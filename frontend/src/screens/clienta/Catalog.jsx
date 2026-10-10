import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ShoppingCart } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ProductCard from '../../components/ProductCard'
import { useCart } from '../../context/CartContext'
import { normalizar } from '../../utils/codigoProducto'
import { agruparCatalogo, etiquetaTamano } from '../../utils/ordenProducto'

const SIN_SECCION = 'Otros productos'

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
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

  return (
    <div className="p-4 pb-28 md:pb-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-grafondo mb-4">Catálogo</h1>

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
              categoryId === c.id ? 'bg-petroleo text-white' : 'bg-white border border-gray-200 text-gray-500'
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
            <h2 className="font-bold text-petroleo uppercase tracking-wide text-sm mb-1 pb-1 border-b-2 border-dorado/40">
              {seccion}
            </h2>
            {tamanos.map(([oz, lista]) => (
              <div key={String(oz)} className="mt-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  {etiquetaTamano(oz)} <span className="font-normal">· {lista.length}</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {lista.map((p) => <ProductCard key={p.id} product={p} onAdd={addItem} />)}
                </div>
              </div>
            ))}
          </section>
        ))
      )}

      {totalItems > 0 && (
        <button
          onClick={() => navigate('/carrito')}
          className="fixed bottom-20 md:bottom-6 right-4 md:right-8 bg-dorado text-petroleo rounded-full shadow-lg px-5 py-3 flex items-center gap-2 font-bold z-40"
        >
          <ShoppingCart size={20} /> {totalItems}
        </button>
      )}
    </div>
  )
}
