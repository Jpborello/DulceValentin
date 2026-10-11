import { NextResponse } from 'next/server';
import { getStaff, supabaseAdmin, deny, argentinaDayRange } from '@/lib/staffAuth';
import { getProductPrice } from '@/lib/productPricing';
import { getProductStockForSizeColor } from '@/lib/catalogData';

// Ventas del local (2026-10). Circuito: la vendedora arma la venta y queda
// "pendiente_cobro" a su nombre; la cajera la cobra (ver ./charge). Precio
// mayorista sin minimo (en persona no aplica la regla x3). El stock se
// descuenta al crear la venta (la prenda ya esta separada) y vuelve si se
// cancela (ver ./cancel). Se guardan en la misma tabla orders, con
// channel = 'local'.

const PRODUCT_COLUMNS = 'id, name, code, category, subcategory, price, wholesale_price, price_per_size, stock, stock_per_size, color_stock, sizes, colors, image_url, thumb_url, is_active';
const SALE_COLUMNS = 'id, created_at, status, total_amount, items, client_name, client_phone, customer_notes, seller_id, cashier_id, payment_method, cash_received, paid_at, commission_pct, commission_amount';

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

function randomSaleId() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return 'LOC-' + (100000 + (n[0] % 900000));
}

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

// POST { items: [{ id, quantity, size, color }], sellerId?, clientName?, clientPhone?, notes? }
export async function POST(req) {
  const { staff, response } = await getStaff(req);
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch {
    return deny(400, 'Venta inválida.');
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

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) return deny(400, 'La venta no tiene productos.');
  if (rawItems.length > 200) return deny(400, 'Demasiados renglones.');

  const ids = [...new Set(rawItems.map((it) => String(it?.id || '')).filter(Boolean))];
  const { data: products, error: productsErr } = await supabaseAdmin.from('products').select(PRODUCT_COLUMNS).in('id', ids);
  if (productsErr) return deny(500, 'No se pudieron verificar los productos.');
  const productById = new Map((products || []).map((p) => [p.id, p]));

  // Agrupa renglones repetidos (mismo producto/talle/color).
  const byVariant = new Map();
  for (const raw of rawItems) {
    const product = productById.get(String(raw?.id || ''));
    if (!product) return deny(409, 'Uno de los productos ya no existe.');
    const quantity = Math.floor(Number(raw.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) return deny(400, `Revisá la cantidad de "${product.name}".`);
    const size = raw.size ? String(raw.size) : null;
    const color = raw.color ? String(raw.color) : null;
    const key = `${product.id}::${size || ''}::${color || ''}`;
    const prev = byVariant.get(key);
    byVariant.set(key, { product, size, color, quantity: (prev?.quantity || 0) + quantity, key });
  }

  const lines = [];
  for (const v of byVariant.values()) {
    const available = getProductStockForSizeColor({ ...v.product, is_active: true }, v.size, v.color);
    if (v.quantity > available) {
      return deny(409, `"${v.product.name}"${v.size ? ` talle ${v.size}` : ''}${v.color ? ` ${v.color}` : ''}: hay ${available} en stock y se cargaron ${v.quantity}.`);
    }
    const unitPrice = getProductPrice(v.product, v.size);
    lines.push({
      product: { ...v.product, selectedSize: v.size, selectedColor: v.color, unit_price: unitPrice },
      quantity: v.quantity,
      variantKey: v.key
    });
  }

  // Descuento de stock (total + talle/color); si algo falla se devuelve.
  const deducted = [];
  for (const line of lines) {
    const { data: ok, error } = await supabaseAdmin.rpc('decrement_variant_stock', {
      p_product_id: line.product.id,
      p_size: line.product.selectedSize,
      p_color: line.product.selectedColor,
      p_qty: line.quantity
    });
    if (error || ok === false) {
      await Promise.all(deducted.map((l) => supabaseAdmin.rpc('restore_variant_stock', {
        p_product_id: l.product.id, p_size: l.product.selectedSize, p_color: l.product.selectedColor, p_qty: l.quantity
      })));
      return deny(409, `"${line.product.name}" se quedó sin stock. Revisá la venta.`);
    }
    deducted.push(line);
  }

  const total = lines.reduce((s, l) => s + l.product.unit_price * l.quantity, 0);
  const sale = {
    id: randomSaleId(),
    channel: 'local',
    status: 'pendiente_cobro',
    created_at: new Date().toISOString(),
    client_name: clean(body.clientName, 120) || 'Venta en el local',
    client_phone: clean(body.clientPhone, 30).replace(/\D/g, '').slice(-10) || '',
    client_dni: '',
    client_locality: 'Rosario',
    delivery_method: 'Venta en el local',
    customer_notes: clean(body.notes, 500) || null,
    items: lines,
    total_amount: total,
    is_wholesale: true,
    discount_applied: 0,
    stock_issue: false,
    seller_id: seller.id,
    commission_pct: Number(seller.commission_pct) || 0
  };

  let { error: insertErr } = await supabaseAdmin.from('orders').insert(sale);
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
