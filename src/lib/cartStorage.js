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

// La regla del x3 vive en wholesaleRule.js (sin 'use client') para que
// tambien la pueda usar /api/orders en el servidor.
export { evaluateWholesaleRule, isProductExemptFromMin3 } from './wholesaleRule';
