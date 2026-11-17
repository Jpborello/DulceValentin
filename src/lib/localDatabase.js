/**
 * Gestor Local-First e IndexedDB para Dulce Valentín
 * Permite almacenar y consultar la base de datos completa de prendas,
 * catálogo, stock por talle/color, precios y ventas sin conexión a internet (Modo Contingencia).
 */

const DB_NAME = 'dulce_valentin_local_db';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const KEY_CURRENT = 'current_database_snapshot';
const LS_META_KEY = 'dv_local_snapshot_meta';

/**
 * Helper para generar CSV compatible con Excel en español (BOM UTF-8 y punto y coma).
 */
export function generateCsv(rows = [], columns = []) {
  const header = columns.map((c) => `"${String(c.label || '').replace(/"/g, '""')}"`).join(';');
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return '""';
        if (typeof val === 'boolean') return val ? '"SÍ"' : '"NO"';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
      })
      .join(';')
  );
  return '\uFEFF' + [header, ...lines].join('\r\n');
}

/**
 * Abre la conexión a IndexedDB en el navegador.
 */
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no está disponible en este entorno.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Lectura/escritura genérica de una clave en el mismo store de IndexedDB.
 * La usa la caja sin conexión (catálogo cacheado y cola de ventas).
 */
export async function idbGet(key) {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key, value) {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Guarda el snapshot completo en IndexedDB y un resumen ligero en localStorage.
 */
export async function saveLocalSnapshot(snapshot) {
  if (typeof window === 'undefined' || !snapshot) return;

  try {
    const db = await openIndexedDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(snapshot, KEY_CURRENT);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Guardar resumen ligero en localStorage para lectura síncrona inmediata
    localStorage.setItem(
      LS_META_KEY,
      JSON.stringify({
        exportedAt: snapshot.exportedAt,
        counts: snapshot.counts,
        windowsPath: snapshot.windowsPath,
      })
    );
  } catch (err) {
    console.warn('Fallo al guardar en IndexedDB, intentando localStorage:', err);
    try {
      localStorage.setItem(KEY_CURRENT, JSON.stringify(snapshot));
    } catch (lsErr) {
      console.error('No se pudo guardar en localStorage (tamaño excedido):', lsErr);
    }
  }
}

/**
 * Recupera el snapshot activo desde IndexedDB (o localStorage como fallback).
 */
export async function loadLocalSnapshot() {
  if (typeof window === 'undefined') return null;

  try {
    const db = await openIndexedDB();
    const snapshot = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_CURRENT);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (snapshot) return snapshot;
  } catch (err) {
    console.warn('Error leyendo de IndexedDB, buscando en localStorage:', err);
  }

  // Fallback a localStorage
  try {
    const raw = localStorage.getItem(KEY_CURRENT);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignorar
  }

  return null;
}

/**
 * Obtiene los metadatos del último respaldo local sin cargar el payload completo en memoria.
 */
export function getLocalSnapshotMeta() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Busca productos en el snapshot local (búsqueda ultra rápida a 0ms en memoria).
 * Soporta búsqueda por código de artículo, nombre, categoría, color, talle o código de barras.
 */
export function searchLocalProducts(snapshot, query) {
  if (!snapshot || !snapshot.data || !Array.isArray(snapshot.data.products)) return [];
  const q = String(query || '').trim().toLowerCase();
  const list = snapshot.data.products;
  if (!q) return list.slice(0, 50);

  const cleanNum = q.replace(/\D/g, '');

  return list.filter((p) => {
    const name = String(p.name || '').toLowerCase();
    const code = String(p.code || '').toLowerCase();
    const cat = String(p.category || '').toLowerCase();
    const subcat = String(p.subcategory || '').toLowerCase();

    // Coincidencia directa en datos básicos
    if (name.includes(q) || code.includes(q) || cat.includes(q) || subcat.includes(q)) {
      return true;
    }

    if (cleanNum && code.replace(/\D/g, '').includes(cleanNum)) {
      return true;
    }

    // Coincidencia en códigos de barra
    if (p.barcodes && typeof p.barcodes === 'object') {
      const bcValues = Object.values(p.barcodes).map((v) => String(v).toLowerCase());
      if (bcValues.some((bc) => bc.includes(q))) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Busca pedidos/ventas en el snapshot local por ID, nombre de cliente, teléfono o DNI.
 */
export function searchLocalOrders(snapshot, query) {
  if (!snapshot || !snapshot.data || !Array.isArray(snapshot.data.orders)) return [];
  const q = String(query || '').trim().toLowerCase();
  const list = snapshot.data.orders;
  if (!q) return list.slice(0, 30);

  const cleanDigits = q.replace(/\D/g, '');

  return list.filter((o) => {
    const id = String(o.id || '').toLowerCase();
    const name = String(o.client_name || '').toLowerCase();
    const phone = String(o.client_phone || '').replace(/\D/g, '');
    const dni = String(o.client_dni || '').replace(/\D/g, '');
    const locality = String(o.client_locality || '').toLowerCase();

    return (
      id.includes(q) ||
      name.includes(q) ||
      locality.includes(q) ||
      (cleanDigits && (phone.includes(cleanDigits) || dni.includes(cleanDigits)))
    );
  });
}

/**
 * Dispara la descarga directa en el navegador de un archivo Blob.
 */
export function triggerBrowserFileDownload(content, filename, mimeType) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

