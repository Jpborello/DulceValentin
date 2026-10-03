'use client';

import { useState, Fragment } from 'react';
import { Save, Percent, TrendingUp, RefreshCw, Tag, Star, Sparkles, Ruler, ChevronDown, ChevronUp, X, PackageOpen, Flame, Plus, Edit2, Trash2, Search } from 'lucide-react';

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
  onUnsetFeatured,
  onUpdatePricePerSize,
  onToggleExemptMin3,
  allProducts = [],
  onSetHeroBadge,
  onRemoveHeroBadge
}) {
  // Mass percentage state
  const [bulkPct, setBulkPct] = useState('');
  const [bulkTarget, setBulkTarget] = useState('both'); // 'both', 'list', 'wholesale'
  const [bulkScope, setBulkScope] = useState('filtered'); // 'filtered', 'all'
  const [showConfirm, setShowConfirm] = useState(false);

  // Hero Carousel & Promo Badges state
  const [isHeroModalOpen, setIsHeroModalOpen] = useState(false);
  const [heroSelectedProduct, setHeroSelectedProduct] = useState(null);
  const [heroBadgeType, setHeroBadgeType] = useState('3x2'); // '3x2', 'new', 'pct', 'liq', 'custom'
  const [heroDiscountPct, setHeroDiscountPct] = useState('20');
  const [heroCustomText, setHeroCustomText] = useState('');
  const [heroProductSearch, setHeroProductSearch] = useState('');

  // Individual percentage state per product id: { [productId]: number | string }
  const [individualPcts, setIndividualPcts] = useState({});
  const [savedIds, setSavedIds] = useState({});

  // Precio por talle: que productos tienen el panel abierto, y los valores
  // que se estan editando en sus inputs (por talle) antes de guardar.
  const [expandedPPS, setExpandedPPS] = useState({});
  const [ppsValues, setPpsValues] = useState({});
  const [savedPPSIds, setSavedPPSIds] = useState({});

  const toggleExpandPPS = (product) => {
    setExpandedPPS((prev) => ({ ...prev, [product.id]: !prev[product.id] }));
    setPpsValues((prev) => {
      if (prev[product.id]) return prev;
      const initial = {};
      (product.sizes || []).forEach((size) => {
        initial[size] = product.price_per_size?.[size] ?? product.wholesale_price ?? product.price ?? '';
      });
      return { ...prev, [product.id]: initial };
    });
  };

  const handlePPSValueChange = (productId, size, value) => {
    setPpsValues((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [size]: value }
    }));
  };

  const handleSavePPS = (product) => {
    const values = ppsValues[product.id] || {};
    const pricePerSize = {};
    (product.sizes || []).forEach((size) => {
      const num = parseFloat(values[size]);
      pricePerSize[size] = Number.isNaN(num) ? (product.wholesale_price || product.price || 0) : num;
    });
    onUpdatePricePerSize(product.id, pricePerSize);
    setSavedPPSIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => setSavedPPSIds((prev) => ({ ...prev, [product.id]: false })), 2500);
  };

  const handleClearPPS = (product) => {
    onUpdatePricePerSize(product.id, null);
    setPpsValues((prev) => {
      const next = { ...prev };
      delete next[product.id];
      return next;
    });
  };

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

  const getFinalBadgeText = () => {
    if (heroBadgeType === '3x2') return 'Promoción 3 x 2';
    if (heroBadgeType === 'new') return 'Nuevo ingreso';
    if (heroBadgeType === 'pct') {
      const val = parseInt(heroDiscountPct, 10);
      return `${isNaN(val) ? 20 : val}% OFF`;
    }
    if (heroBadgeType === 'liq') return 'Liquidación';
    if (heroBadgeType === 'custom') return heroCustomText.trim() || 'Promoción';
    return 'Promoción 3 x 2';
  };

  const handleOpenHeroModal = (product = null) => {
    setHeroSelectedProduct(product);
    setHeroProductSearch('');
    if (product) {
      const current = product.badge_text || (product.is_offer ? 'Liquidación' : product.is_new ? 'Nuevo ingreso' : '');
      if (current === 'Promoción 3 x 2' || current.includes('3 x 2') || current.includes('3x2')) {
        setHeroBadgeType('3x2');
      } else if (current === 'Nuevo ingreso') {
        setHeroBadgeType('new');
      } else if (current === 'Liquidación') {
        setHeroBadgeType('liq');
      } else if (current.includes('% OFF') || current.includes('% off') || current.includes('%')) {
        setHeroBadgeType('pct');
        const match = current.match(/(\d+)/);
        if (match) setHeroDiscountPct(match[1]);
      } else if (current) {
        setHeroBadgeType('custom');
        setHeroCustomText(current);
      } else {
        setHeroBadgeType('3x2');
      }
    } else {
      setHeroBadgeType('3x2');
      setHeroDiscountPct('20');
      setHeroCustomText('');
    }
    setIsHeroModalOpen(true);
  };

  const handleSaveHeroBadge = async () => {
    if (!heroSelectedProduct || !onSetHeroBadge) return;
    const badge = getFinalBadgeText();
    await onSetHeroBadge(heroSelectedProduct.id, badge);
    setIsHeroModalOpen(false);
    setHeroSelectedProduct(null);
  };

  const handleRemoveBadge = async (productId) => {
    if (!onRemoveHeroBadge) return;
    await onRemoveHeroBadge(productId);
    if (heroSelectedProduct?.id === productId) {
      setIsHeroModalOpen(false);
      setHeroSelectedProduct(null);
    }
  };

  const productSource = allProducts && allProducts.length > 0 ? allProducts : products;
  const heroBadgeProducts = productSource.filter((p) => p.badge_text);

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

      {/* Card: Gestión del Carrusel de Liquidaciones y Nuevos Ingresos */}
      <div style={{
        backgroundColor: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '18px 20px', 
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              backgroundColor: '#FFF1F2', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Flame size={20} color="#E11D48" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Liquidaciones, Promociones y Nuevos Ingresos (Carrusel del Home)
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Configurá los artículos que aparecen en la marquesina superior del Home con sus etiquetas (3 x 2, % OFF, etc.)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenHeroModal(null)}
            className="btn-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', fontSize: '0.82rem', fontWeight: 700,
              backgroundColor: '#E11D48', borderColor: '#E11D48'
            }}
          >
            <Plus size={16} /> Agregar producto al carrusel
          </button>
        </div>

        {heroBadgeProducts.length === 0 ? (
          <div style={{
            padding: '16px', borderRadius: '8px',
            border: '1px dashed var(--border-color)',
            textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem'
          }}>
            Actualmente no hay productos con etiqueta en el carrusel.
            Hacé clic en <strong>"+ Agregar producto al carrusel"</strong> o asigná etiquetas desde el botón "🏷️ Etiqueta Carrusel" en la tabla inferior.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '12px'
          }}>
            {heroBadgeProducts.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)'
                }}
              >
                <img
                  src={p.image_url || '/logo.png'}
                  alt=""
                  style={{ width: '46px', height: '46px', borderRadius: '8px', objectFit: 'cover' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {p.code ? `#${p.code} · ` : ''}{p.category}
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </div>
                  <div style={{ display: 'inline-block', marginTop: '2px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      backgroundColor: p.badge_text === 'Nuevo ingreso' ? '#2563EB' : '#E11D48',
                      color: '#FFF'
                    }}>
                      {p.badge_text}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenHeroModal(p)}
                    title="Modificar etiqueta"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '4px', borderRadius: '4px', color: '#2563EB'
                    }}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveBadge(p.id)}
                    title="Quitar del carrusel"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '4px', borderRadius: '4px', color: '#DC2626'
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
              <Fragment key={p.id}>
              <tr>
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
                  {Array.isArray(p.sizes) && p.sizes.length > 0 && onUpdatePricePerSize && (
                    <button
                      type="button"
                      onClick={() => toggleExpandPPS(p)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '3px',
                        marginTop: '5px', background: 'none', border: 'none',
                        padding: 0, cursor: 'pointer',
                        fontSize: '0.72rem', fontWeight: 700,
                        color: p.price_per_size ? '#B45309' : '#2563EB'
                      }}
                      title="Poner un precio distinto segun el talle (ej: talle especial mas caro)"
                    >
                      <Ruler size={11} />
                      {p.price_per_size ? 'Precio por talle ✓' : 'Precio por talle'}
                      {expandedPPS[p.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
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
                    {onSetHeroBadge && (
                      <button
                        type="button"
                        onClick={() => handleOpenHeroModal(p)}
                        title="Asignar o editar etiqueta del carrusel del home (3 x 2, % OFF, etc)"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '4px 8px', fontSize: '0.74rem', fontWeight: 700,
                          borderRadius: '6px',
                          border: p.badge_text ? '1px solid #E11D48' : '1px solid var(--border-color)',
                          backgroundColor: p.badge_text ? '#FFF1F2' : 'var(--bg-card)',
                          color: p.badge_text ? '#BE123C' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        <Tag size={12} /> {p.badge_text ? `🏷️ ${p.badge_text}` : 'Etiqueta Carrusel'}
                      </button>
                    )}
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
                    {onToggleExemptMin3 && (
                      <button
                        type="button"
                        onClick={() => onToggleExemptMin3(p.id, !p.exempt_from_min3)}
                        title="Productos vendidos en pack (ej. medias, '3 x $') no exigen ni cuentan para el minimo de 3 unidades de un mismo articulo que pide la dueña para acceder al precio mayorista"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '4px 8px', fontSize: '0.74rem', fontWeight: 700,
                          borderRadius: '6px',
                          border: p.exempt_from_min3 ? '1px solid #7C3AED' : '1px solid var(--border-color)',
                          backgroundColor: p.exempt_from_min3 ? '#F5F3FF' : 'var(--bg-card)',
                          color: p.exempt_from_min3 ? '#6D28D9' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        <PackageOpen size={12} /> {p.exempt_from_min3 ? 'Sin mínimo de 3 ✓' : 'Exceptuar del mínimo x3'}
                      </button>
                    )}
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

              {expandedPPS[p.id] && (
                <tr>
                  <td colSpan={6} style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      <Ruler size={14} style={{ color: '#B45309' }} />
                      <strong style={{ fontSize: '0.85rem' }}>Precio por talle — {p.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        (reemplaza el precio mayorista de arriba para el talle que corresponda)
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
                      {(p.sizes || []).map((size) => (
                        <div key={size} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            Talle {size}
                          </label>
                          <input
                            type="number"
                            value={ppsValues[p.id]?.[size] ?? ''}
                            onChange={(e) => handlePPSValueChange(p.id, size, e.target.value)}
                            className="form-input"
                            style={{ width: '100px', padding: '6px 8px' }}
                          />
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleSavePPS(p)}
                        className="btn-primary"
                        style={{
                          padding: '7px 14px', fontSize: '0.82rem', fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          backgroundColor: savedPPSIds[p.id] ? '#059669' : undefined,
                          borderColor: savedPPSIds[p.id] ? '#059669' : undefined
                        }}
                      >
                        {savedPPSIds[p.id] ? <>✓ ¡Guardado!</> : <><Save size={13} /> Guardar precios por talle</>}
                      </button>

                      {p.price_per_size && (
                        <button
                          type="button"
                          onClick={() => handleClearPPS(p)}
                          title="Volver a un precio unico para todos los talles"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '7px 12px', fontSize: '0.8rem', fontWeight: 700,
                            borderRadius: '8px', border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)', color: '#B91C1C', cursor: 'pointer'
                          }}
                        >
                          <X size={13} /> Quitar precio por talle
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Modal: Configurar Etiqueta de Carrusel / Promoción */}
      {isHeroModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-main)',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  🏷️ Etiqueta para Carrusel del Home
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Asigná la promoción o etiqueta que verá el cliente en la marquesina superior.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHeroModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Paso 1: Elegir Producto si no está preseleccionado */}
            {!heroSelectedProduct ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Seleccioná el producto a agregar:
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Escribí nombre o código del producto..."
                    value={heroProductSearch}
                    onChange={(e) => setHeroProductSearch(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '34px', width: '100%' }}
                    autoFocus
                  />
                </div>

                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {productSource
                    .filter((p) => {
                      if (!heroProductSearch.trim()) return true;
                      const q = heroProductSearch.toLowerCase();
                      return (
                        (p.name || '').toLowerCase().includes(q) ||
                        (p.code || '').toLowerCase().includes(q) ||
                        (p.category || '').toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 30)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setHeroSelectedProduct(p)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <img
                          src={p.image_url || '/logo.png'}
                          alt=""
                          style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.code ? `[#${p.code}] ` : ''}{p.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {p.category} · Mayorista: ${Number(p.wholesale_price || 0).toLocaleString('es-AR')}
                          </div>
                        </div>
                        {p.badge_text && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FFF1F2', color: '#BE123C', fontWeight: 700 }}>
                            {p.badge_text}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              /* Producto seleccionado */
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-color)'
              }}>
                <img
                  src={heroSelectedProduct.image_url || '/logo.png'}
                  alt=""
                  style={{ width: '54px', height: '54px', borderRadius: '8px', objectFit: 'cover' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {heroSelectedProduct.code ? `#${heroSelectedProduct.code} · ` : ''}{heroSelectedProduct.category}
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800 }}>
                    {heroSelectedProduct.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#16A34A', fontWeight: 700 }}>
                    Precio Mayorista: ${Number(heroSelectedProduct.wholesale_price || 0).toLocaleString('es-AR')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHeroSelectedProduct(null)}
                  style={{
                    background: 'none', border: '1px solid var(--border-color)',
                    borderRadius: '6px', padding: '4px 8px', fontSize: '0.74rem',
                    color: 'var(--text-muted)', cursor: 'pointer'
                  }}
                >
                  Cambiar
                </button>
              </div>
            )}

            {/* Paso 2: Elegir Etiqueta */}
            {heroSelectedProduct && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Elegí la etiqueta a mostrar:
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {/* Opción 1: Promoción 3 x 2 */}
                  <button
                    type="button"
                    onClick={() => setHeroBadgeType('3x2')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: heroBadgeType === '3x2' ? '2px solid #E11D48' : '1px solid var(--border-color)',
                      backgroundColor: heroBadgeType === '3x2' ? '#FFF1F2' : 'var(--bg-surface-elevated)',
                      color: heroBadgeType === '3x2' ? '#BE123C' : 'var(--text-main)',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    🎉 Promoción 3 x 2
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', marginTop: '2px' }}>
                      Llevan 3, pagan 2
                    </div>
                  </button>

                  {/* Opción 2: Nuevo ingreso */}
                  <button
                    type="button"
                    onClick={() => setHeroBadgeType('new')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: heroBadgeType === 'new' ? '2px solid #2563EB' : '1px solid var(--border-color)',
                      backgroundColor: heroBadgeType === 'new' ? '#EFF6FF' : 'var(--bg-surface-elevated)',
                      color: heroBadgeType === 'new' ? '#1D4ED8' : 'var(--text-main)',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    🆕 Nuevo ingreso
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', marginTop: '2px' }}>
                      Lo último llegado
                    </div>
                  </button>

                  {/* Opción 3: X% OFF */}
                  <button
                    type="button"
                    onClick={() => setHeroBadgeType('pct')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: heroBadgeType === 'pct' ? '2px solid #E11D48' : '1px solid var(--border-color)',
                      backgroundColor: heroBadgeType === 'pct' ? '#FFF1F2' : 'var(--bg-surface-elevated)',
                      color: heroBadgeType === 'pct' ? '#BE123C' : 'var(--text-main)',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    🏷️ Descuento % OFF
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', marginTop: '2px' }}>
                      Vos definís el %
                    </div>
                  </button>

                  {/* Opción 4: Liquidación */}
                  <button
                    type="button"
                    onClick={() => setHeroBadgeType('liq')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: heroBadgeType === 'liq' ? '2px solid #EA580C' : '1px solid var(--border-color)',
                      backgroundColor: heroBadgeType === 'liq' ? '#FFF7ED' : 'var(--bg-surface-elevated)',
                      color: heroBadgeType === 'liq' ? '#C2410C' : 'var(--text-main)',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    🔥 Liquidación
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', marginTop: '2px' }}>
                      Precio de remate
                    </div>
                  </button>
                </div>

                {/* Sub-formulario para % OFF */}
                {heroBadgeType === 'pct' && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      ¿Qué porcentaje de descuento querés mostrar?
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={heroDiscountPct}
                        onChange={(e) => setHeroDiscountPct(e.target.value)}
                        placeholder="Ej: 20"
                        className="form-input"
                        style={{ width: '100px', fontWeight: 800, fontSize: '1rem', textAlign: 'center' }}
                      />
                      <span style={{ fontWeight: 800, fontSize: '1rem' }}>% OFF</span>
                    </div>
                    {/* Botones rápidos de % */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {[10, 15, 20, 25, 30, 35, 40, 50].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setHeroDiscountPct(n.toString())}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: heroDiscountPct === n.toString() ? '#E11D48' : 'var(--bg-card)',
                            color: heroDiscountPct === n.toString() ? '#FFF' : 'var(--text-main)',
                            cursor: 'pointer'
                          }}
                        >
                          {n}% OFF
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-formulario para Personalizada */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setHeroBadgeType('custom')}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: heroBadgeType === 'custom' ? '#E11D48' : 'var(--text-muted)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    O escribir una etiqueta personalizada...
                  </button>
                  {heroBadgeType === 'custom' && (
                    <input
                      type="text"
                      placeholder="Ej: Pack x3, Combo Especial, etc."
                      value={heroCustomText}
                      onChange={(e) => setHeroCustomText(e.target.value)}
                      className="form-input"
                      style={{ marginTop: '4px' }}
                    />
                  )}
                </div>

                {/* Vista previa de cómo quedará la etiqueta */}
                <div style={{
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Vista previa de la etiqueta:
                  </span>
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    background: heroBadgeType === 'new' ? '#FFFFFF' : 'linear-gradient(135deg, #DC2626 0%, #E11D48 100%)',
                    color: heroBadgeType === 'new' ? '#3A1F2E' : '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}>
                    {getFinalBadgeText()}
                  </span>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              {heroSelectedProduct?.badge_text ? (
                <button
                  type="button"
                  onClick={() => handleRemoveBadge(heroSelectedProduct.id)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #DC2626',
                    color: '#DC2626',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Quitar del carrusel
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsHeroModalOpen(false)}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                {heroSelectedProduct && (
                  <button
                    type="button"
                    onClick={handleSaveHeroBadge}
                    className="btn-primary"
                    style={{
                      padding: '8px 18px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      backgroundColor: '#E11D48',
                      borderColor: '#E11D48'
                    }}
                  >
                    Guardar en el Carrusel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
