// Seguimiento del pedido: el cliente ve cada paso y es él quien lo cierra.
import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const falla = async (fn, m) => { try { await fn(); bien(false, m) } catch { bien(true, m) } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id

const SUP = await nu('supremo@x'), ANA = await nu('ana@x'), BEA = await nu('bea@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'supremo','8091','Dueno')`, [SUP])
await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','Ana'),($2,'clienta','Bea')`, [ANA, BEA])
await q(`insert into clients(profile_id,full_name,telefono_login) values($1,'Ana','8091110000'),($2,'Bea','8092220000')`, [ANA, BEA])
await q(`update company_settings set catalogo_publicado = true`)

const P = (await q(`insert into products(nombre,precio,codigo) values('SHAMPOO DE COCO 32 OZ',900,'SH-COC-32') returning id`)).rows[0].id
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id
const pedir = (uid) => como(db, uid, `select * from crear_pedido($1::jsonb,'parada',$2,null,'contado',null,'')`,
  [JSON.stringify([{ product_id: P, cantidad: 1 }]), parada])

const ped = (await pedir(ANA)).rows[0]
const confirmar = (uid, id) => como(db, uid, `select status from confirmar_entrega($1)`, [id])
const estado = async (id) => (await q(`select status from orders where id=$1`, [id])).rows[0].status

console.log('1) El cliente ve su propio camino')
const pasos = await como(db, ANA, `select status from order_status_history where order_id=$1 order by changed_at`, [ped.id])
bien(pasos.rows.length === 1 && pasos.rows[0].status === 'recibido', 'al nacer el pedido ya quedó marcado "recibido" con su fecha')
const ajena = await como(db, BEA, `select count(*)::int n from order_status_history where order_id=$1`, [ped.id])
bien(ajena.rows[0].n === 0, 'Bea no ve el camino del pedido de Ana')

console.log('\n2) No se puede cerrar antes de tiempo')
await falla(() => confirmar(ANA, ped.id), 'Ana no puede confirmar un pedido que ni ha salido de almacén')
for (const s of ['confirmado', 'preparacion', 'listo']) {
  await q(`update orders set status=$1 where id=$2`, [s, ped.id])
  await falla(() => confirmar(ANA, ped.id), `tampoco en "${s}"`)
}

console.log('\n3) Cuando sale de almacén, el cliente cierra')
await q(`update orders set status='despachado' where id=$1`, [ped.id])
await confirmar(ANA, ped.id)
bien(await estado(ped.id) === 'entregado', 'Ana confirma que le llegó y el pedido queda entregado')
const h = await como(db, ANA, `select status from order_status_history where order_id=$1 order by changed_at`, [ped.id])
bien(h.rows.map((r) => r.status).join(',') === 'recibido,confirmado,preparacion,listo,despachado,entregado',
  'el camino completo quedó guardado paso por paso')
const quien = (await q(`select changed_by from order_status_history where order_id=$1 and status='entregado'`, [ped.id])).rows[0].changed_by
bien(quien === ANA, 'queda registrado que fue la clienta quien lo cerró, no el personal')

console.log('\n4) Confirmar dos veces no rompe nada')
await confirmar(ANA, ped.id)
bien(await estado(ped.id) === 'entregado', 'vuelve a confirmar y sigue entregado, sin error')

console.log('\n5) Nadie cierra el pedido de otro')
const ped2 = (await pedir(ANA)).rows[0]
await q(`update orders set status='en_entrega' where id=$1`, [ped2.id])
await falla(() => confirmar(BEA, ped2.id), 'Bea no puede cerrar el pedido de Ana')
bien(await estado(ped2.id) === 'en_entrega', 'y el pedido de Ana se quedó igual')
await falla(() => confirmar(SUP, ped2.id), 'ni el supremo cierra por esta puerta: él usa el panel')

console.log('\n6) Un pedido cancelado no se puede cerrar')
const ped3 = (await pedir(ANA)).rows[0]
await q(`update orders set status='cancelado' where id=$1`, [ped3.id])
await falla(() => confirmar(ANA, ped3.id), 'no se confirma un pedido cancelado')

console.log('\n7) La regla vieja sigue en pie')
// Cuando la regla tapa la fila, Postgres no se queja: simplemente no cambia
// nada. Por eso aquí se mide que no tocó ni una fila, no que diera error.
const aMano = await como(db, ANA, `update orders set status='entregado' where id=$1`, [ped2.id])
bien(aMano.affectedRows === 0, 'el cliente sigue sin poder cambiar el estado a mano: no toca ni una fila')
bien(await estado(ped2.id) === 'en_entrega', 'el pedido no se movió')

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
