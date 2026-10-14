import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m, '')) }
const falla = async (fn, m) => { try { await fn(); bien(false, m) } catch { bien(true, m) } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id
const N = (x) => Number(x)

const SUP = await nu('s@x'), ALM = await nu('a@x'), ANA = await nu('ana@x'), BEA = await nu('bea@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','D')`, [SUP])
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'personal','alm','3','A')`, [ALM])
for (const [u, n, t] of [[ANA, 'Ana', '8091110000'], [BEA, 'Bea', '8092220000']]) {
  await q(`insert into profiles(id,tipo,full_name) values($1,'clienta',$2)`, [u, n])
  await q(`insert into clients(profile_id,full_name,telefono_login,credit_enabled) values($1,$2,$3,true)`, [u, n, t])
}
const cA = (await q(`select id from clients where profile_id=$1`, [ANA])).rows[0].id
const cB = (await q(`select id from clients where profile_id=$1`, [BEA])).rows[0].id
const P1 = (await q(`insert into products(nombre,precio,stock) values('Shampoo',1000,100) returning id`)).rows[0].id
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id
const pedir = async (uid, cant, pago = 'contado') => (await como(db, uid,
  `select * from crear_pedido($1::jsonb,'parada',$2,null,$3,0,'')`, [JSON.stringify([{ product_id: P1, cantidad: cant }]), parada, pago])).rows[0]
const saldo = async (c) => N((await q(`select balance_pendiente b from clients where id=$1`, [c])).rows[0].b)

console.log('1) % fijo de cliente')
await falla(() => como(db, ANA, `insert into descuentos_cliente(client_id,porcentaje) values($1,50)`, [cA]), 'el cliente NO se pone descuento él mismo')
await falla(() => como(db, ALM, `insert into descuentos_cliente(client_id,porcentaje) values($1,10)`, [cA]), 'Almacén (sin permiso) no da descuentos')
await falla(() => como(db, SUP, `insert into descuentos_cliente(client_id,porcentaje) values($1,80)`, [cA]), 'no se permite más de 50%')
await como(db, SUP, `insert into descuentos_cliente(client_id,porcentaje,motivo) values($1,10,'Cliente fiel')`, [cA])
bien((await como(db, ANA, `select porcentaje from descuentos_cliente`)).rows.length === 1, 'Ana ve su descuento')
bien((await como(db, BEA, `select porcentaje from descuentos_cliente`)).rows.length === 0, 'Bea no ve el de Ana')

let o = await pedir(ANA, 3)
bien(N(o.subtotal) === 3000 && N(o.descuento) === 300 && N(o.total) === 2700, 'contado: 3,000 − 10% = 2,700')
bien(o.descuento_nota === 'Descuento de cliente 10%', 'el pedido dice de dónde salió el descuento')
const ob = await pedir(BEA, 3)
bien(N(ob.descuento) === 0 && N(ob.total) === 3000, 'Bea (sin descuento) paga 3,000')

const oc = await pedir(ANA, 2, 'credito')
bien(N(oc.total) === 1800 && N(oc.balance) === 1800, 'crédito: 2,000 − 10% = 1,800 de balance')
bien(await saldo(cA) === 1800, 'lo que debe Ana es 1,800, no 2,000')

console.log('\n2) Descuento en un pedido puntual')
await falla(() => como(db, ALM, `select descontar_pedido($1,100,'x')`, [oc.id]), 'Almacén no descuenta pedidos')
await falla(() => como(db, ANA, `select descontar_pedido($1,100,'x')`, [oc.id]), 'el cliente no descuenta pedidos')
await falla(() => como(db, SUP, `select descontar_pedido($1,100,'')`, [oc.id]), 'sin motivo no se acepta')
await falla(() => como(db, SUP, `select descontar_pedido($1,5000,'x')`, [oc.id]), 'no más que el subtotal')
let d = (await como(db, SUP, `select * from descontar_pedido($1,500,'Promoción de apertura')`, [oc.id])).rows[0]
bien(N(d.total) === 1500 && N(d.balance) === 1500, 'crédito de 2,000 con 500 de descuento: debe 1,500')
bien(await saldo(cA) === 1500, 'lo que debe Ana baja a 1,500')
d = (await como(db, SUP, `select * from descontar_pedido($1,0,'')`, [oc.id])).rows[0]
bien(N(d.total) === 2000 && await saldo(cA) === 2000, 'quitar el descuento devuelve el total a 2,000')
d = (await como(db, SUP, `select * from descontar_pedido($1,250,'Cortesía')`, [ob.id])).rows[0]
bien(N(d.total) === 2750 && N(d.balance) === 0, 'contado: el total baja y el balance sigue en 0')
await falla(() => como(db, SUP, `update orders set descuento=999 where id=$1`, [ob.id]), 'nadie cambia el descuento a mano, solo por la función')

console.log('\n3) Pedido cerrado')
await q(`update orders set status='entregado' where id=$1`, [o.id])
await falla(() => como(db, SUP, `select descontar_pedido($1,10,'x')`, [o.id]), 'un pedido entregado ya no se descuenta')

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
