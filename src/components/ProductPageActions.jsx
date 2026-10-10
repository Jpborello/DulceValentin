'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, ArrowLeft, CheckCircle2, X, MessageCircle } from 'lucide-react';
import ProductDetailModal from '@/components/ProductDetailModal';
import { addToStoredCart, countStoredCart, readStoredCart, CART_UPDATED_EVENT } from '@/lib/cartStorage';
import SafeImg from '@/components/admin/SafeImg';
import { getThumbUrl } from '@/lib/dataStore';
import { getProductPriceRange } from '@/lib/productPricing';
import { getProductUrlPath } from '@/lib/productSlug';

// Vuelve a la pagina anterior del sitio (categoria, busqueda, etc.) en vez
// de mandar siempre a la home. Si el cliente entro directo (link de
// Instagram, Google), lo lleva a la categoria del producto.
function useSmartBack(fallbackHref) {
  const router = useRouter();
  return () => {
    let cameFromSite = false;
    try {
      cameFromSite = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
    } catch {}
    if (cameFromSite && window.history.length > 1) router.back();
    else router.push(fallbackHref);
  };
}

export function ProductBackButton({ fallbackHref = '/', label = 'Volver' }) {
  const goBack = useSmartBack(fallbackHref);
  return (
    <button type="button" onClick={goBack} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <ArrowLeft size={16} /> {label}
    </button>
  );
}

export function CartHeaderLink() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(countStoredCart());
    update();
    window.addEventListener(CART_UPDATED_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return (
    <Link href="/?carrito=1" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} aria-label={`Ver carrito (${count} productos)`}>
      <ShoppingCart size={16} /> Carrito{count > 0 ? ` (${count})` : ''}
    </Link>
  );
}

// Boton "Agregar al carrito" de la pagina de producto: abre el mismo selector
// de talle/color que la home y guarda en el carrito sin salir de la pagina.
export function ProductBuyButton({ product, fallbackHref = '/' }) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(null);
  const [countForProduct, setCountForProduct] = useState(0);
  const router = useRouter();
  const goBack = useSmartBack(fallbackHref);

  const refreshCount = () =>
    setCountForProduct(readStoredCart().filter((t) => t.id === product.id).reduce((s, t) => s + (Number(t.quantity) || 1), 0));
  useEffect(() => { refreshCount(); }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const outOfStock = !(Number(product?.stock) > 0);

  const handleAdd = (item) => {
    if (addToStoredCart(item)) {
      setAdded(item);
      refreshCount();
    }
  };

  return (
    <>
      {outOfStock ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <button
            type="button"
            disabled
            className="btn-primary"
            style={{ justifyContent: 'center', backgroundColor: '#64748B', color: '#FFF', opacity: 0.7, cursor: 'not-allowed' }}
          >
            <ShoppingCart size={18} /> Sin stock por el momento
          </button>
          <a
            href={`https://wa.me/5493412648035?text=${encodeURIComponent(`¡Hola Dulce Valentín! Me interesa el producto "${product?.name}" (Cód: ${product?.code || product?.id}) que figura sin stock. ¿Me lo podrían conseguir?`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              padding: '12px 18px',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.88rem',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(37,211,102,0.3)',
              textAlign: 'center'
            }}
          >
            <MessageCircle size={18} /> Pedir por WhatsApp (Te lo conseguimos)
          </a>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-primary"
          style={{ justifyContent: 'center', backgroundColor: 'var(--accent-gold)', color: '#FFF', cursor: 'pointer' }}
        >
          <ShoppingCart size={18} /> Agregar al carrito
        </button>
      )}

      <ProductDetailModal
        product={product}
        isOpen={open}
        onClose={() => setOpen(false)}
        onAddToCart={handleAdd}
        isWholesaleQualified
        cartCountForProduct={countForProduct}
        onViewCart={() => router.push('/?carrito=1')}
      />

      {added && !open && (
        <div
          role="status"
          style={{
            position: 'fixed', left: '16px', right: '16px', bottom: '24px', maxWidth: '460px', margin: '0 auto',
            background: '#1E293B', color: '#FFF', borderRadius: '14px', padding: '14px 16px', zIndex: 9999,
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem' }}>
            <CheckCircle2 size={18} color="#4ADE80" />
            <span style={{ flex: 1 }}>
              Agregado: {added.name}
              {added.selectedSize ? ` · talle ${added.selectedSize}` : ''}
              {added.selectedColor ? ` · ${added.selectedColor}` : ''}
            </span>
            <button type="button" onClick={() => setAdded(null)} aria-label="Cerrar aviso" style={{ background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer', padding: '2px' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => { setAdded(null); goBack(); }}
              style={{ flex: 1, padding: '9px 10px', borderRadius: '9px', border: '1px solid #475569', background: 'transparent', color: '#FFF', fontWeight: 700, cursor: 'pointer' }}
            >
              Seguir comprando
            </button>
            <Link
              href="/?carrito=1"
              style={{ flex: 1, padding: '9px 10px', borderRadius: '9px', background: '#2563EB', color: '#FFF', fontWeight: 800, textAlign: 'center', textDecoration: 'none' }}
            >
              Ver carrito y finalizar
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

// "También te puede interesar" de la pagina de producto (links a otras
// paginas de producto: ademas de vender mas, suma enlaces internos para SEO).
export function RelatedProducts({ products = [] }) {
  if (!products.length) return null;
  return (
    <section className="pp-related" aria-labelledby="pp-related-title">
      <h2 id="pp-related-title" className="pp-related-title">También te puede interesar</h2>
      <div className="pp-related-grid">
        {products.map((p) => {
          const { min, hasRange } = getProductPriceRange(p);
          return (
            <Link key={p.id} href={getProductUrlPath(p)} className="pp-related-card">
              <SafeImg
                src={p.image_url ? getThumbUrl(p.image_url) : '/logo.png'}
                fallbacks={[p.image_url, '/logo.png']}
                alt={p.name}
                loading="lazy"
                className="pp-related-img"
              />
              <span className="pp-related-name">{p.name}</span>
              <span className="pp-related-price">{hasRange ? 'Desde ' : ''}${Number(min || 0).toLocaleString('es-AR')}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
