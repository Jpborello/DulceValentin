'use client';

import { useState } from 'react';
import { StickyNote, Save, Loader2, Check, MessageSquareQuote } from 'lucide-react';
import { dataStore } from '@/lib/dataStore';

// Celda "Notas" de la tabla de pedidos: muestra lo que aclaro el cliente al
// comprar (customer_notes) y un anotador interno del admin (admin_notes)
// para dejar especificaciones del pedido al lado.
export default function OrderNotesCell({ order }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(order.admin_notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const startEdit = () => {
    setDraft(order.admin_notes || '');
    setError('');
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    const res = await dataStore.updateOrderAdminNotes(order.id, draft);
    setIsSaving(false);
    if (!res.ok) {
      setError('No se pudo guardar. ¿Sesión vencida?');
      return;
    }
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ minWidth: '200px', maxWidth: '260px' }}>
      {order.customer_notes && (
        <div
          title="Lo escribió el cliente al hacer el pedido"
          style={{
            display: 'flex', gap: '5px', fontSize: '0.74rem', lineHeight: 1.35, marginBottom: '6px', padding: '5px 7px',
            borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE'
          }}
        >
          <MessageSquareQuote size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span><strong>Cliente:</strong> {order.customer_notes}</span>
        </div>
      )}

      {isEditing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
            rows={3}
            autoFocus
            placeholder="Ej: cambiar talle M por L, retira el jueves, mandar por Vía Cargo..."
            className="form-input"
            style={{ width: '100%', fontSize: '0.78rem', padding: '6px 8px', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary"
              style={{ padding: '4px 10px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            >
              Cancelar
            </button>
          </div>
          {error && <div style={{ fontSize: '0.72rem', color: '#B91C1C', fontWeight: 700, marginTop: '3px' }}>{error}</div>}
        </div>
      ) : order.admin_notes ? (
        <button
          type="button"
          onClick={startEdit}
          title="Editar anotación"
          style={{
            display: 'flex', gap: '5px', width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '0.76rem', lineHeight: 1.35,
            padding: '5px 7px', borderRadius: '6px', backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A',
            whiteSpace: 'pre-wrap'
          }}
        >
          {saved ? <Check size={13} style={{ flexShrink: 0, marginTop: '1px' }} /> : <StickyNote size={13} style={{ flexShrink: 0, marginTop: '1px' }} />}
          <span>{order.admin_notes}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 9px', fontSize: '0.74rem', fontWeight: 700,
            borderRadius: '6px', border: '1px dashed var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          <StickyNote size={12} /> Anotar
        </button>
      )}
    </div>
  );
}
