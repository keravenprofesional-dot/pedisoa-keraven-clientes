// Puente Pedidos → Keraven Systems Masters, probado sobre una copia local con
// las tablas reales del ERP (C:/Keraven-Systems-Masters/schema.sql). No toca Supabase.
import { nuevaBase, como } from './base.mjs'
import fs from 'fs'
const db = await nuevaBase()
await db.exec(fs.readFileSync('C:/Keraven-Systems-Masters/schema.sql', 'utf8'))
// Con las tablas del ERP ya puestas, se vuelven a pasar las migraciones del puente
// (en la base real el ERP ya existía cuando se aplicaron)
for (const m of ['20261014060000_puente_con_systems_masters.sql', '20261014090000_erp_completar_productos.sql', '20261014100000_cancelar_siempre_devuelve.sql'])
  await db.exec(fs.readFileSync(new URL('../migrations/' + m, import.meta.url), 'utf8'))
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id
const N = Number

await q(`update company_settings set catalogo_publicado = true`)
const SUP = await nu('s@x'), ANA = await nu('ana@x'), BEA = await nu('bea@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','D')`, [SUP])
for (const [u, n, t, ced] of [[ANA, 'ANA PEREZ', '8091110000', '001-1234567-8'], [BEA, 'BEA GOMEZ', '809-222-0000', '402-0000000-1']]) {
  await q(`insert into profiles(id,tipo,full_name) values($1,'clienta',$2)`, [u, n])
  await q(`insert into clients(profile_id,full_name,telefono_login,cedula,direccion,sector) values($1,$2,$3,$4,'C/ 1','Los Mina')`, [u, n, t, ced])
}
const cA = (await q(`select id from clients where profile_id=$1`, [ANA])).rows[0].id
const cB = (await q(`select id from clients where profile_id=$1`, [BEA])).rows[0].id
// Bea ya existía en el ERP (la encuentra por teléfono, aunque esté escrito distinto)
const erpBea = (await q(`insert into clientes(nombre,telefono1) values('Bea Gómez','(809) 222-0000') returning id`)).rows[0].id

// Productos: dos con equivalencia en el ERP, uno sin ella, y un Duo Pack que lleva los dos primeros
const E_SH = (await q(`insert into productos(nombre,codigo) values('Shampoo Coco 16 oz','SH-COC-16') returning id`)).rows[0].id
const E_TR = (await q(`insert into productos(nombre,codigo) values('Tratamiento Coco 10 oz','TR-COC-10') returning id`)).rows[0].id
const P_SH = (await q(`insert into products(nombre,precio,stock) values('Shampoo Coco 16',500,100) returning id`)).rows[0].id
const P_TR = (await q(`insert into products(nombre,precio,stock) values('Tratamiento Coco 10',400,100) returning id`)).rows[0].id
const P_LI = (await q(`insert into products(nombre,precio,stock) values('Leave-in 32',900,100) returning id`)).rows[0].id
const P_DP = (await q(`insert into products(nombre,precio,stock,tipo) values('Duo Pack Coco',800,100,'duo_pack') returning id`)).rows[0].id
await q(`insert into product_items(product_id,componente_id,cantidad) values($1,$2,1),($1,$3,1)`, [P_DP, P_SH, P_TR])
await q(`insert into erp_equivalencias(product_id,producto_id) values($1,$2),($3,$4)`, [P_SH, E_SH, P_TR, E_TR])
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id
const pedir = async (uid, items, obs = '') => (await como(db, uid,
  `select * from crear_pedido($1::jsonb,'parada',$2,null,'contado',0,$3)`, [JSON.stringify(items), parada, obs])).rows[0]
const venta = async (oid) => (await q(`select c.* from contratos c join erp_enlace_pedidos e on e.contrato_id=c.id where e.order_id=$1`, [oid])).rows[0]
const prods = async (cid) => (await q(`select p.nombre, sum(cp.cantidad)::int n from contrato_productos cp join productos p on p.id=cp.producto_id where cp.contrato_id=$1 group by 1 order by 1`, [cid])).rows.map(r => `${r.n}× ${r.nombre}`).join(', ')
const errores = async () => (await q(`select count(*)::int n from erp_errores`)).rows[0].n

console.log('1) Pedido nuevo → venta pendiente en el Buzón del ERP')
const o1 = await pedir(ANA, [{ product_id: P_SH, cantidad: 2 }, { product_id: P_TR, cantidad: 1 }], 'Llamar antes')
let v = await venta(o1.id)
bien(!!v, 'el pedido creó su venta en el ERP')
bien(v.estado === 'pendiente' && v.origen === 'pedidos', 'pendiente en el Buzón, con firma "pedidos"')
bien(v.numero_factura === o1.order_number, 'mismo número que el pedido: ' + v.numero_factura)
bien(v.promotor_id === null && v.promotor_nombre === null, 'sin promotor (no genera comisión)')
bien(N(v.monto) === 1400 && N(v.neto) === 1400 && N(v.saldo) === 1400 && N(v.descuento) === 0, 'monto, neto y saldo = 1,400')
bien(v.tipo_venta === 'contado' && v.canal === 'oficina', 'contado, canal oficina')
bien(v.observaciones.includes('Pedidos Keraven') && v.observaciones.includes('Llamar antes'), 'observaciones dicen de dónde vino y la nota del cliente')
bien(await prods(v.id) === '2× Shampoo Coco 16 oz, 1× Tratamiento Coco 10 oz', 'productos en el ERP: ' + await prods(v.id))
const cliA = (await q(`select * from clientes where id=$1`, [v.cliente_id])).rows[0]
bien(cliA.nombre === 'ANA PEREZ' && cliA.cedula === '001-1234567-8' && cliA.telefono1 === '8091110000', 'Ana no existía en el ERP: se creó con cédula y teléfono')
bien(cliA.direccion.includes('Los Mina'), 'con su dirección')

console.log('\n2) El mismo cliente no se duplica; uno que ya existía se reconoce')
const o2 = await pedir(ANA, [{ product_id: P_SH, cantidad: 1 }])
bien((await venta(o2.id)).cliente_id === v.cliente_id, 'segundo pedido de Ana: mismo cliente del ERP')
bien((await q(`select count(*)::int n from clientes where nombre='ANA PEREZ'`)).rows[0].n === 1, 'Ana está una sola vez en el ERP')
const o3 = await pedir(BEA, [{ product_id: P_SH, cantidad: 1 }])
bien((await venta(o3.id)).cliente_id === erpBea, 'Bea se reconoce por su teléfono aunque esté escrito distinto')

console.log('\n3) Duo Pack entra por lo que lleva; lo que no tiene equivalencia se anota')
const o4 = await pedir(ANA, [{ product_id: P_DP, cantidad: 3 }, { product_id: P_LI, cantidad: 2 }])
v = await venta(o4.id)
bien(await prods(v.id) === '3× Shampoo Coco 16 oz, 3× Tratamiento Coco 10 oz', 'Duo Pack ×3 = 3 shampoo + 3 tratamiento: ' + await prods(v.id))
bien(v.observaciones.includes('Sin equivalencia en el ERP: 2× Leave-in 32'), 'el Leave-in sin equivalencia queda anotado')
bien(N(v.monto) === 4200, 'el monto es el del pedido completo (4,200)')

console.log('\n4) Descuento después → el ERP cobra el neto, no el bruto')
await q(`insert into permisos(clave,nombre) values('dar_descuentos','Dar descuentos') on conflict do nothing`).catch(() => {})
await como(db, SUP, `select descontar_pedido($1, 200, 'Cliente fiel')`, [o1.id])
v = await venta(o1.id)
bien(N(v.monto) === 1400 && N(v.descuento) === 200 && N(v.neto) === 1200 && N(v.saldo) === 1200, `descuento 200: neto ${N(v.neto)}, saldo ${N(v.saldo)}`)

console.log('\n5) El Buzón del ERP decide → el pedido del cliente cambia')
await q(`update contratos set estado='aprobado', decidido_en=now() where id=$1`, [v.id])
bien((await q(`select status from orders where id=$1`, [o1.id])).rows[0].status === 'confirmado', 'aprobado en el Buzón → pedido "confirmado"')
bien((await q(`select count(*)::int n from comisiones_semanas where contrato_id=$1`, [v.id])).rows[0].n === 0, 'sin comisión')
const v2 = await venta(o2.id)
await q(`update contratos set estado='rechazado', decidido_en=now() where id=$1`, [v2.id])
bien((await q(`select status from orders where id=$1`, [o2.id])).rows[0].status === 'cancelado', 'rechazado en el Buzón → pedido cancelado')

console.log('\n6) Cancelado en Pedidos → rechazado (en el Buzón) o anulado (si ya estaba aprobado)')
await q(`update orders set status='cancelado' where id=$1`, [o3.id])
bien((await venta(o3.id)).estado === 'rechazado', 'seguía en el Buzón: queda rechazado')
const o5 = await pedir(BEA, [{ product_id: P_TR, cantidad: 1 }])
const v5 = await venta(o5.id)
await q(`update contratos set estado='aprobado' where id=$1`, [v5.id])
await q(`update orders set status='cancelado' where id=$1`, [o5.id])
const v5b = await venta(o5.id)
bien(v5b.estado === 'anulado' && v5b.motivo_anulacion.includes('Pedidos Keraven'), 'ya aprobado: queda anulado, con el motivo')

console.log('\n7) Pago confirmado en Pedidos → abono en el ERP')
const BAN = (await q(`insert into bank_accounts(banco,tipo_cuenta,numero,titular) values('Banco Popular','Ahorro','812-345678','Keraven') returning id`)).rows[0].id
const r = (await como(db, ANA, `select * from reportar_pago($1,1200,'transferencia',$2,'5566')`, [o1.id, BAN])).rows[0]
bien((await q(`select count(*)::int n from contrato_abonos where contrato_id=$1`, [v.id])).rows[0].n === 0, 'reportado (sin confirmar): todavía no es abono')
await como(db, SUP, `select confirmar_pago($1,'confirmado')`, [r.id])
const ab = (await q(`select * from contrato_abonos where contrato_id=$1`, [v.id])).rows[0]
bien(ab && N(ab.monto) === 1200 && ab.via === 'pedidos' && ab.nota.includes('Ref. 5566'), 'abono de 1,200 vía pedidos, con la referencia')
bien(N((await venta(o1.id)).saldo) === 0, 'saldo en el ERP: 0')

console.log('\n8) Si el ERP falla, el pedido del cliente se guarda igual')
await q(`alter table contratos add constraint prueba_falla check (monto < 0) not valid`)
const o6 = await pedir(ANA, [{ product_id: P_SH, cantidad: 1 }])
bien(!!o6 && !!o6.id, 'el pedido se guardó')
bien(!(await venta(o6.id)), 'no hay venta en el ERP')
bien(await errores() >= 1, 'el error quedó anotado en erp_errores')
await q(`alter table contratos drop constraint prueba_falla`)
const id6 = (await como(db, SUP, `select erp_enviar_pedido_manual($1) id`, [o6.id])).rows[0].id
bien(!!id6 && await prods(id6) === '1× Shampoo Coco 16 oz', 'reenviado a mano después: entra con sus productos')
let negado = false; try { await como(db, ANA, `select erp_enviar_pedido_manual($1)`, [o6.id]) } catch { negado = true }
bien(negado, 'un cliente no puede mandar pedidos al ERP a mano')

console.log('\n9) Seguridad')
let leyo = true; try { await como(db, ANA, `select * from erp_enlace_pedidos`) } catch { leyo = false }
bien(!leyo, 'un cliente no ve los enlaces con el ERP')
bien((await como(db, ANA, `select count(*)::int n from erp_equivalencias`)).rows[0].n === 0, 'un cliente no ve las equivalencias')
bien((await como(db, SUP, `select count(*)::int n from erp_equivalencias`)).rows[0].n === 2, 'el personal sí')

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
if (mal) process.exitCode = 1

console.log('\n10) Lista de productos del ERP para la pantalla de equivalencias')
await db.exec(fs.readFileSync(new URL('../migrations/20261014070000_equivalencias_erp.sql', import.meta.url), 'utf8'))
const lista = (await como(db, SUP, `select * from erp_lista_productos()`)).rows
bien(lista.length === 2 && lista[0].nombre === 'Shampoo Coco 16 oz', 'el personal con permiso ve la lista del ERP')
let cli = true; try { await como(db, ANA, `select * from erp_lista_productos()`) } catch { cli = false }
bien(!cli, 'un cliente no puede pedir la lista')
let vista = true; try { await como(db, ANA, `select * from erp_productos`) } catch { vista = false }
bien(!vista, 'un cliente ya no puede leer la vista vieja')
await como(db, SUP, `insert into erp_equivalencias(product_id,producto_id,puesto_por) values($1,$2,$3)`, [P_LI, E_TR, SUP])
const o7 = await pedir(ANA, [{ product_id: P_LI, cantidad: 1 }])
bien(await prods((await venta(o7.id)).id) === '1× Tratamiento Coco 10 oz', 'equivalencia puesta desde la pantalla: el pedido ya entra con su producto')
console.log(`\nResultado final: ${ok} bien, ${mal} fallas`)
if (mal) process.exitCode = 1

console.log('\n11) Al poner un enlace, las ventas que ya llegaron se completan solas')
const P_X = (await q(`insert into products(nombre,precio,stock) values('Gotero 4',300,100) returning id`)).rows[0].id
const P_Y = (await q(`insert into products(nombre,precio,stock) values('Gotica 4',200,100) returning id`)).rows[0].id
const P_DP2 = (await q(`insert into products(nombre,precio,stock,tipo) values('Duo Goteros',450,100,'duo_pack') returning id`)).rows[0].id
await q(`insert into product_items(product_id,componente_id,cantidad) values($1,$2,1),($1,$3,1)`, [P_DP2, P_X, P_Y])
const E_GO = (await q(`insert into productos(nombre,codigo) values('Gotero crecimiento 4oz','GOTE-1') returning id`)).rows[0].id
const E_GI = (await q(`insert into productos(nombre,codigo) values('Gotica brillo 4oz','GOTI-1') returning id`)).rows[0].id
const o8 = await pedir(ANA, [{ product_id: P_X, cantidad: 2 }, { product_id: P_DP2, cantidad: 1 }])
let v8 = await venta(o8.id)
bien(await prods(v8.id) === '' && v8.observaciones.includes('2× Gotero 4') && v8.observaciones.includes('Gotica 4'), 'sin enlaces: llegan como nota')
await como(db, SUP, `insert into erp_equivalencias(product_id,producto_id) values($1,$2)`, [P_X, E_GO])
v8 = await venta(o8.id)
bien(await prods(v8.id) === '3× Gotero crecimiento 4oz', 'enlazado el gotero: 2 sueltos + 1 del Duo, ya en la venta: ' + await prods(v8.id))
bien(!v8.observaciones.includes('Gotero 4') && v8.observaciones.includes('Gotica 4'), 'la nota ya solo dice lo que falta (la gotica)')
await como(db, SUP, `insert into erp_equivalencias(product_id,producto_id) values($1,$2)`, [P_Y, E_GI])
v8 = await venta(o8.id)
bien(await prods(v8.id) === '3× Gotero crecimiento 4oz, 1× Gotica brillo 4oz', 'enlazada la gotica: venta completa')
bien(!v8.observaciones.includes('Sin equivalencia'), 'ya no queda nota de faltantes')
bien(v8.observaciones.includes('Pedidos Keraven'), 'lo demás de las observaciones sigue igual')
await q(`update contratos set estado='rechazado' where id=$1`, [v8.id])
await como(db, SUP, `update erp_equivalencias set producto_id=$2 where product_id=$1`, [P_Y, E_GO])
bien(await prods(v8.id) === '3× Gotero crecimiento 4oz, 1× Gotica brillo 4oz', 'una venta rechazada no se toca')

console.log('\n12) Cédula de relleno no pasa al ERP')
const MAL = await nu('mal@x')
await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','JINETE')`, [MAL])
await q(`alter table clients disable trigger trg_cedula_cliente`)
await q(`insert into clients(profile_id,full_name,telefono_login,cedula) values($1,'JINETE','8496557032','000000000')`, [MAL])
await q(`alter table clients enable trigger trg_cedula_cliente`)
const o9 = await pedir(MAL, [{ product_id: P_SH, cantidad: 1 }])
const c9 = (await q(`select cedula from clientes where id=$1`, [(await venta(o9.id)).cliente_id])).rows[0]
bien(c9.cedula === null, 'el cliente nuevo del ERP queda sin cédula, no con "000000000"')
console.log(`\nResultado final: ${ok} bien, ${mal} fallas`)
if (mal) process.exitCode = 1

console.log('\n13) Cancelado desde el ERP: el stock y la deuda vuelven')
const P_S = (await q(`insert into products(nombre,precio,stock) values('Con stock',100,10) returning id`)).rows[0].id
const o10 = await pedir(BEA, [{ product_id: P_S, cantidad: 3 }])
const st = async () => (await q(`select stock from products where id=$1`, [P_S])).rows[0].stock
bien(await st() === 7, 'pedir 3 baja el stock a 7')
await q(`update contratos set estado='rechazado' where id=$1`, [(await venta(o10.id)).id])
bien((await q(`select status from orders where id=$1`, [o10.id])).rows[0].status === 'cancelado' && await st() === 10, 'rechazado en el Buzón: pedido cancelado y el stock vuelve a 10')
console.log(`\nResultado final: ${ok} bien, ${mal} fallas`)
if (mal) process.exitCode = 1
