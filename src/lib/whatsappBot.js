import { getProductUrlPath } from './productSlug.js';

const SITE_URL = 'https://www.dulcevalentin.com.ar';

const DEFAULT_SYSTEM_PROMPT = `Sos el asistente virtual de ventas oficial de 'Dulce Valentín', tienda mayorista de indumentaria en Rosario.
Tu función es responder a los clientes de forma clara, directa, amable y SIN DIVAGAR, basándote exclusivamente en la información oficial de la tienda.

DATOS OFICIALES Y PREGUNTAS FRECUENTES:

1. MÉTODOS DE PAGO:
   - Aceptamos Transferencia bancaria / Mercado Pago y Efectivo en el local.
   - Datos de Transferencia: Alias 'alias.dulcevalentin.completar' (Titular: [Titular de la cuenta — COMPLETAR], CUIT: [CUIT — COMPLETAR]).

2. DIRECCIÓN Y HORARIOS DE ATENCIÓN:
   - Dulce Valentín: Pte. Perón 5349/5305/5265, Rosario, Santa Fe. Horario: Lunes a Sábado de 8:00 a 17:00 hs. Teléfono / WhatsApp oficial de atención y comprobantes: +54 9 341 264-8035 (3412648035).

3. MODALIDAD DE VENTA, MÍNIMO DE COMPRA & ENVÍOS:
   - ¿Venden por unidad? Sí, vendemos por unidad, por talle completo o también podés armar surtido/variedad de productos según necesites.
   - ¿Hay compra mínima? No hay un monto mínimo. En pedidos por la WEB, el primer artículo tiene que ser de 3 unidades o más (salvo medias y productos en pack) y después podés sumar el resto por unidad, combinando los productos que quieras. Comprando EN PERSONA en el local NO hay compra mínima.
   - ¿El envío está incluido? Por el momento el envío NO está incluido en el precio del pedido (corre por cuenta del comprador).

4. REALIZACIÓN DE PEDIDOS Y COMPROBANTES:
   - Podés armar tu pedido directamente en la web o por este chat.
   - El comprobante de pago de tu pedido lo podés enviar directamente al WhatsApp oficial de vendedores: 3412648035 (o tocando el botón de WhatsApp en la pantalla), o adjuntarlo al finalizar tu pedido en la web.

5. ATENCIÓN CON REPRESENTANTE HUMANO / VENDEDORES:
   - Si el cliente solicita hablar con una persona, vendedor o asesor, respondé amablemente: "¡Por supuesto! Podés comunicarte directamente con nuestros vendedores por WhatsApp tocando el logo de WhatsApp en pantalla o escribiendo al 3412648035 para que te atiendan de forma directa y puedas enviar tu comprobante."

6. TONO Y FORMATO:
   - Sé claro, puntual, educado y sin rodeos (evitá divagar). Dá respuestas de 2 a 4 oraciones bien formateadas.`;

// Busca un telefono argentino dentro del texto del cliente (con o sin +54,
// 9, 0, 15, espacios o guiones). Devuelve solo los digitos, o null.
export function extractPhone(text) {
  if (!text) return null;
  const candidates = String(text).match(/\+?\d[\d\s().-]{6,20}\d/g) || [];
  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 13) return digits;
  }
  return null;
}

// Llamada a OpenRouter con tiempo limite y un reintento, para que un corte
// momentaneo de la IA no deje al cliente sin respuesta.
async function callOpenRouter(payload, apiKey) {
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://dulcevalentin.com',
          'X-Title': 'Dulce Valentín Assistant',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && content.trim()) return { ok: true, content };
        lastError = 'respuesta vacía';
      } else {
        lastError = `${res.status} ${await res.text()}`;
        if (res.status < 500 && res.status !== 429) break; // error de config: no reintentar
      }
    } catch (err) {
      lastError = err?.name === 'AbortError' ? 'timeout' : String(err?.message || err);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, error: lastError };
}

const FALLBACK_REPLY = 'Perdón, tuve un problema para responderte recién. ¿Me repetís la consulta? Si preferís, también podés escribirnos al WhatsApp 3412648035 y te atiende un vendedor.';

