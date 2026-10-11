import { useMemo, useState } from 'react'
import { Wand2, Plus, X } from 'lucide-react'
import { nombreDeSabor, partirCodigo } from '../../utils/codigoProducto'

// Receta de una caja que el cliente arma (ej. 8 shampoo + 8 mascarilla,
// a elegir 1 o 2 sabores). `valor` es el objeto que se guarda en
// products.armado; `alCambiar` lo devuelve cambiado.
const RECETA_NUEVA = { unidades_por_grupo: 8, max_sabores: 2, grupos: ['Shampoo', 'Mascarilla'], sabores: [] }

export default function ArmadoCaja({ valor, alCambiar, productos }) {
  const receta = valor || RECETA_NUEVA
  const [familias, setFamilias] = useState([]) // una por grupo, ej. "SH|16"

  const poner = (cambios) => alCambiar({ ...receta, ...cambios })

  // Familias de productos que comparten tipo y tamaño: "SH-*-16" son los
  // 7 shampoos de 16 oz. Sirve para rellenar los sabores de un tirón.
  const porFamilia = useMemo(() => {
    const m = new Map()
    for (const p of productos) {
      const c = partirCodigo(p.codigo)
      if (!c?.sabor) continue
      const clave = `${c.tipo}|${c.tamano}`
      if (!m.has(clave)) m.set(clave, [])
      m.get(clave).push({ ...p, sabor: c.sabor })
    }
    return [...m.entries()].filter(([, l]) => l.length >= 2).sort((a, b) => b[1].length - a[1].length)
  }, [productos])

  const etiquetaFamilia = (clave) => {
    const [tipo, tam] = clave.split('|')
    return `${tipo}-*-${tam || 'sin tamaño'}  (${porFamilia.find(([k]) => k === clave)?.[1].length} productos)`
  }

  // Arma las filas de sabores cruzando las familias elegidas.
  function rellenar() {
    const listas = receta.grupos.map((_, i) => porFamilia.find(([k]) => k === familias[i])?.[1] || [])
    if (listas.some((l) => !l.length)) return
    const comunes = listas[0]
      .map((p) => p.sabor)
      .filter((s) => listas.every((l) => l.some((p) => p.sabor === s)))
    poner({
      sabores: comunes.map((s) => ({
        nombre: nombreDeSabor(s),
        productos: listas.map((l) => l.find((p) => p.sabor === s).id),
      })),
    })
  }

  const cambiarSabor = (i, cambios) => poner({
    sabores: receta.sabores.map((s, k) => (k === i ? { ...s, ...cambios } : s)),
  })
  const cambiarProducto = (i, g, id) => cambiarSabor(i, {
    productos: receta.sabores[i].productos.map((x, k) => (k === g ? id : x)),
  })
  const quitarSabor = (i) => poner({ sabores: receta.sabores.filter((_, k) => k !== i) })
  const agregarSabor = () => poner({ sabores: [...receta.sabores, { nombre: '', productos: receta.grupos.map(() => '') }] })

  function cambiarGrupos(n) {
    const grupos = Array.from({ length: n }, (_, i) => receta.grupos[i] || `Grupo ${i + 1}`)
    poner({
      grupos,
      sabores: receta.sabores.map((s) => ({ ...s, productos: grupos.map((_, i) => s.productos[i] || '') })),
    })
  }

  const repartos = Array.from({ length: Number(receta.max_sabores) || 1 }, (_, i) => i + 1)
    .filter((n) => Number(receta.unidades_por_grupo) % n === 0)
  const input = 'mt-1 w-full border border-gray-200 rounded-lg px-3 py-2'

  return (
    <div className="bg-graclaro rounded-xl p-3 mt-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="text-sm">Unidades de cada grupo
          <input type="number" min="1" max="99" value={receta.unidades_por_grupo}
            onChange={(e) => poner({ unidades_por_grupo: Number(e.target.value) })} className={input} />
        </label>
        <label className="text-sm">Sabores que puede elegir
          <input type="number" min="1" max="4" value={receta.max_sabores}
            onChange={(e) => poner({ max_sabores: Number(e.target.value) })} className={input} />
        </label>
        <label className="text-sm">¿Cuántos grupos?
          <select value={receta.grupos.length} onChange={(e) => cambiarGrupos(Number(e.target.value))} className={input}>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="text-sm self-end pb-2 text-gray-600">
          Total: <strong>{receta.unidades_por_grupo * receta.grupos.length} unidades</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        {receta.grupos.map((g, i) => (
          <label key={i} className="text-sm">Nombre del grupo {i + 1}
            <input value={g} placeholder="Ej. Shampoo"
              onChange={(e) => poner({ grupos: receta.grupos.map((x, k) => (k === i ? e.target.value : x)) })} className={input} />
          </label>
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-2">
        {repartos.length
          ? repartos.map((n) => `con ${n} sabor${n > 1 ? 'es' : ''}: ${receta.unidades_por_grupo / n} de cada uno`).join(' · ')
          : 'Ojo: con esos números no se puede repartir en partes iguales.'}
      </p>

      {/* Rellenar de un tirón usando los códigos */}
      <div className="bg-white rounded-xl p-3 mt-3 border border-gray-200">
        <p className="text-sm font-semibold text-grafondo mb-2">
          <Wand2 size={15} className="inline mr-1 text-dorado" />
          Rellenar los sabores solo
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {receta.grupos.map((g, i) => (
            <label key={i} className="text-sm">{g || `Grupo ${i + 1}`}: ¿qué productos son?
              <select value={familias[i] || ''} onChange={(e) => setFamilias((p) => { const n = [...p]; n[i] = e.target.value; return n })} className={input}>
                <option value="">Elige…</option>
                {porFamilia.map(([k]) => <option key={k} value={k}>{etiquetaFamilia(k)}</option>)}
              </select>
            </label>
          ))}
        </div>
        <button type="button" onClick={rellenar}
          disabled={receta.grupos.some((_, i) => !familias[i])}
          className="mt-2 bg-dorado text-petroleo rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-40">
          Buscar los sabores que tienen los dos
        </button>
      </div>

      {/* Los sabores */}
      <div className="mt-3">
        <p className="text-sm font-semibold text-grafondo mb-1">Sabores de la caja ({receta.sabores.length})</p>
        <div className="flex flex-col gap-2">
          {receta.sabores.map((s, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-2 flex flex-wrap items-end gap-2">
              <label className="text-xs flex-1 min-w-[8rem]">Sabor
                <input value={s.nombre} placeholder="Ej. Coco" onChange={(e) => cambiarSabor(i, { nombre: e.target.value })}
                  className="mt-0.5 w-full border border-gray-200 rounded px-2 py-1 text-sm" />
              </label>
              {receta.grupos.map((g, gi) => (
                <label key={gi} className="text-xs flex-[2] min-w-[12rem]">{g || `Grupo ${gi + 1}`}
                  <select value={s.productos[gi] || ''} onChange={(e) => cambiarProducto(i, gi, e.target.value)}
                    className="mt-0.5 w-full border border-gray-200 rounded px-2 py-1 text-sm">
                    <option value="">Elige el producto…</option>
                    {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} · ` : ''}{p.nombre}</option>)}
                  </select>
                </label>
              ))}
              <button type="button" onClick={() => quitarSabor(i)} className="text-gray-400 hover:text-red-500 pb-1"><X size={16} /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={agregarSabor} className="mt-2 flex items-center gap-1 text-sm text-petroleo font-semibold">
          <Plus size={15} /> Agregar un sabor a mano
        </button>
      </div>
    </div>
  )
}
