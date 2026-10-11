// La caja de 16 que el cliente arma: 8 shampoo + 8 mascarilla, 1 o 2 sabores.
import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const falla = async (f, m) => {
  try { await f(); bien(false, m + ' (debió ser rechazado)') }
  catch (e) { bien(true, `${m}  →  "${String(e.message).slice(0, 70)}"`) }
}
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id

const SUP = await nu('s@x'), CLI = await nu('c@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'supremo','8091','D')`, [SUP])
await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','Ana')`, [CLI])
await q(`insert into clients(profile_id,full_name,telefono_login) values($1,'Ana','8091110000')`, [CLI])
await q(`update company_settings set catalogo_publicado = true`)

// Los 7 sabores, con su shampoo 16 oz y su mascarilla (tratamiento) 10 oz
const SABORES = ['Coco', 'Cacao', 'Jengibre y Romero', 'Banana', 'Detox Negro', 'Miel y Leche', 'Zanahoria']
const prod = async (nombre, precio) => (await q(`insert into products(nombre,precio) values($1,$2) returning id`, [nombre, precio])).rows[0].id
const receta = { unidades_por_grupo: 8, max_sabores: 2, grupos: ['Shampoo', 'Mascarilla'], sabores: [] }
for (const s of SABORES) {
  receta.sabores.push({ nombre: s, productos: [await prod(`SHAMPOO DE ${s.toUpperCase()} 16 OZ`, 450), await prod(`TRATAMIENTO DE ${s.toUpperCase()} 10 OZ`, 450)] })
}
const caja = (await como(db, SUP, `insert into products(nombre,precio,tipo,armado) values('DUO PACK 16 UNIDADES',6500,'duo_pack',$1) returning id`, [JSON.stringify(receta)])).rows[0].id
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id

const pedir = (sabores, cantidad = 1) => como(db, CLI,
  `select * from crear_pedido($1::jsonb,'parada',$2,null,'contado',null,'')`,
  [JSON.stringify([{ product_id: caja, cantidad, sabores }]), parada])
const loQueVa = async (pedidoId) => (await q(`select detalle from order_items where order_id=$1`, [pedidoId])).rows[0].detalle

console.log('1) Un solo sabor')
const p1 = (await pedir(['Coco'])).rows[0]
const d1 = await loQueVa(p1.id)
bien(Number(p1.total) === 6500, 'la caja cuesta RD$6,500 (no la suma de las 16 piezas)')
bien(d1.length === 2 && d1.every((x) => x.cantidad === 8), 'con 1 sabor: 8 shampoo y 8 mascarilla de Coco')
console.log('     ' + d1.map((x) => `${x.cantidad} ${x.nombre}`).join('  |  '))

console.log('2) Dos sabores')
const p2 = (await pedir(['Coco', 'Zanahoria'])).rows[0]
const d2 = await loQueVa(p2.id)
bien(d2.length === 4 && d2.every((x) => x.cantidad === 4), 'con 2 sabores: 4 y 4 de cada grupo')
bien(d2.filter((x) => x.grupo === 'Shampoo').length === 2 && d2.filter((x) => x.grupo === 'Mascarilla').length === 2, 'quedan 2 shampoo y 2 mascarillas distintos')
console.log('     ' + d2.map((x) => `${x.cantidad} ${x.nombre}`).join('  |  '))

console.log('3) Dos cajas iguales')
const p3 = (await pedir(['Coco', 'Cacao'], 2)).rows[0]
const d3 = await loQueVa(p3.id)
bien(d3.every((x) => x.cantidad === 8) && Number(p3.total) === 13000, 'pidiendo 2 cajas se duplica todo (8 de cada uno, RD$13,000)')

console.log('4) Lo que NO se puede')
await falla(() => pedir(['Coco', 'Cacao', 'Banana']), 'no deja elegir 3 sabores')
await falla(() => pedir([]), 'no deja dejarla sin sabor')
await falla(() => pedir(['Coco', 'Coco']), 'no deja repetir el mismo sabor')
await falla(() => pedir(['Chocolate']), 'no deja inventarse un sabor que no existe')
const suelto = receta.sabores[0].productos[0]
await falla(() => como(db, CLI, `select * from crear_pedido($1::jsonb,'parada',$2,null,'contado',null,'')`,
  [JSON.stringify([{ product_id: suelto, cantidad: 1, sabores: ['Coco'] }]), parada]),
  'no deja mandar sabores en un producto normal')

console.log('5) Si un sabor se agota')
await q(`update products set disponible=false where id=$1`, [receta.sabores[0].productos[1]])
await falla(() => pedir(['Coco']), 'no deja pedir una caja con un sabor agotado')
bien(!(await pedir(['Cacao'])).rows[0].id === false, 'los demás sabores siguen funcionando')
await q(`update products set disponible=true where id=$1`, [receta.sabores[0].productos[1]])

console.log('6) Recetas mal armadas')
await falla(() => como(db, SUP, `insert into products(nombre,precio,tipo,armado) values('MALA',100,'duo_pack','{"unidades_por_grupo":8,"max_sabores":2,"grupos":["A","B"],"sabores":[{"nombre":"X","productos":["` + suelto + `"]}]}')`),
  'no deja guardar un sabor al que le falta un producto')
await falla(() => como(db, SUP, `insert into products(nombre,precio,tipo,armado) values('MALA2',100,'simple',$1)`, [JSON.stringify(receta)]),
  'un producto normal no puede ser una caja que se arma')

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
