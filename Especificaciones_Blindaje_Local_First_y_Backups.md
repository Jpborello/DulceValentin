# Documento de Especificaciones Técnicas y Operativas
## Respaldo Local + Nube y Funcionamiento sin Internet

**Proyecto:** Dulce Valentín — Sistema Web y Punto de Venta  
**Versión:** 2.0.0 (17/11/2026). Reemplaza a la 1.0.0-local-first.

---

### 1. Resumen

El sistema tiene **tres copias de los datos** y la caja **sigue vendiendo sin internet**:

| Copia | Dónde | Cuándo se actualiza |
| :--- | :--- | :--- |
| **Nube** (fuente de verdad) | Supabase | En tiempo real |
| **Punto local** | Disco de la PC del local: `C:\Users\<usuario>\Backups_DulceValentin` | Automático, cada 6 h y al prender la PC (print-agent) |
| **Navegador** | IndexedDB de cada equipo + archivo en Descargas | Al tocar "Respaldar en 1 clic" (panel) y cada vez que la caja carga productos |

> Corrección respecto de la versión 1.0: el botón del panel **no** escribe en el disco de la PC del local. El sitio corre en Vercel (en la nube) y desde ahí no se puede escribir en la PC. La copia física en el local la hace el **print-agent**.

---

### 2. Qué se respalda

20 tablas completas, leídas **de a 1000 filas** (paginado) y verificadas contra el total de cada tabla. Si alguna tabla obligatoria falla o vuelve incompleta, **el respaldo se cancela** y no pisa la copia buena anterior.

`products`, `wholesale_clients`, `orders`, `categories` (obligatorias) · `pos_shifts`, `pos_cashiers`, `pos_config`, `raffle_tickets`, `stock_movements`, `product_suppliers`, `product_barcodes`, `staff`, `seller_sales`, `seller_advances`, `seller_payouts`, `seller_commission_rates`, `cash_counts`, `cash_expenses`, `vouchers`, `payment_aliases` (opcionales: si una no existe en la base se omite y se avisa).

El JSON incluye datos personales de clientes (DNI, teléfonos y la columna `password` de `wholesale_clients`). Los archivos de respaldo se guardan con cuidado y no se comparten.

Archivos generados (mismo formato en el panel y en el print-agent):
- `backup_dulce_valentin_<AAAA-MM-DD_HH-MM-SS>.json`: copia completa fechada (hora de Argentina).
- `base_completa_reciente.json`: siempre la última copia buena.
- `catalogo_productos_<fecha>.csv`, `stock_por_talle_y_color_<fecha>.csv`, `ventas_y_pedidos_<fecha>.csv`, `clientes_y_contactos_<fecha>.csv`: para Excel (UTF-8 con BOM, separador `;`).
- `estado_respaldo.json` (solo en el print-agent): resultado del último intento.

---

### 3. Componentes

#### 3.1. Armado del respaldo — `src/lib/backupBuilder.js`
Función `buildBackup()` compartida por las dos rutas. Requiere `SUPABASE_SERVICE_ROLE_KEY`: sin ella da un error, en vez de traer datos parciales con la clave pública.

#### 3.2. Botón del panel — `POST /api/admin/backups/export`
- Requiere sesión de administradora.
- Devuelve el snapshot. El navegador lo guarda en IndexedDB y descarga el JSON y la planilla de stock.
- Solo escribe en disco si el servidor corre en una PC (por ejemplo `npm run dev`). En Vercel avisa que no lo hizo.

#### 3.3. Punto local — `print-agent/backup.js` + `GET /api/admin/backups/agent`
- Corre dentro del mismo agente de impresión (`npm start`) o suelto (`npm run backup`).
- Se autentica con el header `x-agent-secret` (`BACKUP_AGENT_SECRET` o, si no está, `PRINT_AGENT_SECRET`). Ese secreto da acceso a toda la base.
- Se baja en dos partes (`?part=snapshot` y `?part=csv`) para no pasar el límite de tamaño de respuesta de Vercel.
- Escribe a un `.tmp` y después renombra: un corte de luz a mitad de la escritura no daña la copia anterior.
- Rota las copias y guarda las últimas `BACKUP_KEEP` (30). Configuración en `print-agent/.env`.
- Sin internet, ese intento falla y la última copia buena queda intacta.

