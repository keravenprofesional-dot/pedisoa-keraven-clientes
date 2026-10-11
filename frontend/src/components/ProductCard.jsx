import { Plus, Layers } from 'lucide-react'
import { formatMoney } from '../utils/format'
import { placaDe } from '../utils/placaProducto'

export default function ProductCard({ product, onAdd, onVer, piezas = 0 }) {
  const agotado = !product.disponible
  const { inicial, familia, sabor, oz, codigo, foil } = placaDe(product)
  // Tocar la tarjeta abre el detalle; el botón de añadir no abre nada.
  const abrir = () => onVer?.(product)

  return (
    <article
      onClick={abrir}
      role={onVer ? 'button' : undefined}
      tabIndex={onVer ? 0 : undefined}
      onKeyDown={(e) => { if (onVer && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir() } }}
      className={`group relative flex flex-col overflow-hidden rounded-[18px] bg-white ring-1 transition
        ${onVer ? 'cursor-pointer active:scale-[0.99]' : ''}
        ${agotado ? 'ring-negro/10' : 'ring-oro/25 hover:ring-oro/60'}`}
    >
      {/* La placa ocupa el lugar de la foto y se sostiene sola */}
      <div className={`placa ${foil} aspect-[4/5] ${agotado ? 'saturate-[0.45] opacity-70' : ''}`}>
        {product.foto_url ? (
          <img src={product.foto_url} alt={product.nombre} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span aria-hidden className="placa-inicial pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[54%] select-none text-[84px] md:text-[108px]">
            {inicial}
          </span>
        )}
        <span aria-hidden className="absolute left-2.5 top-2 font-display text-[11px] leading-none text-oroprof/55">
          K<span className="mx-px opacity-55">/</span>V
        </span>
        {oz != null && (
          <span className="absolute right-2 top-2 rounded-full border border-oro/45 bg-crema/75 px-2 py-px font-sans text-[10px] font-medium tabular-nums tracking-[0.1em] text-oroprof backdrop-blur-[2px]">
            {oz} oz
          </span>
        )}
        {!product.foto_url && (
          <span aria-hidden className="absolute inset-x-0 bottom-2.5 text-center font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-oroprof/60">
            {codigo}
          </span>
        )}
        {agotado && (
          <>
            <span className="absolute inset-0 bg-crema/55" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap border border-negro/25 bg-crema/95 px-3 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.3em] text-negro/70">
              Agotado
            </span>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.28em] text-oroprof">{familia}</p>
        <h3 title={product.nombre} className="mt-1 line-clamp-2 font-display text-[17px] leading-[1.12] text-negro">
          {sabor || product.nombre}
        </h3>
        {product.descripcion && (
          <p className="mt-1.5 line-clamp-2 font-sans text-[12px] leading-snug text-negro/45">{product.descripcion}</p>
        )}
        {piezas > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 font-sans text-[11px] text-oroprof">
            <Layers size={12} strokeWidth={1.8} /> {piezas} productos adentro
          </p>
        )}

        <div className="mt-auto pt-3">
          <div className="filo-oro mb-2.5 opacity-55" />
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[17px] tabular-nums text-negro">{formatMoney(product.precio)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(product) }}
              disabled={agotado}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-negro px-3.5 font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-orosuave transition active:scale-95 disabled:bg-transparent disabled:text-negro/30 disabled:ring-1 disabled:ring-negro/15"
            >
              <Plus size={13} strokeWidth={2} /> Añadir
            </button>
          </div>
        </div>
      </div>

      {agotado && (
        <p className="px-3.5 pb-3 font-sans text-[11px] leading-snug text-negro/45">
          Agotado. Consulta a tu suplidor.
        </p>
      )}
    </article>
  )
}
