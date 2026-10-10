-- Guardado de las fotos de productos, líneas y combos.
-- Va dentro de un "si existe" porque la copia local de pruebas no tiene
-- el guardado de archivos de Supabase; allá este archivo simplemente no hace nada.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'Sin guardado de archivos (copia de pruebas): nada que hacer.';
    return;
  end if;

  -- Carpeta pública de fotos: cualquiera puede VERLAS (salen en el catálogo),
  -- pero subirlas o borrarlas es solo de quien tenga el permiso de Productos.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos', 'fotos', true, 3000000, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = true, file_size_limit = 3000000,
        allowed_mime_types = array['image/jpeg','image/png','image/webp'];

  drop policy if exists fotos_ver        on storage.objects;
  drop policy if exists fotos_subir      on storage.objects;
  drop policy if exists fotos_reemplazar on storage.objects;
  drop policy if exists fotos_borrar     on storage.objects;

  create policy fotos_ver on storage.objects for select
    using (bucket_id = 'fotos');
  create policy fotos_subir on storage.objects for insert to authenticated
    with check (bucket_id = 'fotos' and public.tiene_permiso('productos'));
  create policy fotos_reemplazar on storage.objects for update to authenticated
    using (bucket_id = 'fotos' and public.tiene_permiso('productos'))
    with check (bucket_id = 'fotos' and public.tiene_permiso('productos'));
  create policy fotos_borrar on storage.objects for delete to authenticated
    using (bucket_id = 'fotos' and public.tiene_permiso('productos'));
end $$;
