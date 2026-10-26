import { useEffect, useState } from 'react'
import { Eye, Users, CalendarDays, ShoppingBag, Package } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney, formatDate } from '../../utils/format'

const PERIODOS = [[7, '7 días'], [30, '30 días'], [90, '90 días']]

// Cuántos clientes entran a la app y qué productos miran y compran más.
// Solo cuentan los clientes: las visitas del personal no suman.
export default function Estadisticas() {
  const [dias, setDias] = useState(30)
  const [e, setE] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setE(null); setError('')
    supabase.rpc('estadisticas', { p_dias: dias }).then(({ data, error: err }) => {
      if (err) setError(err.message); else setE(data)
    })
  }, [dias])

  const maxDia = Math.max(1, ...(e?.por_dia || []).map((d) => d.visitas))

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-grafondo">Estadísticas</h1>
      <p className="mb-5 text-sm text-gray-500">Visitas de los clientes y los productos que más miran y compran.</p>

      <div className="mb-5 flex gap-2">
        {PERIODOS.map(([v, t]) => (
          <button key={v} onClick={() => setDias(v)}
            className={`rounded-full px-4 py-1.5 text-sm ${dias === v ? 'bg-negro text-oro font-semibold' : 'bg-white border border-gray-200 text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {!e && !error && <p className="py-10 text-center text-gray-400">Cargando…</p>}

      {e && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cifra icono={Eye} texto="Visitas" valor={e.visitas} />
            <Cifra icono={CalendarDays} texto="Visitas hoy" valor={e.visitas_hoy} />
            <Cifra icono={Users} texto="Clientes distintos" valor={e.clientes} />
            <Cifra icono={Package} texto="Productos vistos" valor={e.vistas_productos} />
          </div>

          <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-grafondo">Visitas por día</p>
            <div className="flex h-36 items-end gap-[2px]">
              {e.por_dia.map((d) => (
                <div key={d.dia} className="group relative flex h-full flex-1 items-end">
                  <div className="w-full rounded-t bg-oro/80 hover:bg-oroprof" style={{ height: `${(d.visitas / maxDia) * 100}%`, minHeight: d.visitas ? 3 : 1 }} />
                  <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-negro px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                    {d.dia.slice(5).split('-').reverse().join('/')}: {d.visitas}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Ranking titulo="Más vistos" icono={Eye} filas={e.mas_vistos}
              dato={(p) => `${p.vistas} vista${p.vistas == 1 ? '' : 's'}`}
              sub={(p) => (p.quien || []).map((x) => x.vistas > 1 ? `${x.nombre} (${x.vistas})` : x.nombre).join(', ')} />
            <Ranking titulo="Más comprados" icono={ShoppingBag} filas={e.mas_comprados}
              dato={(p) => `${p.unidades} unid.`}
              sub={(p) => `${p.pedidos} pedido${p.pedidos == 1 ? '' : 's'} · ${formatMoney(p.monto)}`} />
          </div>

          <Quienes filas={e.quienes || []} />
        </>
      )}
    </div>
  )
}

function Cifra({ icono: Icono, texto, valor }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <Icono size={18} className="text-petroleo" />
      <p className="mt-2 text-2xl font-bold tabular-nums text-grafondo">{Number(valor || 0).toLocaleString('es-DO')}</p>
      <p className="text-xs text-gray-500">{texto}</p>
    </div>
  )
}

function Ranking({ titulo, icono: Icono, filas, dato, sub }) {
  const max = Math.max(1, ...filas.map((p) => Number(p.vistas ?? p.unidades)))
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-grafondo"><Icono size={16} className="text-petroleo" /> {titulo}</p>
      {filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Todavía no hay datos en este período.</p>
      ) : (
        <ol className="space-y-2.5">
          {filas.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3">
              <span className="w-5 text-right text-xs font-bold text-gray-400">{i + 1}</span>
              {p.foto_url
                ? <img src={p.foto_url} alt="" className="h-9 w-9 flex-none rounded-lg object-cover" />
                : <span className="h-9 w-9 flex-none rounded-lg bg-graclaro" />}
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <p className="truncate text-sm text-grafondo">{p.nombre}</p>
                  <p className="flex-none text-sm font-semibold tabular-nums">{dato(p)}</p>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-graclaro">
                  <div className="h-full rounded-full bg-oro" style={{ width: `${(Number(p.vistas ?? p.unidades) / max) * 100}%` }} />
                </div>
                <p className="mt-0.5 text-[11px] text-gray-400">{sub(p)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// Cada clienta que entró en el período: cuántas veces, cuándo fue la última
// y qué productos miró.
function Quienes({ filas }) {
  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-grafondo"><Users size={16} className="text-petroleo" /> Quién entró y qué miró</p>
      {filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Nadie ha entrado en este período.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {filas.map((c) => (
            <li key={c.profile_id} className="py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-semibold text-grafondo">
                  {c.nombre}{c.numero && <span className="ml-1.5 text-xs font-normal text-gray-400">{c.numero}</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {c.visitas} visita{c.visitas == 1 ? '' : 's'} · última {formatDate(c.ultima)}
                </p>
              </div>
              {c.miro?.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {c.miro.map((m) => (
                    <span key={m.nombre} className="rounded-full bg-graclaro px-2 py-0.5 text-[11px] text-gray-600">
                      {m.nombre}{m.vistas > 1 && ` ×${m.vistas}`}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-gray-400">Entró, pero no abrió ningún producto.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
