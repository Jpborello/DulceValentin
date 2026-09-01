'use client';

import { useState } from 'react';
import { Save, Layers, Settings2, X, Plus } from 'lucide-react';
import { getProductColors } from '@/lib/catalogData';

export default function StockTab({ products, searchFilter, setSearchFilter, onUpdateStock, onUpdateSizesColors, onToggleActive }) {
  // Local state for stock per size per product
  const [sizeStockState, setSizeStockState] = useState({});
  const [managingProduct, setManagingProduct] = useState(null);

  const handleSizeStockChange = (productId, size, val) => {
    const num = parseInt(val, 10) || 0;
    setSizeStockState(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [size]: num
      }
    }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>Control e Inventario de Stock por Talle</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Gestiona las existencias totales y la distribución del stock por talle para indumentaria.
          </p>
        </div>
        <input 
          type="text" 
          placeholder="Buscar producto o categoría..." 
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="form-input"
          style={{ maxWidth: '300px' }}
        />
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Prenda / Código</th>
            <th>Categoría</th>
            <th>Estado</th>
            <th>Talles Disponibles</th>
            <th>Stock Total</th>
            <th>Modificar Stock</th>
            <th>Talles y Colores</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const hasSizes = Array.isArray(p.sizes) && p.sizes.length > 0;
            const currentSizeMap = sizeStockState[p.id] || p.stock_per_size || {};
            const isActive = p.is_active !== false;

            return (
              <tr key={p.id} style={{ opacity: isActive ? 1 : 0.55 }}>
                <td>
                  <img
                    src={p.image_url}
                    alt=""
                    style={{ width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                    onError={(e) => { e.target.src = '/logo.png'; }}
                  />
                </td>
                <td style={{ fontWeight: 700 }}>
                  <div>{p.name}</div>
                  {p.code && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cód: {p.code}</span>}
                </td>
                <td>
                  <span style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                    {p.category}
                  </span>
                  {p.subcategory && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.subcategory}</div>}
                </td>

                {/* Activar / Desactivar */}
                <td>
                  <button
                    onClick={() => onToggleActive(p.id, isActive)}
                    title={isActive ? 'Ocultar este producto de la web' : 'Volver a mostrar este producto en la web'}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      borderRadius: '20px',
                      border: isActive ? '1px solid #A7F3D0' : '1px solid #FECACA',
                      backgroundColor: isActive ? '#ECFDF5' : '#FEF2F2',
                      color: isActive ? '#047857' : '#DC2626',
                      cursor: 'pointer'
                    }}
                  >
                    {isActive ? '● Activo' : '○ Desactivado'}
                  </button>
                </td>

                {/* Talles */}
                <td>
                  {hasSizes ? (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '240px' }}>
                      {p.sizes.map(size => (
                        <div key={size} style={{
                          backgroundColor: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '0.72rem',
                          textAlign: 'center'
                        }}>
                          <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{size}:</span>{' '}
                          <span style={{ color: '#059669', fontWeight: 700 }}>{currentSizeMap[size] ?? 20} un.</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Sin talles (Blanquería)
                    </span>
                  )}
                </td>

                {/* Stock Total */}
                <td style={{ fontWeight: 800, fontSize: '0.95rem', color: p.stock > 10 ? '#059669' : '#DC2626' }}>
                  {p.stock} un.
                </td>

                {/* Acción Modificar */}
                <td>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="number" 
                      defaultValue={p.stock} 
                      id={`stock-${p.id}`}
                      className="form-input" 
                      style={{ width: '90px', padding: '6px 10px', fontWeight: 700 }} 
                    />
                    <button
                      onClick={() => {
                        const val = document.getElementById(`stock-${p.id}`).value;
                        onUpdateStock(p.id, val);
                      }}
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Save size={14} /> Guardar
                    </button>
                  </div>
                </td>

                {/* Gestionar talles y colores */}
                <td>
                  <button
                    onClick={() => setManagingProduct(p)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Settings2 size={14} /> Gestionar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {managingProduct && (
        <SizeColorManagerModal
          product={managingProduct}
          onClose={() => setManagingProduct(null)}
          onSave={onUpdateSizesColors}
        />
      )}
    </div>
  );
}

function SizeColorManagerModal({ product, onClose, onSave }) {
  const [sizes, setSizes] = useState(Array.isArray(product.sizes) ? [...product.sizes] : []);
  const [stockPerSize, setStockPerSize] = useState({ ...(product.stock_per_size || {}) });
  const [colors, setColors] = useState(getProductColors(product));
  const [newSize, setNewSize] = useState('');
  const [newSizeStock, setNewSizeStock] = useState('20');
  const [newColor, setNewColor] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleRemoveSize = (size) => {
    setSizes((prev) => prev.filter((s) => s !== size));
  };

  const handleAddSize = () => {
    const trimmed = newSize.trim();
    if (!trimmed || sizes.includes(trimmed)) return;
    setSizes((prev) => [...prev, trimmed]);
    setStockPerSize((prev) => ({ ...prev, [trimmed]: parseInt(newSizeStock, 10) || 0 }));
    setNewSize('');
    setNewSizeStock('20');
  };

  const handleRemoveColor = (color) => {
    setColors((prev) => prev.filter((c) => c !== color));
  };

  const handleAddColor = () => {
    const trimmed = newColor.trim();
    if (!trimmed || colors.includes(trimmed)) return;
    setColors((prev) => [...prev, trimmed]);
    setNewColor('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Solo dejamos en stock_per_size los talles que siguen habilitados,
    // para no arrastrar numeros viejos de talles ya sacados.
    const cleanStockPerSize = {};
    sizes.forEach((s) => {
      cleanStockPerSize[s] = stockPerSize[s] ?? 0;
    });
    await onSave(product.id, { sizes, stock_per_size: cleanStockPerSize, colors });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="qty-btn" style={{ position: 'absolute', top: '14px', right: '14px' }}>
          <X size={18} />
        </button>

        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px' }}>
          <Layers size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-3px' }} />
          Talles y Colores
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>{product.name}</p>

        {/* SIZES */}
        <div style={{ marginBottom: '20px' }}>
          <label className="form-label">Talles habilitados en la web</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {sizes.length === 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Sin talles (se vende como talle único)
              </span>
            )}
            {sizes.map((s) => (
              <span
                key={s}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 10px', borderRadius: '20px',
                  backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)',
                  fontSize: '0.82rem', fontWeight: 700
                }}
              >
                {s}
                <button
                  type="button"
                  onClick={() => handleRemoveSize(s)}
                  title="Sacar este talle"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'flex', padding: 0 }}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="Nuevo talle (ej: XXXL)"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              className="form-input"
              style={{ flex: 1, padding: '7px 10px', fontSize: '0.85rem' }}
            />
            <input
              type="number"
              placeholder="Stock"
              value={newSizeStock}
              onChange={(e) => setNewSizeStock(e.target.value)}
              className="form-input"
              style={{ width: '80px', padding: '7px 10px', fontSize: '0.85rem' }}
            />
            <button type="button" onClick={handleAddSize} className="btn-secondary" style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={14} /> Agregar
            </button>
          </div>
        </div>

        {/* COLORS */}
        <div style={{ marginBottom: '22px' }}>
          <label className="form-label">Colores habilitados en la web</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {colors.map((c) => (
              <span
                key={c}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 10px', borderRadius: '20px',
                  backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)',
                  fontSize: '0.82rem', fontWeight: 700
                }}
              >
                {c}
                <button
                  type="button"
                  onClick={() => handleRemoveColor(c)}
                  title="Sacar este color"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'flex', padding: 0 }}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="Nuevo color (ej: Turquesa)"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="form-input"
              style={{ flex: 1, padding: '7px 10px', fontSize: '0.85rem' }}
            />
            <button type="button" onClick={handleAddColor} className="btn-secondary" style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={14} /> Agregar
            </button>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary"
          style={{ width: '100%', padding: '11px', justifyContent: 'center', opacity: isSaving ? 0.7 : 1 }}
        >
          <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar Talles y Colores'}
        </button>
      </div>
    </div>
  );
}