// Procesa un mensaje entrante de CUALQUIER canal (WhatsApp o Chat Web) contra
// las mismas tablas whatsapp_chats/whatsapp_messages, para que el admin vea
// y responda todo desde un unico inbox sin importar de donde vino.
export async function processIncomingChatMessage(supabaseAdmin, { chatId, clientName, messageText, channel, mediaUrl, messageType }) {
  const timestamp = new Date().toISOString();

  const { data: existingChat } = await supabaseAdmin
    .from('whatsapp_chats')
    .select('*')
    .eq('phone', chatId)
    .maybeSingle();

  const isBotEnabledForChat = existingChat ? existingChat.bot_enabled !== false : true;
  // Si el cliente escribio un telefono, se guarda para que el vendedor lo vea
  // en el panel (columna contact_phone).
  const detectedPhone = extractPhone(messageText);
  const contactPhone = detectedPhone || existingChat?.contact_phone || null;
  const currentUnread = (existingChat?.unread_count || 0) + 1;
  const mediaLabels = { image: '📷 Imagen', video: '🎥 Video', audio: '🎤 Audio', document: '📎 Documento', sticker: '💬 Sticker' };
  const previewMessage = messageText || (mediaUrl ? mediaLabels[messageType] || '📎 Archivo' : messageText);

  await supabaseAdmin.from('whatsapp_messages').insert([{
    id: crypto.randomUUID(),
    chat_phone: chatId,
    sender: 'client',
    content: messageText || '',
    media_url: mediaUrl || null,
    message_type: messageType || 'text',
    created_at: timestamp
  }]);

  await supabaseAdmin.from('whatsapp_chats').upsert([{
    phone: chatId,
    client_name: clientName,
    channel: existingChat?.channel || channel,
    last_message: previewMessage,
    unread_count: currentUnread,
    bot_enabled: isBotEnabledForChat,
    contact_phone: contactPhone,
    updated_at: timestamp
  }], { onConflict: 'phone' });

  // El bot es de solo texto: si llega un archivo sin texto que lo acompañe,
  // no tiene nada para interpretar, así que lo dejamos para que lo vea un
  // humano en vez de generar una respuesta inventada.
  if (mediaUrl && !messageText) {
    return { botReply: null, status: 'media_manual' };
  }

  const { data: settings } = await supabaseAdmin
    .from('whatsapp_bot_settings')
    .select('*')
    .eq('id', 'main')
    .maybeSingle();

  const globalEnabled = settings ? settings.is_global_enabled !== false : true;
  const openrouterKey = process.env.OPENROUTER_API_KEY || settings?.openrouter_key;

  if (!globalEnabled || !isBotEnabledForChat || !openrouterKey) {
    return { botReply: null, status: 'disabled_or_no_key' };
  }

  const { data: products } = await supabaseAdmin.from('products').select('*').gt('stock', 0);
  const catalogSummary = (products || []).map(p => {
    const productUrl = `${SITE_URL}${getProductUrlPath(p)}`;
    return `- [${p.name}](${productUrl}) | Categoría: ${p.category} (${p.subcategory || ''}) | Precio: $${Number(p.wholesale_price || 0).toLocaleString('es-AR')} | Stock: ${p.stock}`;
  }).join('\n');

  const nowInArgentina = new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false });
  const [argDate, argTime] = nowInArgentina.split(' ');
  const argWeekday = new Date(nowInArgentina.replace(' ', 'T')).getDay(); // 0=domingo..6=sabado
  const [argHour, argMinute] = argTime.split(':').map(Number);
  const minutesNow = argHour * 60 + argMinute;
  const isWithinBusinessDays = argWeekday >= 1 && argWeekday <= 6; // lunes a sabado
  const isWithinBusinessHours = isWithinBusinessDays && minutesNow >= 8 * 60 && minutesNow <= 16 * 60 + 30;
  const saludoSegunHora = argHour < 12 ? 'Buen día' : argHour < 20 ? 'Buenas tardes' : 'Buenas noches';

  const channelNotice = channel === 'web'
    ? `\n\nCANAL ACTUAL: Chat web del sitio.
   - Si el cliente pide hablar con una persona, un asesor o un humano, invitalo amablemente a escribir por el botón de WhatsApp del sitio (al número 3412648035) — así lo atiende un asesor directamente.`
    : `\n\nCANAL ACTUAL: WhatsApp.`;

  const genericNames = ['visitante web', 'cliente whatsapp', 'cliente'];
  const hasRealName = clientName && !genericNames.includes(clientName.trim().toLowerCase());
  const nameNotice = hasRealName
    ? `\n\nNOMBRE DEL CLIENTE: ${clientName}. Usalo en el saludo inicial (ej: "¡Hola ${clientName}, ${saludoSegunHora.toLowerCase()}! ¿Cómo estás?").`
    : `\n\nNOMBRE DEL CLIENTE: no disponible todavía — saludalo sin nombre (ej: "¡Hola, ${saludoSegunHora.toLowerCase()}!") y si en algún momento se presenta, usalo de ahí en adelante.`;

  const phoneNotice = contactPhone
    ? `\n\nTELÉFONO DE CONTACTO: el cliente ya dejó su número (${contactPhone}). NO se lo vuelvas a pedir. Si corresponde, confirmale que un vendedor lo va a contactar por WhatsApp a ese número.`
    : `\n\nTELÉFONO DE CONTACTO: el cliente todavía no dejó su número.
   - Pedíselo SOLO cuando sea pertinente: cuando quiere hacer, confirmar o reservar un pedido; cuando pide que un vendedor lo contacte o quiere hablar con una persona; cuando consulta el costo o la forma de envío a su localidad; cuando pide una cotización por cantidad o algo que vos no podés resolver.
   - NO lo pidas en consultas generales (horarios, dirección, medios de pago, compra mínima, ver productos o precios).
   - Pedilo una sola vez, en una frase corta y explicando para qué: "¿Me dejás tu número de WhatsApp así un vendedor te contacta para cerrar el pedido?". Si no lo quiere dar, seguí ayudándolo igual sin insistir.`;

  const systemPrompt = (settings?.system_prompt || DEFAULT_SYSTEM_PROMPT) + `

FECHA Y HORA ACTUAL EN ARGENTINA: ${argDate} ${argTime} hs — Local ${isWithinBusinessHours ? 'ABIERTO en este momento' : 'CERRADO en este momento (fuera del horario Lunes a Sábado 8:00 a 16:30hs)'}. Saludo que corresponde según la hora: "${saludoSegunHora}".
${channelNotice}
${nameNotice}
${phoneNotice}

REGLAS ESTRICTAS DE PRODUCTOS Y ENLACES (OBLIGATORIAS):
1. NO DIVAGAR Y SER DIRECTO:
   - Dá respuestas puntuales, cortas y bien estructuradas (máximo 2 a 4 oraciones, o una lista concisa de 2 a 4 productos sugeridos).
   - NUNCA uses frases de relleno vacías como "Podés explorar todos los productos en los links que te envié" a menos que en ese mismo mensaje hayas puesto los links correspondientes.
2. VERIFICACIÓN ESTRICTA EN BASE DE DATOS (PROHIBIDO INVENTAR):
   - Toda información sobre productos (nombres, categorías, precios y stock) DEBE provenir EXCLUSIVAMENTE del "CATÁLOGO DE PRODUCTOS EN STOCK" que figura más abajo.
   - NUNCA inventes marcas (Nike, Adidas, etc.), modelos ni precios que no figuren en la lista. Si el cliente busca algo que no está en el catálogo, decí con total honestidad: "Actualmente no disponemos de ese artículo en stock." y sugerí 1 o 2 opciones reales que sí tengamos en el catálogo.
3. ENLACES CLICKEABLES OBLIGATORIOS (FORMATO MARKDOWN):
   - Cada vez que menciones un producto del catálogo, DEBES hacerlo SIEMPRE con el enlace Markdown exacto que ya viene entre corchetes en el catálogo:
     • [Nombre del Producto](URL_DEL_PRODUCTO) - $Precio
     Ejemplo:
     • [Boxer uomo de niño](https://www.dulcevalentin.com.ar/producto/p-0131-boxer-uomo-de-nino) - $2.000 (Stock: 50)
   - NUNCA pongas enlaces en texto plano ni nombres productos sin su enlace clickeable.

CATÁLOGO DE PRODUCTOS EN STOCK (CONSULTÁ SIEMPRE ACÁ):
${catalogSummary}
`;

  const { data: history } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('*')
    .eq('chat_phone', chatId)
    .order('created_at', { ascending: false })
    .limit(6);

  const formattedHistory = (history || []).reverse().map(m => ({
    role: m.sender === 'client' ? 'user' : 'assistant',
    content: m.content
  }));

  const openrouterModel = process.env.OPENROUTER_MODEL || settings?.model || 'deepseek/deepseek-chat';

  const ai = await callOpenRouter({
    model: openrouterModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...formattedHistory
    ],
    temperature: 0.4,
    max_tokens: 450
  }, openrouterKey);

  let botReply;
  let status = 'ok';
  if (ai.ok) {
    botReply = ai.content;
  } else {
    console.error('Error OpenRouter API:', ai.error);
    // En la web el cliente esta mirando la pantalla esperando: mejor una
    // disculpa con salida a WhatsApp que el silencio.
    if (channel !== 'web') {
      return { botReply: null, status: 'ai_error', error: ai.error };
    }
    botReply = FALLBACK_REPLY;
    status = 'ai_error_fallback';
  }

  const botTimestamp = new Date().toISOString();

  await supabaseAdmin.from('whatsapp_messages').insert([{
    id: crypto.randomUUID(),
    chat_phone: chatId,
    sender: 'bot',
    content: botReply,
    created_at: botTimestamp
  }]);

  await supabaseAdmin.from('whatsapp_chats').upsert([{
    phone: chatId,
    last_message: botReply,
    updated_at: botTimestamp
  }], { onConflict: 'phone' });

  return { botReply, status, model: openrouterModel };
}
