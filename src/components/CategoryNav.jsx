'use client';

import { Search, X, Sparkles, Footprints, Shirt, Heart, Baby } from 'lucide-react';
import ShareCategoryButton from './ShareCategoryButton';

const NAV_GROUPS = [
  { id: 'all', name: 'Todos', icon: Sparkles },
  { id: 'Calzado', name: 'Calzado', icon: Footprints },
  { id: 'Indumentaria', name: 'Indumentaria', icon: Shirt },
  { id: 'Lencería', name: 'Lencería', icon: Heart },
  { id: 'Bebés', name: 'Bebés', icon: Baby },
  { id: 'Blanquería', name: 'Blanquería' },
  { id: 'Perfumería', name: 'Perfumería' },
  { id: 'Complementos', name: 'Complementos' }
];

const GROUP_SUBCATEGORIES = {
  'Calzado': ['Hombre', 'Mujer', 'Infantil'],
  'Indumentaria': ['Hombre', 'Mujer', 'Infantil', 'Remeras', 'Camperas', 'Buzos', 'Pantalones', 'Shorts', 'Chombas'],
  'Hombres': ['Remeras', 'Chombas', 'Shorts', 'Pantalones', 'Camperas', 'Buzos', 'Camisas', 'Conjuntos', 'Ropa Interior'],
  'Mujeres': ['Remeras', 'Camperas', 'Buzos', 'Abrigos', 'Pantalones', 'Calzas', 'Medias'],
  'Infantil': ['Indumentaria Infantil'],
  'Lencería': ['Conjuntos', 'Corpiños', 'Bombachas', 'Bodies', 'Camisones y Batas', 'Portaligas', 'Ropa Íntima'],
  'Bebés': ['Ajuar y Sets', 'Bodys', 'Enteritos', 'Ranitas y Pantalones', 'Accesorios', 'Blanquería y Cuidado', 'Bolsos Maternales'],
  'Blanquería': ['Sabanas'],
  'Perfumería': ['Perfumes y Cremas'],
  'Complementos': ['Mochilas', 'Carteras', 'Bolsos', 'Billeteras', 'Gorras', 'Otros accesorios']
};

const normStr = (str) =>
  (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function CategoryNav({
  categories = [],
  selectedCategory = 'all',
  onSelectCategory,
  selectedSubcategory = null,
  onSelectSubcategory,
  searchQuery = '',
  setSearchQuery,
  hasSearch = false,
  totalCount = null
}) {
  const isFiltered = Boolean(selectedCategory) && selectedCategory !== 'all';

  // Buscar objeto de categoría o grupo
  const activeCategoryObj = categories.find((c) => normStr(c.id) === normStr(selectedCategory) || normStr(c.name) === normStr(selectedCategory));
  const activeName = activeCategoryObj?.name || selectedCategory;

  const heading = isFiltered
    ? activeName
    : hasSearch
      ? 'Resultados de búsqueda'
      : 'Catálogo de Productos';

  // Obtener subcategorías correspondientes a la categoría seleccionada
  const activeSubcategories =
    GROUP_SUBCATEGORIES[selectedCategory] ||
    GROUP_SUBCATEGORIES[activeCategoryObj?.name] ||
    activeCategoryObj?.subcategories ||
    [];

  const clearCategory = () => {
    onSelectCategory('all');
    if (onSelectSubcategory) onSelectSubcategory(null);
  };

  const clearAllFilters = () => {
    onSelectCategory('all');
    if (onSelectSubcategory) onSelectSubcategory(null);
    if (setSearchQuery) setSearchQuery('');
  };

  return (
    <div id="catalogo" className="catalog-nav-header">
      {/* Barra superior: Título del catálogo + Buscador con Lupa integrado */}
      <div className="catalog-nav-top">
        <div className="catalog-nav-title-wrap">
          <h2 className="catalog-nav-title">{heading}</h2>
          {totalCount !== null && (
            <span className="catalog-nav-count-badge">
              {totalCount} {totalCount === 1 ? 'producto' : 'productos'}
            </span>
          )}
          {isFiltered && (
            <ShareCategoryButton
              label={selectedSubcategory ? `${selectedSubcategory} de ${activeName}` : activeName}
            />
          )}
        </div>

        {/* Buscador con lupa arriba del catálogo */}
        {setSearchQuery && (
          <div className="catalog-search-inline">
            <Search size={18} className="catalog-search-icon" />
            <input
              type="text"
              className="catalog-search-input"
              placeholder="¿Qué estás buscando en el catálogo?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar en el catálogo"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="catalog-search-clear"
                title="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fila de Categorías Principales */}
      <div className="catalog-categories-bar">
        <div className="catalog-categories-scroll">
          {NAV_GROUPS.map((group) => {
            const Icon = group.icon;
            const isActive =
              group.id === 'all'
                ? selectedCategory === 'all'
                : normStr(selectedCategory) === normStr(group.id) ||
                  normStr(selectedCategory) === normStr(group.name);

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  onSelectCategory(group.id);
                  if (onSelectSubcategory) onSelectSubcategory(null);
                }}
                className={`cat-nav-pill ${isActive ? 'active' : ''}`}
              >
                {Icon && <Icon size={16} className="cat-nav-pill-icon" />}
                <span>{group.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fila de Subcategorías (si hay una categoría activa con subcategorías) */}
      {isFiltered && activeSubcategories.length > 0 && (
        <div className="catalog-subcategories-bar">
          <span className="catalog-subcategories-label">Filtrar por:</span>
          <div className="catalog-subcategories-scroll">
            <button
              type="button"
              onClick={() => onSelectSubcategory(null)}
              className={`subcat-chip ${selectedSubcategory === null ? 'active' : ''}`}
            >
              Todas
            </button>
            {activeSubcategories.map((sub, idx) => {
              const isSubActive = normStr(selectedSubcategory) === normStr(sub);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSubcategory(isSubActive ? null : sub)}
                  className={`subcat-chip ${isSubActive ? 'active' : ''}`}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chips de filtro activo y botón para restablecer */}
      {(isFiltered || hasSearch) && (
        <div className="catalog-active-filters-row">
          <span className="catalog-active-label">Filtros activos:</span>
          {isFiltered && (
            <span className="catalog-active-tag">
              Categoría: <strong>{activeName}</strong>
              <button type="button" onClick={clearCategory} aria-label="Quitar categoría">
                <X size={12} />
              </button>
            </span>
          )}
          {selectedSubcategory && (
            <span className="catalog-active-tag">
              Subcategoría: <strong>{selectedSubcategory}</strong>
              <button type="button" onClick={() => onSelectSubcategory(null)} aria-label="Quitar subcategoría">
                <X size={12} />
              </button>
            </span>
          )}
          {hasSearch && (
            <span className="catalog-active-tag">
              Búsqueda: <strong>&ldquo;{searchQuery}&rdquo;</strong>
              <button type="button" onClick={() => setSearchQuery('')} aria-label="Quitar búsqueda">
                <X size={12} />
              </button>
            </span>
          )}
          <button type="button" onClick={clearAllFilters} className="catalog-clear-all-link">
            Mostrar todo el catálogo
          </button>
        </div>
      )}
    </div>
  );
}
