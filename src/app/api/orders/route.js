import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/phoneUtils';
import { getProductPrice } from '@/lib/productPricing';
import { getProductStockForSizeColor } from '@/lib/catalogData';
import { evaluateWholesaleRule } from '@/lib/wholesaleRule';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

// Checkout de la tienda (2026-10). Antes el pedido se armaba entero en el
// navegador: precios, total, descuento de stock, boletos del sorteo y
// baucher se mandaban directo a Supabase con la key publica, asi que
// cualquiera podia manipularlos (y si el insert fallaba, el cliente veia
// "pedido generado" igual con el stock ya descontado). Ahora el navegador
// solo manda QUE quiere comprar; precios, stock, regla x3, baucher y boletos
// se resuelven aca con la service role key, y si algo falla se deshace todo.

const RAFFLE_STEP = 50000;
const MAX_LINES = 200;
const MAX_QTY_PER_LINE = 999;

const PRODUCT_COLUMNS = 'id, name, code, category, subcategory, price, wholesale_price, price_per_size, stock, stock_per_size, color_stock, sizes, colors, image_url, thumb_url, is_active, exempt_from_min3';

const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const variantKeyOf = (id, size, color) => `${id}::${size || ''}::${color || ''}`;

function randomOrderId() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return 'ORD-' + (100000 + (n[0] % 900000));
}

async function generateUniqueOrderId() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const id = randomOrderId();
    const { data } = await supabaseAdmin.from('orders').select('id').eq('id', id).maybeSingle();
    if (!data) return id;
  }
  throw new Error('No se pudo generar un número de pedido');
}

// Devuelve el stock de las lineas ya descontadas (total + talle/color).
async function restoreStock(deductedLines) {
  await Promise.all(
    deductedLines.map((l) =>
      supabaseAdmin.rpc('restore_variant_stock', {
        p_product_id: l.product.id,
        p_size: l.product.selectedSize,
        p_color: l.product.selectedColor,
        p_qty: l.quantity
      })
    )
  );
}

async function releaseVoucher(voucherId) {
  if (!voucherId) return;
  await supabaseAdmin
    .from('vouchers')
    .update({ status: 'active', redeemed_order_id: null, redeemed_at: null })
    .eq('id', voucherId);
}

