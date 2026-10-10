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

/* ==========================================================================
   Busqueda con puntaje (la que usa el catalogo)
   --------------------------------------------------------------------------
   La version de arriba (flexibleProductMatch) aceptaba coincidencias muy
   flojas y por eso al buscar "calza" aparecian zapatillas ("calza" esta
   dentro de "calZAdo") o al buscar "short" aparecian productos con talle
   "S" ("short" empieza con "s"). Ahora:
   - Se compara palabra por palabra (nunca un pedazo de otra palabra).
   - Cada coincidencia tiene un nivel: 3 = la palabra esta en el nombre,
     subcategoria o categoria; 2 = esta en la descripcion, o es un color o
     talle exacto; 1 = coincidencia debil (sinonimo, palabra a medio
     escribir o error de tipeo).
   - Si alguna prenda coincide de verdad (nivel 2 o mas) con lo buscado, se
     descartan las coincidencias debiles. Las debiles solo aparecen cuando no
     hay nada mejor (ej. "zapas" -> calzado, "zapat" mientras se escribe).
   - Los resultados se ordenan por puntaje: primero lo mas relevante.
   ========================================================================== */

const tokenizeWords = (str) =>
  normalizeText(str)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

// Une masculino/femenino de colores: negra/negro, blanca/blanco, roja/rojo.
const sameColorWord = (a, b) =>
  a === b || (a.length >= 4 && b.length >= 4 && /[ao]$/.test(a) && /[ao]$/.test(b) && a.slice(0, -1) === b.slice(0, -1));

const fieldsCache = new WeakMap();

function getProductFields(product) {
  let f = fieldsCache.get(product);
  if (f) return f;
  const listText = (v) => (Array.isArray(v) ? v.join(' ') : v || '');
  const rawCode = normalizeText(product.code);
  const cleanNumCode = rawCode ? rawCode.replace(/^0+/, '') : '';
  f = {
    strong: [
      ...tokenizeWords(product.name),
      ...tokenizeWords(product.subcategory),
      ...tokenizeWords(product.category)
    ],
    description: tokenizeWords(product.description),
    attrs: [...tokenizeWords(listText(product.colors)), ...tokenizeWords(listText(product.sizes))],
    codes: [rawCode, cleanNumCode, normalizeText(product.id)].filter(Boolean)
  };
  fieldsCache.set(product, f);
  return f;
}

// Dos letras vecinas invertidas ("remrea" / "remera").
const isSwap = (a, b) => {
  if (a.length !== b.length) return false;
  const diff = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
};

const wordMatches = (token, tokenStem, w) => w === token || stemWord(w) === tokenStem;

function tokenLevel(token, fields) {
  const tStem = stemWord(token);
  const tCleanNum = token.replace(/^0+/, '');

  if (
    fields.codes.some((c) =>
      c === token ||
      (tCleanNum && c === tCleanNum) ||
      c.endsWith(`-${token}`) ||
      (tCleanNum && c.endsWith(`-${tCleanNum}`))
    )
  ) {
    return 3;
  }
  if (fields.strong.some((w) => wordMatches(token, tStem, w))) return 3;
  if (fields.description.some((w) => wordMatches(token, tStem, w))) return 2;
  if (fields.attrs.some((w) => sameColorWord(token, w) || sameColorWord(tStem, stemWord(w)))) return 2;

  // --- coincidencias debiles ---
  const synonyms = SYNONYMS_MAP[token] || SYNONYMS_MAP[tStem];
  if (synonyms && synonyms.some((syn) => {
    const sStem = stemWord(normalizeText(syn));
    return fields.strong.some((w) => wordMatches(normalizeText(syn), sStem, w));
  })) return 1;

  // Palabra a medio escribir ("zapat" -> zapatillas). Minimo 3 letras.
  if (token.length >= 3 && fields.strong.some((w) => w.length > token.length && w.startsWith(token))) return 1;

  // Un error de tipeo en palabras largas ("remrea" -> remera, "calsa" -> calza).
  if (token.length >= 5 && fields.strong.some((w) => w.length >= 5 && (isCloseTypo(token, w) || isSwap(token, w)))) return 1;

  return 0;
}

/**
 * Devuelve un Map(idProducto -> puntaje) con los productos que coinciden con
 * la busqueda, o null si la busqueda esta vacia.
 */
export function getSearchScores(products, query) {
  const tokens = tokenizeWords(query);
  if (tokens.length === 0) return null;

  const rows = (products || []).map((p) => {
    const fields = getProductFields(p);
    return { p, levels: tokens.map((t) => tokenLevel(t, fields)) };
  });

  // Para cada palabra buscada: ¿hay al menos un producto que coincida de verdad?
  const strongExists = tokens.map((_, i) => rows.some((r) => r.levels[i] >= 2));

  const phrase = normalizeText(query);
  const scores = new Map();
  rows.forEach(({ p, levels }) => {
    const ok = levels.every((lvl, i) => lvl >= (strongExists[i] ? 2 : 1));
    if (!ok) return;
    let score = levels.reduce((s, l) => s + l, 0);
    if (normalizeText(p.name).includes(phrase)) score += 2;
    scores.set(p.id, score);
  });
  return scores;
}
