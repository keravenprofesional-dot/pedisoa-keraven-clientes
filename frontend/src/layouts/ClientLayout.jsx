import { Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import BotonVolver from '../components/BotonVolver'
import MusicaFondo from '../components/MusicaFondo'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

export default function ClientLayout() {
  const { client, signOut } = useAuth()

  function salir() {
    if (confirm('¿Cerrar sesión? Tendrás que entrar otra vez con tu código.')) signOut()
  }

  return (
    <div className="min-h-screen fondo-keraven">
      {/* Barra negra con el dorado del logo */}
      <header className="sticky top-0 z-30 bg-negro text-crema">
        <div className="flex items-center gap-3 px-3 py-2">
          <BotonVolver className="text-orosuave" />
          <Logo size="sm" />
          <span className="font-bold tracking-wide text-orosuave">Pedidos Keraven</span>
          <span className="flex-1" />
          <span className="text-xs text-crema/60">{client?.client_number}</span>
          <button
            onClick={salir}
            className="flex items-center gap-1 text-sm text-crema/70 hover:text-orosuave px-2 py-1"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
        <div className="h-[3px] borde-oro" />
      </header>

      <Outlet />
      <MusicaFondo />
      <BottomNav />
    </div>
  )
}
