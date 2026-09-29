'use client';

import { useEffect } from 'react';

// Registra el service worker (public/sw.js) para que la web se pueda
// instalar como app y tenga una pantalla propia cuando no hay conexion.
// Solo en produccion: en desarrollo un service worker cachea de mas y
// confunde al probar cambios.
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
        console.warn('No se pudo registrar el service worker:', err);
      });
    };

    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