const fail = (status, error, extra = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(req) {
  if (!supabaseAdmin) {
    return fail(503, 'La tienda no está configurada para recibir pedidos en este momento. Escribinos por WhatsApp.');
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Pedido inválido.');
  }

  // ---- Datos del cliente ----
  const client = body.client || {};
  const phone = normalizePhone(client.phone);
  if (phone.length < 8) return fail(400, 'Cargá un número de teléfono válido.');

  // Si ya es cliente, lo que no mande el navegador (ej. el DNI, que ya no se
  // devuelve al loguearse) se completa con lo guardado.
  const { data: existingClient } = await supabaseAdmin
    .from('wholesale_clients')
    .select('name, dni, locality')
    .eq('phone', phone)
    .maybeSingle();

  const name = clean(client.name) || existingClient?.name || '';
  const dni = clean(client.dni, 30) || existingClient?.dni || '';
  const locality = clean(client.locality, 120) || existingClient?.locality || '';
  const address = clean(client.address);
  const postalCode = clean(client.postalCode, 20);
  const floorApt = clean(client.floorApt, 60);
  const deliveryMethod = clean(body.deliveryMethod, 120) || 'Envío a Domicilio / Transporte';
  const isPickup = deliveryMethod.toLowerCase().includes('retiro');

  const missing = [!name && 'Nombre', !dni && 'DNI', !locality && 'Localidad'].filter(Boolean);
  if (missing.length > 0) return fail(400, `Completá estos datos para generar el pedido: ${missing.join(', ')}.`);
  if (!isPickup && !address) return fail(400, 'Para envío a domicilio necesitamos la dirección completa (calle y número).');

  // ---- Productos: precio y stock salen de la base, no del navegador ----
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) return fail(400, 'El carrito está vacío.');
  if (rawItems.length > MAX_LINES) return fail(400, 'El pedido tiene demasiados renglones.');

  const ids = [...new Set(rawItems.map((it) => String(it?.id || '')).filter(Boolean))];
  const { data: products, error: productsErr } = await supabaseAdmin
    .from('products')
    .select(PRODUCT_COLUMNS)
    .in('id', ids);
  if (productsErr) {
    console.error('API orders: error leyendo productos', productsErr);
    return fail(500, 'No pudimos verificar los productos. Probá de nuevo en un momento.');
  }
  const productById = new Map((products || []).map((p) => [p.id, p]));

  const lines = [];
  const priceChanges = [];
  for (const raw of rawItems) {
    const product = productById.get(String(raw?.id || ''));
    if (!product || product.is_active === false) {
      return fail(409, `Uno de los productos de tu carrito ya no está disponible. Quitalo para continuar.`);
    }
    const quantity = Math.floor(Number(raw.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY_PER_LINE) {
      return fail(400, `Revisá la cantidad de "${product.name}".`);
    }
    const size = raw.selectedSize ? String(raw.selectedSize) : null;
    const color = raw.selectedColor ? String(raw.selectedColor) : null;
    const sizes = Array.isArray(product.sizes) ? product.sizes.map(String) : [];
    if (size && sizes.length > 0 && !sizes.includes(size)) {
      return fail(409, `El talle ${size} de "${product.name}" ya no está disponible.`);
    }

    const unitPrice = getProductPrice(product, size);
    const variantKey = variantKeyOf(product.id, size, color);
    // El carrito "congela" el precio al agregar: si cambio desde entonces no
    // se cobra un precio distinto sin que el cliente lo vea antes.
    if (raw.unit_price != null && Number(raw.unit_price) !== unitPrice) {
      priceChanges.push({ variantKey, unit_price: unitPrice, name: product.name });
    }

    lines.push({
      product: { ...product, selectedSize: size, selectedColor: color, unit_price: unitPrice },
      quantity,
      variantKey
    });
  }

  if (priceChanges.length > 0) {
    const names = priceChanges.map((c) => `"${c.name}"`).join(', ');
    return fail(409, `Se actualizó el precio de ${names}. Ya lo corregimos en tu carrito: revisá el total y volvé a generar el pedido.`, {
      code: 'PRICE_CHANGED',
      prices: priceChanges
    });
  }

  // Stock por variante (talle/color) y por producto.
  const qtyByVariant = new Map();
  const qtyByProduct = {};
  for (const line of lines) {
    qtyByVariant.set(line.variantKey, (qtyByVariant.get(line.variantKey) || 0) + line.quantity);
    qtyByProduct[line.product.id] = (qtyByProduct[line.product.id] || 0) + line.quantity;
  }
  for (const line of lines) {
    const { product } = line;
    const available = getProductStockForSizeColor(product, product.selectedSize, product.selectedColor);
    const requested = qtyByVariant.get(line.variantKey);
    if (available <= 0) {
      return fail(409, `"${product.name}"${product.selectedSize ? ` (talle ${product.selectedSize})` : ''} se quedó sin stock. Quitalo de tu carrito o consultanos por WhatsApp.`);
    }
    if (requested > available) {
      return fail(409, `"${product.name}"${product.selectedSize ? ` (talle ${product.selectedSize})` : ''} tiene ${available} unidades disponibles y pediste ${requested}. Ajustá la cantidad para continuar.`);
    }
  }
  for (const [productId, qty] of Object.entries(qtyByProduct)) {
    const product = productById.get(productId);
    if (qty > (Number(product.stock) || 0)) {
      return fail(409, `"${product.name}" tiene ${product.stock} unidades disponibles en total y pediste ${qty}.`);
    }
  }

  const rule = evaluateWholesaleRule(lines);
  if (!rule.hasMinQtyItem) {
    return fail(400, `Para acceder al precio mayorista necesitás 3 unidades de un mismo artículo (faltan ${rule.unitsNeededForMinQty}).`);
  }

  const subtotal = lines.reduce((sum, l) => sum + l.product.unit_price * l.quantity, 0);

  let orderId;
  try {
    orderId = await generateUniqueOrderId();
  } catch (err) {
    console.error('API orders:', err);
    return fail(500, 'No pudimos generar el pedido. Probá de nuevo en un momento.');
  }

  // ---- Baucher: se reserva de forma atomica (solo si sigue activo) ----
  let voucher = null;
  if (body.useVoucher) {
    const { data: candidate } = await supabaseAdmin
      .from('vouchers')
      .select('id, amount')
      .eq('phone_normalized', phone)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (candidate) {
      const { data: reserved } = await supabaseAdmin
        .from('vouchers')
        .update({ status: 'redeemed', redeemed_order_id: orderId, redeemed_at: new Date().toISOString() })
        .eq('id', candidate.id)
        .eq('status', 'active')
        .select('id, amount')
        .maybeSingle();
      voucher = reserved || null;
    }
  }
  const discountApplied = Math.min(subtotal, Math.max(0, Number(voucher?.amount) || 0));
  const total = subtotal - discountApplied;

  // ---- Descuento de stock atomico por linea: baja el total y tambien el
  // talle/color vendido (antes solo bajaba el total y el stock por talle
  // quedaba desfasado). Si algo falla se devuelve lo ya descontado. ----
  const deducted = [];
  for (const line of lines) {
    const { data: ok, error } = await supabaseAdmin.rpc('decrement_variant_stock', {
      p_product_id: line.product.id,
      p_size: line.product.selectedSize,
      p_color: line.product.selectedColor,
      p_qty: line.quantity
    });
    if (error || ok === false) {
      await restoreStock(deducted);
      await releaseVoucher(voucher?.id);
      return fail(409, `"${line.product.name}" se agotó mientras armabas el pedido. Revisá tu carrito y probá de nuevo.`);
    }
    deducted.push(line);
  }

  const isRegistered = Boolean(existingClient);
  const order = {
    id: orderId,
    client_name: name,
    client_phone: phone,
    client_dni: dni,
    client_locality: locality,
    client_address: address,
    client_postal_code: postalCode,
    client_floor_apt: floorApt,
    delivery_method: deliveryMethod,
    receipt_url: null,
    total_amount: total,
    items: lines,
    status: 'pendiente',
    created_at: new Date().toISOString(),
    is_wholesale: true,
    discount_applied: discountApplied,
    voucher_id: voucher?.id || null,
    stock_issue: false,
    stock_issue_detail: null
  };

  const { error: insertErr } = await supabaseAdmin.from('orders').insert(order);
  if (insertErr) {
    console.error('API orders: error guardando el pedido', insertErr);
    await restoreStock(deducted);
    await releaseVoucher(voucher?.id);
    return fail(500, 'No pudimos guardar tu pedido. No se te cobró nada: probá de nuevo o escribinos por WhatsApp.');
  }

  // Boletos del sorteo: solo clientes que ya estaban en el Club (registrados
  // o que ya compraron antes con ese telefono).
  let raffleTickets = [];
  if (isRegistered && total >= RAFFLE_STEP) {
    const { data: ticketNums, error: ticketErr } = await supabaseAdmin.rpc('assign_raffle_tickets', {
      p_order_id: orderId,
      p_count: Math.floor(total / RAFFLE_STEP),
      p_client_name: name,
      p_client_phone: phone,
      p_client_dni: dni,
      p_client_locality: locality,
      p_order_amount: total
    });
    if (ticketErr) console.warn('API orders: error asignando boletos', ticketErr);
    else if (Array.isArray(ticketNums)) raffleTickets = ticketNums.map(String);
  }

  const { error: clientErr } = await supabaseAdmin.rpc('upsert_wholesale_client', {
    p_name: name,
    p_dni: dni,
    p_phone: phone,
    p_locality: locality,
    p_password: 'sinclave-' + phone.slice(-4)
  });
  if (clientErr) console.warn('API orders: error guardando el cliente', clientErr);

  return NextResponse.json({
    order: { ...order, raffle_tickets: raffleTickets, is_registered: isRegistered }
  });
}
