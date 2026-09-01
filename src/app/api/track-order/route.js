import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Solo digitos, para no depender de como este formateado el telefono
// (con espacios, guiones, +54, etc.) ni de pontos en el N de pedido.
const onlyDigits = (str) => (str || '').replace(/\D/g, '');

// Consulta publica de estado de un pedido por N de orden + telefono. Se pide
// el telefono ademas del ID (no alcanza con el ID solo) para que no cualquiera
// que adivine/comparta un numero de pedido pueda ver los datos de otro cliente.
export async function POST(req) {
  try {
    const body = await req.json();
    const orderId = (body.orderId || '').trim().toUpperCase();
    const phone = onlyDigits(body.phone);

    if (!orderId || phone.length < 6) {
      return NextResponse.json({ error: 'Ingresá el número de pedido y tu teléfono.' }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('id, status, created_at, delivery_method, client_locality, client_phone, total_amount, items')
      .eq('id', orderId)
      .maybeSingle();

    const orderPhone = onlyDigits(order?.client_phone);
    const matches = order && orderPhone && (orderPhone.endsWith(phone) || phone.endsWith(orderPhone));

    if (error || !matches) {
      // Mismo mensaje si no existe el pedido o si el telefono no matchea,
      // para no darle pistas a quien intente adivinar numeros de pedido ajenos.
      return NextResponse.json({ error: 'No encontramos un pedido con esos datos. Revisá el número de pedido y el teléfono.' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error('API track-order Error:', err);
    return NextResponse.json({ error: 'Ocurrió un error al buscar el pedido.' }, { status: 500 });
  }
}
