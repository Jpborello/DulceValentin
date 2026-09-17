import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processIncomingChatMessage } from '@/lib/whatsappBot';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Si falta la key en este entorno (deploy nuevo sin las variables cargadas
// todavia), no tiramos abajo el build entero del sitio por esta ruta sola.
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

// GET: el widget hace polling de los mensajes de su propia sesion (incluye
// respuestas del bot y del admin escritas desde el panel).
export async function GET(req) {
  try {
    if (!serviceRoleKey || serviceRoleKey.includes('COMPLETAR')) {
      return NextResponse.json({ success: true, messages: [] });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId || !sessionId.startsWith('web-')) {
      return NextResponse.json({ error: 'sessionId inválido' }, { status: 400 });
    }

    const { data: messages, error } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_phone', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, messages: messages || [] });
  } catch (err) {
    console.error('API GET WebChat Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: mensaje nuevo del visitante de la web. Usa la misma logica de bot
// (mismo prompt, catalogo y config) que WhatsApp, guardando todo en las
// mismas tablas para que aparezca en el inbox del admin.
export async function POST(req) {
  try {
    const body = await req.json();
    const { sessionId, clientName, message } = body;

    if (!sessionId || !sessionId.startsWith('web-') || !message) {
      return NextResponse.json({ error: 'Faltan parámetros sessionId o message' }, { status: 400 });
    }

    const { botReply, status } = await processIncomingChatMessage(supabaseAdmin, {
      chatId: sessionId,
      clientName: clientName || 'Visitante Web',
      messageText: message,
      channel: 'web'
    });

    return NextResponse.json({ success: true, bot_reply: botReply, status });
  } catch (err) {
    console.error('API POST WebChat Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
