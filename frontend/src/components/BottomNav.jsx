import { NavLink } from 'react-router-dom'
import { Home, ShoppingBag, Receipt, User } from 'lucide-react'
import { BotonMusica } from './MusicaFondo'

// "Pedido" y "Pedidos" se parecían demasiado y el cliente podía tocar el
// equivocado. Ahora se llaman "Comprar" y "Mis pedidos": se distinguen de
// un golpe de vista. "Realizar pedido" sería más claro todavía, pero en un
// celular cada botón tiene unos 75 px y no cabe en una línea.
//
// La música va en el medio, entre Mis pedidos y Perfil, como lo pidió Keraven.
const items = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/catalogo', icon: ShoppingBag, label: 'Comprar' },
  { to: '/mis-pedidos', icon: Receipt, label: 'Mis pedidos' },
  { musica: true },
  { to: '/perfil', icon: User, label: 'Perfil' },
]

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="filo-oro" />
      {/* El padding de abajo respeta la barra del sistema del iPhone cuando
          la app está instalada; si no, el menú queda tapado. */}
      <div className="bg-crema/95 px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="grid grid-cols-5">
          {items.map(({ to, icon: Icon, label, musica }) => musica ? (
            <BotonMusica key="musica" variante="nav" />
          ) : (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="flex min-w-0 flex-col items-center gap-1 py-0.5"
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-9 w-9 place-items-center rounded-full transition ${
                    isActive ? 'bg-negro text-orosuave' : 'text-negro/45'
                  }`}>
                    <Icon size={18} strokeWidth={isActive ? 1.7 : 1.4} />
                  </span>
                  <span className={`w-full truncate text-center font-sans text-[10px] leading-tight ${
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
