// Service Worker mínimo para habilitar la instalación de la PWA
const CACHE_NAME = 'stock-system-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // El navegador requiere un fetch handler para activar el prompt de instalación
  event.respondWith(fetch(event.request).catch(() => cafes.match(event.request)));
});
