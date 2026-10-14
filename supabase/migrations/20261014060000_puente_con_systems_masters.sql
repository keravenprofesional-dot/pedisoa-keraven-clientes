-- PUENTE: Pedidos Keraven → Keraven Systems Masters (el ERP).
--
-- Los dos programas comparten la misma base de datos, así que el puente vive
-- aquí, en la base, y es inmediato: no depende de que un programa llame al otro.
--
--   · Cada pedido nuevo entra al ERP como una venta (contratos) PENDIENTE en
--     el Buzón, con origen = 'pedidos' (la firma "Pedidos Keraven"), número de
--     factura igual al del pedido (KP-000123), sin promotor (=> sin comisión).
--   · Sus productos entran a contrato_productos usando la tabla de
--     equivalencias. Un Duo Pack entra como los productos que lleva adentro.
--     Lo que no tenga equivalencia se anota en las observaciones de la venta.
--   · El cliente se busca en el ERP por cédula o teléfono; si no está, se crea.
--   · Descuentos, cancelaciones y pagos confirmados también pasan al ERP.
--   · Al revés: si en el Buzón del ERP la aprueban, el pedido pasa a
--     "confirmado"; si la rechazan o la anulan, el pedido se cancela.
--
-- REGLA DE ORO: si algo falla al pasar al ERP, el pedido del cliente SE
-- GUARDA IGUAL. El error queda en erp_errores para revisarlo.
--
-- Todo va condicionado a que existan las tablas del ERP (la copia de pruebas
-- de Pedidos no las tiene).

-- ── Tablas propias del puente (lado Pedidos) ─────────────────────────────
create table if not exists erp_errores (
  id        bigint generated always as identity primary key,
  que       text not null,
  order_id  uuid,
  detalle   text,
  creado_en timestamptz not null default now()
);
alter table erp_errores enable row level security;
revoke insert, update, delete on erp_errores from anon, authenticated;
drop policy if exists erp_errores_leer on erp_errores;
create policy erp_errores_leer on erp_errores for select to authenticated using (tiene_permiso('configuracion'));

do $$
begin
  if to_regclass('public.contratos') is null then return; end if;

  -- La firma: el ERP acepta ahora origen = 'pedidos'.
  alter table contratos drop constraint if exists contratos_origen_check;
  alter table contratos add constraint contratos_origen_check
    check (origen in ('manual','excel','cobrador','pedidos'));

  -- Qué producto del ERP es cada producto de Pedidos.
  create table if not exists erp_equivalencias (
    product_id  uuid primary key references products(id) on delete cascade,
    producto_id integer not null references productos(id) on delete cascade,
    puesto_por  uuid references profiles(id),
    actualizado_en timestamptz not null default now()
  );
  -- Qué venta del ERP es cada pedido, y qué cliente del ERP es cada cliente.
  create table if not exists erp_enlace_pedidos (
    order_id    uuid primary key references orders(id) on delete cascade,
    contrato_id integer not null unique references contratos(id) on delete cascade,
    creado_en   timestamptz not null default now()
  );
  create table if not exists erp_enlace_clientes (
    client_id  uuid primary key references clients(id) on delete cascade,
    cliente_id integer not null references clientes(id) on delete cascade
  );

  alter table erp_equivalencias   enable row level security;
  alter table erp_enlace_pedidos  enable row level security;
  alter table erp_enlace_clientes enable row level security;
  revoke all on erp_enlace_pedidos, erp_enlace_clientes from anon, authenticated;
  revoke all on erp_equivalencias from anon;
  drop policy if exists erp_eq_leer on erp_equivalencias;
  drop policy if exists erp_eq_escribir on erp_equivalencias;
  create policy erp_eq_leer on erp_equivalencias for select to authenticated using (es_personal());
  create policy erp_eq_escribir on erp_equivalencias for all to authenticated
    using (tiene_permiso('productos')) with check (tiene_permiso('productos'));
  -- La lista de productos del ERP, para elegir la equivalencia desde Pedidos
  -- (solo lectura, solo personal con permiso de productos).
  execute 'create or replace view erp_productos as
           select id, nombre, codigo, activo from productos';
  revoke all on erp_productos from anon, authenticated;
  grant select on erp_productos to authenticated;
end $$;

-- ── Funciones del puente ─────────────────────────────────────────────────
-- (plpgsql no revisa las tablas al crear la función, así que se crean siempre;
--  cada una se apaga sola si no existe el ERP.)

