'use client';

import { useState } from 'react';
import { Save, Percent, TrendingUp, RefreshCw, Tag, Star, Sparkles } from 'lucide-react';

export default function PricesTab({
  products,
  allProductsCount,
  searchFilter,
  setSearchFilter,
  onUpdatePrice,
  onUpdatePricePercentage,
  onToggleOffer,
  onToggleNew,
  onSetFeatured,
  onUnsetFeatured
}) {
  // Mass percentage state
  const [bulkPct, setBulkPct] = useState('');
  const [bulkTarget, setBulkTarget] = useState('both'); // 'both', 'list', 'wholesale'
  const [bulkScope, setBulkScope] = useState('filtered'); // 'filtered', 'all'
  const [showConfirm, setShowConfirm] = useState(false);

  // Individual percentage state per product id: { [productId]: number | string }
  const [individualPcts, setIndividualPcts] = useState({});
  const [savedIds, setSavedIds] = useState({});

  const handleApplyBulk = () => {
    const pct = parseFloat(bulkPct);
    if (isNaN(pct) || pct === 0) return;

    const targetIds = bulkScope === 'filtered' && searchFilter 
      ? products.map(p => p.id) 
      : null;

    const applyToList = bulkTarget === 'both' || bulkTarget === 'list';
    const applyToWholesale = bulkTarget === 'both' || bulkTarget === 'wholesale';

    onUpdatePricePercentage(targetIds, pct, applyToList, applyToWholesale);
    setBulkPct('');
    setShowConfirm(false);
  };

  const handleIndividualPctChange = (productId, val) => {
    setIndividualPcts(prev => ({ ...prev, [productId]: val }));
    
    // Auto-calculate new price values in the inputs
    const pct = parseFloat(val);
    const prod = products.find(p => p.id === productId);
    if (prod && !isNaN(pct)) {
      const factor = 1 + (pct / 100);
      const listInput = document.getElementById(`price-${productId}`);
      const wholesaleInput = document.getElementById(`wprice-${productId}`);
      if (listInput) listInput.value = Math.round(prod.price * factor);
      if (wholesaleInput) wholesaleInput.value = Math.round(prod.wholesale_price * factor);
    }
  };

  const handleQuickRowPct = (productId, pct) => {
    handleIndividualPctChange(productId, pct);
  };

  return (
    <div>
      {/* Top Header & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main, #1E293B)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={22} style={{ color: '#2563EB' }} /> Gestión y Aumento de Precios
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Actualiza los valores de tus productos de forma individual o aplica aumentos porcentuales masivos.
          </p>
        </div>
        <input 
          type="text" 
          placeholder="Buscar producto o categoría..." 
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="form-input"
          style={{ maxWidth: '320px', fontSize: '0.9rem' }}
        />
      </div>

      {/* Card: Aumento Masivo por Porcentaje */}
      <div style={{
        backgroundColor: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '18px 20px', 
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Percent size={18} style={{ color: '#2563EB', fontWeight: 'bold' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Aumento Masivo por Porcentaje
          </h3>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          {/* Porcentaje Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Porcentaje (%)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                type="number"
                step="0.5"
                placeholder="Ej: 5 u 10"
                value={bulkPct}
                onChange={(e) => setBulkPct(e.target.value)}
                className="form-input"
                style={{ width: '110px', fontWeight: 700, fontSize: '0.95rem', padding: '7px 10px' }}
              />
              <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>%</span>
            </div>
          </div>

          {/* Presets rápido */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Ajuste rápido</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[5, 10, 15, 20, 25].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setBulkPct(val.toString())}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: bulkPct === val.toString() ? '1px solid #2563EB' : '1px solid var(--border-color)',
                    backgroundColor: bulkPct === val.toString() ? '#EFF6FF' : 'var(--bg-card)',
                    color: bulkPct === val.toString() ? '#1D4ED8' : 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  +{val}%
                </button>
              ))}
            </div>
          </div>

          {/* Destino de Precios */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Aplicar en</label>
            <select
              value={bulkTarget}
              onChange={(e) => setBulkTarget(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.85rem', padding: '7px 10px', fontWeight: 600 }}
            >
              <option value="both">Ambos (Lista y Mayorista)</option>
              <option value="list">Solo Precio Lista</option>
              <option value="wholesale">Solo Precio Mayorista</option>
            </select>
          </div>

          {/* Alcance (Filtro o Todos) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Alcance</label>
            <select
              value={bulkScope}
              onChange={(e) => setBulkScope(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.85rem', padding: '7px 10px', fontWeight: 600 }}
            >
              <option value="filtered">
                {searchFilter ? `Productos filtrados (${products.length})` : `Todos los productos (${products.length})`}
              </option>
              <option value="all">Todos los productos en catálogo ({allProductsCount || products.length})</option>
            </select>
          </div>

          {/* Botón Aplicar */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 'auto' }}>
            {!showConfirm ? (
              <button
                type="button"
                disabled={!bulkPct || isNaN(parseFloat(bulkPct)) || parseFloat(bulkPct) === 0}
                onClick={() => setShowConfirm(true)}
                className="btn-primary"
                style={{
                  padding: '8px 18px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  opacity: (!bulkPct || isNaN(parseFloat(bulkPct)) || parseFloat(bulkPct) === 0) ? 0.5 : 1,
                  cursor: (!bulkPct || isNaN(parseFloat(bulkPct)) || parseFloat(bulkPct) === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                Aplicar Aumento %
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#B91C1C' }}>
                  ¿Aumentar {bulkPct}%?
                </span>
                <button
                  type="button"
                  onClick={handleApplyBulk}
                  style={{
                    backgroundColor: '#16A34A',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Sí, confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-main)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de Productos */}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Prenda</th>
            <th>Precio de Lista ($)</th>
            <th>Precio Mayorista ($)</th>
            <th>Calculadora de Aumento %</th>
            <th>Oferta / Nuevo</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const currentPct = individualPcts[p.id] || '';

            return (
              <tr key={p.id}>
                <td style={{ fontWeight: 700, minWidth: '180px' }}>
                  <div>{p.name}</div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {p.category} {p.subcategory ? `• ${p.subcategory}` : ''}
                  </span>
                </td>
                
                {/* Precio Lista */}
                <td>
                  <input 
                    type="number" 
                    key={`price-${p.id}-${p.price}`}
                    defaultValue={p.price} 
                    id={`price-${p.id}`}
                    className="form-input" 
                    style={{ width: '110px', padding: '6px 10px' }} 
                  />
                </td>

                {/* Precio Mayorista */}
                <td>
                  <input 
                    type="number" 
                    key={`wprice-${p.id}-${p.wholesale_price}`}
                    defaultValue={p.wholesale_price} 
                    id={`wprice-${p.id}`}
                    className="form-input" 
                    style={{ width: '110px', padding: '6px 10px', fontWeight: 700 }} 
                  />
                </td>

                {/* Ajuste Porcentual Individual */}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Ej: 5"
                        value={currentPct}
                        onChange={(e) => handleIndividualPctChange(p.id, e.target.value)}
                        className="form-input"
                        style={{ width: '70px', padding: '4px 6px', fontSize: '0.82rem', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>%</span>
                    </div>

                    <div style={{ display: 'flex', gap: '3px' }}>
                      {[5, 10, 15].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleQuickRowPct(p.id, val.toString())}
                          style={{
                            padding: '3px 6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: currentPct === val.toString() ? '#EFF6FF' : 'var(--bg-surface-elevated)',
                            color: currentPct === val.toString() ? '#1D4ED8' : 'var(--text-muted)',
                            cursor: 'pointer'
                          }}
                        >
                          +{val}%
                        </button>
                      ))}
                    </div>

                    {currentPct !== '' && (
                      <button
                        type="button"
                        title="Restablecer a precios actuales"
                        onClick={() => {
                          handleIndividualPctChange(p.id, '');
                          const listInput = document.getElementById(`price-${p.id}`);
                          const wholesaleInput = document.getElementById(`wprice-${p.id}`);
                          if (listInput) listInput.value = p.price;
                          if (wholesaleInput) wholesaleInput.value = p.wholesale_price;
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <RefreshCw size={13} />
                      </button>
                    )}
                  </div>
                </td>

                {/* Oferta / Destacada */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => onToggleOffer(p.id, !p.is_offer)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 8px', fontSize: '0.74rem', fontWeight: 700,
                        borderRadius: '6px',
                        border: p.is_offer ? '1px solid #EA580C' : '1px solid var(--border-color)',
                        backgroundColor: p.is_offer ? '#FFF7ED' : 'var(--bg-card)',
                        color: p.is_offer ? '#C2410C' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      <Tag size={12} /> {p.is_offer ? 'En oferta' : 'Marcar oferta'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleNew(p.id, !p.is_new)}
                      title="Aparece primero en su categoría con un sello de Nuevo"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 8px', fontSize: '0.74rem', fontWeight: 700,
                        borderRadius: '6px',
                        border: p.is_new ? '1px solid #2563EB' : '1px solid var(--border-color)',
                        backgroundColor: p.is_new ? '#EFF6FF' : 'var(--bg-card)',
                        color: p.is_new ? '#1D4ED8' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      <Sparkles size={12} /> {p.is_new ? '🆕 Nuevo Ingreso' : 'Marcar Nuevo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => (p.is_featured ? onUnsetFeatured(p.id) : onSetFeatured(p.id))}
                      title="Solo puede haber una oferta destacada a la vez"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 8px', fontSize: '0.74rem', fontWeight: 700,
                        borderRadius: '6px',
                        border: p.is_featured ? '1px solid #B45309' : '1px solid var(--border-color)',
                        backgroundColor: p.is_featured ? '#FEF3C7' : 'var(--bg-card)',
                        color: p.is_featured ? '#92400E' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      <Star size={12} fill={p.is_featured ? '#92400E' : 'none'} /> {p.is_featured ? 'Destacada ★' : 'Destacar'}
                    </button>
                  </div>
                </td>

                {/* Acciones */}
                <td>
                  <button 
                    onClick={() => {
                      const priceInput = document.getElementById(`price-${p.id}`);
                      const wpriceInput = document.getElementById(`wprice-${p.id}`);
                      const priceVal = priceInput ? priceInput.value : p.price;
                      const wpriceVal = wpriceInput ? wpriceInput.value : p.wholesale_price;
                      
                      onUpdatePrice(p.id, priceVal, wpriceVal);
                      setIndividualPcts(prev => ({ ...prev, [p.id]: '' }));
                      
                      setSavedIds(prev => ({ ...prev, [p.id]: true }));
                      setTimeout(() => {
                        setSavedIds(prev => ({ ...prev, [p.id]: false }));
                      }, 2500);
                    }}
                    className="btn-primary"
                    style={{ 
                      padding: '6px 14px', 
                      fontSize: '0.8rem', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      backgroundColor: savedIds[p.id] ? '#059669' : undefined,
                      borderColor: savedIds[p.id] ? '#059669' : undefined
                    }}
                  >
                    {savedIds[p.id] ? (
                      <>✓ ¡Guardado!</>
                    ) : (
                      <><Save size={14} /> Guardar</>
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
