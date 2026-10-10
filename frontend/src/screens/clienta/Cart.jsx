import { useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { formatMoney } from '../../utils/format'

export default function Cart() {
  const { items, updateQty, removeItem, subtotal } = useCart()
  const navigate = useNavigate()
  const envio = 0 // se calcula/edita en Checkout según método de entrega

  if (items.length === 0) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-gray-400 mb-4">Tu carrito está vacío.</p>
        <button onClick={() => navigate('/catalogo')} className="text-petroleo font-semibold">
          Ir al catálogo
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 pb-40 md:pb-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-grafondo mb-4">Carrito</h1>

      <div className="flex flex-col gap-3">
        {items.map(({ product, cantidad }) => (
          <div key={product.id} className="bg-white rounded-xl border border-gray-100 p-3 flex gap-3 items-center">
            <div className="w-16 h-16 bg-graclaro rounded-lg overflow-hidden flex-shrink-0">
              {product.foto_url && <img src={product.foto_url} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-grafondo truncate">{product.nombre}</p>
              <p className="text-petroleo font-bold text-sm">{formatMoney(product.precio)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => updateQty(product.id, cantidad - 1)} className="p-1.5 bg-graclaro rounded-full">
                <Minus size={14} />
              </button>
              <span className="w-6 text-center font-semibold">{cantidad}</span>
              <button onClick={() => updateQty(product.id, cantidad + 1)} className="p-1.5 bg-graclaro rounded-full">
                <Plus size={14} />
              </button>
            </div>
            <button onClick={() => removeItem(product.id)} className="text-red-400 p-1.5">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:relative md:mt-6 md:border md:rounded-2xl">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>Subtotal</span><span>{formatMoney(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-500 mb-3">
          <span>Envío</span><span>Se calcula en el siguiente paso</span>
        </div>
        <div className="flex justify-between font-bold text-lg text-grafondo mb-3">
          <span>Total estimado</span><span>{formatMoney(subtotal + envio)}</span>
        </div>
        <button
          onClick={() => navigate('/checkout')}
          className="w-full bg-petroleo text-white rounded-xl py-3 font-bold"
        >
          CONTINUAR CON EL PEDIDO
        </button>
      </div>
    </div>
  )
}
