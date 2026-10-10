'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ShoppingCart, Share2, Check, ChevronLeft, ChevronRight, Camera, MessageCircle } from 'lucide-react';
import { shareProduct } from '@/lib/shareProduct';
import { getProductImages, getProductPrice, getProductPriceRange, getThumbUrl } from '@/lib/dataStore';

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="products-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="product-card" style={{ pointerEvents: 'none', opacity: 0.85 }}>
          <div className="product-img-wrapper skeleton-shimmer" style={{ width: '100%', height: '260px' }} />
          <div className="product-card-body" style={{ padding: '12px' }}>
            <div className="skeleton-shimmer" style={{ height: '13px', width: '45%', borderRadius: '4px', marginBottom: '8px' }} />
            <div className="skeleton-shimmer" style={{ height: '17px', width: '85%', borderRadius: '4px', marginBottom: '12px' }} />
            <div className="skeleton-shimmer" style={{ height: '22px', width: '50%', borderRadius: '6px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProductGrid({ products, onAddToCart, isWholesaleQualified = false, onOpenDetail, topSellingIds, isLoading = false }) {
  const [copiedShareId, setCopiedShareId] = useState(null);

  const handleShare = async (e, product) => {
    e.stopPropagation();
    const result = await shareProduct(product);
    if (result === 'copied') {
      setCopiedShareId(product.id);
      setTimeout(() => setCopiedShareId((cur) => (cur === product.id ? null : cur)), 2000);
    }
  };

  if (isLoading) {
    return <ProductGridSkeleton count={8} />;
  }

  if (!products || products.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '50px 24px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        maxWidth: '560px',
        margin: '0 auto',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#F3F4F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: '26px'
        }}>
          🔍
        </div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0' }}>
          No encontramos lo que estás buscando
        </h3>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
          ¿Buscás algún modelo, curva de talles o artículo específico? Escribinos por WhatsApp y te lo conseguimos directo de fábrica o distribuidora.
        </p>
        <a
          href={`https://wa.me/5493412648035?text=${encodeURIComponent('¡Hola Dulce Valentín! Estoy buscando un artículo que no encuentro en el catálogo online. ¿Me pueden ayudar a conseguirlo?')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#25D366',
            color: '#FFFFFF',
            padding: '12px 22px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '0.92rem',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(37,211,102,0.3)',
            transition: 'transform 0.15s ease'
          }}
        >
          <MessageCircle size={18} /> Pedir por WhatsApp al 341-264-8035
        </a>
      </div>
    );
  }

  const handleQuickAdd = (e, product) => {
    e.stopPropagation();
    if (Number(product.stock) <= 0) return;
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

  // Cascada de calidad para la foto de la tarjeta: primero la miniatura
  // liviana (pensada para este tamano), y si no existe todavia (fotos
  // subidas antes de generarse miniaturas) cae a la foto completa, y recien
  // como ultimo recurso al logo. Se reinicia cada vez que cambia la foto
  // activa (rotacion automatica o flechas), porque cada foto tiene su propio
  // resultado de carga.
  const [imgFallbackLevel, setImgFallbackLevel] = useState(0);
  useEffect(() => {
    setImgFallbackLevel(0);
  }, [activeImgIndex, product.id]);

  const hasMultiple = images.length > 1;
  const currentImage = images[activeImgIndex] || images[0] || '/logo.png';
  const thumbImage = getThumbUrl(currentImage);
  const displayImage = imgFallbackLevel === 0 ? thumbImage : (imgFallbackLevel === 1 ? currentImage : '/logo.png');

  // Auto-rotación sutil de imágenes en Desktop (se pausa al pasar el mouse).
  // En móviles y táctiles se desactiva para mantener el scroll fluido a 60fps,
  // ahorrar datos en 4G y no sobrecalentar el celular (el usuario usa swipe o flechas).
  useEffect(() => {
    if (!hasMultiple || isHovered) return;
    if (typeof window !== 'undefined' && (window.innerWidth < 768 || window.matchMedia('(hover: none)').matches)) {
      return;
    }

    const codeNum = parseInt(product.code, 10) || 0;
    const intervalTime = 4500 + (codeNum % 5) * 400;

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
            src={displayImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
            className="product-img"
            onError={() => {
              setImgFallbackLevel((lvl) => lvl + 1);
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

          {/* Urgencia real: solo cuando el stock de verdad es bajo */}
          {Number(product.stock) > 0 && Number(product.stock) <= 3 && (
            <span className="card-badge-lowstock">
              {Number(product.stock) === 1 ? '¡Queda 1!' : `¡Quedan ${Number(product.stock)}!`}
            </span>
          )}

          <div className="card-badges-topleft">
            {Number(product.stock) <= 0 ? (
              <span
                className="card-badge-offer"
                style={{
                  background: '#334155',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                }}
              >
                Sin Stock
              </span>
            ) : product.badge_text ? (
              <span
                className="card-badge-offer"
                style={{
                  background: 'linear-gradient(135deg, #DC2626 0%, #E11D48 100%)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  boxShadow: '0 2px 8px rgba(225, 29, 72, 0.4)'
                }}
              >
                {product.badge_text}
              </span>
            ) : (
              <>
                {product.is_new && <span className="card-badge-new">🆕 Nuevo</span>}
                {product.is_offer && <span className="card-badge-offer">Oferta</span>}
              </>
            )}
            {Number(product.stock) > 0 && isTopSeller && <span className="card-badge-bestseller">🔥 Más Vendido</span>}
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', margin: '4px 0 2px' }}>
          {product.code ? (
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-gold, #D97706)', letterSpacing: '0.02em' }}>
              ART. #{product.code}
            </span>
          ) : <span />}
          {product.category && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {product.category}
            </span>
          )}
        </div>

        <h3 className="product-title-compact" style={{ marginTop: 0 }}>
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
          disabled={Number(product.stock) <= 0}
          style={{
            opacity: Number(product.stock) <= 0 ? 0.35 : 1,
            cursor: Number(product.stock) <= 0 ? 'not-allowed' : 'pointer'
          }}
          title={Number(product.stock) > 0 ? 'Agregar al Carrito' : 'Sin Stock disponible'}
        >
          <ShoppingCart size={16} />
        </button>
      </div>
    </div>
  );
}
