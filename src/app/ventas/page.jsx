'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Wallet, HandCoins, Loader2, LogOut, X, Download, CloudOff, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { adminFetch } from '@/lib/adminFetch';

// /ventas (2026-10): ventas, comisiones y vales de las vendedoras. Solo la
// dueña (admin). Ventas y vales se anulan con motivo, nunca se borran. Si se
// corta internet, lo cargado queda en una cola en este navegador y se manda
// solo cuando vuelve la conexion (con un id propio, asi nunca se duplica).

const money = (n) => `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const todayAR = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10);
const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
const shiftDate = (d, period, dir) => {
  const t = new Date(`${d}T12:00:00`);
  if (period === 'month') t.setMonth(t.getMonth() + dir);
  else t.setDate(t.getDate() + (period === 'week' ? 7 : 1) * dir);
  return t.toISOString().slice(0, 10);
};
const PERIODS = { day: 'Día', week: 'Semana', month: 'Mes' };
const QUEUE_KEY = 'dv_ventas_queue';

const readQueue = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
};
const writeQueue = (q) => {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
};

async function api(method, body, query = '') {
  const res = await adminFetch(`/api/ventas${query}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Ocurrió un error.');
    err.status = res.status;
    throw err;
  }
  return data;
}

// Manda un alta (venta o vale); si no hay conexion la deja en cola.
async function sendOrQueue(payload) {
  try {
    await api('POST', payload);
    return { queued: false };
  } catch (err) {
    if (err.status) throw err; // el servidor contesto con un error: no se encola
    writeQueue([...readQueue(), payload]);
    return { queued: true };
  }
}

async function flushQueue() {
  const queue = readQueue();
  if (queue.length === 0) return 0;
  const remaining = [];
  for (const item of queue) {
    try {
      await api('POST', item);
    } catch (err) {
      if (!err.status) remaining.push(item); // sigue sin conexion
      // si el servidor lo rechazo (ej. dato invalido) se descarta para no trabar la cola
    }
  }
  writeQueue(remaining);
  return queue.length - remaining.length;
}

