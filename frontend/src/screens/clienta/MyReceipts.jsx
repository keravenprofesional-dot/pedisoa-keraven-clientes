import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney, formatDate } from '../../utils/format'

// Un recibo es un pedido ya entregado: lo que se llevó, lo que pagó y lo que
// queda debiendo. "Mis pedidos" es para ver por dónde va un pedido en camino;
// esto es el comprobante de los que ya llegaron.
export default function MyReceipts() {
  const { client } = useAuth()
  const [recibos, setRecibos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!client) return
    supabase
      .from('orders')
      .select('*')
      .eq('client_id', client.id)
      .eq('status', 'entregado')
      .order('created_at', { ascending: false })
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
        <p className="mt-2 font-sans text-[13px] text-negro/45">Comprobante de cada pedido entregado.</p>
      </header>

      {cargando ? (
        <p className="py-10 text-center font-sans text-[13px] text-negro/40">Cargando…</p>
      ) : recibos.length === 0 ? (
        <div className="rounded-2xl border border-oro/25 bg-white/70 px-5 py-8 text-center">
          <p className="font-display text-[17px] text-negro">Todavía no hay recibos</p>
          <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-negro/45">
            Cuando te entreguen un pedido, su comprobante aparece aquí.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {recibos.map((o) => {
            const pendiente = Number(o.balance || 0)
            const pagado = Number(o.total || 0) - pendiente
            return (
              <Link
                key={o.id}
                to={`/mis-pedidos/${o.id}`}
                className="rounded-2xl border border-oro/25 bg-white/85 px-4 py-4 transition hover:border-oro/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-oroprof">
                      {o.order_number}
                    </p>
                    <p className="mt-0.5 font-sans text-[11px] uppercase tracking-[0.14em] text-negro/40">
                      {formatDate(o.created_at)}
                    </p>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.6} className="mt-1 shrink-0 text-negro/25" />
                </div>

                <div className="filo-oro my-3 opacity-50" />

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-negro/40">Total</p>
                    <p className="font-display text-[17px] tabular-nums text-negro">{formatMoney(o.total)}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-negro/40">Pagado</p>
                    <p className="font-display text-[17px] tabular-nums text-negro/70">{formatMoney(pagado)}</p>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-negro/40">Debe</p>
                    <p className={`font-display text-[17px] tabular-nums ${pendiente > 0 ? 'text-negro' : 'text-negro/35'}`}>
                      {formatMoney(pendiente)}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
