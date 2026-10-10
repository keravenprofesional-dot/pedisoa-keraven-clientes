import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney, formatDate, STATUS_LABELS, STATUS_ORDER } from '../../utils/format'

export default function OrdersBoard() {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('orders')
      .select('*, clients(full_name)')
      .order('created_at', { ascending: false })
    setOrders(data || [])
  }

  async function changeStatus(orderId, status) {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    load()
  }

  const filtered = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter
    const q = search.toLowerCase()
    const matchesSearch =
      o.order_number?.toLowerCase().includes(q) ||
      o.clients?.full_name?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-grafondo mb-4">Pedidos</h1>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          placeholder="Buscar por Nº de pedido, nombre, teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2"
        >
          <option value="all">Todos los estados</option>
          {STATUS_ORDER.concat('cancelado').map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Tabla en escritorio */}
      <div className="hidden md:block bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-graclaro text-gray-500 text-left">
            <tr>
              <th className="p-3">Pedido</th><th className="p-3">Cliente</th><th className="p-3">Fecha</th>
              <th className="p-3">Total</th><th className="p-3">Estado</th><th className="p-3">Cambiar a</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t border-gray-100">
                <td className="p-3 font-bold text-petroleo">{o.order_number}</td>
                <td className="p-3">{o.clients?.full_name}</td>
                <td className="p-3">{formatDate(o.created_at)}</td>
                <td className="p-3">{formatMoney(o.total)}</td>
                <td className="p-3 text-dorado font-medium">{STATUS_LABELS[o.status] || o.status}</td>
                <td className="p-3">
                  <select
                    value={o.status}
                    onChange={(e) => changeStatus(o.id, e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1"
                  >
                    {STATUS_ORDER.concat('cancelado').map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tarjetas en móvil */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.map((o) => (
          <div key={o.id} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex justify-between mb-1">
              <span className="font-bold text-petroleo">{o.order_number}</span>
              <span className="font-semibold">{formatMoney(o.total)}</span>
            </div>
            <p className="text-sm text-gray-500 mb-2">{o.clients?.full_name} · {formatDate(o.created_at)}</p>
            <select
              value={o.status}
              onChange={(e) => changeStatus(o.id, e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-2"
            >
              {STATUS_ORDER.concat('cancelado').map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
