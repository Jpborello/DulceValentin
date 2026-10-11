import { NextResponse } from 'next/server';
import { getStaff, supabaseAdmin, deny } from '@/lib/staffAuth';

// Codigo de barras escaneado -> producto + talle + color (tabla
// product_barcodes). GET ?barcode=2000000000013
export async function GET(req) {
  const { response } = await getStaff(req);
  if (response) return response;

  const barcode = String(new URL(req.url).searchParams.get('barcode') || '').replace(/\D/g, '');
  if (barcode.length < 8) return deny(400, 'Código inválido.');

  const { data: row } = await supabaseAdmin
    .from('product_barcodes')
    .select('barcode, product_id, size, color')
    .eq('barcode', barcode)
    .maybeSingle();
  if (!row) return deny(404, `No hay ninguna prenda con el código ${barcode}.`);

  return NextResponse.json({
    productId: row.product_id,
    size: row.size || null,
    color: row.color || null
  });
}
