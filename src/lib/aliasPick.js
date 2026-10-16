// Elección del alias de cobro para una transferencia (/ventas y /supervisor).
// Cada alias puede tener mínimo, máximo por transferencia y tope del día;
// se sugiere el primero activo (en el orden que definió Mica) que acepta el monto.

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

export function aliasRemaining(a) {
  if (!a?.dailyLimit) return null;
  return Math.max(0, a.dailyLimit - (a.receivedToday || 0));
}

// { ok, reason } — reason es corto para mostrar en el chip.
export function aliasStatus(a, amount) {
  if (!a) return { ok: false, reason: 'Sin alias' };
  if (!a.active) return { ok: false, reason: 'Pausado' };
  const amt = Number(amount) || 0;
  const remaining = aliasRemaining(a);
  if (remaining !== null && remaining <= 0) return { ok: false, reason: 'Tope lleno' };
  if (amt > 0) {
    if (a.minAmount && amt < a.minAmount) return { ok: false, reason: `Desde ${fmt(a.minAmount)}` };
    if (a.maxAmount && amt > a.maxAmount) return { ok: false, reason: `Hasta ${fmt(a.maxAmount)}` };
    if (remaining !== null && amt > remaining) return { ok: false, reason: `Le quedan ${fmt(remaining)}` };
  }
  return { ok: true, reason: '' };
}

// Devuelve el alias a usar: el elegido a mano si acepta el monto, si no el
// primero que lo acepte. null si ninguno sirve.
export function pickAlias(aliases, amount, preferredId) {
  const list = (aliases || []).filter((a) => a.active);
  if (preferredId) {
    const chosen = list.find((a) => a.id === preferredId);
    if (chosen && aliasStatus(chosen, amount).ok) return chosen;
  }
  return list.find((a) => aliasStatus(a, amount).ok) || null;
}

// Texto corto de las reglas: "desde $100.000 · tope $500.000"
export function aliasRules(a) {
  const parts = [];
  if (a.minAmount) parts.push(`desde ${fmt(a.minAmount)}`);
  if (a.maxAmount) parts.push(`hasta ${fmt(a.maxAmount)}`);
  if (a.dailyLimit) parts.push(`tope ${fmt(a.dailyLimit)}/día`);
  return parts.join(' · ') || 'sin límites';
}
