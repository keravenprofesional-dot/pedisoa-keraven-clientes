import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Cuántas cosas nuevas tiene por ver la persona conectada, por pantalla
// ({ pedidos, pagos, solicitudes, estadisticas }). Se refresca cada minuto
// y cada vez que alguien marca una pantalla como vista.
export function useNovedades() {
  const [n, setN] = useState({})
  useEffect(() => {
    let vivo = true
    const cargar = () => supabase.rpc('novedades').then(({ data }) => { if (vivo && data) setN(data) })
    cargar()
    const reloj = setInterval(cargar, 60000)
    window.addEventListener('novedades', cargar)
    return () => { vivo = false; clearInterval(reloj); window.removeEventListener('novedades', cargar) }
  }, [])
  return n
}

export async function marcarVisto(seccion) {
  await supabase.rpc('marcar_visto', { p_seccion: seccion })
  window.dispatchEvent(new Event('novedades'))
}

// El punto resaltado con el número.
export function Punto({ n, className = '' }) {
  if (!n) return null
  return (
    <span className={`inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold tabular-nums text-white ring-2 ring-red-500/30 ${className}`}>
      {n > 99 ? '99+' : n}
    </span>
  )
}
