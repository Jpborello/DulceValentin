import { createElement, Fragment } from 'react';

// Expresión regular que detecta tanto links Markdown [texto](url) como URLs sueltas https://...
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s\)]+)\)|((?:https?:\/\/)[^\s\)]+)/g;

function renderTextWithBold(text, keyPrefix) {
  if (!text) return null;
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((bPart, bIdx) => {
    if (bPart.startsWith('**') && bPart.endsWith('**')) {
      return createElement(
        'strong',
        { key: `${keyPrefix}-b-${bIdx}`, style: { fontWeight: 800 } },
        bPart.slice(2, -2)
      );
    }
    return bPart;
  });
}

export function renderMessageWithLinks(text) {
  if (!text) return text;

  const elements = [];
  let lastIndex = 0;
  let match;
  let count = 0;

  // Reseteamos el regex global
  MARKDOWN_LINK_REGEX.lastIndex = 0;

  while ((match = MARKDOWN_LINK_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const rawText = text.slice(lastIndex, match.index);
      elements.push(
        createElement(Fragment, { key: `text-${count++}` }, renderTextWithBold(rawText, `t-${count}`))
      );
    }

    if (match[1] && match[2]) {
      // Caso 1: [Texto](URL)
      const label = match[1];
      let url = match[2];
      // Si es un path relativo ej /producto/..., armamos la URL completa o la dejamos navegable
      if (url.startsWith('/')) {
        url = typeof window !== 'undefined' ? `${window.location.origin}${url}` : `https://www.dulcevalentin.com.ar${url}`;
      }
      elements.push(
        createElement(
          'a',
          {
            key: `link-${count++}`,
            href: url,
            target: '_blank',
            rel: 'noreferrer',
            style: {
              color: '#2563EB',
              textDecoration: 'underline',
              fontWeight: 800,
              padding: '2px 4px',
              borderRadius: '4px',
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              display: 'inline-block',
              margin: '0 2px'
            }
          },
          `🔗 ${label}`
        )
      );
    } else if (match[3]) {
      // Caso 2: URL suelta https://...
      const rawUrl = match[3];
      const trailingPunctMatch = rawUrl.match(/[.,;:)\]]+$/);
      const trailing = trailingPunctMatch ? trailingPunctMatch[0] : '';
      const cleanUrl = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;

      elements.push(
        createElement(
          Fragment,
          { key: `link-raw-${count++}` },
          createElement(
            'a',
            {
              href: cleanUrl,
              target: '_blank',
              rel: 'noreferrer',
              style: {
                color: '#2563EB',
                textDecoration: 'underline',
                fontWeight: 700,
                wordBreak: 'break-all'
              }
            },
            cleanUrl
          ),
          trailing
        )
      );
    }

    lastIndex = MARKDOWN_LINK_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    const rawText = text.slice(lastIndex);
    elements.push(
      createElement(Fragment, { key: `text-${count++}` }, renderTextWithBold(rawText, `t-end`))
    );
  }

  return elements.length > 0 ? elements : text;
}
