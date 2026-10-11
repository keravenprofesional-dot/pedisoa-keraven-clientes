import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney, formatDate } from '../../utils/format'

const METODO = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque',
  tarjeta: 'Tarjeta', deposito: 'Depósito',
}

export default function MyPayments() {
  const { client } = useAuth()
  const [pagos, setPagos] = useState([])
  const [cargando, setCargando] = useState(true)
  const debe = Number(client?.balance_pendiente || 0)

  useEffect(() => {
    if (!client) return
    // Los pagos cuelgan del pedido; la regla de la base ya deja ver solo los
    // pedidos de este cliente, así que aquí no hace falta filtrar por cliente.
    supabase
      .from('payments')
      .select('*, orders(order_number)')
      .order('fecha', { ascending: false })
      .then(({ data }) => {
        setPagos(data || [])
        setCargando(false)
      })
  }, [client])

  const abonado = pagos.reduce((s, p) => s + Number(p.monto || 0), 0)

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 md:pb-10">
      <header className="pt-7 pb-6">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.5em] text-oroprof">Keraven Profesional</p>
        <h1 className="mt-2 font-display text-[34px] leading-none text-negro">Mis pagos</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/85 px-4 py-4 ring-1 ring-oro/25">
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-negro/45">Balance pendiente</p>
          <p className={`mt-1 font-display text-[24px] tabular-nums ${debe > 0 ? 'text-negro' : 'text-negro/40'}`}>
            {formatMoney(debe)}
          </p>
        </div>
        <div className="rounded-2xl bg-white/85 px-4 py-4 ring-1 ring-oro/25">
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-negro/45">Total abonado</p>
          <p className="mt-1 font-display text-[24px] tabular-nums text-negro">{formatMoney(abonado)}</p>
        </div>
      </div>

      <div className="mt-8 mb-3 flex items-baseline gap-3">
        <h2 className="font-display text-[15px] uppercase tracking-[0.1em] text-negro">Mis abonos</h2>
        <span className="h-px flex-1 bg-oro/35" />
        <span className="font-sans text-[11px] uppercase tracking-[0.16em] tabular-nums text-negro/35">
          {pagos.length}
        </span>
      </div>

      {cargando ? (
        <p className="py-10 text-center font-sans text-[13px] text-negro/40">Cargando…</p>
      ) : pagos.length === 0 ? (
        <div className="rounded-2xl border border-oro/25 bg-white/70 px-5 py-8 text-center">
          <p className="font-display text-[17px] text-negro">Todavía no hay abonos registrados</p>
          <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-negro/45">
            Cada vez que pagues, Keraven lo registra y lo verás aquí.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-oro/25 bg-white/80">
          {pagos.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-b border-oro/12 px-4 py-3.5 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[16px] leading-tight text-negro">
                  {METODO[p.metodo] || p.metodo || 'Abono'}
                </p>
                <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-negro/40">
                  {formatDate(p.fecha)}
                  {p.orders?.order_number && <> · Pedido {p.orders.order_number}</>}
                </p>
              </div>
              <span className="shrink-0 font-display text-[17px] tabular-nums text-negro">
                {formatMoney(p.monto)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
