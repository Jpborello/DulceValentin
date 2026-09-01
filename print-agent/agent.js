// Agente de impresion remota — corre en una PC conectada a la impresora
// del local (cualquier marca: usa el driver que Windows ya tenga instalado
// para esa impresora, via pdf-to-printer). Escucha la cola "print_jobs" de
// Supabase y va imprimiendo lo que llega desde el panel de admin, sin
// importar desde donde se haya mandado el pedido.
//
// Pensado para ser reusable en otro negocio/cliente: no conoce nada de
// "Dulce Valentín" mas alla del texto que le llega en ticket_data — todo lo
// especifico del rubro vive del lado del panel web, que arma ese JSON.

require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const PDFDocument = require('pdfkit');
const { print: printPdf, getDefaultPrinter } = require('pdf-to-printer');

const SITE_URL = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const AGENT_SECRET = process.env.AGENT_SECRET;
const PRINTER_NAME = process.env.PRINTER_NAME || null; // vacio = impresora predeterminada de Windows
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);

if (!AGENT_SECRET) {
  console.error('Falta AGENT_SECRET en el .env del agente. Copia .env.example a .env y completalo.');
  process.exit(1);
}

function money(n) {
  return `$${Number(n || 0).toLocaleString('es-AR')}`;
}

// Arma el PDF de la comanda con pdfkit (sin depender de un navegador/Chromium
// para renderizar, asi el agente es liviano y anda en cualquier PC Windows).
function buildTicketPdf(ticket, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 28 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.font('Helvetica-Bold').fontSize(18).text(ticket.company || 'COMANDA', { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(10).text(ticket.subtitle || '', { align: 'center' });
    doc.moveDown(0.6);
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`ORDEN N°: ${ticket.order_id || '-'}`);
    doc.text(`FECHA Y HORA: ${ticket.date || '-'}`);
    doc.moveDown(0.5);

    const client = ticket.client || {};
    const sender = ticket.sender || {};
    const isRetiro = (client.delivery_method || '').toLowerCase().includes('retiro');

    const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const lineHeight = 11;
    const boxPad = 14;

    // Caja de datos del remitente (solo aplica si es envio por transporte)
    if (!isRetiro && (sender.name || sender.address)) {
      const senderTop = doc.y;
      const senderLines = 5;
      const senderBoxHeight = boxPad + senderLines * lineHeight;
      doc.rect(doc.x, senderTop, boxWidth, senderBoxHeight).stroke();
      doc.font('Helvetica-Bold').fontSize(8.5);
      doc.text('REMITENTE', doc.x + 6, senderTop + 6, { width: 300, lineGap: 1.5 });
      doc.text(`${sender.name || '-'}`, doc.x + 6, doc.y, { lineGap: 1.5 });
      doc.text(`Direccion: ${sender.address || '-'}`, doc.x + 6, doc.y, { lineGap: 1.5 });
      doc.text(`Localidad / Provincia: ${sender.locality || '-'} / ${sender.province || '-'}`, doc.x + 6, doc.y, { lineGap: 1.5 });
      doc.text(`CP: ${sender.postal_code || '-'}  |  Tel: ${sender.phone || '-'}`, doc.x + 6, doc.y, { lineGap: 1.5 });
      doc.y = senderTop + senderBoxHeight + 8;
      doc.x = doc.page.margins.left;
    }

    // Caja de datos del cliente
    const clientTop = doc.y;
    const clientLines = isRetiro ? 5 : 8;
    const clientBoxHeight = boxPad + clientLines * lineHeight;
    doc.rect(doc.x, clientTop, boxWidth, clientBoxHeight).stroke();
    const boxX = doc.x + 6;
    doc.font('Helvetica-Bold').fontSize(8.5);
    doc.text('DESTINATARIO', boxX, clientTop + 6, { lineGap: 1.5 });
    doc.text(`Nombre Completo: ${client.name || '-'}`, boxX, doc.y, { lineGap: 1.5 });
    doc.text(`DNI / CUIT: ${client.dni || '-'}`, boxX, doc.y, { lineGap: 1.5 });
    doc.text(`Telefono: ${client.phone || '-'}`, boxX, doc.y, { lineGap: 1.5 });
    doc.text(`Entrega: ${isRetiro ? 'RETIRO POR SUCURSAL' : 'ENVIO A DOMICILIO / TRANSPORTE'}`, boxX, doc.y, { lineGap: 1.5 });
    if (!isRetiro) {
      doc.text(`Direccion: ${client.address || 'No especificada'}${client.floor_apt ? ` (${client.floor_apt})` : ''}`, boxX, doc.y, { lineGap: 1.5 });
      doc.text(`Localidad: ${client.locality || '-'}`, boxX, doc.y, { lineGap: 1.5 });
      doc.text(`CP: ${client.postal_code || '-'}`, boxX, doc.y, { lineGap: 1.5 });
    }
    doc.y = clientTop + clientBoxHeight + 10;
    doc.x = doc.page.margins.left;

    // Tabla de items
    doc.font('Helvetica-Bold').fontSize(9).text('DETALLE DEL PEDIDO A PREPARAR:');
    doc.moveDown(0.3);

    const items = Array.isArray(ticket.items) ? ticket.items : [];
    const tableX = doc.page.margins.left;
    const colWidths = { arm: 24, ctrl: 24, name: 150, size: 40, color: 55, qty: 30, sub: 55 };
    let y = doc.y;

    const drawRow = (cells, bold, rowHeight) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.6);
      let x = tableX;
      const heights = [colWidths.arm, colWidths.ctrl, colWidths.name, colWidths.size, colWidths.color, colWidths.qty, colWidths.sub];
      cells.forEach((cell, i) => {
        doc.text(cell, x + 2, y + 3, { width: heights[i] - 4, align: i >= 3 ? 'center' : 'left' });
        x += heights[i];
      });
      doc.rect(tableX, y, Object.values(colWidths).reduce((a, b) => a + b, 0), rowHeight).stroke();
      y += rowHeight;
    };

    drawRow(['Arm', 'Ctrl', 'Producto', 'Talle', 'Color', 'Cant', 'Subt.'], true, 16);

    items.forEach((item) => {
      if (y > doc.page.height - doc.page.margins.bottom - 100) {
        doc.addPage({ size: 'A5', margin: 28 });
        y = doc.page.margins.top;
      }
      drawRow(
        ['[ ]', '[ ]', `${item.name || 'Producto'}${item.code ? ` (${item.code})` : ''}`, item.size || '-', item.color || 'Surtido', `x${item.qty || 1}`, money(item.subtotal)],
        false,
        16
      );
    });

    doc.y = y + 10;
    doc.x = tableX;

    if (ticket.discount_applied > 0) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#92400E').text(`Baucher aplicado: -${money(ticket.discount_applied)}`, { align: 'right' });
      doc.fillColor('#000000');
    }
    doc.font('Helvetica-Bold').fontSize(11).text(`TOTAL: ${money(ticket.total)}`, { align: 'right' });
    if (ticket.is_wholesale) {
      doc.font('Helvetica').fontSize(8).text('Venta Mayorista', { align: 'right' });
    }
    doc.moveDown(0.8);

    const checks = ticket.footer_checks || [];
    doc.font('Helvetica-Bold').fontSize(8).text('CONTROL DE DEPOSITO Y CONTROL FINAL:');
    doc.font('Helvetica').fontSize(8).text(checks.map((c) => `[ ] ${c}`).join('     '));
    doc.moveDown(0.6);
    doc.text('Firma Armador: ______________________        Firma Control: ______________________');

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function fetchPendingJobs() {
  const res = await fetch(`${SITE_URL}/api/admin/print-jobs`, {
    headers: { 'x-agent-secret': AGENT_SECRET }
  });
  if (!res.ok) throw new Error(`GET print-jobs -> HTTP ${res.status}`);
  const data = await res.json();
  return data.jobs || [];
}

