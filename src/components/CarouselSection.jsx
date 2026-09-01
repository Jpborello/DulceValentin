'use client';

import { useState, useEffect } from 'react';
import { Flame, ChevronLeft, ChevronRight, ShoppingCart, Tag, Sparkles } from 'lucide-react';

export default function CarouselSection({ offers, featuredOffer, topSeller, onAddToCart, onOpenDetail }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Combine offers into slides
  const slides = offers.length > 0 ? offers : [
    {
      id: 'slide-1',
      name: 'Novedades de la Semana — Camperas & Buzos Frizados',
      description: 'Aprovechá la nueva temporada con un 15% de descuento adicional llevando curva completa de talles.',
      image_url: '/logo.png',
      wholesale_price: 34000
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const currentSlide = slides[currentIndex] || slides[0];

  return (
    <section id="ofertas" className="carousel-section-container">

      {/* Oferta Destacada: la UNA promo que el admin eligio empujar, fija y
          bien grande arriba de todo, para que no se pierda entre las demas */}
      {featuredOffer && (
        <div className="featured-offer-banner">
          <div className="featured-offer-glow" />
          <img
            src={featuredOffer.image_url}
            alt={featuredOffer.name}
            className="featured-offer-img"
            onClick={() => onOpenDetail && onOpenDetail(featuredOffer)}
            title="Ver detalle del producto"
          />
          <div className="featured-offer-info">
            <span className="featured-offer-tag">
              <Sparkles size={13} style={{ marginRight: '5px' }} /> Oferta Destacada
            </span>
            <h3
              className="featured-offer-title"
              onClick={() => onOpenDetail && onOpenDetail(featuredOffer)}
              title="Ver detalle del producto"
            >
              {featuredOffer.name}
            </h3>
            {featuredOffer.description && (
              <p className="featured-offer-desc">{featuredOffer.description}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '18px' }}>
              <span className="featured-offer-price">
                ${featuredOffer.wholesale_price?.toLocaleString('es-AR')}
              </span>
              <button onClick={() => onAddToCart(featuredOffer)} className="btn-hero-primary">
                <ShoppingCart size={16} /> Pedir esta Oferta
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="carousel-card-grid">

        {/* Left Side: Offers & News Auto-Carousel */}
        <div className="carousel-box">
          <div className="carousel-slide-content" key={currentSlide.id}>
            <img
              src={currentSlide.image_url}
              alt={currentSlide.name}
              className="carousel-img"
              onClick={() => onOpenDetail && onOpenDetail(currentSlide)}
              title="Ver detalle del producto"
              style={{ cursor: 'pointer' }}
            />
            <span style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '1px',
              color: 'rgba(255, 255, 255, 0.8)',
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              backdropFilter: 'blur(3px)',
              padding: '4px 8px',
              borderRadius: '4px',
              pointerEvents: 'none',
              textTransform: 'uppercase',
              userSelect: 'none',
              zIndex: 2
            }}>
              Dulce Valentín
            </span>
            <div className="carousel-info">
              <span className="carousel-tag">
                <Tag size={12} style={{ marginRight: '4px' }} /> Novedad & Oferta
              </span>
              <h3
                className="carousel-title"
                onClick={() => onOpenDetail && onOpenDetail(currentSlide)}
                title="Ver detalle del producto"
                style={{ cursor: 'pointer' }}
              >
                {currentSlide.name}
              </h3>
              <p className="carousel-desc">{currentSlide.description}</p>

              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <span className="price-wholesale-label">
                  ${currentSlide.wholesale_price?.toLocaleString('es-AR')}
                </span>
                <button
                  onClick={() => onAddToCart(currentSlide)}
                  className="btn-primary"
                >
                  <ShoppingCart size={16} /> Pedir en Oferta
                </button>
              </div>
            </div>
          </div>

          <div className="carousel-controls">
            <div className="carousel-dots">
              {slides.map((_, idx) => (
                <div
                  key={idx}
                  className={`dot ${idx === currentIndex ? 'active' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length)}
                className="qty-btn"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentIndex((prev) => (prev + 1) % slides.length)}
                className="qty-btn"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Automatically Featured Top Seller */}
        {topSeller && (
          <div id="destacados" className="top-seller-box">
            <div className="top-seller-badge">
              <Flame size={12} style={{ display: 'inline', marginRight: '3px' }} /> Más Vendido
            </div>

            <div>
              <img
                src={topSeller.image_url}
                alt={topSeller.name}
                className="top-seller-img"
                onClick={() => onOpenDetail && onOpenDetail(topSeller)}
                title="Ver detalle del producto"
                style={{ cursor: 'pointer' }}
              />
              <h4
                className="top-seller-title"
                onClick={() => onOpenDetail && onOpenDetail(topSeller)}
                title="Ver detalle del producto"
                style={{ cursor: 'pointer' }}
              >
                {topSeller.name}
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                ⭐ Mayor rotación en la tienda ({topSeller.sales_count} un. vendidas)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Precio Mayorista:</div>
                <div className="price-wholesale-label">${topSeller.wholesale_price?.toLocaleString('es-AR')}</div>
              </div>
              <button onClick={() => onAddToCart(topSeller)} className="btn-hero-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <ShoppingCart size={16} /> Agregar
              </button>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
