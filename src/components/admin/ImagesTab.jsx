'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  UploadCloud, Loader2, CheckCircle2, AlertCircle, Star, Trash2, ArrowLeft, ArrowRight,
  Image as ImageIcon, Search, Link2, Maximize2, ImageOff
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { compressImageWithThumb } from '@/lib/compressImage';
import { getProductImages, getThumbUrl } from '@/lib/dataStore';
import ImageLightbox from '@/components/admin/ImageLightbox';
import SafeImg from '@/components/admin/SafeImg';

const normStr = (str) =>
  (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const realImagesOf = (product) =>
  getProductImages(product).filter((u) => u && u !== '/logo.png');

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'none', label: 'Sin fotos' },
  { id: 'one', label: '1 foto' },
  { id: 'many', label: 'Varias fotos' }
];

/**
 * Gestión de imágenes: grilla de tarjetas (varias por fila) en vez de una
 * fila ancha por producto. Cada tarjeta muestra la foto elegida en grande,
 * la tira de todas sus fotos y las acciones sobre la foto seleccionada.
 * Arriba hay buscador y filtros para encontrar rápido los productos sin foto.
 */
const MAIN_CATEGORIES = [
  { id: 'calzado', name: 'Calzado', defaultImg: '/categorias/calzado.webp', desc: 'Zapatillas y calzado familiar' },
  { id: 'indumentaria', name: 'Indumentaria', defaultImg: '/categorias/indumentaria.webp', desc: 'Hombre, Mujer e Infantil' },
  { id: 'lenceria', name: 'Lencería', defaultImg: '/categorias/lenceria.webp', desc: 'Ropa interior, medias y lencería' },
  { id: 'bebes', name: 'Bebés', defaultImg: '/categorias/bebes.webp', desc: 'Recién nacidos y primera infancia' }
];

