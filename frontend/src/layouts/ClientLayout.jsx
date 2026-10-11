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
      {/* Franja negra con lo de la clienta a la derecha, legible */}
      <header className="sticky top-0 z-30 bg-negro text-crema">
        <div className="flex items-start justify-between gap-3 px-4 py-2.5">
          <BotonVolver className="text-orosuave mt-1" />
          <div className="ml-auto text-right leading-tight">
            <button
              onClick={salir}
              className="inline-flex items-center gap-1.5 text-[15px] font-medium text-crema hover:text-oro"
            >
              <LogOut size={17} strokeWidth={1.6} /> Salir
            </button>
            {nombre && <p className="font-display text-oro text-[15px] mt-0.5">Hola, {nombre}</p>}
            {client?.client_number && (
              <p className="text-[11px] text-crema/55 mt-0.5">
                Tu código de clienta: <span className="text-crema/80">{client.client_number}</span>
              </p>
            )}
          </div>
        </div>
        <div className="h-px borde-oro" />
      </header>

      <Outlet />
      <MusicaFondo />
      <BottomNav />
    </div>
  )
}
