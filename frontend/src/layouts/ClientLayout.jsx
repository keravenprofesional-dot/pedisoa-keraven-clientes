import { Outlet, Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import BotonVolver from '../components/BotonVolver'
import MusicaFondo from '../components/MusicaFondo'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.jpg'

export default function ClientLayout() {
  const { client, signOut } = useAuth()
  const nombre = client?.full_name?.split(' ')[0]

  function salir() {
    if (confirm('¿Cerrar sesión? Tendrás que entrar otra vez con tu código.')) signOut()
  }

  return (
    <div className="min-h-screen fondo-keraven">
      <header className="sticky top-0 z-30">
        <div className="bg-crema/92 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2.5 px-4">
            {/* El logo a la izquierda, como lo quiso Keraven. La placa negra
                recoge el fondo negro del archivo: así se ve a propósito. */}
            <Link to="/" className="shrink-0 rounded-[9px] bg-negro px-2 py-1 ring-1 ring-oro/35">
              <img src={logo} alt="Keraven Profesional" className="h-8 w-auto object-contain" />
            </Link>
            <span className="hidden h-5 w-px bg-oro/30 sm:block" />
            <span className="hidden font-sans text-[10px] uppercase tracking-[0.42em] text-negro/45 sm:block">
              Profesional
            </span>

            <div className="ml-auto flex items-center gap-2">
              <BotonVolver className="h-8 rounded-full border border-negro/12 bg-white/60 px-3 text-[12px] text-negro/65" />
              {nombre && (
                <div className="hidden text-right leading-tight sm:block">
                  <p className="font-display text-[15px] text-negro">{nombre}</p>
                  {client?.client_number && (
                    <p className="font-sans text-[10px] uppercase tracking-[0.18em] tabular-nums text-negro/35">
                      N.º {client.client_number}
                    </p>
                  )}
                </div>
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
      <MusicaFondo />
      <BottomNav />
    </div>
  )
}
