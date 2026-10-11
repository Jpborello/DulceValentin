import { NextResponse } from 'next/server';
import { getStaff, supabaseAdmin, deny } from '@/lib/staffAuth';

// Cancela una venta del local que todavia no se cobro y devuelve el stock.
// La vendedora solo puede cancelar las suyas; caja/admin cualquiera.
// POST { orderId }
export async function POST(req) {
  const { staff, response } = await getStaff(req);
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch {
    return deny(400, 'Datos inválidos.');
  }
  const orderId = String(body.orderId || '').trim().toUpperCase();

  const { data: sale } = await supabaseAdmin
    .from('orders')
    .select('id, status, channel, seller_id, items')
    .eq('id', orderId)
    .maybeSingle();
  if (!sale || sale.channel !== 'local') return deny(404, 'No se encontró la venta.');
  if (staff.role === 'vendedora' && sale.seller_id !== staff.id) return deny(403, 'Solo podés cancelar tus ventas.');
  if (sale.status !== 'pendiente_cobro') return deny(409, 'Solo se pueden cancelar ventas que todavía no se cobraron.');

  const { data: cancelled, error } = await supabaseAdmin
    .from('orders')
    .update({ status: 'cancelado' })
    .eq('id', orderId)
    .eq('status', 'pendiente_cobro')
    .select('id')
    .maybeSingle();
  if (error) return deny(500, 'No se pudo cancelar.');
  if (!cancelled) return deny(409, 'La venta ya no está pendiente.');

  await Promise.all(
    (sale.items || [])
      .filter((it) => it?.product?.id && Number(it.quantity) > 0)
      .map((it) => supabaseAdmin.rpc('restore_variant_stock', {
        p_product_id: it.product.id,
        p_size: it.product.selectedSize || null,
        p_color: it.product.selectedColor || null,
        p_qty: Number(it.quantity)
      }))
  );

  return NextResponse.json({ success: true });
}
