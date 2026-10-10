// Prueba del orden y la separación por tamaño (no toca la base de datos)
const { agruparCatalogo, tamanoOz } = await import('../../frontend/src/utils/ordenProducto.js')
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }

bien(tamanoOz('SHAMPOO DE COCO 32OZ') === 32, 'lee 32 de "32OZ" pegado')
bien(tamanoOz('TRATAMIENTO DE COCO 10 OZ') === 10, 'lee 10 de "10 OZ" separado')
bien(tamanoOz('SPRAY DE RIZOS 4 0Z') === 4, 'lee 4 aunque esté escrito "0Z"')
bien(tamanoOz('SHAMPOO DE 32OZ DETOX NEGRO 32OZ') === 32, 'con el tamaño repetido sigue siendo 32')
bien(tamanoOz('GEL INTIMO 8 ONZAS') === 8, 'lee "8 ONZAS"')
bien(tamanoOz('SHAMPOO GOLDEN BLACK') === null, 'sin tamaño devuelve vacío')

const productos = [
  { nombre: 'SHAMPOO DE BANANA 32OZ', s: 'Shampoo' },
  { nombre: 'SHAMPOO DE COCO 10 OZ', s: 'Shampoo' },
  { nombre: 'SHAMPOO DE COCO 32OZ', s: 'Shampoo' },
  { nombre: 'SHAMPOO DE CACAO 32OZ', s: 'Shampoo' },
  { nombre: 'SHAMPOO DE RIZOS 16 OZ', s: 'Shampoo' },
  { nombre: 'SHAMPOO GOLDEN BLACK', s: 'Shampoo' },
  { nombre: 'MASCARILLA DE CACAO 32OZ', s: 'Mascarilla' },
  { nombre: 'MASCARILLA DE COCO 32OZ', s: 'Mascarilla' },
  { nombre: 'TRATAMIENTO DE MIEL Y LECHE 32OZ', s: 'Tratamientos' },
  { nombre: 'TRATAMIENTO DE COCO 32OZ', s: 'Tratamientos' },
]
const cat = agruparCatalogo(productos, (p) => p.s)
console.log('')
for (const [seccion, tamanos] of cat) {
  console.log(seccion.toUpperCase())
  for (const [oz, lista] of tamanos) console.log('   ' + (oz == null ? 'sin tamaño' : oz + ' oz') + ': ' + lista.map((p) => p.nombre).join(' | '))
}
console.log('')
const sh = new Map(cat).get('Shampoo')
bien(sh.map((x) => x[0]).join(',') === '32,16,10,', 'los tamaños van 32, 16, 10 y al final el que no tiene')
bien(sh[0][1].map((p) => p.nombre.split(' ')[2]).join(' ') === 'COCO CACAO BANANA', 'en shampoo 32oz: coco, cacao, banana')
const ma = new Map(cat).get('Mascarilla')
bien(ma[0][1][0].nombre.includes('COCO'), 'en mascarilla 32oz el coco también va primero (mismo orden)')
const tr = new Map(cat).get('Tratamientos')
bien(tr[0][1][0].nombre.includes('MIEL'), 'en tratamientos la miel y leche va primero')
console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
