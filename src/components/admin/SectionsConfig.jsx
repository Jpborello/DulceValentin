'use client';

import { useState } from 'react';
import { Store, Link2, Copy, Check, KeyRound, Loader2, PlusCircle } from 'lucide-react';
import { adminFetch } from '@/lib/adminFetch';

// Cajas de sección (ej. "Caja 1 · Sección Niños"): nombre, vendedoras que
// venden ahí, código de 4 números de cada una y link para vincular la PC de
// la sección (pantalla /seccion). Va dentro de Punto de Venta → Cajeras &
// Turnos, sin botones nuevos en el menú del panel.

async function post(body) {
  const res = await adminFetch('/api/admin/pos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo guardar.');
  return data;
}

const randomCode = () => String(Math.floor(1000 + Math.random() * 9000));

export default function SectionsConfig({ sections = [], sellers = [], sellersWithCode = [], onChanged }) {
  const [openId, setOpenId] = useState(sections[0]?.id || null);
  const [draft, setDraft] = useState(null); // { id?, name, sellerIds, active }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type, text }
  const [link, setLink] = useState(null); // { sectionId, url }
  const [copied, setCopied] = useState(false);
  const [codeFor, setCodeFor] = useState(null); // { staffId, value }

  const withCode = new Set(sellersWithCode);
  const nameOf = (id) => sellers.find((s) => s.id === id)?.name || 'Vendedora';

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 6000);
  };

  const startEdit = (section) => {
    setOpenId(section?.id || 'new');
    setDraft(section
      ? { id: section.id, name: section.name, sellerIds: section.sellerIds || [], active: section.active !== false }
      : { name: '', sellerIds: [], active: true });
    setLink(null);
  };

  const saveDraft = async () => {
    setBusy(true);
    try {
      const { section } = await post({ action: 'saveSection', ...draft });
      setDraft(null);
      setOpenId(section.id);
      flash('ok', `✓ ${section.label} guardada.`);
      onChanged?.();
    } catch (err) {
      flash('err', err.message);
    } finally {
      setBusy(false);
    }
  };

  const makeLink = async (section) => {
    if (section.linked && !window.confirm('Ya hay una PC vinculada a esta caja. Si generás un link nuevo, esa PC deja de funcionar hasta que abra el link nuevo. ¿Seguir?')) return;
    setBusy(true);
    try {
      const { token } = await post({ action: 'sectionLink', id: section.id });
      setLink({ sectionId: section.id, url: `${window.location.origin}/seccion#vincular=${token}` });
      setCopied(false);
      onChanged?.();
    } catch (err) {
      flash('err', err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveCode = async () => {
    if (!codeFor) return;
    setBusy(true);
    try {
      await post({ action: 'setSellerCode', staffId: codeFor.staffId, code: codeFor.value });
      flash('ok', codeFor.value
        ? `✓ Código de ${nameOf(codeFor.staffId)}: ${codeFor.value}. Anotalo y pasáselo: después no se puede volver a ver.`
        : `✓ Se quitó el código de ${nameOf(codeFor.staffId)}.`);
      setCodeFor(null);
      onChanged?.();
    } catch (err) {
      flash('err', err.message);
    } finally {
      setBusy(false);
    }
  };

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '18px', marginBottom: '16px' };
  const small = { fontSize: '0.8rem', color: 'var(--text-muted)' };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <h3 style={{ fontSize: '1.02rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Store size={18} /> Cajas de sección
        </h3>
        <button type="button" onClick={() => startEdit(null)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <PlusCircle size={14} /> Nueva sección
        </button>
      </div>
      <p style={{ ...small, margin: '0 0 12px' }}>
        La vendedora pone su código en la PC de la sección, escanea las prendas y sale el ticket a su nombre.
        Se cobra abajo en la Caja General (aparece sola en &laquo;Ventas pendientes&raquo;) y ahí suma a su comisión.
      </p>

      {msg && (
        <div role="status" style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '8px', fontWeight: 700, fontSize: '0.84rem', background: msg.type === 'ok' ? '#DCFCE7' : '#FEE2E2', color: msg.type === 'ok' ? '#166534' : '#B91C1C' }}>
          {msg.text}
        </div>
      )}

      {draft && openId === 'new' && (
        <SectionEditor draft={draft} setDraft={setDraft} sellers={sellers} busy={busy} onSave={saveDraft} onCancel={() => setDraft(null)} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sections.map((s) => (
          <div key={s.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px 14px', opacity: s.active === false ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 900 }}>{s.label}{s.active === false ? ' (desactivada)' : ''}</div>
                <div style={small}>
                  {s.linked ? '🟢 PC vinculada' : '⚪ Sin PC vinculada'} · {(s.sellerIds || []).length} vendedora{(s.sellerIds || []).length === 1 ? '' : 's'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => startEdit(s)} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>Editar</button>
                <button type="button" disabled={busy} onClick={() => makeLink(s)} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Link2 size={13} /> {s.linked ? 'Nuevo link para la PC' : 'Link para la PC'}
                </button>
              </div>
            </div>

            {link?.sectionId === s.id && (
              <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: 'var(--bg-surface-elevated)', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 800, marginBottom: '6px' }}>Abrí este link en la PC de la sección (una sola vez). No lo compartas con nadie más:</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input readOnly value={link.url} className="form-input" style={{ flex: 1, fontSize: '0.75rem' }} onFocus={(e) => e.target.select()} />
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                    onClick={async () => { try { await navigator.clipboard.writeText(link.url); setCopied(true); } catch {} }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}

            {draft && openId === s.id && (
              <div style={{ marginTop: '10px' }}>
                <SectionEditor draft={draft} setDraft={setDraft} sellers={sellers} busy={busy} onSave={saveDraft} onCancel={() => setDraft(null)} />
              </div>
            )}

            {(s.sellerIds || []).length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(s.sellerIds || []).map((id) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '0.86rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>
                      {nameOf(id)}{' '}
                      <span style={{ ...small, fontWeight: 600 }}>{withCode.has(id) ? '· tiene código' : '· sin código (no puede vender)'}</span>
                    </span>
                    {codeFor?.staffId === id ? (
                      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          value={codeFor.value}
                          onChange={(e) => setCodeFor({ staffId: id, value: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          inputMode="numeric"
                          placeholder="4 números"
                          aria-label={`Código de ${nameOf(id)}`}
                          className="form-input"
                          style={{ width: '96px', padding: '4px 8px', fontWeight: 800, letterSpacing: '3px', textAlign: 'center' }}
                        />
                        <button type="button" disabled={busy || codeFor.value.length !== 4} onClick={saveCode} className="btn-primary" style={{ padding: '5px 10px', fontSize: '0.78rem' }}>
                          {busy ? <Loader2 size={13} className="animate-spin" /> : 'Guardar'}
                        </button>
                        <button type="button" onClick={() => setCodeFor(null)} className="btn-secondary" style={{ padding: '5px 8px', fontSize: '0.78rem' }}>Cancelar</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setCodeFor({ staffId: id, value: randomCode() })} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <KeyRound size={12} /> {withCode.has(id) ? 'Cambiar código' : 'Darle código'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionEditor({ draft, setDraft, sellers, busy, onSave, onCancel }) {
  const toggle = (id) => setDraft((d) => ({
    ...d,
    sellerIds: d.sellerIds.includes(id) ? d.sellerIds.filter((x) => x !== id) : [...d.sellerIds, id]
  }));
  return (
    <div style={{ border: '1px dashed var(--border-color)', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>
        Nombre de la sección
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Ej. Sección Niños"
          className="form-input"
          style={{ display: 'block', width: '100%', marginTop: '4px', fontWeight: 700 }}
        />
      </label>
      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', margin: '10px 0 6px' }}>Vendedoras que venden en esta sección</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {sellers.map((s) => {
          const on = draft.sellerIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              aria-pressed={on}
              style={{
                padding: '5px 10px',
                borderRadius: '999px',
                border: on ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)',
                background: on ? 'var(--accent-gold-light)' : 'var(--bg-surface-elevated)',
                color: 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              {on ? '✓ ' : ''}{s.name}
            </button>
          );
        })}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} /> Caja activa
      </label>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button type="button" disabled={busy || !draft.name.trim()} onClick={onSave} className="btn-primary" style={{ padding: '7px 14px', fontSize: '0.82rem' }}>
          {busy ? 'Guardando...' : 'Guardar sección'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary" style={{ padding: '7px 14px', fontSize: '0.82rem' }}>Cancelar</button>
      </div>
    </div>
  );
}
