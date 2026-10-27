import { formatMoney } from '../utils/format'

// Lo que debe una clienta o un pedido, resaltado en rojo y más grande para
// que el personal lo vea de una vez. Si no debe nada, no se muestra.
export default function Debe({ monto, texto = 'Debe', className = '' }) {
  if (!(Number(monto) > 0)) return null
  return (
    <span className={`inline-block whitespace-nowrap rounded-md bg-red-50 px-2 py-0.5 text-base font-bold tabular-nums text-red-600 ring-1 ring-red-300 ${className}`}>
      {texto} {formatMoney(monto)}
    </span>
  )
}