#### 3.4. Panel y caja abren sin internet — `public/sw.js` (v2)
- `/admin` y `/caja`: se guarda solo el "cascarón" HTML, que no trae datos, en un cache que no se recorta. Las respuestas de `/api` nunca se guardan.
- La navegación espera 8 s a la red y después usa la copia guardada (caso de wifi conectado pero sin internet).
- Condición: el panel y la caja tienen que haberse abierto **al menos una vez con internet en ese equipo**, y en producción (en `npm run dev` el service worker no se registra).
- Sin conexión, el panel entra con el último rol de administradora verificado en ese navegador y abre directo en "Respaldo & Modo Local".

#### 3.5. Caja sin internet — `src/lib/posOffline.js` + `src/app/caja/page.jsx`
- **Detección automática** (`navigator.onLine` y fallas de red). No hay que activar ningún modo a mano.
- **Catálogo:** copia en IndexedDB que se actualiza sola cada vez que la caja carga productos con internet. Si nunca se guardó, usa el respaldo del panel.
- **Usuario:** se entra con el último usuario verificado en ese equipo. El primer ingreso necesita internet.
- **Ventas:** se guardan en una cola con número `OFF-XXXXXXXX`. Se controla el stock contra la copia, descontando lo ya vendido en la cola. El ticket se imprime igual.
- **Cobro:** de ventas de la cola o de ventas ya subidas (se encola solo el cobro).
- **Escaneo:** primero busca en el catálogo cargado (`products.barcodes` o código de artículo), así que anda con y sin internet.
- **Subida automática** al volver internet, cada 8 s mientras haya pendientes, o con "Subir ahora":
  - El servidor usa el `OFF-` como id de la venta: un reenvío **no duplica** ni descuenta stock dos veces.
  - Se respetan la fecha y hora reales de la venta y del cobro, para que caigan en el día correcto del cierre y las comisiones.
  - Si el servidor la rechaza (por ejemplo, esa prenda se vendió por la web mientras tanto), queda marcada con el error y la caja elige **Reintentar** o **Descartar**.
  - Si el precio cambió entre la copia y la subida, la venta queda con el precio actual y la caja recibe un aviso con la diferencia.
- **Límites:** no se pueden ver el cierre ni las comisiones, ni cancelar ventas ya subidas, hasta que vuelva internet. Las ventas de un equipo sin conexión solo se ven en ese equipo hasta que se suben.

---

### 4. Puesta en marcha

1. **Vercel:** verificar `SUPABASE_SERVICE_ROLE_KEY` y `PRINT_AGENT_SECRET` (opcional: `BACKUP_AGENT_SECRET`).
2. **PC del local:** actualizar la carpeta `print-agent`, correr `npm install` y reiniciar el agente. Probar con `npm run backup` y verificar que aparezcan los archivos en `Backups_DulceValentin`.
3. **Cada equipo de caja:** abrir `/caja` (y `/admin` en la PC de administración) una vez con internet, después del deploy, para que quede guardado para usar sin conexión.

### 5. Si se corta internet en el local

1. La caja muestra el aviso amarillo **"Sin conexión"**. Se sigue vendiendo y cobrando normal.
2. Las ventas aparecen con la etiqueta **"☁ Sin subir"**.
3. Al volver internet se suben solas. Si alguna muestra **"⚠ No se pudo subir"**, revisarla y tocar Reintentar o Descartar.
4. Para consultar precios y stock desde el panel: **Respaldo & Modo Local → Visor de Contingencia Offline**.
