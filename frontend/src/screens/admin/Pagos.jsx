import { useEffect, useState } from 'react'
import { Check, X, Landmark } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney, formatDate } from '../../utils/format'
import { METODOS, ESTADO_PAGO } from '../../components/PagoPedido'

// Los avisos de pago de los clientes ("ya pagué"). Se revisa en el banco
// que el dinero llegó a esa cuenta y se confirma; o se rechaza con motivo.
export default function Pagos() {
  const [lista, setLista] = useState([])
  const [filtro, setFiltro] = useState('reportado')
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('pagos_reportados')
      .select('*, orders(order_number, total, clients(full_name, client_number))')
      .order('creado_en', { ascending: false })
    setLista(data || [])
    setCargando(false)
  }

  async function atender(p, estado) {
    let nota = null
    if (estado === 'rechazado') {
      nota = prompt(`¿Por qué se rechaza el pago de ${formatMoney(p.monto)}? (el cliente lo verá)`, 'No llegó a la cuenta')
      if (nota === null) return
    } else if (!confirm(`¿Confirmar ${formatMoney(p.monto)} de ${p.orders?.clients?.full_name}` +
      `${p.cuenta_texto ? `\nen ${p.cuenta_texto}` : ' en efectivo'}?\n\nVerifica primero que el dinero llegó.`)) return
    const { error } = await supabase.rpc('confirmar_pago', { p_id: p.id, p_estado: estado, p_nota: nota })
    setAviso(error ? error.message : `Pago de ${p.orders?.order_number} ${estado}.`)
    cargar()
  }

  const pendientes = lista.filter((p) => p.estado === 'reportado').length
  const filtrada = lista.filter((p) => filtro === 'todos' || p.estado === filtro)

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-grafondo">Pagos</h1>
      <p className="mb-5 text-sm text-gray-500">
        Avisos de pago de los clientes, con la cuenta a la que dicen que pagaron.
        {pendientes > 0 && <b className="text-amber-600"> {pendientes} por confirmar.</b>}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {[['reportado', 'Por confirmar'], ['confirmado', 'Confirmados'], ['rechazado', 'Rechazados'], ['todos', 'Todos']].map(([v, t]) => (
          <button key={v} onClick={() => setFiltro(v)}
            className={`rounded-full px-4 py-1.5 text-sm ${filtro === v ? 'bg-negro text-oro font-semibold' : 'bg-white border border-gray-200 text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {aviso && <p className="mb-4 rounded-xl border border-gray-200 bg-graclaro p-3 text-sm">{aviso}</p>}

      {cargando ? (
        <p className="py-10 text-center text-gray-400">Cargando…</p>
      ) : filtrada.length === 0 ? (
        <p className="py-10 text-center text-gray-400">No hay pagos aquí.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtrada.map((p) => {
            const e = ESTADO_PAGO[p.estado]
            return (
              <div key={p.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-petroleo">{p.orders?.order_number}</p>
                    <p className="text-sm text-grafondo">{p.orders?.clients?.full_name} <span className="text-xs text-gray-400">{p.orders?.clients?.client_number}</span></p>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${e.clase}`}>
                    <e.icono size={12} /> {e.texto}
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums text-grafondo">{formatMoney(p.monto)}
                  <span className="ml-2 text-xs font-normal text-gray-400">de {formatMoney(p.orders?.total)}</span>
                </p>
                <p className="mt-1 text-sm text-gray-600">{METODOS[p.metodo]}{p.referencia && <> · Ref. <b>{p.referencia}</b></>}</p>
                {p.cuenta_texto && (
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-600">
                    <Landmark size={15} className="mt-0.5 shrink-0 text-petroleo" /> {p.cuenta_texto}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Avisó el {formatDate(p.creado_en)}
                  {p.confirmado_en && ` · ${p.estado} el ${formatDate(p.confirmado_en)}`}
                </p>
                {p.nota && <p className="mt-2 rounded-lg bg-graclaro p-2 text-xs text-gray-500">{p.nota}</p>}

                {p.estado === 'reportado' && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => atender(p, 'confirmado')}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white">
                      <Check size={15} /> Confirmar
                    </button>
                    <button onClick={() => atender(p, 'rechazado')}
                      className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-600">
                      <X size={15} /> Rechazar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
