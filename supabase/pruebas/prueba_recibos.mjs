// Lo que se debe = total − abonos (también al contado) y recibos obligatorios.
import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const falla = async (fn, m) => { try { await fn(); bien(false, m) } catch { bien(true, m) } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id
const N = (x) => Number(x)

const SUP = await nu('s@x'), ANA = await nu('ana@x'), BEA = await nu('bea@x'), NADA = await nu('n@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','Dueño')`, [SUP])
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'personal','nada','3','Nada')`, [NADA])
for (const [u, n, t, ced] of [[ANA, 'Ana Pérez', '8091110000', '00100000001'], [BEA, 'Bea', '8092220000', '00100000002']]) {
  await q(`insert into profiles(id,tipo,full_name) values($1,'clienta',$2)`, [u, n])
  await q(`insert into clients(profile_id,full_name,telefono_login,cedula,direccion,sector) values($1,$2,$3,$4,'Calle 5 #10','Los Prados')`, [u, n, t, ced])
}
const cA = (await q(`select id from clients where profile_id=$1`, [ANA])).rows[0].id
const P1 = (await q(`insert into products(nombre,precio,stock) values('Shampoo Coco 16 oz',1000,100) returning id`)).rows[0].id
const P2 = (await q(`insert into products(nombre,precio,stock) values('Mascarilla Coco 10 oz',900,100) returning id`)).rows[0].id
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id
const pedir = async (uid, items) => (await como(db, uid, `select * from crear_pedido($1::jsonb,'parada',$2,null,'contado',0,'')`,
  [JSON.stringify(items), parada])).rows[0]
const saldo = async () => N((await q(`select balance_pendiente b from clients where id=$1`, [cA])).rows[0].b)
const recibos = async (o) => (await q(`select * from recibos where order_id=$1 order by numero`, [o])).rows
const pagar = (o, m) => como(db, SUP, `select reportar_pago($1,$2,'efectivo',null,null)`, [o, m])

console.log('1) Al contado se debe el total hasta que se pague')
const o = await pedir(ANA, [{ product_id: P1, cantidad: 3 }, { product_id: P2, cantidad: 2 }])
bien(N(o.total) === 4800 && N(o.balance) === 4800, `pedido al contado de 4,800 nace debiendo 4,800 (balance ${o.balance})`)
bien(await saldo() === 4800, 'Ana debe 4,800')

console.log('\n2) Recibo de venta, con la clienta y los productos')
let rs = await recibos(o.id)
bien(rs.length === 1 && rs[0].tipo === 'venta', 'la venta emite su recibo sola')
bien(/^RC-\d{6}$/.test(rs[0].numero), `con número (${rs[0].numero})`)
bien(rs[0].cliente.nombre === 'Ana Pérez' && rs[0].cliente.cedula === '001-0000000-1' && rs[0].cliente.telefono === '8091110000', 'trae nombre, cédula y teléfono de la clienta')
bien(rs[0].cliente.direccion === 'Calle 5 #10, Los Prados' && rs[0].cliente.numero, 'trae la dirección y el número de clienta')
bien(rs[0].productos.length === 2 && rs[0].productos.some((p) => p.nombre === 'Shampoo Coco 16 oz' && p.cantidad === 3 && N(p.importe) === 3000), 'detalla los productos con cantidad e importe')
bien(N(rs[0].total) === 4800 && N(rs[0].resta) === 4800, 'total 4,800 y resta 4,800')

console.log('\n3) Abono: debía, abonó y resta en un solo recibo')
await pagar(o.id, 3000)
let ord = (await q(`select * from orders where id=$1`, [o.id])).rows[0]
bien(N(ord.balance) === 1800 && await saldo() === 1800, 'abonó 3,000: el pedido y la clienta deben 1,800')
rs = await recibos(o.id)
const r2 = rs[1]
bien(rs.length === 2 && r2.tipo === 'abono', 'el abono emite su recibo solo')
bien(N(r2.debia) === 4800 && N(r2.abono) === 3000 && N(r2.resta) === 1800, 'recibo: debía 4,800, abonó 3,000, resta 1,800')
bien(r2.productos.length === 2 && r2.cliente.nombre === 'Ana Pérez', 'el recibo del abono también detalla productos y clienta')
bien(r2.metodo === 'efectivo', 'dice cómo pagó')
bien((await q(`select count(*) n from payments where order_id=$1`, [o.id])).rows[0].n == 1, 'el abono sale en Mis pagos de la clienta')

