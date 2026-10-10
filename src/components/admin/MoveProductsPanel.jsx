'use client';

import { useMemo, useState } from 'react';
import { ArrowRightLeft, Search, CheckSquare, Square, Loader2 } from 'lucide-react';
import { dataStore } from '@/lib/dataStore';

const norm = (str) => String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Cambiar de categoria/subcategoria uno o varios productos a la vez. Usa
// dataStore.updateProduct (UPDATE directo con la sesion del admin), asi que
// el cambio queda en la base y se ve al toque en la tienda.
export default function MoveProductsPanel({ products = [], categories = [] }) {
  const [search, setSearch] = useState('');
  const [fromCategory, setFromCategory] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [targetCategory, setTargetCategory] = useState('');
  const [targetSubcategory, setTargetSubcategory] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [result, setResult] = useState(null); // { ok, failed }

  const targetOptions = categories.filter((c) => c.id !== 'all');
  const targetCat = targetOptions.find((c) => (c.name || c.id) === targetCategory);
  const subOptions = targetCat?.subcategories || [];

  // Categorias que tienen hoy los productos (incluye las "sueltas" que no
  // estan en la lista oficial, para poder encontrarlas y moverlas).
  const currentCategories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category || '(sin categoría)'))).sort(),
    [products]
  );

  const filtered = useMemo(() => {
    const q = norm(search);
    return products.filter((p) => {
      if (fromCategory && (p.category || '(sin categoría)') !== fromCategory) return false;
      if (!q) return true;
      return norm(p.name).includes(q) || norm(p.code).includes(q) || norm(p.subcategory).includes(q);
    });
  }, [products, search, fromCategory]);

  const visible = filtered.slice(0, 200);
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selectedIds.has(p.id));

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((p) => next.delete(p.id));
      else visible.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const handleMove = async () => {
    if (!targetCategory || selectedIds.size === 0 || isMoving) return;
    setIsMoving(true);
    setResult(null);
    let ok = 0;
    const failed = [];
    for (const id of selectedIds) {
      const res = await dataStore.updateProduct(id, {
        category: targetCategory,
        subcategory: targetSubcategory || null
      });
      if (res?.ok) ok += 1;
      else failed.push(products.find((p) => p.id === id)?.name || id);
    }
    setIsMoving(false);
    setResult({ ok, failed });
    if (failed.length === 0) setSelectedIds(new Set());
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '32px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div style={{ backgroundColor: '#F5F3FF', padding: '8px', borderRadius: '8px', color: '#7C3AED', display: 'flex' }}>
          <ArrowRightLeft size={18} />
        </div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
          Mover productos de categoría
        </h3>
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
        Buscá, tildá uno o varios productos y elegí a qué categoría y subcategoría pasan.
      </p>

      {/* Filtros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="form-input"
            style={{ width: '100%', paddingLeft: '32px', fontSize: '0.88rem' }}
          />
        </div>
        <select
          value={fromCategory}
          onChange={(e) => setFromCategory(e.target.value)}
          className="form-input"
          style={{ width: '100%', fontSize: '0.88rem' }}
        >
          <option value="">Todas las categorías actuales</option>
          {currentCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
        <button
          type="button"
          onClick={toggleAllVisible}
          disabled={visible.length === 0}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
            background: 'var(--bg-surface-elevated)', border: 'none', borderBottom: '1px solid var(--border-color)',
            fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left'
          }}
        >
          {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          {allVisibleSelected ? 'Destildar' : 'Tildar'} los {visible.length} que se ven
          {filtered.length > visible.length && ` (de ${filtered.length}; afiná la búsqueda para ver el resto)`}
          <span style={{ marginLeft: 'auto', color: '#7C3AED' }}>{selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}</span>
        </button>
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {visible.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No hay productos con ese filtro.
            </div>
          ) : visible.map((p) => {
            const checked = selectedIds.has(p.id);
            return (
              <label
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: checked ? 'rgba(124, 58, 237, 0.07)' : 'transparent'
                }}
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} />
                <img
                  src={p.thumb_url || p.image_url || '/logo.png'}
                  alt=""
                  style={{ width: '34px', height: '34px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                  onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.code ? `#${p.code} · ` : ''}{p.name}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {p.category || '(sin categoría)'}{p.subcategory ? ` › ${p.subcategory}` : ''}
                    {p.is_active === false ? ' · inactivo' : ''}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Destino */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
            Nueva categoría *
          </label>
          <select
            value={targetCategory}
            onChange={(e) => { setTargetCategory(e.target.value); setTargetSubcategory(''); }}
            className="form-input"
            style={{ width: '100%', fontSize: '0.88rem' }}
          >
            <option value="">Elegí una categoría</option>
            {targetOptions.map((c) => (
              <option key={c.id} value={c.name || c.id}>{c.name || c.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
            Subcategoría
          </label>
          <select
            value={targetSubcategory}
            onChange={(e) => setTargetSubcategory(e.target.value)}
            className="form-input"
            style={{ width: '100%', fontSize: '0.88rem' }}
            disabled={!targetCategory || subOptions.length === 0}
          >
            <option value="">{subOptions.length === 0 ? 'Sin subcategorías' : 'Sin subcategoría'}</option>
            {subOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleMove}
          disabled={!targetCategory || selectedIds.size === 0 || isMoving}
          className="btn-primary"
          style={{
            padding: '10px 16px', fontSize: '0.88rem', fontWeight: 700, justifyContent: 'center',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            backgroundColor: '#7C3AED', borderColor: '#7C3AED',
            opacity: !targetCategory || selectedIds.size === 0 || isMoving ? 0.55 : 1
          }}
        >
          {isMoving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
          {isMoving ? 'Moviendo...' : `Mover ${selectedIds.size || ''} producto${selectedIds.size === 1 ? '' : 's'}`}
        </button>
      </div>

      {result && (
        <div
          role="status"
          style={{
            marginTop: '12px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 600,
            backgroundColor: result.failed.length ? '#FEF2F2' : '#ECFDF5',
            border: `1px solid ${result.failed.length ? '#FECACA' : '#A7F3D0'}`,
            color: result.failed.length ? '#B91C1C' : '#047857'
          }}
        >
          {result.ok > 0 && `✓ ${result.ok} producto${result.ok === 1 ? '' : 's'} movido${result.ok === 1 ? '' : 's'}. `}
          {result.failed.length > 0 && `No se pudieron mover: ${result.failed.join(', ')}. Revisá que la sesión no haya vencido.`}
        </div>
      )}
    </div>
  );
}
