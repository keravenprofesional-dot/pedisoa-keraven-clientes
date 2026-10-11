-- Una caja con productos fijos adentro (ej. 16 shampoo de coco) no se puede
-- vender si alguno de esos productos está agotado o todavía no tiene precio:
-- no se puede empacar lo que no hay.
-- (Las cajas que el cliente arma ya revisaban el sabor elegido; esto cubre
--  las que llevan una lista fija.)
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
  sabores   jsonb;
  n_sab     int;
  por_grupo int;
  s_nombre  text;
  sab_def   jsonb;
  g         int;
  comp      products;
  detalle   jsonb;
  falta     text;
begin
  select c.* into cli from clients c join profiles p on p.id = c.profile_id
   where c.profile_id = auth.uid() and p.active;
  if cli.id is null then raise exception 'Solo un cliente activo puede hacer pedidos'; end if;

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

    if prod.armado is not null then
      sabores := coalesce(it->'sabores', '[]'::jsonb);
      n_sab := jsonb_array_length(sabores);
      por_grupo := (prod.armado->>'unidades_por_grupo')::int;
      if n_sab < 1 then
        raise exception 'Elige el sabor de tu %', prod.nombre;
      end if;
      if n_sab > (prod.armado->>'max_sabores')::int then
        raise exception 'Esta caja admite hasta % sabor(es)', prod.armado->>'max_sabores';
      end if;
      if (select count(distinct x) from jsonb_array_elements_text(sabores) x) <> n_sab then
        raise exception 'No repitas el mismo sabor: elige sabores distintos';
      end if;
      if por_grupo % n_sab <> 0 then
        raise exception 'Con % sabores no se pueden repartir las % unidades en partes iguales', n_sab, por_grupo;
      end if;
      for s_nombre in select * from jsonb_array_elements_text(sabores) loop
        select x into sab_def from jsonb_array_elements(prod.armado->'sabores') x
         where x->>'nombre' = s_nombre;
        if sab_def is null then raise exception 'El sabor "%" no está en esta caja', s_nombre; end if;
        for g in 0 .. jsonb_array_length(prod.armado->'grupos') - 1 loop
          select * into comp from products where id = (sab_def->'productos'->>g)::uuid;
          if comp.id is null or not comp.disponible or comp.precio <= 0 then
            raise exception 'El sabor "%" no está disponible ahora mismo', s_nombre;
          end if;
        end loop;
      end loop;
    else
      if coalesce(jsonb_array_length(it->'sabores'), 0) > 0 then
        raise exception 'Este producto no se arma por sabores';
      end if;
      -- Caja con lista fija: revisar que todo lo de adentro esté disponible.
      select c2.nombre into falta
        from product_items i join products c2 on c2.id = i.componente_id
       where i.product_id = prod.id and (not c2.disponible or c2.precio <= 0)
       limit 1;
      if falta is not null then
        raise exception 'La caja "%" no se puede pedir ahora: % está agotado', prod.nombre, falta;
      end if;
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
    detalle := null;

    if prod.armado is not null then
      sabores := it->'sabores';
      n_sab := jsonb_array_length(sabores);
      por_grupo := (prod.armado->>'unidades_por_grupo')::int;
      detalle := '[]'::jsonb;
      for g in 0 .. jsonb_array_length(prod.armado->'grupos') - 1 loop
        for s_nombre in select * from jsonb_array_elements_text(sabores) loop
          select x into sab_def from jsonb_array_elements(prod.armado->'sabores') x
           where x->>'nombre' = s_nombre;
          select * into comp from products where id = (sab_def->'productos'->>g)::uuid;
          detalle := detalle || jsonb_build_object(
            'grupo', prod.armado->'grupos'->>g, 'sabor', s_nombre,
            'producto_id', comp.id, 'nombre', comp.nombre,
            'cantidad', (por_grupo / n_sab) * cant
          );
        end loop;
      end loop;
    else
      -- Caja con lista fija: se guarda también lo que lleva, para despacho.
      select jsonb_agg(jsonb_build_object('producto_id', c2.id, 'nombre', c2.nombre, 'cantidad', i.cantidad * cant))
        into detalle
        from product_items i join products c2 on c2.id = i.componente_id
       where i.product_id = prod.id;
    end if;

    insert into order_items (order_id, product_id, cantidad, precio_unitario, subtotal, detalle)
    values (ord.id, prod.id, cant, prod.precio, prod.precio * cant, detalle);
    update products set stock = stock - cant where id = prod.id and stock is not null;
  end loop;

  update clients set balance_pendiente = balance_pendiente + v_balance where id = cli.id;
  return ord;
end;
$$;
