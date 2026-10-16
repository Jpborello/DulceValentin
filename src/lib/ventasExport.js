'use client';

// Exportacion de /ventas: Excel (.xlsx real, con numeros que Excel suma y
// alinea bien) y texto del cierre de jornada para mandar por WhatsApp.
// Antes era un CSV con "1000001.5": en Excel en español el punto se toma
// como separador de miles y esa celda quedaba como texto (a la izquierda).

export const OWNER_WHATSAPP = '5493412172269'; // Mica (dueña) — cierre de jornada

const METHOD = { efectivo: 'Efectivo', transferencia: 'Transferencia' };
const MONEY_FMT = '"$" #,##0;[Red]-"$" #,##0';
const money = (n) => `${Number(n) < 0 ? '−' : ''}$${Math.abs(Number(n || 0)).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
const asDate = (d) => new Date(`${d}T12:00:00`);
const hour = (iso) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA8175A' } };
  row.alignment = { vertical: 'middle' };
  row.height = 20;
}

function addTableSheet(wb, name, columns, records) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 14, style: c.style || {} }));
  styleHeader(ws.getRow(1));
  records.forEach((r) => {
    const row = ws.addRow(r);
    if (r.estado && r.estado !== 'Válido') row.font = { color: { argb: 'FF9CA3AF' }, strike: true };
  });
  if (records.length > 0) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

export async function downloadVentasExcel(data) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dulce Valentín';
  wb.created = new Date();
  const periodLabel = data.from === data.to ? fmtDate(data.from) : `${fmtDate(data.from)} al ${fmtDate(data.to)}`;
  const moneyStyle = { numFmt: MONEY_FMT };
  const dateStyle = { numFmt: 'dd/mm/yyyy' };

  // --- Resumen
  const ws = wb.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 4 }] });
  ws.mergeCells('A1:J1');
  ws.getCell('A1').value = 'Dulce Valentín — Ventas de vendedoras';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.mergeCells('A2:J2');
  ws.getCell('A2').value = `Período: ${periodLabel}  ·  Generado: ${new Date().toLocaleString('es-AR')}`;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF6B7280' } };
  const cols = [
    ['Vendedora', 24], ['Ventas', 9], ['Total vendido', 16], ['Efectivo', 15], ['Transferencia', 15],
    ['% comisión', 12], ['Comisión', 14], ['Vales', 14], ['Pagado', 14], ['Saldo pendiente', 17]
  ];
  cols.forEach(([, w], i) => { ws.getColumn(i + 1).width = w; });
  const header = ws.getRow(4);
  header.values = cols.map(([h]) => h);
  styleHeader(header);
  const first = 5;
  data.sellers.forEach((s, i) => {
    const r = ws.getRow(first + i);
    r.values = [s.name, s.salesCount, s.total, s.cash, s.transfer, Number(s.pct) / 100, s.commission, s.advances, s.paid, s.balance];
  });
  const last = first + data.sellers.length - 1;
  const totalRow = ws.getRow(last + 1);
  totalRow.values = ['TOTAL', ...['B', 'C', 'D', 'E'].map((c) => ({ formula: `SUM(${c}${first}:${c}${Math.max(first, last)})` })), '', ...['G', 'H', 'I', 'J'].map((c) => ({ formula: `SUM(${c}${first}:${c}${Math.max(first, last)})` }))];
  totalRow.font = { bold: true };
  totalRow.border = { top: { style: 'thin' } };
  for (let r = first; r <= last + 1; r++) {
    ['C', 'D', 'E', 'G', 'H', 'I', 'J'].forEach((c) => { ws.getCell(`${c}${r}`).numFmt = MONEY_FMT; });
    ws.getCell(`F${r}`).numFmt = '0.0%';
  }
  ws.getCell(`A${last + 3}`).value = 'Saldo pendiente = todas las comisiones − vales − pagos (acumulado a la fecha de cierre del período). Negativo = vales por encima de la comisión.';
  ws.getCell(`A${last + 3}`).font = { italic: true, size: 9, color: { argb: 'FF6B7280' } };

  const exp = data.export || { sales: [], advances: [], payouts: [], cashCounts: [] };
  const state = (x) => (x.voided_at ? `Anulado: ${x.void_reason || ''}` : 'Válido');

  addTableSheet(wb, 'Ventas', [
    { header: 'Fecha', key: 'fecha', width: 12, style: dateStyle },
    { header: 'Hora carga', key: 'hora', width: 11 },
    { header: 'Vendedora', key: 'vendedora', width: 22 },
    { header: 'Monto', key: 'monto', width: 15, style: moneyStyle },
    { header: 'Medio de pago', key: 'medio', width: 15 },
    { header: 'Nota', key: 'nota', width: 30 },
    { header: 'Estado', key: 'estado', width: 28 }
  ], exp.sales.map((x) => ({ fecha: asDate(x.date), hora: hour(x.created_at), vendedora: x.seller_name, monto: Number(x.amount), medio: METHOD[x.payment_method] || x.payment_method, nota: x.note || '', estado: state(x) })));

  addTableSheet(wb, 'Vales', [
    { header: 'Fecha', key: 'fecha', width: 12, style: dateStyle },
    { header: 'Hora carga', key: 'hora', width: 11 },
    { header: 'Vendedora', key: 'vendedora', width: 22 },
    { header: 'Monto', key: 'monto', width: 15, style: moneyStyle },
    { header: 'Cómo se dio', key: 'medio', width: 15 },
    { header: 'Motivo', key: 'nota', width: 30 },
    { header: 'Estado', key: 'estado', width: 28 }
  ], exp.advances.map((x) => ({ fecha: asDate(x.date), hora: hour(x.created_at), vendedora: x.seller_name, monto: Number(x.amount), medio: METHOD[x.payment_method] || x.payment_method, nota: x.note || '', estado: state(x) })));

  addTableSheet(wb, 'Pagos', [
    { header: 'Fecha', key: 'fecha', width: 12, style: dateStyle },
    { header: 'Hora carga', key: 'hora', width: 11 },
    { header: 'Vendedora', key: 'vendedora', width: 22 },
    { header: 'Monto', key: 'monto', width: 15, style: moneyStyle },
    { header: 'Medio', key: 'medio', width: 15 },
    { header: 'Período liquidado', key: 'periodo', width: 24 },
    { header: 'Nota', key: 'nota', width: 26 },
    { header: 'Estado', key: 'estado', width: 28 }
  ], exp.payouts.map((x) => ({ fecha: asDate(x.date), hora: hour(x.created_at), vendedora: x.seller_name, monto: Number(x.amount), medio: METHOD[x.payment_method] || x.payment_method, periodo: x.period_from ? `${x.period_from} al ${x.period_to}` : '', nota: x.note || '', estado: state(x) })));

  addTableSheet(wb, 'Caja', [
    { header: 'Fecha', key: 'fecha', width: 12, style: dateStyle },
    { header: 'Hora', key: 'hora', width: 9 },
    { header: 'Fondo inicial', key: 'fondo', width: 15, style: moneyStyle },
    { header: 'Esperado', key: 'esperado', width: 15, style: moneyStyle },
    { header: 'Contado', key: 'contado', width: 15, style: moneyStyle },
    { header: 'Diferencia', key: 'diferencia', width: 15, style: moneyStyle },
    { header: 'Nota', key: 'nota', width: 26 },
    { header: 'Estado', key: 'estado', width: 24 }
  ], exp.cashCounts.map((x) => ({ fecha: asDate(x.count_date), hora: hour(x.created_at), fondo: Number(x.opening_float), esperado: Number(x.expected), contado: Number(x.counted), diferencia: Number(x.difference), nota: x.note || '', estado: state(x) })));

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ventas_dulce_valentin_${data.from}${data.to !== data.from ? `_a_${data.to}` : ''}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Texto del cierre (dia, semana o mes) para WhatsApp.
export function cierreText(data) {
  const isDay = data.from === data.to;
  const sellers = data.sellers.filter((s) => s.total > 0 || s.advances > 0 || s.paid > 0);
  const t = data.sellers.reduce((acc, s) => ({
    total: acc.total + s.total, cash: acc.cash + s.cash, transfer: acc.transfer + s.transfer,
    commission: acc.commission + s.commission, advances: acc.advances + s.advances, paid: acc.paid + s.paid, count: acc.count + s.salesCount
  }), { total: 0, cash: 0, transfer: 0, commission: 0, advances: 0, paid: 0, count: 0 });

  const avgTicket = t.count > 0 ? money(Math.round(t.total / t.count)) : '−';

  const lines = [
    `*${isDay ? 'CIERRE DE JORNADA' : 'RESUMEN'} — Dulce Valentín*`,
    `📅 ${isDay ? fmtDate(data.from) : `${fmtDate(data.from)} al ${fmtDate(data.to)}`}`,
    '',
    `💰 *Total vendido: ${money(t.total)}* (${t.count} ventas · ticket prom: ${avgTicket})`,
    `   • Efectivo: ${money(t.cash)}`,
    `   • Transferencia: ${money(t.transfer)}`,
    `🧾 Comisiones: ${money(t.commission)}`,
    `💸 Vales: ${money(t.advances)}`,
    `✅ Pagado a vendedoras: ${money(t.paid)}`,
    ''
  ];
  if (sellers.length > 0) {
    lines.push('*Por vendedora:*');
    sellers.forEach((s) => {
      const sAvg = s.salesCount > 0 ? money(Math.round(s.total / s.salesCount)) : '−';
      lines.push(`• *${s.name}*: vendió ${money(s.total)} (${s.salesCount} vtas · ticket: ${sAvg}) · comisión ${money(s.commission)} (${s.pct}%) · vales ${money(s.advances)}${s.paid ? ` · pagado ${money(s.paid)}` : ''} · saldo ${money(s.balance)}`);
    });
    lines.push('');
  }
  if (isDay && data.cash) {
    lines.push(`🏦 Efectivo del día (sin fondo): ${money(data.cash.expected)}`);
    const c = data.cash.lastCount;
    if (c) {
      const d = Number(c.difference);
      lines.push(`🔎 Arqueo: contado ${money(c.counted)} · ${d === 0 ? 'cerró justo ✅' : d > 0 ? `sobran ${money(d)}` : `faltan ${money(-d)} ⚠️`}`);
    } else {
      lines.push('🔎 Arqueo: no se hizo');
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- Exportación de Transferencias y Alias para Mica
export async function downloadTransferenciasExcelForMica({ date, aliasConfig, transfers, totalTransfers, remaining, limit }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dulce Valentín';
  wb.created = new Date();
  const moneyStyle = { numFmt: MONEY_FMT };
  const dateStyle = { numFmt: 'dd/mm/yyyy' };

  const ws = wb.addWorksheet('Transferencias del Día', { views: [{ state: 'frozen', ySplit: 8 }] });

  // Cabecera Principal
  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = 'Dulce Valentín — Control Diario de Transferencias (Mica)';
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA8175A' } };
  ws.getCell('A1').alignment = { vertical: 'middle' };
  ws.getRow(1).height = 25;

  const pct = limit > 0 ? Math.round((totalTransfers / limit) * 100) : 0;
  const statusLabel = totalTransfers >= limit ? '🚨 TOPE ALCANZADO / EXCEDIDO' : pct >= 80 ? '⚠️ CERCA DEL TOPE' : '✅ DENTRO DEL MARGEN';

  // Fila 3
  ws.getCell('A3').value = 'Fecha:';
  ws.getCell('B3').value = fmtDate(date);
  ws.getCell('A3').font = { bold: true };

  ws.getCell('D3').value = 'Alias del Día:';
  ws.getCell('E3').value = aliasConfig?.alias || 'No definido';
  ws.getCell('D3').font = { bold: true };
  ws.getCell('E3').font = { bold: true, color: { argb: 'FF0D9488' } };

  // Fila 4
  ws.getCell('A4').value = 'Titular / Banco:';
  ws.getCell('B4').value = `${aliasConfig?.holder || '-'} ${aliasConfig?.bank ? `(${aliasConfig.bank})` : ''}`;
  ws.getCell('A4').font = { bold: true };

  ws.getCell('D4').value = 'Estado del Tope:';
  ws.getCell('E4').value = `${statusLabel} (${pct}%)`;
  ws.getCell('D4').font = { bold: true };
  ws.getCell('E4').font = { bold: true };

  // Fila 5
  ws.getCell('A5').value = 'Monto Tope fijado:';
  ws.getCell('B5').value = Number(limit || 0);
  ws.getCell('B5').numFmt = MONEY_FMT;
  ws.getCell('A5').font = { bold: true };

  ws.getCell('D5').value = 'Total transferido:';
  ws.getCell('E5').value = Number(totalTransfers || 0);
  ws.getCell('E5').numFmt = MONEY_FMT;
  ws.getCell('D5').font = { bold: true };
  ws.getCell('E5').font = { bold: true, color: { argb: totalTransfers >= limit ? 'FFDC2626' : 'FF047857' } };

  // Fila 6
  ws.getCell('A6').value = 'Saldo disponible / resto:';
  ws.getCell('B6').value = Number(remaining || 0);
  ws.getCell('B6').numFmt = MONEY_FMT;
  ws.getCell('A6').font = { bold: true };

  ws.getCell('D6').value = 'Operaciones:';
  ws.getCell('E6').value = `${transfers.length} transferencias`;
  ws.getCell('D6').font = { bold: true };

  // Configuración de Columnas
  const cols = [
    ['N°', 6],
    ['Hora', 11],
    ['Monto', 18],
    ['Vendedora', 26],
    ['Nota / Detalle', 34],
    ['Estado', 16]
  ];
  cols.forEach(([, w], i) => { ws.getColumn(i + 1).width = w; });
  const header = ws.getRow(8);
  header.values = cols.map(([h]) => h);
  styleHeader(header);

  // Filas de Datos
  transfers.forEach((t, i) => {
    const row = ws.getRow(9 + i);
    const hourStr = t.createdAt ? hour(t.createdAt) : '--:--';
    row.values = [
      i + 1,
      hourStr,
      Number(t.amount || 0),
      t.sellerName || 'Directa',
      t.note || '',
      t.voided_at ? 'Anulada' : 'Válida'
    ];
    row.getCell(3).numFmt = MONEY_FMT;
    if (t.voided_at) {
      row.font = { color: { argb: 'FF9CA3AF' }, strike: true };
    }
  });

  const totalRowNum = 9 + transfers.length;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.values = ['TOTAL', '', { formula: `SUM(C9:C${Math.max(9, totalRowNum - 1)})` }, '', '', ''];
  totalRow.font = { bold: true };
  totalRow.border = { top: { style: 'thin' } };
  totalRow.getCell(3).numFmt = MONEY_FMT;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const cleanAlias = (aliasConfig?.alias || 'dia').replace(/[^a-z0-9_-]/gi, '_');
  a.download = `transferencias_mica_${date}_${cleanAlias}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Texto de reporte de transferencias del día para WhatsApp de Mica
