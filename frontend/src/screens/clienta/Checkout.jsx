import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart()
  const { client } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState('entrega') // entrega | pago | confirmar
  const [deliveryMethod, setDeliveryMethod] = useState('parada')
  const [stops, setStops] = useState([])
  const [stopId, setStopId] = useState('')
  const [addresses, setAddresses] = useState([])
  const [addressId, setAddressId] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('contado')
  const [avance, setAvance] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [createdOrder, setCreatedOrder] = useState(null)

  const envio = deliveryMethod === 'envio' ? 150 : 0 // ejemplo: costo fijo configurable a futuro
  const total = subtotal + envio
  const avanceNum = Number(avance || 0)
  const balance = paymentMethod === 'avance' ? Math.max(total - avanceNum, 0) : paymentMethod === 'credito' ? total : 0

  useEffect(() => {
    if (!client) return
    supabase.from('delivery_stops').select('*').eq('activo', true).then(({ data }) => setStops(data || []))
    supabase.from('client_addresses').select('*').eq('client_id', client.id).then(({ data }) => setAddresses(data || []))
  }, [client])

  async function handleConfirm() {
    setCreating(true)
    setError('')
    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          client_id: client.id,
          status: 'recibido',
          subtotal,
          descuento: 0,
          envio,
          total,
          payment_method: paymentMethod,
          avance: paymentMethod === 'avance' ? avanceNum : 0,
          balance,
          delivery_method: deliveryMethod,
          delivery_stop_id: deliveryMethod === 'parada' ? stopId : null,
          address_id: deliveryMethod === 'envio' ? addressId : null,
          observaciones,
        })
        .select()
        .single()
      if (orderErr) throw orderErr

      const orderItems = items.map((i) => ({
        order_id: order.id,
        product_id: i.product.id,
        cantidad: i.cantidad,
        precio_unitario: i.product.precio,
        subtotal: i.product.precio * i.cantidad,
      }))
      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems)
      if (itemsErr) throw itemsErr

      setCreatedOrder(order)
      clearCart()
    } catch (err) {
      setError('No se pudo crear el pedido. Intenta de nuevo.')
    } finally {
      setCreating(false)
    }
  }

  if (createdOrder) {
    return (
      <div className="p-6 max-w-md mx-auto text-center py-16">
        <p className="text-dorado font-semibold mb-2">PEDIDO CREADO</p>
        <h1 className="text-3xl font-extrabold text-petroleo mb-4">{createdOrder.order_number}</h1>
        <p className="text-gray-500 mb-8">Te avisaremos cuando tu pedido cambie de estado.</p>
        <button
          onClick={() => navigate(`/mis-pedidos/${createdOrder.id}`)}
          className="w-full bg-petroleo text-white rounded-xl py-3 font-bold mb-3"
        >
          Ver mi recibo
        </button>
        <button onClick={() => navigate('/')} className="text-gray-400 text-sm">
          Volver al inicio
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 pb-6 max-w-lg mx-auto">
      {step === 'entrega' && (
        <div>
          <h1 className="text-xl font-bold text-grafondo mb-4">¿Cómo deseas recibir tu pedido?</h1>
          <div className="flex flex-col gap-2 mb-4">
            {[
              { v: 'parada', label: 'Parada' },
              { v: 'envio', label: 'Envío a domicilio' },
              { v: 'recogida', label: 'Recogida' },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setDeliveryMethod(o.v)}
                className={`text-left px-4 py-3 rounded-xl border ${
                  deliveryMethod === o.v ? 'border-dorado bg-dorado/10 font-semibold' : 'border-gray-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {deliveryMethod === 'parada' && (
            <select
              value={stopId}
              onChange={(e) => setStopId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-4"
            >
              <option value="">Selecciona una parada</option>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre} — {s.zona}</option>
              ))}
            </select>
          )}

          {deliveryMethod === 'envio' && (
            <select
              value={addressId}
              onChange={(e) => setAddressId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-4"
            >
              <option value="">Selecciona una dirección</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>{a.address}</option>
              ))}
            </select>
          )}

          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones (opcional)"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-4"
            rows={2}
          />

          <button
            onClick={() => setStep('pago')}
            disabled={deliveryMethod === 'parada' ? !stopId : deliveryMethod === 'envio' ? !addressId : false}
            className="w-full bg-petroleo disabled:bg-gray-300 text-white rounded-xl py-3 font-bold"
          >
            Continuar
          </button>
        </div>
      )}

      {step === 'pago' && (
        <div>
          <h1 className="text-xl font-bold text-grafondo mb-4">Forma de pago</h1>
          <div className="flex flex-col gap-2 mb-4">
            {[
              { v: 'contado', label: 'Contado (pago total)' },
              { v: 'avance', label: 'Avance' },
              { v: 'credito', label: 'Crédito', disabled: !client?.credit_enabled },
            ].map((o) => (
              <button
                key={o.v}
                disabled={o.disabled}
                onClick={() => setPaymentMethod(o.v)}
                className={`text-left px-4 py-3 rounded-xl border disabled:opacity-40 ${
                  paymentMethod === o.v ? 'border-dorado bg-dorado/10 font-semibold' : 'border-gray-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {paymentMethod === 'avance' && (
            <input
              type="number"
              min="0"
              max={total}
              placeholder="Monto del avance"
              value={avance}
              onChange={(e) => setAvance(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-4"
            />
          )}

          <div className="bg-graclaro rounded-xl p-4 mb-4 text-sm">
            <div className="flex justify-between"><span>Total</span><span className="font-semibold">{formatMoney(total)}</span></div>
            {paymentMethod !== 'contado' && (
              <div className="flex justify-between text-petroleo font-semibold">
                <span>Balance pendiente</span><span>{formatMoney(balance)}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => setStep('confirmar')}
            className="w-full bg-petroleo text-white rounded-xl py-3 font-bold"
          >
            Continuar
          </button>
        </div>
      )}

      {step === 'confirmar' && (
        <div>
          <h1 className="text-xl font-bold text-grafondo mb-4">Confirmar pedido</h1>
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 text-sm space-y-2">
            <p><strong>Cliente:</strong> {client?.full_name} <span className="text-gray-400">({client?.client_number})</span></p>
            <p><strong>Entrega:</strong> {deliveryMethod}</p>
            <div className="border-t pt-2 mt-2">
              {items.map((i) => (
                <div key={i.product.id} className="flex justify-between">
                  <span>{i.cantidad}× {i.product.nombre}</span>
                  <span>{formatMoney(i.product.precio * i.cantidad)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between font-bold">
              <span>Total</span><span>{formatMoney(total)}</span>
            </div>
            <p><strong>Forma de pago:</strong> {paymentMethod}</p>
            {paymentMethod === 'avance' && <p><strong>Avance:</strong> {formatMoney(avanceNum)}</p>}
            {paymentMethod !== 'contado' && <p><strong>Balance:</strong> {formatMoney(balance)}</p>}
          </div>

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <button
            onClick={handleConfirm}
            disabled={creating}
            className="w-full bg-dorado text-petroleo rounded-xl py-4 font-extrabold text-lg"
          >
            {creating ? 'Creando pedido…' : 'CONFIRMAR PEDIDO'}
          </button>
        </div>
      )}
    </div>
  )
}
