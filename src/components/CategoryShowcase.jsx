'use client';

import Link from 'next/link';
import { Footprints, Shirt, Heart, Baby, ArrowRight } from 'lucide-react';
import {
  HOME_CATEGORY_GROUPS,
  SECONDARY_CATEGORY_IDS
} from '@/lib/catalogData';

const GROUP_ICONS = {
  calzado: Footprints,
  indumentaria: Shirt,
  lenceria: Heart,
  bebes: Baby
};

const normStr = (str) =>
  (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Las 4 categorias principales del home, en cards cuadradas. Cada una es un
 * link directo a su propia pagina (/categoria/<id>: calzado, indumentaria,
 * lenceria, bebes) que ya muestra todos sus productos apenas entra el
 * visitante, con buscador y filtro por subcategoria adentro — ver
 * `CategoryGroupCatalog`. La home ya no despliega el catalogo abajo al
 * tocarlas.
 *
 * Las categorias secundarias (Blanquería, Perfumería, Complementos, y
 * cualquier categoria nueva que el admin cargue sin asignarla a una card)
 * siguen filtrando el catalogo de la propia home, sin navegar a otra pagina.
 */
export default function CategoryShowcase({
  categories = [],
  products = [],
  selectedCategory,
  onSelect
}) {
  const findCategory = (idOrName) =>
    categories.find(
      (c) => normStr(c.id) === normStr(idOrName) || normStr(c.name) === normStr(idOrName)
    );

  const matchesItem = (product, item) => {
    if (normStr(product.category) !== normStr(item.category)) return false;
    if (!item.subcategory) return true;
    return normStr(product.subcategory) === normStr(item.subcategory);
  };

  const countForGroup = (group) =>
    products.filter(
      (p) => p.is_active !== false && group.items.some((item) => matchesItem(p, item))
    ).length;

  const handlePickSecondary = (category) => {
    const cat = findCategory(category);
    onSelect(cat ? cat.id : category, null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById('catalogo');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

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
      <div className="cat-showcase-header">
        <div>
          <h2 id="cat-showcase-title" className="cat-showcase-title">
            Categorías
          </h2>
          <p className="cat-showcase-subtitle">
            Elegí una categoría para explorar todas las prendas disponibles
          </p>
        </div>
      </div>

      <div className="cat-showcase-grid">
        {HOME_CATEGORY_GROUPS.map((group) => {
          const Icon = GROUP_ICONS[group.id] || Shirt;
          const count = countForGroup(group);

          return (
            <Link key={group.id} href={`/categoria/${group.id}`} className="cat-card">
              {group.image && (
                <div className="cat-card-bg-wrap">
                  <img
                    src={group.image}
                    alt={group.name}
                    className="cat-card-bg-img"
                    loading="lazy"
                  />
                  <div className="cat-card-scrim" />
                </div>
              )}

              <div className="cat-card-top">
                <span className="cat-card-icon">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                {count > 0 && (
                  <span className="cat-card-badge">
                    {count} {count === 1 ? 'prenda' : 'prendas'}
                  </span>
                )}
              </div>

              <div className="cat-card-body">
                <span className="cat-card-name">{group.name}</span>
                <span className="cat-card-tagline">{group.tagline}</span>
              </div>

              <div className="cat-card-foot">
                <span className="cat-card-action">
                  Ver productos
                </span>
                <ArrowRight size={16} className="cat-card-chevron" />
              </div>
            </Link>
          );
        })}
      </div>

      {secondaryCategories.length > 0 && (
        <div className="cat-secondary">
          <span className="cat-secondary-label">También:</span>
          {secondaryCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handlePickSecondary(cat.id)}
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
