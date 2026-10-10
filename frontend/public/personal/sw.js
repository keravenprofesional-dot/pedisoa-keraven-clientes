// Igual que el de clientas: existe solo para poder instalar la app.
// No guarda copias, así nunca se queda con una versión vieja.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => { /* todo va directo a internet */ })
