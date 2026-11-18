import { NextResponse } from 'next/server';
import { supabaseAdmin, deny } from '@/lib/staffAuth';
import { buildLocalSaleLines, restoreLinesStock, randomLocalId } from '@/lib/localSale';
import { getSectionFromRequest, findSellerByCode, sectionLabel } from '@/lib/posSections';

// Pantalla de la caja de sección (/seccion). La PC no inicia sesión: manda
// el token con el que se vinculó (header x-section-token). La vendedora se
// identifica con su código de 4 números en cada venta.
//
// GET                         -> datos de la sección + catálogo para escanear
// POST { action: 'identify', code }            -> { seller: { id, name } }
// POST { action: 'sale', code, items, clientName? } -> venta pendiente de cobro

const CATALOG_COLUMNS = 'id, code, name, price, wholesale_price, price_per_size, stock, stock_per_size, color_stock, sizes, colors, barcodes, is_active, image_url';

// Freno a quien prueba códigos al azar: 8 errores seguidos bloquean la
// pantalla 1 minuto (por sección, en la memoria del servidor).
const failures = new Map();
const LOCK_AFTER = 8;
const LOCK_MS = 60 * 1000;

function isLocked(sectionId) {
  const f = failures.get(sectionId);
  return f && f.count >= LOCK_AFTER && Date.now() - f.last < LOCK_MS;
}
function registerFailure(sectionId) {
  const f = failures.get(sectionId);
  const fresh = !f || Date.now() - f.last > LOCK_MS;
  failures.set(sectionId, { count: fresh ? 1 : f.count + 1, last: Date.now() });
}

async function resolveSection(req) {
  if (!supabaseAdmin) return { response: deny(503, 'Servicio no disponible.') };
  const section = await getSectionFromRequest(req, supabaseAdmin);
  if (!section) return { response: deny(401, 'Esta PC no está vinculada a ninguna caja de sección. Pedile el link al administrador.') };
  return { section };
}

async function identify(section, code) {
  if (isLocked(section.id)) return { response: deny(429, 'Demasiados códigos incorrectos. Esperá un minuto.') };
  const seller = await findSellerByCode(supabaseAdmin, section, String(code || '').trim());
  if (!seller) {
    registerFailure(section.id);
    return { response: deny(403, 'Código incorrecto o vendedora no habilitada en esta caja.') };
  }
  failures.delete(section.id);
  return { seller };
}

export async function GET(req) {
  const { section, response } = await resolveSection(req);
  if (response) return response;

  const { data: products, error } = await supabaseAdmin.from('products').select(CATALOG_COLUMNS).order('name');
  if (error) return deny(500, 'No se pudo cargar el catálogo.');

  return NextResponse.json({
    section: { id: section.id, number: section.number, name: section.name, label: sectionLabel(section) },
    products: products || []
  });
}

export async function POST(req) {
  const { section, response } = await resolveSection(req);
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch {
    return deny(400, 'Datos inválidos.');
  }

  const who = await identify(section, body.code);
  if (who.response) return who.response;
  const { seller } = who;

  if (body.action === 'identify') {
    return NextResponse.json({ seller: { id: seller.id, name: seller.name } });
  }

  if (body.action !== 'sale') return deny(400, 'Acción no válida.');

  const rawItems = (Array.isArray(body.items) ? body.items : []).map((it) => ({
    id: it?.id,
    quantity: it?.quantity,
    size: it?.size || null,
    color: it?.color || null,
    priceType: it?.priceType === 'menor' ? 'menor' : 'mayor'
  }));
  const built = await buildLocalSaleLines(supabaseAdmin, rawItems);
  if (built.error) return deny(built.status, built.error);

  const label = sectionLabel(section);
  const sale = {
    id: randomLocalId('LOC'),
    channel: 'local',
    status: 'pendiente_cobro',
    created_at: new Date().toISOString(),
    client_name: String(body.clientName || '').trim().slice(0, 120) || 'Consumidor Final',
    client_phone: '',
    client_dni: '',
    client_locality: 'Rosario',
    delivery_method: 'Venta en el local',
    customer_notes: label,
    items: built.lines,
    total_amount: built.total,
    is_wholesale: built.lines.every((l) => l.price_type !== 'menor'),
    discount_applied: 0,
    stock_issue: false,
    seller_id: seller.id,
    commission_pct: Number(seller.commission_pct) || 0
  };

  let { error: insertErr } = await supabaseAdmin.from('orders').insert(sale);
  if (insertErr?.code === '23505') {
    sale.id = randomLocalId('LOC');
    ({ error: insertErr } = await supabaseAdmin.from('orders').insert(sale));
  }
  if (insertErr) {
    console.error('Caja de sección: error guardando la venta', insertErr);
    await restoreLinesStock(supabaseAdmin, built.lines);
    return deny(500, 'No se pudo guardar la venta. Probá de nuevo.');
  }

  return NextResponse.json({ sale: { ...sale, seller_name: seller.name }, sectionLabel: label });
}
