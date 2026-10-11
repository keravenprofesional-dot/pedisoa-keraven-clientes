import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ShoppingCart } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ProductCard from '../../components/ProductCard'
import ArmarCaja from '../../components/ArmarCaja'
import DetalleProducto from '../../components/DetalleProducto'
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
  const [viendo, setViendo] = useState(null)
  const [contenidos, setContenidos] = useState({})
  const { addItem, items } = useCart()
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: prods }, { data: cats }, { data: partes }] = await Promise.all([
      // Un producto sin precio todavía no está a la venta: no se muestra.
      supabase.from('products').select('*').gt('precio', 0).order('nombre'),
      supabase.from('categories').select('*').order('nombre'),
      // Lo que trae adentro cada línea, Duo Pack y Duo Kit. El nombre del FK
      // es obligatorio: product_items apunta dos veces a products y sin
      // decirle cuál, Postgres rechaza la consulta entera.
      supabase.from('product_items').select(
        'product_id, cantidad, componente:products!product_items_componente_id_fkey(id, nombre, codigo)'
      ),
    ])
    setProducts(prods || [])
    setCategories(cats || [])
    // product_items es la verdad de qué lleva cada caja: un mismo producto
    // (la Gótica de Brillo, el Gotero, el Leave-in) va en las 6 líneas.
    const mapa = {}
    for (const p of partes || []) {
      if (!p.componente) continue
      ;(mapa[p.product_id] ||= []).push({ ...p.componente, cantidad: p.cantidad })
    }
    for (const lista of Object.values(mapa)) lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    setContenidos(mapa)
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
      <p className="font-sans text-[10px] font-medium uppercase tracking-[0.5em] text-oroprof">Keraven Profesional</p>
      <h1 className="mt-2 mb-5 font-display text-[34px] leading-none text-negro">La colección</h1>

      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-negro/35" size={17} strokeWidth={1.6} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto…"
          className="h-12 w-full rounded-full border border-negro/12 bg-white/75 pl-11 pr-4 font-sans text-[14px] placeholder:text-negro/35 focus:outline-none focus:ring-1 focus:ring-oro"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-2 -mx-4 px-4">
        {PESTANAS.map(({ tipo, texto }) => (
          <button
            key={tipo}
            onClick={() => setPestana(tipo)}
            className={`h-9 shrink-0 whitespace-nowrap rounded-full px-4 font-sans text-[11px] font-medium uppercase tracking-[0.16em] transition ${
              pestana === tipo ? 'bg-negro text-orosuave' : 'border border-negro/12 bg-white/70 text-negro/50'
            }`}
          >
            {texto} <span className="tabular-nums opacity-55">{cuantos(tipo)}</span>
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
              <>
                <h2 className="font-display text-[15px] uppercase tracking-[0.1em] text-negro">{seccion}</h2>
                <div className="filo-oro mt-1.5 opacity-60" />
              </>
            )}
            {tamanos.map(([oz, lista]) => (
              <div key={String(oz)} className="mt-5">
                <h3 className="mb-3 flex items-baseline gap-3">
                  <span className="font-display text-[24px] leading-none tabular-nums text-negro">
                    {etiquetaTamano(oz)}
                  </span>
                  <span className="h-px flex-1 bg-oro/35" />
                  <span className="font-sans text-[11px] uppercase tracking-[0.16em] tabular-nums text-negro/35">
                    {lista.length} {lista.length === 1 ? 'pieza' : 'piezas'}
                  </span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {lista.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onAdd={agregar}
                      onVer={setViendo}
                      piezas={(contenidos[p.id] || []).reduce((s, c) => s + (c.cantidad || 1), 0)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))
      )}

      {viendo && (
        <DetalleProducto
          producto={viendo}
          contenido={contenidos[viendo.id] || []}
          alCerrar={() => setViendo(null)}
          alAgregar={agregar}
        />
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
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-negro px-5 py-3 font-display text-[16px] tabular-nums text-orosuave shadow-xl ring-1 ring-oro/50 md:bottom-6 md:right-8"
        >
          <ShoppingCart size={18} strokeWidth={1.6} /> {totalItems}
        </button>
      )}
    </div>
  )
}
