'use client';

// Caja sin conexion (2026-11). Si se corta internet, la caja sigue vendiendo:
//  - El catalogo se lee de la ultima copia guardada en este navegador
//    (se actualiza sola cada vez que la caja carga productos con internet;
//    si nunca se guardo, se usa el respaldo del panel).
//  - Cada venta se guarda en una cola en IndexedDB con un numero OFF-XXXXXXXX.
//  - Al volver internet, la cola se sube sola (crear venta y, si se cobro,
//    registrar el cobro). El servidor usa ese mismo numero como id de la
//    venta, asi que si un envio se repite no se duplica.
//  - Si el servidor la rechaza (ej: esa prenda ya se vendio por la web), la
//    venta queda en la cola marcada con el error para que la revise la caja.

import { idbGet, idbSet, loadLocalSnapshot } from '@/lib/localDatabase';
import { getUnitPriceForType } from '@/lib/productPricing';
import { getVariantStock } from '@/lib/catalogData';

const CATALOG_KEY = 'pos_catalog';
const QUEUE_KEY = 'pos_offline_queue';
const ME_KEY = 'dv_pos_me';
export const QUEUE_EVENT = 'dv:pos-queue-change';

// ------------------------------------------------------------ red
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

// fetch tira TypeError cuando no hay red (no cuando el servidor responde un error).
export function isNetworkError(err) {
  return err?.name === 'TypeError' || err?.isNetwork === true || isOffline();
}

// ------------------------------------------------------------ sesion cacheada
export function cacheMe(userId, staff, sellers) {
  try {
    localStorage.setItem(ME_KEY, JSON.stringify({ userId, staff, sellers, savedAt: new Date().toISOString() }));
  } catch {}
}

export function readCachedMe(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(ME_KEY) || 'null');
    return raw && raw.userId === userId ? raw : null;
  } catch {
    return null;
  }
}

export function clearCachedMe() {
  try { localStorage.removeItem(ME_KEY); } catch {}
}

// ------------------------------------------------------------ catalogo
export async function savePosCatalog(products) {
  if (!Array.isArray(products) || products.length === 0) return;
  try {
    await idbSet(CATALOG_KEY, { savedAt: new Date().toISOString(), products });
  } catch (err) {
    console.warn('No se pudo guardar el catálogo de la caja para usar sin internet:', err);
  }
}

// { products, savedAt, source: 'caja' | 'respaldo' } o null
export async function loadPosCatalog() {
  try {
    const cached = await idbGet(CATALOG_KEY);
    if (cached?.products?.length) return { ...cached, source: 'caja' };
  } catch {}
  try {
    const snap = await loadLocalSnapshot();
    const products = snap?.data?.products;
    if (Array.isArray(products) && products.length) {
      return { products: products.filter((p) => p.is_active !== false), savedAt: snap.exportedAt, source: 'respaldo' };
    }
  } catch {}
  return null;
}

// ------------------------------------------------------------ cola
let queueLock = Promise.resolve();
// Serializa lecturas/escrituras de la cola dentro de esta pestaña.
function withQueue(fn) {
  const run = queueLock.then(async () => {
    const queue = (await idbGet(QUEUE_KEY)) || [];
    const result = await fn(queue);
    if (result?.save) {
      await idbSet(QUEUE_KEY, result.queue);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(QUEUE_EVENT));
    }
    return result?.value;
  });
  queueLock = run.catch(() => {});
  return run;
}

export function getQueue() {
  return withQueue(async (queue) => ({ value: queue }));
}

function newOfflineId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return 'OFF-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

// Unidades de cada variante ya vendidas en la cola sin subir: se descuentan
// del stock del catalogo guardado para no vender dos veces la misma prenda.
export function reservedByVariant(queue) {
  const map = new Map();
  for (const entry of queue || []) {
    for (const it of entry.request?.items || []) {
      const key = `${it.id}::${it.size || ''}::${it.color || ''}`;
      map.set(key, (map.get(key) || 0) + Number(it.quantity || 0));
    }
  }
  return map;
}

