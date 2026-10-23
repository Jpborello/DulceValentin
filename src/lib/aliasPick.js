// Elección del alias de cobro para una transferencia (/ventas y /supervisor).
// Cada alias puede tener mínimo, máximo por transferencia y tope del día;
// se sugiere el primero activo (en el orden que definió Mica) que acepta el monto.

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

export function aliasRemaining(a) {
  if (!a?.dailyLimit) return null;
  return Math.max(0, a.dailyLimit - (a.receivedToday || 0));
}

// { ok, reason, overLimit, willOver } — reason es corto para mostrar en el chip.
// NUNCA bloquea el cobro ni la asignación: ok siempre es true para alias activos
// permitiendo cobrar y agregar al alias aunque se pase del tope.
export function aliasStatus(a, amount) {
  if (!a) return { ok: false, reason: 'Sin alias', overLimit: false, willOver: false };
  if (!a.active) return { ok: false, reason: 'Pausado', overLimit: false, willOver: false };
  const amt = Number(amount) || 0;
  const remaining = aliasRemaining(a);
  const alreadyFull = remaining !== null && remaining <= 0;
  const willOver = remaining !== null && remaining > 0 && amt > 0 && amt > remaining;

  let reason = '';
  if (alreadyFull) {
    reason = 'Tope alcanzado';
  } else if (willOver) {
    reason = `Pasa tope (${fmt(remaining)} disp.)`;
  } else if (amt > 0 && a.minAmount && amt < a.minAmount) {
    reason = `Desde ${fmt(a.minAmount)}`;
  } else if (amt > 0 && a.maxAmount && amt > a.maxAmount) {
    reason = `Hasta ${fmt(a.maxAmount)}`;
  }

  return {
    ok: true,
    reason,
    overLimit: alreadyFull,
    willOver
  };
}

// Devuelve el alias a usar:
// 1. Si se eligió uno a mano y está activo, SIEMPRE se usa (sin bloquear nunca).
// 2. Si no, busca el primer activo que tenga margen diario (sin tope o remaining > 0).
//    Si está por llegar al tope, LO DEJA USAR aunque este monto se pase.
// 3. Si todos superaron el tope, devuelve el primer activo para no bloquear.
// null solo si no hay ningún alias activo.
export function pickAlias(aliases, amount, preferredId) {
  const list = (aliases || []).filter((a) => a.active);
  if (list.length === 0) return null;

  // 1. Si el usuario eligió un alias a mano, siempre se respeta sin bloquear
  if (preferredId) {
    const chosen = list.find((a) => a.id === preferredId);
    if (chosen) return chosen;
  }

  const amt = Number(amount) || 0;

  // 2. Primero busca uno activo que aún tenga margen en el día (remaining > 0 o sin tope)
  // y que cumpla min/max. Si este monto hace que se pase del tope pero todavía le quedaba margen,
  // LO DEJA USAR para completar la transferencia.
  const candidateWithRoom = list.find((a) => {
    const rem = aliasRemaining(a);
    const hasRoom = rem === null || rem > 0;
    const fitsAmount = amt <= 0 || ((!a.minAmount || amt >= a.minAmount) && (!a.maxAmount || amt <= a.maxAmount));
    return hasRoom && fitsAmount;
  });
  if (candidateWithRoom) return candidateWithRoom;

  // 3. Si no calzan min/max pero alguno tiene margen disponible
  const anyWithRoom = list.find((a) => {
    const rem = aliasRemaining(a);
    return rem === null || rem > 0;
  });
  if (anyWithRoom) return anyWithRoom;

  // 4. Si todos ya están al tope (remaining <= 0), busca uno que calce en monto
  const fitsAny = list.find((a) => {
    return amt <= 0 || ((!a.minAmount || amt >= a.minAmount) && (!a.maxAmount || amt <= a.maxAmount));
  });
  if (fitsAny) return fitsAny;

  // 5. Fallback: primer alias activo
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
