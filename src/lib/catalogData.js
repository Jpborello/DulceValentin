// Categorías del catálogo de Dulce Valentín. El precio que se carga es
// directamente el precio mayorista (no se aplica ningun descuento/markup automatico).

export const CATALOG_CATEGORIES = [
  { id: 'all', name: 'Todos los Productos' },
  {
    id: 'Hombres',
    name: 'Hombres',
    subcategories: ['Buzos', 'Camperas', 'Camisas', 'Pantalon', 'Remeras y Chombas', 'Ropa Interior']
  },
  {
    id: 'Mujeres',
    name: 'Mujeres',
    // 'Ropa Intima' se mudo a la categoria Lenceria (ver RETIRED_SUBCATEGORIES).
    subcategories: ['Camperas', 'Buzos y abrigos', 'Pantalones y Calzas', 'Remeras', 'Medias', 'Otros Productos']
  },
  { 
    id: 'Infantil', 
    name: 'Infantil', 
    subcategories: ['Indumentaria Infantil'] 
  },
  { 
    id: 'Blanquería', 
    name: 'Blanquería', 
    subcategories: ['Sabanas'] 
  },
  {
    id: 'Perfumería',
    name: 'Perfumería',
    subcategories: ['Perfumes y Cremas']
  },
  {
    id: 'Calzado',
    name: 'Calzado',
    // 'Niño' y 'Niña' se unificaron en 'Infantil' (ver SUBCATEGORY_ALIASES).
    subcategories: ['Hombre', 'Mujer', 'Infantil']
  },
  {
    id: 'Lencería',
    name: 'Lencería',
    subcategories: ['Conjuntos', 'Corpiños', 'Bombachas', 'Bodies', 'Camisones y Batas', 'Portaligas']
  },
  {
    id: 'Bebés',
    name: 'Bebés',
    subcategories: ['Niños', 'Niñas']
  },
  {
    id: 'Complementos',
    name: 'Complementos',
    subcategories: ['Mochilas', 'Carteras', 'Bolsos', 'Billeteras', 'Gorras', 'Otros accesorios']
  }
];

/* ==========================================================================
   Agrupacion de categorias para el home
   --------------------------------------------------------------------------
   El modelo de datos (tabla `categories` de Supabase + campo `category` /
   `subcategory` de cada producto) es de DOS niveles. Estas constantes agregan
   un tercer nivel SOLO de navegacion: las 4 cards principales del home
   agrupan categorias que ya existen, sin tocar la base ni los productos.

       card Indumentaria  ->  categoria Hombres  ->  subcategoria Remeras
       (grupo, solo UI)        (dato real)            (dato real)
   ========================================================================== */

// Subcategorias que se retiraron de una categoria porque se mudaron a otra.
// getCategories() las filtra aunque sigan viniendo de Supabase (el merge de
// categorias nunca borra, solo suma, asi que hace falta la exclusion explicita).
export const RETIRED_SUBCATEGORIES = {
  'Mujeres': ['Ropa Intima', 'Ropa Íntima']
};

// Subcategorias renombradas. Se muestran con el nombre nuevo y los productos
// viejos siguen entrando en el filtro (ver normalizeSubcategory).
export const SUBCATEGORY_ALIASES = {
  'Calzado': {
    'Niño': 'Infantil',
    'Niña': 'Infantil',
    'Nino': 'Infantil',
    'Nina': 'Infantil',
    'Niños': 'Infantil',
    'Niñas': 'Infantil'
  }
};

