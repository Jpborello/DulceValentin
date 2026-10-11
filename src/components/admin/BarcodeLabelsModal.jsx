'use client';

import { useMemo, useState } from 'react';
import { X, Barcode, Printer, Loader2 } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { supabase } from '@/lib/supabaseClient';
import { getProductColorsForSize, getProductStockForSizeColor } from '@/lib/catalogData';
import { getProductPrice } from '@/lib/productPricing';

// Formatos de etiqueta: etiquetadora termica (rollo) u hoja A4 comun.
const FORMATS = {
  thermal: { label: 'Etiquetadora 50 × 25 mm', page: '@page { size: 50mm 25mm; margin: 0; }', cols: 1, w: '50mm', h: '25mm' },
  a4: { label: 'Hoja A4 (3 × 8 etiquetas)', page: '@page { size: A4; margin: 8mm; }', cols: 3, w: '64mm', h: '33.9mm' }
};

const escapeHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Variantes del producto: cada talle x cada color de ese talle (o una sola
// fila si no tiene talles/colores).
function buildVariants(product) {
  const sizes = Array.isArray(product.sizes) && product.sizes.length > 0 ? product.sizes : [null];
  const rows = [];
  sizes.forEach((size) => {
    const colors = getProductColorsForSize(product, size);
    const list = colors && colors.length > 0 ? colors : [null];
    list.forEach((color) => {
      rows.push({
        key: `${size || ''}::${color || ''}`,
        size,
        color,
        stock: getProductStockForSizeColor(product, size, color)
      });
    });
  });
  return rows;
}

// Genera e imprime etiquetas con codigo de barras por prenda. Cada variante
// (talle + color) tiene su codigo EAN-13 propio (tabla product_barcodes,
// funcion ensure_product_barcode), que despues va a leer la caja.
export default function BarcodeLabelsModal({ product, onClose }) {
  const variants = useMemo(() => buildVariants(product), [product]);
  const [qty, setQty] = useState(() => Object.fromEntries(variants.map((v) => [v.key, Math.max(0, v.stock)])));
  const [format, setFormat] = useState('thermal');
  const [showPrice, setShowPrice] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');

  const totalLabels = variants.reduce((s, v) => s + (parseInt(qty[v.key], 10) || 0), 0);

  const handlePrint = async () => {
    if (totalLabels === 0 || isWorking) return;
    setError('');
    // Se abre la ventana ANTES de los await para que el navegador no la
    // bloquee como popup.
    const win = window.open('', '_blank');
    if (!win) {
      setError('El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes para este sitio.');
      return;
    }
    win.document.write('<p style="font-family:sans-serif;padding:20px">Generando etiquetas…</p>');
    setIsWorking(true);

    try {
      const labels = [];
      for (const v of variants) {
        const n = parseInt(qty[v.key], 10) || 0;
        if (n <= 0) continue;
        const { data: code, error: rpcError } = await supabase.rpc('ensure_product_barcode', {
          p_product_id: product.id,
          p_size: v.size,
          p_color: v.color
        });
        if (rpcError || !code) throw rpcError || new Error('sin código');

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        JsBarcode(svg, code, { format: 'EAN13', width: 1.6, height: 38, fontSize: 13, margin: 0, flat: true });
        const svgMarkup = new XMLSerializer().serializeToString(svg);
        const price = getProductPrice(product, v.size);
        for (let i = 0; i < n; i++) labels.push({ v, svgMarkup, price });
      }

      const f = FORMATS[format];
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${escapeHtml(product.name)}</title>
<style>
${f.page}
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
.grid { display: grid; grid-template-columns: repeat(${f.cols}, ${f.w}); }
.label { width: ${f.w}; height: ${f.h}; padding: 1.2mm 2mm; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; ${format === 'a4' ? 'border: 0.2mm dashed #bbb;' : 'page-break-after: always;'} }
.top { display: flex; justify-content: space-between; gap: 2mm; font-size: 7pt; line-height: 1.15; }
.name { font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta { font-size: 6.5pt; }
.price { font-weight: bold; font-size: 9pt; white-space: nowrap; }
.bc svg { width: 100%; height: auto; max-height: 13mm; display: block; }
</style></head><body><div class="grid">
${labels.map(({ v, svgMarkup, price }) => `<div class="label">
  <div class="top">
    <div style="min-width:0">
      <div class="name">${escapeHtml(product.name)}</div>
      <div class="meta">${product.code ? `Art. ${escapeHtml(product.code)}` : ''}${v.size ? ` · T. ${escapeHtml(v.size)}` : ''}${v.color ? ` · ${escapeHtml(v.color)}` : ''}</div>
    </div>
    ${showPrice ? `<div class="price">$${Number(price || 0).toLocaleString('es-AR')}</div>` : ''}
  </div>
  <div class="bc">${svgMarkup}</div>
</div>`).join('')}
</div><script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };<\/script></body></html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      console.warn('Etiquetas:', err);
      win.close();
      setError('No se pudieron generar los códigos. Revisá la conexión o volvé a iniciar sesión.');
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
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <Barcode size={20} /> Etiquetas con código de barras
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          {product.name}{product.code ? ` (Cód: ${product.code})` : ''}. Cada talle/color tiene su propio código. Por defecto se imprime una etiqueta por prenda en stock.
        </p>

        <div style={{ overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '14px' }}>
          {variants.map((v) => (
            <div key={v.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>
                {[v.size ? `Talle ${v.size}` : null, v.color].filter(Boolean).join(' · ') || 'Talle único'}
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
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 600 }}>
            <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Mostrar precio
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
