import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'
import { Phone } from 'lucide-react'

export default function Profile() {
  const { client, signOut } = useAuth()
  // Teléfono de contacto que el personal pone en Configuración.
  const [contacto, setContacto] = useState('')
  useEffect(() => {
    supabase.from('company_settings').select('whatsapp, telefono').maybeSingle()
      .then(({ data }) => setContacto(String(data?.whatsapp || data?.telefono || '').replace(/[^\d+]/g, '')))
  }, [])

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-grafondo mb-4">Mi perfil</h1>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4 space-y-2 text-sm">
        <p><strong>Número de cliente:</strong> <span className="text-petroleo font-bold">{client?.client_number}</span></p>
        <p><strong>Nombre:</strong> {client?.full_name}</p>
        <p><strong>Correo:</strong> {client?.correo || '—'}</p>
        <p><strong>Dirección:</strong> {client?.direccion || '—'}</p>
        <p><strong>Sector:</strong> {client?.sector || '—'}</p>
        <p><strong>Ciudad:</strong> {client?.ciudad || '—'}</p>
        <p><strong>Condición de pago:</strong> <span className="capitalize">{client?.payment_condition}</span></p>
        <p>
          <strong>Balance pendiente:</strong>{' '}
          <span className={client?.balance_pendiente > 0 ? 'text-red-500 font-semibold' : ''}>
            {formatMoney(client?.balance_pendiente || 0)}
          </span>
        </p>
      </div>

      <a
        href={contacto ? `tel:${contacto}` : undefined}
        className="flex items-center justify-center gap-2 bg-graclaro rounded-xl py-3 font-semibold text-petroleo mb-4"
      >
        <Phone size={18} /> Contactar a Keraven
      </a>

      <button onClick={signOut} className="w-full text-red-500 font-semibold py-3">
        Cerrar sesión
      </button>
    </div>
  )
}
