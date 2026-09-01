// El bot manda los links de producto como texto plano dentro de la
// respuesta (ej "...mirala aca: https://www.dulcevalentin.com.ar/producto/...").
// Sin esto, React los renderiza como texto sin mas -- el cliente los ve pero
// no los puede tocar/abrir, solo copiarlos a mano. Esto detecta las URLs y
// las devuelve como <a> clickeables, dejando el resto del texto igual.
// Usado tanto en el chat web (WebChatWidget.jsx) como en la bandeja de
// WhatsApp del admin (WhatsAppTab.jsx). Sin JSX a proposito (archivo .js
// de lib, no componente) -- se arma con React.createElement directo.
import { createElement, Fragment } from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function renderMessageWithLinks(text) {
  if (!text) return text;
  const parts = text.split(URL_REGEX);
  return parts.map((part, idx) => {
    if (part.match(URL_REGEX)) {
      // Sacamos puntuacion final (. , ) etc) que suele quedar pegada a la
      // URL cuando el bot termina la oracion justo despues del link.
      const trailingPunctMatch = part.match(/[.,;:)\]]+$/);
      const trailing = trailingPunctMatch ? trailingPunctMatch[0] : '';
      const cleanUrl = trailing ? part.slice(0, -trailing.length) : part;
      return createElement(
        Fragment,
        { key: idx },
        createElement(
          'a',
          {
            href: cleanUrl,
            target: '_blank',
            rel: 'noreferrer',
            style: { color: 'inherit', textDecoration: 'underline', fontWeight: 700, wordBreak: 'break-all' }
          },
          cleanUrl
        ),
        trailing
      );
    }
    return part;
  });
}
