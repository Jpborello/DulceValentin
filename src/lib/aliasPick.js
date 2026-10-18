// Elección del alias de cobro para una transferencia (/ventas y /supervisor).
// Cada alias puede tener mínimo, máximo por transferencia y tope del día;
// se sugiere el primero activo (en el orden que definió Mica) que acepta el monto.

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

export function aliasRemaining(a) {
  if (!a?.dailyLimit) return null;
  return Math.max(0, a.dailyLimit - (a.receivedToday || 0));
}

// { ok, reason, overLimit } — reason es corto para mostrar en el chip.
// Si se superó el tope diario, overLimit = true pero ok = true
// (se muestra en rojo pero permite seguir cobrando sin bloquear).
export function aliasStatus(a, amount) {
  if (!a) return { ok: false, reason: 'Sin alias', overLimit: false };
  if (!a.active) return { ok: false, reason: 'Pausado', overLimit: false };
  const amt = Number(amount) || 0;
  const remaining = aliasRemaining(a);
  const isOver = remaining !== null && (remaining <= 0 || (amt > 0 && amt > remaining));

  if (amt > 0) {
    if (a.minAmount && amt < a.minAmount) return { ok: false, reason: `Desde ${fmt(a.minAmount)}`, overLimit: isOver };
    if (a.maxAmount && amt > a.maxAmount) return { ok: false, reason: `Hasta ${fmt(a.maxAmount)}`, overLimit: isOver };
  }

  if (isOver) {
    return {
      ok: true,
      reason: remaining <= 0 ? 'Tope alcanzado' : `Supera tope (${fmt(remaining)} disp.)`,
      overLimit: true
    };
  }

  return { ok: true, reason: '', overLimit: false };
}

// Devuelve el alias a usar:
// 1. Si se eligió uno a mano y está activo, se usa (incluso si pasó el tope).
// 2. Si no, busca el primer activo que acepte el monto y NO haya superado el tope.
// 3. Si todos superaron el tope, devuelve el primer activo (en rojo) para no bloquear.
// null solo si no hay ningún alias activo.
export function pickAlias(aliases, amount, preferredId) {
  const list = (aliases || []).filter((a) => a.active);
  if (list.length === 0) return null;

  if (preferredId) {
    const chosen = list.find((a) => a.id === preferredId);
    if (chosen && aliasStatus(chosen, amount).ok) return chosen;
  }

  // Primero intentamos con uno activo que no supere el tope
  const perfect = list.find((a) => {
    const st = aliasStatus(a, amount);
    return st.ok && !st.overLimit;
  });
  if (perfect) return perfect;

  // Si todos superaron el tope, el primero activo permitido
  const acceptable = list.find((a) => aliasStatus(a, amount).ok);
  if (acceptable) return acceptable;

  return list[0];
}

// Texto corto de las reglas: "desde $100.000 · tope $500.000"
export function aliasRules(a) {
  const parts = [];
  if (a.minAmount) parts.push(`desde ${fmt(a.minAmount)}`);
  if (a.maxAmount) parts.push(`hasta ${fmt(a.maxAmount)}`);
  if (a.dailyLimit) parts.push(`tope ${fmt(a.dailyLimit)}/día`);
  return parts.join(' · ') || 'sin límites';
}
