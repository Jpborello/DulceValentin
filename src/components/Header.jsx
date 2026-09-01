'use client';

import { useState } from 'react';
import { ShoppingBag, User, Menu, X, Shield } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

export default function Header({
  cartCount,
  onOpenCart,
  onOpenAuth,
  currentUser,
  onLogout
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="header-container">
      {/* Top Notification Bar */}
      <div className="header-top">
        📍 ROSARIO (SANTA FE) — PTE. PERÓN 5349/5305/5265 — Lunes a Sábado de 8 a 17 hs
      </div>

      <div className="header-content">
        {/* Brand Logo & Name */}
        <Link href="/" className="brand-logo-wrapper">
          <img 
            src="/logo.png" 
            alt="Logo Dulce Valentín" 
            className="brand-logo-img"
          />
          <div>
            <div className="brand-title">Dulce Valentín</div>
            <div className="brand-subtitle">Indumentaria Mayorista</div>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="header-nav">
          <a href="#catalogo" className="nav-link">Catálogo</a>
          <a href="#ofertas" className="nav-link">Ofertas</a>
          <a href="#destacados" className="nav-link">Más Vendidos</a>
        </nav>

        {/* Actions (Auth & Cart) */}
        <div className="header-actions">
          <ThemeToggle />
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                Hola, <strong>{currentUser.name}</strong>
              </span>
              <button onClick={onLogout} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                Salir
              </button>
            </div>
          ) : (
            <button onClick={onOpenAuth} className="btn-primary">
              <User size={18} /> Iniciar Sesión / Registro
            </button>
          )}

          <button onClick={onOpenCart} className="btn-icon" title="Ver Carrito Mayorista">
            <ShoppingBag size={22} />
            {cartCount > 0 && <span className="badge-counter">{cartCount}</span>}
          </button>

          {/* Mobile Menu Toggle Button */}
          <button 
            className="btn-icon mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div style={{ 
          backgroundColor: 'var(--bg-card)', 
          borderTop: '1px solid var(--border-color)', 
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <a href="#catalogo" onClick={() => setMobileMenuOpen(false)} className="nav-link">Catálogo Completo</a>
          <a href="#ofertas" onClick={() => setMobileMenuOpen(false)} className="nav-link">Ofertas Especiales</a>
          <a href="#destacados" onClick={() => setMobileMenuOpen(false)} className="nav-link">Productos de Alta Rotación</a>
        </div>
      )}
    </header>
  );
}
