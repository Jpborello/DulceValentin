// Carga la segunda tanda de fotos nuevas (0001.webp..0033.webp) de
// C:\Users\jpbor\OneDrive\Escritorio\Productos 10-09-26 (lote del 17/09) como
// productos nuevos en el catalogo, usando las especificaciones de
// productos-Dulce-Valentin.txt (mismo folder, reescrito por Juampi para este
// lote) y las reglas de categorizacion que dio por chat:
//   - Ropa interior de nena (bombacha / conjunto)  -> Infantil > Niña
//   - Bombacha pañalera (bebe)                     -> Bebés > Bombachas Pañaleras
//   - Todo lo demas (colales, vedetina, bombacha de
//     señora, corpiños, conjuntos de dama)         -> Lencería (Bombachas / Corpiños / Conjuntos)
//
// PRECIO: todo el lote trae UN solo precio "la docena", asi que se carga tal
// cual como precio del producto (mismo criterio que la tanda anterior).
// La unica excepcion es el img 0017 (Corpiño de algodón), que trae DOS
// precios por docena segun el talle ("Talle comun" / "Talle especial") -- se
// carga con price_per_size, igual que se hizo con las sabanas Full/Queen/King
// del lote anterior.
//
// FOTOS AGRUPADAS: el txt agrupa varios numeros de foto bajo un mismo
// producto (ej "[IMG 0018 0019 0020] Conjunto triangulito") -- son varias
// fotos del MISMO producto, no productos distintos. Se suben todas y se
// guardan juntas en image_urls (la primera queda como image_url / portada).
//
// Este script:
//   1. Inicia sesion como el admin (RLS).
//   2. Suma las subcategorias nuevas (Niña, Bombachas Pañaleras) a las
//      categorias que ya existen, sin pisar las que ya estaban.
//   3. Por cada producto: sube la(s) foto(s) completa(s) + miniatura al
//      bucket (en una carpeta NUEVA para no pisar las fotos del lote
//      anterior, que usan los mismos nombres 0001..0033), y crea la fila en
//      `products` con un codigo correlativo nuevo.
//
// Es un script de UNA sola vez -- no lo corras dos veces, duplicaria los 23
// productos.
//
// Uso: node scripts/create-new-products-2026-09-17.js

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

// --- .env.local loader (mismo criterio que los otros scripts de /scripts) ---
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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SG-JwsfgUZuPHN23twhBlw_QhaJmwL_';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

const BUCKET = 'Productos';
const IMAGES_DIR = 'C:\\Users\\jpbor\\OneDrive\\Escritorio\\Productos 10-09-26';
// OJO: carpeta distinta a la del lote anterior ("lote-2026-09"), porque las
// fotos de este lote se llaman IGUAL (0001.webp..0033.webp) y pisarian las
// fotos ya usadas por los productos del lote anterior si comparten carpeta.
const STORAGE_FOLDER = 'admin-uploads/lote-2026-09-17';
const THUMB_MAX_WIDTH = 500;
const THUMB_MAX_HEIGHT = 625;
const THUMB_QUALITY = 75;

