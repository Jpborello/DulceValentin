/**
 * Script de carga automática para los nuevos productos definidos en Productos.md
 * - Convierte todas las fotos .jpeg de carga/ a .webp usando sharp con compresión optimizada.
 * - Sube las fotos convertidas a Supabase Storage (bucket 'Productos').
 * - Asocia las múltiples fotos a cada producto en el array `image_urls` (y portada en `image_url`).
 * - Registra las categorías y subcategorías correspondientes ('Bebés', 'Calzado', etc.).
 * - Guarda los productos en la tabla `products` de Supabase con código correlativo.
 *
 * Uso:
 *   node scripts/cargar-nuevos-productos.js --dry-run   (para verificar mapeos sin escribir en DB)
 *   node scripts/cargar-nuevos-productos.js             (para procesar y subir todo a Supabase)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..');
const CARGA = path.join(ROOT, 'carga');
const BUCKET = 'Productos';
const STORAGE_FOLDER = 'catalogo-2026';

const DRY_RUN = process.argv.includes('--dry-run');

function loadEnv() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

const env = loadEnv();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_SERVICE_ROLE_KEY.includes('COMPLETAR') ? env.SUPABASE_SERVICE_ROLE_KEY : null;
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function authenticate() {
  if (serviceKey) return console.log('✓ Usando Service Role Key');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD
  });
  if (error) throw new Error('Error al autenticar admin en Supabase: ' + error.message);
  console.log('✓ Admin autenticado con éxito:', data.user.email);
}

// Mapeo detallado y curado de todos los productos de Productos.md
const PRODUCTOS_DEFS = [
  {
    name: 'Ajuar Cajita 7 Piezas RN',
    category: 'Bebés',
    subcategory: 'Ajuar y Sets',
    wholesale_price: 21000,
    sizes: ['RN'],
    description: 'Set de ajuar 7 piezas de algodón en cajita talle único RN. Incluye: 1 mantita, 1 ranita, 1 gorrito, 1 manopla, 1 babero, 1 body y 1 batita.',
    imagePrefixes: ['001', '002', '003', '004', '005', '006', '007', '008']
  },
  {
    name: 'Escarpines de Algodón',
    category: 'Bebés',
    subcategory: 'Accesorios',
    wholesale_price: 3500,
    sizes: ['Único'],
    description: 'Escarpines de algodón para bebé, variedad de colores disponibles. Precio por unidad $3.500 (Por docena $12.000).',
    imagePrefixes: ['010', '011']
  },
  {
    name: 'Sábanas de Bebé 90x120cm',
    category: 'Bebés',
    subcategory: 'Blanquería y Cuidado',
    wholesale_price: 16000,
    sizes: ['90x120'],
    description: 'Juego de sábanas para cuna / practicuna 90cm x 120cm. Incluye sábana ajustable y funda de almohadita con diseños estampados.',
    imagePrefixes: ['020', '021', '022', '024']
  },
  {
    name: 'Body Mangas Largas Liso',
    category: 'Bebés',
    subcategory: 'Bodys',
    wholesale_price: 5500,
    sizes: ['1', '2', '3', '4', '5', '6'],
    description: 'Body de mangas largas de algodón suave, variedad de colores surtidos del talle 1 al 6.',
    imagePrefixes: ['030', '031', '032']
  },
  {
    name: 'Ranitas sin Pie Estampadas (Pack x3)',
    category: 'Bebés',
    subcategory: 'Ranitas y Pantalones',
    wholesale_price: 10000,
    sizes: ['1', '2', '3', '4', '5', '6'],
    description: 'Ranitas sin pie estampadas del talle 1 al 6. Pack x3 unidades a $10.000 ($3.333 por prenda).',
    imagePrefixes: ['040', '041', '042']
  },
  {
    name: 'Conjunto Enterito + Gorrito',
    category: 'Bebés',
    subcategory: 'Enteritos',
    wholesale_price: 8500,
    sizes: ['1', '2', '3', '4', '5', '6'],
    description: 'Enterito estampado de algodón con gorrito haciendo juego, del talle 1 al 6.',
    imagePrefixes: ['050', '051', '052', '053']
  },
  {
    name: 'Body Estampado Mangas Largas',
    category: 'Bebés',
    subcategory: 'Bodys',
    wholesale_price: 5900,
    sizes: ['1', '2', '3', '4', '5', '6'],
    description: 'Body estampado mangas largas en algodón peinado premium del talle 1 al 6.',
    imagePrefixes: ['070', '071', '072', '073']
  },
  {
    name: 'Conjunto Recibidor + Babero',
    category: 'Bebés',
    subcategory: 'Ajuar y Sets',
    wholesale_price: 5500,
    sizes: ['RN'],
    description: 'Set recibidor para recién nacido incluye batita y babero bandana de algodón.',
    imagePrefixes: ['080']
  },
  {
    name: 'Cambiador de Bebé Varios Colores',
    category: 'Bebés',
    subcategory: 'Blanquería y Cuidado',
    wholesale_price: 6900,
    sizes: ['Único'],
    description: 'Cambiador acolchado impermeable para bolso maternal o cuna, fácil de limpiar.',
    imagePrefixes: ['090']
  },
  {
    name: 'Set Toallón con Capucha + Toallita',
    category: 'Bebés',
    subcategory: 'Blanquería y Cuidado',
    wholesale_price: 7500,
    sizes: ['Único'],
    description: 'Toallón de bebé con capucha estampada más toallita de mano haciendo juego.',
    imagePrefixes: ['110']
  },
  {
    name: 'Set Nidito Contenedor + Cambiador + Almohadita',
    category: 'Bebés',
    subcategory: 'Blanquería y Cuidado',
    wholesale_price: 36000,
    sizes: ['Único'],
    description: 'Set completo de descanso: Nidito reductor contenedor + cambiador acolchado + almohadita para recién nacido.',
    imagePrefixes: ['100']
  },
  {
    name: 'Almohadón Lunita de Amamantar',
    category: 'Bebés',
    subcategory: 'Blanquería y Cuidado',
    wholesale_price: 19000,
    sizes: ['Único'],
    description: 'Almohadón contenedor tipo lunita de descanso y amamantamiento para beba y bebé.',
    imagePrefixes: ['130']
  },
  {
    name: 'Babita de Algodón',
    category: 'Bebés',
    subcategory: 'Accesorios',
    wholesale_price: 1500,
    sizes: ['Único'],
    description: 'Babita de toalla y algodón doble faz. Por unidad $1.500 (Por docena $13.000).',
    imagePrefixes: ['120']
  },
  {
    name: 'Porta Chupete Artesanal',
    category: 'Bebés',
    subcategory: 'Accesorios',
    wholesale_price: 2500,
    sizes: ['Único'],
    description: 'Porta chupete de tela y clip de seguridad.',
    imagePrefixes: ['150']
  },
  {
    name: 'Baberos Bandana Estampados',
    category: 'Bebés',
    subcategory: 'Accesorios',
    wholesale_price: 3000,
    sizes: ['Único'],
    description: 'Babero bandana estampado con broche de ajuste, algodón absorbente.',
    imagePrefixes: ['140']
  },
  {
    name: 'Cajita Ajuar RN 3 Piezas',
    category: 'Bebés',
    subcategory: 'Ajuar y Sets',
    wholesale_price: 8000,
    sizes: ['RN'],
    description: 'Cajita para regalo recién nacido 3 piezas: 1 batita, 1 ranita y 1 gorrito.',
    imagePrefixes: ['160', '161', '162']
  },
  {
    name: 'Cajita Ajuar RN 4 Piezas',
    category: 'Bebés',
    subcategory: 'Ajuar y Sets',
    wholesale_price: 9900,
    sizes: ['RN'],
    description: 'Cajita para recién nacido 4 piezas: 1 batita mangas cortas, 1 ranita, 1 gorrito y 1 par de manoplas.',
    imagePrefixes: ['170', '171', '172']
  },
  {
    name: 'Jeans de Bebé Elastizados',
    category: 'Bebés',
    subcategory: 'Ranitas y Pantalones',
    wholesale_price: 13000,
    sizes: ['2', '3', '4', '5', '6'],
    description: 'Pantalón de jeans elastizado súper cómodo para beba y bebé del talle 2 al 6.',
    imagePrefixes: ['350', '351']
  },
  {
    name: 'Ranitas con Pie de Algodón (Pack x3)',
    category: 'Bebés',
    subcategory: 'Ranitas y Pantalones',
    wholesale_price: 10000,
    sizes: ['1', '2', '3', '4', '5', '6'],
    description: 'Ranitas con pie de algodón interlock. Pack x3 unidades a $10.000.',
    imagePrefixes: ['0050']
  },
  {
    name: 'Body Estampado Mangas Cortas',
    category: 'Bebés',
    subcategory: 'Bodys',
    wholesale_price: 5000,
    sizes: ['1', '2', '3', '4', '5', '6'],
    description: 'Body mangas cortas de algodón con broches metálicos reforzados del talle 1 al 6.',
    imagePrefixes: ['190', '191', '192']
  },
  {
    name: 'Body con Volados de Nena',
    category: 'Bebés',
    subcategory: 'Bodys',
    wholesale_price: 5900,
    sizes: ['1', '2', '3', '4', '5', '6'],
    description: 'Body con detalle de voladitos para nena, confeccionado en algodón suave del talle 1 al 6.',
    imagePrefixes: ['180', '181', '182']
  },
  {
    name: 'Medias de Bebé Surtidas (Pack x3)',
    category: 'Bebés',
    subcategory: 'Accesorios',
    wholesale_price: 2500,
    sizes: ['0-6m', '6-12m'],
    description: 'Medias de algodón para bebé. Pack de 3 pares $2.500 (Por docena $8.000).',
    imagePrefixes: ['0010']
  },
  {
    name: 'Medias de Bebé Baby con Diseño (Pack x3)',
    category: 'Bebés',
    subcategory: 'Accesorios',
    wholesale_price: 3000,
    sizes: ['0-6m', '6-12m'],
    description: 'Medias Baby con motivos infantiles. Pack de 3 pares $3.000 (Por docena $9.000).',
    imagePrefixes: ['0020']
  },
  {
    name: 'Medias de Bebé Valtex',
    category: 'Bebés',
    subcategory: 'Accesorios',
    wholesale_price: 1500,
    sizes: ['0-6m', '6-12m'],
    description: 'Medias de bebé Valtex de primera calidad. Por unidad $1.500 (Por docena $9.000).',
    imagePrefixes: ['0030']
  },
  {
    name: 'Medias de Beba con Encaje (Pack x3)',
    category: 'Bebés',
    subcategory: 'Accesorios',
    wholesale_price: 2500,
    sizes: ['0-6m', '6-12m'],
    description: 'Medias para beba con detalles delicados. Pack de 3 pares $2.500 (Por docena $8.000).',
    imagePrefixes: ['0001']
  },
  {
    name: 'Sombrerito Piluso Infantil',
    category: 'Bebés',
    subcategory: 'Accesorios',
    wholesale_price: 5000,
    sizes: ['1', '2', '3', '4'],
    description: 'Gorrito piluso playero de algodón para protección solar del talle 1 al 4.',
    imagePrefixes: ['0040']
  },
  {
    name: 'Bolso Maternal Estampado + Cambiador',
    category: 'Bebés',
    subcategory: 'Bolsos Maternales',
    wholesale_price: 17900,
    sizes: ['Único'],
    description: 'Bolso maternal amplio con compartimientos internos, correa regulable y cambiador portátil haciendo juego.',
    imagePrefixes: ['210', '211', '212', '213']
  },
  {
    name: 'Bolso Maternal de Jeans Premium',
    category: 'Bebés',
    subcategory: 'Bolsos Maternales',
    wholesale_price: 19900,
    sizes: ['Único'],
    description: 'Bolso maternal confeccionado en tela de jeans reforzada con detalles en ecocuero y gran capacidad.',
    imagePrefixes: ['200', '201', '203']
  },
  // --- SECCIÓN CALZADO / ZAPATILLAS ---
  {
    name: 'Zapatillas Adidas de Niño',
    category: 'Calzado',
    subcategory: 'Infantil',
    wholesale_price: 19000,
    sizes: ['21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34'],
    description: 'Zapatillas deportivas adidas para niño/a, suela antideslizante del 21 al 34.',
    imagePrefixes: ['1000', '1001']
  },
  {
    name: 'Zapatillas Puma de Niño',
    category: 'Calzado',
    subcategory: 'Infantil',
    wholesale_price: 19000,
    sizes: ['21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34'],
    description: 'Zapatillas urbanas Puma para niño del talle 21 al 34.',
    imagePrefixes: ['1080']
  },
  {
    name: 'Zapatillas Nike Niños',
    category: 'Calzado',
    subcategory: 'Infantil',
    wholesale_price: 18000,
    sizes: ['21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34'],
    description: 'Zapatillas deportivas Nike para niños del talle 21 al 34.',
    imagePrefixes: ['1070', '1071', '1072']
  },
  {
    name: 'Zapatillas Campus Urbanas',
    category: 'Calzado',
    subcategory: 'Infantil',
    wholesale_price: 18000,
    sizes: ['17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34'],
    description: 'Zapatillas estilo Campus de gamuza con cordones anchos del talle 17 al 34.',
    imagePrefixes: ['1030', '1031']
  },
  {
    name: 'Zapatillas Lacoste Niños',
    category: 'Calzado',
    subcategory: 'Infantil',
    wholesale_price: 14900,
    sizes: ['21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34'],
    description: 'Zapatillas urbanas Lacoste con abrojos o cordones del talle 21 al 34.',
    imagePrefixes: ['1050', '1051', '1052']
  },
  {
    name: 'Zapatillas Vans Infantiles',
    category: 'Calzado',
    subcategory: 'Infantil',
    wholesale_price: 17000,
    sizes: ['17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34'],
    description: 'Zapatillas clásicas Vans urbanas para niños del talle 17 al 34.',
    imagePrefixes: ['2020']
  },
  {
    name: 'Zapatillas Adidas Urbanas Adulto',
    category: 'Calzado',
    subcategory: 'Hombre',
    wholesale_price: 19500,
    sizes: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
    description: 'Zapatillas Adidas clásicas urbanas de suela de goma del talle 35 al 44.',
    imagePrefixes: ['1020']
  },
  {
    name: 'Zapatillas Nike Urbanas Adulto',
    category: 'Calzado',
    subcategory: 'Hombre',
    wholesale_price: 19500,
    sizes: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
    description: 'Zapatillas Nike urbanas unisex del talle 35 al 44.',
    imagePrefixes: ['1060']
  },
  {
    name: 'Zapatillas DC Shoes Skate',
    category: 'Calzado',
    subcategory: 'Hombre',
    wholesale_price: 28000,
    sizes: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
    description: 'Zapatillas DC Shoes acolchadas tipo skate del talle 35 al 44.',
    imagePrefixes: ['1040', '1041']
  },
  {
    name: 'Zapatillas Vans Botitas Sk8-Hi',
    category: 'Calzado',
    subcategory: 'Hombre',
    wholesale_price: 26000,
    sizes: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
    description: 'Zapatillas botitas Vans caña alta Sk8-Hi del talle 35 al 44.',
    imagePrefixes: ['1090', '1091']
  },
  {
    name: 'Zapatillas Vans KNU Skool',
    category: 'Calzado',
    subcategory: 'Hombre',
    wholesale_price: 26000,
    sizes: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
    description: 'Zapatillas Vans KNU acolchadas con cordones gordos en blanco y negro del talle 35 al 44.',
    imagePrefixes: ['2000', '2001', '2003']
  },
  {
    name: 'Zapatillas Vans Old Skool Urban',
    category: 'Calzado',
    subcategory: 'Hombre',
    wholesale_price: 22000,
    sizes: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
    description: 'Zapatillas Vans Old Skool urbanas unisex del talle 35 al 44.',
    imagePrefixes: ['2010', '2011', '2012']
  },
  // --- CHANCLETAS Y LONAS (Presentes en carga/) ---
  {
    name: 'Chancletas Adidas Adilette Hombre',
    category: 'Calzado',
    subcategory: 'Hombre',
    wholesale_price: 12500,
    sizes: ['39', '40', '41', '42', '43', '44'],
    description: 'Ojotas / Chancletas Adidas con faja anatómica en varios colores para hombre.',
    imagePrefixes: ['300', '301', '302']
  },
  {
    name: 'Chancletas Adidas Pastel Dama',
    category: 'Calzado',
    subcategory: 'Mujer',
    wholesale_price: 12500,
    sizes: ['35', '36', '37', '38', '39', '40'],
    description: 'Chancletas Adidas tonos pastel (lila, rosa) para mujer.',
    imagePrefixes: ['310', '311', '312']
  },
  {
    name: 'Chancletas Alo Comfort',
    category: 'Calzado',
    subcategory: 'Mujer',
    wholesale_price: 13000,
    sizes: ['35', '36', '37', '38', '39', '40'],
    description: 'Ojotas / Chancletas Alo acolchadas en amarillo, rosa, turquesa y verde.',
    imagePrefixes: ['320', '321', '322', '323']
  },
  {
    name: 'Chancletas Lacoste Cocodrilo',
    category: 'Calzado',
    subcategory: 'Hombre',
    wholesale_price: 13500,
    sizes: ['39', '40', '41', '42', '43', '44'],
    description: 'Chancletas Lacoste con logo cocodrilo en relieve.',
    imagePrefixes: ['330', '331']
  },
  {
    name: 'Chancletas Nike Slide',
    category: 'Calzado',
    subcategory: 'Hombre',
    wholesale_price: 13000,
    sizes: ['39', '40', '41', '42', '43', '44'],
    description: 'Chancletas deportivas Nike Slide con amortiguación.',
    imagePrefixes: ['340', '341', '342']
  },
  {
    name: 'Zapatillas de Lona Clásicas',
    category: 'Calzado',
    subcategory: 'Infantil',
    wholesale_price: 12000,
    sizes: ['21', '22', '23', '24', '25', '26', '27', '28', '29', '30'],
    description: 'Zapatillas náuticas de lona clásicas con puntera de goma para niños.',
    imagePrefixes: ['1010', '1011', '1012']
  }
];

// Helper para convertir cualquier imagen en buffer WebP usando sharp
async function convertToWebP(filePath) {
  return await sharp(filePath)
    .rotate() // Respeta orientacion EXIF
    .resize(1200, 1500, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

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

async function run() {
  console.log('=== CARGA DE NUEVOS PRODUCTOS (CONVERTIDOS A WEBP + MULTI-IMAGEN) ===\n');
  await authenticate();

  const filesInCarga = fs.readdirSync(CARGA);

  // Obtener último código numérico para continuar la correlatividad
  const { data: existingProds } = await supabase.from('products').select('code');
  let nextNumericCode = (existingProds || []).reduce((max, p) => {
    const n = parseInt(p.code, 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0) + 1;

  console.log(`Próximo código inicial a asignar: ${String(nextNumericCode).padStart(4, '0')}\n`);

  const productsToUpsert = [];
  const processedFiles = new Set();

  for (let i = 0; i < PRODUCTOS_DEFS.length; i++) {
    const def = PRODUCTOS_DEFS[i];
    const code = String(nextNumericCode++).padStart(4, '0');
    const id = `p-${code}-${slugify(def.name)}`;

    // Buscar todos los archivos en carga/ cuyo prefijo numérico exacto coincida
    const matchedFiles = [];
    for (const prefix of def.imagePrefixes) {
      const found = filesInCarga.filter((f) => {
        const m = f.match(/^(\d+)/);
        return m && m[1] === prefix;
      });
      found.forEach((f) => {
        if (!matchedFiles.includes(f)) matchedFiles.push(f);
        processedFiles.add(f);
      });
    }

    if (matchedFiles.length === 0) {
      console.warn(`[!] ALERTA: No se encontraron imágenes para ${def.name} (Prefijos: ${def.imagePrefixes.join(', ')})`);
      continue;
    }

    console.log(`\n[${code}] ${def.name}`);
    console.log(`    Categoría: ${def.category} > ${def.subcategory} | Precio: $${def.wholesale_price.toLocaleString('es-AR')}`);
    console.log(`    ${matchedFiles.length} foto(s) a convertir a .webp y subir:`, matchedFiles);

    const imageUrls = [];

    for (let imgIdx = 0; imgIdx < matchedFiles.length; imgIdx++) {
      const originalFile = matchedFiles[imgIdx];
      const localPath = path.join(CARGA, originalFile);
      const webpFileName = `${id}-${imgIdx + 1}.webp`;
      const storagePath = `${STORAGE_FOLDER}/${webpFileName}`;

      if (!DRY_RUN) {
        // 1. Convertir a WebP
        const webpBuffer = await convertToWebP(localPath);

        // 2. Subir al bucket 'Productos'
        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(storagePath, webpBuffer, {
          contentType: 'image/webp',
          upsert: true
        });

        if (uploadErr) {
          console.error(`    x Error subiendo ${storagePath}:`, uploadErr.message);
          continue;
        }

        // 3. Obtener URL pública
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        if (urlData?.publicUrl) {
          imageUrls.push(urlData.publicUrl);
        }
      } else {
        imageUrls.push(`https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/${BUCKET}/${storagePath}`);
      }
    }

    const stockPerSize = {};
    def.sizes.forEach((s) => { stockPerSize[s] = 50; });

    productsToUpsert.push({
      id,
      code,
      name: def.name,
      category: def.category,
      subcategory: def.subcategory,
      wholesale_price: def.wholesale_price,
      price: def.wholesale_price,
      description: def.description,
      sizes: def.sizes,
      stock_per_size: stockPerSize,
      stock: 50 * def.sizes.length,
      image_url: imageUrls[0] || '/logo.png',
      image_urls: imageUrls,
      is_active: true,
      is_new: true,
      is_offer: false,
      is_featured: false,
      is_top_seller: false,
      sales_count: 0
    });
  }

  console.log(`\n========================================`);
  console.log(`Total productos preparados: ${productsToUpsert.length}`);
  console.log(`Total fotos procesadas de carga/: ${processedFiles.size} de ${filesInCarga.length}`);

  const unused = filesInCarga.filter((f) => !processedFiles.has(f));
  if (unused.length > 0) {
    console.log(`Archivos sin procesar (${unused.length}):`, unused);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN]: No se guardaron cambios en Supabase.');
    return;
  }

  console.log('\nGuardando productos en la base de datos de Supabase...');
  const { error: upsertErr } = await supabase.from('products').upsert(productsToUpsert, { onConflict: 'id' });
  if (upsertErr) {
    throw new Error('Error al guardar productos en Supabase: ' + upsertErr.message);
  }

  console.log('✓ ¡Todos los productos fueron guardados con éxito!');

  // Actualizar categorías en Supabase para asegurar que existan las nuevas subcategorías
  console.log('\nActualizando subcategorías en Supabase...');
  const catMap = {
    'Bebés': ['Ajuar y Sets', 'Bodys', 'Enteritos', 'Ranitas y Pantalones', 'Accesorios', 'Blanquería y Cuidado', 'Bolsos Maternales'],
    'Calzado': ['Infantil', 'Hombre', 'Mujer']
  };

  for (const [catId, subcats] of Object.entries(catMap)) {
    const { data: existingCat } = await supabase.from('categories').select('*').eq('id', catId).maybeSingle();
    const currentSubs = existingCat?.subcategories || [];
    const merged = Array.from(new Set([...currentSubs, ...subcats]));
    await supabase.from('categories').upsert({
      id: catId,
      name: catId,
      subcategories: merged
    }, { onConflict: 'id' });
    console.log(`✓ Categoría "${catId}" sincronizada con ${merged.length} subcategorías.`);
  }

  console.log('\n🎉 ¡PROCESO DE CARGA COMPLETADO AL 100%! 🎉');
}

run().catch((err) => {
  console.error('\n❌ ERROR FATAL:', err);
  process.exit(1);
});
