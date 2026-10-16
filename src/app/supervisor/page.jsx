'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  TrendingUp,
  DollarSign,
  Landmark,
  Users,
  Download,
  Send,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trophy,
  Wallet,
  Receipt,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Copy,
  Check,
  RefreshCw,
  ShoppingBag,
  Percent,
  Banknote,
  Clock,
  Sparkles,
  ExternalLink,
  PiggyBank,
  CheckCheck
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { adminFetch } from '@/lib/adminFetch';
import AliasManager from '@/components/AliasManager';
import { aliasRemaining as aliasLeft, aliasRules } from '@/lib/aliasPick';
import {
  downloadSupervisorExcel,
  supervisorWhatsAppText,
  OWNER_WHATSAPP
} from '@/lib/ventasExport';

const SUPERVISOR_EMAIL = 'belenbarbieri93@gmail.com';

// Tablas que, al cambiar, refrescan el panel en vivo (Supabase Realtime).
const LIVE_TABLES = ['seller_sales', 'seller_advances', 'seller_payouts', 'cash_counts', 'seller_commission_rates', 'payment_aliases'];
const POLL_MS = 30000; // respaldo por si se corta el canal en vivo

// adminFetch devuelve el Response crudo: hay que leer el JSON y chequear el status.
async function api(path, options = {}) {
  const res = await adminFetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Ocurrió un error.');
    err.status = res.status;
    throw err;
  }
  return data;
}
const PERIODS = { day: 'Día', week: 'Semana', month: 'Mes' };
const todayAR = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10);
const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
const hour = (iso) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

const shiftDate = (d, period, dir) => {
  const t = new Date(`${d}T12:00:00`);
  if (period === 'month') t.setMonth(t.getMonth() + dir);
  else t.setDate(t.getDate() + (period === 'week' ? 7 : 1) * dir);
  return t.toISOString().slice(0, 10);
};

// ---------------------------------------------------------------- Componente de Login de Autoridad
function SupervisorLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('Belenbarbieri93@gmail.com');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanEmail = email.trim().toLowerCase();

    if (cleanEmail !== SUPERVISOR_EMAIL) {
      setErrorMsg(`Acceso denegado. Este panel es exclusivo para Micaela Barbieri (${SUPERVISOR_EMAIL}).`);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) {
        throw new Error(error.message === 'Invalid login credentials' ? 'Contraseña o email incorrectos.' : error.message);
      }

      if (data?.user?.email?.toLowerCase() !== SUPERVISOR_EMAIL) {
        await supabase.auth.signOut();
        throw new Error(`Acceso denegado. Este panel es exclusivo para la supervisora.`);
      }

      onLoginSuccess();
    } catch (err) {
      setErrorMsg(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-page)',
      backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(236, 111, 166, 0.12) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(95, 193, 232, 0.12) 0%, transparent 40%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      color: 'var(--text-main)'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '24px',
        padding: '38px 32px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 20px 50px -10px rgba(168, 23, 90, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04)',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Cabecera del Portal */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, rgba(236, 111, 166, 0.2) 0%, rgba(168, 23, 90, 0.2) 100%)',
            color: 'var(--dv-accent-fill)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            border: '1px solid rgba(236, 111, 166, 0.35)',
            boxShadow: '0 8px 24px rgba(236, 111, 166, 0.25)'
          }}>
            <ShieldCheck size={38} />
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 900,
            margin: '0 0 6px 0',
            letterSpacing: '-0.02em',
            color: 'var(--text-main)',
            fontFamily: 'var(--font-heading)'
          }}>
            Panel de Supervisión
          </h1>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Dulce Valentín · Acceso exclusivo para <strong style={{ color: 'var(--dv-accent-text)' }}>Micaela Barbieri</strong>
          </p>
        </div>

        {errorMsg && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#DC2626',
            padding: '12px 14px',
            borderRadius: '12px',
            fontSize: '0.86rem',
            fontWeight: 600,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Email de Supervisora
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  color: 'var(--text-main)',
                  fontSize: '0.94rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                type={showPass ? 'text' : 'password'}
                required
                placeholder="Ingresá tu clave"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 42px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  color: 'var(--text-main)',
                  fontSize: '0.94rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-light)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex'
                }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '10px',
              backgroundColor: 'var(--dv-accent-fill)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '0.96rem',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 8px 20px rgba(168, 23, 90, 0.3)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
            <span>Ingresar al Panel de Supervisión</span>
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-light)' }}>
          <span>🔒 Panel encriptado y seguro · Rosario, Argentina</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Tarjeta Ejecutiva Reutilizable (Senior Component)
