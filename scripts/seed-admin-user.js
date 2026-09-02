/**
 * Crea (o repara) el usuario administrador del panel /admin en Supabase Auth.
 *
 *   node scripts/seed-admin-user.js
 *
 * Credenciales por defecto (DEMO):  admin@test.com / Admin123
 * Se pueden pisar con variables de entorno:
 *   ADMIN_EMAIL=otro@mail.com ADMIN_PASSWORD=OtraClave123 node scripts/seed-admin-user.js
 *
 * Usa dos caminos segun lo que haya en .env.local:
 *   A) SUPABASE_SERVICE_ROLE_KEY cargada  -> crea el usuario ya confirmado
 *      (camino recomendado: funciona aunque "Confirm email" este activado).
 *   B) Solo la anon key                   -> hace signUp normal. Si el proyecto
 *      pide confirmacion por mail, el script avisa que hay que desactivarla.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// --- .env.local: lo leemos a mano porque `node` no lo carga solo (eso lo hace Next) ---
function loadEnvLocal() {
  const file = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SG-JwsfgUZuPHN23twhBlw_QhaJmwL_';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const EMAIL = (process.env.ADMIN_EMAIL || 'admin@test.com').trim().toLowerCase();
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123';

// La service role key real arranca con "sb_secret_" o es un JWT ("eyJ...").
// Cualquier otra cosa (el placeholder COMPLETAR_...) la tratamos como ausente.
const hasServiceKey = /^(sb_secret_|eyJ)/.test(SERVICE_KEY);

const anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

function line() {
  console.log('-'.repeat(62));
}

async function canLogIn() {
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD
  });
  return { ok: Boolean(data && data.session), error };
}

// --- Camino A: service role. Crea el usuario ya confirmado, o le resetea la clave. ---
async function seedWithServiceRole() {
  console.log('Metodo: service role key (usuario confirmado automaticamente)');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: 'admin', name: 'Administrador Dulce Valentin' }
  });

  if (!created.error) {
    console.log('OK  Usuario creado y confirmado. id:', created.data.user.id);
    return;
  }

  const alreadyExists =
    created.error.status === 422 ||
    /already been registered|already exists|email_exists/i.test(created.error.message);

  if (!alreadyExists) throw created.error;

  console.log('El usuario ya existia. Le actualizo la contrasena y lo dejo confirmado...');

  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw list.error;

  const existing = list.data.users.find((u) => (u.email || '').toLowerCase() === EMAIL);
  if (!existing) {
    throw new Error(
      `Supabase dice que ${EMAIL} ya existe pero no aparece en listUsers(). ` +
        'Revisalo a mano en el dashboard: Authentication > Users.'
    );
  }

  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { ...(existing.user_metadata || {}), role: 'admin' }
  });
  if (updated.error) throw updated.error;

  console.log('OK  Contrasena actualizada. id:', existing.id);
}

// --- Camino B: solo anon key. signUp comun, con diagnostico de los errores tipicos. ---
async function seedWithAnonKey() {
  console.log('Metodo: anon key (signUp publico)');
  console.log('Nota: sin SUPABASE_SERVICE_ROLE_KEY en .env.local no puedo confirmar el mail por vos.');

  const { data, error } = await anonClient.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
    options: { data: { role: 'admin', name: 'Administrador Dulce Valentin' } }
  });

  if (error) {
    if (/at least|should be at least|password/i.test(error.message)) {
      console.error('\nERROR  La contrasena es demasiado corta o debil para este proyecto.');
      console.error('       Supabase pide 6 caracteres como minimo (configurable en');
      console.error('       Authentication > Providers > Email > Minimum password length).');
    } else if (/invalid/i.test(error.message) && /email/i.test(error.message)) {
      console.error(`\nERROR  Supabase rechaza el mail "${EMAIL}".`);
      console.error('       Revisa Authentication > Providers > Email por si hay dominios bloqueados,');
      console.error('       o usa un mail de un dominio real.');
    } else if (/already/i.test(error.message)) {
      console.error('\nERROR  Ese mail ya esta registrado con OTRA contrasena.');
      console.error('       Cambiasela desde el dashboard (Authentication > Users > ... > Reset password)');
      console.error('       o cargá SUPABASE_SERVICE_ROLE_KEY en .env.local y volve a correr el script.');
    } else {
      console.error('\nERROR  Supabase respondio:', error.status, error.message);
    }
    throw error;
  }

  const confirmed = Boolean(data.user && (data.user.confirmed_at || data.user.email_confirmed_at));
  console.log('OK  signUp aceptado. id:', data.user && data.user.id);

  if (!confirmed && !data.session) {
    console.warn('\nATENCION  El proyecto tiene activada la confirmacion por email.');
    console.warn(`          ${EMAIL} quedo creado pero SIN confirmar, asi que todavia no puede entrar.`);
    console.warn('          Como es una demo, lo mas practico es:');
    console.warn('            Supabase > Authentication > Sign In / Providers > Email');
    console.warn('            -> desactivar "Confirm email" -> Save');
    console.warn('          y despues confirmarlo a mano en Authentication > Users.');
  }
}

async function main() {
  line();
  console.log('Seed del admin de Dulce Valentin');
  console.log('Proyecto :', SUPABASE_URL);
  console.log('Email    :', EMAIL);
  console.log('Password :', PASSWORD);
  line();

  const pre = await canLogIn();
  if (pre.ok) {
    console.log('Nada que hacer: el usuario ya existe y estas credenciales funcionan.');
    line();
    return;
  }
  console.log('El login todavia no funciona. Motivo:', pre.error ? pre.error.message : 'sin sesion');
  console.log('');

  if (hasServiceKey) {
    await seedWithServiceRole();
  } else {
    await seedWithAnonKey();
  }

  console.log('');
  console.log('Verificando login final...');
  const post = await canLogIn();
  line();
  if (post.ok) {
    console.log('LISTO  Podes entrar a /admin con:');
    console.log('   Email      ', EMAIL);
    console.log('   Contrasena ', PASSWORD);
  } else {
    console.log('El login sigue fallando:', post.error ? post.error.message : 'sin sesion');
    console.log('Mira las notas de arriba: casi siempre es la confirmacion por email.');
    process.exitCode = 1;
  }
  line();
}

main().catch((err) => {
  console.error('\nFallo el script:', err.message || err);
  process.exitCode = 1;
});
