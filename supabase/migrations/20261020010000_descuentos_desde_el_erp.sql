-- Descuentos manuales también desde Keraven Systems Masters (decidido el
-- 20-10-2026: "en los dos"). La regla del descuento en un pedido vive en un
-- solo sitio, aplicar_descuento_pedido(): la app la llama pidiendo el permiso
-- 'dar_descuentos' de la persona conectada, y el ERP (que se conecta directo a
-- la base) con el nombre de quien lo hizo allá. El puente
-- (erp_al_cambiar_pedido) pasa el nuevo neto y saldo a la factura del ERP,
-- igual que cuando se descuenta desde la app.

alter table orders             add column if not exists descuento_por_texto text;
alter table descuentos_cliente add column if not exists puesto_por_texto text;

-- ── La regla (sin revisar permisos: eso lo hace quien la llama) ──
create or replace function aplicar_descuento_pedido(p_order_id uuid, p_monto numeric, p_motivo text, p_quien text)
returns orders language plpgsql security definer set search_path = public as $$
declare
  ord      orders;
  n_total  numeric(12,2);
  n_bal    numeric(12,2);
begin
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
         descuento_nota      = case when p_monto > 0 then left(trim(p_motivo), 200) end,
         descuento_por_texto = case when p_monto > 0 then left(p_quien, 120) end
   where id = p_order_id
  returning * into ord;
  perform set_config('keraven.pago_en_curso', 'no', true);
  return ord;
end $$;

-- La app: igual que antes (pide el permiso de la persona conectada)
create or replace function descontar_pedido(p_order_id uuid, p_monto numeric, p_motivo text)
returns orders language plpgsql security definer set search_path = public as $$
begin
  if not tiene_permiso('dar_descuentos') then raise exception 'No tienes permiso para dar descuentos'; end if;
  return aplicar_descuento_pedido(p_order_id, p_monto, p_motivo,
                                  (select full_name from profiles where id = auth.uid()));
end $$;

-- El ERP: descuento en un pedido, anotando el nombre de quien lo hizo allá
create or replace function erp_descontar_pedido(p_order uuid, p_monto numeric, p_motivo text, p_quien text)
returns orders language plpgsql security definer set search_path = public as $$
begin
  return aplicar_descuento_pedido(p_order, p_monto, p_motivo, coalesce(p_quien, 'ERP'));
end $$;

-- El ERP: % fijo de una clienta (se aplica solo en cada pedido nuevo suyo).
-- 0 o vacío lo quita. Mismos límites que la app: de 1 % a 50 %.
create or replace function erp_descuento_cliente(p_client uuid, p_pct numeric, p_motivo text, p_quien text)
returns descuentos_cliente language plpgsql security definer set search_path = public as $$
declare
  d descuentos_cliente;
begin
  if not exists (select 1 from clients where id = p_client) then raise exception 'Clienta no encontrada'; end if;
  if coalesce(p_pct, 0) = 0 then
    delete from descuentos_cliente where client_id = p_client;
    return null;
  end if;
  if p_pct < 1 or p_pct > 50 then raise exception 'El descuento debe estar entre 1%% y 50%%'; end if;
  insert into descuentos_cliente (client_id, porcentaje, motivo, puesto_por, puesto_por_texto, actualizado_en)
  values (p_client, p_pct, nullif(left(trim(coalesce(p_motivo, '')), 200), ''), null, left(coalesce(p_quien, 'ERP'), 120), now())
  on conflict (client_id) do update
     set porcentaje = excluded.porcentaje, motivo = excluded.motivo, puesto_por = null,
         puesto_por_texto = excluded.puesto_por_texto, actualizado_en = now()
  returning * into d;
  return d;
end $$;

-- Cuando el % lo cambia alguien en la app, el nombre del ERP ya no aplica.
create or replace function descuento_cliente_quien()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.puesto_por is not null then new.puesto_por_texto := null; end if;
  return new;
end $$;
drop trigger if exists trg_descuento_cliente_quien on descuentos_cliente;
create trigger trg_descuento_cliente_quien before insert or update on descuentos_cliente
for each row execute function descuento_cliente_quien();

revoke all on function aplicar_descuento_pedido(uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function erp_descontar_pedido(uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function erp_descuento_cliente(uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function descontar_pedido(uuid, numeric, text) from public, anon;
grant execute on function descontar_pedido(uuid, numeric, text) to authenticated;
