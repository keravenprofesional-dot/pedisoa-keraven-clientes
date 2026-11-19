-- ============================================================
-- VENTAS DEL MES Y PROYECCIÓN (en Estadísticas)
--
-- ventas_del_mes(mes): cuánto se vendió en el mes (pedidos no cancelados,
-- por la fecha del pedido en hora de RD) y cada pedido con su clienta,
-- teléfono, forma de pago, lo pagado, lo que debe y la fecha del pago.
--
-- proyecciones_ventas: lo que se espera vender cada mes, para compararlo
-- con lo vendido. Lo ve y lo pone quien ve el Resumen.
-- ============================================================
create table if not exists proyecciones_ventas (
  mes             date primary key check (mes = date_trunc('month', mes)::date),
  monto           numeric(12,2) not null check (monto >= 0),
  nota            text,
  puesto_por      uuid default auth.uid(),
  puesto_por_texto text,
  actualizado_en  timestamptz not null default now()
);
alter table proyecciones_ventas enable row level security;
drop policy if exists proyeccion_ver on proyecciones_ventas;
create policy proyeccion_ver on proyecciones_ventas for select to authenticated
  using (tiene_permiso('ver_resumen'));
drop policy if exists proyeccion_poner on proyecciones_ventas;
create policy proyeccion_poner on proyecciones_ventas for insert to authenticated
  with check (tiene_permiso('ver_resumen'));
drop policy if exists proyeccion_cambiar on proyecciones_ventas;
create policy proyeccion_cambiar on proyecciones_ventas for update to authenticated
  using (tiene_permiso('ver_resumen')) with check (tiene_permiso('ver_resumen'));
revoke all on proyecciones_ventas from anon;

-- Quién la puso y cuándo, siempre desde la base (no lo manda el teléfono).
create or replace function proyeccion_quien()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.puesto_por := auth.uid();
  new.puesto_por_texto := (select full_name from profiles where id = auth.uid());
  new.actualizado_en := now();
  new.nota := nullif(left(trim(coalesce(new.nota, '')), 300), '');
  return new;
end $$;
drop trigger if exists trg_proyeccion_quien on proyecciones_ventas;
create trigger trg_proyeccion_quien before insert or update on proyecciones_ventas
for each row execute function proyeccion_quien();

create or replace function ventas_del_mes(p_mes date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ini   timestamptz;
  fin   timestamptz;
  mes   date := date_trunc('month', p_mes)::date;
  filas jsonb;
begin
  if not tiene_permiso('ver_resumen') then raise exception 'No tienes permiso para ver las ventas'; end if;
  ini := (mes::timestamp) at time zone 'America/Santo_Domingo';
  fin := ((mes + interval '1 month')::timestamp) at time zone 'America/Santo_Domingo';

  select coalesce(jsonb_agg(f order by f->>'fecha'), '[]'::jsonb) into filas from (
    select jsonb_build_object(
      'id', o.id,
      'pedido', o.order_number,
      'fecha', o.created_at,
      'estado', o.status,
      'cliente', c.full_name,
      'numero', c.client_number,
      'telefono', coalesce((select ph.phone from client_phones ph where ph.client_id = c.id
                             order by ph.is_primary desc nulls last limit 1), c.telefono_login),
      'forma_pago', o.payment_method,
      'subtotal', o.subtotal, 'descuento', o.descuento, 'envio', o.envio, 'total', o.total,
      'pagado', coalesce(p.pagado, 0),
      -- Lo que debe es el balance del pedido (al contado es 0), igual que en Pedidos.
      'debe', o.balance,
      'fecha_pago', p.ultimo
    ) f
    from orders o
    join clients c on c.id = o.client_id
    left join lateral (
      select sum(pr.monto) pagado, max(coalesce(pr.confirmado_en, pr.creado_en)) ultimo
        from pagos_reportados pr where pr.order_id = o.id and pr.estado = 'confirmado'
    ) p on true
    where o.created_at >= ini and o.created_at < fin and o.status <> 'cancelado'
  ) x;

  return jsonb_build_object(
    'mes', mes,
    'vendido', (select coalesce(sum((f->>'total')::numeric), 0) from jsonb_array_elements(filas) f),
    'cobrado', (select coalesce(sum((f->>'pagado')::numeric), 0) from jsonb_array_elements(filas) f),
    'pedidos', jsonb_array_length(filas),
    'clientes', (select count(distinct f->>'numero') from jsonb_array_elements(filas) f),
    'cancelados', (select count(*) from orders o where o.created_at >= ini and o.created_at < fin and o.status = 'cancelado'),
    'filas', filas
  );
end $$;
revoke all on function ventas_del_mes(date) from public, anon;
grant execute on function ventas_del_mes(date) to authenticated;
