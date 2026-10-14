// Buzón de solicitudes de cliente nuevo: enviar sin cuenta, atender con permiso.
import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const falla = async (fn, m) => { try { await fn(); bien(false, m) } catch { bien(true, m) } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id

const SUP = await nu('supremo@x'), MAN = await nu('manuel@x'), ALM = await nu('almacen@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'supremo','8091','Dueno')`, [SUP])
const rol = (await q(`select id from pedidos_roles where nombre='Super usuario'`)).rows[0].id
await q(`insert into profiles(id,tipo,rol_id,usuario,telefono,full_name) values($1,'personal',$2,'manuel','8092','Manuel')`, [MAN, rol])
// Almacén: personal SIN crear_clientas ni ver_solicitudes
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'personal','almacen','8093','Alma')`, [ALM])

console.log('1) Una persona sin cuenta envía su solicitud')
const env = (uid) => como(db, uid, `select solicitar_cliente('Ana Perez Gomez','809-111-2233','809-444-5566','001-1234567-8','Calle 1','ana@correo.com') id`)
const r1 = await env(null)   // anon, sin iniciar sesión
bien(r1.rows[0].id, 'anon puede enviar una solicitud')
const total = (await q(`select count(*)::int n, estado from solicitudes_cliente group by estado`)).rows
bien(total.length === 1 && total[0].n === 1 && total[0].estado === 'pendiente', 'queda 1 solicitud pendiente')

console.log('\n2) No se duplica ni se cuela basura')
await falla(() => env(null), 'no deja una segunda solicitud con el mismo correo/teléfono')
await falla(() => como(db, null, `select solicitar_cliente('Ab','8091112222','','','','x@y.com')`), 'rechaza nombre muy corto')
await falla(() => como(db, null, `select solicitar_cliente('Pedro Luis','809','','','','p@y.com')`), 'rechaza teléfono corto')
await falla(() => como(db, null, `select solicitar_cliente('Pedro Luis','8091112233','','00112345678','','sin-arroba')`), 'rechaza correo inválido')

console.log('\n3) El buzón solo lo ve el personal con permiso')
const leer = async (uid) => (await como(db, uid, `select count(*)::int n from solicitudes_cliente`)).rows[0].n
bien(await leer(SUP) === 1, 'el supremo ve la solicitud')
bien(await leer(MAN) === 1, 'Manuel (crea clientes) ve la solicitud')
bien(await leer(ALM) === 0, 'Almacén, sin permiso, NO ve el buzón')
bien(await leer(null) === 0, 'un anónimo no puede leer el buzón')

console.log('\n4) Atender la solicitud')
const sid = r1.rows[0].id
await falla(() => como(db, ALM, `select atender_solicitud($1,'aprobada','ok')`, [sid]), 'Almacén no puede atender')
const at = await como(db, MAN, `select estado from atender_solicitud($1,'aprobada','Cliente creado')`, [sid])
bien(at.rows[0].estado === 'aprobada', 'Manuel aprueba la solicitud')
await falla(() => como(db, MAN, `select atender_solicitud($1,'rechazada','x')`, [sid]), 'no se puede atender dos veces')
const quien = (await q(`select atendida_por, atendida_en is not null hecha from solicitudes_cliente where id=$1`, [sid])).rows[0]
bien(quien.atendida_por === MAN && quien.hecha, 'queda registrado quién la atendió y cuándo')

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
