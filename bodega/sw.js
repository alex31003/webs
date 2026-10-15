// Service worker de BodegaApp: permite abrir la app sin conexión.
// Estrategia "red primero": siempre intenta la versión más nueva y, si no hay
// internet, usa la copia guardada. Nunca guarda datos de Supabase (API/Realtime).
const CACHE = 'bodegaapp-v3';
const ARCHIVOS = ['./', './index.html', './config.js', './manifest.json', './icon.svg', './icon-maskable.svg', './icon-192.png', './icon-512.png'];
const CDN_PERMITIDOS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(ARCHIVOS.map(url => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(c => c !== CACHE).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mismoOrigen = url.origin === self.location.origin;
  const esCdn = CDN_PERMITIDOS.includes(url.hostname);
  if (!mismoOrigen && !esCdn) return; // Supabase y otros: siempre directo a la red

  event.respondWith(
    fetch(req)
      .then(resp => {
        if (resp && (resp.ok || resp.type === 'opaque')) {
          const copia = resp.clone();
          caches.open(CACHE).then(cache => cache.put(req, copia)).catch(() => null);
        }
        return resp;
      })
      .catch(async () => {
        const guardado = await caches.match(req, { ignoreSearch: mismoOrigen && req.mode === 'navigate' });
        if (guardado) return guardado;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Sin conexión' });
      })
  );
});
