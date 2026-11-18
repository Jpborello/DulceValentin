import { getUnitPriceForType } from '@/lib/productPricing';
import { getVariantStock } from '@/lib/catalogData';

// Logica compartida de las ventas del local (orders con channel = 'local'):
// la usan la caja de vendedoras (/api/pos/sales) y la Caja Principal del
// panel (/api/pos). El precio de cada renglon lo calcula siempre el servidor
// (por mayor o por menor) y el stock se descuenta al armar la venta.

export const PRODUCT_COLUMNS = 'id, name, code, category, subcategory, price, wholesale_price, price_per_size, stock, stock_per_size, color_stock, sizes, colors, image_url, thumb_url, is_active';

export function randomLocalId(prefix = 'LOC') {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return `${prefix}-${100000 + (n[0] % 900000)}`;
}

// En la base el medio de pago de seller_sales solo admite efectivo o
// transferencia: tarjeta y otros cuentan como "transferencia" (no es efectivo).
export const ledgerPaymentMethod = (method) => (method === 'efectivo' ? 'efectivo' : 'transferencia');

export async function restoreLinesStock(supabaseAdmin, lines) {
  await Promise.all((lines || []).map((l) => supabaseAdmin.rpc('restore_variant_stock', {
    p_product_id: l.product.id,
    p_size: l.product.selectedSize,
    p_color: l.product.selectedColor,
    p_qty: l.quantity
  })));
}

// rawItems: [{ id, quantity, size, color, priceType: 'mayor' | 'menor' }]
// Devuelve { lines, total } con el stock ya descontado, o { status, error }.
export async function buildLocalSaleLines(supabaseAdmin, rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (items.length === 0) return { status: 400, error: 'La venta no tiene productos.' };
  if (items.length > 200) return { status: 400, error: 'Demasiados renglones.' };

  const ids = [...new Set(items.map((it) => String(it?.id || '')).filter(Boolean))];
  const { data: products, error: productsErr } = await supabaseAdmin.from('products').select(PRODUCT_COLUMNS).in('id', ids);
  if (productsErr) return { status: 500, error: 'No se pudieron verificar los productos.' };
  const productById = new Map((products || []).map((p) => [p.id, p]));

  // Agrupa renglones repetidos (mismo producto/talle/color y mismo tipo de precio).
  const byVariant = new Map();
  const qtyByStockKey = new Map(); // el stock es el mismo para mayor y menor
  for (const raw of items) {
    const product = productById.get(String(raw?.id || ''));
    if (!product) return { status: 409, error: 'Uno de los productos ya no existe.' };
    const quantity = Math.floor(Number(raw.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) return { status: 400, error: `Revisá la cantidad de "${product.name}".` };
    const size = raw.size ? String(raw.size) : null;
    const color = raw.color ? String(raw.color) : null;
    const priceType = raw.priceType === 'menor' ? 'menor' : 'mayor';
    const stockKey = `${product.id}::${size || ''}::${color || ''}`;
    const key = `${stockKey}::${priceType}`;
    const prev = byVariant.get(key);
    byVariant.set(key, { product, size, color, priceType, quantity: (prev?.quantity || 0) + quantity, key: stockKey });
    qtyByStockKey.set(stockKey, (qtyByStockKey.get(stockKey) || 0) + quantity);
  }

  for (const v of byVariant.values()) {
    const available = getVariantStock(v.product, v.size, v.color); // stock fisico (vale aunque no este publicado en la web)
    const wanted = qtyByStockKey.get(v.key);
    if (wanted > available) {
      return { status: 409, error: `"${v.product.name}"${v.size ? ` talle ${v.size}` : ''}${v.color ? ` ${v.color}` : ''}: hay ${available} en stock y se cargaron ${wanted}.` };
    }
  }

  const lines = [];
  for (const v of byVariant.values()) {
    const unitPrice = getUnitPriceForType(v.product, v.size, v.priceType);
    lines.push({
      product: { ...v.product, selectedSize: v.size, selectedColor: v.color, unit_price: unitPrice, price_type: v.priceType },
      quantity: v.quantity,
      variantKey: v.key,
      price_type: v.priceType
    });
  }

  // Descuento de stock (total + talle/color); si algo falla se devuelve.
  const deducted = [];
  for (const line of lines) {
    const { data: ok, error } = await supabaseAdmin.rpc('decrement_variant_stock', {
      p_product_id: line.product.id,
      p_size: line.product.selectedSize,
      p_color: line.product.selectedColor,
      p_qty: line.quantity
    });
    if (error || ok === false) {
      await restoreLinesStock(supabaseAdmin, deducted);
      return { status: 409, error: `"${line.product.name}" se quedó sin stock. Revisá la venta.` };
    }
    deducted.push(line);
  }

  const total = lines.reduce((s, l) => s + l.product.unit_price * l.quantity, 0);
  return { lines, total };
}
