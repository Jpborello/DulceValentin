import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { supabaseAdmin, argentinaDay } from '@/lib/staffAuth';
import { buildLocalSaleLines, restoreLinesStock, randomLocalId, ledgerPaymentMethod } from '@/lib/localSale';

// Caja Principal y Caja de Sección del panel de administración (PosTab).
// Circuito (2026-11):
//   1. Sección (ej. niños, arriba): se arma la venta A NOMBRE DE LA VENDEDORA
//      (createPreventa). Queda como venta del local "pendiente_cobro" (igual
//      que las de la caja de vendedoras), con el stock ya separado, y se
//      imprime el ticket con su código de barras.
//   2. Caja Principal (abajo): se escanean uno o varios tickets (de cualquier
//      sección) y se pueden sumar prendas sueltas. Todo se cobra en un solo
//      pago (chargeSale): cada ticket queda "cobrado" y suma a la comisión de
//      su vendedora.
// Solo el admin logueado en el panel puede usar esta ruta.

const DEFAULT_SUPERVISOR_PIN = '1234';
const PAYMENT_METHODS = ['efectivo', 'transferencia', 'tarjeta', 'otro'];
const PREVENTA_ID_RE = /^(LOC-\d{6}|OFF-[A-Z0-9]{8}|DV-PRE-\d{6})$/;
const MAX_TICKETS_PER_CHARGE = 20;

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// staff.id de quien usa el panel (si tiene usuario de personal), para dejar
// registrado quién cobró.
async function getCallerStaffId(req) {
  try {
    const header = req.headers.get('authorization') || '';
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) return null;
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (!data?.user) return null;
    const { data: staff } = await supabaseAdmin.from('staff').select('id').eq('auth_user_id', data.user.id).maybeSingle();
    return staff?.id || null;
  } catch {
    return null;
  }
}

// Renglones del carrito de la caja -> formato de buildLocalSaleLines.
function toRawItems(items) {
  return (Array.isArray(items) ? items : []).map((it) => ({
    id: it?.productId || it?.product?.id,
    quantity: it?.quantity,
    size: it?.size && it.size !== 'SIN_TALLE' ? it.size : null,
    color: it?.color && it.color !== 'SIN_COLOR' ? it.color : null,
    priceType: it?.pricingType === 'menor' ? 'menor' : 'mayor'
  }));
}

async function insertWithFreshId(table, row, prefix) {
  let attempt = { ...row };
  for (let i = 0; i < 4; i++) {
    const { error } = await supabaseAdmin.from(table).insert(attempt);
    if (!error) return { row: attempt };
    if (error.code !== '23505') return { error };
    attempt = { ...attempt, id: randomLocalId(prefix) };
  }
  return { error: { message: 'No se pudo generar un número de comprobante.' } };
}

// Helper para leer la configuración del POS (PIN de supervisor y cajeros)
async function getPosConfigData() {
  let supervisorPin = DEFAULT_SUPERVISOR_PIN;
  let hasCustomPin = false;

  try {
    const { data: configRow } = await supabaseAdmin
      .from('pos_config')
      .select('value')
      .eq('key', 'supervisor_pin')
      .maybeSingle();

    if (configRow?.value?.pin) {
      supervisorPin = String(configRow.value.pin);
      hasCustomPin = true;
    }
  } catch (err) {
    console.warn('pos_config no disponible, usando PIN default:', err.message);
  }

  // Leer cajeros registrados
  let cashiers = [];
  try {
    const { data: cashierRows } = await supabaseAdmin
      .from('pos_cashiers')
      .select('code, name, dni, active')
      .eq('active', true)
      .order('code', { ascending: true });

    if (Array.isArray(cashierRows) && cashierRows.length > 0) {
      cashiers = cashierRows;
    }
  } catch (err) {
    console.warn('pos_cashiers no disponible:', err.message);
  }

  // Si no hay cajeras en pos_cashiers, traer de tabla staff o defaults
  if (cashiers.length === 0) {
    try {
      const { data: staffRows } = await supabaseAdmin
        .from('staff')
        .select('name, role')
        .eq('active', true);

      if (Array.isArray(staffRows) && staffRows.length > 0) {
        cashiers = staffRows.map((s, idx) => ({
          code: String(101 + idx),
          name: s.name,
          dni: ''
        }));
      }
    } catch (_) {}
  }

  if (cashiers.length === 0) {
    cashiers = [
      { code: '101', name: 'Caja Principal' },
      { code: '102', name: 'Caja Secundaria' }
    ];
  }

  return { supervisorPin, hasCustomPin, cashiers };
}

