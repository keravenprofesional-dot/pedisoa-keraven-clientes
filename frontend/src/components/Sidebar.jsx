import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, Users, ShoppingCart, Truck, Settings, LogOut } from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'

const items = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/pedidos', icon: ShoppingCart, label: 'Pedidos' },
  { to: '/admin/despacho', icon: Truck, label: 'Despacho' },
  { to: '/admin/productos', icon: Package, label: 'Productos' },
  { to: '/admin/clientes', icon: Users, label: 'Clientes' },
  { to: '/admin/configuracion', icon: Settings, label: 'Configuración' },
]

export default function Sidebar() {
  const { signOut } = useAuth()
  return (
    <aside className="hidden md:flex flex-col w-64 bg-petroleo text-white min-h-screen p-6 fixed">
      <div className="mb-10">
        <Logo size="sm" />
      </div>
      <nav className="flex-1 space-y-1">
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                isActive ? 'bg-dorado text-petroleo font-semibold' : 'hover:bg-white/10'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={signOut}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-white/10 mt-auto"
      >
        <LogOut size={18} /> Cerrar sesión
      </button>
    </aside>
  )
}
