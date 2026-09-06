'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Lock, ShieldCheck, ArrowLeft, KeyRound, Loader2, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { dataStore } from '@/lib/dataStore';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminTabsNav from '@/components/admin/AdminTabsNav';
import MetricsTab from '@/components/admin/MetricsTab';
import StockTab from '@/components/admin/StockTab';
import PricesTab from '@/components/admin/PricesTab';
import CategoriesTab from '@/components/admin/CategoriesTab';
import BulkImportTab from '@/components/admin/BulkImportTab';
import AddProductTab from '@/components/admin/AddProductTab';
import ImagesTab from '@/components/admin/ImagesTab';
import OrdersTab from '@/components/admin/OrdersTab';
import ClientsTab from '@/components/admin/ClientsTab';
import RaffleTab from '@/components/admin/RaffleTab';
import WhatsAppTab from '@/components/admin/WhatsAppTab';

// Desactivado a pedido: /api/admin/whatsapp usa SUPABASE_SERVICE_ROLE_KEY,
// que en .env.local todavia esta sin completar ("COMPLETAR_falta_la_secret_key..."),
// asi que cada llamada explota con 500. Hasta que se cargue la service role
// key real, se apaga toda la pestana y el polling/notificaciones de WhatsApp
// para que no siga generando errores en el server. Para reactivar: volver
// esto a "true" (y completar la key en .env.local).
const WHATSAPP_ENABLED = false;

