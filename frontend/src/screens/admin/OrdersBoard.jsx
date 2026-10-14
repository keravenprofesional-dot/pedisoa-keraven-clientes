import { useEffect, useState } from 'react'
import { Percent } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { formatMoney, formatDate, STATUS_LABELS, STATUS_ORDER, colorDe } from '../../utils/format'

const ESTADOS = STATUS_ORDER.concat('cancelado')

export default function OrdersBoard() {
  const { puede } = useAuth()
  const puedeEstado = puede('cambiar_estado')
  const puedePagos = puede('registrar_pagos')
  const puedeDescuentos = puede('dar_descuentos')
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [aviso, setAviso] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('orders')
      .select('*, clients(full_name, client_number, telefono_login)')
      .order('created_at', { ascending: false })
    setOrders(data || [])
  }

  async function changeStatus(o, status) {
    if (status === o.status) return
    if (status === 'cancelado' && !confirm(`¿Cancelar el pedido ${o.order_number}? La mercancía vuelve al inventario y se borra lo que debe de este pedido. No se puede reabrir.`)) return
    setAviso('')
    const { error } = await supabase.from('orders').update({ status }).eq('id', o.id)
    if (error) setAviso(error.message || 'No se pudo cambiar el estado')
    load()
  }

  async function pagar(o) {
    const txt = prompt(`Pago para ${o.order_number} (debe ${formatMoney(o.balance)}). Monto:`)
    if (txt === null) return
    const monto = Number(String(txt).replace(/[^\d.]/g, ''))
    const metodo = prompt('¿Cómo pagó? (efectivo, transferencia…)', 'efectivo')
    if (metodo === null) return
    const { error } = await supabase.rpc('registrar_pago', { p_order_id: o.id, p_monto: monto, p_metodo: metodo })
    setAviso(error ? error.message : `Pago de ${formatMoney(monto)} registrado.`)
    load()
  }

  // Pone (o cambia, o quita con 0) el descuento de un pedido puntual.
  async function descontar(o) {
    const txt = prompt(
      `Descuento para ${o.order_number} (subtotal ${formatMoney(o.subtotal)}` +
      `${Number(o.descuento) > 0 ? `, ahora tiene ${formatMoney(o.descuento)}` : ''}).\n` +
      'Monto en RD$ (0 para quitarlo):',
      Number(o.descuento) > 0 ? String(Number(o.descuento)) : '')
    if (txt === null) return
    const monto = Number(String(txt).replace(/[^\d.]/g, '') || 0)
    let motivo = ''
    if (monto > 0) {
      motivo = prompt('Motivo del descuento:', o.descuento_nota || '')
      if (motivo === null) return
    }
    const { error } = await supabase.rpc('descontar_pedido', { p_order_id: o.id, p_monto: monto, p_motivo: motivo })
    setAviso(error ? error.message : monto > 0
      ? `${o.order_number}: descuento de ${formatMoney(monto)} aplicado.`
      : `${o.order_number}: descuento quitado.`)
    load()
  }

  const q = search.toLowerCase()
  const filtered = orders.filter((o) =>
    (statusFilter === 'all' || o.status === statusFilter) &&
    (o.order_number?.toLowerCase().includes(q) ||
      o.clients?.full_name?.toLowerCase().includes(q) ||
      o.clients?.client_number?.toLowerCase().includes(q) ||
      (search.replace(/\D/g, '') && o.clients?.telefono_login?.includes(search.replace(/\D/g, ''))))
  )

  const selectorEstado = (o, clase) => puedeEstado && o.status !== 'cancelado' ? (
    <select value={o.status} onChange={(e) => changeStatus(o, e.target.value)}
      className={`${clase.replace('border border-gray-200', '')} font-medium ring-1 ${colorDe(o.status).chip}`}>
      {ESTADOS.map((s) => <option key={s} value={s} className="bg-white text-grafondo">{STATUS_LABELS[s]}</option>)}
    </select>
  ) : <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${colorDe(o.status).chip}`}>{STATUS_LABELS[o.status] || o.status}</span>

  const botonPago = (o) => (
    <div className="flex flex-wrap justify-end gap-1.5">
      {puedePagos && Number(o.balance) > 0 && o.status !== 'cancelado' && (
        <button onClick={() => pagar(o)} className="text-xs font-semibold text-petroleo border border-gray-200 rounded-lg px-2 py-1">Registrar pago</button>
      )}
      {puedeDescuentos && !['cancelado', 'entregado'].includes(o.status) && (
        <button onClick={() => descontar(o)} title="Dar descuento a este pedido"
          className="flex items-center gap-1 text-xs font-semibold text-amber-700 border border-amber-200 rounded-lg px-2 py-1">
          <Percent size={12} /> Descuento
        </button>
      )}
    </div>
  )
  const totalCon = (o) => (
    <>
      {formatMoney(o.total)}
      {Number(o.descuento) > 0 && (
        <span className="block text-[11px] text-amber-700" title={o.descuento_nota || ''}>
          −{formatMoney(o.descuento)} desc.
        </span>
      )}
    </>
  )

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-grafondo mb-4">Pedidos</h1>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input placeholder="Buscar por Nº de pedido, nombre, Nº de cliente o teléfono…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-4 py-2" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2">
          <option value="all">Todos los estados</option>
          {ESTADOS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      {aviso && <p className="bg-graclaro border border-gray-200 text-sm rounded-xl p-3 mb-4">{aviso}</p>}

      <div className="hidden md:block bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-graclaro text-gray-500 text-left">
            <tr>
              <th className="p-3">Pedido</th><th className="p-3">Cliente</th><th className="p-3">Fecha</th>
              <th className="p-3">Total</th><th className="p-3">Debe</th><th className="p-3">Estado</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t border-gray-100">
                <td className="p-3 font-bold text-petroleo">{o.order_number}</td>
                <td className="p-3">{o.clients?.full_name} <span className="text-xs text-gray-400">{o.clients?.client_number}</span></td>
                <td className="p-3">{formatDate(o.created_at)}</td>
                <td className="p-3">{totalCon(o)}</td>
                <td className="p-3">{Number(o.balance) > 0 ? <span className="text-red-500">{formatMoney(o.balance)}</span> : '—'}</td>
                <td className="p-3">{selectorEstado(o, 'border border-gray-200 rounded-lg px-2 py-1')}</td>
                <td className="p-3">{botonPago(o)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden flex flex-col gap-3">
        {filtered.map((o) => (
          <div key={o.id} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex justify-between mb-1">
              <span className="font-bold text-petroleo">{o.order_number}</span>
              <span className="text-right font-semibold">{totalCon(o)}</span>
            </div>
            <p className="text-sm text-gray-500 mb-1">{o.clients?.full_name} · {formatDate(o.created_at)}</p>
            {Number(o.balance) > 0 && <p className="text-sm text-red-500 mb-2">Debe {formatMoney(o.balance)}</p>}
            <div className="flex items-center gap-2">
              <div className="flex-1">{selectorEstado(o, 'w-full border border-gray-200 rounded-lg px-2 py-2')}</div>
              {botonPago(o)}
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-gray-400 text-center py-10">No hay pedidos.</p>}
    </div>
  )
}
