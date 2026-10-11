import { useEffect, useState } from 'react'
import { ChevronRight, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { formatMoney, formatDate } from '../../utils/format'
import { ETAPAS, caminoDe, siguienteEtapa } from '../../utils/seguimiento'

const hora = (f) =>
  f ? new Date(f).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

// Cuántas horas lleva parado en esta etapa: lo que de verdad hay que mirar.
function llevaParado(desde) {
  if (!desde) return ''
  const h = Math.floor((Date.now() - new Date(desde).getTime()) / 3600000)
  if (h < 1) return 'hace minutos'
  if (h < 24) return `${h} h aquí`
  return `${Math.floor(h / 24)} d aquí`
}

export default function Seguimiento() {
  const { puede } = useAuth()
  const puedeMover = puede('cambiar_estado') || puede('despacho')
  const [pedidos, setPedidos] = useState([])
  const [historial, setHistorial] = useState({})
  const [abierto, setAbierto] = useState(null)
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data: ped } = await supabase
      .from('orders')
      .select('*, clients(full_name, client_number)')
      .not('status', 'in', '("entregado","cancelado")')
      .order('created_at')
    const lista = ped || []
    setPedidos(lista)
    if (lista.length) {
      const { data: hist } = await supabase
        .from('order_status_history')
        .select('order_id, status, changed_at')
        .in('order_id', lista.map((o) => o.id))
        .order('changed_at')
      const mapa = {}
      for (const h of hist || []) (mapa[h.order_id] ||= []).push(h)
      setHistorial(mapa)
    } else {
      setHistorial({})
    }
    setCargando(false)
  }

  async function avanzar(o) {
    const sig = siguienteEtapa(o.status)
    if (!sig) return
    // El último paso lo da el cliente, no el personal.
    if (sig.estado === 'entregado') {
      setAviso(`${o.order_number} ya va en camino. El cierre lo hace el cliente cuando lo reciba.`)
      return
    }
    setAviso('')
    const { error } = await supabase.from('orders').update({ status: sig.estado }).eq('id', o.id)
    if (error) setAviso(error.message || 'No se pudo mover el pedido')
    else setAviso(`${o.order_number} pasó a ${sig.titulo} (${sig.departamento}).`)
    cargar()
  }

  // Un montón por etapa: así cada departamento ve de un vistazo lo suyo.
  const porEtapa = ETAPAS.filter((e) => e.estado !== 'entregado').map((e) => ({
    etapa: e,
    lista: pedidos.filter((o) => o.status === e.estado),
  }))

  const ultimoCambio = (o) => {
    const h = historial[o.id] || []
    return h.length ? h[h.length - 1].changed_at : o.created_at
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-grafondo">Seguimiento</h1>
      <p className="mb-5 text-sm text-gray-500">
        En qué mano está cada pedido. El cliente ve esto mismo desde su teléfono.
      </p>

      {aviso && <p className="mb-4 rounded-xl border border-gray-200 bg-graclaro p-3 text-sm">{aviso}</p>}

      {cargando ? (
        <p className="py-10 text-center text-gray-400">Cargando…</p>
      ) : pedidos.length === 0 ? (
        <p className="py-10 text-center text-gray-400">No hay pedidos en camino.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {porEtapa.map(({ etapa, lista }) => (
            <section key={etapa.estado} className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-grafondo">{etapa.titulo}</h2>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400">{etapa.departamento}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums ${
                  lista.length ? 'bg-negro text-oro' : 'bg-graclaro text-gray-400'
                }`}>
                  {lista.length}
                </span>
              </div>

              {lista.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-300">Vacío</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lista.map((o) => {
                    const sig = siguienteEtapa(o.status)
                    const esDelCliente = sig?.estado === 'entregado'
                    return (
                      <li key={o.id} className="rounded-xl border border-gray-100 bg-graclaro/60 p-3">
                        <button
                          onClick={() => setAbierto(abierto === o.id ? null : o.id)}
                          className="flex w-full items-start justify-between gap-2 text-left"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-petroleo">{o.order_number}</p>
                            <p className="truncate text-xs text-gray-500">
                              {o.clients?.full_name} · {o.clients?.client_number}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {formatMoney(o.total)} · {llevaParado(ultimoCambio(o))}
                            </p>
                          </div>
                          <ChevronRight
                            size={15}
                            className={`mt-1 shrink-0 text-gray-300 transition ${abierto === o.id ? 'rotate-90' : ''}`}
                          />
                        </button>

                        {abierto === o.id && (
                          <ol className="mt-3 border-t border-gray-200 pt-2">
                            {caminoDe(o.status, historial[o.id] || []).map((e) => (
                              <li key={e.estado} className="flex items-baseline gap-2 py-0.5 text-xs">
                                <span className={`w-3 shrink-0 ${e.hecha ? 'text-dorado' : 'text-gray-300'}`}>
                                  {e.hecha ? '●' : e.esAhora ? '◉' : '○'}
                                </span>
                                <span className={e.esAhora ? 'font-semibold text-grafondo' : e.hecha ? 'text-gray-600' : 'text-gray-300'}>
                                  {e.titulo}
                                </span>
                                <span className="ml-auto tabular-nums text-gray-400">{hora(e.fecha)}</span>
                              </li>
                            ))}
                          </ol>
                        )}

                        {puedeMover && sig && (
                          esDelCliente ? (
                            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
                              <Check size={12} /> Lo cierra el cliente al recibirlo
                            </p>
                          ) : (
                            <button
                              onClick={() => avanzar(o)}
                              className="mt-2 w-full rounded-lg bg-negro py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-oro active:scale-[0.99]"
                            >
                              Pasar a {sig.titulo}
                            </button>
                          )
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {!puedeMover && (
        <p className="mt-6 text-center text-sm text-gray-400">
          Estás viendo el seguimiento. Para mover pedidos hace falta el permiso de despacho o de cambiar estado.
        </p>
      )}
    </div>
  )
}
