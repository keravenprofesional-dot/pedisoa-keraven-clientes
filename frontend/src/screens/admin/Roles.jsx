import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

// Solo el supremo usuario: crea roles y marca con casillas qué puede hacer
// cada uno. Los cambios aplican de inmediato a todos los usuarios de ese rol
// (cuando vuelvan a abrir el programa).
export default function Roles() {
  const [roles, setRoles] = useState([])
  const [permisos, setPermisos] = useState([])
  const [asignados, setAsignados] = useState({}) // { rolId: Set(permiso) }
  const [enUso, setEnUso] = useState({}) // { rolId: cantidad de usuarios }
  const [nuevo, setNuevo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: r }, { data: p }, { data: rp }, { data: us }] = await Promise.all([
      supabase.from('pedidos_roles').select('*').order('nombre'),
      supabase.from('pedidos_permisos').select('*').order('orden'),
      supabase.from('pedidos_rol_permisos').select('*'),
      supabase.from('profiles').select('rol_id').eq('tipo', 'personal'),
    ])
    setRoles(r || [])
    setPermisos(p || [])
    const a = {}
    for (const x of rp || []) (a[x.rol_id] ||= new Set()).add(x.permiso)
    setAsignados(a)
    const u = {}
    for (const x of us || []) if (x.rol_id) u[x.rol_id] = (u[x.rol_id] || 0) + 1
    setEnUso(u)
  }

  async function crear(e) {
    e.preventDefault()
    setError('')
    const nombre = nuevo.trim()
    if (!nombre) return
    const { error: err } = await supabase.from('pedidos_roles').insert({ nombre })
    if (err) { setError(err.code === '23505' ? 'Ya existe un rol con ese nombre' : 'No se pudo crear el rol'); return }
    setNuevo('')
    cargar()
  }

  async function alternar(rolId, permiso) {
    setError('')
    const tiene = asignados[rolId]?.has(permiso)
    const { error: err } = tiene
      ? await supabase.from('pedidos_rol_permisos').delete().eq('rol_id', rolId).eq('permiso', permiso)
      : await supabase.from('pedidos_rol_permisos').insert({ rol_id: rolId, permiso })
    if (err) { setError('No se pudo guardar el cambio'); return }
    cargar()
  }

  async function borrar(rol) {
    if (enUso[rol.id]) { alert(`No se puede borrar: ${enUso[rol.id]} usuario(s) tienen el rol "${rol.nombre}". Cámbiales el rol primero.`); return }
    if (!confirm(`¿Borrar el rol "${rol.nombre}"?`)) return
    await supabase.from('pedidos_roles').delete().eq('id', rol.id)
    cargar()
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-grafondo mb-1">Roles y permisos</h1>
      <p className="text-sm text-gray-500 mb-4">
        Marca lo que puede hacer cada rol. Tú, como supremo usuario, siempre tienes todos los permisos.
        Administrar usuarios y roles es solo tuyo y no se puede dar a otro rol.
      </p>

      <form onSubmit={crear} className="flex gap-2 mb-4">
        <input placeholder="Nombre del rol nuevo (ej. Despacho)" value={nuevo} onChange={(e) => setNuevo(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-4 py-2" />
        <button className="flex items-center gap-1 bg-petroleo text-white text-sm font-semibold rounded-xl px-4 py-2"><Plus size={16} /> Crear rol</button>
      </form>
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {roles.map((rol) => (
          <div key={rol.id} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-petroleo">{rol.nombre}</p>
                <p className="text-xs text-gray-400">{enUso[rol.id] || 0} usuario(s) con este rol</p>
              </div>
              <button onClick={() => borrar(rol)} className="text-gray-400 hover:text-red-500" title="Borrar rol"><Trash2 size={16} /></button>
            </div>
            <div className="space-y-1">
              {permisos.map((p) => (
                <label key={p.clave} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-[#123B4A]" checked={!!asignados[rol.id]?.has(p.clave)} onChange={() => alternar(rol.id, p.clave)} />
                  {p.descripcion}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
