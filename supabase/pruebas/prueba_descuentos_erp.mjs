// Descuentos manuales desde el ERP (y que la app siga igual): 20-10-2026.
import { nuevaBase, como } from './base.mjs'
import fs from 'fs'
const db = await nuevaBase()
await db.exec(fs.readFileSync('C:/Keraven-Systems-Masters/schema.sql', 'utf8'))
for (const m of fs.readdirSync('../migrations').filter((f) => f >= '20261014060000').sort())
  await db.exec(fs.readFileSync('../migrations/' + m, 'utf8'))
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const error = async (fn) => { try { await fn(); return '' } catch (e) { return e.message } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id
const N = Number

await q(`update company_settings set catalogo_publicado = true`)
const SUP = await nu('s@x'), ALM = await nu('a@x'), ANA = await nu('ana@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','Leticia')`, [SUP])
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'personal','alm','3','A')`, [ALM])
await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','ANA')`, [ANA])
await q(`insert into clients(profile_id,full_name,telefono_login,credit_enabled,credit_limit) values($1,'ANA','8091110000',true,50000)`, [ANA])
const cA = (await q(`select id from clients where profile_id=$1`, [ANA])).rows[0].id
const P = (await q(`insert into products(nombre,precio,stock) values('Shampoo',1000,50) returning id`)).rows[0].id
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id
const pedir = async (cant, pago = 'contado') => (await como(db, ANA, `select * from crear_pedido($1::jsonb,'parada',$2,null,$3,0,'')`, [JSON.stringify([{ product_id: P, cantidad: cant }]), parada, pago])).rows[0]
const venta = async (oid) => (await q(`select c.* from contratos c join erp_enlace_pedidos e on e.contrato_id=c.id where e.order_id=$1`, [oid])).rows[0]
const debe = async () => N((await q(`select balance_pendiente b from clients where id=$1`, [cA])).rows[0].b)

console.log('1) Descuento en un pedido, desde el ERP')
const o1 = await pedir(4, 'credito')                    // 4,000 a crédito
bien(N((await venta(o1.id)).saldo) === 4000, 'la venta del ERP nace debiendo 4,000')
bien(/motivo/.test(await error(() => q(`select erp_descontar_pedido($1,500,'','Leticia (ERP)')`, [o1.id]))), 'sin motivo: no')
bien(/subtotal/.test(await error(() => q(`select erp_descontar_pedido($1,9000,'x','Leticia (ERP)')`, [o1.id]))), 'más que el subtotal: no')
let r = (await q(`select * from erp_descontar_pedido($1,1000,'Cliente VIP','Leticia (ERP)')`, [o1.id])).rows[0]
bien(N(r.total) === 3000 && N(r.balance) === 3000, 'el pedido queda en 3,000 y debe 3,000')
bien(r.descuento_nota === 'Cliente VIP' && r.descuento_por_texto === 'Leticia (ERP)', 'queda el motivo y quién lo puso')
let v = await venta(o1.id)
bien(N(v.descuento) === 1000 && N(v.neto) === 3000 && N(v.saldo) === 3000, 'la factura del ERP se ajusta sola: neto y saldo 3,000')
bien(await debe() === 3000, 'lo que debe la clienta baja a 3,000')
r = (await q(`select * from erp_descontar_pedido($1,0,'','Leticia (ERP)')`, [o1.id])).rows[0]
bien(N(r.total) === 4000 && r.descuento_nota === null && r.descuento_por_texto === null, 'con 0 se quita el descuento')
bien(N((await venta(o1.id)).saldo) === 4000 && await debe() === 4000, 'y todo vuelve a 4,000')

console.log('\n2) Pedido entregado o cancelado: no se toca')
const o2 = await pedir(1)
await q(`select erp_cambiar_estado_pedido($1,'entregado','x')`, [o2.id])
bien(/entregado/.test(await error(() => q(`select erp_descontar_pedido($1,100,'x','y')`, [o2.id]))), 'entregado: no')

console.log('\n3) % fijo de la clienta, desde el ERP')
bien(/50/.test(await error(() => q(`select erp_descuento_cliente($1,80,'x','Leticia (ERP)')`, [cA]))), 'más de 50%: no')
let d = (await q(`select * from erp_descuento_cliente($1,10,'Clienta fiel','Leticia (ERP)')`, [cA])).rows[0]
bien(N(d.porcentaje) === 10 && d.puesto_por_texto === 'Leticia (ERP)', 'queda 10%, con quién lo puso')
const o3 = await pedir(2)
bien(N(o3.descuento) === 200 && N(o3.total) === 1800, 'su próximo pedido sale con 10% menos')
bien(N((await venta(o3.id)).neto) === 1800, 'y su factura en el ERP también')
await como(db, SUP, `update descuentos_cliente set porcentaje=15, puesto_por=$2 where client_id=$1`, [cA, SUP])
bien((await q(`select puesto_por_texto t from descuentos_cliente`)).rows[0].t === null, 'si luego lo cambia alguien en la app, ya no dice el nombre del ERP')
await q(`select erp_descuento_cliente($1,0,null,'Leticia (ERP)')`, [cA])
bien((await q(`select count(*)::int n from descuentos_cliente`)).rows[0].n === 0, 'con 0 se quita')

console.log('\n4) La app sigue igual')
const o4 = await pedir(3, 'credito')
r = (await como(db, SUP, `select * from descontar_pedido($1,300,'Promo')`, [o4.id])).rows[0]
bien(N(r.total) === 2700 && r.descuento_por_texto === 'Leticia', 'desde la app: aplica y anota el nombre')
bien(N((await venta(o4.id)).neto) === 2700, 'y la factura del ERP se ajusta')
bien(/permiso/.test(await error(() => como(db, ALM, `select descontar_pedido($1,100,'x')`, [o4.id]))), 'en la app, sin permiso: no')

console.log('\n5) Nadie de la app puede usar las funciones del ERP')
for (const [f, args] of [['erp_descontar_pedido', `$1::uuid,1,'x','y'`], ['erp_descuento_cliente', `$1::uuid,5,'x','y'`], ['aplicar_descuento_pedido', `$1::uuid,1,'x','y'`]]) {
  const id = f === 'erp_descuento_cliente' ? cA : o4.id
  bien(/permission denied/i.test(await error(() => como(db, SUP, `select ${f}(${args})`, [id]))), `${f}: el personal de la app no`)
  bien(/permission denied/i.test(await error(() => como(db, ANA, `select ${f}(${args})`, [id]))), `${f}: un cliente tampoco`)
}

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
if (mal) process.exitCode = 1
