const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const IMAGES_DIR = 'C:\\Users\\jpbor\\OneDrive\\Escritorio\\Dulce Valentin\\drive-download-20261117T142317Z-1-001';
const BUCKET = 'Productos';
const STORAGE_FOLDER = 'catalogo-2026';

function loadEnv() {
  const envPath = path.resolve('.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  });
  return env;
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function convertToWebP(filePath) {
  return await sharp(filePath)
    .rotate()
    .resize(1200, 1500, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

function makeVariantKey(size, color) {
  const s = size ? String(size).trim() : 'SIN_TALLE';
  const c = color ? String(color).trim() : 'SIN_COLOR';
  return `${s}::${c}`;
}

function generateBarcode(code, size, color) {
  const cToken = code.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const sToken = size ? size.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : 'U';
  const colToken = color ? color.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) : 'GEN';
  return `DV${cToken}-${sToken}-${colToken}`;
}

// DEFINICIÓN COMPLETA DE LOS PRODUCTOS
const PRODUCTOS = [
  // --- NIÑOS ---
  {
    name: 'Conjunto Básquet Lakers',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['01.jpg', '03.jpg', '04.jpg', '05.jpg', '37.jpg'],
    wholesale_price: 13000,
    price: 13000,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Azul', 'Verde', 'Negro', 'Rojo']
  },
  {
    name: 'Conjunto Wafle',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['06.jpg'],
    wholesale_price: 6500,
    price: 6500,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Surtido']
  },
  {
    name: 'Chombas Adidas',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['07.jpg'],
    wholesale_price: 9500,
    price: 9500,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Surtido']
  },
  {
    name: 'Conjunto Wafle Essentials',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['08.jpg', '62.jpg'],
    wholesale_price: 16000,
    price: 16000,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Negro', 'Gris', 'Beige', 'Marrón']
  },
  {
    name: 'Conjunto Wafle con Capucha',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['09.jpg'],
    wholesale_price: 14000,
    price: 14000,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Verde', 'Negro', 'Azul', 'Marrón']
  },
  {
    name: 'Camisa Lino',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['11.jpg', '22.jpg'],
    wholesale_price: 7500,
    price: 7500,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Beige', 'Azul', 'Verde', 'Negro', 'Mostaza', 'Marrón', 'Ladrillo']
  },
  {
    name: 'Remeras con Cierre',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['12.jpg'],
    wholesale_price: 8500,
    price: 8500,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Verde', 'Marrón', 'Azul', 'Celeste']
  },
  {
    name: 'Camisa de Creppe',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['14.jpg'],
    wholesale_price: 12000,
    price: 12000,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Batik', 'Negro', 'Beige']
  },
  {
    name: 'Short Lycra',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['15.jpg'],
    wholesale_price: 6500,
    price: 6500,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Negro']
  },
  {
    name: 'Remeras con Cierre Sun',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['16.jpg', '36.jpg'],
    wholesale_price: 14000,
    price: 14000,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Gris', 'Celeste', 'Negro', 'Blanco']
  },
  {
    name: 'Camisa Hawaiana',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['18.jpg'],
    wholesale_price: 6500,
    price: 6500,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Surtidos']
  },
  {
    name: 'Chombas Wafle',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['19.jpg'],
    wholesale_price: 8500,
    price: 8500,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Marrón', 'Negro', 'Beige']
  },
  {
    name: 'Conjunto Puma',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['20.jpg'],
    wholesale_price: 11000,
    price: 11000,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Rojo', 'Blanco']
  },
  {
    name: 'Short de Acetato',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['21.jpg'],
    wholesale_price: 8000,
    price: 8000,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Central', 'Boca', 'River', 'NOB']
  },
  {
    name: 'Conjunto Camisa y Short Wafle',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['23.jpg'],
    wholesale_price: 12000,
    price: 15000,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Negro', 'Blanco', 'Marrón', 'Beige']
  },
  {
    name: 'Conjunto Nike',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['24.jpg'],
    wholesale_price: 9900,
    price: 9900,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Beige', 'Azul', 'Negro', 'Rojo']
  },
  {
    name: 'Conjunto Adidas Algodón',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['25.jpg'],
    wholesale_price: 9900,
    price: 9900,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Verde', 'Beige', 'Negro', 'Gris', 'Verde Agua']
  },
  {
    name: 'Conjunto de Lino con Rayas',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['26.jpg'],
    wholesale_price: 12000,
    price: 12000,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Blanco', 'Marrón', 'Celeste']
  },
  {
    name: 'Remeras Batik de Algodón',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['27.jpg'],
    wholesale_price: 8000,
    price: 8000,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Verde', 'Rojo', 'Celeste', 'Negro', 'Beige']
  },
  {
    name: 'Short Batik',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['28.jpg'],
    wholesale_price: 6500,
    price: 6500,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Mostaza', 'Azul', 'Gris']
  },
  {
    name: 'Short Jordan Algodón',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['29.jpg'],
    wholesale_price: 6500,
    price: 6500,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Marrón', 'Verde', 'Negro']
  },
  {
    name: 'Short Wafle Niño',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['32.jpg'],
    wholesale_price: 5000,
    price: 5000,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Blanco', 'Azul', 'Negro', 'Verde']
  },
  {
    name: 'Conjunto Adidas Deportivo',
    category: 'Infantil',
    subcategory: 'Niño',
    images: ['61.jpg'],
    wholesale_price: 18000,
    price: 18000,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Amarillo', 'Rojo', 'Azul']
  },

  // --- NENA ---
  {
    name: 'Short Pollera Lycra',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['30.jpg'],
    wholesale_price: 5500,
    price: 5500,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Blanco', 'Beige', 'Marrón', 'Negro']
  },
  {
    name: 'Short Estampado Lycra',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['31.jpg'],
    wholesale_price: 3500,
    price: 3500,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Surtidos']
  },
  {
    name: 'Biker Estampada Lycra',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['38.jpg'],
    wholesale_price: 4000,
    price: 4000,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Surtido']
  },
  {
    name: 'Biker Animal Print Lycra',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['34.jpg'],
    wholesale_price: 4000,
    price: 4000,
    sizes: ['4', '6', '8', '10', '12', '14', '16'],
    colors: ['Gris', 'Amarillo', 'Marrón']
  },
  {
    name: 'Short Pollera Lycra Negro',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['35.jpg'],
    wholesale_price: 5500,
    price: 5500,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Negro']
  },
  {
    name: 'Remera de Algodón Estampada Nena',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['40.jpg', '43.jpg', '44.jpg'],
    wholesale_price: 6900,
    price: 6900,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Blanco', 'Negro']
  },
  {
    name: 'Palazzo Animal Print',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['48.jpg', '50.jpg'],
    wholesale_price: 8500,
    price: 8500,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Blanco', 'Beige']
  },
  {
    name: 'Remera con Cierre de Lycra',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['46.jpg', '47.jpg'],
    wholesale_price: 6500,
    price: 6500,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Negro', 'Beige', 'Rosa', 'Blanco']
  },
  {
    name: 'MOM con Brillo',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['51.jpg', '52.jpg', '53.jpg'],
    wholesale_price: 18000,
    price: 18000,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Azul', 'Negro']
  },
  {
    name: 'Bermuda Jean con Tachas',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['57.jpg', '58.jpg'],
    wholesale_price: 14900,
    price: 14900,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Azul', 'Celeste']
  },
  {
    name: 'Bermuda Jean con Brillo',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['59.jpg', '60.jpg'],
    wholesale_price: 14900,
    price: 14900,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Azul', 'Celeste']
  },
  {
    name: 'Short de Lino Nena',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['64.jpg'],
    wholesale_price: 6900,
    price: 6900,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Marrón', 'Negro']
  },
  {
    name: 'Camisa de Jean con Tachas Nena',
    category: 'Infantil',
    subcategory: 'Niña',
    images: ['54.jpg', '55.jpg', '56.jpg'],
    wholesale_price: 18500,
    price: 22000,
    sizes: ['6', '8', '10', '12', '14', '16'],
    colors: ['Celeste']
  }
];

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`=== INICIANDO CARGA ${isDryRun ? '(DRY RUN)' : '(EN PRODUCCIÓN)'} ===`);
  console.log(`Total productos a procesar: ${PRODUCTOS.length}\n`);

  // Verificar que todas las imágenes existan localmente
  let missingFiles = 0;
  for (const p of PRODUCTOS) {
    for (const img of p.images) {
      const fullPath = path.join(IMAGES_DIR, img);
      if (!fs.existsSync(fullPath)) {
        console.error(`ERROR: Archivo no existe: ${fullPath} para producto "${p.name}"`);
        missingFiles++;
      }
    }
  }

  if (missingFiles > 0) {
    console.error(`Faltan ${missingFiles} archivos. Abortando.`);
    process.exit(1);
  }
  console.log('✓ Todas las imágenes verificadas en el disco local.');

  // Obtener último código numérico
  const { data: existingProds, error: codeErr } = await supabase.from('products').select('code');
  if (codeErr) {
    console.error('Error al consultar códigos existentes:', codeErr);
    process.exit(1);
  }

  let nextCodeNum = (existingProds || []).reduce((max, p) => {
    const n = parseInt(p.code, 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0) + 1;

  console.log(`Próximo código a asignar: ${String(nextCodeNum).padStart(4, '0')}\n`);

  const insertedProducts = [];

  for (let i = 0; i < PRODUCTOS.length; i++) {
    const prodDef = PRODUCTOS[i];
    const code = String(nextCodeNum++).padStart(4, '0');
    const id = `p-${code}`;
    const slug = slugify(prodDef.name);

    console.log(`[${i + 1}/${PRODUCTOS.length}] Procesando Art. ${code}: ${prodDef.name} (${prodDef.subcategory})`);

    // 1. Subir fotos a Supabase Storage convertidas a WebP
    const uploadedUrls = [];
    for (let imgIdx = 0; imgIdx < prodDef.images.length; imgIdx++) {
      const imgFileName = prodDef.images[imgIdx];
      const localFilePath = path.join(IMAGES_DIR, imgFileName);
      const storageFilePath = `${STORAGE_FOLDER}/${code}-${slug}-${imgIdx + 1}.webp`;

      if (!isDryRun) {
        const webpBuffer = await convertToWebP(localFilePath);
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storageFilePath, webpBuffer, {
          contentType: 'image/webp',
          upsert: true
        });

        if (uploadError) {
          console.error(`   x Error subiendo ${storageFilePath}:`, uploadError.message);
          continue;
        }

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storageFilePath);
        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      } else {
        uploadedUrls.push(`https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/${BUCKET}/${storageFilePath}`);
      }
    }

    // 2. Armar stock_per_size con 5 unidades por variante (talle x color)
    const stock_per_size = {};
    let totalStock = 0;
    const barcodes = {};

    prodDef.sizes.forEach((s) => {
      const color_stock = {};
      let sizeStock = 0;

      prodDef.colors.forEach((c) => {
        color_stock[c] = 5;
        sizeStock += 5;
        totalStock += 5;

        const variantKey = makeVariantKey(s, c);
        barcodes[variantKey] = generateBarcode(code, s, c);
      });

      stock_per_size[s] = {
        stock: sizeStock,
        colors: prodDef.colors,
        color_stock
      };
    });

    const productRecord = {
      id,
      code,
      name: prodDef.name,
      category: prodDef.category,
      subcategory: prodDef.subcategory,
      description: '',
      price: prodDef.price,
      wholesale_price: prodDef.wholesale_price,
      stock: totalStock,
      stock_per_size,
      sizes: prodDef.sizes,
      colors: prodDef.colors,
      image_url: uploadedUrls[0] || '',
      image_urls: uploadedUrls,
      is_active: true,
      is_new: true,
      is_offer: false,
      is_featured: false,
      is_top_seller: false,
      sales_count: 0,
      exempt_from_min3: false,
      barcodes
    };

    if (!isDryRun) {
      const { error: insertError } = await supabase.from('products').insert(productRecord);
      if (insertError) {
        console.error(`   x ERROR insertando producto ${id}:`, insertError.message);
      } else {
        console.log(`   ✓ Producto guardado en DB con código ${code} | Stock total: ${totalStock} | ${uploadedUrls.length} fotos`);
        insertedProducts.push(productRecord);
      }
    } else {
      console.log(`   [DRY RUN] Simulado OK. Stock: ${totalStock}, Barcodes: ${Object.keys(barcodes).length}`);
      insertedProducts.push(productRecord);
    }
  }

  console.log(`\n=== PROCESO COMPLETADO ===`);
  console.log(`Total productos cargados: ${insertedProducts.length}`);
}

main().catch(console.error);
