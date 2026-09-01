'use client';

import { useState } from 'react';
import { Save, UploadCloud, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { compressImage } from '@/lib/compressImage';

export default function ImagesTab({ products, onUpdateImage }) {
  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Cambio de Imágenes de Productos</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          Subí una foto nueva desde tu computadora o celular — se comprime sola antes de guardarse, no hace falta editarla antes.
        </p>
      </div>

      <div className="products-grid">
        {products.map((p) => (
          <ProductImageCard key={p.id} product={p} onUpdateImage={onUpdateImage} />
        ))}
      </div>
    </div>
  );
}

function ProductImageCard({ product, onUpdateImage }) {
  const [urlInput, setUrlInput] = useState(product.image_url || '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo despues si hace falta
    if (!file || !supabase) return;

    setIsUploading(true);
    setErrorMsg('');
    setUploadInfo('');

    try {
      const originalKb = Math.round(file.size / 1024);
      const { blob, compressed } = await compressImage(file);
      const finalKb = Math.round(blob.size / 1024);

      const filePath = `admin-uploads/${product.id}-${Date.now()}.webp`;
      const { error: uploadErr } = await supabase.storage.from('Productos').upload(filePath, blob, {
        upsert: true,
        contentType: 'image/webp'
      });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('Productos').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      setUrlInput(publicUrl);
      onUpdateImage(product.id, publicUrl);
      setUploadInfo(compressed ? `Comprimida: ${originalKb} KB → ${finalKb} KB` : `Subida (${finalKb} KB)`);
    } catch (err) {
      setErrorMsg('No se pudo subir la foto: ' + (err.message || 'error desconocido'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="product-card" style={{ padding: '16px' }}>
      <img
        src={product.image_url}
        alt=""
        style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}
        onError={(e) => { e.target.src = '/logo.png'; }}
      />
      <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '10px' }}>{product.name}</h4>

      <label
        htmlFor={`upload-${product.id}`}
        className="btn-primary"
        style={{
          width: '100%',
          justifyContent: 'center',
          padding: '8px',
          fontSize: '0.8rem',
          cursor: isUploading ? 'wait' : 'pointer',
          opacity: isUploading ? 0.7 : 1,
          marginBottom: '8px'
        }}
      >
        {isUploading ? <Loader2 size={14} className="spin" /> : <UploadCloud size={14} />}
        {isUploading ? 'Subiendo y comprimiendo…' : 'Subir Foto Nueva'}
      </label>
      <input
        id={`upload-${product.id}`}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={isUploading}
        style={{ display: 'none' }}
      />

      {uploadInfo && (
        <p style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
          <CheckCircle2 size={13} /> {uploadInfo}
        </p>
      )}
      {errorMsg && (
        <p style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700, marginBottom: '8px' }}>{errorMsg}</p>
      )}

      <div className="form-group" style={{ marginBottom: '10px' }}>
        <label className="form-label">O pegar una URL de imagen ya existente:</label>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          className="form-input"
          style={{ fontSize: '0.8rem', padding: '6px 8px' }}
        />
      </div>

      <button
        onClick={() => onUpdateImage(product.id, urlInput)}
        className="btn-secondary"
        style={{ width: '100%', fontSize: '0.8rem' }}
      >
        <Save size={14} /> Guardar URL
      </button>
    </div>
  );
}
