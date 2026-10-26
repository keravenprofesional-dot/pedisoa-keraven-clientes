import { useEffect, useState } from 'react'
import { Minus, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatMoney } from '../utils/format'

// Un gerente corrige el pedido del cliente mientras sigue en "Recibido":
// cantidades, quitar, agregar productos y el descuento (ponerlo o quitarlo).
// Lo que ya estaba conserva su precio; lo que se agrega va al precio de hoy.
export default function EditarPedido({ order, alCerrar, alGuardar }) {
  const [lineas, setLineas] = useState([])      // { item_id?, product_id, nombre, precio, cantidad }
  const [productos, setProductos] = useState([])
  const [agregar, setAgregar] = useState('')
  const [descuento, setDescuento] = useState(String(Number(order.descuento) || 0))
  const [motivo, setMotivo] = useState(order.descuento_nota || '')
  const [pct, setPct] = useState(null)          // % fijo del cliente, si el descuento venía de ahí
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [order.id])

  async function cargar() {
    const [{ data: its }, { data: prods }] = await Promise.all([
      supabase.from('order_items').select('id, product_id, cantidad, precio_unitario, products(nombre)').eq('order_id', order.id),
      supabase.from('products').select('id, nombre, precio, stock, armado').eq('disponible', true).gt('precio', 0).order('nombre'),
    ])
    setLineas((its || []).map((i) => ({
      item_id: i.id, product_id: i.product_id, nombre: i.products?.nombre || '?',
      precio: Number(i.precio_unitario), cantidad: i.cantidad,
    })).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setProductos((prods || []).filter((p) => !p.armado))
    const m = /^Descuento de cliente ([\d.]+)%$/.exec(order.descuento_nota || '')
    setPct(m ? Number(m[1]) : null)
  }

  const subtotal = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0)
  const monto = Number(String(descuento).replace(/[^\d.]/g, '') || 0)
  const total = subtotal + Number(order.envio) - monto

  // Si el descuento era el % fijo del cliente, se recalcula sobre el nuevo subtotal.
  useEffect(() => {
    if (pct !== null) setDescuento(String(Math.round(subtotal * pct) / 100))
  }, [subtotal, pct])

  const cambiar = (i, cant) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, cantidad: Math.min(Math.max(cant, 1), 999) } : l)))
  const quitar = (i) => setLineas((ls) => ls.filter((_, j) => j !== i))

  function sumar() {
    const p = productos.find((x) => x.id === agregar)
    if (!p) return
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.product_id === p.id)
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, cantidad: Math.min(l.cantidad + 1, 999) } : l))
      return [...ls, { product_id: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad: 1 }]
    })
    setAgregar('')
  }

  async function guardar() {
    setError('')
    if (lineas.length === 0) { setError('El pedido no puede quedar sin productos. Si no lo quieren, cancélalo.'); return }
    if (monto > 0 && !motivo.trim()) { setError('Escribe el motivo del descuento.'); return }
    setGuardando(true)
    const { error: err } = await supabase.rpc('editar_pedido', {
      p_order_id: order.id,
      p_items: lineas.map((l) => (l.item_id ? { item_id: l.item_id, cantidad: l.cantidad } : { product_id: l.product_id, cantidad: l.cantidad })),
      p_descuento: monto,
      p_motivo: monto > 0 ? motivo.trim() : '',
    })
    setGuardando(false)
    if (err) { setError(err.message); return }
    alGuardar(`${order.order_number}: pedido corregido. Nuevo total ${formatMoney(total)}.`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-6" onClick={alCerrar}>
      <div className="bg-white w-full md:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-lg font-bold text-grafondo">Editar {order.order_number}</h2>
            <p className="text-xs text-gray-500">{order.clients?.full_name} · se puede editar hasta que se confirme</p>
          </div>
          <button onClick={alCerrar} aria-label="Cerrar" className="p-1 text-gray-400"><X size={20} /></button>
        </div>

        <ul className="divide-y divide-gray-100 my-3">
          {lineas.map((l, i) => (
            <li key={l.item_id || l.product_id} className="flex items-center gap-2 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{l.nombre}</p>
                <p className="text-xs text-gray-500">
                  {formatMoney(l.precio)} c/u{!l.item_id && <span className="ml-1 text-sky-700">· nuevo</span>}
                </p>
              </div>
              <div className="flex items-center rounded-lg ring-1 ring-gray-200">
                <button onClick={() => cambiar(i, l.cantidad - 1)} aria-label="Menos" className="p-1.5"><Minus size={14} /></button>
                <input value={l.cantidad} inputMode="numeric"
                  onChange={(e) => cambiar(i, Number(e.target.value.replace(/\D/g, '') || 1))}
                  className="w-10 text-center text-sm" />
                <button onClick={() => cambiar(i, l.cantidad + 1)} aria-label="Más" className="p-1.5"><Plus size={14} /></button>
              </div>
              <span className="w-24 text-right text-sm font-semibold">{formatMoney(l.precio * l.cantidad)}</span>
              <button onClick={() => quitar(i)} aria-label="Quitar" className="p-1.5 text-red-500"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2 mb-4">
          <select value={agregar} onChange={(e) => setAgregar(e.target.value)} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
            <option value="">Agregar un producto…</option>
            {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {formatMoney(p.precio)}</option>)}
          </select>
          <button onClick={sumar} disabled={!agregar} className="text-xs font-semibold text-petroleo border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40">Agregar</button>
        </div>

        <div className="rounded-xl bg-graclaro p-3 text-sm space-y-2">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
          {Number(order.envio) > 0 && <div className="flex justify-between"><span>Envío</span><span>{formatMoney(order.envio)}</span></div>}
          <div className="flex items-center justify-between gap-2">
            <span>Descuento RD$ <span className="text-xs text-gray-500">(0 = sin descuento)</span></span>
            <input value={descuento} inputMode="decimal"
              onChange={(e) => { setPct(null); setDescuento(e.target.value) }}
              className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 bg-white" />
          </div>
          {monto > 0 && (
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del descuento"
              className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white" />
          )}
          <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-200">
            <span>Total</span><span>{formatMoney(total)}</span>
          </div>
          {Number(order.total) !== total && (
            <p className="text-xs text-gray-500">Antes: {formatMoney(order.total)}</p>
          )}
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={alCerrar} className="text-sm text-gray-600 px-3 py-1.5">Volver</button>
          <button onClick={guardar} disabled={guardando}
            className="text-sm font-semibold text-white bg-petroleo rounded-lg px-4 py-1.5 disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
