import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/phoneUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

// "Modificar o cancelar este pedido" desde el checkout. Antes solo se
// borraba el pedido del navegador: en la base quedaba "pendiente" con el
// stock descontado, y al volver a generarlo quedaba duplicado. Ahora se
// cancela de verdad (solo si todavia no se mando comprobante ni se aprobo),
// devolviendo stock, baucher y boletos.
export async function POST(req) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Servicio no disponible.' }, { status: 503 });

  try {
    const body = await req.json();
    const orderId = String(body.orderId || '').trim().toUpperCase();
    const phone = normalizePhone(body.phone);

    if (!orderId || phone.length < 8) {
      return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, client_phone, status, items, voucher_id, stock_issue')
      .eq('id', orderId)
      .maybeSingle();

    if (!order || normalizePhone(order.client_phone) !== phone) {
      return NextResponse.json({ error: 'No encontramos ese pedido.' }, { status: 404 });
    }
    if (order.status === 'cancelado') {
      return NextResponse.json({ success: true, alreadyCancelled: true });
    }
    if (order.status !== 'pendiente') {
      return NextResponse.json({
        error: 'Este pedido ya está en proceso y no se puede modificar desde la web. Escribinos por WhatsApp y lo ajustamos.'
      }, { status: 409 });
    }

    // Se marca cancelado solo si sigue pendiente, para que dos clicks no
    // devuelvan el stock dos veces.
    const { data: cancelled, error: cancelErr } = await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelado' })
      .eq('id', orderId)
      .eq('status', 'pendiente')
      .select('id')
      .maybeSingle();
    if (cancelErr) throw cancelErr;
    if (!cancelled) return NextResponse.json({ success: true, alreadyCancelled: true });

    if (!order.stock_issue) {
      // Devuelve el total y el talle/color de cada linea.
      await Promise.all(
        (order.items || [])
          .filter((it) => it?.product?.id && Number(it.quantity) > 0)
          .map((it) =>
            supabaseAdmin.rpc('restore_variant_stock', {
              p_product_id: it.product.id,
              p_size: it.product.selectedSize || null,
              p_color: it.product.selectedColor || null,
              p_qty: Number(it.quantity)
            })
          )
      );
    }

    if (order.voucher_id) {
      await supabaseAdmin
        .from('vouchers')
        .update({ status: 'active', redeemed_order_id: null, redeemed_at: null })
        .eq('id', order.voucher_id);
    }

    await supabaseAdmin.from('raffle_tickets').delete().eq('order_id', orderId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API orders/cancel Error:', err);
    return NextResponse.json({ error: 'No pudimos cancelar el pedido. Probá de nuevo o escribinos por WhatsApp.' }, { status: 500 });
  }
}
