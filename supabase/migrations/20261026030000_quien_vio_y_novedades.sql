-- QUIÉN VIO QUÉ y NOVEDADES POR VER (pedido el 26-10-2026)
--
-- 1) Estadísticas: además de las cifras, el nombre de cada clienta que entró
--    y qué productos miró; y en "Más vistos", quiénes miraron cada uno.
-- 2) Novedades: cada persona del personal ve un punto con el número de cosas
--    nuevas desde la última vez que abrió esa pantalla (pedidos, pagos,
--    solicitudes, visitas). Al abrir la pantalla, el número vuelve a cero
--    solo para esa persona.

-- ---------- 1. Estadísticas con nombres ----------------------------------
create or replace function estadisticas(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  desde timestamptz := date_trunc('day', now()) - make_interval(days => greatest(p_dias, 1) - 1);
begin
  if not tiene_permiso('ver_resumen') then
    raise exception 'No tienes permiso para ver las estadísticas';
  end if;

  return jsonb_build_object(
    'dias', p_dias,
    'visitas', (select count(*) from visitas where tipo = 'app' and creado_en >= desde),
    'visitas_hoy', (select count(*) from visitas where tipo = 'app' and creado_en >= date_trunc('day', now())),
    'clientes', (select count(distinct profile_id) from visitas where tipo = 'app' and creado_en >= desde),
    'vistas_productos', (select count(*) from visitas where tipo = 'producto' and creado_en >= desde),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'visitas', coalesce(v.n, 0)) order by d.dia)
        from generate_series(desde::date, now()::date, interval '1 day') as d(dia)
        left join (select creado_en::date dia, count(*) n from visitas
                    where tipo = 'app' and creado_en >= desde group by 1) v on v.dia = d.dia
    ), '[]'::jsonb),
    'mas_vistos', coalesce((
      select jsonb_agg(t order by t.vistas desc) from (
        select p.id, p.nombre, p.foto_url, count(*) vistas, count(distinct v.profile_id) clientes,
               (select jsonb_agg(q order by q.vistas desc, q.nombre) from (
                  select coalesce(c.full_name, pr.full_name, 'Sin nombre') nombre, count(*) vistas
                    from visitas v2
                    left join profiles pr on pr.id = v2.profile_id
                    left join clients c on c.profile_id = v2.profile_id
                   where v2.tipo = 'producto' and v2.product_id = p.id and v2.creado_en >= desde
                   group by 1) q) quien
          from visitas v join products p on p.id = v.product_id
         where v.tipo = 'producto' and v.creado_en >= desde
         group by p.id order by vistas desc limit 10) t
    ), '[]'::jsonb),
    -- Cada clienta que entró: cuántas veces, la última vez y qué miró.
    'quienes', coalesce((
      select jsonb_agg(t order by t.ultima desc) from (
        select v.profile_id,
               coalesce(c.full_name, pr.full_name, 'Sin nombre') nombre, c.client_number numero,
               count(*) filter (where v.tipo = 'app') visitas,
               max(v.creado_en) ultima,
               (select jsonb_agg(m order by m.vistas desc, m.nombre) from (
                  select p.nombre, count(*) vistas
                    from visitas v2 join products p on p.id = v2.product_id
                   where v2.profile_id = v.profile_id and v2.tipo = 'producto' and v2.creado_en >= desde
                   group by p.nombre) m) miro
          from visitas v
          left join profiles pr on pr.id = v.profile_id
          left join clients c on c.profile_id = v.profile_id
         where v.creado_en >= desde and v.profile_id is not null
         group by v.profile_id, c.full_name, pr.full_name, c.client_number) t
    ), '[]'::jsonb),
    'mas_comprados', coalesce((
      select jsonb_agg(t order by t.unidades desc) from (
        select p.id, p.nombre, p.foto_url, sum(i.cantidad) unidades,
               count(distinct o.id) pedidos, sum(i.subtotal) monto
          from order_items i
          join orders o on o.id = i.order_id
          join products p on p.id = i.product_id
         where o.status <> 'cancelado' and o.created_at >= desde
         group by p.id order by unidades desc limit 10) t
    ), '[]'::jsonb)
  );
end $$;

revoke all on function estadisticas(int) from public, anon;
grant execute on function estadisticas(int) to authenticated;

-- ---------- 2. Novedades por ver -----------------------------------------
create table if not exists pedidos_visto (
  profile_id uuid not null references profiles(id) on delete cascade,
  seccion    text not null check (seccion in ('pedidos','pagos','solicitudes','estadisticas')),
  visto_en   timestamptz not null default now(),
  primary key (profile_id, seccion)
);
alter table pedidos_visto enable row level security;
revoke all on pedidos_visto from anon, authenticated;

-- Cuántas cosas nuevas hay para el usuario conectado, por pantalla.
-- Si nunca abrió una pantalla, cuenta lo de los últimos 7 días.
-- Solo cuenta las pantallas que esa persona puede ver.
create or replace function novedades()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hace7 timestamptz := now() - interval '7 days';
  v     jsonb := '{}'::jsonb;
  desde timestamptz;
begin
  if not es_personal() then return v; end if;

  if tiene_permiso('ver_pedidos') then
    select coalesce(max(visto_en), hace7) into desde from pedidos_visto where profile_id = auth.uid() and seccion = 'pedidos';
    v := v || jsonb_build_object('pedidos', (select count(*) from orders where created_at > desde));
  end if;
  if tiene_permiso('registrar_pagos') then
    select coalesce(max(visto_en), hace7) into desde from pedidos_visto where profile_id = auth.uid() and seccion = 'pagos';
    v := v || jsonb_build_object('pagos', (select count(*) from pagos_reportados where creado_en > desde));
  end if;
  if tiene_permiso('ver_solicitudes') or tiene_permiso('crear_clientas') then
    select coalesce(max(visto_en), hace7) into desde from pedidos_visto where profile_id = auth.uid() and seccion = 'solicitudes';
    v := v || jsonb_build_object('solicitudes', (select count(*) from solicitudes_cliente where creado_en > desde));
  end if;
  if tiene_permiso('ver_resumen') then
    select coalesce(max(visto_en), hace7) into desde from pedidos_visto where profile_id = auth.uid() and seccion = 'estadisticas';
    v := v || jsonb_build_object('estadisticas', (select count(*) from visitas where tipo = 'app' and creado_en > desde));
  end if;
  return v;
end $$;

revoke all on function novedades() from public, anon;
grant execute on function novedades() to authenticated;

-- Abrir una pantalla la marca como vista (solo para quien la abre).
create or replace function marcar_visto(p_seccion text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_personal() then return; end if;
  insert into pedidos_visto (profile_id, seccion, visto_en) values (auth.uid(), p_seccion, now())
  on conflict (profile_id, seccion) do update set visto_en = excluded.visto_en;
end $$;

revoke all on function marcar_visto(text) from public, anon;
grant execute on function marcar_visto(text) to authenticated;
