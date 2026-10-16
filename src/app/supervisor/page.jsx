'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  TrendingUp,
  TrendingDown,
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
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { adminFetch } from '@/lib/adminFetch';
import {
  downloadSupervisorExcel,
  supervisorWhatsAppText,
  OWNER_WHATSAPP
} from '@/lib/ventasExport';

const SUPERVISOR_EMAIL = 'belenbarbieri93@gmail.com';
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

// ---------------------------------------------------------------- Componente de Login Exclusivo para Micaela
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
      backgroundColor: '#0F172A',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(217, 119, 6, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(13, 148, 136, 0.15) 0px, transparent 50%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        backgroundColor: '#1E293B',
        borderRadius: '24px',
        padding: '36px 30px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#F8FAFC'
      }}>
        {/* Cabecera del Portal */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            backgroundColor: 'rgba(217, 119, 6, 0.2)',
            color: '#F59E0B',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            border: '1px solid rgba(245, 158, 11, 0.3)'
          }}>
            <ShieldCheck size={36} />
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 900, margin: '0 0 6px 0', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            Portal de Supervisión
          </h1>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#94A3B8' }}>
            Dulce Valentín · Acceso reservado para <strong style={{ color: '#F1F5F9' }}>Micaela Barbieri</strong>
          </p>
        </div>

        {errorMsg && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#FCA5A5',
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
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Email de Supervisora
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 38px',
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '0.92rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input
                type={showPass ? 'text' : 'password'}
                required
                placeholder="Ingresá tu clave"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 38px',
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '0.92rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '2px'
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
              backgroundColor: '#D97706',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              padding: '13px',
              fontSize: '0.95rem',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
            <span>Ingresar al Panel de Supervisión</span>
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.78rem', color: '#64748B' }}>
          <span>🔒 Panel encriptado y seguro · Dulce Valentín Rosario</span>
        </div>
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
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState('ALL');

  // Formato de moneda con soporte de modo privacidad
  const money = useCallback((n) => {
    if (privacyMode) return '$ ••••••';
    const num = Number(n || 0);
    return `${num < 0 ? '−' : ''}$${Math.abs(num).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
  }, [privacyMode]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await adminFetch(`/api/ventas?period=${period}&date=${date}&supervisor=1`);
      setData(res);
      setAuthed(true);
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

  // Monitoreo del tope del alias activo
  const activeAliasLimit = Number(data?.dailyAlias?.limit) || 1000000;
  const aliasRemaining = activeAliasLimit - totalTransfersPeriod;
  const aliasPct = Math.round((totalTransfersPeriod / (activeAliasLimit || 1)) * 100);
  const aliasIsOver = totalTransfersPeriod >= activeAliasLimit;
  const aliasIsNear = !aliasIsOver && aliasPct >= 80;

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

  const copyAliasToClipboard = () => {
    if (!data?.dailyAlias?.alias) return;
    navigator.clipboard.writeText(data.dailyAlias.alias);
    setCopiedAlias(true);
    setTimeout(() => setCopiedAlias(false), 2000);
  };

  // Anular movimiento si fuera necesario
  const handleVoidItem = async (kind, id, currentAmount, extraLabel) => {
    if (!window.confirm(`¿Seguro que deseás anular este registro de ${money(currentAmount)} (${extraLabel})?`)) {
      return;
    }
    const reason = window.prompt('Motivo de anulación:', 'Corrección de supervisora');
    if (!reason || !reason.trim()) return;

    try {
      await adminFetch('/api/ventas', {
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
      <div style={{ minHeight: '100vh', backgroundColor: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F8FAFC' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: '#D97706' }} />
      </div>
    );
  }

  if (!authed) {
    return <SupervisorLogin onLoginSuccess={loadData} />;
  }

  const rangeLabel = !data ? '' : period === 'day' ? fmtDate(data.from) : `${fmtDate(data.from)} al ${fmtDate(data.to)}`;
  const isToday = date === todayAR();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0F172A',
      color: '#F8FAFC',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      paddingBottom: '40px'
    }}>
      {/* Barra Superior VIP */}
      <header style={{
        backgroundColor: '#1E293B',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Logo y Titular */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(217, 119, 6, 0.18)',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                  Panel de Supervisión
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  backgroundColor: 'rgba(217, 119, 6, 0.25)',
                  color: '#FBBF24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  MICAELA
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                Dulce Valentín · Control Financiero y Auditoría de Ventas
              </div>
            </div>
          </div>

          {/* Acciones de Cabecera */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Botón Modo Privacidad (Ocultar Números) */}
            <button
              type="button"
              onClick={() => setPrivacyMode(!privacyMode)}
              style={{
                backgroundColor: privacyMode ? '#DC2626' : '#334155',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title={privacyMode ? 'Mostrar montos' : 'Ocultar montos por seguridad'}
            >
              {privacyMode ? <EyeOff size={15} /> : <Eye size={15} />}
              <span>{privacyMode ? 'Privacidad: ON' : 'Ocultar $'}</span>
            </button>

            {/* Exportar Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingExcel || !data}
              style={{
                backgroundColor: '#0F766E',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: exportingExcel ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Descarga el Excel Gerencial Completo"
            >
              {exportingExcel ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span>Excel Gerencial</span>
            </button>

            {/* Enviar WhatsApp a Mica */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={!data}
              style={{
                backgroundColor: '#16A34A',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Enviar resumen estructurado a WhatsApp de Micaela"
            >
              <Send size={15} />
              <span>WhatsApp Ejecutivo</span>
            </button>

            {/* Acceso a pantalla de Mostrador / Ventas */}
            <a
              href="/ventas"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#1E293B',
                border: '1px solid #475569',
                color: '#E2E8F0',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Abrir mostrador de ventas en pestaña nueva"
            >
              <ShoppingBag size={15} />
              <span>Mostrador</span>
              <ExternalLink size={12} style={{ opacity: 0.6 }} />
            </a>

            {/* Cerrar Sesión */}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                backgroundColor: '#334155',
                color: '#CBD5E1',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <LogOut size={15} /> Salir
            </button>
          </div>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '20px' }}>

        {/* Barra de Filtro de Período y Fecha */}
        <div style={{
          backgroundColor: '#1E293B',
          borderRadius: '18px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          {/* Tabs Período: Día / Semana / Mes */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {Object.entries(PERIODS).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPeriod(id)}
                style={{
                  backgroundColor: period === id ? '#D97706' : '#0F172A',
                  color: period === id ? '#FFFFFF' : '#94A3B8',
                  border: period === id ? '1px solid #D97706' : '1px solid #334155',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Navegación de Fecha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setDate(shiftDate(date, period, -1))}
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                color: '#FFFFFF',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer'
              }}
              title="Período anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0F172A', padding: '4px 10px', borderRadius: '10px', border: '1px solid #334155' }}>
              <Calendar size={15} style={{ color: '#F59E0B' }} />
              <input
                type="date"
                value={date}
                max={todayAR()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => setDate(shiftDate(date, period, 1))}
              disabled={isToday}
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                color: isToday ? '#475569' : '#FFFFFF',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: isToday ? 'not-allowed' : 'pointer'
              }}
              title="Período siguiente"
            >
              <ChevronRight size={16} />
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={() => setDate(todayAR())}
                style={{
                  backgroundColor: '#334155',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Volver a Hoy
              </button>
            )}

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                color: '#94A3B8',
                borderRadius: '8px',
                padding: '7px 10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              title="Actualizar datos en vivo"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loadError && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#FCA5A5', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontWeight: 600 }}>
            {loadError}
          </div>
        )}

        {/* Navegación por Solapas Internas del Dashboard */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '1px solid #334155',
          paddingBottom: '12px',
          overflowX: 'auto'
        }}>
          {[
            { id: 'metrics', label: 'Ganancias & Rentabilidad', icon: TrendingUp },
            { id: 'transfers', label: `Auditoría Transferencias (${transfersList.length})`, icon: Landmark },
            { id: 'sellers', label: 'Vendedoras & Comisiones', icon: Users },
            { id: 'history', label: 'Historial Completo', icon: Receipt }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              style={{
                backgroundColor: activeTab === id ? '#334155' : 'transparent',
                color: activeTab === id ? '#FBBF24' : '#94A3B8',
                border: activeTab === id ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                borderRadius: '12px',
                padding: '10px 16px',
                fontSize: '0.9rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* -------------------- SOLAPA 1: GANANCIAS & RENTABILIDAD -------------------- */}
        {activeTab === 'metrics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Tarjetas Primarias de Alto Impacto */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

              {/* 1. Facturación Bruta (Venta Total) */}
              <div style={{
                backgroundColor: '#1E293B',
                borderRadius: '18px',
                padding: '22px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Facturación Bruta (Ventas)
                  </span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '6px' }}>
                  {money(totals.total)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{totals.salesCount} operaciones</span>
                  <span>·</span>
                  <span>Ticket prom: <strong style={{ color: '#F1F5F9' }}>{totals.salesCount > 0 ? money(Math.round(totals.total / totals.salesCount)) : '−'}</strong></span>
                </div>
              </div>

              {/* 2. Margen Neto para Dulce Valentín (Ganancia Bruta Comercial) */}
              <div style={{
                backgroundColor: '#1E293B',
                borderRadius: '18px',
                padding: '22px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.08)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  padding: '3px 12px',
                  borderBottomLeftRadius: '10px'
                }}>
                  LIMPIO LOCAL
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#A7F3D0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Margen Neto del Negocio
                  </span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#34D399', marginBottom: '6px' }}>
                  {money(netMargin)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  Retención del local: <strong style={{ color: '#6EE7B7' }}>{marginRetentionPct}%</strong> después de comisiones
                </div>
              </div>

              {/* 3. Recaudación en Efectivo */}
              <div style={{
                backgroundColor: '#1E293B',
                borderRadius: '18px',
                padding: '22px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Efectivo en Mano / Caja
                  </span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#FACC15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Banknote size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#FACC15', marginBottom: '6px' }}>
                  {money(totals.cash)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  {totals.total > 0 ? `${Math.round((totals.cash / totals.total) * 100)}% de la facturación` : 'Sin ventas'}
                </div>
              </div>

              {/* 4. Recaudación en Transferencias */}
              <div style={{
                backgroundColor: '#1E293B',
                borderRadius: '18px',
                padding: '22px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Transferencias Bancarias
                  </span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(13, 148, 136, 0.18)', color: '#2DD4BF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Landmark size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#2DD4BF', marginBottom: '6px' }}>
                  {money(totals.transfer)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  {transfersList.length} transferencias recibidas ({totals.total > 0 ? `${Math.round((totals.transfer / totals.total) * 100)}%` : '0%'})
                </div>
              </div>
            </div>

            {/* Fila Secundaria: Pasivo Laboral, Comisiones, Vales y Arqueo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ backgroundColor: '#1E293B', borderRadius: '14px', padding: '16px 18px', border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                  Comisiones Devengadas
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#F59E0B' }}>
                  {money(totals.commission)}
                </span>
                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                  Calculadas por % diario del staff
                </span>
              </div>

              <div style={{ backgroundColor: '#1E293B', borderRadius: '14px', padding: '16px 18px', border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                  Vales / Adelantos Entregados
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#F87171' }}>
                  {money(totals.advances)}
                </span>
                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                  Efectivo entregado a cuenta
                </span>
              </div>

              <div style={{ backgroundColor: '#1E293B', borderRadius: '14px', padding: '16px 18px', border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                  Liquidaciones Pagadas
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#38BDF8' }}>
                  {money(totals.paid)}
                </span>
                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                  Pagadas en el período
                </span>
              </div>

              <div style={{ backgroundColor: '#1E293B', borderRadius: '14px', padding: '16px 18px', border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                  Pasivo Laboral (Saldo Pendiente)
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: totals.balance > 0 ? '#FB923C' : '#34D399' }}>
                  {money(totals.balance)}
                </span>
                <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                  {totals.balance > 0 ? 'Total a liquidar a vendedoras' : 'Sin deuda de comisiones'}
                </span>
              </div>
            </div>

            {/* Barra Visual de Mix de Pago (Efectivo vs Transferencia) */}
            {totals.total > 0 && (
              <div style={{ backgroundColor: '#1E293B', borderRadius: '16px', padding: '20px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#E2E8F0' }}>
                    Distribución por Medio de Pago
                  </span>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#FACC15' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FACC15' }} />
                      Efectivo: <strong>{money(totals.cash)}</strong> ({Math.round((totals.cash / totals.total) * 100)}%)
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#2DD4BF' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#2DD4BF' }} />
                      Transferencias: <strong>{money(totals.transfer)}</strong> ({Math.round((totals.transfer / totals.total) * 100)}%)
                    </span>
                  </div>
                </div>

                <div style={{ height: '14px', borderRadius: '999px', backgroundColor: '#0F172A', overflow: 'hidden', display: 'flex' }}>
                  <div
                    style={{
                      width: `${(totals.cash / totals.total) * 100}%`,
                      backgroundColor: '#EAB308',
                      transition: 'width 0.4s'
                    }}
                    title={`Efectivo: ${money(totals.cash)}`}
                  />
                  <div
                    style={{
                      width: `${(totals.transfer / totals.total) * 100}%`,
                      backgroundColor: '#0D9488',
                      transition: 'width 0.4s'
                    }}
                    title={`Transferencias: ${money(totals.transfer)}`}
                  />
                </div>
              </div>
            )}

            {/* Estado de Caja del Día */}
            {period === 'day' && data?.cash && (
              <div style={{
                backgroundColor: '#1E293B',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF' }}>
                    Conciliación de Caja Diaria (Efectivo Físico)
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#94A3B8' }}>
                    Efectivo esperado por ventas menos vales y pagos: <strong style={{ color: '#FACC15' }}>{money(data.cash.expected)}</strong>
                  </p>
                </div>

                <div>
                  {data.cash.lastCount ? (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 900,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        backgroundColor: Number(data.cash.lastCount.difference) === 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: Number(data.cash.lastCount.difference) === 0 ? '#34D399' : '#FCA5A5'
                      }}>
                        {Number(data.cash.lastCount.difference) === 0
                          ? '✅ Arqueo cerró exacto'
                          : Number(data.cash.lastCount.difference) > 0
                            ? `Sobran ${money(data.cash.lastCount.difference)}`
                            : `Faltan ${money(-data.cash.lastCount.difference)}`}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                        Contado: {money(data.cash.lastCount.counted)} (a las {hour(data.cash.lastCount.created_at)})
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontStyle: 'italic' }}>
                      Sin arqueo realizado aún para hoy
                    </span>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* -------------------- SOLAPA 2: AUDITORÍA DE TRANSFERENCIAS -------------------- */}
        {activeTab === 'transfers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Monitor de Alias Diario y Alerta de Tope */}
            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '20px',
              padding: '24px',
              border: `2px solid ${aliasIsOver ? '#DC2626' : aliasIsNear ? '#F59E0B' : 'rgba(13, 148, 136, 0.4)'}`,
              boxShadow: aliasIsOver ? '0 8px 30px rgba(220, 38, 38, 0.2)' : 'none'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#FFFFFF' }}>
                      Alias Activo: <span style={{ color: '#2DD4BF', fontFamily: 'monospace' }}>{data?.dailyAlias?.alias || 'dulce.valentin.rioja'}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={copyAliasToClipboard}
                      style={{
                        backgroundColor: '#0F172A',
                        border: '1px solid #334155',
                        color: copiedAlias ? '#34D399' : '#94A3B8',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {copiedAlias ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedAlias ? '¡Copiado!' : 'Copiar'}</span>
                    </button>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      padding: '3px 10px',
                      borderRadius: '8px',
                      backgroundColor: aliasIsOver ? '#DC2626' : aliasIsNear ? '#D97706' : '#059669',
                      color: '#FFFFFF'
                    }}>
                      {aliasIsOver ? `🚨 TOPE ALCANZADO (${aliasPct}%)` : aliasIsNear ? `⚠️ ALERTA DE TOPE (${aliasPct}%)` : `✅ CUENTA OK (${aliasPct}%)`}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#94A3B8' }}>
                    Titular: <strong style={{ color: '#E2E8F0' }}>{data?.dailyAlias?.holder || 'Micaela'}</strong> {data?.dailyAlias?.bank ? `· Banco: ${data.dailyAlias.bank}` : ''}
                  </div>
                </div>

                {/* Métricas del Tope */}
                <div style={{ display: 'flex', gap: '18px', textAlign: 'right', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.74rem', color: '#94A3B8', textTransform: 'uppercase' }}>Tope de Cuenta</span>
                    <strong style={{ fontSize: '1.15rem', color: '#FFFFFF' }}>{money(activeAliasLimit)}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.74rem', color: '#94A3B8', textTransform: 'uppercase' }}>Total Transferido</span>
                    <strong style={{ fontSize: '1.15rem', color: aliasIsOver ? '#F87171' : '#34D399' }}>{money(totalTransfersPeriod)}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.74rem', color: '#94A3B8', textTransform: 'uppercase' }}>Restante Disponible</span>
                    <strong style={{ fontSize: '1.15rem', color: aliasRemaining >= 0 ? '#38BDF8' : '#F87171' }}>
                      {aliasRemaining >= 0 ? money(aliasRemaining) : `Exceso: ${money(-aliasRemaining)}`}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Barra de progreso de consumo de cuenta */}
              <div style={{ height: '12px', borderRadius: '999px', backgroundColor: '#0F172A', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(aliasPct, 100)}%`,
                    height: '100%',
                    backgroundColor: aliasIsOver ? '#DC2626' : aliasIsNear ? '#F59E0B' : '#10B981',
                    borderRadius: '999px',
                    transition: 'width 0.4s'
                  }}
                />
              </div>
            </div>

            {/* Barra de Búsqueda y Filtros */}
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
              backgroundColor: '#1E293B',
              padding: '12px 18px',
              borderRadius: '14px',
              border: '1px solid #334155'
            }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                <input
                  type="text"
                  placeholder="Buscar por vendedora, monto o nota..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={15} style={{ color: '#94A3B8' }} />
                <select
                  value={selectedSellerFilter}
                  onChange={(e) => setSelectedSellerFilter(e.target.value)}
                  style={{
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                    color: '#FFFFFF',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL">Todas las vendedoras</option>
                  {(data?.sellers || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <span style={{ fontSize: '0.82rem', color: '#94A3B8', marginLeft: 'auto' }}>
                Mostrando <strong>{filteredTransfers.length}</strong> transferencias ({money(filteredTransfers.reduce((a, b) => a + (b.amount || 0), 0))})
              </span>
            </div>

            {/* Tabla Detallada de Transferencias */}
            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '18px',
              border: '1px solid #334155',
              overflow: 'hidden'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Hora / Fecha</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Monto</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Vendedora</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Alias Receptor</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Detalle / Nota</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransfers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                          Sin transferencias registradas para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredTransfers.map((t) => {
                        const aliasInfo = (data.supervisorData?.aliasByDate && data.supervisorData.aliasByDate[t.date]) || data.dailyAlias || {};
                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{ fontWeight: 800, color: '#FFFFFF', display: 'block' }}>
                                {t.createdAt ? hour(t.createdAt) : '--:--'}
                              </span>
                              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                                {fmtDate(t.date)}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <strong style={{ color: '#2DD4BF', fontSize: '1.05rem' }}>
                                {money(t.amount)}
                              </strong>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                fontWeight: 700,
                                color: t.sellerName.toLowerCase().trim() === 'mostrador' ? '#60A5FA' : '#F1F5F9'
                              }}>
                                {t.sellerName}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#E2E8F0', backgroundColor: '#0F172A', padding: '3px 8px', borderRadius: '6px' }}>
                                {aliasInfo.alias || 'dulce.valentin.rioja'}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px', color: '#94A3B8' }}>
                              {t.note || <span style={{ fontStyle: 'italic', color: '#64748B' }}>Sin nota</span>}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => handleVoidItem('sale', t.id, t.amount, `Transferencia de ${t.sellerName}`)}
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  color: '#F87171',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontSize: '0.75rem',
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

        {/* -------------------- SOLAPA 3: VENDEDORAS & COMISIONES -------------------- */}
        {activeTab === 'sellers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Podio / Ranking de Ventas */}
            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '20px',
              padding: '22px',
              border: '1px solid #334155'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={20} style={{ color: '#F59E0B' }} />
                  Ranking de Ventas del Período
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  Total vendido entre vendedoras: <strong style={{ color: '#FFFFFF' }}>{money(totals.total)}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[...(data?.sellers || [])]
                  .sort((a, b) => b.total - a.total)
                  .map((s, idx) => {
                    const pctOfStore = totals.total > 0 ? Math.round((s.total / totals.total) * 100) : 0;
                    return (
                      <div
                        key={s.id}
                        style={{
                          backgroundColor: '#0F172A',
                          borderRadius: '12px',
                          padding: '12px 16px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          flexWrap: 'wrap'
                        }}
                      >
                        <span style={{ fontSize: '1.2rem', width: '28px', textAlign: 'center', fontWeight: 900 }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                        </span>

                        <div style={{ flex: 1, minWidth: '160px' }}>
                          <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.98rem' }}>{s.name}</span>
                          <span style={{ display: 'block', fontSize: '0.76rem', color: '#94A3B8' }}>
                            {s.salesCount} ventas · % Comisión: <strong style={{ color: '#FBBF24' }}>{s.pct}%</strong>
                          </span>
                        </div>

                        {/* Barra proporcional */}
                        <div style={{ width: '120px', height: '8px', backgroundColor: '#1E293B', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${pctOfStore}%`, height: '100%', backgroundColor: '#D97706', borderRadius: '999px' }} />
                        </div>

                        <div style={{ textAlign: 'right', minWidth: '110px' }}>
                          <strong style={{ display: 'block', fontSize: '1.05rem', color: '#FFFFFF' }}>
                            {money(s.total)}
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: '#34D399' }}>
                            Comisión: {money(s.commission)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Tabla Completa de Comisiones, Vales y Saldos */}
            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '20px',
              border: '1px solid #334155',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900 }}>
                  Consolidado Laboral y Liquidaciones
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8' }}>
                  Auditoría completa de comisiones devengadas, vales en efectivo entregados y saldo acumulado.
                </p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Vendedora</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Total Vendido</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Efectivo</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Transferencias</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>% Com.</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Comisión Ganada</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Vales Retirados</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800 }}>Liquidado</th>
                      <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Saldo Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.sellers || []).map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#FFFFFF' }}>
                          {s.name}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                          {money(s.total)}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#FACC15' }}>
                          {money(s.cash)}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#2DD4BF' }}>
                          {money(s.transfer)}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#FBBF24' }}>
                          {s.pct}%
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#34D399' }}>
                          {money(s.commission)}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#F87171' }}>
                          − {money(s.advances)}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#38BDF8' }}>
                          − {money(s.paid)}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <strong style={{
                            fontSize: '1rem',
                            color: s.balance > 0 ? '#FB923C' : s.balance < 0 ? '#F87171' : '#34D399'
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

        {/* -------------------- SOLAPA 4: HISTORIAL COMPLETO -------------------- */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '20px',
              padding: '20px',
              border: '1px solid #334155'
            }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 900 }}>
                Auditoría Transaccional y Movimientos
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#94A3B8' }}>
                Registro completo de todas las ventas, vales y liquidaciones registradas en el período. Nada se borra, todo se audita.
              </p>

              {/* Solapas secundarias para historial */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Ventas */}
                <h4 style={{ margin: '10px 0 6px 0', fontSize: '0.95rem', fontWeight: 800, color: '#38BDF8' }}>
                  Ventas Registradas ({data?.supervisorData?.sales?.length || 0})
                </h4>
                <div style={{ maxHeight: '340px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#0F172A', position: 'sticky', top: 0 }}>
                      <tr style={{ color: '#94A3B8' }}>
                        <th style={{ padding: '10px 14px' }}>Hora / Fecha</th>
                        <th style={{ padding: '10px 14px' }}>Vendedora</th>
                        <th style={{ padding: '10px 14px' }}>Monto</th>
                        <th style={{ padding: '10px 14px' }}>Medio</th>
                        <th style={{ padding: '10px 14px' }}>Nota</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.supervisorData?.sales || []).map((x) => (
                        <tr key={x.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: x.voided_at ? 0.4 : 1, textDecoration: x.voided_at ? 'line-through' : 'none' }}>
                          <td style={{ padding: '10px 14px' }}>{hour(x.created_at)} ({fmtDate(x.sale_date)})</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700 }}>{x.seller_name}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: '#FFFFFF' }}>{money(x.amount)}</td>
                          <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>{x.payment_method}</td>
                          <td style={{ padding: '10px 14px', color: '#94A3B8' }}>{x.note || '-'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            {!x.voided_at && (
                              <button
                                type="button"
                                onClick={() => handleVoidItem('sale', x.id, x.amount, `Venta de ${x.seller_name}`)}
                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '0.72rem', cursor: 'pointer' }}
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

                {/* Vales y Adelantos */}
                <h4 style={{ margin: '14px 0 6px 0', fontSize: '0.95rem', fontWeight: 800, color: '#F87171' }}>
                  Vales y Adelantos Entregados ({data?.supervisorData?.advances?.length || 0})
                </h4>
                <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#0F172A', position: 'sticky', top: 0 }}>
                      <tr style={{ color: '#94A3B8' }}>
                        <th style={{ padding: '10px 14px' }}>Hora / Fecha</th>
                        <th style={{ padding: '10px 14px' }}>Vendedora</th>
                        <th style={{ padding: '10px 14px' }}>Monto Retirado</th>
                        <th style={{ padding: '10px 14px' }}>Medio</th>
                        <th style={{ padding: '10px 14px' }}>Nota</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.supervisorData?.advances || []).map((x) => (
                        <tr key={x.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: x.voided_at ? 0.4 : 1, textDecoration: x.voided_at ? 'line-through' : 'none' }}>
                          <td style={{ padding: '10px 14px' }}>{hour(x.created_at)} ({fmtDate(x.advance_date)})</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700 }}>{x.seller_name}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: '#F87171' }}>{money(x.amount)}</td>
                          <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>{x.payment_method}</td>
                          <td style={{ padding: '10px 14px', color: '#94A3B8' }}>{x.note || '-'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            {!x.voided_at && (
                              <button
                                type="button"
                                onClick={() => handleVoidItem('advance', x.id, x.amount, `Vale de ${x.seller_name}`)}
                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '0.72rem', cursor: 'pointer' }}
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

                {/* Liquidaciones y Pagos */}
                <h4 style={{ margin: '14px 0 6px 0', fontSize: '0.95rem', fontWeight: 800, color: '#34D399' }}>
                  Liquidaciones Pagadas a Vendedoras ({data?.supervisorData?.payouts?.length || 0})
                </h4>
                <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#0F172A', position: 'sticky', top: 0 }}>
                      <tr style={{ color: '#94A3B8' }}>
                        <th style={{ padding: '10px 14px' }}>Fecha Pago</th>
                        <th style={{ padding: '10px 14px' }}>Vendedora</th>
                        <th style={{ padding: '10px 14px' }}>Monto Pagado</th>
                        <th style={{ padding: '10px 14px' }}>Período</th>
                        <th style={{ padding: '10px 14px' }}>Nota</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.supervisorData?.payouts || []).map((x) => (
                        <tr key={x.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: x.voided_at ? 0.4 : 1, textDecoration: x.voided_at ? 'line-through' : 'none' }}>
                          <td style={{ padding: '10px 14px' }}>{fmtDate(x.paid_date)} ({hour(x.created_at)})</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700 }}>{x.seller_name}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: '#34D399' }}>{money(x.amount)}</td>
                          <td style={{ padding: '10px 14px', color: '#94A3B8' }}>{x.period_from ? `${fmtDate(x.period_from)} al ${fmtDate(x.period_to)}` : 'A cuenta'}</td>
                          <td style={{ padding: '10px 14px', color: '#94A3B8' }}>{x.note || '-'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            {!x.voided_at && (
                              <button
                                type="button"
                                onClick={() => handleVoidItem('payout', x.id, x.amount, `Pago a ${x.seller_name}`)}
                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '0.72rem', cursor: 'pointer' }}
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

      </main>
    </div>
  );
}
