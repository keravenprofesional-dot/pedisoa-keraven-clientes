-- ============================================================
-- LAS LÍNEAS AHORA SE VENDEN
--
-- Antes una línea era solo una etiqueta para agrupar. Ahora es un
-- producto más: tiene precio, foto, descripción y se puede pedir, igual
-- que un Duo Kit. Y sigue sirviendo para saber qué productos la componen.
--
-- Se mudan las líneas que ya existían a la tabla de productos CONSERVANDO
-- SU MISMO id, para que nada de lo ya guardado se pierda.
-- ============================================================

-- 1. "linea" pasa a ser un tipo de producto más
alter table products drop constraint if exists products_tipo_valido;
alter table products add constraint products_tipo_valido
  check (tipo in ('simple', 'duo_pack', 'duo_kit', 'linea'));

-- 2. Mudar las líneas existentes (mismo id) a productos
insert into products (id, nombre, descripcion, foto_url, precio, tipo, disponible, stock)
select l.id, l.nombre, l.descripcion, l.foto_url, 0, 'linea', true, null
  from lineas l
 where not exists (select 1 from products p where p.id = l.id);

-- 3. products.linea_id deja de apuntar a la tabla vieja y apunta al producto-línea
alter table products drop constraint if exists products_linea_id_fkey;
alter table products add constraint products_linea_id_fkey
  foreign key (linea_id) references products(id) on delete set null;
alter table products drop constraint if exists linea_no_se_apunta_a_si_misma;
alter table products add constraint linea_no_se_apunta_a_si_misma
  check (linea_id is null or linea_id <> id);

-- 4. La tabla vieja ya no hace falta
drop table if exists lineas;

-- 5. Una línea también puede llevar productos adentro (lo que se vende junto)
create or replace function combo_sin_combos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select tipo from products where id = new.product_id) = 'simple' then
    raise exception 'Solo un Duo Pack, un Duo Kit o una Línea puede llevar productos adentro';
  end if;
  if (select tipo from products where id = new.componente_id) <> 'simple' then
    raise exception 'Un conjunto no puede llevar otro conjunto adentro';
  end if;
  return new;
end;
$$;

-- 6. Una línea sin precio todavía no se vende (igual que cualquier producto):
--    el catálogo solo muestra lo que tiene precio mayor que cero.
--    No hace falta tocar crear_pedido: una línea con productos adentro ya se
--    comporta como una caja de lista fija.
