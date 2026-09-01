'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, Truck, Store, Upload, CheckCircle2, UserCheck, Sparkles, Tag, Copy, Check, CreditCard, Clock, Edit3, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { dataStore } from '@/lib/dataStore';
import useCloseOnBack from '@/lib/useCloseOnBack';

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems, 
  onUpdateQuantity, 
  onRemoveItem, 
  onCheckout, 
  onRestoreCart,
  currentUser,
  onOpenAuth
}) {
  const handleClose = useCloseOnBack(isOpen, onClose);
  const [deliveryMethod, setDeliveryMethod] = useState('envio'); // 'envio' or 'retiro'
  const [clientDni, setClientDni] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientLocality, setClientLocality] = useState('');

  const [clientAddress, setClientAddress] = useState('');
  const [clientPostalCode, setClientPostalCode] = useState('');
  const [clientFloorApt, setClientFloorApt] = useState('');
  
  // Checkout & Receipt state
  const [createdOrder, setCreatedOrder] = useState(null);
  const [receiptImage, setReceiptImage] = useState(null);
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [isFinishedSuccess, setIsFinishedSuccess] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState('');

  // Baucher/credito disponible para el telefono que se esta cargando (ya
  // sea de una cuenta registrada o tipeado a mano) — se detecta solo, sin
  // que el cliente tenga que hacer nada mas que cargar su numero.
  const [voucher, setVoucher] = useState(null); // { id, amount, reason }
  const phoneForVoucher = currentUser?.phone || clientPhone;

  useEffect(() => {
    const digits = String(phoneForVoucher || '').replace(/\D/g, '');
    if (digits.length < 8) {
      setVoucher(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vouchers?phone=${encodeURIComponent(phoneForVoucher)}`);
        const data = await res.json();
        if (!cancelled) setVoucher(data.voucher || null);
      } catch {
        if (!cancelled) setVoucher(null);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phoneForVoucher]);

  const activeOrderFromStore = dataStore.getActiveOrder();
  const displayOrder = createdOrder || activeOrderFromStore;

  const transferDetails = dataStore.getTransferDetails();
  const [copiedAlias1, setCopiedAlias1] = useState(false);
  const [copiedAlias2, setCopiedAlias2] = useState(false);

  const handleCopyAlias1 = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(transferDetails.alias1);
    }
    setCopiedAlias1(true);
    setTimeout(() => setCopiedAlias1(false), 2500);
  };

  const handleCopyAlias2 = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(transferDetails.alias2);
    }
    setCopiedAlias2(true);
    setTimeout(() => setCopiedAlias2(false), 2500);
  };

  // Wholesale calculations & Minimum Purchase Requirement ($50.000)
  const cartSubtotal = cartItems.reduce((sum, item) => {
    const itemPrice = item.product.wholesale_price || item.product.price || 0;
    return sum + (itemPrice * item.quantity);
  }, 0);
  const MIN_PURCHASE_THRESHOLD = 50000;
  const isMinPurchaseReached = cartSubtotal >= MIN_PURCHASE_THRESHOLD;
  const voucherDiscount = Math.min(cartSubtotal, voucher?.amount || 0);
  const finalTotal = cartSubtotal - voucherDiscount;
  const amountNeeded = Math.max(0, MIN_PURCHASE_THRESHOLD - cartSubtotal);
  const progressPercent = Math.min(100, Math.round((cartSubtotal / MIN_PURCHASE_THRESHOLD) * 100));

  const handleCreateOrder = (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    if (!isMinPurchaseReached) {
      alert(`El mínimo de compra mayorista es de $50.000. Te faltan $${amountNeeded.toLocaleString('es-AR')} para poder finalizar el pedido.`);
      return;
    }

    const name = currentUser?.name || clientName;
    const phone = currentUser?.phone || clientPhone;
    const dni = currentUser?.dni || clientDni;
    const locality = currentUser?.locality || clientLocality;
    const address = clientAddress || currentUser?.address || '';
    const postalCode = clientPostalCode;
    const floorApt = clientFloorApt;

    if (!name || !phone || !dni || !locality) {
      alert('Por favor completá todos los datos personales requeridos (DNI, Teléfono, Nombre y Localidad).');
      return;
    }

    if (deliveryMethod === 'envio' && !address) {
      alert('Para envío a domicilio necesitamos al menos la Dirección completa.');
      return;
    }

    // El Codigo Postal ya NO bloquea el pedido si falta: es importante para
    // el transporte pero preferimos perder ese dato a perder la venta entera
    // (paso esto por lo que le paso a una clienta que quedo trabada sin
    // poder finalizar). Si falta, se avisa y se deja seguir -- el pedido
    // queda marcado para que el admin lo pida antes de despachar (ver
    // OrdersTab.jsx).
    if (deliveryMethod === 'envio' && !postalCode) {
      const seguir = window.confirm(
        'No cargaste el Código Postal. Podés continuar igual y te lo vamos a pedir antes de despachar el pedido, o cancelar para completarlo ahora. ¿Continuar sin Código Postal?'
      );
      if (!seguir) return;
    }

    const orderData = onCheckout(cartItems, {
      name,
      phone,
      dni,
      locality,
      address,
      postalCode,
      floorApt,
      isRegistered: Boolean(currentUser),
      deliveryMethod: deliveryMethod === 'envio' ? 'Envío a Domicilio / Transporte' : 'Retiro por Sucursal (Pte. Perón 5349/5305/5265)',
      voucherId: voucher?.id || null,
      voucherAmount: voucherDiscount
    });

    // Si se uso un baucher, lo marcamos como canjeado para que no se pueda
    // volver a aplicar. Si falla (ej: dos pedidos casi al mismo tiempo con
    // el mismo telefono), no rompemos el pedido — ya se cobro el monto
    // correcto igual, solo quedaria el baucher sin marcar y habria que
    // revisarlo a mano.
    if (voucher?.id && orderData?.id) {
      fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucher_id: voucher.id, order_id: orderData.id })
      }).catch(() => {});
    }

    const fullOrderObj = {
      ...orderData,
      client_name: name,
      client_phone: phone,
      client_dni: dni,
      client_locality: locality,
      client_address: address,
      client_postal_code: postalCode,
      client_floor_apt: floorApt,
      delivery_method: deliveryMethod
    };

    setCreatedOrder(fullOrderObj);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !displayOrder) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptImage(reader.result);
      setReceiptUploaded(true);
    };
    reader.readAsDataURL(file);

    if (supabase) {
      try {
        const ext = file.name.split('.').pop() || 'png';
        const filePath = `comprobantes/comprobante_${displayOrder.id}_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('Productos').upload(filePath, file, { upsert: true });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('Productos').getPublicUrl(filePath);
          const receiptPublicUrl = urlData.publicUrl;
          dataStore.updateOrderReceipt(displayOrder.id, receiptPublicUrl);
        }
      } catch (err) {
        console.warn('Error subiendo comprobante a Supabase Storage:', err);
      }
    }
  };

  const handleFinishWithReceipt = () => {
    if (!displayOrder) return;
    const targetId = displayOrder.id;
    dataStore.updateOrderStatus(targetId, 'comprobante_subido');
    setCompletedOrderId(targetId);
    dataStore.clearActiveOrder();
    setCreatedOrder(null);
    setReceiptImage(null);
    setReceiptUploaded(false);
    setIsFinishedSuccess(true);
  };

  const handleModifyOrCancelOrder = () => {
    if (displayOrder?.items && onRestoreCart) {
      onRestoreCart(displayOrder.items);
    }
    dataStore.clearActiveOrder();
    setCreatedOrder(null);
    setReceiptImage(null);
    setReceiptUploaded(false);
    setIsFinishedSuccess(false);
  };

  const handleStartNewOrder = () => {
    dataStore.clearActiveOrder();
    setCreatedOrder(null);
    setReceiptImage(null);
    setReceiptUploaded(false);
    setIsFinishedSuccess(false);
  };

  const handleResetToCatalog = () => {
    setIsFinishedSuccess(false);
    setCompletedOrderId('');
    dataStore.clearActiveOrder();
    setCreatedOrder(null);
    setReceiptImage(null);
    setReceiptUploaded(false);
    handleClose();
  };

  return (
    <div className={`drawer-backdrop ${isOpen ? 'active' : ''}`}>
      <div className="cart-drawer-panel">
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={22} className="text-accent-gold" />
            <h3 className="drawer-title">
              {createdOrder ? 'Confirmación de Pedido' : 'Tu Carrito de Compras'}
            </h3>
          </div>
          <button onClick={handleClose} className="qty-btn">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {/* STEP 3: SUCCESS THANK YOU SCREEN */}
          {isFinishedSuccess ? (
            <div style={{ padding: '24px 12px', textAlign: 'center' }}>
              <div style={{
                width: '72px',
                height: '72px',
                backgroundColor: '#ECFDF5',
                color: '#10B981',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto',
                border: '3px solid #A7F3D0',
                boxShadow: '0 4px 16px rgba(16,185,129,0.2)'
              }}>
                <CheckCircle2 size={44} />
              </div>

              <h2 style={{ fontSize: '1.45rem', fontWeight: 900, marginBottom: '8px', color: 'var(--text-main)' }}>
                ¡Muchas Gracias por tu Compra!
              </h2>

              <p style={{ fontSize: '0.92rem', color: '#10B981', fontWeight: 800, marginBottom: '20px' }}>
                🎉 Tu pedido {completedOrderId ? `#${completedOrderId}` : ''} fue recibido exitosamente.
              </p>

              {/* Out of hours notice banner */}
              {(() => {
                try {
                  const now = new Date();
                  const argStr = now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' });
                  const argDate = new Date(argStr);
                  const day = argDate.getDay();
                  const mins = argDate.getHours() * 60 + argDate.getMinutes();
                  if (day === 0 || mins < 480 || mins > 990) {
                    return (
                      <div style={{
                        backgroundColor: '#FFFBEB',
                        color: '#B45309',
                        border: '1px solid #FDE68A',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        marginBottom: '16px',
                        textAlign: 'left'
                      }}>
                        🌙 <strong>Aviso de Horario de Atención:</strong> Nuestro horario de atención es de Lunes a Sábados de 8:00 a 17:00 hs. Tu pedido quedó guardado en el sistema y te contactaremos a primera hora del próximo día hábil.
                      </div>
                    );
                  }
                } catch (e) {}
                return null;
              })()}

              <div style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '18px',
                textAlign: 'left',
                marginBottom: '24px'
              }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} style={{ color: '#2563EB' }} />
                  <span>¿Cómo sigue tu pedido?</span>
                </div>

                <ul style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                  <li style={{ marginBottom: '8px' }}>
                    <strong>Aprobación de Pago:</strong> Una vez verificado tu comprobante por nuestro equipo, tu pedido se marcará como <em>Aprobado</em> para su armado.
                  </li>
                  <li>
                    <strong>Contacto:</strong> Un representante de ventas se pondrá en contacto con vos en pocos minutos por el Chat Online para coordinar la entrega o envío.
                  </li>
                </ul>
              </div>

              <button 
                onClick={handleResetToCatalog}
                className="btn-hero-primary" 
                style={{ 
                  width: '100%', 
                  padding: '14px', 
                  borderRadius: '12px', 
                  fontWeight: 800,
                  fontSize: '1rem',
                  backgroundColor: '#2563EB' 
                }}
              >
                🛍️ Volver al Catálogo y Seguir Comprando
              </button>
            </div>
          ) : displayOrder ? (
            <div style={{ padding: '10px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <CheckCircle2 size={48} style={{ color: 'var(--accent-emerald)', marginBottom: '8px' }} />
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                  ¡Pedido #{displayOrder.id} Generado!
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Monto total: <strong>${displayOrder.total_amount?.toLocaleString('es-AR')}</strong>
                </p>

                {displayOrder.is_wholesale && (
                  <div style={{
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    border: '1px solid #A7F3D0',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    marginTop: '10px'
                  }}>
                    🎉 Precio Mayorista Aplicado{displayOrder.discount_applied ? ` (-$${displayOrder.discount_applied.toLocaleString('es-AR')} crédito)` : ''}
                  </div>
                )}

                {/* Raffle Tickets Assigned Card (ONLY for registered users) */}
                {displayOrder.raffle_tickets && displayOrder.raffle_tickets.length > 0 ? (
                  <div style={{ 
                    marginTop: '12px', 
                    backgroundColor: 'var(--accent-gold-light)', 
                    color: 'var(--accent-gold-hover)', 
                    padding: '12px', 
                    borderRadius: 'var(--radius-md)', 
                    border: '1px dashed var(--accent-gold)' 
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>
                      🎟️ ¡Ganaste {displayOrder.raffle_tickets.length} cupón(es) para el Gran Sorteo!
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      Tu(s) Boleto(s): <strong>{displayOrder.raffle_tickets.join(', ')}</strong>
                    </div>
                  </div>
                ) : !displayOrder.is_registered ? (
                  <div style={{
                    marginTop: '12px',
                    backgroundColor: '#FFFBEB',
                    color: '#B45309',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    border: '1px solid #FDE68A',
                    fontWeight: 600
                  }}>
                    💡 *Tip*: Si te registrás como usuario, participás automáticamente del Gran Sorteo con cupones en tus compras mayoristas.
                  </div>
                ) : null}
              </div>

              {/* Bank Transfer Alias Card (2 Alias + Titular) */}
              <div style={{
                backgroundColor: '#EFF6FF',
                border: '2px dashed #3B82F6',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <CreditCard size={16} /> Datos para Transferencia (Mercado Pago)
                </div>

                <div style={{ fontSize: '0.82rem', color: '#1E3A8A', margin: '8px 0 12px 0', fontWeight: 600, backgroundColor: '#DBEAFE', padding: '6px 10px', borderRadius: '6px' }}>
                  <strong>Titular:</strong> {transferDetails.holder} <br />
                  <strong>CUIT/CUIL:</strong> {transferDetails.cuit}
                </div>

                {/* Alias 1 */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  gap: '10px', 
                  backgroundColor: '#FFFFFF', 
                  border: '1px solid #BFDBFE', 
                  padding: '8px 12px', 
                  borderRadius: '8px',
                  marginBottom: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Alias 1</div>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1D4ED8', letterSpacing: '0.5px', fontFamily: 'monospace' }}>
                      {transferDetails.alias1}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleCopyAlias1}
                    style={{
                      backgroundColor: copiedAlias1 ? '#10B981' : '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {copiedAlias1 ? <Check size={14} /> : <Copy size={14} />}
                    {copiedAlias1 ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>

                {/* Alias 2 */}
                {transferDetails.alias2 && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '10px', 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #BFDBFE', 
                    padding: '8px 12px', 
                    borderRadius: '8px',
                    marginBottom: '10px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Alias 2</div>
                      <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1D4ED8', letterSpacing: '0.5px', fontFamily: 'monospace' }}>
                        {transferDetails.alias2}
                      </span>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleCopyAlias2}
                      style={{
                        backgroundColor: copiedAlias2 ? '#10B981' : '#2563EB',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {copiedAlias2 ? <Check size={14} /> : <Copy size={14} />}
                      {copiedAlias2 ? '¡Copiado!' : 'Copiar'}
                    </button>
                  </div>
                )}

                <p style={{ fontSize: '0.78rem', color: '#1E40AF', margin: 0, fontWeight: 600, lineHeight: 1.3 }}>
                  Podés adjuntar tu comprobante de pago subiendo la foto desde esta pantalla.
                </p>
              </div>

              {/* Upload Receipt Section */}
              <div style={{ 
                backgroundColor: 'var(--bg-surface-elevated)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-md)', 
                padding: '16px',
                marginBottom: '20px'
              }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Upload size={16} /> Adjuntar Comprobante de Pago
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Si ya realizaste la transferencia o pago por Mercado Pago, podés subir la captura aquí:
                </p>

                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  id="receipt-file-input"
                  style={{ display: 'none' }}
                />

                <label 
                  htmlFor="receipt-file-input" 
                  className="btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <Upload size={16} /> 
                  {receiptUploaded || displayOrder.receipt_url ? '✓ Comprobante Cargado (Cambiar)' : 'Subir Imagen de Comprobante'}
                </label>

                {(receiptImage || displayOrder.receipt_url) && (
                  <div style={{ marginTop: '12px', textAlign: 'center' }}>
                    <img 
                      src={receiptImage || displayOrder.receipt_url} 
                      alt="Comprobante" 
                      style={{ maxHeight: '120px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 700, marginTop: '4px' }}>
                      Comprobante adjuntado correctamente
                    </div>

                    <button 
                      type="button"
                      onClick={handleFinishWithReceipt}
                      style={{ 
                        width: '100%', 
                        backgroundColor: '#10B981',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '14px', 
                        borderRadius: '10px', 
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        marginTop: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(16,185,129,0.25)'
                      }}
                    >
                      <CheckCircle2 size={20} /> ✓ Aceptar y Enviar Comprobante
                    </button>
                  </div>
                )}
              </div>

              <div style={{
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#B45309',
                marginBottom: '12px',
                textAlign: 'left'
              }}>
                ⚠️ Estamos teniendo unos inconvenientes con WhatsApp. Ponete en contacto mediante el Chat Online.
              </div>

              <button 
                type="button"
                onClick={handleModifyOrCancelOrder} 
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  color: '#DC2626',
                  cursor: 'pointer',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <Edit3 size={16} /> ✏️ Modificar o Cancelar este Pedido (Volver al Carrito)
              </button>

              <button 
                onClick={handleStartNewOrder} 
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                🛒 Limpiar y Empezar Pedido Desde Cero
              </button>
            </div>
          ) : cartItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontWeight: 600 }}>El carrito está vacío.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Agregá prendas del catálogo para iniciar tu pedido.</p>
            </div>
          ) : (
            <>
              {/* MINIMUM PURCHASE $50.000 PROGRESS BANNER */}
              <div style={{
                backgroundColor: isMinPurchaseReached ? '#ECFDF5' : '#FEF3C7',
                border: `1px solid ${isMinPurchaseReached ? '#6EE7B7' : '#FDE68A'}`,
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ 
                    fontSize: '0.82rem', 
                    fontWeight: 800, 
                    color: isMinPurchaseReached ? '#047857' : '#B45309',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    {isMinPurchaseReached ? (
                      <>🎉 ¡MÍNIMO DE COMPRA MAYORISTA ALCANZADO!</>
                    ) : (
                      <><Sparkles size={15} /> Mínimo de compra mayorista: $50.000</>
                    )}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isMinPurchaseReached ? '#047857' : '#92400E' }}>
                    {progressPercent}%
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '7px', backgroundColor: isMinPurchaseReached ? '#A7F3D0' : '#FDE68A', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${progressPercent}%`, 
                    height: '100%', 
                    backgroundColor: isMinPurchaseReached ? '#059669' : '#D97706',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                {!isMinPurchaseReached && (
                  <p style={{ fontSize: '0.75rem', color: '#92400E', marginTop: '6px', margin: 0, fontWeight: 600 }}>
                    Te faltan <strong>${amountNeeded.toLocaleString('es-AR')}</strong> para alcanzar el mínimo de $50.000 para poder finalizar el pedido.
                  </p>
                )}
              </div>

              {/* STEP 1: CART ITEMS & REGISTRATION INPUTS */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>
                  Prendas en el pedido
                </h4>
                {cartItems.map((item) => {
                  const unitPrice = item.product.wholesale_price || item.product.price || 0;
                  const itemTotal = unitPrice * item.quantity;
                  const itemSize = item.product?.selectedSize || item.selectedSize;
                  const itemColor = item.product?.selectedColor || item.selectedColor;

                  return (
                    <div key={item.variantKey || item.product.id} className="cart-item-row">
                      <img 
                        src={item.product.image_url} 
                        alt={item.product.name} 
                        className="cart-item-img"
                      />
                      <div className="cart-item-info">
                        <div className="cart-item-title">
                          {item.product.name}
                        </div>

                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px', marginBottom: '4px' }}>
                          {itemSize && (
                            <span style={{ fontSize: '0.73rem', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              Talle: {itemSize}
                            </span>
                          )}
                          {itemColor && (
                            <span style={{ fontSize: '0.73rem', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              Color: {itemColor}
                            </span>
                          )}
                        </div>
                        
                        <div className="cart-item-price" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                            ${itemTotal.toLocaleString('es-AR')}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            (${unitPrice.toLocaleString('es-AR')} c/u)
                          </span>
                        </div>

                        <div className="qty-controls">
                          <button onClick={() => onUpdateQuantity(item.variantKey || item.product.id, item.quantity - 1)} className="qty-btn">
                            <Minus size={14} />
                          </button>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: '24px', textAlign: 'center' }}>
                            {item.quantity}
                          </span>
                          <button onClick={() => onUpdateQuantity(item.variantKey || item.product.id, item.quantity + 1)} className="qty-btn">
                            <Plus size={14} />
                          </button>

                          <button onClick={() => onRemoveItem(item.variantKey || item.product.id)} style={{ marginLeft: 'auto', color: 'var(--accent-crimson)', padding: '4px' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Delivery Option */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>Método de Entrega</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button 
                    type="button"
                    onClick={() => setDeliveryMethod('envio')}
                    className={`btn-secondary ${deliveryMethod === 'envio' ? 'active' : ''}`}
                    style={{ 
                      padding: '10px', 
                      fontSize: '0.8rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: '4px',
                      backgroundColor: deliveryMethod === 'envio' ? 'var(--text-main)' : 'var(--bg-surface-elevated)',
                      color: deliveryMethod === 'envio' ? 'var(--bg-page)' : 'var(--text-main)'
                    }}
                  >
                    <Truck size={18} /> Envío a Domicilio
                  </button>

                  <button 
                    type="button"
                    onClick={() => setDeliveryMethod('retiro')}
                    className={`btn-secondary ${deliveryMethod === 'retiro' ? 'active' : ''}`}
                    style={{ 
                      padding: '10px', 
                      fontSize: '0.8rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: '4px',
                      backgroundColor: deliveryMethod === 'retiro' ? 'var(--text-main)' : 'var(--bg-surface-elevated)',
                      color: deliveryMethod === 'retiro' ? 'var(--bg-page)' : 'var(--text-main)'
                    }}
                  >
                    <Store size={18} /> Retiro por Sucursal
                  </button>
                </div>
              </div>

              {/* Customer Registration Fields if not logged in */}
              <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserCheck size={16} /> Datos del Cliente
                  </h4>
                  {!currentUser && (
                    <button onClick={onOpenAuth} style={{ fontSize: '0.75rem', color: 'var(--accent-gold-hover)', fontWeight: 700 }}>
                      Iniciar Sesión
                    </button>
                  )}
                </div>

                {currentUser ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <div><strong>{currentUser.name}</strong></div>
                    <div>DNI: {currentUser.dni || 'No especificado'} | Tel: {currentUser.phone}</div>
                    <div>Localidad: {currentUser.locality || 'No especificada'}</div>
                  </div>
                ) : (
                  <div>
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <input
                        type="text"
                        placeholder="Nombre Completo / Razón Social *"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        placeholder="DNI / CUIT *"
                        value={clientDni}
                        onChange={(e) => setClientDni(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                      />
                      <input
                        type="text"
                        placeholder="Teléfono *"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Localidad / Ciudad *"
                      value={clientLocality}
                      onChange={(e) => setClientLocality(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                    />
                  </div>
                )}

                {/* Direccion / Codigo Postal / Piso: nunca se guardan en la
                    cuenta (son datos por pedido, no por cliente), asi que se
                    muestran siempre, este o no logueado el cliente -- antes
                    solo aparecian para invitados y un cliente registrado no
                    tenia forma de cargarlos al pedir envio a domicilio. */}
                <div style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    placeholder={deliveryMethod === 'envio' ? 'Dirección / Calle *' : 'Dirección / Calle'}
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.85rem', padding: '8px 10px', width: '100%' }}
                  />

                  {deliveryMethod === 'envio' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                      <input
                        type="text"
                        placeholder="Código Postal *"
                        value={clientPostalCode}
                        onChange={(e) => setClientPostalCode(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                      />
                      <input
                        type="text"
                        placeholder="Piso / Depto (si aplica)"
                        value={clientFloorApt}
                        onChange={(e) => setClientFloorApt(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {cartItems.length > 0 && !createdOrder && (
          <div className="drawer-footer">
            <div style={{ marginBottom: '10px' }}>
              {voucher && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px',
                  padding: '8px 12px', marginBottom: '8px', fontSize: '0.82rem', fontWeight: 700, color: '#92400E'
                }}>
                  <span>🎁 Tenés ${voucher.amount.toLocaleString('es-AR')} de crédito disponible</span>
                  <span>−${voucherDiscount.toLocaleString('es-AR')}</span>
                </div>
              )}
              <div className="total-summary-row" style={{ marginTop: '4px', paddingTop: '4px' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>Total Mayorista:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: isMinPurchaseReached ? '#059669' : '#D97706' }}>
                  {voucher && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'line-through', marginRight: '6px' }}>
                      ${cartSubtotal.toLocaleString('es-AR')}
                    </span>
                  )}
                  ${finalTotal.toLocaleString('es-AR')}
                </span>
              </div>
              {!isMinPurchaseReached && (
                <div style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 700, marginTop: '4px', textAlign: 'center' }}>
                  ⚠️ Mínimo de compra $50.000 (te faltan ${amountNeeded.toLocaleString('es-AR')})
                </div>
              )}
            </div>

            <button 
              onClick={handleCreateOrder} 
              className="btn-hero-primary" 
              style={{ 
                width: '100%',
                opacity: isMinPurchaseReached ? 1 : 0.6,
                cursor: isMinPurchaseReached ? 'pointer' : 'not-allowed'
              }}
              disabled={!isMinPurchaseReached}
            >
              {isMinPurchaseReached ? 'Generar Pedido & Subir Comprobante' : `Mínimo $50.000 (Faltan $${amountNeeded.toLocaleString('es-AR')})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
