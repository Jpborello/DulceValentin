'use client';

import React from 'react';
import {
  ShieldCheck,
  HardDriveDownload,
  WifiOff,
  FileSpreadsheet,
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  FolderCheck,
  Sparkles,
  Barcode,
  Layers,
  HelpCircle
} from 'lucide-react';

export default function BackupGuideModal({
  isOpen,
  onClose,
  step,
  onNext,
  onPrev,
  onFinish
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(36, 30, 40, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-color-strong, #E4BFD4)',
          borderRadius: '24px',
          padding: '28px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(36, 30, 40, 0.25)',
          position: 'relative'
        }}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color, #F3DCE7)',
            paddingBottom: '14px',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 900,
                color: '#A8175A',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                backgroundColor: '#FCE0EC',
                border: '1px solid #F3DCE7',
                padding: '4px 10px',
                borderRadius: '10px'
              }}
            >
              Paso {step} de 4
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted, #6E656E)', fontWeight: 700 }}>
              Guía de Uso Rápido
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              color: 'var(--text-muted, #6E656E)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Cerrar guía"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido según el Paso */}
        <div style={{ minHeight: '310px', display: 'flex', flexDirection: 'column' }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#FCEDF3',
                  border: '1px solid #E4BFD4',
                  color: '#A8175A',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(168, 23, 90, 0.1)'
                }}
              >
                <ShieldCheck size={30} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main, #241E28)', margin: 0, letterSpacing: '-0.02em' }}>
                ¿Para qué sirve esta pantalla?
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #6E656E)', lineHeight: 1.55, margin: 0 }}>
                Esta sección es tu <strong>caja fuerte digital</strong>. Te permite guardar una copia completa y actualizada de todas las prendas, precios, stock por talle y color, códigos de barra, ventas y clientes directamente en tu computadora.
              </p>
              <div
                style={{
                  backgroundColor: '#FFF8FA',
                  border: '1px solid #F3DCE7',
                  borderRadius: '16px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '0.84rem'
                }}
              >
                <p style={{ fontWeight: 800, color: '#A8175A', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <CheckCircle2 size={16} color="#16A34A" />
                  Tranquilidad y Blindaje Total:
                </p>
                <p style={{ color: 'var(--text-muted, #6E656E)', margin: 0, lineHeight: 1.45 }}>
                  Si alguna vez se corta internet en el local o hay inconvenientes con el servidor de la nube, la información de Dulce Valentín nunca se pierde porque tenés una copia física exacta guardada en tu equipo.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
                }}
              >
                <HardDriveDownload size={30} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main, #241E28)', margin: 0, letterSpacing: '-0.02em' }}>
                El botón: Respaldo en 1 Clic
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #6E656E)', lineHeight: 1.55, margin: 0 }}>
                Para generar un respaldo nuevo, solo tocás el botón verde <strong style={{ color: '#16A34A' }}>&quot;Sincronizar y Respaldar en 1 Clic&quot;</strong>.
              </p>
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '16px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.84rem'
                }}
              >
                <p style={{ fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <FolderCheck size={16} />
                  El sistema hace todo en automático:
                </p>
                <ul style={{ margin: 0, paddingLeft: '18px', color: '#14532D', lineHeight: 1.5, fontSize: '0.82rem' }}>
                  <li>Crea la carpeta <code style={{ backgroundColor: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 800 }}>Backups_DulceValentin</code> en tu usuario de Windows.</li>
                  <li>Guarda allí la base completa en formato JSON y 4 planillas listas para Excel.</li>
                  <li>Descarga en simultáneo una copia al navegador como doble respaldo seguro.</li>
                </ul>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  color: '#D97706',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <WifiOff size={30} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main, #241E28)', margin: 0, letterSpacing: '-0.02em' }}>
                Modo Local (si se corta Internet)
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #6E656E)', lineHeight: 1.55, margin: 0 }}>
                ¿Se cayó la conexión o Fibertel/proveedor no responde en pleno horario de venta en el local?
              </p>
              <div
                style={{
                  backgroundColor: '#FFFDF0',
                  border: '1px solid #FEF08A',
                  borderRadius: '16px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.84rem'
                }}
              >
                <p style={{ fontWeight: 800, color: '#92400E', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Barcode size={16} />
                  El local sigue funcionando:
                </p>
                <p style={{ color: '#78350F', margin: 0, lineHeight: 1.45 }}>
                  Al activar el <strong>Modo Local / Contingencia</strong>, podés buscar cualquier prenda por nombre, código de artículo (ej. 0314) o código de barras, ver su precio por menor/mayor y verificar cuántas unidades quedan por talle y color a 0ms sin internet.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#2563EB',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FileSpreadsheet size={30} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main, #241E28)', margin: 0, letterSpacing: '-0.02em' }}>
                Planillas de Excel listas para usar
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #6E656E)', lineHeight: 1.55, margin: 0 }}>
                Cada respaldo genera 4 archivos compatibles con Microsoft Excel (formato UTF-8 con punto y coma):
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  fontSize: '0.8rem'
                }}
              >
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '12px' }}>
                  <strong style={{ color: '#1E293B', display: 'block', marginBottom: '2px' }}>📊 Catálogo General</strong>
                  <span style={{ color: '#64748B', fontSize: '0.74rem' }}>Precios, stock total y categorías</span>
                </div>
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '12px' }}>
                  <strong style={{ color: '#1E293B', display: 'block', marginBottom: '2px' }}>🏷️ Stock Talle y Color</strong>
                  <span style={{ color: '#64748B', fontSize: '0.74rem' }}>Unidades físicas y código de barra</span>
                </div>
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '12px' }}>
                  <strong style={{ color: '#1E293B', display: 'block', marginBottom: '2px' }}>💰 Ventas y Pedidos</strong>
                  <span style={{ color: '#64748B', fontSize: '0.74rem' }}>Fechas, totales, prendas y canal</span>
                </div>
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '12px' }}>
                  <strong style={{ color: '#1E293B', display: 'block', marginBottom: '2px' }}>👥 Directorio Clientes</strong>
                  <span style={{ color: '#64748B', fontSize: '0.74rem' }}>Teléfonos, localidades y compras</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barra de Navegación del Modal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-color, #F3DCE7)',
            paddingTop: '18px',
            marginTop: '20px'
          }}
        >
          {step > 1 ? (
            <button
              type="button"
              onClick={onPrev}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '0.85rem'
              }}
            >
              <ArrowLeft size={16} /> Anterior
            </button>
          ) : (
            <span />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={onNext}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                fontSize: '0.85rem',
                backgroundColor: '#A8175A',
                color: '#FFFFFF'
              }}
            >
              Siguiente <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onFinish}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 22px',
                fontSize: '0.85rem',
                backgroundColor: '#16A34A',
                color: '#FFFFFF'
              }}
            >
              ¡Entendido, Empezar! <CheckCircle2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

