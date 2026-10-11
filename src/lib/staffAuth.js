import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FEATURES } from '@/lib/features';

// Personal del local (tabla staff): admin, cajera, vendedora. Las rutas
// /api/pos/* reciben el token de la sesion de Supabase en Authorization y
// con esto sabemos quien es y que rol tiene.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

export const deny = (status, error) => NextResponse.json({ error }, { status });

// Devuelve { staff } o { response } con el error listo para devolver.
// roles: lista de roles permitidos (por defecto, todos).
export async function getStaff(req, roles = ['admin', 'cajera', 'vendedora']) {
  // Caja apagada hasta que se contrate (ver src/lib/features.js).
  if (!FEATURES.POS) return { response: deny(404, 'No disponible.') };
  if (!supabaseAdmin) return { response: deny(503, 'Servicio no disponible.') };

  const header = req.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return { response: deny(401, 'Iniciá sesión.') };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return { response: deny(401, 'Sesión inválida o vencida. Volvé a iniciar sesión.') };

  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id, name, email, role, commission_pct, active')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!staff || !staff.active) return { response: deny(403, 'Tu usuario no está habilitado para la caja.') };
  if (!roles.includes(staff.role)) return { response: deny(403, 'Tu usuario no tiene permiso para esto.') };

  return { staff };
}

// Rango de un dia completo en hora de Argentina (UTC-3), para "ventas de
// hoy" y el cierre de caja. date: 'YYYY-MM-DD' (por defecto, hoy).
export function argentinaDayRange(date) {
  const day = date || new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10);
  const start = new Date(`${day}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { day, start: start.toISOString(), end: end.toISOString() };
}
