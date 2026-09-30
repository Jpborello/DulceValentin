'use client';

import { useEffect, useState } from 'react';
import { Save, Layers, Settings2, X, Plus, ZoomIn, Pencil, Loader2, AlertCircle, Palette, Trash2, Check } from 'lucide-react';
import { getProductColors, getSizeDetails, getProductColorsForSize, POPULAR_COLORS } from '@/lib/catalogData';
import { getProductImages, getThumbUrl } from '@/lib/dataStore';
import ImageLightbox from '@/components/admin/ImageLightbox';
import SafeImg from '@/components/admin/SafeImg';

export default function StockTab({ products, searchFilter, setSearchFilter, onUpdateStock, onUpdateSizesColors, onToggleActive, onUpdateDetails }) {
  // Local state for stock per size per product
  const [sizeStockState, setSizeStockState] = useState({});
  const [managingProduct, setManagingProduct] = useState(null);
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'critical', 'out_of_stock'
  // Producto cuya foto se esta viendo ampliada (la miniatura de la tabla es
  // chica y en una notebook no se distingue el articulo).
  const [zoomProduct, setZoomProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);

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
                  <div className="stock-name-row">
                    <span>{p.name}</span>
                    {onUpdateDetails && (
                      <button
                        type="button"
                        className="stock-edit-btn"
                        onClick={() => setEditingProduct(p)}
                        aria-label={`Editar nombre y descripción de ${p.name}`}
                        title="Editar nombre y descripción"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
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
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', maxWidth: '280px' }}>
                      {p.sizes.map((size) => {
                        const details = getSizeDetails(p, size);
                        const colorsCount = details.colors ? details.colors.length : 0;
                        return (
                          <div
                            key={size}
                            style={{
                              backgroundColor: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ fontWeight: 800, color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                              <span>{size}</span>
                              <span style={{ color: details.totalStock > 0 ? '#059669' : '#DC2626' }}>{details.totalStock} un.</span>
                            </div>
                            {colorsCount > 0 && (
                              <div
                                style={{ fontSize: '0.67rem', color: 'var(--text-muted)', whiteSpace: 'normal', lineHeight: 1.25, marginTop: '2px' }}
                                title={details.colors.map((c) => `${c}: ${details.color_stock?.[c] ?? details.stock} un.`).join(' | ')}
                              >
                                {details.colors.map((c) => `${c}: ${details.color_stock?.[c] ?? details.stock}`).join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Sin talles (Talle único)
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

      {editingProduct && (
        <EditDetailsModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={onUpdateDetails}
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

const NAME_MAX = 120;
const DESC_MAX = 1500;

// Modal para corregir el nombre y la descripcion de un producto. El link del
// producto no se rompe al cambiar el nombre: la pagina se busca por el id
// (ver src/lib/productSlug.js).
function EditDetailsModal({ product, onClose, onSave }) {
  const [name, setName] = useState(product.name || '');
  const [description, setDescription] = useState(product.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const trimmedName = name.trim();
  const trimmedDesc = description.trim();
  const changed = trimmedName !== (product.name || '').trim() || trimmedDesc !== (product.description || '').trim();
  const canSave = trimmedName.length >= 2 && changed && !isSaving;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !isSaving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, isSaving]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    setError('');
    const result = await onSave(product.id, { name: trimmedName, description: trimmedDesc });
    setIsSaving(false);
    if (result && result.ok === false) {
      setError('No se pudo guardar. Revisá la conexión o volvé a iniciar sesión e intentá de nuevo.');
      return;
    }
    onClose();
  };

  const photo = getProductImages(product).find((u) => u && u !== '/logo.png');

  return (
    <div className="modal-backdrop active" onClick={() => !isSaving && onClose()}>
      <div
        className="modal-box"
        style={{ maxWidth: '560px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-details-title"
      >
        <button type="button" onClick={onClose} className="qty-btn" style={{ position: 'absolute', top: '14px', right: '14px' }} aria-label="Cerrar" disabled={isSaving}>
          <X size={18} />
        </button>

        <h3 id="edit-details-title" style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '14px' }}>
          <Pencil size={17} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-3px' }} aria-hidden="true" />
          Editar producto
        </h3>

        <div className="edit-details-product">
          {photo && (
            <SafeImg src={getThumbUrl(photo) || photo} fallbacks={[photo, '/logo.png']} alt="" className="edit-details-photo" />
          )}
          <div style={{ minWidth: 0 }}>
            {product.code && <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Cód: {product.code}</div>}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {product.category}{product.subcategory ? ` · ${product.subcategory}` : ''}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="edit-product-name">Nombre del producto</label>
            <input
              id="edit-product-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem', fontWeight: 600 }}
              maxLength={NAME_MAX}
              autoFocus
              required
            />
            <div className="edit-details-hint">
              <span>Es el título que ven los clientes en la web y en el catálogo.</span>
              <span>{name.length}/{NAME_MAX}</span>
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label className="form-label" htmlFor="edit-product-desc">Descripción</label>
            <textarea
              id="edit-product-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
              className="form-input"
              rows={6}
              style={{ width: '100%', padding: '10px 12px', fontSize: '0.9rem', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }}
              maxLength={DESC_MAX}
              placeholder="Material, talles, colores, cantidad por pack, etc."
            />
            <div className="edit-details-hint">
              <span>Se muestra en la ficha del producto y la usa el bot para responder.</span>
              <span>{description.length}/{DESC_MAX}</span>
            </div>
          </div>

          {error && (
            <p role="alert" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 14px', fontSize: '0.85rem', fontWeight: 700, color: '#B91C1C' }}>
              <AlertCircle size={15} aria-hidden="true" /> {error}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={isSaving}>Cancelar</button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!canSave}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: canSave ? 1 : 0.55 }}
            >
              {isSaving ? <Loader2 size={15} className="spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SizeColorManagerModal({ product, onClose, onSave }) {
  const [sizes, setSizes] = useState(Array.isArray(product.sizes) ? [...product.sizes] : []);
  
  // Estado para cada talle: { [size]: { colors: string[], color_stock: { [color]: number }, bulkStock: string } }
  const [sizeConfigs, setSizeConfigs] = useState(() => {
    const map = {};
    const globalColors = getProductColors(product);
    (product.sizes || []).forEach((s) => {
      const details = getSizeDetails(product, s);
      const colors = details.colors.length > 0 ? [...details.colors] : [...globalColors];
      const color_stock = {};
      colors.forEach((c) => {
        color_stock[c] = details.color_stock?.[c] ?? details.stock ?? 5;
      });
      map[s] = {
        colors,
        color_stock,
        bulkStock: String(details.stock || 5)
      };
    });
    return map;
  });

  // Para productos sin talle (talle único)
  const [singleColors, setSingleColors] = useState(() => getProductColors(product));
  const [singleColorStock, setSingleColorStock] = useState(() => {
    const details = getSizeDetails(product, null);
    const map = {};
    (details.colors || []).forEach((c) => {
      map[c] = details.color_stock?.[c] ?? 5;
    });
    return map;
  });
  const [singleStock, setSingleStock] = useState(() => product.stock ?? 20);

  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeStock, setNewSizeStock] = useState('5');
  const [customColorInputs, setCustomColorInputs] = useState({});
  const [singleColorInput, setSingleColorInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Manejo de talles
  const handleAddSize = () => {
    const trimmed = newSizeName.trim().toUpperCase();
    if (!trimmed || sizes.includes(trimmed)) return;
    const initialStock = Math.max(1, parseInt(newSizeStock, 10) || 5);
    const defaultColors = getProductColors(product);
    const colors = defaultColors.length > 0 ? [...defaultColors] : ['Surtido'];
    const color_stock = {};
    colors.forEach((c) => {
      color_stock[c] = initialStock;
    });

    setSizes((prev) => [...prev, trimmed]);
    setSizeConfigs((prev) => ({
      ...prev,
      [trimmed]: {
        colors,
        color_stock,
        bulkStock: String(initialStock)
      }
    }));
    setNewSizeName('');
    setNewSizeStock('5');
  };

  const handleRemoveSize = (size) => {
    setSizes((prev) => prev.filter((s) => s !== size));
    setSizeConfigs((prev) => {
      const copy = { ...prev };
      delete copy[size];
      return copy;
    });
  };

  const handleUpdateColorStock = (size, color, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setSizeConfigs((prev) => {
      const current = prev[size] || { colors: [], color_stock: {} };
      return {
        ...prev,
        [size]: {
          ...current,
          color_stock: {
            ...(current.color_stock || {}),
            [color]: num
          }
        }
      };
    });
  };

  const handleApplyBulkStockToSize = (size, stockVal) => {
    const num = Math.max(0, parseInt(stockVal, 10) || 0);
    setSizeConfigs((prev) => {
      const current = prev[size] || { colors: [], color_stock: {} };
      const updatedColorStock = {};
      (current.colors || []).forEach((c) => {
        updatedColorStock[c] = num;
      });
      return {
        ...prev,
        [size]: {
          ...current,
          color_stock: updatedColorStock,
          bulkStock: String(num)
        }
      };
    });
  };

  // Manejo de colores por talle
  const handleAddColorToSize = (size, colorToAdd, defaultVal = 5) => {
    const trimmed = (colorToAdd || '').trim();
    if (!trimmed) return;
    setSizeConfigs((prev) => {
      const current = prev[size] || { colors: [], color_stock: {}, bulkStock: '5' };
      if (current.colors.includes(trimmed)) return prev;
      const initialStock = Math.max(0, parseInt(current.bulkStock, 10) || defaultVal);
      return {
        ...prev,
        [size]: {
          ...current,
          colors: [...current.colors, trimmed],
          color_stock: {
            ...(current.color_stock || {}),
            [trimmed]: initialStock
          }
        }
      };
    });
  };

  const handleRemoveColorFromSize = (size, colorToRemove) => {
    setSizeConfigs((prev) => {
      const current = prev[size] || { colors: [], color_stock: {} };
      const updatedColors = current.colors.filter((c) => c !== colorToRemove);
      const updatedColorStock = { ...(current.color_stock || {}) };
      delete updatedColorStock[colorToRemove];
      return {
        ...prev,
        [size]: {
          ...current,
          colors: updatedColors,
          color_stock: updatedColorStock
        }
      };
    });
  };

  // Colores para talle único
  const handleAddSingleColor = (colorToAdd, defaultVal = 5) => {
    const trimmed = (colorToAdd || '').trim();
    if (!trimmed || singleColors.includes(trimmed)) return;
    setSingleColors((prev) => [...prev, trimmed]);
    setSingleColorStock((prev) => ({ ...prev, [trimmed]: defaultVal }));
  };

  const handleRemoveSingleColor = (colorToRemove) => {
    setSingleColors((prev) => prev.filter((c) => c !== colorToRemove));
    setSingleColorStock((prev) => {
      const copy = { ...prev };
      delete copy[colorToRemove];
      return copy;
    });
  };

  const handleUpdateSingleColorStock = (color, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setSingleColorStock((prev) => ({ ...prev, [color]: num }));
  };

  // Cálculo de stock total
  const calculatedTotalStock = sizes.length > 0
    ? sizes.reduce((acc, s) => {
        const cfg = sizeConfigs[s] || { colors: [], color_stock: {} };
        const subtotal = (cfg.colors || []).reduce((sum, c) => sum + (parseInt(cfg.color_stock?.[c], 10) || 0), 0);
        return acc + subtotal;
      }, 0)
    : (singleColors.length > 0
        ? singleColors.reduce((sum, c) => sum + (parseInt(singleColorStock[c], 10) || 0), 0)
        : Math.max(0, parseInt(singleStock, 10) || 0));

  const handleSave = async () => {
    setIsSaving(true);

    if (sizes.length > 0) {
      const cleanStockPerSize = {};
      const allUniqueColors = new Set();
      let totalStock = 0;

      sizes.forEach((s) => {
        const cfg = sizeConfigs[s] || { colors: [], color_stock: {} };
        const cleanColors = Array.from(new Set(cfg.colors.filter(Boolean)));
        const finalColorStock = {};
        let sizeTotalStock = 0;

        cleanColors.forEach((c) => {
          const val = Math.max(0, parseInt(cfg.color_stock?.[c], 10) || 0);
          finalColorStock[c] = val;
          sizeTotalStock += val;
          allUniqueColors.add(c);
        });

        cleanStockPerSize[s] = {
          stock: sizeTotalStock,
          colors: cleanColors.length > 0 ? cleanColors : ['Surtido'],
          color_stock: finalColorStock
        };

        totalStock += sizeTotalStock;
      });

      const finalColorsList = Array.from(allUniqueColors);
      await onSave(product.id, {
        sizes,
        stock_per_size: cleanStockPerSize,
        colors: finalColorsList.length > 0 ? finalColorsList : ['Surtido'],
        stock: totalStock
      });
    } else {
      // Talle único
      const totalStock = singleColors.length > 0
        ? singleColors.reduce((sum, c) => sum + (parseInt(singleColorStock[c], 10) || 0), 0)
        : Math.max(0, parseInt(singleStock, 10) || 0);

      await onSave(product.id, {
        sizes: [],
        stock_per_size: {},
        colors: singleColors.length > 0 ? singleColors : ['Surtido'],
        stock: totalStock
      });
    }

    setIsSaving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="qty-btn" style={{ position: 'absolute', top: '14px', right: '14px' }}>
          <X size={18} />
        </button>

        <div style={{ marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} style={{ color: 'var(--accent-gold)' }} />
            Talles, Colores y Stock por Talle
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            {product.name} {product.code ? `(Cód: ${product.code})` : ''}
          </p>
        </div>

        {/* Scrollable content area */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', marginBottom: '16px' }}>

          {/* SIZES LIST */}
          {sizes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Talles configurados ({sizes.length}) — Asigná el stock exacto a cada color:
              </div>

              {sizes.map((s) => {
                const cfg = sizeConfigs[s] || { colors: [], color_stock: {}, bulkStock: '5' };
                const numColors = cfg.colors.length;
                const subtotal = (cfg.colors || []).reduce((sum, c) => sum + (parseInt(cfg.color_stock?.[c], 10) || 0), 0);
                const customInputVal = customColorInputs[s] || '';

                return (
                  <div
                    key={s}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      padding: '14px 16px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                    }}
                  >
                    {/* Header del talle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          backgroundColor: 'var(--text-main)',
                          color: 'var(--bg-page)',
                          fontWeight: 900,
                          fontSize: '0.9rem',
                          padding: '4px 12px',
                          borderRadius: '6px'
                        }}>
                          Talle {s}
                        </span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {numColors} {numColors === 1 ? 'color' : 'colores'}
                        </div>
                      </div>

                      {/* Herramienta de stock masivo y eliminar talle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Fijar a todos:</span>
                        <input
                          type="number"
                          min="0"
                          value={cfg.bulkStock || '5'}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSizeConfigs((prev) => ({
                              ...prev,
                              [s]: { ...(prev[s] || {}), bulkStock: v }
                            }));
                          }}
                          className="form-input"
                          style={{ width: '50px', padding: '3px 4px', fontSize: '0.8rem', textAlign: 'center' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyBulkStockToSize(s, cfg.bulkStock || '5')}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                          title="Aplica este stock a todos los colores de este talle"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSize(s)}
                          title={`Eliminar Talle ${s}`}
                          style={{
                            background: '#FEE2E2',
                            border: '1px solid #FCA5A5',
                            color: '#DC2626',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            padding: '4px 7px',
                            display: 'flex',
                            alignItems: 'center',
                            marginLeft: '4px'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Chips con stock individual por color */}
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Colores y Stock de cada uno en Talle {s}:
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {numColors === 0 ? (
                          <span style={{ fontSize: '0.78rem', color: '#DC2626', fontStyle: 'italic' }}>
                            ⚠️ Sin colores asignados a este talle. Agregá al menos uno abajo.
                          </span>
                        ) : (
                          cfg.colors.map((c) => (
                            <div
                              key={c}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 8px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                              }}
                            >
                              <Palette size={12} style={{ color: 'var(--accent-gold)' }} />
                              <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>{c}</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Stock:</span>
                              <input
                                type="number"
                                min="0"
                                value={cfg.color_stock?.[c] ?? 0}
                                onChange={(e) => handleUpdateColorStock(s, c, e.target.value)}
                                className="form-input"
                                style={{
                                  width: '52px',
                                  padding: '2px 4px',
                                  fontSize: '0.82rem',
                                  fontWeight: 800,
                                  textAlign: 'center',
                                  borderRadius: '4px'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveColorFromSize(s, c)}
                                title={`Quitar color ${c} del talle ${s}`}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '2px', display: 'flex' }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Sugerencias de colores rápidos */}
                    <div style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        + Agregar color a Talle {s}:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {POPULAR_COLORS.filter((pc) => !cfg.colors.includes(pc)).map((pc) => (
                          <button
                            key={pc}
                            type="button"
                            onClick={() => handleAddColorToSize(s, pc)}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              border: '1px dashed var(--border-color)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-muted)',
                              cursor: 'pointer'
                            }}
                          >
                            + {pc}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Input para color personalizado */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Otro color personalizado..."
                        value={customInputVal}
                        onChange={(e) => setCustomColorInputs((prev) => ({ ...prev, [s]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddColorToSize(s, customInputVal);
                            setCustomColorInputs((prev) => ({ ...prev, [s]: '' }));
                          }
                        }}
                        className="form-input"
                        style={{ flex: 1, padding: '5px 10px', fontSize: '0.8rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          handleAddColorToSize(s, customInputVal);
                          setCustomColorInputs((prev) => ({ ...prev, [s]: '' }));
                        }}
                        className="btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus size={13} /> Agregar
                      </button>
                    </div>

                    {/* Subtotal del talle */}
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)', fontSize: '0.76rem', color: '#059669', fontWeight: 700, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                      <span>Subtotal Talle {s}:</span>
                      <span>
                        <strong>{subtotal} prendas</strong> ({cfg.colors.map(c => `${c}: ${cfg.color_stock?.[c] ?? 0}`).join(', ')})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* PRODUCTO DE TALLE ÚNICO (SIN TALLES) */
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', backgroundColor: 'var(--bg-surface-elevated)', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Prenda de Talle Único</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Stock total:</label>
                  <input
                    type="number"
                    min="0"
                    value={singleColors.length > 0 ? calculatedTotalStock : singleStock}
                    onChange={(e) => setSingleStock(e.target.value)}
                    disabled={singleColors.length > 0}
                    className="form-input"
                    style={{ width: '80px', padding: '6px 8px', fontWeight: 800, textAlign: 'center' }}
                  />
                </div>
              </div>

              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Colores y Stock de cada uno:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                {singleColors.map((c) => (
                  <div
                    key={c}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <Palette size={12} style={{ color: 'var(--accent-gold)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{c}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Stock:</span>
                    <input
                      type="number"
                      min="0"
                      value={singleColorStock[c] ?? 0}
                      onChange={(e) => handleUpdateSingleColorStock(c, e.target.value)}
                      className="form-input"
                      style={{ width: '52px', padding: '2px 4px', fontSize: '0.82rem', fontWeight: 800, textAlign: 'center' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSingleColor(c)}
                      title="Quitar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '2px', display: 'flex' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Agregar color..."
                  value={singleColorInput}
                  onChange={(e) => setSingleColorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSingleColor(singleColorInput);
                      setSingleColorInput('');
                    }
                  }}
                  className="form-input"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.82rem' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    handleAddSingleColor(singleColorInput);
                    setSingleColorInput('');
                  }}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {POPULAR_COLORS.filter((pc) => !singleColors.includes(pc)).map((pc) => (
                  <button
                    key={pc}
                    type="button"
                    onClick={() => handleAddSingleColor(pc)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      border: '1px dashed var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    + {pc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FORMULARIO PARA AGREGAR NUEVO TALLE */}
          <div style={{
            border: '1px dashed #D97706',
            borderRadius: '10px',
            padding: '14px 16px',
            backgroundColor: '#FFFBEB'
          }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#92400E', marginBottom: '8px' }}>
              + Agregar un nuevo talle a esta prenda
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Talle (ej: S, M, XL, 4)"
                value={newSizeName}
                onChange={(e) => setNewSizeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSize();
                  }
                }}
                className="form-input"
                style={{ flex: 1, minWidth: '130px', padding: '7px 10px', fontSize: '0.85rem' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: '#92400E', fontWeight: 700 }}>Stock inicial c/u:</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Stock"
                  value={newSizeStock}
                  onChange={(e) => setNewSizeStock(e.target.value)}
                  className="form-input"
                  style={{ width: '70px', padding: '7px 8px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center' }}
                />
              </div>
              <button
                type="button"
                onClick={handleAddSize}
                disabled={!newSizeName.trim()}
                className="btn-primary"
                style={{
                  padding: '7px 16px',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#D97706',
                  color: '#FFF',
                  opacity: newSizeName.trim() ? 1 : 0.5
                }}
              >
                <Plus size={15} /> Agregar Talle
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER DEL MODAL */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Stock total del producto:</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: calculatedTotalStock > 0 ? '#059669' : '#DC2626' }}>
              {calculatedTotalStock} prendas
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '10px 18px', fontSize: '0.85rem', fontWeight: 700 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.88rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              {isSaving ? 'Guardando...' : 'Guardar Talles y Colores'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
