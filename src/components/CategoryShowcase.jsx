'use client';

import { useState } from 'react';
import { Footprints, Shirt, Heart, Baby, ChevronDown, Search } from 'lucide-react';
import {
  HOME_CATEGORY_GROUPS,
  SECONDARY_CATEGORY_IDS,
  isRetiredSubcategory
} from '@/lib/catalogData';

const GROUP_ICONS = {
  calzado: Footprints,
  indumentaria: Shirt,
  lenceria: Heart,
  bebes: Baby
};

const normStr = (str) =>
  (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Las 4 categorias principales del home, en cards cuadradas. Al tocar una se
 * abre debajo el detalle con sus categorias y subcategorias; elegir cualquiera
 * filtra la grilla de productos.
 *
 * Las subcategorias NO estan hardcodeadas aca: salen de `categories` (lo que
 * devuelve dataStore, ya mergeado con Supabase), asi lo que el admin agrega
 * aparece solo. Los grupos de HOME_CATEGORY_GROUPS solo dicen que categoria
 * cuelga de que card.
 */
export default function CategoryShowcase({
  categories = [],
  products = [],
  selectedCategory,
  selectedSubcategory,
  onSelect,
  searchQuery = '',
  setSearchQuery
}) {
  const [openGroupId, setOpenGroupId] = useState(null);

  const findCategory = (idOrName) =>
    categories.find(
      (c) => normStr(c.id) === normStr(idOrName) || normStr(c.name) === normStr(idOrName)
    );

  // Una card esta activa si el filtro actual cae dentro de alguno de sus items.
  const isGroupActive = (group) =>
    group.items.some((item) => {
      if (normStr(item.category) !== normStr(selectedCategory)) return false;
      return item.subcategory ? normStr(item.subcategory) === normStr(selectedSubcategory) : true;
    });

  const matchesItem = (product, item) => {
    if (normStr(product.category) !== normStr(item.category)) return false;
    if (!item.subcategory) return true;
    return normStr(product.subcategory) === normStr(item.subcategory);
  };

  // Se cuenta sobre los productos, no sumando el `count` de cada categoria:
  // una misma categoria puede colgar de dos cards por una subcategoria puntual
  // (Lenceria toma Mujeres > Ropa Intima) y sumar el total de Mujeres ahi
  // inflaba el numero con prendas que no son de esa card.
  const countForGroup = (group) =>
    products.filter(
      (p) => p.is_active !== false && group.items.some((item) => matchesItem(p, item))
    ).length;

  const handlePick = (category, subcategory = null) => {
    const cat = findCategory(category);
    onSelect(cat ? cat.id : category, subcategory);
    // #catalogo recien se monta cuando hay un filtro activo, asi que el scroll
    // tiene que esperar al render siguiente — en el mismo tick el nodo todavia
    // no existe y el scroll no pasaba nada.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById('catalogo');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  const openGroup = HOME_CATEGORY_GROUPS.find((g) => g.id === openGroupId) || null;

  // Red de seguridad: como el home ya no muestra la grilla completa, una
  // categoria que no cuelgue de ninguna card seria inalcanzable salvo por
  // buscador. Cualquier categoria con productos que no este cubierta por las
  // cards ni por la fila secundaria se agrega igual a esa fila — sirve para
  // las categorias que el admin crea despues desde el panel.
  const coveredKeys = new Set();
  HOME_CATEGORY_GROUPS.forEach((g) =>
    g.items.forEach((it) => coveredKeys.add(normStr(it.category)))
  );
  SECONDARY_CATEGORY_IDS.forEach((id) => coveredKeys.add(normStr(id)));

  const uncovered = categories.filter(
    (c) =>
      c.id !== 'all' &&
      !coveredKeys.has(normStr(c.id)) &&
      !coveredKeys.has(normStr(c.name)) &&
      (c.count || 0) > 0
  );

  const secondaryCategories = [
    ...SECONDARY_CATEGORY_IDS.map(findCategory).filter(Boolean),
    ...uncovered
  ].filter((cat, idx, arr) => arr.findIndex((c) => c.id === cat.id) === idx);

  return (
    <section id="categorias" className="cat-showcase" aria-labelledby="cat-showcase-title">
      {/* El buscador vive aca (y no abajo del catalogo) porque el home ya no
          muestra la grilla de entrada: es el unico acceso a la busqueda
          mientras el visitante todavia no eligio una categoria. */}
      <div className="cat-showcase-header">
        <h2 id="cat-showcase-title" className="cat-showcase-title">
          Categorías
        </h2>
        <div className="cat-showcase-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por prenda, modelo o categoría..."
            value={searchQuery}
            onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
            className="form-input"
            aria-label="Buscar productos"
          />
        </div>
      </div>

      <div className="cat-showcase-grid">
        {HOME_CATEGORY_GROUPS.map((group) => {
          const Icon = GROUP_ICONS[group.id] || Shirt;
          const isOpen = openGroupId === group.id;
          const count = countForGroup(group);

          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setOpenGroupId(isOpen ? null : group.id)}
              aria-expanded={isOpen}
              className={`cat-card ${isOpen ? 'open' : ''} ${isGroupActive(group) ? 'active' : ''}`}
            >
              <span className="cat-card-icon">
                <Icon size={26} strokeWidth={1.5} />
              </span>
              <span className="cat-card-body">
                <span className="cat-card-name">{group.name}</span>
                <span className="cat-card-tagline">{group.tagline}</span>
              </span>
              <span className="cat-card-foot">
                <span className="cat-card-count">
                  {count > 0 ? `${count} ${count === 1 ? 'producto' : 'productos'}` : 'Ver'}
                </span>
                <ChevronDown size={16} className="cat-card-chevron" />
              </span>
            </button>
          );
        })}
      </div>

      {openGroup && (
        <div className="cat-panel">
          <div className="cat-panel-cols">
            {openGroup.items.map((item, idx) => {
              const cat = findCategory(item.category);

              // Item hoja: un link directo a categoria + subcategoria.
              if (!item.expand) {
                const isActive =
                  normStr(selectedCategory) === normStr(item.category) &&
                  normStr(selectedSubcategory) === normStr(item.subcategory);
                return (
                  <div className="cat-panel-col" key={`${item.category}-${item.subcategory || idx}`}>
                    <button
                      type="button"
                      onClick={() => handlePick(item.category, item.subcategory)}
                      className={`cat-panel-head ${isActive ? 'active' : ''}`}
                    >
                      {item.label}
                    </button>
                  </div>
                );
              }

              // Item columna: la categoria como titulo y sus subcategorias vivas.
              const subs = (cat?.subcategories || []).filter(
                (sub) => !isRetiredSubcategory(cat?.name || item.category, sub)
              );

              return (
                <div className="cat-panel-col" key={`${item.category}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => handlePick(item.category, null)}
                    className={`cat-panel-head ${
                      normStr(selectedCategory) === normStr(item.category) && !selectedSubcategory
                        ? 'active'
                        : ''
                    }`}
                  >
                    {item.label}
                  </button>

                  {subs.length > 0 ? (
                    <ul className="cat-panel-list">
                      {subs.map((sub) => (
                        <li key={sub}>
                          <button
                            type="button"
                            onClick={() => handlePick(item.category, sub)}
                            className={`cat-panel-link ${
                              normStr(selectedSubcategory) === normStr(sub) &&
                              normStr(selectedCategory) === normStr(item.category)
                                ? 'active'
                                : ''
                            }`}
                          >
                            {sub}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="cat-panel-empty">Sin subcategorías cargadas todavía.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {secondaryCategories.length > 0 && (
        <div className="cat-secondary">
          <span className="cat-secondary-label">También:</span>
          {secondaryCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handlePick(cat.id, null)}
              className={`cat-secondary-chip ${
                normStr(selectedCategory) === normStr(cat.id) ? 'active' : ''
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
