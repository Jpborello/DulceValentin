'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getThumbUrl } from '@/lib/dataStore';
import SafeImg from '@/components/admin/SafeImg';

// Visor de fotos a pantalla completa para el panel admin (Control de Stock y
// Gestión de Imágenes). Muestra la foto completa (no la miniatura), con
// flechas y miniaturas si el producto tiene varias. Se cierra con Esc, con
// la X o tocando afuera de la foto; las flechas del teclado pasan de foto.
export default function ImageLightbox({ images = [], startIndex = 0, title = '', onClose }) {
  const list = images.filter(Boolean);
  const count = list.length;
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(count - 1, 0)));
  const closeRef = useRef(null);

  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && count > 1) prev();
      else if (e.key === 'ArrowRight' && count > 1) next();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [onClose, prev, next, count]);

  if (count === 0) return null;
  const current = list[Math.min(index, count - 1)];
  const stop = (e) => e.stopPropagation();

  return (
    <div className="lbx" role="dialog" aria-modal="true" aria-label={title ? `Fotos de ${title}` : 'Foto ampliada'} onClick={onClose}>
      <div className="lbx-top" onClick={stop}>
        <span className="lbx-title">{title}</span>
        {count > 1 && <span className="lbx-count">{index + 1} / {count}</span>}
        <button ref={closeRef} type="button" className="lbx-btn" onClick={onClose} aria-label="Cerrar">
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="lbx-stage">
        {count > 1 && (
          <button type="button" className="lbx-btn lbx-nav lbx-prev" onClick={(e) => { stop(e); prev(); }} aria-label="Foto anterior">
            <ChevronLeft size={28} aria-hidden="true" />
          </button>
        )}
        <SafeImg
          src={current}
          fallbacks={['/logo.png']}
          alt={title ? `${title} — foto ${index + 1}` : `Foto ${index + 1}`}
          className="lbx-img"
          onClick={stop}
        />
        {count > 1 && (
          <button type="button" className="lbx-btn lbx-nav lbx-next" onClick={(e) => { stop(e); next(); }} aria-label="Foto siguiente">
            <ChevronRight size={28} aria-hidden="true" />
          </button>
        )}
      </div>

      {count > 1 && (
        <div className="lbx-thumbs" onClick={stop}>
          {list.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              className={`lbx-thumb ${i === index ? 'is-active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
            >
              <SafeImg src={getThumbUrl(url) || url} fallbacks={[url]} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
