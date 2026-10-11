import { useEffect, useRef, useState } from 'react'
import { Music, VolumeX } from 'lucide-react'

// Música suave mientras el cliente navega.
//
// Tres cosas que manda el navegador y no se pueden saltar:
//   1. La música NO puede empezar sola: la persona tiene que tocar el botón.
//      (Todos los navegadores lo bloquean para no molestar.)
//   2. Por eso el botón arranca apagado y recuerda la decisión de cada quien.
//   3. El archivo se descarga, así que conviene que sea corto y liviano.
//
// Para que aparezca el botón, pon el archivo en:
//   frontend/public/musica.wav
// Si no está, el botón no se muestra y no pasa nada.
const ARCHIVO = `${import.meta.env.BASE_URL}musica.wav`
const RECUERDO = 'keraven-musica'

export default function MusicaFondo() {
  const audio = useRef(null)
  const [hay, setHay] = useState(false)
  const [sonando, setSonando] = useState(false)

  useEffect(() => {
    // ¿Existe el archivo? Si no, ni se muestra el botón.
    fetch(ARCHIVO, { method: 'HEAD' })
      .then((r) => setHay(r.ok && !String(r.headers.get('content-type') || '').includes('text/html')))
      .catch(() => setHay(false))
  }, [])

  useEffect(() => {
    if (!hay) return
    // Si la última vez la dejó encendida, se intenta seguir.
    try {
      if (localStorage.getItem(RECUERDO) === 'si') encender()
    } catch { /* navegador sin memoria: no pasa nada */ }
  }, [hay])

  function encender() {
    if (!audio.current) {
      audio.current = new Audio(ARCHIVO)
      audio.current.loop = true
      audio.current.volume = 0.25 // bajita, de fondo
    }
    audio.current.play().then(() => setSonando(true)).catch(() => setSonando(false))
  }

  function alternar() {
    if (sonando) {
      audio.current?.pause()
      setSonando(false)
      try { localStorage.setItem(RECUERDO, 'no') } catch { /* sin memoria */ }
    } else {
      encender()
      try { localStorage.setItem(RECUERDO, 'si') } catch { /* sin memoria */ }
    }
  }

  useEffect(() => () => audio.current?.pause(), [])

  if (!hay) return null
  return (
    <button
      onClick={alternar}
      title={sonando ? 'Apagar la música' : 'Poner música'}
      aria-label={sonando ? 'Apagar la música' : 'Poner música'}
      className={`fixed bottom-24 md:bottom-6 left-4 z-40 rounded-full p-3 shadow-lg transition ${
        sonando ? 'bg-negro text-oro' : 'bg-white/90 text-gray-400 border border-oro/30'
      }`}
    >
      {sonando ? <Music size={18} /> : <VolumeX size={18} />}
    </button>
  )
}
