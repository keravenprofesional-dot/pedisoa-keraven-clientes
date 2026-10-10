-- ============================================================
-- 1. CATÁLOGO EN PREPARACIÓN
--    Mientras esté apagado, los clientes NO ven ningún producto.
--    El personal sí, para poder armarlo con calma.
-- ============================================================
alter table company_settings add column if not exists catalogo_publicado boolean not null default false;

-- ============================================================
-- 2. LÍNEAS (Coco, Cacao, Jengibre, Golden Black…)
--    Atraviesan las secciones: la línea de Coco tiene su shampoo,
--    su tratamiento y su mascarilla.
-- ============================================================
create table if not exists lineas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  descripcion text,
  foto_url    text,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);
alter table products add column if not exists linea_id uuid references lineas(id) on delete set null;

-- ============================================================
-- 3. DUO PACK y DUO KIT
--    Son productos que por dentro llevan otros productos. Al ser
--    productos normales ya tienen precio, foto, disponibilidad y
--    se piden igual que todo lo demás.
-- ============================================================
alter table products add column if not exists tipo text not null default 'simple';
alter table products drop constraint if exists products_tipo_valido;
alter table products add constraint products_tipo_valido
  check (tipo in ('simple', 'duo_pack', 'duo_kit'));

create table if not exists product_items (
  product_id    uuid not null references products(id) on delete cascade,
  componente_id uuid not null references products(id) on delete restrict,
  cantidad      int  not null default 1 check (cantidad between 1 and 99),
  primary key (product_id, componente_id),
  constraint no_se_contiene_a_si_mismo check (product_id <> componente_id)
);

-- Un combo no puede llevar otro combo adentro: se vuelve un enredo.
create or replace function combo_sin_combos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select tipo from products where id = new.product_id) = 'simple' then
    raise exception 'Solo un Duo Pack o un Duo Kit puede llevar productos adentro';
  end if;
  if (select tipo from products where id = new.componente_id) <> 'simple' then
    raise exception 'Un Duo Pack o Duo Kit no puede llevar otro combo adentro';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_combo_sin_combos on product_items;
create trigger trg_combo_sin_combos before insert or update on product_items
for each row execute function combo_sin_combos();

-- ============================================================
-- 4. QUIÉN VE Y QUIÉN TOCA
-- ============================================================
alter table lineas        enable row level security;
alter table product_items enable row level security;

create policy lineas_leer     on lineas for select to authenticated using (es_usuario_activo());
create policy lineas_escribir on lineas for all to authenticated
  using (tiene_permiso('productos')) with check (tiene_permiso('productos'));

create policy items_combo_leer on product_items for select to authenticated using (es_usuario_activo());
create policy items_combo_escribir on product_items for all to authenticated
  using (tiene_permiso('productos')) with check (tiene_permiso('productos'));

-- El catálogo sólo se les muestra a los clientes cuando está publicado.
drop policy if exists products_leer on products;
create policy products_leer on products for select to authenticated using (
  es_usuario_activo() and (
    es_personal() or coalesce((select catalogo_publicado from company_settings where id = 1), false)
  )
);
drop policy if exists categories_leer on categories;
create policy categories_leer on categories for select to authenticated using (
  es_usuario_activo() and (
    es_personal() or coalesce((select catalogo_publicado from company_settings where id = 1), false)
  )
);

-- Publicar o esconder el catálogo es parte de Configuración.
-- (company_settings ya lo permite con el permiso 'configuracion')
