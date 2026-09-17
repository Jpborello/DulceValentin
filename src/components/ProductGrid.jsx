'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ShoppingCart, Share2, Check, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { shareProduct } from '@/lib/shareProduct';
import { getProductImages, getProductPrice, getProductPriceRange } from '@/lib/dataStore';

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

  const handleQuickAdd = (e, product) => {
    e.stopPropagation();
    const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
    // El agregado rapido no deja elegir talle: si el producto tiene precio
    // por talle, se toma el del primer talle de la lista (mismo criterio
    // que ya usaba para elegirle el talle por defecto).
    const selectedSize = hasSizes ? product.sizes[0] : null;
    onAddToCart({
      ...product,
      selectedSize,
      selectedColor: null,
      unit_price: getProductPrice(product, selectedSize)
    });
  };

  return (
    <div className="products-grid">
      {products.map((product) => (
        <ProductGridCard
          key={product.id}
          product={product}
          onOpenDetail={onOpenDetail}
          onQuickAdd={handleQuickAdd}
          onShare={handleShare}
          isCopiedShare={copiedShareId === product.id}
          isTopSeller={topSellingIds?.has(product.id)}
        />
      ))}
    </div>
  );
}

function ProductGridCard({ product, onOpenDetail, onQuickAdd, onShare, isCopiedShare, isTopSeller }) {
  const images = getProductImages(product);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef(null);

  const hasMultiple = images.length > 1;
  const currentImage = images[activeImgIndex] || images[0] || '/logo.png';

  // Auto-rotación de imágenes para productos con múltiples fotos (se pausa al pasar el mouse)
  useEffect(() => {
    if (!hasMultiple || isHovered) return;

    // Desfase sutil basado en el código para que las tarjetas roten de forma fluida y no al unísono
    const codeNum = parseInt(product.code, 10) || 0;
    const intervalTime = 3800 + (codeNum % 5) * 350;

    const timer = setInterval(() => {
      setActiveImgIndex((prev) => (prev + 1) % images.length);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [hasMultiple, isHovered, images.length, product.code]);

  const handlePrevImg = (e) => {
    e.stopPropagation();
    setActiveImgIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNextImg = (e) => {
    e.stopPropagation();
    setActiveImgIndex((prev) => (prev + 1) % images.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 40 && hasMultiple) {
      e.stopPropagation();
      if (deltaX > 0) {
        // Swipe derecha -> imagen anterior
        setActiveImgIndex((prev) => (prev - 1 + images.length) % images.length);
      } else {
        // Swipe izquierda -> imagen siguiente
        setActiveImgIndex((prev) => (prev + 1) % images.length);
      }
    }
    touchStartX.current = null;
  };

  return (
    <div
      className="product-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="product-card-clickzone"
        onClick={() => onOpenDetail && onOpenDetail(product)}
        title="Ver detalle del producto"
      >
        <div
          className="product-img-wrapper"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Image
            src={currentImage}
            alt={product.name}
            fill
            unoptimized
            sizes="(max-width: 1024px) 45vw, 280px"
            className="product-img"
            onError={(e) => {
              e.target.src = '/logo.png';
            }}
          />

          {/* Badge de contador de fotos (si tiene mas de 1) */}
          {hasMultiple && (
            <div
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                color: '#FFFFFF',
                padding: '3px 8px',
                borderRadius: '12px',
                fontSize: '0.7rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backdropFilter: 'blur(3px)',
                zIndex: 3,
                pointerEvents: 'none'
              }}
            >
              <Camera size={11} /> {activeImgIndex + 1}/{images.length}
            </div>
          )}

          {/* Flechas de navegación en la tarjeta (si tiene múltiples) */}
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={handlePrevImg}
                aria-label="Foto anterior"
                style={{
                  position: 'absolute',
                  left: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.88)',
                  color: '#0F172A',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 3,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  opacity: isHovered ? 1 : 0.4,
                  transition: 'opacity 0.2s ease, transform 0.15s ease'
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                onClick={handleNextImg}
                aria-label="Foto siguiente"
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.88)',
                  color: '#0F172A',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 3,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  opacity: isHovered ? 1 : 0.4,
                  transition: 'opacity 0.2s ease, transform 0.15s ease'
                }}
              >
                <ChevronRight size={16} />
              </button>

              {/* Dots indicadores de pagina */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '42px',
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '4px',
                  zIndex: 3,
                  pointerEvents: 'none'
                }}
              >
                {images.map((_, dotIdx) => (
                  <span
                    key={dotIdx}
                    style={{
                      width: dotIdx === activeImgIndex ? '12px' : '5px',
                      height: '5px',
                      borderRadius: '4px',
                      backgroundColor: dotIdx === activeImgIndex ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.65)',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                    }}
                  />
                ))}
              </div>
            </>
          )}

          <div className="card-badges-topleft">
            {product.is_new && <span className="card-badge-new">🆕 Nuevo</span>}
            {product.is_offer && <span className="card-badge-offer">Oferta</span>}
            {isTopSeller && <span className="card-badge-bestseller">🔥 Más Vendido</span>}
          </div>

          <button
            type="button"
            onClick={(e) => onShare(e, product)}
            title={isCopiedShare ? 'Link copiado' : 'Compartir producto'}
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
            {isCopiedShare ? <Check size={15} /> : <Share2 size={15} />}
          </button>
        </div>

        <h3 className="product-title-compact">
          {product.name}
        </h3>
      </div>

      <div className="product-card-footer">
        <span className="price-compact">
          {(() => {
            const { min, hasRange } = getProductPriceRange(product);
            return hasRange ? `Desde $${min.toLocaleString('es-AR')}` : `$${min.toLocaleString('es-AR')}`;
          })()}
        </span>

        <button
          onClick={(e) => onQuickAdd(e, product)}
          className="btn-add-cart-compact"
          disabled={product.stock <= 0}
          title={product.stock > 0 ? 'Agregar al Carrito' : 'Sin Stock'}
        >
          <ShoppingCart size={16} />
        </button>
      </div>
    </div>
  );
}
