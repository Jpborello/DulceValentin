import { supabase } from '@/lib/supabaseClient';
import { buildProductSlug } from '@/lib/productSlug';
import { slugify } from '@/lib/slugify';

const SITE_URL = 'https://www.dulcevalentin.com.ar';

export default async function sitemap() {
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('id, name, category, subcategory, updated_at').eq('is_active', true),
    supabase.from('categories').select('id').not('id', 'like', '_config_%')
  ]);

  const productEntries = (products || []).map((p) => ({
    url: `${SITE_URL}/producto/${buildProductSlug(p)}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8
  }));

  // Solo se listan categorias/subcategorias que tienen al menos un producto
  // activo, para no mandarle a Google paginas vacias.
  const categoryIds = new Set((categories || []).map((c) => c.id));
  const withProducts = new Set();
  const subWithProducts = new Set();
  (products || []).forEach((p) => {
    if (categoryIds.has(p.category)) {
      withProducts.add(p.category);
      if (p.subcategory) subWithProducts.add(`${p.category}/${p.subcategory}`);
    }
  });

  const categoryEntries = Array.from(withProducts).map((catId) => ({
    url: `${SITE_URL}/categoria/${slugify(catId)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.7
  }));

  const subcategoryEntries = Array.from(subWithProducts).map((key) => {
    const [catId, sub] = key.split('/');
    return {
      url: `${SITE_URL}/categoria/${slugify(catId)}/${slugify(sub)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6
    };
  });

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1
    },
    ...categoryEntries,
    ...subcategoryEntries,
    ...productEntries
  ];
}
