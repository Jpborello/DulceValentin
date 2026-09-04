'use client';

import { X } from 'lucide-react';
import ShareCategoryButton from './ShareCategoryButton';

/**
 * Barra del catalogo: titulo, buscador y el filtro activo.
 *
 * La eleccion de categoria vive ahora en <CategoryShowcase /> (las 4 cards
 * del home), asi que aca ya no va la fila de chips con TODAS las categorias
 * — quedaba duplicada y era justo lo que recargaba visualmente la pagina.
 * Se conserva la barra de subcategorias, que es la navegacion fina una vez
 * que el visitante ya eligio una categoria.
 */
export default function CategoryNav({
  categories,
  selectedCategory,
  onSelectCategory,
  selectedSubcategory,
  onSelectSubcategory,
  hasSearch = false
}) {
  const activeCategoryObj = categories.find((c) => c.id === selectedCategory);
  const isFiltered = Boolean(selectedCategory) && selectedCategory !== 'all';
  const activeName = activeCategoryObj?.name || selectedCategory;

  const heading = isFiltered
    ? activeName
    : hasSearch
      ? 'Resultados de búsqueda'
      : 'Buscá en el catálogo';

  const clearFilter = () => {
    onSelectCategory('all');
    onSelectSubcategory(null);
  };

  return (
    <div id="catalogo" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{heading}</h2>
          {isFiltered && (
            <ShareCategoryButton
              label={selectedSubcategory ? `${selectedSubcategory} de ${activeName}` : activeName}
            />
          )}
        </div>
      </div>

      {/* Filtro activo + salida rapida */}
      {isFiltered && (
        <div className="active-filter-row">
          <span className="active-filter-tag">
            {activeName}
            {selectedSubcategory ? ` · ${selectedSubcategory}` : ''}
          </span>
          <button type="button" onClick={clearFilter} className="active-filter-clear">
            <X size={14} /> Ver todas las categorías
          </button>
        </div>
      )}

      {/* Subcategorias de la categoria elegida */}
      {activeCategoryObj && activeCategoryObj.subcategories?.length > 0 && (
        <div className="subcategory-bar">
          <button
            onClick={() => onSelectSubcategory(null)}
            className={`subcat-chip ${selectedSubcategory === null ? 'active' : ''}`}
          >
            Todas
          </button>
          {activeCategoryObj.subcategories.map((sub, idx) => (
            <button
              key={idx}
              onClick={() => onSelectSubcategory(sub)}
              className={`subcat-chip ${selectedSubcategory === sub ? 'active' : ''}`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
