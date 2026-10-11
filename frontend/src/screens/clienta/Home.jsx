import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Package, Receipt, CreditCard, User, Phone, Instagram } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'
import logo from '../../assets/logo.jpg'

// Cada tarjeta lleva a un sitio distinto. La última no es una pantalla:
// marca el teléfono de Keraven.
const opciones = [
  { to: '/catalogo', icon: ShoppingBag, label: 'Realizar pedido', sub: 'Catálogo completo', destacado: true },
  { to: '/mis-pedidos', icon: Package, label: 'Mis pedidos', sub: 'Historial' },
  { to: '/mis-recibos', icon: Receipt, label: 'Mis recibos', sub: 'Comprobantes' },
  { to: '/mis-pagos', icon: CreditCard, label: 'Mis pagos', sub: 'Balance y abonos' },
  { to: '/perfil', icon: User, label: 'Mi perfil', sub: 'Mis datos' },
  { icon: Phone, label: 'Contactar', sub: 'Hablar con Keraven', llamar: true },
]

export default function Home() {
  const { client } = useAuth()
  const debe = Number(client?.balance_pendiente || 0)
  const nombre = client?.full_name?.split(' ')[0]
  const [instagram, setInstagram] = useState('')
  const [telefono, setTelefono] = useState('')

  useEffect(() => {
    supabase.from('company_settings').select('instagram, whatsapp, telefono').maybeSingle()
      .then(({ data }) => {
        setInstagram(data?.instagram || '')
        setTelefono(String(data?.whatsapp || data?.telefono || '').replace(/[^\d+]/g, ''))
      })
  }, [])

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 md:pb-10">
      {/* Portada de revista: el logo ya está arriba en la barra, así que aquí
          se abre con tipografía, no repitiéndolo. */}
      <header className="pt-7 pb-7">
        {/* El logo vive aquí, grande y visible. La placa negra va ceñida al
            logo, no de lado a lado: una franja negra ancha no la quiere nadie. */}
        <div className="mb-6 inline-block rounded-2xl bg-negro px-5 py-3 ring-1 ring-oro/35">
          <img src={logo} alt="Keraven Profesional" className="h-20 w-auto object-contain md:h-24" />
        </div>
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.5em] text-oroprof">
          Keraven&nbsp;Profesional
        </p>
        <h1 className="mt-3 font-display text-[38px] leading-[0.96] tracking-[-0.015em] text-negro md:text-[52px]">
          {saludo},<br />
          <span className="italic text-oroprof">{nombre || 'bienvenido'}</span>
        </h1>
        <div className="mt-5 flex items-center gap-3">
          <span className="h-px w-16 bg-gradient-to-r from-oro to-transparent" />
          <span className="font-sans text-[10px] uppercase tracking-[0.34em] text-negro/40">La colección</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-oro/25" />
        </div>
        {debe > 0 && (
          <div className="mt-6 border-l-2 border-oro bg-white/55 px-4 py-2.5">
            <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-negro/45">Balance pendiente</p>
            <p className="font-display text-[20px] tabular-nums text-negro">{formatMoney(debe)}</p>
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3">
        {opciones.map(({ to, icon: Icono, label, sub, destacado, llamar }, i) => {
          // La de contactar marca el teléfono; las demás son pantallas.
          const Caja = llamar ? 'a' : Link
          const props = llamar ? { href: telefono ? `tel:${telefono}` : undefined } : { to }
          return (
          <Caja
            key={i}
            {...props}
            className={`destello group relative flex flex-col justify-between rounded-[20px] bg-white/85 px-4 py-4 ring-1 ring-oro/25 transition hover:ring-oro/60 active:scale-[0.99] ${
              destacado
                ? 'col-span-2 min-h-[132px] bg-gradient-to-br from-white via-crema to-cremaoscura px-6 py-6 ring-oro/55'
                : 'min-h-[118px]'
            }`}
          >
            <span aria-hidden className="absolute right-4 top-3.5 font-display text-[11px] tabular-nums text-oro/55">
              {String(i + 1).padStart(2, '0')}
            </span>
            <Icono size={destacado ? 24 : 19} strokeWidth={1.2} className="text-oroprof" />
            <div>
              <p className={`font-display leading-[1.1] text-negro ${destacado ? 'text-[26px]' : 'text-[17px]'}`}>
                {label}
              </p>
              <p className={`mt-1 font-sans uppercase text-negro/40 ${
                destacado ? 'text-[11px] tracking-[0.26em]' : 'text-[10px] tracking-[0.18em]'
              }`}>
                {sub}
              </p>
            </div>
            {destacado && (
              <span className="absolute bottom-5 right-5 grid h-11 w-11 place-items-center rounded-full bg-negro text-orosuave">
                <ShoppingBag size={17} strokeWidth={1.5} />
              </span>
            )}
          </Caja>
          )
        })}
      </div>

      {instagram && (
        <div className="mt-10">
          <div className="filo-oro opacity-50" />
          <a
            href={instagram}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2.5 py-5 font-sans text-[11px] uppercase tracking-[0.34em] text-negro/45 hover:text-oroprof"
          >
            <Instagram size={15} strokeWidth={1.4} /> Síguenos
          </a>
        </div>
      )}
    </div>
  )
}
