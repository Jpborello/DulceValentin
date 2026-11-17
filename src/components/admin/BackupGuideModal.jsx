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
  Barcode
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
        backgroundColor: 'rgba(10, 6, 15, 0.75)',
        backdropFilter: 'blur(8px)',
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
          backgroundColor: 'var(--bg-card, #2E1F42)',
          border: '1px solid var(--border-color-strong, #55407A)',
          borderRadius: '24px',
          padding: '28px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          position: 'relative',
          color: 'var(--text-main, #F3EDE6)'
        }}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color, #423262)',
            paddingBottom: '14px',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 900,
                color: 'var(--accent-gold, #F5559D)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                backgroundColor: 'rgba(245, 85, 157, 0.14)',
                border: '1px solid rgba(245, 85, 157, 0.3)',
                padding: '4px 10px',
                borderRadius: '10px'
              }}
            >
              Paso {step} de 4
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted, #B3A9AF)', fontWeight: 700 }}>
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
              color: 'var(--text-muted, #B3A9AF)',
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
                  backgroundColor: 'rgba(245, 85, 157, 0.15)',
                  border: '1px solid rgba(245, 85, 157, 0.3)',
                  color: 'var(--accent-gold, #F5559D)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(245, 85, 157, 0.15)'
                }}
              >
                <ShieldCheck size={30} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main, #F3EDE6)', margin: 0, letterSpacing: '-0.02em' }}>
                ¿Para qué sirve esta pantalla?
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #B3A9AF)', lineHeight: 1.55, margin: 0 }}>
                Esta sección es tu <strong style={{ color: 'var(--text-main, #F3EDE6)' }}>caja fuerte digital</strong>. Te permite guardar una copia completa de todas las prendas, precios, stock por talle y color, códigos de barra, ventas y clientes en tu propia computadora.
              </p>
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-dark, #170E24)',
                  border: '1px solid var(--border-color, #423262)',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '0.84rem'
                }}
              >
                <p style={{ fontWeight: 800, color: '#34D399', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <CheckCircle2 size={16} />
                  Tranquilidad y Blindaje Total:
                </p>
                <p style={{ color: 'var(--text-muted, #B3A9AF)', margin: 0, lineHeight: 1.45 }}>
                  Si alguna vez se corta internet en el local o hay inconvenientes con la nube, la información de Dulce Valentín no se pierde: hay copia en la nube, en la PC del local (automática) y en los archivos que descargás acá.
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
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
              >
                <HardDriveDownload size={30} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main, #F3EDE6)', margin: 0, letterSpacing: '-0.02em' }}>
                El botón: Respaldo en 1 Clic
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #B3A9AF)', lineHeight: 1.55, margin: 0 }}>
                Para generar un respaldo nuevo, solo tocás el botón verde <strong style={{ color: '#34D399' }}>&quot;Sincronizar y Respaldar en 1 Clic&quot;</strong>.
              </p>
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-dark, #170E24)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.84rem'
                }}
              >
                <p style={{ fontWeight: 800, color: '#34D399', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <FolderCheck size={16} />
                  El sistema hace todo en automático:
                </p>
                <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-muted, #B3A9AF)', lineHeight: 1.5, fontSize: '0.82rem' }}>
                  <li>Descarga la base completa en formato JSON a tu carpeta de Descargas, más la planilla de stock para Excel.</li>
                  <li>La guarda también en este navegador, para consultarla si se corta internet.</li>
                  <li>Aparte, el programa del local (el mismo de la impresora) guarda solo una copia cada 6 horas en la carpeta <code style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-main, #F3EDE6)' }}>Backups_DulceValentin</code> de la PC del local.</li>
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
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#FBBF24',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <WifiOff size={30} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main, #F3EDE6)', margin: 0, letterSpacing: '-0.02em' }}>
                Si se corta Internet
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #B3A9AF)', lineHeight: 1.55, margin: 0 }}>
                ¿Se cayó la conexión o Fibertel/proveedor no responde en pleno horario de venta en el local?
              </p>
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-dark, #170E24)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.84rem'
                }}
              >
                <p style={{ fontWeight: 800, color: '#FBBF24', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Barcode size={16} />
                  El local sigue funcionando:
                </p>
                <p style={{ color: 'var(--text-muted, #B3A9AF)', margin: 0, lineHeight: 1.45 }}>
                  La <strong>Caja</strong> sigue vendiendo sola: guarda las ventas en el equipo y las sube cuando vuelve la conexión. Y acá, en el <strong>Visor sin conexión</strong>, podés buscar cualquier prenda por nombre, código de artículo (ej. 0314) o código de barras y ver precio y stock por talle y color de la última copia guardada. Para que funcione, el panel y la caja tienen que haberse abierto al menos una vez con internet en ese equipo.
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
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: '#60A5FA',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FileSpreadsheet size={30} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main, #F3EDE6)', margin: 0, letterSpacing: '-0.02em' }}>
                Planillas de Excel listas para usar
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #B3A9AF)', lineHeight: 1.55, margin: 0 }}>
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
                <div style={{ backgroundColor: 'var(--bg-surface-dark, #170E24)', border: '1px solid var(--border-color, #423262)', padding: '10px', borderRadius: '12px' }}>
                  <strong style={{ color: 'var(--text-main, #F3EDE6)', display: 'block', marginBottom: '2px' }}>📊 Catálogo General</strong>
                  <span style={{ color: 'var(--text-muted, #B3A9AF)', fontSize: '0.74rem' }}>Precios, stock total y categorías</span>
                </div>
                <div style={{ backgroundColor: 'var(--bg-surface-dark, #170E24)', border: '1px solid var(--border-color, #423262)', padding: '10px', borderRadius: '12px' }}>
                  <strong style={{ color: '#34D399', display: 'block', marginBottom: '2px' }}>🏷️ Stock Talle y Color</strong>
                  <span style={{ color: 'var(--text-muted, #B3A9AF)', fontSize: '0.74rem' }}>Unidades físicas y código de barra</span>
                </div>
                <div style={{ backgroundColor: 'var(--bg-surface-dark, #170E24)', border: '1px solid var(--border-color, #423262)', padding: '10px', borderRadius: '12px' }}>
                  <strong style={{ color: '#60A5FA', display: 'block', marginBottom: '2px' }}>💰 Ventas y Pedidos</strong>
                  <span style={{ color: 'var(--text-muted, #B3A9AF)', fontSize: '0.74rem' }}>Fechas, totales, prendas y canal</span>
                </div>
                <div style={{ backgroundColor: 'var(--bg-surface-dark, #170E24)', border: '1px solid var(--border-color, #423262)', padding: '10px', borderRadius: '12px' }}>
                  <strong style={{ color: '#FBBF24', display: 'block', marginBottom: '2px' }}>👥 Directorio Clientes</strong>
                  <span style={{ color: 'var(--text-muted, #B3A9AF)', fontSize: '0.74rem' }}>Teléfonos, localidades y compras</span>
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
            borderTop: '1px solid var(--border-color, #423262)',
            paddingTop: '18px',
            marginTop: '20px'
          }}
        >
          {step > 1 ? (
            <button
              type="button"
              onClick={onPrev}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: 800,
                borderRadius: '10px',
                border: '1px solid var(--border-color, #423262)',
                background: 'var(--bg-surface-dark, #170E24)',
                color: 'var(--text-main, #F3EDE6)',
                cursor: 'pointer'
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                fontSize: '0.85rem',
                fontWeight: 800,
                backgroundColor: 'var(--dv-accent-fill, #C2185B)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              Siguiente <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onFinish}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 22px',
                fontSize: '0.85rem',
                fontWeight: 900,
                backgroundColor: '#10B981',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
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
