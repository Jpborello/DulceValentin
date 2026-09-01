'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ShoppingCart, Tag, Palette, Share2, Check } from 'lucide-react';
import useCloseOnBack from '@/lib/useCloseOnBack';
import { getProductColors } from '@/lib/catalogData';
import { shareProduct } from '@/lib/shareProduct';

export default function ProductDetailModal({ product, isOpen, onClose, onAddToCart, isWholesaleQualified = false }) {
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

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

      setIsZoomed(false);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
  const isStockOk = product.stock > 10;

  const handleAdd = () => {
    onAddToCart({ ...product, selectedSize, selectedColor });
    handleClose();
  };

  return (
    <div className="modal-backdrop active" onClick={handleClose}>
      <div className="modal-box product-detail-box" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleClose}
          className="qty-btn"
          style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 2, backgroundColor: 'rgba(255,255,255,0.9)' }}
        >
          <X size={18} />
        </button>

        <div className="product-detail-scroll">
        <div className="product-detail-grid">
          <div 
            className="product-detail-img-wrapper" 
            style={{ position: 'relative', cursor: 'zoom-in' }}
            onClick={() => setIsZoomed(true)}
            title="Toca o haz clic para expandir imagen"
          >
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              unoptimized
              sizes="(max-width: 720px) 100vw, 500px"
              onError={(e) => { e.target.src = '/logo.png'; }}
            />
            {/* Bottom-Right Price Patch Overlay */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              minWidth: '130px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              padding: '7px 16px',
              borderRadius: '8px',
              border: '2px solid var(--border-color)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              fontWeight: 900,
              fontSize: '0.82rem',
              letterSpacing: '0.5px',
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 3
            }}>
              ⭐ DULCE VALENTÍN
            </div>
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
              pointerEvents: 'none'
            }}>
              🔍 Tap para expandir
            </div>
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
                <span className="price-big">${(product.wholesale_price || product.price)?.toLocaleString('es-AR')}</span>
              </div>
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
          <img
            src={product.image_url}
            alt={product.name}
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
