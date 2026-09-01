'use client';

import Link from 'next/link';
import { ArrowLeft, LogOut, ShieldCheck, Eye, Bell, BellOff, BellRing } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function AdminHeader({ onLogout, visitCount, notifPermission, onRequestNotif }) {
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

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <ThemeToggle />
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
