'use client';

import { Sparkles, ArrowRight, Store } from 'lucide-react';

export default function HeroSection({ onExploreCatalog }) {
  return (
    <section className="hero-wrapper">
      <div className="hero-blob hero-blob-pink" aria-hidden="true"></div>
      <div className="hero-blob hero-blob-blue" aria-hidden="true"></div>

      <div className="hero-container">
        <div className="hero-text-col">
          <div className="hero-badge">
            <Store size={16} /> Mayorista de Indumentaria, Calzado y Complementos
          </div>

          <h1 className="hero-title">
            Moda e Indumentaria <span>Mayorista</span>
          </h1>

          <p className="hero-subtitle">
            Surtido completo para toda la familia: indumentaria, calzado y complementos.
            Los mejores precios por bulto y curva, con despacho a todo el país.
          </p>

          <div className="hero-actions-row">
            <button onClick={onExploreCatalog} className="btn-hero-primary">
              Explorar Catálogo Mayorista <ArrowRight size={18} style={{ display: 'inline', marginLeft: '6px' }} />
            </button>

            <a href="#destacados" className="btn-hero-glass">
              <Sparkles size={18} style={{ display: 'inline', marginRight: '6px' }} /> Ver Productos Destacados
            </a>
          </div>
        </div>

        {/* Collage de fotos de prendas en lugar del video (no existia el
            archivo hero-video.mp4 en este proyecto, quedaba un hueco vacio) */}
        <div className="hero-gallery">
          <div className="hero-gallery-item hero-gallery-item-1">
            <img src="/muestra/Zapatillas-Puma-Blancas.png" alt="Zapatillas — nuevo ingreso" />
            <span className="hero-gallery-tag">🆕 Nuevo Ingreso</span>
          </div>
          <div className="hero-gallery-item hero-gallery-item-2">
            <img src="/muestra/COnjunto-Urban.png" alt="Conjunto urbano — más vendido" />
            <span className="hero-gallery-tag hero-gallery-tag-blue">🔥 Más Vendido</span>
          </div>
          <div className="hero-gallery-item hero-gallery-item-3">
            <img src="/muestra/Caja-BEBE-T-Unico-ROsa.png" alt="Body para bebé — nuevo ingreso" />
            <span className="hero-gallery-tag">🆕 Nuevo Ingreso</span>
          </div>
        </div>
      </div>
    </section>
  );
}
