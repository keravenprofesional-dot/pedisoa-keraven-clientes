import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
const u = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id
const A = await u('cl-a@clientas.keraven.local'), P = await u('supremo@personal.keraven.local')
await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','Ana')`, [A])
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'supremo','8098623014','Dueno')`, [P])
await q(`insert into clients(profile_id,full_name,telefono_login) values($1,'Ana','8091110000')`, [A])
const num = (await q(`select client_number from clients`)).rows[0].client_number
let ok = 0, mal = 0
const probar = async (txt, clienta, esperado, msg) => {
  const r = (await como(db, null, `select correo_de_entrada($1,$2) e`, [txt, clienta])).rows[0].e
  const bien = esperado === null ? r === null : r === esperado
  bien ? (ok++, console.log('  OK   ', msg)) : (mal++, console.log('  FALLA', msg, '->', r))
}
console.log('Número de clienta generado:', num)
await probar('8091110000', true, 'cl-a@clientas.keraven.local', 'entra con su teléfono (como siempre)')
await probar('809-111-0000', true, 'cl-a@clientas.keraven.local', 'entra con el teléfono con guiones')
await probar(num, true, 'cl-a@clientas.keraven.local', `entra con su número completo ${num}`)
await probar('000001', true, 'cl-a@clientas.keraven.local', 'entra con 000001')
await probar('1', true, 'cl-a@clientas.keraven.local', 'entra escribiendo solo 1')
await probar('cl 000001', true, 'cl-a@clientas.keraven.local', 'entra con "cl 000001"')
await probar('000009', true, null, 'un número que no existe no entra')
await probar('8090000000', true, null, 'un teléfono que no existe no entra')
await probar('supremo', true, null, 'el usuario del personal no sirve en la puerta de clientas')
await probar('000001', false, null, 'el número de clienta no sirve en la puerta del personal')
await probar('supremo', false, 'supremo@personal.keraven.local', 'el personal sigue entrando con su usuario')
console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
