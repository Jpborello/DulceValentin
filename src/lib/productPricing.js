// Helpers de precio sin dependencias: se pueden importar tanto desde
// componentes cliente como desde Server Components (paginas de
// categoria/producto que se renderizan en el servidor) sin arrastrar el
// singleton con estado de dataStore.js (que dispara un fetch a Supabase al
// instanciarse). dataStore.js re-exporta estas mismas funciones para no
// romper a nadie que ya las importa desde ahi.

// Precio de un producto para un talle puntual. Si el producto tiene
// `price_per_size` cargado (jsonb: { talle: precio }) y el talle pedido está
// ahí, se usa ese valor — si no, se cae al precio único de siempre
// (wholesale_price || price). Esto es lo que reemplaza el parche de crear
// dos productos separados para un mismo artículo con "talle especial" a
// precio distinto (ej: Calza Negra Lisa).
export function getProductPrice(product, selectedSize) {
  if (!product) return 0;
  const pps = product.price_per_size;
  if (pps && typeof pps === 'object' && selectedSize && pps[selectedSize] !== undefined && pps[selectedSize] !== null) {
    const val = Number(pps[selectedSize]);
    if (!Number.isNaN(val)) return val;
  }
  return Number(product.wholesale_price || product.price || 0);
}

// Rango de precios de un producto (para mostrarlo en la card/listado ANTES
// de que el cliente elija un talle). Si todos los talles tienen el mismo
// precio (o no hay price_per_size), min === max y se puede mostrar como
// precio único de siempre.
export function getProductPriceRange(product) {
  if (!product) return { min: 0, max: 0, hasRange: false };
  const pps = product.price_per_size;
  if (pps && typeof pps === 'object') {
    const vals = Object.values(pps).map(Number).filter((v) => !Number.isNaN(v));
    if (vals.length > 0) {
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      return { min, max, hasRange: min !== max };
    }
  }
  const base = Number(product.wholesale_price || product.price || 0);
  return { min: base, max: base, hasRange: false };
}
