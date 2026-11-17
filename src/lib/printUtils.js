import JsBarcode from 'jsbarcode';
import { getProductPrice } from './productPricing';

// Los tickets se arman como HTML y se escriben en un iframe del mismo sitio:
// cualquier texto que venga de un pedido (nombre del cliente, notas) se
// escapa para que no se interprete como HTML (un nombre cargado desde la web
// con etiquetas podria ejecutar codigo en el panel al imprimir).
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Precio unitario de un renglon: el que se cobro. Las ventas guardan
// product.unit_price (caja) o unit_price; si no, el mismo calculo que el
// total (precio por talle / mayorista). Antes se usaba product.price
// (minorista) y el renglon podia no coincidir con el total cobrado.
function lineUnitPrice(it) {
  const candidates = [it?.unit_price, it?.product?.unit_price, it?.price];
  for (const c of candidates) {
    const n = Number(c);
    if (c !== undefined && c !== null && c !== '' && Number.isFinite(n)) return n;
  }
  const size = it?.size || it?.product?.selectedSize || it?.selectedSize || null;
  return getProductPrice(it?.product, size);
}

/**
 * Utilidad universal de impresión aislada mediante iframe oculto para Dulce Valentín.
 * Evita que estilos de la app, elementos invisibles del DOM (dashboard, tablas largas)
 * o el scroll interno de los modales corten o desfasen el contenido a imprimir.
 */
export function printIsolatedContent({
  html,
  styles,
  title = 'Impresión',
  pageSize = null,
  pageMargin = '0mm'
}) {
  if (typeof window === 'undefined') return;

  // Reutilizar o crear un iframe persistente en el DOM
  let iframe = document.getElementById('isolated-print-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'isolated-print-iframe';
    // Se posiciona dentro del viewport pero detrás de la app (z-index negativo)
    // para que el motor de renderizado de Chromium NUNCA lo descarte como "invisible" u "offscreen".
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '300px';
    iframe.style.height = '300px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-99999';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    window.print();
    return;
  }

  const pageRule = pageSize
    ? `@page { size: ${pageSize}; margin: ${pageMargin}; }`
    : `@page { margin: ${pageMargin}; }`;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          ${pageRule}
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
          }
          ${styles || ''}
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);
  doc.close();

  // Esperar a que el DOM interno termine de pintar fuentes antes de invocar print()
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error('Error al invocar iframe.print():', err);
      window.print();
    }
  }, 300);
}

/**
 * Estilos optimizados para impresoras térmicas de 58mm (3nStar RPT001 / POS-58 / Xprinter).
 * Claves técnicas:
 * 1. Tipografía Sans-Serif sólida (Arial/Segoe UI) sin dithering.
 * 2. Ancho efectivo de 48mm (área útil de rollo de 58mm).
 * 3. @page margin: 0 (evita avance infinito de papel).
 * 4. Líneas sólidas en vez de dashed para máxima definición del cabezal térmico.
 * 5. Feed final moderado de 8mm para que la cuchilla manual no corte el texto.
 */
