'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Copy, X, Plus, Trash2, Palette, Layers, UploadCloud, Loader2, 
  AlertCircle, CheckCircle2, Image as ImageIcon, Save, ArrowLeft, ArrowRight, Sparkles 
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { compressImageWithThumb } from '@/lib/compressImage';
import { getProductColors, POPULAR_COLORS, getSizeDetails } from '@/lib/catalogData';
import { getProductImages, getThumbUrl } from '@/lib/dataStore';
import SafeImg from './SafeImg';

export default function DuplicateProductModal({ product, categories = [], onClose, onCreateProduct }) {
  // 1. Datos Generales
  const [name, setName] = useState(product?.name ? `${product.name} (Variante)` : '');
  const [category, setCategory] = useState(product?.category || '');
  const [customCategory, setCustomCategory] = useState('');
  const [subcategory, setSubcategory] = useState(product?.subcategory || '');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState(
    product?.wholesale_price != null ? String(product.wholesale_price) : (product?.price != null ? String(product.price) : '')
  );
  const [description, setDescription] = useState(product?.description || '');
  const [customCode, setCustomCode] = useState('');

  // 2. Fotos
  const [imageUrls, setImageUrls] = useState(() => {
    const raw = getProductImages(product).filter((u) => u && u !== '/logo.png');
    return raw.length > 0 ? [...raw] : [];
  });
  const [manualUrlInput, setManualUrlInput] = useState('');
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // 3. Talles y Colores
  const initialHasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0;
  const [sizes, setSizes] = useState(() => {
    return initialHasSizes ? [...product.sizes] : [];
  });

  const [sizeConfigs, setSizeConfigs] = useState(() => {
    const map = {};
    if (initialHasSizes) {
      product.sizes.forEach((s) => {
        const details = getSizeDetails(product, s);
        const colors = Array.isArray(details.colors) ? [...details.colors] : [];
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
    }
    return map;
  });

  // Talle único (cuando no tiene talles)
  const [singleColors, setSingleColors] = useState(() => {
    return !initialHasSizes && Array.isArray(product?.colors) ? [...product.colors] : [];
  });
  const [singleColorStock, setSingleColorStock] = useState(() => {
    if (!initialHasSizes) {
      const details = getSizeDetails(product, null);
      const map = {};
      (details.colors || []).forEach((c) => {
        map[c] = details.color_stock?.[c] ?? 5;
      });
      return map;
    }
    return {};
  });
  const [singleStock, setSingleStock] = useState(() => String(product?.stock ?? '0'));
  const [singleColorInput, setSingleColorInput] = useState('');

  // Inputs auxiliares
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeStock, setNewSizeStock] = useState('5');
  const [customColorInputs, setCustomColorInputs] = useState({});

  // Estados de guardado / UI
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSaving]);

  // Subcategorías según categoría seleccionada
  const selectedCategoryObj = categories.find((c) => c.name === category || c.id === category);
  const availableSubcats = selectedCategoryObj?.subcategories || [];

  // Manejo de Fotos
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0 || !supabase) return;

    setIsUploadingImg(true);
    setErrorMsg('');
    setUploadProgress(`Preparando ${files.length} foto${files.length > 1 ? 's' : ''}...`);

    try {
      const uploadedUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Comprimiendo y subiendo ${i + 1} de ${files.length}...`);
        const { full, thumb } = await compressImageWithThumb(file);
        const filePath = `admin-uploads/duplicado-${Date.now()}-${i}.webp`;

        const { error: uploadErr } = await supabase.storage.from('Productos').upload(filePath, full.blob, {
          upsert: true,
          contentType: 'image/webp',
          cacheControl: '31536000'
        });
        if (uploadErr) throw uploadErr;

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

  // Manejo de Talles
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

  // Manejo de Colores en Talle Único
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

  // Crear Producto Duplicado
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const finalName = name.trim();
    const finalCategory = (customCategory.trim() || category).trim();
    const finalSubcategory = (customSubcategory.trim() || subcategory).trim();
    const parsedPrice = parseFloat(wholesalePrice);

    if (!finalName) return setErrorMsg('Por favor ingresá un nombre para el nuevo producto.');
    if (!finalCategory) return setErrorMsg('Por favor seleccioná o ingresá una categoría.');
    if (isNaN(parsedPrice) || parsedPrice <= 0) return setErrorMsg('Por favor ingresá un precio mayorista válido mayor a 0.');

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
          const val = Math.max(0, parseInt(singleColorStock[c], 10) || 0);
          finalCalculatedStock += val;
          allUniqueColors.add(c);
        });
      } else {
        finalCalculatedStock = Math.max(0, parseInt(singleStock, 10) || 0);
      }
    }

    const finalColorsList = Array.from(allUniqueColors);

    setIsSaving(true);
    try {
      await onCreateProduct({
        name: finalName,
        category: finalCategory,
        subcategory: finalSubcategory,
        description: description.trim(),
        wholesale_price: parsedPrice,
        price: parsedPrice,
        stock: finalCalculatedStock,
        stock_per_size: cleanStockPerSize,
        sizes,
        colors: finalColorsList,
        image_url: imageUrls[0] || '',
        image_urls: imageUrls,
        code: customCode.trim() || undefined
      });
      onClose();
    } catch (err) {
      setErrorMsg('No se pudo duplicar el producto: ' + (err.message || 'error desconocido'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '880px',
        maxHeight: '92vh',
        overflowY: 'auto',
        border: '1px solid var(--border-color)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
        padding: '24px',
        position: 'relative'
      }}>
        {/* Botón Cerrar */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          disabled={isSaving}
          title="Cerrar"
        >
          <X size={20} />
        </button>

        {/* Encabezado */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '4px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px' }}>
            <Copy size={13} /> Duplicar Producto
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            Crear Variante / Nuevo Producto
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Duplicando a partir de <strong>"{product.name}"</strong> (Cód: {product.code || 'S/C'}). Se asignará un <strong>código nuevo único</strong> y podés modificar todos sus talles, colores, fotos y precios.
          </p>
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '0.86rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* SECCIÓN 1: DATOS BÁSICOS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '14px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '18px'
          }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" style={{ fontWeight: 800 }}>Nombre del nuevo producto *</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Remera Algodón Estampada"
                required
              />
            </div>

            <div>
              <label className="form-label">Categoría *</label>
              <select
                className="form-input"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSubcategory('');
                }}
              >
                <option value="">Elegir categoría...</option>
                {categories
                  .filter((c) => c.id !== 'all' && (c.name || c.id))
                  .map((c, idx) => (
                    <option key={`${c.id || c.name}-${idx}`} value={c.name || c.id}>{c.name || c.id}</option>
                  ))}
              </select>
              <input
                type="text"
                className="form-input"
                style={{ marginTop: '6px', fontSize: '0.8rem' }}
                placeholder="...o escribir nueva categoría"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Subcategoría</label>
              <select
                className="form-input"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                disabled={availableSubcats.length === 0}
              >
                <option value="">{availableSubcats.length > 0 ? 'Elegir subcategoría...' : 'Sin subcategorías'}</option>
                {availableSubcats.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="text"
                className="form-input"
                style={{ marginTop: '6px', fontSize: '0.8rem' }}
                placeholder="...o escribir nueva subcategoría"
                value={customSubcategory}
                onChange={(e) => setCustomSubcategory(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Precio mayorista ($) *</label>
              <input
                type="number"
                min="0"
                step="any"
                className="form-input"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value)}
                placeholder="Ej: 15000"
                required
              />
            </div>

            <div>
              <label className="form-label">
                Código del producto
                <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginLeft: '6px' }}>
                  (Automático si se deja vacío)
                </span>
              </label>
              <input
                type="text"
                className="form-input"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="Automático (correlativo único)"
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Descripción</label>
              <textarea
                className="form-input"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle de tela, corte, etc."
              />
            </div>
          </div>

          {/* SECCIÓN 2: TALLES, COLORES Y STOCK */}
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '18px',
            backgroundColor: 'var(--bg-surface-elevated)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.96rem', fontWeight: 800 }}>
                <Layers size={18} style={{ color: 'var(--accent-gold)' }} />
                Talles, Colores y Stock de la variante
              </div>
              <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 800 }}>
                Stock total calculado: {calculatedTotalStock} prendas
              </span>
            </div>

            {/* SI TIENE TALLES */}
            {sizes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
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
                        backgroundColor: 'var(--bg-card)',
                        padding: '12px 14px'
                      }}
                    >
                      {/* Fila superior del talle */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            backgroundColor: 'var(--text-main)',
                            color: 'var(--bg-page)',
                            fontWeight: 900,
                            fontSize: '0.85rem',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            Talle {s}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {numColors} {numColors === 1 ? 'color' : 'colores'} · Subtotal: <strong>{subtotal} un.</strong>
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fijar a todos:</span>
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
                            style={{ width: '46px', padding: '2px 4px', fontSize: '0.76rem', textAlign: 'center' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleApplyBulkStockToSize(s, cfg.bulkStock || '5')}
                            className="btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
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
                              padding: '3px 6px',
                              display: 'flex'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Lista de colores de este talle */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {numColors === 0 ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Sin colores en este talle. Podés sumar colores abajo.
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
                                borderRadius: '6px',
                                backgroundColor: 'var(--bg-surface-elevated)',
                                border: '1px solid var(--border-color)'
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
                                style={{ width: '46px', padding: '2px 4px', fontSize: '0.78rem', fontWeight: 800, textAlign: 'center' }}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveColorFromSize(s, c)}
                                title={`Quitar color ${c}`}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 0 }}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Botones rápidos de colores + input de color */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1 }}>
                          {POPULAR_COLORS.filter((pc) => !cfg.colors.includes(pc)).slice(0, 7).map((pc) => (
                            <button
                              key={pc}
                              type="button"
                              onClick={() => handleAddColorToSize(s, pc)}
                              style={{
                                padding: '2px 7px',
                                borderRadius: '8px',
                                fontSize: '0.68rem',
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
                        <div style={{ display: 'flex', gap: '4px' }}>
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
                            style={{ width: '110px', padding: '3px 6px', fontSize: '0.74rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleAddColorToSize(s, customInputVal);
                              setCustomColorInputs((prev) => ({ ...prev, [s]: '' }));
                            }}
                            className="btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TALLE ÚNICO */
              <div style={{
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '12px 14px',
                backgroundColor: 'var(--bg-card)',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>Prenda de Talle Único</span>
                  {singleColors.length === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stock total:</span>
                      <input
                        type="number"
                        min="0"
                        value={singleStock}
                        onChange={(e) => setSingleStock(e.target.value)}
                        className="form-input"
                        style={{ width: '70px', padding: '4px 6px', fontSize: '0.82rem', textAlign: 'center', fontWeight: 800 }}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {singleColors.length === 0 ? (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Sin colores específicos (se asignará el stock general a la prenda).
                    </span>
                  ) : (
                    singleColors.map((c) => (
                      <div
                        key={c}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-surface-elevated)',
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
                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.78rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleAddSingleColor(singleColorInput);
                      setSingleColorInput('');
                    }}
                    className="btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '0.76rem' }}
                  >
                    <Plus size={13} /> Agregar Color
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {POPULAR_COLORS.filter((pc) => !singleColors.includes(pc)).slice(0, 9).map((pc) => (
                    <button
                      key={pc}
                      type="button"
                      onClick={() => handleAddSingleColor(pc)}
                      style={{
                        padding: '2px 7px',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        border: '1px dashed var(--border-color)',
                        backgroundColor: 'var(--bg-surface-elevated)',
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

            {/* FORMULARIO PARA AGREGAR NUEVO TALLE A LA DUPLICACIÓN */}
            <div style={{
              border: '1px dashed #D97706',
              borderRadius: '10px',
              padding: '10px 14px',
              backgroundColor: '#FFFBEB'
            }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#92400E', marginBottom: '6px' }}>
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
                  style={{ flex: 1, minWidth: '110px', padding: '5px 8px', fontSize: '0.8rem' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#92400E', fontWeight: 700 }}>Stock inicial:</span>
                  <input
                    type="number"
                    min="0"
                    value={newSizeStock}
                    onChange={(e) => setNewSizeStock(e.target.value)}
                    className="form-input"
                    style={{ width: '55px', padding: '5px 6px', fontSize: '0.8rem', textAlign: 'center', fontWeight: 700 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddSize}
                  disabled={!newSizeName.trim()}
                  className="btn-primary"
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#D97706',
                    color: '#FFF',
                    opacity: newSizeName.trim() ? 1 : 0.5
                  }}
                >
                  <Plus size={13} /> Agregar Talle
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: FOTOS */}
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            backgroundColor: 'var(--bg-surface-elevated)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={16} /> Fotos del Producto ({imageUrls.length})
              </label>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Se conservan las fotos originales. Podés quitar, reordenar o subir fotos nuevas.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
              <label
                htmlFor="duplicate-product-imgs"
                className="btn-secondary"
                style={{
                  cursor: isUploadingImg ? 'wait' : 'pointer',
                  opacity: isUploadingImg ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 700
                }}
              >
                {isUploadingImg ? <Loader2 size={15} className="spin" /> : <UploadCloud size={15} />}
                {isUploadingImg ? (uploadProgress || 'Subiendo fotos...') : 'Subir Fotos Nuevas'}
              </label>
              <input
                id="duplicate-product-imgs"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                disabled={isUploadingImg}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: '220px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="...o pegar URL externa"
                  value={manualUrlInput}
                  onChange={(e) => setManualUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddManualUrl();
                    }
                  }}
                  style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                />
                <button
                  type="button"
                  onClick={handleAddManualUrl}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  + Agregar
                </button>
              </div>
            </div>

            {imageUrls.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: '10px'
              }}>
                {imageUrls.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    style={{
                      position: 'relative',
                      border: idx === 0 ? '2px solid #2563EB' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: 'var(--bg-card)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
                    }}
                  >
                    <div style={{ width: '100%', height: '110px', position: 'relative' }}>
                      <SafeImg
                        src={getThumbUrl(url) || url}
                        fallbacks={[url, '/logo.png']}
                        alt={`Foto ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    {idx === 0 && (
                      <span style={{
                        position: 'absolute',
                        top: '4px',
                        left: '4px',
                        backgroundColor: '#2563EB',
                        color: '#FFF',
                        fontSize: '0.65rem',
                        fontWeight: 900,
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        PORTADA
                      </span>
                    )}

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 6px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderTop: '1px solid var(--border-color)'
                    }}>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveImage(idx, idx - 1)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)' }}
                            title="Mover a la izquierda"
                          >
                            <ArrowLeft size={12} />
                          </button>
                        )}
                        {idx < imageUrls.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMoveImage(idx, idx + 1)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)' }}
                            title="Mover a la derecha"
                          >
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#DC2626' }}
                        title="Eliminar foto"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FOOTER DE ACCIÓN */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '16px'
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSaving}
              style={{ padding: '10px 18px', fontSize: '0.88rem' }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={isSaving}
              style={{
                padding: '10px 24px',
                fontSize: '0.92rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#16A34A',
                color: '#FFF'
              }}
            >
              {isSaving ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
              {isSaving ? 'Guardando nuevo producto...' : '✓ Crear Producto Duplicado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
