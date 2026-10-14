import { useEffect, useRef, useState } from 'react'
import { esVideo } from '../utils/subirFoto'

const CADA = 4500 // milisegundos que dura cada foto

// Un cuadro de promoción: fotos y videos que pasan solos. La foto se acerca
// despacio con un desvanecido; el video se ve completo (sin sonido) y al
// terminar pasa al siguiente. Con el dedo se pasa adelante o atrás, y los
// puntitos llevan a cualquiera.
export default function CarruselPromo({ titulo, etiqueta, fotos }) {
  const [actual, setActual] = useState(0)
  const [pausa, setPausa] = useState(false)
  const toque = useRef(null)
  const videos = useRef({})
  const total = fotos.length
  const tocaVideo = esVideo(fotos[actual])

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
        className="relative aspect-[4/3] w-full overflow-hidden md:aspect-[16/9]"
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
          const clase = `absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
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

        {/* Velo y letrero */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-negro/85 to-transparent" />
        <div className="pointer-events-none absolute bottom-4 left-5 right-5">
          <p className="font-sans text-[9px] font-medium uppercase tracking-[0.4em] text-orosuave">{etiqueta}</p>
          <p className="mt-1 font-display text-[24px] leading-tight text-white md:text-[30px]">{titulo}</p>
        </div>

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
