import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Mail, MapPin, CreditCard, Check, X, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatDate } from '../../utils/format'

// El buzón de solicitudes de clientes nuevos. Lo ven todos los
// administradores con permiso de crear clientes o de ver solicitudes.
export default function Solicitudes() {
  const navigate = useNavigate()
  const [lista, setLista] = useState([])
  const [filtro, setFiltro] = useState('pendiente')
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('solicitudes_cliente')
      .select('*')
      .order('creado_en', { ascending: false })
    setLista(data || [])
    setCargando(false)
  }

  async function atender(s, estado) {
    const verbo = estado === 'aprobada' ? 'aprobar' : 'rechazar'
    const nota = prompt(`¿${verbo[0].toUpperCase() + verbo.slice(1)} la solicitud de ${s.nombre_completo}? Nota (opcional):`, '')
    if (nota === null) return
    const { error } = await supabase.rpc('atender_solicitud', { p_id: s.id, p_estado: estado, p_nota: nota })
    if (error) { setAviso(error.message); return }
    setAviso(`Solicitud de ${s.nombre_completo} ${estado}.`)
    cargar()
  }

  // Llevar los datos de la solicitud al formulario de nuevo cliente.
  function crearCliente(s) {
    const datos = {
      full_name: s.nombre_completo, telefono_login: s.telefono,
      cedula: s.cedula || '', direccion: s.direccion || '', correo: s.correo || '',
    }
    try { sessionStorage.setItem('prefill_cliente', JSON.stringify(datos)) } catch (e) { /* sin memoria */ }
    navigate('/admin/clientas?nuevo=1')
  }

  const pendientes = lista.filter((s) => s.estado === 'pendiente').length
  const filtrada = lista.filter((s) => filtro === 'todas' || s.estado === filtro)
  const color = { pendiente: 'text-amber-600 bg-amber-50', aprobada: 'text-green-700 bg-green-50', rechazada: 'text-red-600 bg-red-50' }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-grafondo">Solicitudes de clientes nuevos</h1>
      <p className="mb-5 text-sm text-gray-500">
        Personas que pidieron su perfil desde la pantalla de entrada.
        {pendientes > 0 && <b className="text-amber-600"> {pendientes} pendiente{pendientes === 1 ? '' : 's'}.</b>}
      </p>

      <div className="mb-4 flex gap-2">
        {[['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas'], ['todas', 'Todas']].map(([v, t]) => (
          <button key={v} onClick={() => setFiltro(v)}
            className={`rounded-full px-4 py-1.5 text-sm ${filtro === v ? 'bg-negro text-oro font-semibold' : 'bg-white border border-gray-200 text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {aviso && <p className="mb-4 rounded-xl border border-gray-200 bg-graclaro p-3 text-sm">{aviso}</p>}

      {cargando ? (
        <p className="py-10 text-center text-gray-400">Cargando…</p>
      ) : filtrada.length === 0 ? (
        <p className="py-10 text-center text-gray-400">No hay solicitudes {filtro !== 'todas' ? filtro + 's' : ''}.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtrada.map((s) => (
            <div key={s.id} className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-grafondo">{s.nombre_completo}</p>
                  <p className="text-xs text-gray-400">{formatDate(s.creado_en)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${color[s.estado]}`}>{s.estado}</span>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600">
                <p className="flex items-center gap-2"><Phone size={14} className="text-petroleo" /> {s.telefono}
                  {s.telefono_referencia && <span className="text-gray-400">· ref. {s.telefono_referencia}</span>}</p>
                <p className="flex items-center gap-2"><Mail size={14} className="text-petroleo" /> {s.correo}</p>
                {s.cedula && <p className="flex items-center gap-2"><CreditCard size={14} className="text-petroleo" /> {s.cedula}</p>}
                {s.direccion && <p className="flex items-center gap-2"><MapPin size={14} className="text-petroleo" /> {s.direccion}</p>}
              </div>

              {s.nota_admin && <p className="mt-2 rounded-lg bg-graclaro p-2 text-xs text-gray-500">Nota: {s.nota_admin}</p>}

              {s.estado === 'pendiente' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => crearCliente(s)}
                    className="flex items-center gap-1.5 rounded-lg bg-petroleo px-3 py-1.5 text-sm font-semibold text-white">
                    <UserPlus size={15} /> Crear cliente
                  </button>
                  <button onClick={() => atender(s, 'aprobada')}
                    className="flex items-center gap-1.5 rounded-lg border border-green-600 px-3 py-1.5 text-sm font-semibold text-green-700">
                    <Check size={15} /> Aprobar
                  </button>
                  <button onClick={() => atender(s, 'rechazada')}
                    className="flex items-center gap-1.5 rounded-lg border border-red-400 px-3 py-1.5 text-sm font-semibold text-red-500">
                    <X size={15} /> Rechazar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
