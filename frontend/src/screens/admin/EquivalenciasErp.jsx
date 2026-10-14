import { useEffect, useMemo, useState } from 'react'
import { Link2, CheckCircle2, HelpCircle, AlertTriangle, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { sugerir } from '../../utils/equivalenciasErp'

// Enlace con Keraven Systems Masters: qué producto del ERP es cada producto
// suelto de aquí. Con eso, cada pedido entra al ERP con sus productos (los
// combos entran por lo que llevan adentro, por eso aquí solo van los sueltos).
// La computadora SUGIERE; nada se guarda hasta que alguien lo acepta.
export default function EquivalenciasErp() {
  const { profile } = useAuth()
  const [productos, setProductos] = useState([])
  const [erp, setErp] = useState([])
  const [guardadas, setGuardadas] = useState({}) // product_id -> producto_id
  const [elegidas, setElegidas] = useState({})   // lo que está en cada selector ahora
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState('')
  const [filtro, setFiltro] = useState('pendientes')

  async function cargar() {
    setCargando(true); setError('')
    const [p, e, q] = await Promise.all([
      supabase.from('products').select('id, codigo, nombre').eq('tipo', 'simple').order('nombre'),
      supabase.rpc('erp_lista_productos'),
      supabase.from('erp_equivalencias').select('product_id, producto_id'),
    ])
    setCargando(false)
    if (p.error || e.error || q.error) return setError('No se pudo cargar. Revisa tu conexión o tu permiso de Productos.')
    const g = Object.fromEntries(q.data.map((r) => [r.product_id, r.producto_id]))
    setProductos(p.data); setErp(e.data); setGuardadas(g)
    setElegidas(Object.fromEntries(p.data.map((x) => [x.id, g[x.id] ?? sugerir(x.nombre, e.data)?.producto_id ?? ''])))
  }
  useEffect(() => { cargar() }, [])

  const filas = useMemo(() => productos.map((p) => {
    const s = sugerir(p.nombre, erp)
    const g = guardadas[p.id]
    const estado = g ? 'guardada' : s ? (s.dudosa ? 'dudosa' : 'segura') : 'sin'
    return { p, s, g, estado }
  }), [productos, erp, guardadas])

  const cuenta = (e) => filas.filter((f) => f.estado === e).length
  const seguras = filas.filter((f) => f.estado === 'segura')
  const visibles = filas.filter((f) => filtro === 'todas' || (filtro === 'pendientes' ? f.estado !== 'guardada' : f.estado === 'guardada'))
  const nombreErp = (id) => erp.find((e) => e.id === Number(id))?.nombre || ''

  async function guardar(lista) {
    const filasNuevas = lista.filter(([, erpId]) => erpId).map(([product_id, producto_id]) => ({ product_id, producto_id: Number(producto_id), puesto_por: profile?.id, actualizado_en: new Date().toISOString() }))
    const quitar = lista.filter(([, erpId]) => !erpId).map(([id]) => id)
    if (filasNuevas.length) {
      const { error } = await supabase.from('erp_equivalencias').upsert(filasNuevas)
      if (error) { alert('No se pudo guardar: ' + error.message); return false }
    }
    if (quitar.length) {
      const { error } = await supabase.from('erp_equivalencias').delete().in('product_id', quitar)
      if (error) { alert('No se pudo quitar: ' + error.message); return false }
    }
    setGuardadas((g) => { const n = { ...g }; filasNuevas.forEach((r) => { n[r.product_id] = r.producto_id }); quitar.forEach((id) => delete n[id]); return n })
    return true
  }

  async function aceptarSeguras() {
    if (!confirm(`¿Aceptar las ${seguras.length} parejas seguras? Puedes revisarlas después en "Ya enlazados".`)) return
    setGuardando('todas')
    await guardar(seguras.map((f) => [f.p.id, f.s.producto_id]))
    setGuardando('')
  }

  async function guardarUna(id) {
    setGuardando(id)
    await guardar([[id, elegidas[id]]])
    setGuardando('')
  }

  if (cargando) return <p className="text-gray-500">Cargando…</p>
  if (error) return <p className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>

  const ETIQUETA = {
    guardada: <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800"><CheckCircle2 size={13} /> Enlazado</span>,
    segura: <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800"><Link2 size={13} /> Sugerido</span>,
    dudosa: <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900"><HelpCircle size={13} /> Por confirmar</span>,
    sin: <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600"><AlertTriangle size={13} /> Sin pareja</span>,
  }

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <p className="font-bold text-grafondo">Enlace con Keraven Systems Masters</p>
        <p className="mt-1 text-sm text-gray-600">
          Cada pedido entra solo al Buzón del ERP. Para que lleve sus productos, aquí se dice qué producto del ERP es cada uno.
          Los Duo Pack, Duo Kit y Líneas no hacen falta: entran por los productos que llevan adentro.
          Un producto sin enlace llega al ERP solo como una nota.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg bg-green-50 px-3 py-1 text-green-900"><b>{cuenta('guardada')}</b> enlazados</span>
          <span className="rounded-lg bg-sky-50 px-3 py-1 text-sky-900"><b>{cuenta('segura')}</b> sugeridos seguros</span>
          <span className="rounded-lg bg-amber-50 px-3 py-1 text-amber-900"><b>{cuenta('dudosa')}</b> por confirmar</span>
          <span className="rounded-lg bg-gray-100 px-3 py-1 text-gray-700"><b>{cuenta('sin')}</b> sin pareja</span>
        </div>
        {seguras.length > 0 && (
          <button onClick={aceptarSeguras} disabled={!!guardando}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-petroleo px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            <Check size={16} /> {guardando === 'todas' ? 'Guardando…' : `Aceptar las ${seguras.length} sugeridas seguras`}
          </button>
        )}
      </div>

      <div className="mb-3 flex gap-2">
        {[['pendientes', 'Pendientes'], ['enlazados', 'Ya enlazados'], ['todas', 'Todos']].map(([id, t]) => (
          <button key={id} onClick={() => setFiltro(id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${filtro === id ? 'bg-petroleo text-white' : 'border border-gray-200 bg-white text-gray-500'}`}>{t}</button>
        ))}
      </div>

      <div className="space-y-2">
        {visibles.map(({ p, s, g, estado }) => {
          const cambio = String(elegidas[p.id] ?? '') !== String(g ?? '')
          return (
            <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-gray-500">{p.codigo}</span>
                <span className="font-semibold text-grafondo">{p.nombre}</span>
                {ETIQUETA[estado]}
              </div>
              {estado === 'dudosa' && <p className="mt-1 text-xs text-amber-800">Revísalo: {s.motivo}.</p>}
              {estado === 'sin' && <p className="mt-1 text-xs text-gray-500">No se encontró en el ERP. Elígelo a mano si existe con otro nombre.</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">En el ERP es:</span>
                <select value={elegidas[p.id] ?? ''} onChange={(e) => setElegidas((x) => ({ ...x, [p.id]: e.target.value }))}
                  className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="">— Sin enlace —</option>
                  {erp.map((e) => <option key={e.id} value={e.id}>{e.nombre}{e.codigo ? ` (${e.codigo})` : ''}{e.activo ? '' : ' · inactivo'}</option>)}
                </select>
                {(cambio || estado === 'dudosa' || estado === 'segura') && (
                  <button onClick={() => guardarUna(p.id)} disabled={!!guardando}
                    className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                    {guardando === p.id ? 'Guardando…' : elegidas[p.id] ? (g ? 'Cambiar' : 'Confirmar') : 'Quitar enlace'}
                  </button>
                )}
              </div>
              {g && cambio && <p className="mt-1 text-xs text-gray-500">Ahora está enlazado con: {nombreErp(g)}</p>}
            </div>
          )
        })}
        {!visibles.length && <p className="rounded-xl bg-green-50 p-4 text-green-900">Nada pendiente aquí.</p>}
      </div>
    </div>
  )
}
