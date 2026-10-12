import { Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import BotonVolver from '../components/BotonVolver'
import { MusicaProvider, BotonMusica } from '../components/MusicaFondo'
import { useAuth } from '../context/AuthContext'

export default function ClientLayout() {
  const { client, signOut } = useAuth()

  function salir() {
    if (confirm('¿Cerrar sesión? Tendrás que entrar otra vez con tu código.')) signOut()
  }

  return (
    <MusicaProvider>
    <div className="min-h-screen fondo-keraven">
      <header className="sticky top-0 z-30">
        <div className="bg-crema/92 backdrop-blur-md">
          {/* La barra va vacía a propósito: el logo y el nombre están abajo,
              en grande. Aquí arriba no se repite nada. */}
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2.5 px-4">
            <div className="ml-auto flex items-center gap-2">
              <BotonVolver className="h-8 rounded-full border border-negro/12 bg-white/60 px-3 text-[12px] text-negro/65" />
              {client?.client_number && (
                <p className="hidden font-sans text-[10px] uppercase tracking-[0.18em] tabular-nums text-negro/35 sm:block">
                  N.º {client.client_number}
                </p>
              )}
              <button
                onClick={salir}
                aria-label="Cerrar sesión"
                className="grid h-8 w-8 place-items-center rounded-full border border-negro/12 text-negro/50 transition hover:border-oro/50 hover:text-negro"
              >
                <LogOut size={15} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
        <div className="filo-oro" />
      </header>

      <Outlet />
      {/* En el celular la música vive dentro de la barra de abajo, entre
          Pedidos y Perfil. En pantalla grande no hay barra, así que ahí se
          queda la burbuja. */}
      <BotonMusica className="hidden md:grid" />
      <BottomNav />
    </div>
    </MusicaProvider>
  )
}
