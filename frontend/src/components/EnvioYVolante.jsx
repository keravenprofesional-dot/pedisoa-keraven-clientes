import { useState } from 'react'
import { Truck, FileImage, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatMoney } from '../utils/format'
import { dibujarVolante, compartirVolante } from '../utils/volantePago'

// Ventana para cobrar el envío: casilla "Cobrar envío", el monto que dice
// quien lo lleva y (si quiere) quién lo lleva. Se suma al total y a lo que
// debe la clienta. Destildar la casilla lo quita.
export function VentanaEnvio({ order, alCerrar, alGuardar }) {
  const [cobrar, setCobrar] = useState(Number(order.envio) > 0 || order.delivery_method === 'envio')
  const [monto, setMonto] = useState(Number(order.envio) > 0 ? String(Number(order.envio)) : '')
  const [nota, setNota] = useState(order.envio_nota || '')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)

  const valor = cobrar ? Number(String(monto).replace(/[^\d.]/g, '') || 0) : 0
  const nuevoTotal = Number(order.subtotal) - Number(order.descuento || 0) + valor

  async function guardar(e) {
    e.preventDefault()
    if (cobrar && !(valor > 0)) return setAviso('Escribe cuánto cuesta el envío')
    setGuardando(true); setAviso('')
    const { error } = await supabase.rpc('poner_envio', { p_order_id: order.id, p_monto: valor, p_nota: cobrar ? nota : '' })
    setGuardando(false)
    if (error) return setAviso(error.message)
    alGuardar(valor > 0
      ? `${order.order_number}: envío de ${formatMoney(valor)} sumado. Total nuevo ${formatMoney(nuevoTotal)}.`
      : `${order.order_number}: sin cobro de envío.`)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={alCerrar}>
      <form onSubmit={guardar} onClick={(e) => e.stopPropagation()}
        className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-petroleo">Envío · {order.order_number}</h3>
          <button type="button" onClick={alCerrar} className="text-gray-400"><X size={18} /></button>
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold mb-3">
          <input type="checkbox" className="w-5 h-5 accent-[#123B4A]" checked={cobrar} onChange={(e) => setCobrar(e.target.checked)} />
          Cobrar envío a la clienta
        </label>

        {cobrar && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="text-sm">Monto del envío (RD$)
              <input autoFocus inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej. 350"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">Quién lo lleva (opcional)
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Caribe Tours" maxLength={120}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" />
            </label>
          </div>
        )}

        <div className="bg-graclaro rounded-xl p-3 text-sm space-y-1 mb-3">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
          {Number(order.descuento) > 0 && (
            <div className="flex justify-between text-green-700"><span>Descuento</span><span>−{formatMoney(order.descuento)}</span></div>
          )}
          <div className="flex justify-between"><span>Envío</span><span>{formatMoney(valor)}</span></div>
          <div className="flex justify-between font-bold border-t border-gray-200 pt-1"><span>Total</span><span>{formatMoney(nuevoTotal)}</span></div>
        </div>

        {aviso && <p className="text-sm text-red-600 mb-2">{aviso}</p>}
        <div className="flex gap-2">
          <button disabled={guardando} className="bg-petroleo text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={alCerrar} className="text-gray-500 px-4 py-2 text-sm">Cancelar</button>
        </div>
      </form>
    </div>
  )
}

export function BotonEnvio({ onClick }) {
  return (
    <button onClick={onClick} title="Poner el costo del envío"
      className="flex items-center gap-1 text-xs font-semibold text-cyan-800 border border-cyan-200 rounded-lg px-2 py-1">
      <Truck size={12} /> Envío
    </button>
  )
}

// Arma y comparte el volante de desglose de pago de un pedido.
export function BotonVolante({ order, alAvisar }) {
  const [haciendo, setHaciendo] = useState(false)

  async function hacer() {
    setHaciendo(true)
    try {
      const [{ data: o }, { data: its }, { data: pagos }, { data: cuentas }] = await Promise.all([
        supabase.from('orders').select('*, clients(full_name, client_number, telefono_login), client_addresses(address, sector)')
          .eq('id', order.id).single(),
        supabase.from('order_items').select('cantidad, subtotal, detalle, products(nombre)').eq('order_id', order.id),
        supabase.from('pagos_reportados').select('monto').eq('order_id', order.id).eq('estado', 'confirmado'),
        supabase.from('bank_accounts').select('banco, tipo_cuenta, numero, titular').eq('activo', true),
      ])
      const ped = o || order
      const dir = ped.client_addresses
      const blob = await dibujarVolante({
        order: ped,
        cliente: ped.clients || order.clients,
        items: (its || []).map((i) => ({ ...i, nombre: i.products?.nombre || 'Producto' })),
        pagado: (pagos || []).reduce((n, p) => n + Number(p.monto), 0),
        cuentas: cuentas || [],
        direccion: ped.delivery_method === 'envio' && dir ? [dir.address, dir.sector].filter(Boolean).join(', ') : '',
      })
      const r = await compartirVolante(blob, `Pago ${ped.order_number}`, ped.clients?.telefono_login)
      if (r === 'descargado') alAvisar?.(`Volante de ${ped.order_number} descargado. Se abrió el WhatsApp de la clienta para pegarlo.`)
    } catch (e) {
      alAvisar?.('No se pudo hacer el volante: ' + (e?.message || e))
    } finally {
      setHaciendo(false)
    }
  }

  return (
    <button onClick={hacer} disabled={haciendo} title="Volante con el desglose del pago para enviarle a la clienta"
      className="flex items-center gap-1 text-xs font-semibold text-oroprof border border-amber-300 rounded-lg px-2 py-1 disabled:opacity-60">
      <FileImage size={12} /> {haciendo ? 'Haciendo…' : 'Volante'}
    </button>
  )
}
