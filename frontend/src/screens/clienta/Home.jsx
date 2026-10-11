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
    <div className="pb-28 md:pb-10">
      {/* Portada: el logo grande, como en una vitrina */}
      <div className="bg-negro text-crema text-center px-6 pt-10 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(520px_280px_at_50%_0%,rgba(212,164,49,.20),transparent_72%)]" />
        <div className="relative">
          <Logo size="xl" />
          <p className="mt-5 text-[11px] tracking-[0.5em] text-oro uppercase">Profesional</p>
          <div className="mx-auto mt-6 flex items-center justify-center gap-3">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-oro/70" />
            <span className="text-oro text-[10px]">◆</span>
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-oro/70" />
          </div>
          <p className="font-display italic text-crema/70 mt-5 text-lg">¿Qué deseas hacer hoy?</p>
        </div>
      </div>
      <div className="h-px borde-oro" />

      <div className="px-5 pt-7 max-w-2xl mx-auto">
        {debe > 0 && (
          <p className="text-center text-sm text-gray-600 mb-5">
            Balance pendiente <span className="font-semibold text-red-600">{formatMoney(debe)}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-3.5">
          {opciones.map(({ to, icon: Icono, label, destacado }, i) => (
            <Link
              key={i}
              to={to}
              className={`rounded-2xl flex flex-col items-center justify-center gap-3 active:scale-[0.99] transition ${
                destacado
                  ? 'col-span-2 bg-negro text-crema py-7 border border-oro/40 shadow-lg'
                  : 'tarjeta-keraven py-7'
              }`}
            >
              <Icono size={destacado ? 28 : 24} className={destacado ? 'text-oro' : 'text-oro/85'} strokeWidth={1.3} />
              <span className={`font-display text-center ${destacado ? 'text-lg text-crema' : 'text-[15px] text-negro/85'}`}>
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
    </div>
  )
}
