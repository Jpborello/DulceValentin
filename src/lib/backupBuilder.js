// Arma el respaldo completo de la base (snapshot JSON + planillas CSV).
// Lo usan dos rutas:
//  - /api/admin/backups/export: boton "Respaldar en 1 clic" del panel.
//  - /api/admin/backups/agent: el print-agent de la PC del local, que guarda
//    la copia en el disco de esa PC (el servidor esta en Vercel y no puede).
// Solo servidor: usa la service role key.
import { createClient } from '@supabase/supabase-js';
import { getProductVariants } from '@/lib/barcode';
import { generateCsv } from '@/lib/localDatabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Sin la service role key, las politicas RLS devolverian datos parciales
// sin dar error, y el respaldo quedaria incompleto sin que nadie lo note.
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

// Supabase devuelve como maximo 1000 filas por consulta: se pide de a paginas.
const PAGE_SIZE = 1000;

// Errores de PostgREST/Postgres que significan "la tabla no existe".
const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01']);

/**
 * Trae TODAS las filas de una tabla, paginando. Si la tabla es opcional y no
 * existe, devuelve { missing: true }. Cualquier otro error corta el respaldo:
 * es preferible no respaldar a guardar una copia vacia o cortada que pise
 * a la buena.
 */
async function fetchAllRows(table, orderBy = [], { optional = false } = {}) {
  const rows = [];
  let expected = null;

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabaseAdmin
      .from(table)
      .select('*', from === 0 ? { count: 'exact' } : undefined)
      .range(from, from + PAGE_SIZE - 1);
    orderBy.forEach(([col, ascending]) => {
      query = query.order(col, { ascending });
    });

    const { data, error, count } = await query;
    if (error) {
      if (optional && MISSING_TABLE_CODES.has(error.code)) return { rows: [], missing: true };
      throw new Error(`No se pudo leer la tabla "${table}": ${error.message}`);
    }
    if (from === 0) expected = count;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  if (expected !== null && rows.length !== expected) {
    throw new Error(
      `La tabla "${table}" devolvió ${rows.length} filas pero tiene ${expected}. Respaldo cancelado para no guardar una copia incompleta.`
    );
  }
  return { rows, missing: false };
}

// Tablas respaldadas: [clave en snapshot.data, tabla, orden, opcional]
const BACKUP_TABLES = [
  ['products', 'products', [['name', true], ['id', true]], false],
  ['wholesaleClients', 'wholesale_clients', [['created_at', false]], false],
  ['orders', 'orders', [['created_at', false], ['id', false]], false],
  ['posShifts', 'pos_shifts', [['opened_at', false], ['id', false]], true],
  ['posCashiers', 'pos_cashiers', [['code', true], ['id', true]], true],
  ['posConfig', 'pos_config', [['key', true]], true],
  ['categories', 'categories', [['name', true]], false],
  ['raffleTickets', 'raffle_tickets', [['ticket_number', true]], true],
  ['stockMovements', 'stock_movements', [['created_at', false], ['id', false]], true],
  ['productSuppliers', 'product_suppliers', [], true],
  ['productBarcodes', 'product_barcodes', [['barcode', true]], true],
  ['staff', 'staff', [['id', true]], true],
  ['sellerSales', 'seller_sales', [['id', true]], true],
  ['sellerAdvances', 'seller_advances', [['id', true]], true],
  ['sellerPayouts', 'seller_payouts', [['id', true]], true],
  ['sellerCommissionRates', 'seller_commission_rates', [['seller_id', true], ['effective_date', true]], true],
  ['cashCounts', 'cash_counts', [['id', true]], true],
  ['cashExpenses', 'cash_expenses', [['id', true]], true],
  ['vouchers', 'vouchers', [['id', true]], true],
  ['paymentAliases', 'payment_aliases', [['id', true]], true]
];


export function isBackupConfigured() {
  return Boolean(supabaseAdmin);
}

/**
 * Lee todas las tablas y arma el snapshot y los CSV. Tira un error si
 * cualquier tabla obligatoria falla o vuelve incompleta.
 */
