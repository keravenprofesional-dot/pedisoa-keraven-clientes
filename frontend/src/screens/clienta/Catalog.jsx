import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ShoppingCart } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ProductCard from '../../components/ProductCard'
import { useCart } from '../../context/CartContext'
import { normalizar } from '../../utils/codigoProducto'
import { agruparCatalogo, etiquetaTamano } from '../../utils/ordenProducto'
import ArmarCaja from '../../components/ArmarCaja'

const SIN_SECCION = 'Otros productos'

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [armando, setArmando] = useState(null) // caja que el cliente está armando
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
    setLoading(false)
  }

  const filtrados = useMemo(() => {
    const q = normalizar(query)
    return products.filter((p) =>
      (categoryId === 'all' || p.categoria_id === categoryId) &&
      // La clienta busca por nombre: los códigos son de uso interno.
      (!q || normalizar(p.nombre).includes(q))
    )
  }, [products, categoryId, query])

  // Por sección y, dentro de cada una, por tamaño: los de 32 oz nunca se
  // mezclan con los de 10 oz, y los sabores van siempre en el mismo orden.
  const secciones = useMemo(() => {
    const nombres = new Map(categories.map((c) => [c.id, c.nombre]))
    return agruparCatalogo(filtrados, (p) => nombres.get(p.categoria_id), SIN_SECCION)
  }, [filtrados, categories])

  const totalItems = items.reduce((sum, i) => sum + i.cantidad, 0)

  // Si el producto es una caja que se arma, primero se eligen los sabores.
  const agregar = (p) => (p.armado ? setArmando(p) : addItem(p))

  return (
    <div className="p-4 pb-28 md:pb-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-negro mb-4">Catálogo</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto…"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-petroleo"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-2 -mx-4 px-4">
        {[{ id: 'all', nombre: 'Todo' }, ...categories].map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              categoryId === c.id ? 'bg-negro text-oro font-semibold' : 'bg-white border border-oro/25 text-gray-500'
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Cargando productos…</p>
      ) : secciones.length === 0 ? (
        <p className="text-center text-gray-400 py-10">No se encontraron productos.</p>
      ) : (
        secciones.map(([seccion, tamanos]) => (
          <section key={seccion} className="mb-8">
            <h2 className="font-bold text-negro uppercase tracking-wide text-sm mb-1 pb-1 border-b-2 border-oro/50">
              {seccion}
            </h2>
            {tamanos.map(([oz, lista]) => (
              <div key={String(oz)} className="mt-5">
                {/* Bien marcado para que no se confunda un tamaño con otro */}
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
          alCerrar={() => setArmando(null)}
          productos={products}
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
