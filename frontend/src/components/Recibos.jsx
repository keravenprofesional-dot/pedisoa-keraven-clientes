import { useEffect, useState } from 'react'
import { Receipt, X, Share2, Download } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatMoney, formatDate } from '../utils/format'
import { dibujarDocumento, documentoDeRecibo, compartirImagen, TITULO_RECIBO } from '../utils/documentoPago'

// Los recibos los emite la BASE sola (venta, venta actualizada, abono,
// pagado completo). Aquí solo se muestran y se envían.

const ETIQUETA = { venta: 'Venta', ajuste: 'Venta actualizada', abono: 'Abono', pagado: 'Pagado completo' }
const COLOR = {
  venta: 'bg-slate-100 text-slate-700', ajuste: 'bg-sky-50 text-sky-800',
  abono: 'bg-amber-50 text-amber-800', pagado: 'bg-green-50 text-green-800',
}
export const etiquetaRecibo = (t) => <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${COLOR[t] || ''}`}>{ETIQUETA[t] || t}</span>

// Un recibo en grande, listo para mandar.
// paraClienta: en la app de la clienta el botón dice "Compartir" y no abre su propio WhatsApp.
export function VentanaRecibo({ recibo, alCerrar, paraClienta = false }) {
  const [url, setUrl] = useState(null)
  const [blob, setBlob] = useState(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let vivo = true, hecho = null
    ;(async () => {
      const { data: cuentas } = await supabase.from('bank_accounts').select('banco, tipo_cuenta, numero, titular').eq('activo', true)
      const b = await dibujarDocumento(documentoDeRecibo(recibo, cuentas || []))
      if (!vivo) return
      hecho = URL.createObjectURL(b)
      setBlob(b); setUrl(hecho)
    })()
    return () => { vivo = false; if (hecho) URL.revokeObjectURL(hecho) }
  }, [recibo])

  async function enviar() {
    const r = await compartirImagen(blob, `Recibo ${recibo.numero}`, paraClienta ? null : recibo.cliente?.telefono)
    if (r === 'descargado') setAviso(paraClienta ? 'Recibo guardado en tus descargas.' : 'Recibo descargado. Se abrió el WhatsApp de la clienta para pegarlo.')
  }
  function bajar() {
    const a = document.createElement('a')
    a.href = url; a.download = `Recibo ${recibo.numero}.png`
    document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 md:items-center md:p-4" onClick={alCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-white md:max-w-md md:rounded-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-petroleo">{TITULO_RECIBO[recibo.tipo]} · {recibo.numero}</p>
            <p className="text-[11px] text-gray-500">{recibo.cliente?.nombre} · Pedido {recibo.pedido} · {formatDate(recibo.fecha)}</p>
          </div>
          <button onClick={alCerrar} className="text-gray-400"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-auto bg-graclaro p-3">
          {url ? <img src={url} alt={`Recibo ${recibo.numero}`} className="mx-auto w-full rounded-lg shadow" />
            : <p className="py-16 text-center text-sm text-gray-400">Preparando el recibo…</p>}
        </div>
        {aviso && <p className="px-4 pt-2 text-xs text-oroprof">{aviso}</p>}
        <div className="flex gap-2 px-4 py-3">
          <button onClick={enviar} disabled={!blob}
            className="flex items-center gap-1.5 rounded-full bg-negro px-4 py-2 text-sm font-semibold text-oro disabled:opacity-40">
            <Share2 size={15} /> {paraClienta ? 'Compartir' : 'Enviar por WhatsApp'}
          </button>
          <button onClick={bajar} disabled={!url}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm text-grafondo disabled:opacity-40">
            <Download size={15} /> Descargar
          </button>
        </div>
      </div>
    </div>
  )
}

// Todos los recibos de un pedido (para el personal).
export function RecibosDelPedido({ order, alCerrar }) {
  const [lista, setLista] = useState(null)
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    supabase.from('recibos').select('*').eq('order_id', order.id).order('fecha', { ascending: false })
      .then(({ data }) => setLista(data || []))
  }, [order.id])

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4" onClick={alCerrar}>
        <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl bg-white p-4 md:max-w-md md:rounded-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-petroleo">Recibos · {order.order_number}</h3>
            <button onClick={alCerrar} className="text-gray-400"><X size={18} /></button>
          </div>
          {!lista ? <p className="py-6 text-center text-sm text-gray-400">Cargando…</p>
            : lista.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">Este pedido no tiene recibos.</p>
            : (
              <ul className="divide-y divide-gray-100">
                {lista.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setAbierto(r)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-graclaro">
                      <span className="font-mono text-xs text-gray-500">{r.numero}</span>
                      {etiquetaRecibo(r.tipo)}
                      <span className="flex-1 text-xs text-gray-500">{formatDate(r.fecha)}</span>
                      <span className="text-right text-sm tabular-nums">
                        {r.abono != null ? formatMoney(r.abono) : formatMoney(r.total)}
                        <span className={`block text-[11px] ${Number(r.resta) > 0 ? 'text-red-600' : 'text-green-700'}`}>
                          {Number(r.resta) > 0 ? `resta ${formatMoney(r.resta)}` : 'pagado'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>
      {abierto && <VentanaRecibo recibo={abierto} alCerrar={() => setAbierto(null)} />}
    </>
  )
}

export function BotonRecibos({ onClick }) {
  return (
    <button onClick={onClick} title="Recibos de este pedido"
      className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-grafondo">
      <Receipt size={12} /> Recibos
    </button>
  )
}

// Después de registrar o confirmar un pago: busca el recibo que la base
// acaba de emitir para ese pago (pagos_reportados.id).
export async function reciboDelPago(pagoId) {
  const { data } = await supabase.from('recibos').select('*').eq('pago_id', pagoId).maybeSingle()
  return data
}
