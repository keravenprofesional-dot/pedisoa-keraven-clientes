import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Music2, VolumeX } from 'lucide-react'

// Música de fondo mientras el cliente navega. Funciona como una EMISORA:
// no empieza "pista 1 desde el segundo 0" cuando alguien enciende, sino que
// entra por donde va la programación en ese momento, como cuando uno prende
// un radio. Dos clientes que enciendan a la misma hora oyen lo mismo.
//
// El cliente SOLO puede encender o apagar. Nada de volumen, ni de saltar
// canción, ni de ver qué suena: eso lo decide Keraven, no quien compra.
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

// === EMISORA: INICIO ===========================================================
// Este bloque es puro cálculo (ni React ni navegador) para poderlo probar
// aparte con Node. El script de prueba lo recorta por estas marcas, así que
// aquí dentro no debe entrar nada que necesite navegador.

// Duraciones reales de los cinco mp3, en segundos. Van QUEMADAS a propósito.
//
// PORQUÉ: para saber qué debería estar sonando "ahora" hay que conocer el
// largo de las cinco pistas. Si las leyéramos con metadata, el navegador
// tendría que tocar los cinco archivos ANTES de la primera nota; con el
// internet del dueño (~6 KB/s) eso son varios segundos de silencio y datos
// gastados sin oír nada, y encima la música quedaría esperando a la más
// lenta. Quemadas cuestan 0 bytes y 0 ms: la emisora sabe su horario al
// instante y solo se descarga la pista que de verdad se va a oír.
//
// El riesgo de quemarlas es que alguien cambie un mp3 y el horario quede
// corrido. Eso está cubierto abajo: cuando la pista sí carga, se compara con
// su duración real (`audio.duration`) y el salto se recorta para no caer
// fuera; y al terminar cada pista se vuelve a mirar el reloj.
const DURACIONES = [118.0, 98.1, 72.0, 188.0, 205.3]

// Lo que dura una vuelta completa a las cinco pistas: 681.4 s (11 min 21 s).
const VUELTA = DURACIONES.reduce((total, d) => total + d, 0)

// Fecha fija de arranque de la emisora. Es solo un punto de referencia: todos
// los equipos cuentan desde el mismo instante, y por eso dos clientes a la
// misma hora caen en el mismo segundo de la misma pista SIN necesidad de
// servidor. No se debe cambiar, o la programación se corre para todos.
const ARRANQUE = Date.UTC(2025, 0, 1, 0, 0, 0)

// Dado un instante, dice qué pista y qué segundo van al aire.
// Devuelve siempre algo válido: nunca null, nunca un segundo fuera de la
// pista, nunca una excepción. Si el reloj del equipo viene raro (vacío, en el
// pasado, o en el año 1970 porque la tablet perdió la hora), se sintoniza el
// principio del ciclo y la música suena igual: lo único que se pierde es que
// esa persona oiga lo mismo que las demás.
export function programacion(ahora = Date.now()) {
  const ms = Number(ahora)
  if (!Number.isFinite(ms)) return { indice: 0, segundo: 0 }

  // El módulo doble (`% V + V) % V`) es para que un reloj atrasado —que da
  // resta negativa— también caiga dentro de la vuelta en vez de dar un
  // número negativo.
  const posicion = (((ms - ARRANQUE) / 1000) % VUELTA + VUELTA) % VUELTA

  let resto = posicion
  for (let i = 0; i < DURACIONES.length; i++) {
    if (resto < DURACIONES[i]) return { indice: i, segundo: resto }
    resto -= DURACIONES[i]
  }
  // Solo se llega aquí por un redondeo de decimales en el último borde:
  // se entra limpio al principio de la primera pista.
  return { indice: 0, segundo: 0 }
}

// Cuántos segundos como mínimo vale la pena oír de una pista. Si la emisora
// cae en la colita de una canción, entrar ahí sería oír dos segundos y un
// corte; mejor empezar la siguiente desde su principio.
const COLA_MINIMA = 2

// La programación, ya lista para poner la aguja: evita las colitas.
export function sintonia(ahora = Date.now()) {
  const { indice, segundo } = programacion(ahora)
  if (DURACIONES[indice] - segundo < COLA_MINIMA) {
    return { indice: (indice + 1) % DURACIONES.length, segundo: 0 }
  }
  return { indice, segundo }
}

