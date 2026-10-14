'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HOME_CATEGORY_GROUPS } from '@/lib/catalogData';

const normStr = (str) =>
  (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Categorías principales del home en cards cuadradas. Cada una es un
 * link directo a su propia página (/categoria/<id>: calzado, indumentaria,
 * lencería, bebés, blanquería).
 */
export default function CategoryShowcase({
  products = [],
  categoryImages = {}
}) {
  const matchesItem = (product, item) => {
    if (normStr(product.category) !== normStr(item.category)) return false;
    if (!item.subcategory) return true;
    return normStr(product.subcategory) === normStr(item.subcategory);
  };

  const countForGroup = (group) =>
    products.filter(
      (p) => p.is_active !== false && group.items.some((item) => matchesItem(p, item))
    ).length;

  return (
    <section id="categorias" className="cat-showcase" aria-labelledby="cat-showcase-title">
      <div className="cat-showcase-header">
        <div>
          <h2 id="cat-showcase-title" className="cat-showcase-title">
            Categorías por mayor
          </h2>
          <p className="cat-showcase-subtitle">
            Elegí un rubro para ver todos los productos disponibles
          </p>
        </div>
      </div>

      <div className="dvc-grid">
        {HOME_CATEGORY_GROUPS.map((group) => {
          const count = countForGroup(group);
          const catImg = categoryImages[group.id] || group.image;

          return (
            <Link key={group.id} href={`/categoria/${group.id}`} className="dvc-card">
              <div className="dvc-media">
                {catImg && (
                  <img
                    src={catImg}
                    alt={`${group.name} por mayor`}
                    className="dvc-img"
                    loading="lazy"
                  />
                )}
                {count > 0 && (
                  <span className="dvc-count">
                    {count} {count === 1 ? 'producto' : 'productos'}
                  </span>
                )}
              </div>
              <div className="dvc-body">
                <h3 className="dvc-name">{group.name}</h3>
                <p className="dvc-tagline">{group.tagline}</p>
                <span className="dvc-action">
                  Ver productos <ArrowRight size={15} aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