export function transferenciasWhatsAppText({ date, aliasConfig, transfers, totalTransfers, remaining, limit }) {
  const pct = limit > 0 ? Math.round((totalTransfers / limit) * 100) : 0;
  const isOver = totalTransfers >= limit;
  const isNear = !isOver && pct >= 80;

  const alertLine = isOver
    ? `🚨 *¡ALERTA TOPE ALCANZADO!* (${pct}%) — Cambiar de alias urgente.`
    : isNear
      ? `⚠️ *¡ATENCIÓN!* Al ${pct}% del tope — Quedan ${money(remaining)} disponibles.`
      : `✅ *DENTRO DEL TOPE* (${pct}%) — ${money(remaining)} disponibles.`;

  const lines = [
    `*DULCE VALENTÍN — CONTROL DE TRANSFERENCIAS*`,
    `📅 *Fecha:* ${fmtDate(date)}`,
    `🏦 *Alias del día:* \`${aliasConfig?.alias || 'No definido'}\``,
    aliasConfig?.holder ? `👤 *Titular:* ${aliasConfig.holder}${aliasConfig.bank ? ` (${aliasConfig.bank})` : ''}` : null,
    `🎯 *Monto Tope fijado:* ${money(limit)}`,
    `💰 *Total transferido hoy:* ${money(totalTransfers)} (${transfers.length} ops)`,
    `📊 *Saldo disponible:* ${remaining >= 0 ? money(remaining) : `Exceso: ${money(-remaining)}`}`,
    alertLine,
    '',
    `*Historial de transferencias (${transfers.length}):*`
  ].filter(Boolean);

  if (transfers.length === 0) {
    lines.push('_Sin transferencias registradas para esta fecha._');
  } else {
    transfers.forEach((t, i) => {
      const h = t.createdAt ? hour(t.createdAt) : '--:--';
      const v = t.sellerName ? `· ${t.sellerName}` : '';
      const note = t.note ? ` (${t.note})` : '';
      lines.push(`${i + 1}. *${h}* ➔ *${money(t.amount)}* ${v}${note}`);
    });
  }

  lines.push('');
  lines.push(`*Total a conciliar:* ${money(totalTransfers)}`);

  return lines.join('\n');
}

