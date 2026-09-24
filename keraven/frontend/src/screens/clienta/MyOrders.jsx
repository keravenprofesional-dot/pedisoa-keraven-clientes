import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney, formatDate, STATUS_LABELS } from '../../utils/format'

export default function MyOrders() {
  const { client } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!client) return
    supabase
      .from('orders')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders(data || [])
        setLoading(false)
      })
  }, [client])

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-grafondo mb-4">Mis pedidos</h1>
      {loading ? (
        <p className="text-gray-400 text-center py-10">Cargando…</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-400 text-center py-10">Aún no tienes pedidos.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              to={`/mis-pedidos/${o.id}`}
              className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-bold text-petroleo">{o.order_number}</p>
                <p className="text-xs text-gray-400">{formatDate(o.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatMoney(o.total)}</p>
                <p className="text-xs text-dorado font-medium">{STATUS_LABELS[o.status]}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
