'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScanLine, Search, Trash2, Minus, Plus, Send, Wallet, Receipt, LogOut, Loader2, X, Printer, RefreshCw, Store, WifiOff, CloudUpload, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { adminFetch } from '@/lib/adminFetch';
import { dataStore } from '@/lib/dataStore';
import { getProductColorsForSize } from '@/lib/catalogData';
import { getUnitPriceForType, hasDistinctRetailPrice } from '@/lib/productPricing';
import { FEATURES } from '@/lib/features';
import { printThermalSaleTicket } from '@/lib/printUtils';
import { resolveBarcodeMatches } from '@/lib/barcode';
import {
  isOffline,
  isNetworkError,
  cacheMe,
  readCachedMe,
  clearCachedMe,
  savePosCatalog,
  loadPosCatalog,
  getQueue,
  queueOfflineSale,
  chargeOfflineSale,
  queueOfflineCharge,
  removeFromQueue,
  clearQueueFlags,
  syncOfflineQueue,
  reservedByVariant,
  QUEUE_EVENT
} from '@/lib/posOffline';

// Caja del local (2026-10). Vendedoras arman ventas a su nombre (quedan
// "pendientes de cobro"); la cajera las cobra en efectivo o transferencia.
// Toda la logica de stock/precios/permisos esta en /api/pos/* (servidor).
// Sin internet (2026-11) la caja sigue vendiendo con la ultima copia del
// catalogo y guarda las ventas en una cola que se sube sola al volver la
// conexion (ver src/lib/posOffline.js).

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
  printThermalSaleTicket({
    order: sale,
    cajaName: 'Caja 01',
    cashier: sale.cashier_name || sale.seller_name || '',
    paymentMethod: extra.method || sale.payment_method,
    cashGiven: extra.cashReceived,
    changeDue: extra.change
  });
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
const PRICE_MODE_KEY = 'dv_caja_price_mode';
const lineKey = (productId, size, color, priceType) => `${productId}::${size || ''}::${color || ''}::${priceType || 'mayor'}`;

