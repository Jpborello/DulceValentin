import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/phoneUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);

// Club Mayorista (login solo con WhatsApp). Antes el navegador llamaba
// directo a funciones SQL publicas que devolvian nombre + DNI + localidad de
// cualquier telefono. Ahora pasa por aca y NUNCA se devuelve el DNI: el
// checkout lo completa en el servidor (/api/orders) para clientes conocidos.
//
//   { action: 'lookup', phone }                      -> { client: { name, locality } | null }
//   { action: 'register', phone, name, dni, locality } -> { client: { name, locality } }
//   { action: 'tickets', phone }                     -> { count }
export async function POST(req) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Servicio no disponible.' }, { status: 503 });

  try {
    const body = await req.json();
    const phone = normalizePhone(body.phone);
    if (phone.length < 8) {
      return NextResponse.json({ error: 'Ingresá un número de WhatsApp válido.' }, { status: 400 });
    }

    if (body.action === 'lookup') {
      const { data } = await supabaseAdmin
        .from('wholesale_clients')
        .select('name, locality')
        .eq('phone', phone)
        .maybeSingle();
      return NextResponse.json({ client: data || null });
    }

    if (body.action === 'register') {
      const name = clean(body.name);
      const dni = clean(body.dni, 30);
      const locality = clean(body.locality, 120);
      if (!name || !dni || !locality) {
        return NextResponse.json({ error: 'Completá Nombre, DNI y Localidad.' }, { status: 400 });
      }
      // No se pisa una cuenta existente desde un formulario publico: si el
      // telefono ya esta registrado, se devuelve la cuenta tal cual.
      const { data: existing } = await supabaseAdmin
        .from('wholesale_clients')
        .select('name, locality')
        .eq('phone', phone)
        .maybeSingle();
      if (existing) return NextResponse.json({ client: existing });

      const { error } = await supabaseAdmin.rpc('upsert_wholesale_client', {
        p_name: name,
        p_dni: dni,
        p_phone: phone,
        p_locality: locality,
        p_password: 'sinclave-' + phone.slice(-4)
      });
      if (error) throw error;
      return NextResponse.json({ client: { name, locality } });
    }

    if (body.action === 'tickets') {
      const { count } = await supabaseAdmin
        .from('raffle_tickets')
        .select('ticket_number', { count: 'exact', head: true })
        .eq('client_phone', phone);
      return NextResponse.json({ count: count || 0 });
    }

    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  } catch (err) {
    console.error('API club Error:', err);
    return NextResponse.json({ error: 'Ocurrió un error. Probá de nuevo.' }, { status: 500 });
  }
}
