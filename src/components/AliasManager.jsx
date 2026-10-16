'use client';

// Editor de los alias de cobro por transferencia. Lo usan /ventas y
// /supervisor (Mica). Cada alias: alias/CVU, titular, banco, descripción y
// reglas opcionales (mínimo, máximo por transferencia, tope del día).
// "Sacar" archiva el alias (las ventas viejas siguen mostrando a dónde entraron).

import { useEffect, useState } from 'react';
import { X, Plus, Save, Loader2, ArrowUp, ArrowDown, Archive, Pause, Play, Pencil } from 'lucide-react';
import { aliasRules } from '@/lib/aliasPick';

const money = (n) => `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
const digits = (v) => String(v ?? '').replace(/\D/g, '');
const label = { display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '3px' };
const input = { width: '100%', fontSize: '0.9rem', padding: '7px 9px', boxSizing: 'border-box' };

function emptyForm(a) {
  return {
    id: a?.id || null,
    alias: a?.alias || '',
    holder: a?.holder || '',
    bank: a?.bank || '',
    description: a?.description || '',
    minAmount: a?.minAmount ? String(a.minAmount) : '',
    maxAmount: a?.maxAmount ? String(a.maxAmount) : '',
    dailyLimit: a?.dailyLimit ? String(a.dailyLimit) : '',
    active: a ? a.active : true
  };
}

function AliasForm({ initial, onCancel, onSave }) {
  const [f, setF] = useState(() => emptyForm(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  const setNum = (k) => (e) => setF((prev) => ({ ...prev, [k]: digits(e.target.value) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.alias.trim()) {
      setError('Escribí el alias o CVU.');
      return;
    }
    if (f.minAmount && f.maxAmount && Number(f.minAmount) > Number(f.maxAmount)) {
      setError('El mínimo no puede ser mayor que el máximo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(f);
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
      setBusy(false);
    }
  };

  const numField = (k, title, ph, hint) => (
    <div>
      <label style={label}>{title}</label>
      <input type="text" inputMode="numeric" value={f[k]} onChange={setNum(k)} placeholder={ph} className="form-input" style={input} />
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{f[k] ? `= ${money(f[k])}` : hint}</div>
    </div>
  );

  return (
    <form onSubmit={submit} style={{ border: '2px solid var(--dv-accent-fill, #A8175A)', borderRadius: '12px', padding: '12px', backgroundColor: 'var(--bg-surface-elevated, var(--bg-card))' }}>
      {error && <div role="alert" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#B91C1C', backgroundColor: '#FEF2F2', padding: '6px 9px', borderRadius: '8px', marginBottom: '8px' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px', marginBottom: '8px' }}>
        <div>
          <label style={label}>Alias / CVU *</label>
          <input autoFocus type="text" value={f.alias} onChange={(e) => setF((p) => ({ ...p, alias: e.target.value.toLowerCase().replace(/\s/g, '') }))} placeholder="ej: puesto.ropa.mp" className="form-input" style={{ ...input, fontWeight: 800, fontFamily: 'monospace' }} />
        </div>
        <div>
          <label style={label}>Titular</label>
          <input type="text" value={f.holder} onChange={set('holder')} placeholder="ej: Juan Pérez" className="form-input" style={input} />
        </div>
        <div>
          <label style={label}>Banco / billetera</label>
          <input type="text" value={f.bank} onChange={set('bank')} placeholder="ej: Mercado Pago" className="form-input" style={input} />
        </div>
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label style={label}>Descripción (la ven las vendedoras al cobrar)</label>
        <input type="text" value={f.description} onChange={set('description')} placeholder="ej: No acepta menos de $100.000" className="form-input" style={input} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
        {numField('minAmount', 'Mínimo por transferencia', 'ej: 100000', 'Vacío = sin mínimo')}
        {numField('maxAmount', 'Máximo por transferencia', 'ej: 50000', 'Vacío = sin máximo')}
        {numField('dailyLimit', 'Tope del día', 'ej: 1000000', 'Vacío = sin tope')}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy} style={{ padding: '6px 12px', fontSize: '0.82rem' }}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={busy} style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
        </button>
      </div>
    </form>
  );
}

// post(body) -> promesa con la respuesta del POST /api/ventas
export default function AliasManager({ aliases = [], post, onChanged, onClose }) {
  const [editing, setEditing] = useState(null); // id | 'new' | null
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !editing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, onClose]);

  const run = async (id, body) => {
    setBusyId(id);
    setError('');
    try {
      await post(body);
      await onChanged();
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setBusyId(null);
    }
  };

  const save = async (f) => {
    await post({ action: 'saveAlias', ...f });
    setEditing(null);
    await onChanged();
  };

  const move = (idx, dir) => {
    const ids = aliases.map((a) => a.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    run(ids[idx], { action: 'reorderAliases', ids });
  };

  const archive = (a) => {
    if (!window.confirm(`¿Sacar el alias ${a.alias}? Las transferencias que ya entraron ahí quedan registradas.`)) return;
    run(a.id, { action: 'archiveAlias', id: a.id });
  };

  const iconBtn = { background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '5px 7px', cursor: 'pointer', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700 };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !editing) onClose(); }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px', overflowY: 'auto' }}
    >
      <div style={{ width: '100%', maxWidth: '720px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '18px', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>Alias de cobro</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Al cobrar por transferencia se sugiere el <strong>primero de la lista</strong> que acepte el monto. Ordenalos con las flechas.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ ...iconBtn, border: 'none' }}><X size={20} /></button>
        </div>

        {error && <div role="alert" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#B91C1C', backgroundColor: '#FEF2F2', padding: '7px 10px', borderRadius: '8px', marginBottom: '10px' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {aliases.length === 0 && editing !== 'new' && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
              No hay alias cargados. Agregá el primero.
            </div>
          )}
          {aliases.map((a, idx) => (editing === a.id ? (
            <AliasForm key={a.id} initial={a} onCancel={() => setEditing(null)} onSave={save} />
          ) : (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 12px', opacity: busyId === a.id ? 0.5 : a.active ? 1 : 0.6 }}>
              <span style={{ fontWeight: 900, fontSize: '0.8rem', color: 'var(--text-muted)', width: '22px' }}>{idx + 1}.</span>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <strong style={{ fontFamily: 'monospace', fontSize: '0.98rem', wordBreak: 'break-all' }}>{a.alias}</strong>
                  {!a.active && <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '5px', backgroundColor: '#FEF3C7', color: '#92400E' }}>PAUSADO</span>}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  {[a.holder, a.bank].filter(Boolean).join(' · ') || 'Sin titular'} · {aliasRules(a)}
                </div>
                {a.description && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--dv-accent-text, #A8175A)' }}>“{a.description}”</div>}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <button type="button" style={iconBtn} onClick={() => move(idx, -1)} disabled={idx === 0 || !!busyId} title="Subir (se sugiere antes)"><ArrowUp size={14} /></button>
                <button type="button" style={iconBtn} onClick={() => move(idx, 1)} disabled={idx === aliases.length - 1 || !!busyId} title="Bajar"><ArrowDown size={14} /></button>
                <button type="button" style={iconBtn} onClick={() => setEditing(a.id)} disabled={!!editing}><Pencil size={13} /> Editar</button>
                <button type="button" style={iconBtn} onClick={() => run(a.id, { action: 'setAliasActive', id: a.id, active: !a.active })} disabled={!!busyId}>
                  {a.active ? <><Pause size={13} /> Pausar</> : <><Play size={13} /> Activar</>}
                </button>
                <button type="button" style={{ ...iconBtn, color: '#B91C1C' }} onClick={() => archive(a)} disabled={!!busyId}><Archive size={13} /> Sacar</button>
              </div>
            </div>
          )))}
          {editing === 'new' && <AliasForm initial={null} onCancel={() => setEditing(null)} onSave={save} />}
        </div>

        {editing !== 'new' && (
          <button type="button" onClick={() => setEditing('new')} disabled={!!editing} className="btn-primary" style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.86rem' }}>
            <Plus size={16} /> Agregar alias
          </button>
        )}
      </div>
    </div>
  );
}
