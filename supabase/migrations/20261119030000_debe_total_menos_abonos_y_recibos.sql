-- ============================================================
-- LO QUE SE DEBE = TOTAL − ABONOS, EN TODAS LAS CLIENTAS
-- y RECIBOS OBLIGATORIOS (venta, abono, pagado completo)
--
-- 1) Antes, un pedido al contado nacía con balance 0: el abono no tenía de
--    dónde restarse y nunca salía lo que faltaba. Ahora todo pedido nace
--    debiendo su total (menos el avance, si lo hubo) y cada abono confirmado
--    lo baja. Se recalculan los pedidos viejos con sus abonos confirmados.
--
-- 2) La base emite sola un recibo numerado (RC-000001…) cada vez que:
--      · se hace una venta (crear_pedido)            → tipo 'venta'
--      · cambia el total del pedido (descuento,
--        envío, edición)                             → tipo 'ajuste'
--      · se confirma un abono (venga de donde venga) → tipo 'abono',
--        o 'pagado' si con ese abono queda en 0
--    Cada recibo guarda copia de la clienta (nombre, número, cédula,
--    teléfono, dirección) y de los productos, para que no cambie después.
--
-- 3) Las tildes de crear_pedido, aplicar_envio_pedido y poner_envio
--    quedaron dañadas el 17-nov (se copiaron con la codificación
--    equivocada); aquí se vuelven a crear bien escritas.
-- ============================================================

-- ---------- Recibos ----------
create sequence if not exists recibo_numero_seq;

create table if not exists recibos (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique,
  order_id     uuid not null references orders(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  tipo         text not null check (tipo in ('venta', 'ajuste', 'abono', 'pagado')),
  fecha        timestamptz not null default now(),
  cliente      jsonb not null,           -- copia: nombre, número, cédula, teléfono, dirección
  productos    jsonb not null,           -- copia: cantidad, nombre, precio, importe, lo que lleva la caja
  subtotal     numeric(12,2) not null,
  descuento    numeric(12,2) not null default 0,
  envio        numeric(12,2) not null default 0,
  total        numeric(12,2) not null,
  pagado_antes numeric(12,2) not null default 0,  -- lo abonado antes de este recibo
  debia        numeric(12,2),                     -- solo abono: lo que debía antes
  abono        numeric(12,2),                     -- solo abono: lo que pagó
  resta        numeric(12,2) not null,            -- lo que queda por pagar después
  metodo       text,
  cuenta_texto text,
  referencia   text,
  pago_id      uuid references pagos_reportados(id) on delete set null,
  forma_pago   text,
  pedido       text not null
);
create index if not exists recibos_order_idx on recibos(order_id, fecha);
create index if not exists recibos_client_idx on recibos(client_id, fecha desc);

alter table recibos enable row level security;
drop policy if exists recibos_clienta on recibos;
create policy recibos_clienta on recibos for select to authenticated
  using (client_id in (select c.id from clients c where c.profile_id = auth.uid()));
drop policy if exists recibos_personal on recibos;
create policy recibos_personal on recibos for select to authenticated
  using (tiene_permiso('ver_pedidos') or tiene_permiso('registrar_pagos') or tiene_permiso('despacho'));
-- Nadie los escribe a mano: solo la base, con emitir_recibo.
revoke insert, update, delete on recibos from anon, authenticated;

-- Copia de la clienta tal como está hoy.
create or replace function recibo_cliente(p_order orders)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nombre', c.full_name,
    'numero', c.client_number,
    'cedula', c.cedula,
    'telefono', coalesce((select ph.phone from client_phones ph where ph.client_id = c.id
                           order by ph.is_primary desc nulls last limit 1), c.telefono_login),
    'direccion', coalesce(
      (select concat_ws(', ', a.address, a.sector) from client_addresses a where a.id = p_order.address_id),
      nullif(concat_ws(', ', nullif(c.direccion, ''), nullif(c.sector, ''), nullif(c.ciudad, ''), nullif(c.provincia, '')), ''))
  )
  from clients c where c.id = p_order.client_id
$$;

-- Copia de los productos tal como está hoy.
create or replace function recibo_productos(p_order uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'cantidad', oi.cantidad,
           'nombre', p.nombre,
           'precio', oi.precio_unitario,
           'importe', oi.subtotal,
           'detalle', oi.detalle
         ) order by p.nombre), '[]'::jsonb)
    from order_items oi join products p on p.id = oi.product_id
   where oi.order_id = p_order
