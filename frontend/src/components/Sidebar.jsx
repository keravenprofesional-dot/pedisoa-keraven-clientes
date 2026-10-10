import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'
import { MENU_ADMIN, puedeVer } from '../utils/menuAdmin'

function Enlaces({ alElegir }) {
  const auth = useAuth()
  return MENU_ADMIN.filter((i) => puedeVer(i, auth)).map(({ to, icon: Icon, label }) => (
    <NavLink
      key={to}
      to={to}
      onClick={alElegir}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
          isActive ? 'bg-dorado text-petroleo font-semibold' : 'hover:bg-white/10'
        }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  ))
}

function Pie() {
  const { profile, esSupremo, signOut } = useAuth()
  return (
    <div className="mt-auto pt-4 border-t border-white/10">
      <p className="text-sm font-semibold truncate">{profile?.full_name}</p>
      <p className="text-xs text-white/60 mb-3">{esSupremo ? 'Supremo usuario' : profile?.usuario}</p>
      <button onClick={signOut} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-white/10 w-full">
        <LogOut size={18} /> Cerrar sesión
      </button>
    </div>
  )
}

// Escritorio: barra lateral fija. Celular: barra superior con botón de menú
// (antes el menú no existía en pantallas pequeñas).
export default function Sidebar() {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <aside className="hidden md:flex flex-col w-64 bg-petroleo text-white min-h-screen p-6 fixed">
        <div className="mb-10 bg-white rounded-xl p-2 flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-petroleo font-bold leading-tight text-sm">Pedidos<br />Keraven</span>
        </div>
        <nav className="flex-1 space-y-1"><Enlaces /></nav>
        <Pie />
      </aside>

      <header className="md:hidden sticky top-0 z-40 bg-petroleo text-white flex items-center justify-between px-4 py-3">
        <button onClick={() => setAbierto(true)} aria-label="Abrir menú"><Menu size={24} /></button>
        <span className="font-semibold">Pedidos Keraven</span>
        <span className="w-6" />
      </header>

      {abierto && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-72 max-w-[85%] bg-petroleo text-white p-5 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-white rounded-xl p-2 flex items-center gap-2">
                <Logo size="sm" />
                <span className="text-petroleo font-bold leading-tight text-sm">Pedidos<br />Keraven</span>
              </div>
              <button onClick={() => setAbierto(false)} aria-label="Cerrar menú"><X size={24} /></button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto"><Enlaces alElegir={() => setAbierto(false)} /></nav>
            <Pie />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setAbierto(false)} />
        </div>
      )}
    </>
  )
}
