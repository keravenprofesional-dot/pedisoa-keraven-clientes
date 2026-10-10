import { useRef, useState } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import { subirFoto, borrarFoto } from '../utils/subirFoto'

// Recuadro para poner la foto del producto empacado.
// `valor` es la dirección de la foto; `alCambiar` recibe la nueva (o null).
export default function CampoFoto({ valor, alCambiar, carpeta = 'productos', etiqueta = 'Foto del producto' }) {
  const entrada = useRef(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  async function elegir(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setError('')
    setSubiendo(true)
    try {
      const anterior = valor
      alCambiar(await subirFoto(archivo, carpeta))
      if (anterior) borrarFoto(anterior)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  function quitar() {
    if (valor) borrarFoto(valor)
    alCambiar(null)
  }

  return (
    <div className="text-sm">
      <span className="block mb-1">{etiqueta}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={subiendo}
          className="relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 bg-graclaro overflow-hidden flex items-center justify-center text-gray-400 hover:border-petroleo"
          title={valor ? 'Cambiar la foto' : 'Poner una foto'}
        >
          {valor
            ? <img src={valor} alt="" className="w-full h-full object-cover" />
            : <Camera size={22} />}
          {subiendo && (
            <span className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-petroleo" />
            </span>
          )}
        </button>
        <div className="text-xs text-gray-500">
          {subiendo ? 'Subiendo la foto…' : valor
            ? <button type="button" onClick={quitar} className="flex items-center gap-1 text-red-500"><X size={13} /> Quitar la foto</button>
            : <>Toca el recuadro para tomar o elegir una foto.<br />Se achica sola para que cargue rápido.</>}
          {error && <p className="text-red-500 mt-1">{error}</p>}
        </div>
      </div>
      <input ref={entrada} type="file" accept="image/*" onChange={elegir} className="hidden" />
    </div>
  )
}
