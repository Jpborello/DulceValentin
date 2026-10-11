'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, Loader2, Save, KeyRound, ExternalLink, RefreshCw } from 'lucide-react';
import { adminFetch } from '@/lib/adminFetch';

const ROLE_LABEL = { admin: 'Admin', cajera: 'Caja', vendedora: 'Vendedora' };
const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia / MP' };
const money = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const todayAR = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10);
const firstOfMonthAR = () => `${todayAR().slice(0, 8)}01`;

async function call(path, options = {}) {
  const res = await adminFetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error.');
  return data;
}

// Personal del local (vendedoras, caja, admins) y reporte de comisiones de
// las ventas del local. Las vendedoras y la caja trabajan en /caja.
export default function StaffTab() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'vendedora', commission_pct: '5' });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState(null);
  const [edits, setEdits] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [from, setFrom] = useState(firstOfMonthAR());
  const [to, setTo] = useState(todayAR());
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await call('/api/admin/staff');
      setStaff(data.staff || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  const loadReport = useCallback(async () => {
    setReportError('');
    try {
      setReport(await call(`/api/pos/report?from=${from}&to=${to}`));
    } catch (err) {
      setReportError(err.message);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadReport(); }, [loadReport]);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateMsg(null);
    try {
      await call('/api/admin/staff', { method: 'POST', body: JSON.stringify({ ...form, commission_pct: Number(form.commission_pct) }) });
      setCreateMsg({ ok: true, text: `Usuario creado. ${form.name} entra en /caja con ${form.email} y la contraseña que pusiste.` });
      setForm({ name: '', email: '', password: '', role: 'vendedora', commission_pct: '5' });
      load();
    } catch (err) {
      setCreateMsg({ ok: false, text: err.message });
    }
    setCreating(false);
  };

  const save = async (person, patch) => {
    setSavingId(person.id);
    try {
      const { staff: updated } = await call('/api/admin/staff', { method: 'PATCH', body: JSON.stringify({ id: person.id, ...patch }) });
      setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEdits((prev) => { const c = { ...prev }; delete c[person.id]; return c; });
    } catch (err) {
      window.alert(err.message);
    }
    setSavingId(null);
  };

  const resetPassword = async (person) => {
    const password = window.prompt(`Nueva contraseña para ${person.name} (mínimo 8 caracteres):`);
    if (!password) return;
    await save(person, { password });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} /> Personal y Comisiones
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Usuarios de vendedoras y caja. Ellas trabajan desde <strong>/caja</strong> en cualquier PC o celular: la vendedora arma la venta y la caja la cobra.
          </p>
        </div>
        <a href="/caja" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
          <ExternalLink size={15} /> Abrir la caja
        </a>
      </div>

      {/* Alta */}
      <form onSubmit={create} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}><UserPlus size={17} /> Nuevo usuario</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre" className="form-input" required />
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email (para ingresar)" className="form-input" required autoComplete="off" />
          <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Contraseña (mín. 8)" className="form-input" required minLength={8} autoComplete="new-password" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="form-input">
            <option value="vendedora">Vendedora</option>
            <option value="cajera">Caja</option>
            <option value="admin">Admin</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="number" min="0" max="100" step="0.5" value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} className="form-input" style={{ width: '80px' }} />
            <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>% comisión</span>
          </div>
        </div>
        {createMsg && <div role="status" style={{ marginTop: '10px', fontSize: '0.84rem', fontWeight: 600, color: createMsg.ok ? '#047857' : '#B91C1C' }}>{createMsg.text}</div>}
        <button type="submit" disabled={creating} className="btn-primary" style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {creating ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Crear usuario
        </button>
      </form>

      {/* Lista */}
      {error && <div role="alert" style={{ color: '#B91C1C', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
      {loading ? <Loader2 className="animate-spin" /> : (
        <table className="admin-table" style={{ marginBottom: '24px' }}>
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>% Comisión</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {staff.map((p) => {
              const e = edits[p.id] || {};
              const dirty = (e.role !== undefined && e.role !== p.role) || (e.commission_pct !== undefined && Number(e.commission_pct) !== Number(p.commission_pct));
              return (
                <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 700 }}>{p.name}</td>
                  <td style={{ fontSize: '0.82rem' }}>{p.email}</td>
                  <td>
                    <select value={e.role ?? p.role} onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, role: ev.target.value } })} className="form-input" style={{ padding: '4px 6px' }}>
                      {Object.entries(ROLE_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="number" min="0" max="100" step="0.5" value={e.commission_pct ?? p.commission_pct} onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, commission_pct: ev.target.value } })} className="form-input" style={{ width: '80px', padding: '4px 6px' }} />
                  </td>
                  <td>
                    <button type="button" onClick={() => save(p, { active: !p.active })} disabled={savingId === p.id}
                      style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer', border: p.active ? '1px solid #A7F3D0' : '1px solid #FECACA', backgroundColor: p.active ? '#ECFDF5' : '#FEF2F2', color: p.active ? '#047857' : '#DC2626' }}>
                      {p.active ? '● Activo' : '○ Desactivado'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={() => save(p, { role: e.role ?? p.role, commission_pct: Number(e.commission_pct ?? p.commission_pct) })} disabled={!dirty || savingId === p.id} className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: dirty ? 1 : 0.45 }}>
                        {savingId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar
                      </button>
                      <button type="button" onClick={() => resetPassword(p)} className="btn-secondary" title="Cambiar contraseña" style={{ padding: '4px 8px' }}><KeyRound size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Comisiones */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '10px' }}>Ventas del local y comisiones</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="form-input" />
          <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="form-input" />
          <button type="button" onClick={loadReport} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><RefreshCw size={14} /> Actualizar</button>
        </div>
        {reportError && <div role="alert" style={{ color: '#B91C1C', fontWeight: 600 }}>{reportError}</div>}
        {report && (
          <>
            <p style={{ fontSize: '0.9rem', marginBottom: '10px' }}>
              <strong>{money(report.total)}</strong> cobrados en {report.count} ventas
              {Object.entries(report.byMethod).map(([m, a]) => ` · ${METHOD_LABEL[m] || m}: ${money(a)}`).join('')}
            </p>
            <table className="admin-table">
              <thead><tr><th>Vendedora</th><th>Ventas</th><th>Total vendido</th><th>Comisión a pagar</th></tr></thead>
              <tbody>
                {report.bySeller.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>Sin ventas cobradas en el período.</td></tr>}
                {report.bySeller.map((r) => (
                  <tr key={r.seller_id || 'x'}>
                    <td style={{ fontWeight: 700 }}>{r.name}{r.commission_pct !== null ? ` (${r.commission_pct}%)` : ''}</td>
                    <td>{r.sales}</td>
                    <td>{money(r.total)}</td>
                    <td style={{ fontWeight: 800, color: '#047857' }}>{money(r.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
