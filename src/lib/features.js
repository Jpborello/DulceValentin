// Funciones del sistema habilitadas para Dulce Valentín.
//
//   POS:            caja del local (/caja), punto de venta en panel admin,
//                   lector de código de barras, cobro, comisiones y arqueo.
//   BARCODE_LABELS: botón "Etiquetas" e impresión con código de barras
//                   por variante (talle + color).
//   LOCAL_BACKUP:   respaldo físico en 1 clic en Windows, CSVs para Excel y
//                   modo local / contingencia offline con IndexedDB.
export const FEATURES = {
  POS: true,
  BARCODE_LABELS: true,
  LOCAL_BACKUP: true
};

export default FEATURES;
