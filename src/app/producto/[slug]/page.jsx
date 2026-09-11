import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, ArrowLeft, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getProductColors } from '@/lib/catalogData';
import { buildProductSlug } from '@/lib/productSlug';
import ShareProductButton from '@/components/ShareProductButton';
import ProductPageGallery from '@/components/ProductPageGallery';

const SITE_URL = 'https://www.dulcevalentin.com.ar';

// Server Component (sin 'use client'): el HTML con el producto real ya
// viene armado desde el servidor, para que Google y las vistas previas de
// WhatsApp/redes vean el contenido sin depender de que se ejecute JS.
async function getProduct(slug) {
  if (!slug) return null;

  // Los ids del catalogo suelen ser "prefijo-numero" (ej "p-0040"), pero
  // algunos productos tienen una version actualizada con un sufijo extra
  // (ej "p-0040-new", un producto distinto con su propio precio/stock).
  // Por eso no alcanza con tomar los primeros dos segmentos del slug:
  // buscamos, entre todos los ids activos, el que sea el prefijo MAS LARGO
  // que calce con el slug completo, para no confundir "p-0040" con
  // "p-0040-new" cuando el link comparte este ultimo.
  const { data: candidates } = await supabase
    .from('products')
    .select('id')
    .eq('is_active', true);
  if (!candidates) return null;

  const matches = candidates.filter((p) => slug === p.id || slug.startsWith(`${p.id}-`));
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.id.length - a.id.length);
  const id = matches[0].id;

  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};

  const price = product.wholesale_price || product.price;
  const title = product.name;
  const description = product.description
    ? product.description
    : `${product.name} — ${product.category}${product.subcategory ? ` / ${product.subcategory}` : ''}. Precio mayorista${price ? `: $${Number(price).toLocaleString('es-AR')}` : ''}. Venta mayorista directa de fábrica en Rosario, Santa Fe.`;
  const canonicalPath = `/producto/${buildProductSlug(product)}`;

  const validImages = (Array.isArray(product.image_urls) && product.image_urls.length > 0
    ? product.image_urls
    : [product.image_url]
  ).filter(Boolean);

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'website',
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'Dulce Valentín',
      title: `${title} | Dulce Valentín`,
      description,
      images: validImages.map((url) => ({
        url,
        width: 800,
        height: 1000,
        alt: product.name,
        type: 'image/webp'
      }))
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Dulce Valentín`,
      description,
      images: validImages
    }
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const price = product.wholesale_price || product.price;
  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
  const colors = getProductColors(product);
  const hasColors = Array.isArray(colors) && colors.length > 0;
  const isStockOk = product.stock > 10;
  const canonicalPath = `/producto/${buildProductSlug(product)}`;

  const images = (Array.isArray(product.image_urls) && product.image_urls.length > 0
    ? product.image_urls
    : [product.image_url]
  ).filter(Boolean);

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || `${product.name} — venta mayorista en Dulce Valentín, Rosario.`,
    image: images.length > 0 ? images : undefined,
    category: product.subcategory ? `${product.category} / ${product.subcategory}` : product.category,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}${canonicalPath}`,
      priceCurrency: 'ARS',
      price: price || undefined,
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition'
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

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

      <main style={{ flex: 1, maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        <nav aria-label="breadcrumb" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
          <Link href="/" style={{ color: 'var(--accent-gold-hover)', fontWeight: 600 }}>Inicio</Link>
          {' / '}
          {product.category}
          {product.subcategory ? ` / ${product.subcategory}` : ''}
        </nav>

        <div className="product-detail-grid" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)', padding: '20px' }}>
          <ProductPageGallery images={images} name={product.name} />

          <div className="product-detail-info">
            <div className="product-category-name">
              {product.category}{product.subcategory ? ` • ${product.subcategory}` : ''}
            </div>
            <h1 className="product-detail-title">{product.name}</h1>

            {product.description && (
              <p className="product-detail-desc">{product.description}</p>
            )}

            <div className="product-stock-status" style={{ marginTop: '6px', marginBottom: '4px' }}>
              <span className={`stock-dot ${isStockOk ? 'stock-in' : 'stock-low'}`}></span>
              <span>
                {product.stock > 0
                  ? (isStockOk ? `Stock disponible (${product.stock} un.)` : `Últimas ${product.stock} unidades`)
                  : 'Sin stock por el momento'}
              </span>
            </div>

            {hasSizes && (
              <div style={{ marginTop: '14px' }}>
                <span className="product-detail-size-label">Talles disponibles:</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {product.sizes.map((size) => (
                    <span key={size} className="size-pill">{size}</span>
                  ))}
                </div>
              </div>
            )}

            {hasColors && (
              <div style={{ marginTop: '14px' }}>
                <span className="product-detail-size-label">Colores disponibles:</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {colors.map((color) => (
                    <span key={color} className="size-pill">{color}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="product-detail-price-box">
              <span className="wholesale-tag">★ Precio Mayorista</span>
              <div className="price-row">
                <span className="price-big">${Number(price || 0).toLocaleString('es-AR')}</span>
              </div>
              <p className="price-hint">Mínimo de compra: $50.000 en pedidos por la web.</p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '18px' }}>
              <Link
                href={`/?producto=${encodeURIComponent(product.id)}`}
                className="btn-primary"
                style={{ justifyContent: 'center', backgroundColor: 'var(--accent-gold)', color: '#FFF' }}
              >
                <ShoppingCart size={18} /> Comprar este producto
              </Link>
              <ShareProductButton product={{ id: product.id, name: product.name, wholesale_price: product.wholesale_price, price: product.price }} />
            </div>
          </div>
        </div>
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
