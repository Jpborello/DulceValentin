'use client';

// Los 2 banners del home ("Promociones de la semana" y "Reventón del
// sábado"). Reemplazan al carrusel de liquidaciones y nuevos ingresos.
// Imagen, titulo, texto y link se editan desde el panel (pestaña Banners).
export default function PromoBanners({ banners = [] }) {
  const visible = banners.filter((b) => b.active !== false && (b.title || b.text || b.image_url));
  if (visible.length === 0) return null;

  return (
    <section className="dv-promos" aria-label="Promociones">
      {visible.map((b, i) => {
        const isExternal = /^https?:\/\//i.test(b.link || '');
        const content = (
          <>
            {b.image_url ? (
              <img src={b.image_url} alt="" className="dv-promo-img" loading={i === 0 ? 'eager' : 'lazy'} />
            ) : (
              <span className={`dv-promo-fallback dv-promo-fallback--${i % 2}`} aria-hidden="true" />
            )}
            <span className="dv-promo-scrim" aria-hidden="true" />
            <span className="dv-promo-copy">
              <span className="dv-promo-title">{b.title}</span>
              {b.text && <span className="dv-promo-text">{b.text}</span>}
              {b.link && <span className="dv-promo-cta">Ver más →</span>}
            </span>
          </>
        );

        return b.link ? (
          <a
            key={b.id}
            href={b.link}
            className="dv-promo"
            {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {content}
          </a>
        ) : (
          <div key={b.id} className="dv-promo">
            {content}
          </div>
        );
      })}
    </section>
  );
}
