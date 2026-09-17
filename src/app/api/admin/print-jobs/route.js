import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COMPANY_INFO } from '@/lib/companyInfo';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const agentSecret = process.env.PRINT_AGENT_SECRET;

// Si falta la key en este entorno (ej: un deploy nuevo de Vercel sin las
// variables de entorno cargadas todavia), no tiramos abajo el build entero
// del sitio por una sola ruta de admin — dejamos el cliente en null y cada
// handler de aca abajo (ya envuelto en try/catch) devuelve un 500 prolijo
// en vez de romper "npm run build" para TODO el sitio.
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

// El agente de impresion (programa aparte que corre en la PC del local, ver
// /print-agent) usa este secreto para autenticarse al consultar/actualizar
// la cola. Sin esto, cualquiera en internet podria ver los pedidos en cola
// o marcarlos como impresos sin haberlo hecho.
function isAgentAuthorized(request) {
  if (!agentSecret) return false;
  const provided = request.headers.get('x-agent-secret');
  return provided === agentSecret;
}

function buildTicketData(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  return {
    company: COMPANY_INFO.name.toUpperCase(),
    subtitle: 'COMANDA DE ARMADO Y DESPACHO',
    order_id: order.id,
    date: new Date(order.created_at || Date.now()).toLocaleString('es-AR'),
    sender: {
      name: COMPANY_INFO.name,
      address: COMPANY_INFO.address,
      locality: COMPANY_INFO.locality,
      province: COMPANY_INFO.province,
      postal_code: COMPANY_INFO.postalCode,
      phone: COMPANY_INFO.phone
    },
    client: {
      name: order.client_name || 'Sin nombre',
      dni: order.client_dni || 'Sin DNI',
      phone: order.client_phone || '',
      delivery_method: order.delivery_method || '',
      address: order.client_address || '',
      floor_apt: order.client_floor_apt || '',
      locality: order.client_locality || '',
      postal_code: order.client_postal_code || ''
    },
    items: items.map((item) => {
      const unitPrice = item.product?.wholesale_price || item.product?.price || 0;
      return {
        name: item.product?.name || 'Producto',
        code: item.product?.code || '',
        size: item.product?.selectedSize || item.selectedSize || '-',
        color: item.product?.selectedColor || item.selectedColor || 'Surtido',
        qty: item.quantity || 1,
        unit_price: unitPrice,
        subtotal: unitPrice * (item.quantity || 1)
      };
    }),
    total: order.total_amount || 0,
    discount_applied: order.discount_applied || 0,
    is_wholesale: !!order.is_wholesale,
    footer_checks: ['Control de Talles y Prendas', 'Bolsa / Embalaje', 'Despachado']
  };
}

// POST: el panel de admin encola un pedido para imprimirse en la impresora
// fisica del local (sin importar desde donde este conectado el admin).
export async function POST(req) {
  try {
    const body = await req.json();
    const { order_id, printer_target } = body;

    if (!order_id) {
      return NextResponse.json({ error: 'Falta order_id' }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const ticketData = buildTicketData(order);

    const { data, error } = await supabaseAdmin
      .from('print_jobs')
      .insert([{ order_id, printer_target: printer_target || null, ticket_data: ticketData, status: 'pending' }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, job: data });
  } catch (err) {
    console.error('API POST print-jobs Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: dos usos distintos segun quien pregunte.
//  - El agente (con el header x-agent-secret) pide los trabajos "pending"
//    para imprimirlos.
//  - El panel de admin (sin secreto) puede consultar el estado de un job
//    puntual por id, para mostrar "Impreso" / "Error" en pantalla.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('print_jobs')
        .select('id, status, error_message, printed_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ success: true, job: data });
    }

    if (!isAgentAuthorized(req)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('print_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;
    return NextResponse.json({ success: true, jobs: data || [] });
  } catch (err) {
    console.error('API GET print-jobs Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: el agente reporta el resultado de un trabajo (impreso o con error).
export async function PATCH(req) {
  try {
    if (!isAgentAuthorized(req)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, error_message } = body;

    if (!id || !['printing', 'printed', 'error'].includes(status)) {
      return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
    }

    const updates = { status, error_message: error_message || null };
    if (status === 'printed') updates.printed_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('print_jobs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, job: data });
  } catch (err) {
    console.error('API PATCH print-jobs Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
