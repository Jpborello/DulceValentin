'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { X, ShoppingCart, Tag, Palette, Share2, Check, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import useCloseOnBack from '@/lib/useCloseOnBack';
import { getProductColors } from '@/lib/catalogData';
import { shareProduct } from '@/lib/shareProduct';
import { getProductImages, getProductPrice } from '@/lib/dataStore';

export default function ProductDetailModal({ product, isOpen, onClose, onAddToCart, isWholesaleQualified = false }) {
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const touchStartX = useRef(null);

  const images = getProductImages(product);
  const hasMultiple = images.length > 1;
  const currentImage = images[activeImgIndex] || images[0] || '/logo.png';
  // Precio segun el talle elegido (si el producto tiene price_per_size); si
  // no hay talle seleccionado o el producto no tiene precio por talle, cae
  // al precio unico de siempre.
  const currentPrice = getProductPrice(product, selectedSize);

  const handleShare = async () => {
    const result = await shareProduct(product);
    if (result === 'copied') {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const handleClose = useCloseOnBack(isOpen, () => {
    if (isZoomed) {
      setIsZoomed(false);
    } else {
      onClose();
    }
  });

  const availableColors = getProductColors(product);

  useEffect(() => {
    if (product) {
      const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
      setSelectedSize(hasSizes ? product.sizes[0] : null);
      
      const colors = getProductColors(product);
      setSelectedColor(colors && colors.length > 0 ? colors[0] : null);

      setActiveImgIndex(0);
      setIsZoomed(false);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
  const isStockOk = product.stock > 10;

  const handlePrevImg = (e) => {
    e?.stopPropagation();
    setActiveImgIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNextImg = (e) => {
    e?.stopPropagation();
    setActiveImgIndex((prev) => (prev + 1) % images.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 40 && hasMultiple) {
      if (deltaX > 0) {
        setActiveImgIndex((prev) => (prev - 1 + images.length) % images.length);
      } else {
        setActiveImgIndex((prev) => (prev + 1) % images.length);
      }
    }
    touchStartX.current = null;
  };

  const handleAdd = () => {
    onAddToCart({ ...product, image_url: currentImage, selectedSize, selectedColor, unit_price: currentPrice });
    handleClose();
  };

  return (
    <div className="modal-backdrop active" onClick={handleClose}>
      <div className="modal-box product-detail-box" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleClose}
          className="qty-btn"
          style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.9)' }}
        >
          <X size={18} />
        </button>

        <div className="product-detail-scroll">
        <div className="product-detail-grid">
          {/* Galería interactiva con foto principal + navegación + tira de miniaturas */}
          <div className="product-gallery-column" style={{ display: 'flex', flexDirection: 'column' }}>
            <div 
              className="product-detail-img-wrapper" 
              style={{ position: 'relative', cursor: 'zoom-in', width: '100%', minHeight: '320px', borderRadius: '12px', overflow: 'hidden' }}
              onClick={() => setIsZoomed(true)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              title="Toca o haz clic para expandir imagen"
            >
              <Image
                src={currentImage}
                alt={product.name}
                fill
                unoptimized
                sizes="(max-width: 720px) 100vw, 500px"
                style={{ objectFit: 'cover' }}
                onError={(e) => { e.target.src = '/logo.png'; }}
              />

              {/* Flechas de navegación principal */}
              {hasMultiple && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlePrevImg(e); }}
                    aria-label="Foto anterior"
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      color: '#0F172A',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 4,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                    }}
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleNextImg(e); }}
                    aria-label="Foto siguiente"
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      color: '#0F172A',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 4,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                    }}
                  >
                    <ChevronRight size={20} />
                  </button>

                  {/* Contador en esquina */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    color: '#FFFFFF',
                    padding: '4px 10px',
                    borderRadius: '14px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    backdropFilter: 'blur(4px)',
                    zIndex: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Camera size={12} /> {activeImgIndex + 1}/{images.length}
                  </div>
                </>
              )}

              <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                color: '#FFFFFF',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                backdropFilter: 'blur(4px)',
                pointerEvents: 'none',
                zIndex: 3
              }}>
                🔍 Tap para expandir
              </div>
            </div>

            {/* Tira de Miniaturas (Thumbnails) */}
            {hasMultiple && (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  padding: '10px 2px 2px 2px',
                  alignItems: 'center'
                }}
              >
                {images.map((imgUrl, idx) => {
                  const isActive = idx === activeImgIndex;
                  return (
                    <button
                      key={`${imgUrl}-${idx}`}
                      type="button"
                      onClick={() => setActiveImgIndex(idx)}
                      style={{
                        position: 'relative',
                        width: '62px',
                        height: '62px',
                        minWidth: '62px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: isActive ? '2.5px solid var(--accent-gold)' : '1px solid var(--border-color)',
                        boxShadow: isActive ? '0 0 0 1px var(--accent-gold)' : 'none',
                        opacity: isActive ? 1 : 0.6,
                        transform: isActive ? 'scale(1.02)' : 'scale(1)',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                        padding: 0,
                        backgroundColor: 'var(--bg-card)'
                      }}
                      title={`Ver foto ${idx + 1}`}
                    >
                      <img
                        src={imgUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.src = '/logo.png'; }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="product-detail-info">
            <div className="product-category-name">
              {product.category} {product.subcategory ? `• ${product.subcategory}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <h2 className="product-detail-title" style={{ margin: 0 }}>{product.name}</h2>
              <button
                type="button"
                onClick={handleShare}
                title={shareCopied ? 'Link copiado' : 'Compartir producto'}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 10px',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: shareCopied ? '#ECFDF5' : 'var(--bg-surface-elevated)',
                  color: shareCopied ? '#047857' : 'var(--text-main)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {shareCopied ? <Check size={14} /> : <Share2 size={14} />}
                {shareCopied ? 'Copiado' : 'Compartir'}
              </button>
            </div>

            {product.code && <div className="product-detail-code">Código: {product.code}</div>}

            {product.description && (
              <p className="product-detail-desc">{product.description}</p>
            )}

            <div className="product-stock-status" style={{ marginTop: '6px' }}>
              <span className={`stock-dot ${isStockOk ? 'stock-in' : 'stock-low'}`}></span>
              <span>
                {product.stock > 0
                  ? (isStockOk ? `Stock disponible (${product.stock} un.)` : `Últimas ${product.stock} unidades`)
                  : 'Sin stock por el momento'}
              </span>
            </div>

            {hasSizes && (
              <div style={{ marginTop: '14px' }}>
                <span className="product-detail-size-label">
                  Talle: {selectedSize ? <strong>{selectedSize}</strong> : 'Seleccionar'}
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`size-pill ${selectedSize === size ? 'active' : ''}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selector de Colores */}
            {availableColors && availableColors.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <span className="product-detail-size-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Palette size={14} style={{ color: 'var(--accent-gold)' }} />
                  Color: {selectedColor ? <strong>{selectedColor}</strong> : 'Seleccionar'}
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {availableColors.map((color) => {
                    const isSelected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          border: isSelected ? '2px solid var(--text-main)' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'var(--text-main)' : 'var(--bg-surface-elevated)',
                          color: isSelected ? 'var(--bg-page)' : 'var(--text-main)',
                          boxShadow: isSelected ? '0 2px 8px rgba(15,23,42,0.25)' : 'none'
                        }}
                      >
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="product-detail-price-box">
              <span className="wholesale-tag"><Tag size={13} /> Precio Mayorista</span>
              <div className="price-row">
                <span className="price-big">${currentPrice.toLocaleString('es-AR')}</span>
              </div>
              {product.price_per_size && hasSizes && (
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '4px 0 0 0', fontWeight: 600 }}>
                  El precio varía según el talle elegido.
                </p>
              )}
            </div>

            <button
              onClick={handleAdd}
              className="btn-add-cart"
              disabled={product.stock <= 0}
              style={{ marginTop: '16px' }}
            >
              <ShoppingCart size={16} />
              {product.stock > 0
                ? (selectedSize || selectedColor 
                    ? `Agregar (${[selectedSize ? `Talle ${selectedSize}` : null, selectedColor ? `Color ${selectedColor}` : null].filter(Boolean).join(' • ')})` 
                    : 'Agregar al Carrito') 
                : 'Sin Stock'}
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Image Zoom */}
      {isZoomed && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.92)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out'
          }}
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={() => setIsZoomed(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: '#FFFFFF',
              color: '#000000',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 100000
            }}
          >
            <X size={22} />
          </button>

          {/* Flechas de navegación en modo zoom */}
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handlePrevImg(e); }}
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  color: '#000000',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 100000,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
              >
                <ChevronLeft size={26} />
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleNextImg(e); }}
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  color: '#000000',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 100000,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
              >
                <ChevronRight size={26} />
              </button>

              <div style={{
                position: 'absolute',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: '#FFFFFF',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: 700,
                zIndex: 100000,
                backdropFilter: 'blur(4px)'
              }}>
                {activeImgIndex + 1} / {images.length}
              </div>
            </>
          )}

          <img
            src={currentImage}
            alt={product.name}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '92vh',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
            }}
            onError={(e) => { e.target.src = '/logo.png'; }}
          />
        </div>
      )}
    </div>
  );
}
