'use client';

// Carrito guardado en el navegador (mismo formato que usa la home en
// src/app/page.jsx). Permite agregar productos desde otras paginas (por
// ejemplo /producto/...) sin mandar al cliente a la home para comprar.

export const CART_STORAGE_KEY = 'dulcevalentin_cart';
export const CART_UPDATED_EVENT = 'dv-cart-updated';

const variantKey = (t) => `${t.id}::${t.selectedSize || ''}::${t.selectedColor || ''}`;

export function readStoredCart() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function countStoredCart() {
  return readStoredCart().reduce((sum, t) => sum + (Number(t.quantity) || 1), 0);
}

// product: el objeto que entrega ProductDetailModal al agregar (incluye
// selectedSize, selectedColor y unit_price ya calculado).
export function addToStoredCart(product, quantity = 1) {
  if (!product || (Number(product.stock) || 0) <= 0) return false;
  const items = readStoredCart();
  const entry = {
    id: product.id,
    quantity,
    selectedSize: product.selectedSize || null,
    selectedColor: product.selectedColor || null,
    unit_price: product.unit_price != null ? product.unit_price : null
  };
  const key = variantKey(entry);
  const existing = items.find((t) => variantKey(t) === key);
  if (existing) {
    existing.quantity = (Number(existing.quantity) || 1) + quantity;
  } else {
    items.push(entry);
  }
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function evaluateWholesaleRule(cartItems = []) {
  if (!cartItems || cartItems.length === 0) {
    return {
      hasMinQtyItem: false,
      closestGroup: null,
      closestMinQtyItem: null,
      qualifyingCount: 0,
      unitsNeededForMinQty: 3,
      progressPercent: 0
    };
  }

  const minQtyQualifyingItems = cartItems.filter((item) => !item.product?.exempt_from_min3);
  if (minQtyQualifyingItems.length === 0) {
    // Si todos los productos están exentos (ej: medias, packs), califica automáticamente
    return {
      hasMinQtyItem: true,
      closestGroup: null,
      closestMinQtyItem: null,
      qualifyingCount: 3,
      unitsNeededForMinQty: 0,
      progressPercent: 100
    };
  }

  const unitsByProduct = minQtyQualifyingItems.reduce((acc, item) => {
    const id = item.product?.id;
    if (!id) return acc;
    if (!acc[id]) acc[id] = { total: 0, lines: [] };
    acc[id].total += Number(item.quantity) || 0;
    acc[id].lines.push(item);
    return acc;
  }, {});

  const productGroups = Object.values(unitsByProduct);
  const hasMinQtyItem = productGroups.some((g) => g.total >= 3);
  const closestGroup = productGroups.reduce((best, g) => (!best || g.total > best.total ? g : best), null);
  const closestMinQtyItem = closestGroup
    ? closestGroup.lines.reduce((best, item) => (!best || item.quantity > best.quantity ? item : best), null)
    : null;
  const qualifyingCount = closestGroup ? closestGroup.total : 0;
  const unitsNeededForMinQty = closestGroup ? Math.max(0, 3 - closestGroup.total) : 3;
  const progressPercent = hasMinQtyItem ? 100 : Math.min(90, Math.round((qualifyingCount / 3) * 100));

  return {
    hasMinQtyItem,
    closestGroup,
    closestMinQtyItem,
    qualifyingCount,
    unitsNeededForMinQty,
    progressPercent
  };
}
