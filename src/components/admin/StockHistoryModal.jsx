'use client';

import { useEffect, useState } from 'react';
import { X, History, Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const KIND_LABEL = {
  alta: { label: 'Alta del producto', color: '#1D4ED8' },
  carga: { label: 'Carga de mercadería', color: '#047857' },
  venta: { label: 'Venta', color: '#6D28D9' },
  devolucion: { label: 'Devolución / cancelación', color: '#0E7490' },
  baja_manual: { label: 'Baja manual', color: '#B45309' },
  correccion_tipeo: { label: 'Corrección de tipeo', color: '#9A3412' },
  correccion_cargado: { label: 'Corrección del cargado', color: '#B91C1C' }
};

const fmt = (n) => (n === null || n === undefined ? '—' : n);

// Historial de movimientos de stock de un producto (tabla stock_movements,
// la llena un trigger en cada cambio) + correccion manual del "Cargado".
export default function StockHistoryModal({ product, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [loadedValue, setLoadedValue] = useState(String(product.stock_loaded ?? ''));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const load = async () => {
    const { data, error: err } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (err) setError('No se pudo cargar el historial. ¿Sesión vencida?');
    else setRows(data || []);
  };

  useEffect(() => { load(); }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveLoaded = async () => {
    const value = parseInt(loadedValue, 10);
    if (!Number.isFinite(value) || value < 0) {
      setSaveMsg({ ok: false, text: 'Poné un número válido.' });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    const { error: err } = await supabase.rpc('correct_stock_loaded', {
      p_product_id: product.id,
      p_value: value,
      p_note: note.trim() || null
    });
    setSaving(false);
    if (err) {
      setSaveMsg({ ok: false, text: 'No se pudo guardar. ¿Sesión vencida?' });
      return;
    }
    setSaveMsg({ ok: true, text: 'Cargado corregido.' });
    setNote('');
    load();
  };

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="qty-btn" style={{ position: 'absolute', top: '14px', right: '14px' }}><X size={18} /></button>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <History size={20} /> Historial de stock
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          {product.name}{product.code ? ` (Cód: ${product.code})` : ''} — hoy: queda <strong>{product.stock}</strong>, cargado <strong>{fmt(product.stock_loaded)}</strong>, vendido por la web <strong>{product.sales_count || 0}</strong>.
        </p>

        {/* Correccion del cargado */}
        <div style={{ border: '1px dashed var(--border-color)', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>Corregir el “Cargado” (si quedó mal por un error de carga)</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="number" min="0" value={loadedValue} onChange={(e) => setLoadedValue(e.target.value)} className="form-input" style={{ width: '90px', fontWeight: 800 }} />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo (opcional)" className="form-input" style={{ flex: '1 1 180px' }} />
            <button type="button" onClick={saveLoaded} disabled={saving} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
            </button>
          </div>
          {saveMsg && <div style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: '6px', color: saveMsg.ok ? '#047857' : '#B91C1C' }}>{saveMsg.text}</div>}
        </div>

        <div style={{ overflowY: 'auto' }}>
          {error && <div role="alert" style={{ color: '#B91C1C', fontWeight: 600 }}>{error}</div>}
          {!rows && !error && <Loader2 className="animate-spin" />}
          {rows && rows.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Todavía no hay movimientos registrados (el historial empezó el 13/10/2026).
            </p>
          )}
          {rows && rows.length > 0 && (
            <table className="admin-table">
              <thead><tr><th>Fecha</th><th>Movimiento</th><th>Queda</th><th>Vendido</th><th>Cargado</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const k = KIND_LABEL[r.kind] || { label: r.kind, color: 'var(--text-main)' };
                  return (
                    <tr key={r.id}>
                      <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ fontSize: '0.8rem', fontWeight: 700, color: k.color }}>
                        {k.label}
                        {r.note && <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>{r.note}</div>}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{fmt(r.stock_before)} → <strong>{fmt(r.stock_after)}</strong></td>
                      <td style={{ fontSize: '0.8rem' }}>{fmt(r.sales_before)} → {fmt(r.sales_after)}</td>
                      <td style={{ fontSize: '0.8rem' }}>{fmt(r.loaded_before)} → <strong>{fmt(r.loaded_after)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
