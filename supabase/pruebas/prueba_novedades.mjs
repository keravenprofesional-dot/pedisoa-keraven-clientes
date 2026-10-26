// Quién vio qué (estadísticas con nombres) y el punto de novedades por persona.
import { nuevaBase, como } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }
const nu = async (e) => (await q(`insert into auth.users(email) values($1) returning id`, [e])).rows[0].id

const SUP = await nu('s@x'), MAN = await nu('m@x'), ALM = await nu('a@x'), ANA = await nu('ana@x'), BEA = await nu('bea@x')
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'sup','1','D')`, [SUP])
const rol = (await q(`select id from pedidos_roles where nombre='Super usuario'`)).rows[0].id
await q(`insert into profiles(id,tipo,rol_id,usuario,telefono,full_name) values($1,'personal',$2,'manuel','2','Manuel')`, [MAN, rol])
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'personal','alm','3','A')`, [ALM])
for (const [u, n, t] of [[ANA, 'Ana Perez', '8091110000'], [BEA, 'Bea Diaz', '8092220000']]) {
  await q(`insert into profiles(id,tipo,full_name) values($1,'clienta',$2)`, [u, n])
  await q(`insert into clients(profile_id,full_name,telefono_login) values($1,$2,$3)`, [u, n, t])
}
const P1 = (await q(`insert into products(nombre,precio) values('Shampoo',1200) returning id`)).rows[0].id
const P2 = (await q(`insert into products(nombre,precio) values('Mascarilla',800) returning id`)).rows[0].id

console.log('1) Quién vio qué')
await como(db, ANA, `select registrar_visita()`)
await como(db, BEA, `select registrar_visita()`)
await como(db, ANA, `select registrar_visita($1)`, [P1])
await como(db, BEA, `select registrar_visita($1)`, [P1])
await como(db, BEA, `select registrar_visita($1)`, [P2])
const e = (await como(db, SUP, `select estadisticas(30) e`)).rows[0].e
const ana = e.quienes.find((x) => x.nombre === 'Ana Perez'), bea = e.quienes.find((x) => x.nombre === 'Bea Diaz')
bien(e.quienes.length === 2, 'salen las 2 clientas que entraron, con su nombre')
bien(ana && Number(ana.visitas) === 1 && ana.miro.length === 1 && ana.miro[0].nombre === 'Shampoo', 'Ana: 1 visita, miró Shampoo')
bien(bea && bea.miro.length === 2, 'Bea miró 2 productos')
const sh = e.mas_vistos.find((p) => p.nombre === 'Shampoo')
bien(sh.quien.map((x) => x.nombre).sort().join() === 'Ana Perez,Bea Diaz', 'en Más vistos: Shampoo lo miraron Ana y Bea')

console.log('\n2) Novedades por ver')
const nov = async (u) => (await como(db, u, `select novedades() n`)).rows[0].n
let n = await nov(SUP)
bien(Number(n.estadisticas) === 2, 'el supremo tiene 2 visitas nuevas por ver')
bien(Number(n.solicitudes) === 0 && Number(n.pedidos) === 0, 'sin pedidos ni solicitudes nuevas')
await como(db, null, `select solicitar_cliente('Carla Mena','8093334444','','001-7654321-0','','carla@x.com')`)
bien(Number((await nov(SUP)).solicitudes) === 1, 'llega una solicitud: el supremo ve 1')
bien(Number((await nov(MAN)).solicitudes) === 1, 'Manuel también ve 1')
await como(db, SUP, `select marcar_visto('solicitudes')`)
bien(Number((await nov(SUP)).solicitudes) === 0, 'el supremo abre Solicitudes: vuelve a 0')
bien(Number((await nov(MAN)).solicitudes) === 1, 'para Manuel sigue en 1 (cada quien lo suyo)')
n = await nov(ALM)
bien(n.solicitudes === undefined && n.estadisticas === undefined, 'Almacén, sin permisos, no ve esos contadores')
bien(Object.keys(await nov(ANA)).length === 0, 'una clienta no ve nada')
let leer = true; try { await como(db, MAN, `select * from pedidos_visto`) } catch { leer = false }
bien(!leer, 'nadie lee la tabla de vistos directo')

console.log(`\n${ok} bien, ${mal} mal`)
process.exit(mal ? 1 : 0)
