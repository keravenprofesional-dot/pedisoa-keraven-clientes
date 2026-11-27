import { useEffect, useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatMoney, formatDate, STATUS_LABELS, colorDe } from '../utils/format'
import { METODOS, ESTADO_PAGO } from './PagoPedido'
import Debe from './Debe'

// TODO LO DEL PEDIDO EN PANTALLA (lo mismo que lleva el volante) y el
// HISTORIAL de cada clienta desde que nació el programa: qué compró en cada
// pedido, cómo paga y qué productos lleva más.

const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const ENTREGA = { parada: 'Parada', envio: 'Envío a domicilio', recogida: 'Recogida' }
const entregaDe = (o) => ENTREGA[o.delivery_method] || o.delivery_method || '—'

const chipEstado = (s) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${colorDe(s).chip}`}>
    {STATUS_LABELS[s] || s}
  </span>
)

// Productos de un pedido: cada kit con lo que trae, un producto por renglón.
export function ListaProductos({ items }) {
  return (
    <div className="divide-y divide-gray-100">
      {items.map((it, n) => (
        <div key={it.id || n} className="flex justify-between gap-3 py-1.5 text-sm">
          <div>
            <p className="font-semibold">{it.cantidad}× {limpio(it.products?.nombre) || 'Producto'}</p>
            {it.detalle?.length > 0 && (
              <ul className="mt-0.5 ml-1 space-y-0.5 text-[13px] text-gray-700">
                {it.detalle.map((d, i) => (
                  <li key={i} className="flex gap-1.5"><span className="text-dorado">•</span>{d.cantidad} × {limpio(d.nombre)}</li>
                ))}
              </ul>
            )}
          </div>
          <span className="whitespace-nowrap font-semibold">{formatMoney(it.subtotal)}</span>
        </div>
      ))}
      {items.length === 0 && <p className="py-2 text-sm text-gray-400">Sin productos.</p>}
    </div>
  )
}

// Cuentas del pedido y sus pagos (cómo, a qué cuenta, referencia, estado).
function CuentasYPagos({ o, pagos }) {
  const confirmado = pagos.filter((p) => p.estado === 'confirmado').reduce((s, p) => s + Number(p.monto), 0)
  const fila = (a, b, clase = '') => <div className={`flex justify-between ${clase}`}><span>{a}</span><span>{b}</span></div>
  return (
    <>
      <div className="mt-2 space-y-0.5 border-t border-gray-100 pt-2 text-sm">
        {fila('Subtotal', formatMoney(o.subtotal))}
        {Number(o.descuento) > 0 && fila(`Descuento${o.descuento_nota ? ` · ${o.descuento_nota}` : ''}`, `−${formatMoney(o.descuento)}`, 'text-green-700')}
        {Number(o.envio) > 0
          ? fila(`Envío${o.envio_nota ? ` · ${o.envio_nota}` : ''}`, `+${formatMoney(o.envio)}`)
          : o.delivery_method === 'envio' && o.status !== 'cancelado' && fila('Envío', 'por confirmar', 'text-amber-700')}
        {fila('TOTAL', formatMoney(o.total), 'border-t border-gray-200 pt-1 text-base font-bold')}
        {confirmado > 0 && fila('Pagado', `−${formatMoney(confirmado)}`, 'text-green-700')}
      </div>
      {o.status !== 'cancelado' && <Debe monto={o.balance} className="mt-1" />}
      <p className="mt-3 mb-1 text-xs font-bold uppercase tracking-wide text-oroprof">Pagos</p>
      {pagos.length === 0 && <p className="text-sm text-gray-400">Todavía no ha pagado nada.</p>}
      {pagos.map((p) => {
        const e = ESTADO_PAGO[p.estado] || ESTADO_PAGO.reportado
        return (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-b border-gray-50 py-1 text-sm">
            <span>
              <strong>{formatMoney(p.monto)}</strong> · {METODOS[p.metodo] || p.metodo}
              {p.bank_accounts ? ` · ${p.bank_accounts.banco} ${p.bank_accounts.numero}` : p.cuenta_texto ? ` · ${p.cuenta_texto}` : ''}
              {p.referencia ? ` · Ref. ${p.referencia}` : ''}
              <span className="block text-xs text-gray-400">{formatDate(p.creado_en)}</span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${e.clase}`}>{e.texto}</span>
          </div>
        )
      })}
    </>
  )
}

const SELECT_PEDIDO = '*, clients(full_name, client_number, cedula, telefono_login, direccion, sector, ciudad, provincia), client_addresses(address, sector), delivery_stops(nombre)'
const SELECT_ITEMS = 'id, order_id, cantidad, subtotal, detalle, product_id, products(nombre)'
const SELECT_PAGOS = 'id, order_id, monto, metodo, cuenta_texto, referencia, estado, creado_en, bank_accounts(banco, numero)'

