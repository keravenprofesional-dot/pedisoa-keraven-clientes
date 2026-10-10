-- La clienta ahora puede entrar con su TELÉFONO o con su NÚMERO DE CLIENTA
-- (CL-000002, 000002 o simplemente 2 — da igual cómo lo escriba).
-- El código de acceso sigue siendo el mismo de siempre.
create or replace function correo_de_entrada(identificador text, es_clienta boolean)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  d text := regexp_replace(coalesce(identificador, ''), '\D', '', 'g');
  correo text;
begin
  if not es_clienta then
    select u.email into correo from profiles p join auth.users u on u.id = p.id
     where p.tipo = 'personal' and p.usuario = lower(trim(identificador));
    return correo;
  end if;

  if d = '' then return null; end if;

  -- Primero su teléfono, que es como entra normalmente.
  select u.email into correo from clients c join auth.users u on u.id = c.profile_id
   where c.telefono_login = d;
  if correo is not null then return correo; end if;

  -- Si no, su número de clienta. Son 6 dígitos, así que nunca se confunde
  -- con un teléfono (10 dígitos).
  if length(d) <= 6 then
    select u.email into correo from clients c join auth.users u on u.id = c.profile_id
     where c.client_number = 'CL-' || lpad(d, 6, '0');
  end if;
  return correo;
end;
$$;
revoke all on function correo_de_entrada(text, boolean) from public;
grant execute on function correo_de_entrada(text, boolean) to anon, authenticated;
