import { useEffect, useState } from 'react'
import { UserPlus, Pencil, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { adminUsuarios } from '../../lib/adminUsuarios'
import { useAuth } from '../../context/AuthContext'

// Solo el supremo usuario: crea y edita las cuentas del personal y les
// asigna un rol. (Las clientas se manejan en la pantalla Clientas.)
const vacio = { full_name: '', usuario: '', telefono: '', rol_id: '' }

export default function Usuarios() {
  const { profile, reload } = useAuth()
  const [personal, setPersonal] = useState([])
  const [roles, setRoles] = useState([])
  const [form, setForm] = useState(vacio)
  const [editando, setEditando] = useState(null) // id o 'nuevo'
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('profiles').select('*').eq('tipo', 'personal').order('es_supremo', { ascending: false }).order('full_name'),
      supabase.from('pedidos_roles').select('id, nombre').order('nombre'),
    ])
    setPersonal(p || [])
    setRoles(r || [])
  }

  function abrir(u) {
    setError(''); setAviso('')
    if (u === 'nuevo') { setForm({ ...vacio, rol_id: roles[0]?.id || '' }); setEditando('nuevo'); return }
    setForm({ full_name: u.full_name, usuario: u.usuario || '', telefono: u.telefono || '', rol_id: u.rol_id || '' })
    setEditando(u.id)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true); setError('')
    try {
      if (editando === 'nuevo') {
        await adminUsuarios('crear_personal', form)
        setAviso(`Cuenta creada. ${form.full_name} entra por la puerta del personal con usuario "${form.usuario.trim().toLowerCase()}" y su teléfono.`)
      } else {
        const actual = personal.find((p) => p.id === editando)
        const datos = { id: editando, full_name: form.full_name, usuario: form.usuario, telefono: form.telefono }
        if (!actual.es_supremo) datos.rol_id = form.rol_id
        await adminUsuarios('editar_personal', datos)
        setAviso('Cambios guardados.')
        if (editando === profile.id) reload()
      }
      setEditando(null)
      cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function activar(u, active) {
    if (!active && !confirm(`¿Desactivar a ${u.full_name}? Ya no podrá entrar hasta que lo actives de nuevo.`)) return
    try {
      await adminUsuarios('editar_personal', { id: u.id, active })
      cargar()
    } catch (err) { alert(err.message) }
  }

  const nombreRol = (id) => roles.find((r) => r.id === id)?.nombre || 'Sin rol'
  const editandoSupremo = editando && editando !== 'nuevo' && personal.find((p) => p.id === editando)?.es_supremo

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-grafondo">Usuarios del personal</h1>
        <button onClick={() => abrir('nuevo')} className="flex items-center gap-2 bg-petroleo text-white text-sm font-semibold rounded-xl px-4 py-2">
          <UserPlus size={16} /> Nuevo usuario
        </button>
      </div>

      <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-3 mb-4">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <p>El personal entra con su <strong>usuario + teléfono</strong>. Quien conozca ambos datos puede entrar,
          así que no compartas los usuarios y desactiva enseguida la cuenta de quien deje de trabajar contigo.</p>
      </div>

      {aviso && <p className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl p-3 mb-4">{aviso}</p>}

      {editando && (
        <form onSubmit={guardar} className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <h2 className="md:col-span-2 font-semibold">{editando === 'nuevo' ? 'Nuevo usuario' : 'Editar usuario'}</h2>
          <label className="text-sm">Nombre completo
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">Usuario (para entrar)
            <input required autoCapitalize="none" placeholder="ej. manuel" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">Teléfono (su clave de entrada)
            <input required inputMode="tel" placeholder="809-555-0000" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" />
          </label>
          {editandoSupremo ? (
            <p className="text-sm text-gray-500 self-end pb-2">Supremo usuario: tiene todos los permisos.</p>
          ) : (
            <label className="text-sm">Rol
              <select required value={form.rol_id} onChange={(e) => setForm({ ...form, rol_id: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2">
                <option value="">Elige un rol…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </label>
          )}
          {error && <p className="text-red-500 text-sm md:col-span-2">{error}</p>}
          <div className="md:col-span-2 flex gap-2">
            <button disabled={guardando} className="bg-petroleo text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-60">
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setEditando(null)} className="text-gray-500 px-4 py-2">Cancelar</button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {personal.map((u) => (
          <div key={u.id} className={`bg-white border border-gray-100 rounded-xl p-4 flex flex-wrap items-center gap-3 ${u.active ? '' : 'opacity-60'}`}>
            <div className="flex-1 min-w-[12rem]">
              <p className="font-semibold">{u.full_name}{u.id === profile.id && <span className="text-xs text-gray-400"> (tú)</span>}</p>
              <p className="text-sm text-gray-500">Usuario: <strong>{u.usuario}</strong> · Tel: {u.telefono}</p>
              <p className="text-xs mt-1">
                {u.es_supremo
                  ? <span className="bg-dorado/20 text-petroleo font-semibold rounded-full px-2 py-0.5">Supremo usuario</span>
                  : <span className="bg-graclaro text-petroleo rounded-full px-2 py-0.5">{nombreRol(u.rol_id)}</span>}
                {!u.active && <span className="ml-2 text-red-500 font-semibold">Desactivado</span>}
              </p>
            </div>
            <button onClick={() => abrir(u)} className="flex items-center gap-1 text-sm text-petroleo border border-gray-200 rounded-lg px-3 py-1.5">
              <Pencil size={14} /> Editar
            </button>
            {u.id !== profile.id && (
              <button onClick={() => activar(u, !u.active)} className={`text-sm rounded-lg px-3 py-1.5 border ${u.active ? 'text-red-500 border-red-200' : 'text-green-700 border-green-200'}`}>
                {u.active ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
