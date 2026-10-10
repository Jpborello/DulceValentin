'use client';

import { CART_STORAGE_KEY, CART_UPDATED_EVENT, readStoredCart } from './cartStorage';

// "Mis pedidos" y datos del checkout guardados SOLO en este navegador.
// No hay login real (la cuenta es el telefono), asi que en vez de pedirle al
// servidor "los pedidos de tal telefono" (lo podria consultar cualquiera que
// sepa un numero ajeno) se recuerdan los pedidos hechos desde este
// dispositivo. El estado se consulta con /api/track-order, que exige N° de
// pedido + telefono.

const MY_ORDERS_KEY = 'dulcevalentin_my_orders';
const CHECKOUT_PROFILE_KEY = 'dulcevalentin_checkout_profile';
const MAX_ORDERS = 20;

const safeRead = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const safeWrite = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export function getMyOrders() {
  const list = safeRead(MY_ORDERS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveMyOrder(order) {
  if (!order?.id) return;
  const entry = {
    id: order.id,
    phone: order.client_phone,
    created_at: order.created_at,
    total_amount: order.total_amount,
    delivery_method: order.delivery_method,
    items: (order.items || []).map((it) => ({
      id: it.product?.id,
      name: it.product?.name,
      image_url: it.product?.thumb_url || it.product?.image_url || null,
      quantity: it.quantity,
      selectedSize: it.product?.selectedSize || null,
      selectedColor: it.product?.selectedColor || null
    })).filter((it) => it.id)
  };
  const rest = getMyOrders().filter((o) => o.id !== entry.id);
  safeWrite(MY_ORDERS_KEY, [entry, ...rest].slice(0, MAX_ORDERS));
}

export function forgetMyOrder(orderId) {
  safeWrite(MY_ORDERS_KEY, getMyOrders().filter((o) => o.id !== orderId));
}

// "Repetir pedido": suma los productos al carrito guardado (sin precio
// congelado, asi se toma el precio de hoy; el servidor igual revalida stock
// y precio al generar el pedido).
export function addOrderToStoredCart(order) {
  const cart = readStoredCart();
  const keyOf = (t) => `${t.id}::${t.selectedSize || ''}::${t.selectedColor || ''}`;
  (order?.items || []).forEach((it) => {
    const entry = { id: it.id, quantity: Number(it.quantity) || 1, selectedSize: it.selectedSize || null, selectedColor: it.selectedColor || null, unit_price: null };
    const existing = cart.find((t) => keyOf(t) === keyOf(entry));
    if (existing) existing.quantity = (Number(existing.quantity) || 0) + entry.quantity;
    else cart.push(entry);
  });
  safeWrite(CART_STORAGE_KEY, cart);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

// Datos del cliente para no hacerlos tipear de nuevo en la proxima compra.
export function getCheckoutProfile() {
  const p = safeRead(CHECKOUT_PROFILE_KEY, null);
  return p && typeof p === 'object' ? p : null;
}

export function saveCheckoutProfile(profile) {
  safeWrite(CHECKOUT_PROFILE_KEY, {
    name: profile.name || '',
    dni: profile.dni || '',
    phone: profile.phone || '',
    locality: profile.locality || '',
    address: profile.address || '',
    postalCode: profile.postalCode || '',
    floorApt: profile.floorApt || ''
  });
}
