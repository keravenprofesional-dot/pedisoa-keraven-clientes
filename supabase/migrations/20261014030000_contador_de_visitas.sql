-- CONTADOR DE VISITAS y de PRODUCTOS (más vistos y más comprados).
-- Solo lo ven los administradores (permiso 'ver_resumen').
--
-- Se cuentan las visitas de los CLIENTES, no las del personal (si no, cada
-- vez que alguien de la oficina revisa el catálogo inflaría los números).
-- Una misma persona cuenta una visita a la app cada 30 minutos, y una vista
-- a un mismo producto cada 30 minutos: recargar la página no suma.

create table if not exists visitas (
  id         bigint generated always as identity primary key,
  profile_id uuid references profiles(id) on delete set null,
  tipo       text not null check (tipo in ('app','producto')),
  product_id uuid references products(id) on delete cascade,
  creado_en  timestamptz not null default now()
);
create index if not exists visitas_fecha    on visitas (creado_en);
create index if not exists visitas_producto on visitas (product_id) where product_id is not null;
create index if not exists visitas_quien    on visitas (profile_id, tipo, creado_en);

-- Nadie lee ni escribe la tabla directo: solo por las dos funciones de abajo.
alter table visitas enable row level security;
revoke all on visitas from anon, authenticated;

create or replace function registrar_visita(p_producto uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tipo text := case when p_producto is null then 'app' else 'producto' end;
begin
  if not exists (select 1 from profiles where id = auth.uid() and active and tipo = 'clienta') then
    return;
  end if;
  if exists (
    select 1 from visitas
     where profile_id = auth.uid() and tipo = v_tipo
       and product_id is not distinct from p_producto
       and creado_en > now() - interval '30 minutes'
  ) then
    return;
  end if;
  insert into visitas (profile_id, tipo, product_id) values (auth.uid(), v_tipo, p_producto);
end $$;

revoke all on function registrar_visita(uuid) from public, anon;
grant execute on function registrar_visita(uuid) to authenticated;

-- Todo el tablero de una vez, para los últimos p_dias días.
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
        select p.id, p.nombre, p.foto_url, count(*) vistas, count(distinct v.profile_id) clientes
          from visitas v join products p on p.id = v.product_id
         where v.tipo = 'producto' and v.creado_en >= desde
         group by p.id order by vistas desc limit 10) t
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
