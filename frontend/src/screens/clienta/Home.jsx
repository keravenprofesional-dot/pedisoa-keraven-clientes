import { Link } from 'react-router-dom'
import { ShoppingBag, Package, Receipt, CreditCard, User, Phone } from 'lucide-react'
import Logo from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'

const options = [
  { to: '/catalogo', icon: ShoppingBag, label: 'Realizar pedido' },
  { to: '/mis-pedidos', icon: Package, label: 'Mis pedidos' },
  { to: '/mis-pedidos', icon: Receipt, label: 'Mis recibos' },
  { to: '/perfil', icon: CreditCard, label: 'Mis pagos' },
  { to: '/perfil', icon: User, label: 'Mi perfil' },
  { to: '/perfil', icon: Phone, label: 'Contactar a Keraven' },
]

export default function Home() {
  const { client } = useAuth()
  return (
    <div className="p-6 pb-24 md:pb-6 max-w-2xl mx-auto">
      <div className="flex justify-center mb-6"><Logo /></div>
      <h1 className="text-xl font-bold text-grafondo mb-1">
        Bienvenida{client?.full_name ? `, ${client.full_name.split(' ')[0]}` : ''}
      </h1>
      <p className="text-gray-500 mb-6">¿Qué deseas hacer hoy?</p>

      <div className="grid grid-cols-2 gap-4">
        {options.map(({ to, icon: Icon, label }, idx) => (
          <Link
            key={idx}
            to={to}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col items-center gap-3 hover:border-dorado transition"
          >
            <div className="bg-petroleo/10 text-petroleo p-3 rounded-full">
              <Icon size={24} />
            </div>
            <span className="text-sm font-semibold text-grafondo text-center">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
