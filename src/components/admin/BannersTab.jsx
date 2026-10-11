'use client';

import { useEffect, useRef, useState } from 'react';
import { Megaphone, Upload, Loader2, Save, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { compressImageWithThumb } from '@/lib/compressImage';
import { dataStore } from '@/lib/dataStore';
import PromoBanners from '@/components/PromoBanners';

// Editor de los 2 banners del home ("Promociones de la semana" y "Reventón
// del sábado"): imagen, titulo, texto, link opcional y si se muestran.
export default function BannersTab() {
  const [banners, setBanners] = useState(() => dataStore.getPromoBanners());
  const [uploadingId, setUploadingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(null); // { ok, msg }

  // Si los banners terminan de cargar de la base despues de abrir la pestaña,
  // se toman, pero solo mientras no se haya editado nada (el store avisa
  // seguido por el realtime de productos y pisaria lo que se esta editando).
  const dirtyRef = useRef(false);
  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      if (!dirtyRef.current) setBanners(dataStore.getPromoBanners());
    });
    return unsubscribe;
  }, []);

  const update = (id, field, value) => {
    dirtyRef.current = true;
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
    setStatus(null);
  };

  const handleUpload = async (id, file) => {
    if (!file || !supabase) return;
    setUploadingId(id);
    setStatus(null);
    try {
      const { full } = await compressImageWithThumb(file);
      const filePath = `admin-uploads/banner-${id}-${Date.now()}.webp`;
      const { error } = await supabase.storage.from('Productos').upload(filePath, full.blob, {
        upsert: true,
        contentType: 'image/webp',
        cacheControl: '31536000'
      });
      if (error) throw error;
      const { data } = supabase.storage.from('Productos').getPublicUrl(filePath);
      update(id, 'image_url', data.publicUrl);
      setStatus({ ok: true, msg: 'Imagen subida. Tocá "Guardar banners" para publicarla.' });
    } catch (err) {
      setStatus({ ok: false, msg: 'No se pudo subir la imagen: ' + (err.message || 'error desconocido') });
    } finally {
      setUploadingId(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const res = await dataStore.setPromoBanners(banners);
    setIsSaving(false);
    if (res.ok) dirtyRef.current = false;
    setStatus(res.ok
      ? { ok: true, msg: '✓ Banners publicados en la tienda.' }
      : { ok: false, msg: 'No se pudieron guardar. Revisá la conexión o volvé a iniciar sesión.' });
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Megaphone size={22} style={{ color: '#EC6FA6' }} /> Banners del Inicio
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Los 2 banners que se ven debajo de la foto del local. Cambiá la imagen, el título y el texto, y tocá “Guardar banners”.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', marginBottom: '20px' }}>
        {banners.map((b, i) => (
          <div key={b.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <strong style={{ fontSize: '0.95rem' }}>Banner {i + 1}</strong>
              <button
                type="button"
                onClick={() => update(b.id, 'active', !b.active)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '20px', cursor: 'pointer',
                  fontSize: '0.76rem', fontWeight: 800,
                  border: b.active ? '1px solid #A7F3D0' : '1px solid #FECACA',
                  backgroundColor: b.active ? '#ECFDF5' : '#FEF2F2',
                  color: b.active ? '#047857' : '#DC2626'
                }}
              >
                {b.active ? <Eye size={13} /> : <EyeOff size={13} />} {b.active ? 'Visible' : 'Oculto'}
              </button>
            </div>

            {/* Imagen */}
            <div style={{
              position: 'relative', height: '150px', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px',
              background: b.image_url ? `center / cover no-repeat url("${b.image_url}")` : 'linear-gradient(135deg, #EC6FA6, #A8175A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '0.8rem', fontWeight: 700
            }}>
              {!b.image_url && 'Sin imagen (se usa el fondo de color)'}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <label className="btn-secondary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', padding: '8px', fontSize: '0.82rem' }}>
                {uploadingId === b.id ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {uploadingId === b.id ? 'Subiendo...' : 'Subir imagen'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={uploadingId !== null}
                  onChange={(e) => { handleUpload(b.id, e.target.files?.[0]); e.target.value = ''; }}
                />
              </label>
              {b.image_url && (
                <button type="button" onClick={() => update(b.id, 'image_url', '')} className="btn-secondary" title="Quitar imagen" style={{ padding: '8px 10px' }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Título</label>
            <input
              type="text"
              value={b.title}
              maxLength={80}
              onChange={(e) => update(b.id, 'title', e.target.value)}
              className="form-input"
              style={{ width: '100%', marginBottom: '10px' }}
            />

            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Texto</label>
            <textarea
              value={b.text}
              maxLength={240}
              rows={3}
              onChange={(e) => update(b.id, 'text', e.target.value)}
              className="form-input"
              style={{ width: '100%', marginBottom: '10px', resize: 'vertical' }}
            />

            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Link al tocar el banner (opcional)
            </label>
            <input
              type="text"
              value={b.link}
              placeholder="Ej: /?categoria=Lencería  o  https://wa.me/549341..."
              onChange={(e) => update(b.id, 'link', e.target.value)}
              className="form-input"
              style={{ width: '100%' }}
            />
          </div>
        ))}
      </div>

      {status && (
        <div role="status" style={{
          marginBottom: '14px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
          backgroundColor: status.ok ? '#ECFDF5' : '#FEF2F2', color: status.ok ? '#047857' : '#B91C1C',
          border: `1px solid ${status.ok ? '#A7F3D0' : '#FECACA'}`
        }}>
          {status.msg}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || uploadingId !== null}
        className="btn-primary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', opacity: isSaving ? 0.7 : 1 }}
      >
        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar banners
      </button>

      <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '28px 0 0' }}>Vista previa</h3>
      <div style={{ marginLeft: '-24px', marginRight: '-24px' }}>
        <PromoBanners banners={banners} />
      </div>
    </div>
  );
}
