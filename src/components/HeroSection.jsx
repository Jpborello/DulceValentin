'use client';

import PromoBanners from '@/components/PromoBanners';

// Foto del frente del local (public/hero/). Hay dos tamaños para que el
// celular no descargue la version grande.
const HERO_IMG = '/hero/local-dulce-valentin-1376.webp';
const HERO_IMG_SMALL = '/hero/local-dulce-valentin-800.webp';

/**
 * Hero de la home: foto del local a todo el ancho con el H1 fijo encima
 * (no rota, asi Google y los buscadores con IA siempre leen el mismo
 * titular), y debajo los 2 banners editables desde el panel ("Promociones
 * de la semana" y "Reventón del sábado"). Hasta 2026-10 aca iba un carrusel
 * de liquidaciones y nuevos ingresos.
 */
export default function HeroSection({ banners = [] }) {
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
          </div>
        </div>
      </section>

      <PromoBanners banners={banners} />
    </>
  );
}
