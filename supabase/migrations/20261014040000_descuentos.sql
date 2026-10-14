-- DESCUENTOS que da el administrador. Dos formas:
--   1) Un % fijo para un cliente: se aplica solo en cada pedido nuevo suyo.
--   2) Un monto en un pedido puntual (ya hecho), con su motivo.
-- El cliente ve su descuento pero no puede ponérselo él mismo.
-- Permiso nuevo 'dar_descuentos' (por defecto, a quien registra pagos).

insert into pedidos_permisos (clave, descripcion, orden) values
  ('dar_descuentos', 'Dar descuentos a clientes y pedidos', 75)
on conflict (clave) do nothing;

insert into pedidos_rol_permisos (rol_id, permiso)
select r.id, 'dar_descuentos' from pedidos_roles r
where exists (select 1 from pedidos_rol_permisos rp where rp.rol_id = r.id and rp.permiso = 'registrar_pagos')
on conflict do nothing;

-- 1) % fijo por cliente --------------------------------------------------
create table if not exists descuentos_cliente (
  client_id      uuid primary key references clients(id) on delete cascade,
  porcentaje     numeric(5,2) not null check (porcentaje > 0 and porcentaje <= 50),
  motivo         text,
  puesto_por     uuid references profiles(id),
  actualizado_en timestamptz not null default now()
);

alter table descuentos_cliente enable row level security;
drop policy if exists desc_leer on descuentos_cliente;
drop policy if exists desc_escribir on descuentos_cliente;
create policy desc_leer on descuentos_cliente for select to authenticated using (
  tiene_permiso('dar_descuentos') or tiene_permiso('ver_clientas')
  or client_id in (select id from clients where profile_id = auth.uid())
);
create policy desc_escribir on descuentos_cliente for all to authenticated
  using (tiene_permiso('dar_descuentos')) with check (tiene_permiso('dar_descuentos'));

-- Al crear el pedido se le aplica el % del cliente. Va en un disparador para
-- no reescribir crear_pedido(): ajusta descuento, total y balance antes de
-- guardar. Si el pedido es a crédito, crear_pedido() le suma al cliente el
-- balance SIN descuento justo después; por eso aquí se le resta la diferencia.
alter table orders add column if not exists descuento_nota text;

create or replace function aplicar_descuento_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pct     numeric;
  antes   numeric(12,2) := new.balance;
begin
  select porcentaje into pct from descuentos_cliente where client_id = new.client_id;
  if pct is null or coalesce(new.subtotal, 0) <= 0 then return new; end if;

  new.descuento      := round(new.subtotal * pct / 100, 2);
  new.descuento_nota := 'Descuento de cliente ' || trim(to_char(pct, 'FM990.##')) || '%';
  new.total          := new.subtotal + new.envio - new.descuento;
  if new.payment_method = 'credito' then
    new.balance := new.total;
  elsif new.payment_method = 'avance' then
    new.balance := greatest(new.total - new.avance, 0);
  end if;
  if new.balance <> antes then
    update clients set balance_pendiente = balance_pendiente - (antes - new.balance) where id = new.client_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_descuento_cliente on orders;
create trigger trg_descuento_cliente before insert on orders
for each row execute function aplicar_descuento_cliente();

-- 2) Descuento en un pedido puntual -------------------------------------
-- Reemplaza el descuento que tenga el pedido por p_monto (0 lo quita).
create or replace function descontar_pedido(p_order_id uuid, p_monto numeric, p_motivo text)
returns orders language plpgsql security definer set search_path = public as $$
declare
  ord      orders;
  n_total  numeric(12,2);
  n_bal    numeric(12,2);
begin
  if not tiene_permiso('dar_descuentos') then raise exception 'No tienes permiso para dar descuentos'; end if;
  select * into ord from orders where id = p_order_id for update;
  if ord.id is null then raise exception 'Pedido no encontrado'; end if;
  if ord.status in ('cancelado', 'entregado') then
    raise exception 'No se puede cambiar el descuento de un pedido %', ord.status;
  end if;
  if p_monto is null or p_monto < 0 or p_monto > ord.subtotal then
    raise exception 'El descuento debe estar entre 0 y el subtotal (%)', ord.subtotal;
  end if;
  if p_monto > 0 and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo del descuento';
  end if;

  n_total := ord.subtotal + ord.envio - p_monto;
  -- Lo que se debe baja (o sube) lo mismo que cambia el total, sin pasar de 0.
  n_bal := case when ord.payment_method = 'contado' then 0
                else greatest(ord.balance + (n_total - ord.total), 0) end;

  -- Lo que debe el cliente en total cambia lo mismo que el balance del pedido.
  update clients set balance_pendiente = greatest(balance_pendiente + (n_bal - ord.balance), 0)
   where id = ord.client_id and n_bal <> ord.balance;

  perform set_config('keraven.pago_en_curso', 'si', true);
  update orders
     set descuento = p_monto, total = n_total, balance = n_bal,
         descuento_nota = case when p_monto > 0 then left(trim(p_motivo), 200) end
   where id = p_order_id
  returning * into ord;
  perform set_config('keraven.pago_en_curso', 'no', true);
  return ord;
end $$;

revoke all on function descontar_pedido(uuid, numeric, text) from public, anon;
grant execute on function descontar_pedido(uuid, numeric, text) to authenticated;
