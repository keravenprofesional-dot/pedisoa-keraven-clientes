-- Puente con el ERP, dos mejoras:
--
-- 1) Cuando se pone (o se cambia) un enlace en "Enlace con el ERP", las ventas
--    del ERP que ya llegaron con ese producto como nota ("Sin equivalencia…")
--    se completan solas: se rehacen sus productos con los enlaces de ahora.
--    No se tocan las ventas rechazadas o anuladas.
-- 2) Al ERP solo pasa una cédula válida (11 números). Una cédula de relleno
--    como "000000000" ya no se copia ni se usa para buscar al cliente.

-- Rehace los productos de una venta del ERP desde su pedido
create or replace function erp_rehacer_productos(p_contrato integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  oid uuid;
  it  order_items;
begin
  select order_id into oid from erp_enlace_pedidos where contrato_id = p_contrato;
  if oid is null then return; end if;
  delete from contrato_productos where contrato_id = p_contrato;
  update contratos
     set observaciones = nullif(btrim(regexp_replace(coalesce(observaciones, ''), '\n?Sin equivalencia en el ERP:[^\n]*', '', 'g'), E'\n '), '')
   where id = p_contrato;
  for it in select * from order_items where order_id = oid loop
    perform erp_agregar_linea(p_contrato, it);
  end loop;
end $$;

create or replace function erp_al_cambiar_equivalencia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c integer;
begin
  if to_regclass('public.contratos') is null then return new; end if;
  begin
    for c in
      select distinct e.contrato_id
        from erp_enlace_pedidos e
        join contratos k on k.id = e.contrato_id
        join order_items i on i.order_id = e.order_id
       where k.estado not in ('rechazado', 'anulado')
         and (i.product_id = new.product_id
              or (jsonb_typeof(i.detalle) = 'array'
                  and i.detalle @> jsonb_build_array(jsonb_build_object('producto_id', new.product_id::text))))
    loop
      perform erp_rehacer_productos(c);
    end loop;
  exception when others then
    perform erp_anotar_error('completar productos', null, sqlerrm);
  end;
  return new;
end $$;

do $$
begin
  if to_regclass('public.erp_equivalencias') is null then return; end if;
  drop trigger if exists trg_erp_equivalencia on erp_equivalencias;
  create trigger trg_erp_equivalencia after insert or update on erp_equivalencias
  for each row execute function erp_al_cambiar_equivalencia();
end $$;

revoke all on function erp_rehacer_productos(integer) from public, anon, authenticated;

-- El cliente del ERP que corresponde a un cliente de Pedidos (lo crea si no hay).
-- Igual que antes, pero solo con cédula válida.
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
  ced := cedula_formato(c.cedula);   -- null si no tiene 11 números
  tel := nullif(regexp_replace(coalesce(c.telefono_login, ''), '\D', '', 'g'), '');

  if ced is not null then
    select e.id into id_erp from clientes e
     where cedula_formato(e.cedula) = ced
     order by e.id limit 1;
  end if;
  if id_erp is null and tel is not null then
    select e.id into id_erp from clientes e
     where regexp_replace(coalesce(e.telefono1, ''), '\D', '', 'g') = tel
        or regexp_replace(coalesce(e.telefono2, ''), '\D', '', 'g') = tel
     order by e.id limit 1;
  end if;

  if id_erp is null then
    insert into clientes (cedula, nombre, telefono1, email, direccion, notas, estado_crm)
    values (ced, c.full_name, c.telefono_login, c.correo,
            nullif(concat_ws(', ', c.direccion, c.sector, c.ciudad, c.provincia), ''),
            'Cliente creado desde Pedidos Keraven (' || coalesce(c.client_number, '') || ')', 'cliente')
    returning id into id_erp;
  elsif ced is not null then
    -- Ya estaba en el ERP sin cédula: se le pone
    update clientes set cedula = ced where id = id_erp and coalesce(btrim(cedula), '') = '';
  end if;

  insert into erp_enlace_clientes (client_id, cliente_id) values (p_client, id_erp)
  on conflict (client_id) do update set cliente_id = excluded.cliente_id;
  return id_erp;
end $$;
revoke all on function erp_cliente_de(uuid) from public, anon, authenticated;
