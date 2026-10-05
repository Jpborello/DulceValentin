'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { renderMessageWithLinks } from '@/lib/chatLinks';
import {
  MessageSquare,
  Send,
  Bot,
  UserCheck,
  Search,
  Settings,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
  ArrowLeft,
  Trash2,
  Paperclip,
  Eye,
  EyeOff
} from 'lucide-react';

export default function WhatsAppTab() {
  const [chats, setChats] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('deepseek/deepseek-chat');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isGlobalEnabled, setIsGlobalEnabled] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const messagesEndRef = useRef(null);

  // Sound alert for new incoming messages
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const prevUnreadRef = useRef(0);
  const lastMsgIdRef = useRef(null);

  useEffect(() => {
    soundEnabledRef.current = isSoundEnabled;
  }, [isSoundEnabled]);

  const playNotificationSound = () => {
    if (!soundEnabledRef.current) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      [880, 1108].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.15 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.3);
      });
      setTimeout(() => ctx.close(), 700);
    } catch (e) {}
  };

  // Cargar lista de chats y settings al montar
  useEffect(() => {
    fetchChats();
    fetchSettings();
  }, []);

  // Polling de respaldo cada 8 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchChats(true);
      if (selectedPhone) fetchMessages(selectedPhone, true);
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedPhone]);

  const selectedPhoneRef = useRef(selectedPhone);
  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  // Suscripción Realtime a mensajes de Supabase (se monta una sola vez)
  useEffect(() => {
    if (!supabase) return;
    const channelName = 'whatsapp-realtime-' + Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          fetchChats(true);
          const currentPhone = selectedPhoneRef.current;
          if (currentPhone && (payload.new?.chat_phone === currentPhone || payload.old?.chat_phone === currentPhone)) {
            fetchMessages(currentPhone, true);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_chats' },
        () => {
          fetchChats(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const lastScrolledIdRef = useRef(null);
  const justSwitchedChatRef = useRef(false);
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.id !== lastScrolledIdRef.current) {
      lastScrolledIdRef.current = lastMsg.id;
      const behavior = justSwitchedChatRef.current ? 'auto' : 'smooth';
      justSwitchedChatRef.current = false;
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    }
  }, [messages]);

  const fetchChats = async (isBackground = false) => {
    if (!isBackground) setIsLoadingChats(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (Array.isArray(data)) {
        const newUnreadTotal = data.reduce((sum, c) => sum + (c.unread_count || 0), 0);
        if (isBackground && newUnreadTotal > prevUnreadRef.current) {
          playNotificationSound();
        }
        prevUnreadRef.current = newUnreadTotal;
        setChats(data);
        if (!selectedPhone && data.length > 0) {
          setSelectedPhone(data[0].phone);
          fetchMessages(data[0].phone);
        }
      }
    } catch (e) {
      console.warn('Error al cargar chats de Supabase:', e);
    } finally {
      if (!isBackground) setIsLoadingChats(false);
    }
  };

  const fetchMessages = async (phone, isBackground = false) => {
    if (!phone) return;
    if (!isBackground) setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('chat_phone', phone)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (Array.isArray(data)) {
        if (data.length > 0) {
          const lastMsg = data[data.length - 1];
          if (isBackground && lastMsg.id !== lastMsgIdRef.current && lastMsg.sender === 'client') {
            playNotificationSound();
          }
          lastMsgIdRef.current = lastMsg.id;
        }
        setMessages(data);
      }

      // Marcar como leído
      await supabase
        .from('whatsapp_chats')
        .update({ unread_count: 0 })
        .eq('phone', phone);

      setChats(prev => prev.map(c => c.phone === phone ? { ...c, unread_count: 0 } : c));
    } catch (e) {
      console.warn('Error al cargar mensajes:', e);
    } finally {
      if (!isBackground) setIsLoadingMessages(false);
    }
  };

  const defaultSystemPrompt = `Sos el asistente virtual de ventas oficial de 'Dulce Valentín', tienda mayorista de indumentaria en Rosario.
Tu función es responder a los clientes de forma clara, directa, amable y SIN DIVAGAR, basándote exclusivamente en la información oficial de la tienda.

DATOS OFICIALES Y PREGUNTAS FRECUENTES:

1. MÉTODOS DE PAGO:
   - Aceptamos Transferencia bancaria / Mercado Pago y Efectivo en el local.
   - Datos de Transferencia: Alias 'alias.dulcevalentin.completar' (Titular: [Titular de la cuenta — COMPLETAR], CUIT: [CUIT — COMPLETAR]).

2. DIRECCIÓN, HORARIOS Y CONTACTO:
   - Dulce Valentín: Pte. Perón 5349/5305/5265, Rosario, Santa Fe. Horario: Lunes a Sábado de 8:00 a 17:00 hs. Teléfono / WhatsApp oficial: +54 9 341 264-8035 (3412648035).

3. MODALIDAD DE VENTA, MÍNIMO DE COMPRA & ENVÍOS:
   - ¿Venden por unidad? Sí, vendemos por unidad, por talle completo o también podés armar surtido/variedad de productos según necesites.
   - ¿Hay compra mínima? No hay un monto mínimo. En pedidos por la WEB, el primer artículo tiene que ser de 3 unidades o más (salvo medias y productos en pack) y después podés sumar el resto por unidad, combinando los productos que quieras. Comprando EN PERSONA en el local NO hay compra mínima.
   - ¿El envío está incluido? Por el momento el envío NO está incluido en el precio del pedido (corre por cuenta del comprador).

4. REALIZACIÓN DE PEDIDOS Y COMPROBANTES:
   - Podés armar tu pedido directamente en la web o por este chat.
   - El comprobante de pago lo podés enviar directamente al WhatsApp oficial 3412648035 o adjuntarlo al finalizar tu pedido en la web.

5. ATENCIÓN CON REPRESENTANTE HUMANO:
   - Si el cliente solicita hablar con una persona, vendedor o asesor, respondé amablemente: "¡Por supuesto! Podés comunicarte directamente con nuestros vendedores por WhatsApp al 3412648035 o tocando el botón de WhatsApp del sitio."

6. TONO Y FORMATO:
   - Sé claro, puntual, educado y sin rodeos (evitá divagar). Dá respuestas de 2 a 4 oraciones bien formateadas.`;

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('whatsapp_bot_settings')
        .select('*')
        .eq('id', 'main')
        .maybeSingle();

      if (data) {
        setOpenrouterKey(data.openrouter_key || '');
        setSelectedModel(data.model || 'deepseek/deepseek-chat');
        setSystemPrompt(data.system_prompt || defaultSystemPrompt);
        setIsGlobalEnabled(data.is_global_enabled !== false);
      } else {
        setSystemPrompt(defaultSystemPrompt);
      }
    } catch (e) {
      console.warn('Error al cargar configuración de bot:', e);
    }
  };

  const handleSelectChat = (phone) => {
    setSelectedPhone(phone);
    lastScrolledIdRef.current = null;
    justSwitchedChatRef.current = true;
    fetchMessages(phone);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedPhone) return;

    const textToSend = inputText.trim();
    setInputText('');

    const tempMsg = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      chat_phone: selectedPhone,
      sender: 'admin',
      content: textToSend,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await supabase.from('whatsapp_messages').insert([tempMsg]);
      await supabase.from('whatsapp_chats').upsert([{
        phone: selectedPhone,
        last_message: textToSend,
        unread_count: 0,
        updated_at: new Date().toISOString()
      }], { onConflict: 'phone' });

      fetchMessages(selectedPhone, true);
      fetchChats(true);
    } catch (e) {
      console.warn('Error al enviar mensaje:', e);
    }
  };

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const handleAttachImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedPhone) return;

    setIsUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `whatsapp_media/admin_${selectedPhone}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('Productos').upload(filePath, file, { contentType: file.type, upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('Productos').getPublicUrl(filePath);
      const imageUrl = urlData.publicUrl;

      const msgObj = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        chat_phone: selectedPhone,
        sender: 'admin',
        content: inputText.trim() || '',
        media_url: imageUrl,
        message_type: 'image',
        created_at: new Date().toISOString()
      };

      await supabase.from('whatsapp_messages').insert([msgObj]);
      await supabase.from('whatsapp_chats').upsert([{
        phone: selectedPhone,
        last_message: msgObj.content || '📷 Imagen',
        unread_count: 0,
        updated_at: new Date().toISOString()
      }], { onConflict: 'phone' });

      setInputText('');
      fetchMessages(selectedPhone, true);
      fetchChats(true);
    } catch (err) {
      console.warn('Error al adjuntar imagen:', err);
      alert(`No se pudo enviar la imagen: ${err.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDeleteChat = async (e, chat) => {
    e.stopPropagation();
    const label = chat.client_name || chat.phone;
    if (!window.confirm(`¿Eliminar la conversación con ${label}? Se borran todos los mensajes y no se puede deshacer.`)) {
      return;
    }
    try {
      await supabase.from('whatsapp_messages').delete().eq('chat_phone', chat.phone);
      await supabase.from('whatsapp_chats').delete().eq('phone', chat.phone);

      setChats(prev => prev.filter(c => c.phone !== chat.phone));
      if (selectedPhone === chat.phone) {
        setSelectedPhone(null);
        setMessages([]);
      }
    } catch (err) {
      console.warn('Error al borrar chat:', err);
      alert('No se pudo borrar la conversación. Probá de nuevo.');
    }
  };

  const handleToggleBot = async (phone, currentStatus) => {
    const newStatus = !currentStatus;
    setChats(prev => prev.map(c => c.phone === phone ? { ...c, bot_enabled: newStatus } : c));
    try {
      await supabase.from('whatsapp_chats').update({ bot_enabled: newStatus }).eq('phone', phone);
    } catch (e) {
      console.warn('Error al cambiar estado del bot:', e);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaveSuccessMsg('');
    try {
      const { error } = await supabase.from('whatsapp_bot_settings').upsert([{
        id: 'main',
        openrouter_key: openrouterKey,
        model: selectedModel,
        system_prompt: systemPrompt,
        is_global_enabled: isGlobalEnabled,
        updated_at: new Date().toISOString()
      }], { onConflict: 'id' });

      if (error) throw error;
      setSaveSuccessMsg('✓ Configuración del Bot guardada con éxito.');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    } catch (e) {
      console.warn('Error al guardar ajustes:', e);
    }
  };

  const selectedChat = chats.find(c => c.phone === selectedPhone);
  const filteredChats = chats.filter(c => 
    (c.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone || '').includes(searchQuery)
  );

  return (
    <div className="whatsapp-tab-root" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 180px)', minHeight: '600px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>

      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '12px 20px', background: '#0F172A', color: '#FFFFFF', borderBottom: '1px solid #1E293B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MessageSquare className="text-gold" size={22} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>WhatsApp CRM & Bot de IA</h3>
            <span className="whatsapp-subtitle" style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Bandeja en Vivo • Conectada con Supabase & DeepSeek IA</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsSoundEnabled(prev => !prev)}
            title={isSoundEnabled ? 'Silenciar alerta sonora de mensajes nuevos' : 'Activar alerta sonora de mensajes nuevos'}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isSoundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          <button
            onClick={() => fetchChats()}
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Actualizar
          </button>

          <button 
            onClick={() => setIsSettingsOpen(true)} 
            style={{ 
              padding: '6px 14px', 
              fontSize: '0.82rem', 
              fontWeight: 700, 
              borderRadius: '8px', 
              background: 'linear-gradient(135deg, #D97706, #B45309)', 
              color: '#FFFFFF', 
              border: 'none', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Settings size={15} /> Ajustes del Bot
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="whatsapp-split-layout" data-has-chat={selectedChat ? 'true' : 'false'} style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* LEFT SIDEBAR: Chats List */}
        <div className="whatsapp-sidebar" style={{ width: '320px', background: 'var(--bg-main)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Search Box */}
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar cliente o nro..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '7px 10px 7px 32px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          {/* Chats List */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {isLoadingChats ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cargando conversaciones...</div>
            ) : filteredChats.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No hay conversaciones registradas aún.
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isSelected = chat.phone === selectedPhone;
                const dateStr = chat.updated_at ? new Date(chat.updated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';

                return (
                  <div 
                    key={chat.phone}
                    onClick={() => handleSelectChat(chat.phone)}
                    style={{ 
                      padding: '12px 14px', 
                      borderBottom: '1px solid var(--border-color)', 
                      cursor: 'pointer', 
                      background: isSelected ? 'rgba(217, 119, 6, 0.12)' : 'transparent',
                      borderLeft: isSelected ? '4px solid var(--accent-gold)' : '4px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span title={chat.channel === 'web' ? 'Chat Web' : 'WhatsApp'}>
                          {chat.channel === 'web' ? '🌐' : '📱'}
                        </span>
                        {chat.client_name || chat.phone}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{dateStr}</span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteChat(e, chat)}
                          title="Eliminar esta conversación"
                          aria-label="Eliminar conversación"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: 'var(--text-muted)', opacity: 0.7 }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#EF4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                        {chat.last_message || 'Sin mensajes'}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {chat.bot_enabled !== false ? (
                          <span title="Bot de IA Activo" style={{ fontSize: '0.65rem', background: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Bot size={10} /> IA
                          </span>
                        ) : (
                          <span title="Modo Manual" style={{ fontSize: '0.65rem', background: '#E2E8F0', color: '#475569', padding: '2px 6px', borderRadius: '10px', fontWeight: 800 }}>
                            Manual
                          </span>
                        )}

                        {chat.unread_count > 0 && (
                          <span style={{ background: '#EF4444', color: '#FFFFFF', fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px' }}>
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Active Chat Conversation */}
        <div className="whatsapp-conversation-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' }}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'var(--bg-main)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedPhone(null)}
                    className="whatsapp-back-button"
                    aria-label="Volver a la lista de chats"
                    style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', padding: '4px', flexShrink: 0 }}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedChat.client_name || selectedChat.phone}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {selectedChat.channel === 'web' ? (
                        <>🌐 Chat Web (visitante del sitio)</>
                      ) : (
                        <>WhatsApp: <strong>{selectedChat.phone}</strong></>
                      )}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {/* Toggle Bot for this chat */}
                  <button 
                    onClick={() => handleToggleBot(selectedChat.phone, selectedChat.bot_enabled !== false)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      background: selectedChat.bot_enabled !== false ? '#DCFCE7' : '#F1F5F9',
                      color: selectedChat.bot_enabled !== false ? '#15803D' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Bot size={14} />
                    {selectedChat.bot_enabled !== false ? 'Bot IA: Encendido' : 'Bot IA: Pausado (Manual)'}
                  </button>
                </div>
              </div>

              {/* Messages History Bubbles */}
              <div style={{ flex: 1, minHeight: 0, padding: '18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-card)' }}>
                {isLoadingMessages ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto' }}>Cargando conversación...</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto' }}>No hay mensajes en este chat.</div>
                ) : (
                  messages.map((msg) => {
                    const isClient = msg.sender === 'client';
                    const isBot = msg.sender === 'bot';
                    const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';

                    return (
                      <div 
                        key={msg.id}
                        style={{
                          alignSelf: isClient ? 'flex-start' : 'flex-end',
                          maxWidth: '75%',
                          padding: '10px 14px',
                          borderRadius: '14px',
                          background: isClient
                            ? 'var(--bg-surface-elevated)'
                            : isBot
                              ? 'linear-gradient(135deg, #10B981, #059669)'
                              : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                          color: isClient ? 'var(--text-main)' : '#FFFFFF',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, opacity: 0.8, textTransform: 'uppercase' }}>
                            {isClient ? (selectedChat.client_name || 'Cliente') : isBot ? '🤖 IA Bot' : '👤 Administrador'}
                          </span>
                          <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{timeStr}</span>
                        </div>

                        {/* Si tiene imagen adjunta */}
                        {msg.media_url && (
                          <div style={{ marginBottom: msg.content ? '8px' : 0 }}>
                            <a href={msg.media_url} target="_blank" rel="noreferrer">
                              <img
                                src={msg.media_url}
                                alt="Adjunto"
                                style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '8px', objectFit: 'cover', display: 'block' }}
                              />
                            </a>
                          </div>
                        )}

                        <div style={{ fontSize: '0.85rem', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {renderMessageWithLinks(msg.content)}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--bg-main)' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAttachImage}
                  accept="image/*"
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  disabled={isUploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar imagen"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Paperclip size={16} />
                </button>

                <input
                  type="text"
                  placeholder={`Responder a ${selectedChat.client_name || selectedChat.phone}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  style={{ flex: 1, padding: '9px 14px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    background: 'var(--accent-gold)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: inputText.trim() ? 1 : 0.5
                  }}
                >
                  <Send size={16} /> Enviar
                </button>
              </form>
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
              <MessageSquare size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
              <p>Seleccioná una conversación para ver los mensajes</p>
            </div>
          )}
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', maxWidth: '600px', width: '100%', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles className="text-gold" size={20} /> Configuración del Bot IA
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            {saveSuccessMsg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#DCFCE7', color: '#15803D', fontWeight: 700, fontSize: '0.85rem', marginBottom: '16px' }}>
                {saveSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSaveSettings}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  OpenRouter API Key (Opcional - ya configurada en el servidor):
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showKey ? 'text' : 'password'}
                    placeholder="sk-or-v1-... (ya cargada en .env.local)"
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    style={{ width: '100%', padding: '8px 40px 8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowKey(!showKey)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>La clave ya está guardada de forma segura en las variables de entorno.</span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Modelo de IA:
                </label>
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                >
                  <option value="deepseek/deepseek-chat">🔥 DeepSeek V3 (deepseek-chat) - Rápido & Económico (Recomendado)</option>
                  <option value="deepseek/deepseek-r1">🧠 DeepSeek R1 (deepseek-r1) - Razonamiento</option>
                  <option value="meta-llama/llama-3.3-70b-instruct">Meta Llama 3.3 70B</option>
                  <option value="openai/gpt-4o-mini">OpenAI GPT-4o Mini</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={isGlobalEnabled}
                    onChange={(e) => setIsGlobalEnabled(e.target.checked)}
                  />
                  Habilitar Bot de IA de forma global para nuevos visitantes
                </label>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Prompt / Instrucciones del Bot de Ventas:
                </label>
                <textarea 
                  rows={8}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsSettingsOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" style={{ padding: '8px 18px', background: 'var(--accent-gold)', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>
                  Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* En celular no entran las dos columnas lado a lado */}
      <style jsx>{`
        @media (max-width: 768px) {
          .whatsapp-tab-root {
            height: calc(100vh - 140px) !important;
            height: calc(100dvh - 140px) !important;
            min-height: 500px !important;
          }
          .whatsapp-subtitle {
            display: none;
          }
          .whatsapp-split-layout {
            flex-direction: column;
          }
          .whatsapp-sidebar {
            width: 100% !important;
            border-right: none !important;
          }
          .whatsapp-split-layout[data-has-chat='true'] .whatsapp-sidebar {
            display: none !important;
          }
          .whatsapp-split-layout[data-has-chat='false'] .whatsapp-conversation-panel {
            display: none !important;
          }
          .whatsapp-back-button {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