function exportCsv(data) {
  const rows = [['Vendedora', 'Ventas', 'Total', 'Efectivo', 'Transferencia', '% comisión', 'Comisión', 'Vales', 'A pagar']];
  data.sellers.forEach((s) => rows.push([s.name, s.salesCount, s.total, s.cash, s.transfer, s.pct, s.commission, s.advances, s.toPay]));
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ventas_${data.from}_a_${data.to}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------------------------------------------------------- Login
function Login({ onLogged }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (err) setError('Email o contraseña incorrectos.');
    else onLogged();
  };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: 'var(--bg-surface-elevated)' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: '360px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '28px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}><Users size={22} /> Ventas</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>Ingresá con el usuario de administración.</p>
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="form-input" style={{ width: '100%', marginBottom: '10px' }} required />
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="form-input" style={{ width: '100%', marginBottom: '12px' }} required />
        {error && <div role="alert" style={{ color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
        <button type="submit" disabled={busy} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px' }}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- Alta de venta / vale
function EntryModal({ kind, seller, date, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('efectivo');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isSale = kind === 'sale';

  const save = async (e) => {
    e.preventDefault();
    const value = Number(String(amount).replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Poné un monto válido.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        action: isSale ? 'addSale' : 'addAdvance',
        clientRef: crypto.randomUUID(),
        sellerId: seller.id,
        date,
        amount: value,
        note,
        ...(isSale ? { method } : {})
      };
      const { queued } = await sendOrQueue(payload);
      onSaved(queued);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <form className="modal-box" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <button type="button" onClick={onClose} className="qty-btn" style={{ position: 'absolute', top: '14px', right: '14px' }}><X size={18} /></button>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '2px' }}>{isSale ? 'Nueva venta' : 'Nuevo vale / adelanto'}</h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '14px' }}>{seller.name} · {fmtDate(date)}</p>
        <input type="number" inputMode="decimal" min="0" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto $" className="form-input" style={{ width: '100%', fontSize: '1.3rem', fontWeight: 800, marginBottom: '10px' }} />
        {isSale && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            {[['efectivo', 'Efectivo'], ['transferencia', 'Transferencia']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setMethod(id)}
                style={{ padding: '10px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', border: method === id ? '2px solid var(--text-main)' : '1px solid var(--border-color)', backgroundColor: method === id ? 'var(--text-main)' : 'var(--bg-card)', color: method === id ? 'var(--bg-page)' : 'var(--text-main)' }}>
                {label}
              </button>
            ))}
          </div>
        )}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={isSale ? 'Nota (opcional)' : 'Motivo (opcional)'} className="form-input" style={{ width: '100%', marginBottom: '12px' }} />
        {error && <div role="alert" style={{ color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
        <button type="submit" disabled={busy} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- Detalle de una vendedora
function DetailModal({ seller, period, date, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api('GET', null, `?period=${period}&date=${date}&sellerId=${seller.id}`);
      setDetail(data.detail);
    } catch (err) {
      setError(err.message);
    }
  }, [period, date, seller.id]);

  useEffect(() => { load(); }, [load]);

  const voidEntry = async (kind, entry) => {
    const reason = window.prompt(`Motivo para anular ${kind === 'sale' ? 'la venta' : 'el vale'} de ${money(entry.amount)}:`);
    if (!reason || !reason.trim()) return;
    try {
      await api('POST', { action: 'void', kind, id: entry.id, reason });
      await load();
      onChanged();
    } catch (err) {
      window.alert(err.message);
    }
  };

  const toggleActive = async () => {
    if (seller.active && !window.confirm(`¿Dar de baja a ${seller.name}? No se borra nada: deja de aparecer en la lista diaria.`)) return;
    try {
      await api('POST', { action: 'setActive', sellerId: seller.id, active: !seller.active });
      onChanged();
      onClose();
    } catch (err) {
      window.alert(err.message);
    }
  };

  const Row = ({ entry, kind }) => {
    const voided = Boolean(entry.voided_at);
    const day = kind === 'sale' ? entry.sale_date : entry.advance_date;
    return (
      <tr style={{ opacity: voided ? 0.5 : 1 }}>
        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmtDate(day)} {new Date(entry.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
        <td style={{ fontWeight: 800, textDecoration: voided ? 'line-through' : 'none' }}>{money(entry.amount)}</td>
        {kind === 'sale' && <td style={{ fontSize: '0.8rem' }}>{entry.payment_method === 'efectivo' ? 'Efectivo' : 'Transferencia'}</td>}
        <td style={{ fontSize: '0.8rem' }}>
          {entry.note}
          {voided && <div style={{ color: '#B91C1C', fontWeight: 700 }}>Anulado: {entry.void_reason}</div>}
        </td>
        <td>{!voided && <button type="button" onClick={() => voidEntry(kind, entry)} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.74rem' }}>Anular</button>}</td>
      </tr>
    );
  };

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="qty-btn" style={{ position: 'absolute', top: '14px', right: '14px' }}><X size={18} /></button>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{seller.name}</h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Vendió {money(seller.total)} · comisión {money(seller.commission)} · vales {money(seller.advances)} · <strong>a pagar {money(seller.toPay)}</strong>
        </p>
        {error && <div role="alert" style={{ color: '#B91C1C', fontWeight: 600 }}>{error}</div>}
        {!detail ? <Loader2 className="animate-spin" /> : (
          <>
            <h4 style={{ fontWeight: 800, margin: '10px 0 6px' }}>Ventas ({detail.sales.filter((s) => !s.voided_at).length})</h4>
            {detail.sales.length === 0 ? <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Sin ventas en el período.</p> : (
              <table className="admin-table"><tbody>{detail.sales.map((s) => <Row key={`s${s.id}`} entry={s} kind="sale" />)}</tbody></table>
            )}
            <h4 style={{ fontWeight: 800, margin: '16px 0 6px' }}>Vales / adelantos ({detail.advances.filter((a) => !a.voided_at).length})</h4>
            {detail.advances.length === 0 ? <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Sin vales en el período.</p> : (
              <table className="admin-table"><tbody>{detail.advances.map((a) => <Row key={`a${a.id}`} entry={a} kind="advance" />)}</tbody></table>
            )}
          </>
        )}
        <button type="button" onClick={toggleActive} className="btn-secondary" style={{ marginTop: '18px', fontSize: '0.8rem' }}>
          {seller.active ? 'Dar de baja a esta vendedora' : 'Volver a dar de alta'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Página
export default function VentasPage() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(todayAR());
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [pctDrafts, setPctDrafts] = useState({});
  const [entry, setEntry] = useState(null);   // { kind, seller }
  const [detailSeller, setDetailSeller] = useState(null);
  const [queueSize, setQueueSize] = useState(0);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await api('GET', null, `?period=${period}&date=${date}`);
      setData(res);
      setAuthed(true);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setAuthed(false);
        setAuthError(err.status === 403 ? 'Este usuario no es de administración.' : '');
      } else {
        setLoadError(err.status ? err.message : 'Sin conexión. Lo que cargues se guarda y se envía solo cuando vuelva internet.');
      }
    }
    setChecking(false);
  }, [period, date]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) load();
      else setChecking(false);
    });
  }, [load]);

  // Cola sin conexion: reintenta al volver internet y cada 20 s.
  useEffect(() => {
    const tick = async () => {
      const sent = await flushQueue();
      setQueueSize(readQueue().length);
      if (sent > 0) load();
    };
    setQueueSize(readQueue().length);
    window.addEventListener('online', tick);
    const id = setInterval(tick, 20000);
    return () => { window.removeEventListener('online', tick); clearInterval(id); };
  }, [load]);

  const savePct = async (seller) => {
    const pct = Number(String(pctDrafts[seller.id]).replace(',', '.'));
    try {
      await api('POST', { action: 'setPct', sellerId: seller.id, date, pct });
      setPctDrafts((p) => { const c = { ...p }; delete c[seller.id]; return c; });
      load();
    } catch (err) {
      window.alert(err.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAuthed(false);
    setData(null);
  };

  if (checking) return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="animate-spin" /></div>;
  if (!authed && !data) {
    return (
      <>
        {authError && <div role="alert" style={{ position: 'fixed', top: 0, left: 0, right: 0, padding: '10px', textAlign: 'center', backgroundColor: '#FEF2F2', color: '#B91C1C', fontWeight: 700, zIndex: 10 }}>{authError} <button type="button" onClick={logout} style={{ textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>Salir</button></div>}
        <Login onLogged={load} />
      </>
    );
  }

  const totals = (data?.sellers || []).reduce((t, s) => ({
    total: t.total + s.total, cash: t.cash + s.cash, transfer: t.transfer + s.transfer,
    commission: t.commission + s.commission, advances: t.advances + s.advances, toPay: t.toPay + s.toPay
  }), { total: 0, cash: 0, transfer: 0, commission: 0, advances: 0, toPay: 0 });

  const rangeLabel = !data ? '' : period === 'day' ? fmtDate(data.from) : `${fmtDate(data.from)} al ${fmtDate(data.to)}`;
  const isToday = date === todayAR();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-surface-elevated)', padding: '16px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={22} /> Ventas de vendedoras</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {queueSize > 0 && (
              <span title="Se guardaron sin conexión y se envían solos al volver internet" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 800, color: '#B45309', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', padding: '4px 10px', borderRadius: '20px' }}>
                <CloudOff size={14} /> {queueSize} sin enviar
              </span>
            )}
            {data && <button type="button" onClick={() => exportCsv(data)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Download size={14} /> Excel</button>}
            <button type="button" onClick={logout} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><LogOut size={14} /> Salir</button>
          </div>
        </header>

        {/* Periodo */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
          {Object.entries(PERIODS).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPeriod(id)} className={`admin-tab-btn ${period === id ? 'active' : ''}`}>{label}</button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
            <button type="button" className="qty-btn" onClick={() => setDate(shiftDate(date, period, -1))} aria-label="Anterior"><ChevronLeft size={16} /></button>
            <input type="date" value={date} max={todayAR()} onChange={(e) => e.target.value && setDate(e.target.value)} className="form-input" style={{ padding: '6px 8px' }} />
            <button type="button" className="qty-btn" onClick={() => setDate(shiftDate(date, period, 1))} disabled={isToday} aria-label="Siguiente"><ChevronRight size={16} /></button>
            {!isToday && <button type="button" onClick={() => setDate(todayAR())} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>Hoy</button>}
          </div>
        </div>

        {loadError && <div role="alert" style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FFFBEB', color: '#92400E', fontWeight: 600, marginBottom: '12px' }}>{loadError}</div>}
        {notice && <div role="status" style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#ECFDF5', color: '#047857', fontWeight: 600, marginBottom: '12px' }}>{notice}</div>}

        {data && (
          <>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>{PERIODS[period]}: {rangeLabel}</p>

            {/* Totales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
              {[['Total vendido', totals.total], ['Efectivo', totals.cash], ['Transferencia', totals.transfer], ['Comisiones', totals.commission], ['Vales', totals.advances], ['A pagar', totals.toPay]].map(([label, value]) => (
                <div key={label} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>{money(value)}</div>
                </div>
              ))}
            </div>

            {/* Vendedoras */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
              {data.sellers.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Todavía no hay vendedoras. Dalas de alta desde el panel de admin → Vendedoras.</p>}
              {data.sellers.map((s) => (
                <div
                  key={s.id}
                  role={s.active ? 'button' : undefined}
                  tabIndex={s.active ? 0 : undefined}
                  aria-label={s.active ? `Cargar una venta de ${s.name}` : undefined}
                  // Tocar la tarjeta abre la carga de una venta; los botones e
                  // inputs de adentro frenan el click para no abrirla.
                  onClick={() => s.active && setEntry({ kind: 'sale', seller: s })}
                  onKeyDown={(e) => { if (s.active && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setEntry({ kind: 'sale', seller: s }); } }}
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '14px', opacity: s.active ? 1 : 0.6, cursor: s.active ? 'pointer' : 'default' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setDetailSeller(s); }} title="Ver historial" style={{ background: 'none', border: 'none', padding: 0, fontSize: '1.05rem', fontWeight: 900, cursor: 'pointer', color: 'var(--text-main)', textDecoration: 'underline' }}>{s.name}</button>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.salesCount} venta{s.salesCount === 1 ? '' : 's'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.86rem', marginBottom: '10px' }}>
                    <span>Total vendido</span><strong style={{ textAlign: 'right' }}>{money(s.total)}</strong>
                    <span>Efectivo</span><span style={{ textAlign: 'right' }}>{money(s.cash)}</span>
                    <span>Transferencia</span><span style={{ textAlign: 'right' }}>{money(s.transfer)}</span>
                    <span>Comisión{period === 'day' ? '' : ' (suma diaria)'}</span><strong style={{ textAlign: 'right', color: '#047857' }}>{money(s.commission)}</strong>
                    <span>Vales</span><span style={{ textAlign: 'right', color: '#B91C1C' }}>− {money(s.advances)}</span>
                    <span style={{ fontWeight: 800 }}>A pagar</span><strong style={{ textAlign: 'right', fontSize: '1rem' }}>{money(s.toPay)}</strong>
                  </div>

                  {/* % del dia */}
                  {period === 'day' && (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '0.82rem', cursor: 'default' }}>
                      <span style={{ fontWeight: 700 }}>% comisión del día:</span>
                      <input
                        type="number" inputMode="decimal" min="0" max="100" step="0.5"
                        value={pctDrafts[s.id] ?? s.pct}
                        onChange={(e) => setPctDrafts((p) => ({ ...p, [s.id]: e.target.value }))}
                        className="form-input" style={{ width: '70px', padding: '4px 6px', fontWeight: 800 }}
                      />
                      <span>%</span>
                      {pctDrafts[s.id] !== undefined && Number(pctDrafts[s.id]) !== Number(s.pct) && (
                        <button type="button" onClick={() => savePct(s)} className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>Guardar</button>
                      )}
                      {!s.pctSetToday && pctDrafts[s.id] === undefined && <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>(sigue el anterior)</span>}
                    </div>
                  )}

                  {s.active && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setEntry({ kind: 'sale', seller: s }); }} className="btn-primary" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px' }}>
                        <Plus size={15} /> Venta
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setEntry({ kind: 'advance', seller: s }); }} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px' }}>
                        <HandCoins size={15} /> Vale
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p style={{ fontSize: '0.8rem', marginTop: '18px' }}>
              Para dar de alta o de baja vendedoras: <a href="/admin" style={{ fontWeight: 700, textDecoration: 'underline' }}>Panel de admin → Vendedoras</a>.
            </p>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '10px' }}>
              <Wallet size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> “A pagar” = comisión − vales. La comisión de cada día se calcula con el % de ese día. Tocá la tarjeta de una vendedora para cargar una venta; tocá su nombre para ver el historial. Nada se borra: las ventas y vales se anulan con motivo desde el historial.
            </p>
          </>
        )}

        {entry && (
          <EntryModal
            kind={entry.kind}
            seller={entry.seller}
            date={date}
            onClose={() => setEntry(null)}
            onSaved={(queued) => {
              setQueueSize(readQueue().length);
              setNotice(queued ? 'Sin conexión: quedó guardado en este dispositivo y se envía solo cuando vuelva internet.' : '');
              if (!queued) load();
            }}
          />
        )}
        {detailSeller && (
          <DetailModal
            seller={detailSeller}
            period={period}
            date={date}
            onClose={() => setDetailSeller(null)}
            onChanged={load}
          />
        )}
      </div>
    </div>
  );
}
