import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
await db.exec(`alter table clients alter column cedula drop default`)   // aquí sí se prueba la regla de verdad
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const error = async (fn) => { try { await fn(); return '' } catch (e) { return e.message } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id
const nuevo = async (ced, tel) => {
  const u = await nu(tel + '@x')
  await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','X')`, [u])
  return q(`insert into clients(profile_id,full_name,telefono_login,cedula) values($1,'X',$2,$3) returning id, cedula, client_number`, [u, tel, ced])
}

console.log('1) Cliente nuevo')
bien(/obligatoria/.test(await error(() => nuevo(null, '8090000001'))), 'sin cédula no se crea')
bien(/obligatoria/.test(await error(() => nuevo('  ', '8090000002'))), 'con espacios tampoco')
bien(/11 números/.test(await error(() => nuevo('000000000', '8090000003'))), 'con 9 números no se crea')
const a = (await nuevo('00117369645', '8090000004')).rows[0]
bien(a.cedula === '001-1736964-5', 'se guarda con guiones: ' + a.cedula)
bien(/Ya existe un cliente con esa cédula/.test(await error(() => nuevo('001-1736964-5', '8090000005'))), 'no se repite la misma cédula (escrita distinta)')

console.log('\n2) Clientes que ya existían sin cédula')
await q(`alter table clients disable trigger trg_cedula_cliente`)
const u = await nu('viejo@x'); await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','Viejo')`, [u])
const v = (await q(`insert into clients(profile_id,full_name,telefono_login) values($1,'Viejo','8090000006') returning id`, [u])).rows[0].id
await q(`alter table clients enable trigger trg_cedula_cliente`)
bien(!(await error(() => q(`update clients set full_name='Viejo Uno' where id=$1`, [v]))), 'se puede editar otra cosa sin ponerle cédula')
bien(/11 números/.test(await error(() => q(`update clients set cedula='123' where id=$1`, [v]))), 'si se le pone, tiene que ser válida')
await q(`update clients set cedula='402-2417587-3' where id=$1`, [v])
bien(/no se puede borrar/.test(await error(() => q(`update clients set cedula='' where id=$1`, [v]))), 'una vez puesta no se puede borrar')

console.log('\n3) Solicitud "Soy nuevo"')
const sol = (ced) => error(() => como(db, null, `select solicitar_cliente('Maria Lopez','8091234567','',$1,'Calle 1','maria@x.com')`, [ced]))
bien(/cédula/.test(await sol('')), 'sin cédula no se envía')
bien(/cédula/.test(await sol('123')), 'con cédula incompleta tampoco')
bien(!(await sol('40224175873')), 'con cédula válida se envía')
bien((await q(`select cedula from solicitudes_cliente`)).rows[0].cedula === '402-2417587-3', 'la solicitud la guarda con guiones')

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
if (mal) process.exitCode = 1