// Ventana para elegir por mayor / por menor al agregar una prenda.
function PriceTypePicker({ pending, onPick, onCancel }) {
  const { product, size } = pending;
  const mayor = getUnitPriceForType(product, size, 'mayor');
  const menor = getUnitPriceForType(product, size, 'menor');
  useEffect(() => {
    // Solo Esc para cancelar: sin atajos de numeros ni foco en un boton, para
    // que un escaneo siguiente (digitos + Enter del lector) no elija un precio solo.
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  const btn = (bg) => ({ padding: '14px 10px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: bg, color: '#fff', fontWeight: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' });
  return (
    <div className="modal-backdrop active" onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Elegir precio">
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '2px' }}>¿Por mayor o por menor?</h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '14px' }}>{product.name}{size ? ` · Talle ${size}` : ''}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button type="button" onClick={() => onPick('mayor')} style={btn('#2563EB')}>
            <span style={{ fontSize: '0.8rem' }}>Por mayor</span><span style={{ fontSize: '1.2rem' }}>{money(mayor)}</span>
          </button>
          <button type="button" onClick={() => onPick('menor')} style={btn('#16A34A')}>
            <span style={{ fontSize: '0.8rem' }}>Por menor</span><span style={{ fontSize: '1.2rem' }}>{money(menor)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function NewSale({ me, sellers, products, offline, onCreated }) {
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

  // Precio por mayor o por menor. 'ask' = pregunta al agregar cada prenda
  // (solo si esa prenda tiene un precio por menor distinto); se recuerda en este equipo.
  const [pricingMode, setPricingModeState] = useState('ask');
  const [pendingAdd, setPendingAdd] = useState(null); // { product, size, color }
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRICE_MODE_KEY);
      if (['ask', 'mayor', 'menor'].includes(saved)) setPricingModeState(saved);
    } catch {}
  }, []);
  const setPricingMode = (mode) => {
    setPricingModeState(mode);
    try { localStorage.setItem(PRICE_MODE_KEY, mode); } catch {}
  };

  const addLine = useCallback((product, size = null, color = null, priceType = 'mayor') => {
    setLines((prev) => {
      const key = lineKey(product.id, size, color, priceType);
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { key, productId: product.id, size, color, priceType, quantity: 1 }];
    });
    setMessage(null);
  }, []);

  // Agregar una prenda respetando el modo de precio.
  const requestAdd = (product, size = null, color = null) => {
    if (pricingMode !== 'ask') return addLine(product, size, color, pricingMode);
    if (!hasDistinctRetailPrice(product, size)) return addLine(product, size, color, 'mayor'); // mismo precio: no hace falta preguntar
    setPendingAdd({ product, size, color });
  };
  const confirmPendingAdd = (priceType) => {
    if (!pendingAdd) return;
    addLine(pendingAdd.product, pendingAdd.size, pendingAdd.color, priceType);
    setPendingAdd(null);
    setTimeout(() => scanRef.current?.focus(), 0);
  };

  const handleScan = async (e) => {
    e.preventDefault();
    const code = scan.trim();
    setScan('');
    if (!code) return;
    if (pendingAdd) {
      setMessage({ ok: false, text: `Primero elegí si "${pendingAdd.product.name}" va por mayor o por menor.` });
      return;
    }
    // Primero se busca en el catalogo cargado (codigos de barra por variante
    // del producto o codigo de articulo): anda con y sin internet.
    const local = resolveBarcodeMatches(products, code);
    if (local.length > 0) {
      const m = local[0];
      requestAdd(productById.get(m.product.id) || m.product, m.size, m.color);
      if (local.length > 1) setMessage({ ok: false, text: `Ese código coincide con ${local.length} prendas: se agregó "${m.product.name}". Revisá que sea la correcta.` });
      scanRef.current?.focus();
      return;
    }
    if (offline) {
      setMessage({ ok: false, text: `No hay ninguna prenda con el código ${code} en la copia guardada.` });
      scanRef.current?.focus();
      return;
    }
    try {
      const data = await api(`/api/pos/lookup?barcode=${encodeURIComponent(code)}`);
      const product = productById.get(data.productId);
      if (!product) throw new Error('El producto de ese código ya no está en el catálogo.');
      requestAdd(product, data.size, data.color);
    } catch (err) {
      setMessage({ ok: false, text: isNetworkError(err) ? 'Sin conexión y el código no está en la copia guardada.' : err.message });
    }
    scanRef.current?.focus();
  };

  const results = useMemo(() => {
    const q = norm(search);
    if (q.length < 2) return [];
    return products.filter((p) => norm(p.name).includes(q) || norm(p.code) === q || norm(p.code).startsWith(q)).slice(0, 8);
  }, [search, products]);

  // Si el cambio deja dos renglones iguales (misma prenda, talle, color y
  // tipo de precio), se juntan en uno sumando las cantidades.
  const setLine = (key, patch) => setLines((prev) => {
    const updated = prev.map((l) => {
      if (l.key !== key) return l;
      const next = { ...l, ...patch };
      next.key = lineKey(next.productId, next.size, next.color, next.priceType);
      return next;
    });
    const merged = [];
    for (const l of updated) {
      const same = merged.find((m) => m.key === l.key);
      if (same) same.quantity += l.quantity;
      else merged.push({ ...l });
    }
    return merged;
  });

  const linePrice = (p, l) => getUnitPriceForType(p, l.size, l.priceType);
  const total = lines.reduce((s, l) => {
    const p = productById.get(l.productId);
    return s + (p ? linePrice(p, l) * l.quantity : 0);
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
    const resetForm = () => {
      setLines([]);
      setClientName('');
      setClientPhone('');
      setNotes('');
    };
    // Sin internet: la venta queda en la cola de este dispositivo.
    const saveOffline = async () => {
      const seller = sellers.find((s) => s.id === sellerId) || me;
      const sale = await queueOfflineSale({ lines, productById, seller, me, clientName, clientPhone, notes });
      resetForm();
      setMessage({ ok: true, text: `Sin conexión: venta ${sale.id} por ${money(sale.total_amount)} guardada en este equipo. Se sube sola cuando vuelva internet.${chargeNow ? ' Cobrala abajo.' : ''}` });
      onCreated(sale, chargeNow);
    };
    try {
      if (offline) {
        await saveOffline();
        return;
      }
      const { sale } = await api('/api/pos/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: lines.map((l) => ({ id: l.productId, quantity: l.quantity, size: l.size, color: l.color, priceType: l.priceType || 'mayor' })),
          sellerId,
          clientName,
          clientPhone,
          notes
        })
      });
      resetForm();
      setMessage({ ok: true, text: `Venta ${sale.id} por ${money(sale.total_amount)} ${chargeNow ? 'creada: cobrala abajo.' : 'enviada a caja.'}` });
      onCreated(sale, chargeNow);
    } catch (err) {
      if (!offline && isNetworkError(err)) {
        // Se corto justo al enviar: se guarda en la cola. Caso raro: si el
        // pedido llego al servidor y lo que se perdio fue la respuesta, la
        // venta queda dos veces (la LOC- y la OFF-) y hay que cancelar una.
        try {
          await saveOffline();
        } catch (offErr) {
          setMessage({ ok: false, text: offErr.message });
        }
      } else {
        setMessage({ ok: false, text: err.message });
      }
    } finally {
      setBusy(false);
      scanRef.current?.focus();
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', alignItems: 'start' }}>
      {pendingAdd && (
        <PriceTypePicker pending={pendingAdd} onPick={confirmPendingAdd} onCancel={() => { setPendingAdd(null); scanRef.current?.focus(); }} />
      )}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '18px', border: '1px solid var(--border-color)' }}>
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Precio</span>
          <div role="group" aria-label="Precio por mayor o por menor" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '4px' }}>
            {[['ask', 'Preguntar'], ['mayor', 'Por mayor'], ['menor', 'Por menor']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setPricingMode(id)} aria-pressed={pricingMode === id}
                style={{ padding: '7px 6px', borderRadius: '9px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', border: pricingMode === id ? '2px solid var(--text-main)' : '1px solid var(--border-color)', backgroundColor: pricingMode === id ? 'var(--text-main)' : 'var(--bg-card)', color: pricingMode === id ? 'var(--bg-page)' : 'var(--text-main)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

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
              <button key={p.id} type="button" onClick={() => { requestAdd(p); setSearch(''); }}
                style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', border: 'none', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', color: 'var(--text-main)' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>{p.code ? `#${p.code} · ` : ''}{p.name}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {hasDistinctRetailPrice(p, null)
                    ? `May. ${money(getUnitPriceForType(p, null, 'mayor'))} · Men. ${money(getUnitPriceForType(p, null, 'menor'))}`
                    : money(getUnitPriceForType(p, null, 'mayor'))} · {p.stock} u.
                </span>
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
                <strong style={{ fontSize: '0.9rem' }}>{money(linePrice(p, l) * l.quantity)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {hasDistinctRetailPrice(p, l.size) ? (
                  <button type="button" onClick={() => setLine(l.key, { priceType: l.priceType === 'menor' ? 'mayor' : 'menor' })}
                    title="Cambiar entre precio por mayor y por menor"
                    style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', border: 'none', backgroundColor: l.priceType === 'menor' ? '#DCFCE7' : '#DBEAFE', color: l.priceType === 'menor' ? '#166534' : '#1E40AF' }}>
                    {l.priceType === 'menor' ? 'Por menor' : 'Por mayor'} · {money(linePrice(p, l))} ⇄
                  </button>
                ) : (
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{money(linePrice(p, l))} c/u</span>
                )}
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
function ChargePanel({ sale, me, offline, onDone, onClose }) {
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
    const cashReceived = method === 'efectivo' && received !== '' ? Number(received) : null;
    const offlineArgs = { paymentMethod: method, cashReceived, cashierName: me.name, me };
    // Sin internet: venta de la cola -> se cobra en la cola; venta ya subida
    // -> se encola solo el cobro.
    const chargeOffline = () => (sale.offline ? chargeOfflineSale(sale.id, offlineArgs) : queueOfflineCharge(sale, offlineArgs));
    try {
      const data = sale.offline || offline
        ? await chargeOffline()
        : await api('/api/pos/sales/charge', {
          method: 'POST',
          body: JSON.stringify({ orderId: sale.id, paymentMethod: method, cashReceived })
        });
      setResult({ ...data, method, cashReceived, offline: Boolean(sale.offline || offline) });
      onDone();
    } catch (err) {
      if (!offline && !sale.offline && isNetworkError(err)) {
        try {
          const data = await chargeOffline();
          setResult({ ...data, method, cashReceived, offline: true });
          onDone();
        } catch (offErr) {
          setError(offErr.message);
        }
      } else {
        setError(err.message);
      }
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
            {result.offline && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '-4px', marginBottom: '12px' }}>
                Sin conexión: el cobro quedó guardado en este equipo y se sube solo cuando vuelva internet.
              </p>
            )}
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
              {s.offline && (
                <span style={{ marginLeft: '6px', fontSize: '0.72rem', fontWeight: 800, color: s.syncError ? '#B91C1C' : '#92400E', backgroundColor: s.syncError ? '#FEF2F2' : '#FEF3C7', padding: '2px 7px', borderRadius: '20px' }}>
                  {s.syncError ? '⚠ No se pudo subir' : '☁ Sin subir'}
                </span>
              )}
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
            {(s.items || []).map((it) => `${it.quantity}× ${it.product?.name}${it.product?.selectedSize ? ` T.${it.product.selectedSize}` : ''}${it.product?.selectedColor ? ` ${it.product.selectedColor}` : ''}${(it.price_type || it.product?.price_type) === 'menor' ? ' (por menor)' : ''}`).join(' · ')}
          </div>
          {s.customer_notes && <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>📝 {s.customer_notes}</div>}
          {s.syncError && <div style={{ fontSize: '0.78rem', marginTop: '4px', color: '#B91C1C', fontWeight: 600 }}>{s.syncError}</div>}
          {s.status === 'pendiente_cobro' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {me.role !== 'vendedora' && (
                <button type="button" onClick={() => onCharge(s)} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Wallet size={15} /> Cobrar
                </button>
              )}
              {!s.offlineChargeOnly && (
                <button type="button" onClick={() => onCancel(s)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Cancelar venta</button>
              )}
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
      setError(isNetworkError(err)
        ? 'Sin conexión: el cierre se ve cuando vuelva internet. Las ventas guardadas en este equipo se suman al subirse.'
        : err.message);
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
// Caja apagada hasta que se contrate (ver src/lib/features.js).
export default function CajaPageGate() {
  if (!FEATURES.POS) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '6px' }}>Caja no disponible</h1>
          <p style={{ color: 'var(--text-muted)' }}>Esta función todavía no está habilitada.</p>
        </div>
      </div>
    );
  }
  return <CajaPage />;
}

function CajaPage() {
  const [checking, setChecking] = useState(true);
  const [me, setMe] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState('new');
  const [pending, setPending] = useState([]);
  const [today, setToday] = useState([]);
  const [charging, setCharging] = useState(null);
  const [offline, setOffline] = useState(false);
  const [onlineProducts, setOnlineProducts] = useState([]);
  const [offlineCatalog, setOfflineCatalog] = useState(null); // { products, savedAt, source }
  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState(null); // { ok, text }

  // ---- conexion: navigator.onLine + eventos del navegador
  useEffect(() => {
    const update = () => setOffline(isOffline());
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

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
      cacheMe(session.user.id, data.staff, data.sellers || []);
    } catch (err) {
      // Sin internet: se entra con el ultimo usuario verificado en este equipo.
      const cached = isNetworkError(err) ? readCachedMe(session.user.id) : null;
      if (cached) {
        setMe(cached.staff);
        setSellers(cached.sellers || []);
      } else {
        setMe(null);
        setAuthError(isNetworkError(err)
          ? 'Sin conexión y este usuario nunca entró a la caja en este equipo: hace falta internet para el primer ingreso.'
          : err.message);
      }
    }
    setChecking(false);
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  // ---- catalogo: el de la base cuando hay internet (y se guarda copia), la copia cuando no
  useEffect(() => {
    const update = () => {
      const list = dataStore.getProducts();
      setOnlineProducts(list.filter((p) => Number(p.stock) > 0));
      if (dataStore.productsSyncedAt) savePosCatalog(list);
    };
    update();
    const unsub = dataStore.subscribe(update);
    const unsubRt = dataStore.subscribeProductsRealtime();
    return () => { unsub(); unsubRt(); };
  }, []);

  useEffect(() => {
    if (offline) loadPosCatalog().then(setOfflineCatalog);
  }, [offline]);

  // Sin internet se descuenta lo vendido en la cola, para no ofrecer prendas que ya se fueron.
  const products = useMemo(() => {
    if (!offline) return onlineProducts;
    const list = offlineCatalog?.products || [];
    const reserved = reservedByVariant(queue);
    const reservedByProduct = new Map();
    reserved.forEach((qty, key) => {
      const id = key.split('::')[0];
      reservedByProduct.set(id, (reservedByProduct.get(id) || 0) + qty);
    });
    // (no se modifica el objeto: el control fino por talle/color lo hace la cola al guardar)
    return list.filter((p) => Number(p.stock) - (reservedByProduct.get(p.id) || 0) > 0);
  }, [offline, onlineProducts, offlineCatalog, queue]);

  // ---- cola de ventas sin conexion
  const loadQueue = useCallback(() => getQueue().then(setQueue).catch(() => {}), []);
  useEffect(() => {
    loadQueue();
    window.addEventListener(QUEUE_EVENT, loadQueue);
    return () => window.removeEventListener(QUEUE_EVENT, loadQueue);
  }, [loadQueue]);

  const refreshLists = useCallback(async () => {
    if (!me || isOffline()) return;
    try {
      const [p, t] = await Promise.all([api('/api/pos/sales?scope=pending'), api('/api/pos/sales?scope=today')]);
      setPending(p.sales || []);
      setToday(t.sales || []);
      setOffline(false); // wifi conectado pero sin internet: se recupera cuando el servidor vuelve a responder
    } catch (err) {
      if (isNetworkError(err)) setOffline(true);
    }
  }, [me]);

  const runSync = useCallback(async () => {
    if (!me || isOffline()) return;
    const current = await getQueue();
    if (!current.some((e) => !e.error)) return;
    setSyncing(true);
    try {
      const r = await syncOfflineQueue(api);
      if (r.synced > 0 || r.failed > 0) {
        const parts = [];
        if (r.synced > 0) parts.push(`${r.synced} venta${r.synced > 1 ? 's' : ''} sin conexión subida${r.synced > 1 ? 's' : ''}`);
        if (r.failed > 0) parts.push(`${r.failed} con error (revisalas en la lista)`);
        setSyncNotice({ ok: r.failed === 0 && r.warnings.length === 0, text: [parts.join(' · '), ...r.warnings].join(' — ') });
      }
      refreshLists();
    } finally {
      setSyncing(false);
    }
  }, [me, refreshLists]);

  useEffect(() => {
    if (!me) return;
    refreshLists();
    runSync();
    const id = setInterval(() => { refreshLists(); runSync(); }, 8000);
    return () => clearInterval(id);
  }, [me, refreshLists, runSync]);

  // Al volver internet: subir la cola enseguida.
  useEffect(() => {
    if (!offline && me) runSync();
  }, [offline, me, runSync]);

  // Listas: lo que vino del servidor + lo que esta en la cola de este equipo.
  const queueSales = useMemo(
    () => queue.map((e) => ({ ...e.sale, offline: true, syncError: e.error, offlineChargeOnly: !e.request })),
    [queue]
  );
  const queuedIds = useMemo(() => new Set(queue.map((e) => e.offlineId)), [queue]);
  const pendingAll = useMemo(
    () => [...queueSales.filter((s) => s.status === 'pendiente_cobro'), ...pending.filter((s) => !queuedIds.has(s.id))],
    [queueSales, pending, queuedIds]
  );
  const todayAll = useMemo(
    () => [...queueSales, ...today.filter((s) => !queuedIds.has(s.id))],
    [queueSales, today, queuedIds]
  );
  const queueErrors = queue.filter((e) => e.error);

  const handleCancel = async (sale) => {
    if (sale.offline) {
      if (!window.confirm(`¿Cancelar la venta ${sale.id}? Todavía no se subió: se borra de este equipo.`)) return;
      await removeFromQueue(sale.id);
      return;
    }
    if (!window.confirm(`¿Cancelar la venta ${sale.id}? Las prendas vuelven al stock.`)) return;
    try {
      await api('/api/pos/sales/cancel', { method: 'POST', body: JSON.stringify({ orderId: sale.id }) });
      refreshLists();
    } catch (err) {
      window.alert(isNetworkError(err) ? 'Sin conexión: esta venta ya está subida y se puede cancelar cuando vuelva internet.' : err.message);
    }
  };

  const retryQueueEntry = async (offlineId) => {
    await clearQueueFlags(offlineId);
    runSync();
  };

  const discardQueueEntry = async (entry) => {
    const msg = entry.request
      ? `¿Descartar la venta ${entry.offlineId}? No va a quedar registrada en el sistema (ni descuenta stock). Hacelo solo si la vas a cargar a mano.`
      : `¿Descartar el cobro sin conexión de ${entry.offlineId}? La venta vuelve a quedar "por cobrar".`;
    if (!window.confirm(msg)) return;
    await removeFromQueue(entry.offlineId);
  };

  const logout = async () => {
    if (queue.length > 0 && !window.confirm(`Hay ${queue.length} venta(s) sin subir en este equipo. Quedan guardadas, pero para subirlas hay que volver a entrar con internet. ¿Salir igual?`)) return;
    await supabase.auth.signOut();
    clearCachedMe();
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
    { id: 'pending', label: `Por cobrar (${pendingAll.length})`, icon: Wallet },
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

        {offline && (
          <div role="status" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 14px', borderRadius: '12px', marginBottom: '12px', backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
            <WifiOff size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>
              <strong>Sin conexión.</strong> Podés seguir vendiendo: las ventas se guardan en este equipo y se suben solas cuando vuelva internet.
              {offlineCatalog?.savedAt
                ? ` Precios y stock de la copia del ${new Date(offlineCatalog.savedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${offlineCatalog.source === 'respaldo' ? ' (respaldo del panel)' : ''}.`
                : ' No hay copia del catálogo guardada en este equipo: entrá a la caja una vez con internet para que se guarde.'}
            </div>
          </div>
        )}

        {queue.length > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: '12px', marginBottom: '12px', backgroundColor: 'var(--bg-card)', border: `1px solid ${queueErrors.length ? '#DC2626' : 'var(--border-color)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 800 }}>
                <CloudUpload size={17} /> {queue.length} venta{queue.length > 1 ? 's' : ''} sin subir en este equipo
                {syncing && <Loader2 size={15} className="animate-spin" />}
              </span>
              {!offline && (
                <button type="button" onClick={runSync} disabled={syncing} className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <RefreshCw size={13} /> Subir ahora
                </button>
              )}
            </div>
            {queueErrors.map((e) => (
              <div key={e.offlineId} style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#991B1B', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                  <AlertTriangle size={14} /> {e.offlineId} · {money(e.sale?.total_amount)}: {e.error}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button type="button" onClick={() => retryQueueEntry(e.offlineId)} disabled={offline} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>Reintentar</button>
                  <button type="button" onClick={() => discardQueueEntry(e)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#B91C1C' }}>Descartar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {syncNotice && (
          <div role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 12px', borderRadius: '10px', marginBottom: '12px', fontSize: '0.84rem', fontWeight: 600, backgroundColor: syncNotice.ok ? '#ECFDF5' : '#FEF3C7', color: syncNotice.ok ? '#047857' : '#92400E' }}>
            <span>{syncNotice.text}</span>
            <button type="button" onClick={() => setSyncNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} aria-label="Cerrar"><X size={15} /></button>
          </div>
        )}

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
            offline={offline}
            onCreated={(sale, chargeNow) => {
              refreshLists();
              if (chargeNow) setCharging(sale);
            }}
          />
        )}
        {tab === 'pending' && <SalesList sales={pendingAll} me={me} onCharge={setCharging} onCancel={handleCancel} emptyText="No hay ventas pendientes de cobro." />}
        {tab === 'today' && <SalesList sales={todayAll} me={me} onCharge={setCharging} onCancel={handleCancel} emptyText="Todavía no hay ventas hoy." />}
        {tab === 'report' && <Report me={me} />}

        {charging && (
          <ChargePanel
            sale={charging}
            me={me}
            offline={offline}
            onDone={refreshLists}
            onClose={() => setCharging(null)}
          />
        )}
      </div>
    </div>
  );
}
