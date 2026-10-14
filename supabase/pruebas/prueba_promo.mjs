import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const falla = async (fn, m) => { try { await fn(); bien(false, m) } catch { bien(true, m) } }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id

const SUP = await nu('s@x'), CLI = await nu('c@x'), ALM = await nu('a@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','D')`, [SUP])
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'personal','alm','3','A')`, [ALM])
await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','Ana')`, [CLI])
await q(`insert into clients(profile_id,full_name,telefono_login) values($1,'Ana','8091110000')`, [CLI])

bien((await q(`select count(*)::int n from promociones`)).rows[0].n === 2, 'arranca con 2 cuadros (temporada y mes)')
bien((await q(`select count(*)::int n from promociones where activo`)).rows[0].n === 0, 'los dos arrancan apagados')

console.log('\n1) Solo el personal con permiso publica')
const pub = (uid) => como(db, uid, `update promociones set fotos='["a.jpg","b.jpg"]', titulo='Navidad', activo=true where tipo='temporada'`)
await falla(async () => { const r = await pub(ALM); if (r.affectedRows === 0) throw 0 }, 'Almacén (sin permiso) no publica')
await pub(SUP)
bien((await q(`select jsonb_array_length(fotos)::int n, activo from promociones where tipo='temporada'`)).rows[0].n === 2, 'el supremo publica 2 fotos')

console.log('\n2) El cliente ve las promociones')
const vistas = await como(db, CLI, `select tipo, jsonb_array_length(fotos) n from promociones where activo`)
bien(vistas.rows.length === 1 && vistas.rows[0].tipo === 'temporada', 'el cliente ve la promo encendida')

console.log('\n3) Tope de 10 fotos')
const once = JSON.stringify(Array.from({length:11},(_,i)=>`f${i}.jpg`))
await falla(() => como(db, SUP, `update promociones set fotos=$1::jsonb where tipo='mes'`, [once]), 'no deja pasar de 10 fotos')
const diez = JSON.stringify(Array.from({length:10},(_,i)=>`f${i}.jpg`))
await como(db, SUP, `update promociones set fotos=$1::jsonb where tipo='mes'`, [diez])
bien((await q(`select jsonb_array_length(fotos)::int n from promociones where tipo='mes'`)).rows[0].n === 10, '10 fotos sí se aceptan')

console.log('\n4) Fotos y videos: 10 fotos + 5 videos, ni uno más')
const mezcla = (f, v) => JSON.stringify([...Array.from({length:f},(_,i)=>`p${i}.jpg`), ...Array.from({length:v},(_,i)=>`v${i}.mp4`)])
await como(db, SUP, `update promociones set fotos=$1::jsonb where tipo='mes'`, [mezcla(10,5)])
bien((await q(`select jsonb_array_length(fotos)::int n from promociones where tipo='mes'`)).rows[0].n === 15, '10 fotos + 5 videos sí se aceptan')
await falla(() => como(db, SUP, `update promociones set fotos=$1::jsonb where tipo='mes'`, [mezcla(10,6)]), 'el 6.º video no entra')
await falla(() => como(db, SUP, `update promociones set fotos=$1::jsonb where tipo='mes'`, [mezcla(11,0)]), 'la 11.ª foto no entra')
await como(db, SUP, `update promociones set fotos=$1::jsonb where tipo='mes'`, [mezcla(0,3)])
bien((await q(`select promo_cuenta(fotos,true) n from promociones where tipo='mes'`)).rows[0].n === 3, 'se pueden borrar: quedan 3 videos y 0 fotos')

console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
