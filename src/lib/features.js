// Funciones que ya estan programadas pero quedan APAGADAS hasta que el
// cliente las contrate. Para habilitar una, cambiar false -> true y hacer
// deploy (la base de datos ya esta preparada para todas).
//
//   POS:            caja del local (/caja), ventas de vendedoras, cobro,
//                   comisiones y pestaña "Personal y Comisiones" del admin.
//   BARCODE_LABELS: boton "Etiquetas" en Control de Stock (codigos de barra
//                   por talle/color para imprimir y escanear en la caja).
export const FEATURES = {
  POS: false,
  BARCODE_LABELS: false
};
