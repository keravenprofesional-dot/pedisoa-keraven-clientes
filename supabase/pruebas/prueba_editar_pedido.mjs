// Editar el pedido antes de aprobarlo (26-10-2026).
import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const error = async (fn) => { try { await fn(); return '' } catch (e) { return e.message } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id
const N = Number

await q(`update company_settings set catalogo_publicado = true`)
const SUP = await nu('s@x'), GER = await nu('g@x'), ALM = await nu('a@x'), ANA = await nu('ana@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','Dueño')`, [SUP])
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'personal','ger','2','Leticia'),($2,'personal','alm','3','Almacén')`, [GER, ALM])
await q(`insert into pedidos_usuario_permisos(profile_id,permiso,concedido) values($1,'editar_pedidos',true)`, [GER])
await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','ANA')`, [ANA])
const cA = (await q(`insert into clients(profile_id,full_name,telefono_login,credit_enabled,credit_limit) values($1,'ANA','8091110000',true,50000) returning id`, [ANA])).rows[0].id
const P = (await q(`insert into products(nombre,precio,stock) values('Shampoo',1000,50) returning id`)).rows[0].id
const M = (await q(`insert into products(nombre,precio,stock) values('Mascarilla',500,5) returning id`)).rows[0].id
const C = (await q(`insert into products(nombre,precio,stock,tipo) values('Caja 6 shampoo',5000,null,'duo_pack') returning id`)).rows[0].id
await q(`insert into product_items(product_id,componente_id,cantidad) values($1,$2,6)`, [C, P])
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id
const pedir = async (items, pago = 'contado') => (await como(db, ANA, `select * from crear_pedido($1::jsonb,'parada',$2,null,$3,0,'')`, [JSON.stringify(items), parada, pago])).rows[0]
const lineas = async (oid) => (await q(`select i.*, p.nombre from order_items i join products p on p.id=i.product_id where order_id=$1 order by p.nombre`, [oid])).rows
const stock = async (id) => (await q(`select stock from products where id=$1`, [id])).rows[0].stock
const debe = async () => N((await q(`select balance_pendiente b from clients where id=$1`, [cA])).rows[0].b)
const editar = (uid, oid, items, desc = 0, motivo = '') =>
  como(db, uid, `select * from editar_pedido($1,$2::jsonb,$3,$4)`, [oid, JSON.stringify(items), desc, motivo]).then((r) => r.rows[0])

console.log('1) Quién puede')
const o1 = await pedir([{ product_id: P, cantidad: 4 }], 'credito')     // 4,000 a crédito
let [l1] = await lineas(o1.id)
bien(/permiso/.test(await error(() => editar(ALM, o1.id, [{ item_id: l1.id, cantidad: 2 }]))), 'sin el permiso: no')
bien(/permiso/.test(await error(() => editar(ANA, o1.id, [{ item_id: l1.id, cantidad: 2 }]))), 'la clienta: no')
bien((await q(`select count(*)::int n from pedidos_permisos where clave='editar_pedidos'`)).rows[0].n === 1, 'el permiso aparece en la lista')

console.log('\n2) Cambiar cantidad, agregar y descontar')
await q(`update products set precio = 1100 where id = $1`, [P])         // sube el precio después del pedido
let r = await editar(GER, o1.id, [{ item_id: l1.id, cantidad: 3 }, { product_id: M, cantidad: 2 }], 500, 'Clienta fiel')
let ls = await lineas(o1.id)
bien(ls.length === 2 && N(ls[1].precio_unitario) === 1000 && ls[1].cantidad === 3, 'el shampoo queda en 3, con su precio de 1,000 (no el nuevo)')
bien(N(ls[0].precio_unitario) === 500 && ls[0].cantidad === 2, 'la mascarilla entra al precio de hoy')
bien(N(r.subtotal) === 4000 && N(r.descuento) === 500 && N(r.total) === 3500 && N(r.balance) === 3500, 'subtotal 4,000 − 500 = 3,500 y debe 3,500')
bien(r.descuento_nota === 'Clienta fiel' && r.descuento_por_texto === 'Leticia' && r.editado_en, 'queda el motivo, quién y cuándo')
bien(await stock(P) === 47 && await stock(M) === 3, 'existencia: shampoo vuelve 1 (47), mascarilla baja 2 (3)')
bien(await debe() === 3500, 'lo que debe la clienta pasa a 3,500')
const ed = (await q(`select * from pedido_ediciones where order_id=$1`, [o1.id])).rows
bien(ed.length === 1 && ed[0].antes.length === 1 && ed[0].despues.length === 2 && N(ed[0].total_antes) === 4000 && N(ed[0].total_despues) === 3500, 'queda anotado cómo estaba y cómo quedó')
bien((await como(db, ANA, `select count(*)::int n from pedido_ediciones`)).rows[0].n === 1, 'la clienta ve que su pedido fue ajustado')

console.log('\n3) Quitar una línea y quitar el descuento')
ls = await lineas(o1.id)
r = await editar(GER, o1.id, [{ item_id: ls.find((x) => x.nombre === 'Shampoo').id, cantidad: 3 }], 0)
bien(N(r.total) === 3000 && N(r.descuento) === 0 && r.descuento_nota === null, 'sin mascarilla y sin descuento: 3,000')
bien(await stock(M) === 5 && await debe() === 3000, 'la mascarilla vuelve al inventario y debe 3,000')