export async function buildBackup() {
  if (!supabaseAdmin) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el servidor: sin ella el respaldo saldría incompleto.');
  }

  {
    // 1. Extracción completa (paginada) en paralelo desde Supabase
    const results = await Promise.all(
      BACKUP_TABLES.map(([, table, orderBy, optional]) => fetchAllRows(table, orderBy, { optional }))
    );

    const data = {};
    const missingTables = [];
    BACKUP_TABLES.forEach(([key, table], i) => {
      data[key] = results[i].rows;
      if (results[i].missing) missingTables.push(table);
    });

    const {
      products,
      wholesaleClients,
      orders,
      posShifts,
      posCashiers,
      categories,
      raffleTickets,
      stockMovements
    } = data;

    // Calcular estadísticas consolidadas
    const totalStock = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

    // Consolidar directorio unificado de clientes (wholesale_clients + clientes de orders)
    const clientMap = new Map();

    wholesaleClients.forEach((wc) => {
      const phoneClean = String(wc.phone || '').replace(/\D/g, '');
      const key = phoneClean || String(wc.name || '').trim().toLowerCase();
      if (!key) return;
      clientMap.set(key, {
        nombre: wc.name || 'Cliente Mayorista',
        telefono: wc.phone || '',
        dni: wc.dni || '',
        localidad: wc.locality || '',
        pedidos_count: 0,
        total_gastado: 0,
        registrado: 'SÍ',
        fecha_alta: wc.created_at ? new Date(wc.created_at).toLocaleDateString('es-AR') : ''
      });
    });

    orders.forEach((o) => {
      const phoneClean = String(o.client_phone || '').replace(/\D/g, '');
      const key = phoneClean || String(o.client_name || '').trim().toLowerCase();
      if (!key) return;

      const existing = clientMap.get(key) || {
        nombre: o.client_name || 'Cliente',
        telefono: o.client_phone || '',
        dni: o.client_dni || '',
        localidad: o.client_locality || '',
        pedidos_count: 0,
        total_gastado: 0,
        registrado: 'NO',
        fecha_alta: o.created_at ? new Date(o.created_at).toLocaleDateString('es-AR') : ''
      };

      existing.pedidos_count += 1;
      existing.total_gastado += Number(o.total_amount) || 0;
      if (!existing.dni && o.client_dni) existing.dni = o.client_dni;
      if (!existing.localidad && o.client_locality) existing.localidad = o.client_locality;

      clientMap.set(key, existing);
    });

    const consolidatedClients = Array.from(clientMap.values());

    // 2. Fechas en hora de Argentina (el servidor de Vercel corre en UTC):
    //    "2026-11-17 15:04:09" -> dateStr "2026-11-17", timestamp "2026-11-17_15-04-09"
    const now = new Date();
    const localStamp = now.toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
    const dateStr = localStamp.slice(0, 10);
    const timestamp = `${dateStr}_${localStamp.slice(11, 19).replace(/:/g, '-')}`;

    // 3. Crear Snapshot JSON maestro
    const snapshot = {
      version: '1.0.0-local-first',
      system: 'Dulce Valentín - Blindaje Local-First',
      exportedAt: now.toISOString(),
      windowsPath: null, // se completa solo si de verdad se escribio en disco
      missingTables,
      counts: {
        products: products.length,
        totalStock,
        clients: consolidatedClients.length,
        orders: orders.length,
        posShifts: posShifts.length,
        posCashiers: posCashiers.length,
        categories: categories.length,
        raffleTickets: raffleTickets.length,
        stockMovements: stockMovements.length
      },
      data
    };

    // 5. Generar Planillas CSV compatibles con Excel en español (\uFEFF + ;)
    // A. Catálogo General de Productos
    const rowsCatalogo = products.map((p) => ({
      codigo: p.code || '',
      nombre: p.name || '',
      categoria: p.category || '',
      subcategoria: p.subcategory || '',
      precio_minorista: Number(p.price || 0),
      precio_mayorista: Number(p.wholesale_price || 0),
      stock: Number(p.stock || 0),
      ventas: Number(p.sales_count || 0),
      talles: Array.isArray(p.sizes) ? p.sizes.join(', ') : '',
      colores: Array.isArray(p.colors) ? p.colors.join(', ') : '',
      activo: p.is_active !== false,
      ultima_actualizacion: p.updated_at ? new Date(p.updated_at).toLocaleString('es-AR') : ''
    }));

    const csvCatalogo = generateCsv(rowsCatalogo, [
      { key: 'codigo', label: 'Código Artículo' },
      { key: 'nombre', label: 'Nombre de la Prenda' },
      { key: 'categoria', label: 'Categoría' },
      { key: 'subcategoria', label: 'Subcategoría' },
      { key: 'precio_minorista', label: 'Precio Minorista ($)' },
      { key: 'precio_mayorista', label: 'Precio Mayorista ($)' },
      { key: 'stock', label: 'Stock Total' },
      { key: 'ventas', label: 'Ventas Acumuladas' },
      { key: 'talles', label: 'Talles Disponibles' },
      { key: 'colores', label: 'Colores Disponibles' },
      { key: 'activo', label: 'Activo para Venta' },
      { key: 'ultima_actualizacion', label: 'Última Actualización' }
    ]);

    // B. Stock Físico Detallado por Talle y Color (con Código de Barras asignado)
    const rowsStockVariantes = [];
    products.forEach((p) => {
      const variants = getProductVariants(p);
      const barcodes = p.barcodes || {};

      if (variants && variants.length > 0) {
        variants.forEach((v) => {
          rowsStockVariantes.push({
            codigo_articulo: p.code || '',
            nombre_prenda: p.name || '',
            categoria: p.category || '',
            talle: v.size || 'Único',
            color: v.color || 'Único',
            stock_disponible: Number(v.stock) || 0,
            codigo_barras: barcodes[v.key] || barcodes['CUALQUIER_TALLE'] || '',
            precio_minorista: Number(v.price || p.price || 0),
            precio_mayorista: Number(p.wholesale_price || 0)
          });
        });
      } else {
        rowsStockVariantes.push({
          codigo_articulo: p.code || '',
          nombre_prenda: p.name || '',
          categoria: p.category || '',
          talle: 'Único',
          color: 'Único',
          stock_disponible: Number(p.stock) || 0,
          codigo_barras: barcodes['CUALQUIER_TALLE'] || '',
          precio_minorista: Number(p.price || 0),
          precio_mayorista: Number(p.wholesale_price || 0)
        });
      }
    });

    const csvStockVariantes = generateCsv(rowsStockVariantes, [
      { key: 'codigo_articulo', label: 'Código de Prenda' },
      { key: 'nombre_prenda', label: 'Artículo' },
      { key: 'categoria', label: 'Categoría' },
      { key: 'talle', label: 'Talle' },
      { key: 'color', label: 'Color' },
      { key: 'stock_disponible', label: 'Stock Disponible' },
      { key: 'codigo_barras', label: 'Código de Barras (EAN/UPC)' },
      { key: 'precio_minorista', label: 'Precio Minorista ($)' },
      { key: 'precio_mayorista', label: 'Precio Mayorista ($)' }
    ]);

    // C. Ventas y Pedidos
    const rowsVentas = orders.map((o) => {
      let itemsResumen = '';
      if (Array.isArray(o.items)) {
        itemsResumen = o.items
          .map((item) => `${item.quantity || 1}x ${item.name || item.title || 'Prenda'} ${item.size ? `(T.${item.size})` : ''} ${item.color ? `[${item.color}]` : ''}`)
          .join(' | ');
      }

      return {
        id: o.id || '',
        fecha: o.created_at ? new Date(o.created_at).toLocaleString('es-AR') : '',
        cliente: o.client_name || 'Sin identificar',
        telefono: o.client_phone || '',
        dni: o.client_dni || '',
        localidad: o.client_locality || '',
        direccion: o.client_address || '',
        canal: o.channel || 'web',
        medio_pago: o.payment_method || 'no especificado',
        total: Number(o.total_amount) || 0,
        prendas: Array.isArray(o.items) ? o.items.reduce((s, it) => s + (Number(it.quantity) || 1), 0) : 0,
        es_mayorista: o.is_wholesale ? 'SÍ' : 'NO',
        descuento: Number(o.discount_applied) || 0,
        estado: o.status || 'pendiente',
        cajera_vendedora: o.cashier_id || o.seller_id || '',
        detalle_prendas: itemsResumen,
        notas: o.admin_notes || o.customer_notes || ''
      };
    });

    const csvVentas = generateCsv(rowsVentas, [
      { key: 'id', label: 'Nro de Pedido/Ticket' },
      { key: 'fecha', label: 'Fecha y Hora' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'dni', label: 'DNI' },
      { key: 'localidad', label: 'Localidad' },
      { key: 'direccion', label: 'Dirección' },
      { key: 'canal', label: 'Canal de Venta' },
      { key: 'medio_pago', label: 'Medio de Pago' },
      { key: 'total', label: 'Total Abonado ($)' },
      { key: 'prendas', label: 'Cant. Prendas' },
      { key: 'es_mayorista', label: 'Es Mayorista' },
      { key: 'descuento', label: 'Descuento ($)' },
      { key: 'estado', label: 'Estado' },
      { key: 'cajera_vendedora', label: 'Cajera / Vendedora' },
      { key: 'detalle_prendas', label: 'Detalle de Prendas Compradas' },
      { key: 'notas', label: 'Notas' }
    ]);

    // D. Directorio de Clientes y Contactos
    const csvClientes = generateCsv(consolidatedClients, [
      { key: 'nombre', label: 'Nombre y Apellido' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'dni', label: 'DNI' },
      { key: 'localidad', label: 'Localidad' },
      { key: 'pedidos_count', label: 'Cantidad de Compras' },
      { key: 'total_gastado', label: 'Total Gastado Histórico ($)' },
      { key: 'registrado', label: 'Usuario Registrado' },
      { key: 'fecha_alta', label: 'Fecha de Registro' }
    ]);


    return {
      snapshot,
      timestamp,
      dateStr,
      missingTables,
      csvFiles: {
        catalogo: csvCatalogo,
        stockVariantes: csvStockVariantes,
        ventas: csvVentas,
        clientes: csvClientes
      }
    };
  }
}
