import { nuevaBase } from './base.mjs'
import fs from 'fs'
const db = await nuevaBase()
try { await db.exec(fs.readFileSync('C:/Keraven-Systems-Masters/schema.sql', 'utf8')); console.log('esquema ERP: cargado') }
catch (e) { console.log('esquema ERP: ERROR', e.message) }
try { await db.exec(fs.readFileSync('../migrations/20261014060000_puente_con_systems_masters.sql', 'utf8')); console.log('puente: aplicado') }
catch (e) { console.log('puente: ERROR', e.message) }
const r = await db.query(`select conname, pg_get_constraintdef(oid) d from pg_constraint where conname='contratos_origen_check'`)
console.log(JSON.stringify(r.rows))
