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
  ws.getCell(`A${last + 3}`).font = { italic: true, size: 9, color: { argb: 'FF6B7280' } };

  const exp = data.export || { sales: [], advances: [], payouts: [], expenses: [], cashCounts: [] };
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

  addTableSheet(wb, 'Gastos', [
    { header: 'Fecha', key: 'fecha', width: 12, style: dateStyle },
    { header: 'Hora carga', key: 'hora', width: 11 },
    { header: 'Categoría', key: 'categoria', width: 16 },
    { header: 'Concepto / Detalle', key: 'descripcion', width: 30 },
    { header: 'Monto', key: 'monto', width: 15, style: moneyStyle },
    { header: 'Medio de pago', key: 'medio', width: 15 },
    { header: 'Vendedora (si aplica)', key: 'vendedora', width: 20 },
    { header: 'Nota', key: 'nota', width: 25 },
    { header: 'Estado', key: 'estado', width: 28 }
  ], (exp.expenses || []).map((x) => ({
    fecha: asDate(x.date || x.expense_date),
    hora: hour(x.created_at),
    categoria: x.category || 'Varios',
    descripcion: x.description || '',
    monto: Number(x.amount),
    medio: METHOD[x.payment_method] || x.payment_method,
    vendedora: x.seller_name || '',
    nota: x.note || '',
    estado: state(x)
  })));

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
    ...(data.cash?.expensesCash > 0 ? [`🛒 Gastos de caja: ${money(data.cash.expensesCash)}`] : []),
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
export async function downloadTransferenciasExcelForMica({ date, aliasConfig, aliases = [], transfers, totalTransfers, remaining, limit }) {
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

  ws.getCell('D3').value = aliases.length ? 'Alias activos:' : 'Alias del Día:';
  ws.getCell('E3').value = aliases.length
    ? aliases.filter((x) => x.active).map((x) => x.alias).join(', ') || 'Ninguno'
    : aliasConfig?.alias || 'No definido';
  ws.getCell('D3').font = { bold: true };
  ws.getCell('E3').font = { bold: true, color: { argb: 'FF0D9488' } };

  // Fila 4
  ws.getCell('A4').value = 'Titular / Banco:';
  ws.getCell('B4').value = aliases.length ? 'Ver hoja "Por alias"' : `${aliasConfig?.holder || '-'} ${aliasConfig?.bank ? `(${aliasConfig.bank})` : ''}`;
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
    ['Alias', 24],
    ['Nota / Detalle', 34],
    ['Comprobante / Drive', 36],
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
    const compStr = t.attachment ? (t.attachment.driveUrl || t.attachment.url || t.attachment.fileName || 'Adjuntado') : 'Sin comprobante';
    row.values = [
      i + 1,
      hourStr,
      Number(t.amount || 0),
      t.sellerName || 'Directa',
      t.aliasName || '',
      t.note || '',
      compStr,
      t.voided_at ? 'Anulada' : 'Válida'
    ];
    row.getCell(3).numFmt = MONEY_FMT;
    if (t.voided_at) {
      row.font = { color: { argb: 'FF9CA3AF' }, strike: true };
    }
  });

  const totalRowNum = 9 + transfers.length;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.values = ['TOTAL', '', { formula: `SUM(C9:C${Math.max(9, totalRowNum - 1)})` }, '', '', '', '', ''];
  totalRow.font = { bold: true };
  totalRow.border = { top: { style: 'thin' } };
  totalRow.getCell(3).numFmt = MONEY_FMT;

  if (aliases.length) {
    const wa = wb.addWorksheet('Por alias', { views: [{ state: 'frozen', ySplit: 1 }] });
    wa.columns = [
      { header: 'Alias', key: 'alias', width: 26 },
      { header: 'Titular', key: 'holder', width: 22 },
      { header: 'Banco', key: 'bank', width: 16 },
      { header: 'Descripción', key: 'description', width: 32 },
      { header: 'Anotación del día', key: 'note', width: 32 },
      { header: 'Mínimo', key: 'min', width: 13, style: { numFmt: MONEY_FMT } },
      { header: 'Máximo', key: 'max', width: 13, style: { numFmt: MONEY_FMT } },
      { header: 'Tope del día', key: 'limit', width: 14, style: { numFmt: MONEY_FMT } },
      { header: 'Recibido', key: 'received', width: 14, style: { numFmt: MONEY_FMT } },
      { header: 'Transferencias', key: 'count', width: 14 },
      { header: 'Estado', key: 'state', width: 16 }
    ];
    styleHeader(wa.getRow(1));
    aliases.forEach((x) => {
      const isOver = x.dailyLimit && (x.receivedToday || 0) >= x.dailyLimit;
      wa.addRow({
        alias: x.alias, holder: x.holder, bank: x.bank, description: x.description,
        note: x.note || '—',
        min: x.minAmount, max: x.maxAmount, limit: x.dailyLimit,
        received: Number(x.receivedToday || 0), count: x.countToday || 0,
        state: !x.active ? 'Pausado' : isOver ? '🚨 Tope superado' : 'Activo'
      });
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const cleanAlias = (aliases.length ? 'alias' : (aliasConfig?.alias || 'dia')).replace(/[^a-z0-9_-]/gi, '_');
  a.download = `transferencias_mica_${date}_${cleanAlias}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Texto de reporte de transferencias del día para WhatsApp de Mica
export function transferenciasWhatsAppText({ date, aliasConfig, aliases = [], transfers, totalTransfers, remaining, limit }) {
  const pct = limit > 0 ? Math.round((totalTransfers / limit) * 100) : 0;
  const isOver = totalTransfers >= limit;
  const isNear = !isOver && pct >= 80;

  const alertLine = isOver
    ? `🚨 *¡ALERTA TOPE ALCANZADO!* (${pct}%) — Cambiar de alias urgente.`
    : isNear
      ? `⚠️ *¡ATENCIÓN!* Al ${pct}% del tope — Quedan ${money(remaining)} disponibles.`
      : `✅ *DENTRO DEL TOPE* (${pct}%) — ${money(remaining)} disponibles.`;

  const aliasLines = aliases.length
    ? [
      `💰 *Total transferido hoy:* ${money(totalTransfers)} (${transfers.length} ops)`,
      '',
      '*Por alias:*',
      ...aliases.map((x) => {
        const tope = x.dailyLimit ? ` de ${money(x.dailyLimit)}${x.receivedToday >= x.dailyLimit ? ' 🚨 LLENO' : ''}` : '';
        return `🏦 \`${x.alias}\`${x.active ? '' : ' (pausado)'}: *${money(x.receivedToday)}*${tope} · ${x.countToday || 0} ops`;
      }),
      ''
    ]
    : null;

  if (aliasLines) {
    const out = [`*DULCE VALENTÍN — CONTROL DE TRANSFERENCIAS*`, `📅 *Fecha:* ${fmtDate(date)}`, ...aliasLines, `*Historial de transferencias (${transfers.length}):*`];
    if (transfers.length === 0) out.push('_Sin transferencias registradas para esta fecha._');
    transfers.forEach((t, i) => {
      const h = t.createdAt ? hour(t.createdAt) : '--:--';
      out.push(`${i + 1}. *${h}* ➔ *${money(t.amount)}* · ${t.sellerName || ''}${t.aliasName ? ` → ${t.aliasName}` : ''}${t.note ? ` (${t.note})` : ''}`);
    });
    out.push('', `*Total a conciliar:* ${money(totalTransfers)}`);
    return out.join('\n');
  }

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