export const THERMAL_58MM_STYLES = `
  @page {
    margin: 0mm !important;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    width: 48mm !important;
    max-width: 48mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #000000 !important;
    font-family: Arial, Helvetica, sans-serif !important;
    -webkit-font-smoothing: antialiased !important;
    text-rendering: geometricPrecision !important;
  }
  .thermal-ticket {
    width: 48mm;
    max-width: 48mm;
    margin: 0;
    padding: 1.5mm 1mm 4mm 1mm;
    font-size: 11px;
    line-height: 1.25;
    color: #000000;
  }
  .th-bold {
    font-weight: 800 !important;
  }
  .th-header {
    text-align: center;
    margin-bottom: 4px;
  }
  .th-logo {
    max-width: 34mm;
    max-height: 16mm;
    object-fit: contain;
    margin: 0 auto 3px auto;
    display: block;
    filter: grayscale(100%) contrast(150%);
  }
  .th-brand {
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 0.5px;
    line-height: 1.1;
    margin-bottom: 1px;
  }
  .th-sub {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.3px;
    margin-bottom: 2px;
  }
  .th-thanks-top {
    font-size: 11px;
    font-weight: 800;
    margin: 2px 0 3px 0;
    letter-spacing: 0.2px;
  }
  .th-doc-type {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.4px;
  }
  .th-barcode-wrap {
    text-align: center;
    margin: 3px 0 2px 0;
  }
  .th-barcode-wrap svg {
    max-width: 44mm;
    max-height: 14mm;
    display: block;
    margin: 0 auto;
  }
  .th-divider {
    border-bottom: 1.5px solid #000000;
    margin: 4px 0;
  }
  .th-divider-thin {
    border-bottom: 1px solid #000000;
    margin: 3px 0;
  }
  .th-row-between {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 4px;
    font-size: 10.5px;
    margin-bottom: 1.5px;
  }
  .th-meta {
    margin: 3px 0;
    font-size: 10.5px;
  }
  .th-items-header {
    display: flex;
    justify-content: space-between;
    font-size: 9.5px;
    font-weight: 900;
    letter-spacing: 0.3px;
    padding: 1px 0;
  }
  .th-items {
    margin: 3px 0;
  }
  .th-item {
    margin-bottom: 4px;
  }
  .th-item-title {
    font-size: 11.5px;
    font-weight: 800;
    line-height: 1.2;
    word-break: break-word;
  }
  .th-item-sub {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10.5px;
    font-weight: 700;
    margin-top: 1px;
  }
  .th-item-calc {
    font-size: 10px;
    color: #000;
  }
  .th-item-price {
    font-size: 11.5px;
    font-weight: 900;
  }
  .th-totals {
    margin: 3px 0;
  }
  .th-subtotal, .th-discount {
    font-size: 11px;
  }
  .th-grand-total {
    font-size: 15px;
    font-weight: 900;
    margin: 4px 0 2px 0;
  }
  .th-policy {
    text-align: center;
    font-size: 9px;
    font-weight: 700;
    line-height: 1.25;
    margin: 4px 0;
  }
  .th-policy-title {
    font-size: 9.5px;
    font-weight: 900;
    margin-bottom: 1px;
  }
  .th-footer {
    text-align: center;
    font-size: 9.5px;
    font-weight: 700;
    line-height: 1.3;
    margin-top: 4px;
  }
  .th-thanks {
    font-size: 11px;
    font-weight: 900;
    margin-top: 4px;
  }
  .th-section-title {
    font-size: 9.5px;
    font-weight: 900;
    text-align: center;
    margin: 2px 0 3px 0;
  }
  .th-items-summary {
    font-size: 10.5px;
  }
  .th-feed {
    height: 8mm;
  }
`;

/**
 * Estilos para comprobantes en Hoja A4 Completa (210 x 297 mm)
 * Diseñado para ventas mayoristas con 20 a 60 prendas.
 */
export const SHEET_A4_STYLES = `
  @page {
    size: A4 portrait;
    margin: 8mm 10mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    background: #fff;
    line-height: 1.35;
    font-size: 11px;
  }
  .sheet-container {
    width: 100%;
    max-width: 190mm;
    margin: 0 auto;
  }
  .sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .sheet-logo-group {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .sheet-logo-img {
    max-height: 48px;
    max-width: 130px;
    object-fit: contain;
  }
  .sheet-company-title {
    font-size: 19px;
    font-weight: 900;
    letter-spacing: 0.5px;
  }
  .sheet-company-sub {
    font-size: 11px;
    font-weight: 700;
    color: #222;
  }
  .sheet-thanks-badge {
    font-size: 11px;
    font-weight: 800;
    color: #000;
    margin-top: 2px;
  }
  .sheet-meta-card {
    border: 1.5px solid #000;
    border-radius: 6px;
    padding: 6px 12px;
    text-align: right;
    min-width: 200px;
  }
  .sheet-meta-title {
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.5px;
  }
  .sheet-meta-num {
    font-size: 15px;
    font-weight: 900;
    margin: 1px 0;
  }
  .sheet-info-strip {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    background: #f7f7f7;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 11px;
    margin-bottom: 12px;
  }
  .sheet-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    font-size: 11px;
  }
  .sheet-table th {
    background: #000;
    color: #fff !important;
    font-weight: 800;
    padding: 6px 8px;
    font-size: 10px;
    text-transform: uppercase;
    border: 1px solid #000;
  }
  .sheet-table td {
    padding: 5px 8px;
    border: 1px solid #ccc;
  }
  .sheet-table tr:nth-child(even) td {
    background: #fbfbfb;
  }
  .sheet-totals-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 14px;
  }
  .sheet-policy-box {
    flex: 1;
    border: 1px dashed #444;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 10.5px;
    line-height: 1.4;
  }
  .sheet-totals-box {
    min-width: 240px;
    border: 1.5px solid #000;
    border-radius: 6px;
    padding: 8px 12px;
  }
  .sheet-footer {
    border-top: 1px solid #ccc;
    padding-top: 8px;
    text-align: center;
    font-size: 10px;
  }
`;

