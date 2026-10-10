import { useEffect, useState } from 'react'
import { Package, Layers, Gift, Boxes, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import ListaProductos from './Products'
import Lineas from './Lineas'
import Combos from './Combos'

const PESTANAS = [
  { id: 'productos', icono: Package, texto: 'Productos' },
  { id: 'lineas', icono: Layers, texto: 'Líneas' },
  { id: 'duo_pack', icono: Gift, texto: 'Duo Pack' },
  { id: 'duo_kit', icono: Boxes, texto: 'Duo Kit' },
]

export default function Catalogo() {
  const { puede } = useAuth()
  const puedePublicar = puede('configuracion')
  const [pestana, setPestana] = useState('productos')
  const [publicado, setPublicado] = useState(null)
  const [cambiando, setCambiando] = useState(false)

  useEffect(() => {
    supabase.from('company_settings').select('catalogo_publicado').maybeSingle()
      .then(({ data }) => setPublicado(data?.catalogo_publicado ?? false))
  }, [])

  async function cambiarPublicado() {
    const nuevo = !publicado
    if (nuevo && !confirm('¿Publicar el catálogo? Desde este momento los clientes podrán ver y pedir los productos que tengan precio y estén disponibles.')) return
    setCambiando(true)
    const { error } = await supabase.from('company_settings').update({ catalogo_publicado: nuevo }).eq('id', 1)
    setCambiando(false)
    if (error) return alert('No se pudo cambiar. ¿Tienes permiso de Configuración?')
    setPublicado(nuevo)
  }

  return (
    <div className="p-4 md:p-8">
      {/* Aviso bien visible de si los clientes ya lo ven o no */}
      {publicado !== null && (
        <div className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 mb-5 border-2 ${
          publicado ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-400'
        }`}>
          {publicado ? <Eye size={22} className="text-green-700 shrink-0" /> : <EyeOff size={22} className="text-amber-700 shrink-0" />}
          <div className="flex-1 min-w-[14rem]">
            <p className={`font-bold ${publicado ? 'text-green-900' : 'text-amber-900'}`}>
              {publicado ? 'El catálogo está publicado' : 'El catálogo está en preparación'}
            </p>
            <p className={`text-sm ${publicado ? 'text-green-800' : 'text-amber-800'}`}>
              {publicado
                ? 'Los clientes ya ven los productos con precio y disponibles.'
                : 'Los clientes NO ven ningún producto todavía. Arma todo con calma y publícalo cuando esté listo.'}
            </p>
          </div>
          {puedePublicar && (
            <button
              onClick={cambiarPublicado}
              disabled={cambiando}
              className={`rounded-xl px-5 py-2.5 font-bold text-sm disabled:opacity-60 ${
                publicado ? 'bg-white border border-gray-300 text-grafondo' : 'bg-green-700 text-white'
              }`}
            >
              {cambiando ? 'Un momento…' : publicado ? 'Volver a esconderlo' : 'Publicar el catálogo'}
            </button>
          )}
        </div>
      )}

      <h1 className="text-2xl font-bold text-grafondo mb-3">Catálogo</h1>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {PESTANAS.map(({ id, icono: Icono, texto }) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${
              pestana === id ? 'bg-petroleo text-white' : 'bg-white border border-gray-200 text-gray-500'
            }`}
          >
            <Icono size={16} /> {texto}
          </button>
        ))}
      </div>

      {pestana === 'productos' && <ListaProductos />}
      {pestana === 'lineas' && <Lineas />}
      {pestana === 'duo_pack' && (
        <Combos tipo="duo_pack" titulo="Duo Pack" ejemplo="Por ejemplo: shampoo + tratamiento de la misma línea." />
      )}
      {pestana === 'duo_kit' && (
        <Combos tipo="duo_kit" titulo="Duo Kit" ejemplo="Por ejemplo: el juego completo de una línea en su empaque." />
      )}
    </div>
  )
}
