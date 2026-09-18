'use client';

import { useState, useMemo } from 'react';
import { PlusCircle, X, UploadCloud, Loader2, CheckCircle2, AlertCircle, Tag, Star, Trash2, ArrowLeft, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { compressImageWithThumb } from '@/lib/compressImage';
import { getProductColors } from '@/lib/catalogData';

const EMPTY_FORM = {
  name: '',
  category: '',
  customCategory: '',
  subcategory: '',
  customSubcategory: '',
  description: '',
  wholesale_price: '',
  stock: '50'
};

// Alta de UN producto por vez con soporte de MULTIPLES IMAGENES.
// Genera el codigo automatico, comprime todas las fotos a .webp,
// permite elegir cual es la portada y reordenarlas.
export default function AddProductTab({ categories, onCreateProduct }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageUrls, setImageUrls] = useState([]);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const [sizes, setSizes] = useState([]);
  const [newSize, setNewSize] = useState('');
  const [colors, setColors] = useState([]);
  const [newColor, setNewColor] = useState('');
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  const selectedCategory = categories.find((c) => c.id === form.category);
  const availableSubcats = selectedCategory?.subcategories || [];

  const previewColors = useMemo(() => {
    if (colors.length > 0) return colors;
    const catName = form.customCategory.trim() || form.category;
    const subName = form.customSubcategory.trim() || form.subcategory;
    if (!catName) return [];
    return getProductColors({ category: catName, subcategory: subName });
  }, [colors, form.category, form.customCategory, form.subcategory, form.customSubcategory]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleAddSize = () => {
    const trimmed = newSize.trim();
    if (!trimmed || sizes.includes(trimmed)) return;
    setSizes((prev) => [...prev, trimmed]);
    setNewSize('');
  };

  const handleAddColor = () => {
    const trimmed = newColor.trim();
    if (!trimmed || colors.includes(trimmed)) return;
    setColors((prev) => [...prev, trimmed]);
    setNewColor('');
  };

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
          contentType: 'image/webp'
        });
        if (uploadErr) throw uploadErr;

        // Miniatura liviana para la grilla (mismo nombre + "-thumb", ver
        // getThumbUrl en dataStore.js). Si falla esta subida puntual no se
        // corta el alta: la tarjeta cae a la foto completa como respaldo.
        if (thumb?.blob) {
          const thumbPath = filePath.replace(/\.webp$/, '-thumb.webp');
          await supabase.storage.from('Productos').upload(thumbPath, thumb.blob, {
            upsert: true,
            contentType: 'image/webp'
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
    setForm((f) => ({ ...EMPTY_FORM, category: f.category, customCategory: f.customCategory, subcategory: f.subcategory, customSubcategory: f.customSubcategory, stock: f.stock }));
    setImageUrls([]);
    setManualUrlInput('');
    setSizes([]);
    setColors([]);
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

    setIsSaving(true);
    try {
      const created = await onCreateProduct({
        name: form.name,
        category: finalCategory,
        subcategory: finalSubcategory,
        description: form.description,
        wholesale_price: form.wholesale_price,
        stock: form.stock,
        sizes,
        colors,
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
          <label className="form-label">Stock (unidades)</label>
          <input type="number" className="form-input" value={form.stock} onChange={update('stock')} />
        </div>

        <div className="form-group">
          <label className="form-label">Descripción (opcional)</label>
          <textarea className="form-input" rows={2} value={form.description} onChange={update('description')} placeholder="Detalle de tela, corte, etc." />
        </div>

        {/* Talles */}
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Talles</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {sizes.length === 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin talles cargados (se vende talle único)</span>
            )}
            {sizes.map((s) => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '20px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', fontSize: '0.82rem', fontWeight: 700 }}>
                {s}
                <button type="button" onClick={() => setSizes((prev) => prev.filter((x) => x !== s))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'flex', padding: 0 }}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px', maxWidth: '360px' }}>
            <input type="text" className="form-input" placeholder="Ej: S, 38, Único..." value={newSize} onChange={(e) => setNewSize(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSize(); } }} />
            <button type="button" onClick={handleAddSize} className="btn-secondary" style={{ padding: '7px 14px' }}>Agregar</button>
          </div>
        </div>

        {/* Colores */}
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Colores (opcional — si no cargás ninguno, se usan los típicos de la categoría)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {previewColors.map((c) => (
              <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '20px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', fontSize: '0.82rem', fontWeight: 700 }}>
                {c}
                {colors.includes(c) && (
                  <button type="button" onClick={() => setColors((prev) => prev.filter((x) => x !== c))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'flex', padding: 0 }}>
                    <X size={13} />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px', maxWidth: '360px' }}>
            <input type="text" className="form-input" placeholder="Ej: Negro, Bordó..." value={newColor} onChange={(e) => setNewColor(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddColor(); } }} />
            <button type="button" onClick={handleAddColor} className="btn-secondary" style={{ padding: '7px 14px' }}>Agregar</button>
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
