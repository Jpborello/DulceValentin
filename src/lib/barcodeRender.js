'use client';

import JsBarcode from 'jsbarcode';
import { isValidEan13 } from '@/lib/barcode';

// Dibuja un codigo de barras como SVG con el ancho de barra EXACTO en mm,
// sin estirarlo ni achicarlo para llenar la etiqueta (2026-11-18).
//
// Por que: las impresoras termicas de etiquetas imprimen a 203 dpi (8 puntos
// por mm). Si la barra mas fina no cae justo en un numero entero de puntos,
// unas barras salen de 1 punto y otras de 2, y el lector no las distingue.
// Con 3 puntos (0,375 mm) por barra minima el codigo sale nitido.
//
// moduleMm: ancho de la barra mas fina. 0,375 mm = 3 puntos a 203 dpi.
// maxWidthMm: si el codigo no entra (codigos viejos DV largos), se baja a 2
// puntos y, si aun asi no entra, se achica para que quepa (puede no leerse:
// esos codigos hay que pasarlos a EAN-13).
export const DOT_MM = 25.4 / 203;

export function renderBarcodeSvg(value, { moduleMm = 3 * DOT_MM, barHeightMm = 9, fontMm = 2.6, maxWidthMm = 46 } = {}) {
  const code = String(value || '').trim();
  if (!code || typeof document === 'undefined') return '';
  const format = isValidEan13(code) ? 'EAN13' : 'CODE128';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  // Se dibuja en "unidades de modulo" (1 = una barra minima) y despues se le da
  // el tamaño real en mm con viewBox. margin = zona en blanco a los costados
  // (el lector la necesita: minimo ~10 modulos).
  const quiet = format === 'EAN13' ? 10 : 10;
  try {
    JsBarcode(svg, code, {
      format,
      width: 1,
      height: Math.round(barHeightMm / moduleMm),
      margin: 0,
      marginLeft: quiet,
      marginRight: quiet,
      displayValue: true,
      fontSize: Math.round(fontMm / moduleMm),
      textMargin: 1,
      font: 'Arial',
      fontOptions: 'bold',
      flat: true,
      background: '#ffffff',
      lineColor: '#000000'
    });
  } catch (err) {
    console.warn('Código de barras inválido:', code, err);
    return '';
  }

  const wUnits = parseFloat(svg.getAttribute('width')) || 0;
  const hUnits = parseFloat(svg.getAttribute('height')) || 0;
  if (!wUnits || !hUnits) return '';

  let mod = moduleMm;
  if (wUnits * mod > maxWidthMm) mod = 2 * DOT_MM;        // probar con 2 puntos
  if (wUnits * mod > maxWidthMm) mod = maxWidthMm / wUnits; // ultimo recurso: que entre

  svg.setAttribute('viewBox', `0 0 ${wUnits} ${hUnits}`);
  svg.setAttribute('width', `${(wUnits * mod).toFixed(3)}mm`);
  svg.setAttribute('height', `${(hUnits * mod).toFixed(3)}mm`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('preserveAspectRatio', 'none');
  return new XMLSerializer().serializeToString(svg);
}
