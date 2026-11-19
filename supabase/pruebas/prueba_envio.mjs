// El envío lo pone el personal y se suma al total y a lo que debe la clienta.
import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const falla = async (fn, m) => { try { await fn(); bien(false, m) } catch { bien(true, m) } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id
const N = (x) => Number(x)

const SUP = await nu('s@x'), DES = await nu('d@x'), NADA = await nu('n@x'), ANA = await nu('ana@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','D')`, [SUP])
const rolDes = (await q(`insert into pedidos_roles(nombre) values('Despachador prueba') returning id`)).rows[0].id
await q(`insert into pedidos_rol_permisos(rol_id,permiso) values($1,'despacho')`, [rolDes])
await q(`insert into profiles(id,tipo,usuario,telefono,full_name,rol_id) values($1,'personal','des','2','Des',$2)`, [DES, rolDes])
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'personal','nada','3','Nada')`, [NADA])
await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','Ana')`, [ANA])
await q(`insert into clients(profile_id,full_name,telefono_login,credit_enabled) values($1,'Ana','8091110000',true)`, [ANA])
const cA = (await q(`select id from clients where profile_id=$1`, [ANA])).rows[0].id
const dir = (await q(`insert into client_addresses(client_id,address) values($1,'Calle 1') returning id`, [cA])).rows[0].id
const P1 = (await q(`insert into products(nombre,precio,stock) values('Shampoo',1000,100) returning id`)).rows[0].id
const pedir = async (pago, metodo = 'envio') => (await como(db, ANA,
  `select * from crear_pedido($1::jsonb,$2,null,$3,$4,$5,'')`,
  [JSON.stringify([{ product_id: P1, cantidad: 2 }]), metodo, metodo === 'envio' ? dir : null, pago, pago === 'avance' ? 500 : 0])).rows[0]
const saldo = async () => N((await q(`select balance_pendiente b from clients where id=$1`, [cA])).rows[0].b)

console.log('1) El pedido con envío nace sin cobrar envío')
const oc = await pedir('credito')
bien(N(oc.envio) === 0 && N(oc.total) === 2000 && N(oc.balance) === 2000, 'crédito: total 2,000, envío por confirmar (0)')
bien(await saldo() === 2000, 'Ana debe 2,000')

console.log('\n2) Quién puede poner el envío')
await falla(() => como(db, ANA, `select poner_envio($1,300,'')`, [oc.id]), 'la clienta NO se pone el envío')
await falla(() => como(db, NADA, `select poner_envio($1,300,'')`, [oc.id]), 'personal sin permiso no lo pone')
await falla(() => como(db, ANA, `select aplicar_envio_pedido($1,0,'')`, [oc.id]), 'la función interna no se puede llamar directo')
await falla(() => como(db, SUP, `update orders set envio=300 where id=$1`, [oc.id]), 'nadie cambia el envío a mano, solo por la función')
await falla(() => como(db, SUP, `select poner_envio($1,-5,'')`, [oc.id]), 'no se acepta envío negativo')

console.log('\n3) Se suma al total y a lo que debe')
let o = (await como(db, DES, `select * from poner_envio($1,350,'Caribe Tours')`, [oc.id])).rows[0]
bien(N(o.envio) === 350 && N(o.total) === 2350 && N(o.balance) === 2350, 'despacho pone 350: total y balance 2,350')
bien(o.envio_nota === 'Caribe Tours', 'queda anotado quién lo lleva')
bien(await saldo() === 2350, 'Ana debe 2,350')
o = (await como(db, SUP, `select * from poner_envio($1,200,'')`, [oc.id])).rows[0]
bien(N(o.total) === 2200 && await saldo() === 2200, 'cambiarlo a 200 ajusta todo a 2,200')
bien(o.envio_nota === null, 'sin nota queda vacío')
o = (await como(db, SUP, `select * from poner_envio($1,0,'x')`, [oc.id])).rows[0]
bien(N(o.total) === 2000 && await saldo() === 2000 && o.envio_nota === null, 'con 0 se quita el envío')

console.log('\n4) Con descuento, contado y avance')
await como(db, SUP, `select descontar_pedido($1,100,'Cortesía')`, [oc.id])
o = (await como(db, SUP, `select * from poner_envio($1,300,'')`, [oc.id])).rows[0]
bien(N(o.total) === 2200 && N(o.descuento) === 100, 'subtotal 2,000 − 100 desc. + 300 envío = 2,200')
const ok2 = await pedir('contado')
o = (await como(db, SUP, `select * from poner_envio($1,250,'')`, [ok2.id])).rows[0]
bien(N(o.total) === 2250 && N(o.balance) === 2250, 'contado: total 2,250 y debe 2,250 hasta que pague')
const oa = await pedir('avance')
o = (await como(db, SUP, `select * from poner_envio($1,150,'')`, [oa.id])).rows[0]
bien(N(o.total) === 2150 && N(o.balance) === 1650, 'avance de 500: total 2,150, debe 1,650')
const op = await pedir('contado', 'recogida')
o = (await como(db, SUP, `select * from poner_envio($1,400,'Mensajero')`, [op.id])).rows[0]
bien(N(o.total) === 2400, 'también sirve en un pedido de recogida si se decide enviarlo')

console.log('\n5) Pedido cerrado o cancelado')
await q(`update orders set status='entregado' where id=$1`, [ok2.id])
await falla(() => como(db, SUP, `select poner_envio($1,10,'')`, [ok2.id]), 'entregado: ya no se cambia el envío')
const antes = await saldo()
await q(`update orders set status='cancelado' where id=$1`, [oc.id])
bien(await saldo() === antes - 2200, 'cancelar devuelve también el envío que se debía')
await falla(() => como(db, SUP, `select poner_envio($1,10,'')`, [oc.id]), 'cancelado: ya no se cambia el envío')

console.log(`\n${ok} bien, ${mal} mal`)
process.exit(mal ? 1 : 0)
