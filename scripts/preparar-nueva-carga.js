const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CARGA = path.join(ROOT, 'carga');
const MD_FILE = path.join(ROOT, 'Productos.md');

function loadEnvLocal() {
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

const filesInCarga = fs.readdirSync(CARGA);

// Normalizador para matchear lineas de Productos.md con nombres de archivo en carga/
function clean(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const rawContent = fs.readFileSync(MD_FILE, 'utf8');

// Los bloques estan delimitados por '(' y ')'
const rawBlocks = rawContent.split('(').map(b => b.trim()).filter(Boolean);

const products = [];
const usedFiles = new Set();

rawBlocks.forEach((block, bIdx) => {
  const cleanBlock = block.replace(/\)[^)]*$/, '').trim();
  const lines = cleanBlock.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return;

  // Detecta si una linea es un nombre de archivo de imagen
  const imageLines = [];
  const textLines = [];

  lines.forEach(line => {
    // Si la linea es una nota como "(Son del mismo articulo." la salteamos
    if (line.toLowerCase().startsWith('son del mismo') || line.toLowerCase().startsWith('zapatillas infantil')) return;
    
    // Quita prefijos numericos tipo 001, 002, 1070...
    const lineWithoutNum = line.replace(/^\d+\s*/, '').trim();
    const lNorm = clean(line);
    const lNoNumNorm = clean(lineWithoutNum);

    // Busca coincidencia en filesInCarga
    const match = filesInCarga.find(f => {
      const fBase = path.parse(f).name;
      const fNorm = clean(fBase);
      const fNoNumNorm = clean(fBase.replace(/^\d+\s*/, ''));
      return fNorm === lNorm || fNoNumNorm === lNoNumNorm || (lNoNumNorm.length > 5 && fNorm.includes(lNoNumNorm)) || (fNoNumNorm.length > 5 && lNorm.includes(fNoNumNorm));
    });

    if (match) {
      imageLines.push(match);
      usedFiles.add(match);
    } else {
      textLines.push(line);
    }
  });

  products.push({
    index: bIdx + 1,
    textLines,
    images: Array.from(new Set(imageLines))
  });
});

console.log(`Total productos detectados: ${products.length}`);
let totalImgs = 0;
products.forEach(p => {
  totalImgs += p.images.length;
  console.log(`[#${p.index}] Texto: "${p.textLines.slice(0, 2).join(' / ')}" -> ${p.images.length} fotos:`, p.images);
});

console.log(`\nTotal fotos asignadas: ${totalImgs} de ${filesInCarga.length}`);
const unassigned = filesInCarga.filter(f => !usedFiles.has(f));
console.log(`Fotos sin asignar (${unassigned.length}):`, unassigned);
