// Comprime una foto en el navegador ANTES de subirla: la redimensiona a un
// tamano razonable para verse bien en el catalogo (no hace falta un archivo
// de varios MB para mostrarse en una tarjeta de producto) y la reconvierte a
// webp con perdida controlada. Asi las fotos llegan livianas desde el
// vamos, sin depender del optimizador de imagenes de Vercel (que tiene
// cuota limitada y ya tuvimos problemas con eso).
async function resizeAndEncode(bitmap, { maxWidth, maxHeight, quality }) {
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const targetWidth = Math.round(bitmap.width * scale);
  const targetHeight = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  return { blob, width: targetWidth, height: targetHeight };
}

export async function compressImage(file, { maxWidth = 1200, maxHeight = 1500, quality = 0.82 } = {}) {
  try {
    const bitmap = await createImageBitmap(file);
    const { blob, width, height } = await resizeAndEncode(bitmap, { maxWidth, maxHeight, quality });
    bitmap.close?.();
    if (!blob) return { blob: file, compressed: false };
    return { blob, compressed: true, width, height };
  } catch (e) {
    // Si el navegador no puede comprimir (formato raro, API no disponible),
    // seguimos con el archivo original en vez de bloquear la subida.
    return { blob: file, compressed: false };
  }
}

// Genera DOS versiones de la misma foto en un solo paso: la "full" de
// siempre (para el modal de detalle / zoom) y una miniatura bastante mas
// chica pensada para las tarjetas de la grilla. Ahi se ven muchas fotos a
// la vez en pantallas de celular, y no tiene sentido bajar la imagen de
// 1200x1500 completa para mostrarla en ~150px de ancho -- eso es lo que
// estaba haciendo pesada la pagina en mobile. Decodifica el archivo una
// sola vez (createImageBitmap) y dibuja el canvas dos veces, asi no duplica
// el costo de decodificacion.
export async function compressImageWithThumb(file, opts = {}) {
  const {
    maxWidth = 1200, maxHeight = 1500, quality = 0.82,
    thumbMaxWidth = 500, thumbMaxHeight = 625, thumbQuality = 0.75
  } = opts;
  try {
    const bitmap = await createImageBitmap(file);
    const [full, thumb] = await Promise.all([
      resizeAndEncode(bitmap, { maxWidth, maxHeight, quality }),
      resizeAndEncode(bitmap, { maxWidth: thumbMaxWidth, maxHeight: thumbMaxHeight, quality: thumbQuality })
    ]);
    bitmap.close?.();

    if (!full.blob) return { full: { blob: file }, thumb: null, compressed: false };
    return {
      full: { blob: full.blob, width: full.width, height: full.height },
      thumb: thumb.blob ? { blob: thumb.blob, width: thumb.width, height: thumb.height } : null,
      compressed: true
    };
  } catch (e) {
    return { full: { blob: file }, thumb: null, compressed: false };
  }
}
