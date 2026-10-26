// Toda clienta nace al contado; el crédito se lo da después un gerente.
import { nuevaBase } from './base.mjs'
const db = await nuevaBase()
const q = (s, p) => db.query(s, p)
await q(`alter table clients enable trigger trg_clienta_nace_al_contado`)
let ok = 0, mal = 0
const bien = (c, m) => { c ? (ok++, console.log('  OK   ', m)) : (mal++, console.log('  FALLA', m)) }

const ANA = (await q(`insert into auth.users(email) values('ana@x') returning id`)).rows[0].id
await q(`insert into profiles(id,tipo,usuario,telefono,full_name) values($1,'clienta','ana','8091112233','Ana Perez')`, [ANA])
const c = (await q(`insert into clients(profile_id, full_name, telefono_login, payment_condition, credit_enabled, credit_limit)
                    values($1, 'Ana Perez','8091112233','credito',true,5000) returning *`, [ANA])).rows[0]
bien(c.payment_condition === 'contado', 'aunque la manden a crédito, nace al contado')
bien(c.credit_enabled === false && Number(c.credit_limit) === 0, 'nace sin crédito aprobado ni límite')
const e = (await q(`update clients set payment_condition='credito', credit_enabled=true, credit_limit=8000 where id=$1 returning *`, [c.id])).rows[0]
bien(e.payment_condition === 'credito' && e.credit_enabled && Number(e.credit_limit) === 8000, 'después el gerente sí le puede dar crédito')

console.log(`\n${ok} bien, ${mal} mal`)
process.exit(mal ? 1 : 0)
