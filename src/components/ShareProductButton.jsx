'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { shareProduct } from '@/lib/shareProduct';

// Boton de compartir para la pagina propia de un producto (Server Component):
// va aparte porque necesita interactividad del navegador (Web Share API /
// portapapeles), algo que un Server Component no puede hacer solo.
export default function ShareProductButton({ product }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const result = await shareProduct(product);
    if (result === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="btn-secondary"
      title={copied ? 'Link copiado' : 'Compartir este producto'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
    >
      {copied ? <Check size={16} /> : <Share2 size={16} />}
      {copied ? 'Copiado' : 'Compartir'}
    </button>
  );
}
