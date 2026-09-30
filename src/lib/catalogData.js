// Categorías del catálogo de Dulce Valentín. El precio que se carga es
// directamente el precio mayorista (no se aplica ningun descuento/markup automatico).

export const CATALOG_CATEGORIES = [
  { id: 'all', name: 'Todos los Productos' },
  {
    id: 'Hombres',
    name: 'Hombres',
    // Una subcategoria por prenda (antes "Remeras y Shorts" / "Remeras y
    // Chombas" mezclaban dos prendas distintas bajo el mismo filtro).
    subcategories: ['Remeras', 'Chombas', 'Shorts', 'Pantalones', 'Camperas', 'Buzos', 'Camisas', 'Conjuntos', 'Ropa Interior']
  },
  {
    id: 'Mujeres',
    name: 'Mujeres',
    // 'Ropa Intima' se mudo a la categoria Lenceria (ver RETIRED_SUBCATEGORIES).
    // Misma logica que Hombres: una subcategoria por prenda (antes "Buzos y
    // abrigos" y "Pantalones y Calzas" mezclaban dos prendas cada una).
    subcategories: ['Remeras', 'Camperas', 'Buzos', 'Abrigos', 'Pantalones', 'Calzas', 'Medias', 'Otros Productos']
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
    subcategories: ['Ajuar y Sets', 'Bodys', 'Enteritos', 'Ranitas y Pantalones', 'Accesorios', 'Blanquería y Cuidado', 'Bolsos Maternales']
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
    image: '/categorias/calzado.webp',
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
    image: '/categorias/indumentaria.webp',
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
    image: '/categorias/lenceria.webp',
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
    image: '/categorias/bebes.webp',
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
    'Remeras': ['Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Surtido'],
    'Chombas': ['Negro', 'Blanco', 'Gris', 'Azul Marino', 'Surtido'],
    'Shorts': ['Negro', 'Gris', 'Azul', 'Surtido'],
    'Pantalones': ['Negro', 'Gris', 'Azul', 'Beige', 'Surtido'],
    'Camperas': ['Negro', 'Azul Marino', 'Verde Militar', 'Gris', 'Surtido'],
    'Buzos': ['Negro', 'Gris Topo', 'Blanco', 'Bordó', 'Azul Marino', 'Rosa', 'Surtido'],
    'Camisas': ['Blanco', 'Celeste', 'Negro', 'Beige', 'Surtido'],
    'Conjuntos': ['Negro', 'Gris', 'Azul Marino', 'Surtido'],
    'Ropa Interior': ['Surtido', 'Negro', 'Blanco', 'Gris']
  },
  'Mujeres': {
    'Remeras': ['Blanco', 'Negro', 'Rosa', 'Lila', 'Rojo', 'Surtido'],
    'Camperas': ['Negro', 'Beige', 'Rosa', 'Verde', 'Blanco', 'Surtido'],
    'Buzos': ['Negro', 'Rosa', 'Blanco', 'Gris', 'Bordó', 'Surtido'],
    'Abrigos': ['Negro', 'Rosa', 'Blanco', 'Lila', 'Gris', 'Bordó', 'Surtido'],
    'Pantalones': ['Negro', 'Gris', 'Azul', 'Beige', 'Surtido'],
    'Calzas': ['Negro', 'Gris', 'Azul', 'Fucsia', 'Surtido'],
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

export const POPULAR_COLORS = [
  'Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Verde', 'Amarillo', 'Rosa', 'Beige', 'Marrón', 'Lila', 'Bordo', 'Surtido'
];

/**
 * Obtiene los detalles de stock y colores para un talle específico de un producto.
 * Compatible tanto con el formato nuevo { stock, colors } como con el formato numérico heredado.
 */
export const getSizeDetails = (product, size) => {
  if (!product || !size) return { stock: 0, colors: [], totalStock: 0, color_stock: {} };
  const raw = product.stock_per_size?.[size];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const fallbackStock = Math.max(0, parseInt(raw.stock ?? raw.quantity, 10) || 0);
    const colors = Array.isArray(raw.colors) && raw.colors.length > 0
      ? raw.colors
      : getProductColors(product);

    // Mapeo granular de stock por color: { 'Negro': 4, 'Blanco': 2 }
    const color_stock = {};
    if (raw.color_stock && typeof raw.color_stock === 'object') {
      colors.forEach((c) => {
        color_stock[c] = raw.color_stock[c] !== undefined
          ? Math.max(0, parseInt(raw.color_stock[c], 10) || 0)
          : fallbackStock;
      });
    } else {
      colors.forEach((c) => {
        color_stock[c] = fallbackStock;
      });
    }

    const hasSpecificColors = colors.length > 0;
    const totalStock = hasSpecificColors
      ? colors.reduce((acc, c) => acc + (color_stock[c] ?? 0), 0)
      : fallbackStock;

    return { stock: fallbackStock, colors, totalStock, color_stock };
  }
  const stock = typeof raw === 'number' ? raw : (parseInt(raw, 10) || 0);
  const colors = getProductColors(product);
  const color_stock = {};
  colors.forEach((c) => {
    color_stock[c] = stock;
  });
  return { stock, colors, totalStock: stock, color_stock };
};

/**
 * Devuelve los colores disponibles para un talle dado (o los generales del producto si no hay talles o no tiene colores propios)
 */
export const getProductColorsForSize = (product, size) => {
  if (!product) return ['Surtido'];
  if (size && product.stock_per_size?.[size]) {
    const raw = product.stock_per_size[size];
    if (raw && typeof raw === 'object' && Array.isArray(raw.colors) && raw.colors.length > 0) {
      return raw.colors;
    }
  }
  return getProductColors(product);
};

/**
 * Devuelve el stock disponible para una combinación específica de talle y color.
 */
export const getProductStockForSizeColor = (product, size, color) => {
  if (!product) return 0;
  if (size) {
    const details = getSizeDetails(product, size);
    if (color && details.colors.length > 0 && !details.colors.includes(color)) return 0;
    if (color && details.color_stock && details.color_stock[color] !== undefined) {
      return details.color_stock[color];
    }
    return details.stock;
  }
  return Number(product.stock) || 0;
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

// El catalogo real vive en Supabase. Este array quedo vacio a proposito: antes
// tenia 18 productos de muestra que seedMissingCatalogInSupabase() reinsertaba
// en la base en cada carga, asi que borrarlos solo de Supabase no alcanzaba —
// volvian solos.
export const CATALOG_PRODUCTS = [];
