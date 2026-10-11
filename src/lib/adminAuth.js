import { NextResponse } from 'next/server';

// Verifica que quien llama a una ruta /api/admin/* sea el admin logueado en
// el panel. El panel manda el token de su sesion de Supabase en el header
// Authorization (ver src/lib/adminFetch.js). Sin esto, cualquiera que
// conociera la URL podia leer los chats, la configuracion del bot (con la
// key de OpenRouter) o mandar/borrar mensajes, porque la ruta usa la
// service role key y saltea todos los permisos de la base.
//
// Desde 2026-10 hay cuentas de personal (tabla staff): solo pasa quien tiene
// rol "admin". Si la tabla staff todavia no existe (deploy previo a la
// migracion), se mantiene el criterio anterior: cualquier sesion valida, o
// solo ADMIN_EMAIL si esa variable esta cargada.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SG-JwsfgUZuPHN23twhBlw_QhaJmwL_';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serviceClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

export async function requireAdmin(req, supabaseAdmin) {
  const client = supabaseAdmin || serviceClient || createClient(supabaseUrl, anonKey);

  const header = req.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data, error } = await client.auth.getUser(token);
  const user = data?.user;
  if (error || !user) {
    return NextResponse.json({ error: 'Sesión inválida o vencida' }, { status: 401 });
  }

  const staffClient = supabaseAdmin || serviceClient;
  if (staffClient) {
    const { data: staff, error: staffError } = await staffClient
      .from('staff')
      .select('role, active')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!staffError) {
      if (staff?.role === 'admin' && staff.active) return null;
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail && (user.email || '').toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  return null;
}