function Ventana({ titulo, sub, alCerrar, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4" onClick={alCerrar}>
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white md:max-w-2xl md:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
          <div>
            <h2 className="text-lg font-bold text-petroleo">{titulo}</h2>
            {sub && <p className="text-sm text-gray-500">{sub}</p>}
          </div>
          <button onClick={alCerrar} className="p-1 text-gray-400 hover:text-grafondo" title="Cerrar"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

// ── Un pedido completo en pantalla (Pedidos → tocar el número).
export function VentanaDetallePedido({ order, alCerrar }) {
  const [d, setD] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('orders').select(SELECT_PEDIDO).eq('id', order.id).single(),
      supabase.from('order_items').select(SELECT_ITEMS).eq('order_id', order.id),
      supabase.from('pagos_reportados').select(SELECT_PAGOS).eq('order_id', order.id).order('creado_en'),
    ]).then(([{ data: o }, { data: its }, { data: pg }]) => setD({ o: o || order, items: its || [], pagos: pg || [] }))
  }, [order.id])

  const o = d?.o || order
  const c = o.clients || {}
  const dir = o.client_addresses
  const direccion = dir ? [dir.address, dir.sector].filter(Boolean).join(', ')
    : [c.direccion, c.sector, c.ciudad, c.provincia].filter(Boolean).join(', ')

  return (
    <Ventana titulo={`Pedido ${o.order_number}`} sub={formatDate(o.created_at)} alCerrar={alCerrar}>
      {!d ? <p className="py-8 text-center text-gray-400">Cargando…</p> : (
        <>
          <div className="mb-3 rounded-xl bg-graclaro p-3 text-sm">
            <p className="font-bold">{c.full_name} <span className="font-normal text-gray-500">· {c.client_number}</span></p>
            <p className="text-gray-600">
              {[c.cedula && `Cédula ${c.cedula}`, c.telefono_login && `Tel. ${c.telefono_login}`].filter(Boolean).join(' · ')}
            </p>
            {direccion && <p className="text-gray-600">Dirección: {direccion}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-2 text-gray-600">
              {chipEstado(o.status)}
              <span>Paga: <strong className="capitalize">{o.payment_method}</strong></span>
              <span>Entrega: <strong>{entregaDe(o)}{o.delivery_stops?.nombre ? ` · ${o.delivery_stops.nombre}` : ''}</strong></span>
            </p>
            {o.observaciones && <p className="mt-1 text-gray-600">Nota de la clienta: {o.observaciones}</p>}
          </div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-oroprof">Lo que pidió</p>
          <ListaProductos items={d.items} />
          <CuentasYPagos o={o} pagos={d.pagos} />
        </>
      )}
    </Ventana>
  )
}

