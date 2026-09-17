import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/phoneUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Si falta la key en este entorno (deploy nuevo sin las variables cargadas
// todavia), no tiramos abajo el build entero del sitio por esta ruta sola.
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

// POST: el admin otorga un baucher (ej: producto faltante en un pedido),
// atado al telefono del cliente. Le sirva o no la proxima vez que compre,
// registrado o no, porque el telefono siempre se carga en el checkout.
export async function POST(req) {
  try {
    const body = await req.json();
    const { phone, amount, reason, source_order_id } = body;

    const normalized = normalizePhone(phone);
    const numericAmount = Number(amount);

    if (!normalized || normalized.length < 8) {
      return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 });
    }
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json({ error: 'El monto tiene que ser mayor a 0' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .insert([{
        phone,
        phone_normalized: normalized,
        amount: numericAmount,
        reason: reason || null,
        source_order_id: source_order_id || null,
        status: 'active'
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, voucher: data });
  } catch (err) {
    console.error('API POST admin/vouchers Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: lista de baucheres (activos primero) para verlos en el panel.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .select('*')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return NextResponse.json({ success: true, vouchers: data || [] });
  } catch (err) {
    console.error('API GET admin/vouchers Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
