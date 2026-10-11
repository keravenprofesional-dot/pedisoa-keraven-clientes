import { Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import BotonVolver from '../components/BotonVolver'
import MusicaFondo from '../components/MusicaFondo'
import { useAuth } from '../context/AuthContext'

export default function ClientLayout() {
  const { client, signOut } = useAuth()
  const nombre = client?.full_name?.split(' ')[0]

  function salir() {
    if (confirm('¿Cerrar sesión? Tendrás que entrar otra vez con tu código.')) signOut()
  }

  return (
    <div className="min-h-screen fondo-keraven">
      {/* Barra clara y delgada. Sin bloques negros: la página respira. */}
      <header className="sticky top-0 z-30 bg-crema/95 backdrop-blur border-b border-oro/30">
        <div className="flex items-center justify-between gap-3 px-4 h-12">
          <BotonVolver className="text-negro/70" />
          <div className="ml-auto flex items-center gap-4">
            {nombre && (
              <span className="font-display text-negro text-[15px]">Hola, {nombre}</span>
            )}
            <button
              onClick={salir}
              className="inline-flex items-center gap-1.5 text-sm text-negro/60 hover:text-negro"
            >
              <LogOut size={16} strokeWidth={1.6} /> Salir
            </button>
          </div>
        </div>
        {client?.client_number && (
          <p className="px-4 pb-1.5 text-right text-[11px] text-negro/40">
            Tu código de clienta: <span className="text-negro/70">{client.client_number}</span>
          </p>
        )}
      </header>

      <Outlet />
      <MusicaFondo />
      <BottomNav />
    </div>
  )
}