// Cuánto se espera antes del arranque AUTOMÁTICO, al entrar a la aplicación.
//
// PORQUÉ: entrar y que la música caiga encima es brusco; el dueño quiere un
// respiro de diez segundos. Y de paso esos diez segundos juegan a favor: el
// navegador no deja sonar nada hasta que la persona toque la pantalla, y en
// diez segundos de mirar el catálogo lo más probable es que ya la haya
// tocado. O sea que la música entra sola, sin pedirle nada a nadie.
//
// Esto NO aplica cuando el cliente toca el botón a propósito: ahí suena al
// instante, porque ya tocó.
export const ESPERA_ENTRADA = 10000

// Cuando se cumplen los diez segundos, ¿todavía debe sonar?
//
// En diez segundos pasan cosas: el cliente puede tocar el botón, apagarla, o
// irse de la pantalla. Su decisión manda sobre el arranque automático: nada
// de música que aparece sola después de que la apagaron.
export function debeArrancar({ hay, recuerdo, desmontado, decidioElCliente }) {
  if (!hay) return false                 // no hay pistas que poner
  if (desmontado) return false           // ya se fue de la pantalla
  if (decidioElCliente) return false     // ya tocó el botón: él manda
  return recuerdo === 'si'               // la dejó encendida (o es su primera vez)
}
// === EMISORA: FIN ==============================================================

