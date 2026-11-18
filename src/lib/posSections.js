import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Cajas de sección (2026-11). Cada sección del local (ej. "Caja 1 · Sección
// Niños") tiene una PC con la pantalla /seccion: la vendedora teclea su
// código de 4 números, escanea las prendas y la venta queda pendiente de
// cobro A SU NOMBRE. Abajo, la Caja General la cobra (sola o junto con otras)
// y recién ahí suma a su comisión.
//
// Se guarda en la tabla pos_config (clave/valor), sin tablas nuevas:
//   sections:     { list: [{ id, number, name, active, sellerIds, tokenHash }] }
//   seller_codes: { codes: { [staffId]: hashDelCodigo } }
// La PC de la sección no inicia sesión: queda vinculada con un link secreto
// (tokenHash). El código de cada vendedora y el token se guardan con HMAC,
// nunca en texto.

const SECRET = process.env.POS_SECTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dv-pos-sections';

export const hashSecret = (value) => createHmac('sha256', SECRET).update(String(value)).digest('hex');

export const isValidSellerCode = (code) => /^\d{4}$/.test(String(code || ''));

export function newSectionToken() {
  return randomBytes(24).toString('base64url');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

async function readConfig(supabaseAdmin, key, fallback) {
  const { data, error } = await supabaseAdmin.from('pos_config').select('value').eq('key', key).maybeSingle();
  if (error) throw new Error('No se pudo leer la configuración de la caja.');
  return data?.value || fallback;
}

async function writeConfig(supabaseAdmin, key, value) {
  const { error } = await supabaseAdmin
    .from('pos_config')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error('No se pudo guardar la configuración de la caja.');
}

// La primera vez se crea la sección de niños.
const DEFAULT_SECTIONS = { list: [{ id: 's1', number: 1, name: 'Sección Niños', active: true, sellerIds: [], tokenHash: null }] };

export async function getSections(supabaseAdmin) {
  const value = await readConfig(supabaseAdmin, 'sections', DEFAULT_SECTIONS);
  return Array.isArray(value.list) ? value.list : [];
}

export async function saveSections(supabaseAdmin, list) {
  await writeConfig(supabaseAdmin, 'sections', { list });
}

export async function getSellerCodes(supabaseAdmin) {
  const value = await readConfig(supabaseAdmin, 'seller_codes', { codes: {} });
  return value.codes && typeof value.codes === 'object' ? value.codes : {};
}

export async function saveSellerCodes(supabaseAdmin, codes) {
  await writeConfig(supabaseAdmin, 'seller_codes', { codes });
}

export const sectionLabel = (section) => `Caja ${section.number} · ${section.name}`;

// Sección de la PC que llama (header x-section-token), o null.
export async function getSectionFromRequest(req, supabaseAdmin) {
  const token = req.headers.get('x-section-token') || '';
  if (token.length < 20) return null;
  const hash = hashSecret(`section:${token}`);
  const sections = await getSections(supabaseAdmin);
  return sections.find((s) => s.active && s.tokenHash && safeEqual(s.tokenHash, hash)) || null;
}

// Vendedora de la sección que corresponde al código, o null.
export async function findSellerByCode(supabaseAdmin, section, code) {
  if (!isValidSellerCode(code)) return null;
  const codes = await getSellerCodes(supabaseAdmin);
  const hash = hashSecret(`seller:${code}`);
  const staffId = Object.keys(codes).find((id) => safeEqual(codes[id], hash));
  if (!staffId || !(section.sellerIds || []).includes(staffId)) return null;
  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id, name, commission_pct, active')
    .eq('id', staffId)
    .maybeSingle();
  return staff && staff.active ? staff : null;
}
