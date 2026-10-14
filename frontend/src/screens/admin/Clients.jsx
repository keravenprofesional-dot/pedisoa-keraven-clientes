import { useEffect, useState } from 'react'
import { Copy, Check, UserPlus, KeyRound, Pencil, UserX, UserCheck, MapPin, Plus, Trash2, ChevronDown, ChevronUp, Percent } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { adminUsuarios } from '../../lib/adminUsuarios'
import { useAuth } from '../../context/AuthContext'
import { formatMoney } from '../../utils/format'
import { formatCode } from '../../utils/accessCode'

const vacio = {
  full_name: '', phone: '', phone2: '', correo: '', cedula: '', direccion: '',
  sector: '', ciudad: '', provincia: '', delivery_stop_id: '', payment_condition: 'contado', credit_enabled: false, credit_limit: 0,
}

// Crear clientas (permiso crear_clientas) y, con editar_clientas, cambiar sus
// datos, su crédito o darle un código nuevo. El código no se guarda legible
// en ningún lado: se muestra una sola vez al crearlo o regenerarlo.
const paradaVacia = { nombre: '', zona: '', referencia: '' }

export default function Clients() {
  const { puede } = useAuth()
  const puedeCrear = puede('crear_clientas')
  const puedeEditar = puede('editar_clientas')
  const puedeParadas = puede('configuracion')
  const puedeDescuentos = puede('dar_descuentos')

  const [clients, setClients] = useState([])
  const [descuentos, setDescuentos] = useState({}) // client_id → { porcentaje, motivo }
  const [desc, setDesc] = useState({ porcentaje: '', motivo: '' })
  const [solicitudId, setSolicitudId] = useState(null) // si viene del buzón de Solicitudes
  const [paradas, setParadas] = useState([])
  const [verParadas, setVerParadas] = useState(false)
  const [nuevaParada, setNuevaParada] = useState(paradaVacia)
  const [search, setSearch] = useState('')
  const [editando, setEditando] = useState(null) // null | 'nueva' | client
  const [form, setForm] = useState(vacio)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [codigo, setCodigo] = useState(null) // { full_name, access_code, telefono }
  const [copiado, setCopiado] = useState(false)

  useEffect(() => { load() }, [])

  // "Crear cliente" desde el buzón de Solicitudes: abre el formulario ya lleno.
  useEffect(() => {
    if (!window.location.hash.includes('nuevo=1')) return
    let datos = null
    try { datos = JSON.parse(sessionStorage.getItem('prefill_cliente') || 'null') } catch { /* nada */ }
    try { sessionStorage.removeItem('prefill_cliente') } catch { /* nada */ }
    if (!datos) return
    setError('')
    setForm({
      ...vacio,
      full_name: datos.full_name || '', phone: datos.telefono_login || '', phone2: datos.telefono_referencia || '',
      cedula: datos.cedula || '', direccion: datos.direccion || '', correo: datos.correo || '',
    })
    setSolicitudId(datos.solicitud_id || null)
    setEditando('nueva')
  }, [])

  async function load() {
    const [{ data }, { data: p }, { data: d }] = await Promise.all([
      supabase.from('clients')
        .select('*, client_phones(phone, is_primary), profiles!clients_profile_id_fkey(active), delivery_stops(nombre, zona)')
        .order('full_name'),
      supabase.from('delivery_stops').select('*').order('zona').order('nombre'),
      supabase.from('descuentos_cliente').select('client_id, porcentaje, motivo'),
    ])
    setClients(data || [])
    setParadas(p || [])
    setDescuentos(Object.fromEntries((d || []).map((x) => [x.client_id, x])))
  }

  // Guarda (o quita, si queda vacío o en 0) el % fijo del cliente.
  async function guardarDescuento(clientId) {
    const pct = Number(desc.porcentaje || 0)
    const antes = descuentos[clientId]
    if (!pct) {
      if (antes) {
        const { error: err } = await supabase.from('descuentos_cliente').delete().eq('client_id', clientId)
        if (err) throw new Error('No se pudo quitar el descuento')
      }
      return
    }
    if (pct < 0 || pct > 50) throw new Error('El descuento debe estar entre 1% y 50%')
    if (antes && Number(antes.porcentaje) === pct && (antes.motivo || '') === desc.motivo) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('descuentos_cliente').upsert({
      client_id: clientId, porcentaje: pct, motivo: desc.motivo.trim() || null,
      puesto_por: user?.id, actualizado_en: new Date().toISOString(),
    })
    if (err) throw new Error('No se pudo guardar el descuento')
  }

  // ── Paradas de la ruta (aquí, porque es donde se usan al dar de alta) ──
  async function agregarParada(e) {
    e.preventDefault()
    if (!nuevaParada.nombre.trim()) return
    const { error: err } = await supabase.from('delivery_stops').insert({
      nombre: nuevaParada.nombre.trim(),
      zona: nuevaParada.zona.trim() || null,
      referencia: nuevaParada.referencia.trim() || null,
    })
    if (err) return alert('No se pudo agregar la parada')
    setNuevaParada(paradaVacia)
    load()
  }
  async function alternarParada(p) {
    await supabase.from('delivery_stops').update({ activo: !p.activo }).eq('id', p.id)
    load()
  }
  async function borrarParada(p) {
    if (!confirm(`¿Borrar la parada "${p.nombre}"?`)) return
    const { error: err } = await supabase.from('delivery_stops').delete().eq('id', p.id)
    if (err?.code === '23503') {
      await supabase.from('delivery_stops').update({ activo: false }).eq('id', p.id)
      alert('Esa parada ya tiene clientes o pedidos, así que no se borra: quedó apagada y ya no se puede elegir.')
    } else if (err) alert('No se pudo borrar la parada')
    load()
  }

  function abrir(c) {
    setError('')
    setSolicitudId(null)
    if (c === 'nueva') { setForm(vacio); setDesc({ porcentaje: '', motivo: '' }); setEditando('nueva'); return }
    const d = descuentos[c.id]
    setDesc({ porcentaje: d ? String(Number(d.porcentaje)) : '', motivo: d?.motivo || '' })
    const tel2 = c.client_phones?.find((p) => !p.is_primary)?.phone || ''
    setForm({
      ...vacio, ...Object.fromEntries(Object.keys(vacio).map((k) => [k, c[k] ?? vacio[k]])),
      phone: c.telefono_login, phone2: tel2,
    })
    setEditando(c)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true); setError('')
    try {
      const datos = { ...form, credit_limit: Number(form.credit_limit || 0) }
      if (editando === 'nueva') {
        const r = await adminUsuarios('crear_clienta', datos)
        setCodigo({ full_name: form.full_name, access_code: r.access_code, telefono: form.phone })
        // Si vino del buzón, la solicitud queda aprobada sola.
        if (solicitudId) {
          await supabase.rpc('atender_solicitud', {
            p_id: solicitudId, p_estado: 'aprobada',
            p_nota: `Cliente creado${r.client?.client_number ? `: ${r.client.client_number}` : ''}`,
          })
          setSolicitudId(null)
        }
      } else {
        await adminUsuarios('editar_clienta', { ...datos, client_id: editando.id })
        if (puedeDescuentos) await guardarDescuento(editando.id)
      }
      setEditando(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function nuevoCodigo(c) {
    if (!confirm(`¿Darle un código nuevo a ${c.full_name}? El código anterior dejará de servir.`)) return
    try {
      const r = await adminUsuarios('regenerar_codigo', { client_id: c.id })
      setCodigo({ full_name: c.full_name, access_code: r.access_code, telefono: c.telefono_login })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) { alert(err.message) }
  }

  async function activar(c, active) {
    if (!active && !confirm(`¿Desactivar a ${c.full_name}? Ya no podrá entrar ni hacer pedidos.`)) return
    try { await adminUsuarios('editar_clienta', { client_id: c.id, active }); load() } catch (err) { alert(err.message) }
  }

  function copiar() {
    navigator.clipboard?.writeText(formatCode(codigo.access_code))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  const q = search.toLowerCase()
  const filtered = clients.filter((c) =>
    c.full_name.toLowerCase().includes(q) ||
    c.client_number?.toLowerCase().includes(q) ||
    c.client_phones?.some((p) => p.phone.includes(search.replace(/\D/g, '') || '§'))
  )
  const campo = (k, ph, extra = {}) => (
    <input placeholder={ph} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" {...extra} />
  )

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-grafondo">Clientes</h1>
        {puedeCrear && (
          <button onClick={() => abrir('nueva')} className="flex items-center gap-2 bg-petroleo text-white text-sm font-semibold rounded-xl px-4 py-2">
            <UserPlus size={16} /> Nuevo cliente
          </button>
        )}
      </div>

      {/* Paradas de la ruta: viven aquí porque es donde se usan al dar de alta
          un cliente. Solo las administra quien tenga permiso de Configuración. */}
      {puedeParadas && (
        <div className="bg-white border border-gray-100 rounded-2xl mb-4">
          <button onClick={() => setVerParadas((v) => !v)} className="w-full flex items-center gap-2 p-3 text-left">
            <MapPin size={18} className="text-petroleo" />
            <span className="font-semibold text-grafondo">Paradas de la ruta</span>
            <span className="text-sm text-gray-400">{paradas.filter((p) => p.activo).length} activa(s)</span>
            <span className="ml-auto text-gray-400">{verParadas ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
          </button>
          {verParadas && (
            <div className="px-3 pb-3">
              <p className="text-sm text-gray-500 mb-3">
                Los pueblos o puntos donde entregas. A cada cliente se le asigna una abajo, y es la que
                le aparece puesta al hacer su pedido.
              </p>
              <form onSubmit={agregarParada} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
                <input required placeholder="Nombre (ej. Parada Bonao)" value={nuevaParada.nombre} onChange={(e) => setNuevaParada({ ...nuevaParada, nombre: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
                <input placeholder="Zona o ruta" value={nuevaParada.zona} onChange={(e) => setNuevaParada({ ...nuevaParada, zona: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
                <input placeholder="Punto de referencia" value={nuevaParada.referencia} onChange={(e) => setNuevaParada({ ...nuevaParada, referencia: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
                <button className="flex items-center justify-center gap-1 bg-petroleo text-white rounded-lg py-2 font-semibold text-sm"><Plus size={16} /> Agregar</button>
              </form>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                {paradas.map((p) => (
                  <div key={p.id} className={`flex items-center gap-3 p-2.5 text-sm ${p.activo ? '' : 'opacity-50'}`}>
                    <div className="flex-1">
                      <p className="font-medium">{p.nombre}</p>
                      <p className="text-gray-500 text-xs">{[p.zona, p.referencia].filter(Boolean).join(' · ') || 'Sin zona'}</p>
                    </div>
                    <button onClick={() => alternarParada(p)} className={`rounded-lg px-2 py-1 border text-xs font-semibold ${p.activo ? 'text-green-700 border-green-200' : 'text-gray-500 border-gray-300'}`}>
                      {p.activo ? 'Activa' : 'Apagada'}
                    </button>
                    <button onClick={() => borrarParada(p)} className="text-gray-400 hover:text-red-500" title="Borrar"><Trash2 size={15} /></button>
                  </div>
                ))}
                {paradas.length === 0 && <p className="text-gray-400 text-sm p-3">Todavía no hay paradas.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {codigo && (
        <div className="bg-dorado/10 border border-dorado rounded-xl p-4 mb-4">
          <p className="text-sm text-grafondo">
            Entrégale a <strong>{codigo.full_name}</strong> estos datos para entrar (solo se muestran ahora):
          </p>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-2xl font-extrabold text-petroleo tracking-widest">{formatCode(codigo.access_code)}</p>
            <button onClick={copiar} className="text-petroleo p-2" title="Copiar código">{copiado ? <Check size={20} /> : <Copy size={20} />}</button>
          </div>
          <p className="text-sm text-gray-600">Entra con su teléfono <strong>{codigo.telefono}</strong> + este código.</p>
          <button onClick={() => setCodigo(null)} className="text-xs text-gray-500 underline mt-2">Ya se lo entregué, ocultar</button>
        </div>
      )}

      {editando && (
        <form onSubmit={guardar} className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <h2 className="md:col-span-3 font-semibold">{editando === 'nueva' ? 'Nuevo cliente' : `Editar ${editando.client_number}`}</h2>
          {solicitudId && (
            <p className="md:col-span-3 -mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Datos traídos de su solicitud. Revísalos, elige su parada y crea el cliente: la solicitud quedará aprobada.
            </p>
          )}
          {campo('full_name', 'Nombre completo', { required: true })}
          {campo('phone', 'Teléfono (con este entra)', { required: true, inputMode: 'tel' })}
          {campo('phone2', 'Segundo teléfono (opcional)', { inputMode: 'tel' })}
          {campo('correo', 'Correo (opcional)', { type: 'email' })}
          {campo('cedula', 'Cédula (obligatoria, 11 números)', { required: true, inputMode: 'numeric', pattern: '\\D*(\\d\\D*){11}', title: 'La cédula tiene 11 números, por ejemplo 001-1234567-8' })}
          {campo('provincia', 'Provincia')}
          {campo('direccion', 'Dirección', { className: 'border border-gray-200 rounded-lg px-3 py-2 md:col-span-2' })}
          {campo('sector', 'Sector')}
          {campo('ciudad', 'Ciudad o pueblo')}
          <label className="text-sm md:col-span-3">Parada donde recibe
            <select value={form.delivery_stop_id} onChange={(e) => setForm({ ...form, delivery_stop_id: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2">
              <option value="">Sin parada fija (la elige al pedir)</option>
              {paradas.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.zona ? ` — ${p.zona}` : ''}</option>)}
            </select>
          </label>
          {puedeEditar && (
            <>
              <select value={form.payment_condition} onChange={(e) => setForm({ ...form, payment_condition: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2">
                <option value="contado">Condición: Contado</option>
                <option value="avance">Condición: Avance</option>
                <option value="credito">Condición: Crédito</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.credit_enabled} onChange={(e) => setForm({ ...form, credit_enabled: e.target.checked })} />
                Crédito aprobado
              </label>
              <label className="text-sm md:col-span-3">Límite de crédito (0 = sin límite)
                <input type="number" min="0" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} className="ml-2 border border-gray-200 rounded-lg px-3 py-1 w-36" />
              </label>
            </>
          )}
          {puedeDescuentos && editando !== 'nueva' && (
            <div className="md:col-span-3 grid grid-cols-1 gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 md:grid-cols-[auto_1fr]">
              <label className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Percent size={15} /> Descuento fijo
                <input type="number" min="0" max="50" step="0.5" value={desc.porcentaje} placeholder="0"
                  onChange={(e) => setDesc({ ...desc, porcentaje: e.target.value })}
                  className="w-20 rounded-lg border border-amber-200 bg-white px-2 py-1 text-right font-normal" /> %
              </label>
              <input value={desc.motivo} onChange={(e) => setDesc({ ...desc, motivo: e.target.value })}
                placeholder="Motivo (ej. cliente mayorista)" className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm" />
              <p className="text-[11px] text-amber-800 md:col-span-2">Se aplica solo en cada pedido nuevo de este cliente. Déjalo en 0 para quitarlo.</p>
            </div>
          )}
          {error && <p className="text-red-500 text-sm md:col-span-3">{error}</p>}
          <div className="md:col-span-3 flex gap-2">
            <button disabled={guardando} className="bg-petroleo text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-60">
              {guardando ? 'Guardando…' : editando === 'nueva' ? 'Crear cliente y generar código' : 'Guardar cambios'}
            </button>
            <button type="button" onClick={() => setEditando(null)} className="text-gray-500 px-4 py-2">Cancelar</button>
          </div>
        </form>
      )}

      <input
        placeholder="Buscar por nombre, número de cliente o teléfono…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full md:w-96 border border-gray-200 rounded-xl px-4 py-2 mb-4"
      />

      <p className="text-sm text-gray-500 mb-2">{filtered.length} cliente(s)</p>

      {/* Renglones en computadora: con muchas clientas se lee de un vistazo */}
      <div className="hidden md:block bg-pastelsuave border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-pastel text-petroleo text-left">
            <tr>
              <th className="p-3">N°</th><th className="p-3">Nombre</th><th className="p-3">Teléfono</th>
              <th className="p-3">Sector / Ciudad</th><th className="p-3">Parada</th>
              <th className="p-3">Condición</th><th className="p-3 text-right">Debe</th>
              {puedeEditar && <th className="p-3"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const activa = c.profiles?.active !== false
              return (
                <tr key={c.id} className={`border-t border-white/80 even:bg-pastel/50 hover:bg-pastel ${activa ? '' : 'opacity-50'}`}>
                  <td className="p-3 font-bold text-petroleo whitespace-nowrap">{c.client_number}</td>
                  <td className="p-3">
                    {c.full_name}
                    {!activa && <span className="text-xs text-red-500"> · Sin acceso</span>}
                    {descuentos[c.id] && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        {Number(descuentos[c.id].porcentaje)}% desc.
                      </span>
                    )}
                    {c.correo && <div className="text-xs text-gray-400">{c.correo}</div>}
                  </td>
                  <td className="p-3 whitespace-nowrap">{c.telefono_login}</td>
                  <td className="p-3">{[c.sector, c.ciudad].filter(Boolean).join(' — ') || '—'}</td>
                  <td className="p-3">{c.delivery_stops?.nombre || <span className="text-gray-400">sin asignar</span>}</td>
                  <td className="p-3 capitalize whitespace-nowrap">
                    {c.payment_condition}
                    {c.credit_enabled && <span className="text-green-700 text-xs block">crédito aprobado{Number(c.credit_limit) > 0 && ` · ${formatMoney(c.credit_limit)}`}</span>}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {Number(c.balance_pendiente) > 0 ? <span className="text-red-500 font-semibold">{formatMoney(c.balance_pendiente)}</span> : '—'}
                  </td>
                  {puedeEditar && (
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => abrir(c)} title="Editar" className="text-gray-400 hover:text-petroleo p-1"><Pencil size={16} /></button>
                        <button onClick={() => nuevoCodigo(c)} title="Darle un código nuevo" className="text-gray-400 hover:text-petroleo p-1"><KeyRound size={16} /></button>
                        <button onClick={() => activar(c, !activa)} title={activa ? 'Desactivar' : 'Activar'} className={`p-1 ${activa ? 'text-gray-400 hover:text-red-500' : 'text-green-600'}`}>
                          {activa ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* En celular: un renglón por clienta, compacto */}
      <div className="md:hidden divide-y divide-white/80 bg-pastelsuave border border-gray-200 rounded-2xl overflow-hidden">
        {filtered.map((c) => {
          const activa = c.profiles?.active !== false
          return (
            <div key={c.id} className={`p-3 even:bg-pastel/50 ${activa ? '' : 'opacity-50'}`}>
              <div className="flex justify-between gap-2">
                <span className="font-semibold">
                  {c.full_name}
                  {descuentos[c.id] && <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{Number(descuentos[c.id].porcentaje)}%</span>}
                </span>
                <span className="text-xs font-bold text-petroleo whitespace-nowrap">{c.client_number}</span>
              </div>
              <p className="text-sm text-gray-500">
                {c.telefono_login} · {c.delivery_stops?.nombre || 'sin parada'}
                {Number(c.balance_pendiente) > 0 && <span className="text-red-500 font-semibold"> · debe {formatMoney(c.balance_pendiente)}</span>}
              </p>
              {puedeEditar && (
                <div className="flex gap-3 mt-2 text-xs">
                  <button onClick={() => abrir(c)} className="flex items-center gap-1 text-petroleo"><Pencil size={13} /> Editar</button>
                  <button onClick={() => nuevoCodigo(c)} className="flex items-center gap-1 text-petroleo"><KeyRound size={13} /> Nuevo código</button>
                  <button onClick={() => activar(c, !activa)} className={activa ? 'text-red-500' : 'text-green-700'}>{activa ? 'Desactivar' : 'Activar'}</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && <p className="text-gray-400 text-center py-10">No hay clientes todavía.</p>}
    </div>
  )
}
