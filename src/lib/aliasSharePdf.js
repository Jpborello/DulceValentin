'use client';

// Generador de PDF y enlace a WhatsApp para compartir el total y detalle de transferencias
// al dueño de cada alias de cobro en Dulce Valentín.

const money = (n) => `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
const fmtDateLong = (d) => {
  if (!d) return '';
  const dateObj = new Date(`${d}T12:00:00`);
  return dateObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const fmtDateShort = (d) => {
  if (!d) return '';
  return new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
};
const fmtHour = (iso) => {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

export function cleanPhone(raw) {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  // Si no tiene código de país argentino (54), pero empieza con 341 u otro código de área
  if (!digits.startsWith('54')) {
    if (digits.startsWith('9')) digits = '54' + digits;
    else if (digits.startsWith('15')) digits = '549' + digits.slice(2);
    else digits = '549' + digits;
  }
  return digits;
}

export function buildAliasWhatsAppText({ alias, date, period = 'day', transfers = [], totalAmount = 0 }) {
  const aliasName = alias?.alias || 'Alias';
  const holder = alias?.holder ? `${alias.holder}${alias.bank ? ` (${alias.bank})` : ''}` : (alias?.bank || '');
  const dateLabel = period === 'day' ? fmtDateLong(date) : `Período ${date}`;
  const total = totalAmount || transfers.reduce((sum, t) => sum + (t.amount || 0), 0);
  const count = transfers.length;

  const lines = [
    `*DULCE VALENTÍN — CONTROL DE TRANSFERENCIAS*`,
    `📅 *Fecha:* ${dateLabel}`,
    `🏦 *Alias:* \`${aliasName}\``,
    holder ? `👤 *Titular:* ${holder}` : null,
    ``,
    `💰 *TOTAL A CONCILIAR:* *${money(total)}*`,
    `📊 *Total de transferencias:* ${count} operación${count === 1 ? '' : 'es'}`,
    ``
  ].filter(Boolean);

  if (count === 0) {
    lines.push('_Sin transferencias registradas para esta fecha._');
  } else {
    lines.push(`*Detalle de transferencias:*`);
    transfers.forEach((t, i) => {
      const h = fmtHour(t.createdAt);
      const v = t.sellerName ? `· ${t.sellerName}` : '';
      const sharedTag = t.isShared ? ' 👥' : '';
      const cleanNote = t.note ? ` (${t.note.replace(/\s*\[op:[^\]]+\]/g, '').trim()})` : '';
      lines.push(`${i + 1}. *${h} hs* ➔ *${money(t.amount)}* ${v}${sharedTag}${cleanNote}`);
    });
  }

  lines.push(``);
  lines.push(`📄 _Te adjunto el comprobante en PDF con el detalle completo para que puedas conciliarlo con tu cuenta bancaria._`);
  lines.push(`¡Muchas gracias!`);

  return lines.join('\n');
}

