'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Loader2, ExternalLink, Pencil, Check, X } from 'lucide-react';
import { adminFetch } from '@/lib/adminFetch';

async function call(method, body, query = '') {
  const res = await adminFetch(`/api/ventas${query}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error.');
  return data;
}

// Alta / baja de vendedoras. Las activas aparecen en /ventas, donde se cargan
// sus ventas, comisiones y vales. Dar de baja no borra su historial.
export default function SellersTab() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // { id, name }
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await call('GET', null, '?list=sellers');
      setSellers(data.sellers || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      await call('POST', { action: 'addSeller', name });
      setName('');
      await load();
    } catch (err) {
      window.alert(err.message);
    }
    setAdding(false);
  };

  const rename = async () => {
    if (!editing?.name.trim()) return;
    setBusyId(editing.id);
    try {
      await call('POST', { action: 'rename', sellerId: editing.id, name: editing.name });
      setEditing(null);
      await load();
    } catch (err) {
      window.alert(err.message);
    }
    setBusyId(null);
  };

  const toggle = async (s) => {
    if (s.active && !window.confirm(`¿Dar de baja a ${s.name}? Su historial de ventas y vales se conserva.`)) return;
    setBusyId(s.id);
    try {
      await call('POST', { action: 'setActive', sellerId: s.id, active: !s.active });
      await load();
    } catch (err) {
      window.alert(err.message);
    }
    setBusyId(null);
  };

  const active = sellers.filter((s) => s.active).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={22} /> Vendedoras
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Las vendedoras activas aparecen en <strong>Ventas</strong>, donde se cargan sus ventas, el % de comisión y los vales.
          </p>
        </div>
        <a href="/ventas" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
          <ExternalLink size={15} /> Ir a Ventas
        </a>
      </div>

      <form onSubmit={add} style={{ display: 'flex', gap: '8px', maxWidth: '460px', marginBottom: '20px' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la vendedora" className="form-input" style={{ flex: 1 }} maxLength={80} />
        <button type="submit" disabled={adding || !name.trim()} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {adding ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Dar de alta
        </button>
      </form>

      {error && <div role="alert" style={{ color: '#B91C1C', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
      {loading ? <Loader2 className="animate-spin" /> : sellers.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Todavía no hay vendedoras cargadas.</p>
      ) : (
        <>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{active} activa{active === 1 ? '' : 's'} de {sellers.length}</p>
          <table className="admin-table" style={{ maxWidth: '640px' }}>
            <thead><tr><th>Nombre</th><th>Alta</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.id} style={{ opacity: s.active ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 700 }}>
                    {editing?.id === s.id ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="form-input" style={{ padding: '4px 6px' }} autoFocus maxLength={80}
                          onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setEditing(null); }} />
                        <button type="button" onClick={rename} className="btn-primary" style={{ padding: '4px 8px' }} aria-label="Guardar nombre"><Check size={14} /></button>
                        <button type="button" onClick={() => setEditing(null)} className="btn-secondary" style={{ padding: '4px 8px' }} aria-label="Cancelar"><X size={14} /></button>
                      </div>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {s.name}
                        <button type="button" onClick={() => setEditing({ id: s.id, name: s.name })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label={`Cambiar el nombre de ${s.name}`}><Pencil size={13} /></button>
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(s.created_at).toLocaleDateString('es-AR')}</td>
                  <td>
                    <button type="button" onClick={() => toggle(s)} disabled={busyId === s.id}
                      style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer', border: s.active ? '1px solid #A7F3D0' : '1px solid #FECACA', backgroundColor: s.active ? '#ECFDF5' : '#FEF2F2', color: s.active ? '#047857' : '#DC2626' }}>
                      {s.active ? '● Activa' : '○ Dada de baja'}
                    </button>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{s.active ? 'Tocá para dar de baja' : 'Tocá para volver a dar de alta'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
