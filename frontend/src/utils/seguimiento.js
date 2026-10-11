// Las etapas del pedido, con el nombre del departamento que lo tiene.
// El cliente ve "qué está pasando con lo mío"; el personal ve "en qué mano está".
export const ETAPAS = [
  {
    estado: 'recibido',
    titulo: 'Pedido recibido',
    departamento: 'Ventas',
    cliente: 'Keraven ya tiene tu pedido.',
  },
  {
    estado: 'confirmado',
    titulo: 'Pedido confirmado',
    departamento: 'Ventas',
    cliente: 'Revisamos tu pedido y está confirmado.',
  },
  {
    estado: 'preparacion',
    titulo: 'En preparación',
    departamento: 'Producción',
    cliente: 'Estamos preparando tus productos.',
  },
  {
    estado: 'listo',
    titulo: 'Almacén lo recibió',
    departamento: 'Almacén',
    cliente: 'Tu pedido está en almacén, listo para despacho.',
  },
  {
    estado: 'despachado',
    titulo: 'Salió de almacén',
    departamento: 'Despacho',
    cliente: 'Tu pedido salió de almacén y va en camino.',
  },
  {
    estado: 'en_entrega',
    titulo: 'En camino a tu parada',
    departamento: 'Ruta',
    cliente: 'Va en la ruta hacia tu parada.',
  },
  {
    estado: 'entregado',
    titulo: 'Entregado',
    departamento: 'Cliente',
    cliente: 'Recibiste tu pedido. ¡Gracias!',
  },
]

export const ORDEN = ETAPAS.map((e) => e.estado)
export const etapaDe = (estado) => ETAPAS.find((e) => e.estado === estado)
export const indiceDe = (estado) => ORDEN.indexOf(estado)

// A partir de qué momento el cliente puede decir "ya me llegó".
export const puedeConfirmar = (estado) => estado === 'despachado' || estado === 'en_entrega'

// La siguiente etapa, para el botón del personal. Devuelve null al final.
export function siguienteEtapa(estado) {
  const i = indiceDe(estado)
  return i < 0 || i >= ETAPAS.length - 1 ? null : ETAPAS[i + 1]
}

// Arma el camino completo de un pedido: qué etapas ya pasaron (con su fecha),
// cuál es la de ahora y cuáles faltan.
export function caminoDe(estado, historial = []) {
  const fechas = {}
  for (const h of historial) if (!fechas[h.status]) fechas[h.status] = h.changed_at
  const actual = indiceDe(estado)
  return ETAPAS.map((e, i) => ({
    ...e,
    fecha: fechas[e.estado] || null,
    hecha: actual >= 0 && i < actual,
    esAhora: i === actual,
  }))
}
