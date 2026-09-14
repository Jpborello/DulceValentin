'use client';

import { useState } from 'react';
import { X, Phone, User, FileText, MapPin, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import useCloseOnBack from '@/lib/useCloseOnBack';
import { dataStore } from '@/lib/dataStore';

// Club Mayorista (2026-09): registro/login unificados en un solo paso, sin
// contraseña. El cliente escribe su WhatsApp; si ya tiene cuenta lo
// reconocemos al toque, si es la primera vez le pedimos Nombre/DNI/Localidad
// una única vez. Ver dataStore.findClientByPhone / registerUser / loginUser.
export default function AuthModal({ isOpen, onClose, onLogin, onRegister }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'details' | 'welcome'
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [locality, setLocality] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [welcomeName, setWelcomeName] = useState('');
  const handleClose = useCloseOnBack(isOpen, onClose);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setStep('phone');
    setPhone('');
    setName('');
    setDni('');
    setLocality('');
    setErrorMsg('');
    handleClose();
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
      setErrorMsg('Ingresá un número de WhatsApp válido.');
      return;
    }

    setIsChecking(true);
    try {
      const existing = await dataStore.findClientByPhone(phone);
      if (existing) {
        onLogin(phone, existing);
        setWelcomeName(existing.name);
        setStep('welcome');
        setTimeout(resetAndClose, 1400);
      } else {
        setStep('details');
      }
    } catch (err) {
      setErrorMsg('No pudimos verificar el número. Probá de nuevo.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name || !dni || !locality) {
      setErrorMsg('Por favor completá Nombre, DNI y Localidad.');
      return;
    }

    onRegister({ name, dni, phone, locality });
    setWelcomeName(name);
    setStep('welcome');
    setTimeout(resetAndClose, 1400);
  };

  return (
    <div className="modal-backdrop active">
      <div className="modal-box" style={{ maxWidth: '440px' }}>
        <button
          onClick={resetAndClose}
          className="qty-btn"
          style={{ position: 'absolute', top: '16px', right: '16px' }}
        >
          <X size={18} />
        </button>

        {step === 'welcome' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={48} style={{ color: 'var(--accent-emerald)', marginBottom: '12px' }} />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '6px' }}>
              ¡Hola, {welcomeName}!
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Ya sos parte del Club Mayorista Dulce Valentín.
            </p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                backgroundColor: 'var(--accent-gold-light)', color: 'var(--accent-gold-hover)',
                padding: '4px 14px', borderRadius: 'var(--radius-full)', fontWeight: 800,
                fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: '10px'
              }}>
                <Sparkles size={13} /> Club Mayorista
              </span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '6px' }}>
                {step === 'phone' ? 'Ingresá con tu WhatsApp' : 'Ya casi, completá tus datos'}
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {step === 'phone'
                  ? 'Sin contraseñas: te reconocemos por tu número la próxima vez.'
                  : 'Es la primera vez que entrás con este número — solo una vez.'}
              </p>
            </div>

            {errorMsg && (
              <div style={{
                backgroundColor: '#FFEBEE', color: '#C62828', padding: '10px 14px',
                borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 600
              }}>
                {errorMsg}
              </div>
            )}

            {step === 'phone' ? (
              <form onSubmit={handlePhoneSubmit}>
                <div className="form-group">
                  <label className="form-label">
                    <Phone size={14} style={{ display: 'inline', marginRight: '4px' }} /> Número de WhatsApp *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 3416095021"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="form-input"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isChecking}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', justifyContent: 'center', marginTop: '10px', opacity: isChecking ? 0.7 : 1 }}
                >
                  {isChecking ? 'Verificando...' : <>Continuar <ArrowRight size={18} /></>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleDetailsSubmit}>
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
                    autoFocus
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

                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', justifyContent: 'center', marginTop: '10px' }}>
                  Crear mi cuenta mayorista
                </button>

                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  style={{ width: '100%', textAlign: 'center', marginTop: '12px', fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'underline' }}
                >
                  Volver
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
