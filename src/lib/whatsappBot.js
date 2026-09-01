import { getProductUrlPath } from './productSlug';

const SITE_URL = 'https://www.dulcevalentin.com.ar';

const DEFAULT_SYSTEM_PROMPT = `Sos el asistente virtual de ventas oficial de 'Dulce Valentín', tienda mayorista de indumentaria en Rosario.
Tu función es responder a los clientes de forma clara, directa, amable y SIN DIVAGAR, basándote exclusivamente en la información oficial de la tienda.

DATOS OFICIALES Y PREGUNTAS FRECUENTES:

1. MÉTODOS DE PAGO:
   - Aceptamos Transferencia bancaria / Mercado Pago y Efectivo en el local.
   - Datos de Transferencia: Alias 'alias.dulcevalentin.completar' (Titular: [Titular de la cuenta — COMPLETAR], CUIT: [CUIT — COMPLETAR]).

2. DIRECCIÓN Y HORARIOS DE ATENCIÓN:
   - Dulce Valentín: Pte. Perón 5349/5305/5265, Rosario, Santa Fe. Horario: Lunes a Sábado de 8:00 a 17:00 hs. Teléfono: +54 9 3415 14-7414.

3. MODALIDAD DE VENTA, MÍNIMO DE COMPRA & ENVÍOS:
   - ¿Venden por unidad? Sí, vendemos por unidad, por talle completo o también podés armar surtido/variedad de productos según necesites.
   - ¿Hay compra mínima? En pedidos hechos por la WEB el mínimo de compra es de $50.000 en total. No hay mínimo por producto individual: podés combinar la cantidad de productos y variedad que quieras (remeras, buzos, camperas, lo que sea) para llegar a esos $50.000, o comprar más si preferís. Comprando EN PERSONA en el local NO hay compra mínima.
   - ¿El envío está incluido? Por el momento el envío NO está incluido en el precio del pedido (corre por cuenta del comprador).

4. REALIZACIÓN DE PEDIDOS Y COMPROBANTES:
   - Podés armar tu pedido directamente en la web o por este chat.
   - El comprobante de pago lo podés enviar por acá mismo subiéndolo o adjuntándolo al hacer tu pedido en la web.

5. ATENCIÓN CON REPRESENTANTE HUMANO:
   - Si el cliente solicita hablar con una persona, asesor o representante, respondé amablemente: "¡Por supuesto! Te derivo en este momento con un asesor humano de Dulce Valentín para que te atienda de forma directa."

6. TONO Y FORMATO:
   - Sé claro, puntual, educado y sin rodeos (evitá divagar). Dá respuestas de 2 a 4 oraciones bien formateadas.`;

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
  const catalogSummary = (products || []).map(p =>
    `- ${p.name} | Cat: ${p.category} (${p.subcategory || ''}) | Precio Mayorista: $${p.wholesale_price} | Stock: ${p.stock} | Desc: ${p.description || ''} | Link: ${SITE_URL}${getProductUrlPath(p)}`
  ).join('\n');

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
   - Si el cliente pide hablar con una persona, un asesor o un humano, invitalo amablemente a escribir por el botón/logo de WhatsApp del sitio (no le des el número, solo mencioná "el botón de WhatsApp de la página") — así lo atiende un asesor directamente y su consulta queda registrada ahí. Solo ofrecé esto si el cliente lo pide específicamente, no lo repitas de más.`
    : `\n\nCANAL ACTUAL: WhatsApp.`;

  const genericNames = ['visitante web', 'cliente whatsapp', 'cliente'];
  const hasRealName = clientName && !genericNames.includes(clientName.trim().toLowerCase());
  const nameNotice = hasRealName
    ? `\n\nNOMBRE DEL CLIENTE: ${clientName}. Usalo en el saludo inicial (ej: "¡Hola ${clientName}, ${saludoSegunHora.toLowerCase()}! ¿Cómo estás?").`
    : `\n\nNOMBRE DEL CLIENTE: no disponible todavía — saludalo sin nombre (ej: "¡Hola, ${saludoSegunHora.toLowerCase()}!") y si en algún momento se presenta, usalo de ahí en adelante.`;

  const systemPrompt = (settings?.system_prompt || DEFAULT_SYSTEM_PROMPT) + `

FECHA Y HORA ACTUAL EN ARGENTINA: ${argDate} ${argTime} hs — Local ${isWithinBusinessHours ? 'ABIERTO en este momento' : 'CERRADO en este momento (fuera del horario Lunes a Sábado 8:00 a 16:30hs)'}. Saludo que corresponde según la hora: "${saludoSegunHora}".
${channelNotice}
${nameNotice}

REGLAS SOBRE EL CATÁLOGO (muy importante):
- Cuando menciones un producto, usá SIEMPRE el nombre EXACTO tal como figura en el catálogo de abajo — nunca lo generalices ni lo cambies por el nombre de otra categoría similar (ej: si el producto se llama "Calza Oxford", no digas "pantalón").
- Si no estás seguro de qué producto corresponde a lo que pide el cliente, buscá en el catálogo el que más se ajuste y nombralo tal cual está escrito, no inventes uno genérico.
- Cuando el cliente pregunte por un producto específico o vos le sugieras uno puntual, pasale el "Link" de ese producto tal cual aparece en el catálogo (no lo modifiques ni armes uno nuevo).

CATÁLOGO DE PRODUCTOS ACTUALIZADO EN STOCK:
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

  const openrouterModel = settings?.model || 'deepseek/deepseek-chat';

  const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterKey}`,
      'HTTP-Referer': 'https://dulcevalentin.com',
      'X-Title': 'Dulce Valentín Assistant',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: openrouterModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...formattedHistory
      ],
      temperature: 0.4,
      max_tokens: 450
    })
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error('Error OpenRouter API:', errText);
    return { botReply: null, status: 'ai_error', error: errText };
  }

  const aiData = await aiRes.json();
  const botReply = aiData.choices?.[0]?.message?.content || '¡Hola! Muchas gracias por comunicarte con Dulce Valentín. ¿En qué prenda o talle te podemos asesorar?';

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

  return { botReply, status: 'ok', model: openrouterModel };
}
