'use client';

import { useState, useEffect } from 'react';
import { Search, Crown, Ticket, MapPin, Phone, FileText, Gift, X } from 'lucide-react';
import { normalizePhone } from '@/lib/phoneUtils';

export default function ClientsTab({ clients }) {
  const [searchFilter, setSearchFilter] = useState('');
  const [vouchersByPhone, setVouchersByPhone] = useState({}); // { [phone_normalized]: {id, amount, reason} }
  const [voucherClient, setVoucherClient] = useState(null);
  const [voucherAmount, setVoucherAmount] = useState('');
  const [voucherReason, setVoucherReason] = useState('');
  const [voucherSubmitting, setVoucherSubmitting] = useState(false);
  const [voucherError, setVoucherError] = useState('');

  const fetchVouchers = async () => {
    try {
      const res = await fetch('/api/admin/vouchers');
      const data = await res.json();
      if (data.success) {
        const map = {};
        (data.vouchers || []).forEach((v) => {
          if (v.status === 'active') map[v.phone_normalized] = v;
        });
        setVouchersByPhone(map);
      }
    } catch (e) {
      console.warn('Error al cargar baucheres:', e);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const normalizeSearch = (str) => (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const filteredClients = clients.filter(c =>
    normalizeSearch(c.name).includes(normalizeSearch(searchFilter)) ||
    (c.dni && c.dni.includes(searchFilter)) ||
    (c.phone && c.phone.includes(searchFilter)) ||
    (c.locality && normalizeSearch(c.locality).includes(normalizeSearch(searchFilter)))
  );

  const openVoucherModal = (client) => {
    setVoucherClient(client);
    setVoucherAmount('');
    setVoucherReason('');
    setVoucherError('');
  };

  const handleGrantVoucher = async () => {
    if (!voucherClient) return;
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
        body: JSON.stringify({ phone: voucherClient.phone, amount: amountNum, reason: voucherReason || null })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo otorgar el baucher');
      await fetchVouchers();
      setVoucherClient(null);
    } catch (err) {
      setVoucherError(err.message);
    } finally {
      setVoucherSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Ranking de Clientes Mayoristas</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Base completa de clientes ordenada por mayor consumo acumulado (los primeros 3 puestos se marcan como VIP). También podés ver y otorgar baucheres/créditos por acá.
          </p>
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por DNI, Nombre o Localidad..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '36px' }}
          />
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
          <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>No se encontraron clientes registrados.</p>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ranking</th>
              <th>Cliente / Razón Social</th>
              <th>DNI / CUIT</th>
              <th>Teléfono</th>
              <th>Localidad</th>
              <th>Pedidos</th>
              <th>Total Gastado ($)</th>
              <th>Cupones Sorteo</th>
              <th>Baucher</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client, idx) => {
              const isTop1 = idx === 0;
              const isTop3 = idx < 3;
              const activeVoucher = vouchersByPhone[normalizePhone(client.phone)];

              return (
                <tr key={client.phone || idx} style={{ backgroundColor: isTop1 ? 'rgba(200, 157, 84, 0.08)' : 'transparent' }}>
                  <td style={{ fontWeight: 800 }}>
                    {isTop1 && <Crown size={16} style={{ color: 'var(--accent-gold)', marginRight: '4px', display: 'inline' }} />}
                    #{idx + 1}
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {client.name}
                    {isTop3 && (
                      <span style={{ marginLeft: '8px', fontSize: '0.7rem', backgroundColor: 'var(--accent-gold-light)', color: 'var(--accent-gold-hover)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontWeight: 800 }}>
                        VIP
                      </span>
                    )}
                  </td>
                  <td>
                    <FileText size={12} style={{ display: 'inline', marginRight: '4px', color: 'var(--text-muted)' }} />
                    {client.dni || 'Sin DNI'}
                  </td>
                  <td>
                    <Phone size={12} style={{ display: 'inline', marginRight: '4px', color: 'var(--text-muted)' }} />
                    {client.phone}
                  </td>
                  <td>
                    <MapPin size={12} style={{ display: 'inline', marginRight: '4px', color: 'var(--text-muted)' }} />
                    {client.locality || 'Sin localidad'}
                  </td>
                  <td style={{ fontWeight: 700 }}>{client.orders_count} compras</td>
                  <td style={{ fontWeight: 800, color: 'var(--accent-emerald)', fontSize: '1rem' }}>
                    ${client.total_spent?.toLocaleString('es-AR')}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: 'var(--accent-gold-hover)', background: 'var(--accent-gold-light)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem' }}>
                      <Ticket size={14} /> {client.tickets_count} cupones
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {activeVoucher ? (
                        <span title={activeVoucher.reason || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '3px 9px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem' }}>
                          <Gift size={12} /> ${activeVoucher.amount.toLocaleString('es-AR')}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                      <button
                        onClick={() => openVoucherModal(client)}
                        title="Otorgar baucher a este cliente"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <Gift size={11} /> Otorgar
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
      {voucherClient && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setVoucherClient(null)}
        >
          <div
            style={{ background: 'var(--bg-card)', borderRadius: '12px', maxWidth: '420px', width: '100%', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gift size={18} style={{ color: '#D97706' }} /> Otorgar Baucher
              </h3>
              <button onClick={() => setVoucherClient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Cliente: <strong>{voucherClient.name}</strong> — Tel: <strong>{voucherClient.phone}</strong>
              <br />Se descuenta solo la próxima vez que compre con ese número, esté registrada o no.
            </p>

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
              <label className="form-label">Motivo (opcional)</label>
              <textarea
                value={voucherReason}
                onChange={(e) => setVoucherReason(e.target.value)}
                className="form-input"
                rows={2}
                placeholder="Ej: Producto faltante en un pedido"
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
          </div>
        </div>
      )}
    </div>
  );
}