/**
 * Arma y encola una venta hecha sin internet. Valida stock contra el catalogo
 * guardado menos lo ya vendido en la cola. Devuelve la venta (mismo formato
 * que la del servidor) para mostrarla y cobrarla.
 */
export function queueOfflineSale({ lines, productById, seller, me, clientName, clientPhone, notes }) {
  return withQueue(async (queue) => {
    const reserved = reservedByVariant(queue);
    const items = [];
    const saleLines = [];
    for (const l of lines) {
      const p = productById.get(l.productId);
      if (!p) throw new Error('Uno de los productos no está en el catálogo guardado.');
      const key = `${p.id}::${l.size || ''}::${l.color || ''}`;
      const available = getVariantStock(p, l.size, l.color) - (reserved.get(key) || 0);
      if (l.quantity > available) {
        throw new Error(`"${p.name}"${l.size ? ` talle ${l.size}` : ''}${l.color ? ` ${l.color}` : ''}: según la última copia quedan ${Math.max(0, available)} y se cargaron ${l.quantity}.`);
      }
      reserved.set(key, (reserved.get(key) || 0) + l.quantity);
      const priceType = l.priceType === 'menor' ? 'menor' : 'mayor';
      const unitPrice = getUnitPriceForType(p, l.size, priceType);
      items.push({ id: p.id, quantity: l.quantity, size: l.size, color: l.color, priceType });
      saleLines.push({
        product: { id: p.id, name: p.name, code: p.code, selectedSize: l.size, selectedColor: l.color, unit_price: unitPrice, price_type: priceType },
        quantity: l.quantity,
        price_type: priceType
      });
    }

    const offlineId = newOfflineId();
    const createdAt = new Date().toISOString();
    const total = saleLines.reduce((s, l) => s + l.product.unit_price * l.quantity, 0);
    const entry = {
      offlineId,
      createdAt,
      createdBy: me.id,
      request: { items, sellerId: seller.id, clientName, clientPhone, notes },
      charge: null,
      stage: 'create', // 'create' -> 'charge' -> (se borra de la cola)
      error: null,
      warning: null,
      sale: {
        id: offlineId,
        offline: true,
        created_at: createdAt,
        status: 'pendiente_cobro',
        total_amount: total,
        items: saleLines,
        client_name: clientName || 'Venta en el local',
        client_phone: clientPhone || '',
        customer_notes: notes || null,
        seller_id: seller.id,
        seller_name: seller.name
      }
    };
    return { save: true, queue: [...queue, entry], value: entry.sale };
  });
}

// Registra el cobro de una venta de la cola (sin internet).
export function chargeOfflineSale(offlineId, { paymentMethod, cashReceived, cashierName }) {
  return withQueue(async (queue) => {
    const entry = queue.find((e) => e.offlineId === offlineId);
    if (!entry) throw new Error('No se encontró la venta en la cola sin conexión.');
    if (entry.charge) throw new Error('Esta venta ya fue cobrada.');
    const total = Number(entry.sale.total_amount) || 0;
    if (paymentMethod === 'efectivo' && cashReceived !== null && cashReceived < total) {
      throw new Error('El efectivo recibido es menor al total.');
    }
    const paidAt = new Date().toISOString();
    entry.charge = { paymentMethod, cashReceived, paidAt };
    entry.sale = { ...entry.sale, status: 'cobrado', payment_method: paymentMethod, cash_received: cashReceived, paid_at: paidAt, cashier_name: cashierName };
    return {
      save: true,
      queue,
      value: { paid_at: paidAt, change: cashReceived !== null ? Math.round((cashReceived - total) * 100) / 100 : null }
    };
  });
}