function ExecutiveCard({
  title,
  amount,
  secondaryText,
  badgeText,
  badgeType = 'brand', // 'brand' | 'emerald' | 'amber' | 'teal' | 'blue'
  icon: Icon,
  gradientLine = 'linear-gradient(90deg, #A8175A, #EC6FA6)',
  highlight = false,
  tooltip = ''
}) {
  const badgeStyles = {
    brand: { bg: 'rgba(236, 111, 166, 0.15)', text: 'var(--dv-accent-text)', border: 'rgba(236, 111, 166, 0.3)' },
    emerald: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.3)' },
    amber: { bg: 'rgba(245, 158, 11, 0.12)', text: '#D97706', border: 'rgba(245, 158, 11, 0.3)' },
    teal: { bg: 'rgba(13, 148, 136, 0.12)', text: '#0D9488', border: 'rgba(13, 148, 136, 0.3)' },
    blue: { bg: 'rgba(37, 99, 235, 0.12)', text: '#2563EB', border: 'rgba(37, 99, 235, 0.3)' }
  }[badgeType];

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '20px',
        padding: '22px 20px',
        border: highlight ? '1.5px solid var(--dv-accent-fill)' : '1px solid var(--border-color)',
        boxShadow: highlight
          ? '0 10px 30px -5px rgba(168, 23, 90, 0.15), 0 2px 6px rgba(0, 0, 0, 0.04)'
          : '0 4px 20px rgba(0, 0, 0, 0.03)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1)'
      }}
      title={tooltip}
    >
      {/* Línea de Acento Superior Luminosa */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: gradientLine
      }} />

      {/* Cabecera de la Tarjeta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{
          fontSize: '0.78rem',
          fontWeight: 800,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {title}
        </span>

        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '12px',
          backgroundColor: badgeStyles.bg,
          color: badgeStyles.text,
          border: `1px solid ${badgeStyles.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Icon size={20} />
        </div>
      </div>

      {/* Monto Principal */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{
          fontSize: 'clamp(1.55rem, 2.4vw, 1.95rem)',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          color: 'var(--text-main)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1
        }}>
          {amount}
        </div>
      </div>

      {/* Pie con Micro Badge y Subtítulo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {secondaryText}
        </span>
        {badgeText && (
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: badgeStyles.bg,
            color: badgeStyles.text,
            border: `1px solid ${badgeStyles.border}`,
            whiteSpace: 'nowrap'
          }}>
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Dashboard Principal
export default function SupervisorPage() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(todayAR());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics' | 'transfers' | 'sellers' | 'history'
  const [privacyMode, setPrivacyMode] = useState(false); // Ocultar números si alguien mira
  const [exportingExcel, setExportingExcel] = useState(false);
  const [copiedAlias, setCopiedAlias] = useState('');
  const [showAliasManager, setShowAliasManager] = useState(false); // false | 'edit' | 'new'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState('ALL');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [live, setLive] = useState(false); // canal Realtime conectado

  // Formato de moneda con soporte de modo privacidad
  const money = useCallback((n) => {
    if (privacyMode) return '$ ••••••';
    const num = Number(n || 0);
    return `${num < 0 ? '−' : ''}$${Math.abs(num).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
  }, [privacyMode]);

  // silent: refresco en vivo, sin spinner ni borrar el error de la pantalla.
  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError('');
    }
    try {
      const res = await api(`/api/ventas?period=${period}&date=${date}&supervisor=1`);
      setData(res);
      setAuthed(true);
      setLastUpdate(new Date());
      if (silent) setLoadError('');
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setAuthed(false);
        setLoadError('Sesión vencida o no autorizada.');
      } else {
        setLoadError(err.message || 'No se pudieron cargar los datos gerenciales.');
      }
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, [period, date]);

  // Verificar sesión activa
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userEmail = session?.user?.email?.toLowerCase();
      if (userEmail === SUPERVISOR_EMAIL) {
        setAuthed(true);
        loadData();
      } else {
        setAuthed(false);
        setChecking(false);
      }
    });
  }, [loadData]);

  // Tiempo real: cada venta, vale, pago o arqueo que se carga en /ventas
  // dispara un refresco (agrupado para no pedir 10 veces seguidas). Además,
  // respaldo cada 30 s y al volver a la pestaña.
  const loadRef = useRef(loadData);
  useEffect(() => { loadRef.current = loadData; }, [loadData]);

  useEffect(() => {
    if (!authed || !supabase) return undefined;
    let timer = null;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => loadRef.current(true), 700);
    };

    let channel = supabase.channel('supervisor-live');
    LIVE_TABLES.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    });
    channel.subscribe((status) => setLive(status === 'SUBSCRIBED'));

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') loadRef.current(true);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadRef.current(true);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
      setLive(false);
    };
  }, [authed]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthed(false);
    setData(null);
  };

  // Totales calculados del período
  const totals = useMemo(() => {
    if (!data?.sellers) {
      return { total: 0, cash: 0, transfer: 0, commission: 0, advances: 0, paid: 0, balance: 0, salesCount: 0 };
    }
    return data.sellers.reduce((t, s) => ({
      total: t.total + s.total,
      cash: t.cash + s.cash,
      transfer: t.transfer + s.transfer,
      commission: t.commission + s.commission,
      advances: t.advances + s.advances,
      paid: t.paid + s.paid,
      balance: t.balance + s.balance,
      salesCount: t.salesCount + s.salesCount
    }), { total: 0, cash: 0, transfer: 0, commission: 0, advances: 0, paid: 0, balance: 0, salesCount: 0 });
  }, [data?.sellers]);

  // Margen Neto del local: Lo que vendió el local menos lo devengado en comisiones a vendedoras
  const netMargin = useMemo(() => {
    return totals.total - totals.commission;
  }, [totals]);

  const marginRetentionPct = useMemo(() => {
    if (totals.total <= 0) return 100;
    return Math.round((netMargin / totals.total) * 1000) / 10;
  }, [netMargin, totals.total]);

  // Lista consolidada de transferencias del período
  const transfersList = useMemo(() => {
    return data?.periodTransfers || data?.dayTransfers || [];
  }, [data]);

  const totalTransfersPeriod = useMemo(() => {
    return transfersList.reduce((acc, t) => acc + (t.amount || 0), 0);
  }, [transfersList]);


  // Filtrado de transferencias
  const filteredTransfers = useMemo(() => {
    return transfersList.filter((t) => {
      const matchSeller = selectedSellerFilter === 'ALL' || t.sellerId === selectedSellerFilter;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchSeller;
      const matchText = (t.sellerName || '').toLowerCase().includes(q)
        || (t.note || '').toLowerCase().includes(q)
        || String(t.amount || '').includes(q)
        || (t.date || '').includes(q);
      return matchSeller && matchText;
    });
  }, [transfersList, selectedSellerFilter, searchQuery]);

  // Exportar Excel Gerencial
  const handleExportExcel = async () => {
    if (!data) return;
    setExportingExcel(true);
    try {
      await downloadSupervisorExcel({
        data,
        period,
        date,
        supervisorData: data.supervisorData
      });
    } catch (err) {
      window.alert(err.message || 'Error al exportar Excel gerencial.');
    } finally {
      setExportingExcel(false);
    }
  };

  // Enviar WhatsApp Ejecutivo a Mica
  const handleSendWhatsApp = () => {
    if (!data) return;
    const text = supervisorWhatsAppText({ data, period, date });
    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const copyAliasToClipboard = (alias) => {
    if (!alias) return;
    navigator.clipboard?.writeText(alias);
    setCopiedAlias(alias);
    setTimeout(() => setCopiedAlias(''), 1500);
  };

  // Anular movimiento si fuera necesario
  const handleVoidItem = async (kind, id, currentAmount, extraLabel) => {
    if (!window.confirm(`¿Seguro que deseás anular este registro de ${money(currentAmount)} (${extraLabel})?`)) {
      return;
    }
    const reason = window.prompt('Motivo de anulación:', 'Corrección de supervisora');
    if (!reason || !reason.trim()) return;

    try {
      await api('/api/ventas', {
        method: 'POST',
        body: JSON.stringify({
          action: 'void',
          kind,
          id,
          reason: reason.trim()
        })
      });
      loadData();
    } catch (err) {
      window.alert(err.message || 'No se pudo anular.');
    }
  };

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--dv-accent-fill)' }} />
      </div>
    );
  }

  if (!authed) {
    return <SupervisorLogin onLoginSuccess={loadData} />;
  }

  const aliasModal = showAliasManager ? (
    <AliasManager
      aliases={data?.aliases || []}
      post={(body) => api('/api/ventas', { method: 'POST', body: JSON.stringify(body) })}
      onChanged={() => loadData(true)}
      onClose={() => setShowAliasManager(false)}
      startAdding={showAliasManager === 'new'}
    />
  ) : null;

  const rangeLabel = !data ? '' : period === 'day' ? fmtDate(data.from) : `${fmtDate(data.from)} al ${fmtDate(data.to)}`;
  const isToday = date === todayAR();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-page)',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-heading)',
      paddingBottom: '50px'
    }}>
      {/* -------------------- BARRA SUPERIOR EJECUTIVA -------------------- */}
      <header style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Logo de Marca y Título */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--dv-accent-fill) 0%, var(--accent-gold) 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(168, 23, 90, 0.28)',
              flexShrink: 0
            }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  Panel de Supervisión
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  backgroundColor: 'var(--accent-gold-light)',
                  color: 'var(--dv-accent-text)',
                  border: '1px solid rgba(236, 111, 166, 0.4)',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  MICAELA
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Dulce Valentín · Control Financiero, Margen y Auditoría
              </div>
            </div>
          </div>

          {/* Acciones Rápidas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Modo Privacidad */}
            <button
              type="button"
              onClick={() => setPrivacyMode(!privacyMode)}
              className="btn-secondary"
              style={{
                padding: '7px 11px',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: privacyMode ? '#FEE2E2' : undefined,
                color: privacyMode ? '#DC2626' : undefined,
                borderColor: privacyMode ? '#FCA5A5' : undefined
              }}
              title={privacyMode ? 'Mostrar cifras' : 'Ocultar cifras si hay personas cerca'}
            >
              {privacyMode ? <EyeOff size={15} /> : <Eye size={15} />}
              <span>{privacyMode ? 'Oculto' : 'Ocultar $'}</span>
            </button>

            {/* Alias de cobro: siempre a mano */}
            <button
              type="button"
              onClick={() => { setActiveTab('aliases'); setShowAliasManager('new'); }}
              className="btn-primary"
              style={{ padding: '7px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#0D9488', borderColor: '#0D9488' }}
              title="Agregar un alias de cobro por transferencia"
            >
              <Landmark size={14} />
              <span>+ Alias</span>
            </button>

            {/* Excel Gerencial */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingExcel || !data}
              className="btn-secondary"
              style={{ padding: '7px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              title="Descargar Excel Gerencial Completo"
            >
              {exportingExcel ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span>Excel</span>
            </button>

            {/* WhatsApp a Mica */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={!data}
              className="btn-primary"
              style={{
                padding: '7px 12px',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#16A34A',
                borderColor: '#16A34A'
              }}
              title="Enviar resumen estructurado a WhatsApp de Micaela"
            >
              <Send size={14} />
              <span>WhatsApp</span>
            </button>

            {/* Acceso a pantalla de Mostrador / Ventas */}
            <a
              href="/ventas"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ padding: '7px 11px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none' }}
              title="Abrir pantalla de mostrador en pestaña nueva"
            >
              <ShoppingBag size={14} />
              <span>Mostrador</span>
              <ExternalLink size={11} style={{ opacity: 0.6 }} />
            </a>

            {/* Salir */}
            <button
              type="button"
              onClick={handleLogout}
              className="btn-secondary"
              style={{ padding: '7px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <LogOut size={14} /> Salir
            </button>
          </div>
        </div>
      </header>

      {/* -------------------- CONTENIDO PRINCIPAL -------------------- */}
      <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '16px 18px' }}>

        {/* Barra de Período y Fechas (Estilo Dulce Valentín) */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '18px',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
        }}>
          {/* Tabs Período: Día / Semana / Mes */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {Object.entries(PERIODS).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPeriod(id)}
                className={`admin-tab-btn ${period === id ? 'active' : ''}`}
                style={{
                  padding: '7px 16px',
                  borderRadius: '10px',
                  fontSize: '0.86rem',
                  fontWeight: 800
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Selector de Fecha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="qty-btn"
              onClick={() => setDate(shiftDate(date, period, -1))}
              aria-label="Anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={date}
                max={todayAR()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="form-input"
                style={{ padding: '6px 10px', fontSize: '0.86rem', fontWeight: 700 }}
              />
            </div>

            <button
              type="button"
              className="qty-btn"
              onClick={() => setDate(shiftDate(date, period, 1))}
              disabled={isToday}
              aria-label="Siguiente"
            >
              <ChevronRight size={16} />
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={() => setDate(todayAR())}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Hoy
              </button>
            )}

            <button
              type="button"
              onClick={() => loadData()}
              disabled={loading}
              className="qty-btn"
              style={{ width: '34px', height: '34px' }}
              title="Refrescar datos en vivo"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Indicador de Rango */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {PERIODS[period]}: <span style={{ color: 'var(--dv-accent-text)' }}>{rangeLabel}</span>
          </p>
          <span
            style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title={live ? 'Se actualiza solo con cada venta, vale o pago que se carga' : 'Reconectando… igual se actualiza cada 30 segundos'}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: live ? '#16A34A' : '#D97706',
              boxShadow: live ? '0 0 0 3px rgba(22, 163, 74, 0.2)' : 'none'
            }} />
            <strong style={{ color: live ? '#16A34A' : '#D97706' }}>{live ? 'En vivo' : 'Conectando'}</strong>
            {lastUpdate && <span>· actualizado {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
          </span>
        </div>

        {loadError && (
          <div role="alert" style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: '#FFFBEB', color: '#92400E', fontWeight: 700, marginBottom: '16px', border: '1px solid #FDE68A' }}>
            {loadError}
          </div>
        )}

        {/* -------------------- NAVEGACIÓN POR SOLAPAS -------------------- */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '18px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '10px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          {[
            { id: 'metrics', label: 'Ganancias & Rentabilidad', icon: TrendingUp },
            { id: 'aliases', label: `Alias de Cobro (${(data?.aliases || []).length})`, icon: Wallet },
            { id: 'transfers', label: `Auditoría Transferencias (${transfersList.length})`, icon: Landmark },
            { id: 'sellers', label: 'Rendimiento de Vendedoras', icon: Users },
            { id: 'history', label: 'Historial Transaccional', icon: Receipt }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`admin-tab-btn ${activeTab === id ? 'active' : ''}`}
              style={{
                borderRadius: '12px',
                padding: '9px 16px',
                fontSize: '0.88rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ==================== SOLAPA 1: GANANCIAS & RENTABILIDAD ==================== */}
        {activeTab === 'metrics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* 4 CARDS HERO PRIMARIAS (DISEÑO PROFESIONAL SENIOR) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '14px'
            }}>

              {/* 1. Facturación Bruta */}
              <ExecutiveCard
                title="Facturación Bruta (Ventas)"
                amount={money(totals.total)}
                secondaryText={`${totals.salesCount} operaciones`}
                badgeText={totals.salesCount > 0 ? `Ticket prom: ${money(Math.round(totals.total / totals.salesCount))}` : '0 ventas'}
                badgeType="brand"
                icon={DollarSign}
                gradientLine="linear-gradient(90deg, #A8175A, #EC6FA6)"
                tooltip="Monto total cobrado en el período por todas las ventas"
              />

              {/* 2. Margen Neto Real (Ganancia Limpia) */}
              <ExecutiveCard
                title="Margen Neto del Negocio"
                amount={money(netMargin)}
                secondaryText="Limpio para el local"
                badgeText={`${marginRetentionPct}% retenido`}
                badgeType="emerald"
                icon={Sparkles}
                gradientLine="linear-gradient(90deg, #059669, #34D399)"
                highlight={true}
                tooltip="Facturación bruta menos comisiones a pagar a las vendedoras"
              />

              {/* 3. Recaudación Efectivo */}
              <ExecutiveCard
                title="Efectivo en Caja / Mano"
                amount={money(totals.cash)}
                secondaryText="Billetes cobrados"
                badgeText={totals.total > 0 ? `${Math.round((totals.cash / totals.total) * 100)}% del total` : '0%'}
                badgeType="amber"
                icon={Banknote}
                gradientLine="linear-gradient(90deg, #D97706, #FBBF24)"
                tooltip="Total de cobros realizados en efectivo físico"
              />

              {/* 4. Recaudación Transferencias */}
              <ExecutiveCard
                title="Transferencias Bancarias"
                amount={money(totals.transfer)}
                secondaryText={`${transfersList.length} transferencias`}
                badgeText={totals.total > 0 ? `${Math.round((totals.transfer / totals.total) * 100)}% del total` : '0%'}
                badgeType="teal"
                icon={Landmark}
                gradientLine="linear-gradient(90deg, #0D9488, #2DD4BF)"
                tooltip="Total de cobros ingresados a cuentas bancarias / alias"
              />
            </div>

            {/* 4 CARDS SECUNDARIAS: PASIVO LABORAL, COMISIONES, VALES Y SALDOS */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px'
            }}>
              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '16px 18px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Comisiones Devengadas
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--dv-accent-text)', marginBottom: '4px' }}>
                  {money(totals.commission)}
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  A pagar a las vendedoras
                </span>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '16px 18px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Vales / Adelantos
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#DC2626', marginBottom: '4px' }}>
                  {money(totals.advances)}
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Efectivo entregado a cuenta
                </span>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '16px 18px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Liquidaciones Pagadas
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#2563EB', marginBottom: '4px' }}>
                  {money(totals.paid)}
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Saldadas en el período
                </span>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '16px 18px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Saldo Laboral Pendiente
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: totals.balance > 0 ? '#D97706' : '#059669', marginBottom: '4px' }}>
                  {money(totals.balance)}
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {totals.balance > 0 ? 'Deuda actual con staff' : 'Sin deuda de comisiones'}
                </span>
              </div>
            </div>

            {/* Barra Visual de Proporción Efectivo vs Transferencias */}
            {totals.total > 0 && (
              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '18px',
                padding: '20px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      Mix de Medios de Cobro
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Comparativa porcentual entre dinero en mano y cuentas bancarias
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', fontSize: '0.82rem', fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#B45309' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                      Efectivo: <strong>{money(totals.cash)}</strong> ({Math.round((totals.cash / totals.total) * 100)}%)
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0F766E' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#0D9488' }} />
                      Transferencias: <strong>{money(totals.transfer)}</strong> ({Math.round((totals.transfer / totals.total) * 100)}%)
                    </span>
                  </div>
                </div>

                <div style={{ height: '14px', borderRadius: '999px', backgroundColor: 'var(--bg-surface-elevated)', overflow: 'hidden', display: 'flex' }}>
                  <div
                    style={{
                      width: `${(totals.cash / totals.total) * 100}%`,
                      backgroundColor: '#F59E0B',
                      transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    title={`Efectivo: ${money(totals.cash)}`}
                  />
                  <div
                    style={{
                      width: `${(totals.transfer / totals.total) * 100}%`,
                      backgroundColor: '#0D9488',
                      transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    title={`Transferencias: ${money(totals.transfer)}`}
                  />
                </div>
              </div>
            )}

            {/* Caja Diaria y Arqueo */}
            {period === 'day' && data?.cash && (
              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '18px',
                padding: '18px 20px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PiggyBank size={18} style={{ color: 'var(--dv-accent-fill)' }} /> Conciliación de Efectivo Físico en Caja
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Efectivo esperado por ventas del día (menos vales y pagos): <strong style={{ color: 'var(--text-main)' }}>{money(data.cash.expected)}</strong>
                  </p>
                </div>

                <div>
                  {data.cash.lastCount ? (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: '0.84rem',
                        fontWeight: 900,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        backgroundColor: Number(data.cash.lastCount.difference) === 0 ? '#ECFDF5' : '#FEF2F2',
                        color: Number(data.cash.lastCount.difference) === 0 ? '#047857' : '#B91C1C',
                        border: `1px solid ${Number(data.cash.lastCount.difference) === 0 ? '#A7F3D0' : '#FECACA'}`
                      }}>
                        {Number(data.cash.lastCount.difference) === 0
                          ? '✅ Arqueo cerró exacto'
                          : Number(data.cash.lastCount.difference) > 0
                            ? `Sobran ${money(data.cash.lastCount.difference)}`
                            : `Faltan ${money(-data.cash.lastCount.difference)}`}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Contado: {money(data.cash.lastCount.counted)} ({hour(data.cash.lastCount.created_at)})
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Sin arqueo registrado para la fecha
                    </span>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================== SOLAPA: ALIAS DE COBRO ==================== */}
        {activeTab === 'aliases' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Alias de cobro: lo recibido en cada uno el día elegido */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              padding: '20px 22px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(13, 148, 136, 0.12)', color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Landmark size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>Alias de cobro</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Recibido el <strong style={{ color: 'var(--text-main)' }}>{fmtDate(date)}</strong> · al cobrar se sugiere el primero que acepta el monto
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowAliasManager('new')}
                    className="btn-primary"
                    style={{ padding: '9px 16px', fontSize: '0.88rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#0D9488', borderColor: '#0D9488' }}
                  >
                    + Agregar alias
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAliasManager('edit')}
                    className="btn-secondary"
                    style={{ padding: '9px 14px', fontSize: '0.88rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Landmark size={15} /> Editar / pausar / ordenar
                  </button>
                </div>
              </div>

              {(data?.aliases || []).length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                  No hay alias de cobro cargados. Tocá <strong>+ Agregar alias</strong>.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
                  {data.aliases.map((a, idx) => {
                    const rem = aliasLeft(a);
                    const pct = a.dailyLimit ? Math.round(((a.receivedToday || 0) / a.dailyLimit) * 100) : null;
                    const full = rem === 0;
                    const near = !full && pct !== null && pct >= 80;
                    const color = !a.active ? 'var(--text-muted)' : full ? '#DC2626' : near ? '#D97706' : '#10B981';
                    return (
                      <div key={a.id} style={{ border: `1.5px solid ${a.active ? color : 'var(--border-color)'}`, borderRadius: '14px', padding: '12px 14px', backgroundColor: 'var(--bg-surface-elevated)', opacity: a.active ? 1 : 0.6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                              {idx + 1}. {!a.active ? 'PAUSADO' : full ? 'TOPE LLENO' : near ? 'CASI LLENO' : 'ACTIVO'}
                            </div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>{a.alias}</div>
                          </div>
                          <button type="button" onClick={() => copyAliasToClipboard(a.alias)} title="Copiar alias" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedAlias === a.alias ? '#059669' : 'var(--text-muted)', flexShrink: 0 }}>
                            {copiedAlias === a.alias ? <Check size={15} /> : <Copy size={15} />}
                          </button>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{[a.holder, a.bank].filter(Boolean).join(' · ') || 'Sin titular'} · {aliasRules(a)}</div>
                        {a.description && <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--dv-accent-text)', marginTop: '2px' }}>“{a.description}”</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 800, marginTop: '8px' }}>
                          <span style={{ color: 'var(--text-main)' }}>{money(a.receivedToday)} <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem' }}>({a.countToday} ops)</span></span>
                          <span style={{ color }}>{rem !== null ? (full ? 'Lleno' : `quedan ${money(rem)}`) : 'sin tope'}</span>
                        </div>
                        {a.dailyLimit ? (
                          <div style={{ height: '7px', borderRadius: '999px', backgroundColor: 'var(--border-color)', overflow: 'hidden', marginTop: '5px' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, backgroundColor: color, transition: 'width 0.4s' }} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ==================== SOLAPA 2: AUDITORÍA DE TRANSFERENCIAS ==================== */}
        {activeTab === 'transfers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Filtros y Buscador */}
            <div style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card)',
              padding: '12px 16px',
              borderRadius: '16px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input
                  type="text"
                  placeholder="Buscar vendedora, monto o detalle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '7px 10px 7px 36px', fontSize: '0.84rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={15} style={{ color: 'var(--text-muted)' }} />
                <select
                  value={selectedSellerFilter}
                  onChange={(e) => setSelectedSellerFilter(e.target.value)}
                  className="form-input"
                  style={{ padding: '6px 10px', fontSize: '0.84rem', fontWeight: 600 }}
                >
                  <option value="ALL">Todas las vendedoras</option>
                  {(data?.sellers || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto', fontWeight: 700 }}>
                {filteredTransfers.length} transferencias · Total: <strong style={{ color: '#0D9488' }}>{money(filteredTransfers.reduce((a, b) => a + (b.amount || 0), 0))}</strong>
              </span>
            </div>

            {/* Tabla Detallada con soporte Móvil Responsivo */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '18px',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Hora / Fecha</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Monto</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Vendedora</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Alias Destino</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Nota / Comprobante</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransfers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Sin transferencias registradas para la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filteredTransfers.map((t) => {
                        const aliasInfo = (data.supervisorData?.aliasByDate && data.supervisorData.aliasByDate[t.date]) || data.dailyAlias || {};
                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s' }}>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                              <strong style={{ display: 'block', color: 'var(--text-main)' }}>
                                {t.createdAt ? hour(t.createdAt) : '--:--'}
                              </strong>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {fmtDate(t.date)}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                              <strong style={{ color: '#0D9488', fontSize: '1rem', fontVariantNumeric: 'tabular-nums' }}>
                                {money(t.amount)}
                              </strong>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                fontWeight: 800,
                                color: t.sellerName.toLowerCase().trim() === 'mostrador' ? '#2563EB' : 'var(--text-main)'
                              }}>
                                {t.sellerName}
                              </span>
                              {t.sellerName.toLowerCase().trim() === 'mostrador' && (
                                <span style={{ display: 'block', fontSize: '0.7rem', color: '#3B82F6' }}>
                                  Venta directa caja
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                color: 'var(--text-main)',
                                backgroundColor: 'var(--bg-surface-elevated)',
                                padding: '3px 8px',
                                borderRadius: '6px'
                              }}>
                                {t.aliasName || (t.aliasId ? 'Alias archivado' : aliasInfo.alias || 'Sin alias')}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                              {t.note || <span style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>Sin nota</span>}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => handleVoidItem('sale', t.id, t.amount, `Transferencia de ${t.sellerName}`)}
                                style={{
                                  backgroundColor: '#FEF2F2',
                                  color: '#DC2626',
                                  border: '1px solid #FECACA',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                                title="Anular si fue un cobro por error"
                              >
                                Anular
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ==================== SOLAPA 3: RENDIMIENTO DE VENDEDORAS ==================== */}
        {activeTab === 'sellers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Podio / Leaderboard de Rendimiento */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              padding: '22px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={20} style={{ color: '#F59E0B' }} />
                  Ranking de Ventas del Período
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total vendido entre vendedoras: <strong style={{ color: 'var(--text-main)' }}>{money(totals.total)}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[...(data?.sellers || [])]
                  .sort((a, b) => b.total - a.total)
                  .map((s, idx) => {
                    const pctOfStore = totals.total > 0 ? Math.round((s.total / totals.total) * 100) : 0;
                    return (
                      <div
                        key={s.id}
                        style={{
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderRadius: '14px',
                          padding: '12px 16px',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          flexWrap: 'wrap'
                        }}
                      >
                        <span style={{ fontSize: '1.15rem', width: '28px', textAlign: 'center', fontWeight: 900 }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                        </span>

                        <div style={{ flex: 1, minWidth: '150px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.96rem' }}>{s.name}</span>
                          <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {s.salesCount} ventas · % Com: <strong style={{ color: 'var(--dv-accent-text)' }}>{s.pct}%</strong>
                          </span>
                        </div>

                        {/* Barra proporcional */}
                        <div style={{ width: '120px', height: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${pctOfStore}%`, height: '100%', backgroundColor: 'var(--dv-accent-fill)', borderRadius: '999px' }} />
                        </div>

                        <div style={{ textAlign: 'right', minWidth: '110px' }}>
                          <strong style={{ display: 'block', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                            {money(s.total)}
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 700 }}>
                            Comisión: {money(s.commission)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Consolidado Laboral Completo */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>
                  Consolidado Laboral y Liquidaciones
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Auditoría de comisiones devengadas, vales en efectivo y saldo acumulado.
                </p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Vendedora</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Total Vendido</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Efectivo</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Transferencia</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>% Com.</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Comisión</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Vales</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Liquidado</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Saldo Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.sellers || []).map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {s.name}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                          {money(s.total)}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#B45309' }}>
                          {money(s.cash)}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#0F766E' }}>
                          {money(s.transfer)}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--dv-accent-text)' }}>
                          {s.pct}%
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#059669' }}>
                          {money(s.commission)}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#DC2626' }}>
                          − {money(s.advances)}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#2563EB' }}>
                          − {money(s.paid)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <strong style={{
                            fontSize: '0.98rem',
                            color: s.balance > 0 ? '#D97706' : s.balance < 0 ? '#DC2626' : '#059669'
                          }}>
                            {money(s.balance)}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ==================== SOLAPA 4: HISTORIAL COMPLETO ==================== */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              padding: '20px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 900 }}>
                Auditoría Transaccional y Movimientos
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Registro completo de todas las ventas, vales y liquidaciones registradas en el período. Nada se borra, todo se audita.
              </p>

              {/* Solapas secundarias */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Ventas */}
                <h4 style={{ margin: '8px 0 4px 0', fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Ventas Registradas ({data?.supervisorData?.sales?.length || 0})
                </h4>
                <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'var(--bg-surface-elevated)', position: 'sticky', top: 0 }}>
                      <tr style={{ color: 'var(--text-muted)' }}>
                        <th style={{ padding: '9px 12px' }}>Hora / Fecha</th>
                        <th style={{ padding: '9px 12px' }}>Vendedora</th>
                        <th style={{ padding: '9px 12px' }}>Monto</th>
                        <th style={{ padding: '9px 12px' }}>Medio</th>
                        <th style={{ padding: '9px 12px' }}>Nota</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.supervisorData?.sales || []).map((x) => (
                        <tr key={x.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: x.voided_at ? 0.4 : 1, textDecoration: x.voided_at ? 'line-through' : 'none' }}>
                          <td style={{ padding: '9px 12px' }}>{hour(x.created_at)} ({fmtDate(x.sale_date)})</td>
                          <td style={{ padding: '9px 12px', fontWeight: 700 }}>{x.seller_name}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 800, color: 'var(--text-main)' }}>{money(x.amount)}</td>
                          <td style={{ padding: '9px 12px', textTransform: 'capitalize' }}>{x.payment_method}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{x.note || '-'}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                            {!x.voided_at && (
                              <button
                                type="button"
                                onClick={() => handleVoidItem('sale', x.id, x.amount, `Venta de ${x.seller_name}`)}
                                style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '4px', padding: '2px 6px', fontSize: '0.72rem', cursor: 'pointer' }}
                              >
                                Anular
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vales */}
                <h4 style={{ margin: '12px 0 4px 0', fontSize: '0.92rem', fontWeight: 800, color: '#DC2626' }}>
                  Vales y Adelantos Entregados ({data?.supervisorData?.advances?.length || 0})
                </h4>
                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'var(--bg-surface-elevated)', position: 'sticky', top: 0 }}>
                      <tr style={{ color: 'var(--text-muted)' }}>
                        <th style={{ padding: '9px 12px' }}>Hora / Fecha</th>
                        <th style={{ padding: '9px 12px' }}>Vendedora</th>
                        <th style={{ padding: '9px 12px' }}>Monto Retirado</th>
                        <th style={{ padding: '9px 12px' }}>Medio</th>
                        <th style={{ padding: '9px 12px' }}>Nota</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.supervisorData?.advances || []).map((x) => (
                        <tr key={x.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: x.voided_at ? 0.4 : 1, textDecoration: x.voided_at ? 'line-through' : 'none' }}>
                          <td style={{ padding: '9px 12px' }}>{hour(x.created_at)} ({fmtDate(x.advance_date)})</td>
                          <td style={{ padding: '9px 12px', fontWeight: 700 }}>{x.seller_name}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 800, color: '#DC2626' }}>{money(x.amount)}</td>
                          <td style={{ padding: '9px 12px', textTransform: 'capitalize' }}>{x.payment_method}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{x.note || '-'}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                            {!x.voided_at && (
                              <button
                                type="button"
                                onClick={() => handleVoidItem('advance', x.id, x.amount, `Vale de ${x.seller_name}`)}
                                style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '4px', padding: '2px 6px', fontSize: '0.72rem', cursor: 'pointer' }}
                              >
                                Anular
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Liquidaciones */}
                <h4 style={{ margin: '12px 0 4px 0', fontSize: '0.92rem', fontWeight: 800, color: '#059669' }}>
                  Liquidaciones Pagadas a Vendedoras ({data?.supervisorData?.payouts?.length || 0})
                </h4>
                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'var(--bg-surface-elevated)', position: 'sticky', top: 0 }}>
                      <tr style={{ color: 'var(--text-muted)' }}>
                        <th style={{ padding: '9px 12px' }}>Fecha Pago</th>
                        <th style={{ padding: '9px 12px' }}>Vendedora</th>
                        <th style={{ padding: '9px 12px' }}>Monto Pagado</th>
                        <th style={{ padding: '9px 12px' }}>Período</th>
                        <th style={{ padding: '9px 12px' }}>Nota</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.supervisorData?.payouts || []).map((x) => (
                        <tr key={x.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: x.voided_at ? 0.4 : 1, textDecoration: x.voided_at ? 'line-through' : 'none' }}>
                          <td style={{ padding: '9px 12px' }}>{fmtDate(x.paid_date)} ({hour(x.created_at)})</td>
                          <td style={{ padding: '9px 12px', fontWeight: 700 }}>{x.seller_name}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 800, color: '#059669' }}>{money(x.amount)}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{x.period_from ? `${fmtDate(x.period_from)} al ${fmtDate(x.period_to)}` : 'A cuenta'}</td>
                          <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{x.note || '-'}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                            {!x.voided_at && (
                              <button
                                type="button"
                                onClick={() => handleVoidItem('payout', x.id, x.amount, `Pago a ${x.seller_name}`)}
                                style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '4px', padding: '2px 6px', fontSize: '0.72rem', cursor: 'pointer' }}
                              >
                                Anular
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

          </div>
        )}

        {aliasModal}
      </main>
    </div>
  );
}
