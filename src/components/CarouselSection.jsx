'use client';

import { useState, useEffect } from 'react';
import { Flame, ChevronLeft, ChevronRight, ShoppingCart, Tag, Sparkles, Camera } from 'lucide-react';

const DEFAULT_SLIDES = [
  {
    id: 'p-0044-bolso-maternal-de-jeans-premium',
    name: 'Bolso Maternal de Jeans Premium',
    category: 'Bebés',
    subcategory: 'Bolsos Maternales',
    description: 'Bolso maternal premium en tela de jean reforzada. Incluye cambiador acolchado y múltiples compartimientos térmicos para mamaderas.',
    image_url: 'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0044-bolso-maternal-de-jeans-premium-1.webp',
    image_urls: [
      'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0044-bolso-maternal-de-jeans-premium-1.webp',
      'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0044-bolso-maternal-de-jeans-premium-2.webp',
      'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0044-bolso-maternal-de-jeans-premium-3.webp'
    ],
    wholesale_price: 19900
  },
  {
    id: 'p-0017-ajuar-cajita-7-piezas-rn',
    name: 'Ajuar Cajita 7 Piezas RN',
    category: 'Bebés',
    subcategory: 'Ajuar y Sets',
    description: 'Set de ajuar 7 piezas 100% algodón en cajita de regalo: mantita, ranita, gorrito, manoplas, babero, body y batita.',
    image_url: 'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0017-ajuar-cajita-7-piezas-rn-1.webp',
    image_urls: [
      'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0017-ajuar-cajita-7-piezas-rn-1.webp',
      'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0017-ajuar-cajita-7-piezas-rn-2.webp',
      'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0017-ajuar-cajita-7-piezas-rn-3.webp'
    ],
    wholesale_price: 21000
  },
  {
    id: 'p-0043-bolso-maternal-estampado-cambiador',
    name: 'Bolso Maternal Estampado + Cambiador',
    category: 'Bebés',
    subcategory: 'Bolsos Maternales',
    description: 'Bolso maternal estampado impermeable con amplio espacio interior, bolsillos exteriores y cambiador portátil a juego.',
    image_url: 'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0043-bolso-maternal-estampado-cambiador-1.webp',
    image_urls: [
      'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0043-bolso-maternal-estampado-cambiador-1.webp',
      'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0043-bolso-maternal-estampado-cambiador-2.webp'
    ],
    wholesale_price: 17900
  },
  {
    id: 'p-0027-set-nidito-contenedor-cambiador-almohadita',
    name: 'Set Nidito Contenedor + Cambiador + Almohadita',
    category: 'Bebés',
    subcategory: 'Blanquería y Cuidado',
    description: 'Combo completo de descanso y cuidado para recién nacido. Confección hipoalergénica y acolchada de primera calidad.',
    image_url: 'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0027-set-nidito-contenedor-cambiador-almohadita-1.webp',
    wholesale_price: 36000
  }
];

export default function CarouselSection({ offers, featuredOffer, topSeller, onAddToCart, onOpenDetail }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Combina ofertas de la base de datos o usa las colecciones destacadas (Bolsos, Ajuares, etc.)
  const slides = (offers && offers.length > 0) ? offers : DEFAULT_SLIDES;

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

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
        <div
          className="carousel-box"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="carousel-slide-content" key={currentSlide.id}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
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
                color: 'rgba(255, 255, 255, 0.9)',
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                padding: '4px 8px',
                borderRadius: '4px',
                pointerEvents: 'none',
                textTransform: 'uppercase',
                userSelect: 'none',
                zIndex: 2
              }}>
                Dulce Valentín
              </span>
              {currentSlide.image_urls && currentSlide.image_urls.length > 1 && (
                <span style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(4px)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  pointerEvents: 'none',
                  zIndex: 2
                }}>
                  <Camera size={11} /> {currentSlide.image_urls.length} fotos
                </span>
              )}
            </div>
            <div className="carousel-info">
              <span className="carousel-tag">
                <Tag size={12} style={{ marginRight: '4px' }} />
                {currentSlide.subcategory || currentSlide.category || 'Novedad & Oferta'}
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