/**
 * Estilos para comprobantes en Media Hoja A5 (148 x 210 mm)
 * Estándar mayorista: ahorra la mitad de papel y entran 10 a 25 prendas perfectamente.
 */
export const SHEET_A5_STYLES = `
  @page {
    size: A5 portrait;
    margin: 5mm 6mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    background: #fff;
    line-height: 1.25;
    font-size: 9.5px;
  }
  .sheet-container {
    width: 100%;
    max-width: 136mm;
    margin: 0 auto;
  }
  .sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #000;
    padding-bottom: 5px;
    margin-bottom: 6px;
  }
  .sheet-logo-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sheet-logo-img {
    max-height: 36px;
    max-width: 90px;
    object-fit: contain;
  }
  .sheet-company-title {
    font-size: 15px;
    font-weight: 900;
    letter-spacing: 0.4px;
  }
  .sheet-company-sub {
    font-size: 9px;
    font-weight: 700;
    color: #222;
  }
  .sheet-thanks-badge {
    font-size: 9px;
    font-weight: 800;
    color: #000;
    margin-top: 2px;
  }
  .sheet-meta-card {
    border: 1px solid #000;
    border-radius: 4px;
    padding: 4px 8px;
    text-align: right;
    min-width: 150px;
  }
  .sheet-meta-title {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.4px;
  }
  .sheet-meta-num {
    font-size: 13px;
    font-weight: 900;
  }
  .sheet-info-strip {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    background: #f7f7f7;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 9px;
    margin-bottom: 8px;
  }
  .sheet-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 9px;
  }
  .sheet-table th {
    background: #000;
    color: #fff !important;
    font-weight: 800;
    padding: 4px 6px;
    font-size: 8.5px;
    text-transform: uppercase;
    border: 1px solid #000;
  }
  .sheet-table td {
    padding: 3.5px 6px;
    border: 1px solid #ccc;
  }
  .sheet-table tr:nth-child(even) td {
    background: #fbfbfb;
  }
  .sheet-totals-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 8px;
  }
  .sheet-policy-box {
    flex: 1;
    border: 1px dashed #444;
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 8.5px;
    line-height: 1.35;
  }
  .sheet-totals-box {
    min-width: 180px;
    border: 1.2px solid #000;
    border-radius: 4px;
    padding: 5px 8px;
  }
  .sheet-footer {
    border-top: 1px solid #ccc;
    padding-top: 5px;
    text-align: center;
    font-size: 8.5px;
  }
`;

/**
 * Imprime contenido térmico en un iframe aislado con calibración 58mm.
 */
export function printThermalTicket({ html, title = 'Ticket Dulce Valentín' }) {
  printIsolatedContent({
    html,
    styles: THERMAL_58MM_STYLES,
    title,
    pageSize: null,
    pageMargin: '0mm'
  });
}

/**
 * Genera el HTML formateado para un comprobante de venta térmica 58mm de Dulce Valentín.
 */
