'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Users, Plus, Wallet, HandCoins, Loader2, LogOut, X, Download, CloudOff, ChevronLeft, ChevronRight, Save, Banknote, Receipt, Calculator, Trophy, TrendingUp, TrendingDown, History, Send, Target, Sparkles, Pencil, Zap, Undo2, Settings, Check, Building2, AlertTriangle, AlertCircle, Copy, CheckCheck, FileSpreadsheet, Clock, Landmark } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { adminFetch } from '@/lib/adminFetch';
import { downloadVentasExcel, cierreText, OWNER_WHATSAPP, downloadTransferenciasExcelForMica, transferenciasWhatsAppText } from '@/lib/ventasExport';

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

const GOALS_STORAGE_KEY = 'dv_ventas_store_goals';
const DEFAULT_GOALS = {
  day: 1000000,
  week: 5000000,
  month: 20000000
};
const readGoals = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(GOALS_STORAGE_KEY) || '{}');
    return { ...DEFAULT_GOALS, ...saved };
  } catch {
    return DEFAULT_GOALS;
  }
};
const writeGoals = (g) => {
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(g));
  } catch {}
};

const SELLER_NUMBERS_KEY = 'dv_seller_numbers';
const readSellerNumbers = () => {
  try {
    return JSON.parse(localStorage.getItem(SELLER_NUMBERS_KEY) || '{}');
  } catch {
    return {};
  }
};
const writeSellerNumbers = (map) => {
  try {
    localStorage.setItem(SELLER_NUMBERS_KEY, JSON.stringify(map));
  } catch {}
};

function getAssignedSellerNumbers(sellers, savedMap = {}) {
  const assigned = {};
  const usedNumbers = new Set();
  
  // 1. "Mostrador" siempre tiene asignado '00'
  (sellers || []).forEach((s) => {
    if (s.name.toLowerCase().trim() === 'mostrador') {
      assigned[s.id] = '00';
    }
  });

  // 2. Asignar números guardados explícitamente (1 a 20)
  (sellers || []).forEach((s) => {
    if (assigned[s.id]) return;
    const num = Number(savedMap[s.id]);
    if (num >= 1 && num <= 20 && !usedNumbers.has(num)) {
      assigned[s.id] = num;
      usedNumbers.add(num);
    }
  });

  // 3. Para las que no tengan número, asignar correlativo 1..20
  let next = 1;
  (sellers || []).forEach((s) => {
    if (!assigned[s.id]) {
      while (usedNumbers.has(next) && next <= 20) {
        next++;
      }
      assigned[s.id] = next;
      usedNumbers.add(next);
      next++;
    }
  });

  return assigned;
}

// Beep sonoro sutil de confirmación inmediata (Web Audio API)
const playSuccessBeep = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch {}
};

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

