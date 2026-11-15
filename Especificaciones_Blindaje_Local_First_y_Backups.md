# Documento de Especificaciones Técnicas y Operativas
## Sistema de Blindaje Local-First, Backup en 1 Clic y Modo de Contingencia Offline

**Proyecto:** Dulce Valentín — Sistema Web y Punto de Venta  
**Fecha de Implementación:** Noviembre 2026  
**Versión:** 1.0.0-local-first  
**Estado:** Producción Verificado  

---

### 1. Resumen Ejecutivo
El **Plan de Blindaje Local-First y Backup en 1 Clic** de Dulce Valentín dota a la empresa de una infraestructura de resiliencia total frente a cortes de internet, caídas de servicios de nube o fallas de conectividad en el local comercial.

Permite:
1. **Respaldar el 100% de la base de datos física y comercial en 1 solo clic**, detectando la carpeta del usuario en Windows (`C:\Users\<Usuario>\Backups_DulceValentin`) y generando tanto un volcado maestro JSON como 4 planillas listas para Microsoft Excel.
2. **Doble respaldo en navegador:** Descarga simultánea de archivos Blob al explorador para redundancia inmediata.
3. **Modo Local / Contingencia Offline (IndexedDB):** Acceso instantáneo a catálogo, búsqueda por nombre, código de artículo y código de barras, precios por menor/mayor y stock físico desglosado por talle y color sin requerir internet.
4. **Diseño Adaptativo de Alta Gama (Bento Grid):** Interfaz armónica en Dark Mode y Light Mode, con métricas en tiempo real y sin sobrecargar la barra principal de navegación.

---

### 2. Arquitectura de Datos y Tablas Auditadas

| Entidad / Tabla | Cantidad Auditada | Descripción y Campos Principales |
| :--- | :---: | :--- |
| `products` | **324** | Catálogo general de prendas, precios minoristas y mayoristas, categorías, subcategorías, talles, colores, stock total y matriz de códigos de barra (`barcodes` JSONB). |
| `wholesale_clients` | **225** | Directorio de clientes mayoristas y registrados con nombres, teléfonos (normalizados), DNI, localidad y roles. |
| `orders` | **21** | Historial de pedidos y ventas web y de local, detalle de prendas (`items` JSONB), medios de pago, vendedoras/cajeras asignadas y montos. |
| `stock_movements` | **349** | Auditoría histórica de ingresos, egresos y ventas de mercadería. |
| `categories` | **82** | Árbol de categorías y subcategorías del negocio. |
| `pos_cashiers` | **2** | Personal de caja habilitado para cobro en mostrador. |
| `pos_shifts` | **—** | Registro de turnos de caja, aperturas, cobros y cierres Z. |
| `raffle_tickets` | **7** | Cupones emitidos para el sorteo en vivo del local. |

---

### 3. Componentes Implementados

#### 3.1. API Route de Exportación Física
- **Ruta:** `/api/admin/backups/export` (`POST`)
- **Archivo:** `src/app/api/admin/backups/export/route.js`
- **Mecanismo:**
  1. Valida permisos de administrador mediante token Bearer (`requireAdmin`).
  2. Extrae en paralelo todas las tablas de Supabase.
  3. Detecta la carpeta del sistema operativo:
     ```javascript
     const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir();
     const backupDir = path.join(homeDir, 'Backups_DulceValentin');
     ```
  4. Crea la carpeta en caso de no existir.
  5. Escribe en disco:
     - `backup_dulce_valentin_<timestamp>.json` (Snapshot maestro completo)
     - `base_completa_reciente.json` (Snapshot de acceso directo)
     - `catalogo_productos_<fecha>.csv`
     - `stock_por_talle_y_color_<fecha>.csv`
     - `ventas_y_pedidos_<fecha>.csv`
     - `clientes_y_contactos_<fecha>.csv`
  6. Devuelve la carga útil al cliente para hidratar IndexedDB y disparar descargas de navegador.

#### 3.2. Formato de Planillas para Microsoft Excel
Para evitar que los caracteres con tildes (á, é, í, ó, ú, ñ) se corrompan o que Excel desplace las columnas, todas las planillas CSV se generan bajo las siguientes reglas estrictas:
- **BOM UTF-8 (`\uFEFF`):** Permite a Microsoft Excel en Windows reconocer de inmediato la codificación en español.
- **Delimitador de punto y coma (`;`):** Estándar de Excel en Argentina y países hispanohablantes donde la coma es separador decimal.
- **Escape de comillas dobles y salto de línea:** Los campos de texto se encierran entre `"..."` con reemplazo de caracteres de retorno de carro por espacios.

