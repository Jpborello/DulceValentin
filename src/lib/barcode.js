// Helpers para el sistema de códigos de barra del Punto de Venta (Caja) de Dulce Valentín.
//
// En Dulce Valentín cada prenda se identifica por TALLE Y COLOR:
//   ej. "Remera Roja Talle 8" vs "Remera Roja Talle 4".
//
// Estructura de almacenamiento:
// Cada producto tiene un campo `barcodes` (JSONB) en la tabla `products`, con forma:
//   {
//     "8::Rojo": "DV0220-8-ROJ",
//     "4::Rojo": "DV0220-4-ROJ",
//     "SIN_TALLE::Negro": "DV0314-U-NEG"
//   }
//
// Claves especiales:
// - SIN_TALLE: para productos de talle único.
// - SIN_COLOR: para productos sin variantes de color.
// - CUALQUIER_TALLE: para códigos heredados que no distinguen talle/color (al escanear se pregunta al vendedor).

import { getProductColorsForSize, getVariantStock } from './catalogData';
import { getProductPrice } from './productPricing';

export const SIN_TALLE_KEY = 'SIN_TALLE';
export const SIN_COLOR_KEY = 'SIN_COLOR';
export const CUALQUIER_TALLE_KEY = 'CUALQUIER_TALLE';

/**
 * Arma la clave compuesta estándar para una variante (Talle::Color).
 */
export function makeVariantKey(size, color) {
  const s = size && size !== SIN_TALLE_KEY ? String(size).trim() : SIN_TALLE_KEY;
  const c = color && color !== SIN_COLOR_KEY ? String(color).trim() : SIN_COLOR_KEY;
  return `${s}::${c}`;
}

/**
 * Descompone una clave de variante en { size, color }.
 */
export function parseVariantKey(key) {
  if (!key) return { size: null, color: null };
  const str = String(key);
  if (str === CUALQUIER_TALLE_KEY) return { size: null, color: null, isLegacy: true };

  const parts = str.split('::');
  if (parts.length === 1) {
    // Compatibilidad si solo venía el talle (formato viejo)
    const val = parts[0].trim();
    return {
      size: val && val !== SIN_TALLE_KEY ? val : null,
      color: null
    };
  }

  const s = parts[0].trim();
  const c = parts[1].trim();
  return {
    size: s && s !== SIN_TALLE_KEY ? s : null,
    color: c && c !== SIN_COLOR_KEY ? c : null
  };
}

/**
 * Devuelve un texto legible para humanos de la variante (ej. "Talle 8 · Rojo" o "Talle único · Negro").
 */
export function formatVariantLabel(size, color) {
  const sText = size && size !== SIN_TALLE_KEY ? `Talle ${size}` : null;
  const cText = color && color !== SIN_COLOR_KEY ? color : null;
  if (sText && cText) return `${sText} · ${cText}`;
  if (sText) return sText;
  if (cText) return cText;
  return 'Talle único';
}

/**
 * Obtiene la lista completa de variantes que tiene un producto según sus talles y colores cargados.
 * Devuelve un array de { key, size, color, label, stock, price }.
 */
export function getProductVariants(product) {
  if (!product) return [];
  const sizes = Array.isArray(product.sizes) && product.sizes.length > 0 ? product.sizes : [null];
  const variants = [];

  sizes.forEach((size) => {
    const colors = getProductColorsForSize(product, size);
    const colorList = Array.isArray(colors) && colors.length > 0 ? colors : [null];
    colorList.forEach((color) => {
      const key = makeVariantKey(size, color);
      // Stock fisico: una prenda sin publicar en la web igual se etiqueta y se vende en el local.
      const stock = getVariantStock(product, size, color);
      const price = getProductPrice(product, size);
      variants.push({
        key,
        size,
        color,
        label: formatVariantLabel(size, color),
        stock: typeof stock === 'number' ? stock : 0,
        price: typeof price === 'number' ? price : (product.price || 0)
      });
    });
  });

  return variants;
}

/**
 * Obtiene todas las claves de variante que corresponden al producto.
 */
export function getVariantKeys(product) {
  const variants = getProductVariants(product);
  return variants.length > 0 ? variants.map((v) => v.key) : [makeVariantKey(null, null)];
}

/**
 * Genera un código de barras propio, único y legible para un producto + talle + color.
 * Formato Code128 de alta densidad con prefijo de la marca DV:
 *   ej: DV0220-8-ROJO  ó  DV0066-1-NEGRO  ó  DV0314-U-SURT
 */
export function generateBarcodeValue(product, sizeOrKey, maybeColor) {
  let size = null;
  let color = null;

  if (typeof sizeOrKey === 'string' && sizeOrKey.includes('::')) {
    const parsed = parseVariantKey(sizeOrKey);
    size = parsed.size;
    color = parsed.color;
  } else {
    size = sizeOrKey && sizeOrKey !== SIN_TALLE_KEY ? sizeOrKey : null;
    color = maybeColor && maybeColor !== SIN_COLOR_KEY ? maybeColor : null;
  }

  // Código de artículo limpio (ej. "0220" o los últimos 4 dígitos del ID)
  let code = (product?.code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code && product?.id) {
    code = product.id.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-4);
  }
  if (!code) code = '0000';

  const sizeToken = size
    ? size.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    : 'U';

  return `DV${code}-${sizeToken}-${colorTokenFor(color)}`;
}

// (misma limpieza que siempre, para que los codigos de colores de una palabra no cambien)
const cleanToken = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// Abreviatura del color para el codigo. Un color de una palabra queda igual
// que siempre (4 letras: "Rosa" -> ROSA). Si tiene mas palabras se agrega la
// inicial de cada una, para que "Rosa fluo" (ROSAF) o "Negro con blanco"
// (NEGRCB) no queden con el mismo codigo que "Rosa" o "Negro con rosa".
function colorTokenFor(color) {
  if (!color) return 'GEN';
  const words = String(color).trim().split(/\s+/).map(cleanToken).filter(Boolean);
  if (words.length === 0) return 'GEN';
  return words[0].slice(0, 4) + words.slice(1).map((w) => w[0]).join('');
}

