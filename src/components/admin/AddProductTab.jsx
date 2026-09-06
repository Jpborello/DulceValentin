'use client';

import { useState, useMemo } from 'react';
import { PlusCircle, X, UploadCloud, Loader2, CheckCircle2, AlertCircle, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { compressImage } from '@/lib/compressImage';
import { getProductColors } from '@/lib/catalogData';

const EMPTY_FORM = {
  name: '',
  category: '',
  customCategory: '',
  subcategory: '',
  customSubcategory: '',
  description: '',
  wholesale_price: '',
  stock: '50',
  imageUrl: ''
};

// Alta de UN producto por vez (a diferencia de la Carga Masiva, que es para
// listas grandes por CSV). Genera el codigo automatico, deja elegir
// categoria/subcategoria ya existentes o escribir una nueva, y sube la foto
// igual que en "Gestión de Imágenes".
export default function AddProductTab({ categories, onCreateProduct }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [sizes, setSizes] = useState([]);
  const [newSize, setNewSize] = useState('');
  const [colors, setColors] = useState([]);
  const [newColor, setNewColor] = useState('');
  const [isUploadingImg, setIsUploadingImg] = useState(false);
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

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !supabase) return;

    setIsUploadingImg(true);
    setErrorMsg('');
    try {
      const { blob } = await compressImage(file);
      const filePath = `admin-uploads/nuevo-${Date.now()}.webp`;
      const { error: uploadErr } = await supabase.storage.from('Productos').upload(filePath, blob, {
        upsert: true,
        contentType: 'image/webp'
      });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('Productos').getPublicUrl(filePath);
      setForm((f) => ({ ...f, imageUrl: urlData.publicUrl }));
    } catch (err) {
      setErrorMsg('No se pudo subir la foto: ' + (err.message || 'error desconocido'));
    } finally {
      setIsUploadingImg(false);
    }
  };

  const resetForNext = () => {
    // Deja categoria/subcategoria puestas: es comun cargar varias prendas
    // seguidas de la misma tanda.
    setForm((f) => ({ ...EMPTY_FORM, category: f.category, customCategory: f.customCategory, subcategory: f.subcategory, customSubcategory: f.customSubcategory, stock: f.stock }));
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
        image_url: form.imageUrl
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

        {/* Foto */}
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Foto</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {form.imageUrl && (
              <img src={form.imageUrl} alt="" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
            )}
            <label htmlFor="new-product-img" className="btn-secondary" style={{ cursor: isUploadingImg ? 'wait' : 'pointer', opacity: isUploadingImg ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {isUploadingImg ? <Loader2 size={14} className="spin" /> : <UploadCloud size={14} />}
              {isUploadingImg ? 'Subiendo...' : 'Subir Foto'}
            </label>
            <input id="new-product-img" type="file" accept="image/*" onChange={handleFileSelect} disabled={isUploadingImg} style={{ display: 'none' }} />
            <input type="text" className="form-input" placeholder="...o pegar una URL de imagen" value={form.imageUrl} onChange={update('imageUrl')} style={{ flex: 1, minWidth: '200px' }} />
          </div>
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
