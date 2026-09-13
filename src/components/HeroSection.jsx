'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Sparkles,
  Tag,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  ArrowRight,
  Eye,
  Camera
} from 'lucide-react';

const FALLBACK_PROMO_SLIDES = [
  {
    id: 'promo-bolso-maternal',
    name: 'Bolso Maternal Jeans Premium',
    category: 'Bebés',
    subcategory: 'Bolsos Maternales',
    badge: '🔥 Súper Oferta Mayorista',
    tagline: 'Calidad Premium · Incluye cambiador acolchado térmico',
    description: 'Bolso maternal en tela de jean reforzada con múltiples bolsillos organizadores. Ideal para reventa con altísimo margen.',
    image_url: 'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0044-bolso-maternal-de-jeans-premium-1.webp',
    wholesale_price: 19900
  },
  {
    id: 'promo-ajuar-cajita',
    name: 'Ajuar Cajita 7 Piezas RN',
    category: 'Bebés',
    subcategory: 'Ajuar y Sets',
    badge: '✨ Novedad Exclusiva',
    tagline: '100% Algodón Hipoalergénico · Presentación para regalo',
    description: 'Set completo de 7 piezas presentado en caja de regalo: mantita, ranita, gorrito, manoplas, babero, body y batita.',
    image_url: 'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0017-ajuar-cajita-7-piezas-rn-1.webp',
    wholesale_price: 21000
  },
  {
    id: 'promo-cambiador-nidito',
    name: 'Set Nidito Contenedor + Almohadita',
    category: 'Bebés',
    subcategory: 'Blanquería y Cuidado',
    badge: '⭐ Producto Estrella',
    tagline: 'Combo Completo de Descanso y Confort',
    description: 'Confección hipoalergénica de primera calidad. Producto de altísima rotación mayorista con entrega inmediata.',
    image_url: 'https://revrbrrzlnweuxwhpgei.supabase.co/storage/v1/object/public/Productos/catalogo-2026/p-0027-set-nidito-contenedor-cambiador-almohadita-1.webp',
    wholesale_price: 36000
  }
];

export default function HeroSection({
  offers = [],
  featuredOffer = null,
  topSeller = null,
  onAddToCart,
  onOpenDetail,
  onExploreCatalog
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef(null);

  // Construir la lista de slides dinámicos con ofertas, destacados y promociones
  const slides = [];

  if (featuredOffer) {
    slides.push({
      ...featuredOffer,
      badge: '✨ Oferta Destacada',
      tagline: 'Oportunidad Exclusiva Mayorista'
    });
  }

  if (Array.isArray(offers) && offers.length > 0) {
    offers.forEach((offer) => {
      if (!slides.some((s) => s.id === offer.id)) {
        slides.push({
          ...offer,
          badge: offer.is_offer ? '🔥 Oferta Especial' : '🎉 Promoción',
          tagline: offer.subcategory || offer.category || 'Mayorista Directo'
        });
      }
    });
  }

  if (topSeller && !slides.some((s) => s.id === topSeller.id)) {
    slides.push({
      ...topSeller,
      badge: '⭐ Más Vendido de la Semana',
      tagline: `Mayor Rotación (${topSeller.sales_count || 120}+ vendidos)`
    });
  }

  // Si no hay suficientes ofertas dinámicas cargadas, complementar con las promociones destacadas
  if (slides.length < 2) {
    FALLBACK_PROMO_SLIDES.forEach((fb) => {
      if (!slides.some((s) => s.id === fb.id)) {
        slides.push(fb);
      }
    });
  }

  // Rotación automática cada 4.8 segundos si no está en pausa
  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 4800);
    return () => clearInterval(interval);
  }, [slides.length, isPaused]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  // Soporte para gestos táctiles (swipe en mobile)
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (diffX > 45) {
      handlePrev();
    } else if (diffX < -45) {
      handleNext();
    }
    touchStartXRef.current = null;
  };

  const currentSlide = slides[currentIndex] || slides[0];

  return (
    <section
      className="hero-carousel-section"
      aria-label="Promociones y Ofertas Destacadas"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="hero-carousel-viewport">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={slide.id || index}
              className={`hero-carousel-slide ${isActive ? 'active' : ''}`}
              aria-hidden={!isActive}
            >
              {/* Contenedor de contenido editorial y oferta */}
              <div className="hero-slide-layout">
                {/* Columna Texto y CTA */}
                <div className="hero-slide-info">
                  <div className="hero-kicker-row">
                    <span className="hero-badge-pill">
                      {slide.badge || '🔥 Oferta Mayorista'}
                    </span>
                    <span className="hero-kicker-city">Rosario · Envíos al País</span>
                  </div>

                  <h1 className="hero-slide-title">
                    {slide.name}
                  </h1>

                  {slide.tagline && (
                    <p className="hero-slide-tagline">{slide.tagline}</p>
                  )}

                  <p className="hero-slide-desc">
                    {slide.description || 'Prendas confeccionadas con la mejor calidad textil. Precios 100% mayoristas sin intermediarios.'}
                  </p>

                  <div className="hero-slide-pricing">
                    <div className="hero-price-block">
                      <span className="hero-price-prefix">Precio Mayorista:</span>
                      <span className="hero-price-amount">
                        ${slide.wholesale_price?.toLocaleString('es-AR') || 'Consultar'}
                      </span>
                    </div>
                  </div>

                  <div className="hero-slide-actions">
                    {onAddToCart && (
                      <button
                        type="button"
                        onClick={() => onAddToCart(slide)}
                        className="btn-hero-primary"
                        id="hero-btn-add"
                      >
                        <ShoppingCart size={18} /> Pedir en Oferta
                      </button>
                    )}

                    {onOpenDetail && (
                      <button
                        type="button"
                        onClick={() => onOpenDetail(slide)}
                        className="btn-hero-outline"
                        id="hero-btn-detail"
                      >
                        <Eye size={17} /> Ver Detalle
                      </button>
                    )}

                    {onExploreCatalog && (
                      <button
                        type="button"
                        onClick={onExploreCatalog}
                        className="btn-hero-ghost"
                        id="hero-btn-catalog"
                      >
                        Ver Catálogo <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Columna Imagen del Producto / Oferta */}
                <div className="hero-slide-media">
                  <div className="hero-image-card" onClick={() => onOpenDetail && onOpenDetail(slide)}>
                    <img
                      src={slide.image_url || '/logo.png'}
                      alt={slide.name}
                      className="hero-main-img"
                      loading={index === 0 ? 'eager' : 'lazy'}
                    />
                    <div className="hero-image-overlay">
                      <span className="hero-overlay-tag">
                        <Tag size={13} /> {slide.category || 'Mayorista'}
                      </span>
                      {slide.image_urls && slide.image_urls.length > 1 && (
                        <span className="hero-overlay-photos">
                          <Camera size={12} /> {slide.image_urls.length} fotos
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Flechas de navegación */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            className="hero-nav-arrow hero-nav-prev"
            onClick={handlePrev}
            aria-label="Oferta anterior"
            title="Oferta anterior"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            className="hero-nav-arrow hero-nav-next"
            onClick={handleNext}
            aria-label="Siguiente oferta"
            title="Siguiente oferta"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Paginación con Dots indicadores */}
      {slides.length > 1 && (
        <div className="hero-carousel-dots" role="tablist">
          {slides.map((s, idx) => (
            <button
              key={s.id || idx}
              type="button"
              role="tab"
              aria-selected={idx === currentIndex}
              className={`hero-dot ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Ir a oferta ${idx + 1}: ${s.name}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
