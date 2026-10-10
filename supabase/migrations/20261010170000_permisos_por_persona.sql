-- Permisos POR PERSONA, además de los del rol.
--
-- El rol sigue siendo el punto de partida (lo que traen todos los que lo
-- tienen), pero el supremo puede darle o quitarle algo a UNA sola persona
-- sin afectar a los demás del mismo rol.
--
--   concedido = true  → se lo damos aunque su rol no lo traiga
--   concedido = false → se lo quitamos aunque su rol sí lo traiga
--   sin fila          → lo que diga su rol
create table if not exists pedidos_usuario_permisos (
  profile_id uuid    not null references profiles(id) on delete cascade,
  permiso    text    not null references pedidos_permisos(clave) on delete cascade,
  concedido  boolean not null,
  primary key (profile_id, permiso)
);

alter table pedidos_usuario_permisos enable row level security;

create or replace function tiene_permiso(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select pr.active and pr.tipo = 'personal' and (
      pr.es_supremo
      or coalesce(
        -- Lo que se le haya puesto o quitado a esta persona manda.
        (select up.concedido from pedidos_usuario_permisos up
          where up.profile_id = pr.id and up.permiso = p),
        -- Si no tiene nada propio, vale lo de su rol.
        exists (select 1 from pedidos_rol_permisos rp
                 where rp.rol_id = pr.rol_id and rp.permiso = p)
      ))
    from profiles pr where pr.id = auth.uid()
  ), false);
$$;

-- Solo el supremo los administra; cada quien puede ver los suyos.
create policy up_supremo on pedidos_usuario_permisos for all to authenticated
  using (es_supremo()) with check (es_supremo());
create policy up_propios on pedidos_usuario_permisos for select to authenticated
  using (profile_id = auth.uid());
