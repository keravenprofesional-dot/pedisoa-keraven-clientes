-- La clienta que tiene su cédula registrada entra con su TELÉFONO + su CÉDULA:
-- la cédula (solo los 11 números) pasa a ser la clave de su cuenta y su código
-- de acceso viejo deja de servir. Las que no tienen cédula siguen con su código.
-- Decidido por el dueño el 18 oct 2026 (aplica a todas las que ya tienen cédula
-- y a las nuevas, que desde el 14 oct están obligadas a tenerla).

create or replace function cedula_es_la_clave()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  d text := regexp_replace(coalesce(new.cedula, ''), '\D', '', 'g');
begin
  if length(d) <> 11 or new.profile_id is null then return new; end if;
  if tg_op = 'UPDATE' and d = regexp_replace(coalesce(old.cedula, ''), '\D', '', 'g') then return new; end if;
  update auth.users
     set encrypted_password = extensions.crypt(d, extensions.gen_salt('bf')), updated_at = now()
   where id = new.profile_id;
  return new;
end;
$$;

revoke all on function cedula_es_la_clave() from public, anon, authenticated;

drop trigger if exists trg_cedula_es_la_clave on clients;
create trigger trg_cedula_es_la_clave
  after insert or update of cedula on clients
  for each row execute function cedula_es_la_clave();

-- Las clientas que YA tienen su cédula pasan a entrar con ella.
update auth.users u
   set encrypted_password = extensions.crypt(regexp_replace(c.cedula, '\D', '', 'g'), extensions.gen_salt('bf')),
       updated_at = now()
  from clients c
 where c.profile_id = u.id
   and length(regexp_replace(coalesce(c.cedula, ''), '\D', '', 'g')) = 11;
