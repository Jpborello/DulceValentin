const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.local');
const env = {};
fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(l => {
  const eq = l.indexOf('=');
  if (eq > 0) env[l.slice(0, eq).trim()] = l.slice(eq+1).trim().replace(/^["']|["']$/g, '');
});

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_SERVICE_ROLE_KEY.includes('COMPLETAR') ? env.SUPABASE_SERVICE_ROLE_KEY : null;
const keyToUse = serviceKey || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, keyToUse);

async function check() {
  const { data: authData, error: authError } = await sb.auth.signInWithPassword({
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD
  });
  if (authError) {
    console.error('Auth error:', authError);
  } else {
    console.log('Admin auth successful! User:', authData.user.email);
  }

  const { data: prods, error } = await sb.from('products').select('id, code, name');
  if (error) console.error('Error fetching products:', error);
  console.log('Total products in DB:', prods ? prods.length : 0);
  if (prods && prods.length > 0) {
    const codes = prods.map(p => parseInt(p.code, 10)).filter(Number.isFinite);
    const maxCode = Math.max(...codes, 0);
    console.log('Max numeric code in DB:', maxCode);
  }
}
check();
