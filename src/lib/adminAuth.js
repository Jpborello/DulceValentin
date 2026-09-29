import { NextResponse } from 'next/server';

// Verifica que quien llama a una ruta /api/admin/* sea el admin logueado en
// el panel. El panel manda el token de su sesion de Supabase en el header
// Authorization (ver src/lib/adminFetch.js). Sin esto, cualquiera que
// conociera la URL podia leer los chats, la configuracion del bot (con la
// key de OpenRouter) o mandar/borrar mensajes, porque la ruta usa la
// service role key y saltea todos los permisos de la base.
//
// Si ADMIN_EMAIL esta cargada en las variables de entorno, ademas exige que
// el usuario logueado sea ese mail (por si algun dia se crea otro usuario).
export async function requireAdmin(req, supabaseAdmin) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.' },
      { status: 503 }
    );
  }

  const header = req.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const user = data?.user;
  if (error || !user) {
    return NextResponse.json({ error: 'Sesión inválida o vencida' }, { status: 401 });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail && (user.email || '').toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  return null;
}
