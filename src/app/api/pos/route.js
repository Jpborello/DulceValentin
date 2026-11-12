import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const DEFAULT_SUPERVISOR_PIN = '1234';

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

      const cleanId = orderId.trim().replace(/^#/, '').replace(/^ORD-/, '');
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .or(`id.eq.${cleanId},id.ilike.%${cleanId}%`)
        .limit(1)
        .maybeSingle();

      if (error || !order) {
        return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
      }

      return NextResponse.json({ success: true, order });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (err) {
    console.error('API POS GET Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
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

    // 3. COBRAR VENTA EN MOSTRADOR (CHECKOUT POS)
    if (action === 'chargeSale') {
      const {
        registerId = 'caja_01',
        cashierCode = '',
        cashierName = '',
        clientName = 'Consumidor Final',
        clientDni = '',
        clientPhone = '',
        paymentMethod = 'efectivo',
        cashGiven = null,
        changeDue = null,
        discount = 0,
        items = []
      } = body;

      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 });
      }

      // Validar y calcular total
      let subtotal = 0;
      const orderItems = [];

      for (const it of items) {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unit = Number(it.unitPrice) || 0;
        subtotal += unit * qty;

        orderItems.push({
          product: {
            id: it.product?.id || it.productId,
            code: it.product?.code || it.code || '',
            name: it.product?.name || it.name || 'Artículo',
            price: unit,
            selectedSize: it.size || null,
            selectedColor: it.color || null,
            image_url: it.product?.image_url || it.image_url || null
          },
          size: it.size || null,
          color: it.color || null,
          unit_price: unit,
          quantity: qty
        });
      }

      const discountApplied = Math.max(0, Number(discount) || 0);
      const totalAmount = Math.max(0, subtotal - discountApplied);

      // Crear o actualizar la orden en tabla orders
      const orderId = body.existingOrderId ? String(body.existingOrderId).trim() : `DV-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString();

      const orderData = {
        id: orderId,
        client_name: clientName || 'Consumidor Final',
        client_phone: clientPhone || '',
        client_dni: clientDni || '',
        delivery_method: 'Retiro por local',
        items: orderItems,
        total_amount: totalAmount,
        status: 'completado',
        channel: 'local',
        payment_method: paymentMethod,
        cash_received: cashGiven ? Number(cashGiven) : null,
        paid_at: now,
        created_at: now
      };

      let finalOrder = orderData;
      if (body.existingOrderId) {
        const { data: updatedOrder, error: updateErr } = await supabaseAdmin
          .from('orders')
          .update(orderData)
          .eq('id', orderId)
          .select()
          .maybeSingle();
        if (!updateErr && updatedOrder) finalOrder = updatedOrder;
      } else {
        const { data: createdOrder, error: orderErr } = await supabaseAdmin
          .from('orders')
          .insert(orderData)
          .select()
          .single();
        if (!orderErr && createdOrder) finalOrder = createdOrder;
      }

      // Descontar stock de cada variante en Supabase
      for (const it of items) {
        const prodId = it.product?.id || it.productId;
        const qty = Math.max(1, Number(it.quantity) || 1);
        const size = it.size || null;
        const color = it.color || null;

        try {
          await supabaseAdmin.rpc('decrement_variant_stock', {
            p_product_id: prodId,
            p_size: size,
            p_color: color,
            p_qty: qty
          });
        } catch (stockErr) {
          console.warn('Error descontando stock de variante:', stockErr.message);
          // Fallback directo a products.stock si no está la rpc
          try {
            const { data: curProd } = await supabaseAdmin.from('products').select('stock').eq('id', prodId).single();
            if (curProd) {
              await supabaseAdmin.from('products').update({ stock: Math.max(0, (curProd.stock || 0) - qty) }).eq('id', prodId);
            }
          } catch (_) {}
        }
      }

      // Actualizar turno activo si existe
      try {
        const activeShift = await getActiveShift(registerId);
        if (activeShift) {
          const isCash = paymentMethod === 'efectivo';
          const isTransfer = paymentMethod === 'transferencia';
          const isCard = paymentMethod === 'tarjeta';

          const newSalesCash = Number(activeShift.sales_cash || 0) + (isCash ? totalAmount : 0);
          const newSalesTransfer = Number(activeShift.sales_transfer || 0) + (isTransfer ? totalAmount : 0);
          const newSalesCard = Number(activeShift.sales_card || 0) + (isCard ? totalAmount : 0);
          const newSalesOther = Number(activeShift.sales_other || 0) + (!isCash && !isTransfer && !isCard ? totalAmount : 0);
          const newSalesTotal = Number(activeShift.sales_total || 0) + totalAmount;
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

      return NextResponse.json({
        success: true,
        order: finalOrder,
        orderId
      });
    }

    // 3B. EMITIR TICKET DE PREVENTA (SECCIÓN JEANS & INFANTIL)
    if (action === 'createPreventa') {
      const {
        sectionName = 'Sección Jeans & Infantil',
        cashierCode,
        cashierName,
        clientName = 'Consumidor Final',
        clientDni = '',
        clientPhone = '',
        discount = 0,
        items = []
      } = body;

      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 });
      }

      let subtotal = 0;
      const orderItems = [];

      for (const it of items) {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unit = Number(it.unitPrice) || 0;
        subtotal += unit * qty;

        orderItems.push({
          product: {
            id: it.product?.id || it.productId,
            code: it.product?.code || it.code || '',
            name: it.product?.name || it.name || 'Artículo',
            price: unit,
            selectedSize: it.size || null,
            selectedColor: it.color || null,
            image_url: it.product?.image_url || it.image_url || null
          },
          size: it.size || null,
          color: it.color || null,
          unit_price: unit,
          quantity: qty
        });
      }

      const discountApplied = Math.max(0, Number(discount) || 0);
      const totalAmount = Math.max(0, subtotal - discountApplied);

      const orderId = `DV-PRE-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString();

      const orderData = {
        id: orderId,
        client_name: clientName || 'Consumidor Final',
        client_phone: clientPhone || '',
        client_dni: clientDni || '',
        delivery_method: 'Retiro por local',
        items: orderItems,
        total_amount: totalAmount,
        status: 'pendiente_caja',
        channel: 'preventa_seccion',
        payment_method: 'pendiente',
        notes: `${sectionName} · Atendido por: ${cashierName || cashierCode || 'Sección'}`,
        created_at: now
      };

      try {
        await supabaseAdmin.from('orders').insert(orderData);
      } catch (insertErr) {
        console.warn('Error guardando preventa en Supabase:', insertErr.message);
      }

      return NextResponse.json({ success: true, order: orderData });
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

