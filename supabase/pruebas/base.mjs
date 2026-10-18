// Arma una base de prueba que imita Supabase (roles anon/authenticated, auth.uid()).
// Aplica TODAS las migraciones en orden, igual que el Supabase real.
import { PGlite } from '@electric-sql/pglite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export const CARPETA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

export async function nuevaBase() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
      encrypted_password text, updated_at timestamptz);
    -- Imitación de pgcrypto (en Supabase vive en el esquema extensions): crypt deja la clave
    -- legible para poder comprobar en las pruebas qué clave quedó puesta.
    create schema extensions;
    create function extensions.gen_salt(text) returns text language sql as $$ select 'sal' $$;
    create function extensions.crypt(clave text, sal text) returns text language sql as $$ select 'cifrada:' || clave $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
    grant usage on schema auth to anon, authenticated;
    grant select on auth.users to service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    grant usage, create on schema public to anon, authenticated, service_role;
  `)
  for (const archivo of fs.readdirSync(CARPETA).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(CARPETA, archivo), 'utf8'))
  }
  // Solo en la copia de pruebas: a los clientes de prueba que no traen cédula se les
  // inventa una (la cédula es obligatoria desde el 14-oct). prueba_cedula.mjs prueba la regla.
  await db.exec(`alter table clients alter column cedula set default lpad((floor(random() * 1e11))::bigint::text, 11, '0')`)
  return db
}

// Ejecuta como un usuario conectado (o anon si uid es null)
export async function como(db, uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)`, [uid || '', uid ? 'authenticated' : 'anon'])
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`)
    return tx.query(sql, params)
  })
}