// --- Los 23 productos (33 fotos, algunas agrupadas) ---
const PRODUCTS = [
  { imgs: ['0001'], name: 'Colales', category: 'Lencería', subcategory: 'Bombachas', price: 22500 },
  { imgs: ['0002'], name: 'Vedetina', category: 'Lencería', subcategory: 'Bombachas', price: 25000 },
  { imgs: ['0003'], name: 'Vedetina', category: 'Lencería', subcategory: 'Bombachas', price: 10000 },
  { imgs: ['0004'], name: 'Vedetina', category: 'Lencería', subcategory: 'Bombachas', price: 18000 },
  { imgs: ['0005'], name: 'Vedetina', category: 'Lencería', subcategory: 'Bombachas', price: 25000 },
  { imgs: ['0006'], name: 'Vedetina', category: 'Lencería', subcategory: 'Bombachas', price: 16000 },
  { imgs: ['0007'], name: 'Bombacha de señora', category: 'Lencería', subcategory: 'Bombachas', price: 24000 },
  { imgs: ['0008'], name: 'Bombacha de señora', category: 'Lencería', subcategory: 'Bombachas', price: 35000 },
  { imgs: ['0009'], name: 'Bombacha de señora', category: 'Lencería', subcategory: 'Bombachas', price: 31000 },
  // Ropa interior de nena -> Infantil (no Lenceria), pidio Juampi.
  { imgs: ['0010'], name: 'Bombacha de nena', category: 'Infantil', subcategory: 'Niña', price: 16000 },
  // Bombacha pañalera (bebe) -> Bebés.
  { imgs: ['0011'], name: 'Bombacha pañalera', category: 'Bebés', subcategory: 'Bombachas Pañaleras', price: 12000 },
  { imgs: ['0012'], name: 'Bombacha pañalera', category: 'Bebés', subcategory: 'Bombachas Pañaleras', price: 7000 },
  { imgs: ['0013'], name: 'Bombacha pañalera', category: 'Bebés', subcategory: 'Bombachas Pañaleras', price: 13000 },
  { imgs: ['0014'], name: 'Bombacha de nena', category: 'Infantil', subcategory: 'Niña', price: 12000 },
  { imgs: ['0015'], name: 'Corpiño de señora', category: 'Lencería', subcategory: 'Corpiños', price: 42000 },
  { imgs: ['0016'], name: 'Corpiño con arco', category: 'Lencería', subcategory: 'Corpiños', price: 65000 },
  // Dos precios por docena segun talle (no es "por unidad") -> price_per_size.
  { imgs: ['0017'], name: 'Corpiño de algodón', category: 'Lencería', subcategory: 'Corpiños', sizes: ['Común', 'Especial'], pricePerSize: { 'Común': 20000, 'Especial': 21000 } },
  { imgs: ['0018', '0019', '0020'], name: 'Conjunto triangulito', category: 'Lencería', subcategory: 'Conjuntos', price: 58000 },
  { imgs: ['0021', '0022', '0023'], name: 'Conjunto de encaje', category: 'Lencería', subcategory: 'Conjuntos', price: 40000 },
  { imgs: ['0024', '0025', '0026', '0027'], name: 'Conjunto capicúa', category: 'Lencería', subcategory: 'Conjuntos', price: 90000 },
  { imgs: ['0028', '0029'], name: 'Conjunto de nena', category: 'Infantil', subcategory: 'Niña', price: 43000 },
  { imgs: ['0030', '0031'], name: 'Conjunto de nena', category: 'Infantil', subcategory: 'Niña', price: 21000 },
  { imgs: ['0032', '0033'], name: 'Conjunto de nena talle único', category: 'Infantil', subcategory: 'Niña', price: 21000 }
];

// El bucket y la tabla exigen un usuario autenticado (RLS) -- ver
// src/app/admin/page.jsx, mismo patron que los otros scripts de /scripts.
async function ensureAdminAuth() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('⚠️  Falta ADMIN_EMAIL/ADMIN_PASSWORD en .env.local: si la base exige sesion, esto va a fallar por RLS.\n');
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.warn(`⚠️  No se pudo iniciar sesion como admin (${email}): ${error.message}\n`);
  } else {
    console.log(`🔐 Sesion iniciada como ${email}.\n`);
  }
}

// Suma subcategorias nuevas a las categorias que ya existen en la base, SIN
// pisar las subcategorias que ya tenian.
async function ensureSubcategories() {
  const neededByCategory = {};
  PRODUCTS.forEach((p) => {
    if (!neededByCategory[p.category]) neededByCategory[p.category] = new Set();
    if (p.subcategory) neededByCategory[p.category].add(p.subcategory);
  });

  for (const [categoryId, subSet] of Object.entries(neededByCategory)) {
    const { data: existing, error } = await supabase.from('categories').select('*').eq('id', categoryId).maybeSingle();
    if (error) {
      console.warn(`⚠️  No pude leer la categoria "${categoryId}": ${error.message}`);
      continue;
    }
    const currentSubs = Array.isArray(existing?.subcategories) ? existing.subcategories : [];
    const merged = Array.from(new Set([...currentSubs, ...subSet]));
    const { error: upsertErr } = await supabase.from('categories').upsert({
      id: categoryId,
      name: existing?.name || categoryId,
      subcategories: merged
    }, { onConflict: 'id' });
    if (upsertErr) {
      console.warn(`⚠️  No pude actualizar subcategorias de "${categoryId}": ${upsertErr.message}`);
    } else {
      console.log(`✓ Subcategorias de "${categoryId}": ${merged.join(', ')}`);
    }
  }
  console.log('');
}

