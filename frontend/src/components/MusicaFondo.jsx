import { useEffect, useRef, useState } from 'react'
import { Music2, VolumeX, Volume1, Volume2, SkipForward } from 'lucide-react'

// Música de fondo mientras el cliente navega.
//
// Dos cosas que manda el navegador y no se pueden saltar:
//   1. La música NO puede empezar sola la primera vez: la persona tiene que
//      tocar algo. Por eso, si la dejó encendida, se queda esperando el
//      primer toque en cualquier parte de la pantalla y ahí arranca.
//   2. El archivo se descarga. Con internet lento eso tarda, por eso las
//      pistas van livianas y solo se baja la que se está oyendo.
//
// Las pistas viven en frontend/public/musica/. Si faltan, el botón no
// aparece y no pasa nada.
const PISTAS = [1, 2, 3, 4, 5].map((n) => `${import.meta.env.BASE_URL}musica/pista-${n}.mp3`)
const RECUERDO = 'keraven-musica'
const RECUERDO_VOL = 'keraven-musica-vol'

const leer = (k, pordefecto) => {
  try { return localStorage.getItem(k) ?? pordefecto } catch { return pordefecto }
}
const guardar = (k, v) => {
  try { localStorage.setItem(k, v) } catch { /* navegador sin memoria */ }
}

export default function MusicaFondo() {
  const audio = useRef(null)
  const orden = useRef([])
  const indice = useRef(0)
  const [hay, setHay] = useState(false)
  const [sonando, setSonando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [volumen, setVolumen] = useState(() => Number(leer(RECUERDO_VOL, '0.25')))

  useEffect(() => {
    // ¿Existen las pistas? Si no, ni se muestra el botón.
    fetch(PISTAS[0], { method: 'HEAD' })
      .then((r) => setHay(r.ok && !String(r.headers.get('content-type') || '').includes('text/html')))
      .catch(() => setHay(false))
  }, [])

  // Arranca donde quedó. Si el navegador no deja, espera el primer toque.
  useEffect(() => {
    if (!hay || leer(RECUERDO, 'no') !== 'si') return
    let quitar = () => {}
    encender().catch(() => {
      const alTocar = () => { encender(); quitar() }
      quitar = () => {
        document.removeEventListener('pointerdown', alTocar)
        document.removeEventListener('keydown', alTocar)
      }
      document.addEventListener('pointerdown', alTocar, { once: true })
      document.addEventListener('keydown', alTocar, { once: true })
    })
    return () => quitar()
  }, [hay])

  function siguientePista() {
    // Orden al azar, y cuando se acaban las cinco se vuelve a barajar: así
    // no se oye siempre la misma al entrar.
    if (indice.current >= orden.current.length) {
      orden.current = [...PISTAS].sort(() => Math.random() - 0.5)
      indice.current = 0
    }
    return orden.current[indice.current++]
  }

  function encender() {
    if (!audio.current) {
      audio.current = new Audio()
      audio.current.volume = volumen
      // Al terminar una, entra la siguiente sin cortes.
      audio.current.addEventListener('ended', () => {
        audio.current.src = siguientePista()
        audio.current.play().catch(() => setSonando(false))
      })
      audio.current.addEventListener('error', () => setSonando(false))
    }
    if (!audio.current.src) audio.current.src = siguientePista()
    return audio.current.play().then(() => setSonando(true))
  }

  function alternar() {
    if (sonando) {
      audio.current?.pause()
      setSonando(false)
      guardar(RECUERDO, 'no')
    } else {
      encender().then(() => guardar(RECUERDO, 'si')).catch(() => setSonando(false))
    }
  }

  function saltar() {
    if (!audio.current) return
    audio.current.src = siguientePista()
    audio.current.play().then(() => setSonando(true)).catch(() => setSonando(false))
  }

  function cambiarVolumen(v) {
    setVolumen(v)
    if (audio.current) audio.current.volume = v
    guardar(RECUERDO_VOL, String(v))
  }

  useEffect(() => () => audio.current?.pause(), [])

  if (!hay) return null
  const Icono = !sonando ? VolumeX : volumen < 0.34 ? Volume1 : Volume2

  return (
    <div className="fixed bottom-24 left-4 z-40 md:bottom-6">
      <div className="flex items-center gap-1 rounded-full border border-oro/30 bg-crema/95 py-1 pl-1 pr-1 shadow-lg backdrop-blur">
        <button
          onClick={alternar}
          title={sonando ? 'Silenciar' : 'Poner música'}
          aria-label={sonando ? 'Silenciar' : 'Poner música'}
          className={`grid h-9 w-9 place-items-center rounded-full transition ${
            sonando ? 'bg-negro text-orosuave' : 'text-negro/40 hover:text-negro'
          }`}
        >
          {sonando ? <Music2 size={15} strokeWidth={1.7} /> : <VolumeX size={15} strokeWidth={1.7} />}
        </button>

        {/* El control de volumen solo aparece si usted lo pide: discreto. */}
        <button
          onClick={() => setAbierto((a) => !a)}
          title="Volumen"
          aria-label="Volumen"
          aria-expanded={abierto}
          className="grid h-9 w-7 place-items-center rounded-full text-negro/35 transition hover:text-negro"
        >
          <Icono size={14} strokeWidth={1.7} />
        </button>

        {abierto && (
          <div className="flex items-center gap-2 pl-1 pr-2.5">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volumen}
              onChange={(e) => cambiarVolumen(Number(e.target.value))}
              aria-label="Volumen de la música"
              className="h-1 w-20 cursor-pointer accent-oro"
            />
            <button
              onClick={saltar}
              title="Otra canción"
              aria-label="Otra canción"
              className="text-negro/35 transition hover:text-negro"
            >
              <SkipForward size={13} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
