import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/phoneUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

// Solo se aceptan comprobantes subidos al bucket propio de la tienda.
const RECEIPT_URL_PREFIX = `${supabaseUrl}/storage/v1/object/public/comprobantes/`;

// El cliente adjunta el comprobante de SU pedido desde el checkout. Antes se
// guardaba con una funcion SQL publica que no verificaba nada (cualquiera
// podia cambiar el comprobante de cualquier pedido) y el cambio de estado a
// "comprobante_subido" lo bloqueaba el RLS, asi que en el admin el pedido
// seguia figurando "pendiente". Ahora se exige el telefono del pedido.
export async function POST(req) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Servicio no disponible.' }, { status: 503 });

  try {
    const body = await req.json();
    const orderId = String(body.orderId || '').trim().toUpperCase();
    const phone = normalizePhone(body.phone);
    const receiptUrl = String(body.receiptUrl || '');

    if (!orderId || phone.length < 8 || !receiptUrl.startsWith(RECEIPT_URL_PREFIX)) {
      return NextResponse.json({ error: 'Datos del comprobante inválidos.' }, { status: 400 });
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, client_phone, status')
      .eq('id', orderId)
      .maybeSingle();

    if (!order || normalizePhone(order.client_phone) !== phone) {
      return NextResponse.json({ error: 'No encontramos ese pedido.' }, { status: 404 });
    }
    if (order.status === 'cancelado') {
      return NextResponse.json({ error: 'Este pedido está cancelado.' }, { status: 409 });
    }

    const updates = { receipt_url: receiptUrl };
    if (order.status === 'pendiente') updates.status = 'comprobante_subido';

    const { error } = await supabaseAdmin.from('orders').update(updates).eq('id', orderId);
    if (error) throw error;

    return NextResponse.json({ success: true, status: updates.status || order.status });
  } catch (err) {
    console.error('API orders/receipt Error:', err);
    return NextResponse.json({ error: 'No pudimos guardar el comprobante. Probá de nuevo.' }, { status: 500 });
  }
}
