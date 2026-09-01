'use client';

import { Calendar, TrendingUp, Eye, Percent, Wallet, ListChecks, MapPin } from 'lucide-react';

const ORDER_STATUS_META = {
  pendiente: { label: 'Pendiente', bg: '#FEF3C7', color: '#92400E' },
  comprobante_subido: { label: 'Comprobante Subido', bg: '#EDE9FE', color: '#6D28D9' },
  aprobado: { label: 'Aprobado', bg: '#ECFDF5', color: '#047857' },
  enviado: { label: 'Enviado', bg: '#EFF6FF', color: '#1D4ED8' },
  cancelado: { label: 'Cancelado', bg: '#FEE2E2', color: '#B91C1C' }
};

const formatPercent = (value) => `${(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;

// Codigos ISO 3166-2:AR que manda Vercel en el header x-vercel-ip-country-region
// (solo la letra, sin el prefijo "AR-"), para mostrar el nombre de la
// provincia en vez del codigo crudo.
const AR_PROVINCES = {
  C: 'Ciudad de Buenos Aires', B: 'Buenos Aires', K: 'Catamarca', H: 'Chaco',
  U: 'Chubut', X: 'Córdoba', W: 'Corrientes', E: 'Entre Ríos', P: 'Formosa',
  Y: 'Jujuy', L: 'La Pampa', F: 'La Rioja', M: 'Mendoza', N: 'Misiones',
  Q: 'Neuquén', R: 'Río Negro', A: 'Salta', J: 'San Juan', D: 'San Luis',
  Z: 'Santa Cruz', S: 'Santa Fe', G: 'Santiago del Estero',
  V: 'Tierra del Fuego', T: 'Tucumán'
};

function formatRegionLabel({ country, region }) {
  if (!country && !region) return 'Sin datos (desarrollo o bot)';
  if (country === 'AR') return AR_PROVINCES[region] || `Argentina (${region || '?'})`;
  return country || 'Desconocido';
}

export default function MetricsTab({ metrics }) {
  return (
    <div>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '16px' }}>Arqueo de Caja (Ingresos Mayoristas)</h2>
      
      <div className="metrics-cards-grid">
        <div className="metric-card">
          <div className="metric-label">
            <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} /> Arqueo Hoy (Diario)
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-emerald)' }}>
            ${metrics.dailyCash?.toLocaleString('es-AR')}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} /> Arqueo de la Semana
          </div>
          <div className="metric-value">
            ${metrics.weeklyCash?.toLocaleString('es-AR')}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} /> Arqueo del Mes
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-gold-hover)' }}>
            ${metrics.monthlyCash?.toLocaleString('es-AR')}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Stock Total Físico</div>
          <div className="metric-value">
            {metrics.totalStockCount} prendas
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '4px solid #2563EB' }}>
          <div className="metric-label">
            <Eye size={14} style={{ display: 'inline', marginRight: '4px', color: '#2563EB' }} /> Visitas Totales
          </div>
          <div className="metric-value" style={{ color: '#2563EB' }}>
            👁️ {metrics.visitCount?.toLocaleString('es-AR') || 0}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <Wallet size={14} style={{ display: 'inline', marginRight: '4px' }} /> Ticket Promedio (Mes)
          </div>
          <div className="metric-value">
            ${Math.round(metrics.avgOrderValue || 0).toLocaleString('es-AR')}
          </div>
        </div>
      </div>

      {/* Conversion Funnel: Visitas -> Pedidos Aprobados, por periodo */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '32px 0 16px 0' }}>
        <Percent size={20} style={{ display: 'inline', marginRight: '6px', color: 'var(--accent-emerald)' }} />
        Conversión (Visitas → Pedidos Aprobados)
      </h2>

      <div className="metrics-cards-grid">
        <div className="metric-card">
          <div className="metric-label">Conversión Hoy</div>
          <div className="metric-value">{formatPercent(metrics.conversionToday)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {metrics.visitToday || 0} visitas hoy
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Conversión Semana</div>
          <div className="metric-value">{formatPercent(metrics.conversionWeek)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {metrics.visitWeek || 0} visitas esta semana
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Conversión Mes</div>
          <div className="metric-value">{formatPercent(metrics.conversionMonth)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {metrics.visitMonth || 0} visitas este mes
          </div>
        </div>
      </div>

      {/* Visitas por Provincia (geolocalizacion por IP, gratis via Vercel) */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '32px 0 16px 0' }}>
        <MapPin size={20} style={{ display: 'inline', marginRight: '6px', color: '#2563EB' }} />
        Visitas por Provincia
      </h2>

      {(!metrics.visitsByRegion || metrics.visitsByRegion.length === 0) ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Todavía no hay datos de ubicación. Esto se completa solo con las nuevas visitas una vez deployado.
        </p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Provincia / Ubicación</th>
              <th>Visitas</th>
              <th>% del Total</th>
            </tr>
          </thead>
          <tbody>
            {metrics.visitsByRegion.map((row, idx) => {
              const total = metrics.visitsByRegion.reduce((sum, r) => sum + r.count, 0);
              const pct = total > 0 ? (row.count / total) * 100 : 0;
              return (
                <tr key={`${row.country}-${row.region}-${idx}`}>
                  <td style={{ fontWeight: 700 }}>{formatRegionLabel(row)}</td>
                  <td style={{ fontWeight: 800, color: '#2563EB' }}>{row.count}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, maxWidth: '140px', height: '6px', borderRadius: '4px', background: 'var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#2563EB' }} />
                      </div>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatPercent(pct)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Pedidos agrupados por estado, para ver donde se traban */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '32px 0 16px 0' }}>
        <ListChecks size={20} style={{ display: 'inline', marginRight: '6px', color: 'var(--accent-emerald)' }} />
        Pedidos por Estado
      </h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
        {Object.entries(ORDER_STATUS_META).map(([status, meta]) => (
          <div
            key={status}
            style={{
              backgroundColor: meta.bg,
              color: meta.color,
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {meta.label}
            <span style={{ fontWeight: 900, fontSize: '1rem' }}>
              {metrics.ordersByStatus?.[status] || 0}
            </span>
          </div>
        ))}
      </div>

      {/* Product Rotation Ranking */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '32px 0 16px 0' }}>
        <TrendingUp size={20} style={{ display: 'inline', marginRight: '6px', color: 'var(--accent-gold)' }} />
        Productos con Mayor Rotación (Más Vendidos)
      </h2>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Ranking</th>
            <th>Prenda / Producto</th>
            <th>Categoría</th>
            <th>Ventas Acumuladas</th>
            <th>Stock Actual</th>
            <th>Precio Mayorista</th>
          </tr>
        </thead>
        <tbody>
          {metrics.topRotationProducts?.map((prod, idx) => (
            <tr key={prod.id}>
              <td style={{ fontWeight: 800 }}>#{idx + 1}</td>
              <td style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={prod.image_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }} />
                {prod.name}
              </td>
              <td>{prod.category}</td>
              <td style={{ fontWeight: 800, color: 'var(--accent-emerald)' }}>
                🔥 {prod.sales_count} un.
              </td>
              <td>{prod.stock} un.</td>
              <td style={{ fontWeight: 700 }}>${prod.wholesale_price?.toLocaleString('es-AR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
