import { Plus } from 'lucide-react'
import { formatMoney } from '../utils/format'

export default function ProductCard({ product, onAdd }) {
  const agotado = !product.disponible
  return (
    <div className={`rounded-2xl overflow-hidden flex flex-col ${agotado ? 'bg-white border border-gray-200' : 'tarjeta-keraven'}`}>
      <div className="relative aspect-square bg-cremaoscura flex items-center justify-center overflow-hidden">
        {product.foto_url
          ? <img src={product.foto_url} alt={product.nombre} className={`w-full h-full object-cover ${agotado ? 'grayscale opacity-50' : ''}`} />
          : <span className="text-gray-300 text-sm">Sin foto</span>}
        {agotado && (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-negro/85 text-oro text-xs font-bold text-center py-1.5 tracking-widest">
            AGOTADO
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <h3 className={`font-semibold text-sm leading-tight ${agotado ? 'text-gray-400' : 'text-grafondo'}`}>{product.nombre}</h3>
        {product.descripcion && <p className="text-xs text-gray-500 line-clamp-2">{product.descripcion}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className={`font-bold ${agotado ? 'text-gray-400' : 'text-negro'}`}>{formatMoney(product.precio)}</span>
          <button
            onClick={() => onAdd(product)}
            disabled={agotado}
            className="bg-negro disabled:bg-gray-300 text-oro disabled:text-white rounded-full p-2 active:scale-95 transition"
            aria-label={agotado ? 'Agotado' : 'Agregar al carrito'}
          >
            <Plus size={16} />
          </button>
        </div>
        {agotado && (
          <span className="text-xs text-gray-500 leading-snug">
            Producto agotado. Ponerse en contacto con su suplidor.
          </span>
        )}
      </div>
    </div>
  )
}
