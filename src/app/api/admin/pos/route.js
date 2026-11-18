import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';
import {
  getSections,
  saveSections,
  getSellerCodes,
  saveSellerCodes,
  sectionLabel,
  hashSecret,
  isValidSellerCode,
  newSectionToken
} from '@/lib/posSections';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const DEFAULT_SUPERVISOR_PIN = '1234';

export async function GET(req) {
  const denied = await requireAdmin(req, supabaseAdmin);
  if (denied) return denied;

  try {
    // 1. PIN de supervisor
    let supervisorPin = DEFAULT_SUPERVISOR_PIN;
    let hasCustomPin = false;
    try {
      const { data: configRow } = await supabaseAdmin
        .from('pos_config')
        .select('value')
        .eq('key', 'supervisor_pin')
        .maybeSingle();
      if (configRow?.value?.pin) {
        supervisorPin = String(configRow.value.pin);
        hasCustomPin = true;
      }
    } catch (_) {}

    // 2. Cajeros
    let cashiers = [];
    try {
      const { data: cashierRows } = await supabaseAdmin
        .from('pos_cashiers')
        .select('*')
        .eq('active', true)
        .order('code', { ascending: true });
      if (Array.isArray(cashierRows)) cashiers = cashierRows;
    } catch (_) {}

    // 3. Historial de turnos recientes
    let shifts = [];
    try {
      const { data: shiftRows } = await supabaseAdmin
        .from('pos_shifts')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(30);
      if (Array.isArray(shiftRows)) shifts = shiftRows;
    } catch (_) {}

    // 4. Cajas de sección y qué vendedoras tienen código (nunca el código en sí)
    let sections = [];
    let sellersWithCode = [];
    try {
      sections = (await getSections(supabaseAdmin)).map(({ tokenHash, ...s }) => ({ ...s, linked: !!tokenHash, label: sectionLabel(s) }));
      sellersWithCode = Object.keys(await getSellerCodes(supabaseAdmin));
    } catch (_) {}

    return NextResponse.json({
      success: true,
      supervisorPin,
      hasCustomPin,
      cashiers,
      shifts,
      sections,
      sellersWithCode
    });
  } catch (err) {
    console.error('API Admin POS GET Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  const denied = await requireAdmin(req, supabaseAdmin);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { action } = body;

    // A. AGREGAR CAJERO
    if (action === 'addCashier') {
      const { code, name, dni, phone, email } = body;
      const cleanCode = String(code || '').trim();
      const cleanName = String(name || '').trim();

      if (!cleanCode || !cleanName) {
        return NextResponse.json({ error: 'Código y Nombre son obligatorios.' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('pos_cashiers')
        .insert({
          code: cleanCode,
          name: cleanName,
          dni: dni || null,
          phone: phone || null,
          email: email || null,
          active: true
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: `El código ${cleanCode} ya está en uso por otro cajero.` }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, cashier: data });
    }

    // B. DESACTIVAR CAJERO
    if (action === 'deleteCashier') {
      const { code } = body;
      if (!code) return NextResponse.json({ error: 'Falta el código de cajero.' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('pos_cashiers')
        .update({ active: false })
        .eq('code', String(code).trim());

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // C. ACTUALIZAR PIN DE SUPERVISOR
    if (action === 'updatePin') {
      const { pin } = body;
      const cleanPin = String(pin || '').trim();
      if (cleanPin.length < 4) {
        return NextResponse.json({ error: 'El PIN debe tener al menos 4 dígitos.' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('pos_config')
        .upsert({
          key: 'supervisor_pin',
          value: { pin: cleanPin },
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // D. GUARDAR CÓDIGOS DE BARRA DE UN PRODUCTO
    if (action === 'saveProductBarcodes') {
      const { productId, barcodes } = body;
      if (!productId || typeof barcodes !== 'object') {
        return NextResponse.json({ error: 'Faltan parámetros.' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('products')
        .update({ barcodes })
        .eq('id', productId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // D2. GUARDAR CÓDIGOS DE BARRA EN LOTE (BATCH)
    if (action === 'batchSaveBarcodes') {
      const { updates } = body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: 'Faltan parámetros de lote.' }, { status: 400 });
      }

      let updatedCount = 0;
      for (const item of updates) {
        if (!item.productId || typeof item.barcodes !== 'object') continue;
        const { error } = await supabaseAdmin
          .from('products')
          .update({ barcodes: item.barcodes })
          .eq('id', item.productId);
        if (!error) updatedCount += 1;
      }

      return NextResponse.json({ success: true, count: updatedCount });
    }

    // F. CAJAS DE SECCIÓN: crear / editar (nombre, activa, vendedoras)
    if (action === 'saveSection') {
      const name = String(body.name || '').trim().slice(0, 40);
      if (!name) return NextResponse.json({ error: 'Poné el nombre de la sección.' }, { status: 400 });
      const sellerIds = [...new Set((Array.isArray(body.sellerIds) ? body.sellerIds : []).map(String))];
      if (sellerIds.length > 0) {
        const { data: valid } = await supabaseAdmin.from('staff').select('id').in('id', sellerIds);
        if ((valid || []).length !== sellerIds.length) return NextResponse.json({ error: 'Alguna vendedora no existe.' }, { status: 400 });
      }

      const list = await getSections(supabaseAdmin);
      let section = body.id ? list.find((s) => s.id === body.id) : null;
      if (body.id && !section) return NextResponse.json({ error: 'No existe esa sección.' }, { status: 404 });
      if (!section) {
        const number = list.reduce((m, s) => Math.max(m, Number(s.number) || 0), 0) + 1;
        section = { id: `s${Date.now().toString(36)}`, number, tokenHash: null };
        list.push(section);
      }
      section.name = name;
      section.active = body.active !== false;
      section.sellerIds = sellerIds;
      await saveSections(supabaseAdmin, list);
      const { tokenHash, ...publicSection } = section;
      return NextResponse.json({ success: true, section: { ...publicSection, linked: !!tokenHash, label: sectionLabel(section) } });
    }

    // G. LINK PARA VINCULAR LA PC DE UNA SECCIÓN (el anterior deja de andar)
    if (action === 'sectionLink') {
      const list = await getSections(supabaseAdmin);
      const section = list.find((s) => s.id === body.id);
      if (!section) return NextResponse.json({ error: 'No existe esa sección.' }, { status: 404 });
      const token = newSectionToken();
      section.tokenHash = hashSecret(`section:${token}`);
      await saveSections(supabaseAdmin, list);
      return NextResponse.json({ success: true, token });
    }

    // H. CÓDIGO DE 4 NÚMEROS DE UNA VENDEDORA (code vacío = quitarlo)
    if (action === 'setSellerCode') {
      const staffId = String(body.staffId || '');
      const { data: person } = await supabaseAdmin.from('staff').select('id').eq('id', staffId).maybeSingle();
      if (!person) return NextResponse.json({ error: 'No existe esa vendedora.' }, { status: 404 });

      const codes = await getSellerCodes(supabaseAdmin);
      const code = String(body.code ?? '').trim();
      if (!code) {
        delete codes[staffId];
      } else {
        if (!isValidSellerCode(code)) return NextResponse.json({ error: 'El código tiene que ser de 4 números.' }, { status: 400 });
        const hash = hashSecret(`seller:${code}`);
        if (Object.entries(codes).some(([id, h]) => id !== staffId && h === hash)) {
          return NextResponse.json({ error: 'Ese código ya lo tiene otra vendedora. Elegí otro.' }, { status: 409 });
        }
        codes[staffId] = hash;
      }
      await saveSellerCodes(supabaseAdmin, codes);
      return NextResponse.json({ success: true });
    }

    // E. ANULAR VENTA DESDE EL POS
    if (action === 'voidSale') {
      const { orderId } = body;
      if (!orderId) return NextResponse.json({ error: 'Falta orderId.' }, { status: 400 });

      const { data: order, error: fetchErr } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (fetchErr || !order) {
        return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });
      }

      if (order.status === 'cancelado') {
        return NextResponse.json({ error: 'Esta venta ya fue anulada.' }, { status: 400 });
      }

      // 1. Restaurar stock de cada variante
      const items = Array.isArray(order.items) ? order.items : [];
      for (const it of items) {
        const prodId = it.product?.id || it.productId;
        const qty = Number(it.quantity) || 1;
        const size = it.size || it.product?.selectedSize || null;
        const color = it.color || it.product?.selectedColor || null;

        try {
          await supabaseAdmin.rpc('restore_variant_stock', {
            p_product_id: prodId,
            p_size: size,
            p_color: color,
            p_qty: qty
          });
        } catch (_) {
          // Fallback a products.stock si no está la rpc
          try {
            const { data: cur } = await supabaseAdmin.from('products').select('stock').eq('id', prodId).single();
            if (cur) {
              await supabaseAdmin.from('products').update({ stock: (cur.stock || 0) + qty }).eq('id', prodId);
            }
          } catch (e) {}
        }
      }

      // 2. Marcar orden como cancelada
      const { error: updErr } = await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelado' })
        .eq('id', orderId);

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

      return NextResponse.json({ success: true, orderId });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (err) {
    console.error('API Admin POS POST Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

