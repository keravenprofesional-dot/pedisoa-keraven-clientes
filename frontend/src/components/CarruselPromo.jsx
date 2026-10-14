import { useEffect, useRef, useState } from 'react'
import { Maximize2, Volume2, VolumeX } from 'lucide-react'
import { esVideo } from '../utils/subirFoto'
import { useMusica } from './MusicaFondo'

const CADA = 4500 // milisegundos que dura cada foto

// Un cuadro de promoción: fotos y videos que pasan solos. La foto se acerca
// despacio con un desvanecido; el video se ve completo y al terminar pasa al
// siguiente. El navegador NO deja que un video arranque solo con sonido: empieza
// callado y el cliente toca "Tocar para oír". Mientras el video habla, la
// música de fondo se calla, y vuelve sola cuando el video se calla o se va.
// El cuadro toma la forma del video (los verticales del celular se ven altos y
// completos) y hay botón de pantalla completa. Con el dedo se pasa adelante o atrás, y los
// puntitos llevan a cualquiera.
export default function CarruselPromo({ titulo, etiqueta, fotos }) {
  const [actual, setActual] = useState(0)
  const [pausa, setPausa] = useState(false)
  const toque = useRef(null)
  const videos = useRef({})
  const total = fotos.length
  const tocaVideo = esVideo(fotos[actual])
  const [conSonido, setConSonido] = useState(false)
  const [forma, setForma] = useState({}) // ancho/alto de cada video, cuando se sabe
  const { cederAlVideo, alPonerMusica } = useMusica()

  // Habla el video solo si está a la vista y el cliente le puso sonido
  const hablando = conSonido && tocaVideo
  useEffect(() => {
    Object.entries(videos.current).forEach(([i, v]) => { if (v) v.muted = !(hablando && Number(i) === actual) })
    cederAlVideo(hablando)
  }, [hablando, actual])
  useEffect(() => () => cederAlVideo(false), [])
  // Si el cliente prende la música a mano, el video se calla
  useEffect(() => {
    alPonerMusica.current = () => setConSonido(false)
    return () => { alPonerMusica.current = null }
  }, [])

  function pantallaCompleta() {
    const v = videos.current[actual]; if (!v) return
    setConSonido(true)
    if (v.requestFullscreen) v.requestFullscreen().catch(() => {})
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen() // iPhone
  }
  // Forma del cuadro: la del video que se ve (entre 9:16 vertical y 16:9);
  // las fotos siguen como siempre.
  const r = tocaVideo ? forma[actual] : null
  const estiloCuadro = r ? { aspectRatio: String(Math.min(Math.max(r, 9 / 16), 16 / 9)), maxHeight: '78vh' } : undefined

  useEffect(() => { if (actual >= total) setActual(0) }, [total, actual])

  // Solo suena (en silencio) el video que está a la vista, desde el inicio.
  useEffect(() => {
    Object.entries(videos.current).forEach(([i, v]) => {
      if (!v) return
      if (Number(i) === actual) { v.currentTime = 0; v.play().catch(() => {}) } else v.pause()
    })
  }, [actual, fotos])

  // Las fotos cambian por reloj; los videos, cuando terminan.
  useEffect(() => {
    if (total < 2 || pausa || tocaVideo) return
    const t = setTimeout(() => setActual((a) => (a + 1) % total), CADA)
    return () => clearTimeout(t)
  }, [actual, total, pausa, tocaVideo])

  const ir = (n) => setActual((n + total) % total)

  return (
    <section className="overflow-hidden rounded-[22px] bg-negro ring-1 ring-oro/40">
      <div
        className={`relative w-full overflow-hidden transition-[aspect-ratio] duration-500 ${r ? '' : 'aspect-[4/3] md:aspect-[16/9]'}`}
        style={estiloCuadro}
        onTouchStart={(e) => { toque.current = e.touches[0].clientX; setPausa(true) }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - (toque.current ?? 0)
          if (Math.abs(dx) > 40) ir(actual + (dx < 0 ? 1 : -1))
          setPausa(false)
        }}
        onMouseEnter={() => setPausa(true)}
        onMouseLeave={() => setPausa(false)}
      >
        {fotos.map((url, i) => {
          const clase = `absolute inset-0 h-full w-full ${esVideo(url) ? 'object-contain' : 'object-cover'} transition-opacity duration-1000 ${
            i === actual ? 'opacity-100' : 'opacity-0'}`
          return esVideo(url) ? (
            <video
              key={url + i}
              ref={(v) => { videos.current[i] = v }}
              src={url}
              muted
              playsInline
              loop={total === 1}
              preload={i === actual ? 'auto' : 'metadata'}
              onLoadedMetadata={(e) => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) setForma((f) => ({ ...f, [i]: v.videoWidth / v.videoHeight })) }}
              onEnded={() => total > 1 && ir(i + 1)}
              onError={() => i === actual && total > 1 && ir(i + 1)}
              className={clase}
            />
          ) : (
            <img
              key={url + i}
              src={url}
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              className={`${clase} ${i === actual ? 'promo-acercar' : ''}`}
            />
          )
        })}

        {/* Velo y letrero (en un video, más bajito para no taparlo) */}
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-negro/85 to-transparent ${tocaVideo ? 'h-1/5' : 'h-2/5'}`} />
        <div className={`pointer-events-none absolute bottom-4 left-5 ${tocaVideo ? 'right-28' : 'right-5'}`}>
          <p className="font-sans text-[9px] font-medium uppercase tracking-[0.4em] text-orosuave">{etiqueta}</p>
          <p className="mt-1 font-display text-[24px] leading-tight text-white md:text-[30px]">{titulo}</p>
        </div>

        {tocaVideo && (
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button
              onClick={() => setConSonido((s) => !s)}
              aria-label={conSonido ? 'Quitar el sonido del video' : 'Oír el video'}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 font-sans text-[12px] font-medium shadow-lg backdrop-blur ${
                conSonido ? 'bg-negro/70 text-orosuave' : 'animate-pulse bg-oro text-negro'}`}
            >
              {conSonido ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {conSonido ? '' : 'Tocar para oír'}
            </button>
            <button onClick={pantallaCompleta} aria-label="Ver el video en pantalla completa"
              className="grid h-9 w-9 place-items-center rounded-full bg-negro/70 text-white shadow-lg backdrop-blur">
              <Maximize2 size={16} />
            </button>
          </div>
        )}

        {total > 1 && (
          <div className="absolute right-4 top-4 flex gap-1.5">
            {fotos.map((_, i) => (
              <button
                key={i}
                aria-label={`Anuncio ${i + 1}`}
                onClick={() => ir(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ${i === actual ? 'w-5 bg-oro' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
