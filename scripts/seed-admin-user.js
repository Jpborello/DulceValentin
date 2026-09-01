const { createClient } = require('@supabase/supabase-js');
let ws;
try { ws = require('ws'); } catch (e) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SG-JwsfgUZuPHN23twhBlw_QhaJmwL_';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  ...(ws ? { realtime: { transport: ws } } : {})
});

async function run() {
  // COMPLETAR antes de correr este script: email y contraseña reales del
  // admin de Dulce Valentín (no dejar este placeholder en producción).
  const email = 'admin@dulcevalentin.com.ar';
  const password = 'CAMBIAR_ESTA_CLAVE_2026@';

  console.log(`🔐 Creando/Iniciando usuario Admin en Supabase Auth: ${email}...`);

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInData && signInData.session) {
    console.log('✓ Usuario Admin ya existe y se autenticó correctamente en Supabase Auth!');
    return;
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role: 'admin', name: 'Administrador Dulce Valentín' }
    }
  });

  if (signUpError) {
    console.warn('Respuesta Supabase Auth SignUp:', signUpError.message);
  } else {
    console.log('🎉 Usuario Administrador registrado en Supabase Auth con éxito!');
  }
}

run();
