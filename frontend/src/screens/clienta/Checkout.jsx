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
  // El cliente siempre pide de contado. Si Keraven quiere darle crédito a
  // alguien, eso lo decide el administrador desde su panel (Clientes →
  // crédito habilitado) — el cliente nunca ve ni elige esa opción aquí.
  const paymentMethod = 'contado'
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [createdOrder, setCreatedOrder] = useState(null)

  const envio = deliveryMethod === 'envio' ? 150 : 0 // ejemplo: costo fijo configurable a futuro
  const total = subtotal + envio

  useEffect(() => {
    if (!client) return
    supabase.from('delivery_stops').select('*').eq('activo', true).order('nombre').then(({ data }) => {
      setStops(data || [])
      // Su parada de siempre ya viene puesta; igual puede cambiarla.
      if (client.delivery_stop_id && (data || []).some((s) => s.id === client.delivery_stop_id)) {
        setStopId(client.delivery_stop_id)
      }
    })
    supabase.from('client_addresses').select('*').eq('client_id', client.id).then(({ data }) => setAddresses(data || []))
  }, [client])

  async function handleConfirm() {
    setCreating(true)
    setError('')
    try {
      // El servidor recalcula precios, total y crédito con sus propios datos;
      // lo que se muestra en pantalla es solo una vista previa.
      const { data: order, error: orderErr } = await supabase.rpc('crear_pedido', {
        items: items.map((i) => ({
          product_id: i.product.id,
          cantidad: i.cantidad,
          // En una caja armada van los sabores que eligió; el servidor
          // vuelve a revisarlos y calcula lo que de verdad lleva.
          ...(i.sabores?.length ? { sabores: i.sabores } : {}),
        })),
        delivery_method: deliveryMethod,
        delivery_stop_id: deliveryMethod === 'parada' ? stopId : null,
        address_id: deliveryMethod === 'envio' ? addressId : null,
        payment_method: paymentMethod,
        avance: null,
        observaciones,
      })
      if (orderErr) throw orderErr

      setCreatedOrder(order)
      clearCart()
    } catch (err) {
      // Los mensajes de crear_pedido ya vienen en español y son para la clienta
      // (sin existencia, sin crédito, límite superado…).
      const msg = err?.message || ''
      setError(msg && !/fetch|network|JWT/i.test(msg) ? msg : 'No se pudo crear el pedido. Revisa tu conexión e intenta de nuevo.')
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
            onClick={() => setStep('confirmar')}
            disabled={deliveryMethod === 'parada' ? !stopId : deliveryMethod === 'envio' ? !addressId : false}
            className="w-full bg-petroleo disabled:bg-gray-300 text-white rounded-xl py-3 font-bold"
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
                <div key={i.clave} className="flex justify-between">
                  <span>
                    {i.cantidad}× {i.product.nombre}
                    {i.sabores?.length > 0 && <span className="block text-xs text-petroleo">{i.sabores.join(' y ')}</span>}
                  </span>
                  <span>{formatMoney(i.product.precio * i.cantidad)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between font-bold">
              <span>Total</span><span>{formatMoney(total)}</span>
            </div>
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
