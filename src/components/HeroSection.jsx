'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, MessageCircle } from 'lucide-react';
import { COMPANY_INFO } from '@/lib/companyInfo';
import { getProductPriceRange, getThumbUrl } from '@/lib/dataStore';

const WHATSAPP_URL = `https://wa.me/${COMPANY_INFO.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
  '¡Hola! Quiero hacer una consulta sobre productos de Dulce Valentín.'
)}`;

// Foto del frente del local (public/hero/). Hay dos tamaños para que el
// celular no descargue la version grande.
const HERO_IMG = '/hero/local-dulce-valentin-1376.webp';
const HERO_IMG_SMALL = '/hero/local-dulce-valentin-800.webp';

// Tope de productos en la tira: 6 imagenes de muestra para rotar con fluidez.
const MAX_ITEMS = 6;

const ITEM_KINDS = {
  destacado: 'Destacado',
  liquidacion: 'Liquidación',
  nuevo: 'Nuevo ingreso'
};

const formatPrice = (product) => {
  const { min, hasRange } = getProductPriceRange(product);
  if (min) return hasRange ? `Desde $${min.toLocaleString('es-AR')}` : `$${min.toLocaleString('es-AR')}`;
  if (product.wholesale_price) return `$${Number(product.wholesale_price).toLocaleString('es-AR')}`;
  return 'Consultar precio';
};

/**
 * Hero de la home: foto del local a todo el ancho con el H1 fijo encima
 * (no rota, asi Google y los buscadores con IA siempre leen el mismo
 * titular), y debajo una tira deslizable con la oferta destacada
 * (is_featured), las liquidaciones (is_offer) y los nuevos ingresos (is_new).
 */
export default function HeroSection({
  offers = [],
  featuredOffer = null,
  newArrivals = [],
  promoProducts = [],
  onOpenDetail,
  onExploreCatalog
}) {
  const trackRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const items = [];
  const pushItem = (product, kind) => {
    if (!product || items.length >= MAX_ITEMS) return;
    if (items.some((i) => i.id === product.id)) return;
    items.push({ ...product, kind });
  };
  pushItem(featuredOffer, 'destacado');
  (Array.isArray(promoProducts) ? promoProducts : []).forEach((p) =>
    pushItem(p, p.badge_text === 'Nuevo ingreso' ? 'nuevo' : 'liquidacion')
  );
  (Array.isArray(offers) ? offers : []).forEach((p) => pushItem(p, 'liquidacion'));
  (Array.isArray(newArrivals) ? newArrivals : []).forEach((p) => pushItem(p, 'nuevo'));

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, items.length]);

  // Rotación automática: va pasando los productos cada 3.5 segundos suavemente
  useEffect(() => {
    if (items.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      const el = trackRef.current;
      if (!el) return;

      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduce) return;

      const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 15;
      if (isAtEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const firstItem = el.querySelector('.dvn-item');
        const gap = 18;
        const step = firstItem ? firstItem.getBoundingClientRect().width + gap : el.clientWidth * 0.7;
        el.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [items.length, isPaused]);

  const scrollByPage = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const firstItem = el.querySelector('.dvn-item');
    const gap = 18;
    const step = firstItem ? firstItem.getBoundingClientRect().width + gap : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * step, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <>
      <section className="dvh" aria-labelledby="dvh-title">
        <picture>
          <source media="(max-width: 820px)" srcSet={HERO_IMG_SMALL} />
          <img
            src={HERO_IMG}
            alt="Frente del local mayorista Dulce Valentín en Av. Pres. Perón 5349, Rosario"
            className="dvh-bg"
            width={1376}
            height={768}
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <div className="dvh-scrim" aria-hidden="true" />
        <div className="dvh-inner">
          <div className="dvh-copy">
            <span className="dvh-eyebrow">Dulce Valentín · Rosario, Santa Fe</span>
            <h1 id="dvh-title" className="dvh-title">
              Mayorista de ropa, calzado y <em>lencería</em> en Rosario
            </h1>
            <p className="dvh-lead">
              Venta por mayor de indumentaria, calzado, lencería y artículos para
              bebés. Local en Av. Pres. Perón 5349, Rosario, y envíos a todo el país.
            </p>
            <div className="dvh-actions">
              {onExploreCatalog && (
                <button type="button" onClick={onExploreCatalog} className="dvh-btn dvh-btn--primary">
                  Ver catálogo mayorista <ArrowRight size={18} aria-hidden="true" />
                </button>
              )}
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="dvh-btn dvh-btn--secondary">
                <MessageCircle size={18} aria-hidden="true" /> Consultar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {items.length > 0 && (
        <section
          className="dvn"
          aria-labelledby="dvn-title"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <div className="dvn-head">
            <h2 id="dvn-title" className="dvn-title">Liquidaciones y nuevos ingresos</h2>
            <div className="dvn-arrows">
              <button
                type="button"
                className="dvn-arrow"
                onClick={() => scrollByPage(-1)}
                disabled={!canPrev}
                aria-label="Ver anteriores"
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="dvn-arrow"
                onClick={() => scrollByPage(1)}
                disabled={!canNext}
                aria-label="Ver siguientes"
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
          </div>

          <ul className="dvn-track" ref={trackRef}>
            {items.map((item, index) => (
              <li key={item.id} className="dvn-item">
                <button
                  type="button"
                  className="dvn-card"
                  onClick={() => onOpenDetail && onOpenDetail(item)}
                  aria-label={`${ITEM_KINDS[item.kind]}: ${item.name}, ${formatPrice(item)}`}
                >
                  <span className="dvn-media">
                    <img
                      src={getThumbUrl(item.image_url) || '/logo.png'}
                      alt=""
                      className="dvn-img"
                      loading={index < 4 ? 'eager' : 'lazy'}
                      onError={(e) => {
                        // Miniatura inexistente -> foto completa -> logo.
                        if (e.target.dataset.fallback !== 'full' && item.image_url) {
                          e.target.dataset.fallback = 'full';
                          e.target.src = item.image_url;
                        } else if (e.target.dataset.fallback !== 'logo') {
                          e.target.dataset.fallback = 'logo';
                          e.target.src = '/logo.png';
                        }
                      }}
                    />
                    <span
                      className={`dvn-badge ${
                        item.badge_text && item.badge_text !== 'Nuevo ingreso'
                          ? 'dvn-badge--promo'
                          : `dvn-badge--${item.kind}`
                      }`}
                    >
                      {item.badge_text || ITEM_KINDS[item.kind]}
                    </span>
                  </span>
                  <span className="dvn-body">
                    {item.category && <span className="dvn-cat">{item.category}</span>}
                    <span className="dvn-name">{item.name}</span>
                    <span className="dvn-price">{formatPrice(item)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
