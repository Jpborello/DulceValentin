import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/phoneUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Si falta la key en este entorno (deploy nuevo sin las variables cargadas
// todavia), no tiramos abajo el build entero del sitio por esta ruta sola.
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

// GET: el checkout consulta si el telefono que se esta tipeando tiene un
// baucher activo, para mostrarlo y descontarlo del total. Solo devuelve el
// monto: el canje lo hace /api/orders al crear el pedido (antes habia un POST
// publico que marcaba cualquier baucher como usado sabiendo su id).
export async function GET(req) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ voucher: null });

    const { searchParams } = new URL(req.url);
    const normalized = normalizePhone(searchParams.get('phone'));

    if (!normalized || normalized.length < 8) {
      return NextResponse.json({ voucher: null });
    }

    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .select('amount')
      .eq('phone_normalized', normalized)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ voucher: data ? { amount: Number(data.amount) } : null });
  } catch (err) {
    console.error('API GET vouchers Error:', err);
    return NextResponse.json({ voucher: null });
  }
}
