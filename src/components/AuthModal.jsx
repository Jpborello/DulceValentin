'use client';

import { useState } from 'react';
import { X, Lock, Phone, User, LogIn, UserPlus, FileText, MapPin } from 'lucide-react';
import useCloseOnBack from '@/lib/useCloseOnBack';

export default function AuthModal({ isOpen, onClose, onLogin, onRegister }) {
  const [isRegistering, setIsRegistering] = useState(true);
  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [locality, setLocality] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const handleClose = useCloseOnBack(isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!phone || !password) {
      setErrorMsg('Por favor completá teléfono y contraseña.');
      return;
    }

    if (isRegistering && (!name || !dni || !locality)) {
      setErrorMsg('Por favor completá Nombre, DNI y Localidad.');
      return;
    }

    if (isRegistering) {
      onRegister({ name, dni, phone, locality, password });
    } else {
      onLogin(phone, password);
    }

    setName('');
    setDni('');
    setPhone('');
    setLocality('');
    setPassword('');
    handleClose();
  };

  return (
    <div className="modal-backdrop active">
      <div className="modal-box" style={{ maxWidth: '480px' }}>
        <button
          onClick={handleClose}
          className="qty-btn" 
          style={{ position: 'absolute', top: '16px', right: '16px' }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '6px' }}>
            {isRegistering ? 'Registro de Cliente Mayorista' : 'Iniciar Sesión'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isRegistering ? 'Ingresá tus datos personales para armar tu pedido' : 'Accedé a tu cuenta mayorista'}
          </p>
        </div>

        {errorMsg && (
          <div style={{ 
            backgroundColor: '#FFEBEE', 
            color: '#C62828', 
            padding: '10px 14px', 
            borderRadius: 'var(--radius-sm)', 
            fontSize: '0.85rem',
            marginBottom: '16px',
            fontWeight: 600
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <>
              <div className="form-group">
                <label className="form-label">
                  <User size={14} style={{ display: 'inline', marginRight: '4px' }} /> Nombre Completo / Razón Social *
                </label>
                <input 
                  type="text" 
                  placeholder="Ej: Carlos Pérez / Moda San Martín" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="form-input" 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">
                    <FileText size={14} style={{ display: 'inline', marginRight: '4px' }} /> DNI / CUIT *
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ej: 38450123" 
                    value={dni} 
                    onChange={(e) => setDni(e.target.value)} 
                    className="form-input" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} /> Localidad *
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ej: Rosario / Funes" 
                    value={locality} 
                    onChange={(e) => setLocality(e.target.value)} 
                    className="form-input" 
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">
              <Phone size={14} style={{ display: 'inline', marginRight: '4px' }} /> Número de Teléfono (WhatsApp) *
            </label>
            <input 
              type="text" 
              placeholder="Ej: 3416095021" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              className="form-input" 
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Lock size={14} style={{ display: 'inline', marginRight: '4px' }} /> Contraseña *
            </label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="form-input" 
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', justifyContent: 'center', marginTop: '10px' }}>
            {isRegistering ? <UserPlus size={18} /> : <LogIn size={18} />}
            {isRegistering ? 'Crear Cuenta Mayorista' : 'Acceder'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isRegistering ? '¿Ya tenés cuenta?' : '¿Sos cliente nuevo?'}
          </span>{' '}
          <button 
            type="button" 
            onClick={() => setIsRegistering(!isRegistering)} 
            style={{ fontWeight: 700, color: 'var(--accent-gold-hover)', textDecoration: 'underline' }}
          >
            {isRegistering ? 'Iniciá Sesión' : 'Registrate gratis'}
          </button>
        </div>
      </div>
    </div>
  );
}
