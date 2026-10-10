// Catálogo en preparación, líneas y combos (todo en la copia local)
import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const falla = async (f, m) => { try { await f(); bien(false, m + ' (debió ser rechazado)') } catch { bien(true, m) } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id

const SUP = await nu('s@x'), CLI = await nu('c@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'supremo','8091','D')`, [SUP])
await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','Ana')`, [CLI])
await q(`insert into clients(profile_id,full_name,telefono_login) values($1,'Ana','8091110000')`, [CLI])

const sh = (await como(db, SUP, `insert into products(nombre,precio,codigo) values('SHAMPOO DE COCO 32 OZ',900,'SH-COC-32') returning id`)).rows[0].id
const tr = (await como(db, SUP, `insert into products(nombre,precio,codigo) values('TRATAMIENTO DE COCO 32 OZ',900,'TR-COC-32') returning id`)).rows[0].id

console.log('1) Catálogo en preparación')
bien((await como(db, CLI, `select * from products`)).rows.length === 0, 'el cliente NO ve productos mientras se prepara')
bien((await como(db, SUP, `select * from products`)).rows.length === 2, 'el personal sí los ve, para poder armarlo')
await como(db, SUP, `update company_settings set catalogo_publicado = true`)
bien((await como(db, CLI, `select * from products`)).rows.length === 2, 'al publicarlo, el cliente ya los ve')
await como(db, SUP, `update company_settings set catalogo_publicado = false`)
bien((await como(db, CLI, `select * from products`)).rows.length === 0, 'se puede volver a esconder')
await como(db, SUP, `update company_settings set catalogo_publicado = true`)

console.log('2) Líneas')
const lin = (await como(db, SUP, `insert into lineas(nombre,descripcion) values('Línea de Coco','Hidratación profunda') returning id`)).rows[0].id
await como(db, SUP, `update products set linea_id=$1 where id in ($2,$3)`, [lin, sh, tr])
bien((await como(db, CLI, `select * from products where linea_id=$1`, [lin])).rows.length === 2, 'la línea de Coco agrupa sus 2 productos')
await falla(() => como(db, CLI, `insert into lineas(nombre) values('Pirata')`), 'el cliente NO puede crear líneas')
await falla(() => como(db, SUP, `insert into lineas(nombre) values('Línea de Coco')`), 'no deja dos líneas con el mismo nombre')

console.log('3) Duo Pack')
const duo = (await como(db, SUP, `insert into products(nombre,precio,codigo,tipo) values('DUO PACK COCO 32 OZ',1600,'DUO-COC-32','duo_pack') returning id`)).rows[0].id
await como(db, SUP, `insert into product_items values($1,$2,1),($1,$3,1)`, [duo, sh, tr])
const dentro = await como(db, CLI, `select p.nombre from product_items i join products p on p.id=i.componente_id where i.product_id=$1 order by p.nombre`, [duo])
bien(dentro.rows.length === 2, 'el Duo Pack lleva sus 2 productos adentro')
bien(Number((await como(db, CLI, `select precio from products where id=$1`, [duo])).rows[0].precio) === 1600, 'el Duo Pack tiene su propio precio (1600, no 1800)')
await falla(() => como(db, SUP, `insert into product_items values($1,$2,1)`, [sh, tr]), 'un producto normal no puede llevar otros adentro')
const duo2 = (await como(db, SUP, `insert into products(nombre,precio,tipo) values('DUO KIT GRANDE',3000,'duo_kit') returning id`)).rows[0].id
await falla(() => como(db, SUP, `insert into product_items values($1,$2,1)`, [duo2, duo]), 'un combo no puede llevar otro combo adentro')
await falla(() => como(db, CLI, `insert into product_items values($1,$2,1)`, [duo, sh]), 'el cliente NO puede armar combos')

console.log('4) Pedir un Duo Pack')
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id
const ped = await como(db, CLI, `select * from crear_pedido($1::jsonb,'parada',$2,null,'contado',null,'')`, [JSON.stringify([{ product_id: duo, cantidad: 1 }]), parada])
bien(Number(ped.rows[0].total) === 1600, 'el cliente pide el Duo Pack y paga 1600')
console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
