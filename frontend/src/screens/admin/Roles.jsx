import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, User, Users, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

// Solo el supremo usuario.
//   · Por persona: le da o le quita algo a UNO solo, sin tocar a los demás.
//   · Por rol: lo que traen de entrada todos los que tengan ese rol.
export default function Roles() {
  const [vista, setVista] = useState('persona') // persona | rol
  const [permisos, setPermisos] = useState([])
  const [roles, setRoles] = useState([])
  const [personal, setPersonal] = useState([])
  const [delRol, setDelRol] = useState({})      // { rolId: Set(permiso) }
  const [deLaPersona, setDeLaPersona] = useState({}) // { profileId: { permiso: true|false } }
  const [elegido, setElegido] = useState(null)  // persona seleccionada
  const [nuevo, setNuevo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: p }, { data: r }, { data: rp }, { data: us }, { data: up }] = await Promise.all([
      supabase.from('pedidos_permisos').select('*').order('orden'),
      supabase.from('pedidos_roles').select('*').order('nombre'),
      supabase.from('pedidos_rol_permisos').select('*'),
      supabase.from('profiles').select('id, full_name, usuario, rol_id, es_supremo, active').eq('tipo', 'personal').order('es_supremo', { ascending: false }).order('full_name'),
      supabase.from('pedidos_usuario_permisos').select('*'),
    ])
    setPermisos(p || [])
    setRoles(r || [])
    setPersonal(us || [])
    const a = {}
    for (const x of rp || []) (a[x.rol_id] ||= new Set()).add(x.permiso)
    setDelRol(a)
    const b = {}
    for (const x of up || []) (b[x.profile_id] ||= {})[x.permiso] = x.concedido
    setDeLaPersona(b)
    setElegido((e) => e ?? (us || []).find((u) => !u.es_supremo)?.id ?? null)
  }

  // Lo que puede hacer hoy esta persona: manda lo suyo; si no, lo de su rol.
  const tiene = (u, permiso) => {
    const propio = deLaPersona[u.id]?.[permiso]
    if (propio !== undefined) return propio
    return !!delRol[u.rol_id]?.has(permiso)
  }
  const esPropio = (u, permiso) => deLaPersona[u.id]?.[permiso] !== undefined

  async function alternarPersona(u, permiso) {
    setError('')
    const ahora = tiene(u, permiso)
    const delSuRol = !!delRol[u.rol_id]?.has(permiso)
    // Si al cambiarlo queda igual que su rol, se borra lo propio y vuelve a
    // mandar el rol: así no quedan excepciones que nadie entiende después.
    const { error: err } = (!ahora) === delSuRol
      ? await supabase.from('pedidos_usuario_permisos').delete().eq('profile_id', u.id).eq('permiso', permiso)
      : await supabase.from('pedidos_usuario_permisos').upsert({ profile_id: u.id, permiso, concedido: !ahora })
    if (err) setError('No se pudo guardar el cambio')
    cargar()
  }

  async function volverAlRol(u) {
    if (!confirm(`¿Dejar a ${u.full_name} exactamente con lo que trae su rol?`)) return
    await supabase.from('pedidos_usuario_permisos').delete().eq('profile_id', u.id)
    cargar()
  }

  async function crearRol(e) {
    e.preventDefault()
    setError('')
    const nombre = nuevo.trim()
    if (!nombre) return
    const { error: err } = await supabase.from('pedidos_roles').insert({ nombre })
    if (err) return setError(err.code === '23505' ? 'Ya existe un rol con ese nombre' : 'No se pudo crear el rol')
    setNuevo('')
    cargar()
  }

  async function alternarRol(rolId, permiso) {
    setError('')
    const ya = delRol[rolId]?.has(permiso)
    const { error: err } = ya
      ? await supabase.from('pedidos_rol_permisos').delete().eq('rol_id', rolId).eq('permiso', permiso)
      : await supabase.from('pedidos_rol_permisos').insert({ rol_id: rolId, permiso })
    if (err) setError('No se pudo guardar el cambio')
    cargar()
  }

  async function borrarRol(rol) {
    const cuantos = personal.filter((u) => u.rol_id === rol.id).length
    if (cuantos) return alert(`No se puede borrar: ${cuantos} usuario(s) tienen el rol "${rol.nombre}". Cámbiales el rol primero.`)
    if (!confirm(`¿Borrar el rol "${rol.nombre}"?`)) return
    await supabase.from('pedidos_roles').delete().eq('id', rol.id)
    cargar()
  }

  const persona = useMemo(() => personal.find((u) => u.id === elegido), [personal, elegido])
  const nombreRol = (id) => roles.find((r) => r.id === id)?.nombre || 'Sin rol'
  const pestana = (v, Icono, texto) => (
    <button onClick={() => setVista(v)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${vista === v ? 'bg-petroleo text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
      <Icono size={16} /> {texto}
    </button>
  )

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-grafondo mb-1">Roles y permisos</h1>
      <p className="text-sm text-gray-500 mb-4">
        Tú, como supremo usuario, siempre tienes todos los permisos. Administrar usuarios y roles es
        solo tuyo y no se le puede dar a nadie más.
      </p>

      <div className="flex gap-2 mb-4">
        {pestana('persona', User, 'Por persona')}
        {pestana('rol', Users, 'Por rol')}
      </div>
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {/* ── POR PERSONA ── */}
      {vista === 'persona' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {personal.filter((u) => !u.es_supremo).map((u) => (
              <button
                key={u.id}
                onClick={() => setElegido(u.id)}
                className={`px-4 py-2 rounded-xl text-sm border ${elegido === u.id ? 'bg-dorado/20 border-dorado font-bold text-petroleo' : 'bg-white border-gray-200 text-gray-600'} ${u.active ? '' : 'opacity-50'}`}
              >
                {u.full_name}
                <span className="block text-xs font-normal text-gray-500">{nombreRol(u.rol_id)}{u.active ? '' : ' · desactivado'}</span>
              </button>
            ))}
            {personal.filter((u) => !u.es_supremo).length === 0 && (
              <p className="text-gray-500 text-sm">Todavía no hay usuarios del personal. Créalos en la pantalla <strong>Usuarios</strong>.</p>
            )}
          </div>

          {persona && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <h2 className="font-bold text-petroleo">Qué puede hacer {persona.full_name}</h2>
                {Object.keys(deLaPersona[persona.id] || {}).length > 0 && (
                  <button onClick={() => volverAlRol(persona)} className="flex items-center gap-1 text-xs text-petroleo border border-gray-200 rounded-lg px-2 py-1">
                    <RotateCcw size={13} /> Dejarlo igual a su rol
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Empieza con lo que trae su rol <strong>{nombreRol(persona.rol_id)}</strong>. Lo que cambies
                aquí es solo para {persona.full_name.split(' ')[0]}; los demás del mismo rol no se tocan.
              </p>
              <div className="space-y-1">
                {permisos.map((p) => (
                  <label key={p.clave} className="flex items-center gap-2 text-sm py-1.5 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-[#123B4A]" checked={tiene(persona, p.clave)} onChange={() => alternarPersona(persona, p.clave)} />
                    <span>{p.descripcion}</span>
                    {esPropio(persona, p.clave) && (
                      <span className="text-xs bg-dorado/20 text-petroleo rounded-full px-2 py-0.5">
                        {deLaPersona[persona.id][p.clave] ? 'se lo diste tú' : 'se lo quitaste tú'}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── POR ROL ── */}
      {vista === 'rol' && (
        <>
          <p className="text-sm text-gray-500 mb-3">
            Lo que marques aquí lo traen <strong>todos</strong> los que tengan ese rol. Para darle o
            quitarle algo a una sola persona, usa la pestaña <strong>Por persona</strong>.
          </p>
          <form onSubmit={crearRol} className="flex gap-2 mb-4">
            <input placeholder="Nombre del rol nuevo (ej. Despacho)" value={nuevo} onChange={(e) => setNuevo(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-4 py-2" />
            <button className="flex items-center gap-1 bg-petroleo text-white text-sm font-semibold rounded-xl px-4 py-2"><Plus size={16} /> Crear rol</button>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {roles.map((rol) => {
              const cuantos = personal.filter((u) => u.rol_id === rol.id)
              return (
                <div key={rol.id} className="bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-petroleo">{rol.nombre}</p>
                      <p className="text-xs text-gray-400">{cuantos.length ? cuantos.map((u) => u.full_name).join(', ') : 'nadie lo tiene todavía'}</p>
                    </div>
                    <button onClick={() => borrarRol(rol)} className="text-gray-400 hover:text-red-500" title="Borrar rol"><Trash2 size={16} /></button>
                  </div>
                  <div className="space-y-1">
                    {permisos.map((p) => (
                      <label key={p.clave} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 accent-[#123B4A]" checked={!!delRol[rol.id]?.has(p.clave)} onChange={() => alternarRol(rol.id, p.clave)} />
                        {p.descripcion}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
