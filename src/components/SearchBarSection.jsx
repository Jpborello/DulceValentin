'use client';

import { useRef } from 'react';
import { Search, X } from 'lucide-react';

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
      requestAnimationFrame(() => {
        const el = document.getElementById('catalogo');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
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
            placeholder="¿Qué estás buscando? (ej. remeras, buzos, calzado...)"
            value={searchQuery}
            onChange={(e) => {
              if (setSearchQuery) setSearchQuery(e.target.value);
            }}
            onKeyDown={handleKeyDown}
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
