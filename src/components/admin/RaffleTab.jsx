'use client';

import { useState } from 'react';
import { Sparkles, Trophy, Ticket, RefreshCw, Play, Volume2, Users } from 'lucide-react';

export default function RaffleTab({ tickets }) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayTicket, setDisplayTicket] = useState('TICKET-????');
  const [winner, setWinner] = useState(null);

  const totalTicketsCount = tickets.length;
  const uniqueParticipantsCount = new Set(tickets.map(t => t.client_phone)).size;

  const handleStartRaffle = () => {
    if (tickets.length === 0) return;

    setIsSpinning(true);
    setWinner(null);

    let counter = 0;
    const interval = setInterval(() => {
      const randomT = tickets[Math.floor(Math.random() * tickets.length)];
      setDisplayTicket(randomT.ticket_id);
      counter++;

      if (counter > 35) {
        clearInterval(interval);
        const winningTicket = tickets[Math.floor(Math.random() * tickets.length)];
        setDisplayTicket(winningTicket.ticket_id);
        setWinner(winningTicket);
        setIsSpinning(false);
      }
    }, 90);
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <span style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '6px', 
          backgroundColor: 'var(--accent-gold-light)', 
          color: 'var(--accent-gold-hover)', 
          padding: '6px 16px', 
          borderRadius: 'var(--radius-full)', 
          fontWeight: 800, 
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '10px'
        }}>
          <Sparkles size={16} /> Sistema de Sorteo Mayorista en Vivo para Instagram Live
        </span>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 800 }}>Tómbola Digital de Premios Dulce Valentín</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Participan automáticamente todas las compras superiores a $50.000 ARS.
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '30px' }}>
        <div className="metric-card" style={{ textAlign: 'center' }}>
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <Ticket size={14} /> Boletos Generados
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-gold-hover)' }}>{totalTicketsCount}</div>
        </div>

        <div className="metric-card" style={{ textAlign: 'center' }}>
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <Users size={14} /> Clientes Participando
          </div>
          <div className="metric-value">{uniqueParticipantsCount}</div>
        </div>

        <div className="metric-card" style={{ textAlign: 'center' }}>
          <div className="metric-label">Requisito de Entrada</div>
          <div className="metric-value" style={{ fontSize: '1.4rem', color: 'var(--accent-emerald)' }}>
            $50.000+ por compra
          </div>
        </div>
      </div>

      {/* INSTAGRAM LIVE STREAMING TOMBOLA DISPLAY */}
      <div style={{ 
        background: 'linear-gradient(135deg, #2C2825 0%, #1D1A18 100%)', 
        borderRadius: 'var(--radius-lg)', 
        padding: '40px 24px', 
        color: '#FFF', 
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
        border: '2px solid var(--accent-gold)',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '40px'
      }}>
        <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', color: '#F4E8D3' }}>
          <Volume2 size={14} /> Listo para transmitir en vivo
        </div>

        <Trophy size={48} style={{ color: 'var(--accent-gold)', marginBottom: '14px' }} />

        <div style={{ 
          fontSize: 'clamp(2rem, 6vw, 3.8rem)', 
          fontWeight: 900, 
          fontFamily: 'monospace', 
          letterSpacing: '0.15em', 
          color: 'var(--accent-gold-light)',
          background: 'rgba(0,0,0,0.4)',
          display: 'inline-block',
          padding: '16px 36px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--accent-gold)',
          margin: '20px 0 30px 0',
          textShadow: '0 0 20px rgba(200, 157, 84, 0.6)'
        }}>
          {displayTicket}
        </div>

        <div>
          <button 
            onClick={handleStartRaffle} 
            disabled={isSpinning || tickets.length === 0} 
            className="btn-hero-primary" 
            style={{ 
              fontSize: '1.2rem', 
              padding: '16px 40px',
              cursor: isSpinning ? 'wait' : 'pointer'
            }}
          >
            <Play size={20} style={{ display: 'inline', marginRight: '8px' }} /> 
            {isSpinning ? 'GIRANDO TÓMBOLA EN VIVO...' : '¡REALIZAR SORTEO AHORA!'}
          </button>
        </div>

        {/* WINNER CARD REVEAL FOR LIVE INSTAGRAM STREAMING */}
        {winner && (
          <div style={{ 
            marginTop: '32px', 
            backgroundColor: 'rgba(200, 157, 84, 0.15)', 
            border: '2px solid var(--accent-gold)', 
            borderRadius: 'var(--radius-md)', 
            padding: '24px',
            animation: 'fadeIn 0.5s ease-in-out'
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              🎉 ¡¡TENEMOS GANADOR DEL SORTEO MAYORISTA!! 🎉
            </div>
            
            <h3 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF', margin: '10px 0' }}>
              {winner.client_name}
            </h3>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.95rem', color: '#F4E8D3', fontWeight: 600 }}>
              <div>📄 DNI/CUIT: <strong>{winner.client_dni || 'No especificado'}</strong></div>
              <div>📍 Localidad: <strong>{winner.client_locality || 'No especificada'}</strong></div>
              <div>📞 Teléfono: <strong>{winner.client_phone}</strong></div>
              <div>🎫 Boleto Ganador: <strong>{winner.ticket_id}</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* Table of all registered tickets */}
      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '14px' }}>Boletos Participantes Registrados</h3>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Boleto ID</th>
            <th>Cliente</th>
            <th>DNI / CUIT</th>
            <th>Teléfono</th>
            <th>Localidad</th>
            <th>Orden Origen</th>
            <th>Monto Compra</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t, idx) => (
            <tr key={idx}>
              <td style={{ fontWeight: 800, color: 'var(--accent-gold-hover)' }}>{t.ticket_id}</td>
              <td style={{ fontWeight: 700 }}>{t.client_name}</td>
              <td>{t.client_dni || 'Sin DNI'}</td>
              <td>{t.client_phone}</td>
              <td>{t.client_locality || 'Sin localidad'}</td>
              <td>{t.order_id}</td>
              <td style={{ fontWeight: 800, color: 'var(--accent-emerald)' }}>
                ${t.order_amount?.toLocaleString('es-AR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
