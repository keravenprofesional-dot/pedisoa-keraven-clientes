import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'
import { useNovedades, Punto } from '../../utils/novedades'

// Lo nuevo por ver: cada línea lleva a su pantalla y, al abrirla, se pone en cero.
const POR_VER = [
  ['pedidos', '/admin/pedidos', 'Pedidos nuevos'],
  ['pagos', '/admin/pagos', 'Pagos reportados'],
  ['solicitudes', '/admin/solicitudes', 'Solicitudes de clientes'],
  ['estadisticas', '/admin/estadisticas', 'Visitas de clientas'],
]

export default function Dashboard() {
  const nuevas = useNovedades()
  const porVer = POR_VER.filter(([k]) => Number(nuevas[k]) > 0)
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
      {porVer.length > 0 && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <p className="mb-2 text-sm font-semibold text-red-700">Por ver</p>
          <div className="flex flex-wrap gap-2">
            {porVer.map(([k, to, texto]) => (
              <Link key={k} to={to} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-grafondo ring-1 ring-red-200 hover:ring-red-400">
                <Punto n={Number(nuevas[k])} /> {texto}
              </Link>
            ))}
          </div>
        </div>
      )}
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
