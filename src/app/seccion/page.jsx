'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScanLine, Search, Trash2, Minus, Plus, Printer, Loader2, X, LogOut, CheckCircle2, AlertTriangle, Delete } from 'lucide-react';
import { resolveBarcodeMatches, getProductVariants, parseVariantKey, formatVariantLabel, CUALQUIER_TALLE_KEY } from '@/lib/barcode';
import { getUnitPriceForType, hasDistinctRetailPrice } from '@/lib/productPricing';
import { getVariantStock } from '@/lib/catalogData';
import { printThermalSaleTicket } from '@/lib/printUtils';

// Caja de sección (ej. "Caja 1 · Sección Niños"). Pantalla fija en la PC de
// la sección, sin iniciar sesión: se vincula una sola vez con el link que
// genera el admin (Punto de Venta → Cajeras & Turnos → Cajas de sección).
//   1. La vendedora teclea su código de 4 números.
//   2. Escanea las prendas y toca "Listo": sale el ticket a su nombre.
//   3. El cliente baja a pagar a la Caja General, que lo cobra (solo o junto
//      con otras ventas) y recién ahí suma a la comisión de la vendedora.

const TOKEN_KEY = 'dv_section_token';
const IDLE_MS = 2 * 60 * 1000; // sin actividad y con el carrito vacío, vuelve al teclado
const money = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const C = {
  bg: '#F6F3F7',
  card: '#FFFFFF',
  text: '#1F1724',
  muted: '#6B6170',
  border: '#E4DCE8',
  accent: '#B0306A',
  accentSoft: '#FBE7F0',
  ok: '#15803D',
  okSoft: '#DCFCE7',
  err: '#B91C1C',
  errSoft: '#FEE2E2',
  blue: '#1E40AF',
  blueSoft: '#DBEAFE',
  amber: '#92400E',
  amberSoft: '#FEF3C7'
};

const btn = (bg, color, extra = {}) => ({
  background: bg,
  color,
  border: 'none',
  borderRadius: '14px',
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  ...extra
});

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

