export function formatMoney(value) {
  const n = Number(value || 0)
  return 'RD$' + n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
}

export const STATUS_LABELS = {
  recibido: 'Pedido recibido',
  confirmado: 'Confirmado',
  preparacion: 'En preparación',
  listo: 'Listo para despacho',
  despachado: 'Despachado',
  en_entrega: 'En entrega',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

// Un color por estado, el mismo en todas las pantallas (cliente y personal),
// para saber de un vistazo dónde va cada pedido.
//   punto: el círculo del paso · chip: la etiqueta · linea: la raya entre pasos
//   borde: la franja de arriba de cada columna del seguimiento del personal
export const STATUS_COLORS = {
  recibido:    { punto: 'bg-slate-500',  chip: 'bg-slate-100 text-slate-700 ring-slate-300',    linea: 'bg-slate-300',  borde: 'border-t-slate-500' },
  confirmado:  { punto: 'bg-blue-600',   chip: 'bg-blue-50 text-blue-700 ring-blue-200',        linea: 'bg-blue-300',   borde: 'border-t-blue-600' },
  preparacion: { punto: 'bg-amber-500',  chip: 'bg-amber-50 text-amber-700 ring-amber-200',     linea: 'bg-amber-300',  borde: 'border-t-amber-500' },
  listo:       { punto: 'bg-violet-600', chip: 'bg-violet-50 text-violet-700 ring-violet-200',  linea: 'bg-violet-300', borde: 'border-t-violet-600' },
  despachado:  { punto: 'bg-cyan-600',   chip: 'bg-cyan-50 text-cyan-700 ring-cyan-200',        linea: 'bg-cyan-300',   borde: 'border-t-cyan-600' },
  en_entrega:  { punto: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700 ring-orange-200',  linea: 'bg-orange-300', borde: 'border-t-orange-500' },
  entregado:   { punto: 'bg-green-600',  chip: 'bg-green-50 text-green-700 ring-green-200',     linea: 'bg-green-300',  borde: 'border-t-green-600' },
  cancelado:   { punto: 'bg-red-600',    chip: 'bg-red-50 text-red-700 ring-red-200',           linea: 'bg-red-300',    borde: 'border-t-red-600' },
}
export const colorDe = (estado) => STATUS_COLORS[estado] || STATUS_COLORS.recibido

// Alerta por tiempo parado en la misma etapa (para el personal):
//   más de 24 h → ámbar · más de 48 h → rojo
export function alertaParado(desde) {
  const horas = (Date.now() - new Date(desde).getTime()) / 36e5
  if (horas > 48) return { nivel: 'rojo', clase: 'bg-red-50 ring-1 ring-red-300', texto: 'text-red-600' }
  if (horas > 24) return { nivel: 'ambar', clase: 'bg-amber-50 ring-1 ring-amber-300', texto: 'text-amber-700' }
  return null
}

export const STATUS_ORDER = [
  'recibido', 'confirmado', 'preparacion', 'listo', 'despachado', 'en_entrega', 'entregado',
]
