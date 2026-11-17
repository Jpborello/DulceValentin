// Genera Especificaciones_Blindaje_Local_First_y_Backups.pdf a partir del .md
// (el .md es la fuente: editar ese y volver a correr `node scripts/generate_specs_pdf.js`).
// Soporta lo que usa ese documento: titulos #/##/###/####, parrafos, listas
// (- y 1.), citas (>), tablas simples, separadores (---), **negrita** y `codigo`.
const { jsPDF } = require('jspdf');
const autoTableImport = require('jspdf-autotable');
const autoTable = autoTableImport.default || autoTableImport;
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'Especificaciones_Blindaje_Local_First_y_Backups.md');
const OUT = path.join(ROOT, 'Especificaciones_Blindaje_Local_First_y_Backups.pdf');

const MAGENTA = [168, 23, 90];
const TEXT = [36, 30, 40];
const MUTED = [110, 101, 110];
const SOFT = [252, 237, 243];
const LEFT = 16;
const WIDTH = 178;
const BOTTOM = 282;

// jsPDF con fuentes estandar no tiene emojis ni algunos simbolos.
const clean = (s) =>
  s
    .replace(/[☁]/g, '')
    .replace(/[⚠]/g, '(!)')
    .replace(/[→]/g, '->')
    .replace(/[^\u0000-ÿ–—‘’“”•…]/g, '')
    .replace(/\s{2,}$/, '');
const plain = (s) => clean(s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1'));

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
let y = 18;

function ensure(h) {
  if (y + h > BOTTOM) {
    doc.addPage();
    y = 18;
  }
}

// Texto con **negrita** y `codigo` dentro de la linea, con salto automatico.
function richText(text, { x = LEFT, width = WIDTH, size = 9.5, lineH = 4.6, color = TEXT } = {}) {
  const tokens = [];
  clean(text).split(/(\*\*.+?\*\*|`.+?`)/g).filter(Boolean).forEach((part) => {
    let style = 'normal';
    let value = part;
    if (part.startsWith('**')) { style = 'bold'; value = part.slice(2, -2); }
    else if (part.startsWith('`')) { style = 'code'; value = part.slice(1, -1); }
    value.split(/(\s+)/).filter((w) => w.length).forEach((w) => tokens.push({ w, style }));
  });

  doc.setFontSize(size);
  let cx = x;
  ensure(lineH);
  for (const t of tokens) {
    doc.setFont(t.style === 'code' ? 'courier' : 'helvetica', t.style === 'bold' ? 'bold' : 'normal');
    doc.setTextColor(...(t.style === 'code' ? MAGENTA : color));
    const isSpace = /^\s+$/.test(t.w);
    const tw = doc.getTextWidth(t.w);
    if (!isSpace && cx + tw > x + width && cx > x) {
      y += lineH;
      ensure(lineH);
      cx = x;
    }
    if (isSpace && cx === x) continue;
    doc.text(t.w, cx, y);
    cx += tw;
  }
  y += lineH;
}

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  if (!trimmed) { y += 1.6; continue; }

  if (trimmed === '---') {
    ensure(6);
    doc.setDrawColor(230, 210, 220);
    doc.setLineWidth(0.3);
    doc.line(LEFT, y, LEFT + WIDTH, y);
    y += 5;
    continue;
  }

  const h = trimmed.match(/^(#{1,4})\s+(.*)$/);
  if (h) {
    const level = h[1].length;
    const sizes = { 1: 16, 2: 12.5, 3: 11.5, 4: 10.2 };
    if (level === 1) {
      ensure(18);
      doc.setFillColor(...SOFT);
      doc.roundedRect(LEFT - 2, y - 7, WIDTH + 4, 12, 3, 3, 'F');
    } else {
      y += level === 2 ? 2 : 2.5;
      ensure(10);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(sizes[level]);
    doc.setTextColor(...(level <= 3 ? MAGENTA : TEXT));
    doc.splitTextToSize(plain(h[2]), WIDTH).forEach((l) => { ensure(6); doc.text(l, LEFT, y); y += sizes[level] * 0.48; });
    y += level === 1 ? 4 : 1.5;
    continue;
  }

  if (trimmed.startsWith('|')) {
    const rows = [];
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => plain(c.trim()));
      if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
      i++;
    }
    i--;
    autoTable(doc, {
      startY: y,
      head: [rows[0]],
      body: rows.slice(1),
      margin: { left: LEFT, right: 16 },
      styles: { font: 'helvetica', fontSize: 8.4, cellPadding: 2, textColor: TEXT },
      headStyles: { fillColor: MAGENTA, textColor: 255 },
      alternateRowStyles: { fillColor: [250, 245, 248] }
    });
    y = doc.lastAutoTable.finalY + 4;
    continue;
  }

  if (trimmed.startsWith('>')) {
    const text = trimmed.replace(/^>\s?/, '');
    ensure(10);
    const startY = y;
    richText(text, { x: LEFT + 5, width: WIDTH - 7, size: 9, color: [120, 53, 15] });
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.9);
    doc.line(LEFT + 1.5, startY - 3.5, LEFT + 1.5, y - 3);
    y += 1;
    continue;
  }

  const bullet = line.match(/^(\s*)(-|\d+\.)\s+(.*)$/);
  if (bullet) {
    const indent = Math.min(2, Math.floor(bullet[1].length / 2));
    const x = LEFT + 3 + indent * 5;
    const marker = bullet[2] === '-' ? '•' : bullet[2];
    ensure(5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...MAGENTA);
    doc.text(marker, x, y);
    richText(bullet[3], { x: x + (marker === '•' ? 4 : 5.5), width: WIDTH - (x - LEFT) - 6 });
    continue;
  }

  richText(trimmed, { color: trimmed.startsWith('**') ? TEXT : TEXT });
}

const pages = doc.getNumberOfPages();
for (let p = 1; p <= pages; p++) {
  doc.setPage(p);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`Dulce Valentín — Respaldo local + nube y funcionamiento sin internet · Página ${p} de ${pages}`, LEFT, 290);
}

fs.writeFileSync(OUT, Buffer.from(doc.output('arraybuffer')));
console.log(`PDF generado: ${OUT} (${pages} páginas)`);
