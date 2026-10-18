// La clienta con cédula entra con su teléfono + su cédula: la cédula pasa a ser su clave.
import { nuevaBase } from './base.mjs'
const db = await nuevaBase()
await db.exec(`alter table clients alter column cedula drop default`)
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const clave = async (u) => (await q(`select encrypted_password from auth.users where id=$1`, [u])).rows[0].encrypted_password
const cuenta = async (tel) => {
  const u = (await q(`insert into auth.users(email, encrypted_password) values($1, 'cifrada:CODIGO12') returning id`, [tel + '@x'])).rows[0].id
  await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','X')`, [u])
  return u
}

console.log('1) Clienta nueva con cédula')
const a = await cuenta('8090000001')
await q(`insert into clients(profile_id,full_name,telefono_login,cedula) values($1,'Ana','8090000001','001-1736964-5')`, [a])
bien(await clave(a) === 'cifrada:00117369645', 'su clave es su cédula, solo los números')

console.log('\n2) Cambiar la cédula cambia la clave')
await q(`update clients set cedula='402-2417587-3' where profile_id=$1`, [a])
bien(await clave(a) === 'cifrada:40224175873', 'la clave es la cédula nueva')

console.log('\n3) Editar otra cosa no toca la clave')
await q(`update auth.users set encrypted_password='cifrada:OTRA' where id=$1`, [a])
await q(`update clients set full_name='Ana María' where profile_id=$1`, [a])
bien(await clave(a) === 'cifrada:OTRA', 'cambiar el nombre no cambia la clave')

console.log('\n4) Clienta vieja sin cédula sigue con su código')
await q(`alter table clients disable trigger trg_cedula_cliente`)
const b = await cuenta('8090000002')
await q(`insert into clients(profile_id,full_name,telefono_login) values($1,'Bea','8090000002')`, [b])
const c = await cuenta('8090000003')
await q(`insert into clients(profile_id,full_name,telefono_login,cedula) values($1,'Cris','8090000003','000000000')`, [c])
await q(`alter table clients enable trigger trg_cedula_cliente`)
bien(await clave(b) === 'cifrada:CODIGO12', 'sin cédula: conserva su código')
bien(await clave(c) === 'cifrada:CODIGO12', 'con una cédula que no es válida (9 números): conserva su código')

console.log('\n5) Cuando se le registra la cédula, pasa a entrar con ella')
await q(`update clients set cedula='22300123456' where profile_id=$1`, [b])
bien(await clave(b) === 'cifrada:22300123456', 'su clave pasa a ser su cédula')

console.log('\n6) Nadie de afuera puede llamar la función de la clave')
const permiso = (await q(`select has_function_privilege('anon', 'cedula_es_la_clave()', 'execute') a, has_function_privilege('authenticated', 'cedula_es_la_clave()', 'execute') b`)).rows[0]
bien(!permiso.a && !permiso.b, 'ni visitantes ni clientas pueden ejecutarla')

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
if (mal) process.exitCode = 1
