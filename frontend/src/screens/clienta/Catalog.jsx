import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ShoppingCart } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ProductCard from '../../components/ProductCard'
import ArmarCaja from '../../components/ArmarCaja'
import { useCart } from '../../context/CartContext'
import { normalizar } from '../../utils/codigoProducto'
import { agruparCatalogo, agruparPorTamano, etiquetaTamano } from '../../utils/ordenProducto'

const SIN_SECCION = 'Otros productos'
// Las pestañas, en el orden que pidió Keraven: los conjuntos primero y
// todos los productos sueltos al final.
const PESTANAS = [
  { tipo: 'linea', texto: 'Líneas' },
  { tipo: 'duo_pack', texto: 'Duo Pack' },
  { tipo: 'duo_pack_mixto', texto: 'Duo Pack Mixto' },
  { tipo: 'duo_kit', texto: 'Duo Kit' },
  { tipo: 'simple', texto: 'Todos los productos' },
]

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [pestana, setPestana] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [armando, setArmando] = useState(null)
  const { addItem, items } = useCart()
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: prods }, { data: cats }] = await Promise.all([
      // Un producto sin precio todavía no está a la venta: no se muestra.
      supabase.from('products').select('*').gt('precio', 0).order('nombre'),
      supabase.from('categories').select('*').order('nombre'),
    ])
    setProducts(prods || [])
    setCategories(cats || [])
    // Abre en la primera pestaña que tenga algo, para no empezar en vacío.
    setPestana((p) => p ?? (PESTANAS.find((x) => (prods || []).some((q) => q.tipo === x.tipo))?.tipo || 'simple'))
    setLoading(false)
  }

  const cuantos = (tipo) => products.filter((p) => p.tipo === tipo).length

  const filtrados = useMemo(() => {
    const q = normalizar(query)
    return products.filter((p) => p.tipo === pestana && (!q || normalizar(p.nombre).includes(q)))
  }, [products, pestana, query])

  // Los sueltos van por sección y tamaño; los conjuntos, solo por tamaño.
  const grupos = useMemo(() => {
    if (pestana !== 'simple') return [[null, agruparPorTamano(filtrados)]]
    const nombres = new Map(categories.map((c) => [c.id, c.nombre]))
    return agruparCatalogo(filtrados, (p) => nombres.get(p.categoria_id), SIN_SECCION)
  }, [filtrados, categories, pestana])

  const agregar = (p) => (p.armado ? setArmando(p) : addItem(p))
  const totalItems = items.reduce((sum, i) => sum + i.cantidad, 0)

  return (
    <div className="p-4 pb-28 md:pb-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-negro mb-4">Catálogo</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto…"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-oro/25 bg-white focus:outline-none focus:ring-2 focus:ring-negro"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-2 -mx-4 px-4">
        {PESTANAS.map(({ tipo, texto }) => (
          <button
            key={tipo}
            onClick={() => setPestana(tipo)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              pestana === tipo ? 'bg-negro text-oro font-semibold' : 'bg-white border border-oro/25 text-gray-500'
            }`}
          >
            {texto} <span className="opacity-60">{cuantos(tipo)}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Cargando productos…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-center text-gray-400 py-10">
          {query ? 'No se encontraron productos.' : 'Todavía no hay nada en esta sección.'}
        </p>
      ) : (
        grupos.map(([seccion, tamanos]) => (
          <section key={seccion ?? 'solo'} className="mb-8">
            {seccion && (
              <h2 className="font-bold text-negro uppercase tracking-wide text-sm mb-1 pb-1 border-b-2 border-oro/50">
                {seccion}
              </h2>
            )}
            {tamanos.map(([oz, lista]) => (
              <div key={String(oz)} className="mt-5">
                <h3 className="flex items-center gap-2 mb-3">
                  <span className="bg-negro text-oro text-base font-extrabold rounded-lg px-3 py-1.5">
                    {etiquetaTamano(oz)}
                  </span>
                  <span className="text-sm text-gray-500">{lista.length} producto(s)</span>
                  <span className="flex-1 h-px bg-gray-300" />
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {lista.map((p) => <ProductCard key={p.id} product={p} onAdd={agregar} />)}
                </div>
              </div>
            ))}
          </section>
        ))
      )}

      {armando && (
        <ArmarCaja
          producto={armando}
          productos={products}
          alCerrar={() => setArmando(null)}
          alAgregar={(sabores) => addItem(armando, sabores)}
        />
      )}

      {totalItems > 0 && (
        <button
          onClick={() => navigate('/carrito')}
          className="fixed bottom-24 md:bottom-6 right-4 md:right-8 bg-oro text-negro rounded-full shadow-xl px-5 py-3 flex items-center gap-2 font-bold z-40"
        >
          <ShoppingCart size={20} /> {totalItems}
        </button>
      )}
    </div>
  )
}
