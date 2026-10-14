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

  const lines = [
    `*${isDay ? 'CIERRE DE JORNADA' : 'RESUMEN'} — Dulce Valentín*`,
    `📅 ${isDay ? fmtDate(data.from) : `${fmtDate(data.from)} al ${fmtDate(data.to)}`}`,
    '',
    `💰 *Total vendido: ${money(t.total)}* (${t.count} ventas)`,
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
      lines.push(`• *${s.name}*: vendió ${money(s.total)} (ef. ${money(s.cash)} / transf. ${money(s.transfer)}) · comisión ${money(s.commission)} (${s.pct}%) · vales ${money(s.advances)}${s.paid ? ` · pagado ${money(s.paid)}` : ''} · saldo ${money(s.balance)}`);
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