#### 3.3. Gestor Local-First e IndexedDB
- **Archivo:** `src/lib/localDatabase.js`
- **Base IndexedDB:** `dulce_valentin_local_db` (Versión 1)
- **Object Store:** `snapshots` (Clave: `current_database_snapshot`)
- **Metadatos en localStorage:** `dv_local_snapshot_meta` (permite lectura síncrona sin latencia al montar la pantalla).
- **Modo de contingencia:** Evento `dv:mode-change` que conmuta la interfaz entre consulta en línea y búsqueda a 0ms en memoria local.

#### 3.4. Interfaz de Usuario y Navegación (Bento Grid)
- **Archivo:** `src/components/admin/BackupsTab.jsx`
- **Ubicación del Acceso:** Botón `[ 🛡️ Respaldo & Modo Local ]` en `AdminHeader.jsx`. Al estar en la cabecera superior:
  - No consume espacio en la barra horizontal de pestañas (`AdminTabsNav.jsx`).
  - Mantiene 100% visible la pestaña `🎰 Sorteo en Vivo` y el resto de las 17 secciones operativas.
  - Es accesible desde cualquier vista a 1 solo clic.
- **Bento Cards de Métricas Vivas:**
  - 🏷️ **Prendas en Catálogo:** Cantidad en tiempo real + badge `● Variantes activas`.
  - 📦 **Stock Físico Total:** Suma real de unidades físicas (`u.`) en local y depósito.
  - 💳 **Ventas y Pedidos:** Historial de tickets emitidos por caja y tienda online.
  - 👥 **Directorio de Clientes:** Cantidad unificada de clientes mayoristas y compradores.
- **Visor de Contingencia Offline:** Buscador instantáneo con filtro por nombre, código de artículo (ej. `0314`) o código de barras, con visualización de precio minorista, mayorista y chips de stock por talle y color.
- **Inspección de Archivos:** Permite arrastrar o cargar cualquier `.json` histórico para verificar datos o montarlo en la memoria local.

#### 3.5. Guía Interactiva Paso a Paso
- **Archivo:** `src/components/admin/BackupGuideModal.jsx`
- Modal interactivo de 4 pasos para operadoras y administradoras:
  1. *¿Para qué sirve esta pantalla?*
  2. *El botón de Respaldo en 1 Clic*
  3. *Modo Local si se corta Internet*
  4. *Planillas Excel listas para contabilidad*
- Botón permanente `¿Cómo funciona esta pantalla?` para volver a abrir la guía en cualquier momento.

---

### 4. Pruebas de Funcionamiento en Vivo

En la prueba de ejecución directa en la máquina host Windows (`C:\Users\jpbor`), el sistema verificó con éxito:
1. Conexión y extracción a Supabase de 324 prendas, 225 clientes y 21 ventas.
2. Cálculo síncrono de stock físico: **12.469 unidades**.
3. Creación automática del directorio `C:\Users\jpbor\Backups_DulceValentin`.
4. Escritura física de:
   - `backup_dulce_valentin_2026-11-15_03-46-41.json` (**1.41 MB**)
   - `base_completa_reciente.json` (**1.41 MB**)
   - `catalogo_productos_2026-11-15.csv` (**44.8 KB**, 324 filas)
   - `stock_por_talle_y_color_2026-11-15.csv` (**188.5 KB**, 2.122 filas de variantes)
   - `ventas_y_pedidos_2026-11-15.csv` (**4.2 KB**, 21 filas)
   - `clientes_y_contactos_2026-11-15.csv` (**17.3 KB**, 225 filas)
5. Compilación general de Next.js (`npm run build`) completada con **Código 0** sin errores.

---

### 5. Guía de Uso Rápido para el Local

1. Entrar al panel de administración `/admin`.
2. En la parte superior derecha hacer clic en **[ 🛡️ Respaldo & Modo Local ]**.
3. Tocar el botón verde **"Sincronizar y Respaldar en 1 Clic"**.
4. ¡Listo! Se crearon los archivos en tu PC y se descargaron en tu navegador.
5. Si querés abrir una planilla específica en Excel (ej. para reponer mercadería o enviarle al contador), tocás el botón **"Descargar Excel"** correspondiente.
6. Si se corta internet, activás el botón **"Modo Local"** y buscás cualquier prenda por código o nombre para ver su precio y stock al instante.
