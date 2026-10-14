import { useEffect, useState } from 'react'
import { ImagePlus, Film, ChevronLeft, ChevronRight, Trash2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { subirFoto, subirVideo, borrarFoto, esVideo, VIDEO_MB, VIDEO_SEGUNDOS } from '../../utils/subirFoto'
import CarruselPromo from '../../components/CarruselPromo'

const MAXIMO = 10
const MAX_VIDEOS = 5
const NOMBRE = { temporada: 'Promociones de temporada', mes: 'Ofertas del mes' }

// Los dos cuadros de promoción del inicio del cliente. Cada uno lleva hasta
// 10 fotos que pasan solas. Aquí se suben, se ordenan y se encienden.
export default function Promociones() {
  const [cuadros, setCuadros] = useState([])
  const [aviso, setAviso] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('promociones').select('*').order('tipo', { ascending: false })
    setCuadros(data || [])
  }

  async function guardar(c, cambios) {
    const { error } = await supabase.from('promociones')
      .update({ ...cambios, actualizado_en: new Date().toISOString() }).eq('id', c.id)
    if (error) { setAviso('No se pudo guardar: ' + error.message); return false }
    setCuadros((l) => l.map((x) => (x.id === c.id ? { ...x, ...cambios } : x)))
    return true
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-grafondo">Promociones</h1>
      <p className="mb-5 text-sm text-gray-500">
        Dos cuadros en el inicio del cliente. Cada uno lleva hasta {MAXIMO} fotos y {MAX_VIDEOS} videos cortos que pasan solos.
      </p>
      {aviso && <p className="mb-4 rounded-xl border border-gray-200 bg-graclaro p-3 text-sm">{aviso}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {cuadros.map((c) => <Cuadro key={c.id} c={c} guardar={guardar} setAviso={setAviso} />)}
      </div>
    </div>
  )
}

function Cuadro({ c, guardar, setAviso }) {
  const [titulo, setTitulo] = useState(c.titulo || '')
  const [subiendo, setSubiendo] = useState(0)
  const fotos = Array.isArray(c.fotos) ? c.fotos : []
  const quedanFotos = MAXIMO - fotos.filter((u) => !esVideo(u)).length
  const quedanVideos = MAX_VIDEOS - fotos.filter(esVideo).length

  async function agregar(e, video) {
    const archivos = [...e.target.files].slice(0, video ? quedanVideos : quedanFotos)
    e.target.value = ''
    if (!archivos.length) return
    setSubiendo(archivos.length); setAviso('')
    const nuevas = []
    for (const a of archivos) {
      try { nuevas.push(video ? await subirVideo(a) : await subirFoto(a, 'promos')) } catch (err) { setAviso(`${a.name}: ${err.message}`) }
      setSubiendo((n) => n - 1)
    }
    if (nuevas.length) await guardar(c, { fotos: [...fotos, ...nuevas] })
  }

  async function quitar(i) {
    if (!confirm(`¿Quitar ${esVideo(fotos[i]) ? 'este video' : 'esta foto'} del cuadro?`)) return
    const url = fotos[i]
    if (await guardar(c, { fotos: fotos.filter((_, j) => j !== i) })) borrarFoto(url)
  }

  function mover(i, d) {
    const l = [...fotos]; const j = i + d
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    guardar(c, { fotos: l })
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-bold text-grafondo">{NOMBRE[c.tipo]}</p>
        <button
          onClick={() => {
            if (!c.activo && !fotos.length) { setAviso('Sube al menos una foto antes de publicarlo.'); return }
            guardar(c, { activo: !c.activo })
          }}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            c.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
        >
          {c.activo ? <><Eye size={14} /> Publicado</> : <><EyeOff size={14} /> Apagado</>}
        </button>
      </div>

      <label className="text-xs font-semibold uppercase text-gray-400">Título que ve el cliente</label>
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={() => titulo !== (c.titulo || '') && guardar(c, { titulo })}
        placeholder={NOMBRE[c.tipo]}
        className="mb-4 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {fotos.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-lg bg-graclaro">
            {esVideo(url)
              ? <video src={`${url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              : <img src={url} alt="" className="h-full w-full object-cover" />}
            <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-negro/70 px-1.5 text-[10px] text-white">
              {esVideo(url) && <Film size={10} />}{i + 1}
            </span>
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-negro/60 p-0.5">
              <button onClick={() => mover(i, -1)} disabled={i === 0} className="p-1 text-white disabled:opacity-30"><ChevronLeft size={14} /></button>
              <button onClick={() => quitar(i)} className="p-1 text-red-300"><Trash2 size={14} /></button>
              <button onClick={() => mover(i, 1)} disabled={i === fotos.length - 1} className="p-1 text-white disabled:opacity-30"><ChevronRight size={14} /></button>
            </div>
          </div>
        ))}
        {quedanFotos > 0 && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-200 text-center text-gray-400 hover:border-oro hover:text-oroprof">
            <ImagePlus size={22} />
            <span className="text-[11px]">{subiendo ? `Subiendo ${subiendo}…` : `Fotos (${quedanFotos})`}</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => agregar(e, false)} disabled={!!subiendo} />
          </label>
        )}
        {quedanVideos > 0 && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-200 text-center text-gray-400 hover:border-oro hover:text-oroprof">
            <Film size={22} />
            <span className="text-[11px]">{subiendo ? `Subiendo ${subiendo}…` : `Videos (${quedanVideos})`}</span>
            <input type="file" accept="video/*,.mp4,.mov,.m4v,.webm" multiple className="hidden" onChange={(e) => agregar(e, true)} disabled={!!subiendo} />
          </label>
        )}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Hasta {MAXIMO} fotos y {MAX_VIDEOS} videos. Cada video: máximo {VIDEO_SEGUNDOS} segundos y {VIDEO_MB} MB.
      </p>

      {fotos.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Así lo ve el cliente</p>
          <CarruselPromo fotos={fotos} titulo={titulo || NOMBRE[c.tipo]} etiqueta={c.tipo === 'temporada' ? 'Temporada' : 'Este mes'} />
        </div>
      )}
    </div>
  )
}
