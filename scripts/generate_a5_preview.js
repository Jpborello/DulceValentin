const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const logoBase64 = fs.readFileSync('public/logo.png').toString('base64');
const jsBarcodeCode = fs.readFileSync('node_modules/jsbarcode/dist/JsBarcode.all.min.js', 'utf8');

const htmlA5 = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>A5 Preview - Dulce Valentín</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    body {
      background: #e2e8f0;
      padding: 30px 20px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }
    .sheet-wrapper {
      background: #ffffff;
      width: 580px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06);
      border-radius: 4px;
      padding: 24px;
      color: #000000;
    }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .sheet-logo-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sheet-logo-img {
      max-height: 52px;
      max-width: 120px;
      object-fit: contain;
    }
    .sheet-company-title {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .sheet-company-sub {
      font-size: 11px;
      font-weight: 700;
      color: #333;
    }
    .sheet-thanks-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      background: #000;
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      margin-top: 3px;
    }
    .sheet-meta-card {
      border: 1.5px solid #000;
      border-radius: 6px;
      padding: 6px 12px;
      text-align: right;
      min-width: 190px;
    }
    .sheet-meta-title {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .sheet-meta-num {
      font-size: 15px;
      font-weight: 900;
    }
    .sheet-info-strip {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
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
      background: #0f172a;
      color: #fff;
      font-weight: 800;
      padding: 6px 8px;
      font-size: 10px;
      text-transform: uppercase;
      border: 1px solid #0f172a;
    }
    .sheet-table td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
    }
    .sheet-table tr:nth-child(even) td {
      background: #f8fafc;
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
      border: 1.5px dashed #475569;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 10px;
      line-height: 1.4;
      background: #fff;
    }
    .sheet-totals-box {
      min-width: 220px;
      border: 1.5px solid #0f172a;
      border-radius: 6px;
      padding: 8px 12px;
      background: #f8fafc;
    }
    .sheet-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      text-align: center;
      font-size: 10px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="sheet-wrapper">
    <div class="sheet-header">
      <div class="sheet-logo-group">
        <img class="sheet-logo-img" src="data:image/png;base64,${logoBase64}" alt="Dulce Valentín" />
        <div>
          <div class="sheet-company-title">DULCE VALENTÍN</div>
          <div class="sheet-company-sub">INDUMENTARIA MAYORISTA & MINORISTA</div>
          <div><span class="sheet-thanks-badge">¡Gracias por elegirnos!</span></div>
          <div style="font-size: 9.5px; color: #475569; margin-top: 3px;">
            Pte. Perón 5349/5305/5265 · Rosario · WhatsApp: 341 264-8035
          </div>
        </div>
      </div>

      <div class="sheet-meta-card">
        <div class="sheet-meta-title">COMPROBANTE DE VENTA</div>
        <div class="sheet-meta-num">#DV-849102</div>
        <div style="font-size: 10px; color: #475569;">Fecha: 12/11/2026 18:35 hs</div>
        <div style="font-size: 9.5px; font-weight: 800; color: #0f172a; margin-top: 2px;">Caja 01 • Planta Baja</div>
        <div style="margin-top: 4px;"><svg id="barcode-a5"></svg></div>
      </div>
    </div>

    <div class="sheet-info-strip">
      <div>
        <div><strong>Cliente:</strong> Mariana Giménez</div>
        <div><strong>DNI / CUIT:</strong> 34.892.104</div>
        <div><strong>Teléfono:</strong> 341 555-8921</div>
      </div>
      <div style="text-align: right;">
        <div><strong>Vendedora:</strong> Romina (Sección Jeans & Infantil)</div>
        <div><strong>Medio de Pago:</strong> Efectivo</div>
        <div><strong>Formato:</strong> Media Hoja A5 (Ahorro de papel)</div>
      </div>
    </div>

    <table class="sheet-table">
      <thead>
        <tr>
          <th style="width: 25px; text-align: center;">#</th>
          <th style="width: 70px;">CÓDIGO</th>
          <th>DETALLE DE LA PRENDA</th>
          <th style="width: 60px; text-align: center;">TALLE</th>
          <th style="width: 75px; text-align: center;">COLOR</th>
          <th style="width: 45px; text-align: center;">CANT</th>
          <th style="width: 75px; text-align: right;">P. UNIT</th>
          <th style="width: 80px; text-align: right;">SUBTOTAL</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align: center; color: #64748b;">1</td>
          <td style="font-weight: 700;">0220</td>
          <td style="font-weight: 800;">Jean Wide Leg Rígido Celeste</td>
          <td style="text-align: center; font-weight: 700;">38</td>
          <td style="text-align: center;">Celeste</td>
          <td style="text-align: center; font-weight: 800;">2</td>
          <td style="text-align: right;">$14.500</td>
          <td style="text-align: right; font-weight: 800;">$29.000</td>
        </tr>
        <tr>
          <td style="text-align: center; color: #64748b;">2</td>
          <td style="font-weight: 700;">0184</td>
          <td style="font-weight: 800;">Jean Mom Cargo Negro</td>
          <td style="text-align: center; font-weight: 700;">40</td>
          <td style="text-align: center;">Negro</td>
          <td style="text-align: center; font-weight: 800;">1</td>
          <td style="text-align: right;">$15.800</td>
          <td style="text-align: right; font-weight: 800;">$15.800</td>
        </tr>
        <tr>
          <td style="text-align: center; color: #64748b;">3</td>
          <td style="font-weight: 700;">0092</td>
          <td style="font-weight: 800;">Remera Algodón Niña Estampada</td>
          <td style="text-align: center; font-weight: 700;">8</td>
          <td style="text-align: center;">Rosa</td>
          <td style="text-align: center; font-weight: 800;">3</td>
          <td style="text-align: right;">$4.200</td>
          <td style="text-align: right; font-weight: 800;">$12.600</td>
        </tr>
        <tr>
          <td style="text-align: center; color: #64748b;">4</td>
          <td style="font-weight: 700;">0115</td>
          <td style="font-weight: 800;">Calza Corta Infantil Ciclista</td>
          <td style="text-align: center; font-weight: 700;">6</td>
          <td style="text-align: center;">Negro</td>
          <td style="text-align: center; font-weight: 800;">2</td>
          <td style="text-align: right;">$3.500</td>
          <td style="text-align: right; font-weight: 800;">$7.000</td>
        </tr>
      </tbody>
    </table>

    <div class="sheet-totals-section">
      <div class="sheet-policy-box">
        <div style="font-weight: 900; margin-bottom: 2px; text-transform: uppercase;">Política de Cambios:</div>
        <div>Para cambios presentarse con este ticket de <strong>lunes a jueves de 8:00 a 17:00 hs</strong> (dentro de los 15 días con la prenda en perfecto estado y etiqueta puesta).</div>
        <div style="margin-top: 4px; color: #64748b;">Horario de atención: Lunes a Sábados de 8:00 a 17:00 hs.</div>
      </div>

      <div class="sheet-totals-box">
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px;">
          <span>Subtotal (8 prendas):</span>
          <span>$64.400</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #b91c1c; font-size: 11px;">
          <span>Descuento Pack Mayorista:</span>
          <span>-$5.000</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; border-top: 1.5px solid #0f172a; padding-top: 4px; margin-top: 2px;">
          <span>TOTAL:</span>
          <span>$59.400</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 4px;">
          <span>Abona con:</span>
          <span>$60.000</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #059669;">
          <span>Su vuelto:</span>
          <span>$600</span>
        </div>
      </div>
    </div>

    <div class="sheet-footer">
      <div>Dulce Valentín · Casa Central Rosario · Pte. Perón 5349/5305/5265 · WhatsApp: 341 264-8035</div>
      <div style="font-weight: 800; margin-top: 2px;">¡Muchas gracias por su compra!</div>
    </div>
  </div>

  <script>
    ${jsBarcodeCode}
    JsBarcode("#barcode-a5", "DV-849102", {
      format: "CODE128",
      displayValue: true,
      fontSize: 10,
      height: 24,
      margin: 1,
      width: 1.3
    });
  </script>
</body>
</html>
`;

const tempA5Html = path.resolve('ticket_a5_sample.html');
fs.writeFileSync(tempA5Html, htmlA5, 'utf8');

const targetDir = 'C:\\Users\\jpbor\\.gemini\\antigravity\\brain\\0783c8d8-615d-46ce-a73e-574db76d5909';
const outputA5Png = path.join(targetDir, 'ticket_a5_preview.png');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
execSync(`"${chromePath}" --headless --disable-gpu --screenshot="${outputA5Png}" --window-size=680,850 --default-background-color=00000000 "${tempA5Html}"`);

console.log('A5 preview screenshot generated at:', outputA5Png);