console.log('\n4) Pagado completo')
await falla(() => pagar(o.id, 2000), 'no deja abonar más de lo que resta')
await pagar(o.id, 1800)
rs = await recibos(o.id)
const r3 = rs[2]
bien(r3.tipo === 'pagado' && N(r3.debia) === 1800 && N(r3.abono) === 1800 && N(r3.resta) === 0, 'último abono: recibo de PAGADO COMPLETO (debía 1,800, abonó 1,800, resta 0)')
ord = (await q(`select * from orders where id=$1`, [o.id])).rows[0]
bien(N(ord.balance) === 0 && await saldo() === 0, 'ya no debe nada')

console.log('\n5) Ajustes del total emiten recibo actualizado')
const o2 = await pedir(ANA, [{ product_id: P1, cantidad: 2 }])
await como(db, SUP, `select descontar_pedido($1,200,'Cortesía')`, [o2.id])
let x = (await q(`select * from orders where id=$1`, [o2.id])).rows[0]
bien(N(x.total) === 1800 && N(x.balance) === 1800, 'contado con descuento: total y deuda 1,800')
await como(db, SUP, `select poner_envio($1,300,'Caribe Tours')`, [o2.id])
x = (await q(`select * from orders where id=$1`, [o2.id])).rows[0]
bien(N(x.total) === 2100 && N(x.balance) === 2100 && await saldo() === 2100, 'contado con envío: debe 2,100')
rs = await recibos(o2.id)
bien(rs.map((r) => r.tipo).join(',') === 'venta,ajuste,ajuste' && N(rs[2].envio) === 300 && N(rs[2].resta) === 2100, 'venta + 2 recibos actualizados (descuento y envío)')
await pagar(o2.id, 1000)
await q(`update orders set status='cancelado' where id=$1`, [o2.id])
bien(await saldo() === 0, 'cancelar quita lo que se debía de ese pedido')

console.log('\n6) Quién ve los recibos')
// 3 del primer pedido (venta, abono, pagado) + 4 del segundo (venta, 2 ajustes, abono)
bien((await como(db, ANA, `select * from recibos`)).rows.length === 7, 'Ana ve sus 7 recibos')
bien((await como(db, BEA, `select * from recibos`)).rows.length === 0, 'Bea no ve los de Ana')
bien((await como(db, NADA, `select * from recibos`)).rows.length === 0, 'personal sin permiso no los ve')
bien((await como(db, SUP, `select * from recibos`)).rows.length === 7, 'el personal con permiso los ve')
await falla(() => como(db, SUP, `insert into recibos(numero,order_id,client_id,tipo,cliente,productos,subtotal,total,resta,pedido) values('X',$1,$2,'venta','{}','[]',0,0,0,'x')`, [o.id, cA]), 'nadie crea recibos a mano')
await falla(() => como(db, SUP, `update recibos set resta=0`), 'nadie cambia un recibo')
await falla(() => como(db, ANA, `select emitir_recibo($1,'venta')`, [o.id]), 'la clienta no puede emitir recibos')

console.log('\n7) Tildes bien escritas en los mensajes')
const def = (await q(`select pg_get_functiondef('crear_pedido'::regproc) d`)).rows[0].d
bien(def.includes('crédito aprobado') && !/[Â-Å][\u0080-¿]/.test(def), 'crear_pedido dice "crédito" bien escrito')
const def2 = (await q(`select pg_get_functiondef('poner_envio'::regproc) d`)).rows[0].d
bien(def2.includes('poner el envío'), 'poner_envio dice "envío" bien escrito')

console.log(`\n${ok} bien, ${mal} mal`)
process.exit(mal ? 1 : 0)

