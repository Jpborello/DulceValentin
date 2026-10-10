// Eventos estandar del Meta Pixel (el script base se carga en layout.jsx).
// Sin estos, Meta solo ve PageView y no puede optimizar anuncios por compra
// ni armar publicos de "agrego al carrito y no compro" para retargeting.
export function trackPixel(event, params = {}) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  try {
    window.fbq('track', event, { currency: 'ARS', ...params });
  } catch {}
}
