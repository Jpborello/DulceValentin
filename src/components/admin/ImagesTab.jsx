'use client';

import { useState } from 'react';
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, Star, Trash2, ArrowLeft, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { compressImageWithThumb } from '@/lib/compressImage';
import { getProductImages } from '@/lib/dataStore';

export default function ImagesTab({ products, onUpdateImage }) {
  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ImageIcon size={22} style={{ color: 'var(--accent-gold)' }} /> Gestión de Imágenes de Productos
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          Cada producto puede tener múltiples fotos. Podés subir varias imágenes juntas (se convierten a <strong>.webp</strong> automáticamente), reordenarlas o elegir cuál es la foto principal de portada.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {products.map((p) => (
          <ProductImageRow key={p.id} product={p} onUpdateImage={onUpdateImage} />
        ))}
      </div>
    </div>
  );
}

function ProductImageRow({ product, onUpdateImage }) {
  const currentImages = getProductImages(product).filter((u) => u && u !== '/logo.png');
  const [images, setImages] = useState(currentImages.length > 0 ? currentImages : (product.image_url && product.image_url !== '/logo.png' ? [product.image_url] : []));
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const syncImages = (newImagesList, notice) => {
    setImages(newImagesList);
    onUpdateImage(product.id, newImagesList);
    if (notice) {
      setSuccessNotice(notice);
      setTimeout(() => setSuccessNotice(''), 3000);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0 || !supabase) return;

    setIsUploading(true);
    setErrorMsg('');
    setSuccessNotice('');
    setUploadStatus(`Preparando ${files.length} foto${files.length > 1 ? 's' : ''}...`);

    try {
      const newUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStatus(`Comprimiendo y subiendo ${i + 1} de ${files.length}...`);
        
        const { full, thumb } = await compressImageWithThumb(file);
        const filePath = `admin-uploads/${product.id || 'prod'}-${Date.now()}-${i}.webp`;
        const { error: uploadErr } = await supabase.storage.from('Productos').upload(filePath, full.blob, {
          upsert: true,
          contentType: 'image/webp'
        });
        if (uploadErr) throw uploadErr;

        // Miniatura para la grilla: mismo nombre + "-thumb" (convencion que
        // usa getThumbUrl para encontrarla desde el lado del sitio). Si esta
        // subida puntual falla no se corta el alta de la foto -- la tarjeta
        // igual muestra la foto completa como respaldo.
        if (thumb?.blob) {
          const thumbPath = filePath.replace(/\.webp$/, '-thumb.webp');
          await supabase.storage.from('Productos').upload(thumbPath, thumb.blob, {
            upsert: true,
            contentType: 'image/webp'
          }).catch(() => {});
        }

        const { data: urlData } = supabase.storage.from('Productos').getPublicUrl(filePath);
        if (urlData?.publicUrl) {
          newUrls.push(urlData.publicUrl);
        }
      }

      const updated = [...images, ...newUrls];
      syncImages(updated, `${newUrls.length} foto${newUrls.length > 1 ? 's' : ''} subida${newUrls.length > 1 ? 's' : ''} en formato WebP`);
    } catch (err) {
      setErrorMsg('No se pudieron subir las fotos: ' + (err.message || 'error desconocido'));
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const handleAddManualUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (images.includes(trimmed)) {
      setErrorMsg('Esa URL ya está en la lista de este producto.');
      return;
    }
    const updated = [...images, trimmed];
    setUrlInput('');
    syncImages(updated, 'Imagen agregada a la lista');
  };

  const handleRemoveImage = (indexToRemove) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove);
    syncImages(updated, 'Foto eliminada');
  };

  const handleSetCover = (indexToCover) => {
    if (indexToCover === 0) return;
    const copy = [...images];
    const [item] = copy.splice(indexToCover, 1);
    const updated = [item, ...copy];
    syncImages(updated, 'Nueva foto de portada establecida');
  };

  const handleMove = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    const copy = [...images];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    syncImages(copy, 'Orden actualizado');
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px'
    }}>
      {/* Header del producto */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {product.code && (
              <span style={{ fontSize: '0.75rem', fontWeight: 800, backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', padding: '2px 7px', borderRadius: '4px' }}>
                {product.code}
              </span>
            )}
            <h4 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, color: 'var(--text-main)' }}>{product.name}</h4>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            {product.category} {product.subcategory ? `• ${product.subcategory}` : ''} — {images.length} {images.length === 1 ? 'foto' : 'fotos'}
          </p>
        </div>

        {/* Acciones de subida */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label
            htmlFor={`upload-more-${product.id}`}
            className="btn-primary"
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              cursor: isUploading ? 'wait' : 'pointer',
              opacity: isUploading ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isUploading ? <Loader2 size={14} className="spin" /> : <UploadCloud size={14} />}
            {isUploading ? (uploadStatus || 'Subiendo...') : '+ Subir Fotos (WebP)'}
          </label>
          <input
            id={`upload-more-${product.id}`}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            disabled={isUploading}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              type="text"
              placeholder="O pegar URL..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddManualUrl(); } }}
              className="form-input"
              style={{ fontSize: '0.8rem', padding: '6px 8px', width: '160px' }}
            />
            <button
              type="button"
              onClick={handleAddManualUrl}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 10px' }}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Avisos */}
      {successNotice && (
        <p style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
          <CheckCircle2 size={14} /> {successNotice}
        </p>
      )}
      {errorMsg && (
        <p style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
          <AlertCircle size={14} /> {errorMsg}
        </p>
      )}

      {/* Carrusel/tira de fotos actuales */}
      {images.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '12px',
          padding: '10px',
          backgroundColor: 'var(--bg-surface-elevated)',
          borderRadius: '10px',
          border: '1px solid var(--border-color)'
        }}>
          {images.map((url, idx) => {
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
                <div style={{ position: 'relative', width: '100%', height: '110px' }}>
                  <img
                    src={url}
                    alt={`Foto ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.src = '/logo.png'; }}
                  />
                  {isCover && (
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      left: '5px',
                      backgroundColor: 'var(--accent-gold)',
                      color: '#000',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
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
                      top: '5px',
                      right: '5px',
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

                <div style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', backgroundColor: 'var(--bg-card)' }}>
                  {!isCover ? (
                    <button
                      type="button"
                      onClick={() => handleSetCover(idx)}
                      className="btn-secondary"
                      style={{ fontSize: '0.68rem', padding: '3px 6px', flex: 1, justifyContent: 'center', gap: '3px' }}
                      title="Fijar como foto principal de portada"
                    >
                      <Star size={10} /> Portada
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
                        onClick={() => handleMove(idx, idx - 1)}
                        title="Mover a la izquierda"
                        style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 4px', cursor: 'pointer', display: 'flex', color: 'var(--text-main)' }}
                      >
                        <ArrowLeft size={11} />
                      </button>
                    )}
                    {idx < images.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMove(idx, idx + 1)}
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
          padding: '16px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-surface-elevated)',
          borderRadius: '8px',
          border: '1px dashed var(--border-color)',
          color: 'var(--text-muted)',
          fontSize: '0.82rem'
        }}>
          Sin fotos cargadas. Hacé click en "+ Subir Fotos" para agregar imágenes a este artículo.
        </div>
      )}
    </div>
  );
}
