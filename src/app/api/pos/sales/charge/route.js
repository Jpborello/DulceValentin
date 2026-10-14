import { NextResponse } from 'next/server';
import { getStaff, supabaseAdmin, deny, argentinaDayRange } from '@/lib/staffAuth';

const METHODS = ['efectivo', 'transferencia'];

// Cobro de una venta del local (solo cajera o admin).
// POST { orderId, paymentMethod: 'efectivo' | 'transferencia', cashReceived? }
// Fija la comision con el % que tenia la vendedora al crear la venta.
export async function POST(req) {
  const { staff, response } = await getStaff(req, ['admin', 'cajera']);
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch {
    return deny(400, 'Datos inválidos.');
  }

  const orderId = String(body.orderId || '').trim().toUpperCase();
  const paymentMethod = String(body.paymentMethod || '');
  if (!orderId || !METHODS.includes(paymentMethod)) return deny(400, 'Elegí el medio de pago.');

  const { data: sale } = await supabaseAdmin
    .from('orders')
    .select('id, status, channel, total_amount, commission_pct, seller_id, client_name')
    .eq('id', orderId)
    .maybeSingle();
  if (!sale || sale.channel !== 'local') return deny(404, 'No se encontró la venta.');
  if (sale.status !== 'pendiente_cobro') return deny(409, 'Esta venta ya fue cobrada o cancelada.');

  const total = Number(sale.total_amount) || 0;
  let cashReceived = null;
  if (paymentMethod === 'efectivo' && body.cashReceived !== undefined && body.cashReceived !== null && body.cashReceived !== '') {
    cashReceived = Number(body.cashReceived);
    if (!Number.isFinite(cashReceived) || cashReceived < total) return deny(400, 'El efectivo recibido es menor al total.');
  }

  const commissionAmount = Math.round(total * (Number(sale.commission_pct) || 0)) / 100;
  const paidAt = new Date().toISOString();

  // Solo si sigue pendiente: dos cajas no pueden cobrar la misma venta.
  const { data: updated, error } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'cobrado',
      payment_method: paymentMethod,
      cash_received: cashReceived,
      paid_at: paidAt,
      cashier_id: staff.id,
      commission_amount: commissionAmount
    })
    .eq('id', orderId)
    .eq('status', 'pendiente_cobro')
    .select('id')
    .maybeSingle();
  if (error) return deny(500, 'No se pudo registrar el cobro.');
  if (!updated) return deny(409, 'Esta venta ya fue cobrada o cancelada.');

  // Sincronización automática con /ventas (seller_sales):
  // Si la venta tiene vendedora asignada, registramos el movimiento en el libro contable
  // para que impacte de inmediato en su comisión, el ranking y el arqueo de caja.
  if (sale.seller_id && total > 0) {
    const saleDate = argentinaDayRange().day;
    const clientRef = crypto.randomUUID();
    const note = `Venta mostrador #${orderId}${sale.client_name ? ` (${sale.client_name})` : ''}`;
    try {
      const { error: syncErr } = await supabaseAdmin.from('seller_sales').insert({
        client_ref: clientRef,
        seller_id: sale.seller_id,
        sale_date: saleDate,
        amount: total,
        payment_method: paymentMethod,
        note,
        created_by: staff.id
      });
      if (syncErr) {
        console.error('POS charge: error al registrar en seller_sales:', syncErr);
      }
    } catch (syncEx) {
      console.error('POS charge: excepción al registrar en seller_sales:', syncEx);
    }
  }

  return NextResponse.json({
    success: true,
    paid_at: paidAt,
    change: cashReceived !== null ? Math.round((cashReceived - total) * 100) / 100 : null,
    commission_amount: commissionAmount
  });
}
