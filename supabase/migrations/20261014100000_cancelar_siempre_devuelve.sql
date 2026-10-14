-- Arreglo: al cancelar un pedido, el stock y la deuda del cliente se devuelven
-- SIEMPRE, lo cancele quien lo cancele.
--
-- Antes, esa devolución solo corría cuando cancelaba alguien conectado a la
-- app. Si lo cancelaba el ERP (Buzón rechaza o anula la venta → el puente
-- cancela el pedido), los productos no volvían al stock ni bajaba lo que el
-- cliente debía.
--
-- Las restricciones (solo se cambia el estado; un cancelado no se reabre)
-- siguen aplicando a quien está conectado a la app, como antes.

create or replace function proteger_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and current_setting('keraven.pago_en_curso', true) is distinct from 'si' then
    if (new.client_id, new.subtotal, new.descuento, new.envio, new.total, new.payment_method,
        new.avance, new.balance, new.created_at, new.order_number)
       is distinct from
       (old.client_id, old.subtotal, old.descuento, old.envio, old.total, old.payment_method,
        old.avance, old.balance, old.created_at, old.order_number) then
      raise exception 'Solo se puede cambiar el estado del pedido';
    end if;
    if old.status = 'cancelado' and new.status <> 'cancelado' then
      raise exception 'Un pedido cancelado no se puede reabrir; el cliente debe hacer uno nuevo';
    end if;
  end if;

  -- Cancelar devuelve lo que el pedido había tomado (venga de donde venga)
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    update products p set stock = p.stock + oi.cantidad
      from order_items oi where oi.order_id = new.id and oi.product_id = p.id and p.stock is not null;
    update clients set balance_pendiente = greatest(balance_pendiente - old.balance, 0)
      where id = new.client_id;
  end if;
  return new;
end;
$$;
