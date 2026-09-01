const fs = require('fs');
const path = require('path');

// Read .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
} catch (e) {
  console.log('Error leyendo .env.local');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const CATEGORIES_DATA = [
  { id: 'Buzos', name: 'Buzos', subcategories: ['Urbano', 'Con Capucha', 'Canguro'] },
  { id: 'Camperas', name: 'Camperas', subcategories: ['Deportivas', 'Térmicas', 'Urbana', 'AFA'] },
  { id: 'Calzas', name: 'Calzas', subcategories: ['Deportivas', 'Largas', 'Ciclismo'] },
  { id: 'Camisas', name: 'Camisas', subcategories: ['Leñadoras', 'De Vestir', 'Lino'] },
  { id: 'Gorras', name: 'Gorras', subcategories: ['Accesorios', 'Planas', 'Curvas'] },
  { id: 'Infantil', name: 'Infantil', subcategories: ['Conjuntos', 'Buzos', 'Remeras'] },
  { id: 'Medias', name: 'Medias', subcategories: ['Deportivas', 'Invisibles', 'Packs'] },
  { id: 'Pantalon de Yoguin', name: 'Pantalón Jogging', subcategories: ['Babuchas', 'Rectos', 'Frizados'] },
  { id: 'Perfumeria', name: 'Perfumería', subcategories: ['Fragancias Textiles', 'Ambientadores'] },
  { id: 'Remeras deportivas', name: 'Remeras Deportivas', subcategories: ['DryFit', 'Entrenamiento', 'Musculosas'] },
  { id: 'Top Deportivos', name: 'Top Deportivos', subcategories: ['Alto Impacto', 'Standard'] }
];

const PRODUCTS_DATA = [
  {
    id: 'p-1',
    name: 'Campera de AFA Selección Oficial',
    category: 'Camperas',
    subcategory: 'Deportivas',
    price: 35000,
    wholesale_price: 29900,
    stock: 85,
    sales_count: 340,
    image_url: '/elpaquetero_imagenes/Camperas/campera de Afa.jpg',
    description: 'Campera oficial de la Selección Argentina con tecnología frizada, escudo bordado y cierres reforzados.',
    is_offer: true,
    is_top_seller: true
  },
  {
    id: 'p-2',
    name: 'Buzo The North Face Hooded',
    category: 'Buzos',
    subcategory: 'Urbano',
    price: 22000,
    wholesale_price: 18500,
    stock: 45,
    sales_count: 210,
    image_url: '/elpaquetero_imagenes/Buzos/buzo the north Face N.jpg',
    description: 'Buzo frizado canguro marca The North Face con capucha ajustables y estampa frontal HD.',
    is_offer: false,
    is_top_seller: false
  },
  {
    id: 'p-3',
    name: 'Buzo The North Face Classic Black',
    category: 'Buzos',
    subcategory: 'Urbano',
    price: 21000,
    wholesale_price: 17900,
    stock: 60,
    sales_count: 185,
    image_url: '/elpaquetero_imagenes/Buzos/buzo the north Face.jpg',
    description: 'Buzo básico de friza pesada premium con puños elastizados.',
    is_offer: true,
    is_top_seller: false
  },
  {
    id: 'p-4',
    name: 'Campera de Abrigo Térmica Premium',
    category: 'Camperas',
    subcategory: 'Térmicas',
    price: 42000,
    wholesale_price: 34000,
    stock: 30,
    sales_count: 145,
    image_url: '/elpaquetero_imagenes/Camperas/Campera de abrigo.jpg',
    description: 'Campera inflable de abrigo ultra liviana con relleno térmico de guata siliconada.',
    is_offer: false,
    is_top_seller: false
  },
  {
    id: 'p-5',
    name: 'Campera Urbana de Buzo',
    category: 'Camperas',
    subcategory: 'Urbana',
    price: 27000,
    wholesale_price: 22500,
    stock: 50,
    sales_count: 175,
    image_url: '/elpaquetero_imagenes/Camperas/Campera de buzo Urbana.jpg',
    description: 'Campera combinada en rústico con mangas frizadas y cierre completo.',
    is_offer: true,
    is_top_seller: false
  },
  {
    id: 'p-6',
    name: 'Camperas Deportivas Nike Line',
    category: 'Camperas',
    subcategory: 'Deportivas',
    price: 33000,
    wholesale_price: 28000,
    stock: 40,
    sales_count: 260,
    image_url: '/elpaquetero_imagenes/Camperas/Camperas deportivas nike.jpg',
    description: 'Campera rompeviento microfibra esmerilada con recortes combinados.',
    is_offer: false,
    is_top_seller: true
  },
  {
    id: 'p-7',
    name: 'Campera Deportiva Urban Style',
    category: 'Camperas',
    subcategory: 'Deportivas',
    price: 31000,
    wholesale_price: 26000,
    stock: 35,
    sales_count: 130,
    image_url: '/elpaquetero_imagenes/Camperas/Camperas deportivas urban.jpg',
    description: 'Campera deportiva liviana ideal para entrenamiento o tiempo libre.',
    is_offer: false,
    is_top_seller: false
  },
  {
    id: 'p-8',
    name: 'Campera de Buzo Canguro Rústica',
    category: 'Camperas',
    subcategory: 'Urbana',
    price: 23500,
    wholesale_price: 19500,
    stock: 55,
    sales_count: 160,
    image_url: '/elpaquetero_imagenes/Camperas/camperas de buzo.jpg',
    description: 'Campera rústica de algodón con capucha y bolsillos laterales.',
    is_offer: true,
    is_top_seller: false
  },
  {
    id: 'p-9',
    name: 'Gorra Urbana Curva Varios Colores',
    category: 'Gorras',
    subcategory: 'Accesorios',
    price: 7500,
    wholesale_price: 5500,
    stock: 130,
    sales_count: 410,
    image_url: '/elpaquetero_imagenes/Gorras.jpg',
    description: 'Gorra gabardina de algodón con hebilla metálica de ajuste trasera.',
    is_offer: true,
    is_top_seller: true
  }
];

async function seedTable(tableName, data) {
  const url = `${supabaseUrl}/rest/v1/${tableName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  });

  if (response.ok) {
    console.log(`✓ Tabla ${tableName} sincronizada con éxito en Supabase.`);
  } else {
    const errorText = await response.text();
    console.log(`Aviso en tabla ${tableName}:`, response.status, errorText);
  }
}

async function main() {
  console.log('🚀 Conectando directo a la API REST de Supabase...');
  await seedTable('categories', CATEGORIES_DATA);
  await seedTable('products', PRODUCTS_DATA);
}

main();
