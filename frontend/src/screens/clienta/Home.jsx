import { Link } from 'react-router-dom'
import { ShoppingBag, Package, Receipt, CreditCard, User, Phone } from 'lucide-react'
import Logo from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
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

  return (
    <div className="pb-28 md:pb-10">
      {/* Portada negra con el logo dorado, como la marca */}
      <div className="bg-negro text-crema px-6 pt-8 pb-14 text-center relative">
        <div className="inline-block bg-negro rounded-2xl p-1 mb-3"><Logo size="lg" /></div>
        <p className="text-[11px] tracking-[0.35em] text-oro/80 uppercase">Keraven Profesional</p>
        <h1 className="text-2xl font-bold mt-3">
          Hola{client?.full_name ? `, ${client.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-crema/60 text-sm mt-1">¿Qué deseas hacer hoy?</p>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] borde-oro" />
      </div>

      <div className="px-5 -mt-8 max-w-2xl mx-auto">
        {/* Solo el balance: el número de cliente ya está arriba, al lado de Salir */}
        <div className="tarjeta-keraven rounded-full px-4 py-2 mb-5 mx-auto w-fit flex items-center gap-2 text-sm">
          <span className="text-gray-500">Balance</span>
          <span className={`font-bold ${debe > 0 ? 'text-red-600' : 'text-green-700'}`}>
            {debe > 0 ? formatMoney(debe) : 'Al día'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {opciones.map(({ to, icon: Icono, label, destacado }, i) => (
            <Link
              key={i}
              to={to}
              className={`rounded-2xl p-5 flex flex-col items-center gap-3 active:scale-[0.98] transition ${
                destacado
                  ? 'col-span-2 bg-negro text-crema border border-oro/40 shadow-lg'
                  : 'tarjeta-keraven'
              }`}
            >
              <div className={`p-3 rounded-full ${destacado ? 'bg-oro text-negro' : 'bg-oro/12 text-oro'}`}>
                <Icono size={24} />
              </div>
              <span className={`text-sm font-semibold text-center ${destacado ? 'text-crema' : 'text-grafondo'}`}>
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
