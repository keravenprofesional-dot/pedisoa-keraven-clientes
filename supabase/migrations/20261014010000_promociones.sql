-- PROMOCIONES: dos cuadros que el cliente ve en su inicio, con fotos que
-- rotan solas para "darle vida al anuncio":
--   temporada → Promociones de temporada
--   mes       → Ofertas del mes
-- Cada cuadro guarda hasta 10 fotos. El administrador las sube y publica.

create table if not exists promociones (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('temporada','mes')),
  titulo         text,
  fotos          jsonb not null default '[]'::jsonb,   -- lista de URLs (máx 10)
  activo         boolean not null default true,
  actualizado_en timestamptz not null default now(),
  constraint promo_max_10 check (jsonb_array_length(fotos) <= 10)
);

-- Arranca con un cuadro de cada tipo, vacío y apagado, para que el admin
-- solo tenga que subir fotos y encenderlo.
insert into promociones (tipo, titulo, activo)
select 'temporada', 'Promociones de temporada', false
where not exists (select 1 from promociones where tipo = 'temporada');
insert into promociones (tipo, titulo, activo)
select 'mes', 'Ofertas del mes', false
where not exists (select 1 from promociones where tipo = 'mes');

-- Permiso nuevo para manejar las promociones. Se da por defecto a quien ya
-- tiene 'configuracion' (datos de la empresa).
insert into pedidos_permisos (clave, descripcion, orden) values
  ('promociones', 'Publicar las promociones y ofertas del inicio', 95)
on conflict (clave) do nothing;

insert into pedidos_rol_permisos (rol_id, permiso)
select r.id, 'promociones' from pedidos_roles r
where exists (select 1 from pedidos_rol_permisos rp where rp.rol_id = r.id and rp.permiso = 'configuracion')
on conflict do nothing;

alter table promociones enable row level security;

drop policy if exists promo_leer     on promociones;
drop policy if exists promo_escribir on promociones;

-- Las promociones las ve cualquier usuario activo (el cliente las necesita
-- en su inicio). No son datos sensibles.
create policy promo_leer on promociones for select to authenticated
  using (es_usuario_activo());
create policy promo_escribir on promociones for all to authenticated
  using (tiene_permiso('promociones') or tiene_permiso('configuracion'))
  with check (tiene_permiso('promociones') or tiene_permiso('configuracion'));

-- Las fotos de promociones van al mismo depósito público 'fotos'. Hay que
-- dejar subirlas también a quien maneja promociones, no solo a Productos.
-- (Va dentro del "si existe storage" porque la copia local de pruebas no lo tiene.)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then return; end if;
  drop policy if exists fotos_subir      on storage.objects;
  drop policy if exists fotos_reemplazar on storage.objects;
  drop policy if exists fotos_borrar     on storage.objects;
  create policy fotos_subir on storage.objects for insert to authenticated
    with check (bucket_id = 'fotos' and (public.tiene_permiso('productos') or public.tiene_permiso('promociones') or public.tiene_permiso('configuracion')));
  create policy fotos_reemplazar on storage.objects for update to authenticated
    using (bucket_id = 'fotos' and (public.tiene_permiso('productos') or public.tiene_permiso('promociones') or public.tiene_permiso('configuracion')))
    with check (bucket_id = 'fotos' and (public.tiene_permiso('productos') or public.tiene_permiso('promociones') or public.tiene_permiso('configuracion')));
  create policy fotos_borrar on storage.objects for delete to authenticated
    using (bucket_id = 'fotos' and (public.tiene_permiso('productos') or public.tiene_permiso('promociones') or public.tiene_permiso('configuracion')));
end $$;
