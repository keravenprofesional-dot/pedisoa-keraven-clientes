import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney, formatDate } from '../../utils/format'
import StatusTracker from '../../components/StatusTracker'

export default function OrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const { data: o } = await supabase.from('orders').select('*').eq('id', id).single()
    setOrder(o)
    const { data: its } = await supabase
      .from('order_items')
      .select('*, products(nombre)')
      .eq('order_id', id)
    setItems(its || [])
    const { data: banks } = await supabase.from('bank_accounts').select('*').eq('activo', true)
    setBankAccounts(banks || [])
  }

  if (!order) return <p className="text-center text-gray-400 py-10">Cargando…</p>

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-lg mx-auto">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6" id="receipt">
        <div className="text-center mb-4">
          <p className="font-extrabold text-petroleo text-lg">KERAVEN PROFESIONAL</p>
          <p className="text-dorado font-bold text-xl">PEDIDO #{order.order_number}</p>
          <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
        </div>

        <div className="border-t border-b py-3 my-3">
          {items.map((it) => (
            <div key={it.id} className="flex justify-between text-sm py-1">
              <span>{it.cantidad}× {it.products?.nombre}</span>
              <span>{formatMoney(it.subtotal)}</span>
            </div>
          ))}
        </div>

        <div className="text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>Descuento</span><span>{formatMoney(order.descuento)}</span></div>
          <div className="flex justify-between"><span>Envío</span><span>{formatMoney(order.envio)}</span></div>
          <div className="flex justify-between font-bold text-base border-t pt-1 mt-1">
            <span>TOTAL</span><span>{formatMoney(order.total)}</span>
          </div>
          <div className="flex justify-between"><span>Forma de pago</span><span className="capitalize">{order.payment_method}</span></div>
          {order.avance > 0 && <div className="flex justify-between"><span>Avance</span><span>{formatMoney(order.avance)}</span></div>}
          {order.balance > 0 && (
            <div className="flex justify-between text-red-500 font-semibold">
              <span>Balance pendiente</span><span>{formatMoney(order.balance)}</span>
            </div>
          )}
        </div>

        {bankAccounts.length > 0 && (
          <div className="mt-4 pt-3 border-t text-xs text-gray-500">
            <p className="font-semibold text-grafondo mb-1">CUENTAS BANCARIAS — KERAVEN PROFESIONAL</p>
            {bankAccounts.map((b) => (
              <p key={b.id}>{b.banco} ({b.tipo_cuenta}) — {b.numero} — {b.titular} — {b.moneda}</p>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => window.print()} className="w-full bg-petroleo text-white rounded-xl py-3 font-bold mb-6">
        Descargar / Imprimir recibo
      </button>

      <h2 className="font-bold text-grafondo mb-3">Seguimiento del pedido</h2>
      <StatusTracker status={order.status} />
    </div>
  )
}
