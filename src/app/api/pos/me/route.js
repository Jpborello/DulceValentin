import { NextResponse } from 'next/server';
import { getStaff, supabaseAdmin } from '@/lib/staffAuth';

// Perfil del usuario logueado en la caja + lista de vendedoras activas
// (para que caja/admin elijan a quien se le asigna una venta).
export async function GET(req) {
  const { staff, response } = await getStaff(req);
  if (response) return response;

  let sellers = [];
  if (staff.role !== 'vendedora') {
    const { data } = await supabaseAdmin
      .from('staff')
      .select('id, name, role')
      .eq('active', true)
      .order('name');
    sellers = data || [];
  }

  return NextResponse.json({ staff, sellers });
}
