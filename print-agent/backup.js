// Respaldo automatico en la PC del local ("punto local").
//
// Cada BACKUP_INTERVAL_HOURS pide al sitio una copia completa de la base
// (/api/admin/backups/agent) y la guarda en el disco de esta PC, en
// BACKUP_DIR (por defecto C:\Users\<usuario>\Backups_DulceValentin):
//   - backup_dulce_valentin_<fecha_hora>.json   (copia fechada, se rota)
//   - base_completa_reciente.json                (siempre la ultima buena)
//   - catalogo / stock / ventas / clientes _<fecha>.csv  (para Excel)
//   - estado_respaldo.json                       (resultado del ultimo intento)
//
// Si se corta internet, simplemente falla ese intento y queda la ultima copia
// buena intacta: nunca se pisa una copia buena con una vacia o a medias.
//
// Uso suelto (sin el agente de impresion): `npm run backup`

require('dotenv').config({ quiet: true });
const fs = require('fs');
const os = require('os');
const path = require('path');

const SITE_URL = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SECRET = process.env.BACKUP_AGENT_SECRET || process.env.AGENT_SECRET;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(os.homedir(), 'Backups_DulceValentin');
const INTERVAL_HOURS = Math.max(0.25, Number(process.env.BACKUP_INTERVAL_HOURS || 6));
const KEEP = Math.max(1, Math.floor(Number(process.env.BACKUP_KEEP || 30)));
const ENABLED = String(process.env.BACKUP_ENABLED || 'true').toLowerCase() !== 'false';
const REQUEST_TIMEOUT_MS = 120000;

function log(msg) {
  console.log(`[${new Date().toLocaleString('es-AR', { hour12: false })}] [respaldo] ${msg}`);
}

async function fetchPart(part) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${SITE_URL}/api/admin/backups/agent?part=${part}`, {
      headers: { 'x-agent-secret': SECRET },
      signal: controller.signal
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

// Escribe a un .tmp y despues renombra: si la PC se apaga a mitad de la
// escritura, el archivo anterior queda sano.
function writeAtomic(filePath, content) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function rotate(prefix, ext) {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
    .sort(); // los nombres llevan fecha AAAA-MM-DD, asi que el orden alfabetico es cronologico
  const extra = files.length - KEEP;
  for (let i = 0; i < extra; i++) {
    try { fs.unlinkSync(path.join(BACKUP_DIR, files[i])); } catch {}
  }
}

function writeStatus(status) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    writeAtomic(path.join(BACKUP_DIR, 'estado_respaldo.json'), JSON.stringify(status, null, 2));
  } catch {}
}

function validateSnapshot(snapshot) {
  const data = snapshot && snapshot.data;
  if (!data || !Array.isArray(data.products) || !Array.isArray(data.orders)) {
    throw new Error('La copia recibida no tiene el formato esperado.');
  }
  if (data.products.length === 0) {
    throw new Error('La copia recibida no trae productos: no se guarda para no pisar la última buena.');
  }
}

let running = false;

async function runBackup() {
  if (running) return;
  running = true;
  const startedAt = new Date().toISOString();
  try {
    log(`Pidiendo copia completa a ${SITE_URL}...`);
    const { snapshot, timestamp, dateStr, missingTables } = await fetchPart('snapshot');
    validateSnapshot(snapshot);

    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    snapshot.windowsPath = BACKUP_DIR;
    const json = JSON.stringify(snapshot, null, 2);
    const datedName = `backup_dulce_valentin_${timestamp}.json`;
    writeAtomic(path.join(BACKUP_DIR, datedName), json);
    writeAtomic(path.join(BACKUP_DIR, 'base_completa_reciente.json'), json);
    rotate('backup_dulce_valentin_', '.json');

    // Las planillas son un extra: si fallan, la copia JSON ya quedo guardada.
    let csvError = null;
    try {
      const { csvFiles } = await fetchPart('csv');
      writeAtomic(path.join(BACKUP_DIR, `catalogo_productos_${dateStr}.csv`), csvFiles.catalogo);
      writeAtomic(path.join(BACKUP_DIR, `stock_por_talle_y_color_${dateStr}.csv`), csvFiles.stockVariantes);
      writeAtomic(path.join(BACKUP_DIR, `ventas_y_pedidos_${dateStr}.csv`), csvFiles.ventas);
      writeAtomic(path.join(BACKUP_DIR, `clientes_y_contactos_${dateStr}.csv`), csvFiles.clientes);
      ['catalogo_productos_', 'stock_por_talle_y_color_', 'ventas_y_pedidos_', 'clientes_y_contactos_'].forEach((p) => rotate(p, '.csv'));
    } catch (err) {
      csvError = err.message;
      log(`Aviso: no se pudieron bajar las planillas CSV (${err.message}). La copia JSON sí quedó guardada.`);
    }

    const sizeMb = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
    const c = snapshot.counts || {};
    log(`OK: ${datedName} (${sizeMb} MB) · ${c.products} prendas, ${c.orders} pedidos, ${c.clients} clientes.`);
    if (missingTables && missingTables.length) log(`Tablas que no existen en la base (omitidas): ${missingTables.join(', ')}`);

    writeStatus({ ok: true, startedAt, finishedAt: new Date().toISOString(), file: datedName, sizeMb: Number(sizeMb), counts: c, missingTables, csvError });
    return true;
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? 'El sitio tardó demasiado en responder.'
      : err.message === 'fetch failed'
        ? `No se pudo conectar con ${SITE_URL} (¿hay internet?).`
        : err.message;
    log(`ERROR: ${msg} — queda intacta la última copia buena en ${BACKUP_DIR}`);
    writeStatus({ ok: false, startedAt, finishedAt: new Date().toISOString(), error: msg });
    return false;
  } finally {
    running = false;
  }
}

function startBackupSchedule() {
  if (!ENABLED) {
    log('Respaldo automático desactivado (BACKUP_ENABLED=false).');
    return;
  }
  if (!SECRET) {
    log('No hay AGENT_SECRET / BACKUP_AGENT_SECRET: respaldo automático desactivado.');
    return;
  }
  log(`Activo: cada ${INTERVAL_HOURS} h en ${BACKUP_DIR} (se guardan las últimas ${KEEP} copias).`);
  setTimeout(runBackup, 15000); // primer respaldo al arrancar (con margen para que levante la red)
  setInterval(runBackup, INTERVAL_HOURS * 3600 * 1000);
}

module.exports = { runBackup, startBackupSchedule, BACKUP_DIR };

// `node backup.js` -> un respaldo y sale (codigo 1 si fallo)
if (require.main === module) {
  if (!SECRET) {
    console.error('Falta AGENT_SECRET (o BACKUP_AGENT_SECRET) en el .env del agente.');
    process.exit(1);
  }
  runBackup().then((ok) => process.exit(ok ? 0 : 1));
}
