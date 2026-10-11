'use client';

import { useEffect, useMemo, useState } from 'react';
import { NotebookPen, Search, Save, Loader2, MessageCircle, Check } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getThumbUrl } from '@/lib/dataStore';

const norm = (str) => String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Telefono argentino para wa.me: 10 digitos (341xxxxxxx) -> 549341xxxxxxx.
const waNumber = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `549${digits}`;
  if (digits.startsWith('54')) return digits;
  return digits;
};

const waLink = (row, product) => {
  const number = waNumber(row.supplier_phone);
  if (!number) return null;
  const name = String(row.supplier_name || '').trim();
  const text = `¡Hola${name ? ` ${name}` : ''}! Te escribo de Dulce Valentín por "${product.name}"${product.code ? ` (cód. ${product.code})` : ''}. ¿Tenés disponibilidad para reponer?`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};

// Anotador de proveedores: para cada producto, de quien es, su telefono y
// notas, con un boton que abre WhatsApp con el mensaje ya armado. Los datos
// viven en product_suppliers (solo el admin los puede ver).
export default function SuppliersTab({ products = [] }) {
  const [rows, setRows] = useState({}); // { [product_id]: { supplier_name, supplier_phone, notes } }
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [rowError, setRowError] = useState({});
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) return;
      const { data, error } = await supabase.from('product_suppliers').select('*');
      if (cancelled) return;
      if (error) setLoadError('No se pudieron cargar los proveedores. Volvé a iniciar sesión.');
      else {
        const map = {};
        (data || []).forEach((r) => { map[r.product_id] = r; });
        setRows(map);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Proveedores ya cargados (para autocompletar el telefono al elegir uno).
  const knownSuppliers = useMemo(() => {
    const map = new Map();
    Object.values(rows).forEach((r) => {
      const name = String(r.supplier_name || '').trim();
      if (name && !map.has(norm(name))) map.set(norm(name), { name, phone: r.supplier_phone || '' });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const valueOf = (productId) => ({
    supplier_name: '',
    supplier_phone: '',
    notes: '',
    ...(rows[productId] || {}),
    ...(drafts[productId] || {})
  });

  const isDirty = (productId) => {
    const d = drafts[productId];
    if (!d) return false;
    const saved = rows[productId] || {};
    return ['supplier_name', 'supplier_phone', 'notes'].some((k) => d[k] !== undefined && (d[k] || '') !== (saved[k] || ''));
  };

  const setField = (productId, field, value) => {
    setDrafts((prev) => {
      const next = { ...(prev[productId] || {}), [field]: value };
      // Si eligen un proveedor ya conocido y no hay telefono, se completa solo.
      if (field === 'supplier_name') {
        const known = knownSuppliers.find((s) => norm(s.name) === norm(value));
        const currentPhone = next.supplier_phone ?? rows[productId]?.supplier_phone ?? '';
        if (known && !currentPhone) next.supplier_phone = known.phone;
      }
      return { ...prev, [productId]: next };
    });
    setSavedId(null);
  };

  const handleSave = async (productId) => {
    const v = valueOf(productId);
    setSavingId(productId);
    setRowError((prev) => ({ ...prev, [productId]: '' }));
    const payload = {
      product_id: productId,
      supplier_name: v.supplier_name.trim() || null,
      supplier_phone: v.supplier_phone.trim() || null,
      notes: v.notes.trim() || null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('product_suppliers').upsert(payload).select().maybeSingle();
    setSavingId(null);
    if (error || !data) {
      setRowError((prev) => ({ ...prev, [productId]: 'No se pudo guardar. ¿Sesión vencida?' }));
      return;
    }
    setRows((prev) => ({ ...prev, [productId]: data }));
    setDrafts((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
    setSavedId(productId);
    setTimeout(() => setSavedId((cur) => (cur === productId ? null : cur)), 2500);
  };

  const filtered = useMemo(() => {
    const q = norm(search);
    return products.filter((p) => {
      const r = rows[p.id] || {};
      if (onlyMissing && (r.supplier_name || r.supplier_phone)) return false;
      if (supplierFilter && norm(r.supplier_name) !== norm(supplierFilter)) return false;
      if (!q) return true;
      return norm(p.name).includes(q) || norm(p.code).includes(q) || norm(r.supplier_name).includes(q);
    });
  }, [products, rows, search, supplierFilter, onlyMissing]);

  const visible = filtered.slice(0, 150);
  const withSupplier = products.filter((p) => rows[p.id]?.supplier_name || rows[p.id]?.supplier_phone).length;

  return (
    <div>
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NotebookPen size={22} style={{ color: '#7C3AED' }} /> Anotador de Proveedores
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Anotá de qué proveedor es cada artículo y su teléfono. Con el botón de WhatsApp le escribís con el mensaje ya armado. Solo lo ve el admin.
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por artículo, código o proveedor..."
            className="form-input"
            style={{ width: '100%', paddingLeft: '32px' }}
          />
        </div>
        <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="form-input" style={{ flex: '0 1 220px' }}>
          <option value="">Todos los proveedores</option>
          {knownSuppliers.map((s) => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOnlyMissing((v) => !v)}
          style={{
            padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', cursor: 'pointer',
            border: `1px solid ${onlyMissing ? '#7C3AED' : 'var(--border-color)'}`,
            backgroundColor: onlyMissing ? '#F5F3FF' : 'var(--bg-card)',
            color: onlyMissing ? '#6D28D9' : 'var(--text-main)'
          }}
        >
          Sin proveedor ({products.length - withSupplier})
        </button>
      </div>

      {loadError && (
        <div role="alert" style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', marginBottom: '12px', fontWeight: 600 }}>
          {loadError}
        </div>
      )}

      <datalist id="dv-known-suppliers">
        {knownSuppliers.map((s) => <option key={s.name} value={s.name} />)}
      </datalist>

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={20} className="animate-spin" /> Cargando...
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Artículo</th>
              <th>Proveedor</th>
              <th>Teléfono</th>
              <th>Notas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const v = valueOf(p.id);
              const link = waLink(v, p);
              const dirty = isDirty(p.id);
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px' }}>
                      <img
                        src={getThumbUrl(p.image_url) || p.image_url || '/logo.png'}
                        alt=""
                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                        onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {p.code ? `Cód: ${p.code} · ` : ''}Queda: {p.stock}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      list="dv-known-suppliers"
                      value={v.supplier_name}
                      onChange={(e) => setField(p.id, 'supplier_name', e.target.value)}
                      placeholder="Nombre del proveedor"
                      className="form-input"
                      style={{ width: '170px', padding: '6px 8px', fontSize: '0.84rem' }}
                    />
                  </td>
                  <td>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={v.supplier_phone}
                      onChange={(e) => setField(p.id, 'supplier_phone', e.target.value)}
                      placeholder="Ej: 3411234567"
                      className="form-input"
                      style={{ width: '140px', padding: '6px 8px', fontSize: '0.84rem' }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={v.notes}
                      onChange={(e) => setField(p.id, 'notes', e.target.value)}
                      placeholder="Precio de costo, demora, etc."
                      className="form-input"
                      style={{ width: '200px', padding: '6px 8px', fontSize: '0.84rem' }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleSave(p.id)}
                        disabled={!dirty || savingId === p.id}
                        className="btn-primary"
                        title="Guardar"
                        style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: dirty ? 1 : 0.45 }}
                      >
                        {savingId === p.id ? <Loader2 size={14} className="animate-spin" /> : savedId === p.id ? <Check size={14} /> : <Save size={14} />}
                        {savedId === p.id ? 'Guardado' : 'Guardar'}
                      </button>
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Escribirle al proveedor por WhatsApp"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', backgroundColor: '#25D366', color: '#FFFFFF', fontSize: '0.78rem', fontWeight: 800, textDecoration: 'none' }}
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                      ) : (
                        <span title="Cargá el teléfono del proveedor" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 }}>
                          <MessageCircle size={14} /> WhatsApp
                        </span>
                      )}
                    </div>
                    {rowError[p.id] && <div style={{ fontSize: '0.72rem', color: '#B91C1C', marginTop: '4px', fontWeight: 600 }}>{rowError[p.id]}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!loading && filtered.length > visible.length && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>
          Mostrando {visible.length} de {filtered.length}. Usá la búsqueda para encontrar el resto.
        </p>
      )}
    </div>
  );
}
