'use client';

import { Tag, Truck, Store, MessageCircle } from 'lucide-react';

const ITEMS = [
  {
    icon: Tag,
    title: 'Precio 100% Mayorista',
    subtitle: 'Sin intermediarios, mejores precios'
  },
  {
    icon: Truck,
    title: 'Envíos a Todo el País',
    subtitle: 'Recibí tu pedido donde estés'
  },
  {
    icon: Store,
    title: 'Retirá en Nuestro Local',
    subtitle: 'Pte. Perón 5349/5305/5265, Rosario — te esperamos con la mejor onda ✨'
  },
  {
    icon: MessageCircle,
    title: 'Consultas por WhatsApp',
    subtitle: 'Escribinos y te respondemos al toque'
  }
];

export default function TrustBar() {
  return (
    <div className="trust-bar">
      {ITEMS.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div key={idx} className="trust-bar-item">
            <div className="trust-bar-icon">
              <Icon size={20} />
            </div>
            <div className="trust-bar-text">
              {item.title}
              <span>{item.subtitle}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
