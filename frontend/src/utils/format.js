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

export const STATUS_ORDER = [
  'recibido', 'confirmado', 'preparacion', 'listo', 'despachado', 'en_entrega', 'entregado',
]
