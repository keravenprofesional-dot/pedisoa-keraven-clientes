import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

// El navegador guarda la página para abrirla más rápido, y por eso a veces
// se sigue viendo la versión vieja después de un cambio. Esto revisa cada
// 3 minutos si hay una nueva y avisa con un botón para actualizar.
const CADA = 3 * 60 * 1000

async function versionPublicada() {
  const r = await fetch(`${import.meta.env.BASE_URL}index.html?v=${Date.now()}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('sin respuesta')
  const html = await r.text()
  return html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? null
}

export default function AvisoVersion() {
  const [hayNueva, setHayNueva] = useState(false)

  useEffect(() => {
    let actual = null
    let vivo = true

    async function revisar() {
      try {
        const v = await versionPublicada()
        if (!vivo || !v) return
        if (actual === null) actual = v
        else if (v !== actual) setHayNueva(true)
      } catch {
        // Sin internet o GitHub lento: se vuelve a intentar en la próxima vuelta.
      }
    }

    revisar()
    const reloj = setInterval(revisar, CADA)
    // También al volver a la pestaña, que es cuando más se nota.
    const alVolver = () => document.visibilityState === 'visible' && revisar()
    document.addEventListener('visibilitychange', alVolver)
    return () => { vivo = false; clearInterval(reloj); document.removeEventListener('visibilitychange', alVolver) }
  }, [])

  if (!hayNueva) return null
  return (
    <button
      onClick={() => window.location.reload(true)}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-petroleo text-white rounded-full shadow-lg px-5 py-3 text-sm font-semibold"
    >
      <RefreshCw size={16} /> Hay una versión nueva · Toca para actualizar
    </button>
  )
}
