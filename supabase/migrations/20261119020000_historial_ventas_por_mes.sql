-- ============================================================
-- HISTORIAL MES POR MES (en Estadísticas)
--
-- Desde el mes en que nació el programa (el primer producto o pedido)
-- hasta el mes actual, en hora de RD, cada mes con:
--   vendido, cobrado, por cobrar, pedidos, clientes, cancelados,
--   proyección y % logrado.
-- Mismas reglas que ventas_del_mes: los cancelados no suman; lo cobrado
-- son los pagos confirmados de los pedidos de ese mes; lo que se debe es
-- el balance de los pedidos.
-- ============================================================
create or replace function ventas_por_mes()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  desde date;
  hasta date := date_trunc('month', now() at time zone 'America/Santo_Domingo')::date;
  res   jsonb;
begin
  if not tiene_permiso('ver_resumen') then raise exception 'No tienes permiso para ver las ventas'; end if;

  select date_trunc('month', min(f) at time zone 'America/Santo_Domingo')::date into desde
    from (select min(created_at) f from products union all select min(created_at) from orders) x;
  desde := coalesce(desde, hasta);

  with meses as (
    select m::date mes from generate_series(desde, hasta, interval '1 month') m
  ), ped as (
    select date_trunc('month', o.created_at at time zone 'America/Santo_Domingo')::date mes, o.*
      from orders o
  ), pag as (
    select pr.order_id, sum(pr.monto) pagado from pagos_reportados pr where pr.estado = 'confirmado' group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'mes', m.mes,
           'vendido', coalesce(v.vendido, 0),
           'cobrado', coalesce(v.cobrado, 0),
           'por_cobrar', coalesce(v.por_cobrar, 0),
           'pedidos', coalesce(v.pedidos, 0),
           'clientes', coalesce(v.clientes, 0),
           'cancelados', coalesce(v.cancelados, 0),
           'proyeccion', pv.monto
         ) order by m.mes desc), '[]'::jsonb)
    into res
    from meses m
    left join lateral (
      select sum(p.total) filter (where p.status <> 'cancelado') vendido,
             sum(coalesce(g.pagado, 0)) filter (where p.status <> 'cancelado') cobrado,
             sum(p.balance) filter (where p.status <> 'cancelado') por_cobrar,
             count(*) filter (where p.status <> 'cancelado') pedidos,
             count(distinct p.client_id) filter (where p.status <> 'cancelado') clientes,
             count(*) filter (where p.status = 'cancelado') cancelados
        from ped p left join pag g on g.order_id = p.id
       where p.mes = m.mes
    ) v on true
    left join proyecciones_ventas pv on pv.mes = m.mes;

  return jsonb_build_object('desde', desde, 'meses', res);
end $$;
revoke all on function ventas_por_mes() from public, anon;
grant execute on function ventas_por_mes() to authenticated;
