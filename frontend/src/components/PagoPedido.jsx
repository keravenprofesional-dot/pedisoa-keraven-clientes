import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, XCircle, Landmark } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatMoney, formatDate } from '../utils/format'

export const METODOS = { transferencia: 'Transferencia', deposito: 'Depósito', efectivo: 'Efectivo' }
export const ESTADO_PAGO = {
  reportado:  { texto: 'En revisión',     icono: Clock,        clase: 'bg-amber-50 text-amber-800 ring-amber-200' },
  confirmado: { texto: 'Pago confirmado', icono: CheckCircle2, clase: 'bg-green-50 text-green-800 ring-green-200' },
  rechazado:  { texto: 'Rechazado',       icono: XCircle,      clase: 'bg-red-50 text-red-700 ring-red-200' },
}

// Los pagos de un pedido y, si falta algo, el botón "Ya pagué": el cliente
// dice cuánto, cómo y a cuál cuenta de Keraven pagó, con su referencia.
// El personal lo confirma; confirmado, aquí queda a qué cuenta se pagó.
export default function PagoPedido({ order, cuentas }) {
  const [pagos, setPagos] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({ metodo: 'transferencia', cuenta: '', monto: '', referencia: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { cargar() }, [order.id])

  async function cargar() {
    const { data } = await supabase.from('pagos_reportados').select('*')
      .eq('order_id', order.id).order('creado_en')
    setPagos(data || [])
  }

  const cubierto = pagos.filter((p) => p.estado !== 'rechazado').reduce((s, p) => s + Number(p.monto), 0)
  const falta = Math.max(Number(order.total) - cubierto, 0)
  const enRevision = pagos.some((p) => p.estado === 'reportado')
  const pagado = falta === 0 && pagos.length > 0 && !enRevision

  function abrir() {
    setError('')
    setF({ metodo: cuentas.length ? 'transferencia' : 'efectivo', cuenta: cuentas[0]?.id || '', monto: String(falta), referencia: '' })
    setAbierto(true)
  }

  async function enviar(e) {
    e.preventDefault()
    setError(''); setEnviando(true)
    const { error: err } = await supabase.rpc('reportar_pago', {
      p_order_id: order.id,
      p_monto: Number(String(f.monto).replace(/[^\d.]/g, '')),
      p_metodo: f.metodo,
      p_cuenta_id: f.metodo === 'efectivo' ? null : f.cuenta,
      p_referencia: f.metodo === 'efectivo' ? null : f.referencia,
    })
    setEnviando(false)
    if (err) { setError(err.message); return }
    setAbierto(false)
    cargar()
  }

  if (order.status === 'cancelado') return null

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-bold text-grafondo">Pago</h2>
        {pagado
          ? <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800 ring-1 ring-green-200">Pagado</span>
          : <span className="text-sm text-gray-500">Falta {formatMoney(falta)}</span>}
      </div>

      {pagos.map((p) => {
        const e = ESTADO_PAGO[p.estado]
        return (
          <div key={p.id} className={`mb-2 rounded-xl p-3 text-sm ring-1 ${e.clase}`}>
            <div className="flex items-center justify-between gap-2 font-semibold">
              <span className="flex items-center gap-1.5"><e.icono size={15} /> {e.texto}</span>
              <span className="tabular-nums">{formatMoney(p.monto)}</span>
            </div>
            <p className="mt-1 text-xs">
              {METODOS[p.metodo]}{p.referencia ? ` · Ref. ${p.referencia}` : ''} · {formatDate(p.creado_en)}
            </p>
            {p.cuenta_texto && (
              <p className="mt-1 flex items-start gap-1.5 text-xs">
                <Landmark size={13} className="mt-0.5 shrink-0" />
                <span>{p.estado === 'confirmado' ? 'Recibido en' : 'Pagado a'}: <b>{p.cuenta_texto}</b></span>
              </p>
            )}
            {p.estado === 'confirmado' && p.confirmado_en && (
              <p className="mt-1 text-xs">Confirmado por Keraven el {formatDate(p.confirmado_en)}</p>
            )}
            {p.nota && p.estado === 'rechazado' && <p className="mt-1 text-xs">Motivo: {p.nota}</p>}
          </div>
        )
      })}

      {!pagado && !enRevision && !abierto && falta > 0 && (
        <button onClick={abrir} className="mt-1 w-full rounded-xl bg-negro py-3 text-sm font-bold text-orosuave">
          Ya pagué — avisar a Keraven
        </button>
      )}
      {enRevision && (
        <p className="mt-1 text-xs text-gray-500">Keraven está revisando tu pago. Te avisamos aquí cuando lo confirme.</p>
      )}

      {abierto && (
        <form onSubmit={enviar} className="mt-2 space-y-3 text-sm">
          <div className="flex gap-2">
            {Object.entries(METODOS).filter(([v]) => cuentas.length || v === 'efectivo').map(([v, t]) => (
              <button type="button" key={v} onClick={() => setF({ ...f, metodo: v })}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold ${f.metodo === v ? 'bg-negro text-orosuave' : 'border border-gray-200 text-gray-500'}`}>
                {t}
              </button>
            ))}
          </div>

          {f.metodo !== 'efectivo' && (
            <>
              <p className="text-xs font-semibold uppercase text-gray-400">¿A cuál cuenta pagaste?</p>
              {cuentas.map((b) => (
                <label key={b.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${f.cuenta === b.id ? 'border-oro bg-crema' : 'border-gray-200'}`}>
                  <input type="radio" name="cuenta" checked={f.cuenta === b.id} onChange={() => setF({ ...f, cuenta: b.id })} className="mt-1" />
                  <span>
                    <b>{b.banco}</b>{b.tipo_cuenta ? ` · ${b.tipo_cuenta}` : ''}<br />
                    <span className="text-xs text-gray-500">Nº {b.numero} · {b.titular}</span>
                  </span>
                </label>
              ))}
              <input required value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })}
                placeholder="Número de referencia o de comprobante"
                className="w-full rounded-lg border border-gray-200 px-3 py-2" />
            </>
          )}

          <label className="block text-xs font-semibold uppercase text-gray-400">Monto pagado
            <input required inputMode="decimal" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-base font-normal text-grafondo" />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button disabled={enviando} className="flex-1 rounded-xl bg-negro py-3 font-bold text-orosuave disabled:opacity-50">
              {enviando ? 'Enviando…' : 'Enviar aviso de pago'}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="px-4 text-gray-500">Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}
