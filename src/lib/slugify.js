// Convierte cualquier texto (nombre de producto, categoria, subcategoria)
// en un slug de URL: sin tildes, en minusculas, separado por guiones.
export function slugify(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
