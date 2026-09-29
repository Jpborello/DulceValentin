'use client';

import { useEffect, useRef, useState } from 'react';

// <img> con respaldo: si la foto no carga (por ejemplo una miniatura
// "-thumb.webp" que nunca se genero), prueba la siguiente de `fallbacks`.
// Maneja tambien el caso en que la imagen fallo antes de que React
// "despierte" la pagina, cuando el onError todavia no estaba conectado.
export default function SafeImg({ src, fallbacks = [], ...rest }) {
  const chain = [src, ...fallbacks].filter((u, i, arr) => u && arr.indexOf(u) === i);
  const [step, setStep] = useState(0);
  const ref = useRef(null);
  const key = chain.join('|');

  useEffect(() => { setStep(0); }, [key]);

  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0 && step < chain.length - 1) setStep(step + 1);
  }, [step, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <img
      ref={ref}
      src={chain[Math.min(step, chain.length - 1)]}
      onError={() => { if (step < chain.length - 1) setStep(step + 1); }}
      {...rest}
    />
  );
}
