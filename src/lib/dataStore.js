import { supabase } from './supabaseClient';
import { normalizePhone } from './phoneUtils';
import {
  CATALOG_PRODUCTS,
  CATALOG_CATEGORIES,
  normalizeSubcategory,
  isRetiredSubcategory
} from './catalogData';

export const INITIAL_PRODUCTS = CATALOG_PRODUCTS;
export const CATEGORIES = CATALOG_CATEGORIES;

// In-Memory / LocalStorage State Manager with Supabase Mirror
class DataStore {
  constructor() {
    this.products = [...INITIAL_PRODUCTS].map(p => ({ sales_count: 0, ...p }));
    this.currentUser = typeof window !== 'undefined' && localStorage.getItem('dulcevalentin_current_user')
      ? JSON.parse(localStorage.getItem('dulcevalentin_current_user'))
      : null;
    this.activeOrder = typeof window !== 'undefined' && localStorage.getItem('dulcevalentin_active_order')
      ? JSON.parse(localStorage.getItem('dulcevalentin_active_order'))
      : null;
    this.clients = [];
    this.orders = [];
    this.raffleTickets = [];
    this.cashMovements = [];
    this.categories = CATALOG_CATEGORIES.filter(c => c.id !== 'all');
    this.transferAlias1 = 'alias.dulcevalentin.completar';
    this.transferAlias2 = 'alias.dulcevalentin.completar';
    this.transferHolder = '[Titular de la cuenta — COMPLETAR]';
    this.transferCuit = '[CUIT — COMPLETAR]';
    this.transferAlias = 'alias.dulcevalentin.completar';
    this.listeners = [];
    
    this.loadProductsFromLocalStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'dulcevalentin_products_overrides') {
          this.loadProductsFromLocalStorage();
          this.notify();
        }
      });
    }

    this.initFromSupabase();
  }

  saveProductsToLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      const overrides = {};
      this.products.forEach(p => {
        overrides[p.id] = {
          price: p.price,
          wholesale_price: p.wholesale_price,
          stock: p.stock,
          image_url: p.image_url,
          is_offer: p.is_offer,
          colors: p.colors
        };
      });
      localStorage.setItem('dulcevalentin_products_overrides', JSON.stringify(overrides));
    } catch (e) {
      console.warn('LocalStorage save products warning:', e);
    }
  }

  loadProductsFromLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('dulcevalentin_products_overrides');
      if (stored) {
        const overrides = JSON.parse(stored);
        if (overrides && typeof overrides === 'object') {
          this.products = this.products.map(p => {
            if (overrides[p.id]) {
              return { ...p, ...overrides[p.id] };
            }
            return p;
          });
        }
      }
    } catch (e) {
      console.warn('LocalStorage load products warning:', e);
    }
  }

  // Seed any missing catalog rows once (never overwrites existing data),
  // then pull the real, current state from Supabase so admin edits
  // (precio, stock, categorías nuevas, etc.) siempre prevalecen.
  async initFromSupabase() {
    await this.seedMissingCatalogInSupabase();
    await Promise.all([
      this.fetchProductsFromSupabase(),
      this.fetchCategoriesFromSupabase(),
      this.fetchOrdersFromSupabase(),
      this.fetchClientsFromSupabase(),
      this.fetchRaffleTicketsFromSupabase()
    ]);
  }

  // Boletos del sorteo (numero + a que pedido/cliente quedaron atados).
  // Se guardan en su propia tabla (no como campo de `orders`) porque asi la
  // base puede exigir con una clave primaria que dos boletos nunca compartan
  // numero — antes esto se generaba con Math.random() en el navegador, sin
  // guardarse en ningun lado y sin ningun control de que no se repitiera.
  async fetchRaffleTicketsFromSupabase() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('raffle_tickets').select('*').order('ticket_number', { ascending: true });
      if (data && !error) {
        this.raffleTickets = data;
        this.notify();
      }
    } catch (err) {
      console.warn('Supabase raffle tickets fetch warning:', err);
    }
  }

  async fetchOrdersFromSupabase() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (data && !error && data.length > 0) {
        this.orders = data;
        this.notify();
      }
    } catch (err) {
      console.warn('Supabase orders fetch warning:', err);
    }
  }

  // Llamado desde el listener de Supabase Realtime cuando entra un pedido
  // nuevo mientras el panel admin está abierto (dispara la alerta sonora).
  handleRealtimeOrderInsert(row) {
    if (!row || this.orders.some(o => o.id === row.id)) return;
    this.orders = [row, ...this.orders];
    this.notify();
  }

  // Llamado desde el listener de Supabase Realtime cuando se asigna un
  // boleto nuevo (compra en vivo mientras el admin tiene abierta la pestaña
  // "Sorteo en Vivo" para transmitir por Instagram) — asi el boleto aparece
  // solo, sin que el admin tenga que refrescar en medio de la transmision.
  handleRealtimeTicketInsert(row) {
    if (!row || this.raffleTickets.some(t => t.ticket_number === row.ticket_number)) return;
    this.raffleTickets = [...this.raffleTickets, row];
    this.notify();
  }

  async fetchClientsFromSupabase() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('wholesale_clients').select('*').order('created_at', { ascending: false });
      if (data && !error && data.length > 0) {
        this.clients = data;
        this.notify();
      }
    } catch (err) {
      console.warn('Supabase clients fetch warning:', err);
    }
  }

  // Inserta en Supabase los productos/categorías del catálogo de código que
  // todavía no existan en la base. Usa ignoreDuplicates para que NUNCA
  // pise precios, stock o categorías que ya haya editado el admin.
  async seedMissingCatalogInSupabase() {
    if (!supabase) return;
    try {
      const categoriesToSeed = CATALOG_CATEGORIES.filter(c => c.id !== 'all').map(c => ({
        id: c.id,
        name: c.name,
        subcategories: c.subcategories
      }));

      await supabase.from('categories').upsert(categoriesToSeed, { onConflict: 'id', ignoreDuplicates: true });

      // `code` ya es una columna real en Supabase (antes se excluia a
      // proposito porque no existia); ahora se manda igual que el resto.
      const productsToSeed = CATALOG_PRODUCTS.map(({ sizes, stock_per_size, ...dbFields }) => dbFields);
      await supabase.from('products').upsert(productsToSeed, { onConflict: 'id', ignoreDuplicates: true });
    } catch (err) {
      console.warn('Supabase catalog seed warning:', err);
    }
  }

  // Trae el estado real de productos desde Supabase (precio, stock,
  // ventas, etc.) y lo combina con los campos que solo existen en el
  // código (talles, stock por talle) para no romper el selector de talles.
  async fetchProductsFromSupabase() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (!data || error) return;

      const dbById = new Map(data.map(p => [p.id, p]));

      // La base de datos de Supabase es la fuente de verdad definitiva.
      // Hasta 29/8 esto todavia tenia un fallback a catalogData.js para
      // sizes/stock_per_size/colors, porque parte del catalogo viejo no
      // tenia esos campos cargados en la base. Ya se completaron los 14
      // productos que faltaban (ver memoria de unificacion de catalogo),
      // asi que ahora se confia directo en lo que trae la base sin excepcion.
      const merged = this.products.map(localP => {
        const dbP = dbById.get(localP.id);
        if (!dbP) return localP;
        return {
          ...localP,
          ...dbP,
          price: Number(dbP.price),
          wholesale_price: Number(dbP.wholesale_price),
          stock: Number(dbP.stock),
          sales_count: dbP.sales_count ?? 0
        };
      });

      const localIds = new Set(this.products.map(p => p.id));
      const extraFromDb = data
        .filter(p => !localIds.has(p.id))
        .map(p => ({ 
          ...p, 
          price: Number(p.price), 
          wholesale_price: Number(p.wholesale_price),
          stock: Number(p.stock),
          sales_count: p.sales_count ?? 0 
        }));

      this.products = [...merged, ...extraFromDb];
      this.saveProductsToLocalStorage();
      this.notify();
    } catch (err) {
      console.warn('Supabase products fetch warning:', err);
    }
  }

  async fetchCategoriesFromSupabase() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('categories').select('*');
      if (data && data.length > 0 && !error) {
        const alias1Row = data.find(item => item.id === '_config_alias1') || data.find(item => item.id === '_config_alias');
        const alias2Row = data.find(item => item.id === '_config_alias2');
        const holderRow = data.find(item => item.id === '_config_holder');
        const cuitRow = data.find(item => item.id === '_config_cuit');

        if (alias1Row?.name) this.transferAlias1 = alias1Row.name;
        if (alias2Row?.name) this.transferAlias2 = alias2Row.name;
        if (holderRow?.name) this.transferHolder = holderRow.name;
        if (cuitRow?.name) this.transferCuit = cuitRow.name;

        const normStr = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const catMap = new Map();

        data
          .filter(item => !item.id.startsWith('_config_'))
          .forEach(item => {
            const rawSubcats = Array.isArray(item.subcategories)
              ? item.subcategories
              : (typeof item.subcategories === 'string' ? JSON.parse(item.subcategories) : []);
            const cleanSubcats = rawSubcats.map(s => (s || '').trim()).filter(Boolean);

            const key = normStr(item.name || item.id);
            if (!key) return;

            if (!catMap.has(key)) {
              catMap.set(key, {
                id: item.id,
                name: item.name,
                subcategories: Array.from(new Set(cleanSubcats))
              });
            } else {
              const existing = catMap.get(key);
              const mergedSubcats = Array.from(new Set([
                ...(existing.subcategories || []),
                ...cleanSubcats
              ]));
              catMap.set(key, {
                ...existing,
                name: item.name && item.name.length >= existing.name.length ? item.name : existing.name,
                subcategories: mergedSubcats
              });
            }
          });

        this.categories = Array.from(catMap.values());
        this.notify();
      }
    } catch (err) {
      console.warn('Supabase categories fetch warning:', err);
    }
  }

  getTransferDetails() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('dulcevalentin_transfer_details');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.alias1 || parsed.alias2)) {
            return {
              alias1: parsed.alias1 || this.transferAlias1 || 'alias.dulcevalentin.completar',
              alias2: parsed.alias2 || this.transferAlias2 || 'alias.dulcevalentin.completar',
              holder: parsed.holder || this.transferHolder || 'María Leandra Bernardi',
              cuit: parsed.cuit || this.transferCuit || '27-30938323-6'
            };
          }
        }
      } catch (e) {}
    }
    return {
      alias1: this.transferAlias1 || 'alias.dulcevalentin.completar',
      alias2: this.transferAlias2 || 'alias.dulcevalentin.completar',
      holder: this.transferHolder || 'María Leandra Bernardi',
      cuit: this.transferCuit || '27-30938323-6'
    };
  }

  setTransferDetails({ alias1, alias2, holder, cuit }) {
    const current = this.getTransferDetails();
    const updated = {
      alias1: alias1 !== undefined ? (alias1 || '').trim().toLowerCase() : current.alias1,
      alias2: alias2 !== undefined ? (alias2 || '').trim().toLowerCase() : current.alias2,
      holder: holder !== undefined ? (holder || '').trim() : current.holder,
      cuit: cuit !== undefined ? (cuit || '').trim() : current.cuit
    };

    this.transferAlias1 = updated.alias1;
    this.transferAlias2 = updated.alias2;
    this.transferHolder = updated.holder;
    this.transferCuit = updated.cuit;

    if (typeof window !== 'undefined') {
      localStorage.setItem('dulcevalentin_transfer_details', JSON.stringify(updated));
    }

    if (supabase) {
      supabase.from('categories').upsert([
        { id: '_config_alias1', name: updated.alias1, subcategories: [] },
        { id: '_config_alias2', name: updated.alias2, subcategories: [] },
        { id: '_config_holder', name: updated.holder, subcategories: [] },
        { id: '_config_cuit', name: updated.cuit, subcategories: [] }
      ]).then(() => {}).catch(() => {});
    }

    this.notify();
  }

  getTransferAlias() {
    return this.getTransferDetails().alias1;
  }

  setTransferAlias(newAlias) {
    this.setTransferDetails({ alias1: newAlias });
  }

  // Visits Counter (Hoy / Semana / Mes / Total, via tabla page_visits)
  applyVisitStats(data) {
    if (!data || typeof data.total !== 'number') return;
    this.visitStats = { today: data.today || 0, week: data.week || 0, month: data.month || 0 };
    this.visitCount = data.total;
    this.visitsByRegion = Array.isArray(data.byRegion) ? data.byRegion : [];
    if (typeof window !== 'undefined') {
      localStorage.setItem('dulcevalentin_visit_count', data.total.toString());
      localStorage.setItem('dulcevalentin_visit_stats', JSON.stringify(this.visitStats));
      localStorage.setItem('dulcevalentin_visit_by_region', JSON.stringify(this.visitsByRegion));
    }
    this.notify();
  }

  recordVisit() {
    if (typeof window === 'undefined') return;
    try {
      if (!sessionStorage.getItem('dulcevalentin_visit_counted')) {
        sessionStorage.setItem('dulcevalentin_visit_counted', '1');
        fetch('/api/visit', { method: 'POST' })
          .then(res => res.json())
          .then(data => this.applyVisitStats(data))
          .catch(() => {});
      } else {
        this.fetchVisitCountFromSupabase();
      }
    } catch (e) {
      console.warn('Visit counter error:', e);
    }
  }

  async fetchVisitCountFromSupabase() {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/visit');
      if (res.ok) this.applyVisitStats(await res.json());
    } catch (err) {}
  }

  getVisitCount() {
    if (typeof window !== 'undefined' && !this.visitCount) {
      this.visitCount = parseInt(localStorage.getItem('dulcevalentin_visit_count') || '0', 10);
    }
    return this.visitCount || 0;
  }

  getVisitStats() {
    if (typeof window !== 'undefined' && !this.visitStats) {
      try {
        this.visitStats = JSON.parse(localStorage.getItem('dulcevalentin_visit_stats') || 'null');
      } catch (e) {}
    }
    return this.visitStats || { today: 0, week: 0, month: 0 };
  }

  getVisitsByRegion() {
    if (typeof window !== 'undefined' && !this.visitsByRegion) {
      try {
        this.visitsByRegion = JSON.parse(localStorage.getItem('dulcevalentin_visit_by_region') || 'null');
      } catch (e) {}
    }
    return this.visitsByRegion || [];
  }

  getCategories() {
    const normStr = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const categoryCounts = {};
    this.products.forEach(p => {
      if (p.category) {
        const key = normStr(p.category);
        categoryCounts[key] = (categoryCounts[key] || 0) + 1;
        categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
      }
    });

    const catMap = new Map();
    this.categories.forEach(c => {
      const key = normStr(c.name || c.id);
      if (!key) return;
      const count = categoryCounts[c.id] || categoryCounts[c.name] || categoryCounts[key] || 0;
      if (!catMap.has(key)) {
        catMap.set(key, {
          ...c,
          count
        });
      } else {
        const existing = catMap.get(key);
        const mergedSubcats = Array.from(new Set([
          ...(existing.subcategories || []),
          ...(c.subcategories || [])
        ]));
        catMap.set(key, {
          ...existing,
          subcategories: mergedSubcats,
          count: (existing.count || 0) + count
        });
      }
    });

    // Ultimo paso: aplicar los renombres y las bajas de subcategorias. Va aca
    // (y no en el fetch) porque este es el unico embudo por el que la UI ve las
    // categorias, vengan del catalogo de codigo o de Supabase — y el merge de
    // Supabase suma subcategorias pero nunca borra, asi que sin esto una
    // subcategoria dada de baja reaparece en cuanto la base la sigue teniendo.
    const cleaned = Array.from(catMap.values()).map((c) => {
      const catName = c.name || c.id;
      const subs = (c.subcategories || [])
        .filter((sub) => !isRetiredSubcategory(catName, sub))
        .map((sub) => normalizeSubcategory(catName, sub));
      return { ...c, subcategories: Array.from(new Set(subs)) };
    });

    return [
      { id: 'all', name: 'Todos los Productos', count: this.products.length },
      ...cleaned
    ];
  }

  addCategory(name, initialSubcategories = []) {
    const cleanName = name.trim();
    if (!cleanName) return;

    const existingIndex = this.categories.findIndex(c => c.id.toLowerCase() === cleanName.toLowerCase() || c.name.toLowerCase() === cleanName.toLowerCase());

    const subcats = Array.isArray(initialSubcategories) 
      ? initialSubcategories.map(s => s.trim()).filter(Boolean)
      : initialSubcategories.split(',').map(s => s.trim()).filter(Boolean);

    let catObj;
    if (existingIndex >= 0) {
      const existing = this.categories[existingIndex];
      const mergedSubcats = Array.from(new Set([...(existing.subcategories || []), ...subcats]));
      catObj = { ...existing, subcategories: mergedSubcats };
      this.categories[existingIndex] = catObj;
    } else {
      catObj = {
        id: cleanName,
        name: cleanName,
        subcategories: Array.from(new Set(subcats))
      };
      this.categories.push(catObj);
    }

    this.notify();

    if (supabase) {
      supabase.from('categories').upsert({
        id: catObj.id,
        name: catObj.name,
        subcategories: catObj.subcategories
      }).then(() => {}).catch(() => {});
    }
  }

  addSubcategory(categoryId, subcategoryName) {
    const subClean = subcategoryName.trim();
    if (!subClean) return;

    const catIndex = this.categories.findIndex(c => c.id === categoryId || c.name === categoryId);
    if (catIndex < 0) return;

    const cat = this.categories[catIndex];
    const subcats = cat.subcategories || [];
    if (!subcats.includes(subClean)) {
      const updatedSubcats = [...subcats, subClean];
      const updatedCat = { ...cat, subcategories: updatedSubcats };
      this.categories[catIndex] = updatedCat;
      this.notify();

      if (supabase) {
        supabase.from('categories').upsert({
          id: updatedCat.id,
          name: updatedCat.name,
          subcategories: updatedCat.subcategories
        }).then(() => {}).catch(() => {});
      }
    }
  }

  deleteSubcategory(categoryId, subcategoryName) {
    const catIndex = this.categories.findIndex(c => c.id === categoryId || c.name === categoryId);
    if (catIndex < 0) return;

    const cat = this.categories[catIndex];
    const updatedSubcats = (cat.subcategories || []).filter(s => s !== subcategoryName);
    const updatedCat = { ...cat, subcategories: updatedSubcats };
    this.categories[catIndex] = updatedCat;
    this.notify();

    if (supabase) {
      supabase.from('categories').upsert({
        id: updatedCat.id,
        name: updatedCat.name,
        subcategories: updatedCat.subcategories
      }).then(() => {}).catch(() => {});
    }
  }

  deleteCategory(categoryId) {
    this.categories = this.categories.filter(c => c.id !== categoryId && c.name !== categoryId);
    this.notify();

    if (supabase) {
      supabase.from('categories').delete().eq('id', categoryId).then(() => {}).catch(() => {});
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener());
  }

  getProducts() {
    return this.products;
  }

  getProductById(id) {
    return this.products.find(p => p.id === id);
  }

  getTopSellingProduct() {
    return [...this.products]
      .filter(p => p.is_active !== false)
      .sort((a, b) => b.sales_count - a.sales_count)[0];
  }

  getOffers() {
    return this.products.filter(p => p.is_offer && p.is_active !== false);
  }

  getFeaturedOffer() {
    return this.products.find(p => p.is_featured && p.is_active !== false) || null;
  }

  // Solo puede haber UNA oferta destacada a la vez (para que no se pierda
  // entre las demas), asi que al marcar una nueva se desmarca la anterior.
  async setFeaturedProduct(id) {
    const previousFeatured = this.products.find(p => p.is_featured && p.id !== id);
    if (previousFeatured) {
      await this.updateProduct(previousFeatured.id, { is_featured: false });
    }
    await this.updateProduct(id, { is_featured: true });
  }

  async unsetFeaturedProduct(id) {
    await this.updateProduct(id, { is_featured: false });
  }

  // Stock & Price Updates
  async updateProduct(id, updates) {
    const existingP = this.products.find(p => p.id === id);
    const updatedP = existingP ? { ...existingP, ...updates } : updates;

    if (updatedP.price !== undefined) updatedP.price = Number(updatedP.price);
    if (updatedP.wholesale_price !== undefined) updatedP.wholesale_price = Number(updatedP.wholesale_price);

    this.products = this.products.map(p => p.id === id ? updatedP : p);
    this.saveProductsToLocalStorage();
    this.notify();
    
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'updateProduct', id, updates: updatedP })
        });
        const result = await res.json();
        if (result && result.success && Array.isArray(result.data) && result.data.length > 0) {
          const freshFromDb = result.data[0];
          const normalized = {
            ...freshFromDb,
            price: Number(freshFromDb.price),
            wholesale_price: Number(freshFromDb.wholesale_price),
            stock: Number(freshFromDb.stock)
          };
          this.products = this.products.map(p => p.id === id ? { ...p, ...normalized } : p);
          this.saveProductsToLocalStorage();
          this.notify();
        }
      } catch (err) {
        console.warn('API updateProduct error:', err);
      }
    }
  }

  updateStock(id, newStock) {
    this.updateProduct(id, { stock: parseInt(newStock, 10) || 0 });
  }

  // Usado en el checkout (cliente anonimo). Actualiza el estado local al
  // instante para la UI, y persiste el descuento real en la base via una
  // funcion SQL atomica (evita vender de mas con compras simultaneas y no
  // requiere que el cliente tenga permiso de UPDATE directo sobre products).
  decrementStockAfterSale(id, qty) {
    if (!qty || qty <= 0) return;

    this.products = this.products.map(p => {
      if (p.id !== id) return p;
      return {
        ...p,
        stock: Math.max(0, (p.stock || 0) - qty),
        sales_count: (p.sales_count || 0) + qty
      };
    });
    this.saveProductsToLocalStorage();
    this.notify();

    if (supabase) {
      supabase.rpc('decrement_product_stock', { p_product_id: id, p_qty: qty }).then(() => {}).catch(() => {});
    }
  }

  // Reversa de decrementStockAfterSale: se llama cuando un pedido se
  // cancela, para devolver el stock que se habia descontado al crearlo
  // (el descuento pasa al crear el pedido, no cuando se aprueba el pago).
  restoreStockAfterCancel(id, qty) {
    if (!qty || qty <= 0) return;

    this.products = this.products.map(p => {
      if (p.id !== id) return p;
      return {
        ...p,
        stock: (p.stock || 0) + qty,
        sales_count: Math.max(0, (p.sales_count || 0) - qty)
      };
    });
    this.saveProductsToLocalStorage();
    this.notify();

    if (supabase) {
      supabase.rpc('restore_product_stock', { p_product_id: id, p_qty: qty }).then(() => {}).catch(() => {});
    }
  }

  updatePrice(id, newPrice, newWholesalePrice) {
    this.updateProduct(id, { 
      price: parseFloat(newPrice) || 0, 
      wholesale_price: parseFloat(newWholesalePrice) || 0 
    });
  }

  updatePricesByPercentage(productIds, percentage, applyToList = true, applyToWholesale = true) {
    const pct = parseFloat(percentage);
    if (isNaN(pct) || pct === 0) return;

    const targetIds = Array.isArray(productIds) && productIds.length > 0 
      ? new Set(productIds) 
      : null;

    const factor = 1 + (pct / 100);
    const updatedProductsList = [];

    this.products = this.products.map(p => {
      if (targetIds && !targetIds.has(p.id)) return p;

      const newPrice = applyToList ? Math.round(p.price * factor) : p.price;
      const newWholesalePrice = applyToWholesale ? Math.round(p.wholesale_price * factor) : p.wholesale_price;

      const updatedP = { ...p, price: newPrice, wholesale_price: newWholesalePrice };
      updatedProductsList.push(updatedP);
      return updatedP;
    });

    this.saveProductsToLocalStorage();
    this.notify();

    if (typeof window !== 'undefined' && updatedProductsList.length > 0) {
      fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsertProducts', productsList: updatedProductsList })
      }).catch(err => console.warn('API bulk update error:', err));
    }
  }

  // User Authentication
  //
  // El telefono es la identidad de la cuenta (no hay email/usuario), asi
  // que se normaliza ANTES de guardarlo o compararlo (ver phoneUtils.js):
  // no importa si lo tipean con espacios, guiones, +54, 0 o 15 adelante —
  // "0341 15-555-1234" y "+54 9 3415551234" tienen que ser la MISMA cuenta,
  // nunca dos cuentas separadas que se crucen entre si.
  registerUser(userData) {
    const normalizedPhone = normalizePhone(userData.phone) || userData.phone || '';
    const user = {
      name: userData.name,
      dni: userData.dni,
      phone: normalizedPhone,
      locality: userData.locality,
      password: userData.password || 'cliente123',
      role: 'client',
      created_at: new Date().toISOString()
    };
    this.currentUser = user;
    if (typeof window !== 'undefined') {
      localStorage.setItem('dulcevalentin_current_user', JSON.stringify(user));
    }

    const existingIdx = this.clients.findIndex(c => normalizePhone(c.phone) === normalizedPhone);
    if (existingIdx >= 0) {
      this.clients[existingIdx] = { ...this.clients[existingIdx], ...user };
    } else {
      this.clients.unshift(user);
    }
    this.notify();

    if (supabase) {
      supabase.rpc('upsert_wholesale_client', {
        p_name: user.name,
        p_dni: user.dni,
        p_phone: user.phone,
        p_locality: user.locality,
        p_password: user.password
      }).then(() => {}).catch((err) => console.warn('Client upsert warning:', err));
    }

    return user;
  }

  loginUser(phone, password) {
    if (phone === 'admin' || phone === '1122334455') {
      const adminUser = { id: 'u-admin', name: 'Administrador Dulce Valentín', phone, role: 'admin' };
      this.currentUser = adminUser;
      this.notify();
      return adminUser;
    }

    const normalizedPhone = normalizePhone(phone) || phone;
    const existingClient = this.clients.find(c => normalizePhone(c.phone) === normalizedPhone);
    const user = existingClient || {
      name: 'Cliente Mayorista',
      phone: normalizedPhone,
      role: 'client',
      created_at: new Date().toISOString()
    };

    this.currentUser = user;
    if (typeof window !== 'undefined') {
      localStorage.setItem('dulcevalentin_current_user', JSON.stringify(user));
    }
    this.notify();
    return user;
  }

  logout() {
    this.currentUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dulcevalentin_current_user');
    }
    this.notify();
  }

  bulkInsertProducts(productsList) {
    if (!Array.isArray(productsList) || productsList.length === 0) return 0;

    // Codigo correlativo automatico para lo que se importe sin traer uno
    // propio (ej: un CSV sin columna de codigo) — asi ningun producto
    // nuevo queda sin codigo para buscar/imprimir en etiquetas, como pasaba
    // antes de agregar la columna `code` a la base.
    const usedCodes = new Set(
      this.products.map((p) => p.code).filter(Boolean)
    );
    let nextNumericCode = this.products.reduce((max, p) => {
      const n = parseInt(p.code, 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0) + 1;
    const generateCode = () => {
      let code = String(nextNumericCode).padStart(4, '0');
      while (usedCodes.has(code)) {
        nextNumericCode += 1;
        code = String(nextNumericCode).padStart(4, '0');
      }
      nextNumericCode += 1;
      usedCodes.add(code);
      return code;
    };

    const newFormattedProducts = productsList.map((item, idx) => {
      const wholesale_price = parseFloat(item.wholesale_price || item.precio_mayorista || item.price || item.precio || item.precio_lista) || 0;
      const price = wholesale_price;

      const categoryName = (item.category || item.categoria || 'General').trim();
      const subcategoryName = (item.subcategory || item.subcategoria || '').trim();

      if (categoryName && categoryName !== 'General') {
        this.addCategory(categoryName, subcategoryName ? [subcategoryName] : []);
      }

      const providedCode = (item.code || item.codigo || '').toString().trim();
      const code = providedCode || generateCode();
      if (providedCode) usedCodes.add(providedCode);

      return {
        id: item.id || `p-${Date.now()}-${idx}-${Math.floor(Math.random()*1000)}`,
        code,
        name: (item.name || item.nombre || 'Producto Importado').trim(),
        category: categoryName,
        subcategory: subcategoryName,
        price,
        wholesale_price,
        stock: parseInt(item.stock, 10) || 0,
        sales_count: 0,
        image_url: (item.image_url || item.imagen || item.url_imagen || '/logo.png').trim(),
        description: (item.description || item.descripcion || '').trim(),
        is_offer: Boolean(item.is_offer),
        is_top_seller: false
      };
    });

    this.products = [...newFormattedProducts, ...this.products];
    this.notify();

    if (supabase) {
      supabase.from('products').upsert(newFormattedProducts).then(() => {}).catch(() => {});
    }

    return newFormattedProducts.length;
  }

  // Alta de UN solo producto desde el panel (tab "Nuevo Producto"). Mismo
  // generador de codigo correlativo que bulkInsertProducts, para que un
  // producto cargado a mano y uno importado por CSV nunca choquen de codigo
  // (ademas hay un indice unico en la base como ultima red de seguridad).
  async createProduct(data) {
    const usedCodes = new Set(this.products.map((p) => p.code).filter(Boolean));
    let nextNumericCode = this.products.reduce((max, p) => {
      const n = parseInt(p.code, 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0) + 1;
    let code = String(nextNumericCode).padStart(4, '0');
    while (usedCodes.has(code)) {
      nextNumericCode += 1;
      code = String(nextNumericCode).padStart(4, '0');
    }

    const categoryName = (data.category || '').trim();
    const subcategoryName = (data.subcategory || '').trim();
    if (categoryName) {
      this.addCategory(categoryName, subcategoryName ? [subcategoryName] : []);
    }

    const wholesale_price = Number(data.wholesale_price) || 0;
    const sizes = Array.isArray(data.sizes) ? data.sizes.map((s) => s.trim()).filter(Boolean) : [];
    const colors = Array.isArray(data.colors) ? data.colors.map((c) => c.trim()).filter(Boolean) : [];
    const stock = parseInt(data.stock, 10) || 0;

    // Reparte el mismo stock total entre todos los talles habilitados, asi
    // StockTab (que muestra stock por talle) arranca con numeros consistentes
    // en vez de en blanco.
    const stock_per_size = {};
    sizes.forEach((s) => { stock_per_size[s] = stock; });

    const newProduct = {
      id: `p-${code}`,
      code,
      name: (data.name || '').trim() || 'Producto sin nombre',
      category: categoryName || 'General',
      subcategory: subcategoryName,
      description: (data.description || '').trim(),
      price: wholesale_price,
      wholesale_price,
      stock,
      stock_per_size,
      sizes,
      colors,
      image_url: (data.image_url || '').trim() || '/logo.png',
      is_active: true,
      is_new: true,
      is_offer: false,
      is_featured: false,
      is_top_seller: false,
      sales_count: 0
    };

    this.products = [newProduct, ...this.products];
    this.saveProductsToLocalStorage();
    this.notify();

    if (supabase) {
      const { error } = await supabase.from('products').insert(newProduct);
      if (error) throw error;
    }

    return newProduct;
  }

  // Create Order & Generate Raffle Tickets for REGISTERED purchases >= $50.000
  // setActiveOrder=false para pedidos armados por el admin (no es la sesion
  // del cliente, no tiene que pisarle el "pedido activo" del carrito propio).
  //
  // Es async: antes los boletos se armaban con Math.random() en el
  // navegador sin guardarse en ningun lado (la base ni siquiera tenia
  // columna para eso), asi que se perdian al recargar y nada impedia que
  // dos boletos distintos terminaran con el mismo numero. Ahora el pedido
  // se guarda primero en Supabase y despues se le piden los boletos a una
  // funcion de la base (assign_raffle_tickets) que los reserva de una tabla
  // con clave primaria 1-10000: fisicamente no puede repetirse un numero.
  async createOrder(cartItems, clientDetails, { setActiveOrder = true } = {}) {
    const cartTotal = cartItems.reduce((sum, item) => {
      const itemPrice = item.product.wholesale_price || item.product.price || 0;
      return sum + (itemPrice * item.quantity);
    }, 0);
    // Baucher/credito otorgado por el admin (ej: producto faltante en un
    // pedido anterior), atado al telefono del cliente. Se descuenta del
    // total sin bajar de $0.
    const discountApplied = Math.min(cartTotal, Math.max(0, clientDetails.voucherAmount || 0));
    const total = cartTotal - discountApplied;
    const isWholesaleQualified = total >= 50000;

    // Telefono SIEMPRE normalizado (solo digitos, ultimos 10) antes de
    // guardarlo o usarlo para identificar al cliente: "011 15-5512-3456",
    // "+54 9 1155123456" y "1155123456" tienen que ser la MISMA cuenta.
    const normalizedPhone = normalizePhone(clientDetails.phone) || clientDetails.phone || '';

    // Raffle Tickets are strictly assigned ONLY to REGISTERED users
    const isRegisteredUser = Boolean(clientDetails.isRegistered || this.currentUser);
    const raffleTicketsCount = (isRegisteredUser && total >= 50000)
      ? Math.floor(total / 50000)
      : 0;

    const order = {
      id: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
      client_name: clientDetails.name,
      client_phone: normalizedPhone,
      client_dni: clientDetails.dni,
      client_locality: clientDetails.locality,
      client_address: clientDetails.address || '',
      client_postal_code: clientDetails.postalCode || '',
      client_floor_apt: clientDetails.floorApt || '',
      delivery_method: clientDetails.deliveryMethod,
      receipt_url: clientDetails.receiptUrl || null,
      items: cartItems,
      total_amount: total,
      is_wholesale: true,
      discount_applied: discountApplied,
      voucher_id: clientDetails.voucherId || null,
      raffle_tickets: [],
      is_registered: isRegisteredUser,
      created_at: new Date().toISOString(),
      status: 'pendiente'
    };

    // El pedido se guarda en Supabase ANTES de pedir los boletos: el
    // sorteo los ata a un order_id real (clave foranea a `orders`), asi
    // nunca puede quedar un boleto asignado a un pedido que en los hechos
    // no se llego a guardar.
    if (supabase) {
      const { error: orderErr } = await supabase.from('orders').insert({
        id: order.id,
        client_name: order.client_name,
        client_phone: order.client_phone,
        client_dni: order.client_dni,
        client_locality: order.client_locality,
        client_address: order.client_address,
        client_postal_code: order.client_postal_code,
        client_floor_apt: order.client_floor_apt,
        delivery_method: order.delivery_method,
        receipt_url: order.receipt_url,
        total_amount: order.total_amount,
        items: order.items,
        status: order.status,
        created_at: order.created_at,
        is_wholesale: order.is_wholesale,
        discount_applied: order.discount_applied,
        voucher_id: order.voucher_id
      });

      if (orderErr) {
        console.warn('Order insert warning:', orderErr);
      } else if (raffleTicketsCount > 0) {
        try {
          const { data: ticketNums, error: ticketErr } = await supabase.rpc('assign_raffle_tickets', {
            p_order_id: order.id,
            p_count: raffleTicketsCount,
            p_client_name: order.client_name,
            p_client_phone: order.client_phone,
            p_client_dni: order.client_dni,
            p_client_locality: order.client_locality,
            p_order_amount: order.total_amount
          });
          if (!ticketErr && Array.isArray(ticketNums)) {
            order.raffle_tickets = ticketNums.map((n) => String(n));
            this.raffleTickets = [
              ...this.raffleTickets,
              ...ticketNums.map((n) => ({
                ticket_number: n,
                order_id: order.id,
                client_name: order.client_name,
                client_phone: order.client_phone,
                client_dni: order.client_dni,
                client_locality: order.client_locality,
                order_amount: order.total_amount
              }))
            ];
          } else if (ticketErr) {
            console.warn('Raffle ticket assignment warning:', ticketErr);
          }
        } catch (err) {
          console.warn('Raffle ticket assignment warning:', err);
        }
      }
    }

    // Store active order in memory and localStorage so it never disappears
    if (setActiveOrder) {
      this.activeOrder = order;
      if (typeof window !== 'undefined') {
        localStorage.setItem('dulcevalentin_active_order', JSON.stringify(order));
      }
    }

    // Save client info to wholesale_clients
    if (normalizedPhone && clientDetails.name) {
      const clientRecord = {
        name: clientDetails.name,
        dni: clientDetails.dni || '',
        phone: normalizedPhone,
        locality: clientDetails.locality || '',
        password: 'cliente' + (normalizedPhone.slice(-4) || '123')
      };

      const existingIdx = this.clients.findIndex(c => normalizePhone(c.phone) === normalizedPhone);
      if (existingIdx >= 0) {
        this.clients[existingIdx] = { ...this.clients[existingIdx], ...clientRecord };
      } else {
        this.clients.unshift(clientRecord);
      }

      if (supabase) {
        supabase.rpc('upsert_wholesale_client', {
          p_name: clientRecord.name,
          p_dni: clientRecord.dni,
          p_phone: clientRecord.phone,
          p_locality: clientRecord.locality,
          p_password: clientRecord.password
        }).then(() => {}).catch((err) => console.warn('Client upsert warning:', err));
      }
    }

    // Update sales_count and stock for products (se salta los items
    // "fuera de catalogo" cargados a mano, que no existen en this.products)
    cartItems.forEach(item => {
      if (this.products.some(p => p.id === item.product.id)) {
        this.decrementStockAfterSale(item.product.id, item.quantity);
      }
    });

    // Add cash movement
    this.cashMovements.unshift({
      id: 'cm-' + Date.now(),
      type: 'income',
      amount: total,
      concept: `Venta ${isWholesaleQualified ? 'Mayorista' : 'Minorista'} ${order.id} (${clientDetails.name})`,
      date: new Date().toISOString()
    });

    this.orders.unshift(order);
    this.notify();

    return order;
  }

  updateOrderReceipt(orderId, receiptUrl) {
    this.orders = this.orders.map(o => o.id === orderId ? { ...o, receipt_url: receiptUrl } : o);

    if (this.activeOrder && this.activeOrder.id === orderId) {
      this.activeOrder = { ...this.activeOrder, receipt_url: receiptUrl };
      if (typeof window !== 'undefined') {
        localStorage.setItem('dulcevalentin_active_order', JSON.stringify(this.activeOrder));
      }
    }

    this.notify();

    // Se sube desde el checkout sin sesion de admin: la tabla orders bloquea
    // el UPDATE directo para usuarios anonimos por RLS, asi que se persiste
    // via una funcion SQL con permiso especial (mismo patron que el stock).
    if (supabase) {
      supabase.rpc('update_order_receipt', { p_order_id: orderId, p_receipt_url: receiptUrl })
        .then(({ error }) => { if (error) console.warn('Error guardando comprobante:', error); })
        .catch((err) => console.warn('Error guardando comprobante:', err));
    }
  }

  updateOrderStatus(orderId, newStatus) {
    const existingOrder = this.orders.find(o => o.id === orderId);
    const wasAlreadyCancelled = existingOrder?.status === 'cancelado';

    this.orders = this.orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    this.notify();

    if (supabase) {
      supabase.from('orders').update({ status: newStatus }).eq('id', orderId).then(() => {}).catch(() => {});
    }

    // El stock se descuenta al CREAR el pedido, no al aprobar el pago, asi
    // que si se cancela hay que devolverlo (solo la primera vez que pasa a
    // cancelado, para no duplicar la devolucion si lo cancelan de nuevo).
    if (newStatus === 'cancelado' && !wasAlreadyCancelled && existingOrder?.items) {
      existingOrder.items.forEach((item) => {
        if (item.product?.id && this.products.some((p) => p.id === item.product.id)) {
          this.restoreStockAfterCancel(item.product.id, item.quantity);
        }
      });
    }
  }

  // Borra un pedido definitivamente (ej. pedidos de prueba). Si el pedido
  // no estaba ya cancelado, devuelve el stock primero (mismo criterio que
  // al cancelar) para no dejar unidades "perdidas" en el conteo.
  async deleteOrder(orderId) {
    const existingOrder = this.orders.find((o) => o.id === orderId);
    if (!existingOrder) return;

    if (existingOrder.status !== 'cancelado' && existingOrder.items) {
      existingOrder.items.forEach((item) => {
        if (item.product?.id && this.products.some((p) => p.id === item.product.id)) {
          this.restoreStockAfterCancel(item.product.id, item.quantity);
        }
      });
    }

    this.orders = this.orders.filter((o) => o.id !== orderId);
    this.notify();

    if (supabase) {
      await supabase.from('orders').delete().eq('id', orderId);
    }
  }

  // Modificar los productos/cantidades de un pedido ya creado (sacar,
  // agregar o cambiar cantidades) y recalcular el total al mismo precio
  // mayorista con el que se cobra en el carrito. Devuelve el nuevo total.
  updateOrderItems(orderId, newItems) {
    const existingOrder = this.orders.find(o => o.id === orderId);

    // Ajustar el stock segun la diferencia de cantidades por producto (si el
    // pedido esta cancelado el stock ya fue devuelto al cancelar, asi que no
    // se vuelve a tocar aca).
    if (existingOrder && existingOrder.status !== 'cancelado') {
      const qtyByProduct = (items) => (items || []).reduce((acc, it) => {
        const id = it.product?.id;
        if (id) acc[id] = (acc[id] || 0) + (it.quantity || 0);
        return acc;
      }, {});
      const oldQty = qtyByProduct(existingOrder.items);
      const newQty = qtyByProduct(newItems);
      const productIds = new Set([...Object.keys(oldQty), ...Object.keys(newQty)]);
      productIds.forEach((id) => {
        if (!this.products.some((p) => p.id === id)) return; // producto fuera de catalogo, sin stock que ajustar
        const delta = (newQty[id] || 0) - (oldQty[id] || 0);
        if (delta > 0) this.decrementStockAfterSale(id, delta);
        else if (delta < 0) this.restoreStockAfterCancel(id, -delta);
      });
    }

    const total = newItems.reduce((sum, item) => {
      const itemPrice = item.product.wholesale_price || item.product.price || 0;
      return sum + (itemPrice * item.quantity);
    }, 0);

    this.orders = this.orders.map(o => o.id === orderId ? { ...o, items: newItems, total_amount: total } : o);

    if (this.activeOrder && this.activeOrder.id === orderId) {
      this.activeOrder = { ...this.activeOrder, items: newItems, total_amount: total };
      if (typeof window !== 'undefined') {
        localStorage.setItem('dulcevalentin_active_order', JSON.stringify(this.activeOrder));
      }
    }

    this.notify();

    if (supabase) {
      supabase.from('orders').update({ items: newItems, total_amount: total }).eq('id', orderId).then(() => {}).catch(() => {});
    }

    return total;
  }

  getActiveOrder() {
    if (this.activeOrder) return this.activeOrder;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dulcevalentin_active_order');
      if (stored) {
        try { return JSON.parse(stored); } catch (e) {}
      }
    }
    return null;
  }

  clearActiveOrder() {
    this.activeOrder = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dulcevalentin_active_order');
    }
    this.notify();
  }

  async cleanOldReceipts(daysThreshold = 60) {
    const cutoffTime = Date.now() - (daysThreshold * 86400000);
    let cleanedCount = 0;

    for (const order of this.orders) {
      if (order.receipt_url && new Date(order.created_at).getTime() < cutoffTime) {
        if (supabase && order.receipt_url.includes('supabase.co')) {
          try {
            // Comprobantes nuevos viven en el bucket "comprobantes"; se deja
            // el fallback a "Productos" por si queda algun comprobante viejo
            // subido antes de este cambio.
            const bucket = order.receipt_url.includes('/comprobantes/') ? 'comprobantes' : 'Productos';
            const parts = order.receipt_url.split(`/${bucket}/`);
            if (parts[1]) {
              await supabase.storage.from(bucket).remove([decodeURIComponent(parts[1])]);
            }
          } catch (e) {
            console.warn('Error deleting storage receipt:', e);
          }
        }

        order.receipt_url = null;
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.notify();
      if (supabase) {
        for (const order of this.orders) {
          if (!order.receipt_url) {
            await supabase.from('orders').update({ receipt_url: null }).eq('id', order.id);
          }
        }
      }
    }

    return cleanedCount;
  }

  // Para el aviso del panel: cuantos comprobantes ya superaron el umbral y
  // se pueden liberar, sin borrar nada todavia (eso lo dispara el admin a
  // mano con el boton "Limpiar Fotos").
  getOldReceiptsCount(daysThreshold = 60) {
    const cutoffTime = Date.now() - (daysThreshold * 86400000);
    return this.orders.filter(o => o.receipt_url && new Date(o.created_at).getTime() < cutoffTime).length;
  }

  // Aggregated VIP Client Stats & Ranking (combines registered clients and orders)
  //
  // Se agrupa por telefono NORMALIZADO (no como esta escrito en cada fila):
  // asi un mismo cliente que en un pedido puso "3415551234" y en otro
  // "+54 9 341 555 1234" cae en la MISMA fila del ranking en vez de
  // aparecer como dos clientes distintos con menos compras cada uno.
  getClientsWithStats() {
    const clientMap = {};

    // 1. Add all registered clients from wholesale_clients
    (this.clients || []).forEach(c => {
      const key = normalizePhone(c.phone) || c.name;
      if (!key) return;
      clientMap[key] = {
        name: c.name || 'Cliente Registrado',
        dni: c.dni || 'Sin especificar',
        phone: c.phone || 'Sin especificar',
        locality: c.locality || 'Sin especificar',
        total_spent: 0,
        orders_count: 0,
        tickets_count: 0,
        is_registered: true
      };
    });

    // 2. Aggregate metrics from all orders
    this.orders.forEach(order => {
      const key = normalizePhone(order.client_phone) || order.client_name;
      if (!key) return;
      if (!clientMap[key]) {
        clientMap[key] = {
          name: order.client_name,
          dni: order.client_dni,
          phone: order.client_phone,
          locality: order.client_locality,
          total_spent: 0,
          orders_count: 0,
          tickets_count: 0,
          is_registered: Boolean(order.is_registered)
        };
      }

      clientMap[key].total_spent += order.total_amount;
      clientMap[key].orders_count += 1;
    });

    // 3. Los boletos se cuentan aparte, de la tabla real de boletos (ya no
    // del pedido en memoria, que no los trae al recargar), agrupados por el
    // mismo telefono normalizado.
    (this.raffleTickets || []).forEach(t => {
      const key = normalizePhone(t.client_phone) || t.client_name;
      if (!key || !clientMap[key]) return;
      clientMap[key].tickets_count += 1;
    });

    // Convert map to array and sort by total_spent descending
    return Object.values(clientMap).sort((a, b) => b.total_spent - a.total_spent);
  }

  // All Active Raffle Tickets in Play — vienen de la tabla `raffle_tickets`
  // (persistidos y con numero unico garantizado por la base), no de
  // recorrer `orders` como antes.
  getAllRaffleTickets() {
    return (this.raffleTickets || []).map(t => ({
      ticket_id: String(t.ticket_number),
      order_id: t.order_id,
      order_amount: Number(t.order_amount) || 0,
      client_name: t.client_name,
      client_phone: t.client_phone,
      client_dni: t.client_dni,
      client_locality: t.client_locality
    }));
  }

  // Admin Metrics Calculations — el arqueo se calcula a partir de las
  // ordenes reales persistidas en Supabase (solo pagos ya aprobados),
  // no de un registro de caja en memoria que se perdia al refrescar.
  getMetrics() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const paidOrders = this.orders.filter(o => o.status === 'aprobado' || o.status === 'enviado');

    const ordersSince = (sinceTs) => paidOrders.filter(o => new Date(o.created_at).getTime() >= sinceTs);
    const sumOrdersSince = (sinceTs) => ordersSince(sinceTs).reduce((sum, o) => sum + (o.total_amount || 0), 0);

    const dailyCash = sumOrdersSince(startOfDay);
    const weeklyCash = sumOrdersSince(startOfWeek);
    const monthlyCash = sumOrdersSince(startOfMonth);

    const ordersCountToday = ordersSince(startOfDay).length;
    const ordersCountWeek = ordersSince(startOfWeek).length;
    const ordersCountMonth = ordersSince(startOfMonth).length;

    const visitStats = this.getVisitStats();
    const conversionRate = (ordersCount, visits) => (visits > 0 ? (ordersCount / visits) * 100 : 0);

    const ordersByStatus = this.orders.reduce((acc, o) => {
      const status = o.status || 'pendiente';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const topRotationProducts = [...this.products]
      .sort((a, b) => b.sales_count - a.sales_count)
      .slice(0, 5);

    const totalStockCount = this.products.reduce((sum, p) => sum + p.stock, 0);

    return {
      dailyCash,
      weeklyCash,
      monthlyCash,
      topRotationProducts,
      totalStockCount,
      visitCount: this.getVisitCount(),
      visitsByRegion: this.getVisitsByRegion(),
      visitToday: visitStats.today,
      visitWeek: visitStats.week,
      visitMonth: visitStats.month,
      conversionToday: conversionRate(ordersCountToday, visitStats.today),
      conversionWeek: conversionRate(ordersCountWeek, visitStats.week),
      conversionMonth: conversionRate(ordersCountMonth, visitStats.month),
      avgOrderValue: ordersCountMonth > 0 ? monthlyCash / ordersCountMonth : 0,
      ordersByStatus,
      totalOrders: this.orders.length
    };
  }
}

export const dataStore = new DataStore();
