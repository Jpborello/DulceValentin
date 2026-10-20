'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('App error caught by error boundary:', error);
    // Si es un error de carga de chunk (ocurre cuando se publica una nueva version en Vercel)
    // recargar automaticamente para obtener los bundles JS actualizados.
    const msg = String(error?.message || '');
    if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(msg)) {
      if (!window.__reloaded_for_chunk) {
        window.__reloaded_for_chunk = true;
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: '#FDF2F8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        fontSize: '32px'
      }}>
        ✨
      </div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1F2937', margin: '0 0 10px 0' }}>
        Actualizamos la tienda
      </h2>
      <p style={{ color: '#6B7280', maxWidth: '440px', lineHeight: 1.6, margin: '0 0 24px 0', fontSize: '0.95rem' }}>
        Detectamos una nueva versión del catálogo o una actualización en vivo. Tocá el botón para continuar navegando.
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#EC6FA6',
            color: '#FFFFFF',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(236,111,166,0.3)'
          }}
        >
          Recargar página
        </button>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            backgroundColor: '#F3F4F6',
            color: '#374151',
            border: '1px solid #E5E7EB',
            padding: '12px 20px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer'
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