// Helper para buscar turno activo de una terminal
async function getActiveShift(registerId) {
  try {
    const { data: shift, error } = await supabaseAdmin
      .from('pos_shifts')
      .select('*')
      .eq('register_id', registerId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('getActiveShift error:', error.message);
      return null;
    }
    return shift || null;
  } catch (err) {
    console.warn('pos_shifts no disponible:', err.message);
    return null;
  }
}

export async function GET(req) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Servicio no disponible.' }, { status: 503 });
  const denied = await requireAdmin(req, supabaseAdmin);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'terminal_init';
    const registerId = searchParams.get('register_id') || 'caja_01';

    if (action === 'terminal_init') {
      const { supervisorPin, hasCustomPin, cashiers } = await getPosConfigData();
      const activeShift = await getActiveShift(registerId);

      // Traer productos activos para el catálogo de la terminal de caja
      const { data: products, error: prodErr } = await supabaseAdmin
        .from('products')
        .select('id, code, name, price, wholesale_price, stock, stock_per_size, color_stock, sizes, colors, image_url, barcodes, is_active')
        .order('name', { ascending: true });

      if (prodErr) throw prodErr;

      return NextResponse.json({
        success: true,
        terminal: {
          register_id: registerId,
          active_shift: activeShift,
          has_custom_pin: hasCustomPin
        },
        cashiers: cashiers.map((c) => ({
          code: c.code,
          name: c.name,
          dni: c.dni || ''
        })),
        products: products || []
      });
    }

    if (action === 'check_shift') {
      const activeShift = await getActiveShift(registerId);
      return NextResponse.json({ success: true, active_shift: activeShift });
    }

    // Búsqueda de orden de preventa para cargar en Caja Principal
    if (action === 'lookup_order') {
      const orderId = searchParams.get('order_id');
      if (!orderId) return NextResponse.json({ error: 'Falta order_id' }, { status: 400 });

      // Solo el número exacto del ticket (antes buscaba "parecidos" y podía
      // traer otro comprobante).
      const cleanId = orderId.trim().replace(/^#/, '').replace(/^ORD-/i, '').toUpperCase();
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (error || !order) {
        return NextResponse.json({ error: `No se encontró el ticket #${cleanId}.` }, { status: 404 });
      }

      const isPending = (order.channel === 'local' && order.status === 'pendiente_cobro')
        || (order.channel === 'preventa_seccion' && order.status === 'pendiente_caja');
      let sellerName = null;
      if (order.seller_id) {
        const { data: seller } = await supabaseAdmin.from('staff').select('name').eq('id', order.seller_id).maybeSingle();
        sellerName = seller?.name || null;
      }

      return NextResponse.json({ success: true, order: { ...order, seller_name: sellerName }, pending: isPending });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (err) {
    console.error('API POS GET Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Servicio no disponible.' }, { status: 503 });
  const denied = await requireAdmin(req, supabaseAdmin);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { action } = body;

    // 1. VERIFICAR PIN DE SUPERVISOR
    if (action === 'verifyPin') {
      const { pin } = body;
      const { supervisorPin } = await getPosConfigData();
      const currentPin = String(supervisorPin || DEFAULT_SUPERVISOR_PIN).trim();
      const inputPin = String(pin || '').trim();

      if (inputPin === currentPin) {
        return NextResponse.json({ success: true, authorized: true });
      }
      return NextResponse.json({ success: false, authorized: false, error: 'PIN de Supervisor incorrecto' }, { status: 401 });
    }

    // 2. APERTURA DE TURNO
    if (action === 'openShift') {
      const { registerId, cashierCode, cashierName, initialCash } = body;
      if (!registerId || !cashierCode) {
        return NextResponse.json({ error: 'Faltan datos de la caja o el cajero' }, { status: 400 });
      }

      const existingShift = await getActiveShift(registerId);
      if (existingShift) {
        return NextResponse.json({
          error: `La ${registerId.toUpperCase()} ya tiene un turno abierto por ${existingShift.cashier_name}. Debe cerrarse antes de abrir uno nuevo.`
        }, { status: 400 });
      }

      const initialAmount = Math.max(0, Number(initialCash) || 0);
      const shiftId = `shift_${registerId}_${Date.now()}`;
      const now = new Date().toISOString();

      const newShift = {
        id: shiftId,
        register_id: registerId,
        cashier_code: cashierCode,
        cashier_name: cashierName || 'Cajera',
        opened_at: now,
        initial_cash: initialAmount,
        sales_cash: 0,
        sales_transfer: 0,
        sales_card: 0,
        sales_other: 0,
        sales_total: 0,
        sales_count: 0,
        cash_in_total: 0,
        withdrawals_total: 0,
        expected_cash: initialAmount,
        status: 'open'
      };

      try {
        await supabaseAdmin.from('pos_shifts').insert(newShift);
      } catch (insertErr) {
        console.warn('pos_shifts insert fallback:', insertErr.message);
      }

      return NextResponse.json({ success: true, shift: newShift });
    }

    // 3. COBRAR EN CAJA PRINCIPAL: uno o varios tickets de sección (a nombre
    // de su vendedora) más prendas sueltas, todo en un solo pago.
    // body: { preventaIds: [], items: [renglones sueltos], sellerId?, paymentMethod, cashGiven?, discount?, client* }
    if (action === 'chargeSale') {
      const registerId = clean(body.registerId || 'caja_01', 40);
      const paymentMethod = PAYMENT_METHODS.includes(body.paymentMethod) ? body.paymentMethod : null;
      if (!paymentMethod) return NextResponse.json({ error: 'Elegí el medio de pago.' }, { status: 400 });

      const ticketIds = [...new Set((Array.isArray(body.preventaIds) ? body.preventaIds : [])
        .map((id) => clean(id, 40).replace(/^#/, '').toUpperCase())
        .filter(Boolean))];
      if (ticketIds.length > MAX_TICKETS_PER_CHARGE) {
        return NextResponse.json({ error: `Se pueden cobrar hasta ${MAX_TICKETS_PER_CHARGE} tickets juntos.` }, { status: 400 });
      }
      const badId = ticketIds.find((id) => !PREVENTA_ID_RE.test(id));
      if (badId) return NextResponse.json({ error: `#${badId} no es un ticket de preventa.` }, { status: 400 });

      const looseRaw = toRawItems(body.items);
      if (ticketIds.length === 0 && looseRaw.length === 0) {
        return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 });
      }

      // Vendedora de las prendas sueltas (opcional; los tickets ya traen la suya).
      let looseSeller = null;
      if (looseRaw.length > 0 && body.sellerId) {
        const { data: chosen } = await supabaseAdmin
          .from('staff')
          .select('id, name, commission_pct, active')
          .eq('id', clean(body.sellerId, 60))
          .maybeSingle();
        if (!chosen || !chosen.active) return NextResponse.json({ error: 'La vendedora elegida no está habilitada.' }, { status: 400 });
        looseSeller = chosen;
      }

      // Tickets: tienen que existir y seguir pendientes de cobro.
      const tickets = [];
      if (ticketIds.length > 0) {
        const { data: found, error: ticketsErr } = await supabaseAdmin.from('orders').select('*').in('id', ticketIds);
        if (ticketsErr) return NextResponse.json({ error: 'No se pudieron leer los tickets.' }, { status: 500 });
        for (const id of ticketIds) {
          const t = (found || []).find((o) => o.id === id);
          if (!t) return NextResponse.json({ error: `No se encontró el ticket #${id}.` }, { status: 404 });
          const legacy = t.channel === 'preventa_seccion'; // tickets DV-PRE de antes de este cambio
          const pendingStatus = legacy ? 'pendiente_caja' : 'pendiente_cobro';
          if ((!legacy && t.channel !== 'local') || t.status !== pendingStatus) {
            return NextResponse.json({ error: `El ticket #${id} ya fue cobrado o cancelado.` }, { status: 409 });
          }
          tickets.push({ ...t, legacy, pendingStatus });
        }
      }

      // Prendas sueltas: precio del servidor y stock descontado.
      let looseLines = [];
      let looseTotal = 0;
      if (looseRaw.length > 0) {
        const built = await buildLocalSaleLines(supabaseAdmin, looseRaw);
        if (built.error) return NextResponse.json({ error: built.error }, { status: built.status });
        looseLines = built.lines;
        looseTotal = built.total;
      }

      const grossTotal = tickets.reduce((s, t) => s + (Number(t.total_amount) || 0), 0) + looseTotal;
      const discountApplied = Math.min(grossTotal, Math.max(0, Number(body.discount) || 0));
      const totalCharged = grossTotal - discountApplied;

      let cashGiven = null;
      if (paymentMethod === 'efectivo' && body.cashGiven !== null && body.cashGiven !== undefined && body.cashGiven !== '' && Number(body.cashGiven) > 0) {
        cashGiven = Number(body.cashGiven);
        if (!Number.isFinite(cashGiven) || cashGiven < totalCharged) {
          await restoreLinesStock(supabaseAdmin, looseLines);
          return NextResponse.json({ error: 'El efectivo recibido es menor al total.' }, { status: 400 });
        }
      }

      // El descuento se reparte primero sobre las prendas sueltas y después
      // sobre los tickets, así cada venta queda con lo que realmente se cobró
      // (y la comisión se calcula sobre eso).
      let remainingDiscount = discountApplied;
      const takeDiscount = (gross) => {
        const cut = Math.min(remainingDiscount, gross);
        remainingDiscount -= cut;
        return cut;
      };
      const looseDiscount = takeDiscount(looseTotal);
      for (const t of tickets) {
        const gross = Number(t.total_amount) || 0;
        t.cut = takeDiscount(gross);
        t.net = gross - t.cut;
      }

      const now = new Date().toISOString();
      const cashierStaffId = await getCallerStaffId(req);
      const commissionOf = (amount, pct) => Math.round(amount * (Number(pct) || 0)) / 100;
      const mainId = tickets.length > 0 && looseLines.length === 0 ? tickets[0].id : null;

      // Se marca cada ticket como cobrado solo si sigue pendiente: si otra caja
      // lo cobró justo antes, se deshace todo y no se cobra nada.
      const claimed = [];
      const rollback = async () => {
        for (const t of claimed) {
          await supabaseAdmin.from('orders').update({
            status: t.pendingStatus,
            channel: t.channel,
            payment_method: t.payment_method ?? null,
            paid_at: null,
            cash_received: null,
            cashier_id: t.cashier_id ?? null,
            commission_amount: t.commission_amount ?? null,
            total_amount: t.total_amount,
            discount_applied: t.discount_applied ?? 0
          }).eq('id', t.id);
        }
        await restoreLinesStock(supabaseAdmin, looseLines);
      };

      for (const t of tickets) {
        const update = {
          status: 'cobrado',
          channel: 'local',
          payment_method: paymentMethod,
          paid_at: now,
          cashier_id: cashierStaffId,
          commission_amount: commissionOf(t.net, t.commission_pct)
        };
        if (t.cut > 0) {
          update.total_amount = t.net;
          update.discount_applied = (Number(t.discount_applied) || 0) + t.cut;
        }
        if (t.id === mainId && cashGiven !== null) update.cash_received = cashGiven;

        const { data: ok, error: claimErr } = await supabaseAdmin
          .from('orders')
          .update(update)
          .eq('id', t.id)
          .eq('status', t.pendingStatus)
          .select('id')
          .maybeSingle();
        if (claimErr || !ok) {
          await rollback();
          return NextResponse.json({ error: `El ticket #${t.id} ya fue cobrado o cancelado. No se cobró nada.` }, { status: 409 });
        }
        claimed.push(t);
      }

      // Prendas sueltas: venta nueva ya cobrada.
      let looseOrder = null;
      if (looseLines.length > 0) {
        const looseNet = looseTotal - looseDiscount;
        const row = {
          id: randomLocalId('DV'),
          channel: 'local',
          status: 'cobrado',
          created_at: now,
          paid_at: now,
          client_name: clean(body.clientName, 120) || 'Consumidor Final',
          client_phone: clean(body.clientPhone, 30).replace(/\D/g, '').slice(-10) || '',
          client_dni: clean(body.clientDni, 20),
          client_locality: 'Rosario',
          delivery_method: 'Venta en el local',
          customer_notes: tickets.length > 0 ? `Caja Principal (junto con ${tickets.map((t) => `#${t.id}`).join(', ')})` : 'Caja Principal',
          items: looseLines,
          total_amount: looseNet,
          is_wholesale: looseLines.every((l) => l.price_type !== 'menor'),
          discount_applied: looseDiscount,
          stock_issue: false,
          seller_id: looseSeller?.id || null,
          commission_pct: Number(looseSeller?.commission_pct) || 0,
          commission_amount: commissionOf(looseNet, looseSeller?.commission_pct),
          payment_method: paymentMethod,
          cash_received: cashGiven,
          cashier_id: cashierStaffId
        };
        const { row: saved, error: insertErr } = await insertWithFreshId('orders', row, 'DV');
        if (insertErr) {
          console.error('POS chargeSale: error guardando la venta', insertErr);
          await rollback();
          return NextResponse.json({ error: 'No se pudo guardar la venta. Probá de nuevo.' }, { status: 500 });
        }
        looseOrder = saved;
      }

      // Tickets viejos (DV-PRE): no habían separado stock, se descuenta ahora.
      for (const t of tickets.filter((x) => x.legacy)) {
        for (const it of t.items || []) {
          const prod = it.product || it;
          try {
            await supabaseAdmin.rpc('decrement_variant_stock', {
              p_product_id: prod.id,
              p_size: it.size || prod.selectedSize || null,
              p_color: it.color || prod.selectedColor || null,
              p_qty: Math.max(1, Number(it.quantity) || 1)
            });
          } catch (stockErr) {
            console.warn('Error descontando stock de preventa vieja:', stockErr.message);
          }
        }
      }

      // Libro de ventas por vendedora (comisiones, ranking): un movimiento por venta.
      const saleDate = argentinaDay(now);
      const ledgerRows = [
        ...claimed.filter((t) => t.seller_id && t.net > 0).map((t) => ({ seller_id: t.seller_id, amount: t.net, id: t.id, client: t.client_name })),
        ...(looseOrder?.seller_id && looseOrder.total_amount > 0 ? [{ seller_id: looseOrder.seller_id, amount: looseOrder.total_amount, id: looseOrder.id, client: looseOrder.client_name }] : [])
      ].map((r) => ({
        client_ref: crypto.randomUUID(),
        seller_id: r.seller_id,
        sale_date: saleDate,
        amount: r.amount,
        payment_method: ledgerPaymentMethod(paymentMethod),
        note: `Venta mostrador #${r.id}${r.client && r.client !== 'Venta en el local' && r.client !== 'Consumidor Final' ? ` (${r.client})` : ''}`,
        created_by: cashierStaffId
      }));
      if (ledgerRows.length > 0) {
        const { error: ledgerErr } = await supabaseAdmin.from('seller_sales').insert(ledgerRows);
        if (ledgerErr) console.error('POS chargeSale: error al registrar en seller_sales:', ledgerErr);
      }

      // Actualizar turno activo si existe
      try {
        const activeShift = await getActiveShift(registerId);
        if (activeShift) {
          const isCash = paymentMethod === 'efectivo';
          const isTransfer = paymentMethod === 'transferencia';
          const isCard = paymentMethod === 'tarjeta';

          const newSalesCash = Number(activeShift.sales_cash || 0) + (isCash ? totalCharged : 0);
          const newSalesTransfer = Number(activeShift.sales_transfer || 0) + (isTransfer ? totalCharged : 0);
          const newSalesCard = Number(activeShift.sales_card || 0) + (isCard ? totalCharged : 0);
          const newSalesOther = Number(activeShift.sales_other || 0) + (!isCash && !isTransfer && !isCard ? totalCharged : 0);
          const newSalesTotal = Number(activeShift.sales_total || 0) + totalCharged;
          const newSalesCount = Number(activeShift.sales_count || 0) + 1;
          const newExpectedCash = Number(activeShift.initial_cash || 0) + newSalesCash + Number(activeShift.cash_in_total || 0) - Number(activeShift.withdrawals_total || 0);

          await supabaseAdmin.from('pos_shifts').update({
            sales_cash: newSalesCash,
            sales_transfer: newSalesTransfer,
            sales_card: newSalesCard,
            sales_other: newSalesOther,
            sales_total: newSalesTotal,
            sales_count: newSalesCount,
            expected_cash: newExpectedCash
          }).eq('id', activeShift.id);
        }
      } catch (shiftUpdateErr) {
        console.warn('Error actualizando turno activo:', shiftUpdateErr.message);
      }

      // Comprobante único con todo lo cobrado (tickets + sueltas).
      const sellerIds = [...new Set([...claimed.map((t) => t.seller_id), looseOrder?.seller_id].filter(Boolean))];
      let sellerNames = [];
      if (sellerIds.length > 0) {
        const { data: people } = await supabaseAdmin.from('staff').select('id, name').in('id', sellerIds);
        sellerNames = sellerIds.map((id) => (people || []).find((p) => p.id === id)?.name).filter(Boolean);
      }
      const firstTicket = claimed[0];
      const receipt = {
        id: looseOrder?.id || firstTicket.id,
        created_at: now,
        paid_at: now,
        items: [...claimed.flatMap((t) => t.items || []), ...looseLines],
        total_amount: totalCharged,
        discount_applied: discountApplied,
        payment_method: paymentMethod,
        cash_received: cashGiven,
        client_name: clean(body.clientName, 120) || (firstTicket?.client_name !== 'Venta en el local' ? firstTicket?.client_name : '') || 'Consumidor Final',
        seller_name: sellerNames.join(', '),
        linked_tickets: claimed.map((t) => t.id)
      };

      return NextResponse.json({
        success: true,
        order: receipt,
        orderId: receipt.id,
        chargedTickets: claimed.map((t) => t.id),
        change: cashGiven !== null ? Math.round((cashGiven - totalCharged) * 100) / 100 : null
      });
    }

    // 3B. CAJA DE SECCIÓN (ej. niños): venta a nombre de la vendedora, queda
    // pendiente de cobro con el stock separado y se cobra en Caja Principal.
    // body: { sectionName, sellerId, items, clientName?, clientPhone? }
    if (action === 'createPreventa') {
      const sectionName = clean(body.sectionName || 'Sección Niños', 80);
      const sellerId = clean(body.sellerId, 60);
      if (!sellerId) return NextResponse.json({ error: 'Elegí la vendedora que hizo la venta.' }, { status: 400 });

      const { data: seller } = await supabaseAdmin
        .from('staff')
        .select('id, name, commission_pct, active')
        .eq('id', sellerId)
        .maybeSingle();
      if (!seller || !seller.active) return NextResponse.json({ error: 'La vendedora elegida no está habilitada.' }, { status: 400 });

      const built = await buildLocalSaleLines(supabaseAdmin, toRawItems(body.items));
      if (built.error) return NextResponse.json({ error: built.error }, { status: built.status });

      const sale = {
        id: randomLocalId('LOC'),
        channel: 'local',
        status: 'pendiente_cobro',
        created_at: new Date().toISOString(),
        client_name: clean(body.clientName, 120) || 'Venta en el local',
        client_phone: clean(body.clientPhone, 30).replace(/\D/g, '').slice(-10) || '',
        client_dni: '',
        client_locality: 'Rosario',
        delivery_method: 'Venta en el local',
        customer_notes: sectionName,
        items: built.lines,
        total_amount: built.total,
        is_wholesale: built.lines.every((l) => l.price_type !== 'menor'),
        discount_applied: 0,
        stock_issue: false,
        seller_id: seller.id,
        commission_pct: Number(seller.commission_pct) || 0
      };

      const { row: saved, error: insertErr } = await insertWithFreshId('orders', sale, 'LOC');
      if (insertErr) {
        console.error('POS createPreventa: error guardando la venta', insertErr);
        await restoreLinesStock(supabaseAdmin, built.lines);
        return NextResponse.json({ error: 'No se pudo guardar la venta. Probá de nuevo.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, order: { ...saved, seller_name: seller.name } });
    }

    // 4. CIERRE DE TURNO Y ARQUEO (TICKET Z)
    if (action === 'closeShift') {
      const { registerId, countedCash, closingNotes } = body;
      const activeShift = await getActiveShift(registerId);

      if (!activeShift) {
        return NextResponse.json({ error: 'No hay ningún turno abierto para esta caja.' }, { status: 400 });
      }

      const counted = Math.max(0, Number(countedCash) || 0);
      const expected = Number(activeShift.expected_cash || 0);
      const difference = counted - expected;
      const now = new Date().toISOString();

      const summary = {
        ...activeShift,
        closed_at: now,
        status: 'closed',
        counted_cash: counted,
        difference: difference,
        closing_notes: closingNotes || ''
      };

      try {
        await supabaseAdmin.from('pos_shifts').update({
          closed_at: now,
          status: 'closed',
          counted_cash: counted,
          difference: difference,
          closing_notes: closingNotes || ''
        }).eq('id', activeShift.id);
      } catch (closeErr) {
        console.warn('pos_shifts close error:', closeErr.message);
      }

      return NextResponse.json({
        success: true,
        summary
      });
    }

    // 5. MOVIMIENTO DE EFECTIVO EXTRA (INGRESO O RETIRO)
    if (action === 'cashMovement') {
      const { registerId, type, amount, reason } = body;
      const activeShift = await getActiveShift(registerId);
      if (!activeShift) {
        return NextResponse.json({ error: 'No hay turno abierto para registrar movimientos.' }, { status: 400 });
      }

      const val = Math.max(0, Number(amount) || 0);
      if (val <= 0) return NextResponse.json({ error: 'El monto debe ser mayor a 0.' }, { status: 400 });

      const isWithdrawal = type === 'withdrawal';
      const newCashIn = Number(activeShift.cash_in_total || 0) + (!isWithdrawal ? val : 0);
      const newWithdrawals = Number(activeShift.withdrawals_total || 0) + (isWithdrawal ? val : 0);
      const newExpectedCash = Number(activeShift.initial_cash || 0) + Number(activeShift.sales_cash || 0) + newCashIn - newWithdrawals;

      try {
        await supabaseAdmin.from('pos_shifts').update({
          cash_in_total: newCashIn,
          withdrawals_total: newWithdrawals,
          expected_cash: newExpectedCash
        }).eq('id', activeShift.id);
      } catch (err) {
        console.warn('Error en cashMovement:', err.message);
      }

      return NextResponse.json({ success: true, expectedCash: newExpectedCash });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (err) {
    console.error('API POS POST Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

