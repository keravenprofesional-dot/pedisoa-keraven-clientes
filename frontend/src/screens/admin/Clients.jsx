import { useEffect, useState } from 'react'
import { Copy, Check, UserPlus, KeyRound, Pencil, UserX, UserCheck } from 'lucide-react'
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
export default function Clients() {
  const { puede } = useAuth()
  const puedeCrear = puede('crear_clientas')
  const puedeEditar = puede('editar_clientas')

  const [clients, setClients] = useState([])
  const [paradas, setParadas] = useState([])
  const [search, setSearch] = useState('')
  const [editando, setEditando] = useState(null) // null | 'nueva' | client
  const [form, setForm] = useState(vacio)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [codigo, setCodigo] = useState(null) // { full_name, access_code, telefono }
  const [copiado, setCopiado] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data }, { data: p }] = await Promise.all([
      supabase.from('clients')
        .select('*, client_phones(phone, is_primary), profiles!clients_profile_id_fkey(active), delivery_stops(nombre, zona)')
        .order('full_name'),
      supabase.from('delivery_stops').select('id, nombre, zona').eq('activo', true).order('zona').order('nombre'),
    ])
    setClients(data || [])
    setParadas(p || [])
  }

  function abrir(c) {
    setError('')
    if (c === 'nueva') { setForm(vacio); setEditando('nueva'); return }
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
      } else {
        await adminUsuarios('editar_clienta', { ...datos, client_id: editando.id })
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
        <h1 className="text-2xl font-bold text-grafondo">Clientas</h1>
        {puedeCrear && (
          <button onClick={() => abrir('nueva')} className="flex items-center gap-2 bg-petroleo text-white text-sm font-semibold rounded-xl px-4 py-2">
            <UserPlus size={16} /> Nueva clienta
          </button>
        )}
      </div>

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
          <h2 className="md:col-span-3 font-semibold">{editando === 'nueva' ? 'Nueva clienta' : `Editar ${editando.client_number}`}</h2>
          {campo('full_name', 'Nombre completo', { required: true })}
          {campo('phone', 'Teléfono (con este entra)', { required: true, inputMode: 'tel' })}
          {campo('phone2', 'Segundo teléfono (opcional)', { inputMode: 'tel' })}
          {campo('correo', 'Correo (opcional)', { type: 'email' })}
          {campo('cedula', 'Cédula')}
          {campo('provincia', 'Provincia')}
          {campo('direccion', 'Dirección', { className: 'border border-gray-200 rounded-lg px-3 py-2 md:col-span-2' })}
          {campo('sector', 'Sector')}
          {campo('ciudad', 'Ciudad o pueblo')}
          <label className="text-sm md:col-span-3">Parada donde recibe
            <select value={form.delivery_stop_id} onChange={(e) => setForm({ ...form, delivery_stop_id: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2">
              <option value="">Sin parada fija (la elige al pedir)</option>
              {paradas.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.zona ? ` — ${p.zona}` : ''}</option>)}
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
          {error && <p className="text-red-500 text-sm md:col-span-3">{error}</p>}
          <div className="md:col-span-3 flex gap-2">
            <button disabled={guardando} className="bg-petroleo text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-60">
              {guardando ? 'Guardando…' : editando === 'nueva' ? 'Crear clienta y generar código' : 'Guardar cambios'}
            </button>
            <button type="button" onClick={() => setEditando(null)} className="text-gray-500 px-4 py-2">Cancelar</button>
          </div>
        </form>
      )}

      <input
        placeholder="Buscar por nombre, número de clienta o teléfono…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full md:w-96 border border-gray-200 rounded-xl px-4 py-2 mb-4"
      />

      <p className="text-sm text-gray-500 mb-2">{filtered.length} clienta(s)</p>

      {/* Renglones en computadora: con muchas clientas se lee de un vistazo */}
      <div className="hidden md:block bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-graclaro text-gray-500 text-left">
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
                <tr key={c.id} className={`border-t border-gray-100 ${activa ? '' : 'opacity-50'}`}>
                  <td className="p-3 font-bold text-petroleo whitespace-nowrap">{c.client_number}</td>
                  <td className="p-3">
                    {c.full_name}
                    {!activa && <span className="text-xs text-red-500"> · Desactivada</span>}
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
      <div className="md:hidden divide-y divide-gray-100 bg-white border border-gray-100 rounded-2xl">
        {filtered.map((c) => {
          const activa = c.profiles?.active !== false
          return (
            <div key={c.id} className={`p-3 ${activa ? '' : 'opacity-50'}`}>
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{c.full_name}</span>
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

      {filtered.length === 0 && <p className="text-gray-400 text-center py-10">No hay clientas todavía.</p>}
    </div>
  )
}