// ── Historial de una clienta, desde el primer pedido (Clientes → Historial).
export function VentanaHistorialCliente({ cliente, alCerrar }) {
  const [d, setD] = useState(null)
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    (async () => {
      const { data: ords } = await supabase.from('orders').select(SELECT_PEDIDO)
        .eq('client_id', cliente.id).order('created_at', { ascending: false })
      const ids = (ords || []).map((o) => o.id)
      const [{ data: its }, { data: pg }] = ids.length
        ? await Promise.all([
          supabase.from('order_items').select(SELECT_ITEMS).in('order_id', ids),
          supabase.from('pagos_reportados').select(SELECT_PAGOS).in('order_id', ids).order('creado_en'),
        ])
        : [{ data: [] }, { data: [] }]
      setD({ ords: ords || [], its: its || [], pagos: pg || [] })
    })()
  }, [cliente.id])

  if (!d) return <Ventana titulo={`Historial de ${cliente.full_name}`} alCerrar={alCerrar}><p className="py-8 text-center text-gray-400">Cargando…</p></Ventana>

  const validos = d.ords.filter((o) => o.status !== 'cancelado')
  const idsValidos = new Set(validos.map((o) => o.id))
  const comprado = validos.reduce((s, o) => s + Number(o.total), 0)
  const pagosOk = d.pagos.filter((p) => p.estado === 'confirmado' && idsValidos.has(p.order_id))
  const pagado = pagosOk.reduce((s, p) => s + Number(p.monto), 0)
  const contar = (lista, clave) => Object.entries(lista.reduce((m, x) => { const k = clave(x); if (k) m[k] = (m[k] || 0) + 1; return m }, {}))
    .sort((a, b) => b[1] - a[1])
  const comoPaga = contar(pagosOk, (p) => METODOS[p.metodo] || p.metodo)
  const comoRecibe = contar(validos, entregaDe)
  // Lo que más compra: kits y productos sueltos tal como los pidió, y lo que trae por dentro.
  const sumar = (m, nombre, n) => { const k = limpio(nombre); if (k) m[k] = (m[k] || 0) + Number(n || 0); return m }
  const pedidos = {}
  const unidades = {}
  for (const it of d.its.filter((i) => idsValidos.has(i.order_id))) {
    sumar(pedidos, it.products?.nombre, it.cantidad)
    if (it.detalle?.length) for (const x of it.detalle) sumar(unidades, x.nombre, Number(x.cantidad) * Number(it.cantidad))
    else sumar(unidades, it.products?.nombre, it.cantidad)
  }
  const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1])
  const itemsDe = (id) => d.its.filter((i) => i.order_id === id)
  const pagosDe = (id) => d.pagos.filter((p) => p.order_id === id)
  const primero = d.ords[d.ords.length - 1]

  const cifra = (t, v, clase = '') => (
    <div className="rounded-xl bg-graclaro px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{t}</p>
      <p className={`font-bold ${clase}`}>{v}</p>
    </div>
  )

  return (
    <Ventana titulo={`Historial de ${cliente.full_name}`}
      sub={`${cliente.client_number || ''}${primero ? ` · cliente desde ${new Date(primero.created_at).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })}` : ''}`}
      alCerrar={alCerrar}>
      {d.ords.length === 0 ? <p className="py-8 text-center text-gray-400">Todavía no ha hecho pedidos.</p> : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {cifra('Pedidos', `${validos.length}${d.ords.length > validos.length ? ` (+${d.ords.length - validos.length} cancelado)` : ''}`)}
            {cifra('Ha comprado', formatMoney(comprado))}
            {cifra('Ha pagado', formatMoney(pagado), 'text-green-700')}
            {cifra('Debe', formatMoney(Math.max(comprado - pagado, 0)), comprado - pagado > 0 ? 'text-red-600' : '')}
          </div>

          <div className="mb-3 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-oroprof">Cómo compra</p>
              <p>Condición: <strong className="capitalize">{cliente.payment_condition || 'contado'}</strong>{cliente.credit_enabled ? ' · crédito aprobado' : ''}</p>
              <p>Paga con: <strong>{comoPaga.length ? comoPaga.map(([k, n]) => `${k} (${n})`).join(', ') : 'sin pagos confirmados'}</strong></p>
              <p>Recibe por: <strong>{comoRecibe.map(([k, n]) => `${k} (${n})`).join(', ') || '—'}</strong></p>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-oroprof">Lo que más pide</p>
              {top(pedidos).slice(0, 5).map(([k, n]) => <p key={k}>{n}× {k}</p>)}
            </div>
          </div>

          <details className="mb-3 rounded-xl border border-gray-100 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-petroleo">Todos los productos que se ha llevado (por unidad)</summary>
            <div className="mt-2 grid gap-x-4 md:grid-cols-2">
              {top(unidades).map(([k, n]) => <p key={k} className="flex justify-between border-b border-gray-50 py-0.5"><span>{k}</span><strong>{n}</strong></p>)}
            </div>
          </details>

          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-oroprof">Sus pedidos, del más nuevo al primero</p>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {d.ords.map((o) => {
              const ab = abierto === o.id
              const its = itemsDe(o.id)
              return (
                <div key={o.id} className={o.status === 'cancelado' ? 'opacity-60' : ''}>
                  <button onClick={() => setAbierto(ab ? null : o.id)} className="flex w-full items-center gap-2 p-3 text-left text-sm">
                    <div className="flex-1">
                      <p><strong className="text-petroleo">{o.order_number}</strong> · {formatDate(o.created_at)} {chipEstado(o.status)}</p>
                      <p className="text-xs text-gray-500">
                        {its.map((i) => `${i.cantidad}× ${limpio(i.products?.nombre)}`).join(' · ')}
                      </p>
                    </div>
                    <span className="whitespace-nowrap font-semibold">{formatMoney(o.total)}</span>
                    {ab ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>
                  {ab && (
                    <div className="px-3 pb-3">
                      <p className="mb-1 text-xs text-gray-500">
                        Paga: <strong className="capitalize">{o.payment_method}</strong> · Entrega: <strong>{entregaDe(o)}{o.delivery_stops?.nombre ? ` · ${o.delivery_stops.nombre}` : ''}</strong>
                      </p>
                      <ListaProductos items={its} />
                      <CuentasYPagos o={o} pagos={pagosDe(o.id)} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Ventana>
  )
}
