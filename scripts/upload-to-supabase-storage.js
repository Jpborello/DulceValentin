const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
let ws;
try { ws = require('ws'); } catch (e) {}

// Corre con "node" directo, asi que hay que leer .env.local a mano (Next.js
// se lo carga solo, un script suelto no). Sin esto se cae al fallback de
// abajo, que puede quedar desactualizado si la key se rota en Supabase.
(function loadEnvLocal() {
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
})();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
// Fallback SOLO por si no hay .env.local a mano: publishable key actual del
// proyecto (formato nuevo de Supabase). .env.local siempre tiene prioridad.
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SG-JwsfgUZuPHN23twhBlw_QhaJmwL_';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  ...(ws ? { realtime: { transport: ws } } : {})
});

const imgRoot = path.join(__dirname, '..', 'public', 'dulcevalentin_imagenes');
const catalogPath = path.join(__dirname, '..', 'src', 'lib', 'catalogData.js');

function getAllWebpFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllWebpFiles(filePath, fileList);
    } else if (file.toLowerCase().endsWith('.webp')) {
      const relPath = path.relative(imgRoot, filePath).replace(/\\/g, '/');
      fileList.push({ filePath, relPath });
    }
  }
  return fileList;
}

// El bucket exige un usuario autenticado para poder subir (el panel de admin
// funciona porque el navegador ya inicio sesion con Supabase Auth -- ver
// src/app/admin/page.jsx). Sin este paso, un script suelto queda como
// usuario anonimo y Supabase rechaza la subida con "new row violates
// row-level security policy".
async function ensureAdminAuth() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('⚠️  Falta ADMIN_EMAIL/ADMIN_PASSWORD en .env.local: si el bucket exige sesion, la subida va a fallar por RLS.\n');
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.warn(`⚠️  No se pudo iniciar sesion como admin (${email}): ${error.message}\n`);
  } else {
    console.log(`🔐 Sesion iniciada como ${email}.\n`);
  }
}

async function upload() {
  await ensureAdminAuth();

  let bucketName = 'Productos';

  // Check if bucket 'Productos' or 'productos' exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets && buckets.length > 0) {
    const found = buckets.find(b => b.name.toLowerCase() === 'productos');
    if (found) {
      bucketName = found.name;
    }
  }

  console.log(`🚀 Subiendo 160 imágenes al Bucket de Supabase: '${bucketName}' manteniendo la estructura de carpetas...\n`);

  const files = getAllWebpFiles(imgRoot);
  let uploadedCount = 0;
  let catalogContent = fs.readFileSync(catalogPath, 'utf8');

  for (const { filePath, relPath } of files) {
    const fileBuffer = fs.readFileSync(filePath);
    
    // Normalize path to remove accents (e.g. É -> E) for Supabase Storage key compatibility
    const destinationPath = relPath
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(destinationPath, fileBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    if (error) {
      console.error(`❌ Error subiendo '${relPath}':`, error.message);
    } else {
      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(destinationPath);
      const publicUrl = publicUrlData.publicUrl;

      const oldLocalPath = `/dulcevalentin_imagenes/${relPath}`;
      // Replace with public URL safely without $ regex group expansion
      catalogContent = catalogContent.replace(oldLocalPath, () => publicUrl);

      console.log(`✓ [Bucket '${bucketName}'] -> ${destinationPath}`);
      uploadedCount++;
    }
  }

  fs.writeFileSync(catalogPath, catalogContent, 'utf8');
  console.log(`\n🎉 ¡Subida completada con éxito! ${uploadedCount} imágenes subidas a Supabase Storage Bucket '${bucketName}'.`);
}

upload();