export async function generateAliasPdf({ alias, date, period = 'day', transfers = [] }) {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const total = transfers.reduce((sum, t) => sum + (t.amount || 0), 0);
  const aliasName = alias?.alias || 'alias';
  const cleanAlias = aliasName.replace(/[^a-z0-9_-]/gi, '_');
  const dateLabel = period === 'day' ? fmtDateLong(date) : `Período ${date}`;
  const now = new Date();
  const emitStr = `${now.toLocaleDateString('es-AR')} a las ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`;

  // --- Cabecera con Franja de Marca
  doc.setFillColor(59, 7, 100); // #3B0764 morado oscuro
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('DULCE VALENTÍN', 14, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('CONTROL Y CONCILIACIÓN DE TRANSFERENCIAS BANCARIAS', 14, 18);

  doc.setFontSize(8);
  doc.text(`Emitido: ${emitStr}`, 196, 18, { align: 'right' });

  // --- Recuadro Resumen del Alias
  doc.setFillColor(248, 250, 252); // gris suave
  doc.setDrawColor(226, 232, 240); // borde suave
  doc.roundedRect(14, 29, 182, 32, 3, 3, 'FD');

  // Columna Izquierda: Datos del Alias
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ALIAS / CVU:', 18, 36);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('courier', 'bold');
  doc.text(aliasName, 42, 36);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('TITULAR:', 18, 43);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const holderText = [alias?.holder, alias?.bank].filter(Boolean).join(' · ') || 'No especificado';
  doc.text(holderText, 35, 43);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('FECHA:', 18, 50);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(dateLabel, 35, 50);

  if (alias?.note) {
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Nota: ${alias.note}`, 18, 57);
  }

  // Columna Derecha: Total Grande
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL A CONCILIAR', 190, 36, { align: 'right' });

  doc.setTextColor(4, 120, 87); // #047857 verde banco
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(money(total), 190, 44, { align: 'right' });

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${transfers.length} operaci${transfers.length === 1 ? 'ón' : 'ones'} registrada${transfers.length === 1 ? '' : 's'}`, 190, 50, { align: 'right' });

  // --- Tabla de Transferencias
  const startTableY = alias?.note ? 66 : 64;

  const tableRows = transfers.map((t, idx) => {
    const h = `${fmtHour(t.createdAt)} hs`;
    const amt = money(t.amount);
    const seller = t.sellerName || '—';
    const cleanNote = (t.note || '').replace(/\s*\[op:[^\]]+\]/g, '').trim();
    const noteText = t.isShared
      ? (cleanNote ? `${cleanNote} (Venta compartida)` : 'Venta compartida entre vendedoras')
      : (cleanNote || '—');
    const comp = t.attachment ? 'Adjuntado ✓' : '—';
    return [idx + 1, h, amt, seller, noteText, comp];
  });

  autoTable(doc, {
    startY: startTableY,
    head: [['#', 'Hora', 'Monto transferido', 'Vendedora(s)', 'Detalle / Nota', 'Comprobante']],
    body: tableRows,
    foot: [['', 'TOTAL', money(total), '', `${transfers.length} operaciones`, '']],
    theme: 'grid',
    headStyles: {
      fillColor: [76, 29, 149], // #4C1D95
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87], cellWidth: 32 },
      3: { halign: 'left', cellWidth: 35 },
      4: { halign: 'left' },
      5: { halign: 'center', cellWidth: 24, fontSize: 7.5 }
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      lineColor: [229, 231, 235],
      lineWidth: 0.2
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    didDrawPage: (data) => {
      // Pie de página en cada hoja
      const str = `Página ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(str, 196, 287, { align: 'right' });
      doc.text('Dulce Valentín · Documento confidencial para conciliación de transferencias', 14, 287);
    }
  });

  const fileName = `DulceValentin_Transferencias_${cleanAlias}_${date}.pdf`;
  const blob = doc.output('blob');
  const dataUrl = doc.output('datauristring');

  return {
    doc,
    fileName,
    blob,
    dataUrl
  };
}

export async function shareAliasViaWhatsApp({ alias, date, period = 'day', transfers = [], phone = '' }) {
  const { doc, fileName, blob } = await generateAliasPdf({ alias, date, period, transfers });
  const total = transfers.reduce((sum, t) => sum + (t.amount || 0), 0);
  const text = buildAliasWhatsAppText({ alias, date, period, transfers, totalAmount: total });

  const targetPhone = cleanPhone(phone || alias?.phone || '');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  // 1) Si el navegador soporta compartir archivos nativamente (móviles Android / iOS / etc.)
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Transferencias ${alias?.alias || ''}`,
        text
      });
      return { method: 'native_share', fileName };
    } catch (err) {
      // Si el usuario canceló el diálogo nativo, no forzamos error
      if (err.name === 'AbortError') return { method: 'aborted', fileName };
    }
  }

  // 2) En desktop / PC: descargamos el PDF y abrimos WhatsApp con el texto preparado
  doc.save(fileName);

  const waUrl = targetPhone
    ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  window.open(waUrl, '_blank', 'noopener');
  return { method: 'download_and_whatsapp', fileName, targetPhone };
}
