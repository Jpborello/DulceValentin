'use client';

import { useEffect, useRef } from 'react';

/**
 * Hace que el boton/gesto "atras" del navegador cierre un modal o drawer
 * en lugar de sacar al usuario de la web entera.
 *
 * Problema que soluciona: en mobile, cuando se abre un modal (detalle de
 * producto, carrito, login) no queda ninguna entrada nueva en el historial
 * del navegador. Si el usuario aprieta "atras" (boton fisico o gesto),
 * el navegador no tiene a donde volver dentro del sitio y termina saliendo
 * de la pagina por completo.
 *
 * Solucion: al abrir, se agrega una entrada de historial "dummy". Si el
 * usuario aprieta "atras", esa entrada se consume y en su lugar cerramos
 * el modal (via popstate). Si el usuario cierra el modal con la X o
 * tocando afuera, usamos la funcion devuelta por este hook, que consume
 * esa misma entrada con history.back() para no dejar "basura" en el
 * historial.
 */
export default function useCloseOnBack(isOpen, onClose) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ __modalOpen: true }, '');
    pushedRef.current = true;

    const handlePopState = () => {
      pushedRef.current = false;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const closeAndCleanHistory = () => {
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  };

  return closeAndCleanHistory;
}
