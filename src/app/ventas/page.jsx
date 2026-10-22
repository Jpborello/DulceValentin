'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Users, Plus, Wallet, HandCoins, Loader2, LogOut, X, Download, CloudOff, ChevronLeft, ChevronRight, Save, Banknote, Receipt, Calculator, Trophy, TrendingUp, TrendingDown, History, Send, Target, Sparkles, Pencil, Zap, Undo2, Settings, Check, Building2, AlertTriangle, AlertCircle, Copy, CheckCheck, FileSpreadsheet, Clock, Landmark, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { adminFetch } from '@/lib/adminFetch';
import AliasManager from '@/components/AliasManager';
import { pickAlias, aliasStatus, aliasRemaining, aliasRules } from '@/lib/aliasPick';
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
const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', dividido: 'Dividido (Efvo + Transf)' };
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

function MethodToggle({ value, onChange, showDivided = false }) {
  const options = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    ...(showDivided ? { dividido: '⚡ Dividido (Efvo + Transf)' } : {})
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: showDivided ? '1fr 1fr 1.3fr' : '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
      {Object.entries(options).map(([id, label]) => (
        <button key={id} type="button" onClick={() => onChange(id)}
          style={{ padding: '9px 6px', borderRadius: '10px', fontSize: showDivided ? '0.78rem' : '0.85rem', fontWeight: 800, cursor: 'pointer', border: value === id ? (id === 'dividido' ? '2px solid #D97706' : '2px solid var(--text-main)') : '1px solid var(--border-color)', backgroundColor: value === id ? (id === 'dividido' ? '#FEF3C7' : 'var(--text-main)') : 'var(--bg-card)', color: value === id ? (id === 'dividido' ? '#92400E' : 'var(--bg-page)') : 'var(--text-main)' }}>
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
function EntryModal({ kind, seller, date, aliases = [], onClose, onSaved, onOpenSharedModal }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('efectivo');
  const [cashAmount, setCashAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aliasChoice, setAliasChoice] = useState(null);
  const [copied, setCopied] = useState('');
  const isSale = kind === 'sale';
  const isDivided = isSale && method === 'dividido';
  const isTransfer = method === 'transferencia';

  const totalNum = isDivided
    ? ((amountOk(cashAmount) ? Number(cashAmount) : 0) + (amountOk(transferAmount) ? Number(transferAmount) : 0))
    : (Number(amount) || 0);

  const transferNum = isDivided ? (Number(transferAmount) || 0) : (Number(amount) || 0);
  const activeAliases = aliases.filter((a) => a.active);
  const showAliases = isSale && (isTransfer || (isDivided && transferNum > 0)) && activeAliases.length > 0;
  const chosenAlias = showAliases ? pickAlias(activeAliases, transferNum, aliasChoice) : null;

  const splitHalf = () => {
    const base = amountOk(amount) ? Number(amount) : ((Number(cashAmount) || 0) + (Number(transferAmount) || 0));
    if (base > 0) {
      const half = Math.floor(base / 2);
      setCashAmount(String(half));
      setTransferAmount(String(base - half));
    }
  };

  const copyAlias = (alias) => {
    navigator.clipboard?.writeText(alias);
    setCopied(alias);
    setTimeout(() => setCopied(''), 1500);
  };

  const save = async () => {
    if (isDivided) {
      if (!amountOk(cashAmount) || !amountOk(transferAmount)) {
        setError('Ingresá ambos montos (efectivo y transferencia) sin puntos ni comas.');
        return;
      }
      const cNum = Number(cashAmount);
      const tNum = Number(transferAmount);
      if (showAliases && !chosenAlias) {
        setError(`Ningún alias acepta la transferencia de ${money(tNum)}. Revisá los alias.`);
        return;
      }
      setBusy(true);
      setError('');
      try {
        const { queued } = await sendOrQueue({
          action: 'addBatchSales',
          sales: [
            {
              clientRef: crypto.randomUUID(),
              sellerId: seller.id,
              date,
              amount: cNum,
              method: 'efectivo',
              note: `Pago dividido (${money(cNum)} efvo / ${money(tNum)} transf · Total ${money(cNum + tNum)})${note ? ` · ${note}` : ''}`
            },
            {
              clientRef: crypto.randomUUID(),
              sellerId: seller.id,
              date,
              amount: tNum,
              method: 'transferencia',
              aliasId: chosenAlias?.id || null,
              note: `Pago dividido (${money(cNum)} efvo / ${money(tNum)} transf · Total ${money(cNum + tNum)})${note ? ` · ${note}` : ''}`
            }
          ]
        });
        playSuccessBeep();
        onSaved(queued);
        onClose();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }

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
        aliasId: chosenAlias?.id || null,
        note
      });
      playSuccessBeep();
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
      {isSale && (
        <button
          type="button"
          onClick={() => { onClose(); onOpenSharedModal?.(seller, amount); }}
          style={{
            width: '100%',
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1.5px dashed #818CF8',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            color: '#4338CA',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Users size={15} /> ¿Esta compra fue con otra vendedora? Cargar venta compartida
        </button>
      )}

      {isSale ? (
        <MethodToggle
          value={method}
          onChange={(m) => {
            setMethod(m);
            if (m === 'dividido' && amountOk(amount)) {
              const half = Math.floor(Number(amount) / 2);
              setCashAmount(String(half));
              setTransferAmount(String(Number(amount) - half));
            }
          }}
          showDivided={true}
        />
      ) : (
        <>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>¿Cómo se le dio?</div>
          <MethodToggle value={method} onChange={setMethod} />
        </>
      )}

      {isDivided ? (
        <div style={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>DIVIDIR EL PAGO</span>
            <button type="button" onClick={splitHalf} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={12} /> Mitad y Mitad (50 / 50)
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>💵 Efectivo $</label>
              <input
                type="text"
                inputMode="numeric"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="$ 0"
                className="form-input"
                style={{ width: '100%', fontWeight: 800, fontSize: '1rem', padding: '8px' }}
                autoFocus
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>🏦 Transferencia $</label>
              <input
                type="text"
                inputMode="numeric"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="$ 0"
                className="form-input"
                style={{ width: '100%', fontWeight: 800, fontSize: '1rem', padding: '8px' }}
              />
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-gold, #D97706)', textAlign: 'right' }}>
            Total a cobrar: {money(totalNum)}
          </div>
        </div>
      ) : (
        <AmountInput value={amount} onChange={setAmount} placeholder="Monto $" autoFocus />
      )}

      {showAliases && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px' }}>
            ¿A qué alias transfirió? {isDivided && <span>({money(transferNum)})</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeAliases.map((a) => {
              const st = aliasStatus(a, transferNum);
              const sel = chosenAlias?.id === a.id;
              const rem = aliasRemaining(a);
              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={st.ok ? 0 : -1}
                  onClick={() => st.ok && setAliasChoice(a.id)}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && st.ok) { e.preventDefault(); setAliasChoice(a.id); } }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    padding: '8px 10px', borderRadius: '10px', cursor: st.ok ? 'pointer' : 'not-allowed',
                    border: sel ? '2px solid #10B981' : '1px solid var(--border-color)',
                    backgroundColor: sel ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                    opacity: st.ok ? 1 : 0.5
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.92rem', wordBreak: 'break-all', color: 'var(--text-main)' }}>
                      {sel ? '✓ ' : ''}{a.alias}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {[a.holder, a.bank].filter(Boolean).join(' · ')}
                      {rem !== null ? ` · quedan ${money(rem)}` : ''}
                    </div>
                    {a.description && <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#D97706' }}>“{a.description}”</div>}
                    {st.reason && <div style={{ fontSize: '0.72rem', fontWeight: 800, color: st.ok ? '#D97706' : '#DC2626' }}>{st.reason}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); copyAlias(a.alias); }}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.72rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Copiar alias"
                  >
                    {copied === a.alias ? <CheckCheck size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={isSale ? 'Nota (opcional)' : 'Motivo (opcional)'} className="form-input" style={{ width: '100%', marginBottom: '12px' }} />
      {error && <div role="alert" style={{ color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
      <SaveButton busy={busy} amount={totalNum} onSave={save} />
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
function QuickSaleBar({
  sellers,
  numberMap,
  date,
  aliases = [],
  onSaleCreated,
  onOpenNumbersModal,
  onEditAliases,
  onOpenSharedModal,
  onOpenSplitModal
}) {
  const [sellerInput, setSellerInput] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('efectivo'); // 'efectivo' | 'transferencia' | 'dividido'
  const [cashAmount, setCashAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [undoToast, setUndoToast] = useState(null);
  const [countdown, setCountdown] = useState(8);

  const amountRef = useRef(null);
  const sellerInputRef = useRef(null);

  // Alias de cobro: se sugiere solo el primero que acepta el monto
  const [aliasChoice, setAliasChoice] = useState(null);
  const [aliasCopied, setAliasCopied] = useState(false);
  const activeAliases = useMemo(() => aliases.filter((a) => a.active), [aliases]);
  const amountNum = Number(String(amount).replace(/[^\d]/g, '')) || 0;
  const transferAmountNum = method === 'dividido' ? (Number(transferAmount) || 0) : amountNum;
  const chosenAlias = useMemo(() => pickAlias(activeAliases, transferAmountNum, aliasChoice), [activeAliases, transferAmountNum, aliasChoice]);

  const cycleAlias = (dir) => {
    const ok = activeAliases.filter((a) => aliasStatus(a, transferAmountNum).ok);
    if (ok.length === 0) return;
    const idx = ok.findIndex((a) => a.id === chosenAlias?.id);
    const next = ok[(idx + dir + ok.length) % ok.length];
    setAliasChoice(next.id);
  };

  const copyChosenAlias = () => {
    if (!chosenAlias) return;
    navigator.clipboard?.writeText(chosenAlias.alias);
    setAliasCopied(true);
    setTimeout(() => setAliasCopied(false), 1500);
  };

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

    let saleAlias = null;
    if (targetMethod === 'transferencia' && activeAliases.length > 0) {
      saleAlias = pickAlias(activeAliases, Number(targetAmount), aliasChoice);
      if (!saleAlias) {
        setError(`Ningún alias acepta ${money(targetAmount)} (por mínimo, máximo o tope). Revisá los alias o cobralo en efectivo.`);
        return;
      }
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
        aliasId: saleAlias?.id || null,
        note: 'Carga rápida mostrador'
      });

      playSuccessBeep();

      if (!queued && res?.saleId) {
        setUndoToast({
          saleId: res.saleId,
          sellerName: targetSeller.name,
          amount: Number(targetAmount),
          method: targetMethod,
          aliasName: saleAlias?.alias || '',
          sellerNum: numberMap[targetSeller.id]
        });
      }

      onSaleCreated(queued);

      setAmount('');
      setCashAmount('');
      setTransferAmount('');
      setSellerInput('');
      setSelectedSellerId(null);
      setAliasChoice(null);

      setTimeout(() => {
        if (sellerInputRef.current) sellerInputRef.current.focus();
      }, 50);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la venta.');
    } finally {
      setBusy(false);
    }
  };

  const executeDividedSale = async (targetSeller, targetCash, targetTransfer) => {
    if (!targetSeller) {
      setError('Elegí o escribí el número de la vendedora (1 al 20).');
      return;
    }
    if (!amountOk(targetCash) || !amountOk(targetTransfer)) {
      setError('Ingresá ambos montos (efectivo y transferencia) sin puntos ni comas.');
      return;
    }

    const cNum = Number(targetCash);
    const tNum = Number(targetTransfer);
    const totalNum = cNum + tNum;

    let saleAlias = null;
    if (tNum > 0 && activeAliases.length > 0) {
      saleAlias = pickAlias(activeAliases, tNum, aliasChoice);
      if (!saleAlias) {
        setError(`Ningún alias acepta la transferencia de ${money(tNum)} (por tope o límites).`);
        return;
      }
    }

    setBusy(true);
    setError('');

    try {
      const clientRef1 = crypto.randomUUID();
      const clientRef2 = crypto.randomUUID();
      const sales = [
        {
          clientRef: clientRef1,
          sellerId: targetSeller.id,
          date,
          amount: cNum,
          method: 'efectivo',
          note: `Pago dividido (${money(cNum)} efvo / ${money(tNum)} transf · Total ${money(totalNum)})`
        },
        {
          clientRef: clientRef2,
          sellerId: targetSeller.id,
          date,
          amount: tNum,
          method: 'transferencia',
          aliasId: saleAlias?.id || null,
          note: `Pago dividido (${money(cNum)} efvo / ${money(tNum)} transf · Total ${money(totalNum)})`
        }
      ];

      const { queued, data: res } = await sendOrQueue({
        action: 'addBatchSales',
        sales
      });

      playSuccessBeep();

      if (!queued && res?.saleIds?.length) {
        setUndoToast({
          saleIds: res.saleIds,
          sellerName: targetSeller.name,
          amount: totalNum,
          method: 'dividido',
          cashAmount: cNum,
          transferAmount: tNum,
          aliasName: saleAlias?.alias || '',
          sellerNum: numberMap[targetSeller.id]
        });
      }

      onSaleCreated(queued);

      setAmount('');
      setCashAmount('');
      setTransferAmount('');
      setSellerInput('');
      setSelectedSellerId(null);
      setAliasChoice(null);
      setMethod('efectivo');

      setTimeout(() => {
        if (sellerInputRef.current) sellerInputRef.current.focus();
      }, 50);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la venta dividida.');
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!undoToast?.saleId && !undoToast?.saleIds?.length) return;
    try {
      await api('POST', {
        action: 'void',
        kind: 'sale',
        ...(undoToast.saleIds ? { ids: undoToast.saleIds } : { id: undoToast.saleId }),
        reason: 'Deshecho desde Carga Rápida'
      });
      setUndoToast(null);
      onSaleCreated(false);
    } catch (err) {
      window.alert(err.message || 'No se pudo anular la venta.');
    }
  };

  const jumpToAmount = () => {
    setTimeout(() => {
      if (amountRef.current) {
        amountRef.current.focus();
        amountRef.current.select?.();
      }
    }, 40);
  };

  // Foco inicial automático al abrir la pantalla de ventas
  useEffect(() => {
    const timer = setTimeout(() => {
      if (sellerInputRef.current) sellerInputRef.current.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  // Salto automático para números de 1 dígito si hay pausa de 350ms
  useEffect(() => {
    const trimmed = sellerInput.trim();
    if (/^[1-9]$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      const matched = sellerByNumber.get(trimmed) || sellerByNumber.get(num);
      if (matched) {
        const timer = setTimeout(() => {
          jumpToAmount();
        }, 350);
        return () => clearTimeout(timer);
      }
    }
  }, [sellerInput, sellerByNumber]);

  // Atajo global Ctrl + Z para deshacer venta
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && undoToast) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [undoToast]);

  const handleSellerInputChange = (e) => {
    const raw = e.target.value;
    setSellerInput(raw);
    setSelectedSellerId(null);
    setError('');

    const trimmed = raw.trim();

    if (trimmed.includes(' ') || trimmed.includes('/') || trimmed.includes('.')) {
      return;
    }

    if (trimmed === '00') {
      jumpToAmount();
      return;
    }

    if (/^\d{2}$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      const matched = sellerByNumber.get(trimmed) || sellerByNumber.get(num);
      if (matched) {
        jumpToAmount();
      }
    }
  };

  const handleSellerKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Tab') {
      const trimmed = sellerInput.trim();
      if (trimmed && !trimmed.includes(' ')) {
        const num = parseInt(trimmed, 10);
        const matched = (trimmed === '00' || trimmed === '0')
          ? activeSellers.find((s) => s.name.toLowerCase().trim() === 'mostrador')
          : (sellerByNumber.get(trimmed) || sellerByNumber.get(num));
        if (matched) {
          e.preventDefault();
          jumpToAmount();
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const val = sellerInput.trim();
      const parts = val.split(/\s+/);
      if (parts.length >= 2) {
        const rawNum = parts[0];
        const num = parseInt(rawNum, 10);
        const parsedAmount = parts[1];
        const methodChar = (parts[2] || '').toLowerCase();
        const parsedMethod = methodChar.startsWith('t') ? 'transferencia' : methodChar.startsWith('d') ? 'dividido' : 'efectivo';
        const matched = (rawNum === '00' || rawNum === '0')
          ? activeSellers.find((s) => s.name.toLowerCase().trim() === 'mostrador')
          : (sellerByNumber.get(rawNum) || sellerByNumber.get(num));
        if (matched && amountOk(parsedAmount)) {
          if (parsedMethod === 'dividido') {
            const half = Math.floor(Number(parsedAmount) / 2);
            executeDividedSale(matched, String(half), String(Number(parsedAmount) - half));
          } else {
            executeSale(matched, parsedAmount, parsedMethod);
          }
          return;
        }
      }

      if (parsedSeller) {
        jumpToAmount();
      }
    }
  };

  const handleAmountKeyDown = (e) => {
    if (e.key === 't' || e.key === 'T' || e.key === '+' || e.key === '*') {
      e.preventDefault();
      setMethod((prev) => (prev === 'efectivo' ? 'transferencia' : 'efectivo'));
      return;
    }
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      setMethod('efectivo');
      return;
    }
    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      setMethod('dividido');
      if (amountOk(amount)) {
        const total = Number(amount);
        const half = Math.floor(total / 2);
        setCashAmount(String(half));
        setTransferAmount(String(total - half));
      }
      return;
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && (method === 'transferencia' || (method === 'dividido' && Number(transferAmount) > 0))) {
      e.preventDefault();
      cycleAlias(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if ((e.key === 'Backspace' || e.key === 'ArrowLeft') && (!amount || amount === '') && method !== 'dividido') {
      e.preventDefault();
      if (sellerInputRef.current) {
        sellerInputRef.current.focus();
        sellerInputRef.current.select?.();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setAmount('');
      setCashAmount('');
      setTransferAmount('');
      setSellerInput('');
      setSelectedSellerId(null);
      setMethod('efectivo');
      if (sellerInputRef.current) sellerInputRef.current.focus();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (method === 'dividido') {
        executeDividedSale(parsedSeller, cashAmount, transferAmount);
        return;
      }
      let cleanAmount = amount.trim().toLowerCase();
      let chosenMethod = method;
      if (cleanAmount.endsWith('t')) {
        cleanAmount = cleanAmount.slice(0, -1).trim();
        chosenMethod = 'transferencia';
      } else if (cleanAmount.endsWith('e')) {
        cleanAmount = cleanAmount.slice(0, -1).trim();
        chosenMethod = 'efectivo';
      } else if (cleanAmount.endsWith('d')) {
        cleanAmount = cleanAmount.slice(0, -1).trim();
        const half = Math.floor(Number(cleanAmount) / 2);
        executeDividedSale(parsedSeller, String(half), String(Number(cleanAmount) - half));
        return;
      }
      executeSale(parsedSeller, cleanAmount, chosenMethod);
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
              Carga Rápida Express <span style={{ fontSize: '0.72rem', backgroundColor: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: '6px', fontWeight: 800 }}>⚡ 100% TECLADO (SIN MOUSE)</span>
            </h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Pones el N° de vendedora (<strong>00</strong> o <strong>1-20</strong>) ➔ <strong>pasa solo al monto</strong> ➔ escribís el $ y das <strong>Enter</strong>.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onOpenSharedModal?.(parsedSeller, amount)}
            style={{
              padding: '5px 11px',
              fontSize: '0.76rem',
              fontWeight: 800,
              borderRadius: '8px',
              border: '1.5px solid #818CF8',
              backgroundColor: '#EEF2FF',
              color: '#4338CA',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer'
            }}
            title="Venta atendida por 2 o 3 vendedoras distintas"
          >
            <Users size={14} /> 👥 Venta Compartida
          </button>

          <button
            type="button"
            onClick={onOpenNumbersModal}
            className="btn-secondary"
            style={{ padding: '5px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Asignar o cambiar los números del 1 al 20 de las vendedoras"
          >
            <Settings size={13} /> Asignar N° (1-20)
          </button>
        </div>
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

      {/* Inputs Bar con Auto-Salto */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1.1fr) minmax(170px, 1.5fr) minmax(200px, 1.2fr) minmax(130px, auto)',
        gap: '10px',
        alignItems: 'start'
      }}>
        {/* N° Vendedora */}
        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '3px' }}>
            1. N° Vendedora (00 o 1-20)
          </label>
          <input
            ref={sellerInputRef}
            type="text"
            value={sellerInput}
            onChange={handleSellerInputChange}
            onKeyDown={handleSellerKeyDown}
            placeholder="Ej: 00 o 4"
            className="form-input"
            style={{
              width: '100%',
              fontSize: '1.15rem',
              fontWeight: 900,
              padding: '9px 12px',
              border: parsedSeller ? '2px solid #10B981' : undefined
            }}
          />
          {parsedSeller ? (
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#047857', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Check size={15} /> #{numberMap[parsedSeller.id] || (parsedSeller.name.toLowerCase().trim() === 'mostrador' ? '00' : '')} {parsedSeller.name} {parsedSeller.name.toLowerCase().trim() === 'mostrador' ? '(Directo Caja)' : ''}
            </div>
          ) : sellerInput.trim() !== '' ? (
            <div style={{ fontSize: '0.72rem', color: '#B91C1C', fontWeight: 600, marginTop: '3px' }}>
              No hay vendedora con N° {sellerInput.trim().split(/\s+/)[0]}
            </div>
          ) : (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Tipeá 00 o el número (salta solo al monto)
            </div>
          )}
          <div style={{ marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => onOpenSharedModal?.(parsedSeller, amount)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#4F46E5',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              👥 ¿Venta compartida con otra vendedora? Clic acá
            </button>
          </div>
        </div>

        {/* Monto con Confirmación Enter */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {method === 'dividido' ? '2. Montos Divididos (Enter)' : '2. Monto $ (Enter para guardar)'}
            </label>
            {method === 'dividido' && (
              <button
                type="button"
                onClick={() => {
                  const base = amountOk(amount) ? Number(amount) : ((Number(cashAmount) || 0) + (Number(transferAmount) || 0));
                  if (base > 0) {
                    const half = Math.floor(base / 2);
                    setCashAmount(String(half));
                    setTransferAmount(String(base - half));
                  }
                }}
                style={{
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid #F59E0B',
                  background: '#FEF3C7',
                  color: '#92400E',
                  cursor: 'pointer',
                  fontWeight: 800
                }}
              >
                ⚡ 50 / 50 (Mitad y mitad)
              </button>
            )}
          </div>

          {method === 'dividido' ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <input
                    ref={amountRef}
                    type="text"
                    inputMode="numeric"
                    value={cashAmount}
                    onChange={(e) => {
                      setCashAmount(e.target.value.replace(/[^\d]/g, ''));
                      setError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        executeDividedSale(parsedSeller, cashAmount, transferAmount);
                      } else {
                        handleAmountKeyDown(e);
                      }
                    }}
                    placeholder="Efvo $"
                    className="form-input"
                    style={{ width: '100%', fontSize: '1rem', fontWeight: 900, padding: '7px 8px' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>💵 Efectivo</span>
                </div>
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={transferAmount}
                    onChange={(e) => {
                      setTransferAmount(e.target.value.replace(/[^\d]/g, ''));
                      setError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        executeDividedSale(parsedSeller, cashAmount, transferAmount);
                      } else {
                        handleAmountKeyDown(e);
                      }
                    }}
                    placeholder="Transf $"
                    className="form-input"
                    style={{ width: '100%', fontSize: '1rem', fontWeight: 900, padding: '7px 8px' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>🏦 Transferencia</span>
                </div>
              </div>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--accent-gold, #D97706)', marginTop: '4px' }}>
                Total: {money((Number(cashAmount) || 0) + (Number(transferAmount) || 0))}
              </div>
            </div>
          ) : (
            <>
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
                style={{
                  width: '100%',
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  padding: '8px 12px',
                  border: amountOk(amount) ? '2px solid var(--accent-gold, #D97706)' : undefined
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: amountOk(amount) ? 'var(--text-main)' : 'var(--text-muted)' }}>
                  {amountOk(amount) ? `= ${money(amount)}` : 'Entero sin puntos'}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button type="button" onClick={() => addAmount(10000)} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)', cursor: 'pointer', fontWeight: 700 }}>+10k</button>
                  <button type="button" onClick={() => addAmount(50000)} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)', cursor: 'pointer', fontWeight: 700 }}>+50k</button>
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: '3px' }}>
            <button
              type="button"
              onClick={() => onOpenSplitModal?.(parsedSeller, amount)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#D97706',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              ⚡ ¿Pago dividido (efvo + transf)? Clic acá
            </button>
          </div>
        </div>

        {/* Método Toggle con atajos de teclado */}
        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
            Medio [E], [T] o [D]
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.25fr', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setMethod('efectivo')}
              title="Presioná la letra E para Efectivo"
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
              Efectivo [E]
            </button>
            <button
              type="button"
              onClick={() => setMethod('transferencia')}
              title="Presioná la letra T o tecla + para Transferencia"
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
              Transfer [T]
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('dividido');
                if (amountOk(amount)) {
                  const total = Number(amount);
                  const half = Math.floor(total / 2);
                  setCashAmount(String(half));
                  setTransferAmount(String(total - half));
                }
              }}
              title="Presioná la letra D para Pago Dividido (Efvo + Transfer)"
              style={{
                padding: '9px 4px',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                border: method === 'dividido' ? '2px solid #D97706' : '1px solid var(--border-color)',
                backgroundColor: method === 'dividido' ? '#FEF3C7' : 'var(--bg-surface-elevated)',
                color: method === 'dividido' ? '#92400E' : 'var(--text-main)'
              }}
            >
              ⚡ Dividido [D]
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
            disabled={
              busy ||
              !parsedSeller ||
              (method === 'dividido'
                ? (!amountOk(cashAmount) || !amountOk(transferAmount))
                : !amountOk(amount))
            }
            onClick={() => {
              if (method === 'dividido') {
                executeDividedSale(parsedSeller, cashAmount, transferAmount);
              } else {
                executeSale(parsedSeller, amount, method);
              }
            }}
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
              cursor: (!parsedSeller || busy || (method === 'dividido' ? (!amountOk(cashAmount) || !amountOk(transferAmount)) : !amountOk(amount))) ? 'not-allowed' : 'pointer'
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Cargar [Enter]
          </button>
        </div>
      </div>

      {/* Leyenda de Atajos de Teclado Rápidos */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '6px',
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid var(--border-color)',
        fontSize: '0.74rem',
        color: 'var(--text-muted)'
      }}>
        <span>
          ⌨️ <strong>Atajos rápidos:</strong> <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}>Enter</kbd> Guardar · <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}>T</kbd> o <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}>+</kbd> Transfer · <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}>E</kbd> Efectivo · <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}>D</kbd> Dividido · <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}>Backspace</kbd> Corregir N° · <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}>Esc</kbd> Limpiar
        </span>
        <span style={{ color: '#047857', fontWeight: 700 }}>
          ⚡ 0 clicks de mouse requeridos
        </span>
      </div>

      {/* Alias de cobro al cobrar por Transferencia o Dividido */}
      {(method === 'transferencia' || (method === 'dividido' && Number(transferAmount) > 0)) && (
        <div style={{
          marginTop: '10px',
          padding: '10px 12px',
          borderRadius: '10px',
          border: `1.5px solid ${chosenAlias ? (aliasStatus(chosenAlias, transferAmountNum).overLimit ? '#EF4444' : '#10B981') : '#FCA5A5'}`,
          backgroundColor: chosenAlias ? (aliasStatus(chosenAlias, transferAmountNum).overLimit ? '#FEF2F2' : '#ECFDF5') : '#FEF2F2'
        }}>
          {activeAliases.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.84rem', fontWeight: 700, color: '#B91C1C' }}>
              <span>No hay alias de cobro activos. La transferencia se carga igual, sin alias.</span>
              <button type="button" onClick={onEditAliases} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.76rem' }}>Cargar alias</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                {chosenAlias ? (
                  <div style={{ color: aliasStatus(chosenAlias, transferAmountNum).overLimit ? '#991B1B' : '#065F46', minWidth: 0 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span>🏦 Pasale este alias{transferAmountNum ? ` · ${money(transferAmountNum)}` : ''}</span>
                      {aliasStatus(chosenAlias, transferAmountNum).overLimit && (
                        <span style={{ backgroundColor: '#EF4444', color: '#FFF', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900 }}>
                          🚨 Límite alcanzado (habilitado)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'monospace', wordBreak: 'break-all', color: aliasStatus(chosenAlias, transferAmountNum).overLimit ? '#B91C1C' : 'var(--text-main)' }}>
                      {chosenAlias.alias}
                    </div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      {[chosenAlias.holder, chosenAlias.bank].filter(Boolean).join(' · ')}
                      {aliasRemaining(chosenAlias) !== null ? ` · ${aliasRemaining(chosenAlias) <= 0 ? 'Tope superado' : `le quedan ${money(aliasRemaining(chosenAlias))} hoy`}` : ''}
                    </div>
                    {chosenAlias.note && (
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#92400E', backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', padding: '3px 8px', borderRadius: '6px', marginTop: '4px', display: 'inline-block' }}>
                        📝 Anotación del día: “{chosenAlias.note}”
                      </div>
                    )}
                    {chosenAlias.description && <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#92400E', marginTop: '2px' }}>“{chosenAlias.description}”</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#B91C1C' }}>
                    🚫 Ningún alias acepta {money(transferAmountNum)}. Cobralo en efectivo o revisá los alias.
                  </div>
                )}
                {chosenAlias && (
                  <button type="button" onClick={copyChosenAlias} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    {aliasCopied ? <><CheckCheck size={14} /> Copiado</> : <><Copy size={14} /> Copiar alias</>}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
                {activeAliases.map((a) => {
                  const st = aliasStatus(a, transferAmountNum);
                  const sel = chosenAlias?.id === a.id;
                  const isOver = st.overLimit;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!st.ok}
                      onClick={() => { setAliasChoice(a.id); amountRef.current?.focus(); }}
                      title={`${a.description || aliasRules(a)}${a.note ? ` | Anotación: ${a.note}` : ''}`}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '8px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: st.ok ? 'pointer' : 'not-allowed',
                        border: sel
                          ? isOver ? '2px solid #DC2626' : '2px solid #047857'
                          : isOver ? '1.5px solid #F87171' : '1px solid var(--border-color)',
                        backgroundColor: sel
                          ? isOver ? '#DC2626' : '#047857'
                          : isOver ? '#FEE2E2' : st.ok ? 'var(--bg-card)' : 'transparent',
                        color: sel
                          ? '#FFFFFF'
                          : isOver ? '#B91C1C' : st.ok ? 'var(--text-main)' : 'var(--text-muted)',
                        textDecoration: st.ok ? 'none' : 'line-through'
                      }}
                    >
                      {a.alias}{isOver ? ' · 🚨 Lleno' : (!st.ok ? ` · ${st.reason}` : '')}
                    </button>
                  );
                })}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <kbd>↑</kbd> <kbd>↓</kbd> cambiar alias
                </span>
              </div>
            </>
          )}
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
              {undoToast.method === 'dividido' ? (
                <>✓ Venta dividida de <strong>{money(undoToast.amount)}</strong> ({money(undoToast.cashAmount)} efvo + {money(undoToast.transferAmount)} transf{undoToast.aliasName ? ` → ${undoToast.aliasName}` : ''}) cargada a <strong>#{undoToast.sellerNum} {undoToast.sellerName}</strong></>
              ) : (
                <>✓ Venta de <strong>{money(undoToast.amount)}</strong> cargada a <strong>#{undoToast.sellerNum} {undoToast.sellerName}</strong> ({METHOD_LABEL[undoToast.method]}{undoToast.aliasName ? ` → ${undoToast.aliasName}` : ''})</>
              )}
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

// ---------------------------------------------------------------- Modal Carga Directa de Transferencia
function DirectTransferModal({ date, sellers, numberMap, aliases = [], onClose, onSave }) {
  const [selectedSellerId, setSelectedSellerId] = useState(sellers[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [aliasChoice, setAliasChoice] = useState(null);
  const activeAliases = aliases.filter((a) => a.active);
  const chosenAlias = pickAlias(activeAliases, Number(amount) || 0, aliasChoice);
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
      if (activeAliases.length > 0 && !chosenAlias) {
        setError('Ningún alias acepta ese monto. Revisá los alias.');
        return;
      }
      await onSave({
        sellerId: selectedSellerId,
        amount: Number(amount),
        aliasId: chosenAlias?.id || null,
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

        {activeAliases.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Entró al alias
            </label>
            <select
              value={chosenAlias?.id || ''}
              onChange={(e) => setAliasChoice(e.target.value || null)}
              className="form-input"
              style={{ width: '100%', fontSize: '0.92rem', fontWeight: 700 }}
            >
              {!chosenAlias && <option value="">— Sin alias —</option>}
              {activeAliases.map((a) => {
                const st = aliasStatus(a, Number(amount) || 0);
                const tag = st.overLimit ? ' · 🚨 Tope superado (habilitado)' : (!st.ok ? ` (${st.reason})` : '');
                return <option key={a.id} value={a.id} disabled={!st.ok}>{a.alias}{tag}</option>;
              })}
            </select>
            {chosenAlias && aliasStatus(chosenAlias, Number(amount) || 0).overLimit && (
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
                🚨 Este alias alcanzó su tope diario, pero podés registrar la transferencia igual.
              </div>
            )}
          </div>
        )}

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

// ---------------------------------------------------------------- Modal Venta Compartida (2 o 3 Vendedoras)
function SharedSaleModal({
  date,
  sellers = [],
  numberMap = {},
  aliases = [],
  onClose,
  onSaved,
  initialSeller = null,
  initialAmount = ''
}) {
  const activeSellers = useMemo(() => sellers.filter((s) => s.active !== false), [sellers]);

  const [rows, setRows] = useState(() => [
    { sellerId: initialSeller?.id || '', amount: initialAmount ? String(initialAmount) : '' },
    { sellerId: '', amount: '' }
  ]);

  const [method, setMethod] = useState('efectivo'); // 'efectivo' | 'transferencia' | 'dividido'
  const [cashAmount, setCashAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [aliasChoice, setAliasChoice] = useState(null);
  const [copied, setCopied] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const totalAmount = useMemo(() => {
    return rows.reduce((sum, r) => sum + (amountOk(r.amount) ? Number(r.amount) : 0), 0);
  }, [rows]);

  const activeAliases = useMemo(() => aliases.filter((a) => a.active), [aliases]);
  const isTransfer = method === 'transferencia';
  const isDivided = method === 'dividido';
  const transferNum = isDivided ? (Number(transferAmount) || 0) : (isTransfer ? totalAmount : 0);
  const showAliases = (isTransfer || (isDivided && transferNum > 0)) && activeAliases.length > 0;
  const chosenAlias = showAliases ? pickAlias(activeAliases, transferNum, aliasChoice) : null;

  const handleSplit5050 = () => {
    if (totalAmount > 0) {
      const half = Math.floor(totalAmount / 2);
      setCashAmount(String(half));
      setTransferAmount(String(totalAmount - half));
    }
  };

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    setError('');
  };

  const addSellerRow = () => {
    if (rows.length < 3) {
      setRows((prev) => [...prev, { sellerId: '', amount: '' }]);
    }
  };

  const removeSellerRow = (index) => {
    if (rows.length > 2) {
      setRows((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const copyAlias = (alias) => {
    navigator.clipboard?.writeText(alias);
    setCopied(alias);
    setTimeout(() => setCopied(''), 1500);
  };

  const save = async () => {
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].sellerId) {
        setError(`Elegí la vendedora #${i + 1}.`);
        return;
      }
      if (!amountOk(rows[i].amount)) {
        setError(`Poné el monto que vendió la vendedora #${i + 1} (número entero).`);
        return;
      }
    }

    const sellerIds = rows.map((r) => r.sellerId);
    if (new Set(sellerIds).size !== rows.length) {
      setError('No podés seleccionar la misma vendedora más de una vez.');
      return;
    }

    if (totalAmount <= 0) {
      setError('El total de la venta debe ser mayor a 0.');
      return;
    }

    if (isDivided) {
      if (!amountOk(cashAmount) || !amountOk(transferAmount)) {
        setError('Ingresá los montos en efectivo y transferencia.');
        return;
      }
      const cNum = Number(cashAmount);
      const tNum = Number(transferAmount);
      if (cNum + tNum !== totalAmount) {
        setError(`La suma de Efectivo (${money(cNum)}) y Transferencia (${money(tNum)}) debe ser exactamente igual al total (${money(totalAmount)}).`);
        return;
      }
      if (tNum > 0 && showAliases && !chosenAlias) {
        setError(`Ningún alias acepta la transferencia de ${money(tNum)}. Revisá los alias.`);
        return;
      }
    }

    if (isTransfer && showAliases && !chosenAlias) {
      setError(`Ningún alias acepta la transferencia de ${money(totalAmount)}. Revisá los alias.`);
      return;
    }

    setBusy(true);
    setError('');

    try {
      const summaryParts = rows.map((r) => {
        const s = sellers.find((x) => x.id === r.sellerId);
        const num = numberMap[r.sellerId] !== undefined ? `#${numberMap[r.sellerId]} ` : '';
        return `${num}${s?.name || 'Vendedora'} (${money(r.amount)})`;
      });
      const summary = summaryParts.join(' + ');

      let sales = [];

      if (method === 'efectivo') {
        sales = rows.map((r) => ({
          clientRef: crypto.randomUUID(),
          sellerId: r.sellerId,
          date,
          amount: Number(r.amount),
          method: 'efectivo',
          note: `Venta compartida: ${summary}${note ? ` · ${note}` : ''}`
        }));
      } else if (method === 'transferencia') {
        sales = rows.map((r) => ({
          clientRef: crypto.randomUUID(),
          sellerId: r.sellerId,
          date,
          amount: Number(r.amount),
          method: 'transferencia',
          aliasId: chosenAlias?.id || null,
          note: `Venta compartida: ${summary}${note ? ` · ${note}` : ''}`
        }));
      } else {
        const cTotal = Number(cashAmount);
        const tTotal = Number(transferAmount);
        let cashAllocated = 0;
        let transferAllocated = 0;

        rows.forEach((r, idx) => {
          const isLast = idx === rows.length - 1;
          const sAmt = Number(r.amount);
          let sCash = isLast ? (cTotal - cashAllocated) : Math.round(cTotal * (sAmt / totalAmount));
          sCash = Math.max(0, Math.min(sAmt, sCash));
          const sTransf = sAmt - sCash;

          cashAllocated += sCash;
          transferAllocated += sTransf;

          if (sCash > 0) {
            sales.push({
              clientRef: crypto.randomUUID(),
              sellerId: r.sellerId,
              date,
              amount: sCash,
              method: 'efectivo',
              note: `Venta compartida dividida: ${summary} · ${money(cTotal)} efvo / ${money(tTotal)} transf${note ? ` · ${note}` : ''}`
            });
          }
          if (sTransf > 0) {
            sales.push({
              clientRef: crypto.randomUUID(),
              sellerId: r.sellerId,
              date,
              amount: sTransf,
              method: 'transferencia',
              aliasId: chosenAlias?.id || null,
              note: `Venta compartida dividida: ${summary} · ${money(cTotal)} efvo / ${money(tTotal)} transf${note ? ` · ${note}` : ''}`
            });
          }
        });
      }

      const { queued } = await sendOrQueue({
        action: 'addBatchSales',
        sales
      });

      playSuccessBeep();
      onSaved(queued);
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la venta compartida.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="👥 Venta compartida entre vendedoras"
      subtitle="La comisión de cada prenda o producto se le asigna a la vendedora que la vendió."
      onClose={onClose}
      maxWidth="500px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {rows.map((row, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '10px 12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                Vendedora #{idx + 1}
              </span>
              {rows.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeSellerRow(idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#EF4444',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  <Trash2 size={13} /> Quitar
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
              <select
                value={row.sellerId}
                onChange={(e) => updateRow(idx, 'sellerId', e.target.value)}
                className="form-input"
                style={{ width: '100%', fontWeight: 800, fontSize: '0.88rem', padding: '8px' }}
              >
                <option value="">-- Elegir vendedora --</option>
                {activeSellers.map((s) => {
                  const isMostrador = s.name.toLowerCase().trim() === 'mostrador';
                  const num = isMostrador ? '00' : (numberMap[s.id] || '');
                  return (
                    <option key={s.id} value={s.id} disabled={rows.some((r, i) => i !== idx && r.sellerId === s.id)}>
                      #{num} {s.name} {isMostrador ? '(Mostrador)' : ''}
                    </option>
                  );
                })}
              </select>

              <input
                type="text"
                inputMode="numeric"
                value={row.amount}
                onChange={(e) => updateRow(idx, 'amount', e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Vendió $"
                className="form-input"
                style={{ width: '100%', fontWeight: 800, fontSize: '0.95rem', padding: '8px' }}
              />
            </div>
          </div>
        ))}
      </div>

      {rows.length < 3 && (
        <button
          type="button"
          onClick={addSellerRow}
          className="btn-secondary"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '8px',
            fontSize: '0.8rem',
            fontWeight: 800,
            marginBottom: '14px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <Plus size={14} /> + Agregar 3ra vendedora
        </button>
      )}

      {/* Resumen Total */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderRadius: '10px',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        border: '1.5px solid #818CF8',
        marginBottom: '14px'
      }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4338CA' }}>Total de la compra:</span>
        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#4338CA' }}>{money(totalAmount)}</span>
      </div>

      {/* Método de Cobro */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
          ¿Cómo paga el cliente?
        </label>
        <MethodToggle
          value={method}
          onChange={(m) => {
            setMethod(m);
            if (m === 'dividido' && totalAmount > 0) {
              const half = Math.floor(totalAmount / 2);
              setCashAmount(String(half));
              setTransferAmount(String(totalAmount - half));
            }
          }}
          showDivided={true}
        />
      </div>

      {isDivided && (
        <div style={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>DIVIDIR EL PAGO</span>
            <button type="button" onClick={handleSplit5050} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={12} /> Mitad y Mitad (50 / 50)
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>💵 Efectivo $</label>
              <input
                type="text"
                inputMode="numeric"
                value={cashAmount}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^\d]/g, '');
                  setCashAmount(clean);
                  if (totalAmount > 0 && clean !== '') {
                    const diff = totalAmount - Number(clean);
                    if (diff >= 0) setTransferAmount(String(diff));
                  }
                }}
                placeholder="Efvo $"
                className="form-input"
                style={{ width: '100%', fontWeight: 800, fontSize: '1rem', padding: '8px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>🏦 Transferencia $</label>
              <input
                type="text"
                inputMode="numeric"
                value={transferAmount}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^\d]/g, '');
                  setTransferAmount(clean);
                  if (totalAmount > 0 && clean !== '') {
                    const diff = totalAmount - Number(clean);
                    if (diff >= 0) setCashAmount(String(diff));
                  }
                }}
                placeholder="Transf $"
                className="form-input"
                style={{ width: '100%', fontWeight: 800, fontSize: '1rem', padding: '8px' }}
              />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: (Number(cashAmount) + Number(transferAmount)) === totalAmount ? '#047857' : '#B91C1C', textAlign: 'right' }}>
            Suma: {money((Number(cashAmount) || 0) + (Number(transferAmount) || 0))} / {money(totalAmount)}
          </div>
        </div>
      )}

      {showAliases && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px' }}>
            ¿A qué alias transfiere? ({money(transferNum)})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeAliases.map((a) => {
              const st = aliasStatus(a, transferNum);
              const sel = chosenAlias?.id === a.id;
              const rem = aliasRemaining(a);
              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={st.ok ? 0 : -1}
                  onClick={() => st.ok && setAliasChoice(a.id)}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && st.ok) { e.preventDefault(); setAliasChoice(a.id); } }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    padding: '8px 10px', borderRadius: '10px', cursor: st.ok ? 'pointer' : 'not-allowed',
                    border: sel ? '2px solid #10B981' : '1px solid var(--border-color)',
                    backgroundColor: sel ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                    opacity: st.ok ? 1 : 0.5
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.92rem', wordBreak: 'break-all', color: 'var(--text-main)' }}>
                      {sel ? '✓ ' : ''}{a.alias}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {[a.holder, a.bank].filter(Boolean).join(' · ')}
                      {rem !== null ? ` · quedan ${money(rem)}` : ''}
                    </div>
                    {a.description && <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#D97706' }}>“{a.description}”</div>}
                    {st.reason && <div style={{ fontSize: '0.72rem', fontWeight: 800, color: st.ok ? '#D97706' : '#DC2626' }}>{st.reason}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); copyAlias(a.alias); }}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.72rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Copiar alias"
                  >
                    {copied === a.alias ? <CheckCheck size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota opcional (ej: cliente llevó 3 prendas)"
        className="form-input"
        style={{ width: '100%', marginBottom: '12px' }}
      />

      {error && <div role="alert" style={{ color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}

      <SaveButton busy={busy} amount={totalAmount} onSave={save} label={`Guardar venta compartida (${money(totalAmount)})`} />
    </Modal>
  );
}

// ---------------------------------------------------------------- Modal Pago Dividido (Efectivo + Transferencia)
function SplitSaleModal({
  date,
  sellers = [],
  numberMap = {},
  aliases = [],
  onClose,
  onSaved,
  initialSeller = null,
  initialAmount = ''
}) {
  const activeSellers = useMemo(() => sellers.filter((s) => s.active !== false), [sellers]);
  const [selectedSellerId, setSelectedSellerId] = useState(initialSeller?.id || '');
  const [totalAmount, setTotalAmount] = useState(initialAmount ? String(initialAmount) : '');
  const [cashAmount, setCashAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [aliasChoice, setAliasChoice] = useState(null);
  const [copied, setCopied] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const activeAliases = useMemo(() => aliases.filter((a) => a.active), [aliases]);
  const tNum = Number(transferAmount) || 0;
  const showAliases = tNum > 0 && activeAliases.length > 0;
  const chosenAlias = showAliases ? pickAlias(activeAliases, tNum, aliasChoice) : null;

  useEffect(() => {
    if (initialAmount && amountOk(initialAmount)) {
      const half = Math.floor(Number(initialAmount) / 2);
      setCashAmount(String(half));
      setTransferAmount(String(Number(initialAmount) - half));
    }
  }, [initialAmount]);

  const handleTotalChange = (val) => {
    const clean = val.replace(/[^\d]/g, '');
    setTotalAmount(clean);
    setError('');
    if (amountOk(clean)) {
      const half = Math.floor(Number(clean) / 2);
      setCashAmount(String(half));
      setTransferAmount(String(Number(clean) - half));
    }
  };

  const handleSplit5050 = () => {
    const base = amountOk(totalAmount) ? Number(totalAmount) : ((Number(cashAmount) || 0) + (Number(transferAmount) || 0));
    if (base > 0) {
      setTotalAmount(String(base));
      const half = Math.floor(base / 2);
      setCashAmount(String(half));
      setTransferAmount(String(base - half));
    }
  };

  const handleCashChange = (val) => {
    const clean = val.replace(/[^\d]/g, '');
    setCashAmount(clean);
    setError('');
    if (amountOk(totalAmount) && clean !== '') {
      const diff = Number(totalAmount) - Number(clean);
      if (diff >= 0) setTransferAmount(String(diff));
    }
  };

  const handleTransferChange = (val) => {
    const clean = val.replace(/[^\d]/g, '');
    setTransferAmount(clean);
    setError('');
    if (amountOk(totalAmount) && clean !== '') {
      const diff = Number(totalAmount) - Number(clean);
      if (diff >= 0) setCashAmount(String(diff));
    }
  };

  const copyAlias = (alias) => {
    navigator.clipboard?.writeText(alias);
    setCopied(alias);
    setTimeout(() => setCopied(''), 1500);
  };

  const save = async () => {
    if (!selectedSellerId) {
      setError('Elegí la vendedora que atendió la venta.');
      return;
    }
    if (!amountOk(cashAmount) || !amountOk(transferAmount)) {
      setError('Ingresá montos válidos en efectivo y transferencia.');
      return;
    }
    const c = Number(cashAmount);
    const t = Number(transferAmount);
    const tot = c + t;

    if (tot <= 0) {
      setError('El total debe ser mayor a 0.');
      return;
    }

    if (t > 0 && showAliases && !chosenAlias) {
      setError(`Ningún alias acepta ${money(t)}. Revisá los alias.`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const sales = [
        {
          clientRef: crypto.randomUUID(),
          sellerId: selectedSellerId,
          date,
          amount: c,
          method: 'efectivo',
          note: `Pago dividido (${money(c)} efvo / ${money(t)} transf · Total ${money(tot)})${note ? ` · ${note}` : ''}`
        },
        {
          clientRef: crypto.randomUUID(),
          sellerId: selectedSellerId,
          date,
          amount: t,
          method: 'transferencia',
          aliasId: chosenAlias?.id || null,
          note: `Pago dividido (${money(c)} efvo / ${money(t)} transf · Total ${money(tot)})${note ? ` · ${note}` : ''}`
        }
      ];

      const { queued } = await sendOrQueue({
        action: 'addBatchSales',
        sales
      });

      playSuccessBeep();
      onSaved(queued);
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el pago dividido.');
    } finally {
      setBusy(false);
    }
  };

  const currentTotal = (Number(cashAmount) || 0) + (Number(transferAmount) || 0);

  return (
    <Modal
      title="⚡ Pago dividido (Mitad Efectivo y Mitad Transferencia)"
      subtitle="El cliente paga parte en efectivo y parte por transferencia bancaria."
      onClose={onClose}
      maxWidth="460px"
    >
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
          Vendedora
        </label>
        <select
          value={selectedSellerId}
          onChange={(e) => setSelectedSellerId(e.target.value)}
          className="form-input"
          style={{ width: '100%', fontWeight: 800, fontSize: '0.92rem', padding: '8px' }}
        >
          <option value="">-- Seleccionar vendedora --</option>
          {activeSellers.map((s) => {
            const isMostrador = s.name.toLowerCase().trim() === 'mostrador';
            const num = isMostrador ? '00' : (numberMap[s.id] || '');
            return (
              <option key={s.id} value={s.id}>
                #{num} {s.name} {isMostrador ? '(Mostrador - Autoservicio)' : ''}
              </option>
            );
          })}
        </select>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', margin: 0 }}>
            Monto Total de la Compra $
          </label>
          <button
            type="button"
            onClick={handleSplit5050}
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Zap size={12} /> Mitad y Mitad (50 / 50)
          </button>
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={totalAmount}
          onChange={(e) => handleTotalChange(e.target.value)}
          placeholder="Ej: 50000"
          className="form-input"
          style={{ width: '100%', fontSize: '1.15rem', fontWeight: 900, padding: '8px 12px' }}
        />
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Al poner el total, se divide automáticamente mitad y mitad abajo (podés ajustarlo).
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px' }}>
          DESGLOSE DEL COBRO
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>💵 Efectivo $</label>
            <input
              type="text"
              inputMode="numeric"
              value={cashAmount}
              onChange={(e) => handleCashChange(e.target.value)}
              placeholder="$ 0"
              className="form-input"
              style={{ width: '100%', fontWeight: 800, fontSize: '1rem', padding: '8px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>🏦 Transferencia $</label>
            <input
              type="text"
              inputMode="numeric"
              value={transferAmount}
              onChange={(e) => handleTransferChange(e.target.value)}
              placeholder="$ 0"
              className="form-input"
              style={{ width: '100%', fontWeight: 800, fontSize: '1rem', padding: '8px' }}
            />
          </div>
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-gold, #D97706)', textAlign: 'right' }}>
          Total a cobrar: {money(currentTotal)}
        </div>
      </div>

      {showAliases && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px' }}>
            ¿A qué alias transfirió? ({money(tNum)})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeAliases.map((a) => {
              const st = aliasStatus(a, tNum);
              const sel = chosenAlias?.id === a.id;
              const rem = aliasRemaining(a);
              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={st.ok ? 0 : -1}
                  onClick={() => st.ok && setAliasChoice(a.id)}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && st.ok) { e.preventDefault(); setAliasChoice(a.id); } }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    padding: '8px 10px', borderRadius: '10px', cursor: st.ok ? 'pointer' : 'not-allowed',
                    border: sel ? '2px solid #10B981' : '1px solid var(--border-color)',
                    backgroundColor: sel ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                    opacity: st.ok ? 1 : 0.5
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.92rem', wordBreak: 'break-all', color: 'var(--text-main)' }}>
                      {sel ? '✓ ' : ''}{a.alias}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {[a.holder, a.bank].filter(Boolean).join(' · ')}
                      {rem !== null ? ` · quedan ${money(rem)}` : ''}
                    </div>
                    {a.description && <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#D97706' }}>“{a.description}”</div>}
                    {st.reason && <div style={{ fontSize: '0.72rem', fontWeight: 800, color: st.ok ? '#D97706' : '#DC2626' }}>{st.reason}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); copyAlias(a.alias); }}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.72rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Copiar alias"
                  >
                    {copied === a.alias ? <CheckCheck size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota opcional"
        className="form-input"
        style={{ width: '100%', marginBottom: '12px' }}
      />

      {error && <div role="alert" style={{ color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}

      <SaveButton busy={busy} amount={currentTotal} onSave={save} label={`Guardar pago dividido (${money(currentTotal)})`} />
    </Modal>
  );
}

// ---------------------------------------------------------------- Sección Alias del Día y Control de Transferencias
function DailyAliasSection({
  date,
  aliasConfig,
  aliases = [],
  transfers = [],
  sellers = [],
  numberMap = {},
  onConfigClick,
  onAddAliasClick,
  onAddTransferClick,
  onRefresh
}) {
  const [copied, setCopied] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [voidingId, setVoidingId] = useState(null);

  const totalTransfers = useMemo(() => {
    return (transfers || []).reduce((acc, t) => acc + (t.amount || 0), 0);
  }, [transfers]);

  // Topes sumados de los alias activos (para el Excel / WhatsApp de Mica)
  const activeAliases = aliases.filter((a) => a.active);
  const limit = activeAliases.reduce((acc, a) => acc + (a.dailyLimit || 0), 0) || Number(aliasConfig?.limit) || 0;
  const remaining = limit - totalTransfers;
  const pct = limit > 0 ? Math.round((totalTransfers / limit) * 100) : 0;
  const fullCount = activeAliases.filter((a) => aliasRemaining(a) === 0).length;
  const isOver = activeAliases.length > 0 && fullCount === activeAliases.length;
  const isNear = !isOver && fullCount > 0;
  const unassigned = transfers.filter((t) => !t.aliasId).reduce((acc, t) => acc + (t.amount || 0), 0);

  const copyAlias = (alias) => {
    navigator.clipboard?.writeText(alias);
    setCopied(alias);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExportExcelForMica = async () => {
    setExportingExcel(true);
    try {
      await downloadTransferenciasExcelForMica({
        date,
        aliasConfig,
        aliases,
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
      aliases,
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
                Alias de Cobro y Transferencias
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
{isOver ? '🚨 TODOS LOS ALIAS LLENOS' : isNear ? `⚠️ ${fullCount} ALIAS LLENO${fullCount > 1 ? 'S' : ''}` : `✅ ${activeAliases.length} ALIAS ACTIVO${activeAliases.length === 1 ? '' : 'S'}`}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Total transferido hoy: <strong>{money(totalTransfers)}</strong> ({transfers.length}) · al cobrar se sugiere solo el alias que acepta el monto
            </p>
          </div>
        </div>

        {/* Acciones principales */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onAddAliasClick}
            className="btn-primary"
            style={{ padding: '7px 13px', fontSize: '0.82rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Plus size={15} /> Agregar alias
          </button>
          <button
            type="button"
            onClick={onConfigClick}
            className="btn-secondary"
            style={{ padding: '7px 12px', fontSize: '0.82rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Pencil size={14} /> Editar / pausar alias
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

      {/* Tarjetas por alias: recibido hoy contra el tope */}
      {aliases.length === 0 ? (
        <div style={{ padding: '14px', borderRadius: '12px', border: '1px dashed var(--border-color)', textAlign: 'center', fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          No hay alias de cobro cargados. <button type="button" onClick={onAddAliasClick} className="btn-primary" style={{ padding: '3px 10px', fontSize: '0.78rem', marginLeft: '6px' }}>Agregar alias</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          {aliases.map((a, idx) => {
            const rem = aliasRemaining(a);
            const p = a.dailyLimit ? Math.round(((a.receivedToday || 0) / a.dailyLimit) * 100) : null;
            const full = rem === 0;
            const near = !full && p !== null && p >= 80;
            const isToday = date === todayAR();
            const isArchivedNow = isToday && a.archived;
            const isPausedNow = isToday && !a.active && !a.archived;
            const isOff = isToday && (!a.active || a.archived);
            const color = (isArchivedNow || isPausedNow) ? 'var(--text-muted)' : full ? '#DC2626' : near ? '#D97706' : '#10B981';
            return (
              <div key={a.id} style={{ border: `1.5px solid ${!isOff ? color : 'var(--border-color)'}`, borderRadius: '12px', padding: '10px 12px', backgroundColor: 'var(--bg-surface-elevated, var(--bg-card))', opacity: isOff ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                      {idx + 1}. {isArchivedNow ? 'ARCHIVADO' : isPausedNow ? 'PAUSADO' : full ? 'TOPE LLENO' : near ? 'CASI LLENO' : 'ACTIVO'}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.98rem', wordBreak: 'break-all' }}>{a.alias}</div>
                  </div>
                  <button type="button" onClick={() => copyAlias(a.alias)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === a.alias ? '#059669' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }} title="Copiar alias">
                    {copied === a.alias ? <CheckCheck size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{[a.holder, a.bank].filter(Boolean).join(' · ') || 'Sin titular'} · {aliasRules(a)}</div>
                {a.description && <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#92400E', marginTop: '2px' }}>“{a.description}”</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 800, marginTop: '6px' }}>
                  <span>{money(a.receivedToday)} <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>({a.countToday})</span></span>
                  <span style={{ color }}>{rem !== null ? (full ? 'Lleno' : `quedan ${money(rem)}`) : 'sin tope'}</span>
                </div>
                {a.dailyLimit ? (
                  <div style={{ height: '6px', borderRadius: '999px', backgroundColor: 'var(--border-color)', overflow: 'hidden', marginTop: '4px' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, p)}%`, backgroundColor: color, transition: 'width 0.4s ease' }} />
                  </div>
                ) : null}
              </div>
            );
          })}
          {unassigned > 0 && (
            <div style={{ border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <div style={{ fontWeight: 800 }}>Sin alias asignado</div>
              <div style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-main)' }}>{money(unassigned)}</div>
              Transferencias cargadas antes de los alias de cobro.
            </div>
          )}
        </div>
      )}

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
                  <th style={{ padding: '7px 8px', fontWeight: 700 }}>Alias</th>
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
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {t.aliasName || <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit' }}>—</span>}
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
  const [showAliasModal, setShowAliasModal] = useState(false); // false | 'edit' | 'new'
  const [showDirectTransferModal, setShowDirectTransferModal] = useState(false);
  const [showSharedSaleModal, setShowSharedSaleModal] = useState(false);
  const [sharedSalePrefill, setSharedSalePrefill] = useState(null);
  const [showSplitSaleModal, setShowSplitSaleModal] = useState(false);
  const [splitSalePrefill, setSplitSalePrefill] = useState(null);

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

  const handleDirectTransfer = async ({ sellerId, amount, note, aliasId }) => {
    const clientRef = crypto.randomUUID();
    const { queued } = await sendOrQueue({
      action: 'addSale',
      clientRef,
      sellerId,
      date,
      amount,
      method: 'transferencia',
      aliasId: aliasId || null,
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

  // Tiempo real: si Mica cambia un alias desde /supervisor, o se carga algo
  // desde otra pantalla, se refresca solo (lo que se está tipeando no se pierde).
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    if (!authed || !supabase) return undefined;
    let timer = null;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => loadRef.current(), 600);
    };
    let channel = supabase.channel('ventas-live');
    ['payment_aliases', 'seller_sales', 'seller_advances', 'seller_payouts', 'cash_counts', 'seller_commission_rates'].forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    });
    channel.subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') loadRef.current(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [authed]);

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
            <input type="date" value={date} max={shiftDate(todayAR(), 'day', 1)} onChange={(e) => e.target.value && setDate(e.target.value)} className="form-input" style={{ padding: '6px 8px' }} />
            <button type="button" className="qty-btn" onClick={() => setDate(shiftDate(date, period, 1))} disabled={date >= shiftDate(todayAR(), 'day', 1)} aria-label="Siguiente"><ChevronRight size={16} /></button>
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
                aliases={data.aliases || []}
                onSaleCreated={afterSave}
                onOpenNumbersModal={() => setShowNumbersModal(true)}
                onEditAliases={() => setShowAliasModal('new')}
                onOpenSharedModal={(s, a) => {
                  setSharedSalePrefill({ seller: s, amount: a });
                  setShowSharedSaleModal(true);
                }}
                onOpenSplitModal={(s, a) => {
                  setSplitSalePrefill({ seller: s, amount: a });
                  setShowSplitSaleModal(true);
                }}
              />
            )}

            {/* Acciones Especiales: Venta Compartida y Pago Dividido */}
            {period === 'day' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '10px',
                  marginBottom: '16px'
                }}
              >
                {/* Botón Acción 1: Venta Compartida */}
                <button
                  type="button"
                  onClick={() => {
                    setSharedSalePrefill(null);
                    setShowSharedSaleModal(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #C7D2FE',
                    backgroundColor: '#EEF2FF',
                    color: '#1E1B4B',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#E0E7FF';
                    e.currentTarget.style.borderColor = '#818CF8';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#EEF2FF';
                    e.currentTarget.style.borderColor = '#C7D2FE';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: '#4F46E5',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Users size={22} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.94rem', fontWeight: 900, color: '#312E81' }}>
                        👥 Venta Compartida
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          backgroundColor: '#4F46E5',
                          color: '#FFFFFF',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        2 o 3 Vendedoras
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#4338CA', marginTop: '2px', lineHeight: 1.25 }}>
                      Cargá una compra atendida por varias vendedoras. A cada una le suma su comisión justa según lo que vendió.
                    </div>
                  </div>
                </button>

                {/* Botón Acción 2: Pago Dividido */}
                <button
                  type="button"
                  onClick={() => {
                    setSplitSalePrefill(null);
                    setShowSplitSaleModal(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #FDE68A',
                    backgroundColor: '#FFFBEB',
                    color: '#78350F',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FEF3C7';
                    e.currentTarget.style.borderColor = '#F59E0B';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFBEB';
                    e.currentTarget.style.borderColor = '#FDE68A';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: '#D97706',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Zap size={22} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.94rem', fontWeight: 900, color: '#92400E' }}>
                        ⚡ Pago Dividido
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          backgroundColor: '#D97706',
                          color: '#FFFFFF',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        Efvo + Transf
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#B45309', marginTop: '2px', lineHeight: 1.25 }}>
                      Cobrá mitad y mitad (50/50) o con montos personalizados de efectivo y transferencia en un solo paso.
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Alias del Día y Control de Transferencias */}
            {period === 'day' && (
              <DailyAliasSection
                date={date}
                aliasConfig={data.dailyAlias}
                aliases={[...(data.aliases || []), ...(data.archivedAliases || []).filter((a) => a.countToday > 0 && !data.aliases?.some((x) => x.id === a.id))]}
                transfers={data.dayTransfers || []}
                sellers={data.sellers}
                numberMap={assignedNumbers}
                onConfigClick={() => setShowAliasModal('edit')}
                onAddAliasClick={() => setShowAliasModal('new')}
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

        {entry && (
          <EntryModal
            kind={entry.kind}
            seller={entry.seller}
            date={date}
            aliases={data?.aliases || []}
            onClose={() => setEntry(null)}
            onSaved={afterSave}
            onOpenSharedModal={(s, a) => {
              setEntry(null);
              setSharedSalePrefill({ seller: s, amount: a });
              setShowSharedSaleModal(true);
            }}
          />
        )}
        {payoutSeller && data && <PayoutModal seller={payoutSeller} data={data} onClose={() => setPayoutSeller(null)} onSaved={afterSave} />}
        {showCash && data?.cash && <CashCountModal date={date} cash={data.cash} onClose={() => { setShowCash(false); load(); }} onSaved={(queued) => { if (queued) afterSave(true); }} />}
        {detailSeller && data && <DetailModal seller={detailSeller} periodFrom={data.from} periodTo={data.to} onClose={() => setDetailSeller(null)} onChanged={load} />}
        {showSharedSaleModal && data?.sellers && (
          <SharedSaleModal
            date={date}
            sellers={data.sellers}
            numberMap={assignedNumbers}
            aliases={data.aliases || []}
            initialSeller={sharedSalePrefill?.seller || null}
            initialAmount={sharedSalePrefill?.amount || ''}
            onClose={() => {
              setShowSharedSaleModal(false);
              setSharedSalePrefill(null);
            }}
            onSaved={afterSave}
          />
        )}
        {showSplitSaleModal && data?.sellers && (
          <SplitSaleModal
            date={date}
            sellers={data.sellers}
            numberMap={assignedNumbers}
            aliases={data.aliases || []}
            initialSeller={splitSalePrefill?.seller || null}
            initialAmount={splitSalePrefill?.amount || ''}
            onClose={() => {
              setShowSplitSaleModal(false);
              setSplitSalePrefill(null);
            }}
            onSaved={afterSave}
          />
        )}
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
          <AliasManager
            date={date}
            aliases={data?.aliases || []}
            archivedAliases={data?.archivedAliases || []}
            post={(body) => api('POST', { ...body, date: body.date || date })}
            onChanged={load}
            onClose={() => setShowAliasModal(false)}
            startAdding={showAliasModal === 'new'}
          />
        )}
        {showDirectTransferModal && data?.sellers && (
          <DirectTransferModal
            date={date}
            sellers={data.sellers}
            numberMap={assignedNumbers}
            aliases={data.aliases || []}
            onClose={() => setShowDirectTransferModal(false)}
            onSave={handleDirectTransfer}
          />
        )}
      </div>
    </div>
  );
}
