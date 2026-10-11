-- Separa las cajas de un solo sabor de las mezcladas, para que no estén
-- las 56 en la misma pestaña.
--   duo_pack        → 16 unidades de un solo sabor
--   duo_pack_mixto  → 8 y 8 de dos sabores
alter table products drop constraint if exists products_tipo_valido;
alter table products add constraint products_tipo_valido
  check (tipo in ('simple', 'duo_pack', 'duo_pack_mixto', 'duo_kit', 'linea'));

-- Las que ya existen: si llevan dos productos distintos adentro, son mixtas.
update products p set tipo = 'duo_pack_mixto'
 where p.tipo = 'duo_pack'
   and (select count(*) from product_items i where i.product_id = p.id) > 1;
