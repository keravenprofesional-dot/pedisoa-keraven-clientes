-- EDITAR EL PEDIDO ANTES DE APROBARLO (pedido el 26-10-2026)
--
-- El cliente ya hizo su pedido, pero mientras siga en "Recibido" (antes de
-- que Keraven lo confirme) un gerente puede cambiarle los productos, las
-- cantidades y el descuento (ponerlo, cambiarlo o quitarlo).
-- Una vez confirmado, ya no se edita: solo se cambia el estado o se cancela.
--
-- Reglas:
--   * Permiso nuevo 'editar_pedidos'. Arranca con quien ya da descuentos.
--   * Lo que el cliente ya tenía conserva su precio; lo que se agrega va al
--     precio de hoy.
--   * La existencia se ajusta sola: lo que se quita vuelve, lo que se agrega sale.
--   * Lo que debe el cliente cambia lo mismo que el total.
--   * El total no puede quedar por debajo de lo que el cliente ya pagó.
--   * Cada edición queda anotada: quién, cuándo, cómo estaba y cómo quedó.

insert into pedidos_permisos (clave, descripcion, orden) values
  ('editar_pedidos', 'Editar productos y descuento de un pedido antes de aprobarlo', 76)
on conflict (clave) do nothing;

-- Arranca con quien ya da descuentos (por su rol o por permiso propio).
insert into pedidos_rol_permisos (rol_id, permiso)
select rp.rol_id, 'editar_pedidos' from pedidos_rol_permisos rp where rp.permiso = 'dar_descuentos'
on conflict do nothing;
insert into pedidos_usuario_permisos (profile_id, permiso, concedido)
select up.profile_id, 'editar_pedidos', true from pedidos_usuario_permisos up
 where up.permiso = 'dar_descuentos' and up.concedido
on conflict do nothing;

alter table orders add column if not exists editado_en timestamptz;

create table if not exists pedido_ediciones (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  hecho_en      timestamptz not null default now(),
  hecho_por     uuid references profiles(id),
  hecho_por_texto text,
  antes         jsonb not null,   -- [{nombre, cantidad, precio}]
  despues       jsonb not null,
  total_antes   numeric(12,2) not null,
  total_despues numeric(12,2) not null,
  motivo        text
);
create index if not exists pedido_ediciones_pedido on pedido_ediciones (order_id, hecho_en);

alter table pedido_ediciones enable row level security;
drop policy if exists ediciones_leer on pedido_ediciones;
create policy ediciones_leer on pedido_ediciones for select to authenticated using (
  order_id in (select id from orders)   -- hereda la regla de orders
);

-- Las líneas de un pedido, legibles, para anotar el antes y el después.
create or replace function lineas_legibles(p_order uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'cantidad', i.cantidad,
                                               'precio', i.precio_unitario) order by p.nombre), '[]'::jsonb)
    from order_items i join products p on p.id = i.product_id
   where i.order_id = p_order
$$;
revoke all on function lineas_legibles(uuid) from public, anon, authenticated;

-- p_items: la lista COMPLETA como debe quedar.
--   [{"item_id": "..."(línea que ya estaba), "cantidad": 3},
--    {"product_id": "..."(producto nuevo),   "cantidad": 1}]
-- La línea que no venga en la lista se quita.
-- p_descuento: monto en RD$ (0 = sin descuento). p_motivo: del descuento.
create or replace function editar_pedido(p_order_id uuid, p_items jsonb, p_descuento numeric, p_motivo text)
returns orders language plpgsql security definer set search_path = public as $$
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

  n_bal := case when ord.payment_method = 'contado' then 0
                else greatest(ord.balance + (n_total - ord.total), 0) end;
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
end $$;

revoke all on function editar_pedido(uuid, jsonb, numeric, text) from public, anon;
grant execute on function editar_pedido(uuid, jsonb, numeric, text) to authenticated;
