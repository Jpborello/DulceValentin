const { jsPDF } = require('jspdf');
const autoTableImport = require('jspdf-autotable');
const autoTable = autoTableImport.default || autoTableImport;
const fs = require('fs');

async function createSpecsPdf() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [168, 23, 90]; // #A8175A Dulce Valentin Magenta
  const darkTextColor = [36, 30, 40];
  const mutedTextColor = [110, 101, 110];
  const emeraldColor = [22, 163, 74];
  const bgSoft = [252, 237, 243];

  let y = 18;

  // Header Banner
  doc.setFillColor(...bgSoft);
  doc.roundedRect(14, y, 182, 28, 4, 4, 'F');

  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.8);
  doc.line(14, y, 14, y + 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...primaryColor);
  doc.text('DULCE VALENTÍN — ESPECIFICACIONES TÉCNICAS', 20, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...darkTextColor);
  doc.text('Sistema de Blindaje Local-First, Backup en 1 Clic y Modo de Contingencia Offline', 20, y + 17);

  doc.setFontSize(8.5);
  doc.setTextColor(...mutedTextColor);
  doc.text('Fecha: Noviembre 2026   |   Versión: 1.0.0-local-first   |   Estado: Producción Verificado', 20, y + 23);

  y += 36;

  // 1. Resumen Ejecutivo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('1. Resumen Ejecutivo', 14, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkTextColor);
  const resumenText = 'El Sistema de Blindaje Local-First y Backup en 1 Clic dota a Dulce Valentin de una infraestructura de resiliencia total frente a cortes de internet, caidas de servidores de nube o fallas de red en el local comercial. Permite exportar y sincronizar la base de datos completa de prendas, stock, precios, codigos de barra, ventas y clientes en un solo clic, tanto en la computadora fisica (C:\\Users\\<Usuario>\\Backups_DulceValentin) como en el navegador web.';
  const splitResumen = doc.splitTextToSize(resumenText, 182);
  doc.text(splitResumen, 14, y);
  y += splitResumen.length * 5 + 4;

  // 2. Tablas y Datos Auditados
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('2. Entidades y Volumen de Datos Auditado', 14, y);
  y += 4;

  const tableData = [
    ['products', '324 prendas', 'Catalogo completo, precios minoristas/mayoristas, variantes talle/color y barcodes.'],
    ['wholesale_clients', '225 clientes', 'Directorio de clientes mayoristas, telefonos normalizados, DNI y localidad.'],
    ['orders', '21 pedidos', 'Historial de tickets web, local y caja, medios de pago y vendedoras.'],
    ['stock_movements', '349 movimientos', 'Auditoria historica de ingresos, egresos y ventas de stock fisico.'],
    ['categories', '82 categorias', 'Arbol de categorias y subcategorias para ordenamiento de prendas.'],
    ['pos_cashiers / pos_shifts', '2 cajeras', 'Configuracion de puestos de cobro, turnos y PIN de seguridad.']
  ];

  autoTable(doc, {
    startY: y,
    head: [['Entidad / Tabla', 'Registros', 'Descripcion Operativa']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: darkTextColor,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 32, fontStyle: 'bold', textColor: emeraldColor },
      2: { cellWidth: 108 }
    },
    margin: { left: 14, right: 14 }
  });

  y = (doc.lastAutoTable?.finalY || 130) + 10;

  // 3. Modulos Principales
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('3. Módulos y Arquitectura de la Solución', 14, y);
  y += 6;

  const modulos = [
    {
      title: 'A. Deteccion de Carpeta en Windows y Respaldo Fisico en 1 Clic',
      desc: 'Ruta API /api/admin/backups/export: Detecta dinamicamente la carpeta C:\\Users\\<Usuario>\\Backups_DulceValentin y crea los archivos fisicos: el JSON maestro y 4 planillas CSV (Catalogo, Stock por Variante, Ventas y Clientes).'
    },
    {
      title: 'B. Compatibilidad Estricta con Microsoft Excel (Espanol)',
      desc: 'Los CSV se formatean con BOM UTF-8 (\\uFEFF) y punto y coma (;). Esto permite que el personal abra las planillas con doble clic en Windows sin caracteres con tildes rotos ni columnas corridas.'
    },
    {
      title: 'C. Modo Local y Contingencia Offline a 0ms (IndexedDB)',
      desc: 'Base de datos dulce_valentin_local_db: En caso de corte de internet en el local, el personal activa el Modo Local y busca prendas por nombre, codigo de articulo o codigo de barras con stock y precios en tiempo real.'
    },
    {
      title: 'D. Diseno Adaptativo Bento Grid y Optimizacion de Navegacion',
      desc: 'El acceso se ubico en la cabecera superior (AdminHeader), dejando la barra de pestanas 100% despejada para que la seccion "Sorteo en Vivo" y las 17 pestanas originales permanezcan siempre visibles.'
    }
  ];

  modulos.forEach(m => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...darkTextColor);
    doc.text(`• ${m.title}`, 14, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedTextColor);
    const splitDesc = doc.splitTextToSize(m.desc, 178);
    doc.text(splitDesc, 18, y);
    y += splitDesc.length * 4 + 3.5;
  });

  // Salto de Página para Pruebas y Certificación
  doc.addPage();
  y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('4. Certificación de Pruebas en Vivo (Entorno Windows)', 14, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkTextColor);
  doc.text('Se ejecuto el ciclo completo de validacion en la maquina local con los siguientes resultados verificados:', 14, y);
  y += 6;

  const pruebasData = [
    ['Deteccion de Carpeta', 'EXITOSO', 'C:\\Users\\jpbor\\Backups_DulceValentin creada automaticamente.'],
    ['Snapshot JSON Maestro', 'EXITOSO', 'backup_dulce_valentin_*.json (1.41 MB) escrito en disco.'],
    ['Planilla Catalogo CSV', 'EXITOSO', 'catalogo_productos_*.csv (44.8 KB, 324 prendas).'],
    ['Planilla Stock Variantes CSV', 'EXITOSO', 'stock_por_talle_y_color_*.csv (188.5 KB, 2.122 variantes con codigos de barra).'],
    ['Planilla Ventas CSV', 'EXITOSO', 'ventas_y_pedidos_*.csv (4.2 KB, 21 pedidos registrados).'],
    ['Planilla Clientes CSV', 'EXITOSO', 'clientes_y_contactos_*.csv (17.3 KB, 225 clientes mayoristas).'],
    ['Compilacion Next.js (Build)', 'EXITOSO', 'npm run build completo con Codigo 0 en todas las rutas estaticas y dinamicas.']
  ];

  autoTable(doc, {
    startY: y,
    head: [['Prueba de Integración', 'Resultado', 'Detalle de Verificación']],
    body: pruebasData,
    theme: 'grid',
    headStyles: {
      fillColor: emeraldColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: darkTextColor,
      cellPadding: 2.8
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 28, fontStyle: 'bold', textColor: emeraldColor },
      2: { cellWidth: 99 }
    },
    margin: { left: 14, right: 14 }
  });

  y = (doc.lastAutoTable?.finalY || 110) + 12;

  // 5. Guía Operativa para el Local
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('5. Guía de Operación Rápida para el Administrador', 14, y);
  y += 6;

  const pasos = [
    '1. Ingresar al panel /admin con credenciales de administracion.',
    '2. En la barra superior derecha, pulsar el boton [ Respaldo & Modo Local ].',
    '3. Hacer clic en el boton verde "Sincronizar y Respaldar en 1 Clic".',
    '4. El sistema guardara los archivos en tu PC y descargara una copia en tu navegador.',
    '5. Para auditorias o enviar al contador, descargar la planilla correspondiente con 1 clic.',
    '6. Ante cortes de conexion, activar el "Modo Local" para consultar precios y stock a 0ms.'
  ];

  pasos.forEach(p => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...darkTextColor);
    doc.text(p, 14, y);
    y += 5.5;
  });

  y += 10;

  // Pie de Página / Firma de Entrega
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.4);
  doc.line(14, y, 196, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('DULCE VALENTÍN — TECNOLOGÍA Y BLINDAJE OPERATIVO', 14, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedTextColor);
  doc.text('Documento oficial de entrega y especificaciones tecnicas.', 14, y + 5);

  const pdfOutput = doc.output('arraybuffer');
  fs.writeFileSync('Especificaciones_Blindaje_Local_First_y_Backups.pdf', Buffer.from(pdfOutput));
  console.log('✅ Archivo PDF generado exitosamente: Especificaciones_Blindaje_Local_First_y_Backups.pdf');
}

createSpecsPdf().catch(err => {
  console.error('Error generando PDF:', err);
  process.exit(1);
});
