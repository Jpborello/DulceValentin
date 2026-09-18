// Carga las 43 fotos nuevas (0001.webp..0043.webp) de
// C:\Users\jpbor\OneDrive\Escritorio\Productos 10-09-26 como productos
// nuevos en el catalogo, usando las especificaciones de
// productos-Dulce-Valentin.txt (mismo folder) y las reglas de
// categorizacion que dio Juampi por chat:
//   - "boxer de niño" / "slip de niño"        -> Infantil > Niño
//   - Colales / Vedetina (ropa interior dama)  -> Lencería > Bombachas
//   - Toallas, toallones, manteles, repasadores, sábanas -> Blanquería
//
// PRECIO: cuando el texto traia "por unidad" o "pack de Xu" ademas de "por
// docena", se cargo el precio de "por unidad"/"pack" tal cual (es lo que
// paga el cliente por unidad en el sitio). Los que SOLO traian "por
// docena" -- las medias/repasadores de la primera seccion Y los
// colales/vedetina de la seccion "Dama", 10 productos en total -- se
// cargaron con el precio de docena tal cual, SIN dividir, como pidio
// Juampi.
//
// El "Slip de niño" (0031) no tenia precio ("no me pasaron los precios"):
// se crea INACTIVO (is_active: false, no aparece en el sitio) con stock 0,
// listo para completar en cuanto se sepa el precio.
//
// Este script:
//   1. Inicia sesion como el admin (igual que el panel -- lo necesita para
//      poder escribir por las politicas RLS).
//   2. Suma las subcategorias nuevas (Niño, Toallas y Toallones, Manteles,
//      Repasadores) a las categorias que ya existen, sin pisar las que
//      ya estaban.
//   3. Por cada producto: sube la foto completa + su miniatura al bucket,
//      y crea la fila en la tabla `products` con un codigo correlativo
//      nuevo (mismo criterio que usa el panel de admin).
//
// Es un script de UNA sola vez -- no lo corras dos veces, crearia los 43
// productos de nuevo duplicados.
//
// Uso: node scripts/create-new-products-2026-09.js

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
const STORAGE_FOLDER = 'admin-uploads/lote-2026-09';
const THUMB_MAX_WIDTH = 500;
const THUMB_MAX_HEIGHT = 625;
const THUMB_QUALITY = 75;

const ADULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const KIDS_SIZES = ['2', '4', '6', '8', '10', '12', '14', '16'];

