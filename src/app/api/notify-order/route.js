import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Aviso por Telegram de cada pedido nuevo que entra por la web.
//
// El carrito llama a esta ruta con el id del pedido recien guardado. La ruta
// NO confia en nada de lo que manda el navegador: vuelve a leer el pedido
// desde la base con la service role key, y solo avisa si el pedido existe,
// es de los ultimos 15 minutos y todavia no se aviso (columna
// telegram_notified_at). Asi nadie puede usar esta URL para mandar mensajes
// inventados ni repetir el aviso de un pedido viejo.
//
// Variables de entorno (en .env.local y en Vercel):
//   TELEGRAM_BOT_TOKEN  token del bot que da @BotFather
//   TELEGRAM_CHAT_ID    chat donde llegan los avisos (varios, separados por coma)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const SITE_URL = 'https://www.dulcevalentin.com.ar';
const MAX_AGE_MS = 15 * 60 * 1000;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const money = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

function buildMessage(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items.slice(0, 25).map((item) => {
    const p = item.product || {};
    const extras = [p.selectedSize && `talle ${p.selectedSize}`, p.selectedColor].filter(Boolean).join(', ');
    const unit = p.unit_price != null ? p.unit_price : p.wholesale_price;
    return `• ${item.quantity} x ${escapeHtml(p.name || 'Producto')}${extras ? ` (${escapeHtml(extras)})` : ''}${unit ? ` — ${money(unit * item.quantity)}` : ''}`;
  });
  if (items.length > 25) itemLines.push(`… y ${items.length - 25} artículos más`);

  const lines = [
    '🛍️ <b>Nueva venta en la web</b>',
    `Pedido <b>${escapeHtml(order.id)}</b>`,
    '',
    `👤 ${escapeHtml(order.client_name)}`,
    `📱 ${escapeHtml(order.client_phone)}`,
    order.client_locality ? `📍 ${escapeHtml(order.client_locality)}` : null,
    order.delivery_method ? `🚚 ${escapeHtml(order.delivery_method)}` : null,
    '',
    ...itemLines,
    '',
    Number(order.discount_applied) > 0 ? `🎟️ Descuento: -${money(order.discount_applied)}` : null,
    `💰 <b>Total: ${money(order.total_amount)}</b>`,
    order.receipt_url ? '🧾 Comprobante adjuntado' : '🧾 Comprobante pendiente'
  ];

  if (order.stock_issue) {
    const detail = Array.isArray(order.stock_issue_detail)
      ? order.stock_issue_detail.map((i) => escapeHtml(i.name)).join(', ')
      : '';
    lines.push('', `⚠️ <b>Sin stock suficiente</b>${detail ? `: ${detail}` : ''}`);
  }

  lines.push('', `Ver en el panel: ${SITE_URL}/admin`);
  return lines.filter((l) => l !== null).join('\n');
}

export async function POST(req) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Sin configurar no es un error del cliente: el pedido ya se guardo.
  if (!token || chatIds.length === 0 || !supabaseAdmin) {
    return NextResponse.json({ success: false, skipped: 'telegram_no_configurado' });
  }

  let orderId = '';
  try {
    const body = await req.json();
    orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
  } catch (e) {}
  if (!/^ORD-\d{4,12}$/.test(orderId)) {
    return NextResponse.json({ error: 'orderId inválido' }, { status: 400 });
  }

  // Reserva el aviso de forma atomica: solo una llamada puede pasar de
  // "sin avisar" a "avisado", aunque el navegador reintente.
  const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString();
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from('orders')
    .update({ telegram_notified_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('telegram_notified_at', null)
    .gte('created_at', cutoff)
    .select('*');

  if (claimErr) {
    console.error('notify-order: error leyendo el pedido', claimErr);
    return NextResponse.json({ error: 'No se pudo leer el pedido' }, { status: 500 });
  }
  const order = claimed?.[0];
  if (!order) {
    return NextResponse.json({ success: false, skipped: 'ya_avisado_o_inexistente' });
  }

  const text = buildMessage(order);
  let sentAny = false;
  for (const chatId of chatIds) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
      });
      if (res.ok) sentAny = true;
      else console.error('notify-order: Telegram respondió', res.status, await res.text());
    } catch (err) {
      console.error('notify-order: error llamando a Telegram', err);
    }
  }

  // Si no salio ningun mensaje, se libera la marca para poder reintentar.
  if (!sentAny) {
    await supabaseAdmin.from('orders').update({ telegram_notified_at: null }).eq('id', orderId);
    return NextResponse.json({ success: false, error: 'telegram_fallo' }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
