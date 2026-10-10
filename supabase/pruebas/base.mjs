// Arma una base de prueba que imita Supabase (roles anon/authenticated, auth.uid())
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
export const MIG = 'C:/Users/User/OneDrive/Desktop/universo keraven/´keraven pedidos/Nueva carpeta/keraven/supabase/migrations/20261010000000_pedidos_base.sql';
export async function nuevaBase() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
    grant usage on schema auth to anon, authenticated;
    grant select on auth.users to service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    grant usage, create on schema public to anon, authenticated, service_role;
  `);
  await db.exec(fs.readFileSync(MIG, 'utf8'));
  return db;
}
// Ejecuta como un usuario conectado (o anon si uid es null)
export async function como(db, uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)`, [uid || '', uid ? 'authenticated' : 'anon']);
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
    return tx.query(sql, params);
  });
}
