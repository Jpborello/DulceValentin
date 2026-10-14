// Verifica si un producto está exento de la regla de compra mínima de 3 unidades.
// Aplica si está marcado como exempt_from_min3 en la base de datos o si pertenece
// a la categoría PROMOS o es una promo/pack/combo tipo 2x1 o 3x1.
export function isProductExemptFromMin3(product) {
  if (!product) return false;
  if (product.exempt_from_min3 === true) return true;
  const cat = String(product.category || '').toUpperCase();
  if (cat === 'PROMOS' || cat.includes('PROMO')) return true;
  const name = String(product.name || '').toUpperCase();
  if (/\b2X|\b3X|PROMO|COMBO|PACK/.test(name)) return true;
  return false;
}

// Regla del x3 para el precio mayorista, sin dependencias: la usan el
// carrito (cliente) y /api/orders (servidor), que vuelve a validarla para no
// confiar en lo que manda el navegador. cartStorage.js la re-exporta.
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

  const minQtyQualifyingItems = cartItems.filter((item) => !isProductExemptFromMin3(item.product));
  if (minQtyQualifyingItems.length === 0) {
    // Si todos los productos están exentos (ej: promos, medias, packs), califica automáticamente
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
