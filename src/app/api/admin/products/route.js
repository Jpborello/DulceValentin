import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Si falta la key en este entorno (deploy nuevo sin las variables cargadas
// todavia), no tiramos abajo el build entero del sitio por esta ruta sola.
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, id, updates, productsList } = body;

    if (action === 'updateProduct') {
      if (!id || !updates) {
        return NextResponse.json({ error: 'Faltan parámetros id o updates' }, { status: 400 });
      }

      const { code, ...dbFields } = updates;

      const { data, error } = await supabaseAdmin
        .from('products')
        .update(dbFields)
        .eq('id', id)
        .select();

      if (error) {
        console.error('API Admin Update Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    if (action === 'upsertProducts') {
      if (!Array.isArray(productsList) || productsList.length === 0) {
        return NextResponse.json({ error: 'Lista de productos vacía' }, { status: 400 });
      }

      const cleanedList = productsList.map(({ sizes, stock_per_size, code, ...dbFields }) => dbFields);

      const { data, error } = await supabaseAdmin
        .from('products')
        .upsert(cleanedList, { onConflict: 'id' })
        .select();

      if (error) {
        console.error('API Admin Upsert Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (err) {
    console.error('API Admin Products Route Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
