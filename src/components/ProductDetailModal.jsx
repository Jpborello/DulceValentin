'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { X, ShoppingCart, Tag, Palette, Share2, Check, ChevronLeft, ChevronRight, Camera, Sparkles, Layers, Plus, Trash2, AlertCircle, MessageCircle } from 'lucide-react';
import useCloseOnBack from '@/lib/useCloseOnBack';
import { getProductColors, getProductColorsForSize, getProductStockForSizeColor } from '@/lib/catalogData';
import { shareProduct } from '@/lib/shareProduct';
import { getProductImages, getProductPrice, getThumbUrl } from '@/lib/dataStore';
import SafeImg from '@/components/admin/SafeImg';

export default function ProductDetailModal({ product, isOpen, onClose, onAddToCart, isWholesaleQualified = false, relatedProducts = [], onSelectProduct = null, cartCountForProduct = 0, onViewCart = null }) {
  const boxRef = useRef(null);
  // Ultima variante agregada (el modal queda abierto para poder sumar otro
  // talle o color del mismo producto y completar el x3).
  const [justAdded, setJustAdded] = useState(null);
  const [quantity, setQuantity] = useState(1);
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

  const [selectionMode, setSelectionMode] = useState('pack');
  const [packSlots, setPackSlots] = useState([]);

  useEffect(() => {
    if (product) {
      const hasS = Array.isArray(product.sizes) && product.sizes.length > 0;
      const initialS = hasS ? product.sizes[0] : null;
      setSelectedSize(initialS);
      
      const colors = getProductColorsForSize(product, initialS);
      const initialC = colors && colors.length > 0 ? colors[0] : null;
      setSelectedColor(initialC);

      const hasV = (hasS && product.sizes.length > 1) || (colors && colors.length > 1);
      setSelectionMode(hasV ? 'pack' : 'single');

      // Inicializar 3 prendas para el pack variado (con variedad sugerida)
      const sList = hasS ? product.sizes : [null];
      const cList = colors && colors.length > 0 ? colors : [null];

      const initialSlots = [0, 1, 2].map((idx) => {
        const slotSize = sList[idx % sList.length];
        const colorsForSlotSize = slotSize ? getProductColorsForSize(product, slotSize) : cList;
        const slotColor = (colorsForSlotSize && colorsForSlotSize.length > 0)
          ? colorsForSlotSize[idx % colorsForSlotSize.length]
          : initialC;
        return {
          id: idx + 1,
          size: slotSize,
          color: slotColor
        };
      });
      setPackSlots(initialSlots);

      setActiveImgIndex(0);
      setIsZoomed(false);
      setJustAdded(null);
      setQuantity(1);
      // Al pasar a un producto relacionado, arrancar arriba de todo.
      if (boxRef.current) boxRef.current.scrollTop = 0;
    }
  }, [product]);

  const handleSelectSize = (size) => {
    setSelectedSize(size);
    const colorsForSize = getProductColorsForSize(product, size);
    if (!colorsForSize.includes(selectedColor)) {
      setSelectedColor(colorsForSize[0] || null);
    }
  };

  const handleUpdatePackSlot = (index, field, value) => {
    setPackSlots((prev) => {
      const copy = [...prev];
      const target = { ...copy[index], [field]: value };
      if (field === 'size') {
        const validColors = getProductColorsForSize(product, value);
        if (validColors && validColors.length > 0 && !validColors.includes(target.color)) {
          target.color = validColors[0];
        }
      }
      copy[index] = target;
      return copy;
    });
  };

  const handleAddPackSlot = () => {
    setPackSlots((prev) => {
      const hasS = Array.isArray(product?.sizes) && product.sizes.length > 0;
      const defaultSize = hasS ? product.sizes[0] : null;
      const validColors = getProductColorsForSize(product, defaultSize);
      const defaultColor = validColors && validColors.length > 0 ? validColors[0] : null;
      return [
        ...prev,
        {
          id: Date.now() + Math.random(),
          size: defaultSize,
          color: defaultColor
        }
      ];
    });
  };

  const handleRemovePackSlot = (index) => {
    setPackSlots((prev) => prev.filter((_, idx) => idx !== index));
  };

  if (!isOpen || !product) return null;

  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
  const availableColors = getProductColorsForSize(product, selectedSize);
  const hasVariants = (hasSizes && product.sizes.length > 1) || (availableColors && availableColors.length > 1);

  // Validación de stock por variantes dentro del pack
  const slotUsage = {};
  packSlots.forEach((slot) => {
    const k = `${slot.size || ''}:::${slot.color || ''}`;
    slotUsage[k] = (slotUsage[k] || 0) + 1;
  });

  const stockIssues = [];
  Object.entries(slotUsage).forEach(([key, requestedQty]) => {
    const [size, color] = key.split(':::');
    const available = getProductStockForSizeColor(product, size || null, color || null);
    if (requestedQty > available) {
      const desc = [size ? `Talle ${size}` : null, color || null].filter(Boolean).join(' - ');
      stockIssues.push(`"${desc || 'Esta opción'}" solo tiene ${available} disp. (elegiste ${requestedQty})`);
    }
  });

  const packTotalPrice = packSlots.reduce((sum, slot) => {
    return sum + getProductPrice(product, slot.size);
  }, 0);

  const handleAddPack = () => {
    if (stockIssues.length > 0) return;

    const variantMap = {};
    packSlots.forEach((slot) => {
      const k = `${slot.size || ''}:::${slot.color || ''}`;
      if (!variantMap[k]) {
        variantMap[k] = { size: slot.size, color: slot.color, count: 0 };
      }
      variantMap[k].count += 1;
    });

    Object.values(variantMap).forEach(({ size, color, count }) => {
      const price = getProductPrice(product, size);
      onAddToCart(
        {
          ...product,
          image_url: currentImage,
          selectedSize: size,
          selectedColor: color,
          unit_price: price
        },
        { quantity: count, silent: true }
      );
    });

    const summary = packSlots
      .map((s) => [s.size ? `Talle ${s.size}` : null, s.color || null].filter(Boolean).join(' '))
      .join(' • ');
    setJustAdded(`Pack x${packSlots.length} variado (${summary})`);
  };

  const currentVariantStock = selectedSize
    ? getProductStockForSizeColor(product, selectedSize, selectedColor)
    : Number(product.stock) || 0;
  const isStockOk = currentVariantStock > 5;

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

  // Cierra el modal y recien despues abre el carrito
  const goToCart = () => {
    let done = false;
    const open = () => { if (!done) { done = true; onViewCart && onViewCart(); } };
    if (window.history.state && window.history.state.__modalOpen) {
      window.addEventListener('popstate', () => setTimeout(open, 0), { once: true });
      setTimeout(open, 700);
    } else {
      setTimeout(open, 0);
    }
    handleClose();
  };

  const handleAdd = () => {
    if (currentVariantStock <= 0) return;
    const qty = Math.max(1, quantity);
    onAddToCart(
      { ...product, image_url: currentImage, selectedSize, selectedColor, unit_price: currentPrice },
      { quantity: qty }
    );
    const variantDesc = [selectedSize ? `talle ${selectedSize}` : null, selectedColor || null].filter(Boolean).join(' · ');
    setJustAdded(`${qty > 1 ? `${qty} unidades` : '1 unidad'}${variantDesc ? ` (${variantDesc})` : ''}`);
  };

  return (
    <div className="modal-backdrop active" onClick={handleClose}>
      <div className="modal-box product-detail-box" ref={boxRef} onClick={(e) => e.stopPropagation()}>
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
              style={{ position: 'relative', cursor: 'zoom-in', width: '100%', borderRadius: '12px', overflow: 'hidden' }}
              onClick={() => setIsZoomed(true)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              title="Toca o haz clic para expandir imagen"
            >
              <Image
                src={currentImage}
                alt={product.name}
                fill
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
                {currentVariantStock > 0
                  ? (isStockOk
                      ? `Stock disponible (${currentVariantStock} un.${selectedSize ? ` en talle ${selectedSize}` : ''})`
                      : `Últimas ${currentVariantStock} unidades${selectedSize ? ` en talle ${selectedSize}` : ''}`)
                  : 'Sin stock por el momento'}
              </span>
            </div>

            {hasVariants && (
              <div style={{
                display: 'flex',
                gap: '6px',
                backgroundColor: 'var(--bg-surface-elevated)',
                padding: '4px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                marginTop: '14px',
                marginBottom: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setSelectionMode('pack')}
                  style={{
                    flex: 1,
                    padding: '9px 8px',
                    borderRadius: '9px',
                    border: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                    backgroundColor: selectionMode === 'pack' ? 'var(--dv-accent-fill, #A8175A)' : 'transparent',
                    color: selectionMode === 'pack' ? '#FFFFFF' : 'var(--text-main)',
                    boxShadow: selectionMode === 'pack' ? '0 2px 8px rgba(168,23,90,0.3)' : 'none'
                  }}
                >
                  <Sparkles size={14} /> Armar Pack x3 Variado 🔥
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode('single')}
                  style={{
                    flex: 1,
                    padding: '9px 8px',
                    borderRadius: '9px',
                    border: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                    backgroundColor: selectionMode === 'single' ? 'var(--text-main)' : 'transparent',
                    color: selectionMode === 'single' ? 'var(--bg-page)' : 'var(--text-muted)'
                  }}
                >
                  <Layers size={14} /> Mismo Talle y Color
                </button>
              </div>
            )}

            {selectionMode === 'pack' && hasVariants ? (
              <div style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1.5px solid var(--accent-gold, #D97706)',
                borderRadius: '14px',
                padding: '14px',
                marginTop: '6px',
                boxSizing: 'border-box'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🎨 Elegí las prendas de tu Pack ({packSlots.length} un.):</span>
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Podés combinar libremente talles y colores para llegar al mínimo mayorista.
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '10px',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    border: '1px solid #A7F3D0',
                    whiteSpace: 'nowrap'
                  }}>
                    ✓ Mayorista x{packSlots.length}
                  </span>
                </div>

                {/* Lista de Prendas del Pack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {packSlots.map((slot, idx) => {
                    const colorsForSlotSize = slot.size ? getProductColorsForSize(product, slot.size) : availableColors;

                    return (
                      <div
                        key={slot.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '8px 10px',
                          boxSizing: 'border-box'
                        }}
                      >
                        <span style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          color: 'var(--text-main)',
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          #{idx + 1}
                        </span>

                        {/* Selector de Talle */}
                        {hasSizes && (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <select
                              value={slot.size || ''}
                              onChange={(e) => handleUpdatePackSlot(idx, 'size', e.target.value)}
                              aria-label={`Talle para prenda #${idx + 1}`}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color-strong, #CBD5E1)',
                                backgroundColor: 'var(--bg-card, #FFF)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                            >
                              {product.sizes.map((s) => (
                                <option key={s} value={s}>
                                  Talle {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Selector de Color */}
                        {colorsForSlotSize && colorsForSlotSize.length > 0 && (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <select
                              value={slot.color || ''}
                              onChange={(e) => handleUpdatePackSlot(idx, 'color', e.target.value)}
                              aria-label={`Color para prenda #${idx + 1}`}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color-strong, #CBD5E1)',
                                backgroundColor: 'var(--bg-card, #FFF)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                            >
                              {colorsForSlotSize.map((c) => {
                                const st = getProductStockForSizeColor(product, slot.size, c);
                                return (
                                  <option key={c} value={c} disabled={st <= 0}>
                                    {c} {st <= 0 ? '(Sin stock)' : `(${st} disp.)`}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}

                        {/* Botón Eliminar si hay más de 3 prendas */}
                        {packSlots.length > 3 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePackSlot(idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#DC2626',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                            title="Quitar esta prenda del pack"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Botón para agregar otra prenda al pack y totalizador */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleAddPackSlot}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color-strong, #94A3B8)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-main)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={14} /> Sumar otra prenda al pack
                  </button>

                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Total pack: <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>${packTotalPrice.toLocaleString('es-AR')}</strong>
                  </span>
                </div>

                {/* Alerta si se excede stock disponible */}
                {stockIssues.length > 0 && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#DC2626',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={15} style={{ flexShrink: 0 }} />
                      <span>{stockIssues[0]}</span>
                    </div>
                    <a
                      href={`https://wa.me/5493412648035?text=${encodeURIComponent(`¡Hola Dulce Valentín! Estoy armando un pack de "${product.name}" (Cód: ${product.code || product.id}) pero me figura sin stock en algunas opciones. ¿Me lo podrían conseguir de fábrica?`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        backgroundColor: '#25D366',
                        color: '#FFFFFF',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        textDecoration: 'none',
                        marginTop: '4px'
                      }}
                    >
                      <MessageCircle size={15} /> Pedir que me lo consigan por WhatsApp
                    </a>
                  </div>
                )}

                {/* Botón de Agregar Pack al Carrito */}
                <button
                  type="button"
                  onClick={handleAddPack}
                  className="btn-add-cart"
                  disabled={stockIssues.length > 0}
                  style={{
                    marginTop: '12px',
                    opacity: stockIssues.length > 0 ? 0.55 : 1,
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <ShoppingCart size={17} style={{ flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.25' }}>
                    <span style={{ fontWeight: 800 }}>
                      Agregar Pack de {packSlots.length} prendas por ${packTotalPrice.toLocaleString('es-AR')}
                    </span>
                    <span style={{ fontSize: '0.74rem', opacity: 0.9, fontWeight: 600, marginTop: '2px' }}>
                      ✓ {packSlots.length} unidades combinadas al carrito
                    </span>
                  </div>
                </button>
              </div>
            ) : (
              /* Modo Single (Mismo Talle / Color) */
              <>
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
                          onClick={() => handleSelectSize(size)}
                          className={`size-pill ${selectedSize === size ? 'active' : ''}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableColors && availableColors.length > 0 && (
                  <div style={{ marginTop: '14px' }}>
                    <span className="product-detail-size-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Palette size={14} style={{ color: 'var(--accent-gold)' }} />
                      Color: {selectedColor ? <strong>{selectedColor}</strong> : 'Seleccionar'}
                      {selectedColor && (
                        <span style={{ fontSize: '0.78rem', color: currentVariantStock > 0 ? '#059669' : '#DC2626', marginLeft: '6px', fontWeight: 600 }}>
                          ({currentVariantStock > 0 ? `${currentVariantStock} disp.` : 'Sin stock'})
                        </span>
                      )}
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {availableColors.map((color) => {
                        const isSelected = selectedColor === color;
                        const stockForThisColor = selectedSize
                          ? getProductStockForSizeColor(product, selectedSize, color)
                          : Number(product.stock) || 0;
                        const isOut = stockForThisColor <= 0;

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
                              color: isSelected ? 'var(--bg-page)' : (isOut ? 'var(--text-muted)' : 'var(--text-main)'),
                              opacity: isOut ? 0.65 : 1,
                              boxShadow: isSelected ? '0 2px 8px rgba(15,23,42,0.25)' : 'none',
                              textDecoration: isOut ? 'line-through' : 'none'
                            }}
                            title={isOut ? `${color} (Sin stock)` : `${color} (${stockForThisColor} disp.)`}
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

                {/* Selector de Cantidad Inteligente y Botones Rápidos */}
                <div style={{
                  marginTop: '14px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '10px'
                  }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📦 Cantidad:</span>
                      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        (Stock: {currentVariantStock})
                      </span>
                    </div>
                    
                    {/* Stepper manual */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      backgroundColor: 'var(--bg-card)',
                      border: '1.5px solid var(--border-color-strong, #CBD5E1)',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        style={{
                          width: '32px',
                          height: '32px',
                          border: 'none',
                          background: 'none',
                          cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                          fontWeight: 900,
                          fontSize: '1.1rem',
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        −
                      </button>
                      <span style={{
                        minWidth: '34px',
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: '0.95rem',
                        color: 'var(--text-main)'
                      }}>
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(currentVariantStock || 99, q + 1))}
                        disabled={currentVariantStock > 0 && quantity >= currentVariantStock}
                        style={{
                          width: '32px',
                          height: '32px',
                          border: 'none',
                          background: 'none',
                          cursor: currentVariantStock > 0 && quantity >= currentVariantStock ? 'not-allowed' : 'pointer',
                          fontWeight: 900,
                          fontSize: '1.1rem',
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Botones rápidos de cantidad */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <button
                      type="button"
                      onClick={() => setQuantity(1)}
                      style={{
                        padding: '8px 2px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        border: quantity === 1 ? '2px solid var(--text-main)' : '1px solid var(--border-color)',
                        backgroundColor: quantity === 1 ? 'var(--text-main)' : 'var(--bg-card)',
                        color: quantity === 1 ? 'var(--bg-page)' : 'var(--text-main)',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      1 un.
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuantity(3)}
                      style={{
                        padding: '8px 2px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        border: quantity === 3 ? '2px solid #D97706' : '1px solid #FCD34D',
                        backgroundColor: quantity === 3 ? '#D97706' : '#FEF3C7',
                        color: quantity === 3 ? '#FFFFFF' : '#92400E',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                      title="3 unidades: Cumple la regla mayorista de primer artículo"
                    >
                      3 un. 🔥
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuantity(6)}
                      style={{
                        padding: '8px 2px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        border: quantity === 6 ? '2px solid var(--text-main)' : '1px solid var(--border-color)',
                        backgroundColor: quantity === 6 ? 'var(--text-main)' : 'var(--bg-card)',
                        color: quantity === 6 ? 'var(--bg-page)' : 'var(--text-main)',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      6 un.
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuantity(12)}
                      style={{
                        padding: '8px 2px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        border: quantity === 12 ? '2px solid #2563EB' : '1px solid #BFDBFE',
                        backgroundColor: quantity === 12 ? '#2563EB' : '#EFF6FF',
                        color: quantity === 12 ? '#FFFFFF' : '#1D4ED8',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                      title="Docena completa (12 unidades)"
                    >
                      Docena
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAdd}
                  className="btn-add-cart"
                  disabled={currentVariantStock <= 0}
                  style={{
                    marginTop: '14px',
                    opacity: currentVariantStock <= 0 ? 0.55 : 1,
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <ShoppingCart size={17} style={{ flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.25' }}>
                    <span style={{ fontWeight: 800 }}>
                      {currentVariantStock > 0
                        ? `Agregar ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'} por $${(currentPrice * quantity).toLocaleString('es-AR')}`
                        : (selectedSize || selectedColor ? 'Sin stock en esta opción' : 'Sin Stock')}
                    </span>
                    {(selectedSize || selectedColor) && currentVariantStock > 0 && (
                      <span style={{ fontSize: '0.74rem', opacity: 0.85, fontWeight: 600, marginTop: '2px' }}>
                        {[selectedSize ? `Talle: ${selectedSize}` : null, selectedColor ? `Color: ${selectedColor}` : null].filter(Boolean).join(' • ')}
                      </span>
                    )}
                  </div>
                </button>

                {currentVariantStock <= 0 && (
                  <div style={{
                    marginTop: '14px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#F0FDF4',
                    border: '1.5px solid #86EFAC',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 800, fontSize: '0.86rem' }}>
                      <MessageCircle size={17} />
                      <span>¿Buscás este modelo o talle?</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803D', lineHeight: 1.4 }}>
                      No tenemos stock disponible en este momento en el sistema, pero te lo podemos conseguir directo de fábrica o distribuidora. ¡Escribinos por WhatsApp!
                    </p>
                    <a
                      href={`https://wa.me/5493412648035?text=${encodeURIComponent(`¡Hola Dulce Valentín! Quería consultar por stock de "${product.name}"${selectedSize ? ` en talle ${selectedSize}` : ''}${selectedColor ? ` color ${selectedColor}` : ''} (Cód: ${product.code || product.id}). ¿Me lo consiguen?`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        backgroundColor: '#25D366',
                        color: '#FFFFFF',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        textDecoration: 'none',
                        boxShadow: '0 2px 6px rgba(37,211,102,0.3)',
                        textAlign: 'center'
                      }}
                    >
                      <MessageCircle size={16} /> Consultar y encargar por WhatsApp al 341-264-8035
                    </a>
                  </div>
                )}
              </>
            )}

            {justAdded && (
              <div className="pdm-added" role="status">
                <div className="pdm-added-title">✓ Agregado: {justAdded}</div>
                <div className="pdm-added-text">
                  Llevás <strong>{cartCountForProduct}</strong> de este producto.
                  {!product.exempt_from_min3 && cartCountForProduct < 3
                    ? ` Sumá ${3 - cartCountForProduct} más para completar tu primer artículo x3: podés combinar talles y colores.`
                    : ' Podés sumar otro talle o color, o seguir comprando.'}
                </div>
                <div className="pdm-added-actions">
                  <button type="button" className="pdm-added-btn" onClick={handleClose}>Seguir comprando</button>
                  {onViewCart && (
                    <button type="button" className="pdm-added-btn primary" onClick={goToCart}>Ver carrito</button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Productos relacionados: ancho completo abajo de las 2 columnas */}
        {onSelectProduct && relatedProducts.length > 0 && (
          <div className="pdm-related">
            <div className="pdm-related-title">También te puede interesar</div>
            <div className="pdm-related-track">
              {relatedProducts.map((rp) => (
                <button key={rp.id} type="button" className="pdm-related-card" onClick={() => onSelectProduct(rp)}>
                  <SafeImg
                    src={rp.image_url ? getThumbUrl(rp.image_url) : '/logo.png'}
                    fallbacks={[rp.image_url, '/logo.png']}
                    alt={rp.name}
                    loading="lazy"
                    className="pdm-related-img"
                  />
                  <span className="pdm-related-name">{rp.name}</span>
                  <span className="pdm-related-price">${Number(getProductPrice(rp, null) || 0).toLocaleString('es-AR')}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