// ---------------------------------------------------------------- Meta del local (Termómetro)
function GoalEditModal({ period, currentGoal, onClose, onSave }) {
  const [amount, setAmount] = useState(String(currentGoal || ''));
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!amountOk(amount)) {
      setError('Poné el monto en pesos, sin puntos ni comas.');
      return;
    }
    onSave(Number(amount));
    onClose();
  };

  return (
    <Modal
      title={`Meta de ventas (${PERIODS[period]})`}
      subtitle="Fijá el objetivo de facturación para el termómetro de ventas del local."
      onClose={onClose}
    >
      <AmountInput value={amount} onChange={setAmount} label={`Objetivo para este ${PERIODS[period].toLowerCase()}`} autoFocus />
      {error && <div role="alert" style={{ color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
      <button type="button" onClick={handleSave} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <Save size={16} /> Guardar meta
      </button>
    </Modal>
  );
}

// ---------------------------------------------------------------- Modal para asignar números (1 al 20)
function SellerNumbersModal({ sellers, currentMap, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...currentMap }));

  const handleChange = (id, val) => {
    const num = parseInt(val, 10);
    setDraft((prev) => ({
      ...prev,
      [id]: isNaN(num) ? '' : Math.max(1, Math.min(20, num))
    }));
  };

  const handleAutoReorder = () => {
    const updated = {};
    let idx = 1;
    sellers.forEach((s) => {
      if (s.name.toLowerCase().trim() === 'mostrador') {
        updated[s.id] = '00';
      } else if (idx <= 20) {
        updated[s.id] = idx;
        idx++;
      }
    });
    setDraft(updated);
  };

  const handleSave = () => {
    const cleanMap = {};
    Object.entries(draft).forEach(([id, val]) => {
      if (String(val) === '00' || String(val) === '0') {
        cleanMap[id] = '00';
      } else {
        const n = Number(val);
        if (n >= 1 && n <= 20) cleanMap[id] = n;
      }
    });
    onSave(cleanMap);
    onClose();
  };

  return (
    <Modal title="Configurar N° de Vendedoras" subtitle="Asigná un número fijo a cada vendedora. Mostrador tiene el N° 00 fijo para clientes que van directo a caja." onClose={onClose} maxWidth="480px">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button type="button" onClick={handleAutoReorder} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
          Numerar automático (1 a {Math.min(20, sellers.length)})
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto', marginBottom: '14px', paddingRight: '4px' }}>
        {sellers.map((s) => {
          const isMostrador = s.name.toLowerCase().trim() === 'mostrador';
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: isMostrador ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-surface-elevated)', borderRadius: '10px', border: `1px solid ${isMostrador ? '#93C5FD' : 'var(--border-color)'}` }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{s.name}</span>
                {isMostrador && <span style={{ display: 'block', fontSize: '0.72rem', color: '#1D4ED8', fontWeight: 600 }}>Caja / Autoservicio (Sin comisión)</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>N°</span>
                {isMostrador ? (
                  <span style={{ backgroundColor: '#2563EB', color: '#FFF', fontWeight: 900, fontSize: '0.95rem', padding: '4px 12px', borderRadius: '6px' }}>00</span>
                ) : (
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={draft[s.id] ?? ''}
                    onChange={(e) => handleChange(s.id, e.target.value)}
                    className="form-input"
                    style={{ width: '60px', textAlign: 'center', fontWeight: 900, fontSize: '1rem', padding: '4px' }}
                    placeholder="1-20"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={handleSave} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
        Guardar números
      </button>
    </Modal>
  );
}

// ---------------------------------------------------------------- Barra de Carga Rápida en Hora Pico
function QuickSaleBar({ sellers, numberMap, date, dailyAlias, dayTransfers = [], onSaleCreated, onOpenNumbersModal }) {
  const [sellerInput, setSellerInput] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('efectivo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [undoToast, setUndoToast] = useState(null);
  const [countdown, setCountdown] = useState(8);

  const amountRef = useRef(null);
  const sellerInputRef = useRef(null);

  const dayTransferTotal = useMemo(() => {
    return (dayTransfers || []).reduce((acc, t) => acc + (t.amount || 0), 0);
  }, [dayTransfers]);

  const aliasLimit = Number(dailyAlias?.limit) || 1000000;
  const transferRemaining = aliasLimit - dayTransferTotal;
  const transferPct = Math.round((dayTransferTotal / (aliasLimit || 1)) * 100);
  const isTransferOver = dayTransferTotal >= aliasLimit;
  const isTransferNear = !isTransferOver && transferPct >= 80;

  const activeSellers = useMemo(() => sellers.filter((s) => s.active !== false), [sellers]);

  const sellerByNumber = useMemo(() => {
    const map = new Map();
    activeSellers.forEach((s) => {
      const num = numberMap[s.id];
      if (num !== undefined && num !== null) {
        map.set(String(num), s);
        map.set(Number(num), s);
      }
      if (s.name.toLowerCase().trim() === 'mostrador') {
        map.set('00', s);
        map.set('0', s);
        map.set(0, s);
      }
    });
    return map;
  }, [activeSellers, numberMap]);

  const parsedSeller = useMemo(() => {
    if (selectedSellerId) {
      const found = activeSellers.find((s) => s.id === selectedSellerId);
      if (found) return found;
    }
    const trimmed = sellerInput.trim();
    if (trimmed === '00' || trimmed === '0' || trimmed.startsWith('00 ') || trimmed.startsWith('0 ')) {
      const mostrador = activeSellers.find((s) => s.name.toLowerCase().trim() === 'mostrador');
      if (mostrador) return mostrador;
    }
    const match = trimmed.match(/^(\d+)/);
    if (match) {
      const raw = match[1];
      const num = parseInt(raw, 10);
      return sellerByNumber.get(raw) || sellerByNumber.get(num) || null;
    }
    return null;
  }, [selectedSellerId, sellerInput, activeSellers, sellerByNumber]);

  const handleSelectChip = (seller) => {
    setSelectedSellerId(seller.id);
    setSellerInput(String(numberMap[seller.id] || ''));
    setError('');
    setTimeout(() => {
      if (amountRef.current) amountRef.current.focus();
    }, 50);
  };

  useEffect(() => {
    if (!undoToast) return;
    setCountdown(8);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setUndoToast(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [undoToast]);

  const executeSale = async (targetSeller, targetAmount, targetMethod) => {
    if (!targetSeller) {
      setError('Elegí o escribí el número de la vendedora (1 al 20).');
      return;
    }
    if (!amountOk(targetAmount)) {
      setError('Ingresá el monto de la venta en pesos sin puntos (ej: 15000).');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const clientRef = crypto.randomUUID();
      const { queued, data: res } = await sendOrQueue({
        action: 'addSale',
        clientRef,
        sellerId: targetSeller.id,
        date,
        amount: Number(targetAmount),
        method: targetMethod,
        note: 'Carga rápida mostrador'
      });

      playSuccessBeep();

      if (!queued && res?.saleId) {
        setUndoToast({
          saleId: res.saleId,
          sellerName: targetSeller.name,
          amount: Number(targetAmount),
          method: targetMethod,
          sellerNum: numberMap[targetSeller.id]
        });
      }

      onSaleCreated(queued);

      setAmount('');
      setSellerInput('');
      setSelectedSellerId(null);

      setTimeout(() => {
        if (sellerInputRef.current) sellerInputRef.current.focus();
      }, 50);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la venta.');
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!undoToast?.saleId) return;
    try {
      await api('POST', {
        action: 'void',
        kind: 'sale',
        id: undoToast.saleId,
        reason: 'Deshecho desde Carga Rápida'
      });
      setUndoToast(null);
      onSaleCreated(false);
    } catch (err) {
      window.alert(err.message || 'No se pudo anular la venta.');
    }
  };

  const handleSellerKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = sellerInput.trim();
      const parts = val.split(/\s+/);
      if (parts.length >= 2) {
        const rawNum = parts[0];
        const num = parseInt(rawNum, 10);
        const parsedAmount = parts[1];
        const methodChar = (parts[2] || '').toLowerCase();
        const parsedMethod = methodChar.startsWith('t') ? 'transferencia' : 'efectivo';
        const matched = (rawNum === '00' || rawNum === '0')
          ? activeSellers.find((s) => s.name.toLowerCase().trim() === 'mostrador')
          : (sellerByNumber.get(rawNum) || sellerByNumber.get(num));
        if (matched && amountOk(parsedAmount)) {
          executeSale(matched, parsedAmount, parsedMethod);
          return;
        }
      }

      if (parsedSeller && amountRef.current) {
        amountRef.current.focus();
      }
    }
  };

  const handleAmountKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSale(parsedSeller, amount, method);
    }
  };

  const addAmount = (plus) => {
    const current = Number(amount) || 0;
    setAmount(String(current + plus));
    if (amountRef.current) amountRef.current.focus();
  };

  const sortedSellers = useMemo(() => {
    return [...activeSellers].sort((a, b) => {
      const isA = a.name.toLowerCase().trim() === 'mostrador';
      const isB = b.name.toLowerCase().trim() === 'mostrador';
      if (isA) return -1;
      if (isB) return 1;
      return (Number(numberMap[a.id]) || 99) - (Number(numberMap[b.id]) || 99);
    });
  }, [activeSellers, numberMap]);

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '2px solid var(--accent-gold, #D97706)',
      borderRadius: '16px',
      padding: '16px 18px',
      marginBottom: '16px',
      boxShadow: '0 4px 20px rgba(217, 119, 6, 0.12)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: 'rgba(217, 119, 6, 0.16)',
            color: 'var(--accent-gold, #D97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Zap size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Carga Rápida Express <span style={{ fontSize: '0.72rem', backgroundColor: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: '6px', fontWeight: 800 }}>⚡ HORA PICO</span>
            </h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Tocá la vendedora o poné su N° (<strong>00 Mostrador</strong>, 1-20) + monto. Podés escribir <code>00 25000</code> y dar Enter directo.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenNumbersModal}
          className="btn-secondary"
          style={{ padding: '4px 9px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          title="Asignar o cambiar los números del 1 al 20 de las vendedoras"
        >
          <Settings size={13} /> Asignar N° (1-20)
        </button>
      </div>

      {/* Botonera / Chips táctiles (00 Mostrador y 1 al 20) */}
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        paddingBottom: '8px',
        marginBottom: '12px',
        scrollbarWidth: 'thin'
      }}>
        {sortedSellers.map((s) => {
          const isMostrador = s.name.toLowerCase().trim() === 'mostrador';
          const num = isMostrador ? '00' : (numberMap[s.id] || '');
          const isSelected = parsedSeller?.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectChip(s)}
              title={isMostrador ? 'Mostrador: clientes que se atienden solos y pagan directo en caja' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '10px',
                border: isSelected
                  ? '2px solid var(--accent-gold, #D97706)'
                  : isMostrador
                    ? '1.5px solid #93C5FD'
                    : '1px solid var(--border-color)',
                backgroundColor: isSelected
                  ? 'var(--accent-gold, #D97706)'
                  : isMostrador
                    ? 'rgba(59, 130, 246, 0.08)'
                    : 'var(--bg-surface-elevated)',
                color: isSelected
                  ? '#FFFFFF'
                  : isMostrador
                    ? '#1E40AF'
                    : 'var(--text-main)',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 2px 8px rgba(217, 119, 6, 0.4)' : 'none'
              }}
            >
              <span style={{
                backgroundColor: isSelected
                  ? 'rgba(0,0,0,0.25)'
                  : isMostrador
                    ? '#2563EB'
                    : 'rgba(0,0,0,0.07)',
                color: isSelected || isMostrador ? '#FFFFFF' : 'var(--text-main)',
                padding: '1px 6px',
                borderRadius: '6px',
                fontSize: '0.76rem',
                fontWeight: 900
              }}>
                #{num}
              </span>
              <span>{s.name}</span>
            </button>
          );
        })}
      </div>

      {/* Inputs Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1.2fr) minmax(160px, 1.5fr) minmax(180px, 1fr) minmax(130px, auto)',
        gap: '10px',
        alignItems: 'start'
      }}>
        {/* N° Vendedora */}
        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
            N° Vendedora (00 o 1-20)
          </label>
          <input
            ref={sellerInputRef}
            type="text"
            value={sellerInput}
            onChange={(e) => {
              setSellerInput(e.target.value);
              setSelectedSellerId(null);
              setError('');
            }}
            onKeyDown={handleSellerKeyDown}
            placeholder="Ej: 00 o 4"
            className="form-input"
            style={{ width: '100%', fontSize: '1.05rem', fontWeight: 800, padding: '9px 12px' }}
          />
          {parsedSeller ? (
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#047857', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Check size={14} /> #{numberMap[parsedSeller.id] || (parsedSeller.name.toLowerCase().trim() === 'mostrador' ? '00' : '')} {parsedSeller.name} {parsedSeller.name.toLowerCase().trim() === 'mostrador' ? '(Directo Caja)' : ''}
            </div>
          ) : sellerInput.trim() !== '' ? (
            <div style={{ fontSize: '0.72rem', color: '#B91C1C', fontWeight: 600, marginTop: '3px' }}>
              No hay vendedora con N° {sellerInput.trim().split(/\s+/)[0]}
            </div>
          ) : (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              00 Mostrador o N° 1-20
            </div>
          )}
        </div>

        {/* Monto */}
        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
            Monto $
          </label>
          <input
            ref={amountRef}
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.trim());
              setError('');
            }}
            onKeyDown={handleAmountKeyDown}
            placeholder="$ 0"
            className="form-input"
            style={{ width: '100%', fontSize: '1.15rem', fontWeight: 900, padding: '8px 12px' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginTop: '3px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {amountOk(amount) ? `= ${money(amount)}` : 'Entero sin puntos'}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button type="button" onClick={() => addAmount(10000)} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)', cursor: 'pointer', fontWeight: 700 }}>+10k</button>
              <button type="button" onClick={() => addAmount(50000)} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)', cursor: 'pointer', fontWeight: 700 }}>+50k</button>
            </div>
          </div>
        </div>

        {/* Método Toggle */}
        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
            Medio de pago
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setMethod('efectivo')}
              style={{
                padding: '9px 4px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                border: method === 'efectivo' ? '2px solid var(--text-main)' : '1px solid var(--border-color)',
                backgroundColor: method === 'efectivo' ? 'var(--text-main)' : 'var(--bg-surface-elevated)',
                color: method === 'efectivo' ? 'var(--bg-page)' : 'var(--text-main)'
              }}
            >
              Efectivo (E)
            </button>
            <button
              type="button"
              onClick={() => setMethod('transferencia')}
              style={{
                padding: '9px 4px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                border: method === 'transferencia' ? '2px solid var(--text-main)' : '1px solid var(--border-color)',
                backgroundColor: method === 'transferencia' ? 'var(--text-main)' : 'var(--bg-surface-elevated)',
                color: method === 'transferencia' ? 'var(--bg-page)' : 'var(--text-main)'
              }}
            >
              Transfer (T)
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'transparent', marginBottom: '3px' }}>
            Confirmar
          </label>
          <button
            type="button"
            disabled={busy || !parsedSeller || !amountOk(amount)}
            onClick={() => executeSale(parsedSeller, amount, method)}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '10px 14px',
              justifyContent: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9rem',
              fontWeight: 800,
              backgroundColor: 'var(--accent-gold, #D97706)',
              borderColor: 'var(--accent-gold, #D97706)',
              cursor: (!parsedSeller || !amountOk(amount) || busy) ? 'not-allowed' : 'pointer'
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Cargar Venta
          </button>
        </div>
      </div>

      {/* Alerta de Alias al cobrar por Transferencia */}
      {method === 'transferencia' && (
        <div style={{
          marginTop: '10px',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '0.82rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          backgroundColor: isTransferOver ? '#FEF2F2' : isTransferNear ? '#FFFBEB' : '#ECFDF5',
          color: isTransferOver ? '#B91C1C' : isTransferNear ? '#92400E' : '#047857',
          border: `1px solid ${isTransferOver ? '#FCA5A5' : isTransferNear ? '#FDE68A' : '#A7F3D0'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isTransferOver ? <AlertCircle size={16} /> : isTransferNear ? <AlertTriangle size={16} /> : <Check size={16} />}
            <span>
              {isTransferOver ? (
                <><strong>🚨 ALIAS EN EL TOPE:</strong> <code>{dailyAlias?.alias || 'hoy'}</code> superó el límite ({money(dayTransferTotal)} de {money(aliasLimit)}).</>
              ) : isTransferNear ? (
                <><strong>⚠️ ALERTA:</strong> <code>{dailyAlias?.alias || 'hoy'}</code> al {transferPct}%. Restan <strong>{money(transferRemaining)}</strong>.</>
              ) : (
                <><strong>🏦 Alias del día:</strong> <code>{dailyAlias?.alias || 'hoy'}</code> · Disponible: <strong>{money(transferRemaining)}</strong>.</>
              )}
            </span>
          </div>
          <span
            style={{ fontSize: '0.74rem', textDecoration: 'underline', cursor: 'pointer', flexShrink: 0 }}
            onClick={() => {
              if (dailyAlias?.alias) navigator.clipboard.writeText(dailyAlias.alias);
            }}
            title="Copiar alias"
          >
            Copiar alias
          </span>
        </div>
      )}

      {error && (
        <div role="alert" style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700 }}>
          {error}
        </div>
      )}

      {/* Undo Toast */}
      {undoToast && (
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          backgroundColor: '#ECFDF5',
          border: '1.5px solid #10B981',
          color: '#065F46',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 2px 10px rgba(16, 185, 129, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '0.88rem' }}>
            <Check size={18} style={{ color: '#059669' }} />
            <span>
              ✓ Venta de <strong>{money(undoToast.amount)}</strong> cargada a <strong>#{undoToast.sellerNum} {undoToast.sellerName}</strong> ({METHOD_LABEL[undoToast.method]})
            </span>
          </div>
          <button
            type="button"
            onClick={handleUndo}
            className="btn-secondary"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#B91C1C',
              borderColor: '#FECACA',
              fontWeight: 800,
              padding: '5px 12px',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer'
            }}
          >
            <Undo2 size={14} /> Deshacer venta ({countdown}s)
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Modal Configurar Alias del Día
function DailyAliasModal({ date, currentConfig, onClose, onSave }) {
  const [alias, setAlias] = useState(currentConfig?.alias || '');
  const [limit, setLimit] = useState(String(currentConfig?.limit || 1000000));
  const [holder, setHolder] = useState(currentConfig?.holder || '');
  const [bank, setBank] = useState(currentConfig?.bank || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!alias.trim()) {
      setError('Escribí el alias bancario.');
      return;
    }
    if (!amountOk(limit)) {
      setError('Ingresá el monto tope en pesos sin puntos (ej: 800000).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        alias: alias.trim().toLowerCase(),
        limit: Number(limit),
        holder: holder.trim(),
        bank: bank.trim()
      });
    } catch (err) {
      setError(err.message || 'Error al guardar');
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Configurar Alias del Día y Tope"
      subtitle={`Definí el alias bancario y el monto límite para ${fmtDate(date)}`}
      onClose={onClose}
      maxWidth="460px"
    >
      <form onSubmit={handleSave}>
        {error && (
          <div role="alert" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#B91C1C', backgroundColor: '#FEF2F2', padding: '8px 10px', borderRadius: '8px', marginBottom: '10px' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
            Alias de transferencia / CVU *
          </label>
          <input
            type="text"
            required
            autoFocus
            value={alias}
            onChange={(e) => setAlias(e.target.value.toLowerCase().trim())}
            placeholder="ej: dulce.valentin.rioja"
            className="form-input"
            style={{ width: '100%', fontSize: '1.05rem', fontWeight: 800 }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            El alias que se le pasará a los clientes hoy para abonar.
          </span>
        </div>

        <AmountInput
          label="Monto Tope del Alias *"
          value={limit}
          onChange={setLimit}
          placeholder="800000"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Titular de la cuenta
            </label>
            <input
              type="text"
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              placeholder="ej: Micaela Gómez"
              className="form-input"
              style={{ width: '100%', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Banco / Billetera
            </label>
            <input
              type="text"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="ej: Banco Galicia / MP"
              className="form-input"
              style={{ width: '100%', fontSize: '0.9rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar Alias y Tope
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Modal Carga Directa de Transferencia
function DirectTransferModal({ date, sellers, numberMap, onClose, onSave }) {
  const [selectedSellerId, setSelectedSellerId] = useState(sellers[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!selectedSellerId) {
      setError('Elegí la vendedora asignada a la transferencia.');
      return;
    }
    if (!amountOk(amount)) {
      setError('Ingresá el monto de la transferencia en pesos sin puntos.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        sellerId: selectedSellerId,
        amount: Number(amount),
        note: note.trim() || 'Transferencia directa'
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar');
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Registrar Transferencia"
      subtitle={`Cargar transferencia bancaria en ${fmtDate(date)}`}
      onClose={onClose}
      maxWidth="420px"
    >
      <form onSubmit={handleSave}>
        {error && (
          <div role="alert" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#B91C1C', backgroundColor: '#FEF2F2', padding: '8px 10px', borderRadius: '8px', marginBottom: '10px' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
            Vendedora
          </label>
          <select
            value={selectedSellerId}
            onChange={(e) => setSelectedSellerId(e.target.value)}
            className="form-input"
            style={{ width: '100%', fontSize: '0.95rem', fontWeight: 700 }}
          >
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {numberMap[s.id] ? `#${numberMap[s.id]} ` : ''}{s.name}
              </option>
            ))}
          </select>
        </div>

        <AmountInput
          label="Monto de la transferencia *"
          value={amount}
          onChange={setAmount}
          placeholder="ej: 35000"
          autoFocus
        />

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
            Nota / Comprobante (opcional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ej: Comprobante #19284 / Juan Pérez"
            className="form-input"
            style={{ width: '100%', fontSize: '0.9rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Registrar Transferencia
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Sección Alias del Día y Control de Transferencias
function DailyAliasSection({
  date,
  aliasConfig,
  transfers = [],
  sellers = [],
  numberMap = {},
  onConfigClick,
  onAddTransferClick,
  onRefresh
}) {
  const [copied, setCopied] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [voidingId, setVoidingId] = useState(null);

  const totalTransfers = useMemo(() => {
    return (transfers || []).reduce((acc, t) => acc + (t.amount || 0), 0);
  }, [transfers]);

  const limit = Number(aliasConfig?.limit) || 1000000;
  const remaining = limit - totalTransfers;
  const pct = Math.round((totalTransfers / (limit || 1)) * 100);
  const isOver = totalTransfers >= limit;
  const isNear = !isOver && pct >= 80;

  const copyAlias = () => {
    if (!aliasConfig?.alias) return;
    navigator.clipboard.writeText(aliasConfig.alias);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportExcelForMica = async () => {
    setExportingExcel(true);
    try {
      await downloadTransferenciasExcelForMica({
        date,
        aliasConfig,
        transfers,
        totalTransfers,
        remaining,
        limit
      });
    } catch (err) {
      window.alert(err.message || 'Error al exportar Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleSendWhatsAppToMica = () => {
    const text = transferenciasWhatsAppText({
      date,
      aliasConfig,
      transfers,
      totalTransfers,
      remaining,
      limit
    });
    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const handleVoidTransfer = async (transfer) => {
    if (!window.confirm(`¿Seguro que querés anular la transferencia de ${money(transfer.amount)} cargada a ${transfer.sellerName}?`)) {
      return;
    }
    const reason = window.prompt('Motivo de anulación:', 'Error en carga de transferencia');
    if (!reason || !reason.trim()) return;

    setVoidingId(transfer.id);
    try {
      await api('POST', {
        action: 'void',
        kind: 'sale',
        id: transfer.id,
        reason: reason.trim()
      });
      onRefresh();
    } catch (err) {
      window.alert(err.message || 'No se pudo anular la transferencia');
    } finally {
      setVoidingId(null);
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: `2px solid ${isOver ? '#DC2626' : isNear ? '#D97706' : 'var(--border-color)'}`,
      borderRadius: '16px',
      padding: '18px 20px',
      marginBottom: '16px',
      boxShadow: isOver ? '0 4px 20px rgba(220, 38, 38, 0.15)' : '0 2px 12px rgba(0,0,0,0.04)',
      transition: 'border-color 0.2s, box-shadow 0.2s'
    }}>
      {/* Cabecera de la Sección */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: isOver ? '#FEF2F2' : isNear ? '#FFFBEB' : 'rgba(13, 148, 136, 0.12)',
            color: isOver ? '#DC2626' : isNear ? '#D97706' : '#0D9488',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Landmark size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)' }}>
                Alias del Día y Control de Transferencias
              </h3>
              {/* Badge de Estado del Límite */}
              <span style={{
                fontSize: '0.74rem',
                fontWeight: 900,
                padding: '3px 9px',
                borderRadius: '6px',
                letterSpacing: '0.02em',
                backgroundColor: isOver ? '#DC2626' : isNear ? '#F59E0B' : '#10B981',
                color: '#FFFFFF',
                boxShadow: isOver ? '0 0 10px rgba(220, 38, 38, 0.5)' : undefined
              }}>
                {isOver ? `🚨 TOPE ALCANZADO (${pct}%)` : isNear ? `⚠️ CERCA DEL TOPE (${pct}%)` : `✅ ACTIVO (${pct}%)`}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Monitoreo automático en tiempo real para Micaela · Conciliación y alertas de tope
            </p>
          </div>
        </div>

        {/* Acciones principales */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onConfigClick}
            className="btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Settings size={13} /> Configurar Alias y Tope
          </button>

          <button
            type="button"
            onClick={handleExportExcelForMica}
            disabled={exportingExcel}
            className="btn-secondary"
            style={{ padding: '6px 11px', fontSize: '0.78rem', fontWeight: 800, color: '#047857', borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            title="Descargar archivo Excel con el detalle exclusivo de transferencias para Mica"
          >
            {exportingExcel ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
            Excel para Mica
          </button>

          <button
            type="button"
            onClick={handleSendWhatsAppToMica}
            className="btn-secondary"
            style={{ padding: '6px 11px', fontSize: '0.78rem', fontWeight: 800, color: '#15803D', borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            title="Enviar reporte completo con detalle de transferencias a Mica por WhatsApp"
          >
            <Send size={13} /> WhatsApp a Mica
          </button>
        </div>
      </div>

      {/* Alerta Inteligente Automática */}
      <div style={{
        padding: '12px 14px',
        borderRadius: '12px',
        marginBottom: '14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        backgroundColor: isOver ? '#FEF2F2' : isNear ? '#FFFBEB' : '#F0FDF4',
        border: `1px solid ${isOver ? '#FCA5A5' : isNear ? '#FDE68A' : '#BBF7D0'}`,
        color: isOver ? '#991B1B' : isNear ? '#92400E' : '#166534'
      }}>
        {isOver ? <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#DC2626' }} /> : isNear ? <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#D97706' }} /> : <Check size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#16A34A' }} />}
        <div style={{ flex: 1, fontSize: '0.86rem' }}>
          {isOver ? (
            <>
              <div style={{ fontWeight: 900, fontSize: '0.92rem', marginBottom: '2px' }}>🚨 ¡LÍMITE ALCANZADO EN EL ALIAS!</div>
              El alias <strong>{aliasConfig?.alias || 'del día'}</strong> ya completó el tope diario de <strong>{money(limit)}</strong> (total recaudado: <strong>{money(totalTransfers)}</strong>). Cambiá el alias en <strong>&ldquo;Configurar Alias y Tope&rdquo;</strong> para no seguir recibiendo transferencias en esta cuenta.
            </>
          ) : isNear ? (
            <>
              <div style={{ fontWeight: 900, fontSize: '0.92rem', marginBottom: '2px' }}>⚠️ ¡ATENCIÓN! PRÓXIMO A ALCANZAR EL TOPE</div>
              El alias <strong>{aliasConfig?.alias || 'del día'}</strong> está al <strong>{pct}%</strong> de su capacidad máxima. Restan solo <strong>{money(remaining)}</strong> disponibles antes de alcanzar el límite de <strong>{money(limit)}</strong>.
            </>
          ) : (
            <>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '2px' }}>✓ Alias operativo y con margen disponible</div>
              Lleva <strong>{money(totalTransfers)}</strong> transferidos ({pct}%). Restan <strong>{money(remaining)}</strong> disponibles hasta alcanzar el tope de <strong>{money(limit)}</strong>.
            </>
          )}
        </div>
      </div>

      {/* Tarjetas de Métricas (4 KPIs) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {/* Alias */}
        <div style={{ backgroundColor: 'var(--bg-surface-elevated, var(--bg-card))', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Alias Activo</span>
            <button
              type="button"
              onClick={copyAlias}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#059669' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: 800 }}
              title="Copiar alias al portapapeles"
            >
              {copied ? <CheckCheck size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {aliasConfig?.alias || 'Sin definir'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {aliasConfig?.holder || 'Sin titular'} {aliasConfig?.bank ? `· ${aliasConfig.bank}` : ''}
          </div>
        </div>

        {/* Monto Tope */}
        <div style={{ backgroundColor: 'var(--bg-surface-elevated, var(--bg-card))', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Tope Establecido</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)' }}>{money(limit)}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Límite máximo del día</div>
        </div>

        {/* Total Transferido */}
        <div style={{ backgroundColor: 'var(--bg-surface-elevated, var(--bg-card))', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Total Transferido Hoy</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: isOver ? '#DC2626' : 'var(--text-main)' }}>{money(totalTransfers)}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{transfers.length} transferencias registradas</div>
        </div>

        {/* Restante */}
        <div style={{ backgroundColor: 'var(--bg-surface-elevated, var(--bg-card))', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Disponible / Resto</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: remaining >= 0 ? '#047857' : '#DC2626' }}>
            {remaining >= 0 ? money(remaining) : `Exceso: ${money(-remaining)}`}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {remaining >= 0 ? `${100 - Math.min(100, pct)}% de margen libre` : 'Excedido del límite'}
          </div>
        </div>
      </div>

      {/* Barra de Progreso */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800, marginBottom: '5px' }}>
          <span>Progreso del Tope</span>
          <span style={{ color: isOver ? '#DC2626' : isNear ? '#D97706' : '#047857' }}>
            {pct}% ({money(totalTransfers)} de {money(limit)})
          </span>
        </div>
        <div style={{ height: '10px', borderRadius: '999px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, pct)}%`,
            borderRadius: '999px',
            backgroundColor: isOver ? '#DC2626' : isNear ? '#F59E0B' : '#10B981',
            transition: 'width 0.4s ease'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px' }}>
          <span>$0</span>
          <span>80% ({money(limit * 0.8)})</span>
          <span>100% ({money(limit)})</span>
        </div>
      </div>

      {/* Historial de Transferencias y Hora */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={16} style={{ color: 'var(--text-muted)' }} />
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800 }}>
              Historial de Transferencias ({transfers.length})
            </h4>
          </div>

          <button
            type="button"
            onClick={onAddTransferClick}
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={13} /> Cargar transferencia
          </button>
        </div>

        {transfers.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem', backgroundColor: 'var(--bg-surface-elevated, var(--bg-card))', borderRadius: '10px' }}>
            No hay transferencias registradas para esta fecha. Al registrar una venta con método <strong>Transferencia</strong> o usar <strong>Cargar transferencia</strong>, aparecerá aquí con su hora y vendedora.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '7px 8px', fontWeight: 700 }}>Hora</th>
                  <th style={{ padding: '7px 8px', fontWeight: 700 }}>Monto</th>
                  <th style={{ padding: '7px 8px', fontWeight: 700 }}>Vendedora</th>
                  <th style={{ padding: '7px 8px', fontWeight: 700 }}>Nota / Detalle</th>
                  <th style={{ padding: '7px 8px', fontWeight: 700, textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => {
                  const hourStr = t.createdAt ? new Date(t.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: voidingId === t.id ? 0.4 : 1 }}>
                      <td style={{ padding: '8px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {hourStr} hs
                      </td>
                      <td style={{ padding: '8px', fontWeight: 900, color: '#047857', whiteSpace: 'nowrap', fontSize: '0.92rem' }}>
                        {money(t.amount)}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {numberMap[t.sellerId] ? (
                          <span style={{ backgroundColor: 'var(--accent-gold, #D97706)', color: '#FFF', fontSize: '0.72rem', padding: '1px 5px', borderRadius: '4px', marginRight: '5px', fontWeight: 900 }}>
                            #{numberMap[t.sellerId]}
                          </span>
                        ) : null}
                        {t.sellerName}
                      </td>
                      <td style={{ padding: '8px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.note || '—'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleVoidTransfer(t)}
                          disabled={voidingId === t.id}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#DC2626',
                            cursor: 'pointer',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}
                          title="Anular esta transferencia"
                        >
                          ✕ Anular
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function GoalThermometer({ period, total, salesCount, goal, onEditGoal }) {
  const pct = goal > 0 ? Math.round((total / goal) * 100) : 0;
  const barWidth = Math.min(Math.max(pct, 0), 100);
  const isReached = total >= goal;
  const remaining = Math.max(0, goal - total);
  const diffExceeded = Math.max(0, total - goal);
  const avgTicket = salesCount > 0 ? Math.round(total / salesCount) : 0;

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: isReached ? '2px solid #10B981' : '1px solid var(--border-color)',
      borderRadius: '16px',
      padding: '16px 18px',
      marginBottom: '16px',
      boxShadow: isReached ? '0 4px 16px rgba(16, 185, 129, 0.12)' : 'none',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            backgroundColor: isReached ? '#ECFDF5' : '#F3E8FF',
            color: isReached ? '#059669' : '#7C3AED',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isReached ? <Sparkles size={18} /> : <Target size={18} />}
          </div>
          <div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Termómetro de ventas · Meta {PERIODS[period]}
            </h3>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Objetivo fijado: <strong>{money(goal)}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '0.84rem',
            fontWeight: 900,
            padding: '4px 10px',
            borderRadius: '20px',
            backgroundColor: isReached ? '#ECFDF5' : pct >= 70 ? '#EFF6FF' : '#FFFBEB',
            color: isReached ? '#047857' : pct >= 70 ? '#1D4ED8' : '#B45309',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {isReached ? `🎉 ${pct}% Superado` : `${pct}% alcanzado`}
          </span>
          <button
            type="button"
            onClick={onEditGoal}
            className="btn-secondary"
            style={{ padding: '5px 9px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Cambiar objetivo de ventas"
          >
            <Pencil size={13} /> Ajustar meta
          </button>
        </div>
      </div>

      <div style={{
        width: '100%',
        height: '16px',
        backgroundColor: 'var(--bg-surface-elevated)',
        borderRadius: '9999px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        position: 'relative',
        marginBottom: '10px'
      }}>
        <div style={{
          width: `${barWidth}%`,
          height: '100%',
          borderRadius: '9999px',
          background: isReached
            ? 'linear-gradient(90deg, #10B981 0%, #059669 100%)'
            : pct >= 70
            ? 'linear-gradient(90deg, #6366F1 0%, #8B5CF6 100%)'
            : 'linear-gradient(90deg, #EC4899 0%, #8B5CF6 100%)',
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isReached ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none'
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.8rem' }}>
        <div style={{ fontWeight: 600 }}>
          {isReached ? (
            <span style={{ color: '#047857', fontWeight: 800 }}>
              ¡Meta del local cumplida! Superada por <strong>{money(diffExceeded)}</strong>
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>
              Faltan <strong style={{ color: 'var(--text-main)' }}>{money(remaining)}</strong> para alcanzar los {money(goal)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '14px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          <span>Operaciones: <strong style={{ color: 'var(--text-main)' }}>{salesCount}</strong></span>
          <span>Ticket promedio local: <strong style={{ color: 'var(--text-main)' }}>{avgTicket > 0 ? money(avgTicket) : '−'}</strong></span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Ranking
function Ranking({ data }) {
  const rows = [...data.sellers].filter((s) => s.total > 0 || s.prevTotal > 0).sort((a, b) => b.total - a.total);
  if (rows.length === 0) return null;
  const prevLabel = { day: 'el día anterior', week: 'la semana anterior', month: 'el mes anterior' }[data.period];
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px', marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
          <Trophy size={17} style={{ color: '#F59E0B' }} /> Ranking del período
        </h3>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {rows.length} {rows.length === 1 ? 'vendedora' : 'vendedoras'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rows.map((s, i) => {
          const change = s.prevTotal > 0 ? Math.round(((s.total - s.prevTotal) / s.prevTotal) * 100) : null;
          const avgTicket = s.salesCount > 0 ? Math.round(s.total / s.salesCount) : 0;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', backgroundColor: 'var(--bg-surface-elevated)', fontSize: '0.88rem' }}>
              <strong style={{ width: '24px', textAlign: 'center', fontSize: '1rem' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
              </strong>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 800 }}>{s.name}</span>
                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {s.salesCount} vta{s.salesCount === 1 ? '' : 's'} · Ticket prom: <strong style={{ color: 'var(--text-main)' }}>{avgTicket > 0 ? money(avgTicket) : '−'}</strong>
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ display: 'block' }}>{money(s.total)}</strong>
                <span style={{ fontSize: '0.74rem', color: change === null ? 'var(--text-muted)' : change >= 0 ? '#047857' : '#B91C1C', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                  {change === null ? `sin ventas ${prevLabel}` : <>{change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{change >= 0 ? '+' : ''}{change}%</>}
                </span>
              </div>
            </div>
          );
        })}
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
  const [payoutSeller, setPayoutSeller] = useState(null);
  const [showCash, setShowCash] = useState(false);
  const [detailSeller, setDetailSeller] = useState(null);
  const [queueSize, setQueueSize] = useState(0);
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [sellerNumbersMap, setSellerNumbersMap] = useState({});
  const [showNumbersModal, setShowNumbersModal] = useState(false);
  const [showAliasModal, setShowAliasModal] = useState(false);
  const [showDirectTransferModal, setShowDirectTransferModal] = useState(false);

  useEffect(() => {
    setGoals(readGoals());
    setSellerNumbersMap(readSellerNumbers());
  }, []);

  const assignedNumbers = useMemo(() => {
    if (!data?.sellers) return {};
    return getAssignedSellerNumbers(data.sellers, sellerNumbersMap);
  }, [data?.sellers, sellerNumbersMap]);

  const updateSellerNumbers = (newMap) => {
    setSellerNumbersMap(newMap);
    writeSellerNumbers(newMap);
  };

  const updateGoal = (newAmount) => {
    const updated = { ...goals, [period]: newAmount };
    setGoals(updated);
    writeGoals(updated);
  };

  const handleSaveDailyAlias = async (newConfig) => {
    try {
      await api('POST', {
        action: 'setDailyAlias',
        date,
        alias: newConfig.alias,
        limit: newConfig.limit,
        holder: newConfig.holder,
        bank: newConfig.bank
      });
      setShowAliasModal(false);
      load();
    } catch (err) {
      window.alert(err.message || 'No se pudo guardar el alias.');
    }
  };

  const handleDirectTransfer = async ({ sellerId, amount, note }) => {
    const clientRef = crypto.randomUUID();
    const { queued } = await sendOrQueue({
      action: 'addSale',
      clientRef,
      sellerId,
      date,
      amount,
      method: 'transferencia',
      note: note || 'Transferencia directa'
    });
    afterSave(queued);
  };

  // Excel del periodo: pide todos los movimientos (incluidos los anulados)
  // y arma un .xlsx con Resumen, Ventas, Vales, Pagos y Caja.
  const exportExcel = async () => {
    setExporting(true);
    try {
      const full = await api('GET', null, `?period=${period}&date=${date}&export=1`);
      await downloadVentasExcel(full);
    } catch (err) {
      window.alert(err.message || 'No se pudo generar el Excel.');
    } finally {
      setExporting(false);
    }
  };

  // Cierre por WhatsApp: el texto se arma con lo que se ve en pantalla.
  const sendCierre = () => {
    if (!data) return;
    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(cierreText(data))}`, '_blank', 'noopener');
  };

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
    commission: t.commission + s.commission, advances: t.advances + s.advances, paid: t.paid + s.paid, balance: t.balance + s.balance,
    salesCount: t.salesCount + s.salesCount
  }), { total: 0, cash: 0, transfer: 0, commission: 0, advances: 0, paid: 0, balance: 0, salesCount: 0 });

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
            {data && (
              <button type="button" onClick={sendCierre} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#25D366', borderColor: '#25D366' }} title="Abre WhatsApp con el resumen para Mica">
                <Send size={14} /> {period === 'day' ? 'Enviar cierre a Mica' : 'Enviar resumen a Mica'}
              </button>
            )}
            {data && (
              <button type="button" onClick={exportExcel} disabled={exporting} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Excel
              </button>
            )}
            <a href="/supervisor" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '0.8rem' }} title="Acceso exclusivo supervisora">
              🔒 Panel Supervisora
            </a>
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

            {/* Carga Rápida Express (Hora Pico) */}
            {period === 'day' && (
              <QuickSaleBar
                sellers={data.sellers}
                numberMap={assignedNumbers}
                date={date}
                dailyAlias={data.dailyAlias}
                dayTransfers={data.dayTransfers}
                onSaleCreated={afterSave}
                onOpenNumbersModal={() => setShowNumbersModal(true)}
              />
            )}

            {/* Alias del Día y Control de Transferencias */}
            {period === 'day' && (
              <DailyAliasSection
                date={date}
                aliasConfig={data.dailyAlias}
                transfers={data.dayTransfers || []}
                sellers={data.sellers}
                numberMap={assignedNumbers}
                onConfigClick={() => setShowAliasModal(true)}
                onAddTransferClick={() => setShowDirectTransferModal(true)}
                onRefresh={load}
              />
            )}

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        backgroundColor: s.name.toLowerCase().trim() === 'mostrador' ? '#2563EB' : 'var(--accent-gold, #D97706)',
                        color: '#FFFFFF',
                        fontSize: '0.82rem',
                        fontWeight: 900,
                        padding: '2px 8px',
                        borderRadius: '7px',
                        letterSpacing: '0.02em',
                        boxShadow: s.name.toLowerCase().trim() === 'mostrador' ? '0 1px 3px rgba(37, 99, 235, 0.3)' : '0 1px 3px rgba(217, 119, 6, 0.3)'
                      }}>
                        #{assignedNumbers[s.id] || (s.name.toLowerCase().trim() === 'mostrador' ? '00' : '?')}
                      </span>
                      <button type="button" onClick={stop(() => setDetailSeller(s))} title="Ver historial" style={{ background: 'none', border: 'none', padding: 0, fontSize: '1.05rem', fontWeight: 900, cursor: 'pointer', color: 'var(--text-main)', textDecoration: 'underline' }}>{s.name}</button>
                      {s.name.toLowerCase().trim() === 'mostrador' && (
                        <span style={{ fontSize: '0.72rem', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          Autoservicio / Directo caja
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.salesCount} venta{s.salesCount === 1 ? '' : 's'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.86rem', marginBottom: '10px' }}>
                    <span>Total vendido</span><strong style={{ textAlign: 'right' }}>{money(s.total)}</strong>
                    <span>Ticket promedio</span><strong style={{ textAlign: 'right', color: 'var(--text-main)' }}>{s.salesCount > 0 ? money(Math.round(s.total / s.salesCount)) : '−'}</strong>
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
                      {s.name.toLowerCase().trim() === 'mostrador' ? (
                        <span style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.76rem' }}>0% (Sin comisión · Venta directa caja)</span>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  )}

                  {s.active && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={stop(() => setEntry({ kind: 'sale', seller: s }))} className="btn-primary" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 4px' }}>
                        <Plus size={15} /> Venta
                      </button>
                      {s.name.toLowerCase().trim() !== 'mostrador' && (
                        <>
                          <button type="button" onClick={stop(() => setEntry({ kind: 'advance', seller: s }))} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 4px' }}>
                            <HandCoins size={15} /> Vale
                          </button>
                          <button type="button" onClick={stop(() => setPayoutSeller(s))} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 4px' }}>
                            <Banknote size={15} /> Liquidar
                          </button>
                        </>
                      )}
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
        {showGoalModal && (
          <GoalEditModal
            period={period}
            currentGoal={goals[period] || DEFAULT_GOALS[period]}
            onClose={() => setShowGoalModal(false)}
            onSave={updateGoal}
          />
        )}
        {showNumbersModal && data?.sellers && (
          <SellerNumbersModal
            sellers={data.sellers}
            currentMap={assignedNumbers}
            onClose={() => setShowNumbersModal(false)}
            onSave={updateSellerNumbers}
          />
        )}
        {showAliasModal && (
          <DailyAliasModal
            date={date}
            currentConfig={data?.dailyAlias}
            onClose={() => setShowAliasModal(false)}
            onSave={handleSaveDailyAlias}
          />
        )}
        {showDirectTransferModal && data?.sellers && (
          <DirectTransferModal
            date={date}
            sellers={data.sellers}
            numberMap={assignedNumbers}
            onClose={() => setShowDirectTransferModal(false)}
            onSave={handleDirectTransfer}
          />
        )}
      </div>
    </div>
  );
}
