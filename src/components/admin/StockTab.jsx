'use client';

import { useState } from 'react';
import { Save, Layers, Settings2, X, Plus, ZoomIn } from 'lucide-react';
import { getProductColors } from '@/lib/catalogData';
import { getProductImages, getThumbUrl } from '@/lib/dataStore';
import ImageLightbox from '@/components/admin/ImageLightbox';
import SafeImg from '@/components/admin/SafeImg';

export default function StockTab({ products, searchFilter, setSearchFilter, onUpdateStock, onUpdateSizesColors, onToggleActive }) {
  // Local state for stock per size per product
  const [sizeStockState, setSizeStockState] = useState({});
  const [managingProduct, setManagingProduct] = useState(null);
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'critical', 'out_of_stock'
  // Producto cuya foto se esta viendo ampliada (la miniatura de la tabla es
  // chica y en una notebook no se distingue el articulo).
  const [zoomProduct, setZoomProduct] = useState(null);

  const criticalCount = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  const outOfStockCount = products.filter(p => p.stock <= 0).length;

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

  const displayedProducts = products.filter(p => {
    if (stockFilter === 'critical') return p.stock > 0 && p.stock <= 5;
    if (stockFilter === 'out_of_stock') return p.stock <= 0;
    return true;
  });

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

      {/* Alerta de Stock Crítico / Agotado */}
      {(criticalCount > 0 || outOfStockCount > 0) && (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ fontSize: '0.88rem', color: '#92400E', fontWeight: 700 }}>
            ⚠️ <strong>Atención:</strong> Tenés{' '}
            {criticalCount > 0 && <span><strong>{criticalCount}</strong> prendas con stock crítico (≤ 5 un.)</span>}
            {criticalCount > 0 && outOfStockCount > 0 && ' y '}
            {outOfStockCount > 0 && <span><strong>{outOfStockCount}</strong> prendas agotadas</span>}.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setStockFilter('all')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: '1px solid #D97706',
                backgroundColor: stockFilter === 'all' ? '#D97706' : '#FFFFFF',
                color: stockFilter === 'all' ? '#FFFFFF' : '#92400E',
                cursor: 'pointer'
              }}
            >
              Ver Todos ({products.length})
            </button>
            {criticalCount > 0 && (
              <button
                type="button"
                onClick={() => setStockFilter('critical')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: '1px solid #D97706',
                  backgroundColor: stockFilter === 'critical' ? '#D97706' : '#FFFFFF',
                  color: stockFilter === 'critical' ? '#FFFFFF' : '#92400E',
                  cursor: 'pointer'
                }}
              >
                ⚠️ Solo Críticos ({criticalCount})
              </button>
            )}
            {outOfStockCount > 0 && (
              <button
                type="button"
                onClick={() => setStockFilter('out_of_stock')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: '1px solid #DC2626',
                  backgroundColor: stockFilter === 'out_of_stock' ? '#DC2626' : '#FFFFFF',
                  color: stockFilter === 'out_of_stock' ? '#FFFFFF' : '#DC2626',
                  cursor: 'pointer'
                }}
              >
                🚫 Solo Agotados ({outOfStockCount})
              </button>
            )}
          </div>
        </div>
      )}

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
          {displayedProducts.map((p) => {
            const hasSizes = Array.isArray(p.sizes) && p.sizes.length > 0;
            const currentSizeMap = sizeStockState[p.id] || p.stock_per_size || {};
            const isActive = p.is_active !== false;

            return (
              <tr key={p.id} style={{ opacity: isActive ? 1 : 0.55 }}>
                <td>
                  {(() => {
                    const photos = getProductImages(p).filter((u) => u && u !== '/logo.png');
                    return (
                      <button
                        type="button"
                        className="stock-thumb"
                        onClick={() => photos.length > 0 && setZoomProduct(p)}
                        disabled={photos.length === 0}
                        aria-label={photos.length > 0 ? `Ampliar foto de ${p.name}` : `${p.name} no tiene foto`}
                        title={photos.length > 0 ? 'Ver foto grande' : 'Sin foto'}
                      >
                        <SafeImg
                          src={photos[0] ? (getThumbUrl(photos[0]) || photos[0]) : '/logo.png'}
                          fallbacks={[photos[0], '/logo.png']}
                          alt=""
                          loading="lazy"
                        />
                        {photos.length > 0 && <span className="stock-thumb-zoom" aria-hidden="true"><ZoomIn size={20} /></span>}
                        {photos.length > 1 && <span className="stock-thumb-count" aria-hidden="true">{photos.length}</span>}
                      </button>
                    );
                  })()}
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
                <td>
                  {p.stock <= 0 ? (
                    <span style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '4px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 800 }}>
                      🚫 Agotado
                    </span>
                  ) : p.stock <= 5 ? (
                    <span style={{ backgroundColor: '#FEF3C7', color: '#D97706', padding: '4px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 800 }}>
                      ⚠️ Crítico ({p.stock} un.)
                    </span>
                  ) : (
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#059669' }}>
                      {p.stock} un.
                    </span>
                  )}
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

      {zoomProduct && (
        <ImageLightbox
          images={getProductImages(zoomProduct).filter((u) => u && u !== '/logo.png')}
          title={`${zoomProduct.name}${zoomProduct.code ? ` · Cód. ${zoomProduct.code}` : ''}`}
          onClose={() => setZoomProduct(null)}
        />
      )}

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
