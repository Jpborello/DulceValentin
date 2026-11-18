'use client';

import { useMemo, useState } from 'react';
import { X, Barcode, Printer, Loader2 } from 'lucide-react';
import { getProductVariants, ensureBarcodesForProduct } from '@/lib/barcode';
import { renderBarcodeSvg } from '@/lib/barcodeRender';
import { getUnitPriceForType } from '@/lib/productPricing';
import { printIsolatedContent } from '@/lib/printUtils';
import { adminFetch } from '@/lib/adminFetch';

// Formatos de etiqueta: etiquetadora termica (rollo) u hoja A4 comun.
const FORMATS = {
  thermal: { label: 'Etiquetadora Térmica Rollo (50 × 25 mm)', page: '@page { size: 50mm 25mm; margin: 0; }', cols: 1, w: '50mm', h: '25mm' },
  a4: { label: 'Plancha A4 Adhesiva (3 × 8 etiquetas)', page: '@page { size: A4; margin: 8mm; }', cols: 3, w: '64mm', h: '33.9mm' }
};

const escapeHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default function BarcodeLabelsModal({ product, onClose }) {
  const variants = useMemo(() => getProductVariants(product), [product]);
  const [qty, setQty] = useState(() => Object.fromEntries(variants.map((v) => [v.key, Math.max(0, v.stock)])));
  const [format, setFormat] = useState('thermal');
  const [showPrice, setShowPrice] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');

  const totalLabels = variants.reduce((s, v) => s + (parseInt(qty[v.key], 10) || 0), 0);

  const handlePrint = async () => {
    if (totalLabels === 0 || isWorking) return;
    setError('');
    setIsWorking(true);

    try {
      // Aseguramos que el producto tenga el mapa de barcodes
      const before = JSON.stringify(product.barcodes || {});
      const barcodesMap = ensureBarcodesForProduct(product);
      product.barcodes = barcodesMap;

      // Si se generaron codigos nuevos, se guardan ANTES de imprimir: una
      // etiqueta con un codigo que no esta en la base no se puede cobrar.
      // (adminFetch manda la sesion; con fetch pelado el servidor lo rechazaba
      // en silencio y los codigos nunca se guardaban.)
      if (JSON.stringify(barcodesMap) !== before) {
        const res = await adminFetch('/api/admin/pos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'saveProductBarcodes', productId: product.id, barcodes: barcodesMap })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'No se pudieron guardar los códigos de barra.');
        }
      }

      const labels = [];
      for (const v of variants) {
        const n = parseInt(qty[v.key], 10) || 0;
        if (n <= 0) continue;

        const code = barcodesMap[v.key];
        // Barras a ancho exacto (3 puntos de 203 dpi), sin estirar: ver barcodeRender.js
        // Barras un poco mas bajas (7 mm) para que entren los dos precios en la etiqueta.
        const svgMarkup = renderBarcodeSvg(code, { maxWidthMm: format === 'thermal' ? 46 : 60, barHeightMm: 7, fontMm: 2.4 });
        if (!svgMarkup) throw new Error(`No se pudo generar el código de barras de ${v.label}.`);
        const prices = {
          mayor: getUnitPriceForType(product, v.size, 'mayor'),
          menor: getUnitPriceForType(product, v.size, 'menor')
        };
        for (let i = 0; i < n; i++) labels.push({ v, svgMarkup, prices });
      }

      const f = FORMATS[format];
      const isThermal = format === 'thermal';

      const html = `
        <div class="labels-container">
          ${labels.map(({ v, svgMarkup, prices }) => `
            <div class="label-card">
              <div class="top-row">
                <div class="brand">DULCE VALENTÍN</div>
              </div>
              ${showPrice ? `
                <div class="prices-row">
                  <span><small>Mayor</small>$${Number(prices.mayor || 0).toLocaleString('es-AR')}</span>
                  <span><small>Menor</small>$${Number(prices.menor || 0).toLocaleString('es-AR')}</span>
                </div>` : ''}
              <div class="prod-name">${escapeHtml(product.name)}</div>
              <div class="meta-row">
                ${product.code ? `Art. ${escapeHtml(product.code)} · ` : ''}${v.label}
              </div>
              <div class="barcode-box">${svgMarkup}</div>
            </div>
          `).join('')}
        </div>
      `;

      const styles = `
        ${f.page}
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #fff; color: #000; }
        .labels-container {
          ${isThermal ? 'width: 50mm; margin: 0;' : 'display: grid; grid-template-columns: repeat(3, 64mm); gap: 2mm 3mm;'}
        }
        .label-card {
          width: ${f.w};
          height: ${f.h};
          box-sizing: border-box;
          padding: 1.2mm 2mm;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          page-break-inside: avoid;
          ${isThermal ? 'page-break-after: always;' : 'border: 0.2mm dashed #bbb;'}
        }
        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 0.5px solid #000;
          padding-bottom: 0.4mm;
        }
        .brand { font-size: 6.5pt; font-weight: 900; letter-spacing: 0.3px; }
        /* Compacta y pegada a la izquierda: la impresora no llega al borde derecho
           de la etiqueta y antes el precio por menor quedaba cortado. */
        .prices-row { display: flex; justify-content: flex-start; gap: 2mm; font-size: 7.5pt; font-weight: 900; margin-top: 0.4mm; white-space: nowrap; }
        .prices-row small { font-size: 5pt; font-weight: 700; margin-right: 0.5mm; }
        .prod-name { font-size: 7pt; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.3mm; }
        .meta-row { font-size: 6.8pt; font-weight: 700; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .barcode-box { display: flex; justify-content: center; margin-top: 0.3mm; }
        /* tamaño real en mm desde el SVG: NO escalar (las barras tienen que caer en puntos enteros) */
        .barcode-box svg { display: block; flex: none; }
      `;

      // Imprimir mediante iframe aislado sin bloqueador de popups
      printIsolatedContent({
        html,
        styles,
        title: `Etiquetas_${product.code || product.name}`
      });

      if (onClose) onClose();
    } catch (err) {
      console.warn('Error imprimiendo etiquetas:', err);
      setError(err?.message ? `No se imprimió: ${err.message}` : 'No se pudieron generar las etiquetas. Verificá los datos.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="qty-btn" style={{ position: 'absolute', top: '14px', right: '14px' }}>
          <X size={18} />
        </button>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <Barcode size={20} /> Etiquetas con código de barras
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          {product.name}{product.code ? ` (Cód: ${product.code})` : ''}. Cada variante de talle y color tiene su propio código.
        </p>

        <div style={{ overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '14px' }}>
          {variants.map((v) => (
            <div key={v.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>
                {v.label}
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}> — stock {v.stock}</span>
              </div>
              <input
                type="number"
                min="0"
                value={qty[v.key] ?? 0}
                onChange={(e) => setQty((prev) => ({ ...prev, [v.key]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                className="form-input"
                style={{ width: '70px', padding: '4px 6px', textAlign: 'center', fontWeight: 800 }}
                aria-label="Cantidad de etiquetas"
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="form-input" style={{ flex: '1 1 200px' }}>
            {Object.entries(FORMATS).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}
          </select>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Mostrar precios (mayor y menor)
          </label>
        </div>

        {error && (
          <div role="alert" style={{ fontSize: '0.82rem', color: '#B91C1C', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handlePrint}
          disabled={totalLabels === 0 || isWorking}
          className="btn-primary"
          style={{ justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px', opacity: totalLabels === 0 || isWorking ? 0.6 : 1 }}
        >
          {isWorking ? <Loader2 size={17} className="animate-spin" /> : <Printer size={17} />}
          {isWorking ? 'Generando...' : `Imprimir ${totalLabels} etiqueta${totalLabels === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
