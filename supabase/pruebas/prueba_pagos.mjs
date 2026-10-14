import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const falla = async (fn, m) => { try { await fn(); bien(false, m) } catch { bien(true, m) } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id
const N = Number

const SUP = await nu('s@x'), ALM = await nu('a@x'), ANA = await nu('ana@x'), BEA = await nu('bea@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','D')`, [SUP])
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'personal','alm','3','A')`, [ALM])
for (const [u, n, t] of [[ANA, 'Ana', '8091110000'], [BEA, 'Bea', '8092220000']]) {
  await q(`insert into profiles(id,tipo,full_name) values($1,'clienta',$2)`, [u, n])
  await q(`insert into clients(profile_id,full_name,telefono_login,credit_enabled) values($1,$2,$3,true)`, [u, n, t])
}
const cA = (await q(`select id from clients where profile_id=$1`, [ANA])).rows[0].id
const P1 = (await q(`insert into products(nombre,precio,stock) values('Shampoo',1000,100) returning id`)).rows[0].id
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id
const BAN = (await q(`insert into bank_accounts(banco,tipo_cuenta,numero,titular) values('Banco Popular','Ahorro','812-345678','Keraven Profesional') returning id`)).rows[0].id
const VIEJA = (await q(`insert into bank_accounts(banco,numero,titular,activo) values('Banco Viejo','000','X',false) returning id`)).rows[0].id
const pedir = async (uid, cant, pago = 'contado') => (await como(db, uid,
  `select * from crear_pedido($1::jsonb,'parada',$2,null,$3,0,'')`, [JSON.stringify([{ product_id: P1, cantidad: cant }]), parada, pago])).rows[0]
const reportar = (uid, o, monto, metodo, cuenta, ref) => como(db, uid, `select * from reportar_pago($1,$2,$3,$4,$5)`, [o, monto, metodo, cuenta, ref])

const o = await pedir(ANA, 2)   // contado, total 2,000
console.log('1) El cliente reporta su pago')
await falla(() => reportar(BEA, o.id, 2000, 'transferencia', BAN, '5566'), 'Bea no reporta pagos del pedido de Ana')
await falla(() => reportar(ANA, o.id, 2000, 'transferencia', null, '5566'), 'transferencia sin cuenta: no')
await falla(() => reportar(ANA, o.id, 2000, 'transferencia', VIEJA, '5566'), 'a una cuenta apagada: no')
await falla(() => reportar(ANA, o.id, 2000, 'transferencia', BAN, ''), 'sin número de referencia: no')
await falla(() => reportar(ANA, o.id, 2500, 'transferencia', BAN, '5566'), 'más que el total: no')
await falla(() => como(db, ANA, `insert into pagos_reportados(order_id,monto,metodo,estado) values($1,2000,'efectivo','confirmado')`, [o.id]), 'el cliente no se marca pagado a mano')
let r = (await reportar(ANA, o.id, 2000, 'transferencia', BAN, '5566')).rows[0]
bien(r.estado === 'reportado', 'queda "en revisión"')
bien(r.cuenta_texto === 'Banco Popular · Ahorro · 812-345678 · Keraven Profesional', 'guarda a qué cuenta pagó: ' + r.cuenta_texto)
await falla(() => reportar(ANA, o.id, 100, 'efectivo', null, null), 'no se reporta otro mientras uno está en revisión')
bien((await como(db, ANA, `select count(*)::int n from pagos_reportados`)).rows[0].n === 1, 'Ana ve su pago')
bien((await como(db, BEA, `select count(*)::int n from pagos_reportados`)).rows[0].n === 0, 'Bea no ve el pago de Ana')

console.log('\n2) El personal lo confirma o rechaza')
await falla(() => como(db, ALM, `select confirmar_pago($1,'confirmado')`, [r.id]), 'Almacén (sin permiso) no confirma')
await falla(() => como(db, ANA, `select confirmar_pago($1,'confirmado')`, [r.id]), 'el cliente no se confirma él mismo')
await falla(() => como(db, SUP, `select confirmar_pago($1,'rechazado','')`, [r.id]), 'rechazar sin motivo: no')
r = (await como(db, SUP, `select * from confirmar_pago($1,'rechazado','No llegó la transferencia')`, [r.id])).rows[0]
bien(r.estado === 'rechazado' && r.nota === 'No llegó la transferencia', 'rechazado con su motivo')
r = (await reportar(ANA, o.id, 2000, 'transferencia', BAN, '7788')).rows[0]
r = (await como(db, SUP, `select * from confirmar_pago($1,'confirmado')`, [r.id])).rows[0]
bien(r.estado === 'confirmado' && r.confirmado_por === SUP, 'confirmado, con quién y cuándo')
await falla(() => como(db, SUP, `select confirmar_pago($1,'rechazado','x')`, [r.id]), 'un pago confirmado no se vuelve a tocar')
await falla(() => reportar(ANA, o.id, 1, 'efectivo', null, null), 'ya pagado completo: no se reporta más')

console.log('\n3) Pedido a crédito: confirmar baja lo que debe')
const oc = await pedir(ANA, 3, 'credito')   // debe 3,000
const saldo = async () => N((await q(`select balance_pendiente b from clients where id=$1`, [cA])).rows[0].b)
bien(await saldo() === 3000, 'Ana debe 3,000')
r = (await reportar(ANA, oc.id, 1000, 'deposito', BAN, 'DEP-1')).rows[0]
await como(db, SUP, `select confirmar_pago($1,'confirmado')`, [r.id])
bien(await saldo() === 2000, 'confirmado el abono de 1,000: debe 2,000')
const pg = (await q(`select * from payments where order_id=$1`, [oc.id])).rows[0]
bien(pg && N(pg.monto) === 1000 && pg.cuenta_texto.startsWith('Banco Popular') && pg.referencia === 'DEP-1', 'el pago de crédito guarda cuenta y referencia')

console.log('\n4) El personal registra un pago directo')
r = (await reportar(SUP, oc.id, 500, 'efectivo', null, null)).rows[0]
bien(r.estado === 'confirmado', 'efectivo registrado por el personal: confirmado de una vez')
bien(await saldo() === 1500, 'Ana debe 1,500')
await falla(() => reportar(ALM, oc.id, 100, 'efectivo', null, null), 'Almacén no registra pagos')

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
