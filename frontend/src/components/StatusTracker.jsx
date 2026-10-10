import { Check } from 'lucide-react'
import { STATUS_LABELS, STATUS_ORDER } from '../utils/format'

export default function StatusTracker({ status }) {
  if (status === 'cancelado') {
    return <div className="text-red-500 font-semibold">Pedido cancelado</div>
  }
  const currentIndex = STATUS_ORDER.indexOf(status)

  return (
    <div className="flex flex-col gap-0">
      {STATUS_ORDER.map((s, idx) => {
        const done = idx <= currentIndex
        const isLast = idx === STATUS_ORDER.length - 1
        return (
          <div key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
                  done ? 'bg-dorado' : 'bg-gray-200'
                }`}
              >
                {done && <Check size={14} />}
              </div>
              {!isLast && <div className={`w-0.5 flex-1 min-h-[24px] ${done ? 'bg-dorado' : 'bg-gray-200'}`} />}
            </div>
            <div className={`pb-6 text-sm ${done ? 'text-grafondo font-semibold' : 'text-gray-400'}`}>
              {STATUS_LABELS[s]}
            </div>
          </div>
        )
      })}
    </div>
  )
}