// Codigo correlativo (mismo criterio que dataStore.createProduct).
async function makeCodeGenerator() {
  const { data, error } = await supabase.from('products').select('code');
  if (error) {
    console.warn(`⚠️  No pude leer los codigos existentes (${error.message}), arranco desde 0001.`);
  }
  const rows = data || [];
  const used = new Set(rows.map((p) => p.code).filter(Boolean));
  let next = rows.reduce((max, p) => {
    const n = parseInt(p.code, 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0) + 1;

  return () => {
    let code = String(next).padStart(4, '0');
    while (used.has(code)) {
      next += 1;
      code = String(next).padStart(4, '0');
    }
    next += 1;
    used.add(code);
    return code;
  };
}

async function uploadImageAndThumb(imgNumber) {
  const localPath = path.join(IMAGES_DIR, `${imgNumber}.webp`);
  const buffer = fs.readFileSync(localPath);

  const fullPath = `${STORAGE_FOLDER}/${imgNumber}.webp`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(fullPath, buffer, {
    upsert: true,
    contentType: 'image/webp'
  });
  if (upErr) throw upErr;

  // Miniatura para la grilla -- mismo nombre + "-thumb" (ver getThumbUrl en
  // src/lib/dataStore.js). Si esta parte puntual falla no se corta el alta
  // del producto: la tarjeta cae a la foto completa como respaldo.
  try {
    const thumbBuffer = await sharp(buffer)
      .resize({ width: THUMB_MAX_WIDTH, height: THUMB_MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();
    const thumbPath = fullPath.replace(/\.webp$/i, '-thumb.webp');
    const { error: thumbErr } = await supabase.storage.from(BUCKET).upload(thumbPath, thumbBuffer, {
      upsert: true,
      contentType: 'image/webp'
    });
    if (thumbErr) console.warn(`  ⚠️  No se pudo subir la miniatura de ${imgNumber}: ${thumbErr.message}`);
  } catch (thumbErr) {
    console.warn(`  ⚠️  No se pudo generar la miniatura de ${imgNumber}: ${thumbErr.message || thumbErr}`);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
  return urlData.publicUrl;
}

async function run() {
  await ensureAdminAuth();
  await ensureSubcategories();
  const nextCode = await makeCodeGenerator();

  let created = 0;
  let failed = 0;

  for (const p of PRODUCTS) {
    try {
      // Sube todas las fotos del producto (1 o varias) en orden.
      const imageUrls = [];
      for (const imgNumber of p.imgs) {
        const url = await uploadImageAndThumb(imgNumber);
        imageUrls.push(url);
      }

      const code = nextCode();

      const sizes = p.sizes || [];
      const stock = p.stock !== undefined ? p.stock : 50;
      const stockPerSize = {};
      sizes.forEach((s) => { stockPerSize[s] = stock; });

      const basePrice = p.pricePerSize
        ? Math.min(...Object.values(p.pricePerSize))
        : (p.price || 0);

      const row = {
        id: `p-${code}`,
        code,
        name: p.name,
        category: p.category,
        subcategory: p.subcategory || '',
        description: '',
        price: basePrice,
        wholesale_price: basePrice,
        price_per_size: p.pricePerSize || null,
        stock,
        stock_per_size: stockPerSize,
        sizes,
        colors: p.colors || [],
        image_url: imageUrls[0],
        image_urls: imageUrls,
        is_active: p.isActive !== false,
        is_new: true,
        is_offer: false,
        is_featured: false,
        is_top_seller: false,
        exempt_from_min3: false,
        sales_count: 0
      };

      const { error } = await supabase.from('products').insert(row);
      if (error) throw error;

      created += 1;
      const priceLabel = p.pricePerSize
        ? Object.entries(p.pricePerSize).map(([s, v]) => `${s}:$${v}`).join(' / ')
        : `$${basePrice}`;
      console.log(`✓ [${created}/${PRODUCTS.length}] ${code} - ${p.name} (${p.category} > ${p.subcategory || '-'}) ${priceLabel}  [fotos: ${p.imgs.join(', ')}]`);
    } catch (err) {
      failed += 1;
      console.error(`❌ Error con ${p.imgs.join(',')} "${p.name}":`, err.message || err);
    }
  }

  console.log(`\n🎉 Listo: ${created} productos creados${failed > 0 ? `, ${failed} con error` : ''}.`);
}

run();
