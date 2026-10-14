import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Truck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney, formatDate, STATUS_LABELS, colorDe } from '../../utils/format'
import { caminoDe, puedeConfirmar } from '../../utils/seguimiento'

const horaCorta = (f) =>
  f ? `${formatDate(f)} · ${new Date(f).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}` : ''

export default function Seguimiento() {
  const { client } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [historial, setHistorial] = useState({})
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState('')
  const [confirmando, setConfirmando] = useState(null)

  const cargar = useCallback(async () => {
    if (!client) return
    // Los que van en camino. Los ya entregados viven en Mis recibos.
    const { data: ped } = await supabase
      .from('orders')
      .select('*')
      .eq('client_id', client.id)
      .not('status', 'in', '("entregado","cancelado")')
      .order('created_at', { ascending: false })

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
    }
    setCargando(false)
  }, [client])

  useEffect(() => { cargar() }, [cargar])

  async function confirmar(o) {
    if (!confirm(`¿Confirmas que ya recibiste el pedido ${o.order_number}? Con esto el pedido queda cerrado.`)) return
    setConfirmando(o.id)
    setAviso('')
    const { error } = await supabase.rpc('confirmar_entrega', { p_order_id: o.id })
    setConfirmando(null)
    if (error) setAviso(error.message || 'No se pudo confirmar')
    else setAviso(`Pedido ${o.order_number} confirmado. ¡Gracias!`)
    cargar()
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 md:pb-10">
      <header className="pt-7 pb-6">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.5em] text-oroprof">Keraven Profesional</p>
        <h1 className="mt-2 font-display text-[34px] leading-none text-negro">Seguimiento</h1>
        <p className="mt-2 font-sans text-[13px] text-negro/45">Dónde va tu pedido, paso por paso.</p>
      </header>

      {aviso && (
        <p className="mb-5 rounded-2xl border border-oro/40 bg-white/80 px-4 py-3 font-sans text-[13px] text-negro/70">
          {aviso}
        </p>
      )}

      {cargando ? (
        <p className="py-10 text-center font-sans text-[13px] text-negro/40">Cargando…</p>
      ) : pedidos.length === 0 ? (
        <div className="rounded-2xl border border-oro/25 bg-white/70 px-5 py-8 text-center">
          <p className="font-display text-[17px] text-negro">No tienes pedidos en camino</p>
          <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-negro/45">
            Cuando hagas un pedido, aquí vas viendo por cuál departamento va pasando.
          </p>
          <Link
            to="/catalogo"
            className="mt-5 inline-flex rounded-full bg-negro px-6 py-3 font-sans text-[11px] font-medium uppercase tracking-[0.22em] text-orosuave"
          >
            Realizar pedido
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {pedidos.map((o) => {
            const camino = caminoDe(o.status, historial[o.id] || [])
            return (
              <article key={o.id} className="rounded-2xl border border-oro/25 bg-white/85 px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-oroprof">{o.order_number}</p>
                    <p className="mt-0.5 font-sans text-[11px] uppercase tracking-[0.14em] text-negro/40">
                      {formatDate(o.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-display text-[19px] tabular-nums text-negro">{formatMoney(o.total)}</span>
                    <p className={`mt-1 inline-block rounded-full px-2.5 py-0.5 font-sans text-[10.5px] font-semibold ring-1 ${colorDe(o.status).chip}`}>
                      {STATUS_LABELS[o.status]}
                    </p>
                  </div>
                </div>

                <div className="filo-oro my-4 opacity-50" />

                <ol className="relative">
                  {camino.map((e, i) => (
                    <li key={e.estado} className="relative flex gap-3.5 pb-5 last:pb-0">
                      {/* La línea que une un paso con el siguiente */}
                      {i < camino.length - 1 && (
                        <span className={`absolute left-[11px] top-6 h-[calc(100%-1rem)] w-[2px] ${
                          e.hecha ? colorDe(e.estado).linea : 'bg-negro/10'
                        }`} />
                      )}
                      <span className={`relative z-10 mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full ${
                        e.hecha ? `${colorDe(e.estado).punto} text-white`
                          : e.esAhora ? `${colorDe(e.estado).punto} text-white ring-4 ring-black/10 animate-pulse`
                          : 'border border-negro/15 bg-white'
                      }`}>
                        {e.hecha ? <Check size={12} strokeWidth={2.6} />
                          : e.esAhora ? <Truck size={11} strokeWidth={1.9} />
                          : <span className="h-1 w-1 rounded-full bg-negro/20" />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2.5">
                          <p className={`font-display text-[16px] leading-tight ${
                            e.esAhora ? 'text-negro' : e.hecha ? 'text-negro/75' : 'text-negro/35'
                          }`}>
                            {e.titulo}
                          </p>
                          <span className={`font-sans text-[9.5px] uppercase tracking-[0.2em] ${
                            e.esAhora || e.hecha ? 'text-oroprof' : 'text-negro/25'
                          }`}>
                            {e.departamento}
                          </span>
                        </div>
                        {e.esAhora && (
                          <p className="mt-0.5 font-sans text-[12.5px] leading-snug text-negro/55">{e.cliente}</p>
                        )}
                        {e.fecha && (
                          <p className="mt-0.5 font-sans text-[11px] tabular-nums text-negro/35">{horaCorta(e.fecha)}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>

                {puedeConfirmar(o.status) && (
                  <>
                    <div className="filo-oro my-4 opacity-50" />
                    <button
                      onClick={() => confirmar(o)}
                      disabled={confirmando === o.id}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-negro py-3.5 font-sans text-[11px] font-medium uppercase tracking-[0.22em] text-orosuave transition active:scale-[0.99] disabled:opacity-50"
                    >
                      <Check size={14} strokeWidth={2.2} />
                      {confirmando === o.id ? 'Confirmando…' : 'Ya me llegó — cerrar pedido'}
                    </button>
                    <p className="mt-2 text-center font-sans text-[11.5px] text-negro/40">
                      Solo tú puedes cerrar tu pedido, cuando lo tengas en la mano.
                    </p>
                  </>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