console.log('\n4) Lo que no se deja')
l1 = (await lineas(o1.id))[0]
bien(/sin productos/.test(await error(() => editar(GER, o1.id, []))), 'dejarlo vacío: no (que lo cancelen)')
bien(/existencia/.test(await error(() => editar(GER, o1.id, [{ item_id: l1.id, cantidad: 3 }, { product_id: M, cantidad: 9 }]))), 'más de lo que hay: no')
bien(await stock(P) === 47 && await stock(M) === 5, 'y si falla no se mueve nada')
bien(/subtotal/.test(await error(() => editar(GER, o1.id, [{ item_id: l1.id, cantidad: 3 }], 9999, 'x'))), 'descuento mayor que el subtotal: no')
bien(/motivo/.test(await error(() => editar(GER, o1.id, [{ item_id: l1.id, cantidad: 3 }], 100, ''))), 'descuento sin motivo: no')
bien(/no es de este pedido/.test(await error(() => editar(GER, o1.id, [{ item_id: '00000000-0000-0000-0000-000000000000', cantidad: 1 }]))), 'línea de otro pedido: no')
await q(`update orders set status='confirmado' where id=$1`, [o1.id])
bien(/confirmado/.test(await error(() => editar(GER, o1.id, [{ item_id: l1.id, cantidad: 1 }]))), 'ya confirmado: no se edita')
bien(/confirmado/.test(await error(() => editar(SUP, o1.id, [{ item_id: l1.id, cantidad: 1 }]))), 'ni el dueño')

console.log('\n5) Pagos ya hechos')
const o2 = await pedir([{ product_id: P, cantidad: 2 }])                 // contado 2,200
await como(db, SUP, `select reportar_pago($1,2000,'efectivo',null,null)`, [o2.id])
let l2 = (await lineas(o2.id))[0]
bien(/ya pagó/.test(await error(() => editar(GER, o2.id, [{ item_id: l2.id, cantidad: 1 }]))), 'no puede quedar por debajo de lo pagado')
r = await editar(GER, o2.id, [{ item_id: l2.id, cantidad: 2 }], 200, 'Redondeo')
bien(N(r.total) === 2000 && N(r.balance) === 0, 'contado: puede bajar justo hasta lo pagado; balance sigue en 0')

console.log('\n6) Cajas')
const o3 = await pedir([{ product_id: C, cantidad: 1 }])
let l3 = (await lineas(o3.id))[0]
await editar(GER, o3.id, [{ item_id: l3.id, cantidad: 3 }])
l3 = (await lineas(o3.id))[0]
bien(l3.detalle[0].cantidad === 18, 'lo que va dentro de la caja crece con ella (6 → 18 shampoo)')
await editar(GER, o3.id, [{ item_id: l3.id, cantidad: 3 }, { product_id: C, cantidad: 1 }])
const nueva = (await lineas(o3.id)).find((x) => x.cantidad === 1)
bien(nueva && nueva.detalle[0].cantidad === 6, 'una caja agregada lleva su lista adentro')

console.log('\n7) Cancelar después de editar devuelve lo de ahora')
const o4 = await pedir([{ product_id: M, cantidad: 1 }])
const l4 = (await lineas(o4.id))[0]
await editar(GER, o4.id, [{ item_id: l4.id, cantidad: 3 }])
bien(await stock(M) === 2, 'quedan 2 mascarillas')
await como(db, SUP, `update orders set status='cancelado' where id=$1`, [o4.id])
bien(await stock(M) === 5, 'al cancelar vuelven las 3')

console.log('\n8) La venta pendiente del ERP se rehace (si el puente sigue)')
await db.exec(`create table contratos (id serial primary key, estado text, monto numeric, descuento numeric, neto numeric, saldo numeric, observaciones text, origen text);
         create table contrato_productos (contrato_id int, producto_id int, cantidad int)`)
await q(`create table if not exists erp_enlace_pedidos (order_id uuid primary key, contrato_id int)`)
await q(`create table if not exists erp_equivalencias (product_id uuid primary key, producto_id int)`)
await q(`create table if not exists erp_errores (id serial, que text, order_id uuid, detalle text, creado_en timestamptz default now())`)
const o5 = await pedir([{ product_id: P, cantidad: 2 }])
await q(`insert into erp_equivalencias values ($1, 11), ($2, 22) on conflict do nothing`, [P, M])
const con = (await q(`insert into contratos (estado,monto,descuento,neto,saldo,origen) values ('pendiente',2200,0,2200,2200,'pedidos') returning id`)).rows[0].id
await q(`insert into erp_enlace_pedidos values ($1,$2)`, [o5.id, con])
await q(`insert into contrato_productos values ($1,11,2)`, [con])
const l5 = (await lineas(o5.id))[0]
await editar(GER, o5.id, [{ item_id: l5.id, cantidad: 1 }, { product_id: M, cantidad: 2 }], 100, 'x')
const cps = (await q(`select producto_id, cantidad from contrato_productos where contrato_id=$1 order by 1`, [con])).rows
bien(cps.length === 2 && cps[0].cantidad === 1 && cps[1].cantidad === 2, 'la venta del ERP queda con 1 shampoo y 2 mascarillas (sin duplicar)')
const cv = (await q(`select * from contratos where id=$1`, [con])).rows[0]
bien(N(cv.monto) === 2100 && N(cv.descuento) === 100 && N(cv.neto) === 2000, 'monto 2,100, descuento 100, neto 2,000')

console.log(`\n${ok} bien, ${mal} mal`)
process.exit(mal ? 1 : 0)