$$;

-- Emite un recibo. p_pago: el abono (solo para tipo abono/pagado).
-- p_fecha: cuándo (para los recibos viejos que se rehacen; si no, ahora).
create or replace function emitir_recibo(p_order uuid, p_tipo text, p_pago uuid default null, p_fecha timestamptz default now())
returns recibos language plpgsql security definer set search_path = public as $$
declare
  ord    orders;
  pago   pagos_reportados;
  antes  numeric(12,2);
  r      recibos;
  v_tipo text := p_tipo;
  v_debia numeric(12,2);
  v_abono numeric(12,2);
  v_resta numeric(12,2);
begin
  select * into ord from orders where id = p_order;
  if ord.id is null then raise exception 'Pedido no encontrado'; end if;

  if p_pago is not null then
    select * into pago from pagos_reportados where id = p_pago;
    -- Lo abonado ANTES de este pago (los confirmados anteriores).
    select coalesce(sum(monto), 0) into antes from pagos_reportados
     where order_id = ord.id and estado = 'confirmado' and id <> pago.id
       and (coalesce(confirmado_en, creado_en), id) < (coalesce(pago.confirmado_en, pago.creado_en, p_fecha), pago.id);
    v_debia := greatest(ord.total - antes, 0);
    v_abono := pago.monto;
    v_resta := greatest(v_debia - v_abono, 0);
    v_tipo  := case when v_resta = 0 then 'pagado' else 'abono' end;
  else
    select coalesce(sum(monto), 0) into antes from pagos_reportados
     where order_id = ord.id and estado = 'confirmado'
       and coalesce(confirmado_en, creado_en) <= p_fecha;
    v_resta := greatest(ord.total - antes, 0);
  end if;

  insert into recibos (numero, order_id, client_id, tipo, fecha, cliente, productos,
                       subtotal, descuento, envio, total, pagado_antes, debia, abono, resta,
                       metodo, cuenta_texto, referencia, pago_id, forma_pago, pedido)
  values ('RC-' || lpad(nextval('recibo_numero_seq')::text, 6, '0'), ord.id, ord.client_id, v_tipo, p_fecha,
          recibo_cliente(ord), recibo_productos(ord.id),
          ord.subtotal, ord.descuento, ord.envio, ord.total, antes, v_debia, v_abono, v_resta,
          pago.metodo, pago.cuenta_texto, pago.referencia, pago.id, ord.payment_method, ord.order_number)
  returning * into r;
  return r;
