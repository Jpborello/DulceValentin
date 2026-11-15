'use client';

import Link from 'next/link';
import { ArrowLeft, LogOut, ShieldCheck, Eye, Bell, BellOff, BellRing } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function AdminHeader({ onLogout, visitCount, notifPermission, onRequestNotif, onOpenBackups, isBackupsActive }) {
  return (
    <div className="admin-header-row">
      <div>
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-gold-hover)', marginBottom: '8px' }}
        >
          <ArrowLeft size={16} /> Volver a la Tienda
        </Link>
        <h1 className="admin-header-title">Panel de Administración — Dulce Valentín</h1>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <ThemeToggle />
        {onOpenBackups && (
          <button
            type="button"
            onClick={onOpenBackups}
            style={{
              fontSize: '0.84rem',
              padding: '7px 15px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              cursor: 'pointer',
              fontWeight: 800,
              borderRadius: 'var(--radius-full, 9999px)',
              background: isBackupsActive ? 'var(--dv-accent-fill, #C2185B)' : 'rgba(245, 85, 157, 0.14)',
              color: isBackupsActive ? '#FFFFFF' : 'var(--accent-gold, #F5559D)',
              border: isBackupsActive ? '1px solid var(--dv-accent-fill, #C2185B)' : '1px solid var(--border-color-strong, #55407A)',
              boxShadow: isBackupsActive ? '0 4px 14px rgba(194, 24, 91, 0.35)' : 'none',
              transition: 'all 0.2s ease'
            }}
            title="Respaldo físico en 1 clic en Windows, planillas para Excel y modo offline"
          >
            <ShieldCheck size={16} /> Respaldo & Modo Local
          </button>
        )}
        {notifPermission !== undefined && (
          notifPermission === 'granted' ? (
            <span
              title="Vas a recibir un aviso del navegador cuando entre un mensaje nuevo de un cliente, aunque estés en otra pestaña del panel"
              style={{ background: '#ECFDF5', color: '#047857', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <BellRing size={15} /> Notificaciones activas
            </span>
          ) : notifPermission === 'denied' ? (
            <span
              title="Las bloqueaste desde el navegador. Para activarlas de nuevo, entrá a la configuración del sitio en Chrome (icono de candado en la barra de direcciones) y permití las notificaciones."
              style={{ background: '#FEF2F2', color: '#DC2626', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'help' }}
            >
              <BellOff size={15} /> Notificaciones bloqueadas
            </span>
          ) : (
            <button
              onClick={onRequestNotif}
              className="btn-secondary"
              title="Activar avisos del navegador para cuando entren mensajes nuevos de clientes"
              style={{ fontSize: '0.82rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <Bell size={15} /> Activar Notificaciones
            </button>
          )
        )}
        {visitCount !== undefined && (
          <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={15} /> Visitas Web: {visitCount?.toLocaleString('es-AR')}
          </span>
        )}
        <span style={{ background: '#ECFDF5', color: '#047857', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={16} /> Admin Autenticado
        </span>
        {onLogout && (
          <button 
            onClick={onLogout}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <LogOut size={16} /> Cerrar Sesión
          </button>
        )}
      </div>
    </div>
  );
}
