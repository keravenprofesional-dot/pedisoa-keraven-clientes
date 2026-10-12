import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Music2, VolumeX } from 'lucide-react'

// Música de fondo mientras el cliente navega.
//
// El cliente SOLO puede encender o apagar. Nada de volumen ni de saltar a
// otra canción: eso lo decide Keraven, no quien compra.
//
// El sonido vive aquí, en un solo sitio (MusicaProvider), y el botón se
// dibuja donde haga falta (BotonMusica). Si cada botón tuviera su propio
// audio, sonarían dos canciones a la vez.
//
// Dos cosas que manda el navegador y no se pueden saltar:
//   1. La música NO puede empezar sola la primera vez: la persona tiene que
//      tocar algo. Por eso, si la dejó encendida, se espera el primer toque
//      en cualquier parte y ahí arranca.
//   2. Cada pista se descarga al sonar. Con internet lento eso tarda, por
//      eso van livianas y solo se baja la que se está oyendo.
//
// Las pistas viven en frontend/public/musica/. Si faltan, el botón no
// aparece y no pasa nada.
const PISTAS = [1, 2, 3, 4, 5].map((n) => `${import.meta.env.BASE_URL}musica/pista-${n}.mp3`)
const VOLUMEN = 0.22 // de fondo, para que no tape nada
const RECUERDO = 'keraven-musica'

const leer = (k, pordefecto) => {
  try { return localStorage.getItem(k) ?? pordefecto } catch { return pordefecto }
}
const guardar = (k, v) => {
  try { localStorage.setItem(k, v) } catch { /* navegador sin memoria */ }
}

const Contexto = createContext({ hay: false, sonando: false, alternar: () => {} })
export const useMusica = () => useContext(Contexto)

export function MusicaProvider({ children }) {
  const audio = useRef(null)
  const orden = useRef([])
  const indice = useRef(0)
  const [hay, setHay] = useState(false)
  const [sonando, setSonando] = useState(false)

  useEffect(() => {
    // ¿Existen las pistas? Si no, ni se muestra el botón.
    fetch(PISTAS[0], { method: 'HEAD' })
      .then((r) => setHay(r.ok && !String(r.headers.get('content-type') || '').includes('text/html')))
      .catch(() => setHay(false))
  }, [])

  // Entra sonando: así lo quiere Keraven. Quien no la quiera, la apaga, y
  // entonces sí se le respeta apagada la próxima vez ('no' queda guardado).
  // Si el navegador no deja sonar todavía, espera el primer toque.
  useEffect(() => {
    if (!hay || leer(RECUERDO, 'si') !== 'si') return
    let quitar = () => {}
    encender().catch(() => {
      const alTocar = () => { encender().catch(() => {}); quitar() }
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
      audio.current.volume = VOLUMEN
      // Al terminar una, entra la siguiente sola.
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

  useEffect(() => () => audio.current?.pause(), [])

  return <Contexto.Provider value={{ hay, sonando, alternar }}>{children}</Contexto.Provider>
}

// El botón. `variante="nav"` lo dibuja como un renglón más de la barra de
// abajo (igual que Inicio o Perfil); `flotante` lo deja como burbuja, que
// es lo que se usa en pantalla grande, donde no hay barra de abajo.
export function BotonMusica({ variante = 'flotante', className = '' }) {
  const { hay, sonando, alternar } = useMusica()
  if (!hay) return null
  const Icono = sonando ? Music2 : VolumeX
  const texto = sonando ? 'Apagar la música' : 'Poner música'

  if (variante === 'nav') {
    return (
      <button onClick={alternar} title={texto} aria-label={texto} aria-pressed={sonando}
        className={`flex min-w-0 flex-col items-center gap-1 py-0.5 ${className}`}>
        <span className={`grid h-9 w-9 place-items-center rounded-full transition ${
          sonando ? 'bg-negro text-orosuave' : 'text-negro/45'
        }`}>
          <Icono size={18} strokeWidth={sonando ? 1.7 : 1.4} />
        </span>
        <span className={`w-full truncate text-center font-sans text-[10px] leading-tight ${
          sonando ? 'font-medium text-negro' : 'text-negro/45'
        }`}>
          Música
        </span>
      </button>
    )
  }

  return (
    <button onClick={alternar} title={texto} aria-label={texto} aria-pressed={sonando}
      className={`fixed bottom-6 left-4 z-40 grid h-11 w-11 place-items-center rounded-full border shadow-lg backdrop-blur transition ${
        sonando ? 'border-oro/50 bg-negro text-orosuave' : 'border-oro/30 bg-crema/95 text-negro/40 hover:text-negro'
      } ${className}`}>
      <Icono size={16} strokeWidth={1.7} />
    </button>
  )
}