end $$;
revoke all on function emitir_recibo(uuid, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function recibo_cliente(orders) from public, anon, authenticated;
revoke all on function recibo_productos(uuid) from public, anon, authenticated;

-- Abono confirmado (por el personal, por Pagos o desde el ERP) → recibo.
create or replace function recibo_al_confirmar_pago()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'confirmado' and old.estado is distinct from 'confirmado' then
    perform emitir_recibo(new.order_id, 'abono', new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_recibo_pago on pagos_reportados;
create trigger trg_recibo_pago after update of estado on pagos_reportados
for each row execute function recibo_al_confirmar_pago();

-- Cambió el total de un pedido vivo (descuento, envío, edición) → recibo actualizado.
create or replace function recibo_al_ajustar_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.total is distinct from old.total and new.status <> 'cancelado' then
    perform emitir_recibo(new.id, 'ajuste');
  end if;
  return new;
end $$;
drop trigger if exists trg_recibo_ajuste on orders;
create trigger trg_recibo_ajuste after update of total on orders
for each row execute function recibo_al_ajustar_pedido();

-- ---------- Lo que se debe: igual para contado ----------
-- (el descuento fijo de la clienta, al crear el pedido)
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
  if new.payment_method = 'avance' then
    new.balance := greatest(new.total - new.avance, 0);
  else
    -- contado y crédito: se debe el total hasta que se pague
    new.balance := new.total;
  end if;
  if new.balance <> antes then
    update clients set balance_pendiente = balance_pendiente - (antes - new.balance) where id = new.client_id;
  end if;
  return new;
end $$;

-- (el envío que pone el personal; reescrito con las tildes bien)
create or replace function aplicar_envio_pedido(p_order_id uuid, p_monto numeric, p_nota text)
returns orders language plpgsql security definer set search_path = public as $$
declare
  ord      orders;
  n_total  numeric(12,2);
  n_bal    numeric(12,2);
begin
  select * into ord from orders where id = p_order_id for update;
  if ord.id is null then raise exception 'Pedido no encontrado'; end if;
  if ord.status in ('cancelado', 'entregado') then
    raise exception 'No se puede cambiar el envío de un pedido %', ord.status;
  end if;
  if p_monto is null or p_monto < 0 or p_monto > 50000 then
    raise exception 'El envío debe estar entre 0 y 50,000';
  end if;

  n_total := ord.subtotal + p_monto - ord.descuento;
  -- Lo que se debe cambia lo mismo que el total.
  n_bal := greatest(ord.balance + (n_total - ord.total), 0);

  update clients set balance_pendiente = greatest(balance_pendiente + (n_bal - ord.balance), 0)
   where id = ord.client_id and n_bal <> ord.balance;

  perform set_config('keraven.pago_en_curso', 'si', true);
  update orders
     set envio = p_monto, total = n_total, balance = n_bal,
         envio_nota = case when p_monto > 0 then nullif(left(trim(coalesce(p_nota, '')), 120), '') end
   where id = p_order_id
  returning * into ord;
  perform set_config('keraven.pago_en_curso', 'no', true);
  return ord;
end $$;
revoke all on function aplicar_envio_pedido(uuid, numeric, text) from public, anon, authenticated;

create or replace function poner_envio(p_order_id uuid, p_monto numeric, p_nota text)
returns orders language plpgsql security definer set search_path = public as $$
begin
  if not (tiene_permiso('despacho') or tiene_permiso('editar_pedidos')) then
    raise exception 'No tienes permiso para poner el envío';
  end if;
  return aplicar_envio_pedido(p_order_id, p_monto, p_nota);
end $$;
revoke all on function poner_envio(uuid, numeric, text) from public, anon;
grant execute on function poner_envio(uuid, numeric, text) to authenticated;
comment on column orders.envio_nota is 'Quién lleva el envío o nota del personal (opcional)';

-- (la venta nace debiendo su total, también al contado, y emite su recibo)
CREATE OR REPLACE FUNCTION public.crear_pedido(items jsonb, delivery_method text, delivery_stop_id uuid, address_id uuid, payment_method text, avance numeric, observaciones text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- El envío ya no es fijo: nace en 0 y el personal pone el monto después.
  v_envio := 0;
  v_total := v_sub + v_envio;

  if payment_method = 'contado' then
    -- Al contado también se debe el total hasta que se pague.
    v_balance := v_total;
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
  -- Recibo de venta, obligatorio.
  perform emitir_recibo(ord.id, 'venta');
  return ord;
end;
$function$;

-- (descuento puntual: lo que se debe sigue al total, también al contado)
CREATE OR REPLACE FUNCTION public.aplicar_descuento_pedido(p_order_id uuid, p_monto numeric, p_motivo text, p_quien text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  n_bal := greatest(ord.balance + (n_total - ord.total), 0);  -- igual en contado, crédito y avance

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
end $function$;

-- (editar pedido: igual)
CREATE OR REPLACE FUNCTION public.editar_pedido(p_order_id uuid, p_items jsonb, p_descuento numeric, p_motivo text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ord      orders;
  it       jsonb;
  linea    order_items;
  prod     products;
  cant     int;
  falta    text;
  antes    jsonb;
  pagado   numeric(12,2);
  n_sub    numeric(12,2) := 0;
  n_total  numeric(12,2);
  n_bal    numeric(12,2);
  quien    text;
  id_con   integer;
begin
  if not tiene_permiso('editar_pedidos') then raise exception 'No tienes permiso para editar pedidos'; end if;

  select * into ord from orders where id = p_order_id for update;
  if ord.id is null then raise exception 'Pedido no encontrado'; end if;
  if ord.status <> 'recibido' then
    raise exception 'El pedido % ya fue confirmado: ya no se puede editar', ord.order_number;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no puede quedar sin productos. Si no lo quieren, cancélalo.';
  end if;

  -- Revisar la lista antes de tocar nada.
  for it in select * from jsonb_array_elements(p_items) loop
    cant := (it->>'cantidad')::int;
    if cant is null or cant < 1 or cant > 999 then raise exception 'Cantidad no válida'; end if;
    if it ? 'item_id' then
      if not exists (select 1 from order_items where id = (it->>'item_id')::uuid and order_id = ord.id) then
        raise exception 'Una línea no es de este pedido';
      end if;
    else
      select * into prod from products where id = (it->>'product_id')::uuid;
      if prod.id is null or not prod.disponible or prod.precio <= 0 then
        raise exception 'Un producto que se quiere agregar no está disponible';
      end if;
      if prod.armado is not null then
        raise exception 'La caja "%" se arma por sabores: la tiene que pedir el cliente', prod.nombre;
      end if;
      select c2.nombre into falta
        from product_items pi join products c2 on c2.id = pi.componente_id
       where pi.product_id = prod.id and (not c2.disponible or c2.precio <= 0)
       limit 1;
      if falta is not null then
        raise exception 'La caja "%" no se puede agregar ahora: % está agotado', prod.nombre, falta;
      end if;
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_items) x where x ? 'item_id')
     <> (select count(distinct x->>'item_id') from jsonb_array_elements(p_items) x where x ? 'item_id') then
    raise exception 'Una línea viene repetida';
  end if;

  antes := lineas_legibles(ord.id);

  -- Bloquea los productos en orden fijo (igual que crear_pedido).
  perform 1 from products
   where id in (select product_id from order_items where order_id = ord.id
                union select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x where x ? 'product_id')
   order by id for update;

  -- 1) Líneas quitadas: su existencia vuelve.
  for linea in select * from order_items i where i.order_id = ord.id
     and i.id::text not in (select x->>'item_id' from jsonb_array_elements(p_items) x where x ? 'item_id') loop
    update products set stock = stock + linea.cantidad where id = linea.product_id and stock is not null;
    delete from order_items where id = linea.id;
  end loop;

  -- 2) Líneas que se quedan: cambia la cantidad, con su mismo precio. Lo que
  --    va dentro de la caja crece o baja en la misma proporción.
  for it in select * from jsonb_array_elements(p_items) x where x ? 'item_id' loop
    cant := (it->>'cantidad')::int;
    select * into linea from order_items where id = (it->>'item_id')::uuid;
    if cant <> linea.cantidad then
      select * into prod from products where id = linea.product_id;
      if prod.stock is not null and prod.stock < cant - linea.cantidad then
        raise exception 'No hay suficiente existencia de %', prod.nombre;
      end if;
      update products set stock = stock - (cant - linea.cantidad) where id = prod.id and stock is not null;
      update order_items
         set cantidad = cant, subtotal = precio_unitario * cant,
             detalle = case when detalle is null or jsonb_typeof(detalle) <> 'array' then detalle else
               (select jsonb_agg(d || jsonb_build_object('cantidad', ((d->>'cantidad')::int / linea.cantidad) * cant))
                  from jsonb_array_elements(detalle) d) end
       where id = linea.id;
    end if;
  end loop;

  -- 3) Productos nuevos: al precio de hoy.
  for it in select * from jsonb_array_elements(p_items) x where not x ? 'item_id' loop
    cant := (it->>'cantidad')::int;
    select * into prod from products where id = (it->>'product_id')::uuid;
    if prod.stock is not null and prod.stock < cant then
      raise exception 'No hay suficiente existencia de %', prod.nombre;
    end if;
    insert into order_items (order_id, product_id, cantidad, precio_unitario, subtotal, detalle)
    values (ord.id, prod.id, cant, prod.precio, prod.precio * cant,
            (select jsonb_agg(jsonb_build_object('producto_id', c2.id, 'nombre', c2.nombre, 'cantidad', pi.cantidad * cant))
               from product_items pi join products c2 on c2.id = pi.componente_id
              where pi.product_id = prod.id));
    update products set stock = stock - cant where id = prod.id and stock is not null;
  end loop;

  -- 4) Nuevo total, descuento y lo que se debe.
  select coalesce(sum(subtotal), 0) into n_sub from order_items where order_id = ord.id;
  if p_descuento is null or p_descuento < 0 or p_descuento > n_sub then
    raise exception 'El descuento debe estar entre 0 y el subtotal (%)', n_sub;
  end if;
  if p_descuento > 0 and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo del descuento';
  end if;
  n_total := n_sub + ord.envio - p_descuento;

  select coalesce(sum(monto), 0) into pagado from pagos_reportados
   where order_id = ord.id and estado = 'confirmado';
  if n_total < pagado then
    raise exception 'El cliente ya pagó %; el total no puede quedar por debajo de eso', pagado;
  end if;

  n_bal := greatest(ord.balance + (n_total - ord.total), 0);  -- igual en contado, crédito y avance
  update clients set balance_pendiente = greatest(balance_pendiente + (n_bal - ord.balance), 0)
   where id = ord.client_id and n_bal <> ord.balance;

  quien := (select full_name from profiles where id = auth.uid());
  perform set_config('keraven.pago_en_curso', 'si', true);
  update orders
     set subtotal = n_sub, descuento = p_descuento, total = n_total, balance = n_bal,
         descuento_nota      = case when p_descuento > 0 then left(trim(p_motivo), 200) end,
         descuento_por_texto = case when p_descuento > 0 then left(quien, 120) end,
         editado_en = now()
   where id = ord.id;
  perform set_config('keraven.pago_en_curso', 'no', true);

  insert into pedido_ediciones (order_id, hecho_por, hecho_por_texto, antes, despues, total_antes, total_despues, motivo)
  values (ord.id, auth.uid(), quien, antes, lineas_legibles(ord.id), ord.total, n_total,
          nullif(left(trim(coalesce(p_motivo, '')), 200), ''));

  -- 5) Si el pedido también está en la venta pendiente del ERP, se le
  --    rehacen los productos y el monto. Si eso falla, el pedido queda igual.
  if to_regclass('public.contrato_productos') is not null then
    begin
      select e.contrato_id into id_con from erp_enlace_pedidos e join contratos c on c.id = e.contrato_id
       where e.order_id = ord.id and c.estado in ('pendiente', 'pendiente_fotos');
      if id_con is not null then
        delete from contrato_productos where contrato_id = id_con;
        for linea in select * from order_items where order_id = ord.id loop
          perform erp_agregar_linea(id_con, linea);
        end loop;
        update contratos set monto = n_sub + ord.envio where id = id_con;
      end if;
    exception when others then
      perform erp_anotar_error('editar venta', ord.id, sqlerrm);
    end;
  end if;

  select * into ord from orders where id = ord.id;
  return ord;
