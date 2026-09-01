// Genera y parsea los slugs de las URLs individuales de producto
// (/producto/[slug]), con el nombre incluido solo para lectura/SEO: la
// busqueda real siempre se hace por el id, que son los primeros dos
// segmentos del slug (ej "p-0050-campera-algodon-adidas" -> "p-0050").
// Asi un link ya compartido sigue funcionando aunque el nombre del
// producto cambie despues.

import { slugify } from './slugify';

export const slugifyName = slugify;

export function buildProductSlug(product) {
  const namePart = slugifyName(product?.name);
  return namePart ? `${product.id}-${namePart}` : product.id;
}

export function getProductUrlPath(product) {
  return `/producto/${buildProductSlug(product)}`;
}
