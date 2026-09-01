// Normaliza un numero de telefono para poder comparar dos que representan
// el mismo numero pero estan tipeados distinto (con espacios, guiones,
// codigo de pais +54/9, etc.). Nos quedamos con los ultimos 10 digitos
// (largo tipico de un numero argentino sin codigo de pais), que es lo que
// realmente identifica al numero sin importar como se haya tipeado el resto.
export function normalizePhone(phone) {
  const digitsOnly = String(phone || '').replace(/\D/g, '');
  return digitsOnly.slice(-10);
}