// Devuelve `base` o, si ya esta usado, base + 2, 3, ... hasta que sea unico.
function uniqueValue(base, used) {
  if (!used.has(base.toUpperCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}${n}`;
    if (!used.has(candidate.toUpperCase())) return candidate;
  }
}

/**
 * Devuelve el código de barras guardado para una variante puntual (o null si no tiene).
 */
export function getBarcodeForVariant(product, sizeOrKey, maybeColor) {
  const key = typeof sizeOrKey === 'string' && sizeOrKey.includes('::')
    ? sizeOrKey
    : makeVariantKey(sizeOrKey, maybeColor);
  const map = product?.barcodes && typeof product.barcodes === 'object' ? product.barcodes : {};
  const val = map[key];
  return val ? String(val).trim() : null;
}

/**
 * A partir de los barcodes ya guardados en el producto, arma el mapa completo
 * (uno por cada variante talle x color) rellenando con un valor generado los que falten,
 * SIN pisar los que ya estén cargados (de fábrica o generados previamente).
 */
export function ensureBarcodesForProduct(product) {
  const existing = product?.barcodes && typeof product.barcodes === 'object' ? product.barcodes : {};
  const result = { ...existing };
  const variants = getProductVariants(product);
  // Nunca se genera un codigo que ya tenga otra variante del producto: si dos
  // variantes compartieran codigo, al escanear no se sabria cual se vende.
  const used = new Set(Object.values(result).filter(Boolean).map((v) => String(v).trim().toUpperCase()));

  variants.forEach((v) => {
    if (!result[v.key]) {
      const value = uniqueValue(generateBarcodeValue(product, v.size, v.color), used);
      result[v.key] = value;
      used.add(value.toUpperCase());
    }
  });

  return result;
}

/**
 * Codigos repetidos dentro de un producto: [{ barcode, keys: [variantKey, ...] }].
 */
export function findDuplicateBarcodes(product) {
  const map = product?.barcodes && typeof product.barcodes === 'object' ? product.barcodes : {};
  const byValue = new Map();
  Object.entries(map).forEach(([key, val]) => {
    if (!val) return;
    const k = String(val).trim().toUpperCase();
    byValue.set(k, [...(byValue.get(k) || []), key]);
  });
  return [...byValue.entries()].filter(([, keys]) => keys.length > 1).map(([barcode, keys]) => ({ barcode, keys }));
}

/**
 * Corrige los codigos repetidos de un producto. En cada grupo, el codigo lo
 * conserva la variante a la que "le corresponde" (la que el generador nuevo
 * armaria igual, ej. "Rosa" se queda DV0224-4-ROSA) o, si ninguna, la primera
 * en orden alfabetico; las demas reciben un codigo nuevo unico.
 * Devuelve { barcodes, changes: [{ key, from, to }] }. Las etiquetas ya
 * impresas de las variantes cambiadas hay que reimprimirlas.
 */
export function fixDuplicateBarcodes(product) {
  const barcodes = { ...(product?.barcodes || {}) };
  const changes = [];
  const used = new Set(Object.values(barcodes).filter(Boolean).map((v) => String(v).trim().toUpperCase()));
  for (const { barcode, keys } of findDuplicateBarcodes(product)) {
    const sorted = [...keys].sort();
    const owner = sorted.find((k) => generateBarcodeValue(product, k).toUpperCase() === barcode) || sorted[0];
    for (const key of sorted) {
      if (key === owner) continue;
      const to = uniqueValue(generateBarcodeValue(product, key), used);
      used.add(to.toUpperCase());
      changes.push({ key, from: barcodes[key], to });
      barcodes[key] = to;
    }
  }
  return { barcodes, changes };
}

/**
 * Busca en la lista de productos qué variante tiene exactamente el código escaneado.
 * Devuelve array de coincidencias: [{ product, variantKey, size, color, barcode }]
 * Acepta también como atajo el código corto de artículo (product.code) tipeado a mano.
 */
export function resolveBarcodeMatches(products, scannedCode) {
  const clean = (scannedCode || '').toString().trim();
  if (!clean) return [];
  const cleanUpper = clean.toUpperCase();

  const matches = [];

  for (const product of products || []) {
    const map = product?.barcodes && typeof product.barcodes === 'object' ? product.barcodes : {};
    for (const [variantKey, value] of Object.entries(map)) {
      if (value && String(value).trim().toUpperCase() === cleanUpper) {
        const { size, color } = parseVariantKey(variantKey);
        matches.push({ product, variantKey, size, color, barcode: String(value) });
      }
    }
  }
  if (matches.length > 0) return matches;

  // Atajo: si se tipea a mano el código de artículo (ej. "0220")
  const byCode = (products || []).filter(
    (p) => (p.code || '').toString().trim().toUpperCase() === cleanUpper
  );
  if (byCode.length > 0) {
    byCode.forEach((p) => {
      const variants = getProductVariants(p);
      if (variants.length === 1) {
        // Talle único / variante única: se suma directo
        const v = variants[0];
        matches.push({ product: p, variantKey: v.key, size: v.size, color: v.color, barcode: clean });
      } else {
        // Múltiples talles/colores: se marca como CUALQUIER_TALLE para que el cajero seleccione talle y color
        matches.push({ product: p, variantKey: CUALQUIER_TALLE_KEY, size: null, color: null, barcode: clean });
      }
    });
  }

  return matches;
}

