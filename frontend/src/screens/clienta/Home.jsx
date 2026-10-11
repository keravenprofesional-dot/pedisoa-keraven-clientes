import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Package, Receipt, CreditCard, User, Phone, Instagram } from 'lucide-react'
import Logo from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'

const opciones = [
  { to: '/catalogo', icon: ShoppingBag, label: 'Realizar pedido', destacado: true },
  { to: '/mis-pedidos', icon: Package, label: 'Mis pedidos' },
  { to: '/mis-pedidos', icon: Receipt, label: 'Mis recibos' },
  { to: '/perfil', icon: CreditCard, label: 'Mis pagos' },
  { to: '/perfil', icon: User, label: 'Mi perfil' },
  { to: '/perfil', icon: Phone, label: 'Contactar a Keraven' },
]

export default function Home() {
  const { client } = useAuth()
  const debe = Number(client?.balance_pendiente || 0)
  const [instagram, setInstagram] = useState('')

  useEffect(() => {
    supabase.from('company_settings').select('instagram').maybeSingle()
      .then(({ data }) => setInstagram(data?.instagram || ''))
  }, [])

  return (
    <div className="px-5 pb-28 md:pb-10 max-w-2xl mx-auto">
      {/* Sin franjas negras: el logo se posa sobre el fondo claro */}
      <header className="text-center pt-8 pb-6">
        <Logo size="lg" />
        <p className="mt-4 text-[11px] tracking-[0.45em] text-negro/50 uppercase">Profesional</p>
        <div className="mx-auto mt-4 flex items-center justify-center gap-3">
          <span className="h-px w-14 bg-gradient-to-r from-transparent to-oro/70" />
          <span className="text-oro text-[9px]">◆</span>
          <span className="h-px w-14 bg-gradient-to-l from-transparent to-oro/70" />
        </div>
        <p className="font-display italic text-negro/55 mt-4">¿Qué deseas hacer hoy?</p>
        {debe > 0 && (
          <p className="text-sm text-gray-600 mt-3">
            Balance pendiente <span className="font-semibold text-red-600">{formatMoney(debe)}</span>
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3.5">
        {opciones.map(({ to, icon: Icono, label, destacado }, i) => (
          <Link
            key={i}
            to={to}
            className={`tarjeta-keraven rounded-2xl flex flex-col items-center justify-center gap-3 py-7 active:scale-[0.99] transition ${
              destacado ? 'col-span-2 !border-oro/60' : ''
            }`}
          >
            <Icono size={destacado ? 28 : 24} className="text-oro" strokeWidth={1.3} />
            <span className={`font-display text-center text-negro/85 ${destacado ? 'text-lg' : 'text-[15px]'}`}>
              {label}
            </span>
          </Link>
        ))}
      </div>

      {instagram && (
        <a
          href={instagram}
          target="_blank"
          rel="noreferrer"
          className="mt-8 flex items-center justify-center gap-2 text-xs tracking-[0.25em] uppercase text-negro/45 hover:text-negro py-3"
        >
          <Instagram size={16} strokeWidth={1.4} /> Síguenos
        </a>
      )}
    </div>
  )
}
