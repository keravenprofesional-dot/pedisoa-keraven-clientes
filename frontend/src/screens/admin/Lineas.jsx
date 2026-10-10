import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, X, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import CampoFoto from '../../components/CampoFoto'
import { borrarFoto } from '../../utils/subirFoto'
import { normalizar } from '../../utils/codigoProducto'
import { compararProductos, etiquetaTamano, tamanoOz } from '../../utils/ordenProducto'
import { formatMoney } from '../../utils/format'

// Las líneas atraviesan las secciones: la Línea de Coco tiene su shampoo,
// su tratamiento y su mascarilla. Aquí se arman y se ve qué lleva cada una.
const vacia = { nombre: '', descripcion: '', foto_url: null }

export default function Lineas() {
  const [lineas, setLineas] = useState([])
  const [productos, setProductos] = useState([])
  const [form, setForm] = useState(vacia)
  const [editando, setEditando] = useState(null) // null | 'nueva' | id
  const [abierta, setAbierta] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from('lineas').select('*').order('orden').order('nombre'),
      supabase.from('products').select('id, nombre, codigo, precio, linea_id, tipo').order('nombre'),
    ])
    setLineas(l || [])
    setProductos(p || [])
  }

  const deLaLinea = (id) => productos.filter((p) => p.linea_id === id).sort(compararProductos)

  async function guardar(e) {
    e.preventDefault()
    setAviso('')
    const datos = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion?.trim() || null,
      foto_url: form.foto_url || null,
    }
    if (!datos.nombre) return setAviso('Ponle nombre a la línea')
    const { error } = editando === 'nueva'
      ? await supabase.from('lineas').insert(datos)
      : await supabase.from('lineas').update(datos).eq('id', editando)
    if (error) return setAviso(error.code === '23505' ? 'Ya existe una línea con ese nombre' : 'No se pudo guardar')
    setEditando(null); setForm(vacia); cargar()
  }

  function abrirForm(l) {
    setAviso('')
    if (l === 'nueva') { setForm(vacia); setEditando('nueva'); return }
    setForm({ nombre: l.nombre, descripcion: l.descripcion || '', foto_url: l.foto_url })
    setEditando(l.id)
  }

  async function borrar(l) {
    const cuantos = deLaLinea(l.id).length
    if (!confirm(`¿Borrar la línea "${l.nombre}"?${cuantos ? ` Sus ${cuantos} producto(s) quedan sin línea, pero no se borran.` : ''}`)) return
    const { error } = await supabase.from('lineas').delete().eq('id', l.id)
    if (error) return setAviso('No se pudo borrar la línea')
    if (l.foto_url) borrarFoto(l.foto_url)
    cargar()
  }

  async function poner(producto, lineaId) {
    setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, linea_id: lineaId } : p)))
    const { error } = await supabase.from('products').update({ linea_id: lineaId }).eq('id', producto.id)
    if (error) { setAviso('No se pudo mover el producto'); cargar() }
  }

  // Para agregar: los que todavía no tienen línea o están en otra.
  const candidatos = useMemo(() => {
    const q = normalizar(busqueda)
    return productos
      .filter((p) => p.tipo === 'simple' && p.linea_id !== abierta)
      .filter((p) => !q || normalizar(p.nombre).includes(q) || (p.codigo || '').toUpperCase().includes(q))
      .sort(compararProductos)
      .slice(0, 40)
  }, [productos, abierta, busqueda])

  const sinLinea = productos.filter((p) => p.tipo === 'simple' && !p.linea_id).length
  const input = 'mt-1 w-full border border-gray-200 rounded-lg px-3 py-2'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm text-gray-500">
          Agrupa los productos por línea (Coco, Cacao, Golden Black…). Un producto está en una sola línea.
          {sinLinea > 0 && <strong className="text-amber-700"> Quedan {sinLinea} sin línea.</strong>}
        </p>
        <button onClick={() => abrirForm('nueva')} className="flex items-center gap-2 bg-petroleo text-white text-sm font-semibold rounded-xl px-4 py-2">
          <Plus size={16} /> Nueva línea
        </button>
      </div>
      {aviso && <p className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl p-3 mb-3">{aviso}</p>}

      {editando && (
        <form onSubmit={guardar} className="bg-white border border-gray-100 rounded-2xl p-4 mb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <h3 className="md:col-span-2 font-semibold">{editando === 'nueva' ? 'Nueva línea' : 'Editar línea'}</h3>
          <label className="text-sm">Nombre de la línea
            <input required placeholder="Ej. Línea de Coco" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={input} />
          </label>
          <CampoFoto valor={form.foto_url} alCambiar={(u) => setForm({ ...form, foto_url: u })} carpeta="lineas" etiqueta="Foto de la línea empacada" />
          <label className="text-sm md:col-span-2">Descripción (lo que verá el cliente)
            <textarea rows={2} placeholder="Ej. Hidratación profunda para cabello reseco." value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className={input} />
          </label>
          <div className="md:col-span-2 flex gap-2">
            <button className="bg-petroleo text-white rounded-lg px-4 py-2 font-semibold">Guardar</button>
            <button type="button" onClick={() => setEditando(null)} className="text-gray-500 px-4 py-2">Cancelar</button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {lineas.map((l) => {
          const dentro = deLaLinea(l.id)
          const esta = abierta === l.id
          return (
            <div key={l.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <div className="w-14 h-14 rounded-xl bg-graclaro overflow-hidden shrink-0 flex items-center justify-center text-gray-300 text-xs">
                  {l.foto_url ? <img src={l.foto_url} alt="" className="w-full h-full object-cover" /> : 'sin foto'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-petroleo">{l.nombre}</p>
                  <p className="text-sm text-gray-500 truncate">{l.descripcion || 'Sin descripción'}</p>
                  <p className="text-xs text-gray-400">{dentro.length} producto(s)</p>
                </div>
                <button onClick={() => abrirForm(l)} className="text-gray-400 hover:text-petroleo p-1" title="Editar"><Pencil size={16} /></button>
                <button onClick={() => borrar(l)} className="text-gray-400 hover:text-red-500 p-1" title="Borrar"><Trash2 size={16} /></button>
                <button onClick={() => { setAbierta(esta ? null : l.id); setBusqueda('') }} className="text-petroleo p-1" title="Ver qué lleva">
                  {esta ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>

              {esta && (
                <div className="border-t border-gray-100 p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Lleva estos productos</h4>
                    {dentro.length === 0 && <p className="text-sm text-gray-400">Todavía no tiene productos.</p>}
                    <div className="flex flex-col gap-1">
                      {dentro.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 bg-pastelsuave rounded-lg px-2 py-1.5 text-sm">
                          <span className="font-mono text-xs font-bold text-petroleo w-20">{p.codigo || '—'}</span>
                          <span className="flex-1">{p.nombre}</span>
                          <span className="text-xs text-gray-500">{etiquetaTamano(tamanoOz(p.nombre))}</span>
                          <button onClick={() => poner(p, null)} className="text-gray-400 hover:text-red-500" title="Sacar de la línea"><X size={15} /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Agregar de la lista</h4>
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                      <input placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
                      {candidatos.map((p) => (
                        <button key={p.id} onClick={() => poner(p, l.id)} className="flex items-center gap-2 text-left rounded-lg px-2 py-1.5 text-sm hover:bg-pastel">
                          <Plus size={14} className="text-petroleo shrink-0" />
                          <span className="flex-1">{p.nombre}</span>
                          {p.linea_id && <span className="text-xs text-amber-700">ya está en otra línea</span>}
                          <span className="text-xs text-gray-400">{formatMoney(p.precio)}</span>
                        </button>
                      ))}
                      {candidatos.length === 0 && <p className="text-sm text-gray-400">No hay más productos.</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {lineas.length === 0 && !editando && (
          <p className="text-gray-400 text-center py-10">Todavía no hay líneas. Crea la primera con <strong>Nueva línea</strong>.</p>
        )}
      </div>
    </div>
  )
}
