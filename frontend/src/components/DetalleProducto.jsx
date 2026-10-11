import { useEffect } from 'react'
import { X, Plus, Check } from 'lucide-react'
import { formatMoney } from '../utils/format'

// Lo que ve el cliente al tocar un producto. Para una línea, un Duo Pack o un
// Duo Kit lo importante es el listado de adentro: nadie compra una caja de
// RD$4,900 sin saber qué trae.
export default function DetalleProducto({ producto, contenido = [], alCerrar, alAgregar }) {
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && alCerrar()
    window.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
    }
  }, [alCerrar])

  const agotado = !producto.disponible
  const piezas = contenido.reduce((s, c) => s + (c.cantidad || 1), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-negro/45 backdrop-blur-[2px]" onClick={alCerrar} />

      <div className="relative w-full md:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-crema shadow-2xl">
        <div className="sticky top-0 z-10 bg-crema/95 backdrop-blur px-5 pt-5 pb-3">
          <button
            onClick={alCerrar}
            aria-label="Cerrar"
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-negro/15 text-negro/50 hover:text-negro"
          >
            <X size={16} strokeWidth={1.6} />
          </button>
          {producto.codigo && (
            <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-oro">{producto.codigo}</p>
          )}
          <h2 className="mt-1.5 pr-10 font-display text-[26px] leading-[1.1] text-negro">{producto.nombre}</h2>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-display text-[22px] tabular-nums text-negro">{formatMoney(producto.precio)}</span>
            {agotado && (
              <span className="border border-negro/25 px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.28em] text-negro/60">
                Agotado
              </span>
            )}
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-oro/70 via-oro/25 to-transparent" />
        </div>

        <div className="px-5 pb-5">
          {producto.descripcion && (
            <p className="mb-5 font-sans text-[13.5px] leading-relaxed text-negro/60">{producto.descripcion}</p>
          )}

          {contenido.length > 0 ? (
            <>
              <div className="mb-3 flex items-baseline gap-3">
                <h3 className="font-display text-[15px] uppercase tracking-[0.1em] text-negro">Lo que incluye</h3>
                <span className="h-px flex-1 bg-oro/30" />
                <span className="font-sans text-[11px] tabular-nums uppercase tracking-[0.16em] text-negro/40">
                  {piezas} {piezas === 1 ? 'pieza' : 'piezas'}
                </span>
              </div>
              <ul className="space-y-px overflow-hidden rounded-2xl border border-oro/25 bg-white/70">
                {contenido.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 border-b border-oro/12 px-4 py-3 last:border-0"
                  >
                    <Check size={14} strokeWidth={2} className="shrink-0 text-oro" />
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[13.5px] leading-snug text-negro/85">{c.nombre}</p>
                      {c.codigo && (
                        <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-negro/35">{c.codigo}</p>
                      )}
                    </div>
                    {c.cantidad > 1 && (
                      <span className="shrink-0 rounded-full bg-negro px-2.5 py-0.5 font-sans text-[11px] font-medium tabular-nums text-oro">
                        ×{c.cantidad}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="font-sans text-[13px] leading-relaxed text-negro/45">
              Producto individual.
            </p>
          )}

          <button
            onClick={() => { alAgregar(producto); alCerrar() }}
            disabled={agotado}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-negro py-3.5 font-sans text-[12px] font-medium uppercase tracking-[0.22em] text-oro transition active:scale-[0.99] disabled:bg-transparent disabled:text-negro/35 disabled:ring-1 disabled:ring-negro/15"
          >
            {agotado ? 'Agotado' : (<><Plus size={15} strokeWidth={2} /> Agregar al pedido</>)}
          </button>
          {agotado && (
            <p className="mt-2 text-center font-sans text-[12px] text-negro/45">
              Ponerse en contacto con su suplidor.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
