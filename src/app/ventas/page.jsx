'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Wallet, HandCoins, Loader2, LogOut, X, Download, CloudOff, ChevronLeft, ChevronRight, Save, Banknote, Receipt, Calculator, Trophy, TrendingUp, TrendingDown, History } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { adminFetch } from '@/lib/adminFetch';

// /ventas (2026-10): ventas, comisiones, vales, liquidaciones y arqueo de
// caja de las vendedoras. Solo la dueña (admin). Nada se borra: se anula con
// motivo. Si se corta internet, lo cargado queda en una cola en este
// navegador y se manda solo cuando vuelve la conexion (con un id propio, asi
// nunca se duplica).

const money = (n) => `${Number(n) < 0 ? '−' : ''}$${Math.abs(Number(n || 0)).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const todayAR = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10);
const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
const shiftDate = (d, period, dir) => {
  const t = new Date(`${d}T12:00:00`);
  if (period === 'month') t.setMonth(t.getMonth() + dir);
  else t.setDate(t.getDate() + (period === 'week' ? 7 : 1) * dir);
  return t.toISOString().slice(0, 10);
};
const PERIODS = { day: 'Día', week: 'Semana', month: 'Mes' };
const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia' };
const QUEUE_KEY = 'dv_ventas_queue';
const BIG_AMOUNT = 1000000; // por encima de esto se pide confirmar

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

// Manda un alta; si no hay conexion la deja en cola.
async function sendOrQueue(payload) {
  try {
    return { queued: false, data: await api('POST', payload) };
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
    }
  }
  writeQueue(remaining);
  return queue.length - remaining.length;
}

function exportCsv(data) {
  const rows = [['Vendedora', 'Ventas', 'Total', 'Efectivo', 'Transferencia', '% comisión', 'Comisión', 'Vales', 'Pagado', 'Saldo pendiente']];
  data.sellers.forEach((s) => rows.push([s.name, s.salesCount, s.total, s.cash, s.transfer, s.pct, s.commission, s.advances, s.paid, s.balance]));
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ventas_${data.from}_a_${data.to}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------------------------------------------------------- Monto entero
// Solo digitos: "1.500" o "1,5" se confundian (Mica quedo con $1.000.001,5).
function AmountInput({ value, onChange, placeholder = 'Monto', autoFocus = false, label }) {
  const raw = String(value ?? '');
  const hasSeparator = /[.,\s]/.test(raw);
  const invalid = raw !== '' && !/^\d+$/.test(raw);
  const parsed = /^\d+$/.test(raw) ? Number(raw) : null;
  return (
    <div style={{ marginBottom: '10px' }}>
      {label && <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</label>}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={raw}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder={placeholder}
        className="form-input"
        style={{ width: '100%', fontSize: '1.25rem', fontWeight: 800, borderColor: invalid ? '#DC2626' : undefined }}
      />
      <div style={{ fontSize: '0.76rem', marginTop: '3px', fontWeight: 600, color: invalid ? '#B91C1C' : 'var(--text-muted)' }}>
        {invalid
          ? (hasSeparator ? '⚠️ Escribí el número entero, sin puntos ni comas. Ej: 15000' : '⚠️ Solo números.')
          : parsed !== null ? `= ${money(parsed)}` : 'Número entero, sin puntos ni comas. Ej: 15000'}
      </div>
    </div>
  );
}
const amountOk = (v) => /^\d+$/.test(String(v ?? '')) && Number(v) > 0;

function MethodToggle({ value, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
      {Object.entries(METHOD_LABEL).map(([id, label]) => (
        <button key={id} type="button" onClick={() => onChange(id)}
          style={{ padding: '10px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', border: value === id ? '2px solid var(--text-main)' : '1px solid var(--border-color)', backgroundColor: value === id ? 'var(--text-main)' : 'var(--bg-card)', color: value === id ? 'var(--bg-page)' : 'var(--text-main)' }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, maxWidth = '400px' }) {
  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="qty-btn" style={{ position: 'absolute', top: '14px', right: '14px' }} aria-label="Cerrar"><X size={18} /></button>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '2px' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '14px' }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

// Boton de guardar con confirmacion en dos pasos para montos muy altos.
function SaveButton({ busy, amount, onSave, label = 'Guardar' }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setConfirming(false); }, [amount]);
  const big = Number(amount) > BIG_AMOUNT;
  return (
    <>
      {confirming && (
        <div role="alert" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#92400E', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px' }}>
          ¿Seguro que son {money(amount)}? Tocá de nuevo para confirmar.
        </div>
      )}
      <button type="button" disabled={busy} onClick={() => { if (big && !confirming) { setConfirming(true); return; } onSave(); }} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {confirming ? 'Sí, guardar' : label}
      </button>
    </>
  );
}

// ---------------------------------------------------------------- Recibo
// preOpened: ventana abierta en el momento del click. Si se abre despues de
// esperar al servidor, Chrome la bloquea como ventana emergente.
async function openReceipt(payoutId, preOpened = null) {
  const win = preOpened || window.open('', '_blank', 'width=420,height=700');
  if (win) win.document.write('<p style="font-family:sans-serif;padding:20px">Armando el recibo…</p>');
  try {
    const r = await api('GET', null, `?payoutId=${payoutId}`);
    const n = r.numbers;
    const period = r.from === r.to ? fmtDate(r.from) : `${fmtDate(r.from)} al ${fmtDate(r.to)}`;
    const lines = [
      `RECIBO DE PAGO — Dulce Valentín`,
      `Vendedora: ${r.seller?.name || ''}`,
      `Fecha de pago: ${fmtDate(r.payout.paid_date)}`,
      `Período: ${period}`,
      ``,
      `Ventas: ${n.salesCount} — ${money(n.total)} (efectivo ${money(n.cash)} / transferencia ${money(n.transfer)})`,
      `Comisión del período: ${money(n.commission)}`,
      `Vales del período: ${money(n.advances)}`,
      ...(r.advances || []).map((a) => `   • ${fmtDate(a.advance_date)}: ${money(a.amount)}${a.note ? ` (${a.note})` : ''}`),
      ``,
      `PAGADO: ${money(r.payout.amount)} en ${METHOD_LABEL[r.payout.payment_method] || r.payout.payment_method}${r.payout.note ? ` — ${r.payout.note}` : ''}`,
      `Saldo después de este pago: ${money(r.balanceAfter)}${r.balanceAfter < 0 ? ' (a descontar)' : r.balanceAfter > 0 ? ' (pendiente)' : ''}`,
      r.payout.voided_at ? `*** PAGO ANULADO: ${r.payout.void_reason} ***` : ''
    ].filter((l) => l !== null);
    const text = lines.join('\n');
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    if (!win) return;
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Recibo ${esc(r.seller?.name || '')}</title>
<style>body{font-family:Arial,sans-serif;max-width:380px;margin:16px auto;padding:0 12px;color:#000}pre{white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.5}
.btns{display:flex;gap:8px;margin:14px 0}.btns a,.btns button{flex:1;padding:10px;border-radius:8px;border:none;font-weight:bold;font-size:14px;cursor:pointer;text-align:center;text-decoration:none}
.p{background:#111;color:#fff}.w{background:#25D366;color:#fff}.f{margin-top:30px;border-top:1px solid #000;padding-top:6px;font-size:12px}@media print{.btns{display:none}}</style></head><body>
<pre>${esc(text)}</pre><div class="f">Firma vendedora</div>
<div class="btns"><button class="p" onclick="window.print()">Imprimir</button><a class="w" target="_blank" href="https://wa.me/?text=${encodeURIComponent(text)}">Enviar por WhatsApp</a></div>
</body></html>`);
    win.document.close();
  } catch (err) {
    if (win) win.close();
    window.alert(err.message);
  }
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

