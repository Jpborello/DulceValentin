'use client';

import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * Hero editorial: foto de la dueña a todo el ancho, con la tipografia serif
 * (EB Garamond) encima. La foto es un compuesto de estudio sobre fondo claro,
 * asi que el texto va en oscuro sobre el fondo — no hace falta la cortina
 * negra tipica, que es justo lo que hace que todos los e-commerce se parezcan.
 *
 * Se sirven dos recortes distintos: el apaisado en desktop y uno vertical
 * (armado sobre la figura parada) en mobile, porque la foto original es
 * 16:9 con las figuras en los extremos y un recorte vertical automatico
 * se comeria a una de las dos.
 *
 * Para cambiar de foto alcanza con tocar HERO_SET.
 */
const HERO_SET = 'model4';

export default function HeroSection({ onExploreCatalog }) {
  const mediaRef = useRef(null);

  // Parallax suave: la foto se mueve mas lento que la pagina al bajar.
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ticking = false;
    const update = () => {
      const offset = Math.min(window.scrollY, 600) * 0.18;
      media.style.transform = `translate3d(0, ${offset}px, 0) scale(1.06)`;
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className="hero-editorial">
      <div className="hero-editorial-media" ref={mediaRef}>
        <picture>
          <source
            media="(max-width: 760px)"
            type="image/webp"
            srcSet={`/modelos/${HERO_SET}-mobile.webp`}
          />
          <source media="(max-width: 760px)" srcSet={`/modelos/${HERO_SET}-mobile.jpg`} />
          <source type="image/webp" srcSet={`/modelos/${HERO_SET}-desktop.webp`} />
          <img
            src={`/modelos/${HERO_SET}-desktop.jpg`}
            alt="Dulce Valentín — indumentaria y calzado mayorista"
            fetchPriority="high"
            decoding="async"
          />
        </picture>
      </div>

      <div className="hero-editorial-scrim" aria-hidden="true" />

      <div className="hero-editorial-content">
        <span className="hero-kicker">Mayorista · Rosario</span>

        <h1 className="hero-editorial-title">
          Dulce
          <span>Valentín</span>
        </h1>

        <p className="hero-editorial-sub">
          Indumentaria, calzado y complementos para toda la familia.
          Precio 100% mayorista y envíos a todo el país.
        </p>

        <div className="hero-editorial-actions">
          <button onClick={onExploreCatalog} className="btn-hero-primary">
            Ver catálogo <ArrowRight size={17} />
          </button>
          <a href="#categorias" className="btn-hero-outline">
            Categorías
          </a>
        </div>
      </div>
    </section>
  );
}
