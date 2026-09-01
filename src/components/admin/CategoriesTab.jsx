'use client';

import { useState } from 'react';
import { FolderPlus, Tag, PlusCircle, Trash2, X, Layers, AlertCircle } from 'lucide-react';

export default function CategoriesTab({ 
  categories, 
  onAddCategory, 
  onAddSubcategory, 
  onDeleteCategory, 
  onDeleteSubcategory 
}) {
  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatSubcats, setNewCatSubcats] = useState('');

  // New Subcategory State
  const [selectedCatId, setSelectedCatId] = useState('');
  const [newSubcatName, setNewSubcatName] = useState('');

  // Confirmation modal/state for deleting a category
  const [deletingCatId, setDeletingCatId] = useState(null);

  const filterableCategories = categories.filter(c => c.id !== 'all');

  const handleCreateCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onAddCategory(newCatName.trim(), newCatSubcats);
    setNewCatName('');
    setNewCatSubcats('');
  };

  const handleCreateSubcategory = (e) => {
    e.preventDefault();
    const catTarget = selectedCatId || (filterableCategories[0] ? filterableCategories[0].id : '');
    if (!catTarget || !newSubcatName.trim()) return;
    onAddSubcategory(catTarget, newSubcatName.trim());
    setNewSubcatName('');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderPlus size={22} style={{ color: '#2563EB' }} /> Gestión de Categorías y Subcategorías
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Crea nuevas categorías de ropa o agrega subcategorías para organizar el catálogo de tu tienda en tiempo real.
        </p>
      </div>

      {/* Forms Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '20px', 
        marginBottom: '32px' 
      }}>
        
        {/* Form 1: Crear Categoría */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#EFF6FF', padding: '8px', borderRadius: '8px', color: '#2563EB', display: 'flex' }}>
              <FolderPlus size={18} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Crear Nueva Categoría
            </h3>
          </div>

          <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Nombre de la Categoría *
              </label>
              <input
                type="text"
                placeholder="Ej: Calzado, Bermudas, Accesorios"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="form-input"
                style={{ width: '100%', fontSize: '0.9rem' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Subcategorías Iniciales (Opcional, separadas por coma)
              </label>
              <input 
                type="text" 
                placeholder="Ej: Urbana, Deportiva, Cuero"
                value={newCatSubcats}
                onChange={(e) => setNewCatSubcats(e.target.value)}
                className="form-input"
                style={{ width: '100%', fontSize: '0.9rem' }}
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary"
              disabled={!newCatName.trim()}
              style={{
                marginTop: '4px',
                padding: '9px 16px',
                fontSize: '0.88rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                opacity: !newCatName.trim() ? 0.5 : 1
              }}
            >
              <PlusCircle size={16} /> Crear Categoría
            </button>
          </form>
        </div>

        {/* Form 2: Agregar Subcategoría */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#F0FDF4', padding: '8px', borderRadius: '8px', color: '#16A34A', display: 'flex' }}>
              <Tag size={18} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Agregar Subcategoría
            </h3>
          </div>

          <form onSubmit={handleCreateSubcategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Seleccionar Categoría Padre *
              </label>
              <select
                value={selectedCatId || (filterableCategories[0] ? filterableCategories[0].id : '')}
                onChange={(e) => setSelectedCatId(e.target.value)}
                className="form-input"
                style={{ width: '100%', fontSize: '0.9rem', fontWeight: 600 }}
              >
                {filterableCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.count} productos)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Nombre de la Subcategoría *
              </label>
              <input 
                type="text" 
                placeholder="Ej: Oversize, Canguro, Térmico"
                value={newSubcatName}
                onChange={(e) => setNewSubcatName(e.target.value)}
                className="form-input"
                style={{ width: '100%', fontSize: '0.9rem' }}
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary"
              disabled={!newSubcatName.trim() || filterableCategories.length === 0}
              style={{
                marginTop: '4px',
                padding: '9px 16px',
                fontSize: '0.88rem',
                fontWeight: 700,
                backgroundColor: '#16A34A',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                opacity: (!newSubcatName.trim() || filterableCategories.length === 0) ? 0.5 : 1
              }}
            >
              <PlusCircle size={16} /> Agregar Subcategoría
            </button>
          </form>
        </div>
      </div>

      {/* Categories List Cards */}
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} style={{ color: '#2563EB' }} /> Categorías Activas ({filterableCategories.length})
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px'
        }}>
          {filterableCategories.map(cat => (
            <div 
              key={cat.id} 
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      {cat.name}
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      ID: {cat.id}
                    </span>
                  </div>
                  <span style={{
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    {cat.count} {cat.count === 1 ? 'producto' : 'productos'}
                  </span>
                </div>

                {/* Subcategories list */}
                <div style={{ marginTop: '12px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Subcategorías ({cat.subcategories ? cat.subcategories.length : 0}):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {cat.subcategories && cat.subcategories.length > 0 ? (
                      cat.subcategories.map(sub => (
                        <span 
                          key={sub}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-color)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 600
                          }}
                        >
                          {sub}
                          <button
                            type="button"
                            title={`Eliminar subcategoría "${sub}"`}
                            onClick={() => onDeleteSubcategory(cat.id, sub)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <X size={12} style={{ color: '#EF4444' }} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', italic: 'true' }}>
                        Sin subcategorías agregadas
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Delete Category Footer Action */}
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                {deletingCatId !== cat.id ? (
                  <button
                    type="button"
                    onClick={() => setDeletingCatId(cat.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={13} style={{ color: '#EF4444' }} /> Eliminar Categoría
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626' }}>
                      ¿Eliminar?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteCategory(cat.id);
                        setDeletingCatId(null);
                      }}
                      style={{
                        backgroundColor: '#DC2626',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingCatId(null)}
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        color: 'var(--text-main)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
