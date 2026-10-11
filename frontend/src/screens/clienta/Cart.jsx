import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ChevronDown } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'

export default function Cart() {
  const { items, updateQty, removeItem, subtotal } = useCart()
  const navigate = useNavigate()
  const [contenidos, setContenidos] = useState({})
  const [abierto, setAbierto] = useState({})

  // Qué trae adentro cada caja del carrito, para que el cliente vea lo que
  // está comprando antes de confirmar.
  useEffect(() => {
    const ids = [...new Set(items.map((i) => i.product.id))]
    if (!ids.length) return
    supabase
      .from('product_items')
      .select('product_id, cantidad, componente:products!product_items_componente_id_fkey(id, nombre, codigo)')
      .in('product_id', ids)
      .then(({ data }) => {
        const mapa = {}
        for (const p of data || []) {
          if (!p.componente) continue
          ;(mapa[p.product_id] ||= []).push({ ...p.componente, cantidad: p.cantidad })
        }
        for (const l of Object.values(mapa)) l.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        setContenidos(mapa)
      })
  }, [items])

  if (items.length === 0) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-negro/40 mb-4">Tu carrito está vacío.</p>
        <button onClick={() => navigate('/catalogo')} className="font-semibold text-negro underline decoration-oro underline-offset-4">
          Ir al catálogo
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 pb-40 md:pb-6 max-w-2xl mx-auto">
      <h1 className="font-display text-[28px] leading-none text-negro mb-5">Tu pedido</h1>

      <div className="flex flex-col gap-3">
        {items.map(({ clave, product, cantidad, sabores }) => {
          const dentro = contenidos[product.id] || []
          const ver = abierto[clave]
          return (
            <div key={clave} className="rounded-2xl border border-oro/25 bg-white overflow-hidden">
              <div className="flex gap-3 p-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 vitrina flex items-center justify-center">
                  {product.foto_url
                    ? <img src={product.foto_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[10px] text-negro/25">Sin foto</span>}
                </div>

                <div className="flex-1 min-w-0">
                  {product.codigo && (
                    <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-oro">{product.codigo}</p>
                  )}
                  <p className="font-display text-[16px] leading-tight text-negro">{product.nombre}</p>
                  {/* En una caja armada, los sabores que eligió */}
                  {sabores?.length > 0 && (
                    <p className="text-xs text-negro/55">
                      {product.armado?.unidades_por_grupo / sabores.length} de cada uno · {sabores.join(' y ')}
                    </p>
                  )}
                  <p className="mt-0.5 font-sans text-[12px] text-negro/50 tabular-nums">
                    {formatMoney(product.precio)} c/u × {cantidad}
                  </p>
                </div>

                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => removeItem(clave)} className="text-negro/30 hover:text-red-500 p-1" aria-label="Quitar">
                    <Trash2 size={15} strokeWidth={1.6} />
                  </button>
                  <span className="font-display text-[17px] tabular-nums text-negro">
                    {formatMoney(product.precio * cantidad)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-oro/15 px-3 py-2">
                {dentro.length > 0 ? (
                  <button
                    onClick={() => setAbierto((a) => ({ ...a, [clave]: !a[clave] }))}
                    className="flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-[0.14em] text-negro/55 hover:text-negro"
                  >
                    <ChevronDown size={13} strokeWidth={2} className={`transition ${ver ? 'rotate-180' : ''}`} />
                    {dentro.reduce((s, c) => s + (c.cantidad || 1), 0)} productos adentro
                  </button>
                ) : <span />}

                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(clave, cantidad - 1)} className="p-1.5 rounded-full border border-negro/12" aria-label="Menos">
                    <Minus size={13} />
                  </button>
                  <span className="w-6 text-center font-semibold tabular-nums">{cantidad}</span>
                  <button onClick={() => updateQty(clave, cantidad + 1)} className="p-1.5 rounded-full border border-negro/12" aria-label="Más">
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {ver && dentro.length > 0 && (
                <ul className="bg-crema/60 px-3 py-2">
                  {dentro.map((c) => (
                    <li key={c.id} className="flex items-baseline gap-2 py-1 font-sans text-[12.5px] text-negro/70">
                      <span className="text-oro">◆</span>
                      <span className="flex-1">{c.nombre}</span>
                      {c.cantidad > 1 && <span className="tabular-nums text-negro/45">×{c.cantidad}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-oro/30 p-4 md:relative md:mt-6 md:border md:rounded-2xl">
        <div className="flex justify-between text-sm text-negro/55 mb-1">
          <span>Subtotal</span><span className="tabular-nums">{formatMoney(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-negro/55 mb-3">
          <span>Envío</span><span>Se calcula en el siguiente paso</span>
        </div>
        <div className="flex justify-between font-display text-[20px] text-negro mb-3">
          <span>Total estimado</span><span className="tabular-nums">{formatMoney(subtotal)}</span>
        </div>
        <button
          onClick={() => navigate('/checkout')}
          className="w-full rounded-full bg-negro py-3.5 font-sans text-[12px] font-medium uppercase tracking-[0.22em] text-oro active:scale-[0.99] transition"
        >
          Continuar con el pedido
        </button>
      </div>
    </div>
  )
}
