'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Image as ImageIcon, ExternalLink, X, Eye, Download, Trash2, Printer, Bell, BellOff, CheckCircle2, Sparkles, Pencil, Minus, Plus, UserPlus, Wifi, Gift } from 'lucide-react';
import { dataStore } from '@/lib/dataStore';
import { getProductColors } from '@/lib/catalogData';
import { COMPANY_INFO } from '@/lib/companyInfo';

// Techo de repeticiones del timbre para que no suene para siempre si
// el pedido se queda sin atender (10 veces cada 6s = 1 minuto de aviso).
const CHIME_REPEAT_LIMIT = 10;
const CHIME_REPEAT_MS = 6000;

export default function OrdersTab({ orders, mpTransfers, mpConfigured, mpLoading, onFetchMpTransfers }) {
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedPrintOrder, setSelectedPrintOrder] = useState(null);
  const [cleanNotice, setCleanNotice] = useState('');
  const [remotePrintState, setRemotePrintState] = useState(null); // { status: 'sending'|'queued'|'printing'|'printed'|'error', message }

  useEffect(() => {
    setRemotePrintState(null);
  }, [selectedPrintOrder?.id]);

  // Baucher / credito para clientes (ej: producto faltante en un pedido).
  // Se ata al telefono, no a una cuenta registrada, para que le sirva a la
  // clienta la proxima vez que compre este o no logueada.
  const [voucherOrder, setVoucherOrder] = useState(null);
  const [voucherAmount, setVoucherAmount] = useState('');
  const [voucherReason, setVoucherReason] = useState('Producto faltante en el pedido');
  const [voucherSubmitting, setVoucherSubmitting] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [voucherSuccess, setVoucherSuccess] = useState('');

  const openVoucherModal = (ord) => {
    setVoucherOrder(ord);
    setVoucherAmount('');
    setVoucherReason('Producto faltante en el pedido');
    setVoucherError('');
    setVoucherSuccess('');
  };

  const handleGrantVoucher = async () => {
    if (!voucherOrder) return;
    setVoucherError('');
    const amountNum = Number(voucherAmount);
    if (!amountNum || amountNum <= 0) {
      setVoucherError('Cargá un monto válido.');
      return;
    }
    setVoucherSubmitting(true);
    try {
      const res = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: voucherOrder.client_phone,
          amount: amountNum,
          reason: voucherReason,
          source_order_id: voucherOrder.id
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo otorgar el baucher');
      setVoucherSuccess(`✓ Baucher de $${amountNum.toLocaleString('es-AR')} otorgado a ${voucherOrder.client_name} (tel. ${voucherOrder.client_phone}). Se va a aplicar solo la próxima vez que compre con ese número.`);
    } catch (err) {
      setVoucherError(err.message);
    } finally {
      setVoucherSubmitting(false);
    }
  };

  // Edicion de pedido (agregar/sacar/bajar cantidad de productos y recalcular el total)
  const [editingOrder, setEditingOrder] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editProductSearchQuery, setEditProductSearchQuery] = useState('');
  const [showEditCustomProductForm, setShowEditCustomProductForm] = useState(false);
  const [editCustomProduct, setEditCustomProduct] = useState({ name: '', price: '', size: '', color: '', quantity: 1 });

  // Crear pedido manual (ej. cliente que ya compro y ahora pide mas por
  // telefono/WhatsApp, sin pasar por el checkout de la web)
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [newOrderClient, setNewOrderClient] = useState({ name: '', phone: '', dni: '', locality: '', address: '', postalCode: '', floorApt: '', deliveryMethod: 'envio', isRegistered: false });
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [newOrderItems, setNewOrderItems] = useState([]);
  const [showCustomProductForm, setShowCustomProductForm] = useState(false);
  const [customProduct, setCustomProduct] = useState({ name: '', price: '', size: '', color: '', quantity: 1 });

  // Real-time Sound & Visual Alert State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderToast, setNewOrderToast] = useState(null);
  const [prevOrdersCount, setPrevOrdersCount] = useState(orders.length);

  const audioCtxRef = useRef(null);
  const chimeIntervalRef = useRef(null);
  const chimeCountRef = useRef(0);

  // Los navegadores bloquean el audio hasta que el usuario interactuo
  // con la pagina al menos una vez. "Desbloqueamos" el AudioContext en
  // el primer click/tecla para que cuando llegue un pedido de verdad
  // el sonido ya este listo para reproducirse, no recien empezando.
  useEffect(() => {
    const unlockAudio = () => {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const stopChimeLoop = () => {
    if (chimeIntervalRef.current) {
      clearInterval(chimeIntervalRef.current);
      chimeIntervalRef.current = null;
    }
    chimeCountRef.current = 0;
  };

  // Web Audio API Chime Generator for zero external file dependencies
  const playNewOrderChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      // Dual-tone chime (A5 880Hz -> E6 1318Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      gain1.gain.setValueAtTime(0.4, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.25);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.51, ctx.currentTime);
        gain2.gain.setValueAtTime(0.5, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.4);
      }, 150);
    } catch (e) {
      console.warn('Audio chime notice:', e);
    }
  };

  // Monitor incoming new orders in real-time. El timbre se repite solo
  // (no un unico sonido corto que se puede pasar por alto) hasta que se
  // descarta el aviso o se abre el pedido, con un techo de repeticiones.
  useEffect(() => {
    if (orders.length > prevOrdersCount) {
      const latestOrder = orders[0];
      if (latestOrder) {
        stopChimeLoop();
        playNewOrderChime();
        chimeCountRef.current = 1;
        chimeIntervalRef.current = setInterval(() => {
          chimeCountRef.current += 1;
          if (chimeCountRef.current > CHIME_REPEAT_LIMIT) {
            stopChimeLoop();
            return;
          }
          playNewOrderChime();
        }, CHIME_REPEAT_MS);
        setNewOrderToast(latestOrder);
      }
    }
    setPrevOrdersCount(orders.length);
  }, [orders, prevOrdersCount]);

  // Cortar el timbre si se desmonta el panel (ej. cambian de pestana)
  useEffect(() => stopChimeLoop, []);

  const handleStatusChange = (orderId, newStatus) => {
    dataStore.updateOrderStatus(orderId, newStatus);
    setCleanNotice(`✓ Estado de la orden #${orderId} actualizado a "${newStatus.toUpperCase()}".`);
    setTimeout(() => setCleanNotice(''), 4000);
  };

  const handleDeleteOrder = async (ord) => {
    const stockNote = ord.status !== 'cancelado' ? ' El stock de los productos se va a reincorporar automáticamente.' : '';
    if (!confirm(`¿Eliminar definitivamente el pedido #${ord.id} de ${ord.client_name}? Esta acción no se puede deshacer.${stockNote}`)) return;
    await dataStore.deleteOrder(ord.id);
    setCleanNotice(`✓ Pedido #${ord.id} eliminado.`);
    setTimeout(() => setCleanNotice(''), 4000);
  };

  const openEditOrder = (ord) => {
    setEditingOrder(ord);
    setEditItems((ord.items || []).map((it) => ({ ...it })));
    setEditProductSearchQuery('');
    setShowEditCustomProductForm(false);
    setEditCustomProduct({ name: '', price: '', size: '', color: '', quantity: 1 });
  };

  const closeEditOrder = () => {
    setEditingOrder(null);
    setEditItems([]);
    setEditProductSearchQuery('');
    setShowEditCustomProductForm(false);
  };

  const handleEditQtyChange = (idx, qty) => {
    const safeQty = Math.max(0, Number.isFinite(qty) ? qty : 0);
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: safeQty } : it)));
  };

  const handleRemoveEditItem = (idx) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const editItemPrice = (item) => item.product?.wholesale_price || item.product?.price || 0;
  const editTotal = editItems.reduce((sum, it) => sum + editItemPrice(it) * (it.quantity || 0), 0);

  const handleSaveEditOrder = () => {
    const cleanedItems = editItems.filter((it) => (it.quantity || 0) > 0);
    if (cleanedItems.length === 0) {
      alert('El pedido no puede quedar sin productos. Cancelalo desde el estado si querés anularlo.');
      return;
    }
    const newTotal = dataStore.updateOrderItems(editingOrder.id, cleanedItems);
    setCleanNotice(`✓ Pedido #${editingOrder.id} modificado. Nuevo total: $${newTotal.toLocaleString('es-AR')}.`);
    setTimeout(() => setCleanNotice(''), 5000);
    closeEditOrder();
  };

  // Crear pedido manual desde el admin (ej. clienta que ya compro antes y
  // ahora pide mas por telefono, sin pasar por el checkout de la web)
  const openCreateOrder = () => {
    setNewOrderClient({ name: '', phone: '', dni: '', locality: '', address: '', deliveryMethod: 'envio', isRegistered: false });
    setNewOrderItems([]);
    setClientSearchQuery('');
    setProductSearchQuery('');
    setShowCustomProductForm(false);
    setCustomProduct({ name: '', price: '', size: '', color: '', quantity: 1 });
    setManualOrderVoucher(null);
    setApplyManualVoucher(true);
    setShowCreateOrder(true);
  };

  const closeCreateOrder = () => setShowCreateOrder(false);

  // Baucher/credito para el pedido manual: se busca solo por telefono
  // (mismo criterio que el checkout de la web), y el admin decide con el
  // checkbox si lo aplica o no en este pedido puntual.
  const [manualOrderVoucher, setManualOrderVoucher] = useState(null); // { id, amount, reason }
  const [applyManualVoucher, setApplyManualVoucher] = useState(true);

  useEffect(() => {
    if (!showCreateOrder) return undefined;
    const digits = String(newOrderClient.phone || '').replace(/\D/g, '');
    if (digits.length < 8) {
      setManualOrderVoucher(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vouchers?phone=${encodeURIComponent(newOrderClient.phone)}`);
        const data = await res.json();
        if (!cancelled) {
          setManualOrderVoucher(data.voucher || null);
          setApplyManualVoucher(true);
        }
      } catch {
        if (!cancelled) setManualOrderVoucher(null);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [newOrderClient.phone, showCreateOrder]);

  const manualVoucherDiscount = (manualOrderVoucher && applyManualVoucher) ? manualOrderVoucher.amount : 0;

  const normalizeSearch = (str) => (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const matchingClients = clientSearchQuery.trim().length >= 2
    ? dataStore.getClientsWithStats().filter((c) =>
        normalizeSearch(c.name).includes(normalizeSearch(clientSearchQuery)) ||
        c.phone?.includes(clientSearchQuery)
      ).slice(0, 6)
    : [];

  const handleSelectExistingClient = (client) => {
    setNewOrderClient((prev) => ({
      ...prev,
      name: client.name || '',
      phone: client.phone || '',
      dni: client.dni && client.dni !== 'Sin especificar' ? client.dni : '',
      locality: client.locality && client.locality !== 'Sin especificar' ? client.locality : '',
      isRegistered: Boolean(client.is_registered)
    }));
    setClientSearchQuery('');
  };

  const matchingProducts = productSearchQuery.trim().length >= 2
    ? dataStore.getProducts().filter((p) => normalizeSearch(p.name).includes(normalizeSearch(productSearchQuery))).slice(0, 8)
    : [];

  const handleAddProductToOrder = (product) => {
    const availableSizes = Array.isArray(product.sizes) ? product.sizes : [];
    const availableColors = getProductColors(product) || [];
    const selectedSize = availableSizes[0] || null;
    const selectedColor = availableColors[0] || null;
    const variantKey = `${product.id}::${selectedSize || ''}::${selectedColor || ''}`;

    setNewOrderItems((prev) => {
      const existing = prev.find((it) => it.variantKey === variantKey);
      if (existing) {
        return prev.map((it) => (it.variantKey === variantKey ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [...prev, {
        product: { ...product, selectedSize, selectedColor },
        quantity: 1,
        variantKey,
        availableSizes,
        availableColors
      }];
    });
    setProductSearchQuery('');
  };

  // Producto que todavia no esta cargado en el sistema (ej. mercaderia
  // nueva). Se agrega con el mismo shape { product, quantity, variantKey }
  // que un producto de catalogo, para que comanda, edicion y CSV lo traten igual.
  const handleAddCustomProduct = () => {
    const name = customProduct.name.trim();
    const price = parseFloat(customProduct.price);
    const quantity = Math.max(1, parseInt(customProduct.quantity, 10) || 1);
    if (!name || !price || price <= 0) {
      alert('Cargá un nombre y un precio válido para el producto.');
      return;
    }
    const customId = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    setNewOrderItems((prev) => [...prev, {
      product: {
        id: customId,
        name,
        wholesale_price: price,
        price,
        selectedSize: customProduct.size.trim() || null,
        selectedColor: customProduct.color.trim() || null,
        isCustom: true
      },
      quantity,
      variantKey: customId
    }]);
    setCustomProduct({ name: '', price: '', size: '', color: '', quantity: 1 });
    setShowCustomProductForm(false);
  };

  const handleChangeOrderItemVariant = (idx, field, value) => {
    setNewOrderItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const updatedProduct = { ...it.product, [field]: value };
      return { ...it, product: updatedProduct, variantKey: `${updatedProduct.id}::${updatedProduct.selectedSize || ''}::${updatedProduct.selectedColor || ''}` };
    }));
  };

  // Buscador de productos para sumar al pedido que se esta editando (mismo
  // patron que el buscador de "Crear Pedido Manual", pero escribe en editItems).
  const matchingEditProducts = editProductSearchQuery.trim().length >= 2
    ? dataStore.getProducts().filter((p) => normalizeSearch(p.name).includes(normalizeSearch(editProductSearchQuery))).slice(0, 8)
    : [];

  const handleAddProductToEditOrder = (product) => {
    const availableSizes = Array.isArray(product.sizes) ? product.sizes : [];
    const availableColors = getProductColors(product) || [];
    const selectedSize = availableSizes[0] || null;
    const selectedColor = availableColors[0] || null;
    const variantKey = `${product.id}::${selectedSize || ''}::${selectedColor || ''}`;

    setEditItems((prev) => {
      const existing = prev.find((it) => it.variantKey === variantKey);
      if (existing) {
        return prev.map((it) => (it.variantKey === variantKey ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [...prev, {
        product: { ...product, selectedSize, selectedColor },
        quantity: 1,
        variantKey,
        availableSizes,
        availableColors
      }];
    });
    setEditProductSearchQuery('');
  };

  const handleAddCustomProductToEdit = () => {
    const name = editCustomProduct.name.trim();
    const price = parseFloat(editCustomProduct.price);
    const quantity = Math.max(1, parseInt(editCustomProduct.quantity, 10) || 1);
    if (!name || !price || price <= 0) {
      alert('Cargá un nombre y un precio válido para el producto.');
      return;
    }
    const customId = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    setEditItems((prev) => [...prev, {
      product: {
        id: customId,
        name,
        wholesale_price: price,
        price,
        selectedSize: editCustomProduct.size.trim() || null,
        selectedColor: editCustomProduct.color.trim() || null,
        isCustom: true
      },
      quantity,
      variantKey: customId
    }]);
    setEditCustomProduct({ name: '', price: '', size: '', color: '', quantity: 1 });
    setShowEditCustomProductForm(false);
  };

  const handleChangeEditItemVariant = (idx, field, value) => {
    setEditItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const updatedProduct = { ...it.product, [field]: value };
      return { ...it, product: updatedProduct, variantKey: `${updatedProduct.id}::${updatedProduct.selectedSize || ''}::${updatedProduct.selectedColor || ''}` };
    }));
  };

  const handleNewOrderQtyChange = (idx, qty) => {
    const safeQty = Math.max(0, Number.isFinite(qty) ? qty : 0);
    setNewOrderItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: safeQty } : it)));
  };

  const handleRemoveNewOrderItem = (idx) => {
    setNewOrderItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const newOrderItemPrice = (item) => item.product?.wholesale_price || item.product?.price || 0;
  const newOrderTotal = newOrderItems.reduce((sum, it) => sum + newOrderItemPrice(it) * (it.quantity || 0), 0);

  const handleSubmitCreateOrder = () => {
    const { name, phone, dni, locality, address, postalCode, floorApt, deliveryMethod, isRegistered } = newOrderClient;
    if (!name.trim() || !phone.trim() || !dni.trim() || !locality.trim()) {
      alert('Completá nombre, teléfono, DNI/CUIT y localidad del cliente.');
      return;
    }
    if (deliveryMethod === 'envio' && (!address.trim() || !postalCode.trim())) {
      alert('Para envío a domicilio completá Dirección y Código Postal.');
      return;
    }
    const cleanedItems = newOrderItems.filter((it) => (it.quantity || 0) > 0);
    if (cleanedItems.length === 0) {
      alert('Agregá al menos un producto al pedido.');
      return;
    }

    const order = dataStore.createOrder(cleanedItems, {
      name: name.trim(),
      phone: phone.trim(),
      dni: dni.trim(),
      locality: locality.trim(),
      address: address.trim(),
      postalCode: postalCode.trim(),
      floorApt: floorApt.trim(),
      isRegistered,
      deliveryMethod: deliveryMethod === 'envio' ? 'Envío a Domicilio / Transporte' : 'Retiro por Sucursal (Pte. Perón 5349/5305/5265)',
      voucherId: manualVoucherDiscount > 0 ? manualOrderVoucher.id : null,
      voucherAmount: manualVoucherDiscount
    }, { setActiveOrder: false });

    if (manualVoucherDiscount > 0) {
      fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucher_id: manualOrderVoucher.id, order_id: order.id })
      }).catch(() => {});
    }

    setCleanNotice(`✓ Pedido ${order.id} creado para ${name.trim()}. Total: $${order.total_amount.toLocaleString('es-AR')}.`);
    setTimeout(() => setCleanNotice(''), 5000);
    closeCreateOrder();
  };

  const handleExportCSV = () => {
    if (orders.length === 0) {
      alert('No hay órdenes para exportar.');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'ID Orden,Fecha,Cliente,DNI/CUIT,Telefono,Localidad,Direccion,Metodo Entrega,Monto Total,Mayorista,Estado,Comprobante URL\n';

    orders.forEach(ord => {
      const row = [
        `"${ord.id}"`,
        `"${new Date(ord.created_at || Date.now()).toLocaleString('es-AR')}"`,
        `"${(ord.client_name || '').replace(/"/g, '""')}"`,
        `"${ord.client_dni || ''}"`,
        `"${ord.client_phone || ''}"`,
        `"${(ord.client_locality || '').replace(/"/g, '""')}"`,
        `"${(ord.client_address || '').replace(/"/g, '""')}"`,
        `"${ord.delivery_method || ''}"`,
        `"${ord.total_amount || 0}"`,
        `"${ord.is_wholesale ? 'SI' : 'NO'}"`,
        `"${ord.status || 'pendiente'}"`,
        `"${ord.receipt_url || 'Sin comprobante'}"`
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_ordenes_dulcevalentin_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCleanOldReceipts = async () => {
    if (confirm('¿Desea eliminar las fotos de comprobantes con más de 30 días de antigüedad en Supabase Storage? (Los datos del pedido y montos se mantendrán guardados).')) {
      const count = await dataStore.cleanOldReceipts(30);
      if (count > 0) {
        setCleanNotice(`✓ Se eliminaron ${count} comprobante(s) antiguo(s) de más de 30 días.`);
      } else {
        setCleanNotice('ℹ️ No se encontraron comprobantes con más de 30 días de antigüedad para eliminar.');
      }
      setTimeout(() => setCleanNotice(''), 5000);
    }
  };

  const triggerPrintWindow = () => {
    if (!selectedPrintOrder) {
      window.print();
      return;
    }

    // Chrome usa document.title como nombre sugerido al "Guardar como PDF",
    // asi que lo cambiamos justo antes de imprimir (con fecha y nombre
    // completo del cliente) y lo restauramos al cerrar el dialogo de
    // impresion, para no dejar pisado el titulo de la pestana del admin.
    const originalTitle = document.title;
    const clientName = (selectedPrintOrder.client_name || 'Cliente').trim();
    const dateStr = new Date(selectedPrintOrder.created_at || Date.now())
      .toLocaleDateString('es-AR')
      .replaceAll('/', '-');
    document.title = `Comanda ${clientName} ${dateStr}`;

    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);

    window.print();
  };

  // Manda el pedido a la cola de impresion remota: el agente instalado en
  // la PC del local (ver /print-agent) lo toma y lo imprime ahi, sin
  // importar desde donde este conectado el admin.
  const pollRemoteJobStatus = (jobId) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/admin/print-jobs?id=${jobId}`);
        const data = await res.json();
        const job = data.job;
        if (job) {
          setRemotePrintState({ status: job.status, message: job.error_message });
          if (job.status === 'printed' || job.status === 'error') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        // Sigue reintentando en el proximo tick
      }
      if (attempts >= 24) clearInterval(interval); // ~2 minutos maximo
    }, 5000);
  };

  const handleRemotePrint = async () => {
    if (!selectedPrintOrder) return;
    setRemotePrintState({ status: 'sending' });
    try {
      const res = await fetch('/api/admin/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: selectedPrintOrder.id })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo encolar la impresión');
      setRemotePrintState({ status: 'queued' });
      pollRemoteJobStatus(data.job.id);
    } catch (err) {
      setRemotePrintState({ status: 'error', message: err.message });
    }
  };

  const REMOTE_PRINT_LABELS = {
    sending: 'Enviando…',
    queued: 'En cola, esperando al local…',
    printing: 'Imprimiendo en el local…',
    printed: '✓ Impreso en el local',
    error: '✗ Error — reintentar'
  };

  return (
    <div>
      {/* REAL-TIME NEW ORDER FLOATING TOAST BANNER */}
      {newOrderToast && (
        <div className="no-print" style={{
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          padding: '16px 20px',
          borderRadius: '10px',
          marginBottom: '20px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
          border: '2px solid #10B981',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          animation: 'pulse 2s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.8rem' }}>🔔</span>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#34D399' }}>
                ¡NUEVO PEDIDO RECIBIDO! Orden #{newOrderToast.id}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#E2E8F0', marginTop: '2px' }}>
                Cliente: <strong>{newOrderToast.client_name}</strong> | Monto: <strong style={{ color: '#10B981' }}>${newOrderToast.total_amount?.toLocaleString('es-AR')}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {newOrderToast.receipt_url && (
              <button
                onClick={() => {
                  stopChimeLoop();
                  setSelectedReceipt({ url: newOrderToast.receipt_url, clientName: newOrderToast.client_name, orderId: newOrderToast.id });
                  setNewOrderToast(null);
                }}
                className="btn-primary"
                style={{ fontSize: '0.82rem', padding: '6px 14px', backgroundColor: '#059669', borderColor: '#059669' }}
              >
                <Eye size={14} /> Ver Comprobante
              </button>
            )}
            <button
              onClick={() => { stopChimeLoop(); setNewOrderToast(null); }}
              style={{ background: 'transparent', border: '1px solid #475569', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Descartar (revisar en la tabla)
            </button>
          </div>
        </div>
      )}

      {/* Mercado Pago Transfer Sync & Alert Control Widget */}
      <div className="no-print" style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--accent-gold)',
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚡ Sincronización Mercado Pago & Alertas Sonora de Pedidos
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {mpConfigured
                ? '🟢 Conectado con Mercado Pago API — Acreditaciones en tiempo real'
                : '⚪ Mercado Pago no está conectado todavía — este panel no muestra transferencias hasta que se configure'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* Sound Alert Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="btn-secondary"
              style={{
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: soundEnabled ? '#ECFDF5' : 'var(--bg-surface-elevated)',
                borderColor: soundEnabled ? '#A7F3D0' : 'var(--border-color)',
                color: soundEnabled ? '#047857' : 'var(--text-muted)'
              }}
            >
              {soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
              {soundEnabled ? 'Alerta Sonora Activada' : 'Alerta Sonora Silenciada'}
            </button>

            <button 
              onClick={onFetchMpTransfers} 
              className="btn-secondary" 
              disabled={mpLoading}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={mpLoading ? 'animate-spin' : ''} />
              {mpLoading ? 'Consultando...' : 'Sincronizar Mercado Pago'}
            </button>
          </div>
        </div>

        {mpTransfers.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-gold-hover)', marginBottom: '10px' }}>
              Últimas Transferencias Recibidas en Mercado Pago:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
              {mpTransfers.map((tx) => (
                <div key={tx.id} style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.88rem' }}>
                    <span>{tx.payer_name}</span>
                    <span style={{ color: 'var(--accent-emerald)' }}>+${tx.amount?.toLocaleString('es-AR')}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>DNI/CUIT: {tx.payer_dni}</span>
                    <span>{new Date(tx.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {cleanNotice && (
        <div className="no-print" style={{ backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '16px' }}>
          {cleanNotice}
        </div>
      )}

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Registro de Órdenes, Comprobantes e Impresión
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Verifica pagos, aprueba pedidos e imprime la comanda de armado para el depósito.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={openCreateOrder}
            className="btn-primary"
            style={{ fontSize: '0.82rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#059669', borderColor: '#059669' }}
          >
            <UserPlus size={14} /> Crear Pedido Manual
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} /> Exportar Excel / CSV
          </button>
          
          <button 
            onClick={handleCleanOldReceipts}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#DC2626', borderColor: '#FCA5A5' }}
          >
            <Trash2 size={14} /> Limpiar Fotos (+30 días)
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="no-print" style={{ textAlign: 'center', padding: '50px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
          <p style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '1.1rem' }}>No hay órdenes registradas aún.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px' }}>
            Las nuevas compras realizadas por los clientes aparecerán aquí automáticamente con sus datos, comprobantes y opción de impresión.
          </p>
        </div>
      ) : (
        <table className="admin-table no-print">
          <thead>
            <tr>
              <th>N° Orden</th>
              <th>Cliente</th>
              <th>DNI / CUIT</th>
              <th>Contacto / Dirección</th>
              <th>Monto Total</th>
              <th>Estado Pago</th>
              <th>Comprobante</th>
              <th>Detalle / Imprimir</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((ord) => {
              const currentStatus = ord.status || 'pendiente';
              const isDelivery = ord.delivery_method !== 'retiro' && !ord.delivery_method?.toLowerCase().includes('retiro');

              return (
                <tr key={ord.id}>
                  <td style={{ fontWeight: 800 }}>{ord.id}</td>
                  <td style={{ fontWeight: 700 }}>{ord.client_name}</td>
                  <td>{ord.client_dni || 'No provisto'}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{ord.client_phone}</div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>
                      {isDelivery ? `🚚 Envío: ${ord.client_address || ''} (${ord.client_locality || 'Rosario'})` : `🏬 Retiro por Sucursal`}
                    </span>
                    {isDelivery && !ord.client_postal_code && (
                      <span style={{ fontSize: '0.72rem', color: '#B45309', fontWeight: 700, display: 'block', marginTop: '2px' }}>
                        ⚠️ Falta código postal — pedirlo antes de despachar
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 800, color: '#059669', fontSize: '0.95rem' }}>
                    ${ord.total_amount?.toLocaleString('es-AR')}
                    {ord.is_wholesale && <div style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 700 }}>Venta Mayorista</div>}
                  </td>
                  
                  {/* Status Dropdown */}
                  <td>
                    <select
                      value={currentStatus}
                      onChange={(e) => handleStatusChange(ord.id, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: currentStatus === 'aprobado' ? '#ECFDF5' : (currentStatus === 'enviado' ? '#EFF6FF' : '#FEF3C7'),
                        color: currentStatus === 'aprobado' ? '#047857' : (currentStatus === 'enviado' ? '#1D4ED8' : '#92400E'),
                        cursor: 'pointer'
                      }}
                    >
                      <option value="pendiente">🟡 Pendiente</option>
                      <option value="aprobado">🟢 Aprobado / Pagado</option>
                      <option value="enviado">🔵 Enviado / Despachado</option>
                      <option value="cancelado">🔴 Cancelado</option>
                    </select>
                  </td>

                  {/* Receipt View Button */}
                  <td>
                    {ord.receipt_url ? (
                      <button 
                        onClick={() => setSelectedReceipt({ url: ord.receipt_url, clientName: ord.client_name, orderId: ord.id })}
                        className="btn-secondary" 
                        style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={13} /> Comprobante
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin comprobante</span>
                    )}
                  </td>

                  {/* Ver Detalle: siempre disponible, sin importar el estado del pago.
                      Imprimir la comanda de depósito solo cuando ya está aprobado el pago. */}
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setSelectedPrintOrder(ord)}
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: currentStatus === 'aprobado' ? '#0F172A' : undefined, borderColor: currentStatus === 'aprobado' ? '#0F172A' : undefined, color: currentStatus === 'aprobado' ? '#FFF' : undefined }}
                      >
                        {currentStatus === 'aprobado' ? <Printer size={14} /> : <Eye size={14} />}
                        {currentStatus === 'aprobado' ? 'Imprimir Comanda' : 'Ver Qué Pidió'}
                      </button>
                      <button
                        onClick={() => openEditOrder(ord)}
                        className="btn-secondary"
                        title="Modificar productos/cantidades del pedido"
                        style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        onClick={() => openVoucherModal(ord)}
                        title="Otorgar baucher / crédito a este cliente (ej: producto faltante)"
                        style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', color: '#92400E', cursor: 'pointer' }}
                      >
                        <Gift size={14} /> Baucher
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(ord)}
                        title="Eliminar pedido definitivamente"
                        style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* VOUCHER / BAUCHER MODAL */}
      {voucherOrder && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setVoucherOrder(null)}
        >
          <div
            style={{ background: 'var(--bg-card)', borderRadius: '12px', maxWidth: '420px', width: '100%', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gift size={18} style={{ color: '#D97706' }} /> Otorgar Baucher
              </h3>
              <button onClick={() => setVoucherOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Cliente: <strong>{voucherOrder.client_name}</strong> — Tel: <strong>{voucherOrder.client_phone}</strong>
              <br />Se descuenta solo la próxima vez que compre con ese número, esté registrada o no.
            </p>

            {voucherSuccess ? (
              <p style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 700, marginBottom: '12px' }}>{voucherSuccess}</p>
            ) : (
              <>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Monto del baucher ($)</label>
                  <input
                    type="number"
                    value={voucherAmount}
                    onChange={(e) => setVoucherAmount(e.target.value)}
                    placeholder="Ej: 10500"
                    className="form-input"
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Motivo</label>
                  <textarea
                    value={voucherReason}
                    onChange={(e) => setVoucherReason(e.target.value)}
                    className="form-input"
                    rows={2}
                  />
                </div>
                {voucherError && <p style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 700, marginBottom: '10px' }}>{voucherError}</p>}
                <button
                  onClick={handleGrantVoucher}
                  disabled={voucherSubmitting}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', backgroundColor: '#D97706', borderColor: '#D97706' }}
                >
                  {voucherSubmitting ? 'Otorgando…' : 'Otorgar Baucher'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* RECEIPT MODAL VIEWER */}
      {selectedReceipt && (
        <div className="no-print" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setSelectedReceipt(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'var(--bg-surface-elevated)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
              Comprobante de Pago — Orden #{selectedReceipt.orderId}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Cliente: <strong>{selectedReceipt.clientName}</strong>
            </p>

            <div style={{ textAlign: 'center', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '8px', padding: '12px', border: '1px solid var(--border-color)' }}>
              <img 
                src={selectedReceipt.url} 
                alt="Comprobante de pago" 
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '6px' }}
              />
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a 
                href={selectedReceipt.url} 
                target="_blank" 
                rel="noreferrer" 
                style={{ fontSize: '0.82rem', color: '#1D4ED8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <ExternalLink size={14} /> Abrir en ventana independiente
              </a>
              <button 
                onClick={() => setSelectedReceipt(null)} 
                className="btn-secondary" 
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ORDER MODAL: sacar productos o bajar cantidades y recalcular el total */}
      {editingOrder && (
        <div className="no-print" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            maxWidth: '640px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Editar Pedido #{editingOrder.id}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Cliente: <strong>{editingOrder.client_name}</strong> — agregá, cambiá cantidades o sacá productos y el total se recalcula solo.
                </p>
              </div>
              <button
                onClick={closeEditOrder}
                style={{ background: 'var(--bg-surface-elevated)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Buscador de productos para sumar al pedido */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Buscar producto para agregar al pedido
              </label>
              <input
                type="text"
                value={editProductSearchQuery}
                onChange={(e) => setEditProductSearchQuery(e.target.value)}
                placeholder="Ej: remera, jean, campera..."
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
              />
              {matchingEditProducts.length > 0 && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '4px', overflow: 'hidden' }}>
                  {matchingEditProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddProductToEditOrder(p)}
                      style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: '0.82rem', background: 'var(--bg-card)', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                    >
                      <span>{p.name}</span>
                      <strong style={{ color: '#059669' }}>${(p.wholesale_price || p.price)?.toLocaleString('es-AR')}</strong>
                    </button>
                  ))}
                </div>
              )}

              {!showEditCustomProductForm ? (
                <button
                  type="button"
                  onClick={() => setShowEditCustomProductForm(true)}
                  style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', padding: '8px 2px' }}
                >
                  + Agregar producto que no está en el sistema
                </button>
              ) : (
                <div style={{ marginTop: '8px', padding: '12px', border: '1px dashed var(--border-color-strong)', borderRadius: '8px', backgroundColor: 'var(--bg-surface-elevated)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                    Producto fuera de catálogo
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Nombre del producto"
                      value={editCustomProduct.name}
                      onChange={(e) => setEditCustomProduct((p) => ({ ...p, name: e.target.value }))}
                      style={{ padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Precio unitario"
                      value={editCustomProduct.price}
                      onChange={(e) => setEditCustomProduct((p) => ({ ...p, price: e.target.value }))}
                      style={{ padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                    <input
                      type="text"
                      placeholder="Talle (opcional)"
                      value={editCustomProduct.size}
                      onChange={(e) => setEditCustomProduct((p) => ({ ...p, size: e.target.value }))}
                      style={{ padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                    <input
                      type="text"
                      placeholder="Color (opcional)"
                      value={editCustomProduct.color}
                      onChange={(e) => setEditCustomProduct((p) => ({ ...p, color: e.target.value }))}
                      style={{ padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Cantidad"
                      value={editCustomProduct.quantity}
                      onChange={(e) => setEditCustomProduct((p) => ({ ...p, quantity: e.target.value }))}
                      style={{ padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                    <button type="button" onClick={() => setShowEditCustomProductForm(false)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      Cancelar
                    </button>
                    <button type="button" onClick={handleAddCustomProductToEdit} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem', backgroundColor: '#059669', borderColor: '#059669' }}>
                      Agregar al Pedido
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {editItems.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Sin productos. Agregá al menos uno o cancelá esta edición.</p>
              ) : (
                editItems.map((item, idx) => {
                  const unitPrice = editItemPrice(item);
                  const size = item.product?.selectedSize || item.selectedSize || '-';
                  const color = item.product?.selectedColor || item.selectedColor || 'Surtido';
                  return (
                    <div key={item.variantKey || idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.product?.name}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {item.availableSizes?.length > 0 || item.availableColors?.length > 0 ? `$${unitPrice.toLocaleString('es-AR')} c/u` : `Talle ${size} · ${color} · $${unitPrice.toLocaleString('es-AR')} c/u`}
                        </div>
                      </div>

                      {item.availableSizes?.length > 0 && (
                        <select
                          value={item.product.selectedSize || ''}
                          onChange={(e) => handleChangeEditItemVariant(idx, 'selectedSize', e.target.value)}
                          style={{ padding: '5px 6px', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                        >
                          {item.availableSizes.map((s) => <option key={s} value={s}>Talle {s}</option>)}
                        </select>
                      )}

                      {item.availableColors?.length > 0 && (
                        <select
                          value={item.product.selectedColor || ''}
                          onChange={(e) => handleChangeEditItemVariant(idx, 'selectedColor', e.target.value)}
                          style={{ padding: '5px 6px', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                        >
                          {item.availableColors.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleEditQtyChange(idx, (item.quantity || 0) - 1)}
                          className="btn-secondary"
                          style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Minus size={13} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity || 0}
                          onChange={(e) => handleEditQtyChange(idx, parseInt(e.target.value, 10) || 0)}
                          style={{ width: '44px', textAlign: 'center', padding: '4px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleEditQtyChange(idx, (item.quantity || 0) + 1)}
                          className="btn-secondary"
                          style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <div style={{ width: '90px', textAlign: 'right', fontWeight: 800, fontSize: '0.88rem', color: '#059669' }}>
                        ${(unitPrice * (item.quantity || 0)).toLocaleString('es-AR')}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveEditItem(idx)}
                        title="Sacar del pedido"
                        style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '4px', display: 'flex' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '2px solid var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>NUEVO TOTAL:</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#059669' }}>${editTotal.toLocaleString('es-AR')}</span>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={closeEditOrder} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Cancelar
              </button>
              <button
                onClick={handleSaveEditOrder}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.85rem', backgroundColor: '#059669', borderColor: '#059669' }}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREAR PEDIDO MANUAL (cliente que pide por telefono/WhatsApp) */}
      {showCreateOrder && (
        <div className="no-print" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Crear Pedido Manual
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Para pedidos que llegan por teléfono o WhatsApp, o para sumarle productos a una clienta que ya compró.
                </p>
              </div>
              <button
                onClick={closeCreateOrder}
                style={{ background: 'var(--bg-surface-elevated)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Datos del cliente */}
            <div style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Buscar cliente ya registrado (nombre o teléfono)
              </label>
              <input
                type="text"
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                placeholder="Ej: María, o 3415..."
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
              />
              {matchingClients.length > 0 && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '4px', overflow: 'hidden' }}>
                  {matchingClients.map((c) => (
                    <button
                      key={c.phone || c.name}
                      type="button"
                      onClick={() => handleSelectExistingClient(c)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: '0.82rem', background: 'var(--bg-card)', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                    >
                      <strong>{c.name}</strong> — {c.phone} {c.locality ? `· ${c.locality}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Nombre completo</label>
                <input type="text" value={newOrderClient.name} onChange={(e) => setNewOrderClient((p) => ({ ...p, name: e.target.value }))} style={{ width: '100%', padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Teléfono</label>
                <input type="text" value={newOrderClient.phone} onChange={(e) => setNewOrderClient((p) => ({ ...p, phone: e.target.value }))} style={{ width: '100%', padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }} />
                {manualOrderVoucher && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', padding: '6px 8px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700, color: '#92400E', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={applyManualVoucher}
                      onChange={(e) => setApplyManualVoucher(e.target.checked)}
                    />
                    🎁 Tiene baucher de ${manualOrderVoucher.amount.toLocaleString('es-AR')} ({manualOrderVoucher.reason || 'sin motivo'}) — aplicar
                  </label>
                )}
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>DNI / CUIT</label>
                <input type="text" value={newOrderClient.dni} onChange={(e) => setNewOrderClient((p) => ({ ...p, dni: e.target.value }))} style={{ width: '100%', padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Localidad</label>
                <input type="text" value={newOrderClient.locality} onChange={(e) => setNewOrderClient((p) => ({ ...p, locality: e.target.value }))} style={{ width: '100%', padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Método de entrega</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input type="radio" checked={newOrderClient.deliveryMethod === 'envio'} onChange={() => setNewOrderClient((p) => ({ ...p, deliveryMethod: 'envio' }))} />
                  🚚 Envío a Domicilio
                </label>
                <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input type="radio" checked={newOrderClient.deliveryMethod === 'retiro'} onChange={() => setNewOrderClient((p) => ({ ...p, deliveryMethod: 'retiro' }))} />
                  🏬 Retiro por Sucursal
                </label>
              </div>
              {newOrderClient.deliveryMethod === 'envio' && (
                <>
                  <input
                    type="text"
                    value={newOrderClient.address}
                    onChange={(e) => setNewOrderClient((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Dirección de envío"
                    style={{ width: '100%', padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', marginTop: '6px' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                    <input
                      type="text"
                      value={newOrderClient.postalCode}
                      onChange={(e) => setNewOrderClient((p) => ({ ...p, postalCode: e.target.value }))}
                      placeholder="Código Postal"
                      style={{ width: '100%', padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                    <input
                      type="text"
                      value={newOrderClient.floorApt}
                      onChange={(e) => setNewOrderClient((p) => ({ ...p, floorApt: e.target.value }))}
                      placeholder="Piso / Depto (si aplica)"
                      style={{ width: '100%', padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Buscador de productos */}
            <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Buscar producto para agregar
              </label>
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="Ej: remera, jean, campera..."
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
              />
              {matchingProducts.length > 0 && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '4px', overflow: 'hidden' }}>
                  {matchingProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddProductToOrder(p)}
                      style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: '0.82rem', background: 'var(--bg-card)', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                    >
                      <span>{p.name}</span>
                      <strong style={{ color: '#059669' }}>${(p.wholesale_price || p.price)?.toLocaleString('es-AR')}</strong>
                    </button>
                  ))}
                </div>
              )}

              {!showCustomProductForm ? (
                <button
                  type="button"
                  onClick={() => setShowCustomProductForm(true)}
                  style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', padding: '8px 2px' }}
                >
                  + Agregar producto que no está en el sistema
                </button>
              ) : (
                <div style={{ marginTop: '8px', padding: '12px', border: '1px dashed var(--border-color-strong)', borderRadius: '8px', backgroundColor: 'var(--bg-surface-elevated)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                    Producto fuera de catálogo
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Nombre del producto"
                      value={customProduct.name}
                      onChange={(e) => setCustomProduct((p) => ({ ...p, name: e.target.value }))}
                      style={{ padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Precio unitario"
                      value={customProduct.price}
                      onChange={(e) => setCustomProduct((p) => ({ ...p, price: e.target.value }))}
                      style={{ padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                    <input
                      type="text"
                      placeholder="Talle (opcional)"
                      value={customProduct.size}
                      onChange={(e) => setCustomProduct((p) => ({ ...p, size: e.target.value }))}
                      style={{ padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                    <input
                      type="text"
                      placeholder="Color (opcional)"
                      value={customProduct.color}
                      onChange={(e) => setCustomProduct((p) => ({ ...p, color: e.target.value }))}
                      style={{ padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Cantidad"
                      value={customProduct.quantity}
                      onChange={(e) => setCustomProduct((p) => ({ ...p, quantity: e.target.value }))}
                      style={{ padding: '7px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                    <button type="button" onClick={() => setShowCustomProductForm(false)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      Cancelar
                    </button>
                    <button type="button" onClick={handleAddCustomProduct} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem', backgroundColor: '#059669', borderColor: '#059669' }}>
                      Agregar al Pedido
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Items agregados */}
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {newOrderItems.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>Todavía no agregaste productos.</p>
              ) : (
                newOrderItems.map((item, idx) => (
                  <div key={item.variantKey || idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {item.product?.name}
                        {item.product?.isCustom && (
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#B45309', backgroundColor: '#FEF3C7', padding: '1px 6px', borderRadius: '4px' }}>
                            FUERA DE CATÁLOGO
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        ${newOrderItemPrice(item).toLocaleString('es-AR')} c/u
                        {item.product?.isCustom && (item.product.selectedSize || item.product.selectedColor) &&
                          ` · ${[item.product.selectedSize ? `Talle ${item.product.selectedSize}` : null, item.product.selectedColor].filter(Boolean).join(' · ')}`}
                      </div>
                    </div>

                    {item.availableSizes?.length > 0 && (
                      <select
                        value={item.product.selectedSize || ''}
                        onChange={(e) => handleChangeOrderItemVariant(idx, 'selectedSize', e.target.value)}
                        style={{ padding: '5px 6px', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                      >
                        {item.availableSizes.map((s) => <option key={s} value={s}>Talle {s}</option>)}
                      </select>
                    )}

                    {item.availableColors?.length > 0 && (
                      <select
                        value={item.product.selectedColor || ''}
                        onChange={(e) => handleChangeOrderItemVariant(idx, 'selectedColor', e.target.value)}
                        style={{ padding: '5px 6px', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                      >
                        {item.availableColors.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button type="button" onClick={() => handleNewOrderQtyChange(idx, (item.quantity || 0) - 1)} className="btn-secondary" style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={item.quantity || 0}
                        onChange={(e) => handleNewOrderQtyChange(idx, parseInt(e.target.value, 10) || 0)}
                        style={{ width: '44px', textAlign: 'center', padding: '4px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                      />
                      <button type="button" onClick={() => handleNewOrderQtyChange(idx, (item.quantity || 0) + 1)} className="btn-secondary" style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={13} />
                      </button>
                    </div>

                    <div style={{ width: '80px', textAlign: 'right', fontWeight: 800, fontSize: '0.86rem', color: '#059669' }}>
                      ${(newOrderItemPrice(item) * (item.quantity || 0)).toLocaleString('es-AR')}
                    </div>

                    <button type="button" onClick={() => handleRemoveNewOrderItem(idx)} title="Sacar del pedido" style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {manualVoucherDiscount > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: '#92400E' }}>
                <span>🎁 Baucher aplicado</span>
                <span>−${manualVoucherDiscount.toLocaleString('es-AR')}</span>
              </div>
            )}
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '2px solid var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>TOTAL:</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#059669' }}>
                {manualVoucherDiscount > 0 && (
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'line-through', marginRight: '6px' }}>
                    ${newOrderTotal.toLocaleString('es-AR')}
                  </span>
                )}
                ${(newOrderTotal - manualVoucherDiscount).toLocaleString('es-AR')}
              </span>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={closeCreateOrder} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Cancelar
              </button>
              <button
                onClick={handleSubmitCreateOrder}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.85rem', backgroundColor: '#059669', borderColor: '#059669' }}
              >
                Crear Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNIVERSAL PRINTABLE ORDER TICKET / COMANDA MODAL */}
      {selectedPrintOrder && (() => {
        const renderTicketBody = () => (
          <>
            {/* Header */}
            <div className="ticket-header">
              <h1 className="company-title">{COMPANY_INFO.name.toUpperCase()}</h1>
              <p className="ticket-subtitle">COMANDA DE ARMADO Y DESPACHO</p>
              <div className="ticket-order-meta">
                <div>ORDEN N°: <strong>{selectedPrintOrder.id}</strong></div>
                <div>FECHA Y HORA: <strong>{new Date(selectedPrintOrder.created_at || Date.now()).toLocaleString('es-AR')} hs</strong></div>
              </div>
            </div>

            {/* Sender / Remitente Block — datos fijos de la empresa para las
                empresas de transporte, que siempre piden remitente y destinatario */}
            {(!selectedPrintOrder.delivery_method || !selectedPrintOrder.delivery_method.toLowerCase().includes('retiro')) && (
              <div className="client-info-box" style={{ marginBottom: '8px' }}>
                <div className="info-row" style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>REMITENTE</div>
                <div className="info-row"><strong>Empresa:</strong> <span>{COMPANY_INFO.name}</span></div>
                <div className="info-row"><strong>Dirección:</strong> <span>{COMPANY_INFO.address}</span></div>
                <div className="info-row"><strong>Localidad / Provincia:</strong> <span>{COMPANY_INFO.locality} / {COMPANY_INFO.province}</span></div>
                <div className="info-row"><strong>Código Postal:</strong> <span>{COMPANY_INFO.postalCode}</span></div>
                <div className="info-row"><strong>Teléfono:</strong> <span>{COMPANY_INFO.phone}</span></div>
              </div>
            )}

            {/* Client Info Block */}
            <div className="client-info-box">
              <div className="info-row" style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>DESTINATARIO</div>
              <div className="info-row"><strong>Nombre Completo:</strong> <span>{selectedPrintOrder.client_name}</span></div>
              <div className="info-row"><strong>DNI / CUIT:</strong> <span>{selectedPrintOrder.client_dni || 'Sin DNI'}</span></div>
              <div className="info-row"><strong>Teléfono de Contacto:</strong> <span>{selectedPrintOrder.client_phone}</span></div>
              <div className="info-row">
                <strong>Método de Entrega:</strong>
                <span className="delivery-type-tag">
                  {selectedPrintOrder.delivery_method?.toLowerCase().includes('retiro') ? '🏬 RETIRO POR SUCURSAL' : '🚚 ENVÍO A DOMICILIO / TRANSPORTE'}
                </span>
              </div>

              {/* Show Shipping Address if Delivery */}
              {(!selectedPrintOrder.delivery_method || !selectedPrintOrder.delivery_method.toLowerCase().includes('retiro')) && (
                <>
                  <div className="info-row" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #000' }}>
                    <strong>Dirección de Envío:</strong> <span>{selectedPrintOrder.client_address || 'No especificada'}{selectedPrintOrder.client_floor_apt ? ` (${selectedPrintOrder.client_floor_apt})` : ''}</span>
                  </div>
                  <div className="info-row">
                    <strong>Localidad / Ciudad:</strong> <span>{selectedPrintOrder.client_locality || 'Rosario'}</span>
                  </div>
                  <div className="info-row">
                    <strong>Código Postal:</strong> <span>{selectedPrintOrder.client_postal_code || '⚠️ FALTA — CONSULTAR AL CLIENTE ANTES DE DESPACHAR'}</span>
                  </div>
                </>
              )}
            </div>

            {/* Itemized Table for Warehouse Assembly */}
            <div className="items-section">
              <h3 className="section-title">DETALLE DEL PEDIDO A PREPARAR:</h3>
              <table className="ticket-table">
                <thead>
                  <tr>
                    <th style={{ width: '22px' }}>Arm.</th>
                    <th style={{ width: '22px' }}>Ctrl.</th>
                    <th>Prenda / Producto</th>
                    <th style={{ textAlign: 'center' }}>Talle</th>
                    <th style={{ textAlign: 'center' }}>Color</th>
                    <th style={{ textAlign: 'center' }}>Cant.</th>
                    <th style={{ textAlign: 'right' }}>P. Unit.</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPrintOrder.items && selectedPrintOrder.items.length > 0 ? (
                    selectedPrintOrder.items.map((item, idx) => {
                      // El carrito siempre cobra al precio mayorista de cada producto
                      // (ver CartDrawer.jsx), nunca al precio de vidriera/minorista.
                      // La comanda tiene que reflejar lo mismo que se le cobro al
                      // cliente, sino la suma de renglones no da igual al total final.
                      const unitPrice = item.product?.wholesale_price || item.product?.price || 0;
                      const itemTotal = unitPrice * item.quantity;
                      const size = item.product?.selectedSize || item.selectedSize || '-';
                      const color = item.product?.selectedColor || item.selectedColor || 'Surtido';

                      return (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center' }}>☐</td>
                          <td style={{ textAlign: 'center' }}>☐</td>
                          <td>
                            <strong>{item.product?.name}</strong>
                            {item.product?.code && <span className="product-code">Cód: {item.product.code}</span>}
                          </td>
                          <td style={{ textAlign: 'center' }} className="highlight-size">
                            {size}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: '#0F172A' }}>
                            {color}
                          </td>
                          <td style={{ textAlign: 'center' }} className="highlight-qty">
                            x{item.quantity}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            ${unitPrice?.toLocaleString('es-AR')}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>
                            ${itemTotal?.toLocaleString('es-AR')}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                        Sin detalle de prendas individuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Order Totals */}
            <div className="totals-section">
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block' }}>
                  Estado del Pago: <strong style={{ textTransform: 'uppercase' }}>{selectedPrintOrder.status || 'APROBADO'}</strong>
                </span>
                {selectedPrintOrder.is_wholesale && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                    ✓ Venta Mayorista
                  </span>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                {selectedPrintOrder.discount_applied > 0 && (
                  <span style={{ fontSize: '0.78rem', display: 'block', fontWeight: 800, color: '#92400E' }}>
                    🎁 Baucher aplicado: −${selectedPrintOrder.discount_applied.toLocaleString('es-AR')}
                  </span>
                )}
                <span style={{ fontSize: '0.8rem', display: 'block' }}>TOTAL FINAL COMANDA:</span>
                <span className="grand-total">${selectedPrintOrder.total_amount?.toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* Warehouse Verification Footer */}
            <div className="warehouse-checks">
              <div style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                CONTROL DE DEPÓSITO Y CONTROL FINAL:
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <span>☐ Control de Talles y Prendas</span>
                <span>☐ Bolsa / Embalaje</span>
                <span>☐ Despachado</span>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Firma Armador: ___________________</span>
                <span>Firma Control: ___________________</span>
              </div>
            </div>
          </>
        );

        return (
          <div className="print-ticket-modal-backdrop" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div className="print-ticket-modal-card" style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '92vh',
              overflow: 'auto',
              padding: '26px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              position: 'relative'
            }}>
              {/* Modal Controls (Hidden during print) */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {selectedPrintOrder.status === 'aprobado' ? 'Vista Previa de Comanda Universal' : `Qué Pidió — Orden #${selectedPrintOrder.id}`}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedPrintOrder.status === 'aprobado' ? (
                    <button
                      onClick={triggerPrintWindow}
                      className="btn-primary"
                      style={{ fontSize: '0.88rem', padding: '8px 18px', backgroundColor: '#059669', borderColor: '#059669', color: '#FFF' }}
                    >
                      <Printer size={16} /> Imprimir Comanda Ahora
                    </button>
                  ) : null}
                  {selectedPrintOrder.status === 'aprobado' ? (
                    <button
                      onClick={handleRemotePrint}
                      disabled={remotePrintState?.status === 'sending' || remotePrintState?.status === 'queued' || remotePrintState?.status === 'printing'}
                      title="Imprime en la impresora conectada a la PC del local, sin importar desde donde estes"
                      className="btn-secondary"
                      style={{
                        fontSize: '0.88rem',
                        padding: '8px 18px',
                        opacity: remotePrintState?.status === 'sending' || remotePrintState?.status === 'queued' || remotePrintState?.status === 'printing' ? 0.7 : 1,
                        color: remotePrintState?.status === 'printed' ? '#059669' : remotePrintState?.status === 'error' ? '#DC2626' : undefined
                      }}
                    >
                      <Wifi size={16} /> {REMOTE_PRINT_LABELS[remotePrintState?.status] || 'Enviar a Impresora del Local'}
                    </button>
                  ) : (
                    <button
                      disabled
                      title="Aprobá el pago primero para poder imprimir la comanda de despacho"
                      className="btn-secondary"
                      style={{ fontSize: '0.88rem', padding: '8px 18px', opacity: 0.5, cursor: 'not-allowed' }}
                    >
                      <Printer size={16} /> Aprobar pago para imprimir
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedPrintOrder(null)}
                    className="btn-secondary"
                    style={{ fontSize: '0.88rem', padding: '8px 14px' }}
                  >
                    <X size={16} /> Cerrar
                  </button>
                </div>
              </div>

              {/* PRINTABLE TICKET CONTENT AREA - UNIVERSAL HIGH CONTRAST FORMAT */}
              <div id="printable-order-ticket">
                {renderTicketBody()}
              </div>
            </div>
          </div>
        );
      })()}

      {/* UNIVERSAL PRINT CSS STYLES FOR THERMAL POS & STANDARD A4/A5 PRINTERS */}
      <style jsx global>{`
        /* Screen Styles for Ticket */
        #printable-order-ticket {
          background-color: #FFFFFF;
          color: #000000;
          font-family: 'Arial', sans-serif;
          padding: 14px;
          border: 1px solid #000000;
          border-radius: 6px;
        }
        .company-title {
          font-size: 1.5rem;
          font-weight: 900;
          text-align: center;
          margin: 0;
          letter-spacing: 1px;
        }
        .ticket-subtitle {
          font-size: 0.8rem;
          font-weight: 800;
          text-align: center;
          margin: 2px 0 8px 0;
        }
        .ticket-header {
          border-bottom: 2px solid #000;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .ticket-order-meta {
          display: flex;
          justify: space-between;
          font-size: 0.85rem;
          font-weight: 700;
        }
        .client-info-box {
          border: 1.5px solid #000;
          border-radius: 4px;
          padding: 10px;
          margin-bottom: 14px;
          font-size: 0.85rem;
        }
        .info-row {
          margin-bottom: 4px;
        }
        .delivery-type-tag {
          font-weight: 900;
          margin-left: 4px;
        }
        .items-section {
          margin-bottom: 14px;
        }
        .section-title {
          font-size: 0.88rem;
          font-weight: 900;
          margin-bottom: 6px;
          border-bottom: 1px solid #000;
          padding-bottom: 3px;
        }
        .ticket-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .ticket-table th {
          border-bottom: 1.5px solid #000;
          padding: 6px 4px;
          text-align: left;
          background-color: #F1F5F9;
          font-weight: 800;
        }
        .ticket-table td {
          border-bottom: 1px solid #E2E8F0;
          padding: 6px 4px;
        }
        .product-code {
          font-size: 0.72rem;
          color: #475569;
          display: block;
        }
        .highlight-size {
          font-weight: 900;
          font-size: 0.95rem;
          color: #000000;
        }
        .highlight-qty {
          font-weight: 900;
          font-size: 1rem;
        }
        .totals-section {
          border-top: 2px solid #000;
          padding-top: 8px;
          margin-bottom: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .grand-total {
          font-size: 1.4rem;
          font-weight: 900;
        }
        .warehouse-checks {
          border: 1px dashed #000;
          padding: 10px;
          border-radius: 4px;
          font-size: 0.78rem;
        }
        /* PRINT MEDIA DIRECTIVES (UNIVERSAL COMPATIBILITY) */
        @media print {
          body * {
            visibility: hidden !important;
          }
          .no-print {
            display: none !important;
          }
          /* El modal de vista previa tiene scroll interno (overflow: auto)
             con altura limitada a la pantalla, y position:relative lo
             convierte en el "contenedor" del ticket absoluto. Sin esto,
             al imprimir/guardar como PDF el navegador solo captura lo que
             entraba en el scroll en ese momento (se cortaba el pedido). */
          .print-ticket-modal-backdrop {
            position: static !important;
            background: none !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            display: block !important;
          }
          .print-ticket-modal-card {
            position: static !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            max-width: none !important;
            width: 100% !important;
            padding: 0 !important;
          }
          #printable-order-ticket, #printable-order-ticket * {
            visibility: visible !important;
          }
          #printable-order-ticket {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .ticket-table th {
            background-color: transparent !important;
          }
        }
      `}</style>
    </div>
  );
}
