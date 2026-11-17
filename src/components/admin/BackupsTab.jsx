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
  HelpCircle,
  Tag,
  Clock,
  ArrowUpRight,
  Database,
  CheckCheck,
  Activity
} from 'lucide-react';
import BackupGuideModal from '@/components/admin/BackupGuideModal';
import { adminFetch } from '@/lib/adminFetch';
import {
  saveLocalSnapshot,
  loadLocalSnapshot,
  getLocalSnapshotMeta,
  searchLocalProducts,
  searchLocalOrders,
  triggerBrowserFileDownload,
  generateCsv
} from '@/lib/localDatabase';
import { getProductVariants } from '@/lib/barcode';

export default function BackupsTab({ products = [], orders = [], clients = [] }) {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Sub-pestañas internas
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
    const updateConnection = () => setIsOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    const m = getLocalSnapshotMeta();
    setMeta(m);

    // Cargar snapshot desde IndexedDB
    loadLocalSnapshot().then((s) => {
      if (s) {
        setSnapshot(s);
      }
    });

    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  const showToast = (text, type = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 6000);
  };

  // Métricas en vivo (combinando props del sistema con snapshot)
  const liveMetrics = useMemo(() => {
    const totalProducts = snapshot?.counts?.products ?? products?.length ?? 0;
    const totalStock = snapshot?.counts?.totalStock ?? (
      Array.isArray(products)
        ? products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0)
        : 0
    );
    const totalOrders = snapshot?.counts?.orders ?? orders?.length ?? 0;
    const totalClients = snapshot?.counts?.clients ?? clients?.length ?? 0;

    return { totalProducts, totalStock, totalOrders, totalClients };
  }, [snapshot, products, orders, clients]);

  // Sincronizar y Respaldar en 1 Clic
  const handleSyncBackup = async () => {
    if (isOffline) {
      showToast('Sin conexión: el respaldo se genera desde la nube. Mientras tanto podés consultar la copia guardada en "Visor de Contingencia Offline".', 'warning');
      return;
    }
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

      // 3. Disparar descarga de la planilla de stock por talle y color (esencial para el local)
      if (data.csvFiles?.stockVariantes) {
        triggerBrowserFileDownload(
          data.csvFiles.stockVariantes,
          `stock_por_talle_y_color_${data.timestamp.slice(0, 10)}.csv`,
          'text/csv;charset=utf-8'
        );
      }

      const missingNote = data.missingTables?.length
        ? ` (Tablas inexistentes, omitidas: ${data.missingTables.join(', ')})`
        : '';
      if (data.savedToDisk) {
        showToast(
          `¡Respaldo exitoso! Guardado en "${data.backupDir}" y descargado en el navegador.${missingNote}`,
          'success'
        );
      } else {
        showToast(
          `Respaldo descargado en el navegador (revisá tu carpeta de Descargas). NO se guardó en disco: ${data.diskError || 'error desconocido'}${missingNote}`,
          'warning'
        );
      }
    } catch (err) {
      console.error('Error al realizar backup:', err);
      showToast(`Error al respaldar: ${err.message || 'No se pudo conectar con el servidor'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Copiar ruta al portapapeles
  const handleCopyPath = () => {
    const path = meta?.windowsPath || snapshot?.windowsPath;
    if (!path) {
      showToast('Todavía no hay una copia guardada en disco para copiar su ruta.', 'warning');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2500);
    }
  };


  // Descargar CSV individual
  const handleDownloadCsv = (type) => {
    const sourceProducts = snapshot?.data?.products || products || [];
    const sourceOrders = snapshot?.data?.orders || orders || [];
    const sourceClients = snapshot?.data?.wholesaleClients || clients || [];

    const dateStr = (snapshot?.exportedAt || new Date().toISOString()).slice(0, 10);

    if (type === 'catalogo') {
      const rows = sourceProducts.map((p) => ({
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
      sourceProducts.forEach((p) => {
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
      const rows = sourceOrders.map((o) => {
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

      sourceClients.forEach((wc) => {
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

      sourceOrders.forEach((o) => {
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
      const dataToSave = snapshot || {
        version: '1.0.0-local-first',
        exportedAt: new Date().toISOString(),
        data: { products, orders, wholesaleClients: clients }
      };
      const jsonStr = JSON.stringify(dataToSave, null, 2);
      triggerBrowserFileDownload(jsonStr, `backup_dulce_valentin_${dateStr}.json`, 'application/json;charset=utf-8');
      showToast('Base completa JSON descargada.', 'success');
    }
  };

  // Carga e inspección de archivo de respaldo
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

  // Aplicar respaldo inspeccionado a la memoria local
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
    const list = snapshot?.data?.products || products || [];
    return searchLocalProducts({ data: { products: list } }, offlineSearch);
  }, [snapshot, products, offlineSearch]);

  // Filtrado de ventas en catálogo offline
  const filteredOfflineOrders = useMemo(() => {
    const list = snapshot?.data?.orders || orders || [];
    return searchLocalOrders({ data: { orders: list } }, offlineSearch);
  }, [snapshot, orders, offlineSearch]);

  const lastBackupDateText = useMemo(() => {
    const raw = meta?.exportedAt || snapshot?.exportedAt;
    if (!raw) return 'Aún no realizado en esta sesión';
    try {
      const d = new Date(raw);
      return d.toLocaleDateString('es-AR') + ' · ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return raw;
    }
  }, [meta, snapshot]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', paddingBottom: '60px' }}>
      {/* Guía Modal Paso a Paso */}
      <BackupGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        step={guideStep}
        onNext={() => setGuideStep((s) => Math.min(4, s + 1))}
        onPrev={() => setGuideStep((s) => Math.max(1, s - 1))}
        onFinish={() => setShowGuide(false)}
      />

      {/* Toast Flotante */}
      {feedbackMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: feedbackMsg.type === 'error' ? '#991B1B' : feedbackMsg.type === 'warning' ? '#B45309' : '#065F46',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.86rem',
            fontWeight: 800,
            maxWidth: '500px',
            border: '1px solid rgba(255,255,255,0.15)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {feedbackMsg.type === 'error' ? (
            <AlertTriangle size={18} />
          ) : feedbackMsg.type === 'warning' ? (
            <WifiOff size={18} />
          ) : (
            <CheckCircle2 size={18} color="#34D399" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Cabecera Principal - Adaptativa High-Craft */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid var(--border-color, #423262)',
          paddingBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(245, 85, 157, 0.2) 0%, rgba(168, 23, 90, 0.1) 100%)',
              color: 'var(--accent-gold, #F5559D)',
              border: '1px solid var(--border-color-strong, #55407A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(245, 85, 157, 0.15)'
            }}
          >
            <ShieldCheck size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main, #F3EDE6)', margin: 0, letterSpacing: '-0.02em' }}>
              Copias de Seguridad y Blindaje Local-First
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #B3A9AF)', margin: '2px 0 0 0' }}>
              Respaldo en 1 clic, planillas para Excel y consulta sin internet con la copia guardada en este navegador.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              setGuideStep(1);
              setShowGuide(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #423262)',
              background: 'var(--bg-card, #2E1F42)',
              color: 'var(--text-main, #F3EDE6)',
              transition: 'all 0.2s ease'
            }}
          >
            <HelpCircle size={15} color="var(--accent-gold, #F5559D)" />
            ¿Cómo funciona esta pantalla?
          </button>

          {/* Estado de la conexion (automatico: ya no hace falta activar un modo a mano) */}
          <span
            role="status"
            title={isOffline ? 'Sin internet: esta pantalla usa la copia guardada en este navegador.' : 'Conectado a la nube.'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: 800,
              borderRadius: '10px',
              border: isOffline ? '1px solid #F59E0B' : '1px solid rgba(52, 211, 153, 0.4)',
              background: isOffline ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.12)',
              color: isOffline ? '#FBBF24' : '#34D399'
            }}
          >
            {isOffline ? (
              <>
                <WifiOff size={15} /> Sin conexión: usando copia local
              </>
            ) : (
              <>
                <Wifi size={15} /> Conectado (nube)
              </>
            )}
          </span>
        </div>
      </div>

      {/* Sub-Navegación de Secciones (Pills) */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color, #423262)', paddingBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setActiveSection('operaciones')}
          style={{
            padding: '8px 16px',
            fontSize: '0.84rem',
            fontWeight: 800,
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSection === 'operaciones' ? 'var(--dv-accent-fill, #C2185B)' : 'transparent',
            color: activeSection === 'operaciones' ? '#FFFFFF' : 'var(--text-muted, #B3A9AF)',
            transition: 'all 0.2s ease'
          }}
        >
          ⚡ Panel de Respaldo & Excel
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('catalogo_offline')}
          style={{
            padding: '8px 16px',
            fontSize: '0.84rem',
            fontWeight: 800,
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSection === 'catalogo_offline' ? 'var(--dv-accent-fill, #C2185B)' : 'transparent',
            color: activeSection === 'catalogo_offline' ? '#FFFFFF' : 'var(--text-muted, #B3A9AF)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <Barcode size={15} /> Visor de Contingencia Offline
          <span
            style={{
              backgroundColor: activeSection === 'catalogo_offline' ? 'rgba(255,255,255,0.2)' : 'rgba(245, 85, 157, 0.15)',
              color: activeSection === 'catalogo_offline' ? '#FFFFFF' : 'var(--accent-gold, #F5559D)',
              fontSize: '0.72rem',
              padding: '2px 7px',
              borderRadius: '6px',
              fontWeight: 900
            }}
          >
            {liveMetrics.totalProducts} prendas
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('restaurar')}
          style={{
            padding: '8px 16px',
            fontSize: '0.84rem',
            fontWeight: 800,
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSection === 'restaurar' ? 'var(--dv-accent-fill, #C2185B)' : 'transparent',
            color: activeSection === 'restaurar' ? '#FFFFFF' : 'var(--text-muted, #B3A9AF)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <Upload size={15} /> Inspeccionar Copia Externa
        </button>
      </div>

      {/* SECCIÓN 1: PANEL DE RESPALDO & EXCEL */}
      {activeSection === 'operaciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Card Hero Principal: Respaldo 1 Clic con Estética de Alta Gama */}
          <div
            style={{
              background: 'linear-gradient(145deg, rgba(194, 24, 91, 0.12) 0%, rgba(23, 14, 36, 0.5) 100%), var(--bg-card, #2E1F42)',
              border: '1px solid var(--border-color-strong, #55407A)',
              borderRadius: '22px',
              padding: '24px 26px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              position: 'relative',
              overflow: 'hidden'
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      color: '#34D399',
                      backgroundColor: 'rgba(16, 185, 129, 0.14)',
                      border: '1px solid rgba(52, 211, 153, 0.3)',
                      padding: '3px 9px',
                      borderRadius: '8px',
                      letterSpacing: '0.06em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <CheckCheck size={13} /> Doble Respaldo Físico & Navegador
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 900,
                    color: 'var(--text-main, #F3EDE6)',
                    margin: '0 0 4px 0',
                    letterSpacing: '-0.02em'
                  }}
                >
                  Respaldo Completo en 1 Clic
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted, #B3A9AF)', margin: 0, lineHeight: 1.45 }}>
                  Descarga la base completa y la planilla de stock a tu carpeta de Descargas y la deja guardada en este navegador para usarla sin internet. La copia automática en la PC del local la hace el programa de la impresora.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSyncBackup}
                disabled={loading}
                style={{
                  background: loading
                    ? '#6B7280'
                    : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '14px 28px',
                  fontSize: '0.96rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.32)',
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

            {/* Banner de Carpeta Windows (Estilo Terminal Sleek) */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface-dark, #170E24)',
                border: '1px solid var(--border-color, #423262)',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 85, 157, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-gold, #F5559D)'
                  }}
                >
                  <FolderCheck size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #B3A9AF)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Copia en disco:
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main, #F3EDE6)' }}>
                    {meta?.windowsPath || snapshot?.windowsPath || 'Sin copia en disco (solo descarga del navegador)'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #B3A9AF)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={13} />
                  Último respaldo: <strong style={{ color: 'var(--text-main, #F3EDE6)' }}>{lastBackupDateText}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleCopyPath}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color-strong, #55407A)',
                    background: 'var(--bg-card, #2E1F42)',
                    color: 'var(--text-main, #F3EDE6)',
                    transition: 'all 0.2s ease'
                  }}
                  title="Copiar ruta de Windows"
                >
                  {copiedPath ? (
                    <>
                      <Check size={14} color="#34D399" /> ¡Copiada!
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

          {/* Tarjetas Bento de Métricas - Rediseño de Autor */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px'
            }}
          >
            {/* Card 1: Prendas */}
            <div
              style={{
                background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.2) 100%), var(--bg-card, #2E1F42)',
                border: '1px solid var(--border-color, #423262)',
                borderRadius: '18px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #B3A9AF)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Prendas en Catálogo
                </span>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 85, 157, 0.14)',
                    color: 'var(--accent-gold, #F5559D)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(245, 85, 157, 0.25)'
                  }}
                >
                  <Tag size={19} />
                </div>
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--text-main, #F3EDE6)', fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
                {liveMetrics.totalProducts.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--accent-gold, #F5559D)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold, #F5559D)' }} />
                Variantes por talle y color activas
              </div>
            </div>

            {/* Card 2: Stock */}
            <div
              style={{
                background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.2) 100%), var(--bg-card, #2E1F42)',
                border: '1px solid var(--border-color, #423262)',
                borderRadius: '18px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #B3A9AF)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Stock Físico Total
                </span>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(16, 185, 129, 0.14)',
                    color: '#34D399',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(16, 185, 129, 0.25)'
                  }}
                >
                  <Package size={19} />
                </div>
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#34D399', fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
                {liveMetrics.totalStock > 0 ? liveMetrics.totalStock.toLocaleString('es-AR') : '—'} <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-muted, #B3A9AF)' }}>u.</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#34D399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34D399' }} />
                Unidades físicas en depósito y local
              </div>
            </div>

            {/* Card 3: Ventas */}
            <div
              style={{
                background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.2) 100%), var(--bg-card, #2E1F42)',
                border: '1px solid var(--border-color, #423262)',
                borderRadius: '18px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #B3A9AF)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Ventas y Pedidos
                </span>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.14)',
                    color: '#60A5FA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(59, 130, 246, 0.25)'
                  }}
                >
                  <Layers size={19} />
                </div>
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#60A5FA', fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
                {liveMetrics.totalOrders.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#60A5FA', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#60A5FA' }} />
                Tickets emitidos web, local y caja
              </div>
            </div>

            {/* Card 4: Clientes */}
            <div
              style={{
                background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.2) 100%), var(--bg-card, #2E1F42)',
                border: '1px solid var(--border-color, #423262)',
                borderRadius: '18px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #B3A9AF)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Directorio Clientes
                </span>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 158, 11, 0.14)',
                    color: '#FBBF24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(245, 158, 11, 0.25)'
                  }}
                >
                  <Users size={19} />
                </div>
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#FBBF24', fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
                {liveMetrics.totalClients.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#FBBF24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FBBF24' }} />
                Clientes mayoristas con historial
              </div>
            </div>
          </div>

          {/* Sección de Descarga de Planillas Excel - Bento Grid */}
          <div
            style={{
              backgroundColor: 'var(--bg-card, #2E1F42)',
              border: '1px solid var(--border-color, #423262)',
              borderRadius: '22px',
              padding: '24px 26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main, #F3EDE6)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} color="#34D399" />
                Descargar Planillas Listas para Excel (.csv)
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #B3A9AF)', margin: '4px 0 0 0' }}>
                Formato UTF-8 con punto y coma. Se abren directamente con doble clic en Windows sin errores de caracteres ni columnas desplazadas.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px'
              }}
            >
              {/* Planilla 1: Stock Detallado */}
              <div
                style={{
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.1) 0%, rgba(23, 14, 36, 0.4) 100%), var(--bg-card, #2E1F42)',
                  borderRadius: '16px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 900, fontSize: '0.94rem', color: '#34D399' }}>
                      🏷️ Stock por Talle y Color
                    </span>
                    <span style={{ fontSize: '11px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34D399', padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>
                      Esencial Local
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #B3A9AF)', margin: '6px 0 0 0', lineHeight: 1.45 }}>
                    Desglose de cada variante física con su talle, color, stock disponible y código de barras asignado.
                  </p>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Art.</span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Talle</span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Color</span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Código Barras</span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Stock</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('stockVariantes')}
                  style={{
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '9px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Download size={14} /> Descargar Excel Stock
                </button>
              </div>

              {/* Planilla 2: Catálogo General */}
              <div
                style={{
                  border: '1px solid var(--border-color, #423262)',
                  background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.02) 0%, rgba(0, 0, 0, 0.2) 100%), var(--bg-card, #2E1F42)',
                  borderRadius: '16px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 900, fontSize: '0.94rem', color: 'var(--text-main, #F3EDE6)' }}>
                      📊 Catálogo de Prendas
                    </span>
                    <span style={{ fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-muted, #B3A9AF)', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                      Precios
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #B3A9AF)', margin: '6px 0 0 0', lineHeight: 1.45 }}>
                    Lista completa con código, nombre, categoría, precios minorista/mayorista y stock total.
                  </p>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Minorista</span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Mayorista</span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Ventas</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('catalogo')}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated, #3A2854)',
                    color: 'var(--text-main, #F3EDE6)',
                    border: '1px solid var(--border-color-strong, #55407A)',
                    borderRadius: '10px',
                    padding: '9px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Download size={14} /> Descargar Catálogo
                </button>
              </div>

              {/* Planilla 3: Ventas y Pedidos */}
              <div
                style={{
                  border: '1px solid var(--border-color, #423262)',
                  background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.02) 0%, rgba(0, 0, 0, 0.2) 100%), var(--bg-card, #2E1F42)',
                  borderRadius: '16px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 900, fontSize: '0.94rem', color: '#60A5FA' }}>
                      💰 Ventas y Pedidos
                    </span>
                    <span style={{ fontSize: '11px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                      Auditoría
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #B3A9AF)', margin: '6px 0 0 0', lineHeight: 1.45 }}>
                    Historial de ventas con cliente, fecha, medio de pago, total, prendas y cajera/vendedora.
                  </p>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Ticket #</span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Cliente</span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Medio Pago</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('ventas')}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated, #3A2854)',
                    color: 'var(--text-main, #F3EDE6)',
                    border: '1px solid var(--border-color-strong, #55407A)',
                    borderRadius: '10px',
                    padding: '9px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Download size={14} /> Descargar Ventas
                </button>
              </div>

              {/* Planilla 4: Clientes */}
              <div
                style={{
                  border: '1px solid var(--border-color, #423262)',
                  background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.02) 0%, rgba(0, 0, 0, 0.2) 100%), var(--bg-card, #2E1F42)',
                  borderRadius: '16px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 900, fontSize: '0.94rem', color: '#FBBF24' }}>
                      👥 Directorio de Clientes
                    </span>
                    <span style={{ fontSize: '11px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                      Contactos
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #B3A9AF)', margin: '6px 0 0 0', lineHeight: 1.45 }}>
                    Nombre, teléfono, DNI, localidad, total gastado histórico y cantidad de compras realizadas.
                  </p>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>WhatsApp</span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Localidad</span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #B3A9AF)' }}>Total $</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('clientes')}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated, #3A2854)',
                    color: 'var(--text-main, #F3EDE6)',
                    border: '1px solid var(--border-color-strong, #55407A)',
                    borderRadius: '10px',
                    padding: '9px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Download size={14} /> Descargar Clientes
                </button>
              </div>
            </div>

            {/* Descarga JSON maestro */}
            <div style={{ borderTop: '1px solid var(--border-color, #423262)', paddingTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => handleDownloadCsv('json')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #B3A9AF)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  transition: 'color 0.2s ease'
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
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <WifiOff size={22} color="#FBBF24" />
              <div>
                <strong style={{ color: '#FBBF24', fontSize: '0.92rem', display: 'block' }}>
                  Copia guardada en este navegador (funciona sin internet)
                </strong>
                <span style={{ color: 'var(--text-muted, #B3A9AF)', fontSize: '0.78rem' }}>
                  Consultá artículos, precios por menor/mayor, stock por talle y color sin requerir conexión a internet.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setOfflineTab('productos')}
                style={{
                  padding: '7px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: offlineTab === 'productos' ? 'var(--dv-accent-fill, #C2185B)' : 'rgba(255,255,255,0.06)',
                  color: offlineTab === 'productos' ? '#FFFFFF' : 'var(--text-muted, #B3A9AF)'
                }}
              >
                👗 Catálogo & Stock ({liveMetrics.totalProducts})
              </button>
              <button
                type="button"
                onClick={() => setOfflineTab('ventas')}
                style={{
                  padding: '7px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: offlineTab === 'ventas' ? 'var(--dv-accent-fill, #C2185B)' : 'rgba(255,255,255,0.06)',
                  color: offlineTab === 'ventas' ? '#FFFFFF' : 'var(--text-muted, #B3A9AF)'
                }}
              >
                💰 Ventas ({liveMetrics.totalOrders})
              </button>
            </div>
          </div>

          {/* Barra de Búsqueda Instantánea */}
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              color="var(--text-muted, #B3A9AF)"
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
                border: '1px solid var(--border-color, #423262)',
                background: 'var(--bg-card, #2E1F42)',
                color: 'var(--text-main, #F3EDE6)'
              }}
            />
          </div>

          {/* Resultados de Productos */}
          {offlineTab === 'productos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredOfflineProducts.length === 0 ? (
                <div
                  style={{
                    backgroundColor: 'var(--bg-card, #2E1F42)',
                    border: '1px dashed var(--border-color, #423262)',
                    borderRadius: '16px',
                    padding: '40px',
                    textAlign: 'center',
                    color: 'var(--text-muted, #B3A9AF)'
                  }}
                >
                  <Tag size={36} color="var(--accent-gold, #F5559D)" style={{ margin: '0 auto 10px auto', opacity: 0.6 }} />
                  <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text-main, #F3EDE6)' }}>
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
                        backgroundColor: 'var(--bg-card, #2E1F42)',
                        border: '1px solid var(--border-color, #423262)',
                        borderRadius: '16px',
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
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
                              backgroundColor: 'rgba(245, 85, 157, 0.14)',
                              color: 'var(--accent-gold, #F5559D)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontSize: '0.78rem',
                              flexShrink: 0,
                              border: '1px solid rgba(245, 85, 157, 0.25)'
                            }}
                          >
                            {p.code ? `DV${p.code}` : 'DV'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-main, #F3EDE6)' }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #B3A9AF)' }}>
                              {p.category} {p.subcategory ? `· ${p.subcategory}` : ''} {p.code ? `· Art. ${p.code}` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #B3A9AF)', fontWeight: 700 }}>
                              Precio Minorista
                            </div>
                            <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#34D399', fontFamily: 'monospace' }}>
                              ${Number(p.price || 0).toLocaleString('es-AR')}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-color, #423262)', paddingLeft: '16px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #B3A9AF)', fontWeight: 700 }}>
                              Precio Mayorista
                            </div>
                            <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#60A5FA', fontFamily: 'monospace' }}>
                              ${Number(p.wholesale_price || p.price || 0).toLocaleString('es-AR')}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-color, #423262)', paddingLeft: '16px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #B3A9AF)', fontWeight: 700 }}>
                              Stock Total
                            </div>
                            <div style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-main, #F3EDE6)', fontFamily: 'monospace' }}>
                              {Number(p.stock || 0)} u.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desglose de Variantes (Talles y Colores) */}
                      {variants && variants.length > 0 && (
                        <div
                          style={{
                            backgroundColor: 'var(--bg-surface-dark, #170E24)',
                            border: '1px solid var(--border-color, #423262)',
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
                                  backgroundColor: 'var(--bg-card, #2E1F42)',
                                  border: '1px solid var(--border-color-strong, #55407A)',
                                  borderRadius: '8px',
                                  padding: '5px 10px',
                                  fontSize: '0.76rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <span style={{ fontWeight: 800, color: 'var(--accent-gold, #F5559D)' }}>
                                  {v.label}
                                </span>
                                <span
                                  style={{
                                    backgroundColor: v.stock > 0 ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)',
                                    color: v.stock > 0 ? '#34D399' : '#F87171',
                                    fontWeight: 900,
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
                                      color: 'var(--text-muted, #B3A9AF)',
                                      fontSize: '0.7rem',
                                      backgroundColor: 'rgba(255,255,255,0.06)',
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
                    backgroundColor: 'var(--bg-card, #2E1F42)',
                    border: '1px dashed var(--border-color, #423262)',
                    borderRadius: '16px',
                    padding: '40px',
                    textAlign: 'center',
                    color: 'var(--text-muted, #B3A9AF)'
                  }}
                >
                  <Layers size={36} color="var(--accent-gold, #F5559D)" style={{ margin: '0 auto 10px auto', opacity: 0.6 }} />
                  <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text-main, #F3EDE6)' }}>
                    No se encontraron pedidos
                  </strong>
                </div>
              ) : (
                filteredOfflineOrders.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      backgroundColor: 'var(--bg-card, #2E1F42)',
                      border: '1px solid var(--border-color, #423262)',
                      borderRadius: '16px',
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--accent-gold, #F5559D)' }}>
                          #{o.id}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main, #F3EDE6)' }}>
                          {o.client_name || 'Sin identificar'}
                        </span>
                        {o.client_phone && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #B3A9AF)' }}>
                            · Tel: {o.client_phone}
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: '1rem', color: '#34D399', fontFamily: 'monospace' }}>
                        ${Number(o.total_amount || 0).toLocaleString('es-AR')}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #B3A9AF)', display: 'flex', gap: '12px' }}>
                      <span>Fecha: {o.created_at ? new Date(o.created_at).toLocaleString('es-AR') : '—'}</span>
                      <span>Canal: <strong>{o.channel || 'web'}</strong></span>
                      <span>Pago: <strong>{o.payment_method || 'no especificado'}</strong></span>
                      <span>Estado: <strong style={{ color: o.status === 'completed' || o.status === 'pagado' ? '#34D399' : '#FBBF24' }}>{o.status}</strong></span>
                    </div>

                    {Array.isArray(o.items) && o.items.length > 0 && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #B3A9AF)', borderTop: '1px solid var(--border-color, #423262)', paddingTop: '6px' }}>
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
              backgroundColor: 'var(--bg-card, #2E1F42)',
              border: '1px solid var(--border-color, #423262)',
              borderRadius: '22px',
              padding: '24px 26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main, #F3EDE6)', margin: 0 }}>
                Inspeccionar o Cargar Archivo de Copia (.json)
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #B3A9AF)', margin: '4px 0 0 0' }}>
                Podés cargar cualquier archivo <code style={{ fontFamily: 'monospace' }}>backup_dulce_valentin_*.json</code> generado anteriormente para verificar sus métricas o cargarlo a la memoria local de contingencia.
              </p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-color-strong, #55407A)',
                backgroundColor: 'var(--bg-surface-dark, #170E24)',
                borderRadius: '16px',
                padding: '36px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease'
              }}
            >
              <Upload size={32} color="var(--accent-gold, #F5559D)" style={{ margin: '0 auto 10px auto' }} />
              <strong style={{ fontSize: '0.94rem', color: 'var(--text-main, #F3EDE6)', display: 'block' }}>
                Hacé clic acá para seleccionar tu archivo de respaldo
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #B3A9AF)' }}>
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
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #EF4444',
                  borderRadius: '10px',
                  padding: '12px',
                  color: '#F87171',
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
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  borderRadius: '16px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={20} color="#34D399" />
                  <strong style={{ color: '#34D399', fontSize: '0.94rem' }}>
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
                  <div style={{ backgroundColor: 'var(--bg-card, #2E1F42)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #423262)' }}>
                    <span style={{ color: 'var(--text-muted, #B3A9AF)', display: 'block' }}>Fecha de Emisión:</span>
                    <strong style={{ color: 'var(--text-main, #F3EDE6)' }}>
                      {inspectingSnapshot.exportedAt ? new Date(inspectingSnapshot.exportedAt).toLocaleString('es-AR') : '—'}
                    </strong>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card, #2E1F42)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #423262)' }}>
                    <span style={{ color: 'var(--text-muted, #B3A9AF)', display: 'block' }}>Prendas:</span>
                    <strong style={{ color: 'var(--text-main, #F3EDE6)', fontFamily: 'monospace' }}>
                      {inspectingSnapshot.counts?.products ?? inspectingSnapshot.data?.products?.length ?? 0}
                    </strong>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card, #2E1F42)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #423262)' }}>
                    <span style={{ color: 'var(--text-muted, #B3A9AF)', display: 'block' }}>Stock Físico:</span>
                    <strong style={{ color: '#34D399', fontFamily: 'monospace' }}>
                      {inspectingSnapshot.counts?.totalStock ?? '—'}
                    </strong>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card, #2E1F42)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #423262)' }}>
                    <span style={{ color: 'var(--text-muted, #B3A9AF)', display: 'block' }}>Ventas / Pedidos:</span>
                    <strong style={{ color: '#60A5FA', fontFamily: 'monospace' }}>
                      {inspectingSnapshot.counts?.orders ?? inspectingSnapshot.data?.orders?.length ?? 0}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleApplyInspected}
                    style={{
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 18px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    <CheckCircle2 size={16} /> Usar como copia local de este navegador
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
