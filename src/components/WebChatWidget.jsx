'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { renderMessageWithLinks } from '@/lib/chatLinks';

const SESSION_KEY = 'dulcevalentin_webchat_session';
const NAME_KEY = 'dulcevalentin_webchat_name';
const POLL_MS = 5000;

function getOrCreateSessionId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = 'web-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function WebChatWidget() {
  const [sessionId, setSessionId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [clientName, setClientName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);
    const savedName = localStorage.getItem(NAME_KEY);
    if (savedName) {
      setClientName(savedName);
      setNameSaved(true);
    }
  }, []);

  const fetchMessages = useCallback(async (id, markSeen) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/webchat/message?sessionId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages((prev) => {
          if (!markSeen && data.messages.length > prev.length) {
            setUnseenCount((u) => u + (data.messages.length - prev.length));
          }
          return data.messages;
        });
      }
    } catch (e) {
      console.warn('Error cargando chat web:', e);
    }
  }, []);

  // Poll for admin/bot replies while the panel is open, and lightly while closed
  // too (so the badge can show unread replies without needing to reopen).
  useEffect(() => {
    if (!sessionId) return;
    fetchMessages(sessionId, isOpen);
    pollRef.current = setInterval(() => fetchMessages(sessionId, isOpen), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [sessionId, isOpen, fetchMessages]);

  // Al abrir el panel, saltamos al fondo sin animar: con 'smooth' el scroll
  // arrancaba visualmente desde arriba del todo y recorria toda la
  // conversacion hasta el final, que en charlas largas se sentia como que
  // "empieza desde el principio" en vez de abrir directo en el ultimo
  // mensaje. Mientras el panel ya esta abierto, un mensaje nuevo sigue
  // animando con 'smooth' porque ahi si se nota poco y queda mas prolijo.
  const justOpenedRef = useRef(false);
  useEffect(() => {
    if (isOpen) {
      justOpenedRef.current = true;
      setUnseenCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const behavior = justOpenedRef.current ? 'auto' : 'smooth';
    justOpenedRef.current = false;
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [isOpen, messages]);

  const handleSaveName = (e) => {
    e.preventDefault();
    const trimmed = clientName.trim();
    if (!trimmed) return;
    localStorage.setItem(NAME_KEY, trimmed);
    setNameSaved(true);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !sessionId || isSending) return;

    setInputText('');
    setIsSending(true);

    const tempMsg = {
      id: 'temp-' + Date.now(),
      chat_phone: sessionId,
      sender: 'client',
      content: text,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/webchat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clientName: clientName || 'Visitante Web', message: text })
      });
      await res.json();
      await fetchMessages(sessionId, true);
    } catch (e) {
      console.warn('Error enviando mensaje de chat web:', e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat con Dulce Valentín'}
        title="Chat con Dulce Valentín"
        style={{
          position: 'fixed',
          bottom: '92px',
          right: '24px',
          zIndex: 500,
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #D97706, #B45309)',
          color: '#FFFFFF',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(180, 83, 9, 0.45)'
        }}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {!isOpen && unseenCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#EF4444',
            color: '#FFFFFF',
            fontSize: '0.68rem',
            fontWeight: 800,
            minWidth: '18px',
            height: '18px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px'
          }}>
            {unseenCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="webchat-panel" style={{
          position: 'fixed',
          bottom: '152px',
          right: '24px',
          zIndex: 500,
          width: 'min(360px, calc(100vw - 32px))',
          height: 'min(480px, calc(100vh - 220px))',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '14px 16px', background: 'var(--bg-surface-dark)', color: 'var(--text-on-dark)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Dulce Valentín</div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Te respondemos al toque</div>
          </div>

          {!nameSaved ? (
            <form onSubmit={handleSaveName} style={{ margin: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                ¿Cómo te llamás? Así te podemos atender mejor.
              </p>
              <input
                type="text"
                autoFocus
                placeholder="Tu nombre"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                style={{ padding: '9px 12px', fontSize: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
              />
              <button
                type="submit"
                disabled={!clientName.trim()}
                style={{ padding: '9px 12px', borderRadius: '10px', background: 'var(--accent-gold)', color: '#FFFFFF', border: 'none', fontWeight: 800, cursor: 'pointer', opacity: clientName.trim() ? 1 : 0.5 }}
              >
                Empezar a chatear
              </button>
            </form>
          ) : (
            <>
              <div style={{ flex: 1, padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    ¡Hola {clientName}! Escribinos tu consulta sobre talles, precios o pedidos.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isClient = msg.sender === 'client';
                    const isBot = msg.sender === 'bot';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isClient ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          padding: '9px 12px',
                          borderRadius: '12px',
                          background: isClient ? 'var(--accent-gold)' : (isBot ? 'var(--bg-surface-elevated)' : 'var(--accent-secondary-light)'),
                          color: isClient ? '#FFFFFF' : 'var(--text-main)',
                          fontSize: '0.85rem',
                          lineHeight: 1.4,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {!isClient && (
                          <div style={{ fontSize: '0.66rem', fontWeight: 800, opacity: 0.65, marginBottom: '2px' }}>
                            {isBot ? '🤖 Asistente' : '👤 Dulce Valentín'}
                          </div>
                        )}
                        {renderMessageWithLinks(msg.content)}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} style={{ padding: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Escribí tu mensaje..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  style={{ flex: 1, padding: '9px 12px', fontSize: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  style={{ padding: '9px 14px', borderRadius: '10px', background: 'var(--accent-gold)', color: '#FFFFFF', border: 'none', cursor: 'pointer', opacity: (!inputText.trim() || isSending) ? 0.5 : 1, display: 'flex', alignItems: 'center' }}
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* En pantallas chicas el 100vh/100vw de arriba no coincide con lo que
          realmente se ve (la barra del navegador del celular se muestra/oculta
          y cambia el viewport), asi que el chat pasa a ocupar toda la pantalla
          en vez de ser una cajita flotante con margenes calculados. */}
      <style jsx>{`
        @media (max-width: 480px) {
          .webchat-panel {
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
