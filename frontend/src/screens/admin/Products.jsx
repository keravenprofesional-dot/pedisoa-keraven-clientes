import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Download, Plus, Pencil, Trash2, AlertTriangle, Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'
import { leerExcel, descargarExcel } from '../../utils/excel'
import CampoFoto from '../../components/CampoFoto'
import { codigoUnico, normalizar } from '../../utils/codigoProducto'
import { agruparCatalogo, etiquetaTamano } from '../../utils/ordenProducto'

const vacio = { codigo: '', nombre: '', descripcion: '', precio: '', seccion: '', disponible: true, foto_url: null }
const SIN_SECCION = 'Sin sección'

// Nombres de columna que se aceptan en el Excel (en cualquier orden).
const COLUMNAS = {
  codigo: ['codigo', 'cod', 'clave'],
  nombre: ['producto', 'nombre', 'descripcion', 'articulo'],
  seccion: ['seccion', 'categoria', 'linea', 'grupo'],
  precio: ['precio', 'preciord', 'preciords', 'valor', 'costo'],
  disponible: ['disponible', 'hay', 'existe', 'activo', 'enexistencia'],
}
const limpiaEncabezado = (s) => normalizar(s).toLowerCase().replace(/[^a-z0-9]/g, '')
const esSi = (v) => ['si', 'sí', 'x', '1', 'true', 'verdadero', 'disponible'].includes(String(v).trim().toLowerCase())
const aNumero = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(vacio)
  const [editando, setEditando] = useState(null) // null | 'nuevo' | id
  const [marcados, setMarcados] = useState(new Set())
  // Mientras no lo escribas tú, el código se arma solo con el nombre.
  const [codigoAMano, setCodigoAMano] = useState(false)
  const [previa, setPrevia] = useState(null) // resultado de leer el Excel
  const [trabajando, setTrabajando] = useState('')
  const [aviso, setAviso] = useState('')
  const inputArchivo = useRef(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: p }, { data: c }] = await Promise.all([
      // Solo los productos sueltos: los combos tienen su propia pestaña.
      supabase.from('products').select('*, categories(nombre)').eq('tipo', 'simple').order('nombre'),
      supabase.from('categories').select('*').order('nombre'),
    ])
    setProducts(p || [])
    setCategories(c || [])
    setMarcados(new Set())
  }

  const seccionDe = (p) => p.categories?.nombre || SIN_SECCION

  // ─── Guardar uno a mano ───
  async function guardar(e) {
    e.preventDefault()
    setAviso('')
    const precio = aNumero(form.precio) ?? 0
    if (!form.nombre.trim()) return setAviso('Escribe el nombre del producto')
    const datos = {
      nombre: form.nombre.trim(),
      codigo: form.codigo.trim() || null,
      descripcion: form.descripcion?.trim() || null,
      foto_url: form.foto_url || null,
      precio,
      disponible: form.disponible !== false,
      categoria_id: await idDeSeccion(form.seccion),
    }
    const { error } = editando === 'nuevo'
      ? await supabase.from('products').insert(datos)
      : await supabase.from('products').update(datos).eq('id', editando)
    if (error) return setAviso(error.code === '23505' ? `Ya hay otro producto con el código ${datos.codigo}` : 'No se pudo guardar')
    setEditando(null); setForm(vacio); cargar()
  }

  async function idDeSeccion(nombre) {
    const n = (nombre || '').trim()
    if (!n || n === SIN_SECCION) return null
    const existe = categories.find((c) => normalizar(c.nombre) === normalizar(n))
    if (existe) return existe.id
    const { data } = await supabase.from('categories').insert({ nombre: n }).select().single()
    if (data) setCategories((prev) => [...prev, data])
    return data?.id || null
  }

  // Códigos ya ocupados, sin contar el producto que se está editando.
  function codigosOcupados(exceptoId) {
    return new Set(products.filter((p) => p.id !== exceptoId && p.codigo).map((p) => p.codigo.toUpperCase()))
  }

  function alEscribirNombre(nombre) {
    const codigo = codigoAMano ? form.codigo : codigoUnico(nombre, codigosOcupados(editando))
    setForm({ ...form, nombre, codigo })
  }

  function abrir(p) {
    setAviso('')
    setCodigoAMano(false)
    if (p === 'nuevo') { setForm(vacio); setEditando('nuevo'); return }
    setForm({
      codigo: p.codigo || '', nombre: p.nombre, descripcion: p.descripcion || '',
      precio: String(p.precio ?? ''), seccion: seccionDe(p) === SIN_SECCION ? '' : seccionDe(p),
      disponible: p.disponible !== false, foto_url: p.foto_url || null,
    })
    setEditando(p.id)
  }

  // ─── Disponible: un clic ───
  async function alternarDisponible(p) {
    const nuevo = !p.disponible
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, disponible: nuevo } : x)))
    const { error } = await supabase.from('products').update({ disponible: nuevo }).eq('id', p.id)
    if (error) { setAviso('No se pudo cambiar la disponibilidad'); cargar() }
  }

  // ─── Borrar ───
  async function borrar(ids) {
    const { error } = await supabase.from('products').delete().in('id', ids)
    if (error?.code === '23503') {
      // Ya aparece en pedidos: se oculta en vez de borrarse, para no romper el historial.
      await supabase.from('products').update({ disponible: false }).in('id', ids)
      setAviso('Algunos ya están en pedidos hechos: esos no se borran (se romperían los recibos). Quedaron como NO disponibles y ya no salen en el catálogo.')
    } else if (error) {
      setAviso('No se pudieron borrar')
    } else {
      setAviso(`${ids.length} producto(s) borrado(s).`)
    }
    cargar()
  }
  const borrarMarcados = () => {
    if (!marcados.size) return
    if (confirm(`¿Borrar ${marcados.size} producto(s)? No se puede deshacer.`)) borrar([...marcados])
  }

  // ─── Excel: leer y mostrar la previa ───
  async function alElegirArchivo(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setAviso(''); setTrabajando('Leyendo el Excel…')
    try {
      const filas = await leerExcel(archivo)
      setPrevia(analizar(filas))
    } catch (err) {
      setAviso(err.message || 'No se pudo leer el archivo. Debe ser un Excel .xlsx')
    } finally {
      setTrabajando('')
    }
  }

  function analizar(filas) {
    if (!filas.length) throw new Error('El Excel está vacío')
    // ¿La primera fila son títulos de columna?
    const cab = filas[0].map(limpiaEncabezado)
    const indice = {}
    for (const [campo, alias] of Object.entries(COLUMNAS)) {
      const i = cab.findIndex((c) => c && alias.some((a) => c === a || c.startsWith(a)))
      if (i >= 0) indice[campo] = i
    }
    const hayTitulos = indice.nombre != null || indice.codigo != null
    // Sin títulos se asume el orden del Excel que entrega la app.
    const col = hayTitulos ? indice : { codigo: 0, nombre: 1, seccion: 2, precio: 3, disponible: 4 }
    const cuerpo = hayTitulos ? filas.slice(1) : filas

    const porCodigo = new Map(products.filter((p) => p.codigo).map((p) => [p.codigo.toUpperCase(), p]))
    const porNombre = new Map(products.map((p) => [normalizar(p.nombre), p]))
    const usados = new Set(products.map((p) => (p.codigo || '').toUpperCase()).filter(Boolean))
    const vistos = new Set()
    const items = []

    for (const fila of cuerpo) {
      const nombre = String(fila[col.nombre] ?? '').trim()
      if (!nombre) continue
      let codigo = String(fila[col.codigo] ?? '').trim()
      const seccion = String(fila[col.seccion] ?? '').trim()
      const precioTxt = col.precio != null ? String(fila[col.precio] ?? '').trim() : ''
      const precio = precioTxt ? aNumero(precioTxt) : null
      const dispTxt = col.disponible != null ? String(fila[col.disponible] ?? '').trim() : ''

      const existente = (codigo && porCodigo.get(codigo.toUpperCase())) || porNombre.get(normalizar(nombre))
      if (!codigo) codigo = existente?.codigo || codigoUnico(nombre, usados)

      const clave = codigo.toUpperCase()
      let problema = null
      if (vistos.has(clave)) problema = 'Repetido en el Excel'
      else if (precioTxt && precio == null) problema = 'El precio no es un número'
      else if (precio != null && precio < 0) problema = 'El precio no puede ser negativo'
      else if (!existente && usados.has(clave) ) problema = 'Ese código ya es de otro producto'
      vistos.add(clave)
      if (!existente) usados.add(clave)

      items.push({
        codigo, nombre, seccion, precio,
        disponible: dispTxt ? esSi(dispTxt) : existente?.disponible ?? true,
        existente, problema,
      })
    }
    if (!items.length) throw new Error('No encontré productos en el Excel. Revisa que haya una columna con el nombre del producto.')
    return items
  }

  // ─── Excel: guardar de verdad ───
  async function confirmarImportacion() {
    const buenos = previa.filter((i) => !i.problema)
    setTrabajando(`Subiendo ${buenos.length} productos…`)
    try {
      // Las secciones que no existan se crean primero.
      const secciones = [...new Set(buenos.map((i) => i.seccion).filter(Boolean))]
      const mapaSeccion = new Map(categories.map((c) => [normalizar(c.nombre), c.id]))
      const nuevas = secciones.filter((s) => !mapaSeccion.has(normalizar(s)))
      if (nuevas.length) {
        const { data } = await supabase.from('categories').insert(nuevas.map((nombre) => ({ nombre }))).select()
        for (const c of data || []) mapaSeccion.set(normalizar(c.nombre), c.id)
      }

      const fila = (i) => ({
        codigo: i.codigo,
        nombre: i.nombre,
        categoria_id: i.seccion ? mapaSeccion.get(normalizar(i.seccion)) ?? null : i.existente?.categoria_id ?? null,
        disponible: i.disponible,
      })
      const nuevos = buenos.filter((i) => !i.existente).map((i) => ({ ...fila(i), precio: i.precio ?? 0 }))
      const cambios = buenos.filter((i) => i.existente).map((i) => ({
        id: i.existente.id, ...fila(i),
        // Si la casilla del precio viene vacía no se pisa el precio que ya tenía.
        precio: i.precio ?? i.existente.precio,
      }))

      if (nuevos.length) {
        const { error } = await supabase.from('products').insert(nuevos)
        if (error) throw new Error(error.message)
      }
      if (cambios.length) {
        const { error } = await supabase.from('products').upsert(cambios)
        if (error) throw new Error(error.message)
      }
      setPrevia(null)
      setAviso(`Listo: ${nuevos.length} producto(s) nuevo(s) y ${cambios.length} actualizado(s).`)
      cargar()
    } catch (err) {
      setAviso('No se pudo subir: ' + err.message)
    } finally {
      setTrabajando('')
    }
  }

  // Para los que ya estaban subidos sin código.
  async function ponerCodigosFaltantes() {
    const faltan = products.filter((p) => !p.codigo)
    if (!faltan.length) return
    const usados = codigosOcupados(null)
    const cambios = faltan.map((p) => ({ id: p.id, codigo: codigoUnico(p.nombre, usados) }))
    setTrabajando(`Poniendo código a ${cambios.length} producto(s)…`)
    const { error } = await supabase.from('products').upsert(cambios)
    setTrabajando('')
    setAviso(error ? 'No se pudieron poner los códigos: ' + error.message : `Listo: ${cambios.length} producto(s) ya tienen su código.`)
    cargar()
  }

  function exportar() {
    const filas = [['Código', 'Producto', 'Sección', 'Precio (RD$)', 'Disponible']]
    for (const p of productosFiltrados) {
      filas.push([p.codigo || '', p.nombre, seccionDe(p) === SIN_SECCION ? '' : seccionDe(p), Number(p.precio) || '', p.disponible ? 'Sí' : 'No'])
    }
    descargarExcel(filas, 'Productos Keraven.xlsx', 'Productos')
  }

  // ─── Vista ───
  const productosFiltrados = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return products
    return products.filter((p) => normalizar(p.nombre).includes(q) || (p.codigo || '').toUpperCase().includes(q))
  }, [products, busqueda])

  // Mismo orden que ve la clienta: por sección y, dentro, por tamaño.
  const porSeccion = useMemo(
    () => agruparCatalogo(productosFiltrados, (p) => p.categories?.nombre, SIN_SECCION),
    [productosFiltrados]
  )

  const sinPrecio = products.filter((p) => !Number(p.precio)).length
  const sinCodigo = products.filter((p) => !p.codigo).length
  const marcar = (id) => setMarcados((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const marcarSeccion = (items, todos) => setMarcados((prev) => {
    const s = new Set(prev)
    for (const p of items) todos ? s.delete(p.id) : s.add(p.id)
    return s
  })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-gray-500">
          {products.length} producto(s) sueltos. Los Duo Pack y Duo Kit se arman en sus pestañas.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => inputArchivo.current?.click()} className="flex items-center gap-2 bg-dorado text-petroleo text-sm font-bold rounded-xl px-4 py-2">
            <Upload size={16} /> Subir Excel
          </button>
          <button onClick={exportar} className="flex items-center gap-2 border border-gray-300 text-petroleo text-sm font-semibold rounded-xl px-4 py-2">
            <Download size={16} /> Bajar Excel
          </button>
          <button onClick={() => abrir('nuevo')} className="flex items-center gap-2 bg-petroleo text-white text-sm font-semibold rounded-xl px-4 py-2">
            <Plus size={16} /> Nuevo
          </button>
        </div>
        <input ref={inputArchivo} type="file" accept=".xlsx" onChange={alElegirArchivo} className="hidden" />
      </div>

      {trabajando && <p className="bg-graclaro border border-gray-200 text-sm rounded-xl p-3 mb-4">{trabajando}</p>}
      {aviso && (
        <p className="bg-green-50 border border-green-200 text-green-900 text-sm rounded-xl p-3 mb-4 flex justify-between gap-3">
          {aviso} <button onClick={() => setAviso('')}><X size={16} /></button>
        </p>
      )}
      {sinCodigo > 0 && !previa && (
        <p className="flex flex-wrap gap-2 items-center bg-graclaro border border-gray-200 text-sm rounded-xl p-3 mb-4">
          <span><strong>{sinCodigo} producto(s) sin código corto.</strong></span>
          <button onClick={ponerCodigosFaltantes} disabled={!!trabajando} className="bg-petroleo text-white rounded-lg px-3 py-1.5 font-semibold text-sm disabled:opacity-50">
            Ponerles código automático
          </button>
        </p>
      )}
      {sinPrecio > 0 && !previa && (
        <p className="flex gap-2 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl p-3 mb-4">
          <AlertTriangle size={18} className="shrink-0" />
          <span><strong>{sinPrecio} producto(s) sin precio.</strong> No salen en el catálogo hasta que les pongas precio: toca "Editar" y escríbelo, o bájate el Excel, pon los precios y vuélvelo a subir.</span>
        </p>
      )}

      {/* Previa del Excel */}
      {previa && (
        <div className="bg-white border-2 border-dorado rounded-2xl p-4 mb-6">
          <h2 className="font-bold text-petroleo mb-1">Revisa antes de subir</h2>
          <p className="text-sm text-gray-500 mb-3">
            {previa.filter((i) => !i.existente && !i.problema).length} nuevos ·{' '}
            {previa.filter((i) => i.existente && !i.problema).length} se actualizan ·{' '}
            <span className={previa.some((i) => i.problema) ? 'text-red-500 font-semibold' : ''}>
              {previa.filter((i) => i.problema).length} con problema (se saltan)
            </span>
          </p>
          <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-graclaro text-gray-500 text-left sticky top-0">
                <tr><th className="p-2">Código</th><th className="p-2">Producto</th><th className="p-2">Sección</th><th className="p-2">Precio</th><th className="p-2">Disp.</th><th className="p-2">Qué pasa</th></tr>
              </thead>
              <tbody>
                {previa.map((i, n) => (
                  <tr key={n} className={`border-t border-gray-100 ${i.problema ? 'bg-red-50' : ''}`}>
                    <td className="p-2 font-mono font-bold text-petroleo">{i.codigo}</td>
                    <td className="p-2">{i.nombre}</td>
                    <td className="p-2 text-gray-500">{i.seccion || '—'}</td>
                    <td className="p-2">{i.precio != null ? formatMoney(i.precio) : <span className="text-amber-600">sin precio</span>}</td>
                    <td className="p-2">{i.disponible ? 'Sí' : 'No'}</td>
                    <td className="p-2">{i.problema
                      ? <span className="text-red-600 font-medium">{i.problema}</span>
                      : i.existente ? <span className="text-gray-500">Se actualiza</span> : <span className="text-green-700 font-medium">Nuevo</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={confirmarImportacion} disabled={!!trabajando || !previa.some((i) => !i.problema)} className="bg-petroleo text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-50">
              Subir {previa.filter((i) => !i.problema).length} producto(s)
            </button>
            <button onClick={() => setPrevia(null)} className="text-gray-500 px-4 py-2">Cancelar</button>
          </div>
        </div>
      )}

      {/* Alta / edición a mano */}
      {editando && (
        <form onSubmit={guardar} className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <h2 className="md:col-span-3 font-semibold">{editando === 'nuevo' ? 'Nuevo producto' : 'Editar producto'}</h2>
          <label className="text-sm">Nombre del producto
            <input required autoFocus value={form.nombre} onChange={(e) => alEscribirNombre(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">
            Código corto {!codigoAMano && <span className="text-xs text-green-700 font-semibold">· se arma solo</span>}
            <div className="flex gap-1 mt-1">
              <input
                placeholder="escribe el nombre y aparece"
                value={form.codigo}
                onChange={(e) => { setCodigoAMano(true); setForm({ ...form, codigo: e.target.value.toUpperCase() }) }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 font-mono"
              />
              {codigoAMano && (
                <button type="button" title="Volver al código automático"
                  onClick={() => { setCodigoAMano(false); setForm({ ...form, codigo: codigoUnico(form.nombre, codigosOcupados(editando)) }) }}
                  className="text-xs text-petroleo border border-gray-200 rounded-lg px-2 whitespace-nowrap">
                  Auto
                </button>
              )}
            </div>
          </label>
          <label className="text-sm">Sección
            <input list="secciones" value={form.seccion} onChange={(e) => setForm({ ...form, seccion: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" />
            <datalist id="secciones">{categories.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
          </label>
          <label className="text-sm">Precio (RD$)
            <input inputMode="decimal" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm md:col-span-2">Descripción (la que lee el cliente)
            <textarea rows={2} placeholder="Ej. Shampoo nutritivo de coco, para uso diario." value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" />
          </label>
          <CampoFoto valor={form.foto_url} alCambiar={(u) => setForm({ ...form, foto_url: u })} carpeta="productos" />
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <input type="checkbox" className="w-5 h-5 accent-[#123B4A]" checked={form.disponible} onChange={(e) => setForm({ ...form, disponible: e.target.checked })} />
            Disponible (si lo apagas, el cliente lo ve marcado como agotado y no lo puede pedir)
          </label>
          <div className="md:col-span-3 flex gap-2">
            <button className="bg-petroleo text-white rounded-lg px-4 py-2 font-semibold">Guardar</button>
            <button type="button" onClick={() => setEditando(null)} className="text-gray-500 px-4 py-2">Cancelar</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <input placeholder="Buscar por nombre o código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="flex-1 min-w-[14rem] border border-gray-200 rounded-xl px-4 py-2" />
        {marcados.size > 0 && (
          <button onClick={borrarMarcados} className="flex items-center gap-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl px-4 py-2">
            <Trash2 size={16} /> Borrar {marcados.size} marcado(s)
          </button>
        )}
      </div>

      {porSeccion.map(([seccion, tamanos]) => {
        const items = tamanos.flatMap(([, lista]) => lista)
        const todos = items.every((p) => marcados.has(p.id))
        return (
          <div key={seccion} className="mb-6">
            <div className="flex items-center gap-3 mb-2 pb-1 border-b-2 border-dorado/40">
              <input type="checkbox" className="w-4 h-4 accent-[#123B4A]" checked={todos} onChange={() => marcarSeccion(items, todos)} title="Marcar toda la sección" />
              <h2 className="font-bold text-petroleo uppercase tracking-wide text-sm">{seccion}</h2>
              <span className="text-xs text-gray-400">{items.length}</span>
            </div>
            {tamanos.map(([oz, lista]) => (
            <div key={String(oz)} className="mt-4">
            <h3 className="flex items-center gap-2 mb-2">
              <span className="bg-petroleo text-white text-sm font-extrabold rounded-lg px-3 py-1">
                {etiquetaTamano(oz)}
              </span>
              <span className="text-xs text-gray-500">{lista.length} producto(s)</span>
              <span className="flex-1 h-px bg-gray-300" />
            </h3>
            <div className="bg-pastelsuave border border-gray-200 rounded-2xl divide-y divide-white/80">
              {lista.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                  <input type="checkbox" className="w-4 h-4 accent-[#123B4A]" checked={marcados.has(p.id)} onChange={() => marcar(p.id)} />
                  <span className="font-mono font-bold text-petroleo text-sm w-24">{p.codigo || '—'}</span>
                  <span className="flex-1 min-w-[10rem]">{p.nombre}</span>
                  <span className={`w-28 text-right ${Number(p.precio) ? '' : 'text-amber-600 text-sm'}`}>
                    {Number(p.precio) ? formatMoney(p.precio) : 'sin precio'}
                  </span>
                  <button
                    onClick={() => alternarDisponible(p)}
                    title="Encender o apagar la disponibilidad"
                    className={`flex items-center gap-1 text-xs font-semibold rounded-lg px-2 py-1.5 border ${
                      p.disponible ? 'bg-green-50 border-green-300 text-green-800' : 'bg-gray-100 border-gray-300 text-gray-500'
                    }`}
                  >
                    {p.disponible ? <Check size={14} /> : <X size={14} />}
                    {p.disponible ? 'Disponible' : 'Agotado'}
                  </button>
                  <button onClick={() => abrir(p)} className="text-gray-400 hover:text-petroleo" title="Editar"><Pencil size={16} /></button>
                  <button onClick={() => confirm(`¿Borrar ${p.nombre}?`) && borrar([p.id])} className="text-gray-400 hover:text-red-500" title="Borrar"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            </div>
            ))}
          </div>
        )
      })}

      {products.length === 0 && !previa && (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-2">Todavía no hay productos.</p>
          <p className="text-sm">Usa <strong>Subir Excel</strong> con el archivo <em>PRODUCTOS KERAVEN - poner precios.xlsx</em> de tu Escritorio.</p>
        </div>
      )}
    </div>
  )
}
