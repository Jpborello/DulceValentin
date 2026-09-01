'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

// Boton de compartir para la pagina de una categoria/subcategoria (Server
// Component): va aparte porque necesita interactividad del navegador (Web
// Share API / portapapeles), igual que ShareProductButton.
export default function ShareCategoryButton({ label, productCount }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    const text = `Mirá ${label} en Dulce Valentín${productCount ? ` (${productCount} productos)` : ''} — precio mayorista.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Dulce Valentín', text, url });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {}
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="btn-secondary"
      title={copied ? 'Link copiado' : 'Compartir esta categoría'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
    >
      {copied ? <Check size={16} /> : <Share2 size={16} />}
      {copied ? 'Copiado' : 'Compartir'}
    </button>
  );
}
