import { NavLink } from 'react-router-dom'
import { Home, ShoppingBag, Receipt, User } from 'lucide-react'

const items = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/catalogo', icon: ShoppingBag, label: 'Pedido' },
  { to: '/mis-pedidos', icon: Receipt, label: 'Pedidos' },
  { to: '/perfil', icon: User, label: 'Perfil' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 md:hidden z-40">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-3 py-1 text-xs ${
              isActive ? 'text-petroleo font-semibold' : 'text-gray-400'
            }`
          }
        >
          <Icon size={22} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
