'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, X, Send, Sparkles, MessageCircle, ExternalLink, User } from 'lucide-react';
import { renderMessageWithLinks } from '@/lib/chatLinks';

const SESSION_KEY = 'dulcevalentin_webchat_session';
const NAME_KEY = 'dulcevalentin_webchat_name';
const POLL_MS = 5000;
const WHATSAPP_PHONE = '5493412648035';

const QUICK_PROMPTS = [
  '¿Cuál es la compra mínima y cómo comprar?',
  '¿Qué métodos de pago tienen y cuál es el alias?',
  '¿Dónde queda el local y cuáles son los horarios?',
  'Quiero hablar con un vendedor por WhatsApp'
];

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
  const [showNameInput, setShowNameInput] = useState(false);
  // El chat se habilita recien cuando el visitante deja su nombre.
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [sendError, setSendError] = useState('');
  const [unseenCount, setUnseenCount] = useState(0);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const justOpenedRef = useRef(false);

  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);
    const savedName = localStorage.getItem(NAME_KEY);
    if (savedName) {
      setClientName(savedName);
      if (savedName.trim().length >= 2) setNameConfirmed(true);
    }
  }, []);

  const fetchMessages = useCallback(async (id, markSeen) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/webchat/message?sessionId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
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

  useEffect(() => {
    if (!sessionId) return;
    fetchMessages(sessionId, isOpen);

    if (!isOpen) return;

    pollRef.current = setInterval(() => fetchMessages(sessionId, true), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [sessionId, isOpen, fetchMessages]);

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
  }, [isOpen, messages, isSending]);

  const handleSaveName = (e) => {
    e.preventDefault();
    const trimmed = clientName.trim().slice(0, 60);
    if (trimmed.length < 2) return;
    localStorage.setItem(NAME_KEY, trimmed);
    setClientName(trimmed);
    setNameConfirmed(true);
    setSendError('');
    setShowNameInput(false);
  };

  const sendMessage = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || !sessionId || isSending || !nameConfirmed) return;

    setSendError('');
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
        body: JSON.stringify({
          sessionId,
          clientName: clientName.trim(),
          message: text
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && data?.error === 'name_required') {
        setNameConfirmed(false);
        setSendError('Antes de chatear necesitamos tu nombre.');
      } else if (!res.ok) {
        setSendError('No pudimos enviar tu mensaje. Probá de nuevo en un momento.');
      }
      await fetchMessages(sessionId, true);
    } catch (e) {
      console.warn('Error enviando mensaje de chat web:', e);
      setSendError('Sin conexión. Revisá tu internet y probá de nuevo.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const whatsappDirectUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent('¡Hola! Me comunico desde la web de Dulce Valentín para hablar con un vendedor o enviar mi comprobante de pago.')}`;

  return (
    <>
      {/* Botón flotante para abrir el Chat Web con IA */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Cerrar chat de asistencia' : 'Abrir chat con asistente virtual DulceBot'}
        title="Asistente Virtual DulceBot (DeepSeek IA)"
        className="webchat-fab-button"
        style={{
          position: 'fixed',
          bottom: '96px',
          right: '24px',
          zIndex: 499,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #EC4899 0%, #F59E0B 100%)',
          color: '#FFFFFF',
          border: '2px solid rgba(255,255,255,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(236, 72, 153, 0.45)',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {isOpen ? (
          <X size={26} />
        ) : (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={28} />
            <Sparkles size={12} style={{ position: 'absolute', top: '-6px', right: '-6px', color: '#FEF08A' }} />
          </div>
        )}

        {!isOpen && unseenCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#EF4444',
              color: '#FFFFFF',
              fontSize: '0.7rem',
              fontWeight: 800,
              minWidth: '20px',
              height: '20px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 5px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
            }}
          >
            {unseenCount}
          </span>
        )}
      </button>

      {/* Panel flotante de conversación */}
      {isOpen && (
        <div
          className="webchat-panel"
          style={{
            position: 'fixed',
            bottom: '164px',
            right: '24px',
            zIndex: 500,
            width: 'min(380px, calc(100vw - 32px))',
            height: 'min(540px, calc(100dvh - 190px))',
            background: 'var(--bg-card, #FFFFFF)',
            borderRadius: '20px',
            border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
            boxShadow: '0 24px 50px rgba(0, 0, 0, 0.28)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'webchat-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header del Chat */}
          <div
            style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #EC4899 0%, #F59E0B 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)'
                }}
              >
                <Bot size={22} color="#FFFFFF" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>DulceBot</span>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.2)',
                      color: '#FEF08A'
                    }}
                  >
                    DeepSeek IA
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#A5B4FC', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#10B981',
                      display: 'inline-block',
                      boxShadow: '0 0 8px #10B981'
                    }}
                  />
                  Online 24/7 • Respuestas al toque
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar chat"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  color: '#FFFFFF',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Banner de acceso directo a WhatsApp oficial */}
          <div
            style={{
              padding: '8px 14px',
              background: '#064E3B',
              color: '#D1FAE5',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              borderBottom: '1px solid rgba(16, 185, 129, 0.2)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageCircle size={14} style={{ color: '#34D399', flexShrink: 0 }} />
              <span>Vendedores & Comprobantes al <strong>341-264-8035</strong></span>
            </span>
            <a
              href={whatsappDirectUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#FFFFFF',
                background: '#059669',
                padding: '3px 8px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.7rem',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                whiteSpace: 'nowrap'
              }}
            >
              Abrir <ExternalLink size={10} />
            </a>
          </div>

          {/* Formulario de nombre (opcional / desplegable) */}
          {showNameInput && nameConfirmed && (
            <form
              onSubmit={handleSaveName}
              style={{
                padding: '10px 14px',
                background: 'var(--bg-surface-elevated, #F8FAFC)',
                borderBottom: '1px solid var(--border-color, #E2E8F0)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}
            >
              <input
                type="text"
                autoFocus
                placeholder="Ingresá tu nombre"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '0.82rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #CBD5E1)',
                  background: 'var(--bg-card, #FFFFFF)',
                  color: 'var(--text-main, #0F172A)'
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'var(--accent-gold, #D97706)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setShowNameInput(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #64748B)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={16} />
              </button>
            </form>
          )}

          {/* Área de mensajes con scroll */}
          <div
            style={{
              flex: 1,
              padding: '14px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'var(--bg-main, #F8FAFC)'
            }}
          >
            {/* Mensaje de bienvenida inicial de DulceBot */}
            <div
              style={{
                alignSelf: 'flex-start',
                maxWidth: '88%',
                padding: '12px 14px',
                borderRadius: '14px',
                borderBottomLeftRadius: '4px',
                background: 'var(--bg-card, #FFFFFF)',
                color: 'var(--text-main, #0F172A)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                border: '1px solid var(--border-color, #E2E8F0)',
                fontSize: '0.86rem',
                lineHeight: 1.45
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#6366F1', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Bot size={12} /> DulceBot Asistente Virtual
              </div>
              <div>
                ¡Hola{clientName ? ` ${clientName}` : ''}! 👋 Te doy la bienvenida a <strong>Dulce Valentín</strong>.
                <br /><br />
                Estoy conectado con inteligencia artificial y el catálogo mayorista en vivo para responderte sobre talles, stock, precios, compra mínima y envíos. ¿En qué te puedo asesorar?
              </div>
            </div>

            {/* Paso obligatorio: el nombre antes de chatear */}
            {!nameConfirmed && (
              <form
                onSubmit={handleSaveName}
                style={{
                  alignSelf: 'stretch',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: 'var(--bg-card, #FFFFFF)',
                  border: '1px solid var(--border-color, #E2E8F0)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <label htmlFor="webchat-name" style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main, #0F172A)' }}>
                  Para empezar, ¿cómo te llamás?
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="webchat-name"
                    type="text"
                    autoComplete="given-name"
                    placeholder="Tu nombre"
                    maxLength={60}
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '9px 12px',
                      fontSize: '15px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color, #CBD5E1)',
                      background: 'var(--bg-main, #F8FAFC)',
                      color: 'var(--text-main, #0F172A)'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={clientName.trim().length < 2}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: clientName.trim().length < 2 ? 'not-allowed' : 'pointer',
                      opacity: clientName.trim().length < 2 ? 0.5 : 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Empezar
                  </button>
                </div>
              </form>
            )}

            {/* Chips de sugerencias rápidas cuando hay pocos mensajes */}
            {nameConfirmed && messages.length <= 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '4px 0' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', fontWeight: 700, paddingLeft: '4px' }}>
                  Preguntas frecuentes:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(prompt)}
                      disabled={isSending}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'var(--bg-card, #FFFFFF)',
                        border: '1px solid var(--border-color, #E2E8F0)',
                        color: 'var(--text-main, #1E293B)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#6366F1';
                        e.currentTarget.style.backgroundColor = '#EEF2FF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color, #E2E8F0)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card, #FFFFFF)';
                      }}
                    >
                      💬 {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Historial de mensajes */}
            {messages.map((msg) => {
              const isClient = msg.sender === 'client';
              const isBot = msg.sender === 'bot';

              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: isClient ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    padding: '10px 14px',
                    borderRadius: '14px',
                    borderBottomRightRadius: isClient ? '4px' : '14px',
                    borderBottomLeftRadius: isClient ? '14px' : '4px',
                    background: isClient
                      ? 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)'
                      : 'var(--bg-card, #FFFFFF)',
                    color: isClient ? '#FFFFFF' : 'var(--text-main, #0F172A)',
                    boxShadow: isClient
                      ? '0 3px 10px rgba(79, 70, 229, 0.3)'
                      : '0 2px 8px rgba(0, 0, 0, 0.06)',
                    border: isClient ? 'none' : '1px solid var(--border-color, #E2E8F0)',
                    fontSize: '0.86rem',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {!isClient && (
                    <div
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        color: isBot ? '#6366F1' : '#059669',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {isBot ? <Bot size={12} /> : <User size={12} />}
                      {isBot ? 'DulceBot' : 'Asesor Dulce Valentín'}
                    </div>
                  )}
                  {renderMessageWithLinks(msg.content)}
                </div>
              );
            })}

            {/* Indicador de "Escribiendo..." */}
            {isSending && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 14px',
                  borderRadius: '14px',
                  borderBottomLeftRadius: '4px',
                  background: 'var(--bg-card, #FFFFFF)',
                  border: '1px solid var(--border-color, #E2E8F0)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#6366F1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Bot size={12} /> DulceBot pensando
                </div>
                <div className="webchat-typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Barra inferior de envío */}
          <div
            style={{
              padding: '10px 12px',
              borderTop: '1px solid var(--border-color, #E2E8F0)',
              background: 'var(--bg-card, #FFFFFF)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            {sendError && (
              <div role="alert" style={{ fontSize: '0.75rem', color: '#B91C1C', background: '#FEF2F2', borderRadius: '8px', padding: '6px 10px' }}>
                {sendError}
              </div>
            )}
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder={nameConfirmed ? 'Escribí tu consulta...' : 'Primero ingresá tu nombre'}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isSending || !nameConfirmed}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  fontSize: '15px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #CBD5E1)',
                  background: 'var(--bg-main, #F8FAFC)',
                  color: 'var(--text-main, #0F172A)',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending || !nameConfirmed}
                aria-label="Enviar mensaje"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: !inputText.trim() || isSending ? 0.45 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'opacity 0.2s ease, transform 0.15s ease'
                }}
              >
                <Send size={18} />
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', fontSize: '0.68rem', color: 'var(--text-muted, #94A3B8)' }}>
              <span>
                {clientName ? `Chateando como: ${clientName}` : 'Visitante'}
                {' • '}
                <button
                  onClick={() => setShowNameInput((v) => !v)}
                  style={{ background: 'none', border: 'none', color: '#6366F1', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 'inherit' }}
                >
                  {clientName ? 'cambiar' : 'agregar nombre'}
                </button>
              </span>
              <span>DeepSeek IA 24/7</span>
            </div>
          </div>
        </div>
      )}

      {/* Estilos responsivos y animaciones */}
      <style jsx>{`
        @keyframes webchat-slide-up {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .webchat-typing-dots {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .webchat-typing-dots span {
          width: 5px;
          height: 5px;
          background-color: #6366F1;
          border-radius: 50%;
          display: inline-block;
          animation: webchat-bounce 1.4s infinite ease-in-out both;
        }

        .webchat-typing-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .webchat-typing-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes webchat-bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }

        @media (max-width: 640px) {
          .webchat-fab-button {
            bottom: 78px !important;
            right: 16px !important;
            width: 50px !important;
            height: 50px !important;
          }
        }

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
