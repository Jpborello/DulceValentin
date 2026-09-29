'use client';

import { supabase } from '@/lib/supabaseClient';

// fetch para las rutas /api/admin/*: agrega el token de la sesion del admin
// para que el servidor pueda verificar que la llamada viene del panel
// (ver src/lib/adminAuth.js).
export async function adminFetch(url, options = {}) {
  let token = '';
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token || '';
    } catch (e) {}
  }
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}
