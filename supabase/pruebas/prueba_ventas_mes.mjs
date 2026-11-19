// Ventas del mes y proyección, en Estadísticas.
import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const falla = async (fn, m) => { try { await fn(); bien(false, m) } catch { bien(true, m) } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id
const N = (x) => Number(x)

const SUP = await nu('s@x'), NADA = await nu('n@x'), ANA = await nu('ana@x'), BEA = await nu('bea@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','Dueño')`, [SUP])
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'personal','nada','3','Nada')`, [NADA])
for (const [u, n, t] of [[ANA, 'Ana', '8091110000'], [BEA, 'Bea', '8092220000']]) {
  await q(`insert into profiles(id,tipo,full_name) values($1,'clienta',$2)`, [u, n])
  await q(`insert into clients(profile_id,full_name,telefono_login,credit_enabled) values($1,$2,$3,true)`, [u, n, t])
}
const P1 = (await q(`insert into products(nombre,precio,stock) values('Shampoo',1000,100) returning id`)).rows[0].id
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id
const pedir = async (uid, cant, pago) => (await como(db, uid,
  `select * from crear_pedido($1::jsonb,'parada',$2,null,$3,0,'')`, [JSON.stringify([{ product_id: P1, cantidad: cant }]), parada, pago])).rows[0]
const fecha = (id, f) => q(`update orders set created_at=$2 where id=$1`, [id, f])

// Octubre (en hora de RD): Ana 2 al contado, Bea 3 a crédito, uno cancelado.
const o1 = await pedir(ANA, 2, 'contado'); await fecha(o1.id, '2026-10-05 15:00-04')
const o2 = await pedir(BEA, 3, 'credito'); await fecha(o2.id, '2026-10-20 10:00-04')
const o3 = await pedir(ANA, 1, 'contado'); await fecha(o3.id, '2026-10-21 10:00-04')
await q(`update orders set status='cancelado' where id=$1`, [o3.id])
// 31 oct a las 9 pm en RD = 1 nov en hora universal: debe contar en OCTUBRE.
const o4 = await pedir(ANA, 1, 'contado'); await fecha(o4.id, '2026-10-31 21:00-04')
// Noviembre
const o5 = await pedir(BEA, 5, 'contado'); await fecha(o5.id, '2026-11-02 10:00-04')
// Bea paga 1,000 de su crédito
await como(db, SUP, `select reportar_pago($1,1000,'efectivo',null,null)`, [o2.id])

console.log('1) Quién puede ver')
await falla(() => como(db, NADA, `select ventas_del_mes('2026-10-01')`), 'personal sin permiso no ve las ventas')
await falla(() => como(db, ANA, `select ventas_del_mes('2026-10-01')`), 'la clienta no ve las ventas')

console.log('\n2) Lo vendido en octubre')
const v = (await como(db, SUP, `select ventas_del_mes('2026-10-15') v`)).rows[0].v
bien(N(v.vendido) === 6000, `vendido octubre = 2,000 + 3,000 + 1,000 = 6,000 (dio ${v.vendido})`)
bien(v.pedidos === 3 && N(v.clientes) === 2, 'tres pedidos de dos clientas (el cancelado no cuenta)')
bien(N(v.cancelados) === 1, 'cuenta aparte el cancelado')
bien(v.filas.some((f) => f.pedido === o4.order_number), 'el pedido del 31 oct 9 pm (hora RD) cuenta en octubre')
const fb = v.filas.find((f) => f.pedido === o2.order_number)
bien(fb.cliente === 'Bea' && fb.telefono === '8092220000' && fb.forma_pago === 'credito', 'sale nombre, teléfono y forma de pago')
bien(N(fb.pagado) === 1000 && N(fb.debe) === 2000 && fb.fecha_pago, 'crédito: pagó 1,000, debe 2,000 y tiene fecha de pago')
bien(N(v.cobrado) === 1000, 'cobrado del mes: 1,000')
const vn = (await como(db, SUP, `select ventas_del_mes('2026-11-01') v`)).rows[0].v
bien(N(vn.vendido) === 5000 && vn.pedidos === 1, 'noviembre: 5,000 en un pedido')

console.log('\n3) Proyección')
await falla(() => como(db, NADA, `insert into proyecciones_ventas(mes,monto) values('2026-12-01',50000)`), 'sin permiso no pone proyección')
await falla(() => como(db, SUP, `insert into proyecciones_ventas(mes,monto) values('2026-12-15',50000)`), 'el mes va siempre en día 1')
await falla(() => como(db, SUP, `insert into proyecciones_ventas(mes,monto) values('2026-12-01',-5)`), 'no se acepta negativa')
await como(db, SUP, `insert into proyecciones_ventas(mes,monto,nota) values('2026-12-01',80000,'Navidad')`)
let p = (await como(db, SUP, `select * from proyecciones_ventas where mes='2026-12-01'`)).rows[0]
bien(N(p.monto) === 80000 && p.puesto_por_texto === 'Dueño' && p.nota === 'Navidad', 'queda guardada con quién la puso')
await como(db, SUP, `insert into proyecciones_ventas(mes,monto,nota) values('2026-12-01',90000,'') on conflict (mes) do update set monto=excluded.monto, nota=excluded.nota`)
p = (await como(db, SUP, `select * from proyecciones_ventas where mes='2026-12-01'`)).rows[0]
bien(N(p.monto) === 90000 && p.nota === null, 'se puede cambiar después')
bien((await como(db, NADA, `select * from proyecciones_ventas`)).rows.length === 0, 'sin permiso no la ve')
bien((await como(db, ANA, `select * from proyecciones_ventas`)).rows.length === 0, 'la clienta no la ve')

console.log(`\n${ok} bien, ${mal} mal`)
process.exit(mal ? 1 : 0)
