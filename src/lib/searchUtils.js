/**
 * Utilidades de búsqueda flexible para el catálogo de Dulce Valentín.
 * Soporta:
 * - Eliminación de acentos y diacríticos (bebé -> bebe, lencería -> lenceria).
 * - Búsqueda por múltiples palabras en cualquier orden ('remera blanca', 'pantalon nene').
 * - Normalización de singular y plural en español ('remeras' <-> 'remera', 'buzos' <-> 'buzo', 'pantalones' <-> 'pantalon').
 * - Sinónimos populares del rubro textil y calzado ('zapas' -> calzado, 'nene/a' -> infantil/bebés).
 * - Búsqueda en nombre, categoría, subcategoría, descripción, colores y talles.
 * - Tolerancia a pequeños errores tipográficos (typos).
 */

export const normalizeText = (str) =>
  (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Raíces o desinencias comunes en español para conectar singular y plural
export const stemWord = (word) => {
  if (!word || word.length <= 3) return word;
  
  // Tratamiento especial de palabras frecuentes
  if (word === 'pantalones') return 'pantalon';
  if (word === 'bodys' || word === 'bodies') return 'body';
  if (word === 'camisones') return 'camison';
  if (word === 'calzones') return 'calzon';

  // Terminaciones en -es (p.ej. mujeres -> mujer, colores -> color)
  if (word.endsWith('es') && word.length > 4) {
    return word.slice(0, -2);
  }
  
  // Terminaciones en -s (p.ej. remeras -> remera, buzos -> buzo, calzas -> calza)
  if (word.endsWith('s') && word.length > 3) {
    return word.slice(0, -1);
  }

  return word;
};

// Diccionario de sinónimos y términos equivalentes
const SYNONYMS_MAP = {
  zapa: ['calzado', 'zapatilla', 'zapatillas'],
  zapas: ['calzado', 'zapatilla', 'zapatillas'],
  zapatilla: ['calzado', 'zapatillas', 'zapa', 'zapas'],
  zapatillas: ['calzado', 'zapatilla', 'zapa', 'zapas'],
  championes: ['calzado', 'zapatilla'],
  zapato: ['calzado'],
  zapatos: ['calzado'],
  nene: ['infantil', 'bebes', 'bebe', 'nino'],
  nena: ['infantil', 'bebes', 'bebe', 'nina'],
  nenes: ['infantil', 'bebes', 'bebe', 'ninos'],
  nenas: ['infantil', 'bebes', 'bebe', 'ninas'],
  chico: ['infantil', 'bebes', 'nino'],
  chicos: ['infantil', 'bebes', 'ninos'],
  chica: ['infantil', 'bebes', 'nina'],
  chicas: ['infantil', 'bebes', 'ninas'],
  nino: ['infantil', 'bebes', 'nene'],
  ninos: ['infantil', 'bebes', 'nenes'],
  nina: ['infantil', 'bebes', 'nena'],
  ninas: ['infantil', 'bebes', 'nenas'],
  bebe: ['bebes', 'infantil', 'ajuar', 'body', 'bodys'],
  bebes: ['bebe', 'infantil', 'ajuar', 'body', 'bodys'],
  corpiño: ['lenceria', 'conjunto', 'corpino'],
  corpino: ['lenceria', 'conjunto', 'corpiño'],
  bombacha: ['lenceria', 'bombachas'],
  bombachas: ['lenceria', 'bombacha'],
  tanga: ['lenceria', 'tangas', 'bombacha'],
  tangas: ['lenceria', 'tanga', 'bombachas'],
  interior: ['lenceria', 'ropa interior'],
  ajuar: ['bebes', 'bebe', 'set', 'cajita'],
  campera: ['abrigo', 'camperas', 'camperon', 'buzo'],
  camperas: ['abrigo', 'campera', 'camperon', 'buzo'],
  buzo: ['abrigo', 'buzos', 'campera'],
  buzos: ['abrigo', 'buzo', 'campera'],
  calza: ['calzas', 'pantalon', 'pantalones'],
  calzas: ['calza', 'pantalon', 'pantalones'],
  remeron: ['remera', 'remerones', 'remeras'],
  remerones: ['remera', 'remeron', 'remeras'],
  sabana: ['sabanas', 'blanqueria'],
  sabanas: ['sabana', 'blanqueria'],
  perfume: ['perfumeria', 'crema', 'fragancia'],
  perfumes: ['perfumeria', 'crema', 'fragancia']
};

/**
 * Calcula si dos palabras tienen distancia Levenshtein <= 1 (un typo de diferencia)
 */
function isCloseTypo(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length < 4 || b.length < 4) return false;
  let edits = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] !== b[j]) {
      edits++;
      if (edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else { i++; j++; }
    } else {
      i++; j++;
    }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

/**
 * Obtiene el texto unificado y normalizado de un producto para indexación rápida
 */
export function getProductSearchCorpus(product) {
  if (!product) return '';
  const parts = [
    product.name,
    product.category,
    product.subcategory,
    product.description,
    Array.isArray(product.colors) ? product.colors.join(' ') : product.colors,
    Array.isArray(product.sizes) ? product.sizes.join(' ') : product.sizes,
    product.sku,
    product.id
  ].filter(Boolean);

  return normalizeText(parts.join(' '));
}

/**
 * Evalúa si un producto coincide con una consulta de búsqueda flexible
 * @param {Object} product - Producto del catálogo
 * @param {string} query - Término ingresado por el usuario
 * @param {Set|null} smartSearchIds - IDs devueltos por Postgres FTS (opcional)
 */
export function flexibleProductMatch(product, query, smartSearchIds = null) {
  const normQuery = normalizeText(query);
  if (!normQuery) return true;

  // Si Supabase RPC devolvió este ID, es un match garantizado
  if (smartSearchIds && smartSearchIds.has(product.id)) {
    return true;
  }

  const corpus = getProductSearchCorpus(product);
  if (!corpus) return false;

  // Match directo de frase completa
  if (corpus.includes(normQuery)) {
    return true;
  }

  // Descomponer en palabras clave (tokens)
  const tokens = normQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const corpusWords = corpus.split(/\s+/).filter(Boolean);

  // CADA token de la búsqueda debe tener coincidencia en el producto
  return tokens.every((token) => {
    // 1. Substring directo del token
    if (corpus.includes(token)) return true;

    // 2. Coincidencia por raíz / singular / plural
    const stem = stemWord(token);
    if (stem.length >= 3 && corpus.includes(stem)) return true;

    // 3. Revisar si alguna palabra del producto comparte raíz con el token
    const tokenInWords = corpusWords.some((w) => {
      const wStem = stemWord(w);
      return wStem === stem || w.startsWith(token) || token.startsWith(w);
    });
    if (tokenInWords) return true;

    // 4. Búsqueda por sinónimos
    const synonyms = SYNONYMS_MAP[token] || SYNONYMS_MAP[stem];
    if (synonyms && synonyms.some((syn) => corpus.includes(syn))) {
      return true;
    }

    // 5. Tolerancia a 1 error tipográfico en palabras de más de 4 letras
    if (token.length >= 4) {
      const typoMatch = corpusWords.some((w) => isCloseTypo(token, w) || isCloseTypo(stem, stemWord(w)));
      if (typoMatch) return true;
    }

    return false;
  });
}
