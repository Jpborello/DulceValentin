'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="es">
      <body style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        margin: 0,
        backgroundColor: '#FFFFFF',
        color: '#1F2937',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 10px 0' }}>
          Dulce Valentín
        </h2>
        <p style={{ color: '#6B7280', margin: '0 0 24px 0', maxWidth: '420px', fontSize: '0.95rem' }}>
          Hubo un problema temporal al cargar la página. Por favor recargá para continuar.
        </p>
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
            cursor: 'pointer'
          }}
        >
          Recargar página
        </button>
      </body>
    </html>
  );
}
