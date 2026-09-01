// Comprime una foto en el navegador ANTES de subirla: la redimensiona a un
// tamano razonable para verse bien en el catalogo (no hace falta un archivo
// de varios MB para mostrarse en una tarjeta de producto) y la reconvierte a
// webp con perdida controlada. Asi las fotos llegan livianas desde el
// vamos, sin depender del optimizador de imagenes de Vercel (que tiene
// cuota limitada y ya tuvimos problemas con eso).
export async function compressImage(file, { maxWidth = 1200, maxHeight = 1500, quality = 0.82 } = {}) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const targetWidth = Math.round(bitmap.width * scale);
    const targetHeight = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob) return { blob: file, compressed: false };
    return { blob, compressed: true, width: targetWidth, height: targetHeight };
  } catch (e) {
    // Si el navegador no puede comprimir (formato raro, API no disponible),
    // seguimos con el archivo original en vez de bloquear la subida.
    return { blob: file, compressed: false };
  }
}
