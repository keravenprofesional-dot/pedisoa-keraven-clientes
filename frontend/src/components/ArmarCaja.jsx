import { useMemo, useState } from 'react'
import { X, Check } from 'lucide-react'
import { formatMoney } from '../utils/format'

// Ventana para que el cliente arme su caja: elige 1 o 2 sabores y el
// programa reparte las unidades en partes iguales. Las mismas reglas las
// vuelve a revisar el servidor al guardar el pedido.
export default function ArmarCaja({ producto, alCerrar, alAgregar }) {
  const receta = producto.armado
  const maximo = Number(receta?.max_sabores || 1)
  const porGrupo = Number(receta?.unidades_por_grupo || 0)
  const grupos = receta?.grupos || []
  const sabores = receta?.sabores || []

  const [elegidos, setElegidos] = useState([])

  // Con cuántos sabores se puede repartir en partes iguales.
  const permitidos = useMemo(
    () => Array.from({ length: maximo }, (_, i) => i + 1).filter((n) => porGrupo % n === 0),
    [maximo, porGrupo]
  )
  const cabe = elegidos.length < maximo

  function alternar(nombre) {
    setElegidos((prev) => prev.includes(nombre)
      ? prev.filter((x) => x !== nombre)
      : (prev.length < maximo ? [...prev, nombre] : prev))
  }

  const reparto = elegidos.length && permitidos.includes(elegidos.length)
    ? porGrupo / elegidos.length
    : null

  const listo = reparto !== null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-6" onClick={alCerrar}>
      <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start gap-3">
          <div className="flex-1">
            <h2 className="font-bold text-petroleo text-lg leading-tight">{producto.nombre}</h2>
            <p className="text-sm text-gray-500">
              {grupos.map((g) => `${porGrupo} ${g.toLowerCase()}`).join(' + ')} · {formatMoney(producto.precio)}
            </p>
          </div>
          <button onClick={alCerrar} className="text-gray-400 p-1" aria-label="Cerrar"><X size={22} /></button>
        </div>

        <div className="p-5">
          <p className="text-sm text-grafondo mb-1 font-semibold">
            Elige {maximo > 1 ? `hasta ${maximo} sabores` : 'el sabor'} para tu caja
          </p>
          <p className="text-xs text-gray-500 mb-3">
            {permitidos.map((n) => `con ${n} sabor${n > 1 ? 'es' : ''} te llevas ${porGrupo / n} de cada uno`).join(' · ')}.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {sabores.map((s) => {
              const marcado = elegidos.includes(s.nombre)
              const bloqueado = !marcado && !cabe
              return (
                <button
                  key={s.nombre}
                  onClick={() => alternar(s.nombre)}
                  disabled={bloqueado}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm text-left transition ${
                    marcado ? 'border-dorado bg-dorado/10 font-bold text-petroleo'
                      : bloqueado ? 'border-gray-100 text-gray-300'
                      : 'border-gray-200 text-grafondo'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${marcado ? 'border-dorado bg-dorado text-white' : 'border-gray-300'}`}>
                    {marcado && <Check size={13} />}
                  </span>
                  {s.nombre}
                </button>
              )
            })}
          </div>

          {!cabe && (
            <p className="text-xs text-gray-500 mt-3">
              Ya elegiste {maximo}. Para cambiar uno, tócalo otra vez para quitarlo.
            </p>
          )}

          {listo && (
            <div className="bg-graclaro rounded-xl p-3 mt-4 text-sm">
              <p className="font-semibold text-grafondo mb-1">Tu caja lleva:</p>
              <ul className="text-gray-600 space-y-0.5">
                {grupos.map((g) => elegidos.map((s) => (
                  <li key={g + s}>• {reparto} {g.toLowerCase()} de {s}</li>
                )))}
              </ul>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
          <button
            disabled={!listo}
            onClick={() => { alAgregar(elegidos); alCerrar() }}
            className="w-full bg-petroleo disabled:bg-gray-300 text-white rounded-xl py-3 font-bold"
          >
            {listo ? 'Agregar al carrito' : 'Elige el sabor de tu caja'}
          </button>
        </div>
      </div>
    </div>
  )
}
