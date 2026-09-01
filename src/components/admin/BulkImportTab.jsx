'use client';

import { useState } from 'react';
import { UploadCloud, Download, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Image as ImageIcon } from 'lucide-react';

export default function BulkImportTab({ onBulkImport }) {
  const [csvText, setCsvText] = useState('');
  const [parsedProducts, setParsedProducts] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Template CSV Generator & Downloader
  const handleDownloadTemplate = () => {
    const templateContent = 
`Nombre,Categoria,Subcategoria,PrecioMinorista,Stock,Descripcion,UrlImagen
Campera Frizada Argentina AFA,Camperas,Deportivas,35000,85,Campera oficial frizada con escudo bordado,/elpaquetero_imagenes/Camperas/campera de Afa.jpg
Buzo The North Face Classic,Buzos,Urbano,22000,45,Buzo frizado canguro con capucha,/elpaquetero_imagenes/Buzos/buzo the north Face.jpg
Gorra Gabardina Curva,Gorras,Accesorios,7500,130,Gorra curva de algodon gabardina,/elpaquetero_imagenes/Gorras.jpg
Pantalon Jogging Frizado,Pantalon de Yoguin,Pantalones,16800,90,Pantalón babucha de jogging frizado,/logo.png`;

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_productos_dulcevalentin.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to parse CSV or Tab-Separated Values (TSV)
  const parseCSVContent = (content) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!content || !content.trim()) {
      setParsedProducts([]);
      return;
    }

    const lines = content.trim().split(/\r?\n/);
    if (lines.length === 0) return;

    // Detect delimiter: comma (,) or tab (\t) or semicolon (;)
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

    const rawHeaders = firstLine.split(delimiter).map(h => h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    
    const hasHeader = rawHeaders.some(h => 
      h.includes('nombre') || h.includes('precio') || h.includes('categoria') || h.includes('stock')
    );

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const results = [];

    dataLines.forEach((line, index) => {
      if (!line.trim()) return;
      
      // Basic CSV splitter respecting quotes
      const cols = line.split(new RegExp(`${delimiter}(?=(?:(?:[^"]*"){2})*[^"]*$)`)).map(c => c.replace(/^"|"$/g, '').trim());

      let name = '', category = '', subcategory = '', price = 0, stock = 0, description = '', imageUrl = '';

      if (hasHeader) {
        rawHeaders.forEach((header, colIdx) => {
          const val = cols[colIdx] || '';
          if (header.includes('nombre') || header.includes('product') || header.includes('title')) name = val;
          else if (header.includes('subcategoria') || header.includes('subcategory')) subcategory = val;
          else if (header.includes('categoria') || header.includes('category')) category = val;
          else if (header.includes('precio') || header.includes('price')) price = parseFloat(val) || 0;
          else if (header.includes('stock') || header.includes('cantidad')) stock = parseInt(val, 10) || 0;
          else if (header.includes('descripcion') || header.includes('description')) description = val;
          else if (header.includes('imagen') || header.includes('image') || header.includes('foto') || header.includes('url')) imageUrl = val;
        });
      } else {
        // Fallback positional assignment
        name = cols[0] || `Producto ${index + 1}`;
        category = cols[1] || 'General';
        subcategory = cols[2] || '';
        price = parseFloat(cols[3]) || 0;
        stock = parseInt(cols[4], 10) || 0;
        description = cols[5] || '';
        imageUrl = cols[6] || '';
      }

      if (name) {
        results.push({
          name,
          category: category || 'General',
          subcategory: subcategory || '',
          price,
          wholesale_price: price,
          stock: isNaN(stock) ? 50 : stock,
          description: description || '',
          image_url: imageUrl || '/logo.png'
        });
      }
    });

    if (results.length === 0) {
      setErrorMsg('No se pudieron reconocer productos válidos en el texto o archivo ingresado.');
    } else {
      setParsedProducts(results);
    }
  };

  // Handle File Upload (.csv, .tsv, .txt)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setCsvText(text);
      parseCSVContent(text);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setCsvText(val);
    parseCSVContent(val);
  };

  const handleExecuteImport = () => {
    if (parsedProducts.length === 0) return;
    setIsProcessing(true);

    try {
      const importedCount = onBulkImport(parsedProducts);
      setSuccessMsg(`🎉 ¡Se importaron exitosamente ${importedCount || parsedProducts.length} productos a la tienda!`);
      setParsedProducts([]);
      setCsvText('');
    } catch (err) {
      setErrorMsg('Ocurrió un error durante la importación: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSpreadsheet size={24} style={{ color: '#2563EB' }} /> Carga Masiva de Productos (CSV / Excel)
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Sube tus archivos CSV de Excel o copia y pega tus listas de artículos para cargar cientos de productos con sus imágenes y categorías de una sola vez.
        </p>
      </div>

      {/* Action Banner: Download Template */}
      <div style={{
        backgroundColor: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#2563EB', color: '#FFF', padding: '10px', borderRadius: '10px', display: 'flex' }}>
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1E40AF' }}>
              ¿Primera vez? Descargá la Plantilla CSV de Ejemplo
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#3B82F6', margin: 0 }}>
              Descargá el modelo oficial, completalo en Excel o Google Sheets y subilo a continuación.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="btn-primary"
          style={{
            backgroundColor: '#1D4ED8',
            padding: '9px 18px',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Download size={16} /> Descargar Plantilla CSV
        </button>
      </div>

      {/* Input Options Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        
        {/* Subir Archivo */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UploadCloud size={18} style={{ color: '#2563EB' }} /> Opción A: Subir Archivo CSV o TXT
          </h3>

          <div style={{
            border: '2px dashed var(--border-color)',
            borderRadius: '10px',
            padding: '24px 16px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface-elevated)',
            cursor: 'pointer'
          }}>
            <UploadCloud size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
              Seleccioná un archivo desde tu equipo (.csv, .txt, .tsv)
            </p>
            <input 
              type="file" 
              accept=".csv, .tsv, .txt"
              onChange={handleFileUpload}
              id="csv-file-input"
              style={{ display: 'none' }}
            />
            <label
              htmlFor="csv-file-input"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'inline-block'
              }}
            >
              Buscar Archivo
            </label>
          </div>
        </div>

        {/* Pegar Texto Directo */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileSpreadsheet size={18} style={{ color: '#16A34A' }} /> Opción B: Pegar datos copiados de Excel
          </h3>
          
          <textarea
            placeholder="Pegá aquí las columnas copiadas directamente desde Excel o un bloc de notas..."
            value={csvText}
            onChange={handleTextChange}
            rows={5}
            className="form-input"
            style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'monospace' }}
          />
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{ backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7', padding: '14px 18px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={20} /> {successMsg}
        </div>
      )}

      {/* Preview Section */}
      {parsedProducts.length > 0 && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={18} style={{ color: '#EAB308' }} /> Previsualización ({parsedProducts.length} productos detectados)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                El precio que cargues en la columna "precio" se guarda directo como precio mayorista (no se aplica ningún descuento automático).
              </p>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleExecuteImport}
              className="btn-primary"
              style={{
                backgroundColor: '#16A34A',
                padding: '10px 22px',
                fontSize: '0.9rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isProcessing ? 0.7 : 1
              }}
            >
              {isProcessing ? <RefreshCw size={16} className="spin" /> : <UploadCloud size={18} />}
              Importar {parsedProducts.length} Productos a la Tienda
            </button>
          </div>

          {/* Preview Table */}
          <div style={{ overflowX: 'auto', maxHeight: '420px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table className="admin-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Imagen</th>
                  <th>Nombre del Producto</th>
                  <th>Categoría</th>
                  <th>Subcategoría</th>
                  <th>Precio Mayorista ($)</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {parsedProducts.slice(0, 50).map((p, idx) => (
                  <tr key={idx}>
                    <td>
                      <img 
                        src={p.image_url} 
                        alt={p.name} 
                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                        onError={(e) => { e.target.src = '/logo.png'; }}
                      />
                    </td>
                    <td style={{ fontWeight: 700 }}>{p.name}</td>
                    <td><span style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{p.category}</span></td>
                    <td>{p.subcategory || '-'}</td>
                    <td style={{ fontWeight: 700 }}>${p.price.toLocaleString('es-AR')}</td>
                    <td style={{ fontWeight: 800, color: '#059669' }}>${p.wholesale_price.toLocaleString('es-AR')}</td>
                    <td style={{ fontWeight: 700 }}>{p.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsedProducts.length > 50 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px' }}>
              Mostrando los primeros 50 artículos de {parsedProducts.length}. Todos se importarán al hacer clic en Importar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
