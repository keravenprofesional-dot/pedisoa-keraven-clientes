import { CalendarCheck, Clock3, Truck } from 'lucide-react'

// Política de envíos de Keraven Profesional (pedida por el dueño el 18 oct 2026):
// los envíos salen los SÁBADOS, en el orden en que llegaron los pedidos; el
// MIÉRCOLES es el último día para pedir y salir esa misma semana; el plazo de
// entrega es de hasta 7 días.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Sábado en que sale un pedido hecho en `fecha`: de domingo a miércoles, ese mismo
// sábado; de jueves a sábado, el sábado de la semana siguiente.
export function sabadoDeEnvio(fecha = new Date()) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const dia = d.getDay()
  const hastaSabado = dia <= 3 ? 6 - dia : 13 - dia
  d.setDate(d.getDate() + hastaSabado)
  return d
}

const fechaBonita = (d) => {
  const t = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
  return t[0].toUpperCase() + t.slice(1)
}

export default function PoliticaEnvios({ fechaPedido = new Date(), compacta = false }) {
  const sale = sabadoDeEnvio(fechaPedido)
  const puntos = [
    { Icono: Truck, titulo: 'Día de envío', texto: 'Los envíos se realizan los sábados, de acuerdo con el orden de llegada de los pedidos.' },
    { Icono: CalendarCheck, titulo: 'Fecha límite', texto: 'El miércoles es el último día para hacer tu pedido y que salga en el envío de esa misma semana.' },
    { Icono: Clock3, titulo: 'Plazo de entrega', texto: 'Los pedidos se despachan en un plazo de hasta 7 días, siempre en sábado.' },
  ]

  return (
    <section className="overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-oro/30">
      <div className="bg-negro px-5 py-3.5">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.32em] text-orosuave">Keraven Profesional</p>
        <h2 className="font-display text-[19px] text-white">Política de envíos</h2>
      </div>
      <div className="filo-oro" />

      <div className="border-b border-oro/20 bg-crema px-5 py-4">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.24em] text-oroprof">
          {compacta ? 'Si confirmas hoy, tu pedido sale el' : 'Tu pedido sale en el envío del'}
        </p>
        <p className="font-display text-[22px] leading-tight text-negro">{fechaBonita(sale)}</p>
      </div>

      {!compacta && (
        <ul className="divide-y divide-negro/5 px-5">
          {puntos.map(({ Icono, titulo, texto }) => (
            <li key={titulo} className="flex gap-3 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-crema ring-1 ring-oro/30">
                <Icono size={15} strokeWidth={1.6} className="text-oroprof" />
              </span>
              <div>
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-negro">{titulo}</p>
                <p className="font-sans text-[13px] leading-relaxed text-negro/65">{texto}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {compacta && (
        <p className="px-5 py-3 font-sans text-[12.5px] leading-relaxed text-negro/60">
          Los envíos salen los sábados por orden de llegada. El miércoles es el último día para que tu pedido salga esa misma semana.
        </p>
      )}
    </section>
  )
}
