-- El administrador de Pedidos se muda a Keraven Systems Masters (por partes;
-- primero Pedidos, Seguimiento y Pagos). El ERP no entra a la app con un
-- usuario de aquí: se conecta directo a la base. Por eso tiene sus propias
-- funciones, que hacen lo mismo que la app pero anotan el NOMBRE de la
-- persona del ERP que lo hizo.
--
-- Ninguna de estas funciones la puede llamar un cliente ni nadie desde la app:
-- solo la conexión del ERP (dueña de la base).

alter table order_status_history add column if not exists cambiado_por_texto text;
alter table pagos_reportados     add column if not exists confirmado_por_texto text;

-- ── Cambiar el estado de un pedido desde el ERP ──
create or replace function erp_cambiar_estado_pedido(p_order uuid, p_estado text, p_quien text)
returns orders language plpgsql security definer set search_path = public as $$
declare
  o orders;
begin
  if p_estado not in ('recibido','confirmado','preparacion','listo','despachado','en_entrega','entregado','cancelado') then
    raise exception 'Estado no válido';
  end if;
  select * into o from orders where id = p_order for update;
  if o.id is null then raise exception 'Pedido no encontrado'; end if;
  if o.status = p_estado then return o; end if;
  if o.status = 'cancelado' then raise exception 'Un pedido cancelado no se puede reabrir; el cliente debe hacer uno nuevo'; end if;

  update orders set status = p_estado where id = p_order returning * into o;
  -- El historial anota quién lo movió desde el ERP
  update order_status_history set cambiado_por_texto = left(coalesce(p_quien, 'ERP'), 120)
   where id = (select id from order_status_history where order_id = p_order and status = p_estado order by changed_at desc limit 1);
  return o;
end $$;

-- ── Confirmar o rechazar un pago reportado ──
-- La lógica vive en un solo sitio; la app y el ERP la usan igual.
create or replace function decidir_pago(p_id uuid, p_estado text, p_nota text, p_por uuid, p_por_texto text)
returns pagos_reportados language plpgsql security definer set search_path = public as $$
declare
  rep   pagos_reportados;
  ord   orders;
  abono numeric(12,2);
  pago  payments;
begin
  if p_estado not in ('confirmado', 'rechazado') then raise exception 'Estado no válido'; end if;
  select * into rep from pagos_reportados where id = p_id for update;
  if rep.id is null then raise exception 'Pago no encontrado'; end if;
  if rep.estado <> 'reportado' then raise exception 'Este pago ya fue %', rep.estado; end if;
  if p_estado = 'rechazado' and coalesce(trim(p_nota), '') = '' then
    raise exception 'Escribe por qué se rechaza (el cliente lo verá)';
  end if;

  if p_estado = 'confirmado' then
    select * into ord from orders where id = rep.order_id for update;
    -- Si el pedido debía algo (crédito/avance), el pago lo baja.
    abono := least(rep.monto, greatest(ord.balance, 0));
    if abono > 0 then
      insert into payments (order_id, monto, metodo, registrado_por, cuenta_texto, referencia)
      values (ord.id, abono, rep.metodo, p_por, rep.cuenta_texto, rep.referencia)
      returning * into pago;
      perform set_config('keraven.pago_en_curso', 'si', true);
      update orders set balance = balance - abono where id = ord.id;
      perform set_config('keraven.pago_en_curso', 'no', true);
      update clients set balance_pendiente = greatest(balance_pendiente - abono, 0) where id = ord.client_id;
    end if;
  end if;

  update pagos_reportados
     set estado = p_estado, nota = nullif(left(trim(coalesce(p_nota, '')), 300), ''),
         confirmado_por = p_por, confirmado_por_texto = left(p_por_texto, 120),
         confirmado_en = now(), payment_id = pago.id
   where id = p_id
  returning * into rep;
  return rep;
end $$;

-- La app: igual que antes (pide el permiso de la persona conectada)
create or replace function confirmar_pago(p_id uuid, p_estado text, p_nota text default null)
returns pagos_reportados language plpgsql security definer set search_path = public as $$
begin
  if not tiene_permiso('registrar_pagos') then raise exception 'No tienes permiso para confirmar pagos'; end if;
  return decidir_pago(p_id, p_estado, p_nota, auth.uid(), null);
end $$;

-- El ERP: anota el nombre de quien lo hizo allá
create or replace function erp_decidir_pago(p_id uuid, p_estado text, p_nota text, p_quien text)
returns pagos_reportados language plpgsql security definer set search_path = public as $$
begin
  return decidir_pago(p_id, p_estado, p_nota, null, coalesce(p_quien, 'ERP'));
end $$;

revoke all on function decidir_pago(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function erp_cambiar_estado_pedido(uuid, text, text) from public, anon, authenticated;
revoke all on function erp_decidir_pago(uuid, text, text, text) from public, anon, authenticated;
