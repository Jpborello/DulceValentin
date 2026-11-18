import { NextResponse } from 'next/server';
import { getStaff, supabaseAdmin, deny, argentinaDayRange, parseOfflineDate } from '@/lib/staffAuth';
import { buildLocalSaleLines, randomLocalId } from '@/lib/localSale';

// Ventas del local (2026-10). Circuito: la vendedora arma la venta y queda
// "pendiente_cobro" a su nombre; la cajera la cobra (ver ./charge). Cada
// renglon va por mayor (sin minimo: en persona no aplica la regla x3) o por
// menor (precio minorista), segun eligio la vendedora. El stock se
// descuenta al crear la venta (la prenda ya esta separada) y vuelve si se
// cancela (ver ./cancel). Se guardan en la misma tabla orders, con
// channel = 'local'.

const SALE_COLUMNS = 'id, created_at, status, total_amount, items, client_name, client_phone, customer_notes, seller_id, cashier_id, payment_method, cash_received, paid_at, commission_pct, commission_amount';

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

const randomSaleId = () => randomLocalId('LOC');

// GET ?scope=pending|today|mine&date=YYYY-MM-DD
//   pending: por cobrar (cajera/admin ven todas, vendedora las suyas)
//   today:   ventas del dia (idem)
export async function GET(req) {
  const { staff, response } = await getStaff(req);
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope') || 'pending';

  let query = supabaseAdmin.from('orders').select(SALE_COLUMNS).eq('channel', 'local');
  if (scope === 'pending') {
    query = query.eq('status', 'pendiente_cobro').order('created_at', { ascending: true });
  } else {
    const { start, end } = argentinaDayRange(searchParams.get('date'));
    query = query.gte('created_at', start).lt('created_at', end).order('created_at', { ascending: false });
  }
  if (staff.role === 'vendedora') query = query.eq('seller_id', staff.id);

  const { data, error } = await query.limit(300);
  if (error) return deny(500, 'No se pudieron cargar las ventas.');

  const { data: people } = await supabaseAdmin.from('staff').select('id, name');
  const nameById = Object.fromEntries((people || []).map((p) => [p.id, p.name]));
  return NextResponse.json({
    sales: (data || []).map((s) => ({ ...s, seller_name: nameById[s.seller_id] || null, cashier_name: nameById[s.cashier_id] || null }))
  });
}

// Ventas hechas sin internet (ver src/lib/posOffline.js): llegan con su
// propio numero OFF-XXXXXXXX, que se usa como id. Si el mismo envio llega dos
// veces (se corto la conexion justo despues de guardarla), la segunda vez se
// devuelve la venta ya guardada sin descontar stock de nuevo.
const OFFLINE_ID_RE = /^OFF-[A-Z0-9]{8}$/;

// POST { items: [{ id, quantity, size, color }], sellerId?, clientName?, clientPhone?, notes?, offlineId?, offlineCreatedAt? }
export async function POST(req) {
  const { staff, response } = await getStaff(req);
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch {
    return deny(400, 'Venta inválida.');
  }

  const offlineId = body.offlineId ? String(body.offlineId).trim().toUpperCase() : null;
  if (offlineId && !OFFLINE_ID_RE.test(offlineId)) return deny(400, 'Número de venta sin conexión inválido.');
  const offlineCreatedAt = offlineId ? parseOfflineDate(body.offlineCreatedAt) : null;
  if (offlineId && !offlineCreatedAt) return deny(400, 'La fecha de la venta sin conexión no es válida (más de 14 días o en el futuro).');

  if (offlineId) {
    const { data: existing } = await supabaseAdmin.from('orders').select(SALE_COLUMNS).eq('id', offlineId).maybeSingle();
    if (existing) return NextResponse.json({ sale: existing, duplicate: true });
  }

  // La vendedora siempre vende a su nombre; caja/admin eligen a quien se le
  // asigna (o a si mismas).
  let seller = staff;
  if (staff.role !== 'vendedora' && body.sellerId && body.sellerId !== staff.id) {
    const { data: chosen } = await supabaseAdmin
      .from('staff')
      .select('id, name, role, commission_pct, active')
      .eq('id', body.sellerId)
      .maybeSingle();
    if (!chosen || !chosen.active) return deny(400, 'La vendedora elegida no está habilitada.');
    seller = chosen;
  }

  // Precio calculado por el servidor (por mayor o por menor) y stock
  // descontado: ver src/lib/localSale.js.
  const built = await buildLocalSaleLines(supabaseAdmin, body.items);
  if (built.error) return deny(built.status, built.error);
  const { lines, total } = built;
  const deducted = lines;
  const offlineNote = offlineId
    ? `[Venta sin conexión, cargada el ${new Date(offlineCreatedAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false })}, subida por ${staff.name}]`
    : '';
  const sale = {
    id: offlineId || randomSaleId(),
    channel: 'local',
    status: 'pendiente_cobro',
    created_at: offlineCreatedAt || new Date().toISOString(),
    client_name: clean(body.clientName, 120) || 'Venta en el local',
    client_phone: clean(body.clientPhone, 30).replace(/\D/g, '').slice(-10) || '',
    client_dni: '',
    client_locality: 'Rosario',
    delivery_method: 'Venta en el local',
    customer_notes: [clean(body.notes, 500), offlineNote].filter(Boolean).join(' ') || null,
    items: lines,
    total_amount: total,
    is_wholesale: lines.every((l) => l.price_type !== 'menor'),
    discount_applied: 0,
    stock_issue: false,
    seller_id: seller.id,
    commission_pct: Number(seller.commission_pct) || 0
  };

  let { error: insertErr } = await supabaseAdmin.from('orders').insert(sale);
  if (insertErr?.code === '23505' && offlineId) {
    // Dos envios simultaneos de la misma venta sin conexion: gano el otro.
    // Se devuelve el stock de este y la venta que ya quedo guardada.
    await Promise.all(deducted.map((l) => supabaseAdmin.rpc('restore_variant_stock', {
      p_product_id: l.product.id, p_size: l.product.selectedSize, p_color: l.product.selectedColor, p_qty: l.quantity
    })));
    const { data: existing } = await supabaseAdmin.from('orders').select(SALE_COLUMNS).eq('id', offlineId).maybeSingle();
    if (existing) return NextResponse.json({ sale: existing, duplicate: true });
    return deny(500, 'No se pudo guardar la venta. Probá de nuevo.');
  }
  if (insertErr?.code === '23505') {
    sale.id = randomSaleId();
    ({ error: insertErr } = await supabaseAdmin.from('orders').insert(sale));
  }
  if (insertErr) {
    console.error('POS: error guardando la venta', insertErr);
    await Promise.all(deducted.map((l) => supabaseAdmin.rpc('restore_variant_stock', {
      p_product_id: l.product.id, p_size: l.product.selectedSize, p_color: l.product.selectedColor, p_qty: l.quantity
    })));
    return deny(500, 'No se pudo guardar la venta. Probá de nuevo.');
  }

  return NextResponse.json({ sale: { ...sale, seller_name: seller.name } });
}
