'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Camera, X } from 'lucide-react';

export default function ProductPageGallery({ images = [], name = '' }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const touchStartX = useRef(null);

  const validImages = Array.isArray(images) && images.length > 0 ? images.filter(Boolean) : ['/logo.png'];
  const hasMultiple = validImages.length > 1;
  const currentImg = validImages[activeIdx] || validImages[0] || '/logo.png';

  const handlePrev = (e) => {
    e?.stopPropagation();
    setActiveIdx((prev) => (prev - 1 + validImages.length) % validImages.length);
  };

  const handleNext = (e) => {
    e?.stopPropagation();
    setActiveIdx((prev) => (prev + 1) % validImages.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 40 && hasMultiple) {
      if (deltaX > 0) {
        setActiveIdx((prev) => (prev - 1 + validImages.length) % validImages.length);
      } else {
        setActiveIdx((prev) => (prev + 1) % validImages.length);
      }
    }
    touchStartX.current = null;
  };

  return (
    <div className="product-gallery-column" style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        className="product-detail-img-wrapper"
        style={{ position: 'relative', cursor: 'zoom-in', width: '100%', minHeight: '380px', borderRadius: '12px', overflow: 'hidden' }}
        onClick={() => setIsZoomed(true)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        title="Toca o haz clic para expandir imagen"
      >
        <Image
          src={currentImg}
          alt={name}
          fill
          unoptimized
          sizes="(max-width: 720px) 100vw, 500px"
          style={{ objectFit: 'cover' }}
          onError={(e) => { e.target.src = '/logo.png'; }}
        />

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Foto anterior"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '38px',
                height: '38px',
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
              <ChevronLeft size={22} />
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Foto siguiente"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '38px',
                height: '38px',
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
              <ChevronRight size={22} />
            </button>

            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
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
              }}
            >
              <Camera size={12} /> {activeIdx + 1}/{validImages.length}
            </div>
          </>
        )}

        <div
          style={{
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
          }}
        >
          ⭐ DULCE VALENTÍN
        </div>

        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            color: '#FFFFFF',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: 700,
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
            zIndex: 3
          }}
        >
          🔍 Tap para expandir
        </div>
      </div>

      {/* Tira de Miniaturas */}
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
          {validImages.map((imgUrl, idx) => {
            const isActive = idx === activeIdx;
            return (
              <button
                key={`${imgUrl}-${idx}`}
                type="button"
                onClick={() => setActiveIdx(idx)}
                style={{
                  position: 'relative',
                  width: '64px',
                  height: '64px',
                  minWidth: '64px',
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

      {/* Overlay de Zoom */}
      {isZoomed && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            cursor: 'zoom-out',
            padding: '20px'
          }}
          onClick={() => setIsZoomed(false)}
        >
          <button
            type="button"
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

          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handlePrev(e); }}
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
                onClick={(e) => { e.stopPropagation(); handleNext(e); }}
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

              <div
                style={{
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
                }}
              >
                {activeIdx + 1} / {validImages.length}
              </div>
            </>
          )}

          <img
            src={currentImg}
            alt={name}
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
