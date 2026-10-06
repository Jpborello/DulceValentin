import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processIncomingChatMessage } from '@/lib/whatsappBot';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SG-JwsfgUZuPHN23twhBlw_QhaJmwL_';

const effectiveKey = (serviceRoleKey && !serviceRoleKey.includes('COMPLETAR')) ? serviceRoleKey : anonKey;
const supabaseAdmin = createClient(supabaseUrl, effectiveKey);

// La IA a veces tarda (catalogo grande + respuesta con varios productos).
// Con el limite por defecto de Vercel la funcion se cortaba y el cliente se
// quedaba sin respuesta. 60 s es el maximo del plan Hobby.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const GENERIC_NAMES = ['visitante web', 'visitante', 'cliente', 'cliente whatsapp'];
const MAX_MESSAGE_LENGTH = 1000;

// GET: el widget hace polling de los mensajes de su propia sesion (incluye
// respuestas del bot y del admin escritas desde el panel).
export async function GET(req) {
  try {

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

    // Para chatear hay que dejar el nombre (el widget lo pide antes de
    // habilitar el chat; esto es por si alguien llama a la API directo).
    const name = typeof clientName === 'string' ? clientName.trim().slice(0, 60) : '';
    if (name.length < 2 || GENERIC_NAMES.includes(name.toLowerCase())) {
      return NextResponse.json({ error: 'name_required' }, { status: 400 });
    }

    const { botReply, status } = await processIncomingChatMessage(supabaseAdmin, {
      chatId: sessionId,
      clientName: name,
      messageText: String(message).slice(0, MAX_MESSAGE_LENGTH),
      channel: 'web'
    });

    return NextResponse.json({ success: true, bot_reply: botReply, status });
  } catch (err) {
    console.error('API POST WebChat Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
