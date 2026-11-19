import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney, formatDate } from '../../utils/format'
import { VentanaRecibo } from '../../components/Recibos'

// Cada recibo que Keraven le emitió: el de la venta, el de cada abono (lo
// que debía, lo que abonó y lo que le resta) y el de PAGADO COMPLETO.
// Los emite la base sola; aquí solo se ven y se comparten.
const TIPO = { venta: 'Recibo de venta', ajuste: 'Venta actualizada', abono: 'Recibo de abono', pagado: 'Pagado completo' }

export default function MyReceipts() {
  const { client } = useAuth()
  const [recibos, setRecibos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    if (!client) return
    supabase
      .from('recibos')
      .select('*')
      .eq('client_id', client.id)
      .order('fecha', { ascending: false })
      .then(({ data }) => {
        setRecibos(data || [])
        setCargando(false)
      })
  }, [client])

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 md:pb-10">
      <header className="pt-7 pb-6">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.5em] text-oroprof">Keraven Profesional</p>
        <h1 className="mt-2 font-display text-[34px] leading-none text-negro">Mis recibos</h1>
        <p className="mt-2 font-sans text-[13px] text-negro/45">El recibo de cada compra y de cada abono.</p>
      </header>

      {cargando ? (
        <p className="py-10 text-center font-sans text-[13px] text-negro/40">Cargando…</p>
      ) : recibos.length === 0 ? (
        <div className="rounded-2xl border border-oro/25 bg-white/70 px-5 py-8 text-center">
          <p className="font-display text-[17px] text-negro">Todavía no hay recibos</p>
          <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-negro/45">
            Cuando hagas un pedido o un abono, su recibo aparece aquí.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {recibos.map((r) => {
            const debe = Number(r.resta) > 0
            const esAbono = r.tipo === 'abono' || r.tipo === 'pagado'
            return (
              <button key={r.id} onClick={() => setAbierto(r)}
                className="rounded-2xl border border-oro/25 bg-white/85 px-4 py-4 text-left transition hover:border-oro/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`font-sans text-[10px] uppercase tracking-[0.24em] ${r.tipo === 'pagado' ? 'text-green-700' : 'text-oroprof'}`}>
                      {TIPO[r.tipo]} · {r.numero}
                    </p>
                    <p className="mt-0.5 font-sans text-[11px] uppercase tracking-[0.14em] text-negro/40">
                      Pedido {r.pedido} · {formatDate(r.fecha)}
                    </p>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.6} className="mt-1 shrink-0 text-negro/25" />
                </div>

                <div className="filo-oro my-3 opacity-50" />

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-negro/40">{esAbono ? 'Debía' : 'Total'}</p>
                    <p className="font-display text-[17px] tabular-nums text-negro">{formatMoney(esAbono ? r.debia : r.total)}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-negro/40">{esAbono ? 'Abonó' : 'Pagado'}</p>
                    <p className="font-display text-[17px] tabular-nums text-negro/70">{formatMoney(esAbono ? r.abono : r.pagado_antes)}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-negro/40">Resta</p>
                    <p className={`font-display text-[17px] tabular-nums ${debe ? 'text-red-700' : 'text-green-700'}`}>
                      {debe ? formatMoney(r.resta) : 'Pagado'}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
      {abierto && <VentanaRecibo recibo={abierto} paraClienta alCerrar={() => setAbierto(null)} />}
    </div>
  )
}
