'use client';

import { useState, useMemo } from 'react';
import { PlusCircle, X, UploadCloud, Loader2, CheckCircle2, AlertCircle, Tag, Star, Trash2, ArrowLeft, ArrowRight, Image as ImageIcon, Layers, Palette, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { compressImageWithThumb } from '@/lib/compressImage';
import { getProductColors, POPULAR_COLORS } from '@/lib/catalogData';

const EMPTY_FORM = {
  name: '',
  category: '',
  customCategory: '',
  subcategory: '',
  customSubcategory: '',
  description: '',
  wholesale_price: '',
  stock: '0'
};

// Alta de UN producto por vez con soporte de MULTIPLES IMAGENES.
// Genera el codigo automatico, comprime todas las fotos a .webp,
// permite elegir cual es la portada y reordenarlas.
export default function AddProductTab({ categories, onCreateProduct }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageUrls, setImageUrls] = useState([]);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const [sizes, setSizes] = useState([]);
  const [sizeConfigs, setSizeConfigs] = useState({});
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeStock, setNewSizeStock] = useState('1');
  const [customColorInputs, setCustomColorInputs] = useState({});

  // Para prenda de talle único (cuando sizes está vacío)
  const [singleColors, setSingleColors] = useState([]);
  const [singleColorStock, setSingleColorStock] = useState({});
  const [singleColorInput, setSingleColorInput] = useState('');

  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  const selectedCategory = categories.find((c) => c.id === form.category);
  const availableSubcats = selectedCategory?.subcategories || [];

  const defaultCategoryColors = useMemo(() => {
    const catName = form.customCategory.trim() || form.category;
    const subName = form.customSubcategory.trim() || form.subcategory;
    if (!catName) return POPULAR_COLORS.slice(0, 5);
    return getProductColors({ category: catName, subcategory: subName });
  }, [form.category, form.customCategory, form.subcategory, form.customSubcategory]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Manejo de talles - Inicia totalmente limpio sin colores precargados
  const handleAddSize = () => {
    const trimmed = newSizeName.trim().toUpperCase();
    if (!trimmed || sizes.includes(trimmed)) return;
    const initialStock = Math.max(0, parseInt(newSizeStock, 10) || 0);

    setSizes((prev) => [...prev, trimmed]);
    setSizeConfigs((prev) => ({
      ...prev,
      [trimmed]: {
        colors: [],
        color_stock: {},
        bulkStock: String(initialStock)
      }
    }));
    setNewSizeName('');
    setNewSizeStock('1');
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

  const handleAddColorToSize = (size, colorToAdd, defaultVal = 1) => {
    const trimmed = (colorToAdd || '').trim();
    if (!trimmed) return;
    setSizeConfigs((prev) => {
      const current = prev[size] || { colors: [], color_stock: {}, bulkStock: '0' };
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

  // Manejo de colores para talle único
  const handleAddSingleColor = (colorToAdd, defaultVal = 1) => {
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
        : Math.max(0, parseInt(form.stock, 10) || 0));

  // Subida en lote de multiples fotos convirtiendo a .webp
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0 || !supabase) return;

    setIsUploadingImg(true);
    setErrorMsg('');
    setUploadProgress(`Preparando ${files.length} imagen${files.length > 1 ? 'es' : ''}...`);

    try {
      const uploadedUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Comprimiendo y subiendo ${i + 1} de ${files.length}...`);
        
        // 1. Compresion y conversion a webp en el navegador (full + miniatura)
        const { full, thumb } = await compressImageWithThumb(file);

        // 2. Subida a Supabase Storage bucket 'Productos'
        const filePath = `admin-uploads/nuevo-${Date.now()}-${i}.webp`;
        const { error: uploadErr } = await supabase.storage.from('Productos').upload(filePath, full.blob, {
          upsert: true,
          contentType: 'image/webp',
          // Un año de cache: cada subida usa un nombre de archivo nuevo, asi
          // que la foto nunca cambia una vez publicada (pide Lighthouse en
          // "Usar tiempos de vida de cache eficientes").
          cacheControl: '31536000'
        });
        if (uploadErr) throw uploadErr;

        // Miniatura liviana para la grilla (mismo nombre + "-thumb", ver
        // getThumbUrl en dataStore.js). Si falla esta subida puntual no se
        // corta el alta: la tarjeta cae a la foto completa como respaldo.
        if (thumb?.blob) {
          const thumbPath = filePath.replace(/\.webp$/, '-thumb.webp');
          await supabase.storage.from('Productos').upload(thumbPath, thumb.blob, {
            upsert: true,
            contentType: 'image/webp',
            cacheControl: '31536000'
          }).catch(() => {});
        }

        const { data: urlData } = supabase.storage.from('Productos').getPublicUrl(filePath);
        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      setImageUrls((prev) => [...prev, ...uploadedUrls]);
    } catch (err) {
      setErrorMsg('Error al subir fotos: ' + (err.message || 'error desconocido'));
    } finally {
      setIsUploadingImg(false);
      setUploadProgress('');
    }
  };

  const handleAddManualUrl = () => {
    const trimmed = manualUrlInput.trim();
    if (!trimmed) return;
    setImageUrls((prev) => [...prev, trimmed]);
    setManualUrlInput('');
  };

  const handleRemoveImage = (indexToRemove) => {
    setImageUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetCover = (indexToCover) => {
    if (indexToCover === 0) return;
    setImageUrls((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(indexToCover, 1);
      return [item, ...copy];
    });
  };

  const handleMoveImage = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= imageUrls.length) return;
    setImageUrls((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const resetForNext = () => {
    setForm((f) => ({ ...EMPTY_FORM, category: f.category, customCategory: f.customCategory, subcategory: f.subcategory, customSubcategory: f.customSubcategory, stock: '0' }));
    setImageUrls([]);
    setManualUrlInput('');
    setSizes([]);
    setSizeConfigs({});
    setNewSizeName('');
    setNewSizeStock('1');
    setCustomColorInputs({});
    setSingleColors([]);
    setSingleColorStock({});
    setSingleColorInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessInfo(null);

    const finalCategory = (form.customCategory.trim() || form.category).trim();
    const finalSubcategory = (form.customSubcategory.trim() || form.subcategory).trim();

    if (!form.name.trim()) return setErrorMsg('Falta el nombre del producto.');
    if (!finalCategory) return setErrorMsg('Elegí (o escribí) una categoría.');
    if (!form.wholesale_price || Number(form.wholesale_price) <= 0) return setErrorMsg('Falta el precio mayorista.');

    const cleanStockPerSize = {};
    const allUniqueColors = new Set();
    let finalCalculatedStock = 0;

    if (sizes.length > 0) {
      sizes.forEach((s) => {
        const cfg = sizeConfigs[s] || { colors: [], color_stock: {} };
        const cleanColors = Array.from(new Set((cfg.colors || []).filter(Boolean)));
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
          colors: cleanColors,
          color_stock: finalColorStock
        };

        finalCalculatedStock += sizeTotalStock;
      });
    } else {
      if (singleColors.length > 0) {
        singleColors.forEach((c) => {
          finalCalculatedStock += Math.max(0, parseInt(singleColorStock[c], 10) || 0);
          allUniqueColors.add(c);
        });
      } else {
        finalCalculatedStock = Math.max(0, parseInt(form.stock, 10) || 0);
      }
    }

    const finalColorsList = Array.from(allUniqueColors);

    setIsSaving(true);
    try {
      const created = await onCreateProduct({
        name: form.name,
        category: finalCategory,
        subcategory: finalSubcategory,
        description: form.description,
        wholesale_price: form.wholesale_price,
        stock: finalCalculatedStock,
        stock_per_size: cleanStockPerSize,
        sizes,
        colors: finalColorsList,
        image_url: imageUrls[0] || '',
        image_urls: imageUrls
      });
      setSuccessInfo(created);
      resetForNext();
    } catch (err) {
      setErrorMsg('No se pudo crear el producto: ' + (err.message || 'error desconocido'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PlusCircle size={22} style={{ color: '#16A34A' }} /> Nuevo Producto
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          Cargá una prenda a la vez. El código se genera solo (correlativo, nunca se repite) y el producto queda visible en la web al instante.
        </p>
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {successInfo && (
        <div style={{ backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7', padding: '14px 18px', borderRadius: '8px', marginBottom: '18px', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={20} /> "{successInfo.name}" creado con código <strong>{successInfo.code}</strong>. Ya está activo en la web.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>

        <div className="form-group">
          <label className="form-label">Nombre del producto *</label>
          <input type="text" className="form-input" value={form.name} onChange={update('name')} placeholder="Ej: Remera Algodón Oversize" />
        </div>

        <div className="form-group">
          <label className="form-label">Precio mayorista *</label>
          <input type="number" className="form-input" value={form.wholesale_price} onChange={update('wholesale_price')} placeholder="Ej: 12000" />
        </div>

        <div className="form-group">
          <label className="form-label">Categoría *</label>
          <select
            className="form-input"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, subcategory: '' }))}
          >
            <option value="">Elegir categoría existente...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="text"
            className="form-input"
            style={{ marginTop: '6px', fontSize: '0.82rem' }}
            placeholder="...o escribí una categoría nueva"
            value={form.customCategory}
            onChange={update('customCategory')}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Subcategoría</label>
          <select
            className="form-input"
            value={form.subcategory}
            onChange={update('subcategory')}
            disabled={availableSubcats.length === 0}
          >
            <option value="">{availableSubcats.length ? 'Elegir subcategoría existente...' : 'Sin subcategorías cargadas'}</option>
            {availableSubcats.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="text"
            className="form-input"
            style={{ marginTop: '6px', fontSize: '0.82rem' }}
            placeholder="...o escribí una subcategoría nueva"
            value={form.customSubcategory}
            onChange={update('customSubcategory')}
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            {sizes.length > 0 ? 'Stock Total (calculado)' : 'Stock (unidades)'}
          </label>
          {sizes.length > 0 ? (
            <div style={{
              padding: '9px 12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '8px',
              color: '#065F46',
              fontWeight: 800,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>{calculatedTotalStock} prendas</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#047857' }}>
                Suma de todos los talles
              </span>
            </div>
          ) : (
            <input type="number" min="0" className="form-input" value={form.stock} onChange={update('stock')} />
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Descripción (opcional)</label>
          <textarea className="form-input" rows={2} value={form.description} onChange={update('description')} placeholder="Detalle de tela, corte, etc." />
        </div>

        {/* Talles, Colores y Stock por Talle */}
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
              <Layers size={18} style={{ color: 'var(--accent-gold)' }} />
              Talles, Colores y Stock por Talle
            </label>
            {sizes.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700 }}>
                Total inventario: {calculatedTotalStock} prendas
              </span>
            )}
          </div>

          {/* LISTA DE TALLES CONFIGURADOS */}
          {sizes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
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
                      padding: '12px 14px'
                    }}
                  >
                    {/* Header del talle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          backgroundColor: 'var(--text-main)',
                          color: 'var(--bg-page)',
                          fontWeight: 900,
                          fontSize: '0.88rem',
                          padding: '3px 10px',
                          borderRadius: '6px'
                        }}>
                          Talle {s}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {numColors} {numColors === 1 ? 'color' : 'colores'}
                        </span>
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
                          style={{ width: '48px', padding: '3px 4px', fontSize: '0.78rem', textAlign: 'center' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyBulkStockToSize(s, cfg.bulkStock || '5')}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
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
                            padding: '4px 6px',
                            display: 'flex',
                            marginLeft: '4px'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Chips con stock individual por color */}
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                        Colores y Stock de cada uno en Talle {s}:
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {numColors === 0 ? (
                          <span style={{ fontSize: '0.76rem', color: '#DC2626', fontStyle: 'italic' }}>
                            ⚠️ Sin colores en este talle. Agregá uno abajo.
                          </span>
                        ) : (
                          cfg.colors.map((c) => (
                            <div
                              key={c}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 8px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                              }}
                            >
                              <Palette size={11} style={{ color: 'var(--accent-gold)' }} />
                              <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{c}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Stock:</span>
                              <input
                                type="number"
                                min="0"
                                value={cfg.color_stock?.[c] ?? 0}
                                onChange={(e) => handleUpdateColorStock(s, c, e.target.value)}
                                className="form-input"
                                style={{
                                  width: '48px',
                                  padding: '2px 4px',
                                  fontSize: '0.8rem',
                                  fontWeight: 800,
                                  textAlign: 'center',
                                  borderRadius: '4px'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveColorFromSize(s, c)}
                                title={`Quitar color ${c}`}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 0, display: 'flex' }}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Sugerencias de colores rápidos */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {POPULAR_COLORS.filter((pc) => !cfg.colors.includes(pc)).slice(0, 8).map((pc) => (
                          <button
                            key={pc}
                            type="button"
                            onClick={() => handleAddColorToSize(s, pc)}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '10px',
                              fontSize: '0.7rem',
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
                        placeholder="Otro color..."
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
                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.78rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          handleAddColorToSize(s, customInputVal);
                          setCustomColorInputs((prev) => ({ ...prev, [s]: '' }));
                        }}
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus size={12} /> Agregar
                      </button>
                    </div>

                    {/* Subtotal del talle */}
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)', fontSize: '0.74rem', color: '#059669', fontWeight: 700, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
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
            /* PRENDA DE TALLE ÚNICO (SIN TALLES) */
            <div style={{
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '14px',
              backgroundColor: 'var(--bg-surface-elevated)',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>Prenda de Talle Único</span>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Si la prenda tiene talles, agregá el primero abajo.
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {singleColors.length === 0 ? (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Sin colores específicos (se asignará el stock general a la prenda)
                  </span>
                ) : (
                  singleColors.map((c) => (
                    <div
                      key={c}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <Palette size={11} style={{ color: 'var(--accent-gold)' }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{c}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Stock:</span>
                      <input
                        type="number"
                        min="0"
                        value={singleColorStock[c] ?? 0}
                        onChange={(e) => handleUpdateSingleColorStock(c, e.target.value)}
                        className="form-input"
                        style={{ width: '48px', padding: '2px 4px', fontSize: '0.78rem', fontWeight: 800, textAlign: 'center' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSingleColor(c)}
                        title="Quitar"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 0 }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
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
                  style={{ flex: 1, padding: '5px 8px', fontSize: '0.8rem' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    handleAddSingleColor(singleColorInput);
                    setSingleColorInput('');
                  }}
                  className="btn-secondary"
                  style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                >
                  <Plus size={13} /> Agregar
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {POPULAR_COLORS.filter((pc) => !singleColors.includes(pc)).slice(0, 10).map((pc) => (
                  <button
                    key={pc}
                    type="button"
                    onClick={() => handleAddSingleColor(pc)}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '10px',
                      fontSize: '0.7rem',
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

          {/* FORMULARIO PARA AGREGAR TALLE */}
          <div style={{
            border: '1px dashed #D97706',
            borderRadius: '10px',
            padding: '12px 14px',
            backgroundColor: '#FFFBEB'
          }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#92400E', marginBottom: '6px' }}>
              + Agregar talle a esta prenda
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                style={{ flex: 1, minWidth: '120px', padding: '6px 8px', fontSize: '0.82rem' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.74rem', color: '#92400E', fontWeight: 700 }}>Stock inicial c/u:</span>
                <input
                  type="number"
                  min="1"
                  value={newSizeStock}
                  onChange={(e) => setNewSizeStock(e.target.value)}
                  className="form-input"
                  style={{ width: '65px', padding: '6px 6px', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center' }}
                />
              </div>
              <button
                type="button"
                onClick={handleAddSize}
                disabled={!newSizeName.trim()}
                className="btn-primary"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#D97706',
                  color: '#FFF',
                  opacity: newSizeName.trim() ? 1 : 0.5
                }}
              >
                <Plus size={14} /> Agregar Talle
              </button>
            </div>
          </div>
        </div>

        {/* Fotos del Producto (Múltiples Imágenes con WebP) */}
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ImageIcon size={16} /> Fotos del Producto ({imageUrls.length})
            </label>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Se comprimen a <strong>.webp</strong> automáticamente. La primera foto es la <strong>Portada</strong>.
            </span>
          </div>

          {/* Botones de acción para subir */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
            <label
              htmlFor="new-product-imgs"
              className="btn-secondary"
              style={{
                cursor: isUploadingImg ? 'wait' : 'pointer',
                opacity: isUploadingImg ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                fontWeight: 700
              }}
            >
              {isUploadingImg ? <Loader2 size={16} className="spin" /> : <UploadCloud size={16} />}
              {isUploadingImg ? (uploadProgress || 'Procesando fotos...') : 'Subir Fotos (Podés elegir varias)'}
            </label>
            <input
              id="new-product-imgs"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={isUploadingImg}
              style={{ display: 'none' }}
            />

            {/* Agregar URL manual */}
            <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: '260px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="...o pegar URL de imagen externa"
                value={manualUrlInput}
                onChange={(e) => setManualUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddManualUrl();
                  }
                }}
                style={{ fontSize: '0.84rem' }}
              />
              <button
                type="button"
                onClick={handleAddManualUrl}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
              >
                + Agregar
              </button>
            </div>
          </div>

          {/* Estado de subida en progreso */}
          {isUploadingImg && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '8px', border: '1px dashed var(--accent-gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--accent-gold-hover)', fontWeight: 600 }}>
              <Loader2 size={16} className="spin" /> {uploadProgress}
            </div>
          )}

          {/* Grilla de imágenes cargadas */}
          {imageUrls.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '12px',
              padding: '12px',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: '10px',
              border: '1px solid var(--border-color)'
            }}>
              {imageUrls.map((url, idx) => {
                const isCover = idx === 0;
                return (
                  <div
                    key={`${url}-${idx}`}
                    style={{
                      position: 'relative',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: isCover ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      boxShadow: isCover ? '0 0 0 1px var(--accent-gold)' : 'none',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div style={{ position: 'relative', width: '100%', height: '120px' }}>
                      <img
                        src={url}
                        alt={`Foto ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.src = '/logo.png'; }}
                      />
                      {isCover && (
                        <div style={{
                          position: 'absolute',
                          top: '6px',
                          left: '6px',
                          backgroundColor: 'var(--accent-gold)',
                          color: '#000',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                          <Star size={10} fill="#000" /> Portada
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        title="Eliminar foto"
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: 'rgba(220, 38, 38, 0.85)',
                          color: '#FFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Botonera de orden y portada */}
                    <div style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', backgroundColor: 'var(--bg-card)' }}>
                      {!isCover ? (
                        <button
                          type="button"
                          onClick={() => handleSetCover(idx)}
                          className="btn-secondary"
                          style={{ fontSize: '0.68rem', padding: '3px 6px', flex: 1, justifyContent: 'center', gap: '3px' }}
                          title="Fijar como foto principal de portada"
                        >
                          <Star size={11} /> Portada
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-gold-hover)', padding: '3px 6px' }}>
                          Principal
                        </span>
                      )}

                      <div style={{ display: 'flex', gap: '2px' }}>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveImage(idx, idx - 1)}
                            title="Mover a la izquierda"
                            style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 4px', cursor: 'pointer', display: 'flex', color: 'var(--text-main)' }}
                          >
                            <ArrowLeft size={11} />
                          </button>
                        )}
                        {idx < imageUrls.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMoveImage(idx, idx + 1)}
                            title="Mover a la derecha"
                            style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 4px', cursor: 'pointer', display: 'flex', color: 'var(--text-main)' }}
                          >
                            <ArrowRight size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: '8px',
              border: '1px dashed var(--border-color)',
              color: 'var(--text-muted)',
              fontSize: '0.85rem'
            }}>
              No hay fotos cargadas aún. Podés subir varias imágenes juntas arriba.
            </div>
          )}
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <button type="submit" disabled={isSaving} className="btn-primary" style={{ padding: '11px 24px', fontSize: '0.9rem', fontWeight: 800, opacity: isSaving ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {isSaving ? <Loader2 size={16} className="spin" /> : <Tag size={16} />}
            {isSaving ? 'Creando...' : 'Crear Producto'}
          </button>
        </div>
      </form>
    </div>
  );
}
