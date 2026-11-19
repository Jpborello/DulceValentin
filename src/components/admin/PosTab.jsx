'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Barcode,
  ScanLine,
  Search,
  Trash2,
  Printer,
  Undo2,
  AlertTriangle,
  RefreshCw,
  Users,
  Lock,
  PlusCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Tag,
  Store,
  DollarSign,
  ArrowRight,
  Layers,
  FileText,
  Zap,
  Sparkles,
  MapPin,
  Building
} from 'lucide-react';
import { renderBarcodeSvg } from '@/lib/barcodeRender';
import {
  resolveBarcodeMatches,
  ensureBarcodesForProduct,
  generateBarcodeValue,
  getProductVariants,
  formatVariantLabel,
  makeVariantKey,
  parseVariantKey,
  SIN_TALLE_KEY,
  SIN_COLOR_KEY,
  CUALQUIER_TALLE_KEY
} from '@/lib/barcode';
import { COMPANY_INFO } from '@/lib/companyInfo';
import { adminFetch } from '@/lib/adminFetch';
import { printThermalSaleTicket, printThermalZTicket, printIsolatedContent, printSaleDocument } from '@/lib/printUtils';
import { getProductPrice, getUnitPriceForType } from '@/lib/productPricing';
import { getVariantStock } from '@/lib/catalogData';
import SectionsConfig from '@/components/admin/SectionsConfig';

// Caja de sección (arriba). Por ahora es la del sector de niños.
const SECTION_LABEL = 'Sección Niños';

const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia (Alias / MP)' },
  { id: 'tarjeta', label: 'Tarjeta (Débito/Crédito)' },
  { id: 'otro', label: 'Otro' }
];

