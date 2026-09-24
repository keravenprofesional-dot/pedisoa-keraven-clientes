import { Plus } from 'lucide-react'
import { formatMoney } from '../utils/format'

export default function ProductCard({ product, onAdd }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className="aspect-square bg-graclaro flex items-center justify-center overflow-hidden">
        {product.foto_url ? (
          <img src={product.foto_url} alt={product.nombre} className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-300 text-sm">Sin foto</span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <h3 className="font-semibold text-grafondo text-sm leading-tight">{product.nombre}</h3>
        {product.descripcion && (
          <p className="text-xs text-gray-500 line-clamp-2">{product.descripcion}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-bold text-petroleo">{formatMoney(product.precio)}</span>
          <button
            onClick={() => onAdd(product)}
            disabled={!product.disponible}
            className="bg-petroleo disabled:bg-gray-300 text-white rounded-full p-2 active:scale-95 transition"
            aria-label="Agregar"
          >
            <Plus size={16} />
          </button>
        </div>
        {!product.disponible && (
          <span className="text-xs text-red-500 font-medium">Agotado</span>
        )}
      </div>
    </div>
  )
}
