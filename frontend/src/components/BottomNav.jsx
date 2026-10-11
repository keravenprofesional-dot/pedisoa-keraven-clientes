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
    <nav className="fixed bottom-0 left-0 right-0 bg-crema/95 backdrop-blur border-t border-oro/30 flex justify-around pt-1.5 pb-2 md:hidden z-40">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 pt-1 pb-0.5 text-xs transition ${
              isActive ? 'text-negro font-semibold' : 'text-negro/40'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={21} strokeWidth={isActive ? 1.9 : 1.4} className={isActive ? 'text-oro' : ''} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
