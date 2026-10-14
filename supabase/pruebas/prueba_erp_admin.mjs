// El ERP maneja Pedidos, Seguimiento y Pagos con sus propias funciones.
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
const SUP = await nu('s@x'), ANA = await nu('ana@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','D')`, [SUP])
await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','ANA')`, [ANA])
await q(`insert into clients(profile_id,full_name,telefono_login,credit_enabled,credit_limit) values($1,'ANA','8091110000',true,10000)`, [ANA])
const P = (await q(`insert into products(nombre,precio,stock) values('Shampoo',500,20) returning id`)).rows[0].id
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id
const BAN = (await q(`insert into bank_accounts(banco,tipo_cuenta,numero,titular) values('Banco Popular','Ahorro','812','Keraven') returning id`)).rows[0].id
const pedir = async (cant, pago = 'contado') => (await como(db, ANA, `select * from crear_pedido($1::jsonb,'parada',$2,null,$3,0,'')`, [JSON.stringify([{ product_id: P, cantidad: cant }]), parada, pago])).rows[0]
const stock = async () => (await q(`select stock from products where id=$1`, [P])).rows[0].stock
const venta = async (oid) => (await q(`select c.* from contratos c join erp_enlace_pedidos e on e.contrato_id=c.id where e.order_id=$1`, [oid])).rows[0]

console.log('1) Mover un pedido desde el ERP')
const o1 = await pedir(2)
let r = (await q(`select * from erp_cambiar_estado_pedido($1,'preparacion','Leticia (ERP)')`, [o1.id])).rows[0]
bien(r.status === 'preparacion', 'pasa a "En preparación"')
const hist = (await q(`select cambiado_por_texto from order_status_history where order_id=$1 and status='preparacion'`, [o1.id])).rows[0]
bien(hist.cambiado_por_texto === 'Leticia (ERP)', 'el historial dice quién lo movió en el ERP')
bien(/no válido/.test(await error(() => q(`select erp_cambiar_estado_pedido($1,'volando','x')`, [o1.id]))), 'un estado inventado no se acepta')
bien(await stock() === 18, 'stock 18 después de pedir 2')
await q(`select erp_cambiar_estado_pedido($1,'cancelado','Leticia (ERP)')`, [o1.id])
bien(await stock() === 20, 'cancelado desde el ERP: el stock vuelve a 20')
bien((await venta(o1.id)).estado === 'rechazado', 'y su venta del Buzón queda rechazada')
bien(/no se puede reabrir/.test(await error(() => q(`select erp_cambiar_estado_pedido($1,'confirmado','x')`, [o1.id]))), 'un cancelado no se reabre')

console.log('\n2) Confirmar pagos desde el ERP')
const o2 = await pedir(4, 'credito')   // debe 2,000
const rep = (await como(db, ANA, `select * from reportar_pago($1,2000,'transferencia',$2,'777')`, [o2.id, BAN])).rows[0]
bien(/por qué se rechaza/.test(await error(() => q(`select erp_decidir_pago($1,'rechazado','','Manuel')`, [rep.id]))), 'rechazar sin motivo: no')
r = (await q(`select * from erp_decidir_pago($1,'confirmado',null,'Manuel (ERP)')`, [rep.id])).rows[0]
bien(r.estado === 'confirmado' && r.confirmado_por_texto === 'Manuel (ERP)', 'confirmado, con el nombre de quien lo hizo')
bien(N((await q(`select balance from orders where id=$1`, [o2.id])).rows[0].balance) === 0, 'el pedido ya no debe nada')
const ab = (await q(`select * from contrato_abonos where contrato_id=$1`, [(await venta(o2.id)).id])).rows[0]
bien(ab && N(ab.monto) === 2000 && ab.via === 'pedidos', 'y en el ERP queda el abono de 2,000')
bien(/ya fue confirmado/.test(await error(() => q(`select erp_decidir_pago($1,'rechazado','x','M')`, [rep.id]))), 'un pago decidido no se vuelve a tocar')

console.log('\n3) La app sigue confirmando igual que antes')
const o3 = await pedir(1, 'credito')
const rep3 = (await como(db, ANA, `select * from reportar_pago($1,500,'deposito',$2,'888')`, [o3.id, BAN])).rows[0]
r = (await como(db, SUP, `select * from confirmar_pago($1,'confirmado')`, [rep3.id])).rows[0]
bien(r.estado === 'confirmado' && r.confirmado_por === SUP, 'confirmado desde la app, con su usuario')
bien(/permiso/.test(await error(() => como(db, ANA, `select confirmar_pago($1,'confirmado')`, [rep3.id]))), 'un cliente no confirma pagos')

console.log('\n4) Nadie de la app puede usar las funciones del ERP')
for (const [f, args] of [['erp_cambiar_estado_pedido', `$1,'entregado','x'`], ['erp_decidir_pago', `$1,'confirmado',null,'x'`]]) {
  const id = f === 'erp_decidir_pago' ? rep3.id : o2.id
  bien(/permission denied|permiso/i.test(await error(() => como(db, SUP, `select ${f}(${args})`, [id]))), `${f}: el personal de la app no la puede llamar`)
  bien(/permission denied|permiso/i.test(await error(() => como(db, ANA, `select ${f}(${args})`, [id]))), `${f}: un cliente tampoco`)
}

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
if (mal) process.exitCode = 1
