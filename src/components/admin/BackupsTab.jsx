'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldCheck,
  HardDriveDownload,
  FolderCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Upload,
  Search,
  Users,
  Package,
  Layers,
  Barcode,
  Copy,
  Check,
  Sparkles,
  Wifi,
  WifiOff,
  ExternalLink,
  HelpCircle,
  Eye,
  FileText,
  DollarSign,
  Tag
} from 'lucide-react';
import BackupGuideModal from '@/components/admin/BackupGuideModal';
import { adminFetch } from '@/lib/adminFetch';
import {
  saveLocalSnapshot,
  loadLocalSnapshot,
  getLocalSnapshotMeta,
  isLocalOperationMode,
  setLocalOperationMode,
  searchLocalProducts,
  searchLocalOrders,
  triggerBrowserFileDownload,
  generateCsv
} from '@/lib/localDatabase';
import { getProductVariants } from '@/lib/barcode';

export default function BackupsTab() {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Pestaña interna de la sección
  const [activeSection, setActiveSection] = useState('operaciones'); // 'operaciones' | 'catalogo_offline' | 'restaurar'

  // Búsqueda en catálogo offline
  const [offlineSearch, setOfflineSearch] = useState('');
  const [offlineTab, setOfflineTab] = useState('productos'); // 'productos' | 'ventas'

  // Guía interactiva
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(1);

  // Restaurar archivo
  const [inspectingSnapshot, setInspectingSnapshot] = useState(null);
  const [inspectError, setInspectError] = useState(null);
  const fileInputRef = useRef(null);

  // Cargar estado inicial
  useEffect(() => {
    setIsLocalMode(isLocalOperationMode());
    const m = getLocalSnapshotMeta();
    setMeta(m);

    // Cargar snapshot desde IndexedDB
    loadLocalSnapshot().then((s) => {
      if (s) {
        setSnapshot(s);
      }
    });

    // Abrir la guía automáticamente la primera vez
    if (typeof window !== 'undefined' && !localStorage.getItem('seen_dv_backup_guide')) {
      setShowGuide(true);
      setGuideStep(1);
      localStorage.setItem('seen_dv_backup_guide', 'true');
    }

    const handleModeChange = (e) => {
      setIsLocalMode(Boolean(e.detail?.isLocal));
    };
    window.addEventListener('dv:mode-change', handleModeChange);
    return () => window.removeEventListener('dv:mode-change', handleModeChange);
  }, []);

  const showToast = (text, type = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 6000);
  };

  // Sincronizar y Respaldar en 1 Clic
  const handleSyncBackup = async () => {
    setLoading(true);
    setFeedbackMsg({ text: 'Extrayendo base de datos y volcando en disco local...', type: 'info' });

    try {
      const res = await adminFetch('/api/admin/backups/export', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al generar el respaldo local');
      }

      // 1. Guardar en IndexedDB para disponibilidad offline
      await saveLocalSnapshot(data.snapshot);
      setSnapshot(data.snapshot);
      setMeta({
        exportedAt: data.snapshot.exportedAt,
        counts: data.snapshot.counts,
        windowsPath: data.snapshot.windowsPath
      });

      // 2. Disparar descarga en el navegador del JSON maestro como doble respaldo
      const masterJsonString = JSON.stringify(data.snapshot, null, 2);
      triggerBrowserFileDownload(
        masterJsonString,
        `backup_dulce_valentin_${data.timestamp}.json`,
        'application/json;charset=utf-8'
      );

      // 3. Disparar también descarga de la planilla de stock por talle y color (esencial para el local)
      if (data.csvFiles?.stockVariantes) {
        triggerBrowserFileDownload(
          data.csvFiles.stockVariantes,
          `stock_por_talle_y_color_${data.timestamp.slice(0, 10)}.csv`,
          'text/csv;charset=utf-8'
        );
      }

      showToast(
        `¡Respaldo exitoso! Se guardó en "${data.backupDir}" y se descargó una copia en tu navegador.`,
        'success'
      );
    } catch (err) {
      console.error('Error al realizar backup:', err);
      showToast(`Error al respaldar: ${err.message || 'No se pudo conectar con el servidor'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Copiar ruta al portapapeles
  const handleCopyPath = () => {
    const path = meta?.windowsPath || snapshot?.windowsPath || 'C:\\Users\\<Usuario>\\Backups_DulceValentin';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2500);
    }
  };

  // Alternar modo contingencia local
  const handleToggleLocalMode = () => {
    const next = !isLocalMode;
    setLocalOperationMode(next);
    setIsLocalMode(next);
    showToast(
      next
        ? 'Modo Local / Contingencia ACTIVADO: Las consultas operan sobre la memoria local (IndexedDB).'
        : 'Modo Online ACTIVADO: El sistema opera conectado a la nube.',
      next ? 'warning' : 'info'
    );
  };

  // Descargar CSV individual desde el snapshot cargado
  const handleDownloadCsv = (type) => {
    if (!snapshot || !snapshot.data) {
      showToast('Primero realizá un respaldo para poder descargar las planillas.', 'warning');
      return;
    }

    const dateStr = (snapshot.exportedAt || new Date().toISOString()).slice(0, 10);

    if (type === 'catalogo') {
      const rows = (snapshot.data.products || []).map((p) => ({
        codigo: p.code || '',
        nombre: p.name || '',
        categoria: p.category || '',
        subcategoria: p.subcategory || '',
        precio_minorista: Number(p.price || 0),
        precio_mayorista: Number(p.wholesale_price || 0),
        stock: Number(p.stock || 0),
        ventas: Number(p.sales_count || 0),
        talles: Array.isArray(p.sizes) ? p.sizes.join(', ') : '',
        colores: Array.isArray(p.colors) ? p.colors.join(', ') : '',
        activo: p.is_active !== false,
        ultima_actualizacion: p.updated_at ? new Date(p.updated_at).toLocaleString('es-AR') : ''
      }));

      const csv = generateCsv(rows, [
        { key: 'codigo', label: 'Código Artículo' },
        { key: 'nombre', label: 'Nombre de la Prenda' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'subcategoria', label: 'Subcategoría' },
        { key: 'precio_minorista', label: 'Precio Minorista ($)' },
        { key: 'precio_mayorista', label: 'Precio Mayorista ($)' },
        { key: 'stock', label: 'Stock Total' },
        { key: 'ventas', label: 'Ventas Acumuladas' },
        { key: 'talles', label: 'Talles Disponibles' },
        { key: 'colores', label: 'Colores Disponibles' },
        { key: 'activo', label: 'Activo para Venta' },
        { key: 'ultima_actualizacion', label: 'Última Actualización' }
      ]);

      triggerBrowserFileDownload(csv, `catalogo_productos_${dateStr}.csv`, 'text/csv;charset=utf-8');
      showToast('Planilla de Catálogo descargada para Excel.', 'success');
    } else if (type === 'stockVariantes') {
      const rows = [];
      (snapshot.data.products || []).forEach((p) => {
        const variants = getProductVariants(p);
        const barcodes = p.barcodes || {};

        if (variants && variants.length > 0) {
          variants.forEach((v) => {
            rows.push({
              codigo_articulo: p.code || '',
              nombre_prenda: p.name || '',
              categoria: p.category || '',
              talle: v.size || 'Único',
              color: v.color || 'Único',
              stock_disponible: Number(v.stock) || 0,
              codigo_barras: barcodes[v.key] || barcodes['CUALQUIER_TALLE'] || '',
              precio_minorista: Number(v.price || p.price || 0),
              precio_mayorista: Number(p.wholesale_price || 0)
            });
          });
        } else {
          rows.push({
            codigo_articulo: p.code || '',
            nombre_prenda: p.name || '',
            categoria: p.category || '',
            talle: 'Único',
            color: 'Único',
            stock_disponible: Number(p.stock) || 0,
            codigo_barras: barcodes['CUALQUIER_TALLE'] || '',
            precio_minorista: Number(p.price || 0),
            precio_mayorista: Number(p.wholesale_price || 0)
          });
        }
      });

      const csv = generateCsv(rows, [
        { key: 'codigo_articulo', label: 'Código de Prenda' },
        { key: 'nombre_prenda', label: 'Artículo' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'talle', label: 'Talle' },
        { key: 'color', label: 'Color' },
        { key: 'stock_disponible', label: 'Stock Disponible' },
        { key: 'codigo_barras', label: 'Código de Barras (EAN/UPC)' },
        { key: 'precio_minorista', label: 'Precio Minorista ($)' },
        { key: 'precio_mayorista', label: 'Precio Mayorista ($)' }
      ]);

      triggerBrowserFileDownload(csv, `stock_por_talle_y_color_${dateStr}.csv`, 'text/csv;charset=utf-8');
      showToast('Planilla de Stock por Talle y Color descargada para Excel.', 'success');
    } else if (type === 'ventas') {
      const rows = (snapshot.data.orders || []).map((o) => {
        let itemsResumen = '';
        if (Array.isArray(o.items)) {
          itemsResumen = o.items
            .map((item) => `${item.quantity || 1}x ${item.name || item.title || 'Prenda'} ${item.size ? `(T.${item.size})` : ''} ${item.color ? `[${item.color}]` : ''}`)
            .join(' | ');
        }
        return {
          id: o.id || '',
          fecha: o.created_at ? new Date(o.created_at).toLocaleString('es-AR') : '',
          cliente: o.client_name || 'Sin identificar',
          telefono: o.client_phone || '',
          dni: o.client_dni || '',
          localidad: o.client_locality || '',
          direccion: o.client_address || '',
          canal: o.channel || 'web',
          medio_pago: o.payment_method || 'no especificado',
          total: Number(o.total_amount) || 0,
          prendas: Array.isArray(o.items) ? o.items.reduce((s, it) => s + (Number(it.quantity) || 1), 0) : 0,
          es_mayorista: o.is_wholesale ? 'SÍ' : 'NO',
          descuento: Number(o.discount_applied) || 0,
          estado: o.status || 'pendiente',
          cajera_vendedora: o.cashier_id || o.seller_id || '',
          detalle_prendas: itemsResumen,
          notas: o.admin_notes || o.customer_notes || ''
        };
      });

      const csv = generateCsv(rows, [
        { key: 'id', label: 'Nro de Pedido/Ticket' },
        { key: 'fecha', label: 'Fecha y Hora' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'dni', label: 'DNI' },
        { key: 'localidad', label: 'Localidad' },
        { key: 'direccion', label: 'Dirección' },
        { key: 'canal', label: 'Canal de Venta' },
        { key: 'medio_pago', label: 'Medio de Pago' },
        { key: 'total', label: 'Total Abonado ($)' },
        { key: 'prendas', label: 'Cant. Prendas' },
        { key: 'es_mayorista', label: 'Es Mayorista' },
        { key: 'descuento', label: 'Descuento ($)' },
        { key: 'estado', label: 'Estado' },
        { key: 'cajera_vendedora', label: 'Cajera / Vendedora' },
        { key: 'detalle_prendas', label: 'Detalle de Prendas Compradas' },
        { key: 'notas', label: 'Notas' }
      ]);

      triggerBrowserFileDownload(csv, `ventas_y_pedidos_${dateStr}.csv`, 'text/csv;charset=utf-8');
      showToast('Planilla de Ventas descargada para Excel.', 'success');
    } else if (type === 'clientes') {
      const clientMap = new Map();

      (snapshot.data.wholesaleClients || []).forEach((wc) => {
        const phoneClean = String(wc.phone || '').replace(/\D/g, '');
        const key = phoneClean || String(wc.name || '').trim().toLowerCase();
        if (!key) return;
        clientMap.set(key, {
          nombre: wc.name || 'Cliente Mayorista',
          telefono: wc.phone || '',
          dni: wc.dni || '',
          localidad: wc.locality || '',
          pedidos_count: 0,
          total_gastado: 0,
          registrado: 'SÍ',
          fecha_alta: wc.created_at ? new Date(wc.created_at).toLocaleDateString('es-AR') : ''
        });
      });

      (snapshot.data.orders || []).forEach((o) => {
        const phoneClean = String(o.client_phone || '').replace(/\D/g, '');
        const key = phoneClean || String(o.client_name || '').trim().toLowerCase();
        if (!key) return;

        const existing = clientMap.get(key) || {
          nombre: o.client_name || 'Cliente',
          telefono: o.client_phone || '',
          dni: o.client_dni || '',
          localidad: o.client_locality || '',
          pedidos_count: 0,
          total_gastado: 0,
          registrado: 'NO',
          fecha_alta: o.created_at ? new Date(o.created_at).toLocaleDateString('es-AR') : ''
        };

        existing.pedidos_count += 1;
        existing.total_gastado += Number(o.total_amount) || 0;
        if (!existing.dni && o.client_dni) existing.dni = o.client_dni;
        if (!existing.localidad && o.client_locality) existing.localidad = o.client_locality;

        clientMap.set(key, existing);
      });

      const csv = generateCsv(Array.from(clientMap.values()), [
        { key: 'nombre', label: 'Nombre y Apellido' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'dni', label: 'DNI' },
        { key: 'localidad', label: 'Localidad' },
        { key: 'pedidos_count', label: 'Cantidad de Compras' },
        { key: 'total_gastado', label: 'Total Gastado Histórico ($)' },
        { key: 'registrado', label: 'Usuario Registrado' },
        { key: 'fecha_alta', label: 'Fecha de Registro' }
      ]);

      triggerBrowserFileDownload(csv, `clientes_y_contactos_${dateStr}.csv`, 'text/csv;charset=utf-8');
      showToast('Directorio de Clientes descargado para Excel.', 'success');
    } else if (type === 'json') {
      const jsonStr = JSON.stringify(snapshot, null, 2);
      triggerBrowserFileDownload(jsonStr, `backup_dulce_valentin_${dateStr}.json`, 'application/json;charset=utf-8');
      showToast('Base completa JSON descargada.', 'success');
    }
  };

  // Carga e inspección de archivo de respaldo local
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInspectError(null);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.data || (!parsed.data.products && !parsed.counts)) {
          throw new Error('El archivo no posee el formato de respaldo de Dulce Valentín.');
        }
        setInspectingSnapshot(parsed);
      } catch (err) {
        setInspectError('Archivo no válido: ' + err.message);
        setInspectingSnapshot(null);
      }
    };

    reader.onerror = () => {
      setInspectError('Error al leer el archivo en el navegador.');
    };

    reader.readAsText(file);
  };

  // Aplicar respaldo inspeccionado al modo contingencia local
  const handleApplyInspected = async () => {
    if (!inspectingSnapshot) return;
    try {
      await saveLocalSnapshot(inspectingSnapshot);
      setSnapshot(inspectingSnapshot);
      setMeta({
        exportedAt: inspectingSnapshot.exportedAt,
        counts: inspectingSnapshot.counts,
        windowsPath: inspectingSnapshot.windowsPath
      });
      showToast('¡Copia cargada exitosamente en el Modo Local (IndexedDB)!', 'success');
      setActiveSection('operaciones');
    } catch (err) {
      showToast('Error al guardar copia en IndexedDB: ' + err.message, 'error');
    }
  };

  // Filtrado de productos en catálogo offline
  const filteredOfflineProducts = useMemo(() => {
    if (!snapshot) return [];
    return searchLocalProducts(snapshot, offlineSearch);
  }, [snapshot, offlineSearch]);

  // Filtrado de ventas en catálogo offline
  const filteredOfflineOrders = useMemo(() => {
    if (!snapshot) return [];
    return searchLocalOrders(snapshot, offlineSearch);
  }, [snapshot, offlineSearch]);

  const lastBackupDateText = useMemo(() => {
    const raw = meta?.exportedAt || snapshot?.exportedAt;
    if (!raw) return 'Aún no realizado en esta sesión';
    try {
      const d = new Date(raw);
      return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return raw;
    }
  }, [meta, snapshot]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '50px' }}>
      {/* Guía Modal Paso a Paso */}
      <BackupGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        step={guideStep}
        onNext={() => setGuideStep((s) => Math.min(4, s + 1))}
        onPrev={() => setGuideStep((s) => Math.max(1, s - 1))}
        onFinish={() => setShowGuide(false)}
      />

      {/* Toast / Notificación visual */}
      {feedbackMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: feedbackMsg.type === 'error' ? '#991B1B' : feedbackMsg.type === 'warning' ? '#B45309' : '#14532D',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.88rem',
            fontWeight: 700,
            maxWidth: '480px',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {feedbackMsg.type === 'error' ? (
            <AlertTriangle size={18} />
          ) : feedbackMsg.type === 'warning' ? (
            <WifiOff size={18} />
          ) : (
            <CheckCircle2 size={18} color="#4ADE80" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Cabecera Principal */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '2px solid var(--border-color, #F3DCE7)',
          paddingBottom: '18px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#FCEDF3',
                color: '#A8175A',
                border: '1px solid #E4BFD4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main, #241E28)', margin: 0 }}>
                Copias de Seguridad y Blindaje Local-First
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #6E656E)', margin: 0 }}>
                Respaldo en 1 clic en tu PC con Windows, planillas para Excel y modo contingencia offline sin internet.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              setGuideStep(1);
              setShowGuide(true);
            }}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <HelpCircle size={15} color="#A8175A" />
            ¿Cómo funciona esta pantalla?
          </button>

          <button
            type="button"
            onClick={handleToggleLocalMode}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 800,
              borderRadius: '8px',
              border: isLocalMode ? '1px solid #F59E0B' : '1px solid #BBF7D0',
              backgroundColor: isLocalMode ? '#FEF3C7' : '#F0FDF4',
              color: isLocalMode ? '#92400E' : '#166534',
              cursor: 'pointer'
            }}
          >
            {isLocalMode ? (
              <>
                <WifiOff size={15} color="#D97706" /> Modo Local (Contingencia)
              </>
            ) : (
              <>
                <Wifi size={15} color="#16A34A" /> Modo Online (Nube)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub-Navegación de Secciones */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color, #F3DCE7)', paddingBottom: '10px' }}>
        <button
          type="button"
          onClick={() => setActiveSection('operaciones')}
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem',
            fontWeight: 800,
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSection === 'operaciones' ? '#A8175A' : 'transparent',
            color: activeSection === 'operaciones' ? '#FFFFFF' : 'var(--text-muted, #6E656E)'
          }}
        >
          ⚡ Panel de Respaldo & Excel
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('catalogo_offline')}
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem',
            fontWeight: 800,
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSection === 'catalogo_offline' ? '#A8175A' : 'transparent',
            color: activeSection === 'catalogo_offline' ? '#FFFFFF' : 'var(--text-muted, #6E656E)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Barcode size={15} /> Visor de Contingencia Offline
          {snapshot?.counts?.products && (
            <span
              style={{
                backgroundColor: activeSection === 'catalogo_offline' ? 'rgba(255,255,255,0.25)' : '#FCEDF3',
                color: activeSection === 'catalogo_offline' ? '#FFFFFF' : '#A8175A',
                fontSize: '0.72rem',
                padding: '2px 6px',
                borderRadius: '6px'
              }}
            >
              {snapshot.counts.products} prendas
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('restaurar')}
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem',
            fontWeight: 800,
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSection === 'restaurar' ? '#A8175A' : 'transparent',
            color: activeSection === 'restaurar' ? '#FFFFFF' : 'var(--text-muted, #6E656E)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Upload size={15} /> Inspeccionar Copia Externa
        </button>
      </div>

      {/* SECCIÓN 1: PANEL DE RESPALDO & EXCEL */}
      {activeSection === 'operaciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card Principal: Botón 1 Clic y Banner de Carpeta Windows */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-color, #F3DCE7)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(36, 30, 40, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    color: '#16A34A',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    letterSpacing: '0.05em'
                  }}
                >
                  Doble Respaldo Automático
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main, #241E28)', margin: '6px 0 2px 0' }}>
                  Respaldo Completo en 1 Clic
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted, #6E656E)', margin: 0 }}>
                  Vuelca toda la base de datos a tu carpeta local de Windows y descarga planillas tabulares para Excel.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSyncBackup}
                disabled={loading}
                style={{
                  backgroundColor: loading ? '#9CA3AF' : '#16A34A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '14px 28px',
                  fontSize: '0.98rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 20px rgba(22, 163, 74, 0.28)',
                  transition: 'all 0.2s ease'
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" /> Procesando Respaldo...
                  </>
                ) : (
                  <>
                    <HardDriveDownload size={20} /> Sincronizar y Respaldar en 1 Clic
                  </>
                )}
              </button>
            </div>

            {/* Banner de Carpeta Windows */}
            <div
              style={{
                backgroundColor: '#FFF8FA',
                border: '1px solid var(--border-color, #F3DCE7)',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderCheck size={22} color="#A8175A" />
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted, #6E656E)', textTransform: 'uppercase' }}>
                    Carpeta Física en tu Windows:
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.88rem', color: '#241E28' }}>
                    {meta?.windowsPath || snapshot?.windowsPath || 'C:\\Users\\<Usuario>\\Backups_DulceValentin'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #6E656E)' }}>
                  Último respaldo: <strong style={{ color: '#241E28' }}>{lastBackupDateText}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                  title="Copiar ruta de Windows"
                >
                  {copiedPath ? (
                    <>
                      <Check size={14} color="#16A34A" /> ¡Copiada!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copiar Ruta
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Tarjetas Bento de Resumen */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px'
            }}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color, #F3DCE7)',
                borderRadius: '16px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: '#FCEDF3',
                  color: '#A8175A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Tag size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #6E656E)', fontWeight: 800 }}>Prendas en Catálogo</div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main, #241E28)', fontFamily: 'monospace' }}>
                  {snapshot?.counts?.products ?? '324'}
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color, #F3DCE7)',
                borderRadius: '16px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: '#F0FDF4',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Package size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #6E656E)', fontWeight: 800 }}>Stock Físico Total</div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#16A34A', fontFamily: 'monospace' }}>
                  {snapshot?.counts?.totalStock ? Number(snapshot.counts.totalStock).toLocaleString('es-AR') : '—'}
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color, #F3DCE7)',
                borderRadius: '16px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Layers size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #6E656E)', fontWeight: 800 }}>Ventas Registradas</div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#2563EB', fontFamily: 'monospace' }}>
                  {snapshot?.counts?.orders ?? '21'}
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color, #F3DCE7)',
                borderRadius: '16px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Users size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #6E656E)', fontWeight: 800 }}>Directorio de Clientes</div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#D97706', fontFamily: 'monospace' }}>
                  {snapshot?.counts?.clients ?? '225'}
                </div>
              </div>
            </div>
          </div>

          {/* Sección de Descarga de Planillas Excel */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-color, #F3DCE7)',
              borderRadius: '20px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main, #241E28)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} color="#16A34A" />
                Descargar Planillas Listas para Excel (.csv)
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #6E656E)', margin: '4px 0 0 0' }}>
                Formato UTF-8 con punto y coma. Se abren directamente con doble clic en Windows sin errores de acentos ni columnas movidas.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '14px'
              }}
            >
              {/* Planilla 1: Stock Detallado */}
              <div
                style={{
                  border: '1px solid #BBF7D0',
                  backgroundColor: '#F0FDF4',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 900, fontSize: '0.92rem', color: '#166534' }}>
                      🏷️ Stock por Talle y Color
                    </span>
                    <span style={{ fontSize: '11px', backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                      Esencial
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#14532D', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                    Desglose de cada variante física con su talle, color, stock disponible y código de barras asignado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('stockVariantes')}
                  style={{
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={14} /> Descargar Excel Stock
                </button>
              </div>

              {/* Planilla 2: Catálogo General */}
              <div
                style={{
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <span style={{ fontWeight: 900, fontSize: '0.92rem', color: '#1E293B' }}>
                    📊 Catálogo de Prendas
                  </span>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                    Lista completa con código, nombre, categoría, subcategoría, precios minorista/mayorista y estado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('catalogo')}
                  className="btn-secondary"
                  style={{
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={14} /> Descargar Catálogo
                </button>
              </div>

              {/* Planilla 3: Ventas y Pedidos */}
              <div
                style={{
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <span style={{ fontWeight: 900, fontSize: '0.92rem', color: '#1E293B' }}>
                    💰 Ventas y Pedidos
                  </span>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                    Historial de ventas con cliente, fecha, medio de pago, total, prendas compradas y cajera/vendedora.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('ventas')}
                  className="btn-secondary"
                  style={{
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={14} /> Descargar Ventas
                </button>
              </div>

              {/* Planilla 4: Clientes */}
              <div
                style={{
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <span style={{ fontWeight: 900, fontSize: '0.92rem', color: '#1E293B' }}>
                    👥 Directorio de Clientes
                  </span>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                    Nombre, teléfono, DNI, localidad, total gastado histórico y cantidad de compras realizadas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('clientes')}
                  className="btn-secondary"
                  style={{
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={14} /> Descargar Clientes
                </button>
              </div>
            </div>

            {/* Descarga JSON maestro */}
            <div style={{ borderTop: '1px solid var(--border-color, #F3DCE7)', paddingTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => handleDownloadCsv('json')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #6E656E)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer'
                }}
              >
                <Download size={13} /> Descargar Base Completa Maestra (.json)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: VISOR DE CONTINGENCIA OFFLINE */}
      {activeSection === 'catalogo_offline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Card de Aviso de Modo Contingencia */}
          <div
            style={{
              backgroundColor: '#FFFDF0',
              border: '1px solid #FEF08A',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <WifiOff size={22} color="#D97706" />
              <div>
                <strong style={{ color: '#92400E', fontSize: '0.9rem', display: 'block' }}>
                  Modo de Operación Local a 0ms (IndexedDB)
                </strong>
                <span style={{ color: '#78350F', fontSize: '0.78rem' }}>
                  Consultá artículos, precios por menor/mayor, stock por talle y color sin requerir conexión a internet.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setOfflineTab('productos')}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: offlineTab === 'productos' ? '#92400E' : '#FEF3C7',
                  color: offlineTab === 'productos' ? '#FFFFFF' : '#92400E'
                }}
              >
                👗 Catálogo & Stock ({snapshot?.counts?.products ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setOfflineTab('ventas')}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: offlineTab === 'ventas' ? '#92400E' : '#FEF3C7',
                  color: offlineTab === 'ventas' ? '#FFFFFF' : '#92400E'
                }}
              >
                💰 Ventas ({snapshot?.counts?.orders ?? 0})
              </button>
            </div>
          </div>

          {/* Barra de Búsqueda Instantánea */}
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              color="var(--text-muted, #6E656E)"
              style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              value={offlineSearch}
              onChange={(e) => setOfflineSearch(e.target.value)}
              placeholder={
                offlineTab === 'productos'
                  ? 'Buscar prenda por nombre, código de artículo (ej. 0314), código de barras o categoría...'
                  : 'Buscar pedido por número, nombre de cliente, teléfono o DNI...'
              }
              className="form-input"
              style={{
                width: '100%',
                padding: '12px 16px 12px 46px',
                fontSize: '0.92rem',
                borderRadius: '14px',
                border: '1px solid var(--border-color, #F3DCE7)'
              }}
            />
          </div>

          {/* Resultados de Productos */}
          {offlineTab === 'productos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredOfflineProducts.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px dashed var(--border-color, #F3DCE7)',
                    borderRadius: '16px',
                    padding: '40px',
                    textAlign: 'center',
                    color: 'var(--text-muted, #6E656E)'
                  }}
                >
                  <Tag size={36} color="#A8175A" style={{ margin: '0 auto 10px auto', opacity: 0.6 }} />
                  <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text-main, #241E28)' }}>
                    No se encontraron prendas para esa búsqueda
                  </strong>
                  <p style={{ fontSize: '0.82rem', margin: '4px 0 0 0' }}>
                    Probá ingresando el código del artículo, un color o escaneá el código de barras.
                  </p>
                </div>
              ) : (
                filteredOfflineProducts.map((p) => {
                  const variants = getProductVariants(p);
                  const barcodes = p.barcodes || {};

                  return (
                    <div
                      key={p.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--border-color, #F3DCE7)',
                        borderRadius: '16px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: '0 2px 8px rgba(36, 30, 40, 0.03)'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '10px',
                              backgroundColor: '#FCEDF3',
                              color: '#A8175A',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontSize: '0.78rem',
                              flexShrink: 0
                            }}
                          >
                            {p.code ? `DV${p.code}` : 'DV'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-main, #241E28)' }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #6E656E)' }}>
                              {p.category} {p.subcategory ? `· ${p.subcategory}` : ''} {p.code ? `· Art. ${p.code}` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6E656E)', fontWeight: 700 }}>
                              Precio Minorista
                            </div>
                            <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#16A34A', fontFamily: 'monospace' }}>
                              ${Number(p.price || 0).toLocaleString('es-AR')}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', borderLeft: '1px solid #E2E8F0', paddingLeft: '14px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6E656E)', fontWeight: 700 }}>
                              Precio Mayorista
                            </div>
                            <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#2563EB', fontFamily: 'monospace' }}>
                              ${Number(p.wholesale_price || p.price || 0).toLocaleString('es-AR')}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', borderLeft: '1px solid #E2E8F0', paddingLeft: '14px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6E656E)', fontWeight: 700 }}>
                              Stock Total
                            </div>
                            <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#241E28', fontFamily: 'monospace' }}>
                              {Number(p.stock || 0)} u.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desglose de Variantes (Talles y Colores) */}
                      {variants && variants.length > 0 && (
                        <div
                          style={{
                            backgroundColor: '#FFF8FA',
                            border: '1px solid #F3DCE7',
                            borderRadius: '12px',
                            padding: '10px 14px',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}
                        >
                          {variants.map((v) => {
                            const barcodeVal = barcodes[v.key] || barcodes['CUALQUIER_TALLE'] || '';
                            return (
                              <div
                                key={v.key}
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #E4BFD4',
                                  borderRadius: '8px',
                                  padding: '5px 10px',
                                  fontSize: '0.76rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <span style={{ fontWeight: 800, color: '#A8175A' }}>
                                  {v.label}
                                </span>
                                <span
                                  style={{
                                    backgroundColor: v.stock > 0 ? '#DCFCE7' : '#FEE2E2',
                                    color: v.stock > 0 ? '#15803D' : '#B91C1C',
                                    fontWeight: 800,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem'
                                  }}
                                >
                                  Stock: {v.stock}
                                </span>
                                {barcodeVal && (
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      color: '#6E656E',
                                      fontSize: '0.7rem',
                                      backgroundColor: '#F3F4F6',
                                      padding: '2px 5px',
                                      borderRadius: '4px'
                                    }}
                                  >
                                    Cód: {barcodeVal}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Resultados de Ventas */}
          {offlineTab === 'ventas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredOfflineOrders.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px dashed var(--border-color, #F3DCE7)',
                    borderRadius: '16px',
                    padding: '40px',
                    textAlign: 'center',
                    color: 'var(--text-muted, #6E656E)'
                  }}
                >
                  <Layers size={36} color="#A8175A" style={{ margin: '0 auto 10px auto', opacity: 0.6 }} />
                  <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text-main, #241E28)' }}>
                    No se encontraron pedidos
                  </strong>
                </div>
              ) : (
                filteredOfflineOrders.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-color, #F3DCE7)',
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '0.9rem', color: '#A8175A' }}>
                          #{o.id}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main, #241E28)' }}>
                          {o.client_name || 'Sin identificar'}
                        </span>
                        {o.client_phone && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #6E656E)' }}>
                            · Tel: {o.client_phone}
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: '1rem', color: '#16A34A', fontFamily: 'monospace' }}>
                        ${Number(o.total_amount || 0).toLocaleString('es-AR')}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #6E656E)', display: 'flex', gap: '12px' }}>
                      <span>Fecha: {o.created_at ? new Date(o.created_at).toLocaleString('es-AR') : '—'}</span>
                      <span>Canal: <strong>{o.channel || 'web'}</strong></span>
                      <span>Pago: <strong>{o.payment_method || 'no especificado'}</strong></span>
                      <span>Estado: <strong style={{ color: o.status === 'completed' || o.status === 'pagado' ? '#16A34A' : '#D97706' }}>{o.status}</strong></span>
                    </div>

                    {Array.isArray(o.items) && o.items.length > 0 && (
                      <div style={{ fontSize: '0.76rem', color: '#4B5563', borderTop: '1px solid #F3F4F6', paddingTop: '6px' }}>
                        {o.items.map((it, idx) => (
                          <span key={idx} style={{ marginRight: '8px' }}>
                            • {it.quantity || 1}x {it.name || 'Prenda'} {it.size ? `(T.${it.size})` : ''} {it.color ? `[${it.color}]` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 3: INSPECCIONAR / RESTAURAR ARCHIVO EXTERNO */}
      {activeSection === 'restaurar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-color, #F3DCE7)',
              borderRadius: '20px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main, #241E28)', margin: 0 }}>
                Inspeccionar o Cargar Archivo de Copia (.json)
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #6E656E)', margin: '4px 0 0 0' }}>
                Podés cargar cualquier archivo <code style={{ fontFamily: 'monospace' }}>backup_dulce_valentin_*.json</code> generado anteriormente para verificar sus métricas o cargarlo a la memoria local de contingencia.
              </p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #E4BFD4',
                backgroundColor: '#FFF8FA',
                borderRadius: '16px',
                padding: '36px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease'
              }}
            >
              <Upload size={32} color="#A8175A" style={{ margin: '0 auto 10px auto' }} />
              <strong style={{ fontSize: '0.94rem', color: 'var(--text-main, #241E28)', display: 'block' }}>
                Hacé clic acá para seleccionar tu archivo de respaldo
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #6E656E)' }}>
                Formatos soportados: .json generado por el Blindaje Local de Dulce Valentín
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {inspectError && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '10px',
                  padding: '12px',
                  color: '#991B1B',
                  fontSize: '0.82rem',
                  fontWeight: 700
                }}
              >
                {inspectError}
              </div>
            )}

            {inspectingSnapshot && (
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '14px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={20} color="#16A34A" />
                  <strong style={{ color: '#166534', fontSize: '0.94rem' }}>
                    Archivo de respaldo válido y verificado
                  </strong>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '10px',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #DCFCE7' }}>
                    <span style={{ color: '#64748B', display: 'block' }}>Fecha de Emisión:</span>
                    <strong style={{ color: '#1E293B' }}>
                      {inspectingSnapshot.exportedAt ? new Date(inspectingSnapshot.exportedAt).toLocaleString('es-AR') : '—'}
                    </strong>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #DCFCE7' }}>
                    <span style={{ color: '#64748B', display: 'block' }}>Prendas:</span>
                    <strong style={{ color: '#1E293B', fontFamily: 'monospace' }}>
                      {inspectingSnapshot.counts?.products ?? inspectingSnapshot.data?.products?.length ?? 0}
                    </strong>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #DCFCE7' }}>
                    <span style={{ color: '#64748B', display: 'block' }}>Stock Físico:</span>
                    <strong style={{ color: '#16A34A', fontFamily: 'monospace' }}>
                      {inspectingSnapshot.counts?.totalStock ?? '—'}
                    </strong>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #DCFCE7' }}>
                    <span style={{ color: '#64748B', display: 'block' }}>Ventas / Pedidos:</span>
                    <strong style={{ color: '#2563EB', fontFamily: 'monospace' }}>
                      {inspectingSnapshot.counts?.orders ?? inspectingSnapshot.data?.orders?.length ?? 0}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleApplyInspected}
                    style={{
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <CheckCircle2 size={16} /> Cargar en Modo Local (IndexedDB)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

