import { NextResponse } from 'next/server';
import { getStaff, supabaseAdmin, deny, argentinaDayRange } from '@/lib/staffAuth';

// Reporte de ventas cobradas del local entre dos fechas (inclusive):
//   - por vendedora: cantidad de ventas, total vendido y comision
//   - por medio de pago (cierre de caja)
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (por defecto, hoy)
// Caja/admin ven todo; la vendedora, solo lo suyo.
export async function GET(req) {
  const { staff, response } = await getStaff(req);
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const from = argentinaDayRange(searchParams.get('from'));
  const to = argentinaDayRange(searchParams.get('to') || from.day);
  if (to.end <= from.start) return deny(400, 'El rango de fechas es inválido.');

  let query = supabaseAdmin
    .from('orders')
    .select('id, total_amount, payment_method, seller_id, commission_amount, paid_at')
    .eq('channel', 'local')
    .eq('status', 'cobrado')
    .gte('paid_at', from.start)
    .lt('paid_at', to.end);
  if (staff.role === 'vendedora') query = query.eq('seller_id', staff.id);

  const { data: sales, error } = await query.limit(5000);
  if (error) return deny(500, 'No se pudo armar el reporte.');

  const { data: people } = await supabaseAdmin.from('staff').select('id, name, role, commission_pct');
  const personById = Object.fromEntries((people || []).map((p) => [p.id, p]));

  const bySeller = {};
  const byMethod = {};
  let total = 0;
  for (const s of sales || []) {
    const amount = Number(s.total_amount) || 0;
    total += amount;
    const key = s.seller_id || 'sin-asignar';
    if (!bySeller[key]) {
      const person = personById[s.seller_id];
      bySeller[key] = { seller_id: s.seller_id, name: person?.name || 'Sin asignar', commission_pct: person?.commission_pct ?? null, sales: 0, total: 0, commission: 0 };
    }
    bySeller[key].sales += 1;
    bySeller[key].total += amount;
    bySeller[key].commission += Number(s.commission_amount) || 0;
    const method = s.payment_method || 'otro';
    byMethod[method] = (byMethod[method] || 0) + amount;
  }

  return NextResponse.json({
    from: from.day,
    to: to.day,
    total,
    count: (sales || []).length,
    bySeller: Object.values(bySeller).sort((a, b) => b.total - a.total),
    byMethod
  });
}