// ---------------------------------------------------------------- Venta / vale
function EntryModal({ kind, seller, date, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('efectivo');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isSale = kind === 'sale';

  const save = async () => {
    if (!amountOk(amount)) {
      setError('Poné el monto en pesos, sin puntos ni comas (ej: 15000).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { queued } = await sendOrQueue({
        action: isSale ? 'addSale' : 'addAdvance',
        clientRef: crypto.randomUUID(),
        sellerId: seller.id,
        date,
        amount: Number(amount),
        method,
        note
      });
      onSaved(queued);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isSale ? 'Nueva venta' : 'Nuevo vale / adelanto'} subtitle={`${seller.name} · ${fmtDate(date)}`} onClose={onClose}>
      <AmountInput value={amount} onChange={setAmount} placeholder="Monto $" autoFocus />
      {!isSale && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>¿Cómo se le dio?</div>}
      <MethodToggle value={method} onChange={setMethod} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={isSale ? 'Nota (opcional)' : 'Motivo (opcional)'} className="form-input" style={{ width: '100%', marginBottom: '12px' }} />
      {error && <div role="alert" style={{ color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
      <SaveButton busy={busy} amount={amount} onSave={save} />
    </Modal>
  );
}

// ---------------------------------------------------------------- Liquidar
function PayoutModal({ seller, data, onClose, onSaved }) {
  const suggested = Math.max(0, Math.round(seller.balance));
  const [amount, setAmount] = useState(suggested > 0 ? String(suggested) : '');
  const [method, setMethod] = useState('efectivo');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!amountOk(amount)) {
      setError('Poné el monto en pesos, sin puntos ni comas (ej: 15000).');
      return;
    }
    setBusy(true);
    setError('');
    const receiptWin = window.open('', '_blank', 'width=420,height=700');
    try {
      const { queued, data: res } = await sendOrQueue({
        action: 'addPayout',
        clientRef: crypto.randomUUID(),
        sellerId: seller.id,
        date: data.to > todayAR() ? todayAR() : data.to,
        amount: Number(amount),
        method,
        periodFrom: data.from,
        periodTo: data.to,
        note
      });
      onSaved(queued);
      onClose();
      if (!queued && res?.payoutId) openReceipt(res.payoutId, receiptWin);
      else if (receiptWin) receiptWin.close();
    } catch (err) {
      if (receiptWin) receiptWin.close();
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const rest = amountOk(amount) ? seller.balance - Number(amount) : seller.balance;
  return (
    <Modal title={`Liquidar a ${seller.name}`} subtitle={`Período ${data.from === data.to ? fmtDate(data.from) : `${fmtDate(data.from)} al ${fmtDate(data.to)}`}`} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 12px', fontSize: '0.86rem', marginBottom: '12px', padding: '10px', borderRadius: '10px', backgroundColor: 'var(--bg-surface-elevated)' }}>
        <span>Comisión del período</span><strong>{money(seller.commission)}</strong>
        <span>Vales del período</span><span>− {money(seller.advances)}</span>
        <span>Ya pagado en el período</span><span>− {money(seller.paid)}</span>
        <span style={{ fontWeight: 800 }}>Saldo pendiente (acumulado)</span><strong>{money(seller.balance)}</strong>
      </div>
      {seller.balance <= 0 && (
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400E', marginBottom: '10px' }}>
          {seller.balance < 0 ? `Tiene vales por encima de la comisión: debe ${money(-seller.balance)}, que se descuenta de lo próximo.` : 'No tiene saldo pendiente.'}
        </div>
      )}
      <AmountInput value={amount} onChange={setAmount} label="Monto que le pagás" autoFocus />
      <MethodToggle value={method} onChange={setMethod} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" className="form-input" style={{ width: '100%', marginBottom: '8px' }} />
      <div style={{ fontSize: '0.8rem', marginBottom: '10px' }}>Saldo después del pago: <strong>{money(rest)}</strong></div>
      {error && <div role="alert" style={{ color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
      <SaveButton busy={busy} amount={amount} onSave={save} label="Registrar pago y ver recibo" />
    </Modal>
  );
}

// ---------------------------------------------------------------- Arqueo
function CashCountModal({ date, cash, onClose, onSaved }) {
  const [opening, setOpening] = useState(cash.lastCount ? String(Math.round(cash.lastCount.opening_float)) : '0');
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const okOpening = /^\d+$/.test(opening);
  const expected = (okOpening ? Number(opening) : 0) + cash.expected;
  const diff = /^\d+$/.test(counted) ? Number(counted) - expected : null;

  const save = async () => {
    if (!okOpening || !/^\d+$/.test(counted)) {
      setError('Poné los montos en pesos, sin puntos ni comas.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { queued, data: res } = await sendOrQueue({ action: 'addCashCount', clientRef: crypto.randomUUID(), date, openingFloat: Number(opening), counted: Number(counted), note });
      if (queued) {
        onSaved(true);
        onClose();
      } else {
        setResult(res);
        onSaved(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Arqueo de caja" subtitle={fmtDate(date)} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 12px', fontSize: '0.86rem', marginBottom: '12px', padding: '10px', borderRadius: '10px', backgroundColor: 'var(--bg-surface-elevated)' }}>
        <span>Ventas en efectivo</span><strong>{money(cash.salesCash)}</strong>
        <span>Vales en efectivo</span><span>− {money(cash.advancesCash)}</span>
        <span>Pagos a vendedoras en efectivo</span><span>− {money(cash.payoutsCash)}</span>
      </div>
      {result ? (
        <div style={{ padding: '12px', borderRadius: '10px', textAlign: 'center', fontWeight: 800, backgroundColor: result.difference === 0 ? '#ECFDF5' : '#FEF2F2', color: result.difference === 0 ? '#047857' : '#B91C1C' }}>
          {result.difference === 0 ? '✓ La caja cierra justo' : result.difference > 0 ? `Sobran ${money(result.difference)}` : `Faltan ${money(-result.difference)}`}
          <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '4px' }}>Esperado {money(result.expected)}</div>
        </div>
      ) : (
        <>
          <AmountInput value={opening} onChange={setOpening} label="Fondo inicial (cambio con que abrió la caja)" />
          <div style={{ fontSize: '0.86rem', fontWeight: 700, marginBottom: '8px' }}>Efectivo esperado: {money(expected)}</div>
          <AmountInput value={counted} onChange={setCounted} label="Efectivo contado en la caja" autoFocus />
          {diff !== null && (
            <div style={{ fontWeight: 800, marginBottom: '10px', color: diff === 0 ? '#047857' : '#B91C1C' }}>
              {diff === 0 ? 'Cierra justo' : diff > 0 ? `Sobran ${money(diff)}` : `Faltan ${money(-diff)}`}
            </div>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" className="form-input" style={{ width: '100%', marginBottom: '12px' }} />
          {error && <div role="alert" style={{ color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
          <SaveButton busy={busy} amount={counted} onSave={save} label="Guardar arqueo" />
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Historial de una vendedora
// Rangos del historial: el periodo que se esta viendo, ultimos 7/30 dias o todo.
const HISTORY_RANGES = { period: 'Este período', d7: 'Últimos 7 días', d30: 'Últimos 30 días', all: 'Todo' };
const daysAgo = (n) => {
  const t = new Date(`${todayAR()}T12:00:00`);
  t.setDate(t.getDate() - n);
  return t.toISOString().slice(0, 10);
};

function DetailModal({ seller, periodFrom, periodTo, onClose, onChanged }) {
  const [range, setRange] = useState('period');
  const [hist, setHist] = useState(null);
  const [error, setError] = useState('');

  const bounds = range === 'period' ? { from: periodFrom, to: periodTo }
    : range === 'd7' ? { from: daysAgo(6), to: todayAR() }
    : range === 'd30' ? { from: daysAgo(29), to: todayAR() }
    : { from: null, to: todayAR() };

  const load = useCallback(async () => {
    setError('');
    try {
      const q = `?history=1&sellerId=${seller.id}${bounds.from ? `&from=${bounds.from}` : ''}&to=${bounds.to}`;
      setHist(await api('GET', null, q));
    } catch (err) {
      setError(err.message);
    }
  }, [seller.id, bounds.from, bounds.to]);

  useEffect(() => { setHist(null); load(); }, [load]);

  const voidEntry = async (kind, entry) => {
    const label = { sale: 'la venta', advance: 'el vale', payout: 'el pago' }[kind];
    const reason = window.prompt(`Motivo para anular ${label} de ${money(entry.amount)}:`);
    if (!reason || !reason.trim()) return;
    try {
      await api('POST', { action: 'void', kind, id: entry.id, reason });
      await load();
      onChanged();
    } catch (err) {
      window.alert(err.message);
    }
  };

  const Row = ({ entry, kind, day }) => {
    const voided = Boolean(entry.voided_at);
    return (
      <tr style={{ opacity: voided ? 0.5 : 1 }}>
        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmtDate(day)} {new Date(entry.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
        <td style={{ fontWeight: 800, textDecoration: voided ? 'line-through' : 'none' }}>{money(entry.amount)}</td>
        <td style={{ fontSize: '0.8rem' }}>{METHOD_LABEL[entry.payment_method] || ''}</td>
        <td style={{ fontSize: '0.8rem' }}>
          {entry.note}
          {voided && <div style={{ color: '#B91C1C', fontWeight: 700 }}>Anulado: {entry.void_reason}</div>}
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>
          {kind === 'payout' && <button type="button" onClick={() => openReceipt(entry.id)} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.74rem', marginRight: '4px' }}>Recibo</button>}
          {!voided && <button type="button" onClick={() => voidEntry(kind, entry)} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.74rem' }}>Anular</button>}
        </td>
      </tr>
    );
  };

  const Section = ({ title, rows, kind, dayKey }) => (
    <>
      <h4 style={{ fontWeight: 800, margin: '14px 0 6px' }}>{title} ({rows.filter((r) => !r.voided_at).length})</h4>
      {rows.length === 0 ? <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Nada en este rango.</p> : (
        <table className="admin-table"><tbody>{rows.map((r) => <Row key={`${kind}${r.id}`} entry={r} kind={kind} day={r[dayKey]} />)}</tbody></table>
      )}
    </>
  );

  const n = hist?.numbers;
  const days = hist?.advancesByDay || [];
  return (
    <Modal title={`Historial de ${seller.name}`} subtitle={`Saldo pendiente hoy: ${money(seller.balance)}`} onClose={onClose} maxWidth="760px">
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {Object.entries(HISTORY_RANGES).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setRange(id)} className={`admin-tab-btn ${range === id ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>{label}</button>
        ))}
      </div>
      {error && <div role="alert" style={{ color: '#B91C1C', fontWeight: 600 }}>{error}</div>}
      {!hist ? <Loader2 className="animate-spin" /> : (
        <>
          <p style={{ fontSize: '0.84rem', marginBottom: '10px' }}>
            {range === 'all' ? 'Desde el principio' : `${fmtDate(hist.from)} al ${fmtDate(hist.to)}`}: vendió <strong>{money(n.total)}</strong> ({n.salesCount} ventas) · comisión <strong>{money(n.commission)}</strong> · vales <strong>{money(n.advances)}</strong> · pagado <strong>{money(n.paid)}</strong>
          </p>

          {/* Vales por dia */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 12px', marginBottom: '6px' }}>
            <h4 style={{ fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><HandCoins size={16} /> Vales por día</h4>
            {days.length === 0 ? (
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>No pidió vales en este rango.</p>
            ) : (
              <table className="admin-table">
                <thead><tr><th>Día</th><th>Vales</th><th>Monto del día</th></tr></thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.date}>
                      <td>{fmtDate(d.date)}</td>
                      <td>{d.count}</td>
                      <td style={{ fontWeight: 800 }}>{money(d.total)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 800 }}>Total</td>
                    <td style={{ fontWeight: 800 }}>{days.reduce((t, d) => t + d.count, 0)}</td>
                    <td style={{ fontWeight: 900 }}>{money(days.reduce((t, d) => t + d.total, 0))}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <Section title="Vales / adelantos (detalle)" rows={hist.detail.advances} kind="advance" dayKey="advance_date" />
          <Section title="Ventas" rows={hist.detail.sales} kind="sale" dayKey="sale_date" />
          <Section title="Pagos" rows={hist.detail.payouts} kind="payout" dayKey="paid_date" />
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Ranking
function Ranking({ data }) {
  const rows = [...data.sellers].filter((s) => s.total > 0 || s.prevTotal > 0).sort((a, b) => b.total - a.total);
  if (rows.length === 0) return null;
  const prevLabel = { day: 'el día anterior', week: 'la semana anterior', month: 'el mes anterior' }[data.period];
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '14px', marginTop: '16px' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}><Trophy size={17} /> Ranking del período</h3>
      {rows.map((s, i) => {
        const change = s.prevTotal > 0 ? Math.round(((s.total - s.prevTotal) / s.prevTotal) * 100) : null;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.88rem' }}>
            <strong style={{ width: '24px' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</strong>
            <span style={{ flex: 1, fontWeight: 700 }}>{s.name}</span>
            <strong>{money(s.total)}</strong>
            <span style={{ width: '120px', textAlign: 'right', fontSize: '0.76rem', color: change === null ? 'var(--text-muted)' : change >= 0 ? '#047857' : '#B91C1C', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
              {change === null ? `sin ventas ${prevLabel}` : <>{change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{change >= 0 ? '+' : ''}{change}% vs {prevLabel}</>}
            </span>
          </div>
        );
      })}
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
  const [payoutSeller, setPayoutSeller] = useState(null);
  const [showCash, setShowCash] = useState(false);
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

  const afterSave = (queued) => {
    setQueueSize(readQueue().length);
    setNotice(queued ? 'Sin conexión: quedó guardado en este dispositivo y se envía solo cuando vuelva internet.' : '');
    if (!queued) load();
  };

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
    commission: t.commission + s.commission, advances: t.advances + s.advances, paid: t.paid + s.paid, balance: t.balance + s.balance
  }), { total: 0, cash: 0, transfer: 0, commission: 0, advances: 0, paid: 0, balance: 0 });

  const rangeLabel = !data ? '' : period === 'day' ? fmtDate(data.from) : `${fmtDate(data.from)} al ${fmtDate(data.to)}`;
  const isToday = date === todayAR();
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-surface-elevated)', padding: '16px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={22} /> Ventas de vendedoras</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '12px' }}>
              {[['Total vendido', totals.total], ['Efectivo', totals.cash], ['Transferencia', totals.transfer], ['Comisiones', totals.commission], ['Vales', totals.advances], ['Pagado', totals.paid], ['Saldo pendiente', totals.balance]].map(([label, value]) => (
                <div key={label} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{money(value)}</div>
                </div>
              ))}
            </div>

            {/* Caja del dia */}
            {period === 'day' && data.cash && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.88rem' }}>
                <Calculator size={18} />
                <span>Efectivo del día (sin fondo inicial): <strong>{money(data.cash.expected)}</strong></span>
                {data.cash.lastCount ? (
                  <span style={{ fontWeight: 700, color: Number(data.cash.lastCount.difference) === 0 ? '#047857' : '#B91C1C' }}>
                    Último arqueo {new Date(data.cash.lastCount.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}: {Number(data.cash.lastCount.difference) === 0 ? 'cerró justo' : Number(data.cash.lastCount.difference) > 0 ? `sobraban ${money(data.cash.lastCount.difference)}` : `faltaban ${money(-data.cash.lastCount.difference)}`}
                  </span>
                ) : <span style={{ color: 'var(--text-muted)' }}>Sin arqueo todavía</span>}
                <button type="button" onClick={() => setShowCash(true)} className="btn-secondary" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Calculator size={14} /> Hacer arqueo</button>
              </div>
            )}

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
                    <button type="button" onClick={stop(() => setDetailSeller(s))} title="Ver historial" style={{ background: 'none', border: 'none', padding: 0, fontSize: '1.05rem', fontWeight: 900, cursor: 'pointer', color: 'var(--text-main)', textDecoration: 'underline' }}>{s.name}</button>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.salesCount} venta{s.salesCount === 1 ? '' : 's'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.86rem', marginBottom: '10px' }}>
                    <span>Total vendido</span><strong style={{ textAlign: 'right' }}>{money(s.total)}</strong>
                    <span>Efectivo</span><span style={{ textAlign: 'right' }}>{money(s.cash)}</span>
                    <span>Transferencia</span><span style={{ textAlign: 'right' }}>{money(s.transfer)}</span>
                    <span>Comisión{period === 'day' ? '' : ' (suma diaria)'}</span><strong style={{ textAlign: 'right', color: '#047857' }}>{money(s.commission)}</strong>
                    <span>Vales</span><span style={{ textAlign: 'right', color: '#B91C1C' }}>− {money(s.advances)}</span>
                    <span>Pagado</span><span style={{ textAlign: 'right' }}>− {money(s.paid)}</span>
                    <span style={{ fontWeight: 800 }}>Saldo pendiente</span>
                    <strong style={{ textAlign: 'right', fontSize: '1rem', color: s.balance < 0 ? '#B91C1C' : undefined }} title="Acumulado: todas las comisiones menos vales y pagos">{money(s.balance)}</strong>
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
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={stop(() => setEntry({ kind: 'sale', seller: s }))} className="btn-primary" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 4px' }}>
                        <Plus size={15} /> Venta
                      </button>
                      <button type="button" onClick={stop(() => setEntry({ kind: 'advance', seller: s }))} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 4px' }}>
                        <HandCoins size={15} /> Vale
                      </button>
                      <button type="button" onClick={stop(() => setPayoutSeller(s))} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 4px' }}>
                        <Banknote size={15} /> Liquidar
                      </button>
                    </div>
                  )}
                  <button type="button" onClick={stop(() => setDetailSeller(s))} className="btn-secondary" style={{ width: '100%', marginTop: '6px', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 4px', fontSize: '0.84rem' }}>
                    <History size={15} /> Historial (ventas, vales y pagos)
                  </button>
                </div>
              ))}
            </div>

            <Ranking data={data} />

            <p style={{ fontSize: '0.8rem', marginTop: '18px' }}>
              Para dar de alta o de baja vendedoras: <a href="/admin" style={{ fontWeight: 700, textDecoration: 'underline' }}>Panel de admin → Vendedoras</a>.
            </p>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              <Wallet size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> “Saldo pendiente” = todas las comisiones − vales − pagos (acumulado, se arrastra de un período al otro). La comisión de cada día se calcula con el % de ese día. Tocá la tarjeta para cargar una venta; “Historial” muestra los vales por día, las ventas y los pagos con sus recibos <Receipt size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />. Nada se borra: todo se anula con motivo.
            </p>
          </>
        )}

        {entry && <EntryModal kind={entry.kind} seller={entry.seller} date={date} onClose={() => setEntry(null)} onSaved={afterSave} />}
        {payoutSeller && data && <PayoutModal seller={payoutSeller} data={data} onClose={() => setPayoutSeller(null)} onSaved={afterSave} />}
        {showCash && data?.cash && <CashCountModal date={date} cash={data.cash} onClose={() => { setShowCash(false); load(); }} onSaved={(queued) => { if (queued) afterSave(true); }} />}
        {detailSeller && data && <DetailModal seller={detailSeller} periodFrom={data.from} periodTo={data.to} onClose={() => setDetailSeller(null)} onChanged={load} />}
      </div>
    </div>
  );
}