// --- Los 43 productos ---
const PRODUCTS = [
  // Medias unisex: Juampi pidio que estas vayan tanto en Mujeres como en
  // Hombres -- como el catalogo no tiene "un producto, dos categorias", se
  // cargan como DOS fichas (mismo nombre/foto/precio, una por categoria).
  // uploadImageAndThumb cachea por numero de foto, asi que no se sube la
  // imagen dos veces al bucket aunque haya dos fichas.
  { img: '0001', name: 'Medias de algodón 3/4', category: 'Mujeres', subcategory: 'Medias', price: 2000 },
  { img: '0001', name: 'Medias de algodón 3/4', category: 'Hombres', subcategory: 'Medias', price: 2000 },
  { img: '0002', name: 'Soquete térmico Puma', category: 'Mujeres', subcategory: 'Medias', price: 4000 },
  { img: '0002', name: 'Soquete térmico Puma', category: 'Hombres', subcategory: 'Medias', price: 4000 },
  { img: '0003', name: 'Medias de toalla', category: 'Mujeres', subcategory: 'Medias', price: 8500 },
  { img: '0003', name: 'Medias de toalla', category: 'Hombres', subcategory: 'Medias', price: 8500 },
  // Medias 3/4 termicas: solo Dama, no es unisex (a diferencia de las demas).
  { img: '0004', name: 'Medias 3/4 térmicas', category: 'Mujeres', subcategory: 'Medias', price: 10000 },
  { img: '0005', name: 'Medias invisibles', category: 'Mujeres', subcategory: 'Medias', price: 1500 },
  { img: '0005', name: 'Medias invisibles', category: 'Hombres', subcategory: 'Medias', price: 1500 },
  { img: '0006', name: 'Medias invisibles', category: 'Mujeres', subcategory: 'Medias', price: 1500 },
  { img: '0006', name: 'Medias invisibles', category: 'Hombres', subcategory: 'Medias', price: 1500 },
  // Medias de bebe: van en Infantil, no en Mujeres.
  { img: '0007', name: 'Medias de bebé', category: 'Infantil', subcategory: 'Bebé', price: 2500 },
  { img: '0008', name: 'Soquete económico', category: 'Mujeres', subcategory: 'Medias', price: 1000 },
  { img: '0008', name: 'Soquete económico', category: 'Hombres', subcategory: 'Medias', price: 1000 },

  { img: '0009', name: 'Juego de toallas secado rápido', category: 'Blanquería', subcategory: 'Toallas y Toallones', price: 7900, colors: ['Turquesa', 'Rosa', 'Lila'] },
  { img: '0010', name: 'Juego de toallón económico', category: 'Blanquería', subcategory: 'Toallas y Toallones', price: 6500, colors: ['Naranja'] },
  { img: '0011', name: 'Juego de toallones fantasía', category: 'Blanquería', subcategory: 'Toallas y Toallones', price: 11000, colors: ['Rojo', 'Lila', 'Fucsia', 'Verde', 'Turquesa', 'Azul', 'Blanco'] },
  { img: '0012', name: 'Juego de toallón palet', category: 'Blanquería', subcategory: 'Toallas y Toallones', price: 15000, colors: ['Bordó', 'Naranja', 'Rosa', 'Verde'] },
  { img: '0013', name: 'Mantel antimancha 240x150', category: 'Blanquería', subcategory: 'Manteles', price: 5000, colors: ['Naranja', 'Lila', 'Verde', 'Azul'] },
  { img: '0014', name: 'Mantel antimancha 240x150', category: 'Blanquería', subcategory: 'Manteles', price: 5000, colors: ['Combinados'] },
  { img: '0015', name: 'Mantel antimancha 240x150', category: 'Blanquería', subcategory: 'Manteles', price: 5000, colors: ['Combinados'] },
  { img: '0016', name: 'Mantel ecocuero 240x150', category: 'Blanquería', subcategory: 'Manteles', price: 10000, colors: ['Azul', 'Negro', 'Amarillo'] },
  { img: '0017', name: 'Mantel de razo 240x150', category: 'Blanquería', subcategory: 'Manteles', price: 8000, colors: ['Rosa', 'Amarillo', 'Verde', 'Naranja', 'Rojo'] },
  { img: '0018', name: 'Repasador de flecos', category: 'Blanquería', subcategory: 'Repasadores', price: 6000 },
  { img: '0019', name: 'Repasador de toalla', category: 'Blanquería', subcategory: 'Repasadores', price: 11000 },
  { img: '0020', name: 'Repasador de microfibra', category: 'Blanquería', subcategory: 'Repasadores', price: 6500 },

  { img: '0021', name: 'Boxer uomo juvenil', category: 'Hombres', subcategory: 'Ropa Interior', price: 3000, sizes: ADULT_SIZES },
  { img: '0022', name: 'Boxer de seda fría', category: 'Hombres', subcategory: 'Ropa Interior', price: 4000, sizes: ADULT_SIZES },
  { img: '0023', name: 'Slip stone', category: 'Hombres', subcategory: 'Ropa Interior', price: 2500, sizes: ADULT_SIZES },
  { img: '0024', name: 'Boxer eyelit', category: 'Hombres', subcategory: 'Ropa Interior', price: 5000, sizes: ADULT_SIZES },
  { img: '0025', name: 'Boxer men', category: 'Hombres', subcategory: 'Ropa Interior', price: 2000, sizes: ADULT_SIZES },
  { img: '0026', name: 'Boxer Calvin Klein', category: 'Hombres', subcategory: 'Ropa Interior', price: 2500, sizes: ADULT_SIZES },
  { img: '0027', name: 'Boxer stone', category: 'Hombres', subcategory: 'Ropa Interior', price: 3500, sizes: ADULT_SIZES },
  { img: '0028', name: 'Boxer uomo de niño', category: 'Infantil', subcategory: 'Niño', price: 3000, sizes: KIDS_SIZES },
  { img: '0029', name: 'Boxer uomo de niño', category: 'Infantil', subcategory: 'Niño', price: 3000, sizes: KIDS_SIZES },
  { img: '0030', name: 'Boxer de niño', category: 'Infantil', subcategory: 'Niño', price: 2500, sizes: KIDS_SIZES },
  { img: '0031', name: 'Slip de niño', category: 'Infantil', subcategory: 'Niño', price: 0, sizes: KIDS_SIZES, isActive: false, stock: 0 },
  { img: '0032', name: 'Boxer Calvin Klein', category: 'Hombres', subcategory: 'Ropa Interior', price: 2000, sizes: ADULT_SIZES },
  { img: '0033', name: 'Boxer uomo de niño', category: 'Infantil', subcategory: 'Niño', price: 2000, sizes: KIDS_SIZES },
  { img: '0034', name: 'Boxer de niño', category: 'Infantil', subcategory: 'Niño', price: 2000, sizes: KIDS_SIZES },

  { img: '0035', name: 'Colales', category: 'Lencería', subcategory: 'Bombachas', price: 14000 },
  { img: '0036', name: 'Colales de algodón', category: 'Lencería', subcategory: 'Bombachas', price: 29000 },
  { img: '0037', name: 'Colales de microfibra', category: 'Lencería', subcategory: 'Bombachas', price: 18000 },
  { img: '0038', name: 'Colales de algodón', category: 'Lencería', subcategory: 'Bombachas', price: 16000 },
  { img: '0039', name: 'Vedetina de algodón', category: 'Lencería', subcategory: 'Bombachas', price: 23000 },

  { img: '0040', name: 'Sábanas infantiles 1 plaza 1/2', category: 'Blanquería', subcategory: 'Sabanas', price: 16000, colors: ['Mini', 'Princesas', 'Cars', 'Mickey'] },
  { img: '0041', name: 'Sábanas 1 plaza 1/2', category: 'Blanquería', subcategory: 'Sabanas', price: 7500, colors: ['Lila', 'Verde', 'Rosa', 'Combinado'] },
  { img: '0042', name: 'Sábanas 2 plazas 1/2', category: 'Blanquería', subcategory: 'Sabanas', price: 8000 },
  { img: '0043', name: 'Sábanas', category: 'Blanquería', subcategory: 'Sabanas', sizes: ['Full', 'Queen', 'King'], pricePerSize: { Full: 19900, Queen: 22000, King: 23000 } }
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

// Suma subcategorias nuevas a las categorias que ya existen en la base,
// SIN pisar las subcategorias que ya tenian (mismo criterio que
// dataStore.addCategory, pero acá se hace a mano via upsert directo).
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

// Codigo correlativo (mismo criterio que dataStore.createProduct): lee los
// codigos que ya existen UNA vez y va incrementando en memoria para los 43.
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

// Algunas fotos se usan en DOS fichas (medias unisex: una en Mujeres y otra
// en Hombres) -- este cache evita subir el mismo archivo dos veces al bucket.
const uploadedUrlCache = new Map();

async function uploadImageAndThumb(imgNumber) {
  if (uploadedUrlCache.has(imgNumber)) {
    return uploadedUrlCache.get(imgNumber);
  }

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
  uploadedUrlCache.set(imgNumber, urlData.publicUrl);
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
      const imageUrl = await uploadImageAndThumb(p.img);
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
        image_url: imageUrl,
        image_urls: [imageUrl],
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
      const flag = p.isActive === false ? '  [INACTIVO -- falta precio]' : '';
      console.log(`✓ [${created}/${PRODUCTS.length}] ${code} - ${p.name} (${p.category} > ${p.subcategory || '-'}) ${priceLabel}${flag}`);
    } catch (err) {
      failed += 1;
      console.error(`❌ Error con ${p.img} "${p.name}":`, err.message || err);
    }
  }

  console.log(`\n🎉 Listo: ${created} productos creados${failed > 0 ? `, ${failed} con error` : ''}.`);
}

run();