create or replace function erp_anotar_error(p_que text, p_order uuid, p_detalle text)
returns void language sql security definer set search_path = public as $$
  insert into erp_errores (que, order_id, detalle) values (p_que, p_order, left(p_detalle, 1000));
$$;

-- El cliente del ERP que corresponde a un cliente de Pedidos (lo crea si no hay).
create or replace function erp_cliente_de(p_client uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  c    clients;
  ced  text;
  tel  text;
  id_erp integer;
begin
  select cliente_id into id_erp from erp_enlace_clientes where client_id = p_client;
  if id_erp is not null then return id_erp; end if;

  select * into c from clients where id = p_client;
  ced := nullif(regexp_replace(coalesce(c.cedula, ''), '\D', '', 'g'), '');
  tel := nullif(regexp_replace(coalesce(c.telefono_login, ''), '\D', '', 'g'), '');

  select e.id into id_erp from clientes e
   where (ced is not null and regexp_replace(coalesce(e.cedula, ''), '\D', '', 'g') = ced)
   order by e.id limit 1;
  if id_erp is null and tel is not null then
    select e.id into id_erp from clientes e
     where regexp_replace(coalesce(e.telefono1, ''), '\D', '', 'g') = tel
        or regexp_replace(coalesce(e.telefono2, ''), '\D', '', 'g') = tel
     order by e.id limit 1;
  end if;

  if id_erp is null then
    insert into clientes (cedula, nombre, telefono1, email, direccion, notas, estado_crm)
    values (c.cedula, c.full_name, c.telefono_login, c.correo,
            nullif(concat_ws(', ', c.direccion, c.sector, c.ciudad, c.provincia), ''),
            'Cliente creado desde Pedidos Keraven (' || coalesce(c.client_number, '') || ')', 'cliente')
    returning id into id_erp;
  end if;

  insert into erp_enlace_clientes (client_id, cliente_id) values (p_client, id_erp)
  on conflict (client_id) do update set cliente_id = excluded.cliente_id;
  return id_erp;
end $$;

-- Agrega al ERP los productos de UNA línea del pedido.
create or replace function erp_agregar_linea(p_contrato integer, it order_items)
returns void language plpgsql security definer set search_path = public as $$
declare
  comp   jsonb;
  pid    uuid;
  cant   int;
  id_erp integer;
  nombre text;
  faltan text[] := '{}';
begin
  -- Caja o Duo Pack: entra como los productos que lleva adentro.
  if it.detalle is not null and jsonb_typeof(it.detalle) = 'array' and jsonb_array_length(it.detalle) > 0 then
    for comp in select * from jsonb_array_elements(it.detalle) loop
      pid  := (comp->>'producto_id')::uuid;
      cant := coalesce((comp->>'cantidad')::int, 1);
      select producto_id into id_erp from erp_equivalencias where product_id = pid;
      if id_erp is null then
        faltan := faltan || (cant || '× ' || coalesce(comp->>'nombre', '?'));
      else
        insert into contrato_productos (contrato_id, producto_id, cantidad) values (p_contrato, id_erp, cant);
      end if;
    end loop;
  else
    select producto_id into id_erp from erp_equivalencias where product_id = it.product_id;
    if id_erp is null then
      select p.nombre into nombre from products p where p.id = it.product_id;
      faltan := faltan || (it.cantidad || '× ' || coalesce(nombre, '?'));
    else
      insert into contrato_productos (contrato_id, producto_id, cantidad) values (p_contrato, id_erp, it.cantidad);
    end if;
  end if;

  if array_length(faltan, 1) > 0 then
    update contratos
       set observaciones = concat_ws(E'\n', observaciones, 'Sin equivalencia en el ERP: ' || array_to_string(faltan, ', '))
     where id = p_contrato;
  end if;
end $$;

-- Crea en el ERP la venta de un pedido (si todavía no está). Devuelve su id.
create or replace function erp_enviar_pedido(p_order uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  o       orders;
  id_cli  integer;
  id_con  integer;
  parada  text;
  it      order_items;
begin
  if to_regclass('public.contratos') is null then return null; end if;
  select contrato_id into id_con from erp_enlace_pedidos where order_id = p_order;
  if id_con is not null then return id_con; end if;

  select * into o from orders where id = p_order;
  if o.id is null then return null; end if;
  id_cli := erp_cliente_de(o.client_id);
  select nombre || coalesce(' (' || zona || ')', '') into parada from delivery_stops where id = o.delivery_stop_id;

  insert into contratos (numero_factura, fecha, cliente_id, promotor_id, promotor_nombre, zona, canal,
                         tipo_venta, monto, descuento, neto, saldo, observaciones, estado, origen)
  values (o.order_number, (o.created_at at time zone 'America/Santo_Domingo')::date, id_cli, null, null,
          (select zona from delivery_stops where id = o.delivery_stop_id), 'oficina',
          case when o.payment_method = 'contado' then 'contado' else 'credito' end,
          o.subtotal + o.envio, o.descuento, o.total, o.total,
          concat_ws(E'\n',
            'Pedido hecho por el cliente en la app Pedidos Keraven.',
            'Entrega: ' || case o.delivery_method when 'parada' then 'parada ' || coalesce(parada, '')
                                                  when 'envio' then 'envío a domicilio' else 'recoge en oficina' end,
            case when o.descuento > 0 then 'Descuento: ' || coalesce(o.descuento_nota, '') end,
            nullif(trim(o.observaciones), '')),
          case when o.status = 'cancelado' then 'rechazado'
               when o.status = 'recibido' then 'pendiente' else 'aprobado' end,
          'pedidos')
  returning id into id_con;

  insert into erp_enlace_pedidos (order_id, contrato_id) values (o.id, id_con);
  -- Si el pedido ya tenía productos (envío de pedidos viejos), se pasan ya.
  for it in select * from order_items where order_id = o.id loop
    perform erp_agregar_linea(id_con, it);
  end loop;
  return id_con;
end $$;

-- ── Disparadores: Pedidos → ERP ──────────────────────────────────────────

-- Pedido nuevo → venta pendiente en el Buzón del ERP.
create or replace function erp_al_crear_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.contratos') is null then return new; end if;
  begin
    perform erp_enviar_pedido(new.id);
  exception when others then
    perform erp_anotar_error('crear venta', new.id, sqlerrm);
  end;
  return new;
end $$;
drop trigger if exists trg_erp_crear_pedido on orders;
create trigger trg_erp_crear_pedido after insert on orders
for each row execute function erp_al_crear_pedido();

-- Cada línea que entra al pedido → sus productos en la venta del ERP.
create or replace function erp_al_agregar_linea()
returns trigger language plpgsql security definer set search_path = public as $$
declare id_con integer;
begin
  if to_regclass('public.contratos') is null then return new; end if;
  begin
    select contrato_id into id_con from erp_enlace_pedidos where order_id = new.order_id;
    if id_con is not null then perform erp_agregar_linea(id_con, new); end if;
  exception when others then
    perform erp_anotar_error('agregar producto', new.order_id, sqlerrm);
  end;
  return new;
end $$;
drop trigger if exists trg_erp_linea on order_items;
create trigger trg_erp_linea after insert on order_items
for each row execute function erp_al_agregar_linea();

-- Cambios del pedido → venta del ERP (descuento y cancelación).
create or replace function erp_al_cambiar_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  id_con integer;
  con    record;
begin
  if to_regclass('public.contratos') is null then return new; end if;
  if current_setting('keraven.erp_sincronizando', true) = 'si' then return new; end if;
  begin
    select contrato_id into id_con from erp_enlace_pedidos where order_id = new.id;
    if id_con is null then return new; end if;
    select * into con from contratos where id = id_con for update;

    -- Descuento puesto o quitado después: el saldo cambia lo mismo que el total.
    if new.total is distinct from old.total or new.descuento is distinct from old.descuento then
      update contratos
         set descuento = new.descuento, neto = new.total,
             saldo = greatest(saldo + (new.total - old.total), 0)
       where id = id_con;
    end if;

    -- Cancelado en Pedidos → rechazado (si seguía en el Buzón) o anulado.
    if new.status = 'cancelado' and old.status <> 'cancelado' then
      perform set_config('keraven.erp_sincronizando', 'si', true);
      if con.estado in ('pendiente', 'pendiente_fotos') then
        update contratos set estado = 'rechazado', decidido_en = now(),
               observaciones = concat_ws(E'\n', observaciones, 'Cancelado en Pedidos Keraven.')
         where id = id_con;
      elsif con.estado = 'aprobado' then
        delete from comisiones_semanas where contrato_id = id_con and pagado = false;
        update contratos set estado = 'anulado', anulado_en = now(),
               motivo_anulacion = 'Pedido cancelado en Pedidos Keraven'
         where id = id_con;
      end if;
      perform set_config('keraven.erp_sincronizando', 'no', true);
    end if;
  exception when others then
    perform set_config('keraven.erp_sincronizando', 'no', true);
    perform erp_anotar_error('actualizar venta', new.id, sqlerrm);
  end;
  return new;
end $$;
drop trigger if exists trg_erp_cambiar_pedido on orders;
create trigger trg_erp_cambiar_pedido after update on orders
for each row execute function erp_al_cambiar_pedido();

-- Pago confirmado en Pedidos → abono en el ERP (vía 'pedidos').
create or replace function erp_al_confirmar_pago()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  id_con integer;
  deuda  numeric(12,2);
  m      numeric(12,2);
begin
  if to_regclass('public.contratos') is null then return new; end if;
  if not (new.estado = 'confirmado' and old.estado is distinct from 'confirmado') then return new; end if;
  begin
    select contrato_id into id_con from erp_enlace_pedidos where order_id = new.order_id;
    if id_con is null then return new; end if;
    select greatest(saldo, 0) into deuda from contratos where id = id_con for update;
    m := least(new.monto, deuda);
    insert into contrato_abonos (contrato_id, monto, via, nota)
    values (id_con, m, 'pedidos',
            concat_ws(' · ', 'Pedidos Keraven', initcap(new.metodo), new.cuenta_texto,
                      case when new.referencia is not null then 'Ref. ' || new.referencia end));
    if m > 0 then update contratos set saldo = saldo - m where id = id_con; end if;
  exception when others then
    perform erp_anotar_error('abono', new.order_id, sqlerrm);
  end;
  return new;
end $$;
drop trigger if exists trg_erp_pago on pagos_reportados;
create trigger trg_erp_pago after update on pagos_reportados
for each row execute function erp_al_confirmar_pago();

-- Si el cliente agrega su cédula después, el ERP la recibe también.
create or replace function erp_al_cambiar_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
declare id_erp integer;
begin
  if to_regclass('public.contratos') is null then return new; end if;
  if new.cedula is not distinct from old.cedula or coalesce(new.cedula, '') = '' then return new; end if;
  begin
    select cliente_id into id_erp from erp_enlace_clientes where client_id = new.id;
    if id_erp is not null then
      update clientes set cedula = new.cedula where id = id_erp and coalesce(cedula, '') = '';
    end if;
  exception when others then
    perform erp_anotar_error('cédula', null, sqlerrm);
  end;
  return new;
end $$;
drop trigger if exists trg_erp_cliente on clients;
create trigger trg_erp_cliente after update on clients
for each row execute function erp_al_cambiar_cliente();

-- ── Disparador: ERP → Pedidos ────────────────────────────────────────────
-- Lo que decide el Buzón del ERP se refleja en el pedido del cliente.
create or replace function erp_al_decidir_venta()
returns trigger language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  if new.origen <> 'pedidos' or new.estado is not distinct from old.estado then return new; end if;
  if current_setting('keraven.erp_sincronizando', true) = 'si' then return new; end if;
  select order_id into oid from erp_enlace_pedidos where contrato_id = new.id;
  if oid is null then return new; end if;

  perform set_config('keraven.erp_sincronizando', 'si', true);
  if new.estado = 'aprobado' then
    update orders set status = 'confirmado' where id = oid and status = 'recibido';
  elsif new.estado in ('rechazado', 'anulado') then
    update orders set status = 'cancelado' where id = oid and status not in ('cancelado', 'entregado');
  end if;
  perform set_config('keraven.erp_sincronizando', 'no', true);
  return new;
end $$;

do $$
begin
  if to_regclass('public.contratos') is null then return; end if;
  drop trigger if exists trg_erp_decidir_venta on contratos;
  create trigger trg_erp_decidir_venta after update on contratos
  for each row execute function erp_al_decidir_venta();
end $$;

-- Solo el personal con 'configuracion' manda pedidos viejos a mano.
create or replace function erp_enviar_pedido_manual(p_order uuid)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not tiene_permiso('configuracion') then raise exception 'No tienes permiso'; end if;
  return erp_enviar_pedido(p_order);
end $$;

revoke all on function erp_enviar_pedido(uuid), erp_cliente_de(uuid), erp_anotar_error(text, uuid, text) from public, anon, authenticated;
revoke all on function erp_enviar_pedido_manual(uuid) from public, anon;
grant execute on function erp_enviar_pedido_manual(uuid) to authenticated;
