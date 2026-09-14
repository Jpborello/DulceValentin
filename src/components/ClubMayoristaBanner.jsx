'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Ticket, ArrowRight } from 'lucide-react';
import { dataStore } from '@/lib/dataStore';

// Banner de retención (2026-09): reemplaza el espacio "solo oferta puntual"
// de debajo del hero por algo que le da al cliente una razón concreta para
// volver — el Club Mayorista (cuenta + sorteo por compra $50.000+) ya
// existía en el código pero era invisible en el sitio. Este banner lo
// muestra siempre en el mismo lugar: invita a sumarse si es visitante, y si
// ya es cliente le muestra cuántos boletos lleva acumulados.
export default function ClubMayoristaBanner({ currentUser, onOpenAuth }) {
  const [ticketCount, setTicketCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser?.phone) {
      setTicketCount(null);
      return;
    }
    dataStore.fetchMyRaffleTickets(currentUser.phone).then((tickets) => {
      if (!cancelled) setTicketCount(tickets.length);
    });
    return () => { cancelled = true; };
  }, [currentUser?.phone]);

  if (currentUser) {
    return (
      <div className="club-mayorista-banner club-mayorista-banner--member">
        <div className="club-mayorista-banner__text">
          <span className="club-mayorista-banner__icon"><Ticket size={18} /></span>
          <span>
            Hola <strong>{currentUser.name}</strong> — {ticketCount === null
              ? 'estamos revisando tus boletos del sorteo…'
              : ticketCount > 0
                ? <>llevás <strong>{ticketCount} boleto{ticketCount === 1 ? '' : 's'}</strong> para el Gran Sorteo Mayorista.</>
                : 'todavía no sumaste boletos: comprá $50.000 o más y entrás al Gran Sorteo Mayorista.'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="club-mayorista-banner">
      <div className="club-mayorista-banner__text">
        <span className="club-mayorista-banner__icon"><Sparkles size={18} /></span>
        <span>
          <strong>Club Mayorista Dulce Valentín:</strong> registrate con tu WhatsApp y participá del sorteo en cada compra de $50.000 o más.
        </span>
      </div>
      <button onClick={onOpenAuth} className="club-mayorista-banner__cta">
        Sumarme ahora <ArrowRight size={16} />
      </button>
    </div>
  );
}
