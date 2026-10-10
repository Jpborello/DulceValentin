'use client';

import { useState } from 'react';
import { X, Loader2, FolderInput } from 'lucide-react';
import { dataStore } from '@/lib/dataStore';

// Cambiar categoria/subcategoria de UN producto desde la fila del Control de
// Stock (tocando la etiqueta de la categoria). Para mover varios a la vez
// esta "Mover productos de categoría" en la pestaña Categorías.
export default function CategoryEditModal({ product, categories = [], onClose }) {
  const options = categories.filter((c) => c.id !== 'all');
  const initialCat = options.find((c) => (c.name || c.id) === product.category);
  const [category, setCategory] = useState(initialCat ? (initialCat.name || initialCat.id) : '');
  const [subcategory, setSubcategory] = useState(product.subcategory || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const subOptions = options.find((c) => (c.name || c.id) === category)?.subcategories || [];

  const handleSave = async () => {
    if (!category || isSaving) return;
    setIsSaving(true);
    setError('');
    const res = await dataStore.updateProduct(product.id, { category, subcategory: subcategory || null });
    setIsSaving(false);
    if (res?.ok === false) {
      setError('No se pudo guardar. Revisá la conexión o volvé a iniciar sesión.');
      return;
    }
    onClose();
  };

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="qty-btn" style={{ position: 'absolute', top: '14px', right: '14px' }}>
          <X size={18} />
        </button>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <FolderInput size={20} style={{ color: '#7C3AED' }} /> Cambiar categoría
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          {product.name}{product.code ? ` (Cód: ${product.code})` : ''} — hoy en <strong>{product.category || 'sin categoría'}{product.subcategory ? ` › ${product.subcategory}` : ''}</strong>
        </p>

        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>Categoría *</label>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}
          className="form-input"
          style={{ width: '100%', marginBottom: '12px' }}
        >
          <option value="">Elegí una categoría</option>
          {options.map((c) => (
            <option key={c.id} value={c.name || c.id}>{c.name || c.id}</option>
          ))}
        </select>

        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>Subcategoría</label>
        <select
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
          className="form-input"
          style={{ width: '100%', marginBottom: '16px' }}
          disabled={!category || subOptions.length === 0}
        >
          <option value="">{subOptions.length === 0 ? 'Sin subcategorías' : 'Sin subcategoría'}</option>
          {subOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {error && (
          <div role="alert" style={{ fontSize: '0.82rem', color: '#B91C1C', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '8px 14px' }}>Cancelar</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!category || isSaving}
            className="btn-primary"
            style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#7C3AED', borderColor: '#7C3AED', opacity: !category || isSaving ? 0.6 : 1 }}
          >
            {isSaving && <Loader2 size={15} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