export default function PosTab({ products = [], orders = [], onRefresh }) {
  // Sub-pestañas internas de POS
  const [subTab, setSubTab] = useState('terminal'); // 'terminal' | 'barcodes' | 'cajeros' | 'pin'

  // Carrito de compras
  const [cart, setCart] = useState([]);
  const [scanValue, setScanValue] = useState('');
  const [scanError, setScanError] = useState('');
  const [unresolvedCode, setUnresolvedCode] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [variantPickerProduct, setVariantPickerProduct] = useState(null);
  const [productPickerMatches, setProductPickerMatches] = useState(null);
  const [posPricingMode, setPosPricingMode] = useState('ask'); // 'ask' | 'mayor' | 'menor'
  const [pendingScanItem, setPendingScanItem] = useState(null);

  // Datos del cobro
  const [clientName, setClientName] = useState('');
  const [clientDni, setClientDni] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [cashGiven, setCashGiven] = useState('');
  const [discount, setDiscount] = useState('');

  // Estado del checkout y preventas
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isEmittingPreventa, setIsEmittingPreventa] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [lastOrder, setLastOrder] = useState(null);
  const [lastSaleReceiptData, setLastSaleReceiptData] = useState(null);
  const [printFormat, setPrintFormat] = useState('thermal'); // 'thermal' (58mm/80mm) | 'a5' (Media Hoja) | 'a4' (Hoja Completa)
  const [posSection, setPosSection] = useState('caja_principal'); // 'caja_principal' (Caja General) | 'jeans_infantil' (venta de sección desde el panel)
  // Tickets de sección cargados en este cobro (se pueden juntar varios):
  // [{ id, sellerName, total, count }]. Sus renglones van en el carrito con
  // fromTicket = id y no se editan (el precio y el stock ya quedaron fijos).
  const [loadedTickets, setLoadedTickets] = useState([]);
  const [preventaNotice, setPreventaNotice] = useState('');

  // Vendedoras (tabla staff): la venta de sección queda a su nombre.
  const [sellers, setSellers] = useState([]);
  const [selectedSellerId, setSelectedSellerId] = useState(() => {
    try { return localStorage.getItem('dv_pos_seller') || ''; } catch { return ''; }
  });
  // Cajas de sección (configuración) y ventas pendientes de cobro (lista en vivo).
  const [sections, setSections] = useState([]);
  const [sellersWithCode, setSellersWithCode] = useState([]);
  const [pendingTickets, setPendingTickets] = useState([]);
  const [pendingError, setPendingError] = useState('');

  const selectSeller = (id) => {
    setSelectedSellerId(id);
    try { localStorage.setItem('dv_pos_seller', id); } catch {}
  };

  // Gestor de códigos de barra
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [expandedProductIds, setExpandedProductIds] = useState(new Set());
  const [labelModalProduct, setLabelModalProduct] = useState(null);
  const [labelModalVariants, setLabelModalVariants] = useState([]);
  const [labelModalQty, setLabelModalQty] = useState({});
  const [labelFormat, setLabelFormat] = useState('thermal'); // 'thermal' (50x25mm) | 'a4'
  const [labelShowPrice, setLabelShowPrice] = useState(true);

  // Cajeros y turnos
  const [cashiers, setCashiers] = useState([]);
  const [currentCashierCode, setCurrentCashierCode] = useState('101');
  const [activeShift, setActiveShift] = useState(null);
  const [shiftsHistory, setShiftsHistory] = useState([]);
  const [loadingPosData, setLoadingPosData] = useState(false);

  // Modales de turno
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState('20000');
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [closingNotesInput, setClosingNotesInput] = useState('');

  // Form Cajero
  const [showAddCashierModal, setShowAddCashierModal] = useState(false);
  const [cashierName, setCashierName] = useState('');
  const [cashierCode, setCashierCode] = useState('');
  const [cashierDni, setCashierDni] = useState('');
  const [cashierPhone, setCashierPhone] = useState('');
  const [savingCashier, setSavingCashier] = useState(false);

  // PIN de Supervisor
  const [supervisorPin, setSupervisorPin] = useState('1234');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinErrorMsg, setPinErrorMsg] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  // Modal para autorizar con PIN (anulaciones / vaciado)
  const [pinModal, setPinModal] = useState({ open: false, title: '', description: '', onSuccess: null });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const scanInputRef = useRef(null);

  // Cargar datos administrativos del POS
  const fetchPosAdminData = async () => {
    try {
      setLoadingPosData(true);
      const res = await adminFetch('/api/admin/pos');
      const data = await res.json();
      if (data.success) {
        if (data.supervisorPin) setSupervisorPin(data.supervisorPin);
        if (Array.isArray(data.cashiers)) setCashiers(data.cashiers);
        if (Array.isArray(data.sections)) setSections(data.sections);
        if (Array.isArray(data.sellersWithCode)) setSellersWithCode(data.sellersWithCode);
        if (Array.isArray(data.shifts)) {
          setShiftsHistory(data.shifts);
          const currentOpen = data.shifts.find((s) => s.status === 'open');
          if (currentOpen) setActiveShift(currentOpen);
        }
      }
    } catch (err) {
      console.warn('Error cargando POS admin data:', err);
    } finally {
      setLoadingPosData(false);
    }
  };

  const fetchSellers = async () => {
    try {
      const res = await adminFetch('/api/admin/staff');
      const data = await res.json();
      if (res.ok && Array.isArray(data.staff)) {
        const active = data.staff.filter((s) => s.active);
        // Primero las vendedoras, después el resto del personal.
        active.sort((a, b) => (a.role === 'vendedora' ? 0 : 1) - (b.role === 'vendedora' ? 0 : 1) || a.name.localeCompare(b.name));
        setSellers(active);
        setSelectedSellerId((prev) => (prev && !active.some((s) => s.id === prev) ? '' : prev));
      }
    } catch (err) {
      console.warn('Error cargando vendedoras:', err);
    }
  };

  useEffect(() => {
    fetchPosAdminData();
    fetchSellers();
  }, []);

  // Ventas pendientes de las cajas de sección: se actualizan solas cada 15 s
  // mientras está abierta la Caja General.
  const fetchPendingTickets = async () => {
    try {
      const res = await adminFetch('/api/pos?action=pending_tickets');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar las ventas pendientes.');
      setPendingTickets(data.tickets || []);
      setPendingError('');
    } catch (err) {
      setPendingError(err.message);
    }
  };

  useEffect(() => {
    if (subTab !== 'terminal' || posSection !== 'caja_principal') return undefined;
    fetchPendingTickets();
    const id = setInterval(fetchPendingTickets, 15000);
    return () => clearInterval(id);
  }, [subTab, posSection]);

  useEffect(() => {
    if (subTab === 'terminal') {
      scanInputRef.current?.focus();
    }
  }, [subTab]);

  const refocusScan = () => {
    setTimeout(() => {
      if (subTab === 'terminal') scanInputRef.current?.focus();
    }, 50);
  };

  // Sonido de confirmación con Web Audio API (cero dependencias externas)
  const playBeep = (freq = 900, type = 'sine', duration = 0.08) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  };

  // -------------------------------------------------------------
  // CARRITO & ESCANEO CON SOPORTE DE PRECIO X MAYOR Y X MENOR
  // -------------------------------------------------------------
  const getMayorPrice = (product, size) => {
    return getProductPrice(product, size);
  };

  // Misma regla que la caja de vendedoras: sin minorista propio (o igual al
  // mayorista base) sigue al precio por mayor, incluido el precio por talle.
  const getMenorPrice = (product, size) => getUnitPriceForType(product, size, 'menor');

  const addToCart = (product, variantKey, quantity = 1, priceType = null) => {
    setScanError('');
    setUnresolvedCode('');
    const { size, color } = parseVariantKey(variantKey);
    const key = `${product.id}::${variantKey || 'DEFAULT'}`;

    const effectiveType = priceType || (posPricingMode === 'menor' ? 'menor' : 'mayor');
    const unitPrice = effectiveType === 'menor' ? getMenorPrice(product, size) : getMayorPrice(product, size);
    // Stock fisico: en mostrador se pueden vender prendas no publicadas en la web.
    const stockAvailable = getVariantStock(product, size, color);

    setCart((prev) => {
      const idx = prev.findIndex((it) => it.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity, unitPrice, pricingType: effectiveType };
        return next;
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          product,
          name: product.name,
          code: product.code || '',
          variantKey,
          size,
          color,
          unitPrice,
          pricingType: effectiveType,
          quantity,
          stockAvailable
        }
      ];
    });

    playBeep(980, 'sine', 0.09);
    refocusScan();
  };

  const handleToggleItemPricingType = (itemKey) => {
    setCart((prev) => prev.map((it) => {
      if (it.key !== itemKey) return it;
      const nextType = it.pricingType === 'menor' ? 'mayor' : 'menor';
      const nextPrice = nextType === 'menor' ? getMenorPrice(it.product, it.size) : getMayorPrice(it.product, it.size);
      return {
        ...it,
        pricingType: nextType,
        unitPrice: nextPrice
      };
    }));
  };

  // Atajos de teclado para el selector de precio X Mayor / X Menor
  useEffect(() => {
    if (!pendingScanItem) return;
    const handleKeyDown = (e) => {
      if (e.key === '1' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        e.stopPropagation();
        addToCart(pendingScanItem.product, pendingScanItem.variantKey, pendingScanItem.quantity, 'mayor');
        setPendingScanItem(null);
      } else if (e.key === '2' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        addToCart(pendingScanItem.product, pendingScanItem.variantKey, pendingScanItem.quantity, 'menor');
        setPendingScanItem(null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setPendingScanItem(null);
        refocusScan();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [pendingScanItem]);

  const handleScan = async (rawCode) => {
    const code = rawCode.trim();
    if (!code) return;
    setScanError('');

    // 1. Ticket de una sección (LOC-XXXXXX, OFF-XXXXXXXX o los DV-PRE viejos):
    //    se suma al cobro. Se pueden juntar varios tickets en un solo pago.
    const upper = code.toUpperCase().replace(/^#/, '').replace(/^ORD-/, '').trim();
    if (/^(LOC-|OFF-|DV-)/.test(upper)) {
      if (loadedTickets.some((t) => t.id === upper)) {
        playBeep(260, 'sawtooth', 0.2);
        setScanError(`El ticket #${upper} ya está cargado en este cobro.`);
        return;
      }

      let data = null;
      try {
        const res = await adminFetch(`/api/pos?action=lookup_order&order_id=${encodeURIComponent(upper)}`);
        data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se encontró el ticket.');
      } catch (err) {
        playBeep(260, 'sawtooth', 0.2);
        setScanError(err.message || `No se encontró el ticket #${upper}.`);
        return;
      }

      const foundOrder = data.order;
      if (!data.pending) {
        playBeep(260, 'sawtooth', 0.2);
        setScanError(`El ticket #${foundOrder.id} ya fue cobrado o cancelado.`);
        return;
      }

      playBeep(1200, 'sine', 0.15);
      const newCartItems = (foundOrder.items || []).map((it, idx) => {
        const prod = it.product || it;
        const size = it.size || prod.selectedSize || null;
        const color = it.color || prod.selectedColor || null;
        const variantKey = makeVariantKey(size, color);
        const priceType = it.price_type || prod.price_type || null;
        return {
          key: `${foundOrder.id}::${prod.id || idx}::${variantKey}::${idx}`,
          fromTicket: foundOrder.id,
          productId: prod.id,
          product: prod,
          name: prod.name || it.name || 'Prenda',
          code: prod.code || '',
          variantKey,
          size,
          color,
          // Precio con el que se armó el ticket (lo fijó el servidor)
          unitPrice: Number(prod.unit_price ?? it.unit_price ?? it.price ?? 0),
          pricingType: priceType === 'menor' ? 'menor' : priceType === 'mayor' ? 'mayor' : null,
          quantity: Math.max(1, Number(it.quantity) || 1),
          stockAvailable: 99
        };
      });

      setCart((prev) => [...prev, ...newCartItems]);
      setLoadedTickets((prev) => [...prev, {
        id: foundOrder.id,
        sellerName: foundOrder.seller_name || '',
        total: Number(foundOrder.total_amount) || 0,
        count: newCartItems.reduce((s, it) => s + it.quantity, 0)
      }]);
      if (foundOrder.client_name && !['Consumidor Final', 'Venta en el local'].includes(foundOrder.client_name) && !clientName) {
        setClientName(foundOrder.client_name);
      }
      if (foundOrder.client_phone && !clientPhone) setClientPhone(foundOrder.client_phone);
      if (foundOrder.client_dni && !clientDni) setClientDni(foundOrder.client_dni);

      setPreventaNotice(`✓ Ticket #${foundOrder.id} cargado${foundOrder.seller_name ? ` (vendió ${foundOrder.seller_name})` : ''}`);
      setTimeout(() => setPreventaNotice(''), 6000);
      refocusScan();
      return;
    }

    // 2. Detección normal de códigos de barra por prenda
    const matches = resolveBarcodeMatches(products, code);

    if (matches.length === 0) {
      playBeep(260, 'sawtooth', 0.2);
      setScanError(`Código no reconocido: "${code}"`);
      setUnresolvedCode(code);
      return;
    }

    // Si coincide con más de un producto diferente
    const uniqueProducts = [];
    const seenIds = new Set();
    matches.forEach((m) => {
      if (!seenIds.has(m.product.id)) {
        seenIds.add(m.product.id);
        uniqueProducts.push(m);
      }
    });

    if (uniqueProducts.length > 1) {
      setProductPickerMatches(uniqueProducts);
      return;
    }

    const match = matches[0];
    if (match.variantKey === CUALQUIER_TALLE_KEY) {
      setVariantPickerProduct(match.product);
      return;
    }

    if (posPricingMode === 'ask') {
      setPendingScanItem({ product: match.product, variantKey: match.variantKey, quantity: 1 });
      playBeep(880, 'sine', 0.08);
      return;
    }

    addToCart(match.product, match.variantKey, 1, posPricingMode);
  };

  const onScanKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan(scanValue);
      setScanValue('');
    }
  };

  // Búsqueda manual de productos
  const manualResults = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return (products || [])
      .filter((p) => p.name?.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [manualSearch, products]);

  const handlePickManualProduct = (product) => {
    setManualSearch('');
    const variants = getProductVariants(product);
    if (variants.length === 1) {
      if (posPricingMode === 'ask') {
        setPendingScanItem({ product, variantKey: variants[0].key, quantity: 1 });
        playBeep(880, 'sine', 0.08);
      } else {
        addToCart(product, variants[0].key, 1, posPricingMode);
      }
    } else {
      setVariantPickerProduct(product);
    }
  };

  const subtotal = cart.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const discountNum = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountNum);
  const cashGivenNum = Number(cashGiven) || 0;
  const changeDue = paymentMethod === 'efectivo' && cashGivenNum > total ? cashGivenNum - total : 0;

  // -------------------------------------------------------------
  // COBRO & IMPRESIÓN (TÉRMICA, A5 Y A4) Y PREVENTA DE SECCIÓN
  // -------------------------------------------------------------
  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);
    setCheckoutError('');

    const cashierObj = cashiers.find((c) => c.code === currentCashierCode) || { name: 'Caja', code: currentCashierCode };
    const sectionLabel = posSection === 'jeans_infantil' ? SECTION_LABEL : 'Caja Principal';

    if (paymentMethod === 'efectivo' && cashGivenNum > 0 && cashGivenNum < total) {
      setCheckoutError('El efectivo recibido es menor al total.');
      setIsCheckingOut(false);
      return;
    }

    // Prendas sueltas (las de los tickets ya tienen precio y stock fijos).
    const looseItems = cart
      .filter((it) => !it.fromTicket)
      .map((it) => ({ productId: it.productId, size: it.size, color: it.color, quantity: it.quantity, pricingType: it.pricingType }));

    try {
      const res = await adminFetch('/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chargeSale',
          registerId: 'caja_01',
          cashierCode: cashierObj.code,
          cashierName: cashierObj.name,
          clientName: clientName.trim(),
          clientDni: clientDni.trim(),
          clientPhone: clientPhone.trim(),
          paymentMethod,
          cashGiven: paymentMethod === 'efectivo' && cashGivenNum > 0 ? cashGivenNum : null,
          discount: discountNum,
          preventaIds: loadedTickets.map((t) => t.id),
          items: looseItems,
          sellerId: looseItems.length > 0 ? selectedSellerId || null : null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al procesar la venta');
      }

      const receiptPayload = {
        format: printFormat,
        order: data.order,
        cajaName: sectionLabel,
        cashier: cashierObj.name,
        paymentMethod,
        cashGiven: paymentMethod === 'efectivo' ? cashGivenNum : null,
        changeDue: paymentMethod === 'efectivo' ? changeDue : null,
        isPreventa: false,
        sectionName: sectionLabel
      };

      setLastOrder(data.order);
      setLastSaleReceiptData(receiptPayload);

      // Disparar impresión según formato elegido (térmico, A5 o A4)
      printSaleDocument(receiptPayload);

      // Limpiar carrito y campos
      setCart([]);
      setClientName('');
      setClientDni('');
      setClientPhone('');
      setDiscount('');
      setCashGiven('');
      setLoadedTickets([]);
      playBeep(1200, 'sine', 0.15);

      if (onRefresh) onRefresh();
      fetchPosAdminData();
      fetchPendingTickets();
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setIsCheckingOut(false);
      refocusScan();
    }
  };

  // Emitir Ticket de Preventa (para la sección de arriba - Jeans & Infantil)
  const handleEmitPreventa = async () => {
    if (cart.length === 0 || isEmittingPreventa) return;
    setCheckoutError('');

    if (loadedTickets.length > 0 || cart.some((it) => it.fromTicket)) {
      setCheckoutError('Este carrito tiene tickets de sección cargados: cobralo con "Cobrar".');
      return;
    }
    const seller = sellers.find((s) => s.id === selectedSellerId);
    if (!seller) {
      setCheckoutError('Elegí la vendedora que hizo la venta (arriba, "Vendedora").');
      return;
    }
    if (discountNum > 0) {
      setCheckoutError('El descuento se aplica al cobrar en Caja Principal. Dejalo en 0 para emitir el ticket.');
      return;
    }

    setIsEmittingPreventa(true);
    const sectionLabel = posSection === 'jeans_infantil' ? SECTION_LABEL : 'Caja Principal';

    try {
      const res = await adminFetch('/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createPreventa',
          sectionName: sectionLabel,
          sellerId: seller.id,
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          items: cart.map((it) => ({ productId: it.productId, size: it.size, color: it.color, quantity: it.quantity, pricingType: it.pricingType }))
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al emitir preventa');
      }

      const receiptPayload = {
        format: printFormat,
        order: data.order,
        cajaName: sectionLabel,
        cashier: '',
        paymentMethod: 'A abonar en Caja',
        isPreventa: true,
        sectionName: sectionLabel
      };

      setLastOrder(data.order);
      setLastSaleReceiptData(receiptPayload);

      // Imprimir ticket de preventa para bajar a caja
      printSaleDocument(receiptPayload);

      setCart([]);
      setClientName('');
      setClientDni('');
      setClientPhone('');
      setDiscount('');
      setCashGiven('');
      setLoadedTickets([]);
      playBeep(1200, 'sine', 0.2);

      if (onRefresh) onRefresh();
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setIsEmittingPreventa(false);
      refocusScan();
    }
  };

  // Re-imprimir último comprobante
  const handleReprintLastTicket = (customFormat) => {
    if (lastSaleReceiptData) {
      printSaleDocument({
        ...lastSaleReceiptData,
        format: customFormat || printFormat || lastSaleReceiptData.format || 'thermal'
      });
    }
  };

  // -------------------------------------------------------------
  // AUTORIZACIÓN PIN SUPERVISOR
  // -------------------------------------------------------------
  const requestSupervisorPin = (title, description, onSuccess) => {
    setPinModal({ open: true, title, description, onSuccess });
    setPinInput('');
    setPinError('');
  };

  const verifySupervisorPinSubmit = (e) => {
    e.preventDefault();
    if (pinInput.trim() === supervisorPin.trim()) {
      const fn = pinModal.onSuccess;
      setPinModal({ open: false, title: '', description: '', onSuccess: null });
      if (typeof fn === 'function') fn();
    } else {
      setPinError('PIN incorrecto.');
    }
  };

  const handleClearCartProtected = () => {
    if (cart.length === 0) return;
    requestSupervisorPin(
      'Cancelar venta',
      'Ingresá el PIN de Supervisor para vaciar el carrito actual.',
      () => {
        setCart([]);
        setLoadedTickets([]);
        refocusScan();
      }
    );
  };

  const handleRemoveItemProtected = (itemKey, itemName) => {
    setCart((prev) => prev.filter((it) => it.key !== itemKey || it.fromTicket));
    refocusScan();
  };

  // Saca del cobro un ticket de sección entero (sigue pendiente para cobrarlo después).
  const handleRemoveTicket = (ticketId) => {
    setCart((prev) => prev.filter((it) => it.fromTicket !== ticketId));
    setLoadedTickets((prev) => prev.filter((t) => t.id !== ticketId));
    refocusScan();
  };

  // -------------------------------------------------------------
  // GESTIÓN DE CÓDIGOS DE BARRA & IMPRESIÓN DE ETIQUETAS
  // -------------------------------------------------------------
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchNotice, setBatchNotice] = useState('');
  const [generatingProductId, setGeneratingProductId] = useState(null);

  const barcodeStats = useMemo(() => {
    let totalVariants = 0;
    let productsWithAll = 0;
    let productsMissing = 0;

    products.forEach((p) => {
      const variants = getProductVariants(p);
      if (variants.length === 0) return;
      totalVariants += variants.length;
      const isComplete = variants.every((v) => p.barcodes && p.barcodes[v.key]);
      if (isComplete) {
        productsWithAll += 1;
      } else {
        productsMissing += 1;
      }
    });

    return { totalVariants, productsWithAll, productsMissing };
  }, [products]);

  const handleGenerateProductBarcodes = async (product) => {
    setGeneratingProductId(product.id);
    try {
      const fullBarcodes = ensureBarcodesForProduct(product);
      product.barcodes = fullBarcodes;
      await adminFetch('/api/admin/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveProductBarcodes', productId: product.id, barcodes: fullBarcodes })
      });
      setBatchNotice(`✓ Códigos generados y guardados para "${product.name}".`);
      setTimeout(() => setBatchNotice(''), 4000);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error al generar códigos: ' + (err.message || 'Error desconocido'));
    } finally {
      setGeneratingProductId(null);
    }
  };

  const handleGenerateAllMissingBarcodes = async () => {
    if (batchGenerating) return;
    setBatchGenerating(true);
    setBatchNotice('');
    try {
      const updates = [];
      let updatedProductsCount = 0;
      let totalVariantsGenerated = 0;

      products.forEach((p) => {
        const variants = getProductVariants(p);
        if (variants.length === 0) return;
        const currentBarcodes = p.barcodes || {};
        let needsUpdate = false;

        variants.forEach((v) => {
          if (!currentBarcodes[v.key]) {
            needsUpdate = true;
          }
        });

        if (needsUpdate) {
          const fullBarcodes = ensureBarcodesForProduct(p);
          p.barcodes = fullBarcodes;
          updates.push({ productId: p.id, barcodes: fullBarcodes });
          updatedProductsCount += 1;
          totalVariantsGenerated += variants.length;
        }
      });

      if (updates.length === 0) {
        setBatchNotice('✓ ¡Todas las prendas del catálogo ya tienen sus códigos de barra completos!');
        setTimeout(() => setBatchNotice(''), 4000);
        return;
      }

      const res = await adminFetch('/api/admin/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batchSaveBarcodes', updates })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al guardar');

      setBatchNotice(`🎉 ¡Listo! Se generaron y guardaron códigos para ${updatedProductsCount} prendas (${totalVariantsGenerated} variantes en total).`);
      setTimeout(() => setBatchNotice(''), 6000);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error en generación masiva: ' + (err.message || 'Error'));
    } finally {
      setBatchGenerating(false);
    }
  };

  const filteredBarcodeProducts = useMemo(() => {
    const q = barcodeSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name?.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
  }, [barcodeSearch, products]);

  const toggleExpandProduct = (id) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openLabelModal = (product) => {
    const variants = getProductVariants(product);
    const existing = product.barcodes || {};
    // Asegurar que tengan códigos. Si se generaron nuevos, se guardan en la base:
    // una etiqueta con un código que no está guardado no se puede cobrar.
    const before = JSON.stringify(product.barcodes || {});
    const fullBarcodes = ensureBarcodesForProduct(product);
    product.barcodes = fullBarcodes;
    if (JSON.stringify(fullBarcodes) !== before) {
      adminFetch('/api/admin/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveProductBarcodes', productId: product.id, barcodes: fullBarcodes })
      }).then((r) => { if (!r.ok) alert('Ojo: no se pudieron guardar los códigos de barra nuevos. No imprimas hasta resolverlo.'); })
        .catch(() => alert('Ojo: no se pudieron guardar los códigos de barra nuevos (sin conexión).'));
    }

    const initialQty = {};
    variants.forEach((v) => {
      initialQty[v.key] = Math.max(0, Number(v.stock) || 0);
    });

    setLabelModalProduct(product);
    setLabelModalVariants(variants);
    setLabelModalQty(initialQty);
  };

  const handlePrintLabelsAction = () => {
    if (!labelModalProduct) return;
    const itemsToPrint = [];

    labelModalVariants.forEach((v) => {
      const qty = parseInt(labelModalQty[v.key], 10) || 0;
      if (qty > 0) {
        const code = labelModalProduct.barcodes?.[v.key] || generateBarcodeValue(labelModalProduct, v.size, v.color);
        for (let i = 0; i < qty; i++) {
          itemsToPrint.push({
            productName: labelModalProduct.name,
            code: labelModalProduct.code || '',
            size: v.size,
            color: v.color,
            label: v.label,
            priceMayor: getUnitPriceForType(labelModalProduct, v.size, 'mayor'),
            priceMenor: getUnitPriceForType(labelModalProduct, v.size, 'menor'),
            barcode: code
          });
        }
      }
    });

    if (itemsToPrint.length === 0) {
      alert('Ingresá al menos 1 etiqueta para imprimir.');
      return;
    }

    const isThermal = labelFormat === 'thermal';
    const pageStyle = isThermal
      ? `@page { size: 50mm 25mm; margin: 0; }`
      : `@page { size: A4 portrait; margin: 8mm; }`;

    const htmlContent = `
      <div class="${isThermal ? 'thermal-labels-container' : 'a4-labels-grid'}">
        ${itemsToPrint.map((item) => {
          // Barras a ancho exacto (3 puntos de 203 dpi), sin estirar: ver barcodeRender.js
          // (barras de 7 mm de alto para que entren los dos precios)
          const svgMarkup = renderBarcodeSvg(item.barcode, { maxWidthMm: isThermal ? 46 : 60, barHeightMm: 7, fontMm: 2.4 });

          return `
            <div class="${isThermal ? 'thermal-label-card' : 'a4-label-card'}">
              <div class="label-header">
                <div class="label-brand">DV</div>
                ${item.code ? `<div class="label-code">${String(item.code).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>` : ''}
              </div>
              ${labelShowPrice ? `
                <div class="label-prices-row">
                  <span>$${Number(item.priceMenor || 0).toLocaleString('es-AR')}/${String(Math.round(Number(item.priceMayor || 0))).slice(0, 3)}</span>
                </div>` : ''}
              <div class="label-prod-name">${String(item.productName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              <div class="label-variant-info">
                ${item.label}
              </div>
              <div class="label-barcode-svg">
                ${svgMarkup}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    const styles = `
      ${pageStyle}
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #fff; color: #000; }
      .thermal-labels-container { width: 50mm; margin: 0; padding: 0; }
      .thermal-label-card {
        width: 50mm;
        height: 25mm;
        padding: 1.2mm 2mm;
        box-sizing: border-box;
        overflow: hidden;
        page-break-after: always;
        page-break-inside: avoid;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .a4-labels-grid {
        display: grid;
        grid-template-columns: repeat(3, 64mm);
        gap: 2mm 3mm;
      }
      .a4-label-card {
        width: 64mm;
        height: 33.9mm;
        border: 0.2mm dashed #bbb;
        padding: 1.5mm 2.5mm;
        box-sizing: border-box;
        page-break-inside: avoid;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      /* Marca y codigo de articulo juntos a la izquierda (el borde derecho no imprime). */
      .label-header {
        display: flex;
        justify-content: flex-start;
        gap: 3mm;
        align-items: center;
        border-bottom: 0.5px solid #000;
        padding-bottom: 0.5mm;
      }
      .label-brand { font-size: 6.5pt; font-weight: 900; letter-spacing: 0.4px; }
      .label-code { font-size: 8pt; font-weight: 900; white-space: nowrap; }
      /* Precio por menor y por mayor (en ese orden), sin rotulos. Pegada a la
         izquierda: la impresora no llega al borde derecho de la etiqueta. */
      .label-prices-row { display: flex; justify-content: flex-start; gap: 4mm; font-size: 8.5pt; font-weight: 900; margin-top: 0.4mm; white-space: nowrap; }
      .label-prod-name { font-size: 7pt; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.3mm; }
      .label-variant-info { font-size: 6.8pt; font-weight: 700; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .label-barcode-svg { display: flex; justify-content: center; margin-top: 0.3mm; }
      /* tamaño real en mm desde el SVG: NO escalar (las barras tienen que caer en puntos enteros) */
      .label-barcode-svg svg { display: block; flex: none; }
    `;

    printIsolatedContent({
      html: htmlContent,
      styles,
      title: `Etiquetas_${labelModalProduct.code || labelModalProduct.name}`
    });

    setLabelModalProduct(null);
  };

  return (
    <div style={{ padding: '4px 0 24px 0' }}>
      {/* BARRA SUPERIOR DE SUB-PESTAÑAS ESTÉTICAS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        borderRadius: '14px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSubTab('terminal')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.88rem',
              background: subTab === 'terminal' ? 'var(--accent-gold)' : 'var(--bg-surface-elevated)',
              color: subTab === 'terminal' ? '#000' : 'var(--text-main)',
              transition: 'all 0.15s ease'
            }}
          >
            <Store size={16} /> Terminal de Cobro
          </button>

          <button
            onClick={() => setSubTab('barcodes')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.88rem',
              background: subTab === 'barcodes' ? 'var(--accent-gold)' : 'var(--bg-surface-elevated)',
              color: subTab === 'barcodes' ? '#000' : 'var(--text-main)',
              transition: 'all 0.15s ease'
            }}
          >
            <Barcode size={16} /> Códigos de Barra & Etiquetas
          </button>

          <button
            onClick={() => setSubTab('cajeros')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.88rem',
              background: subTab === 'cajeros' ? 'var(--accent-gold)' : 'var(--bg-surface-elevated)',
              color: subTab === 'cajeros' ? '#000' : 'var(--text-main)',
              transition: 'all 0.15s ease'
            }}
          >
            <Users size={16} /> Cajeras & Turnos
          </button>

          <button
            onClick={() => setSubTab('pin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.88rem',
              background: subTab === 'pin' ? 'var(--accent-gold)' : 'var(--bg-surface-elevated)',
              color: subTab === 'pin' ? '#000' : 'var(--text-main)',
              transition: 'all 0.15s ease'
            }}
          >
            <Lock size={16} /> PIN Supervisor
          </button>
        </div>

        {/* SELECTOR DE SECCIÓN Y CAJERA ACTIVA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} style={{ color: 'var(--accent-gold)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>Sección:</span>
            <select
              value={posSection}
              onChange={(e) => setPosSection(e.target.value)}
              className="form-input"
              style={{ padding: '4px 10px', fontSize: '0.82rem', fontWeight: 800 }}
            >
              <option value="jeans_infantil">📍 {SECTION_LABEL} (Piso Arriba)</option>
              <option value="caja_principal">🏢 Caja Principal (Planta Baja)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={14} style={{ color: 'var(--accent-gold)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              {posSection === 'jeans_infantil' ? 'Vendedora:' : 'Vendedora (prendas sueltas):'}
            </span>
            <select
              value={selectedSellerId}
              onChange={(e) => selectSeller(e.target.value)}
              className="form-input"
              aria-label="Vendedora"
              style={{
                padding: '4px 10px',
                fontSize: '0.82rem',
                fontWeight: 800,
                borderColor: posSection === 'jeans_infantil' && !selectedSellerId ? '#DC2626' : undefined
              }}
            >
              <option value="">{posSection === 'jeans_infantil' ? '— Elegir vendedora —' : 'Sin vendedora'}</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>Cajera:</span>
            <select
              value={currentCashierCode}
              onChange={(e) => setCurrentCashierCode(e.target.value)}
              className="form-input"
              style={{ padding: '4px 10px', fontSize: '0.82rem', fontWeight: 800 }}
            >
              {cashiers.map((c) => (
                <option key={c.code} value={c.code}>
                  [{c.code}] {c.name}
                </option>
              ))}
            </select>
          </div>

          {lastSaleReceiptData && (
            <button
              onClick={() => handleReprintLastTicket()}
              className="btn-secondary"
              style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Reimprimir comprobante del último cliente"
            >
              <Printer size={13} /> Reimprimir Ticket
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUB-PESTAÑA 1: TERMINAL DE COBRO (POS)                    */}
      {/* ========================================================= */}
      {subTab === 'terminal' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)', gap: '16px' }}>
          {/* COLUMNA IZQUIERDA: ESCÁNER, BÚSQUEDA Y CARRITO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* INPUT DE ESCÁNER DE CÓDIGOS DE BARRA */}
            <div style={{
              background: 'var(--bg-card)',
              border: '2px solid var(--accent-gold)',
              borderRadius: '14px',
              padding: '16px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  <ScanLine size={18} style={{ color: 'var(--accent-gold-hover)' }} />
                  Lector de Código de Barras
                </label>

                {/* SELECTOR DE TARIFA LOCAL: PREGUNTAR / X MAYOR / X MENOR */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-surface-elevated)', padding: '2px 4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: '2px', marginLeft: '4px' }}>Tarifa:</span>
                  <button
                    type="button"
                    onClick={() => { setPosPricingMode('ask'); refocusScan(); }}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: posPricingMode === 'ask' ? 'var(--accent-gold)' : 'transparent',
                      color: posPricingMode === 'ask' ? '#000' : 'var(--text-muted)'
                    }}
                    title="Preguntar X Mayor o X Menor cada vez que se escanea"
                  >
                    ❓ Preguntar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPosPricingMode('mayor'); refocusScan(); }}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: posPricingMode === 'mayor' ? '#2563EB' : 'transparent',
                      color: posPricingMode === 'mayor' ? '#fff' : 'var(--text-muted)'
                    }}
                    title="Cobrar todo por Mayor automáticamente"
                  >
                    X Mayor
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPosPricingMode('menor'); refocusScan(); }}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: posPricingMode === 'menor' ? '#16A34A' : 'transparent',
                      color: posPricingMode === 'menor' ? '#fff' : 'var(--text-muted)'
                    }}
                    title="Cobrar todo por Menor automáticamente"
                  >
                    X Menor
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={scanInputRef}
                  type="text"
                  className="form-input"
                  placeholder="Escaneá la etiqueta de la prenda o ingresá el código..."
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={onScanKeyDown}
                  style={{ fontSize: '1rem', padding: '10px 14px', fontWeight: 800, flex: 1 }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => { handleScan(scanValue); setScanValue(''); }}
                  className="btn-primary"
                  style={{ padding: '0 18px', fontWeight: 800 }}
                >
                  Agregar
                </button>
              </div>

              {preventaNotice && (
                <div style={{ marginTop: '8px', color: '#166534', background: '#DCFCE7', border: '1px solid #86EFAC', padding: '8px 12px', borderRadius: '6px', fontSize: '0.84rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> {preventaNotice}
                </div>
              )}

              {scanError && (
                <div style={{ marginTop: '8px', color: '#DC2626', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} /> {scanError}
                </div>
              )}
            </div>

            {/* BÚSQUEDA MANUAL ALTERNATIVA */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="O buscá por nombre o código de artículo (ej. Remera, 0220)..."
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  style={{ paddingLeft: '36px', fontSize: '0.85rem' }}
                />
              </div>

              {manualResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 30,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  marginTop: '4px',
                  boxShadow: 'var(--shadow-md)',
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}>
                  {manualResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePickManualProduct(p)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 14px',
                        border: 'none',
                        borderBottom: '1px solid var(--border-color)',
                        background: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Art: {p.code || 'S/C'} · Stock total: {p.stock}
                        </div>
                      </div>
                      <div style={{ fontWeight: 900, color: 'var(--accent-gold-hover)', fontSize: '0.92rem' }}>
                        ${Number(p.wholesale_price || p.price || 0).toLocaleString('es-AR')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* VENTAS PENDIENTES DE LAS SECCIONES (solo en la Caja General) */}
            {posSection === 'caja_principal' && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={16} /> Ventas pendientes de cobro ({pendingTickets.filter((t) => !loadedTickets.some((l) => l.id === t.id)).length})
                  </h3>
                  <button type="button" onClick={fetchPendingTickets} title="Actualizar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <RefreshCw size={15} />
                  </button>
                </div>
                {pendingError && <div style={{ color: '#DC2626', fontSize: '0.8rem', fontWeight: 700 }}>{pendingError}</div>}
                {pendingTickets.filter((t) => !loadedTickets.some((l) => l.id === t.id)).length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No hay ventas esperando cobro. Las de las secciones aparecen acá solas.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                    {pendingTickets.filter((t) => !loadedTickets.some((l) => l.id === t.id)).map((t) => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.84rem' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800 }}>
                            {t.seller_name || 'Sin vendedora'} · ${t.total.toLocaleString('es-AR')}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {t.origin} · #{t.id} · {t.units} prenda{t.units === 1 ? '' : 's'} · {new Date(t.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <button type="button" onClick={() => handleScan(t.id)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          Sumar al cobro
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TABLA DEL CARRITO DE PRENDAS */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '16px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0 }}>
                  Prendas a Cobrar ({cart.reduce((s, it) => s + it.quantity, 0)})
                </h3>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCartProtected}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#DC2626',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={13} /> Vaciar carrito
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                  <ScanLine size={38} style={{ opacity: 0.3, margin: '0 auto 10px auto' }} />
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>El carrito está vacío</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                    Escaneá con la pistola lectora o buscá la prenda para comenzar.
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                        <th style={{ textAlign: 'left', padding: '8px 4px' }}>Prenda & Variante</th>
                        <th style={{ textAlign: 'center', padding: '8px 4px', width: '90px' }}>Cant.</th>
                        <th style={{ textAlign: 'right', padding: '8px 4px', width: '90px' }}>Unit.</th>
                        <th style={{ textAlign: 'right', padding: '8px 4px', width: '90px' }}>Total</th>
                        <th style={{ width: '36px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((it) => (
                        <tr key={it.key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 4px' }}>
                            <div style={{ fontWeight: 800 }}>{it.name}</div>
                            <div style={{ fontSize: '0.75rem', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                              {it.size && (
                                <span style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                  Talle {it.size}
                                </span>
                              )}
                              {it.color && (
                                <span style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  {it.color}
                                </span>
                              )}
                              {it.code && <span style={{ color: 'var(--text-muted)' }}>Art. {it.code}</span>}
                              {it.fromTicket && (
                                <span style={{ background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                  Ticket #{it.fromTicket}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                            {it.fromTicket ? (
                              <span style={{ fontWeight: 800 }}>{it.quantity}</span>
                            ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (it.quantity > 1) {
                                    setCart((prev) => prev.map((x) => x.key === it.key ? { ...x, quantity: x.quantity - 1 } : x));
                                  } else {
                                    handleRemoveItemProtected(it.key, it.name);
                                  }
                                }}
                                style={{ width: '22px', height: '22px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-surface-elevated)', cursor: 'pointer', fontWeight: 900 }}
                              >
                                -
                              </button>
                              <span style={{ fontWeight: 800, width: '24px', textAlign: 'center' }}>{it.quantity}</span>
                              <button
                                type="button"
                                onClick={() => setCart((prev) => prev.map((x) => x.key === it.key ? { ...x, quantity: x.quantity + 1 } : x))}
                                style={{ width: '22px', height: '22px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-surface-elevated)', cursor: 'pointer', fontWeight: 900 }}
                              >
                                +
                              </button>
                            </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>
                            <div>${it.unitPrice.toLocaleString('es-AR')}</div>
                            {it.pricingType && it.fromTicket && (
                              <span style={{ display: 'inline-block', fontSize: '0.67rem', padding: '2px 5px', borderRadius: '4px', marginTop: '3px', fontWeight: 800, background: it.pricingType === 'menor' ? '#FEF3C7' : '#DBEAFE', color: it.pricingType === 'menor' ? '#92400E' : '#1E40AF' }}>
                                {it.pricingType === 'menor' ? 'X MENOR' : 'X MAYOR'}
                              </span>
                            )}
                            {it.pricingType && !it.fromTicket && (
                              <button
                                type="button"
                                onClick={() => handleToggleItemPricingType(it.key)}
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.67rem',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: it.pricingType === 'menor' ? '#FEF3C7' : '#DBEAFE',
                                  color: it.pricingType === 'menor' ? '#92400E' : '#1E40AF',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  marginTop: '3px',
                                  letterSpacing: '0.3px'
                                }}
                                title="Hacé clic para cambiar entre Por Mayor y Por Menor"
                              >
                                {it.pricingType === 'menor' ? 'X MENOR ⇄' : 'X MAYOR ⇄'}
                              </button>
                            )}
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 900 }}>
                            ${(it.unitPrice * it.quantity).toLocaleString('es-AR')}
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                            {!it.fromTicket && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItemProtected(it.key, it.name)}
                                style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', padding: '2px' }}
                                title="Quitar prenda"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: LIQUIDACIÓN, MEDIO DE PAGO Y TICKET */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            height: 'fit-content'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
              Detalle de Cobro
            </h3>

            {/* TOTALES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                <span style={{ fontWeight: 800 }}>${subtotal.toLocaleString('es-AR')}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Descuento ($):</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="form-input"
                  style={{ width: '90px', padding: '4px 8px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 800 }}
                />
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
                borderTop: '2px solid var(--border-color)',
                fontSize: '1.3rem',
                fontWeight: 900,
                color: 'var(--accent-gold-hover)'
              }}>
                <span>TOTAL:</span>
                <span>${total.toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* MEDIO DE PAGO */}
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                Medio de Pago
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: paymentMethod === m.id ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                      background: paymentMethod === m.id ? 'var(--accent-gold-light)' : 'var(--bg-surface-elevated)',
                      cursor: 'pointer',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      textAlign: 'center'
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CÁLCULO DE VUELTO SI ES EFECTIVO */}
            {paymentMethod === 'efectivo' && (
              <div style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px dashed var(--border-color)',
                borderRadius: '10px',
                padding: '10px 12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Abona con ($):</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Monto entregado"
                    value={cashGiven}
                    onChange={(e) => setCashGiven(e.target.value)}
                    className="form-input"
                    style={{ width: '120px', padding: '5px 8px', textAlign: 'right', fontWeight: 900, fontSize: '0.9rem' }}
                  />
                </div>
                {cashGivenNum > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', fontWeight: 900 }}>
                    <span>Su Vuelto:</span>
                    <span style={{ color: changeDue >= 0 ? '#10B981' : '#DC2626' }}>
                      ${changeDue.toLocaleString('es-AR')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* DATOS DEL CLIENTE (OPCIONALES) */}
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                Datos del Cliente (Opcional)
              </label>
              <input
                type="text"
                placeholder="Nombre (ej. María López)"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="form-input"
                style={{ width: '100%', marginBottom: '6px', fontSize: '0.82rem' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="DNI / CUIT"
                  value={clientDni}
                  onChange={(e) => setClientDni(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.82rem' }}
                />
                <input
                  type="text"
                  placeholder="Teléfono"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.82rem' }}
                />
              </div>
            </div>

            {/* SELECTOR DE FORMATO DE IMPRESIÓN */}
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Printer size={13} /> Formato de Impresión
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {[
                  { id: 'thermal', label: '🧾 Térmica 58mm', desc: 'Rollo' },
                  { id: 'a5', label: '📑 Media Hoja A5', desc: 'Ahorro' },
                  { id: 'a4', label: '📄 Hoja A4', desc: 'Mayorista' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPrintFormat(f.id)}
                    style={{
                      padding: '7px 4px',
                      borderRadius: '8px',
                      border: printFormat === f.id ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                      background: printFormat === f.id ? 'var(--accent-gold-light)' : 'var(--bg-surface-elevated)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      textAlign: 'center',
                      lineHeight: 1.25
                    }}
                  >
                    <div>{f.label}</div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600 }}>{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AVISO DE PREVENTA VINCULADA */}
            {loadedTickets.length > 0 && (
              <div style={{
                background: '#FEF3C7',
                color: '#92400E',
                border: '1px solid #FDE68A',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: 800,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <span>🏷️ {loadedTickets.length === 1 ? 'Ticket cargado' : `${loadedTickets.length} tickets en este cobro`} (se cobran juntos):</span>
                {loadedTickets.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span>
                      #{t.id}{t.sellerName ? ` · ${t.sellerName}` : ''} · ${t.total.toLocaleString('es-AR')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTicket(t.id)}
                      style={{ background: 'none', border: 'none', color: '#92400E', cursor: 'pointer', fontSize: '0.74rem', textDecoration: 'underline', fontWeight: 700 }}
                      title="Sacar este ticket del cobro (queda pendiente)"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {checkoutError && (
              <div style={{ color: '#DC2626', fontSize: '0.82rem', fontWeight: 700, padding: '6px', background: '#FEE2E2', borderRadius: '6px' }}>
                {checkoutError}
              </div>
            )}

            {/* BOTONES DE ACCIÓN SEGÚN SECCIÓN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {posSection === 'jeans_infantil' ? (
                <>
                  <button
                    type="button"
                    onClick={handleEmitPreventa}
                    disabled={cart.length === 0 || isEmittingPreventa}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      padding: '13px',
                      fontSize: '1rem',
                      fontWeight: 900,
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '10px',
                      background: '#16A34A',
                      border: 'none',
                      color: '#fff',
                      boxShadow: '0 4px 12px rgba(22,163,74,0.3)'
                    }}
                  >
                    <Tag size={18} />
                    {isEmittingPreventa ? 'Emitiendo...' : 'Emitir Ticket Preventa (Bajar a Caja)'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || isCheckingOut}
                    className="btn-secondary"
                    style={{
                      width: '100%',
                      padding: '9px',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      justifyContent: 'center',
                      gap: '6px',
                      borderRadius: '8px'
                    }}
                  >
                    <Printer size={15} />
                    {isCheckingOut ? 'Cobrando...' : 'Cobrar Directo en Sección'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || isCheckingOut}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      padding: '13px',
                      fontSize: '1rem',
                      fontWeight: 900,
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '10px'
                    }}
                  >
                    <Printer size={18} />
                    {isCheckingOut ? 'Cobrando...' : 'Cobrar e Imprimir Comprobante'}
                  </button>

                  <button
                    type="button"
                    onClick={handleEmitPreventa}
                    disabled={cart.length === 0 || isEmittingPreventa}
                    className="btn-secondary"
                    style={{
                      width: '100%',
                      padding: '9px',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      justifyContent: 'center',
                      gap: '6px',
                      borderRadius: '8px'
                    }}
                  >
                    <Tag size={15} />
                    {isEmittingPreventa ? 'Emitiendo...' : 'Emitir Preventa / Presupuesto'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-PESTAÑA 2: GESTOR DE CÓDIGOS DE BARRA & ETIQUETAS     */}
      {/* ========================================================= */}
      {subTab === 'barcodes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* TARJETA SUPERIOR DE ACCIONES Y EXPLICACIÓN */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                    Códigos de Barra por Prenda, Talle y Color
                  </h3>
                  <span style={{ fontSize: '0.74rem', background: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: 800 }}>
                    {products.length} prendas registradas
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '6px 0 0 0', maxWidth: '680px', lineHeight: 1.45 }}>
                  El sistema genera automáticamente un código único y legible combinando el artículo + talle + color (ej: <code>DV0220-8-ROJO</code>). Podés generarlos todos con 1 clic para que las prendas queden listas para escanear en caja e imprimir en etiquetas térmicas.
                </p>
              </div>

              {/* BOTÓN MAESTRO DE 1 CLIC */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleGenerateAllMissingBarcodes}
                  disabled={batchGenerating}
                  className="btn-primary"
                  style={{
                    padding: '10px 18px',
                    fontSize: '0.86rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: barcodeStats.productsMissing > 0 ? '#16A34A' : 'var(--bg-surface-elevated)',
                    color: barcodeStats.productsMissing > 0 ? '#fff' : 'var(--text-main)',
                    border: barcodeStats.productsMissing > 0 ? 'none' : '1px solid var(--border-color)',
                    boxShadow: barcodeStats.productsMissing > 0 ? '0 4px 14px rgba(22,163,74,0.3)' : 'none',
                    cursor: batchGenerating ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Zap size={16} />
                  {batchGenerating ? 'Generando códigos...' : barcodeStats.productsMissing > 0 ? `⚡ Generar Códigos para TODO el Catálogo (${barcodeStats.productsMissing} pendientes)` : '✓ Todos los códigos generados'}
                </button>
              </div>
            </div>

            {/* ESTADÍSTICAS RÁPIDAS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A', display: 'inline-block' }}></span>
                <strong>{barcodeStats.productsWithAll}</strong> prendas con códigos completos
              </div>
              {barcodeStats.productsMissing > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#D97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D97706', display: 'inline-block' }}></span>
                  <strong>{barcodeStats.productsMissing}</strong> prendas con códigos pendientes
                </div>
              )}
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Total variantes de stock: <strong>{barcodeStats.totalVariants}</strong> (Talles × Colores)
              </div>
            </div>

            {batchNotice && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#DCFCE7',
                color: '#166534',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} /> {batchNotice}
              </div>
            )}
          </div>

          {/* LISTA DE PRENDAS Y BUSCADOR */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                Mostrando {filteredBarcodeProducts.length} de {products.length} prendas
              </span>

              <div style={{ position: 'relative', width: '300px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar prenda por nombre o código..."
                  value={barcodeSearch}
                  onChange={(e) => setBarcodeSearch(e.target.value)}
                  style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* LISTA DE PRENDAS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredBarcodeProducts.map((p) => {
                const isExpanded = expandedProductIds.has(p.id);
                const variants = getProductVariants(p);
                const missingCount = variants.filter((v) => !p.barcodes || !p.barcodes[v.key]).length;
                const isComplete = variants.length > 0 && missingCount === 0;
                const isGeneratingThis = generatingProductId === p.id;

                return (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      onClick={() => toggleExpandProduct(p.id)}
                      style={{
                        padding: '12px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{p.name}</div>
                        {p.code && (
                          <span style={{ fontSize: '0.74rem', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontWeight: 800 }}>
                            Art. {p.code}
                          </span>
                        )}
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {variants.length} variante{variants.length !== 1 ? 's' : ''} (Talle × Color)
                        </span>

                        {/* BADGE DE ESTADO DEL CÓDIGO */}
                        {isComplete ? (
                          <span style={{ fontSize: '0.72rem', background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> {variants.length} códigos listos
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={12} /> Faltan {missingCount} de {variants.length}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {!isComplete && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleGenerateProductBarcodes(p); }}
                            disabled={isGeneratingThis}
                            className="btn-primary"
                            style={{
                              padding: '5px 12px',
                              fontSize: '0.78rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              background: '#16A34A',
                              border: 'none',
                              color: '#fff',
                              fontWeight: 800
                            }}
                            title="Generar automáticamente los códigos de barra de esta prenda"
                          >
                            <Zap size={13} /> {isGeneratingThis ? 'Generando...' : 'Generar Códigos'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openLabelModal(p); }}
                          className="btn-secondary"
                          style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                          <Printer size={13} /> Imprimir Etiquetas
                        </button>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                        <BarcodeProductManagerRow
                          product={p}
                          variants={variants}
                          onSaveBarcodes={async (productId, updatedMap) => {
                            p.barcodes = updatedMap;
                            await adminFetch('/api/admin/pos', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'saveProductBarcodes', productId, barcodes: updatedMap })
                            });
                            if (onRefresh) onRefresh();
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-PESTAÑA 3: CAJERAS & TURNOS                          */}
      {/* ========================================================= */}
      {subTab === 'cajeros' && (
        <SectionsConfig
          key={sections.map((s) => s.id).join(',')}
          sections={sections}
          sellers={sellers}
          sellersWithCode={sellersWithCode}
          onChanged={fetchPosAdminData}
        />
      )}
      {subTab === 'cajeros' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.8fr)', gap: '16px' }}>
          {/* CAJERAS REGISTRADAS */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.02rem', fontWeight: 900, margin: 0 }}>
                Cajeras del Local
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCashierModal(true)}
                className="btn-primary"
                style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <PlusCircle size={14} /> Nueva Cajera
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cashiers.map((c) => (
                <div
                  key={c.code}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontWeight: 900,
                      fontSize: '0.85rem',
                      background: 'var(--accent-gold-light)',
                      color: 'var(--accent-gold-hover)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--accent-gold)'
                    }}>
                      [{c.code}]
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{c.name}</div>
                      {c.dni && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>DNI: {c.dni}</div>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`¿Dar de baja a la cajera ${c.name}?`)) return;
                      await adminFetch('/api/admin/pos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'deleteCashier', code: c.code })
                      });
                      fetchPosAdminData();
                    }}
                    style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Dar de baja
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* HISTORIAL DE TURNOS & CIERRE Z */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '18px'
          }}>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 900, margin: '0 0 14px 0' }}>
              Turnos & Arqueos de Caja Recientes
            </h3>

            {shiftsHistory.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay turnos registrados aún.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {shiftsHistory.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800 }}>
                        {s.cashier_name} ({s.cashier_code}) · {new Date(s.opened_at).toLocaleDateString('es-AR')}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 800,
                        fontSize: '0.72rem',
                        background: s.status === 'open' ? '#D1FAE5' : '#F3F4F6',
                        color: s.status === 'open' ? '#065F46' : '#374151'
                      }}>
                        {s.status === 'open' ? 'TURNO ABIERTO' : 'CERRADO (Z)'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                      <span>Ventas: ${Number(s.sales_total || 0).toLocaleString('es-AR')} ({s.sales_count || 0} op.)</span>
                      <span>Efectivo esp.: ${Number(s.expected_cash || 0).toLocaleString('es-AR')}</span>
                      {s.counted_cash !== null && <span>Arqueo real: ${Number(s.counted_cash).toLocaleString('es-AR')}</span>}
                    </div>

                    {s.status === 'closed' && (
                      <div style={{ marginTop: '6px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => printThermalZTicket(s)}
                          style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            background: 'var(--bg-card)',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Printer size={11} style={{ display: 'inline', marginRight: '4px' }} />
                          Reimprimir Ticket Z
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-PESTAÑA 4: PIN DE SUPERVISOR                         */}
      {/* ========================================================= */}
      {subTab === 'pin' && (
        <div style={{
          maxWidth: '480px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '24px'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '8px' }}>
            PIN de Supervisor
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Este PIN es requerido en el mostrador para cancelar ventas, anular comprobantes o vaciar carritos.
          </p>

          <form onSubmit={async (e) => {
            e.preventDefault();
            if (newPin.trim().length < 4) {
              setPinErrorMsg('El PIN debe tener al menos 4 dígitos numéricos.');
              return;
            }
            if (newPin !== confirmPin) {
              setPinErrorMsg('Los PINs no coinciden.');
              return;
            }
            setSavingPin(true);
            setPinErrorMsg('');
            setPinMsg('');
            try {
              const res = await adminFetch('/api/admin/pos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updatePin', pin: newPin })
              });
              const data = await res.json();
              if (!res.ok || !data.success) throw new Error(data.error || 'Error al actualizar PIN');
              setSupervisorPin(newPin);
              setPinMsg('✓ PIN actualizado con éxito.');
              setNewPin('');
              setConfirmPin('');
            } catch (err) {
              setPinErrorMsg(err.message);
            } finally {
              setSavingPin(false);
            }
          }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Nuevo PIN (mínimo 4 dígitos)
              </label>
              <input
                type="password"
                maxLength={8}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="form-input"
                style={{ width: '100%', fontSize: '1rem', fontWeight: 900, letterSpacing: '4px' }}
                placeholder="••••"
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Confirmar Nuevo PIN
              </label>
              <input
                type="password"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="form-input"
                style={{ width: '100%', fontSize: '1rem', fontWeight: 900, letterSpacing: '4px' }}
                placeholder="••••"
                required
              />
            </div>

            {pinErrorMsg && <div style={{ color: '#DC2626', fontSize: '0.82rem', fontWeight: 700, marginBottom: '10px' }}>{pinErrorMsg}</div>}
            {pinMsg && <div style={{ color: '#10B981', fontSize: '0.82rem', fontWeight: 800, marginBottom: '10px' }}>{pinMsg}</div>}

            <button type="submit" disabled={savingPin} className="btn-primary" style={{ padding: '10px 18px', fontWeight: 800 }}>
              {savingPin ? 'Guardando...' : 'Actualizar PIN'}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: IMPRESIÓN DE ETIQUETAS PARA PRENDA                */}
      {/* ========================================================= */}
      {labelModalProduct && (
        <div className="modal-backdrop active" onClick={() => setLabelModalProduct(null)}>
          <div
            className="modal-box"
            style={{ maxWidth: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Barcode size={20} /> Imprimir Etiquetas: {labelModalProduct.name}
              </h3>
              <button
                type="button"
                onClick={() => setLabelModalProduct(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 900 }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
              Elegí cuántas etiquetas imprimir para cada talle y color (prellenado con el stock actual).
            </p>

            {/* FORMATO DE IMPRESIÓN */}
            <div style={{
              display: 'flex',
              gap: '10px',
              padding: '10px 12px',
              background: 'var(--bg-surface-elevated)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginBottom: '14px',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setLabelFormat('thermal')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: labelFormat === 'thermal' ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                    background: labelFormat === 'thermal' ? 'var(--accent-gold-light)' : 'var(--bg-card)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Rollo Térmico (50 × 25 mm)
                </button>
                <button
                  type="button"
                  onClick={() => setLabelFormat('a4')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: labelFormat === 'a4' ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                    background: labelFormat === 'a4' ? 'var(--accent-gold-light)' : 'var(--bg-card)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Plancha A4 (3 × 8)
                </button>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={labelShowPrice}
                  onChange={(e) => setLabelShowPrice(e.target.checked)}
                />
                Incluir Precio
              </label>
            </div>

            {/* LISTA DE VARIANTES */}
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '14px' }}>
              {labelModalVariants.map((v) => (
                <div
                  key={v.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-color)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem' }}>{v.label}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Código: <code>{labelModalProduct.barcodes?.[v.key] || generateBarcodeValue(labelModalProduct, v.size, v.color)}</code> · Stock: {v.stock}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Etiquetas:</span>
                    <input
                      type="number"
                      min="0"
                      value={labelModalQty[v.key] ?? 0}
                      onChange={(e) => setLabelModalQty((prev) => ({
                        ...prev,
                        [v.key]: Math.max(0, parseInt(e.target.value, 10) || 0)
                      }))}
                      className="form-input"
                      style={{ width: '70px', padding: '4px 6px', textAlign: 'center', fontWeight: 800 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>
                Total: {Object.values(labelModalQty).reduce((s, n) => s + (parseInt(n, 10) || 0), 0)} etiquetas
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setLabelModalProduct(null)}
                  className="btn-secondary"
                  style={{ padding: '8px 14px' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePrintLabelsAction}
                  className="btn-primary"
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900 }}
                >
                  <Printer size={16} /> Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SELECCIÓN DE VARIANTE (TALLE Y COLOR)             */}
      {/* ========================================================= */}
      {variantPickerProduct && (
        <div className="modal-backdrop active" onClick={() => setVariantPickerProduct(null)}>
          <div className="modal-box" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px' }}>
              Elegí Talle y Color: {variantPickerProduct.name}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Hacé clic en la variante que se va a sumar al carrito:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto', marginBottom: '14px' }}>
              {getProductVariants(variantPickerProduct).map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => {
                    const prod = variantPickerProduct;
                    const vk = v.key;
                    setVariantPickerProduct(null);
                    if (posPricingMode === 'ask') {
                      setPendingScanItem({ product: prod, variantKey: vk, quantity: 1 });
                      playBeep(880, 'sine', 0.08);
                    } else {
                      addToCart(prod, vk, 1, posPricingMode);
                    }
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface-elevated)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 800,
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-gold-light)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated)'}
                >
                  <span>{v.label}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Stock: {v.stock}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setVariantPickerProduct(null)}
              className="btn-secondary"
              style={{ width: '100%', padding: '8px' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SELECCIÓN DE PRECIO (X MAYOR O X MENOR)           */}
      {/* ========================================================= */}
      {pendingScanItem && (
        <div className="modal-backdrop active" onClick={() => { setPendingScanItem(null); refocusScan(); }}>
          <div className="modal-box" style={{ maxWidth: '440px', textAlign: 'center', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--accent-gold-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto'
            }}>
              <Tag size={24} style={{ color: 'var(--accent-gold)' }} />
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '6px' }}>
              ¿Cobrar por Mayor o por Menor?
            </h3>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              <strong style={{ color: 'var(--text-main)', display: 'block', fontSize: '1rem' }}>
                {pendingScanItem.product.name}
              </strong>
              {(() => {
                const { size, color } = parseVariantKey(pendingScanItem.variantKey);
                return (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '4px', fontSize: '0.8rem' }}>
                    {size && <span style={{ background: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: '4px' }}>Talle: {size}</span>}
                    {color && <span style={{ background: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: '4px' }}>Color: {color}</span>}
                  </div>
                );
              })()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {/* OPCION 1: POR MAYOR */}
              <button
                type="button"
                autoFocus
                onClick={() => {
                  addToCart(pendingScanItem.product, pendingScanItem.variantKey, pendingScanItem.quantity, 'mayor');
                  setPendingScanItem(null);
                }}
                style={{
                  padding: '16px 12px',
                  borderRadius: '12px',
                  border: '2px solid #2563EB',
                  background: '#EFF6FF',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  [1] Por Mayor
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1E3A8A' }}>
                  ${getMayorPrice(pendingScanItem.product, parseVariantKey(pendingScanItem.variantKey).size).toLocaleString('es-AR')}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#3B82F6' }}>
                  Precio mayorista
                </span>
              </button>

              {/* OPCION 2: POR MENOR */}
              <button
                type="button"
                onClick={() => {
                  addToCart(pendingScanItem.product, pendingScanItem.variantKey, pendingScanItem.quantity, 'menor');
                  setPendingScanItem(null);
                }}
                style={{
                  padding: '16px 12px',
                  borderRadius: '12px',
                  border: '2px solid #16A34A',
                  background: '#F0FDF4',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  [2 / Enter] Por Menor
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#14532D' }}>
                  ${getMenorPrice(pendingScanItem.product, parseVariantKey(pendingScanItem.variantKey).size).toLocaleString('es-AR')}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#22C55E' }}>
                  Precio local al público
                </span>
              </button>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              💡 Atajo de teclado: presioná <strong>1</strong> para Mayor o <strong>2 / Enter</strong> para Menor (o <strong>Esc</strong> para cancelar).
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PIN DE SUPERVISOR                                 */}
      {/* ========================================================= */}
      {pinModal.open && (
        <div className="modal-backdrop active" onClick={() => setPinModal({ open: false, title: '', description: '', onSuccess: null })}>
          <div className="modal-box" style={{ maxWidth: '360px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px' }}>
              {pinModal.title}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              {pinModal.description}
            </p>

            <form onSubmit={verifySupervisorPinSubmit}>
              <input
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="form-input"
                placeholder="Ingresá el PIN"
                style={{ width: '100%', fontSize: '1.2rem', textAlign: 'center', fontWeight: 900, letterSpacing: '6px', marginBottom: '10px' }}
                autoFocus
              />
              {pinError && <div style={{ color: '#DC2626', fontSize: '0.8rem', fontWeight: 700, marginBottom: '10px', textAlign: 'center' }}>{pinError}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPinModal({ open: false, title: '', description: '', onSuccess: null })}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '9px' }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '9px', fontWeight: 900 }}>
                  Autorizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: NUEVA CAJERA                                      */}
      {/* ========================================================= */}
      {showAddCashierModal && (
        <div className="modal-backdrop active" onClick={() => setShowAddCashierModal(false)}>
          <div className="modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '14px' }}>
              Registrar Nueva Cajera
            </h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSavingCashier(true);
              try {
                const res = await adminFetch('/api/admin/pos', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'addCashier',
                    code: cashierCode.trim(),
                    name: cashierName.trim(),
                    dni: cashierDni.trim(),
                    phone: cashierPhone.trim()
                  })
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.error || 'Error al guardar');
                setShowAddCashierModal(false);
                setCashierCode('');
                setCashierName('');
                setCashierDni('');
                setCashierPhone('');
                fetchPosAdminData();
              } catch (err) {
                alert(err.message);
              } finally {
                setSavingCashier(false);
              }
            }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Código (3 dígitos)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={cashierCode}
                  onChange={(e) => setCashierCode(e.target.value)}
                  placeholder="ej. 103"
                  className="form-input"
                  style={{ width: '100%', fontWeight: 800 }}
                  required
                />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Nombre completo</label>
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  placeholder="ej. Belén Barbieri"
                  className="form-input"
                  style={{ width: '100%' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>DNI (Opcional)</label>
                <input
                  type="text"
                  value={cashierDni}
                  onChange={(e) => setCashierDni(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <button type="button" onClick={() => setShowAddCashierModal(false)} className="btn-secondary" style={{ flex: 1, padding: '9px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={savingCashier} className="btn-primary" style={{ flex: 1, padding: '9px', fontWeight: 900 }}>
                  {savingCashier ? 'Guardando...' : 'Crear Cajera'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Fila expandible de gestión de códigos de barra para un producto específico.
 */
function BarcodeProductManagerRow({ product, variants, onSaveBarcodes }) {
  const [barcodes, setBarcodes] = useState(() => ensureBarcodesForProduct(product));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCodeChange = (key, val) => {
    setSaved(false);
    setBarcodes((prev) => ({ ...prev, [key]: val }));
  };

  const handleRegenerate = (v) => {
    setSaved(false);
    const newCode = generateBarcodeValue(product, v.size, v.color);
    setBarcodes((prev) => ({ ...prev, [v.key]: newCode }));
  };

  const handleGenerateAllMissing = () => {
    setSaved(false);
    const filled = { ...barcodes };
    const used = new Set(Object.values(filled).filter(Boolean).map((c) => String(c).trim().toUpperCase()));
    variants.forEach((v) => {
      if (!filled[v.key]) {
        filled[v.key] = generateBarcodeValue({ ...product, barcodes: filled }, v.key, null, used);
        used.add(filled[v.key]);
      }
    });
    setBarcodes(filled);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveBarcodes(product.id, barcodes);
      setSaved(true);
    } catch (err) {
      alert('Error al guardar códigos: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
          Códigos asignados a cada variante:
        </span>
        <button
          type="button"
          onClick={handleGenerateAllMissing}
          className="btn-secondary"
          style={{ padding: '4px 10px', fontSize: '0.74rem' }}
        >
          Generar faltantes automáticamente
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        {variants.map((v) => (
          <div
            key={v.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              padding: '6px 8px',
              background: 'var(--bg-surface-elevated)',
              borderRadius: '6px',
              border: '1px solid var(--border-color)'
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.label}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Stock: {v.stock}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                value={barcodes[v.key] || ''}
                onChange={(e) => handleCodeChange(v.key, e.target.value)}
                placeholder="Código"
                className="form-input"
                style={{ width: '130px', padding: '4px 6px', fontSize: '0.76rem', fontWeight: 800 }}
              />
              <button
                type="button"
                onClick={() => handleRegenerate(v)}
                title="Generar nuevo código"
                style={{ padding: '4px 6px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-card)', cursor: 'pointer' }}
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
          style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 800 }}
        >
          {saving ? 'Guardando...' : saved ? '✓ Códigos Guardados' : 'Guardar Códigos'}
        </button>
      </div>
    </div>
  );
}

