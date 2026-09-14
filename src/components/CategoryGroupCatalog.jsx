'use client';

import { useMemo, useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { buildProductSlug } from '@/lib/productSlug';
import { getProductPriceRange } from '@/lib/productPricing';
import { flexibleProductMatch, normalizeText } from '@/lib/searchUtils';

const PRODUCTS_PER_PAGE = 24;

/**
 * Catalogo interactivo de una pagina de categoria (/categoria/...).
 *
 * Recibe TODOS los productos de la categoria (o del grupo de categorias, para
 * las 4 tarjetas principales del home) ya resueltos en el servidor, y filtra
 * todo del lado del cliente: buscador libre, y — si la categoria tiene mas
 * de un "tier" (ej. Indumentaria = Hombres + Mujeres + Infantil) — un primer
 * filtro por tier y despues por subcategoria. Asi la pagina carga con el
 * listado completo (bueno para SEO) y filtrar es instantaneo, sin recargar.
 *
 * `tiers`: [{ id, name, subcategories: string[] }]
 *   - Si tiers.length === 1 (categoria real puntual: Calzado, Bebés, una
 *     subcategoria de Mujeres, etc.) no se muestra selector de tier, directo
 *     se ofrecen sus subcategorias.
 *   - Si tiers.length > 1 (grupo del home, hoy solo Indumentaria) se muestra
 *     primero el selector de tier (Hombre/Mujer/Infantil) y recien despues
 *     las subcategorias de ese tier.
 */
export default function CategoryGroupCatalog({ tiers = [], initialProducts = [], initialSubcategory = null }) {
  const singleTier = tiers.length <= 1;
  const [selectedTierId, setSelectedTierId] = useState(singleTier ? (tiers[0]?.id ?? null) : null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialSubcategory || null);
  const [searchQuery, setSearchQuery] = useState('');
  // Antes se mostraban TODOS los productos de la categoria de una — con
  // grupos grandes (ej. Indumentaria, 45+ productos) quedaba un scroll
  // eterno. Ahora se pagina igual que el catálogo de la home ("Ver más
  // productos"), y se reinicia a la primera tanda cada vez que cambia un
  // filtro para no dejar "colgada" una página 3 sobre un resultado nuevo.
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);

  const activeTier = tiers.find((t) => normalizeText(t.id) === normalizeText(selectedTierId)) || (singleTier ? tiers[0] : null);

  const subcategoryOptions = activeTier?.subcategories || [];

  const handleSelectTier = (tierId) => {
    setSelectedTierId(tierId);
    setSelectedSubcategory(null);
  };

  const filteredProducts = useMemo(() => {
    const list = initialProducts.filter((p) => {
      if (!singleTier) {
        if (activeTier && normalizeText(p.category) !== normalizeText(activeTier.id)) return false;
      }
      if (selectedSubcategory && normalizeText(p.subcategory) !== normalizeText(selectedSubcategory)) return false;
      if (!flexibleProductMatch(p, searchQuery)) return false;
      return true;
    });
    return [...list].sort((a, b) => Number(!!b.is_new) - Number(!!a.is_new));
  }, [initialProducts, singleTier, activeTier, selectedSubcategory, searchQuery]);

  useEffect(() => {
    setVisibleCount(PRODUCTS_PER_PAGE);
  }, [activeTier?.id, selectedSubcategory, searchQuery]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);

  const hasFilters = Boolean(searchQuery.trim()) || Boolean(selectedSubcategory) || (!singleTier && Boolean(selectedTierId));

  const clearAll = () => {
    setSearchQuery('');
    setSelectedSubcategory(null);
    if (!singleTier) setSelectedTierId(null);
  };

  return (
    <div className="gc-wrap">
      <div className="gc-search">
        <Search size={18} className="gc-search-icon" />
        <input
          type="text"
          className="gc-search-input"
          placeholder="Buscar dentro de esta categoría…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Buscar en esta categoría"
        />
        {searchQuery && (
          <button type="button" className="gc-search-clear" onClick={() => setSearchQuery('')} aria-label="Limpiar búsqueda">
            <X size={15} />
          </button>
        )}
      </div>

      {!singleTier && (
        <div className="gc-tier-row">
          <button
            type="button"
            className={`gc-tier-chip ${!selectedTierId ? 'active' : ''}`}
            onClick={() => handleSelectTier(null)}
          >
            Todas
          </button>
          {tiers.map((tier) => (
            <button
              key={tier.id}
              type="button"
              className={`gc-tier-chip ${normalizeText(selectedTierId) === normalizeText(tier.id) ? 'active' : ''}`}
              onClick={() => handleSelectTier(tier.id)}
            >
              {tier.name}
            </button>
          ))}
        </div>
      )}

      {activeTier && subcategoryOptions.length > 0 && (
        <div className="subcategory-bar">
          <button
            type="button"
            className={`subcat-chip ${!selectedSubcategory ? 'active' : ''}`}
            onClick={() => setSelectedSubcategory(null)}
          >
            Todas
          </button>
          {subcategoryOptions.map((sub) => (
            <button
              key={sub}
              type="button"
              className={`subcat-chip ${normalizeText(selectedSubcategory) === normalizeText(sub) ? 'active' : ''}`}
              onClick={() => setSelectedSubcategory(normalizeText(selectedSubcategory) === normalizeText(sub) ? null : sub)}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      <div className="gc-results-row">
        <span className="catalog-count-label">
          {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}
        </span>
        {hasFilters && (
          <button type="button" className="gc-clear-all" onClick={clearAll}>
            Mostrar todo
          </button>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            No encontramos productos con ese filtro.
          </p>
        </div>
      ) : (
        <div className="products-grid">
          {visibleProducts.map((product, idx) => (
            <Link
              key={product.id}
              href={`/producto/${buildProductSlug(product)}`}
              className={`product-card product-card-blob-${(idx % 6) + 1}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="product-img-wrapper" style={{ position: 'relative' }}>
                {product.is_new && (
                  <div className="card-badges-topleft">
                    <span className="card-badge-new">🆕 Nuevo</span>
                  </div>
                )}
                {product.image_url && (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    unoptimized
                    sizes="(max-width: 1024px) 45vw, 280px"
                    className="product-img"
                  />
                )}
              </div>
              <div className="product-card-footer" style={{ padding: 0 }}>
                <h3 className="product-title-compact" style={{ minHeight: 0, flex: 1 }}>{product.name}</h3>
                <span className="price-compact">
                  {(() => {
                    const { min, hasRange } = getProductPriceRange(product);
                    return hasRange ? `Desde $${min.toLocaleString('es-AR')}` : `$${min.toLocaleString('es-AR')}`;
                  })()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {filteredProducts.length > 0 && (
        <div className="catalog-footer-controls">
          <span className="catalog-count-label">
            Mostrando {Math.min(visibleCount, filteredProducts.length)} de {filteredProducts.length} productos
          </span>
          {visibleCount < filteredProducts.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + PRODUCTS_PER_PAGE)}
              className="btn-load-more"
            >
              Ver más productos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
