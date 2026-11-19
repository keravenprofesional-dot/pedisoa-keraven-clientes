import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Target, Table2, CalendarRange } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'

// VENTAS DEL MES (dentro de Estadísticas)
//   · cuánto se vendió en el mes, en pesos (por defecto el mes pasado)
//   · cada pedido con su clienta, teléfono, forma de pago y fecha de pago,
//     como una hoja de Excel, y botón para bajarla
//   · la proyección del mes siguiente, para compararla con lo vendido

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const FORMA = { contado: 'Contado', credito: 'Crédito', avance: 'Avance' }

// Los meses se manejan como 'AAAA-MM-01' para no pelear con zonas horarias.
const aTexto = (a, m) => `${a}-${String(m + 1).padStart(2, '0')}-01`
function mover(mes, n) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return aTexto(d.getFullYear(), d.getMonth())
}
const hoy = new Date()
const MES_ACTUAL = aTexto(hoy.getFullYear(), hoy.getMonth())
const nombreMes = (mes) => { const [a, m] = mes.split('-').map(Number); return `${MESES[m - 1]} ${a}` }
const dia = (f) => f ? new Date(f).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
const tel = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : (t || '') }

export default function VentasDelMes() {
  const [mes, setMes] = useState(mover(MES_ACTUAL, -1))
  const [v, setV] = useState(null)
  const [error, setError] = useState('')
  const [proyecciones, setProyecciones] = useState([])
  const [version, setVersion] = useState(0) // sube al guardar una proyección, para refrescar el historial

  useEffect(() => {
    setV(null); setError('')
    supabase.rpc('ventas_del_mes', { p_mes: mes }).then(({ data, error: err }) => {
      if (err) setError(err.message); else setV(data)
    })
  }, [mes])

  const cargarProyecciones = () => supabase.from('proyecciones_ventas').select('*').order('mes', { ascending: false })
    .then(({ data }) => setProyecciones(data || []))
  useEffect(() => { cargarProyecciones() }, [])

  const meta = proyecciones.find((p) => p.mes === mes)
  const filas = v?.filas || []
  const debeTotal = filas.reduce((n, f) => n + Number(f.debe || 0), 0)

  function bajarExcel() {
    const cab = ['Fecha', 'Pedido', 'Cliente', 'Nº cliente', 'Teléfono', 'Forma de pago', 'Subtotal', 'Descuento', 'Envío', 'Total', 'Pagado', 'Debe', 'Fecha de pago', 'Estado']
    const num = (x) => Number(x || 0).toFixed(2)
    const lineas = [cab, ...filas.map((f) => [
      dia(f.fecha), f.pedido, f.cliente, f.numero || '', tel(f.telefono), FORMA[f.forma_pago] || f.forma_pago,
      num(f.subtotal), num(f.descuento), num(f.envio), num(f.total), num(f.pagado), num(f.debe),
      f.fecha_pago ? dia(f.fecha_pago) : (Number(f.debe) > 0 ? 'Pendiente' : ''), f.estado,
    ]), [], ['', '', 'TOTAL VENDIDO', '', '', '', '', '', '', num(v.vendido), num(v.cobrado), num(debeTotal)]]
    if (meta) lineas.push(['', '', 'PROYECCIÓN', '', '', '', '', '', '', num(meta.monto)])
    bajarHoja(lineas, `Ventas Keraven ${nombreMes(mes)}`)
  }

  return (
    <section id="ventas-del-mes" className="mb-8 scroll-mt-4">
      {/* Franja del mes: el número grande */}
      <div className="overflow-hidden rounded-2xl bg-negro text-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orosuave">Ventas del mes</p>
          <div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
            <button onClick={() => setMes(mover(mes, -1))} className="rounded-full p-1 hover:bg-white/10" title="Mes anterior"><ChevronLeft size={16} /></button>
            <span className="min-w-[8.5rem] text-center text-sm font-semibold capitalize">{nombreMes(mes)}</span>
            <button onClick={() => setMes(mover(mes, 1))} disabled={mes >= MES_ACTUAL}
              className="rounded-full p-1 hover:bg-white/10 disabled:opacity-30" title="Mes siguiente"><ChevronRight size={16} /></button>
          </div>
        </div>

        {error && <p className="m-5 rounded-xl bg-red-500/20 p-3 text-sm text-red-200">{error}</p>}
        {!v && !error && <p className="px-5 py-10 text-center text-white/50">Cargando…</p>}
        {v && (
          <div className="grid gap-4 px-5 pb-5 pt-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="font-display text-4xl font-bold tabular-nums text-oro md:text-5xl">{formatMoney(v.vendido)}</p>
              <p className="mt-1 text-sm text-white/70">
                {v.pedidos} pedido{v.pedidos == 1 ? '' : 's'} · {v.clientes} cliente{v.clientes == 1 ? '' : 's'}
                {Number(v.cancelados) > 0 && ` · ${v.cancelados} cancelado${v.cancelados == 1 ? '' : 's'} (no cuentan)`}
              </p>
              <p className="mt-0.5 text-sm text-white/70">
                Cobrado {formatMoney(v.cobrado)}{debeTotal > 0 && <> · <span className="font-semibold text-red-300">Por cobrar {formatMoney(debeTotal)}</span></>}
              </p>
            </div>
            <Cumplimiento meta={meta} vendido={Number(v.vendido)} />
          </div>
        )}
      </div>

      {/* La hoja */}
      {v && (
        <div className="mt-3 rounded-2xl border border-gray-100 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-grafondo"><Table2 size={16} className="text-petroleo" /> Quién nos compró en {nombreMes(mes)}</p>
            <button onClick={bajarExcel} disabled={!filas.length}
              className="flex items-center gap-1.5 rounded-full bg-negro px-3 py-1.5 text-xs font-semibold text-oro disabled:opacity-40">
              <Download size={14} /> Descargar Excel
            </button>
          </div>
          {filas.length === 0 ? (
            <p className="px-4 pb-6 text-center text-sm text-gray-400">No hubo ventas en este mes.</p>
          ) : (
            <div className="max-h-[28rem] overflow-auto border-t border-gray-100">
              <table className="w-full min-w-[56rem] border-collapse whitespace-nowrap text-sm">
                <thead className="sticky top-0 bg-cremaoscura text-left text-[11px] uppercase tracking-wide text-tinta">
                  <tr>
                    {['Fecha', 'Pedido', 'Cliente', 'Teléfono', 'Pago', 'Total', 'Pagado', 'Debe', 'Fecha de pago'].map((h, i) => (
                      <th key={h} className={`border-b border-r border-gray-200 px-2.5 py-2 font-semibold last:border-r-0 ${i >= 5 && i <= 7 ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={f.id} className={i % 2 ? 'bg-crema/60' : ''}>
                      <td className="border-b border-r border-gray-100 px-2.5 py-1.5 tabular-nums">{dia(f.fecha)}</td>
                      <td className="border-b border-r border-gray-100 px-2.5 py-1.5 font-mono text-xs">{f.pedido}</td>
                      <td className="border-b border-r border-gray-100 px-2.5 py-1.5">{f.cliente} <span className="text-[11px] text-gray-400">{f.numero}</span></td>
                      <td className="border-b border-r border-gray-100 px-2.5 py-1.5 tabular-nums">{tel(f.telefono)}</td>
                      <td className="border-b border-r border-gray-100 px-2.5 py-1.5">
                        <span className={f.forma_pago === 'contado' ? 'text-gray-600' : 'font-semibold text-oroprof'}>{FORMA[f.forma_pago] || f.forma_pago}</span>
                      </td>
                      <td className="border-b border-r border-gray-100 px-2.5 py-1.5 text-right tabular-nums">{formatMoney(f.total)}</td>
                      <td className="border-b border-r border-gray-100 px-2.5 py-1.5 text-right tabular-nums text-green-700">{Number(f.pagado) > 0 ? formatMoney(f.pagado) : '—'}</td>
                      <td className={`border-b border-r border-gray-100 px-2.5 py-1.5 text-right tabular-nums ${Number(f.debe) > 0 ? 'font-bold text-red-600' : 'text-gray-400'}`}>
                        {Number(f.debe) > 0 ? formatMoney(f.debe) : '—'}
                      </td>
                      <td className="border-b border-gray-100 px-2.5 py-1.5 tabular-nums">
                        {f.fecha_pago ? dia(f.fecha_pago) : Number(f.debe) > 0 ? <span className="font-semibold text-red-600">Pendiente</span> : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-cremaoscura font-bold">
                  <tr>
                    <td colSpan={5} className="border-t border-gray-200 px-2.5 py-2 text-right text-xs uppercase tracking-wide">Total del mes</td>
                    <td className="border-t border-gray-200 px-2.5 py-2 text-right tabular-nums">{formatMoney(v.vendido)}</td>
                    <td className="border-t border-gray-200 px-2.5 py-2 text-right tabular-nums text-green-700">{formatMoney(v.cobrado)}</td>
                    <td className="border-t border-gray-200 px-2.5 py-2 text-right tabular-nums text-red-600">{formatMoney(debeTotal)}</td>
                    <td className="border-t border-gray-200" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      <Proyeccion proyecciones={proyecciones} alGuardar={() => { cargarProyecciones(); setVersion((n) => n + 1) }} />

      <Historial version={version} mesAbierto={mes}
        alElegir={(m) => { setMes(m); document.getElementById('ventas-del-mes')?.scrollIntoView({ behavior: 'smooth' }) }} />
    </section>
  )
}

// Bajar una hoja a Excel: texto con tabulaciones en UTF-16 (Excel lo abre directo, con tildes).
function bajarHoja(lineas, nombre) {
  const txt = lineas.map((l) => l.map((c) => String(c ?? '').replace(/[\t\n]/g, ' ')).join('\t')).join('\r\n')
  const bytes = new Uint8Array(2 + txt.length * 2)
  bytes[0] = 0xFF; bytes[1] = 0xFE
  for (let i = 0; i < txt.length; i++) { const c = txt.charCodeAt(i); bytes[2 + i * 2] = c & 255; bytes[3 + i * 2] = c >> 8 }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'text/csv;charset=utf-16le' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${nombre}.csv`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// HISTORIAL: todos los meses desde que empezó el programa, con el mismo
// formato de Ventas del mes. Tocar un mes lo abre arriba con su hoja.
function Historial({ version, mesAbierto, alElegir }) {
  const [h, setH] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('ventas_por_mes').then(({ data, error: err }) => {
      if (err) setError(err.message); else { setH(data); setError('') }
    })
  }, [version])

  const meses = h?.meses || []
  const suma = (k) => meses.reduce((n, m) => n + Number(m[k] || 0), 0)
  const max = Math.max(1, ...meses.map((m) => Number(m.vendido)))
  const pct = (m) => (Number(m.proyeccion) > 0 ? Math.round((Number(m.vendido) / Number(m.proyeccion)) * 100) : null)

  function bajar() {
    const n = (x) => Number(x || 0).toFixed(2)
    bajarHoja([
      ['Mes', 'Vendido', 'Cobrado', 'Por cobrar', 'Pedidos', 'Clientes', 'Cancelados', 'Proyección', '% logrado'],
      ...meses.map((m) => [nombreMes(m.mes), n(m.vendido), n(m.cobrado), n(m.por_cobrar), m.pedidos, m.clientes, m.cancelados,
        m.proyeccion != null ? n(m.proyeccion) : '', pct(m) != null ? `${pct(m)}%` : '']),
      [],
      ['TOTAL', n(suma('vendido')), n(suma('cobrado')), n(suma('por_cobrar')), suma('pedidos'), '', suma('cancelados')],
    ], `Historial de ventas Keraven ${dia(new Date())}`.replace(/\//g, '-'))
  }

  return (
    <div className="mt-3 rounded-2xl border border-gray-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-grafondo"><CalendarRange size={16} className="text-petroleo" /> Historial mes por mes</p>
          {h && <p className="text-[11px] text-gray-500">Desde {nombreMes(h.desde)} hasta hoy. Toca un mes para ver quién compró.</p>}
        </div>
        <button onClick={bajar} disabled={!meses.length}
          className="flex items-center gap-1.5 rounded-full bg-negro px-3 py-1.5 text-xs font-semibold text-oro disabled:opacity-40">
          <Download size={14} /> Descargar Excel
        </button>
      </div>
      {error && <p className="px-4 pb-4 text-sm text-red-600">{error}</p>}
      {!h && !error && <p className="px-4 pb-6 text-center text-sm text-gray-400">Cargando…</p>}
      {h && (
        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full min-w-[52rem] border-collapse whitespace-nowrap text-sm">
            <thead className="bg-cremaoscura text-left text-[11px] uppercase tracking-wide text-tinta">
              <tr>
                {['Mes', 'Vendido', 'Cobrado', 'Por cobrar', 'Pedidos', 'Clientes', 'Cancel.', 'Proyección'].map((t, i) => (
                  <th key={t} className={`border-b border-r border-gray-200 px-2.5 py-2 font-semibold last:border-r-0 ${i ? 'text-right' : ''}`}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meses.map((m, i) => {
                const abierto = m.mes === mesAbierto
                const p = pct(m)
                return (
                  <tr key={m.mes} onClick={() => alElegir(m.mes)} title="Ver este mes arriba"
                    className={`cursor-pointer ${abierto ? 'bg-orosuave/30' : i % 2 ? 'bg-crema/60' : ''} hover:bg-orosuave/20`}>
                    <td className="border-b border-r border-gray-100 px-2.5 py-1.5 font-semibold capitalize">
                      {nombreMes(m.mes)}{m.mes === MES_ACTUAL && <span className="ml-1.5 text-[10px] font-normal normal-case text-gray-400">(en curso)</span>}
                    </td>
                    <td className="border-b border-r border-gray-100 px-2.5 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-graclaro md:inline-block">
                          <span className="block h-full rounded-full bg-oro" style={{ width: `${(Number(m.vendido) / max) * 100}%` }} />
                        </span>
                        <span className="font-semibold tabular-nums">{formatMoney(m.vendido)}</span>
                      </div>
                    </td>
                    <td className="border-b border-r border-gray-100 px-2.5 py-1.5 text-right tabular-nums text-green-700">{formatMoney(m.cobrado)}</td>
                    <td className={`border-b border-r border-gray-100 px-2.5 py-1.5 text-right tabular-nums ${Number(m.por_cobrar) > 0 ? 'font-bold text-red-600' : 'text-gray-400'}`}>
                      {Number(m.por_cobrar) > 0 ? formatMoney(m.por_cobrar) : '—'}
                    </td>
                    <td className="border-b border-r border-gray-100 px-2.5 py-1.5 text-right tabular-nums">{m.pedidos}</td>
                    <td className="border-b border-r border-gray-100 px-2.5 py-1.5 text-right tabular-nums">{m.clientes}</td>
                    <td className="border-b border-r border-gray-100 px-2.5 py-1.5 text-right tabular-nums text-gray-500">{m.cancelados || '—'}</td>
                    <td className="border-b border-gray-100 px-2.5 py-1.5 text-right tabular-nums">
                      {m.proyeccion != null
                        ? <>{formatMoney(m.proyeccion)} <span className={`ml-1 text-xs font-bold ${p >= 100 ? 'text-green-700' : 'text-oroprof'}`}>{p}%</span></>
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-cremaoscura font-bold">
              <tr>
                <td className="border-t border-gray-200 px-2.5 py-2 text-xs uppercase tracking-wide">Total</td>
                <td className="border-t border-gray-200 px-2.5 py-2 text-right tabular-nums">{formatMoney(suma('vendido'))}</td>
                <td className="border-t border-gray-200 px-2.5 py-2 text-right tabular-nums text-green-700">{formatMoney(suma('cobrado'))}</td>
                <td className="border-t border-gray-200 px-2.5 py-2 text-right tabular-nums text-red-600">{formatMoney(suma('por_cobrar'))}</td>
                <td className="border-t border-gray-200 px-2.5 py-2 text-right tabular-nums">{suma('pedidos')}</td>
                <td className="border-t border-gray-200" />
                <td className="border-t border-gray-200 px-2.5 py-2 text-right tabular-nums text-gray-500">{suma('cancelados') || '—'}</td>
                <td className="border-t border-gray-200" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// Qué tanto se llegó a lo proyectado para ese mes.
function Cumplimiento({ meta, vendido }) {
  if (!meta) return <p className="text-xs text-white/50 md:text-right">Este mes no tenía proyección.</p>
  const pct = Number(meta.monto) > 0 ? Math.round((vendido / Number(meta.monto)) * 100) : 0
  return (
    <div className="md:w-64">
      <div className="flex items-baseline justify-between text-xs text-white/70">
        <span>Proyección {formatMoney(meta.monto)}</span>
        <span className={`text-base font-bold ${pct >= 100 ? 'text-green-300' : 'text-orosuave'}`}>{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-400' : 'bg-oro'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

// Lo que se espera vender el mes que viene (o cualquier mes por venir).
function Proyeccion({ proyecciones, alGuardar }) {
  const siguiente = mover(MES_ACTUAL, 1)
  const opciones = useMemo(() => [MES_ACTUAL, siguiente, mover(MES_ACTUAL, 2), mover(MES_ACTUAL, 3)], [siguiente])
  const [mes, setMes] = useState(siguiente)
  const actual = proyecciones.find((p) => p.mes === mes)
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setMonto(actual ? String(Number(actual.monto)) : '')
    setNota(actual?.nota || '')
    setAviso('')
  }, [mes, actual?.monto, actual?.nota])

  async function guardar(e) {
    e.preventDefault()
    const valor = Number(String(monto).replace(/[^\d.]/g, ''))
    if (!(valor > 0)) return setAviso('Escribe cuánto esperas vender')
    setGuardando(true)
    const { error } = await supabase.from('proyecciones_ventas').upsert({ mes, monto: valor, nota }, { onConflict: 'mes' })
    setGuardando(false)
    if (error) return setAviso(error.message)
    setAviso(`Proyección de ${nombreMes(mes)} guardada: ${formatMoney(valor)}.`)
    alGuardar()
  }

  return (
    <form onSubmit={guardar} className="mt-3 rounded-2xl border border-dashed border-oro/60 bg-crema p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-grafondo"><Target size={16} className="text-oroprof" /> Proyección de ventas</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-600">Mes
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="mt-1 block rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm capitalize">
            {opciones.map((m) => <option key={m} value={m}>{nombreMes(m)}{m === siguiente ? ' (siguiente)' : ''}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">Espero vender (RD$)
          <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej. 80000"
            className="mt-1 block w-36 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm tabular-nums" />
        </label>
        <label className="min-w-[12rem] flex-1 text-xs text-gray-600">Nota (opcional)
          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} placeholder="Ej. temporada de Navidad"
            className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm" />
        </label>
        <button disabled={guardando} className="rounded-full bg-negro px-4 py-2 text-sm font-semibold text-oro disabled:opacity-60">
          {guardando ? 'Guardando…' : actual ? 'Cambiar' : 'Guardar'}
        </button>
      </div>
      {actual?.puesto_por_texto && (
        <p className="mt-2 text-[11px] text-gray-500">Puesta por {actual.puesto_por_texto} el {dia(actual.actualizado_en)}.</p>
      )}
      {aviso && <p className="mt-2 text-sm text-oroprof">{aviso}</p>}
    </form>
  )
}