end $function$;


-- ---------- Poner al día lo que ya existe ----------
-- a) Los abonos viejos al contado no pasaron a payments (el balance era 0):
--    se pasan ahora, para que la clienta los vea en "Mis pagos".
with nuevos as (
  insert into payments (order_id, monto, metodo, fecha, registrado_por, cuenta_texto, referencia)
  select pr.order_id, pr.monto, pr.metodo, coalesce(pr.confirmado_en, pr.creado_en), pr.confirmado_por, pr.cuenta_texto, pr.referencia
    from pagos_reportados pr join orders o on o.id = pr.order_id
   where pr.estado = 'confirmado' and pr.payment_id is null and o.status <> 'cancelado'
  returning id, order_id, monto, fecha
)
update pagos_reportados pr set payment_id = n.id
  from nuevos n
 where pr.order_id = n.order_id and pr.monto = n.monto and coalesce(pr.confirmado_en, pr.creado_en) = n.fecha
   and pr.payment_id is null and pr.estado = 'confirmado';

-- b) Lo que debe cada pedido = total − abonos confirmados (los cancelados, 0).
update orders o
   set balance = case when o.status = 'cancelado' then 0 else greatest(o.total - coalesce(
         (select sum(pr.monto) from pagos_reportados pr where pr.order_id = o.id and pr.estado = 'confirmado'), 0), 0) end
 where o.balance is distinct from case when o.status = 'cancelado' then 0 else greatest(o.total - coalesce(
         (select sum(pr.monto) from pagos_reportados pr where pr.order_id = o.id and pr.estado = 'confirmado'), 0), 0) end;

-- c) Lo que debe cada clienta = suma de sus pedidos vivos.
update clients c
   set balance_pendiente = coalesce((select sum(o.balance) from orders o where o.client_id = c.id and o.status <> 'cancelado'), 0)
 where c.balance_pendiente is distinct from coalesce((select sum(o.balance) from orders o where o.client_id = c.id and o.status <> 'cancelado'), 0);

-- d) Recibos de lo que ya pasó, en orden de fecha: la venta de cada pedido
--    vivo y cada abono confirmado.
do $$
declare x record;
begin
  if exists (select 1 from recibos) then return; end if;
  for x in
    select * from (
      select o.id order_id, null::uuid pago, o.created_at f from orders o where o.status <> 'cancelado'
      union all
      select pr.order_id, pr.id, coalesce(pr.confirmado_en, pr.creado_en) from pagos_reportados pr
        join orders o on o.id = pr.order_id where pr.estado = 'confirmado' and o.status <> 'cancelado'
    ) t order by f
  loop
    perform emitir_recibo(x.order_id, case when x.pago is null then 'venta' else 'abono' end, x.pago, x.f);
  end loop;
end $$;
