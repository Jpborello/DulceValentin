/* Service worker de Dulce Valentín (PWA).
 *
 * Criterio: la web tiene precios y stock que cambian, asi que las paginas
 * se piden SIEMPRE primero a internet y la copia guardada solo se usa si no
 * hay conexion. Nunca se guardan respuestas de /api/ (ahi viajan los datos).
 * Del panel (/admin) y la caja (/caja) se guarda solo el "cascaron" HTML, que
 * no trae datos (se cargan despues por /api y Supabase): asi abren sin
 * internet y pueden usar la copia local (IndexedDB) y la cola de ventas.
 * Lo que si se guarda es lo que no cambia: los archivos de /_next/static/
 * (llevan un hash en el nombre) y las imagenes propias del sitio.
 *
 * Si se cambia este archivo, subir VERSION para que se limpien las copias
 * viejas en los celulares.
 */
const VERSION = 'dv-v2';
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;
const IMAGES_CACHE = `${VERSION}-images`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];
const MAX_PAGES = 30;
const MAX_IMAGES = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

// Con wifi conectado pero sin internet, fetch puede quedar colgado mucho
// tiempo: pasado este plazo se usa la copia guardada.
const NAV_TIMEOUT_MS = 8000;

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// El panel y la caja van a un cache aparte que no se recorta, para que las
// visitas al catalogo no los saquen y dejen al local sin caja offline.
const APP_SHELL_CACHE = `${VERSION}-app`;
const isAppShell = (pathname) => pathname.startsWith('/admin') || pathname.startsWith('/caja');

async function networkFirstPage(request) {
  const { pathname } = new URL(request.url);
  try {
    const response = await fetchWithTimeout(request, NAV_TIMEOUT_MS);
    // (una respuesta que vino de un redirect no se puede servir despues a una navegacion)
    if (response.ok && response.type === 'basic' && !response.redirected) {
      const copy = response.clone();
      if (isAppShell(pathname)) {
        // Se guarda sin query string: /admin?tab=x y /admin son el mismo cascaron.
        caches.open(APP_SHELL_CACHE).then((cache) => cache.put(pathname, copy));
      } else {
        caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy).then(() => trimCache(PAGES_CACHE, MAX_PAGES)));
      }
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || caches.match(OFFLINE_URL);
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(cacheName).then((cache) => cache.put(request, copy));
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone()).then(() => trimCache(cacheName, max));
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Todo lo de otros dominios (Supabase, Mercado Pago, WhatsApp, etc.) va
  // directo a internet, sin pasar por aca.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (/^\/(icons|hero|categorias)\//.test(url.pathname) || /^\/logo\.(png|webp)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGES_CACHE, MAX_IMAGES));
  }
});