// ---------------------------------------------------------------- Exportación Gerencial Completa para Supervisora (Mica)
export async function downloadSupervisorExcel({ data, period, date, supervisorData }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dulce Valentín — Panel Supervisora';
  wb.created = new Date();
  const periodLabel = data.from === data.to ? fmtDate(data.from) : `${fmtDate(data.from)} al ${fmtDate(data.to)}`;
  const moneyStyle = { numFmt: MONEY_FMT };
  const dateStyle = { numFmt: 'dd/mm/yyyy' };

  const totals = (data?.sellers || []).reduce((t, s) => ({
    total: t.total + s.total,
    cash: t.cash + s.cash,
    transfer: t.transfer + s.transfer,
    commission: t.commission + s.commission,
    advances: t.advances + s.advances,
    paid: t.paid + s.paid,
    balance: t.balance + s.balance,
    salesCount: t.salesCount + s.salesCount
  }), { total: 0, cash: 0, transfer: 0, commission: 0, advances: 0, paid: 0, balance: 0, salesCount: 0 });

  const netMargin = totals.total - totals.commission;
  const marginPct = totals.total > 0 ? Math.round((netMargin / totals.total) * 1000) / 10 : 100;

  // --- Solapa 1: Resumen Gerencial
  const ws1 = wb.addWorksheet('Resumen Gerencial', { views: [{ state: 'frozen', ySplit: 5 }] });
  ws1.mergeCells('A1:G1');
  ws1.getCell('A1').value = 'Dulce Valentín — Informe Gerencial Ejecutivo';
  ws1.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  ws1.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  ws1.getCell('A1').alignment = { vertical: 'middle' };
  ws1.getRow(1).height = 26;

  ws1.mergeCells('A2:G2');
  ws1.getCell('A2').value = `Período: ${periodLabel}  ·  Supervisora: Micaela Barbieri  ·  Generado: ${new Date().toLocaleString('es-AR')}`;
  ws1.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };

  // KPIs en filas
  const kpiRows = [
    ['Métrica Gerencial', 'Valor / Monto', 'Detalle'],
    ['Facturación Bruta (Venta Total)', totals.total, `${totals.salesCount} operaciones`],
    ['Margen Neto del Local', netMargin, `${marginPct}% de retención comercial`],
    ['Recaudación en Efectivo', totals.cash, `${totals.total > 0 ? Math.round((totals.cash / totals.total) * 100) : 0}% del total`],
    ['Recaudación en Transferencias', totals.transfer, `${totals.total > 0 ? Math.round((totals.transfer / totals.total) * 100) : 0}% del total`],
    ['Comisiones Devengadas', totals.commission, 'A favor del personal'],
    ['Vales / Adelantos Entregados', totals.advances, 'Efectivo retirado'],
    ['Liquidaciones Pagadas', totals.paid, 'Comisiones ya saldadas'],
    ['Saldo Laboral Pendiente', totals.balance, 'Pasivo acumulado por liquidar'],
    ['Ticket Promedio General', totals.salesCount > 0 ? Math.round(totals.total / totals.salesCount) : 0, 'Por operación']
  ];

  kpiRows.forEach((r, idx) => {
    const row = ws1.addRow(r);
    if (idx === 0) {
      styleHeader(row);
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    } else {
      row.getCell(2).numFmt = MONEY_FMT;
      row.getCell(1).font = { bold: true };
      if (idx === 1 || idx === 2) {
        row.font = { bold: true };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
    }
  });

  ws1.getColumn(1).width = 30;
  ws1.getColumn(2).width = 20;
  ws1.getColumn(3).width = 30;

  // --- Solapa 2: Auditoría de Transferencias
  const transfers = data.periodTransfers || data.dayTransfers || [];
  const aliasByDate = supervisorData?.aliasByDate || {};
  addTableSheet(wb, 'Transferencias', [
    { header: 'Fecha', key: 'fecha', width: 12, style: dateStyle },
    { header: 'Hora', key: 'hora', width: 10 },
    { header: 'Monto', key: 'monto', width: 16, style: moneyStyle },
    { header: 'Vendedora', key: 'vendedora', width: 22 },
    { header: 'Alias Destino', key: 'alias', width: 24 },
    { header: 'Titular / Banco', key: 'titular', width: 26 },
    { header: 'Nota / Detalle', key: 'nota', width: 32 },
    { header: 'Comprobante / Enlace', key: 'comprobante', width: 36 }
  ], transfers.map((t) => {
    const aliasInfo = aliasByDate[t.date] || data.dailyAlias || {};
    const compStr = t.attachment ? (t.attachment.driveUrl || t.attachment.url || t.attachment.fileName || 'Adjuntado') : 'Sin comprobante';
    return {
      fecha: asDate(t.date),
      hora: t.createdAt ? hour(t.createdAt) : '--:--',
      monto: Number(t.amount || 0),
      vendedora: t.sellerName || 'Vendedora',
      alias: t.aliasName || aliasInfo.alias || 'dulce.valentin.rioja',
      titular: `${aliasInfo.holder || '-'} ${aliasInfo.bank ? `(${aliasInfo.bank})` : ''}`,
      nota: t.note || '',
      comprobante: compStr
    };
  }));

  // --- Solapa: Alias y Anotaciones
  if (data.aliases && data.aliases.length > 0) {
    addTableSheet(wb, 'Alias y Anotaciones', [
      { header: 'Alias', key: 'alias', width: 26 },
      { header: 'Titular / Banco', key: 'titular', width: 26 },
      { header: 'Anotación del día', key: 'nota', width: 36 },
      { header: 'Recibido hoy', key: 'recibido', width: 16, style: moneyStyle },
      { header: 'Tope diario', key: 'tope', width: 16, style: moneyStyle },
      { header: 'Operaciones', key: 'ops', width: 14 },
      { header: 'Estado', key: 'estado', width: 16 }
    ], data.aliases.map((a) => {
      const isOver = a.dailyLimit && (a.receivedToday || 0) >= a.dailyLimit;
      return {
        alias: a.alias,
        titular: [a.holder, a.bank].filter(Boolean).join(' · ') || '—',
        nota: a.note || '—',
        recibido: Number(a.receivedToday || 0),
        tope: Number(a.dailyLimit || 0),
        ops: a.countToday || 0,
        estado: !a.active ? 'Pausado' : isOver ? '🚨 Tope superado' : 'Activo'
      };
    }));
  }

  // --- Solapa 3: Rendimiento de Vendedoras
  addTableSheet(wb, 'Rendimiento Vendedoras', [
    { header: 'Vendedora', key: 'name', width: 24 },
    { header: 'Ventas', key: 'salesCount', width: 10 },
    { header: 'Total Vendido', key: 'total', width: 18, style: moneyStyle },
    { header: 'Ticket Promedio', key: 'avgTicket', width: 16, style: moneyStyle },
    { header: 'Efectivo', key: 'cash', width: 15, style: moneyStyle },
    { header: 'Transferencia', key: 'transfer', width: 15, style: moneyStyle },
    { header: '% Comisión', key: 'pct', width: 12 },
    { header: 'Comisión Devengada', key: 'commission', width: 18, style: moneyStyle },
    { header: 'Vales Retirados', key: 'advances', width: 16, style: moneyStyle },
    { header: 'Liquidaciones Pagadas', key: 'paid', width: 16, style: moneyStyle },
    { header: 'Saldo Pendiente', key: 'balance', width: 18, style: moneyStyle }
  ], (data.sellers || []).map((s) => ({
    name: s.name,
    salesCount: s.salesCount,
    total: Number(s.total || 0),
    avgTicket: s.salesCount > 0 ? Math.round(s.total / s.salesCount) : 0,
    cash: Number(s.cash || 0),
    transfer: Number(s.transfer || 0),
    pct: `${s.pct}%`,
    commission: Number(s.commission || 0),
    advances: Number(s.advances || 0),
    paid: Number(s.paid || 0),
    balance: Number(s.balance || 0)
  })));

  // --- Solapa 4: Historial de Ventas (si hay datos)
  if (supervisorData?.sales?.length > 0) {
    addTableSheet(wb, 'Historial Ventas', [
      { header: 'Fecha', key: 'fecha', width: 12, style: dateStyle },
      { header: 'Hora', key: 'hora', width: 10 },
      { header: 'Vendedora', key: 'vendedora', width: 22 },
      { header: 'Monto', key: 'monto', width: 16, style: moneyStyle },
      { header: 'Medio', key: 'medio', width: 14 },
      { header: 'Nota', key: 'nota', width: 26 },
      { header: 'Estado', key: 'estado', width: 18 }
    ], supervisorData.sales.map((x) => ({
      fecha: asDate(x.date),
      hora: hour(x.created_at),
      vendedora: x.seller_name || '',
      monto: Number(x.amount || 0),
      medio: METHOD[x.payment_method] || x.payment_method,
      nota: x.note || '',
      estado: x.voided_at ? `Anulado: ${x.void_reason || ''}` : 'Válido'
    })));
  }

  // --- Solapa 5: Vales y Liquidaciones (si hay datos)
  const allStaffMoves = [
    ...(supervisorData?.advances || []).map((a) => ({ ...a, tipo: 'Vale / Adelanto' })),
    ...(supervisorData?.payouts || []).map((p) => ({ ...p, tipo: 'Liquidación' }))
  ].sort((a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : (a.date < b.date ? 1 : -1)));

  if (allStaffMoves.length > 0) {
    addTableSheet(wb, 'Vales y Liquidaciones', [
      { header: 'Fecha', key: 'fecha', width: 12, style: dateStyle },
      { header: 'Hora', key: 'hora', width: 10 },
      { header: 'Tipo', key: 'tipo', width: 18 },
      { header: 'Vendedora', key: 'vendedora', width: 22 },
      { header: 'Monto', key: 'monto', width: 16, style: moneyStyle },
      { header: 'Medio', key: 'medio', width: 14 },
      { header: 'Nota', key: 'nota', width: 26 },
      { header: 'Estado', key: 'estado', width: 18 }
    ], allStaffMoves.map((x) => ({
      fecha: asDate(x.date),
      hora: hour(x.created_at),
      tipo: x.tipo,
      vendedora: x.seller_name || '',
      monto: Number(x.amount || 0),
      medio: METHOD[x.payment_method] || x.payment_method,
      nota: x.note || '',
      estado: x.voided_at ? `Anulado: ${x.void_reason || ''}` : 'Válido'
    })));
  }

  // --- Solapa 6: Control de Caja
  if (supervisorData?.cashCounts?.length > 0) {
    addTableSheet(wb, 'Control de Caja', [
      { header: 'Fecha', key: 'fecha', width: 12, style: dateStyle },
      { header: 'Hora', key: 'hora', width: 10 },
      { header: 'Fondo Inicial', key: 'fondo', width: 15, style: moneyStyle },
      { header: 'Efectivo Esperado', key: 'esperado', width: 16, style: moneyStyle },
      { header: 'Efectivo Contado', key: 'contado', width: 16, style: moneyStyle },
      { header: 'Diferencia', key: 'diferencia', width: 15, style: moneyStyle },
      { header: 'Nota', key: 'nota', width: 26 }
    ], supervisorData.cashCounts.map((x) => ({
      fecha: asDate(x.count_date),
      hora: hour(x.created_at),
      fondo: Number(x.opening_float || 0),
      esperado: Number(x.expected || 0),
      contado: Number(x.counted || 0),
      diferencia: Number(x.difference || 0),
      nota: x.note || ''
    })));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `informe_supervisora_micaela_${data.from}${data.to !== data.from ? `_a_${data.to}` : ''}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------------------------------------------------------------- Mensaje WhatsApp Ejecutivo para Micaela
export function supervisorWhatsAppText({ data, period, date }) {
  const periodLabel = data.from === data.to ? fmtDate(data.from) : `${fmtDate(data.from)} al ${fmtDate(data.to)}`;
  const totals = (data?.sellers || []).reduce((t, s) => ({
    total: t.total + s.total,
    cash: t.cash + s.cash,
    transfer: t.transfer + s.transfer,
    commission: t.commission + s.commission,
    advances: t.advances + s.advances,
    paid: t.paid + s.paid,
    balance: t.balance + s.balance,
    salesCount: t.salesCount + s.salesCount
  }), { total: 0, cash: 0, transfer: 0, commission: 0, advances: 0, paid: 0, balance: 0, salesCount: 0 });

  const netMargin = totals.total - totals.commission;
  const marginPct = totals.total > 0 ? Math.round((netMargin / totals.total) * 100) : 100;
  const avgTicket = totals.salesCount > 0 ? money(Math.round(totals.total / totals.salesCount)) : '−';

  const transfers = data.periodTransfers || data.dayTransfers || [];
  const totalTransfers = transfers.reduce((acc, t) => acc + (t.amount || 0), 0);

  const lines = [
    `👑 *INFORME GERENCIAL — Dulce Valentín*`,
    `📅 *Período:* ${periodLabel}`,
    `👤 *Supervisora:* Micaela Barbieri`,
    '',
    `💰 *FACTURACIÓN BRUTA: ${money(totals.total)}*`,
    `   • Operaciones: *${totals.salesCount}* · Ticket prom: *${avgTicket}*`,
    `   • 💵 Efectivo: *${money(totals.cash)}*`,
    `   • 💳 Transferencias: *${money(totals.transfer)}*`,
    '',
    `💎 *MARGEN NETO LOCAL: ${money(netMargin)}* (${marginPct}% de retención)`,
    `🧾 *Comisiones personal:* ${money(totals.commission)}`,
    `💸 *Vales entregados:* ${money(totals.advances)}`,
    `✅ *Liquidaciones pagadas:* ${money(totals.paid)}`,
    `⏳ *Saldo laboral pendiente:* ${money(totals.balance)}`,
    '',
    `🏦 *AUDITORÍA DE TRANSFERENCIAS:*`,
    `   • Total transferido: *${money(totalTransfers)}* (${transfers.length} transferencias)`,
    `   • Alias configurado: \`${data.dailyAlias?.alias || 'dulce.valentin.rioja'}\``,
    `   • Titular: ${data.dailyAlias?.holder || '-'}`
  ];

  const ranking = [...(data.sellers || [])]
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);

  if (ranking.length > 0) {
    lines.push('');
    lines.push(`🏆 *RANKING VENDEDORAS (${ranking.length}):*`);
    ranking.slice(0, 5).forEach((s, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      lines.push(`${medal} *${s.name}*: ${money(s.total)} (${s.salesCount} vtas · com: ${money(s.commission)})`);
    });
  }

  lines.push('');
  lines.push(`🌐 _Generado desde www.dulcevalentin.com.ar/supervisor_`);

  return lines.join('\n');
}


