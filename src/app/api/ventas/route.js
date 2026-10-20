import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';

// /ventas (2026-10): ventas, comisiones, vales, liquidaciones y arqueo de
// caja de las vendedoras. Solo admin. Los totales y saldos se calculan aca,
// siempre desde los registros (nunca se guardan totales que se puedan
// desfasar). Nada se edita ni se borra: se anula con motivo (lo garantiza
// un trigger en la base).
//
//   Comision de un dia = ventas del dia x % vigente ese dia
//   Saldo de una vendedora = comisiones - vales - pagos (todo, hasta la fecha)
//   Efectivo esperado del dia = ventas en efectivo - vales en efectivo - pagos en efectivo

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const fail = (status, error) => NextResponse.json({ error }, { status });
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const todayAR = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10);
const dateInAR = (iso) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10) : null);
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const round2 = (n) => Math.round(n * 100) / 100;
const METHODS = ['efectivo', 'transferencia'];

// Fechas como 'YYYY-MM-DD' operadas en UTC (son dias calendario, sin hora).
const addDays = (d, n) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

// Rango del periodo que contiene la fecha: dia, semana (lunes a domingo) o mes.
function periodRange(period, date) {
  if (period === 'week') {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = domingo
    const from = addDays(date, -((dow + 6) % 7));
    return { from, to: addDays(from, 6) };
  }
  if (period === 'month') {
    const from = `${date.slice(0, 7)}-01`;
    const next = new Date(`${from}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
  }
  return { from: date, to: date };
}

// El periodo anterior equivalente (para comparar).
function previousRange(period, from) {
  if (period === 'month') {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return periodRange('month', d.toISOString().slice(0, 10));
  }
  return periodRange(period, addDays(from, period === 'week' ? -7 : -1));
}

// % vigente de un dia: el ultimo cargado con fecha <= ese dia (rates viene
// ordenado por fecha ascendente).
function pctForDay(rates, sellerId, day) {
  let pct = 0;
  for (const r of rates) {
    if (r.seller_id === sellerId && r.effective_date <= day) pct = Number(r.pct);
  }
  return pct;
}

const sum = (rows) => rows.reduce((t, x) => t + Number(x.amount), 0);
const inRange = (d, from, to) => d >= from && d <= to;

function commissionOf(sales, rates, sellerId) {
  const byDay = {};
  for (const x of sales) byDay[x.sale_date] = (byDay[x.sale_date] || 0) + Number(x.amount);
  let total = 0;
  for (const [day, amount] of Object.entries(byDay)) total += amount * pctForDay(rates, sellerId, day) / 100;
  return total;
}

// Trae todo lo necesario hasta la fecha "to" (los volumenes son chicos).
// Alias de cobro (tabla payment_aliases). Montos numericos o null.
const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
async function loadAliases(date, sales) {
  const [aliasRes, noteRes] = await Promise.all([
    db
      .from('payment_aliases')
      .select('*')
      .order('sort', { ascending: true })
      .order('created_at', { ascending: true }),
    db
      .from('categories')
      .select('id, name')
      .like('id', `_config_alias_note_${date}_%`)
  ]);

  if (aliasRes.error) return [];
  const notesByAliasId = {};
  (noteRes.data || []).forEach((r) => {
    const aId = r.id.replace(`_config_alias_note_${date}_`, '');
    notesByAliasId[aId] = r.name || '';
  });

  const received = {};
  const counts = {};
  sales
    .filter((x) => !x.voided_at && x.sale_date === date && x.payment_method === 'transferencia' && x.alias_id)
    .forEach((x) => {
      received[x.alias_id] = (received[x.alias_id] || 0) + Number(x.amount);
      counts[x.alias_id] = (counts[x.alias_id] || 0) + 1;
    });

  return (aliasRes.data || []).map((a) => ({
    id: a.id,
    alias: a.alias,
    holder: a.holder || '',
    bank: a.bank || '',
    description: a.description || '',
    minAmount: numOrNull(a.min_amount),
    maxAmount: numOrNull(a.max_amount),
    dailyLimit: numOrNull(a.daily_limit),
    sort: a.sort,
    active: a.active,
    receivedToday: round2(received[a.id] || 0),
    countToday: counts[a.id] || 0,
    archived: Boolean(a.archived),
    note: notesByAliasId[a.id] || '',
    createdAt: a.created_at,
    createdDate: dateInAR(a.created_at)
  }));
}

async function loadLedger(to) {
  const [sales, advances, payouts, rates] = await Promise.all([
    db.from('seller_sales').select('*').lte('sale_date', to).order('created_at', { ascending: true }),
    db.from('seller_advances').select('*').lte('advance_date', to).order('created_at', { ascending: true }),
    db.from('seller_payouts').select('*').lte('paid_date', to).order('created_at', { ascending: true }),
    db.from('seller_commission_rates').select('seller_id, effective_date, pct').lte('effective_date', to).order('effective_date', { ascending: true })
  ]);
  if (sales.error || advances.error || payouts.error || rates.error) throw new Error('ledger');
  return { sales: sales.data || [], advances: advances.data || [], payouts: payouts.data || [], rates: rates.data || [] };
}

// Numeros de una vendedora en un rango + su saldo acumulado hasta "to".
function sellerNumbers(ledger, sellerId, from, to) {
  const live = (rows) => rows.filter((x) => x.seller_id === sellerId && !x.voided_at);
  const sales = live(ledger.sales);
  const advances = live(ledger.advances);
  const payouts = live(ledger.payouts);
  const pSales = sales.filter((x) => inRange(x.sale_date, from, to));
  const pAdv = advances.filter((x) => inRange(x.advance_date, from, to));
  const pPay = payouts.filter((x) => inRange(x.paid_date, from, to));
  const total = sum(pSales);
  const cash = sum(pSales.filter((x) => x.payment_method === 'efectivo'));
  const commission = commissionOf(pSales, ledger.rates, sellerId);
  const balance = commissionOf(sales, ledger.rates, sellerId) - sum(advances) - sum(payouts);
  return {
    salesCount: pSales.length,
    total: round2(total),
    cash: round2(cash),
    transfer: round2(total - cash),
    commission: round2(commission),
    advances: round2(sum(pAdv)),
    paid: round2(sum(pPay)),
    balance: round2(balance) // > 0: se le debe; < 0: debe ella (vales de mas)
  };
}

async function getUserId(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const { data } = await db.auth.getUser(token);
  return data?.user?.id || null;
}

// GET
//   ?list=sellers                         -> todas las vendedoras (panel)
//   ?payoutId=N                           -> datos para el recibo de un pago
//   ?history=1&sellerId=uuid[&from&to]    -> historial de una vendedora
//   ?period=day|week|month&date=YYYY-MM-DD[&sellerId=uuid]
export async function GET(req) {
  if (!db) return fail(503, 'Servicio no disponible.');
  const denied = await requireAdmin(req, db);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);

  if (searchParams.get('list') === 'sellers') {
    const { data, error } = await db
      .from('staff')
      .select('id, name, active, created_at')
      .eq('role', 'vendedora')
      .order('active', { ascending: false })
      .order('name');
    if (error) return fail(500, 'No se pudieron cargar las vendedoras.');
    return NextResponse.json({ sellers: data || [] });
  }

  if (searchParams.get('payoutId')) {
    const { data: payout } = await db.from('seller_payouts').select('*').eq('id', searchParams.get('payoutId')).maybeSingle();
    if (!payout) return fail(404, 'No se encontró el pago.');
    const { data: seller } = await db.from('staff').select('id, name').eq('id', payout.seller_id).maybeSingle();
    try {
      const ledger = await loadLedger(payout.paid_date > (payout.period_to || '') ? payout.paid_date : payout.period_to);
      const from = payout.period_from || payout.paid_date;
      const to = payout.period_to || payout.paid_date;
      const numbers = sellerNumbers(ledger, payout.seller_id, from, to);
      // Saldo justo despues de este pago (pagos/vales hasta ese momento).
      const upTo = (rows, dateKey) => rows.filter((x) => x.seller_id === payout.seller_id && !x.voided_at && (x[dateKey] < payout.paid_date || (x[dateKey] === payout.paid_date && x.created_at <= payout.created_at)));
      const salesUpTo = ledger.sales.filter((x) => x.seller_id === payout.seller_id && !x.voided_at && x.sale_date <= payout.paid_date);
      const balanceAfter = commissionOf(salesUpTo, ledger.rates, payout.seller_id) - sum(upTo(ledger.advances, 'advance_date')) - sum(upTo(ledger.payouts, 'paid_date'));
      const advancesList = ledger.advances.filter((x) => x.seller_id === payout.seller_id && !x.voided_at && inRange(x.advance_date, from, to));
      return NextResponse.json({ payout, seller, from, to, numbers, advances: advancesList, balanceAfter: round2(balanceAfter) });
    } catch {
      return fail(500, 'No se pudo armar el recibo.');
    }
  }

  // Historial de una vendedora en un rango libre (from/to; sin from = desde
  // el principio): ventas, vales (con resumen por dia) y pagos.
  if (searchParams.get('history') === '1') {
    const sid = searchParams.get('sellerId');
    if (!uuidRe.test(String(sid || ''))) return fail(400, 'Falta la vendedora.');
    const hTo = isDate(searchParams.get('to')) ? searchParams.get('to') : todayAR();
    const hFrom = isDate(searchParams.get('from')) ? searchParams.get('from') : '2000-01-01';
    let ledger;
    try {
      ledger = await loadLedger(hTo);
    } catch {
      return fail(500, 'No se pudo cargar el historial.');
    }
    // Mas nuevo primero: por el dia del registro y, dentro del dia, por hora
    // de carga (un vale de un dia anterior cargado hoy va en su dia).
    const mine = (rows, key) => rows
      .filter((x) => x.seller_id === sid && inRange(x[key], hFrom, hTo))
      .sort((a, b) => (a[key] === b[key] ? (a.created_at < b.created_at ? 1 : -1) : (a[key] < b[key] ? 1 : -1)));
    const advances = mine(ledger.advances, 'advance_date');
    const byDay = {};
    for (const a of advances) {
      if (a.voided_at) continue;
      const d = (byDay[a.advance_date] ||= { date: a.advance_date, count: 0, total: 0 });
      d.count += 1;
      d.total = round2(d.total + Number(a.amount));
    }
    return NextResponse.json({
      from: hFrom,
      to: hTo,
      numbers: sellerNumbers(ledger, sid, hFrom, hTo),
      advancesByDay: Object.values(byDay).sort((a, b) => (a.date < b.date ? 1 : -1)),
      detail: {
        sales: mine(ledger.sales, 'sale_date'),
        advances,
        payouts: mine(ledger.payouts, 'paid_date')
      }
    });
  }

  const period = ['day', 'week', 'month'].includes(searchParams.get('period')) ? searchParams.get('period') : 'day';
  const date = isDate(searchParams.get('date')) ? searchParams.get('date') : todayAR();
  const sellerId = searchParams.get('sellerId');
  const { from, to } = periodRange(period, date);
  const prev = previousRange(period, from);

  const { data: sellers, error: sellersErr } = await db
    .from('staff')
    .select('id, name, active, created_at')
    .eq('role', 'vendedora')
    .order('name');
  if (sellersErr) return fail(500, 'No se pudieron cargar las vendedoras.');

  let ledger;
  try {
    ledger = await loadLedger(to);
  } catch {
    return fail(500, 'No se pudieron cargar las ventas.');
  }

  const touched = (id) => [ledger.sales, ledger.advances, ledger.payouts].some((rows) => rows.some((x) => x.seller_id === id && !x.voided_at));
  const summary = (sellers || [])
    .filter((s) => s.active || touched(s.id))
    .map((s) => {
      const n = sellerNumbers(ledger, s.id, from, to);
      const prevSales = ledger.sales.filter((x) => x.seller_id === s.id && !x.voided_at && inRange(x.sale_date, prev.from, prev.to));
      return {
        id: s.id,
        name: s.name,
        active: s.active,
        pct: pctForDay(ledger.rates, s.id, to), // % vigente al ultimo dia del periodo
        pctSetToday: ledger.rates.some((r) => r.seller_id === s.id && r.effective_date === to),
        prevTotal: round2(sum(prevSales)),
        ...n
      };
    });

  // Caja del dia (solo en la vista Dia): efectivo esperado y ultimo arqueo.
  let cash = null;
  if (period === 'day') {
    const live = (rows, key) => rows.filter((x) => !x.voided_at && x[key] === date && x.payment_method === 'efectivo');
    const salesCash = sum(live(ledger.sales, 'sale_date'));
    const advCash = sum(live(ledger.advances, 'advance_date'));
    const payCash = sum(live(ledger.payouts, 'paid_date'));
    const { data: counts } = await db.from('cash_counts').select('*').eq('count_date', date).is('voided_at', null).order('created_at', { ascending: false }).limit(1);
    cash = {
      salesCash: round2(salesCash),
      advancesCash: round2(advCash),
      payoutsCash: round2(payCash),
      expected: round2(salesCash - advCash - payCash),
      lastCount: counts?.[0] || null
    };
  }

  // Alias del día y registro de transferencias
  const nameById = Object.fromEntries((sellers || []).map((s) => [s.id, s.name]));
  const periodTransfers = ledger.sales
    .filter((x) => !x.voided_at && inRange(x.sale_date, from, to) && x.payment_method === 'transferencia')
    .map((x) => ({
      id: x.id,
      clientRef: x.client_ref,
      amount: Number(x.amount),
      sellerId: x.seller_id,
      sellerName: nameById[x.seller_id] || 'Vendedora',
      date: x.sale_date,
      createdAt: x.created_at,
      note: x.note || '',
      aliasId: x.alias_id || null
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const [allAliases, attRes, gdriveRes] = await Promise.all([
    loadAliases(date, ledger.sales),
    db.from('categories').select('id, name, subcategories').like('id', '_config_transfer_att_%'),
    db.from('categories').select('name').eq('id', '_config_transfers_gdrive_url').maybeSingle()
  ]);

  // Resumen de transferencias por alias en el período
  const periodByAlias = {};
  periodTransfers.forEach((t) => {
    if (!t.aliasId) return;
    const cur = periodByAlias[t.aliasId] || { received: 0, count: 0 };
    cur.received += t.amount;
    cur.count += 1;
    periodByAlias[t.aliasId] = cur;
  });

  // Solo se ofrecen y muestran en el mostrador los alias que pertenecen al día/período:
  // 1) Tuvieron transferencias en este período (countPeriod > 0 o countToday > 0), O
  // 2) Fueron creados dentro de las fechas de este período (createdDate en el rango from..to).
  // Los alias de días anteriores (con 0 operaciones) NO se muestran en ventas ni se sugieren para cobrar.
  const isForPeriod = (a) => {
    const hasOps = (periodByAlias[a.id]?.count || 0) > 0 || (a.countToday || 0) > 0;
    if (hasOps) return true;
    if (!a.createdDate) return false;
    return inRange(a.createdDate, from, to);
  };

  // Los alias archivados ("sacados") no se ofrecen para cobrar, pero sus
  // transferencias siguen en el historial con su nombre: nunca se pierden.
  const aliases = allAliases.filter((a) => !a.archived && isForPeriod(a));
  const aliasNameById = Object.fromEntries(allAliases.map((a) => [a.id, a.alias]));
  const attMap = {};
  (attRes?.data || []).forEach((r) => {
    const key = r.id.replace('_config_transfer_att_', '');
    let sub = r.subcategories;
    if (typeof sub === 'string') {
      try { sub = JSON.parse(sub); } catch {}
    }
    attMap[key] = {
      url: r.name || '',
      fileName: Array.isArray(sub) ? sub[0] : (sub?.fileName || ''),
      fileType: Array.isArray(sub) ? sub[1] : (sub?.fileType || ''),
      driveUrl: Array.isArray(sub) ? sub[2] : (sub?.driveUrl || ''),
      uploadedAt: Array.isArray(sub) ? sub[3] : (sub?.uploadedAt || '')
    };
  });

  periodTransfers.forEach((t) => {
    t.aliasName = t.aliasId ? (aliasNameById[t.aliasId] || 'Alias desconocido') : '';
    t.aliasArchived = Boolean(t.aliasId && allAliases.find((a) => a.id === t.aliasId)?.archived);
    t.attachment = attMap[String(t.id)] || attMap[t.clientRef] || null;
  });

  const driveFolderUrl = gdriveRes?.data?.name || '';
  const dayTransfers = periodTransfers.filter((x) => x.date === date);

  let dailyAlias = null;
  try {
    const { data: aliasRow } = await db
      .from('categories')
      .select('*')
      .eq('id', `_config_alias_day_${date}`)
      .maybeSingle();

    if (aliasRow?.name) {
      let sub = aliasRow.subcategories;
      if (typeof sub === 'string') {
        try { sub = JSON.parse(sub); } catch {}
      }
      const limit = Array.isArray(sub) ? Number(sub[0]) : Number(sub?.limit);
      const holder = Array.isArray(sub) ? sub[1] : sub?.holder;
      const bank = Array.isArray(sub) ? sub[2] : sub?.bank;
      dailyAlias = {
        alias: aliasRow.name,
        limit: limit && !isNaN(limit) ? limit : 1000000,
        holder: holder || '',
        bank: bank || ''
      };
    } else {
      const { data: defaultRow } = await db
        .from('categories')
        .select('*')
        .eq('id', '_config_alias1')
        .maybeSingle();
      const { data: holderRow } = await db
        .from('categories')
        .select('*')
        .eq('id', '_config_holder')
        .maybeSingle();
      dailyAlias = {
        alias: defaultRow?.name || 'dulce.valentin.rioja',
        limit: 1000000,
        holder: holderRow?.name || '',
        bank: ''
      };
    }
  } catch {
    dailyAlias = {
      alias: 'dulce.valentin.rioja',
      limit: 1000000,
      holder: '',
      bank: ''
    };
  }

  const isSupervisor = searchParams.get('supervisor') === '1';
  let supervisorData = null;
  if (isSupervisor) {
    const rows = (list, key) => list
      .filter((x) => inRange(x[key], from, to))
      .map((x) => ({ ...x, date: x[key], seller_name: nameById[x.seller_id] || '' }))
      .sort((a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : (a.date < b.date ? 1 : -1)));

    const { data: counts } = await db.from('cash_counts').select('*').gte('count_date', from).lte('count_date', to).order('created_at', { ascending: false });
    
    // Traer todos los alias configurados
    const { data: allAliasRows } = await db
      .from('categories')
      .select('id, name, subcategories')
      .ilike('id', '_config_alias_day_%');

    const aliasByDate = {};
    (allAliasRows || []).forEach((row) => {
      const dayKey = row.id.replace('_config_alias_day_', '');
      let sub = row.subcategories;
      if (typeof sub === 'string') {
        try { sub = JSON.parse(sub); } catch {}
      }
      const limit = Array.isArray(sub) ? Number(sub[0]) : Number(sub?.limit);
      const holder = Array.isArray(sub) ? sub[1] : sub?.holder;
      const bank = Array.isArray(sub) ? sub[2] : sub?.bank;
      aliasByDate[dayKey] = {
        alias: row.name,
        limit: limit && !isNaN(limit) ? limit : 1000000,
        holder: holder || '',
        bank: bank || ''
      };
    });

    supervisorData = {
      sales: rows(ledger.sales, 'sale_date'),
      advances: rows(ledger.advances, 'advance_date'),
      payouts: rows(ledger.payouts, 'paid_date'),
      cashCounts: counts || [],
      aliasByDate
    };
  }

  const archivedAliases = allAliases
    .filter((a) => a.archived)
    .map((a) => ({ ...a, active: false, receivedPeriod: round2(periodByAlias[a.id]?.received || 0), countPeriod: periodByAlias[a.id]?.count || 0 }));

  const body = { period, date, from, to, prev, sellers: summary, cash, dailyAlias, aliases, archivedAliases, dayTransfers, periodTransfers, supervisorData, driveFolderUrl };
  if (sellerId) {
    const mine = (rows, key) => rows.filter((x) => x.seller_id === sellerId && inRange(x[key], from, to));
    body.detail = {
      sales: mine(ledger.sales, 'sale_date'),
      advances: mine(ledger.advances, 'advance_date'),
      payouts: mine(ledger.payouts, 'paid_date')
    };
  }

  // Exportacion a Excel: todos los movimientos del periodo (incluidos los
  // anulados, marcados) + arqueos de caja.
  if (searchParams.get('export') === '1') {
    const rows = (list, key) => list
      .filter((x) => inRange(x[key], from, to))
      .map((x) => ({ ...x, date: x[key], seller_name: nameById[x.seller_id] || '' }))
      .sort((a, b) => (a.date === b.date ? (a.created_at < b.created_at ? -1 : 1) : (a.date < b.date ? -1 : 1)));
    const { data: counts } = await db.from('cash_counts').select('*').gte('count_date', from).lte('count_date', to).order('created_at', { ascending: true });
    body.export = {
      sales: rows(ledger.sales, 'sale_date'),
      advances: rows(ledger.advances, 'advance_date'),
      payouts: rows(ledger.payouts, 'paid_date'),
      cashCounts: counts || []
    };
  }
  return NextResponse.json(body);
}

// Montos en pesos enteros (sin puntos ni comas: el "1.500" se confundia).
function parseAmount(v, { allowZero = false } = {}) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < (allowZero ? 0 : 1) || n > 1000000000) return null;
  return n;
}

// POST { action, ... }
//   addSeller    { name }
//   rename       { sellerId, name }
//   setActive    { sellerId, active }
//   addSale      { clientRef, sellerId, date, amount, method, note, aliasId? }
//   saveAlias    { id?, alias, holder, bank, description, minAmount, maxAmount, dailyLimit, active }
//   setAliasActive { id, active } · archiveAlias { id } · restoreAlias { id } · reorderAliases { ids }
//   addAdvance   { clientRef, sellerId, date, amount, method, note }
//   addPayout    { clientRef, sellerId, date, amount, method, periodFrom, periodTo, note }
//   addCashCount { clientRef, date, openingFloat, counted, note }
//   setPct       { sellerId, date, pct }
//   void         { kind: 'sale' | 'advance' | 'payout' | 'cashcount', id, reason }
export async function POST(req) {
  if (!db) return fail(503, 'Servicio no disponible.');
  const denied = await requireAdmin(req, db);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const userId = await getUserId(req);
  const note = String(body.note ?? '').trim().slice(0, 300) || null;
  const today = todayAR();
  const dateOk = (d) => (isDate(d) ? d : today);

  const assertSeller = async (id) => {
    if (!uuidRe.test(String(id || ''))) return null;
    const { data } = await db.from('staff').select('id, role').eq('id', id).maybeSingle();
    return data?.role === 'vendedora' ? data : null;
  };

  switch (body.action) {
    case 'addSeller': {
      const name = String(body.name || '').trim().slice(0, 80);
      if (!name) return fail(400, 'Poné el nombre de la vendedora.');
      const { data, error } = await db.from('staff').insert({ name, role: 'vendedora' }).select('id, name, active').single();
      if (error) return fail(500, 'No se pudo agregar.');
      return NextResponse.json({ seller: data });
    }

    case 'rename': {
      if (!(await assertSeller(body.sellerId))) return fail(404, 'Vendedora no encontrada.');
      const name = String(body.name || '').trim().slice(0, 80);
      if (!name) return fail(400, 'Poné el nombre.');
      const { error } = await db.from('staff').update({ name }).eq('id', body.sellerId);
      if (error) return fail(500, 'No se pudo guardar.');
      return NextResponse.json({ success: true });
    }

    case 'setActive': {
      if (!(await assertSeller(body.sellerId))) return fail(404, 'Vendedora no encontrada.');
      const { error } = await db.from('staff').update({ active: Boolean(body.active) }).eq('id', body.sellerId);
      if (error) return fail(500, 'No se pudo guardar.');
      return NextResponse.json({ success: true });
    }

    // Alias de cobro: alta / edición / pausa / archivo / orden
    case 'saveAlias': {
      const alias = String(body.alias || '').trim().toLowerCase().slice(0, 80);
      if (!alias) return fail(400, 'Escribí el alias o CVU.');
      const opt = (v) => {
        if (v === null || v === undefined || String(v).trim() === '') return { ok: true, value: null };
        const n = parseAmount(v, { allowZero: false });
        return n === null ? { ok: false } : { ok: true, value: n };
      };
      const min = opt(body.minAmount);
      const max = opt(body.maxAmount);
      const lim = opt(body.dailyLimit);
      if (!min.ok || !max.ok || !lim.ok) return fail(400, 'Los montos van en pesos enteros, sin puntos (ej: 100000).');
      if (min.value !== null && max.value !== null && min.value > max.value) return fail(400, 'El mínimo no puede ser mayor que el máximo.');
      const row = {
        alias,
        holder: String(body.holder || '').trim().slice(0, 80) || null,
        bank: String(body.bank || '').trim().slice(0, 60) || null,
        description: String(body.description || '').trim().slice(0, 200) || null,
        min_amount: min.value,
        max_amount: max.value,
        daily_limit: lim.value,
        active: body.active !== false,
        updated_at: new Date().toISOString()
      };
      if (body.id) {
        if (!uuidRe.test(String(body.id))) return fail(400, 'Alias inválido.');
        const { data, error } = await db.from('payment_aliases').update({ ...row, archived: false }).eq('id', body.id).select('id').maybeSingle();
        if (error || !data) return fail(500, 'No se pudo guardar el alias.');
        return NextResponse.json({ success: true, id: data.id });
      }
      // Si no se pasó id, verificar si ya existe un alias con este nombre en la base de datos (para no duplicarlo y mantener su historial)
      const { data: existing } = await db.from('payment_aliases').select('id').eq('alias', alias).limit(1).maybeSingle();
      if (existing?.id) {
        const { data, error } = await db.from('payment_aliases').update({ ...row, archived: false }).eq('id', existing.id).select('id').maybeSingle();
        if (error || !data) return fail(500, 'No se pudo reactivar el alias.');
        return NextResponse.json({ success: true, id: data.id, restored: true });
      }
      const { data: last } = await db.from('payment_aliases').select('sort').order('sort', { ascending: false }).limit(1).maybeSingle();
      row.sort = (last?.sort || 0) + 1;
      if (isDate(body.date) && body.date !== todayAR()) {
        row.created_at = new Date(`${body.date}T12:00:00-03:00`).toISOString();
      }
      const { data, error } = await db.from('payment_aliases').insert(row).select('id').single();
      if (error) return fail(500, 'No se pudo agregar el alias.');
      return NextResponse.json({ success: true, id: data.id });
    }

    case 'setAliasActive':
    case 'archiveAlias':
    case 'restoreAlias': {
      if (!uuidRe.test(String(body.id || ''))) return fail(400, 'Alias inválido.');
      const patch = body.action === 'archiveAlias'
        ? { archived: true, active: false }
        : body.action === 'restoreAlias'
          ? { archived: false, active: true, created_at: new Date().toISOString() }
          : { active: Boolean(body.active) };
      const { error } = await db.from('payment_aliases').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', body.id);
      if (error) return fail(500, 'No se pudo guardar.');
      return NextResponse.json({ success: true });
    }

    case 'reorderAliases': {
      const ids = Array.isArray(body.ids) ? body.ids.filter((id) => uuidRe.test(String(id))) : [];
      if (ids.length === 0) return fail(400, 'Orden inválido.');
      for (let i = 0; i < ids.length; i++) {
        const { error } = await db.from('payment_aliases').update({ sort: i + 1 }).eq('id', ids[i]);
        if (error) return fail(500, 'No se pudo guardar el orden.');
      }
      return NextResponse.json({ success: true });
    }

    case 'setDailyAlias': {
      const targetDate = dateOk(body.date);
      const alias = String(body.alias || '').trim().toLowerCase();
      if (!alias) return fail(400, 'Ingresá el alias.');
      const limit = parseAmount(body.limit, { allowZero: false });
      if (limit === null) return fail(400, 'Poné el monto tope en pesos sin puntos (ej: 800000).');
      const holder = String(body.holder || '').trim();
      const bank = String(body.bank || '').trim();

      const subcategories = [String(limit), holder, bank];
      const { error } = await db.from('categories').upsert({
        id: `_config_alias_day_${targetDate}`,
        name: alias,
        subcategories
      }, { onConflict: 'id' });

      if (error) return fail(500, 'No se pudo guardar la configuración del alias.');
      return NextResponse.json({
        success: true,
        dailyAlias: { alias, limit, holder, bank }
      });
    }

    case 'saveAliasNote': {
      const targetDate = dateOk(body.date);
      const aliasId = String(body.aliasId || '').trim();
      if (!uuidRe.test(aliasId)) return fail(400, 'Alias inválido.');
      const note = String(body.note || '').trim().slice(0, 500);
      const key = `_config_alias_note_${targetDate}_${aliasId}`;
      if (!note) {
        await db.from('categories').delete().eq('id', key);
      } else {
        const { error } = await db.from('categories').upsert({
          id: key,
          name: note,
          subcategories: [new Date().toISOString()]
        }, { onConflict: 'id' });
        if (error) return fail(500, 'No se pudo guardar la anotación.');
      }
      return NextResponse.json({ success: true, note });
    }

    case 'saveTransferAttachment': {
      const keyId = String(body.saleId || body.clientRef || '').trim();
      if (!keyId) return fail(400, 'Falta identificar la transferencia.');
      const fileUrl = String(body.fileUrl || '').trim();
      const fileName = String(body.fileName || '').trim().slice(0, 150);
      const fileType = String(body.fileType || '').trim().slice(0, 80);
      const driveUrl = String(body.driveUrl || '').trim();
      if (!fileUrl && !driveUrl) return fail(400, 'Se requiere un archivo o enlace.');
      const key = `_config_transfer_att_${keyId}`;
      const { error } = await db.from('categories').upsert({
        id: key,
        name: fileUrl || driveUrl,
        subcategories: [fileName, fileType, driveUrl, new Date().toISOString()]
      }, { onConflict: 'id' });
      if (error) return fail(500, 'No se pudo guardar el comprobante.');
      return NextResponse.json({ success: true });
    }

    case 'deleteTransferAttachment': {
      const keyId = String(body.saleId || body.clientRef || '').trim();
      if (!keyId) return fail(400, 'Falta identificar la transferencia.');
      const key = `_config_transfer_att_${keyId}`;
      const { error } = await db.from('categories').delete().eq('id', key);
      if (error) return fail(500, 'No se pudo eliminar el comprobante.');
      return NextResponse.json({ success: true });
    }

    case 'setDriveFolderUrl': {
      const url = String(body.url || '').trim();
      if (!url) {
        const { error } = await db.from('categories').delete().eq('id', '_config_transfers_gdrive_url');
        if (error) return fail(500, 'No se pudo desvincular la carpeta de Google Drive.');
        return NextResponse.json({ success: true, url: '' });
      }
      const { error } = await db.from('categories').upsert({
        id: '_config_transfers_gdrive_url',
        name: url,
        subcategories: [new Date().toISOString()]
      }, { onConflict: 'id' });
      if (error) return fail(500, 'No se pudo guardar el enlace de Google Drive.');
      return NextResponse.json({ success: true, url });
    }

    case 'addSale':
    case 'addAdvance':
    case 'addPayout': {
      if (!uuidRe.test(String(body.clientRef || ''))) return fail(400, 'Falta la referencia del registro.');
      if (!(await assertSeller(body.sellerId))) return fail(404, 'Vendedora no encontrada.');
      const amount = parseAmount(body.amount);
      if (amount === null) return fail(400, 'Poné el monto en pesos, sin puntos ni comas (ej: 15000).');
      if (!METHODS.includes(body.method)) return fail(400, 'Elegí efectivo o transferencia.');
      const date = dateOk(body.date);
      if (date > addDays(today, 1)) return fail(400, 'La fecha no puede ser futura.');

      let table;
      let row;
      if (body.action === 'addSale') {
        table = 'seller_sales';
        row = { sale_date: date, payment_method: body.method };
        if (body.method === 'transferencia' && body.aliasId) {
          if (!uuidRe.test(String(body.aliasId))) return fail(400, 'Alias inválido.');
          const { data: al } = await db.from('payment_aliases').select('id').eq('id', body.aliasId).maybeSingle();
          if (!al) return fail(404, 'Ese alias ya no existe. Elegí otro.');
          row.alias_id = body.aliasId;
        }
      } else if (body.action === 'addAdvance') {
        table = 'seller_advances';
        row = { advance_date: date, payment_method: body.method };
      } else {
        table = 'seller_payouts';
        row = {
          paid_date: date,
          payment_method: body.method,
          period_from: isDate(body.periodFrom) ? body.periodFrom : null,
          period_to: isDate(body.periodTo) ? body.periodTo : null
        };
      }
      Object.assign(row, { client_ref: body.clientRef, seller_id: body.sellerId, amount, note, created_by: userId });

      // Idempotente: si ese clientRef ya se guardo (reintento), no se duplica.
      const { error } = await db.from(table).upsert(row, { onConflict: 'client_ref', ignoreDuplicates: true });
      if (error) return fail(500, 'No se pudo guardar.');
      if (body.action === 'addPayout') {
        const { data: saved } = await db.from('seller_payouts').select('id').eq('client_ref', body.clientRef).maybeSingle();
        return NextResponse.json({ success: true, payoutId: saved?.id || null });
      }
      if (body.action === 'addSale') {
        const { data: saved } = await db.from('seller_sales').select('id').eq('client_ref', body.clientRef).maybeSingle();
        return NextResponse.json({ success: true, saleId: saved?.id || null });
      }
      return NextResponse.json({ success: true });
    }

    case 'addCashCount': {
      if (!uuidRe.test(String(body.clientRef || ''))) return fail(400, 'Falta la referencia del registro.');
      const counted = parseAmount(body.counted, { allowZero: true });
      const opening = parseAmount(body.openingFloat ?? 0, { allowZero: true });
      if (counted === null || opening === null) return fail(400, 'Poné los montos en pesos, sin puntos ni comas.');
      const date = dateOk(body.date);
      // El esperado lo calcula el servidor (no se confia en el navegador).
      const live = async (table, key) => {
        const { data } = await db.from(table).select('amount').eq(key, date).eq('payment_method', 'efectivo').is('voided_at', null);
        return sum(data || []);
      };
      const movement = (await live('seller_sales', 'sale_date')) - (await live('seller_advances', 'advance_date')) - (await live('seller_payouts', 'paid_date'));
      const expected = round2(opening + movement);
      const difference = round2(counted - expected);
      const { error } = await db.from('cash_counts').upsert({
        client_ref: body.clientRef, count_date: date, opening_float: opening, counted, expected, difference, note, created_by: userId
      }, { onConflict: 'client_ref', ignoreDuplicates: true });
      if (error) return fail(500, 'No se pudo guardar el arqueo.');
      return NextResponse.json({ success: true, expected, difference });
    }

    case 'setPct': {
      if (!(await assertSeller(body.sellerId))) return fail(404, 'Vendedora no encontrada.');
      const pct = Number(body.pct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return fail(400, 'El % tiene que estar entre 0 y 100.');
      const { error } = await db.from('seller_commission_rates').upsert(
        { seller_id: body.sellerId, effective_date: dateOk(body.date), pct: round2(pct), set_at: new Date().toISOString(), set_by: userId },
        { onConflict: 'seller_id,effective_date' }
      );
      if (error) return fail(500, 'No se pudo guardar el %.');
      return NextResponse.json({ success: true });
    }

    case 'void': {
      const table = { sale: 'seller_sales', advance: 'seller_advances', payout: 'seller_payouts', cashcount: 'cash_counts' }[body.kind];
      if (!table) return fail(400, 'Tipo inválido.');
      const reason = String(body.reason || '').trim().slice(0, 300);
      if (!reason) return fail(400, 'Indicá el motivo de la anulación.');
      const { data, error } = await db
        .from(table)
        .update({ voided_at: new Date().toISOString(), voided_by: userId, void_reason: reason })
        .eq('id', body.id)
        .is('voided_at', null)
        .select('id')
        .maybeSingle();
      if (error) return fail(500, 'No se pudo anular.');
      if (!data) return fail(409, 'Ya estaba anulado.');
      return NextResponse.json({ success: true });
    }

    default:
      return fail(400, 'Acción inválida.');
  }
}
