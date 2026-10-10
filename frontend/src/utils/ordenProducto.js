// Cómo se ordena y se agrupa el catálogo.
//
// 1. El tamaño sale del nombre (… 32OZ, 16 OZ, 4 0Z …) y cada tamaño va en su
//    propio renglón: nunca se mezclan los de 32 con los de 10.
// 2. Dentro de cada tamaño los sabores van SIEMPRE en el mismo orden, para que
//    el coco esté primero en mascarillas y también primero en shampoo.
// Con extensión .js para que también lo puedan correr las pruebas en Node.
import { normalizar } from './codigoProducto.js'

// Del más grande al más chico, como los pidió Keraven.
export const TAMANOS = [32, 16, 10, 8, 4, 2, 1]

// El orden de siempre de los sabores y líneas.
const ORDEN_SABORES = [
  'MIEL Y LECHE', 'COCO', 'CACAO', 'ZANAHORIA', 'BANANA', 'DETOX NEGRO', 'DETOX',
  'JENGIBRE Y ROMERO', 'JENGIBRE', 'GOLDEN BLACK', 'RIZOS', 'RIZO',
  'CRECIMIENTO', 'BRILLO', 'MOLDEADORA', 'INTIMO', 'CAPILAR', 'CURATIVA', 'MADRE',
]

// Onzas que lleva el producto, leídas de su nombre. null si no dice.
export function tamanoOz(nombre) {
  const n = normalizar(nombre)
  const encontrados = [...n.matchAll(/(\d+(?:\.\d+)?)\s*(?:OZ|0Z|ONZAS?|ONZ)\b/g)].map((m) => Number(m[1]))
  if (!encontrados.length) return null
  // Si el nombre repite el tamaño, es el mismo: se toma el último que aparece.
  return encontrados[encontrados.length - 1]
}

export function etiquetaTamano(oz) {
  return oz == null ? 'Otros tamaños' : `${oz} oz`
}

// Posición del sabor en el orden de siempre. Lo desconocido va al final.
function posicionSabor(nombre) {
  const n = normalizar(nombre)
  const i = ORDEN_SABORES.findIndex((s) => n.includes(s))
  return i === -1 ? ORDEN_SABORES.length : i
}

// Orden dentro de un mismo tamaño: primero por sabor, y si empatan por nombre.
export function compararProductos(a, b) {
  const d = posicionSabor(a.nombre) - posicionSabor(b.nombre)
  return d !== 0 ? d : a.nombre.localeCompare(b.nombre, 'es')
}

// Agrupa una lista de productos en: [ [oz, productos], … ] de mayor a menor.
export function agruparPorTamano(productos) {
  const grupos = new Map()
  for (const p of productos) {
    const oz = tamanoOz(p.nombre)
    if (!grupos.has(oz)) grupos.set(oz, [])
    grupos.get(oz).push(p)
  }
  for (const lista of grupos.values()) lista.sort(compararProductos)
  return [...grupos.entries()].sort((a, b) => {
    if (a[0] == null) return 1
    if (b[0] == null) return -1
    return b[0] - a[0]
  })
}

// Agrupa en secciones y, dentro de cada una, por tamaño:
//   [ [sección, [ [oz, productos], … ] ], … ]
export function agruparCatalogo(productos, nombreDeSeccion, sinSeccion = 'Otros productos') {
  const secciones = new Map()
  for (const p of productos) {
    const s = nombreDeSeccion(p) || sinSeccion
    if (!secciones.has(s)) secciones.set(s, [])
    secciones.get(s).push(p)
  }
  return [...secciones.entries()]
    .sort((a, b) => (a[0] === sinSeccion ? 1 : b[0] === sinSeccion ? -1 : a[0].localeCompare(b[0], 'es')))
    .map(([seccion, lista]) => [seccion, agruparPorTamano(lista)])
}