export default function ImagesTab({ products, onUpdateImage, categoryImages = {}, onUpdateCategoryImage }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [activeCategoryUpload, setActiveCategoryUpload] = useState(null);
  const [categoryUrlInputs, setCategoryUrlInputs] = useState({});
  const [categoryStatusMsg, setCategoryStatusMsg] = useState({});

  const handleCategoryFileUpload = async (groupId, file) => {
    if (!file || !onUpdateCategoryImage || !supabase) return;
    setActiveCategoryUpload(groupId);
    setCategoryStatusMsg((prev) => ({ ...prev, [groupId]: 'Comprimiendo y subiendo foto...' }));

    try {
      const { full } = await compressImageWithThumb(file);
      const filePath = `admin-uploads/categoria-${groupId}-${Date.now()}.webp`;

      const { error: uploadErr } = await supabase.storage.from('Productos').upload(filePath, full.blob, {
        upsert: true,
        contentType: 'image/webp',
        cacheControl: '31536000'
      });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('Productos').getPublicUrl(filePath);
      if (urlData?.publicUrl) {
        await onUpdateCategoryImage(groupId, urlData.publicUrl);
        setCategoryStatusMsg((prev) => ({ ...prev, [groupId]: '✓ ¡Imagen actualizada!' }));
        setTimeout(() => setCategoryStatusMsg((prev) => ({ ...prev, [groupId]: '' })), 3000);
      }
    } catch (err) {
      setCategoryStatusMsg((prev) => ({ ...prev, [groupId]: 'Error: ' + (err.message || 'desconocido') }));
    } finally {
      setActiveCategoryUpload(null);
    }
  };

  const handleCategoryUrlSave = async (groupId) => {
    const url = (categoryUrlInputs[groupId] || '').trim();
    if (!url || !onUpdateCategoryImage) return;
    setActiveCategoryUpload(groupId);
    try {
      await onUpdateCategoryImage(groupId, url);
      setCategoryUrlInputs((prev) => ({ ...prev, [groupId]: '' }));
      setCategoryStatusMsg((prev) => ({ ...prev, [groupId]: '✓ ¡Imagen actualizada!' }));
      setTimeout(() => setCategoryStatusMsg((prev) => ({ ...prev, [groupId]: '' })), 3000);
    } catch (err) {
      setCategoryStatusMsg((prev) => ({ ...prev, [groupId]: 'Error al guardar URL' }));
    } finally {
      setActiveCategoryUpload(null);
    }
  };

  const handleCategoryReset = async (groupId, defaultImg) => {
    if (!onUpdateCategoryImage) return;
    if (!confirm(`¿Restablecer la portada de ${groupId} a la imagen original?`)) return;
    await onUpdateCategoryImage(groupId, defaultImg);
    setCategoryStatusMsg((prev) => ({ ...prev, [groupId]: '✓ Restablecida al original' }));
    setTimeout(() => setCategoryStatusMsg((prev) => ({ ...prev, [groupId]: '' })), 3000);
  };

  const counts = useMemo(() => {
    const c = { all: products.length, none: 0, one: 0, many: 0 };
    products.forEach((p) => {
      const n = realImagesOf(p).length;
      if (n === 0) c.none += 1;
      else if (n === 1) c.one += 1;
      else c.many += 1;
    });
    return c;
  }, [products]);

  const visible = useMemo(() => {
    const q = normStr(query);
    return products.filter((p) => {
      if (q && !normStr(`${p.name} ${p.code || ''} ${p.category || ''} ${p.subcategory || ''}`).includes(q)) return false;
      const n = realImagesOf(p).length;
      if (filter === 'none') return n === 0;
      if (filter === 'one') return n === 1;
      if (filter === 'many') return n > 1;
      return true;
    });
  }, [products, query, filter]);

  return (
    <div>
      {/* SECCIÓN 1: FOTOS DE LAS 4 CATEGORÍAS PRINCIPALES DEL HOME */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        padding: '20px',
        marginBottom: '28px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '3px 10px', borderRadius: '14px', fontSize: '0.74rem', fontWeight: 800, marginBottom: '6px' }}>
            HOME / PÁGINA PRINCIPAL
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ImageIcon size={20} style={{ color: 'var(--accent-gold)' }} />
            Portadas de las 4 Categorías Principales del Home
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
            Cambiá las fotos que se ven en las tarjetas de la página principal (Calzado, Indumentaria, Lencería y Bebés). Podés subir una foto nueva desde tu computadora o pegar un enlace.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}>
          {MAIN_CATEGORIES.map((cat) => {
            const currentImg = categoryImages[cat.id] || cat.defaultImg;
            const isCustom = categoryImages[cat.id] && categoryImages[cat.id] !== cat.defaultImg;
            const isUploading = activeCategoryUpload === cat.id;
            const status = categoryStatusMsg[cat.id];
            const urlInput = categoryUrlInputs[cat.id] || '';

            return (
              <div
                key={cat.id}
                style={{
                  border: isCustom ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ position: 'relative', width: '100%', height: '170px', backgroundColor: '#000' }}>
                  <img
                    src={currentImg}
                    alt={cat.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {isCustom ? (
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      backgroundColor: 'var(--accent-gold)',
                      color: '#000',
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      PERSONALIZADA
                    </span>
                  ) : (
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      color: '#FFF',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      ORIGINAL
                    </span>
                  )}
                </div>

                <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ margin: '0 0 2px 0', fontSize: '1.05rem', fontWeight: 800 }}>{cat.name}</h4>
                    <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>{cat.desc}</p>
                  </div>

                  {status && (
                    <div style={{
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      backgroundColor: status.startsWith('Error') ? '#FEE2E2' : '#DCFCE7',
                      color: status.startsWith('Error') ? '#991B1B' : '#166534'
                    }}>
                      {status}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Botón Subir Foto */}
                    <label
                      htmlFor={`cat-file-${cat.id}`}
                      className="btn-primary"
                      style={{
                        cursor: isUploading ? 'wait' : 'pointer',
                        padding: '7px 12px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        opacity: isUploading ? 0.7 : 1
                      }}
                    >
                      {isUploading ? <Loader2 size={14} className="spin" /> : <UploadCloud size={14} />}
                      {isUploading ? 'Subiendo foto...' : 'Subir Nueva Foto'}
                    </label>
                    <input
                      id={`cat-file-${cat.id}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCategoryFileUpload(cat.id, file);
                        e.target.value = '';
                      }}
                      disabled={isUploading}
                      style={{ display: 'none' }}
                    />

                    {/* Pegar URL externa */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="text"
                        placeholder="...o pegar URL"
                        value={urlInput}
                        onChange={(e) => setCategoryUrlInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCategoryUrlSave(cat.id);
                          }
                        }}
                        className="form-input"
                        style={{ flex: 1, padding: '4px 6px', fontSize: '0.75rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleCategoryUrlSave(cat.id)}
                        disabled={!urlInput.trim() || isUploading}
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 700 }}
                      >
                        OK
                      </button>
                    </div>

                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => handleCategoryReset(cat.id, cat.defaultImg)}
                        className="btn-secondary"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.72rem',
                          color: '#DC2626',
                          borderColor: '#FCA5A5',
                          backgroundColor: '#FFF'
                        }}
                      >
                        Restablecer Original
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN 2: GESTIÓN DE FOTOS DE PRODUCTOS */}
      <div className="imgm-head">
        <div>
          <h2 className="imgm-title">
            <ImageIcon size={22} style={{ color: 'var(--accent-gold)' }} aria-hidden="true" /> Gestión de Imágenes de Productos
          </h2>
          <p className="imgm-sub">
            Subí varias fotos juntas o arrastralas sobre la tarjeta (se convierten a <strong>.webp</strong> solas).
            Tocá una miniatura para elegirla y usá los botones para hacerla portada, moverla o borrarla.
          </p>
        </div>
      </div>

      <div className="imgm-toolbar">
        <label className="imgm-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, código o categoría"
            aria-label="Buscar producto"
          />
        </label>
        <div className="imgm-filters" role="group" aria-label="Filtrar por cantidad de fotos">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`imgm-chip ${filter === f.id ? 'is-active' : ''} ${f.id === 'none' && counts.none > 0 ? 'is-warn' : ''}`}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
            >
              {f.label} <span className="imgm-chip-count">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="imgm-empty">No hay productos que coincidan con la búsqueda.</div>
      ) : (
        <div className="imgm-grid">
          {visible.map((p) => (
            <ProductImageCard key={p.id} product={p} onUpdateImage={onUpdateImage} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductImageCard({ product, onUpdateImage }) {
  const initial = realImagesOf(product);
  const [images, setImages] = useState(initial);

  useEffect(() => {
    setImages(realImagesOf(product));
  }, [product.image_urls, product.image_url]);

  const [selected, setSelected] = useState(0);
  const [urlInput, setUrlInput] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const inputId = `upload-more-${product.id}`;
  const sel = Math.min(selected, Math.max(images.length - 1, 0));

  const syncImages = (newImagesList, notice, newSelected = sel) => {
    setImages(newImagesList);
    setSelected(Math.min(Math.max(newSelected, 0), Math.max(newImagesList.length - 1, 0)));
    onUpdateImage(product.id, newImagesList);
    setErrorMsg('');
    if (notice) {
      setSuccessNotice(notice);
      setTimeout(() => setSuccessNotice(''), 3000);
    }
  };

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0 || !supabase || isUploading) return;

    setIsUploading(true);
    setErrorMsg('');
    setSuccessNotice('');
    setUploadStatus(`Preparando ${files.length} foto${files.length > 1 ? 's' : ''}...`);

    try {
      const newUrls = [];
      for (let i = 0; i < files.length; i++) {
        setUploadStatus(`Subiendo ${i + 1} de ${files.length}...`);
        const { full, thumb } = await compressImageWithThumb(files[i]);
        const filePath = `admin-uploads/${product.id || 'prod'}-${Date.now()}-${i}.webp`;
        const { error: uploadErr } = await supabase.storage.from('Productos').upload(filePath, full.blob, {
          upsert: true,
          contentType: 'image/webp',
          // Cada subida usa un nombre nuevo, asi que el navegador la puede
          // cachear un año (lo que pide Lighthouse).
          cacheControl: '31536000'
        });
        if (uploadErr) throw uploadErr;

        // Miniatura con el mismo nombre + "-thumb" (convencion de getThumbUrl).
        if (thumb?.blob) {
          const thumbPath = filePath.replace(/\.webp$/, '-thumb.webp');
          await supabase.storage.from('Productos').upload(thumbPath, thumb.blob, {
            upsert: true,
            contentType: 'image/webp',
            cacheControl: '31536000'
          }).catch(() => {});
        }

        const { data: urlData } = supabase.storage.from('Productos').getPublicUrl(filePath);
        if (urlData?.publicUrl) newUrls.push(urlData.publicUrl);
      }

      const updated = [...images, ...newUrls];
      syncImages(
        updated,
        `${newUrls.length} foto${newUrls.length > 1 ? 's' : ''} subida${newUrls.length > 1 ? 's' : ''}`,
        images.length
      );
    } catch (err) {
      setErrorMsg('No se pudieron subir las fotos: ' + (err.message || 'error desconocido'));
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    uploadFiles(files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    uploadFiles(e.dataTransfer?.files);
  };

  const handleAddManualUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      setErrorMsg('La URL tiene que empezar con http:// o https://');
      return;
    }
    if (images.includes(trimmed)) {
      setErrorMsg('Esa URL ya está en la lista de este producto.');
      return;
    }
    setUrlInput('');
    setShowUrl(false);
    syncImages([...images, trimmed], 'Imagen agregada', images.length);
  };

  const handleRemove = () => {
    if (images.length === 0) return;
    if (!window.confirm('¿Quitar esta foto del producto?')) return;
    syncImages(images.filter((_, idx) => idx !== sel), 'Foto eliminada', sel - 1);
  };

  const handleSetCover = () => {
    if (sel === 0) return;
    const copy = [...images];
    const [item] = copy.splice(sel, 1);
    syncImages([item, ...copy], 'Nueva portada', 0);
  };

  const handleMove = (dir) => {
    const to = sel + dir;
    if (to < 0 || to >= images.length) return;
    const copy = [...images];
    const [moved] = copy.splice(sel, 1);
    copy.splice(to, 0, moved);
    syncImages(copy, 'Orden actualizado', to);
  };

  const preview = images[sel];

  return (
    <article
      className={`imgm-card ${isDragging ? 'is-dragging' : ''} ${images.length === 0 ? 'is-empty' : ''}`}
      onDragOver={(e) => { e.preventDefault(); if (!isDragging) setIsDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
      onDrop={handleDrop}
    >
      <header className="imgm-card-head">
        <div className="imgm-card-meta">
          {product.code && <span className="imgm-code">{product.code}</span>}
          <span className="imgm-count">{images.length} {images.length === 1 ? 'foto' : 'fotos'}</span>
        </div>
        <h3 className="imgm-name" title={product.name}>{product.name}</h3>
        <p className="imgm-cat">{product.category}{product.subcategory ? ` · ${product.subcategory}` : ''}</p>
      </header>

      {preview ? (
        <button
          type="button"
          className="imgm-preview"
          onClick={() => setLightboxIndex(sel)}
          aria-label={`Ampliar foto ${sel + 1} de ${product.name}`}
        >
          <SafeImg
            src={getThumbUrl(preview) || preview}
            fallbacks={[preview, '/logo.png']}
            alt=""
            loading="lazy"
          />
          {sel === 0 && <span className="imgm-cover-badge"><Star size={11} fill="currentColor" aria-hidden="true" /> Portada</span>}
          <span className="imgm-zoom" aria-hidden="true"><Maximize2 size={15} /></span>
        </button>
      ) : (
        <label htmlFor={inputId} className="imgm-preview imgm-preview--empty">
          <ImageOff size={30} aria-hidden="true" />
          <span>Sin fotos</span>
          <small>Arrastrá fotos acá o tocá para subir</small>
        </label>
      )}

      {images.length > 0 && (
        <div className="imgm-strip" role="listbox" aria-label="Fotos del producto">
          {images.map((url, idx) => (
            <button
              key={`${url}-${idx}`}
              type="button"
              role="option"
              aria-selected={idx === sel}
              className={`imgm-thumb ${idx === sel ? 'is-selected' : ''}`}
              onClick={() => setSelected(idx)}
              onDoubleClick={() => setLightboxIndex(idx)}
              title={idx === 0 ? 'Portada' : `Foto ${idx + 1}`}
            >
              <SafeImg
                src={getThumbUrl(url) || url}
                fallbacks={[url, '/logo.png']}
                alt={`Foto ${idx + 1}`}
                loading="lazy"
              />
              {idx === 0 && <span className="imgm-thumb-star" aria-hidden="true"><Star size={9} fill="currentColor" /></span>}
            </button>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="imgm-actions" aria-label="Acciones sobre la foto seleccionada">
          <button type="button" className="imgm-act" onClick={handleSetCover} disabled={sel === 0} title="Hacer portada">
            <Star size={14} aria-hidden="true" /> <span>Portada</span>
          </button>
          <button type="button" className="imgm-act imgm-act--icon" onClick={() => handleMove(-1)} disabled={sel === 0} aria-label="Mover a la izquierda" title="Mover a la izquierda">
            <ArrowLeft size={14} aria-hidden="true" />
          </button>
          <button type="button" className="imgm-act imgm-act--icon" onClick={() => handleMove(1)} disabled={sel >= images.length - 1} aria-label="Mover a la derecha" title="Mover a la derecha">
            <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button type="button" className="imgm-act imgm-act--icon imgm-act--danger" onClick={handleRemove} aria-label="Eliminar foto seleccionada" title="Eliminar foto">
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {(successNotice || errorMsg) && (
        <p className={`imgm-notice ${errorMsg ? 'is-error' : ''}`} role="status">
          {errorMsg ? <AlertCircle size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
          {errorMsg || successNotice}
        </p>
      )}

      <footer className="imgm-foot">
        <label htmlFor={inputId} className={`imgm-upload ${isUploading ? 'is-busy' : ''}`}>
          {isUploading ? <Loader2 size={15} className="spin" aria-hidden="true" /> : <UploadCloud size={15} aria-hidden="true" />}
          {isUploading ? (uploadStatus || 'Subiendo...') : 'Subir fotos'}
        </label>
        <input id={inputId} type="file" accept="image/*" multiple onChange={handleFileSelect} disabled={isUploading} hidden />
        <button
          type="button"
          className={`imgm-act imgm-act--icon ${showUrl ? 'is-on' : ''}`}
          onClick={() => setShowUrl((v) => !v)}
          aria-label="Agregar foto desde una URL"
          aria-expanded={showUrl}
          title="Agregar desde URL"
        >
          <Link2 size={15} aria-hidden="true" />
        </button>
      </footer>

      {showUrl && (
        <div className="imgm-url">
          <input
            type="url"
            placeholder="https://..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddManualUrl(); } }}
            aria-label="URL de la imagen"
          />
          <button type="button" className="imgm-act" onClick={handleAddManualUrl}>Agregar</button>
        </div>
      )}

      {isDragging && <div className="imgm-drop" aria-hidden="true"><UploadCloud size={28} /> Soltá las fotos para subirlas</div>}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          startIndex={lightboxIndex}
          title={product.name}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </article>
  );
}