async function sectionApi(token, options = {}) {
  const res = await fetch('/api/pos/section', {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-section-token': token, ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Ocurrió un error.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export default function SeccionPage() {
  const [token, setToken] = useState('');
  const [section, setSection] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [unlinked, setUnlinked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Vincular la PC con el link del admin (#vincular=TOKEN); el token no viaja al servidor en la URL.
  useEffect(() => {
    let t = readToken();
    const match = typeof window !== 'undefined' && window.location.hash.match(/vincular=([A-Za-z0-9_-]{20,})/);
    if (match) {
      t = match[1];
      try { localStorage.setItem(TOKEN_KEY, t); } catch {}
      window.history.replaceState(null, '', window.location.pathname);
    }
    setToken(t);
    if (!t) {
      setUnlinked(true);
      setLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    try {
      const data = await sectionApi(token);
      setSection(data.section);
      setProducts(data.products || []);
      setLoadError('');
      setUnlinked(false);
    } catch (err) {
      if (err.status === 401) setUnlinked(true);
      else setLoadError(err.message || 'No se pudo cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadCatalog();
    const id = setInterval(loadCatalog, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadCatalog]);

  if (loading) {
    return <Screen><div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: C.muted, fontWeight: 700 }}><Loader2 className="animate-spin" /> Cargando la caja...</div></Screen>;
  }

  if (unlinked) {
    return (
      <Screen>
        <div style={{ maxWidth: '460px', textAlign: 'center', background: C.card, borderRadius: '20px', padding: '32px', border: `1px solid ${C.border}` }}>
          <AlertTriangle size={40} color={C.amber} style={{ margin: '0 auto 12px' }} />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 8px', color: C.text }}>Esta PC no está vinculada</h1>
          <p style={{ color: C.muted, lineHeight: 1.5, margin: 0 }}>
            Pedile al administrador el <strong>link de la caja de sección</strong> (Panel → Punto de Venta → Cajeras &amp; Turnos)
            y abrilo en esta PC. Se hace una sola vez.
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <SectionTerminal
      token={token}
      section={section}
      products={products}
      loadError={loadError}
      onSaleDone={loadCatalog}
    />
  );
}

function Screen({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      {children}
    </div>
  );
}

function SectionTerminal({ token, section, products, loadError, onSaleDone }) {
  const [code, setCode] = useState('');
  const [seller, setSeller] = useState(null); // { id, name }
  const [codeError, setCodeError] = useState('');
  const [checking, setChecking] = useState(false);

  const [cart, setCart] = useState([]);
  const [scanValue, setScanValue] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState(null); // { type: 'ok' | 'err', text }
  const [pricePick, setPricePick] = useState(null); // { product, size, color }
  const [variantPick, setVariantPick] = useState(null); // product
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // venta recién emitida

  const scanRef = useRef(null);
  const lastActivity = useRef(Date.now());
  const touch = () => { lastActivity.current = Date.now(); };

  const resetToKeypad = useCallback(() => {
    setSeller(null);
    setCode('');
    setCart([]);
    setSearch('');
    setScanValue('');
    setNotice(null);
    setPricePick(null);
    setVariantPick(null);
    setCodeError('');
  }, []);

  const focusScan = () => setTimeout(() => scanRef.current?.focus(), 30);

  // Sin actividad y sin prendas cargadas: vuelve al teclado para la próxima vendedora.
  useEffect(() => {
    if (!seller) return undefined;
    const id = setInterval(() => {
      if (cart.length === 0 && Date.now() - lastActivity.current > IDLE_MS) resetToKeypad();
    }, 10000);
    return () => clearInterval(id);
  }, [seller, cart.length, resetToKeypad]);

  // ---------------------------------------------------------- Código
  const submitCode = useCallback(async (value) => {
    if (checking) return;
    setChecking(true);
    setCodeError('');
    try {
      const data = await sectionApi(token, { method: 'POST', body: JSON.stringify({ action: 'identify', code: value }) });
      setSeller(data.seller);
      touch();
      focusScan();
    } catch (err) {
      setCodeError(err.message);
      setCode('');
    } finally {
      setChecking(false);
    }
  }, [checking, token]);

  const pressDigit = useCallback((d) => {
    setCodeError('');
    setCode((prev) => (prev.length >= 4 ? prev : prev + d));
  }, []);

  // Al completar los 4 números se verifica el código.
  useEffect(() => {
    if (!seller && code.length === 4) submitCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, seller]);

  // Teclado físico en la pantalla del código.
  useEffect(() => {
    if (seller || done) return undefined;
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) pressDigit(e.key);
      else if (e.key === 'Backspace') setCode((p) => p.slice(0, -1));
      else if (e.key === 'Escape') setCode('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seller, done, pressDigit]);

  // ---------------------------------------------------------- Carrito
  const showNotice = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice((n) => (n && n.text === text ? null : n)), 4000);
  };

  const addItem = (product, size, color, priceType) => {
    touch();
    const stock = getVariantStock(product, size, color);
    const key = `${product.id}::${size || ''}::${color || ''}::${priceType}`;
    const inCart = cart.filter((it) => it.product.id === product.id && it.size === size && it.color === color).reduce((s, it) => s + it.quantity, 0);
    if (inCart + 1 > stock) {
      showNotice('err', `"${product.name}" ${formatVariantLabel(size, color)}: no hay más stock (quedan ${stock}).`);
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((it) => it.key === key);
      if (idx >= 0) return prev.map((it, i) => (i === idx ? { ...it, quantity: it.quantity + 1 } : it));
      return [...prev, { key, product, size, color, priceType, quantity: 1, unitPrice: getUnitPriceForType(product, size, priceType) }];
    });
    showNotice('ok', `✓ ${product.name} · ${formatVariantLabel(size, color)}`);
    focusScan();
  };

  // Precio por mayor o por menor: solo se pregunta si el producto tiene minorista distinto.
  const chooseVariant = (product, size, color) => {
    if (hasDistinctRetailPrice(product, size)) setPricePick({ product, size, color });
    else addItem(product, size, color, 'mayor');
  };

  const openProduct = (product) => {
    const variants = getProductVariants(product);
    if (variants.length === 1) chooseVariant(product, variants[0].size || null, variants[0].color || null);
    else setVariantPick(product);
  };

  const handleScan = (raw) => {
    touch();
    const value = String(raw || '').trim();
    if (!value) return;
    const matches = resolveBarcodeMatches(products, value);
    if (matches.length === 0) {
      showNotice('err', `Código no reconocido: ${value}`);
      return;
    }
    const match = matches[0];
    if (match.variantKey === CUALQUIER_TALLE_KEY || new Set(matches.map((m) => m.product.id)).size > 1) {
      setVariantPick(match.product);
      return;
    }
    const { size, color } = parseVariantKey(match.variantKey);
    chooseVariant(match.product, size, color);
  };

  // Atajos en la elección de precio: 1 = mayor, 2 = menor.
  useEffect(() => {
    if (!pricePick) return undefined;
    const onKey = (e) => {
      if (e.key === '1') { e.preventDefault(); addItem(pricePick.product, pricePick.size, pricePick.color, 'mayor'); setPricePick(null); }
      if (e.key === '2') { e.preventDefault(); addItem(pricePick.product, pricePick.size, pricePick.color, 'menor'); setPricePick(null); }
      if (e.key === 'Escape') { setPricePick(null); focusScan(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const searchResults = useMemo(() => {
    const q = norm(search);
    if (q.length < 2) return [];
    return products.filter((p) => norm(p.name).includes(q) || norm(p.code).includes(q)).slice(0, 8);
  }, [search, products]);

  const total = cart.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const units = cart.reduce((s, it) => s + it.quantity, 0);

  const changeQty = (key, delta) => {
    touch();
    setCart((prev) => prev.flatMap((it) => {
      if (it.key !== key) return [it];
      const q = it.quantity + delta;
      if (q <= 0) return [];
      if (delta > 0) {
        const stock = getVariantStock(it.product, it.size, it.color);
        const inCart = prev.filter((x) => x.product.id === it.product.id && x.size === it.size && x.color === it.color).reduce((s, x) => s + x.quantity, 0);
        if (inCart + 1 > stock) {
          showNotice('err', `No hay más stock de "${it.product.name}" (quedan ${stock}).`);
          return [it];
        }
      }
      return [{ ...it, quantity: q }];
    }));
    focusScan();
  };

  // ---------------------------------------------------------- Emitir
  const finishSale = async () => {
    if (cart.length === 0 || saving) return;
    setSaving(true);
    touch();
    try {
      const data = await sectionApi(token, {
        method: 'POST',
        body: JSON.stringify({
          action: 'sale',
          code,
          items: cart.map((it) => ({ id: it.product.id, size: it.size, color: it.color, quantity: it.quantity, priceType: it.priceType }))
        })
      });
      printThermalSaleTicket({
        order: data.sale,
        cajaName: data.sectionLabel,
        cashier: '',
        paymentMethod: 'A abonar en Caja',
        isPreventa: true,
        sectionName: data.sectionLabel
      });
      setDone(data.sale);
      resetToKeypad();
      onSaleDone?.();
      setTimeout(() => setDone(null), 6000);
    } catch (err) {
      showNotice('err', err.message);
      if (err.status === 403 || err.status === 429) resetToKeypad();
    } finally {
      setSaving(false);
    }
  };

  const title = section?.label || 'Caja de Sección';

  // ---------------------------------------------------------- Pantallas
  if (done) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', background: C.card, borderRadius: '24px', padding: '40px 32px', border: `1px solid ${C.border}`, maxWidth: '480px', width: '100%' }}>
          <CheckCircle2 size={64} color={C.ok} style={{ margin: '0 auto 14px' }} />
          <div style={{ fontSize: '1.6rem', fontWeight: 900 }}>¡Ticket listo!</div>
          <div style={{ fontSize: '1.1rem', color: C.muted, margin: '8px 0 18px' }}>
            #{done.id} · {done.seller_name} · <strong style={{ color: C.text }}>{money(done.total_amount)}</strong>
          </div>
          <div style={{ fontWeight: 700, color: C.muted }}>El cliente baja con el ticket a pagar en la Caja General.</div>
          <button type="button" onClick={() => setDone(null)} style={btn(C.accent, '#fff', { marginTop: '22px', padding: '14px 28px', fontSize: '1.05rem' })}>
            Nueva venta
          </button>
        </div>
      </Screen>
    );
  }

  if (!seller) {
    return (
      <Screen>
        <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: C.accent, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Dulce Valentín</div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 900, margin: '4px 0 22px', color: C.text }}>{title}</h1>
          {loadError && <div style={{ background: C.errSoft, color: C.err, padding: '10px', borderRadius: '12px', fontWeight: 700, marginBottom: '14px' }}>{loadError}</div>}
          <div style={{ background: C.card, borderRadius: '24px', padding: '24px', border: `1px solid ${C.border}`, boxShadow: '0 10px 30px rgba(60,20,50,0.08)' }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '14px' }}>Ingresá tu código</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '18px' }} aria-label="Código ingresado">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: '20px', height: '20px', borderRadius: '50%', background: i < code.length ? C.accent : C.border, transition: 'background 0.15s' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} type="button" onClick={() => pressDigit(d)} disabled={checking} style={btn(C.bg, C.text, { height: '68px', fontSize: '1.7rem' })}>{d}</button>
              ))}
              <button type="button" onClick={() => setCode('')} disabled={checking} style={btn(C.bg, C.muted, { height: '68px', fontSize: '0.95rem' })}>Borrar</button>
              <button type="button" onClick={() => pressDigit('0')} disabled={checking} style={btn(C.bg, C.text, { height: '68px', fontSize: '1.7rem' })}>0</button>
              <button type="button" onClick={() => setCode((p) => p.slice(0, -1))} disabled={checking} aria-label="Borrar un número" style={btn(C.bg, C.muted, { height: '68px' })}><Delete size={24} /></button>
            </div>
            <div style={{ minHeight: '24px', marginTop: '14px', fontWeight: 700, color: codeError ? C.err : C.muted }}>
              {checking ? 'Verificando...' : codeError}
            </div>
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }} onMouseDown={touch} onKeyDown={touch}>
      {/* Encabezado */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 20px', background: C.card, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: C.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>{title}</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900 }}>Vende: {seller.name}</div>
        </div>
        <button type="button" onClick={resetToKeypad} style={btn(C.bg, C.text, { padding: '10px 16px', border: `1px solid ${C.border}` })}>
          <LogOut size={18} /> {cart.length > 0 ? 'Cancelar y salir' : 'Cambiar vendedora'}
        </button>
      </header>

      <main style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: '16px', padding: '16px', maxWidth: '1200px', margin: '0 auto' }} className="seccion-grid">
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          {/* Escáner */}
          <div style={{ background: C.card, borderRadius: '18px', padding: '16px', border: `1px solid ${C.border}` }}>
            <label htmlFor="scan" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, marginBottom: '8px' }}>
              <ScanLine size={20} color={C.accent} /> Escaneá la etiqueta
            </label>
            <input
              id="scan"
              ref={scanRef}
              autoFocus
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleScan(scanValue);
                  setScanValue('');
                }
              }}
              placeholder="Pasá la pistola por el código de barras"
              autoComplete="off"
              style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', fontSize: '1.1rem', borderRadius: '12px', border: `2px solid ${C.accent}`, outline: 'none' }}
            />
            <div style={{ position: 'relative', marginTop: '10px' }}>
              <Search size={18} color={C.muted} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); touch(); }}
                placeholder="O buscá por nombre o número de artículo (ej. 0382)"
                autoComplete="off"
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 38px', fontSize: '0.95rem', borderRadius: '12px', border: `1px solid ${C.border}`, outline: 'none' }}
              />
            </div>
            {searchResults.length > 0 && (
              <div style={{ marginTop: '8px', border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSearch(''); openProduct(p); }}
                    style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: '10px', padding: '11px 14px', background: C.card, border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'left', fontSize: '0.95rem' }}
                  >
                    <span style={{ fontWeight: 700 }}>{p.code ? `${p.code} · ` : ''}{p.name}</span>
                    <span style={{ color: C.muted, fontWeight: 700 }}>{money(getUnitPriceForType(p, null, 'mayor'))}</span>
                  </button>
                ))}
              </div>
            )}
            {notice && (
              <div role="status" style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '10px', fontWeight: 800, background: notice.type === 'ok' ? C.okSoft : C.errSoft, color: notice.type === 'ok' ? C.ok : C.err }}>
                {notice.text}
              </div>
            )}
          </div>

          {/* Prendas */}
          <div style={{ background: C.card, borderRadius: '18px', padding: '8px 16px', border: `1px solid ${C.border}`, minHeight: '200px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.muted, padding: '48px 10px', fontWeight: 700 }}>
                <ScanLine size={40} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
                Escaneá la primera prenda para empezar.
              </div>
            ) : cart.map((it) => (
              <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.product.name}</div>
                  <div style={{ fontSize: '0.85rem', color: C.muted, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {it.product.code && <span>Art. {it.product.code}</span>}
                    <span>{formatVariantLabel(it.size, it.color)}</span>
                    <span style={{ padding: '1px 7px', borderRadius: '6px', fontWeight: 800, fontSize: '0.75rem', background: it.priceType === 'menor' ? C.amberSoft : C.blueSoft, color: it.priceType === 'menor' ? C.amber : C.blue }}>
                      {it.priceType === 'menor' ? 'X MENOR' : 'X MAYOR'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button type="button" onClick={() => changeQty(it.key, -1)} aria-label="Restar una" style={btn(C.bg, C.text, { width: '38px', height: '38px', borderRadius: '10px' })}>
                    {it.quantity === 1 ? <Trash2 size={17} color={C.err} /> : <Minus size={17} />}
                  </button>
                  <span style={{ width: '28px', textAlign: 'center', fontWeight: 900, fontSize: '1.1rem' }}>{it.quantity}</span>
                  <button type="button" onClick={() => changeQty(it.key, 1)} aria-label="Sumar una" style={btn(C.bg, C.text, { width: '38px', height: '38px', borderRadius: '10px' })}>
                    <Plus size={17} />
                  </button>
                </div>
                <div style={{ width: '96px', textAlign: 'right', fontWeight: 900 }}>{money(it.unitPrice * it.quantity)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Total y emitir */}
        <aside style={{ background: C.card, borderRadius: '18px', padding: '18px', border: `1px solid ${C.border}`, height: 'fit-content', position: 'sticky', top: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted, fontWeight: 700 }}>
            <span>Prendas</span><span>{units}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `2px solid ${C.border}`, paddingTop: '12px' }}>
            <span style={{ fontWeight: 900, fontSize: '1.1rem' }}>TOTAL</span>
            <span style={{ fontWeight: 900, fontSize: '2rem', color: C.accent }}>{money(total)}</span>
          </div>
          <button
            type="button"
            onClick={finishSale}
            disabled={cart.length === 0 || saving}
            style={btn(cart.length === 0 ? C.border : C.ok, '#fff', { padding: '18px', fontSize: '1.15rem', opacity: saving ? 0.7 : 1, cursor: cart.length === 0 ? 'not-allowed' : 'pointer' })}
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20} />}
            {saving ? 'Guardando...' : 'Listo · Imprimir ticket'}
          </button>
          <div style={{ fontSize: '0.85rem', color: C.muted, textAlign: 'center', lineHeight: 1.4 }}>
            La venta queda a nombre de <strong>{seller.name}</strong>. El cliente paga abajo, en la Caja General.
          </div>
        </aside>
      </main>

      {/* Elegir talle / color */}
      {variantPick && (
        <Modal title={variantPick.name} onClose={() => { setVariantPick(null); focusScan(); }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
            {getProductVariants(variantPick).map((v) => (
              <button
                key={v.key}
                type="button"
                disabled={v.stock <= 0}
                onClick={() => { const p = variantPick; setVariantPick(null); chooseVariant(p, v.size || null, v.color || null); }}
                style={btn(v.stock > 0 ? C.bg : '#F1EEF2', v.stock > 0 ? C.text : C.muted, { padding: '14px 10px', flexDirection: 'column', gap: '2px', cursor: v.stock > 0 ? 'pointer' : 'not-allowed', border: `1px solid ${C.border}` })}
              >
                <span>{v.label}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.muted }}>{v.stock > 0 ? `Stock ${v.stock}` : 'Sin stock'}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Precio por mayor o por menor */}
      {pricePick && (
        <Modal title="¿Cómo se vende?" onClose={() => { setPricePick(null); focusScan(); }}>
          <div style={{ color: C.muted, fontWeight: 700, marginBottom: '14px' }}>
            {pricePick.product.name} · {formatVariantLabel(pricePick.size, pricePick.color)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button type="button" onClick={() => { addItem(pricePick.product, pricePick.size, pricePick.color, 'mayor'); setPricePick(null); }} style={btn(C.blueSoft, C.blue, { padding: '20px 10px', flexDirection: 'column', fontSize: '1.05rem' })}>
              <span>Por mayor</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 900 }}>{money(getUnitPriceForType(pricePick.product, pricePick.size, 'mayor'))}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>tecla 1</span>
            </button>
            <button type="button" onClick={() => { addItem(pricePick.product, pricePick.size, pricePick.color, 'menor'); setPricePick(null); }} style={btn(C.amberSoft, C.amber, { padding: '20px 10px', flexDirection: 'column', fontSize: '1.05rem' })}>
              <span>Por menor</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 900 }}>{money(getUnitPriceForType(pricePick.product, pricePick.size, 'menor'))}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>tecla 2</span>
            </button>
          </div>
        </Modal>
      )}

      <style>{`
        @media (max-width: 760px) { .seccion-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,20,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
        <button type="button" onClick={onClose} aria-label="Cerrar" style={btn('transparent', C.muted, { position: 'absolute', top: '12px', right: '12px', padding: '6px' })}>
          <X size={22} />
        </button>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '0 36px 14px 0', color: C.text }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
