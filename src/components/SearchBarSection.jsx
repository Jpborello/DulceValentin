'use client';

import { useRef } from 'react';
import { Search, X, Sparkles } from 'lucide-react';

const POPULAR_SEARCHES = [
  'Remeras',
  'Calzado',
  'Lencería',
  'Bebés',
  'Buzos',
  'Pantalones',
  'Ofertas'
];

export default function SearchBarSection({
  searchQuery = '',
  setSearchQuery,
  totalResults = null,
  onClear
}) {
  const inputRef = useRef(null);

  const handleClear = () => {
    if (setSearchQuery) setSearchQuery('');
    if (onClear) onClear();
    if (inputRef.current) inputRef.current.focus();
  };

  const handleTagClick = (tag) => {
    if (setSearchQuery) setSearchQuery(tag);
    // Desplazar suavemente hacia el catálogo de resultados si hay algo escrito
    requestAnimationFrame(() => {
      const el = document.getElementById('catalogo');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <section className="search-bar-section" aria-label="Búsqueda de productos">
      <div className="search-bar-container">
        <div className="search-input-wrapper">
          <div className="search-icon-badge" aria-hidden="true">
            <Search size={22} className="search-icon-svg" />
          </div>

          <input
            ref={inputRef}
            type="text"
            className="search-main-input"
            placeholder="¿Qué estás buscando?"
            value={searchQuery}
            onChange={(e) => {
              if (setSearchQuery) setSearchQuery(e.target.value);
            }}
            aria-label="¿Qué estás buscando?"
            autoComplete="off"
            spellCheck="false"
          />

          {searchQuery.trim() !== '' && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClear}
              aria-label="Limpiar búsqueda"
              title="Borrar texto"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Sugerencias rápidas */}
        <div className="search-quick-tags">
          <span className="search-quick-label">
            <Sparkles size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Búsquedas populares:
          </span>
          <div className="search-tags-scroll">
            {POPULAR_SEARCHES.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`search-tag-chip ${searchQuery.toLowerCase() === tag.toLowerCase() ? 'active' : ''}`}
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Indicador de resultados cuando hay búsqueda activa */}
        {searchQuery.trim() !== '' && totalResults !== null && (
          <div className="search-results-feedback">
            <span>
              Encontramos <strong>{totalResults}</strong> {totalResults === 1 ? 'producto' : 'productos'} para &ldquo;{searchQuery}&rdquo;
            </span>
            <button type="button" onClick={handleClear} className="search-reset-link">
              Limpiar filtro
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
