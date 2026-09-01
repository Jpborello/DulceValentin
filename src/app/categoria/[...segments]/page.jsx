import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { slugify } from '@/lib/slugify';
import { buildProductSlug } from '@/lib/productSlug';
import ShareCategoryButton from '@/components/ShareCategoryButton';

const SITE_URL = 'https://www.dulcevalentin.com.ar';

// Las categorias reales viven en la tabla "categories" de Supabase (el admin
// las puede editar), pero esa misma tabla tambien guarda configuracion
// interna con ids "_config_..." (alias de transferencia, CUIT, etc.) que
// hay que descartar aca.
async function getCategoryDef(catSlug) {
  const { data } = await supabase
    .from('categories')
    .select('id, name, subcategories')
    .not('id', 'like', '_config_%');
  if (!data) return null;
  return data.find((c) => slugify(c.id) === catSlug) || null;
}

async function resolveParams(segments) {
  const [catSlug, subSlug] = segments || [];
  const categoryDef = await getCategoryDef(catSlug);
  if (!categoryDef) return null;

  let subcategory = null;
  if (subSlug) {
    subcategory = (categoryDef.subcategories || []).find((s) => slugify(s) === subSlug);
    if (!subcategory) return null;
  }

  return { categoryId: categoryDef.id, categoryName: categoryDef.name, subcategory };
}

async function getProducts(categoryId, subcategory) {
  let query = supabase
    .from('products')
    .select('id, name, image_url, price, wholesale_price, stock, is_new')
    .eq('category', categoryId)
    .eq('is_active', true);
  if (subcategory) query = query.eq('subcategory', subcategory);
  // Los marcados "Nuevo Ingreso" (is_new) van primero, y adentro de cada
  // grupo se mantiene el orden alfabetico de siempre.
  const { data } = await query.order('is_new', { ascending: false }).order('name');
  return data || [];
}

export async function generateMetadata({ params }) {
  const { segments } = await params;
  const resolved = await resolveParams(segments);
  if (!resolved) return {};

  const { categoryName, subcategory } = resolved;
  const label = subcategory ? `${subcategory} de ${categoryName}` : categoryName;
  const title = `${label} — Venta Mayorista`;
  const description = `Comprá ${label.toLowerCase()} al por mayor en Dulce Valentín: precios de fábrica, envíos a todo el país y retiro en Rosario, Santa Fe.`;
  const canonicalPath = `/categoria/${segments.join('/')}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'website',
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'Dulce Valentín',
      title: `${title} | Dulce Valentín`,
      description
    }
  };
}

export default async function CategoryPage({ params }) {
  const { segments } = await params;
  if (!segments || segments.length === 0 || segments.length > 2) notFound();

  const resolved = await resolveParams(segments);
  if (!resolved) notFound();

  const { categoryId, categoryName, subcategory } = resolved;
  const products = await getProducts(categoryId, subcategory);
  const canonicalPath = `/categoria/${segments.join('/')}`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: categoryName, item: `${SITE_URL}/categoria/${segments[0]}` },
      ...(subcategory ? [{ '@type': 'ListItem', position: 3, name: subcategory, item: `${SITE_URL}${canonicalPath}` }] : [])
    ]
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `${SITE_URL}/producto/${buildProductSlug(p)}`
    }))
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <header className="header-container">
        <div className="header-top">
          📍 ROSARIO (SANTA FE) — CAMILO ALDAO 2715 ESQ. EX GODOY
        </div>
        <div className="header-content">
          <Link href="/" className="brand-logo-wrapper">
            <img src="/logo.png" alt="Logo Dulce Valentín" className="brand-logo-img" />
            <div>
              <div className="brand-title">Dulce Valentín</div>
              <div className="brand-subtitle">Indumentaria Mayorista</div>
            </div>
          </Link>
          <Link href="/" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={16} /> Ver todo el catálogo
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: '1320px', width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        <nav aria-label="breadcrumb" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
          <Link href="/" style={{ color: 'var(--accent-gold-hover)', fontWeight: 600 }}>Inicio</Link>
          {' / '}
          {subcategory ? (
            <>
              <Link href={`/categoria/${segments[0]}`} style={{ color: 'var(--accent-gold-hover)', fontWeight: 600 }}>{categoryName}</Link>
              {' / '}{subcategory}
            </>
          ) : categoryName}
        </nav>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-main)' }}>
            {subcategory ? `${subcategory} de ${categoryName}` : categoryName}
          </h1>
          <ShareCategoryButton
            label={subcategory ? `${subcategory} de ${categoryName}` : categoryName}
            productCount={products.length}
          />
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          {products.length} producto{products.length !== 1 ? 's' : ''} disponible{products.length !== 1 ? 's' : ''} — precio mayorista, mínimo de compra $50.000 en pedidos por la web.
        </p>

        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              No hay productos disponibles en esta categoría por el momento.
            </p>
          </div>
        ) : (
          <div className="products-grid">
            {products.map((product, idx) => (
              <Link
                key={product.id}
                href={`/producto/${buildProductSlug(product)}`}
                className={`product-card product-card-blob-${(idx % 6) + 1}`}
                style={{ textDecoration: 'none' }}
              >
                <div className="product-img-wrapper" style={{ position: 'relative' }}>
                  {product.is_new && (
                    <div className="card-badges-topleft">
                      <span className="card-badge-new">🆕 Nuevo</span>
                    </div>
                  )}
                  {product.image_url && (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 280px"
                      className="product-img"
                    />
                  )}
                </div>
                <div className="product-card-footer" style={{ padding: 0 }}>
                  <h3 className="product-title-compact" style={{ minHeight: 0, flex: 1 }}>{product.name}</h3>
                  <span className="price-compact">
                    ${Number(product.wholesale_price || product.price || 0).toLocaleString('es-AR')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer style={{ background: 'var(--bg-surface-dark)', color: 'var(--text-on-dark)', padding: '28px 24px', marginTop: '20px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={15} /> Pte. Perón 5349/5305/5265, Rosario, Santa Fe
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            🕒 Lunes a Sábado de 8 a 17 hs
          </span>
        </div>
      </footer>
    </div>
  );
}
