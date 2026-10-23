'use client';

import { useState } from 'react';
import { X, Send, Download, Copy, Check, Phone, Loader2, Landmark, Calendar, FileText } from 'lucide-react';
import {
  generateAliasPdf,
  buildAliasWhatsAppText,
  shareAliasViaWhatsApp,
  cleanPhone
} from '@/lib/aliasSharePdf';

const money = (n) => `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => {
  if (!d) return '';
  return new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function ShareAliasModal({
  alias,
  date,
  period = 'day',
  transfers = [],
  onClose,
  onSavePhone
}) {
  const [phone, setPhone] = useState(() => alias?.phone || '');
  const [savePhoneChecked, setSavePhoneChecked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const aliasTransfers = transfers.filter((t) => t.aliasId === alias?.id);
  const totalAmount = aliasTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);

  const handleSendWhatsApp = async () => {
    setBusy(true);
    setStatusMsg('');
    try {
      if (savePhoneChecked && phone.trim() && phone !== alias?.phone && onSavePhone) {
        try {
          await onSavePhone(alias.id, phone.trim());
        } catch (err) {
          console.warn('No se pudo guardar el teléfono:', err);
        }
      }

      const res = await shareAliasViaWhatsApp({
        alias,
        date,
        period,
        transfers: aliasTransfers,
        phone: phone.trim()
      });

      if (res.method === 'download_and_whatsapp') {
        setStatusMsg('✅ PDF descargado y WhatsApp abierto. Adjuntá el PDF al chat.');
      } else if (res.method === 'native_share') {
        setStatusMsg('✅ Compartido con éxito.');
        setTimeout(onClose, 1200);
      }
    } catch (err) {
      window.alert(err.message || 'Error al generar o compartir el reporte');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadOnlyPdf = async () => {
    setBusy(true);
    try {
      const { doc, fileName } = await generateAliasPdf({
        alias,
        date,
        period,
        transfers: aliasTransfers
      });
      doc.save(fileName);
      setStatusMsg(`✅ PDF "${fileName}" descargado con éxito.`);
    } catch (err) {
      window.alert(err.message || 'Error al generar el PDF');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyText = () => {
    const text = buildAliasWhatsAppText({
      alias,
      date,
      period,
      transfers: aliasTransfers,
      totalAmount
    });
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#1E1B2E',
          color: '#F8FAFC',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          width: '100%',
          maxWidth: '520px',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out'
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(76, 29, 149, 0.4) 0%, rgba(30, 27, 46, 0.8) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#25D366',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Send size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                Compartir reporte al dueño
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8' }}>
                Alias: <strong style={{ color: '#F1F5F9', fontFamily: 'monospace' }}>{alias?.alias}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: '20px' }}>
          {/* Card Resumen de la liquidación */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', fontWeight: 800 }}>
                  Total a conciliar
                </div>
                <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#10B981', lineHeight: 1.2 }}>
                  {money(totalAmount)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#CBD5E1', marginTop: '2px' }}>
                  {aliasTransfers.length} transferencia{aliasTransfers.length === 1 ? '' : 's'} · {fmtDate(date)}
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.76rem', color: '#94A3B8' }}>
                <div>Titular: <strong style={{ color: '#F1F5F9' }}>{alias?.holder || 'Sin titular'}</strong></div>
                {alias?.bank && <div>Banco: <span style={{ color: '#F1F5F9' }}>{alias.bank}</span></div>}
                {alias?.dailyLimit && <div>Tope: <span style={{ color: '#F1F5F9' }}>{money(alias.dailyLimit)}</span></div>}
              </div>
            </div>
          </div>

          {/* Campo Teléfono de WhatsApp */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="alias-owner-phone"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#CBD5E1',
                marginBottom: '6px'
              }}
            >
              <Phone size={14} style={{ color: '#25D366' }} />
              WhatsApp / Teléfono del dueño (opcional):
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="alias-owner-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="ej: 3412648035 o 549341..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#FFFFFF',
                  fontSize: '0.92rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <label style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={savePhoneChecked}
                  onChange={(e) => setSavePhoneChecked(e.target.checked)}
                />
                Guardar este número en el alias para los próximos envíos
              </label>
            </div>
          </div>

          {/* Estado o feedback */}
          {statusMsg && (
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#A7F3D0',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '0.78rem',
                marginBottom: '14px',
                fontWeight: 600
              }}
            >
              {statusMsg}
            </div>
          )}

          {/* Botones de acción */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {/* Botón principal: WhatsApp + PDF */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={busy}
              style={{
                width: '100%',
                backgroundColor: '#25D366',
                color: '#000000',
                fontWeight: 900,
                fontSize: '0.92rem',
                padding: '11px 16px',
                borderRadius: '10px',
                border: 'none',
                cursor: busy ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
                transition: 'opacity 0.2s'
              }}
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              <span>Enviar reporte por WhatsApp (con PDF)</span>
            </button>

            {/* Fila secundaria: Solo descargar PDF / Copiar texto */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={handleDownloadOnlyPdf}
                disabled={busy}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#F8FAFC',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  cursor: busy ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Download size={14} />
                <span>Solo descargar PDF</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                disabled={busy}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#F8FAFC',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {copied ? <Check size={14} style={{ color: '#10B981' }} /> : <Copy size={14} />}
                <span>{copied ? '¡Copiado!' : 'Copiar texto'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
