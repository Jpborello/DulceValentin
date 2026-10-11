'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScanLine, Search, Trash2, Minus, Plus, Send, Wallet, Receipt, LogOut, Loader2, X, Printer, RefreshCw, Store } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { adminFetch } from '@/lib/adminFetch';
import { dataStore } from '@/lib/dataStore';
import { getProductColorsForSize } from '@/lib/catalogData';
import { getProductPrice } from '@/lib/productPricing';

// Caja del local (2026-10). Vendedoras arman ventas a su nombre (quedan
// "pendientes de cobro"); la cajera las cobra en efectivo o transferencia.
// Toda la logica de stock/precios/permisos esta en /api/pos/* (servidor).

const money = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const ROLE_LABEL = { admin: 'Administración', cajera: 'Caja', vendedora: 'Vendedora' };
const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia / Mercado Pago' };
const todayAR = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10);

async function api(path, options = {}) {
  const res = await adminFetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error.');
  return data;
}

function printTicket(sale, extra = {}) {
  const win = window.open('', '_blank', 'width=380,height=600');
  if (!win) return;
  const rows = (sale.items || []).map((it) => {
    const p = it.product || {};
    const variant = [p.selectedSize ? `T.${p.selectedSize}` : '', p.selectedColor || ''].filter(Boolean).join(' ');
    return `<tr><td>${it.quantity}x ${String(p.name || '').replace(/</g, '&lt;')}${variant ? ` <small>(${variant})</small>` : ''}</td><td style="text-align:right">${money((p.unit_price || 0) * it.quantity)}</td></tr>`;
  }).join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${sale.id}</title>
<style>@page{size:80mm auto;margin:3mm}body{font-family:monospace;font-size:12px;width:72mm;margin:0}h1{font-size:15px;text-align:center;margin:0 0 4px}table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}.tot{font-size:15px;font-weight:bold;border-top:1px dashed #000;padding-top:4px}.c{text-align:center}</style></head><body>
<h1>Dulce Valentín</h1><div class="c">Pte. Perón 5349 - Rosario</div><div class="c">${new Date(sale.paid_at || sale.created_at).toLocaleString('es-AR')}</div>
<div class="c">Venta ${sale.id}${sale.seller_name ? ` · Vend.: ${sale.seller_name}` : ''}</div><hr>
<table>${rows}</table>
<table><tr class="tot"><td>TOTAL</td><td style="text-align:right">${money(sale.total_amount)}</td></tr>
${extra.method ? `<tr><td>Pago</td><td style="text-align:right">${METHOD_LABEL[extra.method] || extra.method}</td></tr>` : ''}
${extra.cashReceived ? `<tr><td>Recibido</td><td style="text-align:right">${money(extra.cashReceived)}</td></tr><tr><td>Vuelto</td><td style="text-align:right">${money(extra.change)}</td></tr>` : ''}
</table><hr><div class="c">¡Gracias por tu compra!</div>
<script>window.onload=function(){setTimeout(function(){window.print();},200)}<\/script></body></html>`);
  win.document.close();
}

// ---------------------------------------------------------------- Login
function LoginBox({ onLogged }) {
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
      <form onSubmit={submit} style={{ width: '100%', maxWidth: '360px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}><Store size={22} /> Caja Dulce Valentín</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>Ingresá con tu usuario de vendedora o caja.</p>
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

// ---------------------------------------------------------------- Nueva venta
function NewSale({ me, sellers, products, onCreated }) {
  const [lines, setLines] = useState([]);
  const [scan, setScan] = useState('');
  const [search, setSearch] = useState('');
  const [sellerId, setSellerId] = useState(me.id);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const scanRef = useRef(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const addLine = useCallback((product, size = null, color = null) => {
    setLines((prev) => {
      const key = `${product.id}::${size || ''}::${color || ''}`;
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { key, productId: product.id, size, color, quantity: 1 }];
    });
    setMessage(null);
  }, []);

  const handleScan = async (e) => {
    e.preventDefault();
    const code = scan.trim();
    setScan('');
    if (!code) return;
    try {
      const data = await api(`/api/pos/lookup?barcode=${encodeURIComponent(code)}`);
      const product = productById.get(data.productId);
      if (!product) throw new Error('El producto de ese código ya no está en el catálogo.');
      addLine(product, data.size, data.color);
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
    scanRef.current?.focus();
  };

  const results = useMemo(() => {
    const q = norm(search);
    if (q.length < 2) return [];
    return products.filter((p) => norm(p.name).includes(q) || norm(p.code) === q || norm(p.code).startsWith(q)).slice(0, 8);
  }, [search, products]);

  const setLine = (key, patch) => setLines((prev) => prev.map((l) => {
    if (l.key !== key) return l;
    const next = { ...l, ...patch };
    next.key = `${next.productId}::${next.size || ''}::${next.color || ''}`;
    return next;
  }));

  const total = lines.reduce((s, l) => {
    const p = productById.get(l.productId);
    return s + (p ? getProductPrice(p, l.size) * l.quantity : 0);
  }, 0);

  const missingVariant = lines.find((l) => {
    const p = productById.get(l.productId);
    if (!p) return false;
    const hasSizes = Array.isArray(p.sizes) && p.sizes.length > 0;
    const colors = getProductColorsForSize(p, l.size);
    return (hasSizes && !l.size) || (colors.length > 1 && !l.color);
  });

  const submit = async (chargeNow) => {
    if (lines.length === 0 || busy) return;
    if (missingVariant) {
      setMessage({ ok: false, text: `Elegí talle/color de "${productById.get(missingVariant.productId)?.name}".` });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { sale } = await api('/api/pos/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: lines.map((l) => ({ id: l.productId, quantity: l.quantity, size: l.size, color: l.color })),
          sellerId,
          clientName,
          clientPhone,
          notes
        })
      });
      setLines([]);
      setClientName('');
      setClientPhone('');
      setNotes('');
      setMessage({ ok: true, text: `Venta ${sale.id} por ${money(sale.total_amount)} ${chargeNow ? 'creada: cobrala abajo.' : 'enviada a caja.'}` });
      onCreated(sale, chargeNow);
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
      scanRef.current?.focus();
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', alignItems: 'start' }}>
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '18px', border: '1px solid var(--border-color)' }}>
        <form onSubmit={handleScan} style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Escaneá el código de la etiqueta</label>
          <div style={{ position: 'relative', marginTop: '4px' }}>
            <ScanLine size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input ref={scanRef} autoFocus inputMode="numeric" value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Código de barras + Enter" className="form-input" style={{ width: '100%', paddingLeft: '36px', fontSize: '1rem', fontWeight: 700 }} />
          </div>
        </form>

        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>…o buscá por nombre / artículo</label>
        <div style={{ position: 'relative', marginTop: '4px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ej: remera, 0220" className="form-input" style={{ width: '100%', paddingLeft: '34px' }} />
        </div>
        {results.length > 0 && (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', marginTop: '6px', overflow: 'hidden' }}>
            {results.map((p) => (
              <button key={p.id} type="button" onClick={() => { addLine(p); setSearch(''); }}
                style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', border: 'none', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', color: 'var(--text-main)' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>{p.code ? `#${p.code} · ` : ''}{p.name}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{money(getProductPrice(p, null))} · {p.stock} u.</span>
              </button>
            ))}
          </div>
        )}

        {me.role !== 'vendedora' && (
          <div style={{ marginTop: '14px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Venta de</label>
            <select value={sellerId} onChange={(e) => setSellerId(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }}>
              {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.id === me.id ? ' (yo)' : ''} — {ROLE_LABEL[s.role]}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '14px' }}>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Cliente (opcional)" className="form-input" />
          <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Teléfono (opcional)" inputMode="tel" className="form-input" />
        </div>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nota (opcional)" className="form-input" style={{ width: '100%', marginTop: '8px' }} />
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '18px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '10px' }}>Venta actual</h3>
        {lines.length === 0 ? (
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>Escaneá o buscá prendas para empezar.</p>
        ) : lines.map((l) => {
          const p = productById.get(l.productId);
          if (!p) return null;
          const sizes = Array.isArray(p.sizes) ? p.sizes : [];
          const colors = getProductColorsForSize(p, l.size);
          return (
            <div key={l.key} style={{ borderBottom: '1px solid var(--border-color)', padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <strong style={{ fontSize: '0.88rem' }}>{p.name}</strong>
                <strong style={{ fontSize: '0.9rem' }}>{money(getProductPrice(p, l.size) * l.quantity)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {sizes.length > 0 && (
                  <select value={l.size || ''} onChange={(e) => setLine(l.key, { size: e.target.value || null, color: null })} className="form-input" style={{ padding: '3px 6px', fontSize: '0.8rem', borderColor: l.size ? undefined : '#F59E0B' }}>
                    <option value="">Talle…</option>
                    {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {colors.length > 1 && (
                  <select value={l.color || ''} onChange={(e) => setLine(l.key, { color: e.target.value || null })} className="form-input" style={{ padding: '3px 6px', fontSize: '0.8rem', borderColor: l.color ? undefined : '#F59E0B' }}>
                    <option value="">Color…</option>
                    {colors.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                  <button type="button" className="qty-btn" onClick={() => setLine(l.key, { quantity: Math.max(1, l.quantity - 1) })}><Minus size={13} /></button>
                  <span style={{ minWidth: '22px', textAlign: 'center', fontWeight: 800 }}>{l.quantity}</span>
                  <button type="button" className="qty-btn" onClick={() => setLine(l.key, { quantity: l.quantity + 1 })}><Plus size={13} /></button>
                  <button type="button" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', marginLeft: '4px' }} aria-label="Quitar"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: '1.2rem', fontWeight: 900 }}>
          <span>Total</span><span>{money(total)}</span>
        </div>

        {message && (
          <div role="status" style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 600, backgroundColor: message.ok ? '#ECFDF5' : '#FEF2F2', color: message.ok ? '#047857' : '#B91C1C' }}>
            {message.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button type="button" onClick={() => submit(false)} disabled={lines.length === 0 || busy} className={me.role === 'vendedora' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '11px', opacity: lines.length === 0 ? 0.5 : 1 }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar a caja
          </button>
          {me.role !== 'vendedora' && (
            <button type="button" onClick={() => submit(true)} disabled={lines.length === 0 || busy} className="btn-primary" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '11px', opacity: lines.length === 0 ? 0.5 : 1 }}>
              <Wallet size={16} /> Cobrar ahora
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Cobro
function ChargePanel({ sale, onDone, onClose }) {
  const [method, setMethod] = useState('efectivo');
  const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const total = Number(sale.total_amount) || 0;
  const change = method === 'efectivo' && received !== '' ? Number(received) - total : null;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/pos/sales/charge', {
        method: 'POST',
        body: JSON.stringify({ orderId: sale.id, paymentMethod: method, cashReceived: method === 'efectivo' && received !== '' ? Number(received) : null })
      });
      setResult({ ...data, method, cashReceived: method === 'efectivo' && received !== '' ? Number(received) : null });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="qty-btn" style={{ position: 'absolute', top: '14px', right: '14px' }}><X size={18} /></button>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '2px' }}>Cobrar venta {sale.id}</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          {sale.seller_name ? `Vendedora: ${sale.seller_name} · ` : ''}{(sale.items || []).reduce((s, i) => s + i.quantity, 0)} prendas
        </p>
        <div style={{ fontSize: '1.8rem', fontWeight: 900, textAlign: 'center', marginBottom: '14px' }}>{money(total)}</div>

        {result ? (
          <div>
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#047857', fontWeight: 800, textAlign: 'center', marginBottom: '12px' }}>
              ✓ Cobrado{result.change !== null ? ` · Vuelto: ${money(result.change)}` : ''}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => printTicket({ ...sale, paid_at: result.paid_at }, { method: result.method, cashReceived: result.cashReceived, change: result.change })} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={16} /> Ticket
              </button>
              <button type="button" onClick={onClose} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Listo</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              {Object.entries(METHOD_LABEL).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setMethod(id)}
                  style={{ padding: '10px', borderRadius: '10px', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', border: method === id ? '2px solid var(--text-main)' : '1px solid var(--border-color)', backgroundColor: method === id ? 'var(--text-main)' : 'var(--bg-card)', color: method === id ? 'var(--bg-page)' : 'var(--text-main)' }}>
                  {label}
                </button>
              ))}
            </div>
            {method === 'efectivo' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Efectivo recibido (opcional, para calcular el vuelto)</label>
                <input type="number" inputMode="decimal" min="0" value={received} onChange={(e) => setReceived(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px', fontSize: '1.1rem', fontWeight: 800 }} autoFocus />
                {change !== null && (
                  <div style={{ marginTop: '6px', fontWeight: 800, color: change >= 0 ? '#047857' : '#B91C1C' }}>
                    {change >= 0 ? `Vuelto: ${money(change)}` : `Faltan ${money(-change)}`}
                  </div>
                )}
              </div>
            )}
            {error && <div role="alert" style={{ color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
            <button type="button" onClick={confirm} disabled={busy || (change !== null && change < 0)} className="btn-primary" style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '12px' }}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Wallet size={17} />} Confirmar cobro
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Listas
function SalesList({ sales, me, onCharge, onCancel, emptyText }) {
  if (sales.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{emptyText}</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {sales.map((s) => (
        <div key={s.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <strong>{s.id}</strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> · {new Date(s.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}{s.seller_name ? ` · ${s.seller_name}` : ''}{s.client_name && s.client_name !== 'Venta en el local' ? ` · ${s.client_name}` : ''}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '1.05rem' }}>{money(s.total_amount)}</strong>
              {s.status === 'cobrado' && <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#047857', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '20px' }}>✓ {METHOD_LABEL[s.payment_method] || 'Cobrado'}</span>}
              {s.status === 'cancelado' && <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#B91C1C', backgroundColor: '#FEF2F2', padding: '2px 8px', borderRadius: '20px' }}>Cancelada</span>}
              {s.status === 'pendiente_cobro' && <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#92400E', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '20px' }}>Por cobrar</span>}
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {(s.items || []).map((it) => `${it.quantity}× ${it.product?.name}${it.product?.selectedSize ? ` T.${it.product.selectedSize}` : ''}${it.product?.selectedColor ? ` ${it.product.selectedColor}` : ''}`).join(' · ')}
          </div>
          {s.customer_notes && <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>📝 {s.customer_notes}</div>}
          {s.status === 'pendiente_cobro' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {me.role !== 'vendedora' && (
                <button type="button" onClick={() => onCharge(s)} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Wallet size={15} /> Cobrar
                </button>
              )}
              <button type="button" onClick={() => onCancel(s)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Cancelar venta</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Report({ me }) {
  const [from, setFrom] = useState(todayAR());
  const [to, setTo] = useState(todayAR());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api(`/api/pos/report?from=${from}&to=${to}`));
    } catch (err) {
      setError(err.message);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '18px', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Desde</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="form-input" />
        <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Hasta</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="form-input" />
        <button type="button" onClick={load} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><RefreshCw size={14} /> Actualizar</button>
      </div>
      {error && <div role="alert" style={{ color: '#B91C1C', fontWeight: 600 }}>{error}</div>}
      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--bg-surface-elevated)' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>Total cobrado</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{money(data.total)}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{data.count} ventas</div>
            </div>
            {Object.entries(data.byMethod).map(([m, amount]) => (
              <div key={m} style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--bg-surface-elevated)' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>{METHOD_LABEL[m] || m}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{money(amount)}</div>
              </div>
            ))}
          </div>
          <table className="admin-table">
            <thead><tr><th>{me.role === 'vendedora' ? 'Yo' : 'Vendedora'}</th><th>Ventas</th><th>Total vendido</th><th>Comisión</th></tr></thead>
            <tbody>
              {data.bySeller.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>Sin ventas cobradas en el período.</td></tr>}
              {data.bySeller.map((r) => (
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
  );
}

// ---------------------------------------------------------------- Página
export default function CajaPage() {
  const [checking, setChecking] = useState(true);
  const [me, setMe] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState('new');
  const [products, setProducts] = useState([]);
  const [pending, setPending] = useState([]);
  const [today, setToday] = useState([]);
  const [charging, setCharging] = useState(null);

  const loadMe = useCallback(async () => {
    setAuthError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMe(null);
      setChecking(false);
      return;
    }
    try {
      const data = await api('/api/pos/me');
      setMe(data.staff);
      setSellers(data.sellers || []);
    } catch (err) {
      setMe(null);
      setAuthError(err.message);
    }
    setChecking(false);
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  useEffect(() => {
    const update = () => setProducts(dataStore.getProducts().filter((p) => Number(p.stock) > 0));
    update();
    const unsub = dataStore.subscribe(update);
    const unsubRt = dataStore.subscribeProductsRealtime();
    return () => { unsub(); unsubRt(); };
  }, []);

  const refreshLists = useCallback(async () => {
    if (!me) return;
    try {
      const [p, t] = await Promise.all([api('/api/pos/sales?scope=pending'), api('/api/pos/sales?scope=today')]);
      setPending(p.sales || []);
      setToday(t.sales || []);
    } catch {}
  }, [me]);

  useEffect(() => {
    if (!me) return;
    refreshLists();
    const id = setInterval(refreshLists, 8000);
    return () => clearInterval(id);
  }, [me, refreshLists]);

  const handleCancel = async (sale) => {
    if (!window.confirm(`¿Cancelar la venta ${sale.id}? Las prendas vuelven al stock.`)) return;
    try {
      await api('/api/pos/sales/cancel', { method: 'POST', body: JSON.stringify({ orderId: sale.id }) });
      refreshLists();
    } catch (err) {
      window.alert(err.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setMe(null);
  };

  if (checking) return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="animate-spin" /></div>;
  if (!me) {
    return (
      <>
        {authError && <div role="alert" style={{ position: 'fixed', top: 0, left: 0, right: 0, padding: '10px', textAlign: 'center', backgroundColor: '#FEF2F2', color: '#B91C1C', fontWeight: 700, zIndex: 10 }}>{authError} <button type="button" onClick={logout} style={{ marginLeft: '8px', textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>Salir</button></div>}
        <LoginBox onLogged={loadMe} />
      </>
    );
  }

  const tabs = [
    { id: 'new', label: 'Nueva venta', icon: ScanLine },
    { id: 'pending', label: `Por cobrar (${pending.length})`, icon: Wallet },
    { id: 'today', label: 'Ventas de hoy', icon: Receipt },
    { id: 'report', label: me.role === 'vendedora' ? 'Mis comisiones' : 'Cierre y comisiones', icon: Receipt }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-surface-elevated)', padding: '16px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}><Store size={22} /> Caja</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem' }}>
            <span><strong>{me.name}</strong> · {ROLE_LABEL[me.role]}</span>
            <button type="button" onClick={logout} className="btn-secondary" style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><LogOut size={14} /> Salir</button>
          </div>
        </header>

        <nav style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`admin-tab-btn ${tab === t.id ? 'active' : ''}`}>
              <t.icon size={15} style={{ display: 'inline', marginRight: '6px' }} />{t.label}
            </button>
          ))}
        </nav>

        {tab === 'new' && (
          <NewSale
            me={me}
            sellers={sellers}
            products={products}
            onCreated={(sale, chargeNow) => {
              refreshLists();
              if (chargeNow) setCharging(sale);
            }}
          />
        )}
        {tab === 'pending' && <SalesList sales={pending} me={me} onCharge={setCharging} onCancel={handleCancel} emptyText="No hay ventas pendientes de cobro." />}
        {tab === 'today' && <SalesList sales={today} me={me} onCharge={setCharging} onCancel={handleCancel} emptyText="Todavía no hay ventas hoy." />}
        {tab === 'report' && <Report me={me} />}

        {charging && (
          <ChargePanel
            sale={charging}
            onDone={refreshLists}
            onClose={() => setCharging(null)}
          />
        )}
      </div>
    </div>
  );
}
