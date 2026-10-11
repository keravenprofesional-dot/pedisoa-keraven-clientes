// Guarda en el teléfono las partes del programa que nunca cambian, para que
// la segunda vez abra al instante aunque el internet esté lentísimo.
//
// Regla de oro: los archivos de /assets/ llevan un código en el nombre
// (main-BtgpIm5w.js). Si el programa cambia, cambia el nombre. Por eso se
// pueden guardar para siempre sin miedo a quedarse con una versión vieja.
// La página de entrada (index.html) NUNCA se guarda: siempre se pide fresca,
// que es la que dice cuál es la versión buena.
const CACHE = 'keraven-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const n of await caches.keys()) if (n !== CACHE) await caches.delete(n)
  await self.clients.claim()
})()))

const guardable = (url) =>
  url.pathname.includes('/assets/') ||          // el programa y sus estilos
  url.hostname === 'fonts.gstatic.com' ||       // las letras
  url.hostname === 'fonts.googleapis.com' ||
  /\.(png|jpg|jpeg|webp|svg|woff2?|mp3|wav)$/i.test(url.pathname)

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  let url
  try { url = new URL(req.url) } catch { return }

  // Las fotos de los productos y demás: primero lo guardado, y si no, internet.
  if (guardable(url)) {
    e.respondWith((async () => {
      const guardado = await caches.match(req)
      if (guardado) return guardado
      const red = await fetch(req)
      if (red.ok) (await caches.open(CACHE)).put(req, red.clone())
      return red
    })())
    return
  }

  // La página de entrada: siempre fresca. Si no hay internet, la última que haya.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const red = await fetch(req)
        if (red.ok) (await caches.open(CACHE)).put(req, red.clone())
        return red
      } catch {
        return (await caches.match(req)) || (await caches.match('./')) || Response.error()
      }
    })())
  }
  // Todo lo demás (la base de datos) va directo a internet, sin guardar.
})
