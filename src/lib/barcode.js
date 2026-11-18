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

// ---------------------------------------------------------------------------
// Codigos EAN-13 (2026-11-18). Los codigos DV (Code128 con letras, ej.
// DV0163-DOCENATALLEUNICO-SURT) eran demasiado largos: en una etiqueta de
// 50 mm a 203 dpi las barras quedaban de menos de 2 puntos y el lector no las
// leia. EAN-13 son siempre 13 digitos y entran con barras de 3 puntos.
//
//   20 + articulo (5 digitos) + nro de variante (5 digitos) + digito verificador
//   ej. 2001630000109 = articulo 0163, variante 1
//
// El prefijo 2 es el reservado para codigos internos del comercio (no choca
// con codigos de fabrica). El codigo DV viejo de cada variante se conserva
// como alternativo (clave "ANT|<variante>") para que las etiquetas ya pegadas
// se sigan pudiendo escanear.
// ---------------------------------------------------------------------------
export const ALT_KEY_PREFIX = 'ANT|';
export const isAltKey = (key) => String(key).startsWith(ALT_KEY_PREFIX);

export function ean13CheckDigit(d12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

export function isValidEan13(value) {
  const s = String(value || '');
  return /^\d{13}$/.test(s) && ean13CheckDigit(s.slice(0, 12)) === s[12];
}

// "20" + codigo de articulo en 5 digitos, o null si el articulo no tiene un
// codigo numerico (en ese caso se usa el formato DV de siempre).
function eanPrefixFor(product) {
  const code = String(product?.code || '').trim();
  if (!/^\d{1,5}$/.test(code)) return null;
  return `20${code.padStart(5, '0')}`;
}

function eanFor(prefix, n) {
  const d12 = `${prefix}${String(n).padStart(5, '0')}`;
  return d12 + ean13CheckDigit(d12);
}

/**
 * Codigo de barras para una variante (talle + color) de un producto.
 * EAN-13 si el articulo tiene codigo numerico; si no, el formato DV.
 * `used`: codigos ya tomados en el producto (se elige uno libre).
 */
export function generateBarcodeValue(product, sizeOrKey, maybeColor, used = null) {
  const prefix = eanPrefixFor(product);
  if (!prefix) return generateLegacyBarcodeValue(product, sizeOrKey, maybeColor);
  const key = typeof sizeOrKey === 'string' && sizeOrKey.includes('::') ? sizeOrKey : makeVariantKey(sizeOrKey, maybeColor);
  const taken = used || new Set(Object.values(product?.barcodes || {}).map((v) => String(v).trim().toUpperCase()));
  // Numero de variante sugerido: su posicion en la lista de variantes (1, 2, 3...).
  // Si ya lo usa otra variante (se agregaron talles, etc.), el siguiente libre.
  const idx = getProductVariants(product).findIndex((v) => v.key === key);
  let n = idx >= 0 ? idx + 1 : 1;
  while (taken.has(eanFor(prefix, n))) n++;
  return eanFor(prefix, n);
}

/**
 * Formato viejo (Code128 con letras), se mantiene para articulos sin codigo
 * numerico y para reconocer etiquetas ya impresas:
 *   ej: DV0220-8-ROJO  ó  DV0066-1-NEGRO  ó  DV0314-U-SURT
 */
export function generateLegacyBarcodeValue(product, sizeOrKey, maybeColor) {
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
      const value = uniqueValue(generateBarcodeValue({ ...product, barcodes: result }, v.key, null, used), used);
      result[v.key] = value;
      used.add(value.toUpperCase());
    }
  });

  return result;
}

/**
 * Pasa los codigos de un producto a EAN-13. Cada variante con un codigo que
 * no sea EAN-13 de este articulo recibe uno nuevo, y el anterior se guarda
 * como alternativo ("ANT|<variante>") para que las etiquetas viejas sigan
 * escaneando. No toca las claves que no son variantes actuales.
 * Devuelve { barcodes, changes: [{ key, from, to }] }.
 */
export function migrateBarcodesToEan(product) {
  const prefix = eanPrefixFor(product);
  const barcodes = { ...(product?.barcodes || {}) };
  const changes = [];
  if (!prefix) return { barcodes, changes };
  const used = new Set(Object.values(barcodes).filter(Boolean).map((v) => String(v).trim().toUpperCase()));
  // Codigos viejos ya guardados como alternativos: si dos variantes tenian el
  // MISMO codigo viejo (dato repetido), solo la primera lo conserva (una
  // etiqueta vieja con ese codigo igual no distinguia entre las dos).
  const altValues = new Set(Object.entries(barcodes).filter(([k]) => isAltKey(k)).map(([, v]) => String(v).trim().toUpperCase()));
  for (const v of getProductVariants(product)) {
    const current = barcodes[v.key];
    if (current && isValidEan13(current) && String(current).startsWith(prefix)) continue;
    const to = generateBarcodeValue({ ...product, barcodes }, v.key, null, used);
    used.add(to);
    const curNorm = current ? String(current).trim().toUpperCase() : null;
    if (current && !barcodes[ALT_KEY_PREFIX + v.key] && !altValues.has(curNorm)) {
      barcodes[ALT_KEY_PREFIX + v.key] = current;
      altValues.add(curNorm);
    }
    barcodes[v.key] = to;
    changes.push({ key: v.key, from: current || null, to });
  }
  // Claves sobrantes (variantes que ya no existen, ej. "8::Rojo" cuando hoy es
  // "8::rojo") con el mismo codigo que ya quedo como alternativo: se borran
  // para que un escaneo no encuentre dos variantes.
  const currentKeys = new Set(getProductVariants(product).map((v) => v.key));
  const seen = new Map();
  for (const [k, val] of Object.entries(barcodes)) {
    if (!val) continue;
    const norm = String(val).trim().toUpperCase();
    if (currentKeys.has(k) || isAltKey(k)) { seen.set(norm, k); }
  }
  for (const [k, val] of Object.entries(barcodes)) {
    if (currentKeys.has(k) || isAltKey(k) || !val) continue;
    if (seen.has(String(val).trim().toUpperCase())) {
      changes.push({ key: k, from: val, to: null, removed: true });
      delete barcodes[k];
    }
  }
  return { barcodes, changes };
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
    const sorted = [...keys].filter((k) => !isAltKey(k)).sort();
    const owner = sorted.find((k) => generateLegacyBarcodeValue(product, k).toUpperCase() === barcode) || sorted[0];
    for (const key of sorted) {
      if (key === owner) continue;
      const to = uniqueValue(generateBarcodeValue({ ...product, barcodes }, key, null, used), used);
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
    for (const [rawKey, value] of Object.entries(map)) {
      if (value && String(value).trim().toUpperCase() === cleanUpper) {
        // "ANT|<variante>" = codigo viejo (DV) de esa variante: tambien vale
        const variantKey = isAltKey(rawKey) ? rawKey.slice(ALT_KEY_PREFIX.length) : rawKey;
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

