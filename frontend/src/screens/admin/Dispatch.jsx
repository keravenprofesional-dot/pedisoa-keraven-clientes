import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'

export default function Dispatch() {
  const [orders, setOrders] = useState([])
  const [checked, setChecked] = useState({}) // { orderId: { itemId: true } }
  const [expanded, setExpanded] = useState(null)
  const [itemsByOrder, setItemsByOrder] = useState({})

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('orders')
      .select('*, clients(full_name, client_phones(phone))')
      .in('status', ['confirmado', 'preparacion', 'listo', 'despachado', 'en_entrega'])
      .order('created_at')
    setOrders(data || [])
  }

  async function toggleExpand(orderId) {
    if (expanded === orderId) {
      setExpanded(null)
      return
    }
    setExpanded(orderId)
    if (!itemsByOrder[orderId]) {
      const { data } = await supabase.from('order_items').select('*, products(nombre)').eq('order_id', orderId)
      setItemsByOrder((prev) => ({ ...prev, [orderId]: data || [] }))
    }
  }

  function toggleItem(orderId, itemId) {
    setChecked((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], [itemId]: !prev[orderId]?.[itemId] },
    }))
  }

  function allChecked(orderId) {
    const its = itemsByOrder[orderId] || []
    return its.length > 0 && its.every((i) => checked[orderId]?.[i.id])
  }

  async function setStatus(orderId, status) {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    load()
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-grafondo mb-4">Preparación y despacho</h1>
      <div className="flex flex-col gap-3">
        {orders.map((o) => (
          <div key={o.id} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(o.id)}>
              <div>
                <p className="font-bold text-petroleo">{o.order_number} — {o.clients?.full_name}</p>
                <p className="text-xs text-gray-400">{o.clients?.client_phones?.[0]?.phone} · Balance: {formatMoney(o.balance)}</p>
              </div>
              <span className="text-xs bg-dorado/20 text-dorado font-semibold px-2 py-1 rounded-full capitalize">
                {o.status.replace('_', ' ')}
              </span>
            </div>

            {expanded === o.id && (
              <div className="mt-3 border-t pt-3">
                {(itemsByOrder[o.id] || []).map((it) => (
                  <label key={it.id} className="flex items-center gap-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={!!checked[o.id]?.[it.id]}
                      onChange={() => toggleItem(o.id, it.id)}
                    />
                    {it.cantidad} unidad(es) — {it.products?.nombre}
                  </label>
                ))}

                <div className="flex gap-2 mt-3">
                  {o.status !== 'despachado' && o.status !== 'en_entrega' && (
                    <button
                      disabled={!allChecked(o.id)}
                      onClick={() => setStatus(o.id, 'listo')}
                      className="bg-petroleo disabled:bg-gray-300 text-white text-sm rounded-lg px-3 py-2"
                    >
                      Pedido completo → Listo
                    </button>
                  )}
                  {o.status === 'listo' && (
                    <button onClick={() => setStatus(o.id, 'despachado')} className="bg-dorado text-petroleo text-sm rounded-lg px-3 py-2 font-semibold">
                      Marcar despachado
                    </button>
                  )}
                  {o.status === 'despachado' && (
                    <button onClick={() => setStatus(o.id, 'en_entrega')} className="bg-dorado text-petroleo text-sm rounded-lg px-3 py-2 font-semibold">
                      En entrega
                    </button>
                  )}
                  {o.status === 'en_entrega' && (
                    <button onClick={() => setStatus(o.id, 'entregado')} className="bg-green-600 text-white text-sm rounded-lg px-3 py-2 font-semibold">
                      Entregado
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {orders.length === 0 && <p className="text-gray-400 text-center py-10">No hay pedidos pendientes.</p>}
      </div>
    </div>
  )
}
