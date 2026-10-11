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
    <nav className="fixed bottom-0 left-0 right-0 bg-negro flex justify-around pt-1 pb-2 md:hidden z-40 shadow-[0_-6px_20px_-12px_rgba(0,0,0,.6)]">
      <div className="absolute top-0 left-0 right-0 h-[2px] borde-oro" />
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 pt-2 pb-1 text-xs transition ${
              isActive ? 'text-oro font-semibold' : 'text-crema/45'
            }`
          }
        >
          <Icon size={21} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
