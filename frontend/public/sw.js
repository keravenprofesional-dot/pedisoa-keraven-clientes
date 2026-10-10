// Este ayudante existe solo para que Chrome deje instalar la app en el
// escritorio y en el celular. A propósito NO guarda copias de nada: así
// nunca se queda mostrando una versión vieja del programa.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => { /* todo va directo a internet */ })
