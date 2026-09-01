'use client';

import { Search } from 'lucide-react';
import ShareCategoryButton from './ShareCategoryButton';

export default function CategoryNav({
  categories,
  selectedCategory,
  onSelectCategory,
  selectedSubcategory,
  onSelectSubcategory,
  searchQuery,
  setSearchQuery
}) {
  const activeCategoryObj = categories.find(c => c.id === selectedCategory);
  const isFiltered = selectedCategory && selectedCategory !== 'all';

  return (
    <div id="catalogo" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Nuestras Categorías Mayoristas</h2>
          {isFiltered && (
            <ShareCategoryButton
              label={selectedSubcategory ? `${selectedSubcategory} de ${activeCategoryObj?.name || selectedCategory}` : (activeCategoryObj?.name || selectedCategory)}
            />
          )}
        </div>
        <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por prenda, modelo o categoría..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '38px', borderRadius: 'var(--radius-full)', width: '100%' }}
          />
        </div>
      </div>

      {/* Main Categories Bar */}
      <div className="category-bar-wrapper">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              onSelectCategory(cat.id);
              onSelectSubcategory(null);
            }}
            className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Subcategories Bar */}
      {activeCategoryObj && activeCategoryObj.subcategories && (
        <div className="subcategory-bar">
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '6px' }}>
            Subcategorías:
          </span>
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