const PISTAS = DURACIONES.map((_, i) => `${import.meta.env.BASE_URL}musica/pista-${i + 1}.mp3`)
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
  const pista = useRef(0)      // qué pista del ciclo está puesta
  const destino = useRef(0)    // a qué segundo queremos entrar
  const cargada = useRef(null) // qué archivo está ya descargado, para no bajarlo dos veces
  const fallos = useRef(0)     // pistas seguidas que no cargaron
  const espera = useRef(null)  // el temporizador de los 10 segundos de entrada
  const decidio = useRef(false) // ¿el cliente ya tocó el botón él mismo?
  const [hay, setHay] = useState(false)
  const [sonando, setSonando] = useState(false)

  useEffect(() => {
    // ¿Existen las pistas? Si no, ni se muestra el botón.
    fetch(PISTAS[0], { method: 'HEAD' })
      .then((r) => setHay(r.ok && !String(r.headers.get('content-type') || '').includes('text/html')))
      .catch(() => setHay(false))
  }, [])

  // Corta el temporizador de entrada si todavía está pendiente.
  function cancelarEspera() {
    if (espera.current) { clearTimeout(espera.current); espera.current = null }
  }

  // Entra sonando: así lo quiere Keraven. Quien no la quiera, la apaga, y
  // entonces sí se le respeta apagada la próxima vez ('no' queda guardado).
  //
  // Pero no entra de golpe: se le dan diez segundos de respiro a la persona.
  // Cuando se cumplen, se vuelve a mirar el reloj —esos diez segundos
  // corrieron para la emisora también— y se entra donde va la programación en
  // ESE momento, no donde iba cuando se abrió la pantalla.
  //
  // Si al cumplirse el navegador todavía no deja sonar (nadie tocó nada en
  // diez segundos), queda el plan de siempre: arranca en el primer toque.
  useEffect(() => {
    if (!hay) return
    let desmontado = false
    let quitar = () => {}

    espera.current = setTimeout(() => {
      espera.current = null
      // Se vuelve a preguntar: en diez segundos el cliente pudo apagarla o
      // irse. Si decidió algo, su decisión manda.
      if (!debeArrancar({ hay, recuerdo: leer(RECUERDO, 'si'), desmontado, decidioElCliente: decidio.current })) return
      encender().catch(() => {
        const alTocar = () => {
          if (!desmontado && !decidio.current) encender().catch(() => {})
          quitar()
        }
        quitar = () => {
          document.removeEventListener('pointerdown', alTocar)
          document.removeEventListener('keydown', alTocar)
        }
        document.addEventListener('pointerdown', alTocar, { once: true })
        document.addEventListener('keydown', alTocar, { once: true })
      })
    }, ESPERA_ENTRADA)

    // Al salir de la pantalla se limpia todo: ni temporizador colgando ni
    // oyentes de toque esperando a resucitar la música.
    return () => { desmontado = true; cancelarEspera(); quitar() }
  }, [hay])

  // Pone una pista y deja apuntado en qué segundo hay que entrar.
  function ponerPista(i, segundo) {
    const el = audio.current
    pista.current = i
    destino.current = segundo
    const url = PISTAS[i]

    if (cargada.current === url) {
      // Esta ya está descargada: solo movemos la aguja, sin gastar internet
      // otra vez. (Pasa al apagar y volver a encender la misma canción.)
      try { el.currentTime = segundo } catch { /* todavía no deja; lo hace 'loadedmetadata' */ }
      return
    }

    cargada.current = url
    // El `#t=` le pide al navegador empezar en ese segundo. Donde funciona,
    // además baja el audio DESDE ahí en vez de desde el principio, que con
    // internet lento es la diferencia entre oír al instante o esperar. Donde
    // no funciona, el 'loadedmetadata' de abajo mueve la aguja a mano.
    el.src = segundo > 0.5 ? `${url}#t=${segundo.toFixed(2)}` : url
  }

  // Mira el reloj y pone la aguja donde va la emisora ahora mismo.
  function sintonizar() {
    const { indice, segundo } = sintonia()
    ponerPista(indice, segundo)
  }

  function encender() {
    if (!audio.current) {
      audio.current = new Audio()
      audio.current.volume = VOLUMEN
      audio.current.preload = 'auto'

      // Cuando el navegador ya sabe cuánto dura el archivo, confirmamos el
      // salto. Aquí es donde la duración REAL manda sobre la quemada: si el
      // mp3 resultó más corto, se recorta para no caer fuera de la pista
      // (caer fuera dejaría la música muerta).
      audio.current.addEventListener('loadedmetadata', () => {
        const el = audio.current
        const real = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null
        let meta = destino.current
        if (real) meta = Math.min(meta, Math.max(0, real - COLA_MINIMA))
        // Si el `#t=` ya hizo el trabajo, no lo tocamos (mover la aguja otra
        // vez obliga al navegador a pedir el archivo de nuevo).
        if (meta > 0.5 && el.currentTime < 0.5) {
          try { el.currentTime = meta } catch { /* el navegador se niega: suena desde el principio */ }
        }
      })

      // Suena de verdad: borrón y cuenta nueva en el contador de fallos.
      audio.current.addEventListener('playing', () => { fallos.current = 0 })

      // Al terminar una, entra la SIGUIENTE DEL CICLO desde su segundo 0:
      // si entramos en hora, el ciclo ya va en hora y no hay que calcular
      // nada. Solo si el reloj dice que estamos muy corridos (señal de que
      // una duración quemada no coincide con el mp3 real) se vuelve a
      // sintonizar, y así la emisora se endereza sola.
      audio.current.addEventListener('ended', () => {
        const siguiente = (pista.current + 1) % PISTAS.length
        const ahora = sintonia()
        if (ahora.indice === siguiente && ahora.segundo < 10) ponerPista(siguiente, 0)
        else ponerPista(ahora.indice, ahora.segundo)
        audio.current.play().catch(() => setSonando(false))
      })

      // Plan B si una pista no carga (archivo borrado, internet cortado):
      // se pasa a la siguiente en vez de quedarse en silencio. Si fallan las
      // cinco seguidas, se deja de insistir calladamente: la pantalla sigue
      // funcionando, solo que sin música.
      audio.current.addEventListener('error', () => {
        fallos.current += 1
        if (fallos.current >= PISTAS.length) { setSonando(false); return }
        cargada.current = null
        ponerPista((pista.current + 1) % PISTAS.length, 0)
        audio.current.play().catch(() => setSonando(false))
      })
    }

    // Siempre se vuelve a mirar el reloj, incluso al volver a encender: por
    // eso apagar y encender no reinicia nada, cae donde va la emisora.
    sintonizar()
    return audio.current.play().then(() => setSonando(true))
  }

  function alternar() {
    // El cliente tocó el botón: de aquí en adelante manda él, no el arranque
    // automático. Se mata el temporizador de los diez segundos para que no
    // vuelva después a poner música que acaba de apagar.
    decidio.current = true
    cancelarEspera()

    if (sonando) {
      audio.current?.pause()
      setSonando(false)
      guardar(RECUERDO, 'no')
    } else {
      // Aquí no se espera nada: tocó el botón a propósito y ya tocó la
      // pantalla, así que el navegador deja sonar al instante.
      encender().then(() => guardar(RECUERDO, 'si')).catch(() => setSonando(false))
    }
  }

  useEffect(() => () => { cancelarEspera(); audio.current?.pause() }, [])

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
