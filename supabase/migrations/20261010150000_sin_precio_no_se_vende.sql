-- Al subir la lista por Excel los productos entran sin precio (en 0) para que
-- el precio se ponga después a mano. Mientras tanto NO deben poder venderse:
-- si no, una clienta podría pedirlos en RD$0.
create or replace function crear_pedido(
  items            jsonb,
  delivery_method  text,
  delivery_stop_id uuid,
  address_id       uuid,
  payment_method   text,
  avance           numeric,
  observaciones    text
) returns orders language plpgsql security definer set search_path = public as $$
declare
  cli       clients;
  it        jsonb;
  prod      products;
  cant      int;
  v_sub     numeric(12,2) := 0;
  v_envio   numeric(12,2);
  v_total   numeric(12,2);
  v_avance  numeric(12,2) := 0;
  v_balance numeric(12,2) := 0;
  ord       orders;
begin
  select c.* into cli from clients c join profiles p on p.id = c.profile_id
   where c.profile_id = auth.uid() and p.active;
  if cli.id is null then raise exception 'Solo una clienta activa puede hacer pedidos'; end if;

  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;
  if delivery_method not in ('parada','envio','recogida') then
    raise exception 'Forma de entrega no válida';
  end if;
  if delivery_method = 'parada' and not exists (select 1 from delivery_stops s where s.id = delivery_stop_id and s.activo) then
    raise exception 'Selecciona una parada válida';
  end if;
  if delivery_method = 'envio' and not exists (select 1 from client_addresses a where a.id = address_id and a.client_id = cli.id) then
    raise exception 'Selecciona una de tus direcciones';
  end if;

  perform 1 from products where id in (select (x->>'product_id')::uuid from jsonb_array_elements(items) x)
    order by id for update;

  for it in select * from jsonb_array_elements(items) loop
    cant := (it->>'cantidad')::int;
    if cant is null or cant < 1 or cant > 999 then raise exception 'Cantidad no válida'; end if;
    select * into prod from products where id = (it->>'product_id')::uuid;
    if prod.id is null or not prod.disponible or prod.precio <= 0 then
      raise exception 'Un producto del carrito ya no está disponible';
    end if;
    if prod.stock is not null and prod.stock < cant then
      raise exception 'No hay suficiente existencia de %', prod.nombre;
    end if;
    v_sub := v_sub + prod.precio * cant;
  end loop;

  v_envio := case when delivery_method = 'envio' then 150 else 0 end;
  v_total := v_sub + v_envio;

  if payment_method = 'contado' then
    v_balance := 0;
  elsif payment_method = 'avance' then
    v_avance := coalesce(avance, 0);
    if v_avance <= 0 or v_avance >= v_total then
      raise exception 'El avance debe ser mayor que 0 y menor que el total';
    end if;
    v_balance := v_total - v_avance;
  elsif payment_method = 'credito' then
    v_balance := v_total;
  else
    raise exception 'Forma de pago no válida';
  end if;

  if payment_method in ('avance','credito') then
    if not cli.credit_enabled then
      raise exception 'Tu cuenta no tiene crédito aprobado. Elige pago de contado.';
    end if;
    if cli.credit_limit > 0 and cli.balance_pendiente + v_balance > cli.credit_limit then
      raise exception 'Este pedido pasa tu límite de crédito';
    end if;
  end if;

  insert into orders (client_id, subtotal, envio, total, payment_method, avance, balance,
                      delivery_method, delivery_stop_id, address_id, observaciones)
  values (cli.id, v_sub, v_envio, v_total, payment_method, v_avance, v_balance, delivery_method,
          case when delivery_method = 'parada' then delivery_stop_id end,
          case when delivery_method = 'envio' then address_id end,
          left(observaciones, 500))
  returning * into ord;

  for it in select * from jsonb_array_elements(items) loop
    cant := (it->>'cantidad')::int;
    select * into prod from products where id = (it->>'product_id')::uuid;
    insert into order_items (order_id, product_id, cantidad, precio_unitario, subtotal)
    values (ord.id, prod.id, cant, prod.precio, prod.precio * cant);
    update products set stock = stock - cant where id = prod.id and stock is not null;
  end loop;

  update clients set balance_pendiente = balance_pendiente + v_balance where id = cli.id;
  return ord;
end;
$$;
