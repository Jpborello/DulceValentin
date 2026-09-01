'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PackageSearch, Search, ArrowLeft } from 'lucide-react';

const STATUS_META = {
  pendiente: { label: 'Pendiente de aprobación', bg: '#FEF3C7', color: '#92400E', desc: 'Todavía no subiste el comprobante, o lo estamos por revisar.' },
  comprobante_subido: { label: 'Comprobante en revisión', bg: '#EDE9FE', color: '#6D28D9', desc: 'Recibimos tu comprobante, lo estamos verificando.' },
  aprobado: { label: '¡Aprobado! Preparando tu pedido', bg: '#ECFDF5', color: '#047857', desc: 'Tu pago fue confirmado y ya estamos armando tu pedido.' },
  enviado: { label: 'Enviado / Listo para retirar', bg: '#EFF6FF', color: '#1D4ED8', desc: 'Tu pedido ya salió (o está listo para que lo retires).' },
  cancelado: { label: 'Cancelado', bg: '#FEE2E2', color: '#B91C1C', desc: 'Este pedido fue cancelado.' }
};

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    setLoading(true);
    try {
      const res = await fetch('/api/track-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, phone })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo buscar el pedido.');
        return;
      }
      setOrder(data.order);
    } catch (err) {
      setError('Ocurrió un error de conexión. Probá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const statusMeta = order ? (STATUS_META[order.status] || STATUS_META.pendiente) : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Volver a la tienda
        </Link>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <PackageSearch size={26} style={{ color: 'var(--accent-gold)' }} />
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Rastreá tu Pedido</h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>
            Ingresá tu número de pedido y el teléfono con el que compraste.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>N° de Pedido</label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Ej: ORD-123456"
                required
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Teléfono</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Con el que hiciste el pedido"
                required
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px', opacity: loading ? 0.7 : 1 }}>
              <Search size={16} /> {loading ? 'Buscando...' : 'Buscar Pedido'}
            </button>
          </form>

          {error && (
            <div style={{ marginTop: '16px', backgroundColor: '#FEE2E2', color: '#B91C1C', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {order && statusMeta && (
            <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Pedido <strong>{order.id}</strong></div>

              <div style={{ backgroundColor: statusMeta.bg, color: statusMeta.color, padding: '12px 14px', borderRadius: 'var(--radius-md)', marginBottom: '14px' }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{statusMeta.label}</div>
                <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>{statusMeta.desc}</div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><strong>Fecha:</strong> {new Date(order.created_at).toLocaleString('es-AR')}</div>
                <div><strong>Entrega:</strong> {order.delivery_method?.toLowerCase().includes('retiro') ? '🏬 Retiro por sucursal' : `🚚 Envío a domicilio (${order.client_locality || 'Rosario'})`}</div>
                <div><strong>Productos:</strong> {(order.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0)} prendas</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '6px' }}>Total: ${order.total_amount?.toLocaleString('es-AR')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
