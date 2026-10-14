-- Pantalla de equivalencias: qué producto del ERP es cada producto de Pedidos.
--
-- La lista de productos del ERP ya no se lee con la vista erp_productos (la
-- podía leer cualquier usuario conectado, también un cliente): ahora sale de
-- una función que solo responde al personal con permiso de productos.

do $$
begin
  if to_regclass('public.erp_productos') is not null then
    execute 'revoke all on erp_productos from anon, authenticated';
  end if;
end $$;

create or replace function erp_lista_productos()
returns table (id integer, nombre text, codigo text, activo boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not tiene_permiso('productos') then raise exception 'No tienes permiso'; end if;
  if to_regclass('public.productos') is null then return; end if;
  return query execute 'select id, nombre::text, codigo::text, activo from productos order by nombre';
end $$;

revoke all on function erp_lista_productos() from public, anon;
grant execute on function erp_lista_productos() to authenticated;
