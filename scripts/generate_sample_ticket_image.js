const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const logoBase64 = fs.readFileSync('public/logo.png').toString('base64');
const jsBarcodeCode = fs.readFileSync('node_modules/jsbarcode/dist/JsBarcode.all.min.js', 'utf8');

const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Ticket Preview - Dulce Valentín</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: #e2e8f0;
      padding: 30px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }
    .ticket-wrapper {
      position: relative;
      background: #ffffff;
      width: 380px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.08);
      border-radius: 4px;
      padding: 24px 20px 28px 20px;
      color: #000000;
    }
    /* Zigzag paper tear top and bottom */
    .tear-top {
      position: absolute;
      top: -6px;
      left: 0;
      right: 0;
      height: 6px;
      background: radial-gradient(circle, transparent, transparent 50%, #ffffff 50%, #ffffff 100%);
      background-size: 12px 12px;
    }
    .tear-bottom {
      position: absolute;
      bottom: -6px;
      left: 0;
      right: 0;
      height: 6px;
      background: radial-gradient(circle, transparent, transparent 50%, #ffffff 50%, #ffffff 100%);
      background-size: 12px 12px;
      transform: rotate(180deg);
    }
    .th-header {
      text-align: center;
      margin-bottom: 12px;
    }
    .th-logo {
      max-width: 130px;
      max-height: 55px;
      object-fit: contain;
      margin: 0 auto 6px auto;
      display: block;
      filter: grayscale(100%) contrast(140%);
    }
    .th-brand {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: 0.5px;
      line-height: 1.1;
      margin-bottom: 2px;
    }
    .th-sub {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.6px;
      color: #222;
      margin-bottom: 4px;
    }
    .th-thanks-top {
      display: inline-block;
      font-size: 12px;
      font-weight: 900;
      background: #000;
      color: #fff;
      padding: 2px 10px;
      border-radius: 4px;
      margin: 4px 0 6px 0;
      letter-spacing: 0.3px;
    }
    .th-doc-type {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .th-section-badge {
      font-size: 11px;
      font-weight: 800;
      color: #111;
      margin-top: 2px;
    }
    .th-section-hint {
      font-size: 10px;
      font-weight: 700;
      color: #444;
      margin-top: 2px;
    }
    .th-divider {
      border-bottom: 2px solid #000000;
      margin: 10px 0;
    }
    .th-divider-thin {
      border-bottom: 1px solid #000000;
      margin: 8px 0;
    }
    .th-divider-dashed {
      border-bottom: 1px dashed #666;
      margin: 8px 0;
    }
    .th-row-between {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 6px;
      font-size: 12px;
      margin-bottom: 3px;
    }
    .th-bold {
      font-weight: 800;
    }
    .th-barcode-wrap {
      text-align: center;
      margin: 8px 0 6px 0;
    }
    .th-barcode-wrap svg {
      max-width: 260px;
      max-height: 48px;
      display: block;
      margin: 0 auto;
    }
    .th-items-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.3px;
      padding-bottom: 2px;
    }
    .th-item {
      margin-bottom: 8px;
    }
    .th-item-title {
      font-size: 13px;
      font-weight: 800;
      line-height: 1.25;
    }
    .th-item-sub {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      margin-top: 2px;
    }
    .th-item-calc {
      font-size: 11px;
      color: #444;
      font-weight: 600;
    }
    .th-item-price {
      font-size: 13px;
      font-weight: 900;
    }
    .th-grand-total {
      font-size: 17px;
      font-weight: 900;
      margin-top: 4px;
    }
    .th-policy {
      text-align: center;
      font-size: 10.5px;
      font-weight: 700;
      line-height: 1.35;
      margin: 10px 0;
      border: 1.5px dashed #000;
      padding: 8px 10px;
      border-radius: 4px;
    }
    .th-policy-title {
      font-size: 11px;
      font-weight: 900;
      margin-bottom: 3px;
      letter-spacing: 0.3px;
    }
    .th-footer {
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.4;
      margin-top: 8px;
    }
    .th-thanks {
      font-size: 13px;
      font-weight: 900;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="ticket-wrapper">
    <div class="tear-top"></div>

    <!-- ENCABEZADO CON LOGO Y AGRADECIMIENTO -->
    <div class="th-header">
      <img class="th-logo" src="data:image/png;base64,${logoBase64}" alt="Dulce Valentín" />
      <div class="th-brand">DULCE VALENTÍN</div>
      <div class="th-sub">INDUMENTARIA & CALZADO</div>
      <div>
        <span class="th-thanks-top">¡Gracias por elegirnos!</span>
      </div>
      <div class="th-doc-type">TICKET DE PREVENTA</div>
      <div class="th-section-badge">SECCIÓN JEANS & INFANTIL (PISO ARRIBA)</div>
      <div class="th-section-hint">(Presentar en Caja Principal para abonar o agregar prendas)</div>
    </div>

    <div class="th-divider"></div>

    <!-- METADATOS -->
    <div class="th-meta">
      <div class="th-row-between">
        <span class="th-bold">Preventa N°:</span>
        <span class="th-bold">#DV-PRE-0482</span>
      </div>
      <div class="th-row-between">
        <span>Fecha y hora:</span>
        <span>12/11/2026 18:35 hs</span>
      </div>
      <div class="th-row-between">
        <span>Terminal / Vendedora:</span>
        <span>Sección Jeans & Infantil • Romina</span>
      </div>
      <div class="th-row-between">
        <span>Cliente:</span>
        <span class="th-bold">Mariana Giménez</span>
      </div>
      <div class="th-row-between">
        <span>Estado:</span>
        <span class="th-bold" style="color: #b45309;">A abonar en Caja de Planta Baja</span>
      </div>
    </div>

    <!-- CÓDIGO DE BARRAS ESCANEABLE -->
    <div class="th-barcode-wrap">
      <svg id="barcode-svg"></svg>
    </div>

    <div class="th-divider"></div>

    <!-- CABECERA DE ÍTEMS -->
    <div class="th-items-header">
      <span>DETALLE DE PRENDAS</span>
      <span>TOTAL</span>
    </div>
    <div class="th-divider-thin"></div>

    <!-- LISTA DE PRENDAS -->
    <div class="th-items">
      <div class="th-item">
        <div class="th-item-title">2x Jean Wide Leg Rígido Celeste (Talle 38 · Celeste)</div>
        <div class="th-item-sub">
          <span class="th-item-calc">2 x $14.500</span>
          <span class="th-item-price">$29.000</span>
        </div>
      </div>

      <div class="th-item">
        <div class="th-item-title">1x Jean Mom Cargo Negro (Talle 40 · Negro)</div>
        <div class="th-item-sub">
          <span class="th-item-calc">1 x $15.800</span>
          <span class="th-item-price">$15.800</span>
        </div>
      </div>

      <div class="th-item">
        <div class="th-item-title">3x Remera Algodón Niña Estampada (Talle 8 · Rosa)</div>
        <div class="th-item-sub">
          <span class="th-item-calc">3 x $4.200</span>
          <span class="th-item-price">$12.600</span>
        </div>
      </div>

      <div class="th-item">
        <div class="th-item-title">2x Calza Corta Infantil Ciclista (Talle 6 · Negro)</div>
        <div class="th-item-sub">
          <span class="th-item-calc">2 x $3.500</span>
          <span class="th-item-price">$7.000</span>
        </div>
      </div>
    </div>

    <div class="th-divider"></div>

    <!-- TOTALES -->
    <div class="th-totals">
      <div class="th-row-between">
        <span>Subtotal (8 prendas):</span>
        <span class="th-bold">$64.400</span>
      </div>
      <div class="th-row-between" style="color: #b91c1c;">
        <span>Descuento Pack Mayorista:</span>
        <span class="th-bold">-$5.000</span>
      </div>
      <div class="th-divider-thin"></div>
      <div class="th-row-between th-grand-total">
        <span>TOTAL A ABONAR:</span>
        <span>$59.400</span>
      </div>
    </div>

    <div class="th-divider"></div>

    <!-- POLÍTICA DE CAMBIO REQUERIDA POR EL USUARIO -->
    <div class="th-policy">
      <div class="th-policy-title">POLÍTICA DE CAMBIOS</div>
      <div>Para cambios presentarse con este ticket de <strong>lunes a jueves de 8:00 a 17:00 hs</strong> (dentro de los 15 días con la prenda en perfecto estado y etiqueta puesta).</div>
    </div>

    <!-- DATOS DEL LOCAL -->
    <div class="th-footer">
      <div class="th-bold">Pte. Perón 5349/5305/5265 · Rosario</div>
      <div>WhatsApp: 341 264-8035</div>
      <div>Horario: Lunes a Sábados de 8:00 a 17:00 hs</div>
      <div class="th-thanks">¡Muchas gracias por su compra!</div>
    </div>

    <div class="tear-bottom"></div>
  </div>

  <script>
    ${jsBarcodeCode}
    JsBarcode("#barcode-svg", "DV-PRE-0482", {
      format: "CODE128",
      displayValue: true,
      fontSize: 12,
      height: 34,
      margin: 1,
      width: 1.5
    });
  </script>
</body>
</html>
`;

const tempHtmlPath = path.resolve('ticket_sample.html');
fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

const targetDir = 'C:\\Users\\jpbor\\.gemini\\antigravity\\brain\\0783c8d8-615d-46ce-a73e-574db76d5909';
const outputPngPath = path.join(targetDir, 'ticket_preview.png');

console.log('Rendering ticket screenshot with headless Chrome...');
const chromePath = 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe';
execSync(`"${chromePath}" --headless --disable-gpu --screenshot="${outputPngPath}" --window-size=480,1080 --default-background-color=00000000 "${tempHtmlPath}"`);

console.log('Ticket screenshot generated successfully at:', outputPngPath);
