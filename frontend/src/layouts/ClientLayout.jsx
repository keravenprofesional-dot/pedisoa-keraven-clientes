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
      {/* Barra fina y discreta: deja respirar la página */}
      <header className="sticky top-0 z-30 bg-negro text-crema">
        <div className="flex items-center gap-2 px-3 h-11">
          <BotonVolver className="text-orosuave" />
          <span className="font-display text-sm tracking-[0.18em] text-orosuave uppercase">Keraven</span>
          <span className="flex-1" />
          <span className="text-[11px] tracking-wider text-crema/40">{client?.client_number}</span>
          <button
            onClick={salir}
            className="flex items-center gap-1 text-xs text-crema/60 hover:text-orosuave px-2 py-1"
            title="Cerrar sesión"
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
        <div className="h-px borde-oro" />
      </header>

      <Outlet />
      <MusicaFondo />
      <BottomNav />
    </div>
  )
}
