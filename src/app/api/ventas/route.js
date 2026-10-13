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

  const body = { period, date, from, to, prev, sellers: summary, cash };
  if (sellerId) {
    const mine = (rows, key) => rows.filter((x) => x.seller_id === sellerId && inRange(x[key], from, to));
    body.detail = {
      sales: mine(ledger.sales, 'sale_date'),
      advances: mine(ledger.advances, 'advance_date'),
      payouts: mine(ledger.payouts, 'paid_date')
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
//   addSale      { clientRef, sellerId, date, amount, method, note }
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
