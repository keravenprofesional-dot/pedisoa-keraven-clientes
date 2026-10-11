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
    <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="filo-oro" />
      {/* El padding de abajo respeta la barra del sistema del iPhone cuando
          la app está instalada; si no, el menú queda tapado. */}
      <div className="bg-crema/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="grid grid-cols-4">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className="flex flex-col items-center gap-1 py-0.5">
              {({ isActive }) => (
                <>
                  <span className={`grid h-9 w-9 place-items-center rounded-full transition ${
                    isActive ? 'bg-negro text-orosuave' : 'text-negro/45'
                  }`}>
                    <Icon size={18} strokeWidth={isActive ? 1.7 : 1.4} />
                  </span>
                  <span className={`font-sans text-[11px] tracking-[0.06em] ${
                    isActive ? 'font-medium text-negro' : 'text-negro/45'
                  }`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
