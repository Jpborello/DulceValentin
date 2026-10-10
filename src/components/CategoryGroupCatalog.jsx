'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { buildProductSlug } from '@/lib/productSlug';
import { getProductPriceRange } from '@/lib/productPricing';
import { getSearchScores, normalizeText } from '@/lib/searchUtils';
import { getThumbUrl } from '@/lib/dataStore';

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

  // Que subcategorias tienen productos de verdad, por categoria. Sirve para no
  // ofrecer chips vacios: por ejemplo, cuando la ropa interior infantil se
  // mudo a Lenceria, el tier "Infantil" de Indumentaria quedo sin productos y
  // mostrarlo solo llevaba a un listado en blanco.
  const subsByCategory = useMemo(() => {
    const map = new Map();
    initialProducts.forEach((p) => {
      const cat = normalizeText(p.category);
      if (!map.has(cat)) map.set(cat, new Set());
      map.get(cat).add(normalizeText(p.subcategory));
    });
    return map;
  }, [initialProducts]);

  const visibleTiers = singleTier ? tiers : tiers.filter((t) => subsByCategory.has(normalizeText(t.id)));

  const subcategoryOptions = (activeTier?.subcategories || []).filter((sub) => {
    const key = normalizeText(sub);
    if (key === normalizeText(selectedSubcategory)) return true;
    if (singleTier) {
      for (const subs of subsByCategory.values()) if (subs.has(key)) return true;
      return false;
    }
    return Boolean(subsByCategory.get(normalizeText(activeTier.id))?.has(key));
  });

  const handleSelectTier = (tierId) => {
    setSelectedTierId(tierId);
    setSelectedSubcategory(null);
  };

  const searchScores = useMemo(() => getSearchScores(initialProducts, searchQuery), [initialProducts, searchQuery]);

  const filteredProducts = useMemo(() => {
    const list = initialProducts.filter((p) => {
      if (!singleTier) {
        if (activeTier && normalizeText(p.category) !== normalizeText(activeTier.id)) return false;
      }
      if (selectedSubcategory && normalizeText(p.subcategory) !== normalizeText(selectedSubcategory)) return false;
      if (searchScores && !searchScores.has(p.id)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (searchScores) {
        const diff = (searchScores.get(b.id) || 0) - (searchScores.get(a.id) || 0);
        if (diff !== 0) return diff;
      }
      return Number(!!b.is_new) - Number(!!a.is_new);
    });
  }, [initialProducts, singleTier, activeTier, selectedSubcategory, searchScores]);

  // --- Recordar filtros y posicion al volver de un producto ---------------
  // El cliente entra a un producto y aprieta "atras": antes volvia a la
  // categoria sin filtros y arriba de todo, y tenia que buscar de nuevo.
  // Ahora se guarda (por pestaña) que tier/subcategoria/busqueda tenia,
  // cuantos productos estaba viendo y hasta donde habia bajado.
  const storageKeyRef = useRef(null);
  const lastFilterSigRef = useRef(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const key = `dv-cat-state:${window.location.pathname}`;
    storageKeyRef.current = key;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(key) || 'null');
      if (saved) {
        // Firma de los filtros restaurados: asi el efecto de abajo no
        // vuelve a la primera tanda de productos por esta restauracion.
        const tierId = singleTier
          ? (tiers[0]?.id ?? null)
          : (tiers.find((t) => normalizeText(t.id) === normalizeText(saved.tier))?.id ?? null);
        const sub = initialSubcategory || saved.sub || null;
        lastFilterSigRef.current = `${tierId}|${sub}|${typeof saved.q === 'string' ? saved.q : ''}`;
        if (!singleTier && saved.tier !== undefined) setSelectedTierId(saved.tier);
        if (saved.sub !== undefined && !initialSubcategory) setSelectedSubcategory(saved.sub);
        if (typeof saved.q === 'string') setSearchQuery(saved.q);
        if (saved.visible > PRODUCTS_PER_PAGE) setVisibleCount(saved.visible);
        if (saved.scrollY > 0) {
          requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved.scrollY)));
        }
      }
    } catch {}
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sig = `${activeTier?.id ?? null}|${selectedSubcategory || null}|${searchQuery}`;
    if (lastFilterSigRef.current === null) {
      lastFilterSigRef.current = sig;
      return;
    }
    if (sig === lastFilterSigRef.current) return;
    lastFilterSigRef.current = sig;
    setVisibleCount(PRODUCTS_PER_PAGE);
  }, [activeTier?.id, selectedSubcategory, searchQuery]);

  const saveState = (scrollY) => {
    if (!storageKeyRef.current) return;
    try {
      window.sessionStorage.setItem(storageKeyRef.current, JSON.stringify({
        tier: selectedTierId,
        sub: selectedSubcategory,
        q: searchQuery,
        visible: visibleCount,
        scrollY: scrollY ?? 0
      }));
    } catch {}
  };

  useEffect(() => {
    if (restored) saveState(window.scrollY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, selectedTierId, selectedSubcategory, searchQuery, visibleCount]);

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
          {visibleTiers.map((tier) => (
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
              onClick={() => saveState(window.scrollY)}
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
                    src={getThumbUrl(product.image_url)}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
                    className="product-img"
                  />
                )}
              </div>
              <div className="product-card-footer" style={{ padding: 0, flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '4px' }}>
                  {product.code && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-gold, #D97706)', letterSpacing: '0.02em' }}>
                      ART. #{product.code}
                    </span>
                  )}
                  <span className="price-compact" style={{ marginLeft: 'auto' }}>
                    {(() => {
                      const { min, hasRange } = getProductPriceRange(product);
                      return hasRange ? `Desde $${min.toLocaleString('es-AR')}` : `$${min.toLocaleString('es-AR')}`;
                    })()}
                  </span>
                </div>
                <h3 className="product-title-compact" style={{ minHeight: 0, width: '100%', marginTop: '2px' }}>{product.name}</h3>
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
