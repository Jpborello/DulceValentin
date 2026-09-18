// Genera una miniatura liviana (".../archivo-thumb.webp") para cada foto de
// producto que ya esta subida al bucket "Productos" de Supabase Storage y
// todavia no tiene una. Es el "backfill" para el catalogo existente: las
// fotos NUEVAS que se suban desde el panel de admin de ahora en mas ya
// generan su miniatura solas (ver src/lib/compressImage.js), pero las que ya
// estaban cargadas antes de ese cambio se quedaron solo con la version
// completa (1200x1500), que es la que hoy se usa tambien en la grilla del
// catalogo -- eso es lo que hace mas pesada la pagina en el celular.
//
// Es seguro correrlo mas de una vez: si una foto ya tiene su "-thumb.webp"
// al lado, se la salta.
//
// Uso:
//   1. npm install --save-dev sharp   (una sola vez; no quedo agregado
//      todavia porque agrega un binario nativo bastante pesado y solo hace
//      falta para este script puntual)
//   2. node scripts/generate-thumbs.js
//
// Corre con la ANON KEY (la misma que ya usa el sitio), asi que solo puede
// escribir en el bucket si sus politicas RLS lo permiten -- igual que ya
// hace scripts/upload-to-supabase-storage.js.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Falta el paquete "sharp". Corre primero:\n   npm install --save-dev sharp\n');
  process.exit(1);
}

// Este script corre con "node" directo (no con "next"), asi que a diferencia
// de la app Next.js nadie le carga .env.local solo -- hay que leerlo a mano.
// Sin esto, se termina usando el valor de emergencia de mas abajo, que en
// algun momento quedo desactualizado y da "signature verification failed".
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) return;
    const key = match[1];
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  });
}
loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
// Fallback SOLO por si no hay .env.local a mano: esta es la publishable key
// actual del proyecto (formato nuevo de Supabase, reemplaza al anon key JWT
// viejo). Si en algun momento se rota, .env.local manda siempre primero.
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SG-JwsfgUZuPHN23twhBlw_QhaJmwL_';

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('⚠️  No se encontro .env.local (o no tiene NEXT_PUBLIC_SUPABASE_ANON_KEY) -- usando la key de emergencia del script.\n');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

const BUCKET = 'Productos';
const THUMB_MAX_WIDTH = 500;
const THUMB_MAX_HEIGHT = 625;
const THUMB_QUALITY = 75;

// Camina el bucket entero recursivamente (Supabase Storage no tiene un
// "list recursivo" nativo: hay que bajar carpeta por carpeta).
async function listAllFiles(prefix = '') {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) {
    console.error(`❌ Error listando "${prefix}":`, error.message);
    return [];
  }

  let files = [];
  for (const entry of data || []) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Las carpetas vienen sin "id"/metadata en la respuesta de Supabase
    if (entry.id === null || entry.metadata === null) {
      const nested = await listAllFiles(fullPath);
      files = files.concat(nested);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

// El bucket exige un usuario autenticado para poder subir (el panel de
// admin funciona porque el navegador ya inicio sesion con Supabase Auth via
// supabase.auth.signInWithPassword -- ver src/app/admin/page.jsx). Este
// script corre suelto con "node", asi que sin este paso queda como usuario
// anonimo y Supabase rechaza la subida con "new row violates row-level
// security policy", pase lo que pase con el nombre/carpeta del archivo.
async function ensureAdminAuth() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('⚠️  Falta ADMIN_EMAIL/ADMIN_PASSWORD en .env.local: si el bucket exige sesion, la subida de miniaturas va a fallar por RLS.\n');
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.warn(`⚠️  No se pudo iniciar sesion como admin (${email}): ${error.message}\n`);
  } else {
    console.log(`🔐 Sesion iniciada como ${email}.\n`);
  }
}

async function run() {
  await ensureAdminAuth();

  console.log('🔍 Listando fotos existentes en el bucket...\n');
  const allFiles = await listAllFiles('');
  const webpFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.webp') && !f.toLowerCase().endsWith('-thumb.webp'));
  const existingThumbs = new Set(allFiles.filter((f) => f.toLowerCase().endsWith('-thumb.webp')));

  const pending = webpFiles.filter((f) => !existingThumbs.has(f.replace(/\.webp$/i, '-thumb.webp')));

  console.log(`Encontradas ${webpFiles.length} fotos, ${pending.length} sin miniatura todavia.\n`);

  let done = 0;
  let failed = 0;

  for (const filePath of pending) {
    try {
      const { data: fileBlob, error: downloadErr } = await supabase.storage.from(BUCKET).download(filePath);
      if (downloadErr) throw downloadErr;

      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      const thumbBuffer = await sharp(buffer)
        .resize({ width: THUMB_MAX_WIDTH, height: THUMB_MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toBuffer();

      const thumbPath = filePath.replace(/\.webp$/i, '-thumb.webp');
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(thumbPath, thumbBuffer, {
        upsert: true,
        contentType: 'image/webp'
      });
      if (uploadErr) throw uploadErr;

      done += 1;
      console.log(`✓ [${done}/${pending.length}] ${thumbPath}`);
    } catch (err) {
      failed += 1;
      console.error(`❌ Error con "${filePath}":`, err.message || err);
    }
  }

  console.log(`\n🎉 Listo: ${done} miniaturas generadas${failed > 0 ? `, ${failed} con error` : ''}.`);
}

run();
