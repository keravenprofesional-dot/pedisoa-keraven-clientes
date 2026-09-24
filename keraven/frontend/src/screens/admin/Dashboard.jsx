import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'

export default function Dashboard() {
  const [stats, setStats] = useState({ nuevos: 0, enProceso: 0, despachados: 0, ventasMes: 0, balancePendiente: 0 })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: orders } = await supabase.from('orders').select('status, total, balance, created_at')
    if (!orders) return
    const now = new Date()
    const nuevos = orders.filter((o) => o.status === 'recibido').length
    const enProceso = orders.filter((o) => ['confirmado', 'preparacion', 'listo'].includes(o.status)).length
    const despachados = orders.filter((o) => ['despachado', 'en_entrega'].includes(o.status)).length
    const ventasMes = orders
      .filter((o) => new Date(o.created_at).getMonth() === now.getMonth())
      .reduce((sum, o) => sum + Number(o.total), 0)
    const balancePendiente = orders.reduce((sum, o) => sum + Number(o.balance || 0), 0)
    setStats({ nuevos, enProceso, despachados, ventasMes, balancePendiente })
  }

  const cards = [
    { label: 'Pedidos nuevos', value: stats.nuevos },
    { label: 'En proceso', value: stats.enProceso },
    { label: 'Despachados / en entrega', value: stats.despachados },
    { label: 'Ventas del mes', value: formatMoney(stats.ventasMes) },
    { label: 'Balance pendiente total', value: formatMoney(stats.balancePendiente) },
  ]

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-grafondo mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-5">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-petroleo">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
