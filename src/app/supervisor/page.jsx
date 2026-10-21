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
  CheckCheck,
  Plus,
  TrendingDown,
  Paperclip,
  FolderSymlink,
  UploadCloud,
  Trash2,
  Edit3,
  Settings,
  X
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
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--dv-accent-fill)',
            color: '#FFFFFF',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            boxShadow: '0 0 0 4px var(--bg-card), 0 0 0 5px var(--accent-gold)'
          }} aria-hidden="true">
            DV
          </div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 400,
            margin: '0 0 6px 0',
            color: 'var(--text-main)',
            fontFamily: 'var(--font-display)'
          }}>
            Supervisión
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
  const [selectedAliasFilter, setSelectedAliasFilter] = useState('ALL');
  const [editingNoteAlias, setEditingNoteAlias] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [attachmentTransfer, setAttachmentTransfer] = useState(null);
  const [attachmentDriveUrl, setAttachmentDriveUrl] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [copiedSuggestedName, setCopiedSuggestedName] = useState(false);
  const [driveFolderModal, setDriveFolderModal] = useState(false);
  const [driveFolderInput, setDriveFolderInput] = useState('');
  const [savingDriveFolder, setSavingDriveFolder] = useState(false);
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

  // Al cambiar la fecha o el período histórico, resetear filtros para ver todas las operaciones de la fecha
  useEffect(() => {
    setSelectedAliasFilter('ALL');
    setSelectedSellerFilter('ALL');
    setSearchQuery('');
  }, [date, period]);

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


  // Filtrado de transferencias (soporta vendedora, alias y búsqueda)
  const filteredTransfers = useMemo(() => {
    return transfersList.filter((t) => {
      const matchSeller = selectedSellerFilter === 'ALL' || t.sellerId === selectedSellerFilter;
      const matchAlias = selectedAliasFilter === 'ALL'
        || t.aliasId === selectedAliasFilter
        || (selectedAliasFilter === '__NO_ALIAS__' && !t.aliasId);
      if (!matchSeller || !matchAlias) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const matchText = (t.sellerName || '').toLowerCase().includes(q)
        || (t.aliasName || '').toLowerCase().includes(q)
        || (t.note || '').toLowerCase().includes(q)
        || String(t.amount || '').includes(q)
        || (t.date || '').includes(q);
      return matchText;
    });
  }, [transfersList, selectedSellerFilter, selectedAliasFilter, searchQuery]);

  const isToday = date === todayAR();

  // Alias relevantes para la pestaña Transferencias en el período/día seleccionado:
  // - Si es HOY (periodo día y es la fecha de hoy): mostramos los alias activos configurados (para monitorear cupos)
  //   más cualquier alias que haya recibido transferencias hoy (aunque luego se haya archivado).
  // - Si es una FECHA HISTÓRICA o período (ayer, días pasados, etc.):
  //   SOLO mostramos los alias que REALMENTE tuvieron transferencias en ese día/período.
  //   No arrastramos alias con 0 operaciones del día actual ni de otros días.
  const transferAliases = useMemo(() => {
    const aliases = data?.aliases || [];
    const archivedAliases = data?.archivedAliases || [];
    const all = [...aliases, ...archivedAliases];

    if (period === 'day' && isToday) {
      const list = [...aliases];
      archivedAliases.forEach((a) => {
        const hasOps = transfersList.some((t) => t.aliasId === a.id);
        if (hasOps && !list.some((x) => x.id === a.id)) {
          list.push(a);
        }
      });
      return list;
    }

    const map = new Map();
    all.forEach((a) => {
      if (transfersList.some((t) => t.aliasId === a.id)) {
        map.set(a.id, a);
      }
    });

    // Por si hubiera transferencias con aliasId no presente en all
    transfersList.forEach((t) => {
      if (t.aliasId && !map.has(t.aliasId)) {
        map.set(t.aliasId, {
          id: t.aliasId,
          alias: t.aliasName || 'Alias desconocido',
          dailyLimit: null,
          note: '',
          active: true,
          archived: false
        });
      }
    });

    return Array.from(map.values());
  }, [data?.aliases, data?.archivedAliases, period, isToday, transfersList]);

  const hasNoAliasTransfers = useMemo(() => {
    return transfersList.some((t) => !t.aliasId);
  }, [transfersList]);

  const noAliasCount = useMemo(() => {
    return transfersList.filter((t) => !t.aliasId).length;
  }, [transfersList]);

  const noAliasTotal = useMemo(() => {
    return transfersList.filter((t) => !t.aliasId).reduce((acc, t) => acc + (t.amount || 0), 0);
  }, [transfersList]);

  // Guardar anotación del día de un alias
  const handleSaveAliasNote = async (e, directText = null) => {
    if (e) e.preventDefault();
    if (!editingNoteAlias) return;
    setSavingNote(true);
    const targetNote = directText !== null ? directText : noteText;
    try {
      await api('/api/ventas', {
        method: 'POST',
        body: JSON.stringify({
          action: 'saveAliasNote',
          aliasId: editingNoteAlias.id,
          date,
          note: targetNote
        })
      });
      setEditingNoteAlias(null);
      setNoteText('');
      await loadData(true);
    } catch (err) {
      window.alert(err.message || 'No se pudo guardar la anotación.');
    } finally {
      setSavingNote(false);
    }
  };

  // Helpers para Google Drive
  const getGoogleDriveFileId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m1) return m1[1];
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return m2[1];
    return null;
  };

  const isGoogleDriveFolder = (url) => {
    if (!url || typeof url !== 'string') return false;
    return url.includes('/drive/folders/') || url.includes('/folders/');
  };

  // Nombre sugerido para normalizar comprobantes en Drive
  const suggestedFileName = useMemo(() => {
    if (!attachmentTransfer) return '';
    const cleanSeller = (attachmentTransfer.sellerName || 'Vendedora').trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '');
    const cleanAlias = (attachmentTransfer.aliasName || 'SinAlias').trim().replace(/[^a-zA-Z0-9]/g, '');
    const amt = Math.round(Number(attachmentTransfer.amount || 0));
    return `Comp_${attachmentTransfer.date}_${cleanAlias}_$${amt}_${cleanSeller}.jpg`;
  }, [attachmentTransfer]);

  const handleCopySuggestedName = (name) => {
    if (!name) return;
    try {
      navigator.clipboard?.writeText(name);
    } catch {}
    setCopiedSuggestedName(true);
    setTimeout(() => setCopiedSuggestedName(false), 2000);
  };

  // Abrir o configurar carpeta de Google Drive
  const handleOpenDriveFolder = () => {
    if (data?.driveFolderUrl) {
      window.open(data.driveFolderUrl, '_blank', 'noopener');
    } else {
      setDriveFolderInput('');
      setDriveFolderModal(true);
    }
  };

  // Abrir modal de configuración de Google Drive
  const handleConfigureDriveFolder = () => {
    setDriveFolderInput(data?.driveFolderUrl || '');
    setDriveFolderModal(true);
  };

  // Guardar enlace de carpeta de Google Drive
  const handleSaveDriveFolder = async (e) => {
    e?.preventDefault();
    const cleanUrl = driveFolderInput.trim();
    if (!cleanUrl) return;
    setSavingDriveFolder(true);
    try {
      await api('/api/ventas', {
        method: 'POST',
        body: JSON.stringify({
          action: 'setDriveFolderUrl',
          url: cleanUrl
        })
      });
      setDriveFolderModal(false);
      await loadData(true);
    } catch (err) {
      window.alert(err.message || 'No se pudo guardar la carpeta de Google Drive.');
    } finally {
      setSavingDriveFolder(false);
    }
  };

  // Desvincular carpeta de Google Drive
  const handleUnlinkDriveFolder = async () => {
    if (!window.confirm('¿Seguro que deseás desvincular la carpeta de Google Drive? El acceso directo se quitará del panel (no se borrará ningún archivo de tu cuenta de Google Drive).')) return;
    setSavingDriveFolder(true);
    try {
      await api('/api/ventas', {
        method: 'POST',
        body: JSON.stringify({
          action: 'setDriveFolderUrl',
          url: ''
        })
      });
      setDriveFolderModal(false);
      setDriveFolderInput('');
      await loadData(true);
    } catch (err) {
      window.alert(err.message || 'No se pudo desvincular la carpeta de Google Drive.');
    } finally {
      setSavingDriveFolder(false);
    }
  };

  // Subir archivo de comprobante a Supabase Storage y registrarlo
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !attachmentTransfer) return;
    setUploadingAttachment(true);
    try {
      const isPdf = file.type === 'application/pdf';
      const ext = file.name.split('.').pop() || (isPdf ? 'pdf' : 'jpg');
      const filePath = `transferencias/${date}/${attachmentTransfer.id}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('comprobantes')
        .upload(filePath, file, { upsert: true, contentType: file.type || 'application/octet-stream' });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(filePath);

      await api('/api/ventas', {
        method: 'POST',
        body: JSON.stringify({
          action: 'saveTransferAttachment',
          saleId: attachmentTransfer.id,
          clientRef: attachmentTransfer.clientRef,
          fileUrl: urlData.publicUrl,
          fileName: file.name,
          fileType: file.type
        })
      });

      await loadData(true);
      setAttachmentTransfer(null);
    } catch (err) {
      console.warn('Error subiendo comprobante:', err);
      window.alert('No se pudo subir el comprobante. Verificá tu conexión o intentá nuevamente.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  // Guardar URL directa de Google Drive
  const handleSaveDriveUrl = async () => {
    if (!attachmentTransfer || !attachmentDriveUrl.trim()) return;
    setUploadingAttachment(true);
    try {
      await api('/api/ventas', {
        method: 'POST',
        body: JSON.stringify({
          action: 'saveTransferAttachment',
          saleId: attachmentTransfer.id,
          clientRef: attachmentTransfer.clientRef,
          fileUrl: attachmentDriveUrl.trim(),
          fileName: 'Enlace Google Drive',
          fileType: 'link',
          driveUrl: attachmentDriveUrl.trim()
        })
      });
      setAttachmentDriveUrl('');
      await loadData(true);
      setAttachmentTransfer(null);
    } catch (err) {
      window.alert(err.message || 'No se pudo guardar el enlace.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  // Eliminar comprobante
  const handleDeleteAttachment = async () => {
    if (!attachmentTransfer) return;
    if (!window.confirm('¿Seguro que deseás eliminar este comprobante adjunto?')) return;
    setUploadingAttachment(true);
    try {
      await api('/api/ventas', {
        method: 'POST',
        body: JSON.stringify({
          action: 'deleteTransferAttachment',
          saleId: attachmentTransfer.id,
          clientRef: attachmentTransfer.clientRef
        })
      });
      await loadData(true);
      setAttachmentTransfer(null);
    } catch (err) {
      window.alert(err.message || 'No se pudo eliminar el comprobante.');
    } finally {
      setUploadingAttachment(false);
    }
  };

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
      date={date}
      aliases={data?.aliases || []}
      archivedAliases={data?.archivedAliases || []}
      post={(body) => api('/api/ventas', { method: 'POST', body: JSON.stringify({ ...body, date: body.date || date }) })}
      onChanged={() => loadData(true)}
      onClose={() => setShowAliasManager(false)}
      startAdding={showAliasManager === 'new'}
    />
  ) : null;

  const rangeLabel = !data ? '' : period === 'day' ? fmtDate(data.from) : `${fmtDate(data.from)} al ${fmtDate(data.to)}`;

  // ---- Datos derivados para el diseño
  const prevTotal = (data?.sellers || []).reduce((acc, s) => acc + (Number(s.prevTotal) || 0), 0);
  const delta = prevTotal > 0 ? Math.round(((totals.total - prevTotal) / prevTotal) * 100) : null;
  const prevLabel = data?.prev ? (period === 'day' ? fmtDate(data.prev.from) : `${fmtDate(data.prev.from)} al ${fmtDate(data.prev.to)}`) : '';
  const hourAR = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires', hour: 'numeric', hour12: false }));
  const greeting = hourAR < 12 ? 'Buen día' : hourAR < 20 ? 'Buenas tardes' : 'Buenas noches';
  const isTomorrow = date === shiftDate(todayAR(), 'day', 1);
  const bigLabel = period === 'day'
    ? (isToday ? 'Vendido hoy' : isTomorrow ? 'Planificado para mañana' : `Vendido el ${rangeLabel}`)
    : period === 'week' ? 'Vendido en la semana' : 'Vendido en el mes';
  const cashPct = totals.total > 0 ? Math.round((totals.cash / totals.total) * 100) : 0;
  const ranking = [...(data?.sellers || [])].sort((a, b) => b.total - a.total);
  const topTotal = ranking[0]?.total || 0;
  const aliases = data?.aliases || [];
  // Alias "sacados": no se usan para cobrar, pero su historial se sigue viendo
  const archivedAliases = data?.archivedAliases || [];
  const archivedWithOps = archivedAliases.filter((a) => a.countPeriod > 0);
  const restoreAlias = async (a) => {
    if (!window.confirm(`¿Volver a activar el alias ${a.alias}?`)) return;
    try {
      await api('/api/ventas', { method: 'POST', body: JSON.stringify({ action: 'restoreAlias', id: a.id, date }) });
      loadData(true);
    } catch (err) {
      window.alert(err.message || 'No se pudo restaurar.');
    }
  };
  const ringR = 46;
  const ringC = 2 * Math.PI * ringR;

  const tabs = [
    { id: 'metrics', label: 'Resumen', icon: TrendingUp },
    { id: 'aliases', label: 'Alias de cobro', icon: Wallet, count: aliases.length },
    { id: 'transfers', label: 'Transferencias', icon: Landmark, count: transfersList.length },
    { id: 'sellers', label: 'Vendedoras', icon: Users },
    { id: 'history', label: 'Movimientos', icon: Receipt }
  ];

  const AliasCards = () => (
    aliases.length === 0 ? (
      <div className="sv-empty">Todavía no hay alias de cobro. Tocá <b>+ Agregar alias</b>.</div>
    ) : (
      <div className="sv-alias-grid">
        {aliases.map((a, idx) => {
          const rem = aliasLeft(a);
          const pct = a.dailyLimit ? Math.round(((a.receivedToday || 0) / a.dailyLimit) * 100) : null;
          const full = a.dailyLimit ? (a.receivedToday || 0) >= a.dailyLimit : false;
          const near = !full && pct !== null && pct >= 80;
          const tone = !a.active ? 'off' : full ? 'bad' : near ? 'warn' : 'ok';
          return (
            <div key={a.id} className={`sv-alias sv-alias--${tone}`}>
              <div className="sv-alias-top">
                <span className="sv-label">{idx + 1} · {!a.active ? 'Pausado' : full ? '🚨 Tope superado (habilitado)' : near ? 'Casi lleno' : 'Activo'}</span>
                <button type="button" className="sv-ghost" onClick={() => copyAliasToClipboard(a.alias)} title="Copiar alias">
                  {copiedAlias === a.alias ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
              <div className="sv-alias-name">{a.alias}</div>
              <div className="sv-alias-sub">{[a.holder, a.bank].filter(Boolean).join(' · ') || 'Sin titular'}</div>
              <div className="sv-alias-rules">{aliasRules(a)}</div>
              {a.description && <div className="sv-alias-desc">“{a.description}”</div>}

              {/* Anotación del día */}
              <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '10px', backgroundColor: a.note ? '#FEF3C7' : 'var(--sv-soft)', border: a.note ? '1px solid #FCD34D' : '1px dashed var(--sv-line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: a.note ? '#92400E' : 'var(--sv-mute)' }}>
                    📝 Anotación del {fmtDate(date)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setEditingNoteAlias(a); setNoteText(a.note || ''); }}
                    className="sv-ghost"
                    style={{ padding: '2px', color: a.note ? '#92400E' : 'var(--sv-mute)' }}
                    title="Editar anotación del día"
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
                {a.note ? (
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400E', marginTop: '3px' }}>
                    “{a.note}”
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingNoteAlias(a); setNoteText(''); }}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.74rem', color: 'var(--sv-mute)', cursor: 'pointer', textAlign: 'left', marginTop: '2px', fontStyle: 'italic' }}
                  >
                    + Agregar anotación para hoy
                  </button>
                )}
              </div>

              <div className="sv-alias-foot">
                <span className="sv-num">{money(a.receivedToday)}</span>
                <span className="sv-alias-left">{rem !== null ? (full ? `🚨 Superado (${money(a.receivedToday - a.dailyLimit)})` : `quedan ${money(rem)}`) : 'sin tope'}</span>
              </div>
              {a.dailyLimit ? <div className="sv-meter"><span style={{ width: `${Math.min(100, pct)}%` }} className={full ? 'bad' : near ? 'warn' : ''} /></div> : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <span className="sv-alias-count">{a.countToday} transferencias el {fmtDate(date)}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedAliasFilter(a.id); setActiveTab('transfers'); }}
                  className="sv-btn"
                  style={{ height: '26px', padding: '0 9px', fontSize: '0.72rem' }}
                  title="Ver transferencias de este alias"
                >
                  <Landmark size={12} /> Ver historial
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )
  );

  return (
    <div className="sv">
      <style>{SV_CSS}</style>

      {/* ---------------- Barra superior ---------------- */}
      <header className="sv-top">
        <div className="sv-wrap sv-topin">
          <div className="sv-brand">
            <div className="sv-seal" aria-hidden="true">DV</div>
            <div>
              <h1>Supervisión</h1>
              <small>Dulce Valentín · panel de Micaela</small>
            </div>
          </div>
          <div className="sv-tools">
            <button type="button" onClick={() => setPrivacyMode(!privacyMode)} className={`sv-btn sv-icon ${privacyMode ? 'sv-btn--on' : ''}`} title={privacyMode ? 'Mostrar cifras' : 'Ocultar cifras si hay alguien mirando'}>
              {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button type="button" onClick={() => { setActiveTab('aliases'); setShowAliasManager('new'); }} className="sv-btn sv-btn--mag" title="Agregar un alias de cobro">
              <Plus size={15} /><span>Alias</span>
            </button>
            <button type="button" onClick={handleExportExcel} disabled={exportingExcel || !data} className="sv-btn" title="Descargar Excel">
              {exportingExcel ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}<span>Excel</span>
            </button>
            <button type="button" onClick={handleSendWhatsApp} disabled={!data} className="sv-btn sv-btn--wa" title="Mandar resumen por WhatsApp">
              <Send size={14} /><span>WhatsApp</span>
            </button>
            <a href="/ventas" target="_blank" rel="noopener noreferrer" className="sv-btn" title="Abrir el mostrador en otra pestaña">
              <ShoppingBag size={15} /><span>Mostrador</span>
            </a>
            <button type="button" onClick={handleLogout} className="sv-btn sv-icon" title="Salir">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="sv-wrap">
        {/* ---------------- Período ---------------- */}
        <div className="sv-period">
          <div className="sv-seg" role="tablist" aria-label="Período">
            {Object.entries(PERIODS).map(([id, label]) => (
              <button key={id} type="button" className={period === id ? 'on' : ''} onClick={() => setPeriod(id)}>{label}</button>
            ))}
          </div>
          <div className="sv-date">
            <button type="button" className="sv-btn sv-icon" onClick={() => setDate(shiftDate(date, period, -1))} aria-label="Anterior"><ChevronLeft size={16} /></button>
            <input type="date" value={date} max={shiftDate(todayAR(), 'day', 1)} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <button type="button" className="sv-btn sv-icon" onClick={() => setDate(shiftDate(date, period, 1))} disabled={date >= shiftDate(todayAR(), 'day', 1)} aria-label="Siguiente"><ChevronRight size={16} /></button>
            {!isToday && <button type="button" className="sv-btn" onClick={() => setDate(todayAR())}>Hoy</button>}
            <button type="button" className="sv-btn sv-icon" onClick={() => loadData()} disabled={loading} title="Actualizar"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </div>

        {loadError && <div role="alert" className="sv-alert">{loadError}</div>}

        {/* ---------------- Solapas ---------------- */}
        <nav className="sv-tabs" aria-label="Secciones">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button key={id} type="button" className={`sv-tab ${activeTab === id ? 'on' : ''}`} onClick={() => setActiveTab(id)}>
              <Icon size={15} /> {label}{count !== undefined && <span className="sv-count">{count}</span>}
            </button>
          ))}
          <span className="sv-live" title={live ? 'Se actualiza solo con cada venta, vale, pago o cambio de alias' : 'Reconectando… igual se actualiza cada 30 segundos'}>
            <i className={live ? 'sv-pulse' : 'sv-pulse sv-pulse--off'} /> {live ? 'En vivo' : 'Conectando'}
            {lastUpdate && <em>{lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</em>}
          </span>
        </nav>

        {/* ==================== RESUMEN ==================== */}
        {activeTab === 'metrics' && (
          <>
            <section className="sv-hero">
              <div className="sv-panel sv-hero-main">
                <p className="sv-greet">{greeting}, Mica</p>
                <span className="sv-label">{bigLabel}</span>
                <div className="sv-big sv-num">{money(totals.total)}</div>
                <div className="sv-hero-line">
                  {delta !== null && (
                    <span className={`sv-delta ${delta >= 0 ? 'sv-delta--up' : 'sv-delta--down'}`}>
                      {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {delta >= 0 ? '+' : ''}{delta}%
                    </span>
                  )}
                  {prevLabel && <span className="sv-muted">vs {prevLabel} ({money(prevTotal)})</span>}
                </div>
                <div className="sv-meta">
                  <span><b>{totals.salesCount}</b> ventas</span>
                  <span>Ticket promedio <b>{money(totals.salesCount > 0 ? Math.round(totals.total / totals.salesCount) : 0)}</b></span>
                  <span>{rangeLabel}</span>
                </div>
                <div className="sv-split">
                  <div className="sv-bar">
                    <span style={{ width: `${cashPct}%`, background: 'var(--sv-cash)' }} />
                    <span style={{ width: `${totals.total > 0 ? 100 - cashPct : 0}%`, background: 'var(--sv-sky)' }} />
                  </div>
                  <div className="sv-legend">
                    <span><i className="sv-dot" style={{ background: 'var(--sv-cash)' }} />Efectivo <b>{money(totals.cash)}</b> · {cashPct}%</span>
                    <span><i className="sv-dot" style={{ background: 'var(--sv-sky)' }} />Transferencia <b>{money(totals.transfer)}</b> · {totals.total > 0 ? 100 - cashPct : 0}%</span>
                  </div>
                </div>
              </div>

              <div className="sv-panel sv-margin">
                <div>
                  <span className="sv-label sv-label--light">Queda para el local</span>
                  <div className="sv-num sv-margin-num">{money(netMargin)}</div>
                  <p className="sv-margin-sub">Ventas menos comisiones de las vendedoras ({money(totals.commission)}).</p>
                </div>
                <div className="sv-ring">
                  <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
                    <circle cx="60" cy="60" r={ringR} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
                    <circle cx="60" cy="60" r={ringR} fill="none" stroke="url(#svRing)" strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={ringC} strokeDashoffset={ringC * (1 - Math.min(100, Math.max(0, marginRetentionPct)) / 100)} transform="rotate(-90 60 60)" />
                    <defs>
                      <linearGradient id="svRing" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#EC6FA6" /><stop offset="100%" stopColor="#5FC1E8" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="sv-ring-label"><span className="sv-num">{privacyMode ? '••' : `${marginRetentionPct}%`}</span><small>retenido</small></div>
                </div>
              </div>
            </section>

            {/* Libro: comisiones, vales, pagos y saldo */}
            <section className="sv-ledger" aria-label="Comisiones y saldos">
              <div><span className="sv-label">Comisiones</span><span className="sv-num">{money(totals.commission)}</span><small>generadas en el período</small></div>
              <div><span className="sv-label">Vales</span><span className="sv-num sv-c-bad">{money(totals.advances)}</span><small>adelantos entregados</small></div>
              <div><span className="sv-label">Pagado</span><span className="sv-num sv-c-sky">{money(totals.paid)}</span><small>liquidaciones</small></div>
              <div><span className="sv-label">Saldo a pagar</span><span className={`sv-num ${totals.balance > 0 ? 'sv-c-warn' : 'sv-c-ok'}`}>{money(totals.balance)}</span><small>{totals.balance > 0 ? 'se les debe a las vendedoras' : 'sin deuda pendiente'}</small></div>
            </section>

            <section className="sv-grid2">
              <div className="sv-panel">
                <div className="sv-h"><h3>Quién vendió</h3><button type="button" className="sv-link" onClick={() => setActiveTab('sellers')}>Ver todas <ArrowUpRight size={13} /></button></div>
                {ranking.filter((s) => s.total > 0).length === 0 ? (
                  <div className="sv-empty">Todavía no hay ventas en el período.</div>
                ) : (
                  <div className="sv-rank">
                    {ranking.filter((s) => s.total > 0).slice(0, 6).map((s, idx) => (
                      <div key={s.id} className="sv-row">
                        <span className="sv-av" style={{ background: AV_COLORS[idx % AV_COLORS.length] }}>{initials(s.name)}</span>
                        <div>
                          <div className="sv-row-name">{s.name} <span className="sv-muted">· {s.salesCount} venta{s.salesCount === 1 ? '' : 's'} · {s.pct}%</span></div>
                          <div className="sv-track"><span style={{ width: `${topTotal > 0 ? Math.max(4, Math.round((s.total / topTotal) * 100)) : 0}%` }} /></div>
                        </div>
                        <div className="sv-row-amt"><span className="sv-num">{money(s.total)}</span><small>comisión {money(s.commission)}</small></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="sv-stack">
                {period === 'day' && data?.cash && (
                  <div className="sv-panel">
                    <div className="sv-h"><h3>Caja del día</h3><PiggyBank size={18} className="sv-muted" /></div>
                    <span className="sv-label">Efectivo que tiene que haber</span>
                    <div className="sv-num sv-mid">{money(data.cash.expected)}</div>
                    <p className="sv-muted sv-small">Ventas en efectivo menos vales y pagos en efectivo (sin el fondo inicial).</p>
                    {data.cash.lastCount ? (
                      <div className={`sv-pill ${Number(data.cash.lastCount.difference) === 0 ? 'sv-pill--ok' : 'sv-pill--bad'}`}>
                        {Number(data.cash.lastCount.difference) === 0
                          ? 'El arqueo cerró justo'
                          : Number(data.cash.lastCount.difference) > 0
                            ? `Sobran ${money(data.cash.lastCount.difference)}`
                            : `Faltan ${money(-data.cash.lastCount.difference)}`}
                        <small> · contado {money(data.cash.lastCount.counted)} a las {hour(data.cash.lastCount.created_at)}</small>
                      </div>
                    ) : (
                      <div className="sv-pill">Todavía no se hizo el arqueo</div>
                    )}
                  </div>
                )}
                <div className="sv-panel">
                  <div className="sv-h"><h3>Alias hoy</h3><button type="button" className="sv-link" onClick={() => setActiveTab('aliases')}>Administrar <ArrowUpRight size={13} /></button></div>
                  {aliases.length === 0 ? (
                    <div className="sv-empty">Sin alias cargados.</div>
                  ) : (
                    <div className="sv-mini-alias">
                      {aliases.filter((a) => a.active).slice(0, 5).map((a) => {
                        const pct = a.dailyLimit ? Math.min(100, Math.round(((a.receivedToday || 0) / a.dailyLimit) * 100)) : null;
                        return (
                          <div key={a.id}>
                            <div className="sv-mini-row"><code>{a.alias}</code><span className="sv-num">{money(a.receivedToday)}</span></div>
                            {pct !== null && <div className="sv-meter sv-meter--thin"><span style={{ width: `${pct}%` }} className={pct >= 100 ? 'bad' : pct >= 80 ? 'warn' : ''} /></div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ==================== ALIAS DE COBRO ==================== */}
        {activeTab === 'aliases' && (
          <section className="sv-panel">
            <div className="sv-h sv-h--wrap">
              <div>
                <h3>Alias de cobro</h3>
                <p className="sv-muted sv-small">Lo recibido el {fmtDate(date)}. Al cobrar, el mostrador sugiere el primero de la lista que acepta el monto.</p>
              </div>
              <div className="sv-tools">
                <button type="button" className="sv-btn sv-btn--mag" onClick={() => setShowAliasManager('new')}><Plus size={15} /> Agregar alias</button>
                <button type="button" className="sv-btn" onClick={() => setShowAliasManager('edit')}>Editar · pausar · ordenar</button>
              </div>
            </div>
            <AliasCards />

            {archivedAliases.length > 0 && (
              <div className="sv-archived">
                <div className="sv-mov-h"><span className="sv-label">Alias archivados</span><span className="sv-count">{archivedAliases.length}</span></div>
                <p className="sv-muted sv-small">No aparecen en el mostrador, pero sus transferencias quedan guardadas para siempre y se ven en Transferencias.</p>
                <div className="sv-archived-list">
                  {archivedAliases.map((a) => (
                    <div key={a.id} className="sv-archived-row">
                      <div>
                        <code>{a.alias}</code> <span className="sv-muted">· {[a.holder, a.bank].filter(Boolean).join(' · ') || 'Sin titular'}</span>
                        <small className="sv-block sv-muted">{a.countPeriod} transferencia{a.countPeriod === 1 ? '' : 's'} en el período · {money(a.receivedPeriod)}</small>
                      </div>
                      <div className="sv-tools">
                        {a.countPeriod > 0 && <button type="button" className="sv-btn" onClick={() => { setSelectedAliasFilter(a.id); setActiveTab('transfers'); }}>Ver transferencias</button>}
                        <button type="button" className="sv-btn" onClick={() => restoreAlias(a)}>Restaurar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ==================== TRANSFERENCIAS ==================== */}
        {activeTab === 'transfers' && (
          <section className="sv-panel sv-panel--flush">
            <div className="sv-h sv-h--pad">
              <div>
                <h3>Transferencias</h3>
                <p className="sv-muted sv-small">{rangeLabel} · {filteredTransfers.length} de {transfersList.length} · total <b>{money(filteredTransfers.reduce((a, b) => a + (b.amount || 0), 0))}</b></p>
              </div>
              <div className="sv-filter">
                <div className="sv-search"><Search size={15} /><input type="text" placeholder="Buscar alias, vendedora o monto" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
                
                {/* Filtro por vendedora */}
                <select className="sv-input" value={selectedSellerFilter} onChange={(e) => setSelectedSellerFilter(e.target.value)}>
                  <option value="ALL">Todas las vendedoras</option>
                  {(data?.sellers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                {/* Filtro por alias */}
                <select className="sv-input" value={selectedAliasFilter} onChange={(e) => setSelectedAliasFilter(e.target.value)}>
                  <option value="ALL">Todos los alias ({transfersList.length})</option>
                  {transferAliases.map((a) => {
                    const ops = transfersList.filter((t) => t.aliasId === a.id);
                    const totalOps = ops.reduce((acc, t) => acc + (t.amount || 0), 0);
                    const isOver = a.dailyLimit && totalOps >= a.dailyLimit;
                    return (
                      <option key={a.id} value={a.id}>
                        {a.alias} ({ops.length} ops · {money(totalOps)}){isOver ? ' 🚨' : ''}
                      </option>
                    );
                  })}
                  {hasNoAliasTransfers && (
                    <option value="__NO_ALIAS__">Sin alias asignado ({noAliasCount} ops · {money(noAliasTotal)})</option>
                  )}
                </select>

                {/* Botón y Configuración de Google Drive */}
                <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '12px', border: '1px solid var(--sv-line)', background: 'var(--sv-card)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={handleOpenDriveFolder}
                    className="sv-btn"
                    style={{ border: 'none', borderRadius: 0, height: '34px', padding: '0 11px', gap: '7px' }}
                    title={data?.driveFolderUrl ? `Abrir carpeta oficial de comprobantes en Google Drive (${data.driveFolderUrl})` : 'Vincular carpeta oficial de Google Drive'}
                  >
                    <FolderSymlink size={15} style={{ color: data?.driveFolderUrl ? '#2563EB' : 'var(--sv-mute)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Google Drive</span>
                    {data?.driveFolderUrl ? (
                      <span
                        style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block', boxShadow: '0 0 6px rgba(16,185,129,0.7)' }}
                        title="Carpeta de Google Drive vinculada"
                      />
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: 'var(--sv-mute)', fontWeight: 600 }}>(Sin vincular)</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfigureDriveFolder}
                    className="sv-btn"
                    style={{ border: 'none', borderLeft: '1px solid var(--sv-line)', borderRadius: 0, height: '34px', padding: '0 9px', color: 'var(--sv-mute)' }}
                    title="Configurar / Cambiar carpeta de Google Drive"
                  >
                    <Settings size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Barra interactiva de Alias del Día / Período */}
            {(transferAliases.length > 0 || hasNoAliasTransfers) && (
              <div className="sv-alias-bar">
                <div className="sv-alias-bar-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wallet size={15} style={{ color: 'var(--sv-magt)' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {period === 'day' ? `Alias del día ${fmtDate(date)}` : period === 'week' ? 'Alias de la semana' : 'Alias del mes'}
                    </span>
                    <span className="sv-count">{transferAliases.length + (hasNoAliasTransfers ? 1 : 0)}</span>
                  </div>
                  {selectedAliasFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedAliasFilter('ALL')}
                      className="sv-btn"
                      style={{ height: '26px', padding: '0 9px', fontSize: '0.72rem' }}
                    >
                      <X size={12} /> Ver todos ({transfersList.length})
                    </button>
                  )}
                </div>
                <div className="sv-alias-pills">
                  <button
                    type="button"
                    className={`sv-alias-pill ${selectedAliasFilter === 'ALL' ? 'on' : ''}`}
                    onClick={() => setSelectedAliasFilter('ALL')}
                  >
                    <div className="sv-alias-pill-top">
                      <span className="sv-alias-pill-title">Todos</span>
                      <span className="sv-alias-pill-count">{transfersList.length} ops</span>
                    </div>
                    <div className="sv-alias-pill-amt">{money(transfersList.reduce((acc, t) => acc + (t.amount || 0), 0))}</div>
                    <div className="sv-alias-pill-foot">
                      <span>Total transferencias</span>
                    </div>
                  </button>

                  {transferAliases.map((a) => {
                    const ops = transfersList.filter((t) => t.aliasId === a.id);
                    const totalOps = ops.reduce((acc, t) => acc + (t.amount || 0), 0);
                    const isOver = a.dailyLimit && totalOps >= a.dailyLimit;
                    const isSelected = selectedAliasFilter === a.id;
                    const showArchivedBadge = isToday && a.archived;
                    const showPauseBadge = isToday && !a.active && !a.archived;
                    const isOff = isToday && !a.active;

                    return (
                      <div
                        key={a.id}
                        className={`sv-alias-pill ${isSelected ? 'on' : ''} ${isOver ? 'sv-alias-pill--bad' : ''} ${isOff ? 'sv-alias-pill--off' : ''}`}
                        onClick={() => setSelectedAliasFilter(isSelected ? 'ALL' : a.id)}
                      >
                        <div className="sv-alias-pill-top">
                          <span className="sv-alias-pill-title">
                            {a.alias}
                            {isOver && <span className="sv-pill-tag">🚨 Tope</span>}
                            {showArchivedBadge && <span className="sv-pill-tag-gray">Archivado</span>}
                            {showPauseBadge && <span className="sv-pill-tag-gray">Pausa</span>}
                          </span>
                          <span className="sv-alias-pill-count">{ops.length} ops</span>
                        </div>
                        <div className="sv-alias-pill-amt">{money(totalOps)}</div>
                        <div className="sv-alias-pill-foot">
                          <span>{a.dailyLimit ? `tope ${money(a.dailyLimit)}` : 'sin tope'}</span>
                          <button
                            type="button"
                            className="sv-pill-note-btn"
                            title={a.note ? `Nota: “${a.note}”` : 'Agregar anotación'}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNoteAlias(a);
                              setNoteText(a.note || '');
                            }}
                          >
                            <Edit3 size={11} /> {a.note ? 'Nota ✓' : '+ Nota'}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {hasNoAliasTransfers && (
                    <div
                      className={`sv-alias-pill ${selectedAliasFilter === '__NO_ALIAS__' ? 'on' : ''}`}
                      onClick={() => setSelectedAliasFilter(selectedAliasFilter === '__NO_ALIAS__' ? 'ALL' : '__NO_ALIAS__')}
                    >
                      <div className="sv-alias-pill-top">
                        <span className="sv-alias-pill-title">Sin alias</span>
                        <span className="sv-alias-pill-count">{noAliasCount} ops</span>
                      </div>
                      <div className="sv-alias-pill-amt">{money(noAliasTotal)}</div>
                      <div className="sv-alias-pill-foot">
                        <span>Sin alias asignado</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="sv-tablewrap">
              <table className="sv-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Monto</th>
                    <th>Vendedora</th>
                    <th>Alias</th>
                    <th>Nota</th>
                    <th>Comprobante</th>
                    <th className="r" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTransfers.length === 0 ? (
                    <tr><td colSpan={7} className="sv-empty-cell">No hay transferencias para mostrar.</td></tr>
                  ) : filteredTransfers.map((t) => {
                    const aliasInfo = (data.supervisorData?.aliasByDate && data.supervisorData.aliasByDate[t.date]) || data.dailyAlias || {};
                    const hasAtt = Boolean(t.attachment);
                    return (
                      <tr key={t.id}>
                        <td><b>{t.createdAt ? hour(t.createdAt) : '--:--'}</b><small className="sv-block sv-muted">{fmtDate(t.date)}</small></td>
                        <td><span className="sv-num sv-amt">{money(t.amount)}</span></td>
                        <td>{t.sellerName}</td>
                        <td>
                          <span
                            className="sv-chip"
                            style={{ cursor: t.aliasId ? 'pointer' : 'default' }}
                            onClick={() => { if (t.aliasId) setSelectedAliasFilter(t.aliasId); }}
                            title={t.aliasId ? 'Filtrar por este alias' : ''}
                          >
                            {t.aliasName || (t.aliasId ? 'Alias archivado' : aliasInfo.alias || 'Sin alias')}
                          </span>
                        </td>
                        <td className="sv-muted">{t.note || '—'}</td>
                        <td>
                          {hasAtt ? (
                            <button
                              type="button"
                              onClick={() => setAttachmentTransfer(t)}
                              className="sv-attach-badge"
                              title="Ver / gestionar comprobante"
                            >
                              <Paperclip size={13} />
                              <span>{t.attachment.fileName || (t.attachment.driveUrl ? 'Google Drive' : 'Comprobante')}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAttachmentTransfer(t);
                                setAttachmentDriveUrl('');
                              }}
                              className="sv-btn-attach"
                              title="Adjuntar archivo o link de Google Drive"
                            >
                              <Paperclip size={12} />
                              <span>Adjuntar</span>
                            </button>
                          )}
                        </td>
                        <td className="r"><button type="button" className="sv-void" onClick={() => handleVoidItem('sale', t.id, t.amount, `Transferencia de ${t.sellerName}`)}>Anular</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==================== VENDEDORAS ==================== */}
        {activeTab === 'sellers' && (
          <>
            {ranking.filter((s) => s.total > 0).length > 0 && (
              <section className="sv-podium">
                {ranking.filter((s) => s.total > 0).slice(0, 3).map((s, idx) => (
                  <div key={s.id} className={`sv-panel sv-pod ${idx === 0 ? 'sv-pod--first' : ''}`}>
                    <span className="sv-pod-place">{idx + 1}°</span>
                    <span className="sv-av sv-av--lg" style={{ background: AV_COLORS[idx % AV_COLORS.length] }}>{initials(s.name)}</span>
                    <div className="sv-pod-name">{s.name}</div>
                    <div className="sv-num sv-pod-amt">{money(s.total)}</div>
                    <small>{s.salesCount} venta{s.salesCount === 1 ? '' : 's'} · comisión {money(s.commission)}</small>
                  </div>
                ))}
              </section>
            )}
            <section className="sv-panel sv-panel--flush">
              <div className="sv-h sv-h--pad">
                <div>
                  <h3>Comisiones y saldos</h3>
                  <p className="sv-muted sv-small">Saldo = comisiones − vales − pagos, acumulado hasta el cierre del período.</p>
                </div>
              </div>
              <div className="sv-tablewrap">
                <table className="sv-table">
                  <thead><tr><th>Vendedora</th><th className="r">Vendido</th><th className="r">Efectivo</th><th className="r">Transf.</th><th className="r">%</th><th className="r">Comisión</th><th className="r">Vales</th><th className="r">Pagado</th><th className="r">Saldo</th></tr></thead>
                  <tbody>
                    {ranking.map((s, idx) => (
                      <tr key={s.id} className={s.total === 0 && s.balance === 0 ? 'dim' : ''}>
                        <td><span className="sv-who"><span className="sv-av sv-av--sm" style={{ background: AV_COLORS[idx % AV_COLORS.length] }}>{initials(s.name)}</span>{s.name}</span></td>
                        <td className="r"><span className="sv-num sv-amt">{money(s.total)}</span></td>
                        <td className="r sv-muted">{money(s.cash)}</td>
                        <td className="r sv-muted">{money(s.transfer)}</td>
                        <td className="r">{s.pct}%</td>
                        <td className="r">{money(s.commission)}</td>
                        <td className="r sv-c-bad">{s.advances ? `− ${money(s.advances)}` : '—'}</td>
                        <td className="r sv-c-sky">{s.paid ? `− ${money(s.paid)}` : '—'}</td>
                        <td className="r"><b className={s.balance > 0 ? 'sv-c-warn' : s.balance < 0 ? 'sv-c-bad' : 'sv-c-ok'}>{money(s.balance)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* ==================== MOVIMIENTOS ==================== */}
        {activeTab === 'history' && (
          <section className="sv-panel">
            <div className="sv-h sv-h--wrap">
              <div>
                <h3>Movimientos del período</h3>
                <p className="sv-muted sv-small">Nada se borra: lo anulado queda tachado con su motivo.</p>
              </div>
            </div>
            {[
              { key: 'sales', title: 'Ventas', kind: 'sale', dateKey: 'sale_date', tone: '' , label: (x) => `Venta de ${x.seller_name}` },
              { key: 'advances', title: 'Vales', kind: 'advance', dateKey: 'advance_date', tone: 'sv-c-bad', label: (x) => `Vale de ${x.seller_name}` },
              { key: 'payouts', title: 'Pagos a vendedoras', kind: 'payout', dateKey: 'paid_date', tone: 'sv-c-sky', label: (x) => `Pago a ${x.seller_name}` }
            ].map((sec) => {
              const rows = data?.supervisorData?.[sec.key] || [];
              return (
                <div key={sec.key} className="sv-mov">
                  <div className="sv-mov-h"><span className="sv-label">{sec.title}</span><span className="sv-count">{rows.length}</span></div>
                  {rows.length === 0 ? <div className="sv-empty">Sin {sec.title.toLowerCase()} en el período.</div> : (
                    <div className="sv-scroll">
                      <table className="sv-table">
                        <thead><tr><th>Fecha</th><th>Vendedora</th><th className="r">Monto</th><th>{sec.kind === 'payout' ? 'Período' : 'Medio'}</th><th>Nota</th><th className="r" /></tr></thead>
                        <tbody>
                          {rows.map((x) => (
                            <tr key={x.id} className={x.voided_at ? 'void' : ''}>
                              <td><b>{hour(x.created_at)}</b> <span className="sv-muted">{fmtDate(x[sec.dateKey])}</span></td>
                              <td>{x.seller_name}</td>
                              <td className="r"><span className={`sv-num sv-amt ${sec.tone}`}>{money(x.amount)}</span></td>
                              <td className="sv-muted">{sec.kind === 'payout' ? (x.period_from ? `${fmtDate(x.period_from)} al ${fmtDate(x.period_to)}` : 'A cuenta') : (x.payment_method === 'transferencia' ? 'Transferencia' : 'Efectivo')}</td>
                              <td className="sv-muted">{x.voided_at ? `Anulado: ${x.void_reason || ''}` : (x.note || '—')}</td>
                              <td className="r">{!x.voided_at && <button type="button" className="sv-void" onClick={() => handleVoidItem(sec.kind, x.id, x.amount, sec.label(x))}>Anular</button>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {aliasModal}

        {/* Modal de Anotación del Día */}
        {editingNoteAlias && (
          <div className="sv-modal-overlay" onClick={() => setEditingNoteAlias(null)}>
            <div className="sv-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-head">
                <div>
                  <h4>Anotación del día</h4>
                  <small className="sv-muted">Alias: <b>{editingNoteAlias.alias}</b> · {fmtDate(date)}</small>
                </div>
                <button type="button" className="sv-ghost" onClick={() => setEditingNoteAlias(null)}><X size={18} /></button>
              </div>
              <form onSubmit={handleSaveAliasNote}>
                <p className="sv-small sv-muted" style={{ marginBottom: '10px' }}>
                  Esta nota se muestra al mostrador al cobrar, en los informes diarios de Mica y en el Excel.
                </p>
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="ej: Tope alcanzado a las 14hs / Solo transferencias grandes / En revisión"
                  className="form-input"
                  style={{ width: '100%', borderRadius: '12px', padding: '10px 12px', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  {editingNoteAlias.note ? (
                    <button
                      type="button"
                      onClick={() => handleSaveAliasNote(null, '')}
                      disabled={savingNote}
                      className="sv-void"
                    >
                      Borrar nota
                    </button>
                  ) : <div />}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => setEditingNoteAlias(null)} className="sv-btn">Cancelar</button>
                    <button type="submit" disabled={savingNote} className="sv-btn sv-btn--mag">
                      {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar nota
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Comprobante / Google Drive */}
        {attachmentTransfer && (
          <div className="sv-modal-overlay" onClick={() => setAttachmentTransfer(null)}>
            <div className="sv-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-head">
                <div>
                  <h4>Comprobante de Transferencia</h4>
                  <small className="sv-muted">{money(attachmentTransfer.amount)} · {attachmentTransfer.sellerName} · {fmtDate(attachmentTransfer.date)}</small>
                </div>
                <button type="button" className="sv-ghost" onClick={() => setAttachmentTransfer(null)}><X size={18} /></button>
              </div>

              {attachmentTransfer.attachment ? (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ padding: '14px', backgroundColor: 'var(--sv-soft)', borderRadius: '14px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <Paperclip size={16} className="sv-c-sky" />
                        <b style={{ fontSize: '0.88rem', wordBreak: 'break-all' }}>{attachmentTransfer.attachment.fileName || 'Comprobante adjunto'}</b>
                      </div>
                      {attachmentTransfer.attachment.uploadedAt && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--sv-mute)' }}>
                          {new Date(attachmentTransfer.attachment.uploadedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* Previsualización si es imagen subida a Supabase */}
                    {attachmentTransfer.attachment.url && !attachmentTransfer.attachment.driveUrl && (attachmentTransfer.attachment.url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || (attachmentTransfer.attachment.fileType && attachmentTransfer.attachment.fileType.startsWith('image/'))) && (
                      <div style={{ textAlign: 'center', maxHeight: '280px', overflow: 'hidden', borderRadius: '10px', marginTop: '8px', backgroundColor: '#000' }}>
                        <img src={attachmentTransfer.attachment.url} alt="Comprobante" style={{ maxHeight: '280px', maxWidth: '100%', objectFit: 'contain' }} />
                      </div>
                    )}

                    {/* Previsualización si es enlace de Google Drive */}
                    {attachmentTransfer.attachment.driveUrl && (() => {
                      const fileId = getGoogleDriveFileId(attachmentTransfer.attachment.driveUrl);
                      return (
                        <div style={{ borderRadius: '12px', overflow: 'hidden', marginTop: '10px', border: '1px solid var(--sv-line)', backgroundColor: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.06)', fontSize: '0.74rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#93c5fd', fontWeight: 700 }}>
                              <FolderSymlink size={13} /> Vista previa de Google Drive
                            </span>
                            <a
                              href={attachmentTransfer.attachment.driveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#fff', fontWeight: 700, fontSize: '0.72rem', textDecoration: 'underline' }}
                            >
                              Pantalla completa ↗
                            </a>
                          </div>
                          {fileId ? (
                            <iframe
                              src={`https://drive.google.com/file/d/${fileId}/preview`}
                              style={{ width: '100%', height: '280px', border: 'none', display: 'block', backgroundColor: '#1e293b' }}
                              allow="autoplay"
                              title="Vista previa del comprobante"
                            />
                          ) : (
                            <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                              Este enlace abre una carpeta o recurso externo en Google Drive.
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                      {attachmentTransfer.attachment.url && !attachmentTransfer.attachment.driveUrl && (
                        <a
                          href={attachmentTransfer.attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sv-btn sv-btn--mag"
                          style={{ fontSize: '0.8rem', height: '32px' }}
                        >
                          <ExternalLink size={13} /> Abrir comprobante
                        </a>
                      )}
                      {attachmentTransfer.attachment.driveUrl && (
                        <a
                          href={attachmentTransfer.attachment.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sv-btn"
                          style={{ fontSize: '0.8rem', height: '32px' }}
                        >
                          <FolderSymlink size={13} style={{ color: '#2563EB' }} /> Abrir en Google Drive
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={handleDeleteAttachment}
                        disabled={uploadingAttachment}
                        className="sv-void"
                        style={{ fontSize: '0.8rem', height: '32px' }}
                      >
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--sv-line)', paddingTop: '12px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--sv-mute)', display: 'block', marginBottom: '8px' }}>
                      Reemplazar o cambiar comprobante
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <label className="sv-btn" style={{ cursor: 'pointer', fontSize: '0.8rem', height: '34px' }}>
                        <UploadCloud size={14} /> <span>Subir otro archivo</span>
                        <input type="file" onChange={handleFileUpload} disabled={uploadingAttachment} style={{ display: 'none' }} />
                      </label>
                      {data?.driveFolderUrl && (
                        <a href={data.driveFolderUrl} target="_blank" rel="noopener noreferrer" className="sv-btn" style={{ fontSize: '0.8rem', height: '34px' }}>
                          <FolderSymlink size={14} style={{ color: '#2563EB' }} /> Abrir carpeta Drive
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '12px' }}>
                  {/* Sugerencia de nombre para guardar y organizar en Drive */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--sv-soft)', border: '1px dashed var(--sv-line)', borderRadius: '12px', padding: '9px 12px', marginBottom: '14px', gap: '8px' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.76rem' }}>
                      <span style={{ color: 'var(--sv-mute)', fontWeight: 600 }}>Nombre sugerido: </span>
                      <code style={{ fontWeight: 800, color: 'var(--sv-magt)' }}>{suggestedFileName}</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopySuggestedName(suggestedFileName)}
                      className="sv-btn"
                      style={{ height: '26px', padding: '0 8px', fontSize: '0.72rem', flexShrink: 0 }}
                      title="Copiar nombre sugerido para guardar el archivo"
                    >
                      {copiedSuggestedName ? <Check size={12} style={{ color: '#10B981' }} /> : <Copy size={12} />}
                      <span>{copiedSuggestedName ? '¡Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>

                  <p className="sv-small sv-muted" style={{ marginBottom: '14px' }}>
                    Adjuntá el comprobante de transferencia en cualquier formato (foto, imagen, PDF) o vinculá el link de Google Drive.
                  </p>

                  <div style={{ border: '2px dashed var(--sv-line)', borderRadius: '16px', padding: '24px 16px', textAlign: 'center', backgroundColor: 'var(--sv-soft)' }}>
                    <UploadCloud size={32} style={{ color: 'var(--sv-magt)', margin: '0 auto 8px' }} />
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '4px' }}>Subir archivo del comprobante</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--sv-mute)', marginBottom: '14px' }}>Fotos, capturas, PDFs o documentos (cualquier formato)</div>
                    <label className="sv-btn sv-btn--mag" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                      {uploadingAttachment ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                      <span>{uploadingAttachment ? 'Subiendo archivo...' : 'Seleccionar archivo'}</span>
                      <input type="file" onChange={handleFileUpload} disabled={uploadingAttachment} style={{ display: 'none' }} />
                    </label>
                  </div>

                  <div style={{ marginTop: '18px', borderTop: '1px solid var(--sv-line)', paddingTop: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--sv-mute)', marginBottom: '6px' }}>
                      O vincular link de Google Drive
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/file/d/..."
                        value={attachmentDriveUrl}
                        onChange={(e) => setAttachmentDriveUrl(e.target.value)}
                        className="form-input"
                        style={{ flex: 1, padding: '7px 12px', fontSize: '0.84rem' }}
                      />
                      <button
                        type="button"
                        onClick={handleSaveDriveUrl}
                        disabled={uploadingAttachment || !attachmentDriveUrl.trim()}
                        className="sv-btn sv-btn--mag"
                      >
                        Vincular
                      </button>
                    </div>

                    {isGoogleDriveFolder(attachmentDriveUrl) && (
                      <div style={{ marginTop: '6px', fontSize: '0.74rem', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={13} />
                        <span>Atención: parece un enlace de carpeta. Para el comprobante debés copiar el link del archivo.</span>
                      </div>
                    )}

                    {data?.driveFolderUrl && (
                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--sv-mute)', backgroundColor: 'var(--sv-soft)', padding: '6px 10px', borderRadius: '8px' }}>
                        <span>📁 Carpeta oficial de Drive del local</span>
                        <a href={data.driveFolderUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <FolderSymlink size={13} /> Abrir para subir
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Configuración de Carpeta Google Drive */}
        {driveFolderModal && (
          <div className="sv-modal-overlay" onClick={() => setDriveFolderModal(false)}>
            <div className="sv-modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(37,99,235,0.12)', display: 'grid', placeItems: 'center', color: '#2563EB', flexShrink: 0 }}>
                    <FolderSymlink size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0 }}>Carpeta de Google Drive</h4>
                    <small className="sv-muted">Carpeta oficial donde se respaldan los comprobantes</small>
                  </div>
                </div>
                <button type="button" className="sv-ghost" onClick={() => setDriveFolderModal(false)}><X size={18} /></button>
              </div>

              {/* Si ya hay una carpeta configurada, mostrar estado actual */}
              {data?.driveFolderUrl && (
                <div style={{ backgroundColor: 'var(--sv-soft)', border: '1px solid var(--sv-line)', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <CheckCircle2 size={13} /> Carpeta actualmente vinculada
                    </span>
                    <button
                      type="button"
                      onClick={handleUnlinkDriveFolder}
                      disabled={savingDriveFolder}
                      className="sv-void"
                      style={{ fontSize: '0.72rem', height: '26px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="Quitar vinculación de esta carpeta"
                    >
                      <Trash2 size={12} /> Desvincular
                    </button>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--sv-mute)', wordBreak: 'break-all', marginBottom: '8px' }}>
                    {data.driveFolderUrl}
                  </div>
                  <a
                    href={data.driveFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sv-btn"
                    style={{ fontSize: '0.76rem', height: '28px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <ExternalLink size={12} /> Abrir carpeta actual en Drive
                  </a>
                </div>
              )}

              <form onSubmit={handleSaveDriveFolder}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--sv-mute)', marginBottom: '6px' }}>
                  {data?.driveFolderUrl ? 'Cambiar por otro enlace de carpeta:' : 'Pegá el enlace de la carpeta de Drive:'}
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={driveFolderInput}
                  onChange={(e) => setDriveFolderInput(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '0.88rem', marginBottom: '12px', boxSizing: 'border-box' }}
                  autoFocus
                />

                {/* Guía rápida para copiar el link correcto */}
                <div style={{ backgroundColor: 'color-mix(in srgb, var(--sv-soft) 60%, transparent)', border: '1px dashed var(--sv-line)', borderRadius: '10px', padding: '10px 12px', marginBottom: '16px', fontSize: '0.75rem', color: 'var(--sv-mute)', lineHeight: '1.4' }}>
                  <b style={{ color: 'var(--sv-text)', display: 'block', marginBottom: '4px' }}>¿Cómo obtener el enlace de tu cuenta?</b>
                  1. Entrá a Google Drive con la cuenta del negocio.<br />
                  2. Clic derecho en la carpeta ➔ <b>Compartir</b> ➔ <b>Compartir</b>.<br />
                  3. En &quot;Acceso general&quot;, seleccioná <b>&quot;Cualquier persona con el enlace&quot;</b>.<br />
                  4. Hacé clic en <b>&quot;Copiar enlace&quot;</b> y pegalo acá arriba.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" onClick={() => setDriveFolderModal(false)} className="sv-btn">Cancelar</button>
                  <button type="submit" disabled={savingDriveFolder || !driveFolderInput.trim()} className="sv-btn sv-btn--mag">
                    {savingDriveFolder ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{data?.driveFolderUrl ? 'Actualizar carpeta' : 'Vincular carpeta'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- Estilos del panel
// Identidad Dulce Valentín: DM Serif Display para cifras y títulos, magenta
// #A8175A + rosa + celeste de la marca, tarjeta ciruela para la ganancia.
const AV_COLORS = ['#A8175A', '#EC6FA6', '#3FA9D6', '#7B4FB5', '#C98A1B', '#2E9E6A'];
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '·';

const SV_CSS = `
.sv{min-height:100vh;background:var(--bg-page);color:var(--text-main);font-family:var(--font-body);padding-bottom:64px;
  --sv-line:var(--border-color);--sv-card:var(--bg-card);--sv-soft:var(--bg-surface-elevated);--sv-mute:var(--text-muted);
  --sv-mag:var(--dv-accent-fill);--sv-magt:var(--dv-accent-text);--sv-pink:var(--accent-gold);--sv-sky:var(--accent-secondary);
  --sv-ok:var(--accent-emerald);--sv-bad:var(--accent-crimson);--sv-warn:#D98A0B;--sv-cash:#D9A13B}
.sv *{box-sizing:border-box}
.sv-wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.sv-num{font-family:var(--font-display);font-weight:400;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.sv-label{display:block;font-size:.66rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--sv-mute)}
.sv-label--light{color:rgba(255,248,250,.7)}
.sv-muted{color:var(--sv-mute)}
.sv-small{font-size:.8rem;margin:4px 0 0}
.sv-block{display:block}
.sv-c-ok{color:var(--sv-ok)}.sv-c-bad{color:var(--sv-bad)}.sv-c-warn{color:var(--sv-warn)}.sv-c-sky{color:var(--sv-sky)}

.sv-top{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--bg-page) 88%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--sv-line)}
.sv-topin{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;flex-wrap:wrap}
.sv-brand{display:flex;align-items:center;gap:12px}
.sv-seal{width:42px;height:42px;border-radius:50%;background:var(--sv-mag);color:#fff;display:grid;place-items:center;font-family:var(--font-display);font-size:1.05rem;letter-spacing:.02em;box-shadow:0 0 0 3px var(--bg-page),0 0 0 4px var(--sv-pink)}
.sv-brand h1{font-family:var(--font-display);font-weight:400;font-size:1.45rem;margin:0;line-height:1}
.sv-brand small{display:block;font-size:.72rem;color:var(--sv-mute);margin-top:4px;letter-spacing:.03em}
.sv-tools{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.sv-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 13px;border-radius:999px;border:1px solid var(--sv-line);background:var(--sv-card);color:var(--text-main);font:700 .8rem var(--font-body);cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s,transform .1s;white-space:nowrap}
.sv-btn:hover:not(:disabled){border-color:var(--sv-pink)}
.sv-btn:active:not(:disabled){transform:scale(.97)}
.sv-btn:disabled{opacity:.45;cursor:not-allowed}
.sv-btn:focus-visible,.sv-tab:focus-visible,.sv-seg button:focus-visible{outline:2px solid var(--sv-pink);outline-offset:2px}
.sv-btn--mag{background:var(--sv-mag);border-color:var(--sv-mag);color:#fff}
.sv-btn--mag:hover:not(:disabled){background:var(--dv-accent-fill-hover);border-color:var(--dv-accent-fill-hover)}
.sv-btn--wa{background:#1E9E52;border-color:#1E9E52;color:#fff}
.sv-btn--on{background:var(--accent-gold-light);border-color:var(--sv-pink);color:var(--sv-magt)}
.sv-icon{width:36px;padding:0}
.sv-ghost{background:none;border:0;color:var(--sv-mute);cursor:pointer;padding:4px;border-radius:8px;display:inline-flex}
.sv-ghost:hover{color:var(--sv-magt)}
.sv-link{background:none;border:0;color:var(--sv-magt);font:700 .78rem var(--font-body);cursor:pointer;display:inline-flex;align-items:center;gap:3px}

.sv-period{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:20px}
.sv-seg{display:inline-flex;background:var(--sv-soft);border-radius:999px;padding:3px}
.sv-seg button{border:0;background:none;padding:8px 18px;border-radius:999px;font:700 .82rem var(--font-body);color:var(--sv-mute);cursor:pointer}
.sv-seg button.on{background:var(--sv-card);color:var(--text-main);box-shadow:var(--shadow-sm)}
.sv-date{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sv-date input{height:36px;border-radius:999px;border:1px solid var(--sv-line);background:var(--sv-card);color:var(--text-main);padding:0 14px;font:700 .84rem var(--font-body);color-scheme:light dark}
.sv-alert{margin-top:14px;padding:10px 14px;border-radius:12px;background:color-mix(in srgb,var(--sv-warn) 14%,transparent);color:var(--sv-warn);font-weight:700;font-size:.86rem}

.sv-tabs{display:flex;align-items:center;gap:24px;border-bottom:1px solid var(--sv-line);margin:18px 0 22px;overflow-x:auto;scrollbar-width:none}
.sv-tab{background:none;border:0;padding:13px 0;font:700 .86rem var(--font-body);color:var(--sv-mute);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;display:inline-flex;gap:7px;align-items:center}
.sv-tab:hover{color:var(--text-main)}
.sv-tab.on{color:var(--text-main);border-color:var(--sv-mag)}
.sv-count{font-size:.68rem;font-weight:700;background:var(--sv-soft);border-radius:999px;padding:1px 8px;color:var(--sv-mute)}
.sv-live{margin-left:auto;display:inline-flex;align-items:center;gap:7px;font-size:.76rem;font-weight:700;color:var(--sv-mute);white-space:nowrap}
.sv-live em{font-style:normal;font-weight:500}
.sv-pulse{width:8px;height:8px;border-radius:50%;background:var(--sv-ok);animation:svp 2s infinite}
.sv-pulse--off{background:var(--sv-warn);animation:none}
@keyframes svp{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--sv-ok) 55%,transparent)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}

.sv-panel{background:var(--sv-card);border:1px solid var(--sv-line);border-radius:22px;padding:22px 24px}
.sv-panel--flush{padding:0;overflow:hidden}
.sv-h{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px}
.sv-h--wrap{flex-wrap:wrap;align-items:flex-start}
.sv-h--pad{padding:20px 22px 14px;margin:0;flex-wrap:wrap;align-items:flex-start}
.sv-h h3{font-family:var(--font-display);font-weight:400;font-size:1.35rem;margin:0;line-height:1.1}
.sv-empty{padding:18px;text-align:center;color:var(--sv-mute);font-size:.86rem;border:1px dashed var(--sv-line);border-radius:14px}

.sv-hero{display:grid;grid-template-columns:1.45fr 1fr;gap:18px;margin-bottom:18px}
.sv-hero-main{position:relative;overflow:hidden}
.sv-hero-main::before{content:"";position:absolute;right:-90px;top:-90px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--sv-pink) 22%,transparent),transparent 68%);pointer-events:none}
.sv-greet{font-family:var(--font-display);font-style:italic;font-size:1.2rem;color:var(--sv-magt);margin:0 0 14px}
.sv-big{font-size:clamp(2.7rem,6.2vw,4.4rem);line-height:.95;margin:8px 0 12px;color:var(--text-main)}
.sv-hero-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:.82rem}
.sv-delta{display:inline-flex;align-items:center;gap:4px;font-size:.78rem;font-weight:800;padding:4px 10px;border-radius:999px}
.sv-delta--up{background:color-mix(in srgb,var(--sv-ok) 15%,transparent);color:var(--sv-ok)}
.sv-delta--down{background:color-mix(in srgb,var(--sv-bad) 14%,transparent);color:var(--sv-bad)}
.sv-meta{display:flex;gap:18px;flex-wrap:wrap;font-size:.82rem;color:var(--sv-mute);margin-top:16px;padding-top:14px;border-top:1px dashed var(--sv-line)}
.sv-meta b{color:var(--text-main)}
.sv-split{margin-top:18px}
.sv-bar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--sv-soft);gap:3px}
.sv-bar span{display:block;height:100%;border-radius:999px;transition:width .5s ease}
.sv-legend{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:.78rem;margin-top:9px;color:var(--sv-mute)}
.sv-legend b{color:var(--text-main)}
.sv-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:1px}

.sv-margin{display:flex;align-items:center;justify-content:space-between;gap:16px;background:linear-gradient(150deg,#3A2147 0%,#26172F 100%);border-color:transparent;color:#FFF8FA;position:relative;overflow:hidden}
.sv-margin::after{content:"";position:absolute;left:-40px;bottom:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(95,193,232,.18),transparent 70%)}
.sv-margin-num{font-size:clamp(2rem,4vw,2.8rem);line-height:1;margin:10px 0 10px}
.sv-margin-sub{font-size:.8rem;color:rgba(255,248,250,.7);margin:0;max-width:240px}
.sv-ring{position:relative;flex-shrink:0;width:120px;height:120px}
.sv-ring circle{transition:stroke-dashoffset .8s ease}
.sv-ring-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.sv-ring-label .sv-num{font-size:1.6rem;line-height:1}
.sv-ring-label small{font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,248,250,.65)}

.sv-ledger{display:grid;grid-template-columns:repeat(4,1fr);background:var(--sv-card);border:1px solid var(--sv-line);border-radius:20px;margin-bottom:18px}
.sv-ledger>div{padding:18px 22px;border-left:1px solid var(--sv-line)}
.sv-ledger>div:first-child{border-left:0}
.sv-ledger .sv-num{display:block;font-size:1.75rem;margin:8px 0 2px;line-height:1.05}
.sv-ledger small{font-size:.74rem;color:var(--sv-mute)}

.sv-grid2{display:grid;grid-template-columns:1.3fr 1fr;gap:18px;align-items:start}
.sv-stack{display:flex;flex-direction:column;gap:18px}
.sv-rank{display:flex;flex-direction:column;gap:14px}
.sv-row{display:grid;grid-template-columns:38px 1fr auto;gap:12px;align-items:center}
.sv-av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font:800 .78rem var(--font-body);color:#fff;letter-spacing:.02em;flex-shrink:0}
.sv-av--lg{width:60px;height:60px;font-size:1.1rem;margin:12px auto 10px}
.sv-av--sm{width:26px;height:26px;font-size:.62rem}
.sv-row-name{font-weight:700;font-size:.9rem}
.sv-row-name .sv-muted{font-weight:500;font-size:.78rem}
.sv-track{height:6px;background:var(--sv-soft);border-radius:999px;margin-top:6px;overflow:hidden}
.sv-track span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--sv-mag),var(--sv-pink))}
.sv-row-amt{text-align:right}
.sv-row-amt .sv-num{font-size:1.2rem}
.sv-row-amt small{display:block;font-size:.72rem;color:var(--sv-mute)}
.sv-mid{font-size:2rem;margin:6px 0 2px}
.sv-pill{display:inline-block;margin-top:12px;padding:7px 12px;border-radius:12px;font-size:.82rem;font-weight:700;background:var(--sv-soft);color:var(--sv-mute)}
.sv-pill small{font-weight:500}
.sv-pill--ok{background:color-mix(in srgb,var(--sv-ok) 14%,transparent);color:var(--sv-ok)}
.sv-pill--bad{background:color-mix(in srgb,var(--sv-bad) 13%,transparent);color:var(--sv-bad)}
.sv-mini-alias{display:flex;flex-direction:column;gap:12px}
.sv-mini-row{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.sv-mini-row code{font-size:.82rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv-mini-row .sv-num{font-size:1.05rem}
.sv-meter{height:6px;border-radius:999px;background:var(--sv-soft);overflow:hidden;margin-top:6px}
.sv-meter--thin{height:4px;margin-top:5px}
.sv-meter span{display:block;height:100%;border-radius:999px;background:var(--sv-ok);transition:width .4s ease}
.sv-meter span.warn{background:var(--sv-warn)}.sv-meter span.bad{background:var(--sv-bad)}

.sv-alias-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.sv-alias{border:1px solid var(--sv-line);border-radius:18px;padding:16px;background:var(--sv-card);position:relative;overflow:hidden}
.sv-alias::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--sv-ok)}
.sv-alias--warn::before{background:var(--sv-warn)}.sv-alias--bad::before{background:var(--sv-bad)}.sv-alias--off{opacity:.6}.sv-alias--off::before{background:var(--sv-line)}
.sv-alias--warn .sv-meter span{background:var(--sv-warn)}.sv-alias--bad .sv-meter span{background:var(--sv-bad)}
.sv-alias-top{display:flex;justify-content:space-between;align-items:center}
.sv-alias-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;font-size:1rem;margin:6px 0 2px;word-break:break-all}
.sv-alias-sub{font-size:.78rem;color:var(--sv-mute)}
.sv-alias-rules{display:inline-block;margin-top:8px;font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--sv-soft);color:var(--sv-mute)}
.sv-alias-desc{margin-top:8px;font-family:var(--font-display);font-style:italic;font-size:.95rem;color:var(--sv-magt)}
.sv-alias-foot{display:flex;justify-content:space-between;align-items:baseline;margin-top:14px}
.sv-alias-foot .sv-num{font-size:1.45rem}
.sv-alias-left{font-size:.78rem;font-weight:700;color:var(--sv-mute)}
.sv-alias-count{font-size:.72rem;color:var(--sv-mute);margin-top:8px}

.sv-filter{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sv-search{position:relative;display:flex;align-items:center}
.sv-search svg{position:absolute;left:12px;color:var(--sv-mute)}
.sv-search input,.sv-input{height:38px;border-radius:999px;border:1px solid var(--sv-line);background:var(--sv-card);color:var(--text-main);padding:0 14px;font:500 .84rem var(--font-body)}
.sv-search input{padding-left:34px;width:250px}
.sv-tablewrap{overflow-x:auto}
.sv-scroll{max-height:340px;overflow:auto;border:1px solid var(--sv-line);border-radius:14px}
.sv-table{width:100%;border-collapse:collapse;font-size:.85rem}
.sv-table th{text-align:left;font-size:.64rem;letter-spacing:.13em;text-transform:uppercase;color:var(--sv-mute);font-weight:700;padding:11px 16px;border-bottom:1px solid var(--sv-line);background:var(--sv-card);position:sticky;top:0;white-space:nowrap}
.sv-table td{padding:12px 16px;border-bottom:1px solid var(--sv-line);vertical-align:middle}
.sv-table tbody tr:last-child td{border-bottom:0}
.sv-table tbody tr:hover td{background:color-mix(in srgb,var(--sv-soft) 55%,transparent)}
.sv-table .r{text-align:right}
.sv-table tr.void td{opacity:.45;text-decoration:line-through}
.sv-table tr.dim td{opacity:.5}
.sv-amt{font-size:1.05rem}
.sv-chip{display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.76rem;padding:3px 9px;border-radius:8px;background:var(--sv-soft)}
.sv-who{display:inline-flex;align-items:center;gap:8px;font-weight:700}
.sv-void{background:none;border:1px solid color-mix(in srgb,var(--sv-bad) 35%,transparent);color:var(--sv-bad);border-radius:999px;padding:4px 11px;font:700 .72rem var(--font-body);cursor:pointer}
.sv-void:hover{background:color-mix(in srgb,var(--sv-bad) 10%,transparent)}
.sv-empty-cell{text-align:center;color:var(--sv-mute);padding:36px!important}
.sv-mov{margin-top:20px}
.sv-mov:first-of-type{margin-top:6px}
.sv-mov-h{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.sv-archived{margin-top:24px;padding-top:18px;border-top:1px dashed var(--sv-line)}
.sv-archived-list{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.sv-archived-row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border:1px solid var(--sv-line);border-radius:14px;background:var(--sv-soft)}
.sv-archived-row code{font-weight:800}

.sv-podium{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:18px;align-items:end}
.sv-pod{text-align:center;padding:22px 18px}
.sv-pod small{font-size:.74rem;color:var(--sv-mute)}
.sv-pod-place{font-family:var(--font-display);font-size:2.4rem;line-height:1;color:var(--sv-pink)}
.sv-pod-name{font-weight:800;font-size:.95rem}
.sv-pod-amt{font-size:1.8rem;margin:4px 0}
.sv-pod--first{background:linear-gradient(150deg,#3A2147 0%,#26172F 100%);border-color:transparent;color:#FFF8FA;padding-top:30px;padding-bottom:30px}
.sv-pod--first small{color:rgba(255,248,250,.7)}

@media (max-width:960px){
  .sv-hero,.sv-grid2{grid-template-columns:1fr}
  .sv-ledger{grid-template-columns:repeat(2,1fr)}
  .sv-ledger>div:nth-child(3){border-left:0}
  .sv-ledger>div:nth-child(n+3){border-top:1px solid var(--sv-line)}
  .sv-podium{grid-template-columns:1fr}
}
@media (max-width:640px){
  .sv-wrap,.sv-topin{padding-left:16px;padding-right:16px}
  .sv-tools .sv-btn span{display:none}
  .sv-tools .sv-btn{width:36px;padding:0}
  .sv-panel{padding:18px;border-radius:18px}
  .sv-panel--flush{padding:0}
  .sv-margin{flex-direction:column;align-items:flex-start}
  .sv-search input{width:100%}
  .sv-search,.sv-filter{width:100%}
  .sv-live{display:none}
  .sv-ledger>div{padding:14px 16px}
  .sv-ledger .sv-num{font-size:1.4rem}
}

/* Quick-bar de alias del día */
.sv-alias-bar{padding:14px 18px;border-bottom:1px solid var(--sv-line);background:color-mix(in srgb,var(--sv-soft) 40%,transparent)}
.sv-alias-bar-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.sv-alias-pills{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
.sv-alias-pill{background:var(--sv-card);border:1.5px solid var(--sv-line);border-radius:14px;padding:9px 13px;min-width:165px;cursor:pointer;text-align:left;transition:all .15s}
.sv-alias-pill:hover{border-color:var(--sv-pink)}
.sv-alias-pill.on{border-color:var(--sv-mag);background:color-mix(in srgb,var(--sv-mag) 8%,var(--sv-card));box-shadow:0 0 0 1px var(--sv-mag)}
.sv-alias-pill--bad{border-color:#EF4444!important}
.sv-alias-pill--bad.on{background:color-mix(in srgb,#EF4444 12%,var(--sv-card))}
.sv-alias-pill--off{opacity:.6}
.sv-alias-pill-top{display:flex;justify-content:space-between;align-items:baseline;gap:6px;margin-bottom:3px}
.sv-alias-pill-title{font-size:.76rem;font-weight:800;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;display:flex;align-items:center;gap:4px}
.sv-alias-pill-count{font-size:.68rem;color:var(--sv-mute);font-weight:700}
.sv-alias-pill-amt{font-family:var(--font-display);font-size:1.15rem;font-weight:400;margin:2px 0}
.sv-alias-pill-foot{display:flex;justify-content:space-between;align-items:center;font-size:.68rem;color:var(--sv-mute);font-weight:700;margin-top:4px}
.sv-pill-tag{font-size:.6rem;background:#EF4444;color:#fff;padding:1px 5px;border-radius:4px;font-weight:900}
.sv-pill-tag-gray{font-size:.6rem;background:var(--sv-soft);color:var(--sv-mute);padding:1px 5px;border-radius:4px}
.sv-pill-note-btn{background:none;border:none;padding:0;font-size:.68rem;color:var(--sv-magt);font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:3px}
.sv-pill-note-btn:hover{text-decoration:underline}

/* Modals */
.sv-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:9999;display:grid;place-items:center;padding:16px}
.sv-modal{background:var(--sv-card);border:1px solid var(--sv-line);border-radius:20px;padding:22px;width:100%;max-width:480px;box-shadow:var(--shadow-lg);position:relative}
.sv-modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
.sv-modal-head h4{margin:0;font-family:var(--font-display);font-size:1.25rem}

/* Botones de Comprobante en la tabla */
.sv-attach-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:8px;background:color-mix(in srgb,var(--accent-emerald) 15%,transparent);color:var(--accent-emerald);font-size:.74rem;font-weight:800;border:1px solid color-mix(in srgb,var(--accent-emerald) 30%,transparent);cursor:pointer;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv-attach-badge:hover{background:color-mix(in srgb,var(--accent-emerald) 25%,transparent)}
.sv-btn-attach{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:8px;background:none;border:1px dashed var(--sv-line);color:var(--sv-mute);font-size:.72rem;font-weight:700;cursor:pointer}
.sv-btn-attach:hover{border-color:var(--sv-mag);color:var(--sv-magt)}
`;
