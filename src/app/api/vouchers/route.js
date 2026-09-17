import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/phoneUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Si falta la key en este entorno (deploy nuevo sin las variables cargadas
// todavia), no tiramos abajo el build entero del sitio por esta ruta sola.
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

// GET: el checkout consulta si el telefono que se esta tipeando tiene un
// baucher activo, para mostrarlo y descontarlo del total automaticamente.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const normalized = normalizePhone(phone);

    if (!normalized || normalized.length < 8) {
      return NextResponse.json({ voucher: null });
    }

    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .select('id, amount, reason')
      .eq('phone_normalized', normalized)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ voucher: data || null });
  } catch (err) {
    console.error('API GET vouchers Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: se llama justo despues de crear el pedido, para marcar el baucher
// como usado y que no se pueda aplicar dos veces. Vuelve a verificar que
// siga activo (por si dos pedidos del mismo telefono se mandan casi juntos).
export async function POST(req) {
  try {
    const body = await req.json();
    const { voucher_id, order_id } = body;

    if (!voucher_id || !order_id) {
      return NextResponse.json({ error: 'Faltan voucher_id u order_id' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .update({ status: 'redeemed', redeemed_order_id: order_id, redeemed_at: new Date().toISOString() })
      .eq('id', voucher_id)
      .eq('status', 'active')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'El baucher ya no está disponible' }, { status: 409 });
    }

    return NextResponse.json({ success: true, voucher: data });
  } catch (err) {
    console.error('API POST vouchers Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