export function generateThermalSaleTicketHtml({
  order,
  cajaName = 'Caja 01',
  cashier = '',
  paymentMethod = '',
  cashGiven = null,
  changeDue = null,
  isPreventa = false,
  sectionName = ''
}) {
  if (!order) return '';

  const items = Array.isArray(order.items) ? order.items : [];
  const createdDate = order.created_at ? new Date(order.created_at) : new Date();
  const dateStr = createdDate.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = createdDate.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const payMethod = paymentMethod || order.payment_method || 'efectivo';
  const payLabel = payMethod === 'efectivo'
    ? 'Efectivo'
    : payMethod === 'transferencia'
    ? 'Transferencia (Alias / MP)'
    : payMethod === 'tarjeta'
    ? 'Tarjeta (Débito/Crédito)'
    : payMethod;

  const totalAmount = Number(order.total_amount) || 0;
  const discountApplied = Number(order.discount_applied) || 0;
  const subtotal = discountApplied > 0 ? totalAmount + discountApplied : totalAmount;

  // Código de barras del comprobante para escanear en caja
  let orderBarcodeSvgMarkup = '';
  if (typeof document !== 'undefined' && order.id) {
    try {
      const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svgNode, String(order.id), {
        format: 'CODE128',
        displayValue: true,
        fontSize: 10,
        height: 24,
        margin: 1,
        width: 1.3
      });
      orderBarcodeSvgMarkup = new XMLSerializer().serializeToString(svgNode);
    } catch (_) {}
  }

  const docTitle = isPreventa
    ? 'TICKET DE PREVENTA'
    : 'COMPROBANTE DE VENTA';

  return `
    <div class="thermal-ticket">
      <!-- ENCABEZADO CON LOGO, TITULO Y AGRADECIMIENTO -->
      <div class="th-header">
        <img class="th-logo" src="/logo.png" alt="Dulce Valentín" onerror="this.style.display='none'" />
        <div class="th-brand">DULCE VALENTÍN</div>
        <div class="th-sub">INDUMENTARIA & CALZADO</div>
        <div class="th-thanks-top">¡Gracias por elegirnos!</div>
        <div class="th-doc-type">${docTitle}</div>
        ${sectionName ? `<div style="font-size: 9.5px; font-weight: 800; margin-top: 1px;">${esc(sectionName.toUpperCase())}</div>` : ''}
        ${isPreventa ? `<div style="font-size: 8.5px; font-weight: 700; margin-top: 1px; color: #111;">(Presentar en Caja Principal para abonar)</div>` : ''}
      </div>

      <div class="th-divider"></div>

      <!-- METADATOS -->
      <div class="th-meta">
        <div class="th-row-between">
          <span class="th-bold">${isPreventa ? 'Preventa N°:' : 'Comprobante N°:'}</span>
          <span class="th-bold">#${esc(order.id || 'LOCAL')}</span>
        </div>
        <div class="th-row-between">
          <span>Fecha y hora:</span>
          <span>${dateStr} ${timeStr}</span>
        </div>
        ${cajaName || cashier ? `
          <div class="th-row-between">
            <span>Terminal / Cajera:</span>
            <span>${esc([cajaName, cashier].filter(Boolean).join(' • '))}</span>
          </div>
        ` : ''}
        ${order.seller_name ? `
          <div class="th-row-between">
            <span>Vendedora:</span>
            <span>${esc(order.seller_name)}</span>
          </div>
        ` : ''}
        ${order.client_name && order.client_name !== 'Consumidor Final' ? `
          <div class="th-row-between">
            <span>Cliente:</span>
            <span class="th-bold">${esc(order.client_name)}</span>
          </div>
        ` : ''}
        ${!isPreventa ? `
          <div class="th-row-between">
            <span>Medio de Pago:</span>
            <span class="th-bold">${payLabel}</span>
          </div>
        ` : ''}
      </div>

      ${orderBarcodeSvgMarkup ? `
        <div class="th-barcode-wrap">
          ${orderBarcodeSvgMarkup}
        </div>
      ` : ''}

      <div class="th-divider"></div>

      <!-- CABECERA ITEMS -->
      <div class="th-items-header">
        <span style="flex: 1;">DETALLE PRENDA</span>
        <span style="width: 50px; text-align: right;">TOTAL</span>
      </div>
      <div class="th-divider-thin"></div>

      <!-- LISTA DE ARTÍCULOS -->
      <div class="th-items">
        ${items.map((it) => {
          const qty = it.quantity || 1;
          const unit = lineUnitPrice(it);
          const itemTotal = unit * qty;
          const name = esc(it.product?.name || it.name || 'Prenda');
          const size = it.size || it.product?.selectedSize || it.selectedSize;
          const color = it.color || it.product?.selectedColor || it.selectedColor;

          const variantParts = [];
          if (size && size !== 'SIN_TALLE') variantParts.push(`Talle ${esc(size)}`);
          if (color && color !== 'SIN_COLOR') variantParts.push(esc(color));
          const variantText = variantParts.length > 0 ? ` (${variantParts.join(' · ')})` : '';

          return `
            <div class="th-item">
              <div class="th-item-title">${qty}x ${name}${variantText}</div>
              <div class="th-item-sub">
                <span class="th-item-calc">${qty > 1 ? `${qty} x $${unit.toLocaleString('es-AR')}` : ''}</span>
                <span class="th-item-price">$${itemTotal.toLocaleString('es-AR')}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="th-divider"></div>

      <!-- TOTALES -->
      <div class="th-totals">
        ${discountApplied > 0 ? `
          <div class="th-row-between th-subtotal">
            <span>Subtotal:</span>
            <span>$${subtotal.toLocaleString('es-AR')}</span>
          </div>
          <div class="th-row-between th-discount">
            <span>Descuento aplicado:</span>
            <span>-$${discountApplied.toLocaleString('es-AR')}</span>
          </div>
        ` : ''}
        <div class="th-row-between th-grand-total">
          <span>TOTAL:</span>
          <span>$${totalAmount.toLocaleString('es-AR')}</span>
        </div>

        ${cashGiven ? `
          <div class="th-divider-thin"></div>
          <div class="th-row-between" style="font-size: 11px;">
            <span>Abona con:</span>
            <span>$${Number(cashGiven).toLocaleString('es-AR')}</span>
          </div>
          <div class="th-row-between th-bold" style="font-size: 12px;">
            <span>Su vuelto:</span>
            <span>$${Number(changeDue || 0).toLocaleString('es-AR')}</span>
          </div>
        ` : ''}
      </div>

      <div class="th-divider"></div>

      <!-- POLÍTICA DE CAMBIO REQUERIDA -->
      <div class="th-policy">
        <div class="th-policy-title">POLÍTICA DE CAMBIOS</div>
        <div>Para cambios presentarse con este ticket de <strong>lunes a jueves de 8:00 a 17:00 hs</strong> (dentro de los 15 días con la prenda en perfecto estado y etiqueta puesta).</div>
      </div>

      <!-- DATOS DE LA EMPRESA -->
      <div class="th-footer">
        <div class="th-bold">Pte. Perón 5349/5305/5265 · Rosario</div>
        <div>WhatsApp: 341 264-8035</div>
        <div>Horario: Lunes a Sábados de 8:00 a 17:00 hs</div>
        <div class="th-thanks">¡Muchas gracias por su compra!</div>
      </div>

      <!-- FEED FINAL PARA CORTE MANUAL -->
      <div class="th-feed"></div>
    </div>
  `;
}

/**
 * Genera el HTML formateado para comprobantes en Hoja A4 o Media Hoja A5 de Dulce Valentín.
 */
export function generateSheetSaleTicketHtml({
  format = 'a4', // 'a4' | 'a5'
  order,
  cajaName = 'Caja 01',
  cashier = '',
  paymentMethod = '',
  cashGiven = null,
  changeDue = null,
  isPreventa = false,
  sectionName = ''
}) {
  if (!order) return '';

  const items = Array.isArray(order.items) ? order.items : [];
  const createdDate = order.created_at ? new Date(order.created_at) : new Date();
  const dateStr = createdDate.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = createdDate.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const payMethod = paymentMethod || order.payment_method || 'efectivo';
  const payLabel = payMethod === 'efectivo'
    ? 'Efectivo'
    : payMethod === 'transferencia'
    ? 'Transferencia (Alias / MP)'
    : payMethod === 'tarjeta'
    ? 'Tarjeta (Débito/Crédito)'
    : payMethod;

  const totalAmount = Number(order.total_amount) || 0;
  const discountApplied = Number(order.discount_applied) || 0;
  const subtotal = discountApplied > 0 ? totalAmount + discountApplied : totalAmount;

  let orderBarcodeSvgMarkup = '';
  if (typeof document !== 'undefined' && order.id) {
    try {
      const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svgNode, String(order.id), {
        format: 'CODE128',
        displayValue: true,
        fontSize: 10,
        height: 28,
        margin: 1,
        width: 1.4
      });
      orderBarcodeSvgMarkup = new XMLSerializer().serializeToString(svgNode);
    } catch (_) {}
  }

  const isA5 = format === 'a5';
  const docTitle = isPreventa
    ? 'TICKET DE PREVENTA'
    : 'COMPROBANTE DE VENTA';

  return `
    <div class="sheet-container">
      <!-- HEADER CON LOGO, TITULO Y AGRADECIMIENTO -->
      <div class="sheet-header">
        <div class="sheet-logo-group">
          <img class="sheet-logo-img" src="/logo.png" alt="Dulce Valentín" onerror="this.style.display='none'" />
          <div>
            <div class="sheet-company-title">DULCE VALENTÍN</div>
            <div class="sheet-company-sub">INDUMENTARIA MAYORISTA & MINORISTA</div>
            <div class="sheet-thanks-badge">¡Gracias por elegirnos!</div>
            <div style="font-size: ${isA5 ? '8.5px' : '9.5px'}; color: #444; margin-top: 2px;">
              Pte. Perón 5349/5305/5265 · Rosario · WhatsApp: 341 264-8035
            </div>
          </div>
        </div>

        <div class="sheet-meta-card">
          <div class="sheet-meta-title">${docTitle}</div>
          <div class="sheet-meta-num">#${order.id || 'LOCAL'}</div>
          <div style="font-size: ${isA5 ? '8.5px' : '9.5px'}; color: #333;">Fecha: ${dateStr} ${timeStr}</div>
          ${sectionName ? `<div style="font-size: ${isA5 ? '8px' : '9px'}; font-weight: 800; color: #000; margin-top: 2px;">${sectionName}</div>` : ''}
          ${orderBarcodeSvgMarkup ? `<div style="margin-top: 4px;">${orderBarcodeSvgMarkup}</div>` : ''}
        </div>
      </div>

      <!-- FRANJA DE DATOS DEL CLIENTE Y OPERACIÓN -->
      <div class="sheet-info-strip">
        <div>
          <div><strong>Cliente:</strong> ${esc(order.client_name || 'Consumidor Final')}</div>
          ${order.client_dni ? `<div><strong>DNI / CUIT:</strong> ${esc(order.client_dni)}</div>` : ''}
          ${order.client_phone ? `<div><strong>Teléfono:</strong> ${esc(order.client_phone)}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div><strong>Terminal:</strong> ${esc([cajaName, cashier].filter(Boolean).join(' • ') || 'Caja Principal')}</div>
          <div><strong>Medio de Pago:</strong> ${isPreventa ? 'A abonar en Caja' : payLabel}</div>
          ${isPreventa ? `<div style="color: #b45309; font-weight: 800;">Presentar en Caja Principal</div>` : ''}
        </div>
      </div>

      <!-- TABLA DETALLADA DE PRENDAS -->
      <table class="sheet-table">
        <thead>
          <tr>
            <th style="width: 25px; text-align: center;">#</th>
            <th style="width: 75px;">CÓDIGO</th>
            <th>DETALLE DE LA PRENDA</th>
            <th style="width: 65px; text-align: center;">TALLE</th>
            <th style="width: 80px; text-align: center;">COLOR</th>
            <th style="width: 45px; text-align: center;">CANT</th>
            <th style="width: 75px; text-align: right;">P. UNIT</th>
            <th style="width: 85px; text-align: right;">SUBTOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => {
            const qty = it.quantity || 1;
            const unit = lineUnitPrice(it);
            const itemTotal = unit * qty;
            const name = esc(it.product?.name || it.name || 'Prenda');
            const code = esc(it.product?.code || it.code || '-');
            const size = esc(it.size || it.product?.selectedSize || it.selectedSize || 'Único');
            const color = esc(it.color || it.product?.selectedColor || it.selectedColor || 'Surtido');

            return `
              <tr>
                <td style="text-align: center; color: #666;">${idx + 1}</td>
                <td style="font-weight: 700;">${code}</td>
                <td style="font-weight: 800;">${name}</td>
                <td style="text-align: center; font-weight: 700;">${size}</td>
                <td style="text-align: center;">${color}</td>
                <td style="text-align: center; font-weight: 800;">${qty}</td>
                <td style="text-align: right;">$${unit.toLocaleString('es-AR')}</td>
                <td style="text-align: right; font-weight: 800;">$${itemTotal.toLocaleString('es-AR')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- TOTALES Y POLÍTICA DE CAMBIO -->
      <div class="sheet-totals-section">
        <!-- POLÍTICA DE CAMBIO REQUERIDA -->
        <div class="sheet-policy-box">
          <div style="font-weight: 900; margin-bottom: 2px; text-transform: uppercase;">Política de Cambios:</div>
          <div>Para cambios presentarse con este ticket de <strong>lunes a jueves de 8:00 a 17:00 hs</strong> (dentro de los 15 días con la prenda en perfecto estado y etiqueta puesta).</div>
          <div style="margin-top: 4px; color: #555;">Horario de atención: Lunes a Sábados de 8:00 a 17:00 hs.</div>
        </div>

        <!-- TOTALES -->
        <div class="sheet-totals-box">
          ${discountApplied > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>Subtotal:</span>
              <span>$${subtotal.toLocaleString('es-AR')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #b91c1c;">
              <span>Descuento aplicado:</span>
              <span>-$${discountApplied.toLocaleString('es-AR')}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: ${isA5 ? '13px' : '15px'}; font-weight: 900; border-top: 1.5px solid #000; padding-top: 4px; margin-top: 2px;">
            <span>TOTAL:</span>
            <span>$${totalAmount.toLocaleString('es-AR')}</span>
          </div>

          ${cashGiven ? `
            <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 4px; border-top: 1px dashed #ccc; padding-top: 4px;">
              <span>Abona con:</span>
              <span>$${Number(cashGiven).toLocaleString('es-AR')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800;">
              <span>Su vuelto:</span>
              <span>$${Number(changeDue || 0).toLocaleString('es-AR')}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- FOOTER -->
      <div class="sheet-footer">
        <div>Dulce Valentín · Casa Central Rosario · Pte. Perón 5349/5305/5265 · WhatsApp: 341 264-8035</div>
        <div style="font-weight: 800; margin-top: 2px;">¡Muchas gracias por su compra!</div>
      </div>
    </div>
  `;
}

/**
 * Función universal de impresión de comprobantes de venta / preventa.
 * Permite imprimir en:
 * - 'thermal': Rollo térmico de 58mm o 80mm
 * - 'a5': Media Hoja A5 (ideal para 10 a 25 prendas, ahorro de papel)
 * - 'a4': Hoja A4 completa (mayoristas grandes de 20 a 60 prendas)
 */
export function printSaleDocument({
  format = 'thermal',
  order,
  cajaName = 'Caja 01',
  cashier = '',
  paymentMethod = '',
  cashGiven = null,
  changeDue = null,
  isPreventa = false,
  sectionName = ''
}) {
  if (!order) return;

  if (format === 'a4') {
    const html = generateSheetSaleTicketHtml({
      format: 'a4',
      order,
      cajaName,
      cashier,
      paymentMethod,
      cashGiven,
      changeDue,
      isPreventa,
      sectionName
    });
    printIsolatedContent({
      html,
      styles: SHEET_A4_STYLES,
      title: `Venta_A4_${order.id || 'doc'}`,
      pageSize: 'A4 portrait',
      pageMargin: '8mm'
    });
  } else if (format === 'a5') {
    const html = generateSheetSaleTicketHtml({
      format: 'a5',
      order,
      cajaName,
      cashier,
      paymentMethod,
      cashGiven,
      changeDue,
      isPreventa,
      sectionName
    });
    printIsolatedContent({
      html,
      styles: SHEET_A5_STYLES,
      title: `Venta_A5_${order.id || 'doc'}`,
      pageSize: 'A5 portrait',
      pageMargin: '5mm'
    });
  } else {
    const html = generateThermalSaleTicketHtml({
      order,
      cajaName,
      cashier,
      paymentMethod,
      cashGiven,
      changeDue,
      isPreventa,
      sectionName
    });
    printIsolatedContent({
      html,
      styles: THERMAL_58MM_STYLES,
      title: `Ticket_${order.id || 'venta'}`,
      pageSize: null,
      pageMargin: '0mm'
    });
  }
}

/**
 * Genera el HTML formateado para un Cierre de Caja / Arqueo (Ticket Z) en 58mm.
 */
export function generateThermalZTicketHtml(summary) {
  if (!summary) return '';

  const openedAt = summary.opened_at
    ? new Date(summary.opened_at).toLocaleString('es-AR')
    : '-';
  const closedAt = summary.closed_at
    ? new Date(summary.closed_at).toLocaleString('es-AR')
    : new Date().toLocaleString('es-AR');

  const diff = Number(summary.difference || 0);
  const diffLabel = diff === 0
    ? 'CAJA EXACTA ($0)'
    : diff > 0
    ? `SOBRANTE (+$${diff.toLocaleString('es-AR')})`
    : `FALTANTE (-$${Math.abs(diff).toLocaleString('es-AR')})`;

  return `
    <div class="thermal-ticket">
      <div class="th-header">
        <div class="th-brand">DULCE VALENTÍN</div>
        <div class="th-sub">CONTROL DE CAJA</div>
        <div class="th-doc-type">CIERRE DE TURNO (TICKET Z)</div>
      </div>

      <div class="th-divider"></div>

      <div class="th-meta">
        <div class="th-row-between">
          <span class="th-bold">Terminal:</span>
          <span class="th-bold">${summary.register_name || summary.register_id || 'Caja 01'}</span>
        </div>
        <div class="th-row-between">
          <span>Cajera:</span>
          <span>${esc(summary.cashier_name || 'Cajera')} (${esc(summary.cashier_code || '')})</span>
        </div>
        <div class="th-row-between">
          <span>Apertura:</span>
          <span>${openedAt}</span>
        </div>
        <div class="th-row-between">
          <span>Cierre:</span>
          <span>${closedAt}</span>
        </div>
      </div>

      <div class="th-divider"></div>

      <div class="th-section-title">MOVIMIENTOS DE EFECTIVO</div>
      <div class="th-items-summary">
        <div class="th-row-between">
          <span>Fondo Inicial:</span>
          <span>$${(Number(summary.initial_cash) || 0).toLocaleString('es-AR')}</span>
        </div>
        <div class="th-row-between">
          <span>+ Ventas Efectivo:</span>
          <span>+$${(Number(summary.sales_cash) || 0).toLocaleString('es-AR')}</span>
        </div>
        ${Number(summary.cash_in_total) > 0 ? `
          <div class="th-row-between">
            <span>+ Ingresos Extra:</span>
            <span>+$${(Number(summary.cash_in_total)).toLocaleString('es-AR')}</span>
          </div>
        ` : ''}
        ${Number(summary.withdrawals_total) > 0 ? `
          <div class="th-row-between">
            <span>- Gastos / Retiros:</span>
            <span>-$${(Number(summary.withdrawals_total)).toLocaleString('es-AR')}</span>
          </div>
        ` : ''}
      </div>

      <div class="th-divider-thin"></div>

      <div class="th-totals">
        <div class="th-row-between th-bold" style="font-size: 11.5px;">
          <span>EFECTIVO ESPERADO:</span>
          <span>$${(Number(summary.expected_cash) || 0).toLocaleString('es-AR')}</span>
        </div>
        <div class="th-row-between th-bold" style="font-size: 12.5px;">
          <span>EFECTIVO REAL EN CAJÓN:</span>
          <span>$${(Number(summary.counted_cash) || 0).toLocaleString('es-AR')}</span>
        </div>
        <div class="th-row-between th-bold" style="font-size: 11.5px; margin-top: 2px;">
          <span>BALANCE:</span>
          <span>${diffLabel}</span>
        </div>
      </div>

      <div class="th-divider"></div>

      <div class="th-section-title">VENTAS TOTALES POR MEDIO</div>
      <div class="th-items-summary">
        <div class="th-row-between">
          <span>Efectivo:</span>
          <span>$${(Number(summary.sales_cash) || 0).toLocaleString('es-AR')}</span>
        </div>
        <div class="th-row-between">
          <span>Transferencia:</span>
          <span>$${(Number(summary.sales_transfer) || 0).toLocaleString('es-AR')}</span>
        </div>
        <div class="th-row-between">
          <span>Tarjeta:</span>
          <span>$${(Number(summary.sales_card) || 0).toLocaleString('es-AR')}</span>
        </div>
        <div class="th-row-between th-bold" style="border-top: 1px solid #000; padding-top: 3px; margin-top: 3px;">
          <span>TOTAL FACTURADO:</span>
          <span>$${(Number(summary.sales_total) || 0).toLocaleString('es-AR')}</span>
        </div>
        <div class="th-row-between" style="font-size: 10px; margin-top: 2px;">
          <span>Operaciones cobradas:</span>
          <span>${summary.sales_count || 0}</span>
        </div>
      </div>

      ${summary.closing_notes ? `
        <div class="th-divider-thin"></div>
        <div style="font-size: 10px; margin-top: 4px;">
          <span class="th-bold">Nota de cierre:</span> ${esc(summary.closing_notes)}
        </div>
      ` : ''}

      <div class="th-divider"></div>
      <div class="th-footer">
        <div class="th-bold">Dulce Valentín - Control de Caja</div>
        <div style="font-size: 9.5px; margin-top: 2px;">Documento interno de arqueo</div>
      </div>

      <div class="th-feed"></div>
    </div>
  `;
}

/**
 * Dispara la impresión del comprobante de venta o preventa.
 * Acepta format: 'thermal' | 'a5' | 'a4'. Si no se especifica, usa 'thermal'.
 */
export function printThermalSaleTicket(data) {
  const payload = data.order ? data : { order: data };
  printSaleDocument({
    format: data.format || 'thermal',
    ...payload
  });
}

/**
 * Dispara la impresión del Cierre Z en la impresora térmica de 58mm.
 */
export function printThermalZTicket(summary) {
  const html = generateThermalZTicketHtml(summary);
  printThermalTicket({
    html,
    title: `Ticket_Z_${summary?.register_id || 'cierre'}`
  });
}

