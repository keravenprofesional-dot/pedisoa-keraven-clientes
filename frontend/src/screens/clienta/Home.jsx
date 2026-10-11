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
      {/* Encabezado fino, con aire: el logo pequeño, un filito dorado y el
          saludo en serif, como la portada de una revista. */}
      <header className="text-center pt-8 pb-7">
        <div className="inline-block rounded-xl overflow-hidden"><Logo size="sm" /></div>
        <p className="mt-3 text-[10px] tracking-[0.42em] text-negro/45 uppercase">Keraven Profesional</p>
        <div className="mx-auto mt-4 mb-5 h-px w-20 bg-gradient-to-r from-transparent via-oro to-transparent" />
        <h1 className="font-display text-[2rem] leading-none text-negro">
          Hola{client?.full_name ? `, ${client.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="font-display italic text-gray-500 mt-2">¿Qué deseas hacer hoy?</p>
        {debe > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            Balance pendiente <span className="font-semibold text-red-600">{formatMoney(debe)}</span>
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3">
        {opciones.map(({ to, icon: Icono, label, destacado }, i) => (
          <Link
            key={i}
            to={to}
            className={`rounded-2xl flex flex-col items-center justify-center gap-2.5 active:scale-[0.99] transition ${
              destacado
                ? 'col-span-2 bg-negro text-crema py-6 border border-oro/35'
                : 'bg-white/80 border border-oro/20 py-6 hover:border-oro/55'
            }`}
          >
            <Icono size={destacado ? 24 : 20} className={destacado ? 'text-oro' : 'text-oro/80'} strokeWidth={1.4} />
            <span className={`font-display text-center ${destacado ? 'text-base text-crema' : 'text-sm text-negro/85'}`}>
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
          className="mt-8 flex items-center justify-center gap-2 text-xs tracking-[0.2em] uppercase text-negro/45 hover:text-negro py-3"
        >
          <Instagram size={15} strokeWidth={1.4} /> Síguenos
        </a>
      )}
    </div>
  )
}
