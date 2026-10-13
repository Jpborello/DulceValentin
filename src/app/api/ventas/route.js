import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';

// /ventas (2026-10): ventas, comisiones y vales de las vendedoras. Solo
// admin. Los totales se calculan aca, siempre desde los registros (nunca se
// guardan totales que se puedan desfasar). Ventas y vales no se editan ni se
// borran: se anulan con motivo (lo garantiza un trigger en la base).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const fail = (status, error) => NextResponse.json({ error }, { status });
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const todayAR = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10);
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const round2 = (n) => Math.round(n * 100) / 100;

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

async function getUserId(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const { data } = await db.auth.getUser(token);
  return data?.user?.id || null;
}

// % vigente de cada dia del rango para cada vendedora (el ultimo cargado con
// fecha <= ese dia).
function pctForDay(rates, sellerId, day) {
  let pct = 0;
  for (const r of rates) {
    if (r.seller_id === sellerId && r.effective_date <= day) pct = Number(r.pct);
  }
  return pct; // rates viene ordenado por fecha ascendente
}

// GET ?period=day|week|month&date=YYYY-MM-DD[&sellerId=uuid]
//   Sin sellerId: resumen de todas las vendedoras activas.
//   Con sellerId: ademas, el detalle de ventas y vales del periodo.
export async function GET(req) {
  if (!db) return fail(503, 'Servicio no disponible.');
  const denied = await requireAdmin(req, db);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);

  // Lista completa de vendedoras (activas y dadas de baja) para el panel.
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

  const period = ['day', 'week', 'month'].includes(searchParams.get('period')) ? searchParams.get('period') : 'day';
  const date = isDate(searchParams.get('date')) ? searchParams.get('date') : todayAR();
  const sellerId = searchParams.get('sellerId');
  const { from, to } = periodRange(period, date);

  const { data: sellers, error: sellersErr } = await db
    .from('staff')
    .select('id, name, active, created_at')
    .eq('role', 'vendedora')
    .order('name');
  if (sellersErr) return fail(500, 'No se pudieron cargar las vendedoras.');

  const [salesRes, advRes, ratesRes] = await Promise.all([
    db.from('seller_sales').select('*').gte('sale_date', from).lte('sale_date', to).order('created_at', { ascending: true }),
    db.from('seller_advances').select('*').gte('advance_date', from).lte('advance_date', to).order('created_at', { ascending: true }),
    db.from('seller_commission_rates').select('seller_id, effective_date, pct').lte('effective_date', to).order('effective_date', { ascending: true })
  ]);
  if (salesRes.error || advRes.error || ratesRes.error) return fail(500, 'No se pudieron cargar las ventas.');

  const sales = salesRes.data || [];
  const advances = advRes.data || [];
  const rates = ratesRes.data || [];

  const summary = (sellers || [])
    .filter((s) => s.active || sales.some((x) => x.seller_id === s.id) || advances.some((x) => x.seller_id === s.id))
    .map((s) => {
      const mySales = sales.filter((x) => x.seller_id === s.id && !x.voided_at);
      const myAdv = advances.filter((x) => x.seller_id === s.id && !x.voided_at);
      // Comision dia por dia, con el % vigente de cada dia.
      const byDay = {};
      for (const x of mySales) byDay[x.sale_date] = (byDay[x.sale_date] || 0) + Number(x.amount);
      let commission = 0;
      for (const [day, amount] of Object.entries(byDay)) commission += amount * pctForDay(rates, s.id, day) / 100;
      const total = mySales.reduce((t, x) => t + Number(x.amount), 0);
      const cash = mySales.filter((x) => x.payment_method === 'efectivo').reduce((t, x) => t + Number(x.amount), 0);
      const advTotal = myAdv.reduce((t, x) => t + Number(x.amount), 0);
      return {
        id: s.id,
        name: s.name,
        active: s.active,
        pct: pctForDay(rates, s.id, to),          // % vigente al ultimo dia del periodo
        pctSetToday: rates.some((r) => r.seller_id === s.id && r.effective_date === to),
        salesCount: mySales.length,
        total: round2(total),
        cash: round2(cash),
        transfer: round2(total - cash),
        commission: round2(commission),
        advances: round2(advTotal),
        toPay: round2(commission - advTotal)
      };
    });

  const body = { period, date, from, to, sellers: summary };
  if (sellerId) {
    body.detail = {
      sales: sales.filter((x) => x.seller_id === sellerId),
      advances: advances.filter((x) => x.seller_id === sellerId)
    };
  }
  return NextResponse.json(body);
}

// POST { action, ... }
//   addSeller   { name }
//   rename      { sellerId, name }
//   setActive   { sellerId, active }
//   addSale     { clientRef, sellerId, date, amount, method, note }
//   addAdvance  { clientRef, sellerId, date, amount, note }
//   setPct      { sellerId, date, pct }
//   void        { kind: 'sale' | 'advance', id, reason }
export async function POST(req) {
  if (!db) return fail(503, 'Servicio no disponible.');
  const denied = await requireAdmin(req, db);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const userId = await getUserId(req);
  const note = String(body.note ?? '').trim().slice(0, 300) || null;

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
    case 'addAdvance': {
      if (!uuidRe.test(String(body.clientRef || ''))) return fail(400, 'Falta la referencia del registro.');
      if (!(await assertSeller(body.sellerId))) return fail(404, 'Vendedora no encontrada.');
      const amount = round2(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return fail(400, 'Poné un monto válido.');
      const date = isDate(body.date) ? body.date : todayAR();
      if (date > addDays(todayAR(), 1)) return fail(400, 'La fecha no puede ser futura.');

      const isSale = body.action === 'addSale';
      if (isSale && !['efectivo', 'transferencia'].includes(body.method)) return fail(400, 'Elegí efectivo o transferencia.');
      const table = isSale ? 'seller_sales' : 'seller_advances';
      const row = isSale
        ? { client_ref: body.clientRef, seller_id: body.sellerId, sale_date: date, amount, payment_method: body.method, note, created_by: userId }
        : { client_ref: body.clientRef, seller_id: body.sellerId, advance_date: date, amount, note, created_by: userId };

      // Idempotente: si ese clientRef ya se guardo (reintento), no se duplica.
      const { error } = await db.from(table).upsert(row, { onConflict: 'client_ref', ignoreDuplicates: true });
      if (error) return fail(500, 'No se pudo guardar.');
      return NextResponse.json({ success: true });
    }

    case 'setPct': {
      if (!(await assertSeller(body.sellerId))) return fail(404, 'Vendedora no encontrada.');
      const pct = Number(body.pct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return fail(400, 'El % tiene que estar entre 0 y 100.');
      const date = isDate(body.date) ? body.date : todayAR();
      const { error } = await db.from('seller_commission_rates').upsert(
        { seller_id: body.sellerId, effective_date: date, pct: round2(pct), set_at: new Date().toISOString(), set_by: userId },
        { onConflict: 'seller_id,effective_date' }
      );
      if (error) return fail(500, 'No se pudo guardar el %.');
      return NextResponse.json({ success: true });
    }

    case 'void': {
      const table = body.kind === 'advance' ? 'seller_advances' : 'seller_sales';
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
