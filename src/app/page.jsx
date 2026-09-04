'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import CarouselSection from '@/components/CarouselSection';
import CategoryNav from '@/components/CategoryNav';
import CategoryShowcase from '@/components/CategoryShowcase';
import ProductGrid from '@/components/ProductGrid';
import CartDrawer from '@/components/CartDrawer';
import AuthModal from '@/components/AuthModal';
import WebChatWidget from '@/components/WebChatWidget';
import WholesaleBanner from '@/components/WholesaleBanner';
import TrustBar from '@/components/TrustBar';
import ProductDetailModal from '@/components/ProductDetailModal';
import { dataStore, CATEGORIES } from '@/lib/dataStore';
import { supabase } from '@/lib/supabaseClient';
import { Store, MapPin, Instagram, PackageSearch } from 'lucide-react';
import Link from 'next/link';

const CART_STORAGE_KEY = 'dulcevalentin_cart';
const PRODUCTS_PER_PAGE = 24;

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);
  // Busqueda "inteligente" (tolera errores de tipeo) via Postgres en
  // Supabase. Arranca en null: mientras no haya respuesta del servidor
  // para la busqueda actual, se usa el filtro por substring de mas abajo
  // como base instantanea, asi no hay ningun parpadeo/demora al tipear.
  const [smartSearchIds, setSmartSearchIds] = useState(null);

  // Cart & Auth state
  const [cartItems, setCartItems] = useState([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [addedToast, setAddedToast] = useState(null);
  const deepLinkHandledRef = useRef(false);

  useEffect(() => {
    dataStore.recordVisit();
    dataStore.fetchVisitCountFromSupabase();

    const updateStoreData = () => {
      setProducts(dataStore.getProducts());
      setCategories(dataStore.getCategories());
      setCurrentUser(dataStore.currentUser);
    };

    updateStoreData();
    const unsubscribe = dataStore.subscribe(updateStoreData);
    return () => unsubscribe();
  }, []);

  // Links compartidos (?producto=ID) abren directo el modal de esa prenda.
  useEffect(() => {
    if (deepLinkHandledRef.current || products.length === 0) return;
    const productId = new URLSearchParams(window.location.search).get('producto');
    if (productId) {
      const found = products.find((p) => p.id === productId);
      if (found) setDetailProduct(found);
    }
    deepLinkHandledRef.current = true;
  }, [products]);

  // Links compartidos (?categoria=Mujeres&sub=Camperas) preseleccionan esa
  // categoria/subcategoria al cargar la pagina.
  const categoryDeepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (categoryDeepLinkHandledRef.current || categories.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get('categoria');
    const subParam = params.get('sub');
    if (catParam && categories.some((c) => c.id === catParam)) {
      setSelectedCategory(catParam);
      if (subParam) setSelectedSubcategory(subParam);
    }
    categoryDeepLinkHandledRef.current = true;
  }, [categories]);

  // Refleja la categoria/subcategoria elegida en la URL (sin recargar la
  // pagina) para poder copiar/compartir el link de ese filtro puntual.
  useEffect(() => {
    if (!categoryDeepLinkHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (selectedCategory && selectedCategory !== 'all') {
      params.set('categoria', selectedCategory);
    } else {
      params.delete('categoria');
    }
    if (selectedSubcategory) {
      params.set('sub', selectedSubcategory);
    } else {
      params.delete('sub');
    }
    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [selectedCategory, selectedSubcategory]);

  // Cada combinacion de producto + talle + color es una linea de carrito
  // distinta, para no perder el talle/color elegido cuando el cliente agrega
  // varias variantes del mismo producto.
  const getVariantKey = (product) => `${product.id}::${product.selectedSize || ''}::${product.selectedColor || ''}`;

  // Restaurar el carrito guardado (una vez que ya tenemos productos para
  // validar contra precio/stock actual) para que no se pierda al refrescar.
  useEffect(() => {
    if (cartHydrated || products.length === 0) return;
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const savedTuples = JSON.parse(raw);
        const restored = (Array.isArray(savedTuples) ? savedTuples : [])
          .map((t) => {
            const baseProduct = products.find((p) => p.id === t.id);
            if (!baseProduct) return null;
            const product = { ...baseProduct, selectedSize: t.selectedSize || null, selectedColor: t.selectedColor || null };
            return { product, quantity: t.quantity || 1, variantKey: getVariantKey(product) };
          })
          .filter(Boolean);
        if (restored.length > 0) setCartItems(restored);
      }
    } catch (e) {
      console.warn('No se pudo restaurar el carrito guardado:', e);
    }
    setCartHydrated(true);
  }, [products, cartHydrated]);

  // Volver a mostrar solo el primer lote cada vez que cambian los filtros,
  // para no arrancar una nueva búsqueda con la paginación ya "gastada".
  useEffect(() => {
    setVisibleCount(PRODUCTS_PER_PAGE);
  }, [selectedCategory, selectedSubcategory, searchQuery]);

  // Busqueda tolerante a errores de tipeo: 300ms despues de que el
  // usuario deja de tipear, le pregunta a Postgres (full-text search +
  // similitud por trigrams) que productos matchean de verdad, y ese
  // resultado reemplaza al filtro por substring simple de mas abajo.
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || !supabase) {
      setSmartSearchIds(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('search_products', { search_term: query });
        if (!cancelled && !error && Array.isArray(data)) {
          setSmartSearchIds(new Set(data.map((p) => p.id)));
        }
      } catch (e) {
        // Si falla la busqueda inteligente (sin conexion, etc.), nos
        // quedamos con el filtro por substring de siempre, sin romper nada.
        if (!cancelled) setSmartSearchIds(null);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Persistir el carrito en cada cambio (recien despues de hidratar, para
  // no pisar lo guardado con el estado inicial vacio)
  useEffect(() => {
    if (!cartHydrated) return;
    try {
      const tuples = cartItems.map((item) => ({
        id: item.product.id,
        quantity: item.quantity,
        selectedSize: item.product.selectedSize || null,
        selectedColor: item.product.selectedColor || null
      }));
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(tuples));
    } catch (e) {
      console.warn('No se pudo guardar el carrito:', e);
    }
  }, [cartItems, cartHydrated]);

  // Cart operations
  const handleAddToCart = (product) => {
    const variantKey = getVariantKey(product);
    setCartItems((prev) => {
      const existing = prev.find(item => item.variantKey === variantKey);
      if (existing) {
        return prev.map(item =>
          item.variantKey === variantKey ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, variantKey }];
    });

    // Toast no invasivo en vez de abrir el drawer en cada click (especialmente en celulares)
    setAddedToast(product.name);
    setTimeout(() => setAddedToast(null), 3000);
  };

  const handleUpdateQuantity = (variantKey, newQty) => {
    if (newQty <= 0) {
      handleRemoveFromCart(variantKey);
      return;
    }
    setCartItems((prev) =>
      prev.map(item => item.variantKey === variantKey ? { ...item, quantity: newQty } : item)
    );
  };

  const handleRemoveFromCart = (variantKey) => {
    setCartItems((prev) => prev.filter(item => item.variantKey !== variantKey));
  };

  const handleCheckout = (cart, clientDetails) => {
    const order = dataStore.createOrder(cart, {
      name: clientDetails?.name || currentUser?.name || 'Cliente Mayorista',
      phone: clientDetails?.phone || currentUser?.phone || 'Sin especificar',
      dni: clientDetails?.dni || currentUser?.dni || 'Sin especificar',
      locality: clientDetails?.locality || currentUser?.locality || 'Sin especificar',
      address: clientDetails?.address || currentUser?.address || '',
      postalCode: clientDetails?.postalCode || '',
      floorApt: clientDetails?.floorApt || '',
      isRegistered: Boolean(clientDetails?.isRegistered || currentUser),
      deliveryMethod: clientDetails?.deliveryMethod || 'Envío a Domicilio',
      receiptUrl: clientDetails?.receiptUrl || null,
      voucherId: clientDetails?.voucherId || null,
      voucherAmount: clientDetails?.voucherAmount || 0
    });
    setCartItems([]);
    return order;
  };

  // Auth operations
  const handleLogin = (phone, password) => {
    dataStore.loginUser(phone, password);
  };

  const handleRegister = (userData) => {
    dataStore.registerUser(userData);
  };

  const handleLogout = () => {
    dataStore.logout();
  };

  const normalizeStr = (str) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Filter products by category, subcategory and search query. Los marcados
  // "Nuevo Ingreso" (is_new, admin lo tilda desde PricesTab) se muestran
  // primero dentro del listado resultante, sin alterar el orden relativo
  // del resto (sort estable).
  const filteredProducts = products.filter((product) => {
    let matchesCategory = selectedCategory === 'all';
    
    if (!matchesCategory) {
      const selCatLower = normalizeStr(selectedCategory);
      const prodCatLower = normalizeStr(product.category);
      const prodSubLower = normalizeStr(product.subcategory);

      matchesCategory = (
        prodCatLower === selCatLower ||
        prodSubLower === selCatLower ||
        prodCatLower.includes(selCatLower) ||
        prodSubLower.includes(selCatLower) ||
        selCatLower.includes(prodSubLower) ||
        selCatLower.includes(prodCatLower)
      );
    }

    let matchesSubcategory = !selectedSubcategory;
    if (!matchesSubcategory && selectedSubcategory) {
      const selSubLower = normalizeStr(selectedSubcategory);
      const prodSubLower = normalizeStr(product.subcategory);
      matchesSubcategory = prodSubLower === selSubLower || prodSubLower.includes(selSubLower);
    }

    const normSearch = normalizeStr(searchQuery);
    // Si ya tenemos respuesta de la busqueda inteligente (tolerante a
    // errores de tipeo) para lo que esta tipeado ahora, se usa esa — sino,
    // el match instantaneo por substring de siempre como base.
    const matchesSearch = normSearch === '' ||
      (smartSearchIds
        ? smartSearchIds.has(product.id)
        : (
          normalizeStr(product.name).includes(normSearch) ||
          normalizeStr(product.category).includes(normSearch) ||
          normalizeStr(product.subcategory).includes(normSearch) ||
          normalizeStr(product.description).includes(normSearch)
        ));

    return product.is_active !== false && matchesCategory && matchesSubcategory && matchesSearch;
  }).sort((a, b) => Number(!!b.is_new) - Number(!!a.is_new));

  // Se derivan del estado local `products` (arranca en [] en server y
  // cliente por igual) en vez de leer directo del singleton `dataStore`,
  // que en el cliente ya viene "adelantado" con overrides de localStorage
  // de una sesion anterior (precios/stock/destacados editados en el admin).
  // Leerlo directo en el render rompia la hidratacion: el server mostraba
  // un producto destacado/oferta distinto al que ya tenia cacheado el
  // navegador, y React tiraba "Hydration failed" en el <h3> del carousel.
  const featuredOffer = products.find((p) => p.is_featured && p.is_active !== false) || null;
  const offers = products.filter((p) => p.is_offer && p.is_active !== false && p.id !== featuredOffer?.id);
  const topSeller = [...products]
    .filter((p) => p.is_active !== false)
    .sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0))[0];

  // Mismo top 5 que ya usa el admin en Metricas ("Mayor Rotacion"), para que
  // el sello "Mas Vendido" en la grilla coincida con ese ranking.
  const topSellingIds = new Set(
    [...products]
      .filter((p) => (p.sales_count || 0) > 0)
      .sort((a, b) => b.sales_count - a.sales_count)
      .slice(0, 5)
      .map((p) => p.id)
  );

  // El home ya no lista todo el catalogo de entrada: los productos viven
  // dentro de las categorias. La grilla aparece solo cuando el visitante
  // eligio una categoria o esta buscando algo.
  const hasSearch = searchQuery.trim() !== '';
  const isCategoryFiltered = Boolean(selectedCategory) && selectedCategory !== 'all';
  const showProductGrid = hasSearch || isCategoryFiltered;

  const totalCartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cartItems.reduce((sum, item) => {
    const p = item.product.wholesale_price || item.product.price || 0;
    return sum + (p * item.quantity);
  }, 0);
  const isWholesaleQualified = cartSubtotal >= 50000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header Navigation */}
      <Header
        cartCount={totalCartItemsCount}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Wholesale Threshold Banner */}
      <WholesaleBanner />

      {/* Active Pending Order Banner */}
      {dataStore.getActiveOrder() && (
        <div style={{
          backgroundColor: '#EFF6FF',
          borderBottom: '2px solid #3B82F6',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          flexWrap: 'wrap',
          fontSize: '0.88rem',
          fontWeight: 700,
          color: '#1E40AF',
          boxShadow: '0 2px 8px rgba(59,130,246,0.15)'
        }}>
          <span>
            📌 Tenés una compra pendiente (Orden N° <strong>#{dataStore.getActiveOrder()?.id}</strong>) por <strong>${dataStore.getActiveOrder()?.total_amount?.toLocaleString('es-AR')}</strong>
          </span>
          <button 
            onClick={() => setIsCartOpen(true)}
            style={{
              backgroundColor: '#2563EB',
              color: '#FFF',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {dataStore.getActiveOrder()?.receipt_url ? '✓ Ver / Modificar Comprobante' : '💳 Subir Comprobante / Pagar'}
          </button>
        </div>
      )}

      {/* Hero Section */}
      <HeroSection
        onExploreCatalog={() => {
          // Sin filtro activo no existe #catalogo (la grilla no esta montada),
          // asi que el boton del hero lleva a las cards de categorias.
          const el = document.getElementById('catalogo') || document.getElementById('categorias');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Carousel Section (Offers & Top Seller) */}
      <CarouselSection
        offers={offers}
        featuredOffer={featuredOffer}
        topSeller={topSeller}
        onAddToCart={handleAddToCart}
        onOpenDetail={setDetailProduct}
      />

      {/* Trust Bar */}
      <TrustBar />

      {/* Categorías principales: 4 cards + accesos secundarios */}
      <CategoryShowcase
        categories={categories}
        products={products}
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        onSelect={(category, subcategory) => {
          setSelectedCategory(category);
          setSelectedSubcategory(subcategory);
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Catálogo: aparece recién cuando se eligió una categoría o hay una
          búsqueda. Sin filtro, el home termina en las cards de categorías. */}
      {showProductGrid && (
        <main className="main-catalog-layout">
          <CategoryNav
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            selectedSubcategory={selectedSubcategory}
            onSelectSubcategory={setSelectedSubcategory}
            hasSearch={hasSearch}
          />

          <ProductGrid
            products={filteredProducts.slice(0, visibleCount)}
            onAddToCart={handleAddToCart}
            isWholesaleQualified={isWholesaleQualified}
            onOpenDetail={setDetailProduct}
            topSellingIds={topSellingIds}
          />

          {filteredProducts.length > 0 && (
            <div className="catalog-footer-controls">
              <span className="catalog-count-label">
                Mostrando {Math.min(visibleCount, filteredProducts.length)} de {filteredProducts.length} productos
              </span>
              {visibleCount < filteredProducts.length && (
                <button
                  onClick={() => setVisibleCount((prev) => prev + PRODUCTS_PER_PAGE)}
                  className="btn-load-more"
                >
                  Ver más productos
                </button>
              )}
            </div>
          )}
        </main>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={detailProduct}
        isOpen={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        onAddToCart={handleAddToCart}
        isWholesaleQualified={isWholesaleQualified}
      />

      {/* Floating Toast Notification on Item Added */}
      {addedToast && (
        <div style={{
          position: 'fixed',
          bottom: '85px',
          right: '20px',
          left: '20px',
          maxWidth: '420px',
          margin: '0 auto',
          backgroundColor: '#1E293B',
          color: '#FFFFFF',
          padding: '12px 18px',
          borderRadius: '14px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 9999,
          border: '1px solid #334155',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            🛒 Agregado: <strong>{addedToast}</strong>
          </div>
          <button 
            onClick={() => { setAddedToast(null); setIsCartOpen(true); }}
            style={{
              backgroundColor: '#2563EB',
              color: '#FFF',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Ver Carrito
          </button>
        </div>
      )}

      {/* Chat en vivo de la web — desactivado temporalmente (29/8: sin
          SUPABASE_SERVICE_ROLE_KEY configurada en Vercel, el endpoint
          /api/webchat/message tira error 500 en cada mensaje). Reactivar
          descomentando <WebChatWidget /> una vez cargada la Service Role
          Key real en las variables de entorno de Vercel. */}
      {/* <WebChatWidget /> */}

      {/* Shopping Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveFromCart}
        onCheckout={handleCheckout}
        onRestoreCart={(items) => setCartItems(items)}
        currentUser={currentUser}
      />

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />

      {/* Footer */}
      <footer style={{ backgroundColor: 'var(--bg-surface-dark)', color: 'var(--text-on-dark)', marginTop: 'auto', padding: '50px 24px 24px 24px' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '40px', marginBottom: '40px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <img src="/logo.png" alt="Logo Dulce Valentín" className="brand-logo-animated" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--accent-gold)', objectFit: 'contain', backgroundColor: '#FFF' }} />
              <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>Dulce Valentín</span>
            </div>
            <p style={{ color: '#A09890', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Distribuidora mayorista de indumentaria, calzado y complementos para toda la familia. Envíos a todo el país y retiro en Rosario.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--accent-gold-light)' }}>Contacto Directo</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', color: '#D6C8B5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🕒 Lunes a Sábado de 8 a 17 hs</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={16} /> Pte. Perón 5349/5305/5265 (Rosario - Santa Fe)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Store size={16} /> Atención Lunes a Sábado de 8:00 a 17:00 hs</div>
              <Link href="/pedido" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-gold-light)', fontWeight: 700, textDecoration: 'none' }}>
                <PackageSearch size={16} /> Rastreá tu Pedido
              </Link>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--accent-gold-light)' }}>Redes & Consultas</h4>
            <div style={{ display: 'flex', gap: '12px' }}>
              <a
                href="https://www.instagram.com/dulcevalentin.unidas/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram de Dulce Valentín"
                className="btn-icon"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF' }}
              >
                <Instagram size={20} />
              </a>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', textAlign: 'center', fontSize: '0.8rem', color: '#857D75' }}>
          © {new Date().getFullYear()} Dulce Valentín - Todos los derechos reservados. Plataforma E-commerce Mayorista.
          <br />
          Desarrollado por{' '}
          <a
            href="https://www.neo-core-sys.com.ar/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-gold-light)', fontWeight: 700 }}
          >
            Neo Core Sys
          </a>
        </div>
      </footer>
    </div>
  );
}
