-- ============================================================
-- CAJAS QUE EL CLIENTE ARMA (Duo Pack de 16 unidades)
--
-- La caja trae 8 shampoo + 8 mascarilla. El cliente elige 1 o 2 sabores:
--   1 sabor  → 8 shampoo y 8 mascarilla de ese sabor
--   2 sabores → 4 y 4 de cada uno
-- Nunca más de los sabores permitidos, y siempre en partes iguales.
--
-- La receta se guarda en products.armado así:
-- {
--   "unidades_por_grupo": 8,
--   "max_sabores": 2,
--   "grupos": ["Shampoo", "Mascarilla"],
--   "sabores": [ { "nombre": "Coco", "productos": ["<id shampoo>", "<id mascarilla>"] }, ... ]
-- }
-- ============================================================
alter table products    add column if not exists armado  jsonb;
alter table order_items add column if not exists detalle jsonb;

comment on column products.armado is 'Receta de la caja que el cliente arma; vacío = producto normal';
comment on column order_items.detalle is 'Lo que de verdad va en la caja, calculado por el servidor';

-- Revisa que la receta tenga sentido antes de guardarla.
create or replace function revisar_armado()
returns trigger language plpgsql as $$
declare
  n_grupos int;
  s jsonb;
begin
  if new.armado is null then return new; end if;
  if new.tipo = 'simple' then
    raise exception 'Solo un Duo Pack o un Duo Kit puede ser una caja que el cliente arma';
  end if;
  if coalesce((new.armado->>'unidades_por_grupo')::int, 0) < 1 then
    raise exception 'Pon cuántas unidades lleva cada grupo';
  end if;
  if coalesce((new.armado->>'max_sabores')::int, 0) < 1 then
    raise exception 'Pon cuántos sabores puede elegir el cliente';
  end if;
  n_grupos := jsonb_array_length(coalesce(new.armado->'grupos', '[]'::jsonb));
  if n_grupos < 1 then raise exception 'La caja necesita por lo menos un grupo (ej. Shampoo)'; end if;
  if jsonb_array_length(coalesce(new.armado->'sabores', '[]'::jsonb)) < 1 then
    raise exception 'La caja necesita por lo menos un sabor';
  end if;
  for s in select * from jsonb_array_elements(new.armado->'sabores') loop
    if coalesce(s->>'nombre', '') = '' then raise exception 'Hay un sabor sin nombre'; end if;
    if jsonb_array_length(coalesce(s->'productos', '[]'::jsonb)) <> n_grupos then
      raise exception 'El sabor "%" necesita un producto por cada grupo', s->>'nombre';
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists trg_revisar_armado on products;
create trigger trg_revisar_armado before insert or update of armado, tipo on products
for each row execute function revisar_armado();

-- ============================================================
-- crear_pedido: ahora cada renglón puede traer los sabores elegidos.
--   items = [{ "product_id": "...", "cantidad": 1, "sabores": ["Coco","Zanahoria"] }]
-- El servidor arma la lista real de lo que va en la caja; lo que mande
-- el teléfono NO se usa para nada más que elegir los sabores.
-- ============================================================
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

  -- Primera vuelta: revisar todo y sumar
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
          if comp.id is null or not comp.disponible then
            raise exception 'El sabor "%" no está disponible ahora mismo', s_nombre;
          end if;
        end loop;
      end loop;
    elsif coalesce(jsonb_array_length(it->'sabores'), 0) > 0 then
      raise exception 'Este producto no se arma por sabores';
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

  -- Segunda vuelta: guardar los renglones y, si es caja, lo que lleva dentro
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
            'grupo', prod.armado->'grupos'->>g,
            'sabor', s_nombre,
            'producto_id', comp.id,
            'nombre', comp.nombre,
            'cantidad', (por_grupo / n_sab) * cant
          );
        end loop;
      end loop;
    end if;

    insert into order_items (order_id, product_id, cantidad, precio_unitario, subtotal, detalle)
    values (ord.id, prod.id, cant, prod.precio, prod.precio * cant, detalle);
    update products set stock = stock - cant where id = prod.id and stock is not null;
  end loop;

  update clients set balance_pendiente = balance_pendiente + v_balance where id = cli.id;
  return ord;
end;
$$;
