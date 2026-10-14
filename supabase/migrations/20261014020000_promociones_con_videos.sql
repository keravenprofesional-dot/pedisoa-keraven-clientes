-- Los cuadros de promoción también llevan VIDEOS cortos.
-- Cada cuadro: hasta 10 fotos y hasta 5 videos, mezclados en el orden que
-- el administrador quiera. La lista `fotos` guarda las direcciones de ambos;
-- un video se reconoce por su terminación (.mp4, .webm, .mov, .m4v).

create or replace function promo_cuenta(lista jsonb, videos boolean)
returns int language sql immutable as $$
  select count(*)::int
  from jsonb_array_elements_text(coalesce(lista, '[]'::jsonb)) as e(url)
  where (e.url ~* '\.(mp4|webm|mov|m4v)(\?|$)') = videos
$$;

alter table promociones drop constraint if exists promo_max_10;
alter table promociones drop constraint if exists promo_max_fotos;
alter table promociones drop constraint if exists promo_max_videos;
alter table promociones add constraint promo_max_fotos  check (promo_cuenta(fotos, false) <= 10);
alter table promociones add constraint promo_max_videos check (promo_cuenta(fotos, true)  <= 5);

-- Depósito propio para los videos: el de 'fotos' solo acepta imágenes de
-- 3 MB. Este acepta videos de hasta 50 MB (el tope del plan de Supabase).
-- (Va dentro del "si existe storage" porque la copia local de pruebas no lo tiene.)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then return; end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('promos', 'promos', true, 52428800, array['video/mp4','video/webm','video/quicktime'])
  on conflict (id) do update
    set public = true, file_size_limit = 52428800,
        allowed_mime_types = array['video/mp4','video/webm','video/quicktime'];

  drop policy if exists promos_subir      on storage.objects;
  drop policy if exists promos_reemplazar on storage.objects;
  drop policy if exists promos_borrar     on storage.objects;
  create policy promos_subir on storage.objects for insert to authenticated
    with check (bucket_id = 'promos' and (public.tiene_permiso('promociones') or public.tiene_permiso('configuracion')));
  create policy promos_reemplazar on storage.objects for update to authenticated
    using (bucket_id = 'promos' and (public.tiene_permiso('promociones') or public.tiene_permiso('configuracion')))
    with check (bucket_id = 'promos' and (public.tiene_permiso('promociones') or public.tiene_permiso('configuracion')));
  create policy promos_borrar on storage.objects for delete to authenticated
    using (bucket_id = 'promos' and (public.tiene_permiso('promociones') or public.tiene_permiso('configuracion')));
end $$;
