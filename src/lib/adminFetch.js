'use client';

import { supabase } from '@/lib/supabaseClient';

// fetch para las rutas /api/admin/* y /api/ventas: agrega el token de la sesion
// del admin para que el servidor pueda verificar que la llamada viene del panel
// (ver src/lib/adminAuth.js).
//
// Importante: el token de Supabase vence (~1 h). Si la pestana queda abierta
// muchas horas (ej: la siesta del local) el token caduca y, sin esto, al
// guardar una venta el servidor devolvia 401 y la venta se perdia. Aca
// refrescamos el token cuando esta por vencer y, si igual sale 401, lo
// refrescamos y reintentamos una sola vez antes de dar el error.

async function getToken(forceRefresh = false) {
  if (!supabase) return '';
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) return '';
    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
    const expiringSoon = expiresAtMs > 0 && expiresAtMs - Date.now() < 60000; // < 60 s
    if (forceRefresh || expiringSoon) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed?.session?.access_token || session.access_token || '';
    }
    return session.access_token || '';
  } catch {
    return '';
  }
}

export async function adminFetch(url, options = {}) {
  const run = (token) => {
    const headers = new Headers(options.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  };

  const token = await getToken(false);
  let res = await run(token);

  // Sesion posiblemente vencida tras inactividad: refrescar y reintentar una vez.
  if (res.status === 401) {
    const refreshed = await getToken(true);
    if (refreshed && refreshed !== token) {
      res = await run(refreshed);
    }
  }

  return res;
}
