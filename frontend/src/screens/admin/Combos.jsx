import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, X, Search, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import CampoFoto from '../../components/CampoFoto'
import ArmadoCaja from './ArmadoCaja'
import { borrarFoto } from '../../utils/subirFoto'
import { generarCodigoCombo, normalizar } from '../../utils/codigoProducto'
import { compararProductos } from '../../utils/ordenProducto'
import { formatMoney } from '../../utils/format'

// Un Duo Pack / Duo Kit es un producto que por dentro lleva otros productos.
// Tiene su propio precio (normalmente más barato que comprarlos sueltos),
// su foto empacado y su descripción.
const vacio = { nombre: '', codigo: '', descripcion: '', precio: '', foto_url: null, disponible: true }

export default function Combos({ tipo, titulo, ejemplo }) {
  const [combos, setCombos] = useState([])
  const [productos, setProductos] = useState([])
  const [secciones, setSecciones] = useState([])
  const [todosLosCodigos, setTodosLosCodigos] = useState([])
  const [form, setForm] = useState(vacio)
  const [piezas, setPiezas] = useState([]) // [{ producto, cantidad }]
  const [armado, setArmado] = useState(null)      // receta si el cliente elige los sabores
  const [editando, setEditando] = useState(null)
  const [codigoAMano, setCodigoAMano] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [tipo])

  async function cargar() {
    const [{ data: c }, { data: p }, { data: s }, { data: cods }] = await Promise.all([
      supabase.from('products').select('*, categories(nombre), product_items(cantidad, componente_id)').eq('tipo', tipo).order('nombre'),
      supabase.from('products').select('id, nombre, codigo, precio, disponible, linea_id').eq('tipo', 'simple').order('nombre'),
      supabase.from('categories').select('*').order('nombre'),
      // TODOS los códigos ya usados, para que el que se arma solo no choque.
      supabase.from('products').select('id, codigo').not('codigo', 'is', null),
    ])
    setCombos(c || [])
    setProductos(p || [])
    setSecciones(s || [])
    setTodosLosCodigos(cods || [])
  }

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const sumaSuelta = piezas.reduce((n, x) => n + Number(x.producto.precio || 0) * x.cantidad, 0)

  function abrir(c) {
    setAviso(''); setBusqueda(''); setCodigoAMano(false)
    if (c === 'nuevo') { setForm(vacio); setPiezas([]); setArmado(null); setEditando('nuevo'); return }
    setForm({
      nombre: c.nombre, codigo: c.codigo || '', descripcion: c.descripcion || '',
      precio: String(c.precio ?? ''),
      foto_url: c.foto_url, disponible: c.disponible !== false,
    })
    setPiezas((c.product_items || []).map((i) => ({ producto: porId.get(i.componente_id) || { id: i.componente_id, nombre: '(producto borrado)', precio: 0 }, cantidad: i.cantidad })))
    setArmado(c.armado || null)
    setEditando(c.id)
  }

  function alEscribirNombre(nombre) {
    if (codigoAMano) return setForm({ ...form, nombre })
    // Prefijo propio (DP / DK) para no confundirse con un producto suelto.
    const usados = new Set(todosLosCodigos.filter((c) => c.id !== editando).map((c) => c.codigo.toUpperCase()))
    const base = generarCodigoCombo(nombre, tipo)
    let codigo = base, n = 2
    while (usados.has(codigo.toUpperCase())) codigo = `${base}-${n++}`
    setForm({ ...form, nombre, codigo })
  }

  const agregar = (p) => setPiezas((prev) => prev.some((x) => x.producto.id === p.id)
    ? prev.map((x) => (x.producto.id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x))
    : [...prev, { producto: p, cantidad: 1 }])
  const cambiarCantidad = (id, n) => setPiezas((prev) => prev.map((x) => (x.producto.id === id ? { ...x, cantidad: Math.max(1, Math.min(99, n)) } : x)))
  const quitar = (id) => setPiezas((prev) => prev.filter((x) => x.producto.id !== id))

  async function idDeSeccion(nombre) {
    const n = (nombre || '').trim()
    if (!n) return null
    const existe = secciones.find((s) => normalizar(s.nombre) === normalizar(n))
    if (existe) return existe.id
    const { data } = await supabase.from('categories').insert({ nombre: n }).select().single()
    return data?.id || null
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return setAviso('Ponle nombre')
    if (armado) {
      if (!armado.sabores?.length) return setAviso('La caja necesita por lo menos un sabor')
      if (armado.sabores.some((s) => !s.nombre.trim() || s.productos.some((p) => !p))) {
        return setAviso('Hay un sabor sin nombre o sin producto en algún grupo')
      }
    } else if (piezas.length < 2) {
      return setAviso('Un combo lleva por lo menos 2 productos adentro')
    }
    setGuardando(true); setAviso('')
    try {
      const datos = {
        tipo,
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim() || null,
        descripcion: form.descripcion?.trim() || null,
        precio: Number(String(form.precio).replace(/[^\d.]/g, '')) || 0,
        foto_url: form.foto_url || null,
        disponible: form.disponible !== false,
        // Los combos no van en las secciones de productos sueltos
        // (Shampoo, Mascarilla…): tienen la suya propia.
        categoria_id: await idDeSeccion(titulo),
        // Si el cliente elige los sabores, va la receta; si no, va vacío.
        armado: armado
          ? { ...armado, sabores: armado.sabores.map((s) => ({ nombre: s.nombre.trim(), productos: s.productos })) }
          : null,
      }
      let id = editando
      if (editando === 'nuevo') {
        const { data, error } = await supabase.from('products').insert(datos).select().single()
        if (error) throw new Error(error.code === '23505' ? `Ya hay otro producto con el código ${datos.codigo}` : error.message)
        id = data.id
      } else {
        const { error } = await supabase.from('products').update(datos).eq('id', id)
        if (error) throw new Error(error.message)
        await supabase.from('product_items').delete().eq('product_id', id)
      }
      // Una caja que se arma no lleva lista fija de piezas: depende del sabor.
      if (!armado && piezas.length) {
        const { error: e2 } = await supabase.from('product_items').insert(
          piezas.map((x) => ({ product_id: id, componente_id: x.producto.id, cantidad: x.cantidad }))
        )
        if (e2) throw new Error(e2.message)
      }

      // En una LÍNEA, sus productos además quedan marcados como de esa línea,
      // para poder saber después qué lleva cada una.
      if (tipo === 'linea') {
        const dentro = piezas.map((x) => x.producto.id)
        const fuera = productos.filter((p) => p.linea_id === id && !dentro.includes(p.id)).map((p) => p.id)
        if (dentro.length) await supabase.from('products').update({ linea_id: id }).in('id', dentro)
        if (fuera.length) await supabase.from('products').update({ linea_id: null }).in('id', fuera)
      }
      setEditando(null); setPiezas([]); setArmado(null); setForm(vacio)
      cargar()
    } catch (err) {
      setAviso('No se pudo guardar: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(c) {
    if (!confirm(`¿Borrar "${c.nombre}"? Los productos que lleva adentro no se borran.`)) return
    const { error } = await supabase.from('products').delete().eq('id', c.id)
    if (error?.code === '23503') {
      await supabase.from('products').update({ disponible: false }).eq('id', c.id)
      setAviso('Ya está en pedidos hechos, así que no se borra: quedó como NO disponible.')
    } else if (error) setAviso('No se pudo borrar')
    else if (c.foto_url) borrarFoto(c.foto_url)
    cargar()
  }

  async function alternarDisponible(c) {
    setCombos((prev) => prev.map((x) => (x.id === c.id ? { ...x, disponible: !c.disponible } : x)))
    await supabase.from('products').update({ disponible: !c.disponible }).eq('id', c.id)
  }

  const candidatos = useMemo(() => {
    const q = normalizar(busqueda)
    return productos
      .filter((p) => !q || normalizar(p.nombre).includes(q) || (p.codigo || '').toUpperCase().includes(q))
      .sort(compararProductos).slice(0, 40)
  }, [productos, busqueda])

  const input = 'mt-1 w-full border border-gray-200 rounded-lg px-3 py-2'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm text-gray-500">
          Arma un {titulo} con los productos que ya tienes cargados. Ponle su propio precio, su foto
          empacado y su descripción. {ejemplo}
        </p>
        <button onClick={() => abrir('nuevo')} className="flex items-center gap-2 bg-petroleo text-white text-sm font-semibold rounded-xl px-4 py-2">
          <Plus size={16} /> Nuevo {titulo}
        </button>
      </div>
      {aviso && <p className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl p-3 mb-3">{aviso}</p>}

      {editando && (
        <form onSubmit={guardar} className="bg-white border-2 border-dorado rounded-2xl p-4 mb-5">
          <h3 className="font-bold text-petroleo mb-3">{editando === 'nuevo' ? `Nuevo ${titulo}` : `Editar ${titulo}`}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm">Nombre
              <input required autoFocus placeholder={`Ej. ${titulo} de Coco 32 oz`} value={form.nombre} onChange={(e) => alEscribirNombre(e.target.value)} className={input} />
            </label>
            <label className="text-sm">Código corto {!codigoAMano && <span className="text-xs text-green-700 font-semibold">· se arma solo</span>}
              <input value={form.codigo} onChange={(e) => { setCodigoAMano(true); setForm({ ...form, codigo: e.target.value.toUpperCase() }) }} className={`${input} font-mono`} />
            </label>
            <label className="text-sm">Precio del combo (RD$)
              <input inputMode="decimal" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} className={input} />
              {sumaSuelta > 0 && (
                <span className="text-xs text-gray-500">
                  Sueltos costarían {formatMoney(sumaSuelta)}.{' '}
                  <button type="button" onClick={() => setForm({ ...form, precio: String(sumaSuelta) })} className="text-petroleo underline">usar ese precio</button>
                </span>
              )}
            </label>
            <CampoFoto valor={form.foto_url} alCambiar={(u) => setForm({ ...form, foto_url: u })} carpeta="combos" etiqueta="Foto del combo empacado" />
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input type="checkbox" className="w-5 h-5 accent-[#123B4A]" checked={form.disponible} onChange={(e) => setForm({ ...form, disponible: e.target.checked })} />
              Disponible
            </label>
            <label className="text-sm md:col-span-3">Descripción (la que lee el cliente)
              <textarea rows={2} placeholder="Ej. Shampoo y tratamiento de coco, para lavar y nutrir en casa." value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className={input} />
            </label>
          </div>

          {/* Dos maneras de armar el combo */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="w-5 h-5 accent-[#123B4A] mt-0.5"
                checked={!!armado}
                onChange={(e) => setArmado(e.target.checked ? { unidades_por_grupo: 8, max_sabores: 2, grupos: ['Shampoo', 'Mascarilla'], sabores: [] } : null)}
              />
              <span>
                <strong>El cliente elige los sabores</strong>
                <span className="block text-xs text-gray-500">
                  Para cajas como la de 16: 8 shampoo + 8 mascarilla, y el cliente escoge 1 o 2 sabores.
                  Si lo dejas apagado, el combo lleva siempre los mismos productos.
                </span>
              </span>
            </label>
            {armado && <ArmadoCaja valor={armado} alCambiar={setArmado} productos={productos} />}
          </div>

          {!armado && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-t border-gray-100 pt-4">
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Qué lleva adentro ({piezas.length})</h4>
              {piezas.length === 0 && <p className="text-sm text-gray-400">Elige por lo menos 2 productos de la derecha.</p>}
              <div className="flex flex-col gap-1">
                {piezas.map((x) => (
                  <div key={x.producto.id} className="flex items-center gap-2 bg-pastelsuave rounded-lg px-2 py-1.5 text-sm">
                    <input type="number" min="1" max="99" value={x.cantidad} onChange={(e) => cambiarCantidad(x.producto.id, Number(e.target.value))} className="w-14 border border-gray-200 rounded px-1 py-0.5 text-center" />
                    <span className="flex-1">{x.producto.nombre}</span>
                    <span className="text-xs text-gray-500">{formatMoney(Number(x.producto.precio) * x.cantidad)}</span>
                    <button type="button" onClick={() => quitar(x.producto.id)} className="text-gray-400 hover:text-red-500"><X size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Agregar de tu lista</h4>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="max-h-56 overflow-y-auto flex flex-col gap-1">
                {candidatos.map((p) => (
                  <button key={p.id} type="button" onClick={() => agregar(p)} className="flex items-center gap-2 text-left rounded-lg px-2 py-1.5 text-sm hover:bg-pastel">
                    <Plus size={14} className="text-petroleo shrink-0" />
                    <span className="flex-1">{p.nombre}</span>
                    <span className="text-xs text-gray-400">{formatMoney(p.precio)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          <div className="flex gap-2 mt-4">
            <button disabled={guardando} className="bg-petroleo text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-60">
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setEditando(null)} className="text-gray-500 px-4 py-2">Cancelar</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {combos.map((c) => (
          <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex gap-3">
            <div className="w-20 h-20 rounded-xl bg-graclaro overflow-hidden shrink-0 flex items-center justify-center text-gray-300 text-xs">
              {c.foto_url ? <img src={c.foto_url} alt="" className="w-full h-full object-cover" /> : 'sin foto'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-petroleo truncate">{c.nombre}</p>
                  <p className="font-mono text-xs text-gray-500">{c.codigo || '—'}</p>
                </div>
                <span className={Number(c.precio) ? 'font-semibold whitespace-nowrap' : 'text-amber-600 text-sm whitespace-nowrap'}>
                  {Number(c.precio) ? formatMoney(c.precio) : 'sin precio'}
                </span>
              </div>
              {c.armado
                ? <p className="text-xs text-gray-500 mt-0.5">
                    Caja de {c.armado.unidades_por_grupo * c.armado.grupos.length} ·
                    el cliente elige hasta {c.armado.max_sabores} de {c.armado.sabores.length} sabores
                    {(() => {
                      const hay = new Map(productos.map((p) => [p.id, p.disponible !== false && Number(p.precio) > 0]))
                      const agotados = c.armado.sabores.filter((s) => s.productos.some((id) => hay.get(id) === false))
                      return agotados.length
                        ? <span className="block text-amber-700 font-semibold">
                            {agotados.length} sabor(es) agotado(s): {agotados.map((s) => s.nombre).join(', ')}
                          </span>
                        : <span className="block text-green-700">todos los sabores disponibles</span>
                    })()}
                  </p>
                : <p className="text-xs text-gray-500 mt-0.5">{(c.product_items || []).length} producto(s) adentro</p>}
              {c.descripcion && <p className="text-xs text-gray-500 line-clamp-2">{c.descripcion}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => alternarDisponible(c)} className={`flex items-center gap-1 text-xs font-semibold rounded-lg px-2 py-1 border ${c.disponible ? 'bg-green-50 border-green-300 text-green-800' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                  {c.disponible ? <Check size={13} /> : <X size={13} />}{c.disponible ? 'Disponible' : 'Agotado'}
                </button>
                <button onClick={() => abrir(c)} className="flex items-center gap-1 text-xs text-petroleo border border-gray-200 rounded-lg px-2 py-1"><Pencil size={13} /> Editar</button>
                <button onClick={() => borrar(c)} className="flex items-center gap-1 text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1"><Trash2 size={13} /> Borrar</button>
              </div>
            </div>
          </div>
        ))}
        {combos.length === 0 && !editando && (
          <p className="text-gray-400 text-center py-10 md:col-span-2">Todavía no hay ningún {titulo}.</p>
        )}
      </div>
    </div>
  )
}
