'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ShoppingCart, Share2, Check } from 'lucide-react';
import { shareProduct } from '@/lib/shareProduct';

export default function ProductGrid({ products, onAddToCart, isWholesaleQualified = false, onOpenDetail, topSellingIds }) {
  const [copiedShareId, setCopiedShareId] = useState(null);

  const handleShare = async (e, product) => {
    e.stopPropagation();
    const result = await shareProduct(product);
    if (result === 'copied') {
      setCopiedShareId(product.id);
      setTimeout(() => setCopiedShareId((cur) => (cur === product.id ? null : cur)), 2000);
    }
  };

  if (!products || products.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
        <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          No se encontraron prendas para los filtros seleccionados.
        </p>
      </div>
    );
  }

  // La card muestra solo foto + nombre corto + precio. Talles, colores,
  // stock y descripcion completa se ven al abrir el detalle (ProductDetailModal),
  // que ya trae su propio selector de talle/color. Acá el "Agregar" rapido
  // usa el talle/color por defecto (el primero de la lista del producto).
  const handleQuickAdd = (e, product) => {
    e.stopPropagation();
    const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
    onAddToCart({
      ...product,
      selectedSize: hasSizes ? product.sizes[0] : null,
      selectedColor: null
    });
  };

  return (
    <div className="products-grid">
      {products.map((product, idx) => {
        return (
          <div key={product.id} className={`product-card product-card-blob-${(idx % 6) + 1}`}>
            <div
              className="product-card-clickzone"
              onClick={() => onOpenDetail && onOpenDetail(product)}
              title="Ver detalle del producto"
            >
              <div className="product-img-wrapper">
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 280px"
                  className="product-img"
                  onError={(e) => {
                    e.target.src = '/logo.png';
                  }}
                />
                {/* Bottom-Right Price Patch Overlay (covers stamped $XX.XXX prices at bottom right without covering top title) */}
                <div style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  minWidth: '120px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '2px solid var(--border-color)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                  fontWeight: 900,
                  fontSize: '0.78rem',
                  letterSpacing: '0.5px',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  zIndex: 3
                }}>
                  ⭐ DULCE VALENTÍN
                </div>

                <div className="card-badges-topleft">
                  {product.is_new && <span className="card-badge-new">🆕 Nuevo</span>}
                  {product.is_offer && <span className="card-badge-offer">Oferta</span>}
                  {topSellingIds?.has(product.id) && <span className="card-badge-bestseller">🔥 Más Vendido</span>}
                </div>
                <span className="card-badge-wholesale">
                  Precio Mayorista
                </span>

                <button
                  type="button"
                  onClick={(e) => handleShare(e, product)}
                  title={copiedShareId === product.id ? 'Link copiado' : 'Compartir producto'}
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 3,
                    backdropFilter: 'blur(2px)'
                  }}
                >
                  {copiedShareId === product.id ? <Check size={15} /> : <Share2 size={15} />}
                </button>
              </div>

              <h3 className="product-title-compact">
                {product.name}
              </h3>
            </div>

            <div className="product-card-footer">
              <span className="price-compact">
                ${(product.wholesale_price || product.price)?.toLocaleString('es-AR')}
              </span>

              <button
                onClick={(e) => handleQuickAdd(e, product)}
                className="btn-add-cart-compact"
                disabled={product.stock <= 0}
                title={product.stock > 0 ? 'Agregar al Carrito' : 'Sin Stock'}
              >
                <ShoppingCart size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