async function reportStatus(id, status, error_message) {
  await fetch(`${SITE_URL}/api/admin/print-jobs`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-agent-secret': AGENT_SECRET },
    body: JSON.stringify({ id, status, error_message })
  });
}

async function processJob(job) {
  console.log(`[${new Date().toLocaleTimeString('es-AR')}] Imprimiendo pedido ${job.order_id || job.id}...`);
  await reportStatus(job.id, 'printing');

  const tmpFile = path.join(os.tmpdir(), `comanda-${job.id}.pdf`);
  try {
    await buildTicketPdf(job.ticket_data, tmpFile);
    await printPdf(tmpFile, { printer: PRINTER_NAME || undefined, silent: true });
    await reportStatus(job.id, 'printed');
    console.log(`  -> Impreso OK.`);
  } catch (err) {
    console.error(`  -> Error al imprimir: ${err.message}`);
    await reportStatus(job.id, 'error', err.message);
  } finally {
    fs.unlink(tmpFile, () => {});
  }
}

async function pollLoop() {
  try {
    const jobs = await fetchPendingJobs();
    for (const job of jobs) {
      await processJob(job);
    }
  } catch (err) {
    console.error('Error consultando la cola de impresion:', err.message);
  } finally {
    setTimeout(pollLoop, POLL_INTERVAL_MS);
  }
}

(async () => {
  console.log('=== Agente de impresion remota ===');
  console.log(`Sitio: ${SITE_URL}`);
  try {
    const def = await getDefaultPrinter();
    console.log(`Impresora ${PRINTER_NAME ? `configurada: ${PRINTER_NAME}` : `predeterminada de Windows: ${def ? def.name : '(ninguna encontrada)'}`}`);
  } catch (err) {
    console.warn('No se pudo detectar la impresora predeterminada:', err.message);
  }
  console.log(`Consultando cola cada ${POLL_INTERVAL_MS / 1000}s. Ctrl+C para salir.\n`);
  pollLoop();
})();