// Cobro sin internet de una venta que SI estaba subida (se armo con internet
// y despues se corto): se encola solo el cobro.
export function queueOfflineCharge(sale, { paymentMethod, cashReceived, cashierName, me }) {
  return withQueue(async (queue) => {
    if (queue.some((e) => e.offlineId === sale.id)) throw new Error('Esta venta ya fue cobrada sin conexión.');
    const total = Number(sale.total_amount) || 0;
    if (paymentMethod === 'efectivo' && cashReceived !== null && cashReceived < total) {
      throw new Error('El efectivo recibido es menor al total.');
    }
    const paidAt = new Date().toISOString();
    const entry = {
      offlineId: sale.id,
      createdAt: paidAt,
      createdBy: me.id,
      request: null,
      charge: { paymentMethod, cashReceived, paidAt },
      stage: 'charge',
      error: null,
      warning: null,
      sale: { ...sale, offline: true, status: 'cobrado', payment_method: paymentMethod, cash_received: cashReceived, paid_at: paidAt, cashier_name: cashierName }
    };
    return {
      save: true,
      queue: [...queue, entry],
      value: { paid_at: paidAt, change: cashReceived !== null ? Math.round((cashReceived - total) * 100) / 100 : null }
    };
  });
}

// Cancelar una venta que todavia no se subio: solo se saca de la cola.
export function removeFromQueue(offlineId) {
  return withQueue(async (queue) => ({ save: true, queue: queue.filter((e) => e.offlineId !== offlineId) }));
}

export function clearQueueFlags(offlineId) {
  return withQueue(async (queue) => {
    const entry = queue.find((e) => e.offlineId === offlineId);
    if (entry) { entry.error = null; entry.warning = null; }
    return { save: true, queue };
  });
}

// ------------------------------------------------------------ sincronizacion
let syncing = false;

/**
 * Sube la cola al servidor. api(path, options) es el mismo helper de la caja
 * (tira Error con el mensaje del servidor). Devuelve un resumen.
 */
export async function syncOfflineQueue(api) {
  if (syncing || isOffline()) return { skipped: true };
  syncing = true;
  const summary = { synced: 0, failed: 0, stoppedByNetwork: false, warnings: [] };
  try {
    const queue = await getQueue();
    for (const snapshot of queue) {
      // Las que ya tienen error esperan a que la caja toque "Reintentar".
      if (snapshot.error) continue;
      try {
        let stage = snapshot.stage;
        let warning = null;

        if (stage === 'create') {
          const { sale } = await api('/api/pos/sales', {
            method: 'POST',
            body: JSON.stringify({
              ...snapshot.request,
              offlineId: snapshot.offlineId,
              offlineCreatedAt: snapshot.createdAt
            })
          });
          if (Math.abs(Number(sale.total_amount) - Number(snapshot.sale.total_amount)) > 0.009) {
            warning = `El total quedó en $${Number(sale.total_amount).toLocaleString('es-AR')} (con precios actuales) y se cobró $${Number(snapshot.sale.total_amount).toLocaleString('es-AR')} sin conexión.`;
          }
          stage = snapshot.charge ? 'charge' : 'done';
          await withQueue(async (q) => {
            const e = q.find((x) => x.offlineId === snapshot.offlineId);
            if (e) { e.stage = stage; e.warning = warning; }
            return { save: true, queue: q };
          });
        }

        if (stage === 'charge') {
          await api('/api/pos/sales/charge', {
            method: 'POST',
            body: JSON.stringify({
              orderId: snapshot.offlineId,
              paymentMethod: snapshot.charge.paymentMethod,
              cashReceived: snapshot.charge.cashReceived,
              offlinePaidAt: snapshot.charge.paidAt
            })
          });
          stage = 'done';
        }

        if (stage === 'done') {
          await removeFromQueue(snapshot.offlineId);
          summary.synced += 1;
          if (warning) summary.warnings.push(`${snapshot.offlineId}: ${warning}`);
        }
      } catch (err) {
        if (isNetworkError(err)) {
          summary.stoppedByNetwork = true;
          break;
        }
        summary.failed += 1;
        await withQueue(async (q) => {
          const e = q.find((x) => x.offlineId === snapshot.offlineId);
          if (e) e.error = err.message || 'Error al subir la venta.';
          return { save: true, queue: q };
        });
      }
    }
  } finally {
    syncing = false;
  }
  return summary;
}