export default function AdminPage() {
  // Admin Authentication State with Supabase Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [activeTab, setActiveTab] = useState('metrics');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [searchFilter, setSearchFilter] = useState('');
  const [editSuccessMsg, setEditSuccessMsg] = useState('');
  const [alias1Input, setAlias1Input] = useState('');
  const [alias2Input, setAlias2Input] = useState('');
  const [holderInput, setHolderInput] = useState('');
  const [cuitInput, setCuitInput] = useState('');
  
  // Mercado Pago Transfers State
  const [mpTransfers, setMpTransfers] = useState([]);
  const [mpConfigured, setMpConfigured] = useState(false);
  const [mpLoading, setMpLoading] = useState(false);

  // Notificaciones del navegador para mensajes nuevos de clientes (WhatsApp/chat
  // web), sin importar en que pestana del admin este parado. La pestana de
  // WhatsApp ya tiene su propio sonido mientras esta abierta; esto la
  // complementa avisando incluso estando en Pedidos, Stock, etc.
  const [notifPermission, setNotifPermission] = useState(undefined);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const handleRequestNotif = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  // Referencia a la pestana activa para leerla dentro del listener de
  // realtime sin tener que re-suscribirse cada vez que cambia.
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Aviso via notificacion del navegador cuando entra un mensaje nuevo de un
  // cliente (WhatsApp o chat web), sin importar en que pestana del admin este
  // parado. Si ya esta mirando la pestana de WhatsApp con la ventana
  // enfocada, el sonido propio de esa pestana ya avisa, asi que no duplica.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!WHATSAPP_ENABLED) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const notifyNewMessage = (chatPhone, content) => {
      if (Notification.permission !== 'granted') return;
      if (activeTabRef.current === 'whatsapp' && !document.hidden) return;
      try {
        const n = new Notification('Nuevo mensaje de cliente — Dulce Valentín', {
          body: `${chatPhone || 'Cliente'}: ${(content || '').slice(0, 150)}`,
          icon: '/logo.png',
          tag: 'dulcevalentin-nuevo-mensaje'
        });
        n.onclick = () => {
          window.focus();
          setActiveTab('whatsapp');
          n.close();
        };
      } catch (e) {}
    };

    let messagesChannel = null;
    if (supabase) {
      messagesChannel = supabase
        .channel('admin-whatsapp-messages-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: 'sender=eq.client' }, (payload) => {
          notifyNewMessage(payload.new.chat_phone, payload.new.content);
        })
        .subscribe();
    }

    // Red de seguridad: si el realtime no llega a disparar, este polling
    // detecta el aumento de mensajes sin leer y avisa igual.
    let prevUnreadTotal = null;
    const unreadPollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/whatsapp');
        const data = await res.json();
        if (!data.success || !Array.isArray(data.chats)) return;
        const total = data.chats.reduce((sum, c) => sum + (c.unread_count || 0), 0);
        if (prevUnreadTotal !== null && total > prevUnreadTotal) {
          const chatWithNew = data.chats.find((c) => c.unread_count > 0);
          notifyNewMessage(chatWithNew?.client_name || chatWithNew?.phone, chatWithNew?.last_message);
        }
        prevUnreadTotal = total;
      } catch (e) {}
    }, 15000);

    return () => {
      if (messagesChannel) supabase.removeChannel(messagesChannel);
      clearInterval(unreadPollInterval);
    };
  }, [isAuthenticated]);

  // Check active Supabase Auth session on mount
  useEffect(() => {
    let isMounted = true;

    async function checkAuthSession() {
      if (!supabase) {
        if (isMounted) setCheckingSession(false);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          if (session?.user) {
            setIsAuthenticated(true);
            setAdminUser(session.user);
          }
          setCheckingSession(false);
        }
      } catch (e) {
        if (isMounted) setCheckingSession(false);
      }
    }

    checkAuthSession();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          setIsAuthenticated(true);
          setAdminUser(session.user);
        } else {
          setIsAuthenticated(false);
          setAdminUser(null);
        }
      });

      return () => {
        isMounted = false;
        subscription?.unsubscribe();
      };
    }
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword;

    try {
      if (!supabase) {
        setLoginError('Supabase no está configurado. Contactá al desarrollador.');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (!error && data?.session) {
        setIsAuthenticated(true);
        setAdminUser(data.user);
      } else {
        setLoginError('Credenciales incorrectas.');
      }
    } catch (err) {
      setLoginError('Error de autenticación: ' + err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
    setAdminUser(null);
  };

  const fetchMpTransfers = async () => {
    setMpLoading(true);
    try {
      const res = await fetch('/api/mercadopago/transfers');
      const data = await res.json();
      if (data.success) {
        setMpTransfers(data.transfers || []);
        setMpConfigured(data.configured || false);
      }
    } catch (e) {
      console.error('Error fetching MP transfers:', e);
    } finally {
      setMpLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const updateState = () => {
      setProducts(dataStore.getProducts());
      setCategories(dataStore.getCategories());
      setOrders(dataStore.orders);
      setClients(dataStore.getClientsWithStats());
      setTickets(dataStore.getAllRaffleTickets());
      setMetrics(dataStore.getMetrics());

      const details = dataStore.getTransferDetails();
      setAlias1Input(details.alias1);
      setAlias2Input(details.alias2);
      setHolderInput(details.holder);
      setCuitInput(details.cuit);
    };

    updateState();
    fetchMpTransfers();

    const unsubscribe = dataStore.subscribe(updateState);

    // Escucha en tiempo real los pedidos nuevos que entran desde cualquier
    // dispositivo/cliente, para que la alerta sonora del panel realmente suene.
    let ordersChannel = null;
    if (supabase) {
      ordersChannel = supabase
        .channel('admin-orders-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          dataStore.handleRealtimeOrderInsert(payload.new);
        })
        .subscribe();
    }

    // Mismo mecanismo para los boletos del sorteo: la pestaña "Sorteo en
    // Vivo" se usa para transmitir por Instagram, asi que un boleto nuevo
    // tiene que aparecer solo mientras se esta al aire, sin refrescar.
    let raffleTicketsChannel = null;
    if (supabase) {
      raffleTicketsChannel = supabase
        .channel('admin-raffle-tickets-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raffle_tickets' }, (payload) => {
          dataStore.handleRealtimeTicketInsert(payload.new);
        })
        .subscribe();
    }

    // Red de seguridad: si el realtime no llega a disparar (sesion vieja,
    // reconexion del socket, etc.), este polling se asegura de que los
    // pedidos y boletos nuevos aparezcan solos sin depender de un refresh manual.
    const ordersPollInterval = setInterval(() => {
      dataStore.fetchOrdersFromSupabase();
      dataStore.fetchRaffleTicketsFromSupabase();
    }, 15000);

    return () => {
      unsubscribe();
      if (ordersChannel) supabase.removeChannel(ordersChannel);
      if (raffleTicketsChannel) supabase.removeChannel(raffleTicketsChannel);
      clearInterval(ordersPollInterval);
    };
  }, [isAuthenticated]);

  const showSuccessNotice = (msg) => {
    setEditSuccessMsg(msg);
    setTimeout(() => setEditSuccessMsg(''), 4000);
  };

  const handleSaveAlias = (e) => {
    e.preventDefault();
    dataStore.setTransferDetails({
      alias1: alias1Input,
      alias2: alias2Input,
      holder: holderInput,
      cuit: cuitInput
    });
    showSuccessNotice('¡Datos de transferencia bancaria actualizados exitosamente!');
  };

  const handleStockUpdate = (id, newStock) => {
    dataStore.updateStock(id, newStock);
    showSuccessNotice('Stock actualizado correctamente.');
  };

  const handleUpdateSizesColors = async (id, { sizes, stock_per_size, colors }) => {
    await dataStore.updateProduct(id, { sizes, stock_per_size, colors });
    showSuccessNotice('Talles y colores actualizados correctamente.');
  };

  const handleToggleActive = async (id, currentIsActive) => {
    await dataStore.updateProduct(id, { is_active: !currentIsActive });
    showSuccessNotice(!currentIsActive ? 'Producto activado: ya se muestra en la web.' : 'Producto desactivado: ya no se muestra en la web.');
  };

  const handlePriceUpdate = (id, newPrice, newWholesalePrice) => {
    dataStore.updatePrice(id, newPrice, newWholesalePrice);
    showSuccessNotice('Precio actualizado correctamente.');
  };

  const handlePricePercentageUpdate = (productIds, percentage, applyToList, applyToWholesale) => {
    dataStore.updatePricesByPercentage(productIds, percentage, applyToList, applyToWholesale);
    showSuccessNotice(`Precios incrementados un ${percentage}% correctamente.`);
  };

  const handleToggleOffer = (id, isOffer) => {
    dataStore.updateProduct(id, { is_offer: isOffer });
    showSuccessNotice(isOffer ? 'Producto marcado en oferta.' : 'Producto sacado de oferta.');
  };

  const handleToggleNew = (id, isNew) => {
    dataStore.updateProduct(id, { is_new: isNew });
    showSuccessNotice(isNew ? 'Producto marcado como Nuevo Ingreso: aparece primero en su categoría.' : 'Producto sacado de Nuevo Ingreso.');
  };

  const handleSetFeatured = (id) => {
    dataStore.setFeaturedProduct(id);
    showSuccessNotice('✓ Oferta Destacada actualizada. Ya se ve en el banner principal de la web.');
  };

  const handleUnsetFeatured = (id) => {
    dataStore.unsetFeaturedProduct(id);
    showSuccessNotice('Oferta Destacada quitada.');
  };

  const handleAddCategory = (name, subcategories) => {
    dataStore.addCategory(name, subcategories);
    showSuccessNotice(`Categoría "${name}" agregada con éxito.`);
  };

  const handleAddSubcategory = (categoryId, subcategoryName) => {
    dataStore.addSubcategory(categoryId, subcategoryName);
    showSuccessNotice(`Subcategoría "${subcategoryName}" agregada.`);
  };

  const handleDeleteCategory = (categoryId) => {
    dataStore.deleteCategory(categoryId);
    showSuccessNotice('Categoría eliminada.');
  };

  const handleDeleteSubcategory = (categoryId, subcategoryName) => {
    dataStore.deleteSubcategory(categoryId, subcategoryName);
    showSuccessNotice('Subcategoría eliminada.');
  };

  const handleCreateProduct = async (data) => {
    const created = await dataStore.createProduct(data);
    showSuccessNotice(`Producto creado con código ${created.code}.`);
    return created;
  };

  const handleBulkImport = (newProducts) => {
    // dataStore.bulkInsertProducts es el que arma el codigo unico automatico
    // (correlativo, 0001, 0002...) para cada producto que no traiga uno
    // propio. Antes esto llamaba a un metodo "addBulkProducts" que no existe
    // en dataStore, asi que la carga masiva quedaba rota en silencio.
    dataStore.bulkInsertProducts(newProducts);
    showSuccessNotice(`${newProducts.length} productos importados masivamente, cada uno con su código único.`);
  };

  const handleImageUpdate = (id, newImageUrl) => {
    dataStore.updateProduct(id, { image_url: newImageUrl });
    showSuccessNotice('Imagen del producto actualizada.');
  };

  const normalizeSearch = (str) =>
    (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  // Prioridad de cada match: coincidencia exacta de codigo primero, despues
  // que el codigo empiece con lo buscado, despues cualquier otro match
  // (nombre/categoria/codigo en cualquier posicion). Sin esto, cuando hay
  // varios productos que matchean, el que el admin realmente busca por
  // codigo puede terminar mezclado en cualquier posicion de la lista.
  const searchRank = (p, needle) => {
    const code = p.code ? normalizeSearch(p.code) : '';
    if (code === needle) return 0;
    if (code && code.startsWith(needle)) return 1;
    if (code && code.includes(needle)) return 2;
    return 3;
  };

  const filteredProducts = products
    .filter(p => {
      if (searchFilter === '') return true;
      const needle = normalizeSearch(searchFilter);
      return (
        normalizeSearch(p.name).includes(needle) ||
        normalizeSearch(p.category).includes(needle) ||
        normalizeSearch(p.subcategory).includes(needle) ||
        (p.code && normalizeSearch(p.code).includes(needle))
      );
    })
    .sort((a, b) => {
      if (searchFilter === '') return 0;
      const needle = normalizeSearch(searchFilter);
      return searchRank(a, needle) - searchRank(b, needle);
    });

  if (checkingSession) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-gold)' }} />
      </div>
    );
  }

  // RENDER ADMIN LOGIN FORM WITH SUPABASE AUTH IF NOT AUTHENTICATED
  if (!isAuthenticated) {
    return (
      <div style={{ 
        minHeight: '85vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '40px 20px',
        backgroundColor: 'var(--bg-page)'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '36px 30px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '50%', 
              backgroundColor: '#EFF6FF', 
              color: '#1D4ED8', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              <Lock size={28} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>Panel de Administración</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Autenticación oficial con Supabase Auth
            </p>
          </div>

          {loginError && (
            <div style={{ 
              backgroundColor: '#FEF2F2', 
              color: '#991B1B', 
              padding: '10px 14px', 
              borderRadius: '6px', 
              fontSize: '0.82rem', 
              marginBottom: '16px',
              border: '1px solid #FCA5A5',
              fontWeight: 600
            }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                Correo Electrónico de Administrador
              </label>
              <input 
                type="email" 
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="form-input"
                style={{ width: '100%', padding: '10px 12px' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                Contraseña de Administrador
              </label>
              <input 
                type="password" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="form-input"
                style={{ width: '100%', padding: '10px 12px' }}
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isLoggingIn}
              style={{ width: '100%', padding: '12px', justifyContent: 'center', fontSize: '0.92rem', fontWeight: 700 }}
            >
              {isLoggingIn ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={18} className="animate-spin" /> Conectando con Supabase Auth...
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <KeyRound size={18} /> Iniciar Sesión en Administración
                </span>
              )}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <Link href="/" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeft size={14} /> Volver a la Tienda Principal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // RENDER FULL ADMIN DASHBOARD IF AUTHENTICATED WITH SUPABASE AUTH
  return (
    <div style={{ paddingBottom: '60px' }}>
      <AdminHeader
        onLogout={handleAdminLogout}
        visitCount={metrics.visitCount}
        notifPermission={notifPermission}
        onRequestNotif={handleRequestNotif}
      />

      {editSuccessMsg && (
        <div style={{ 
          backgroundColor: '#ECFDF5', 
          color: '#047857', 
          padding: '12px 18px', 
          borderRadius: 'var(--radius-sm)', 
          fontWeight: 700, 
          marginBottom: '20px',
          border: '1px solid #A7F3D0' 
        }}>
          ✓ {editSuccessMsg}
        </div>
      )}

      <AdminTabsNav activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'metrics' && (
        <MetricsTab 
          metrics={metrics}
          products={products}
          orders={orders}
        />
      )}

      {WHATSAPP_ENABLED && activeTab === 'whatsapp' && (
        <WhatsAppTab />
      )}

      {activeTab === 'settings' && (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          maxWidth: '720px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #BFDBFE'
            }}>
              <CreditCard size={26} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Datos de Transferencia (Mercado Pago / Banco)
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Configurá los 2 Alias, Titular y CUIT/CUIL que verán tus clientes al momento de pagar en el carrito.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveAlias} style={{ marginTop: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                  Mercado Pago - Alias 1:
                </label>
                <input 
                  type="text" 
                  value={alias1Input} 
                  onChange={(e) => setAlias1Input(e.target.value.toLowerCase())}
                  placeholder="alias.dulcevalentin.completar" 
                  className="form-input"
                  style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    padding: '10px 14px',
                    fontFamily: 'monospace',
                    borderRadius: '8px',
                    border: '2px solid #BFDBFE',
                    backgroundColor: 'var(--bg-surface-elevated)'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                  Mercado Pago - Alias 2:
                </label>
                <input 
                  type="text" 
                  value={alias2Input} 
                  onChange={(e) => setAlias2Input(e.target.value.toLowerCase())}
                  placeholder="alias.dulcevalentin.completar" 
                  className="form-input"
                  style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    padding: '10px 14px',
                    fontFamily: 'monospace',
                    borderRadius: '8px',
                    border: '2px solid #BFDBFE',
                    backgroundColor: 'var(--bg-surface-elevated)'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                  Nombre del Titular de la Cuenta:
                </label>
                <input 
                  type="text" 
                  value={holderInput} 
                  onChange={(e) => setHolderInput(e.target.value)}
                  placeholder="María Leandra Bernardi" 
                  className="form-input"
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                  CUIT / CUIL del Titular:
                </label>
                <input 
                  type="text" 
                  value={cuitInput} 
                  onChange={(e) => setCuitInput(e.target.value)}
                  placeholder="27-30938323-6" 
                  className="form-input"
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="submit" className="btn-hero-primary" style={{ padding: '12px 24px', borderRadius: '10px', fontWeight: 800 }}>
                ✓ Guardar y Publicar Datos de Transferencia
              </button>

              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Se actualizarán automáticamente en la pantalla de pago de todos los clientes.
              </span>
            </div>
          </form>

          {/* Customer Preview Card */}
          <div style={{
            marginTop: '28px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              👁️ Vista previa de cómo lo verán tus clientes en el carrito:
            </div>
            <div style={{
              backgroundColor: '#EFF6FF',
              border: '2px dashed #3B82F6',
              borderRadius: '10px',
              padding: '14px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                💳 Datos para Transferencia (Mercado Pago)
              </div>
              <div style={{ fontSize: '0.8rem', color: '#1E3A8A', margin: '6px 0 10px 0', fontWeight: 600 }}>
                <strong>Titular:</strong> {holderInput || 'María Leandra Bernardi'} | <strong>CUIT:</strong> {cuitInput || '27-30938323-6'}
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #BFDBFE',
                padding: '6px 14px',
                borderRadius: '8px',
                margin: '4px 0'
              }}>
                <span style={{ fontSize: '1rem', fontWeight: 900, color: '#1D4ED8', fontFamily: 'monospace' }}>
                  Alias 1: {alias1Input || 'alias.dulcevalentin.completar'}
                </span>
              </div>
              {alias2Input && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #BFDBFE',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  margin: '4px 0 10px 8px'
                }}>
                  <span style={{ fontSize: '1rem', fontWeight: 900, color: '#1D4ED8', fontFamily: 'monospace' }}>
                    Alias 2: {alias2Input}
                  </span>
                </div>
              )}
              <p style={{ fontSize: '0.75rem', color: '#1E40AF', margin: 0, fontWeight: 600 }}>
                Podés adjuntar tu comprobante de pago subiendo la foto desde esta pantalla o enviárnoslo por WhatsApp junto con tu pedido.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stock' && (
        <StockTab 
          products={filteredProducts}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          onUpdateStock={handleStockUpdate}
          onUpdateSizesColors={handleUpdateSizesColors}
          onToggleActive={handleToggleActive}
        />
      )}

      {activeTab === 'prices' && (
        <PricesTab 
          products={filteredProducts}
          allProductsCount={products.length}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          onUpdatePrice={handlePriceUpdate}
          onUpdatePricePercentage={handlePricePercentageUpdate}
          onToggleOffer={handleToggleOffer}
          onToggleNew={handleToggleNew}
          onSetFeatured={handleSetFeatured}
          onUnsetFeatured={handleUnsetFeatured}
        />
      )}

      {activeTab === 'newProduct' && (
        <AddProductTab
          categories={categories}
          onCreateProduct={handleCreateProduct}
        />
      )}

      {activeTab === 'bulk' && (
        <BulkImportTab
          onBulkImport={handleBulkImport}
        />
      )}

      {activeTab === 'categories' && (
        <CategoriesTab 
          categories={categories}
          onAddCategory={handleAddCategory}
          onAddSubcategory={handleAddSubcategory}
          onDeleteCategory={handleDeleteCategory}
          onDeleteSubcategory={handleDeleteSubcategory}
        />
      )}

      {activeTab === 'images' && (
        <ImagesTab 
          products={filteredProducts}
          onUpdateImage={handleImageUpdate}
        />
      )}

      {activeTab === 'orders' && (
        <OrdersTab 
          orders={orders}
          mpTransfers={mpTransfers}
          mpConfigured={mpConfigured}
          mpLoading={mpLoading}
          onFetchMpTransfers={fetchMpTransfers}
        />
      )}

      {activeTab === 'clients' && (
        <ClientsTab clients={clients} />
      )}

      {activeTab === 'raffle' && (
        <RaffleTab tickets={tickets} />
      )}
    </div>
  );
}
