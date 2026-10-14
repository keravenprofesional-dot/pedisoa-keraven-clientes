import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const falla = async (fn, m) => { try { await fn(); bien(false, m) } catch { bien(true, m) } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id

const SUP = await nu('s@x'), ALM = await nu('a@x'), ANA = await nu('ana@x'), BEA = await nu('bea@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','D')`, [SUP])
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'personal','alm','3','A')`, [ALM])
for (const [u, n, t] of [[ANA, 'Ana', '8091110000'], [BEA, 'Bea', '8092220000']]) {
  await q(`insert into profiles(id,tipo,full_name) values($1,'clienta',$2)`, [u, n])
  await q(`insert into clients(profile_id,full_name,telefono_login) values($1,$2,$3)`, [u, n, t])
}
const P1 = (await q(`insert into products(nombre,precio) values('Shampoo',1200) returning id`)).rows[0].id
const P2 = (await q(`insert into products(nombre,precio) values('Mascarilla',800) returning id`)).rows[0].id
const est = async (uid = SUP) => (await como(db, uid, `select estadisticas(30) e`)).rows[0].e

console.log('1) Visitas a la app')
await como(db, ANA, `select registrar_visita()`)
await como(db, ANA, `select registrar_visita()`)   // recarga: no suma
await como(db, BEA, `select registrar_visita()`)
await como(db, SUP, `select registrar_visita()`)   // personal: no cuenta
let e = await est()
bien(Number(e.visitas) === 2, 'Ana + Bea = 2 visitas (la recarga y el personal no suman)')
bien(Number(e.clientes) === 2, '2 clientes distintos')
bien(Number(e.visitas_hoy) === 2, '2 visitas hoy')
bien(e.por_dia.length === 30, 'gráfica de 30 días')
await q(`update visitas set creado_en = now() - interval '40 minutes' where profile_id=$1`, [ANA])
await como(db, ANA, `select registrar_visita()`)
bien(Number((await est()).visitas) === 3, 'Ana vuelve 40 minutos después: sí suma')

console.log('\n2) Productos más vistos')
await como(db, ANA, `select registrar_visita($1)`, [P1])
await como(db, BEA, `select registrar_visita($1)`, [P1])
await como(db, BEA, `select registrar_visita($1)`, [P2])
await como(db, BEA, `select registrar_visita($1)`, [P2]) // repetido: no suma
e = await est()
bien(e.mas_vistos[0].nombre === 'Shampoo' && Number(e.mas_vistos[0].vistas) === 2, 'Shampoo es el más visto (2)')
bien(Number(e.mas_vistos[1].vistas) === 1, 'Mascarilla 1 vista')

console.log('\n3) Productos más comprados (sin contar cancelados)')
const cA = (await q(`select id from clients where profile_id=$1`, [ANA])).rows[0].id
const pedido = async (status, prod, cant) => {
  const o = (await q(`insert into orders(client_id,status,total) values($1,$2,0) returning id`, [cA, status])).rows[0].id
  await q(`insert into order_items(order_id,product_id,cantidad,precio_unitario,subtotal) values($1,$2,$3,100,$3*100)`, [o, prod, cant])
}
await pedido('entregado', P2, 5); await pedido('recibido', P2, 2); await pedido('recibido', P1, 3); await pedido('cancelado', P1, 50)
e = await est()
bien(e.mas_comprados[0].nombre === 'Mascarilla' && Number(e.mas_comprados[0].unidades) === 7, 'Mascarilla: 7 unidades en 2 pedidos')
bien(Number(e.mas_comprados[1].unidades) === 3, 'Shampoo: 3 (el pedido cancelado de 50 no cuenta)')

console.log('\n4) Solo los administradores lo ven')
await falla(() => est(ALM), 'Almacén (sin ver_resumen) no ve estadísticas')
await falla(() => est(ANA), 'el cliente no ve estadísticas')
await falla(() => como(db, ANA, `select count(*) from visitas`), 'el cliente no lee la tabla de visitas')
await falla(() => como(db, ANA, `insert into visitas(profile_id,tipo) values($1,'app')`, [ANA]), 'el cliente no inventa visitas directo')
await como(db, null, `select 1`).catch(() => {})
await falla(() => como(db, null, `select registrar_visita()`), 'un anónimo no puede registrar visitas')

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
