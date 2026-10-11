import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';
import { FEATURES } from '@/lib/features';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const ROLES = ['admin', 'cajera', 'vendedora'];
const clean = (v, max = 120) => String(v ?? '').trim().slice(0, max);
const pct = (v) => Math.min(100, Math.max(0, Number(v) || 0));

// Personal (solo admin). Las cuentas se crean desde aca (el registro publico
// de usuarios tiene que estar desactivado en Supabase Auth).
export async function GET(req) {
  if (!FEATURES.POS) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  const denied = await requireAdmin(req, supabaseAdmin);
  if (denied) return denied;
  const { data, error } = await supabaseAdmin
    .from('staff')
    .select('id, name, email, role, commission_pct, active, created_at')
    .order('created_at');
  if (error) return NextResponse.json({ error: 'No se pudo cargar el personal.' }, { status: 500 });
  return NextResponse.json({ staff: data || [] });
}

// POST { name, email, password, role, commission_pct } -> crea la cuenta.
export async function POST(req) {
  if (!FEATURES.POS) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  const denied = await requireAdmin(req, supabaseAdmin);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const name = clean(body.name);
  const email = clean(body.email, 200).toLowerCase();
  const password = String(body.password || '');
  const role = ROLES.includes(body.role) ? body.role : 'vendedora';

  if (!name || !email.includes('@')) return NextResponse.json({ error: 'Completá nombre y un email válido.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'La contraseña tiene que tener al menos 8 caracteres.' }, { status: 400 });

  const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name }
  });
  if (authError || !created?.user) {
    const msg = /already|registered|exists/i.test(authError?.message || '') ? 'Ya existe un usuario con ese email.' : 'No se pudo crear el usuario.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data: staff, error } = await supabaseAdmin
    .from('staff')
    .insert({ auth_user_id: created.user.id, name, email, role, commission_pct: pct(body.commission_pct) })
    .select('id, name, email, role, commission_pct, active, created_at')
    .single();
  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: 'No se pudo guardar el personal.' }, { status: 500 });
  }
  return NextResponse.json({ staff });
}

// PATCH { id, name?, role?, commission_pct?, active?, password? }
export async function PATCH(req) {
  if (!FEATURES.POS) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  const denied = await requireAdmin(req, supabaseAdmin);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { data: current } = await supabaseAdmin.from('staff').select('id, auth_user_id, role').eq('id', body.id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'No existe.' }, { status: 404 });

  const updates = {};
  if (body.name !== undefined) updates.name = clean(body.name) || undefined;
  if (body.role !== undefined && ROLES.includes(body.role)) updates.role = body.role;
  if (body.commission_pct !== undefined) updates.commission_pct = pct(body.commission_pct);
  if (body.active !== undefined) updates.active = Boolean(body.active);

  // Que nunca quede el sistema sin ningun admin activo.
  if (current.role === 'admin' && (updates.role && updates.role !== 'admin' || updates.active === false)) {
    const { count } = await supabaseAdmin.from('staff').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
    if ((count || 0) <= 1) return NextResponse.json({ error: 'Tiene que quedar al menos un admin activo.' }, { status: 400 });
  }

  if (body.password) {
    if (String(body.password).length < 8) return NextResponse.json({ error: 'La contraseña tiene que tener al menos 8 caracteres.' }, { status: 400 });
    if (current.auth_user_id) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(current.auth_user_id, { password: String(body.password) });
      if (error) return NextResponse.json({ error: 'No se pudo cambiar la contraseña.' }, { status: 500 });
    }
  }
  // Desactivar tambien bloquea el login.
  if (updates.active !== undefined && current.auth_user_id) {
    await supabaseAdmin.auth.admin.updateUserById(current.auth_user_id, { ban_duration: updates.active ? 'none' : '876000h' });
  }

  const { data: staff, error } = await supabaseAdmin
    .from('staff')
    .update(updates)
    .eq('id', body.id)
    .select('id, name, email, role, commission_pct, active, created_at')
    .single();
  if (error) return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  return NextResponse.json({ staff });
}
