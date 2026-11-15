import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';
import { getProductVariants } from '@/lib/barcode';
import { generateCsv } from '@/lib/localDatabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://revrbrrzlnweuxwhpgei.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function POST(req) {
  // Verificar autenticación de administrador
  const denied = await requireAdmin(req, supabaseAdmin);
  if (denied) return denied;

  try {
    // 1. Extracción masiva en paralelo desde Supabase
    const [
      prodRes,
      clientsRes,
      ordersRes,
      shiftsRes,
      cashiersRes,
      configRes,
      catRes,
      raffleRes,
      movementsRes,
      suppliersRes
    ] = await Promise.all([
      supabaseAdmin.from('products').select('*').order('name', { ascending: true }),
      supabaseAdmin.from('wholesale_clients').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('pos_shifts').select('*').order('opened_at', { ascending: false }),
      supabaseAdmin.from('pos_cashiers').select('*').order('code', { ascending: true }),
      supabaseAdmin.from('pos_config').select('*'),
      supabaseAdmin.from('categories').select('*').order('name', { ascending: true }),
      supabaseAdmin.from('raffle_tickets').select('*').order('ticket_number', { ascending: true }),
      supabaseAdmin.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(1000),
      supabaseAdmin.from('product_suppliers').select('*')
    ]);

    const products = prodRes.data || [];
    const wholesaleClients = clientsRes.data || [];
    const orders = ordersRes.data || [];
    const posShifts = shiftsRes.data || [];
    const posCashiers = cashiersRes.data || [];
    const posConfig = configRes.data || [];
    const categories = catRes.data || [];
    const raffleTickets = raffleRes.data || [];
    const stockMovements = movementsRes.data || [];
    const productSuppliers = suppliersRes.data || [];

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

    // 2. Preparar fechas y sellos de tiempo
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const timestamp = `${dateStr}_${timeStr}`;

    // 3. Detección de carpeta de usuario en Windows (o SO anfitrión)
    const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir();
    const backupDir = path.join(homeDir, 'Backups_DulceValentin');

    let savedToDisk = false;
    let diskError = null;
    let savedMasterJsonPath = '';

    // 4. Crear Snapshot JSON maestro
    const snapshot = {
      version: '1.0.0-local-first',
      system: 'Dulce Valentín - Blindaje Local-First',
      exportedAt: now.toISOString(),
      windowsPath: backupDir,
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
      data: {
        products,
        wholesaleClients,
        orders,
        posShifts,
        posCashiers,
        posConfig,
        categories,
        raffleTickets,
        stockMovements,
        productSuppliers
      }
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

    // 6. Escribir en la carpeta física de Windows
    try {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      savedMasterJsonPath = path.join(backupDir, `backup_dulce_valentin_${timestamp}.json`);
      const recentJsonPath = path.join(backupDir, 'base_completa_reciente.json');
      const jsonString = JSON.stringify(snapshot, null, 2);

      // JSON maestro fechado y reciente
      fs.writeFileSync(savedMasterJsonPath, jsonString, 'utf8');
      fs.writeFileSync(recentJsonPath, jsonString, 'utf8');

      // CSVs tabulares para Excel
      fs.writeFileSync(path.join(backupDir, `catalogo_productos_${dateStr}.csv`), csvCatalogo, 'utf8');
      fs.writeFileSync(path.join(backupDir, `stock_por_talle_y_color_${dateStr}.csv`), csvStockVariantes, 'utf8');
      fs.writeFileSync(path.join(backupDir, `ventas_y_pedidos_${dateStr}.csv`), csvVentas, 'utf8');
      fs.writeFileSync(path.join(backupDir, `clientes_y_contactos_${dateStr}.csv`), csvClientes, 'utf8');

      savedToDisk = true;
    } catch (fsErr) {
      console.warn('Advertencia al escribir en disco físico:', fsErr?.message);
      diskError = fsErr?.message || 'Error de escritura en disco';
    }

    return NextResponse.json({
      success: true,
      savedToDisk,
      diskError,
      backupDir,
      filePath: savedMasterJsonPath,
      timestamp,
      counts: snapshot.counts,
      snapshot,
      csvFiles: {
        catalogo: csvCatalogo,
        stockVariantes: csvStockVariantes,
        ventas: csvVentas,
        clientes: csvClientes
      }
    });
  } catch (error) {
    console.error('Error generando respaldo local de Dulce Valentín:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno al exportar respaldo' },
      { status: 500 }
    );
  }
}

