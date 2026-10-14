// Permisos por persona: dar y quitar a uno sin tocar al otro
import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id

const SUP = await nu('supremo@x'), MAN = await nu('manuel@x'), LET = await nu('leticia@x')
const rol = (await q(`select id from pedidos_roles where nombre='Super usuario'`)).rows[0].id
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'supremo','8091','Dueno')`, [SUP])
await q(`insert into profiles(id,tipo,rol_id,usuario,telefono,full_name) values($1,'personal',$2,'manuel','8092','Manuel'),($3,'personal',$2,'leticia','8093','Leticia')`, [MAN, rol, LET])

const perms = async (uid) => (await como(db, uid, `select * from mis_permisos()`)).rows.map((r) => r.mis_permisos).sort()
bien((await perms(MAN)).join(',') === 'cambiar_estado,crear_clientas,ver_clientas,ver_pedidos,ver_solicitudes', 'Manuel arranca con los 5 del rol')
bien((await perms(LET)).length === 5, 'Leticia también arranca con los 5 del rol')

// El supremo le DA un permiso extra solo a Manuel
await como(db, SUP, `insert into pedidos_usuario_permisos values($1,'registrar_pagos',true)`, [MAN])
bien((await perms(MAN)).includes('registrar_pagos'), 'a Manuel se le dio "registrar pagos"')
bien(!(await perms(LET)).includes('registrar_pagos'), 'a Leticia NO le cambió nada')

// El supremo le QUITA un permiso del rol solo a Leticia
await como(db, SUP, `insert into pedidos_usuario_permisos values($1,'crear_clientas',false)`, [LET])
bien(!(await perms(LET)).includes('crear_clientas'), 'a Leticia se le quitó "crear clientas"')
bien((await perms(MAN)).includes('crear_clientas'), 'Manuel la conserva')

// Y que de verdad se aplique, no solo en la lista
const { rows: r1 } = await como(db, LET, `select count(*)::int n from pedidos_permisos`)
bien(r1[0].n === 12, 'Leticia sigue entrando normal')
await como(db, SUP, `delete from pedidos_usuario_permisos where profile_id=$1 and permiso='crear_clientas'`, [LET])
bien((await perms(LET)).includes('crear_clientas'), 'al borrar lo propio vuelve a mandar su rol')

// Nadie más puede tocarlos
let negado = false
try { await como(db, MAN, `insert into pedidos_usuario_permisos values($1,'productos',true)`, [MAN]) } catch { negado = true }
const tras = await perms(MAN)
bien(negado || !tras.includes('productos'), 'Manuel NO puede darse permisos a sí mismo')
bien((await perms(SUP)).length === 12, 'el supremo mantiene los 12')
console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