const normKey = (str) =>
  (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Devuelve el nombre vigente de una subcategoria dentro de una categoria. */
export const normalizeSubcategory = (categoryName, subcategoryName) => {
  const aliases = SUBCATEGORY_ALIASES[categoryName];
  if (!aliases || !subcategoryName) return subcategoryName;
  const hit = Object.keys(aliases).find((k) => normKey(k) === normKey(subcategoryName));
  return hit ? aliases[hit] : subcategoryName;
};

/** true si esa subcategoria ya no corresponde mostrarla en esa categoria. */
export const isRetiredSubcategory = (categoryName, subcategoryName) => {
  const retired = RETIRED_SUBCATEGORIES[categoryName];
  if (!retired || !subcategoryName) return false;
  return retired.some((r) => normKey(r) === normKey(subcategoryName));
};

/**
 * Las 4 cards principales del home.
 *
 * Cada `item` es de uno de dos tipos:
 *   - hoja      { label, category, subcategory }  -> filtra directo
 *   - columna   { label, category, expand: true } -> lista las subcategorias
 *                                                    vivas de esa categoria
 */
export const HOME_CATEGORY_GROUPS = [
  {
    id: 'calzado',
    name: 'Calzado',
    tagline: 'Zapatillas y calzado para toda la familia',
    items: [
      { label: 'Hombre', category: 'Calzado', subcategory: 'Hombre' },
      { label: 'Mujer', category: 'Calzado', subcategory: 'Mujer' },
      { label: 'Infantil', category: 'Calzado', subcategory: 'Infantil' }
    ]
  },
  {
    id: 'indumentaria',
    name: 'Indumentaria',
    tagline: 'Ropa de hombre, mujer e infantil',
    items: [
      { label: 'Hombre', category: 'Hombres', expand: true },
      { label: 'Mujer', category: 'Mujeres', expand: true },
      { label: 'Infantil', category: 'Infantil', expand: true }
    ]
  },
  {
    id: 'lenceria',
    name: 'Lencería',
    tagline: 'Lencería femenina',
    items: [
      { label: 'Lencería', category: 'Lencería', expand: true },
      // Rescata los productos historicos que quedaron cargados como
      // Mujeres > Ropa Intima, hasta que se reasignen a Lenceria.
      { label: 'Ropa íntima', category: 'Mujeres', subcategory: 'Ropa Intima' }
    ]
  },
  {
    id: 'bebes',
    name: 'Bebés',
    tagline: 'Todo para los más chiquitos',
    items: [
      { label: 'Bebés', category: 'Bebés', expand: true }
    ]
  }
];

// Categorias que no entran en las 4 cards y se muestran como accesos chicos
// debajo de la grilla principal.
export const SECONDARY_CATEGORY_IDS = ['Blanquería', 'Perfumería', 'Complementos'];

// Helper para devolver el precio mayorista (sin recargo minorista)
export const calcRetail = (wholesale) => wholesale;

export const DEFAULT_CATEGORY_COLORS = {
  'Hombres': {
    'Buzos': ['Negro', 'Gris Topo', 'Blanco', 'Bordó', 'Azul Marino', 'Rosa', 'Surtido'],
    'Camperas': ['Negro', 'Azul Marino', 'Verde Militar', 'Gris', 'Surtido'],
    'Camisas': ['Blanco', 'Celeste', 'Negro', 'Beige', 'Surtido'],
    'Pantalon': ['Negro', 'Gris', 'Azul', 'Beige', 'Surtido'],
    'Remeras y Chombas': ['Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Surtido'],
    'Ropa Interior': ['Surtido', 'Negro', 'Blanco', 'Gris']
  },
  'Mujeres': {
    'Buzos y abrigos': ['Negro', 'Rosa', 'Blanco', 'Lila', 'Gris', 'Bordó', 'Surtido'],
    'Camperas': ['Negro', 'Beige', 'Rosa', 'Verde', 'Blanco', 'Surtido'],
    'Pantalones y Calzas': ['Negro', 'Gris', 'Azul', 'Fucsia', 'Surtido'],
    'Remeras': ['Blanco', 'Negro', 'Rosa', 'Lila', 'Rojo', 'Surtido'],
    'Medias': ['Surtido', 'Blanco', 'Negro'],
    'Otros Productos': ['Surtido', 'Único']
  },
  'Lencería': {
    'Conjuntos': ['Negro', 'Blanco', 'Nude', 'Rojo', 'Surtido'],
    'Corpiños': ['Negro', 'Blanco', 'Nude', 'Surtido'],
    'Bombachas': ['Negro', 'Blanco', 'Nude', 'Surtido'],
    'Bodies': ['Negro', 'Blanco', 'Rojo', 'Surtido'],
    'Camisones y Batas': ['Negro', 'Rosa', 'Blanco', 'Surtido'],
    'Portaligas': ['Negro', 'Rojo', 'Surtido']
  },
  'Infantil': {
    'Indumentaria Infantil': ['Rosa', 'Celeste', 'Amarillo', 'Blanco', 'Azul', 'Rojo', 'Lila', 'Surtido']
  },
  'Blanquería': {
    'Sabanas': ['Blanco', 'Beige', 'Gris', 'Azul', 'Rosa', 'Surtido']
  },
  'Perfumería': {
    'Perfumes y Cremas': ['Único']
  },
  'Calzado': {
    'Hombre': ['Negro', 'Blanco', 'Gris', 'Marrón', 'Surtido'],
    'Mujer': ['Negro', 'Blanco', 'Beige', 'Rosa', 'Surtido'],
    'Infantil': ['Negro', 'Azul', 'Rosa', 'Blanco', 'Lila', 'Surtido']
  },
  'Bebés': {
    'Niños': ['Celeste', 'Blanco', 'Gris', 'Surtido'],
    'Niñas': ['Rosa', 'Blanco', 'Lila', 'Surtido']
  },
  'Complementos': {
    'Mochilas': ['Negro', 'Gris', 'Azul', 'Surtido'],
    'Carteras': ['Negro', 'Beige', 'Marrón', 'Surtido'],
    'Bolsos': ['Negro', 'Beige', 'Surtido'],
    'Billeteras': ['Negro', 'Marrón', 'Surtido'],
    'Gorras': ['Negro', 'Blanco', 'Azul', 'Surtido'],
    'Otros accesorios': ['Surtido', 'Único']
  }
};

export const getProductColors = (product) => {
  if (!product) return ['Surtido'];
  if (Array.isArray(product.colors) && product.colors.length > 0) {
    return product.colors;
  }
  const categoryMap = DEFAULT_CATEGORY_COLORS[product.category];
  if (categoryMap) {
    if (product.subcategory && categoryMap[product.subcategory]) {
      return categoryMap[product.subcategory];
    }
    const firstSubcatKey = Object.keys(categoryMap)[0];
    if (firstSubcatKey && categoryMap[firstSubcatKey]) {
      return categoryMap[firstSubcatKey];
    }
  }
  return ['Negro', 'Blanco', 'Gris', 'Surtido'];
};

const ADULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const KIDS_SIZES = ['2', '4', '6', '8', '10', '12', '14', '16'];

const createStockPerSize = (sizesArray, countPerSize = 20) => {
  const stockMap = {};
  sizesArray.forEach(size => {
    stockMap[size] = countPerSize;
  });
  return stockMap;
};

export const CATALOG_PRODUCTS = [
  // Catalogo de MUESTRA para que la web no arranque vacia (fotos de muestra,
  // no fotos finales de producto). Se reemplaza / completa desde el admin.
  {
    id: 'dv001',
    code: 'dv001',
    name: 'Body + Pantalón Animal Print',
    category: 'Bebés',
    subcategory: 'Niños',
    wholesale_price: 9800,
    price: calcRetail(9800),
    stock: 20,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Body-pantalon-animal.png',
    description: 'Conjunto de body y pantalón para bebé, estampado animal print.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
  {
    id: 'dv002',
    code: 'dv002',
    name: 'Buzo Infantil',
    category: 'Infantil',
    subcategory: 'Indumentaria Infantil',
    wholesale_price: 12500,
    price: calcRetail(12500),
    stock: 25,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Buzos-infantil2.png',
    description: 'Buzo infantil, colores surtidos.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 51
  },
  {
    id: 'dv003',
    code: 'dv003',
    name: 'Buzo Infantil Frisado',
    category: 'Infantil',
    subcategory: 'Indumentaria Infantil',
    wholesale_price: 13200,
    price: calcRetail(13200),
    stock: 25,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Buzus-infantil.png',
    description: 'Buzo infantil frisado, ideal para media estación.',
    is_offer: true,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
  {
    id: 'dv004',
    code: 'dv004',
    name: 'Caja Regalo Bebé Lila',
    category: 'Bebés',
    subcategory: 'Niñas',
    wholesale_price: 15900,
    price: calcRetail(15900),
    stock: 15,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Caja-BEBE-T-Unico-Lila.png',
    description: 'Set de regalo para bebé, talle único, color lila.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
  {
    id: 'dv005',
    code: 'dv005',
    name: 'Caja Regalo Bebé Rosa',
    category: 'Bebés',
    subcategory: 'Niñas',
    wholesale_price: 15900,
    price: calcRetail(15900),
    stock: 15,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Caja-BEBE-T-Unico-ROsa.png',
    description: 'Set de regalo para bebé, talle único, color rosa.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
  {
    id: 'dv006',
    code: 'dv006',
    name: 'Caja Regalo Bebé',
    category: 'Bebés',
    subcategory: 'Niños',
    wholesale_price: 15900,
    price: calcRetail(15900),
    stock: 15,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Caja-BEBE-T-Unico.png',
    description: 'Set de regalo para bebé, talle único.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
  {
    id: 'dv007',
    code: 'dv007',
    name: 'Calza Lycra',
    category: 'Mujeres',
    subcategory: 'Pantalones y Calzas',
    wholesale_price: 8900,
    price: calcRetail(8900),
    stock: 30,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Calzas-Lycra.png',
    description: 'Calza de lycra, colores surtidos.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 43
  },
  {
    id: 'dv008',
    code: 'dv008',
    name: 'Camperita Infantil',
    category: 'Infantil',
    subcategory: 'Indumentaria Infantil',
    wholesale_price: 17500,
    price: calcRetail(17500),
    stock: 20,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Camperitas-Infantil.png',
    description: 'Campera infantil, colores surtidos.',
    is_offer: true,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
  {
    id: 'dv009',
    code: 'dv009',
    name: 'Chaleco Infantil Unisex',
    category: 'Infantil',
    subcategory: 'Indumentaria Infantil',
    wholesale_price: 11000,
    price: calcRetail(11000),
    stock: 20,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Chalecos-infantil-unisex.png',
    description: 'Chaleco infantil unisex, ideal para entretiempo.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 38
  },
  {
    id: 'dv010',
    code: 'dv010',
    name: 'Conjunto Deportivo Infantil',
    category: 'Infantil',
    subcategory: 'Indumentaria Infantil',
    wholesale_price: 14800,
    price: calcRetail(14800),
    stock: 18,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Conjunto-deportivo.png',
    description: 'Conjunto deportivo infantil, buzo y pantalón.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
  {
    id: 'dv011',
    code: 'dv011',
    name: 'Conjunto Urbano Infantil',
    category: 'Infantil',
    subcategory: 'Indumentaria Infantil',
    wholesale_price: 14800,
    price: calcRetail(14800),
    stock: 18,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/COnjunto-Urban.png',
    description: 'Conjunto urbano infantil, buzo y pantalón.',
    is_offer: false,
    is_top_seller: false,
    is_featured: true,
    sales_count: 0
  },
  {
    id: 'dv012',
    code: 'dv012',
    name: 'Jean Urbano',
    category: 'Hombres',
    subcategory: 'Pantalon',
    wholesale_price: 16500,
    price: calcRetail(16500),
    stock: 22,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Jeans-Urban.png',
    description: 'Jean urbano, corte moderno.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
  {
    id: 'dv013',
    code: 'dv013',
    name: 'Pantalón de Gabardina',
    category: 'Hombres',
    subcategory: 'Pantalon',
    wholesale_price: 15200,
    price: calcRetail(15200),
    stock: 22,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Pantalon-Gabardina.png',
    description: 'Pantalón de gabardina, colores surtidos.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
  {
    id: 'dv014',
    code: 'dv014',
    name: 'Remera Doble Estampa',
    category: 'Hombres',
    subcategory: 'Remeras y Chombas',
    wholesale_price: 8200,
    price: calcRetail(8200),
    stock: 35,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Remera-Doble-Stampa.png',
    description: 'Remera con doble estampa, algodón.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 87
  },
  {
    id: 'dv015',
    code: 'dv015',
    name: 'Remera Niña Minnie',
    category: 'Infantil',
    subcategory: 'Indumentaria Infantil',
    wholesale_price: 7800,
    price: calcRetail(7800),
    stock: 30,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Remera-niña-miny.png',
    description: 'Remera para niña, estampa Minnie.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
  {
    id: 'dv016',
    code: 'dv016',
    name: 'Zapatillas Nike Air Negras',
    category: 'Calzado',
    subcategory: 'Hombre',
    wholesale_price: 32000,
    price: calcRetail(32000),
    stock: 12,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Zapatillas-nike-Air-Negras.png',
    description: 'Zapatillas estilo Nike Air, color negro.',
    is_offer: true,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
  {
    id: 'dv017',
    code: 'dv017',
    name: 'Zapatillas Puma Blancas',
    category: 'Calzado',
    subcategory: 'Mujer',
    wholesale_price: 29500,
    price: calcRetail(29500),
    stock: 12,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Zapatillas-Puma-Blancas.png',
    description: 'Zapatillas estilo Puma, color blanco.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 64
  },
  {
    id: 'dv018',
    code: 'dv018',
    name: 'Zapatillas Rosa',
    category: 'Calzado',
    subcategory: 'Infantil',
    wholesale_price: 21000,
    price: calcRetail(21000),
    stock: 15,
    sizes: [],
    stock_per_size: {},
    image_url: '/muestra/Zapatillas-Rosa.png',
    description: 'Zapatillas para niña, color rosa.',
    is_offer: false,
    is_top_seller: false,
    is_featured: false,
    sales_count: 0
  },
];
