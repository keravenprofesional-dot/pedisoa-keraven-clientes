-- SEGUIMIENTO DEL PEDIDO: QUIÉN LO CIERRA
--
-- El pedido va pasando de departamento en departamento y el cliente lo ve
-- en vivo. Eso ya funciona solo: order_status_history guarda cada paso con
-- su fecha, y el cliente puede leer la de sus pedidos.
--
-- Lo único que faltaba: Keraven quiere que sea EL CLIENTE quien cierre el
-- pedido cuando le llegue, no el personal. Pero la regla de la tabla solo
-- deja cambiar el estado a quien tenga permiso de despacho o de cambiar
-- estado — y está bien que siga así.
--
-- Por eso se abre una sola puerta estrecha: esta función. No cambia ninguna
-- regla existente. El cliente solo puede cerrar SU pedido, y solo si ya
-- salió de almacén.

create or replace function confirmar_entrega(p_order_id uuid)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
begin
  select * into o from orders where id = p_order_id;
  if not found then
    raise exception 'Ese pedido no existe';
  end if;

  -- Solo el dueño del pedido. El personal cierra desde el panel, no por aquí.
  if o.client_id not in (select id from clients where profile_id = auth.uid()) then
    raise exception 'Ese pedido no es tuyo';
  end if;

  -- Confirmar dos veces no es un error: ya está cerrado y se devuelve igual.
  if o.status = 'entregado' then
    return o;
  end if;

  if o.status = 'cancelado' then
    raise exception 'Ese pedido fue cancelado';
  end if;

  if o.status not in ('despachado', 'en_entrega') then
    raise exception 'Todavía no: el pedido no ha salido de almacén';
  end if;

  update orders set status = 'entregado' where id = p_order_id returning * into o;
  return o;
end;
$$;

grant execute on function confirmar_entrega(uuid) to authenticated;
