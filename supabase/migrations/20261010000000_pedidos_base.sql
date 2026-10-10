-- ============================================================
-- KERAVEN PROFESIONAL — Programa de pedidos de clientas
-- Esquema completo (Supabase/Postgres). Reemplaza database/schema.sql.
--
-- Quién es quién:
--   * Supremo usuario: configura TODOS los usuarios del personal (incluidos
--     los super usuarios), crea roles y les asigna permisos. Solo él.
--   * Personal con rol (ej. "Super usuario"): hace lo que su rol permita.
--   * Clienta: entra con su teléfono + código de acceso; solo ve lo suyo.
--
-- Reglas de seguridad clave:
--   * Nadie puede cambiarse su propio rol ni hacerse supremo: los perfiles
--     solo se escriben desde la función de servidor `admin-usuarios`.
--   * El precio, el total y el crédito de un pedido los calcula la base de
--     datos (función crear_pedido), nunca el celular de la clienta.
-- ============================================================

-- ---------- 1. ROLES Y PERMISOS ----------------------------------------

create table pedidos_permisos (
  clave       text primary key,
  descripcion text not null,
  orden       int  not null default 0
);

insert into pedidos_permisos (clave, descripcion, orden) values
  ('ver_pedidos',          'Ver los pedidos de todas las clientas',              10),
  ('cambiar_estado',       'Cambiar el estado de los pedidos',                    20),
  ('despacho',             'Preparar y despachar pedidos',                        30),
  ('ver_clientas',         'Ver la lista de clientas',                            40),
  ('crear_clientas',       'Crear clientas y darles su código de acceso',         50),
  ('editar_clientas',      'Editar datos y crédito de clientas, nuevo código',    60),
  ('registrar_pagos',      'Registrar pagos de las clientas',                     70),
  ('productos',            'Crear y editar productos, precios y existencia',      80),
  ('configuracion',        'Datos de la empresa, cuentas de banco y paradas',     90),
  ('ver_resumen',          'Ver el resumen de ventas y balances',                100);

create table pedidos_roles (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  descripcion text,
  creado_en   timestamptz not null default now()
);

create table pedidos_rol_permisos (
  rol_id  uuid not null references pedidos_roles(id) on delete cascade,
  permiso text not null references pedidos_permisos(clave) on delete cascade,
  primary key (rol_id, permiso)
);

-- Rol inicial pedido por el dueño: crea clientas, ve y mueve pedidos.
with r as (
  insert into pedidos_roles (nombre, descripcion)
  values ('Super usuario', 'Crea clientas, ve los pedidos de todas y cambia su estado')
  returning id
)
insert into pedidos_rol_permisos (rol_id, permiso)
select r.id, p from r, unnest(array['ver_pedidos','cambiar_estado','ver_clientas','crear_clientas']) p;

-- ---------- 2. PERFILES (uno por usuario de Supabase Auth) -------------

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('personal','clienta')),
  es_supremo  boolean not null default false,
  rol_id      uuid references pedidos_roles(id) on delete set null,
  usuario     text unique,           -- solo personal: con esto entra (ej. "manuel")
  telefono    text,                  -- solo personal: su "contraseña" de entrada
  full_name   text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint supremo_es_personal check (not es_supremo or tipo = 'personal'),
  constraint usuario_en_minuscula check (usuario is null or usuario = lower(usuario))
);
-- Solo puede existir UN supremo usuario.
create unique index un_solo_supremo on profiles (es_supremo) where es_supremo;

-- ---------- 3. FUNCIONES DE PERMISO -------------------------------------
-- security definer: leen profiles sin pasar por sus propias reglas (evita
-- el bucle infinito de la versión anterior).

create or replace function es_supremo()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select es_supremo and active from profiles where id = auth.uid()), false);
$$;

create or replace function tiene_permiso(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select pr.active and pr.tipo = 'personal' and (
      pr.es_supremo or exists (
        select 1 from pedidos_rol_permisos rp where rp.rol_id = pr.rol_id and rp.permiso = p
      ))
    from profiles pr where pr.id = auth.uid()
  ), false);
$$;

create or replace function es_personal()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active and tipo = 'personal' from profiles where id = auth.uid()), false);
$$;

-- Cualquier cuenta registrada por Keraven (personal o clienta) y activa.
-- Una cuenta creada por fuera (sin perfil) no ve nada.
create or replace function es_usuario_activo()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active from profiles where id = auth.uid()), false);
$$;

-- Lista de permisos del usuario conectado (la usa la app para el menú).
create or replace function mis_permisos()
returns setof text language sql stable security definer set search_path = public as $$
  select clave from pedidos_permisos where tiene_permiso(clave);
$$;

-- ---------- 4. CLIENTAS -------------------------------------------------

create sequence client_number_seq start 1;

create table clients (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null unique references profiles(id) on delete cascade,
  client_number      text unique,
  full_name          text not null,
  telefono_login     text not null unique,  -- con este teléfono entra (solo dígitos)
  correo             text,
  cedula             text,
  direccion          text,
  sector             text,
  ciudad             text,
  provincia          text,
  payment_condition  text not null default 'contado' check (payment_condition in ('contado','avance','credito')),
  credit_enabled     boolean not null default false,
  credit_limit       numeric(12,2) not null default 0 check (credit_limit >= 0),
  balance_pendiente  numeric(12,2) not null default 0,
  creado_por         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);

create or replace function set_client_number()
returns trigger language plpgsql as $$
begin
  if new.client_number is null then
    new.client_number := 'CL-' || lpad(nextval('client_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
create trigger trg_set_client_number before insert on clients
for each row execute function set_client_number();

create table client_phones (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  phone      text not null,
  is_primary boolean not null default false
);

create table client_addresses (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  address    text not null,
  sector     text,
  is_default boolean not null default false
);

-- Traduce lo que escribe la persona en la pantalla de entrada al correo
-- interno de Supabase Auth. No revela nada: los correos internos son
-- inventados (ej. cl-000042@clientas.keraven.local).
create or replace function correo_de_entrada(identificador text, es_clienta boolean)
returns text language sql stable security definer set search_path = public as $$
  select case
    when es_clienta then (
      select u.email from clients c join auth.users u on u.id = c.profile_id
      where c.telefono_login = regexp_replace(identificador, '\D', '', 'g')
    )
    else (
      select u.email from profiles p join auth.users u on u.id = p.id
      where p.tipo = 'personal' and p.usuario = lower(trim(identificador))
    )
  end;
$$;
revoke all on function correo_de_entrada(text, boolean) from public;
grant execute on function correo_de_entrada(text, boolean) to anon, authenticated;

-- ---------- 5. CATÁLOGO Y ENTREGA ---------------------------------------

create table categories (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

create table products (
  id           uuid primary key default gen_random_uuid(),
  categoria_id uuid references categories(id) on delete set null,
  nombre       text not null,
  descripcion  text,
  precio       numeric(12,2) not null check (precio >= 0),
  disponible   boolean not null default true,
  stock        integer not null default 0,
  foto_url     text,
  created_at   timestamptz not null default now()
);

create table delivery_stops (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  zona   text,
  activo boolean not null default true
);

-- ---------- 6. PEDIDOS --------------------------------------------------

create sequence order_number_seq start 1;

create table orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text unique,
  client_id        uuid not null references clients(id),
  status           text not null default 'recibido' check (status in
                     ('recibido','confirmado','preparacion','listo','despachado','en_entrega','entregado','cancelado')),
  subtotal         numeric(12,2) not null default 0,
  descuento        numeric(12,2) not null default 0,
  envio            numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  payment_method   text not null default 'contado' check (payment_method in ('contado','avance','credito')),
  avance           numeric(12,2) not null default 0,
  balance          numeric(12,2) not null default 0,
  delivery_method  text not null default 'parada' check (delivery_method in ('parada','envio','recogida')),
  delivery_stop_id uuid references delivery_stops(id),
  address_id       uuid references client_addresses(id),
  observaciones    text,
  created_at       timestamptz not null default now()
);

create or replace function set_order_number()
returns trigger language plpgsql as $$
begin
  new.order_number := 'KP-' || lpad(nextval('order_number_seq')::text, 6, '0');
  return new;
end;
$$;
create trigger trg_set_order_number before insert on orders
for each row execute function set_order_number();

create table order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  product_id      uuid not null references products(id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null,
  subtotal        numeric(12,2) not null
);

create table order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  status     text not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now()
);

create or replace function log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') or (old.status is distinct from new.status) then
    insert into order_status_history(order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;
create trigger trg_log_order_status_insert after insert on orders
for each row execute function log_order_status();
create trigger trg_log_order_status_update after update on orders
for each row execute function log_order_status();

-- El personal solo puede cambiar el ESTADO de un pedido; montos, clienta y
-- fecha quedan fijos. Al cancelar, se devuelve la existencia y el balance.
-- Excepciones: mantenimiento interno (sin usuario) y registrar_pago(), que
-- baja el balance marcando keraven.pago_en_curso dentro de su transacción.
create or replace function proteger_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_setting('keraven.pago_en_curso', true) = 'si' then
    return new;
  end if;
  if (new.client_id, new.subtotal, new.descuento, new.envio, new.total, new.payment_method,
      new.avance, new.balance, new.created_at, new.order_number)
     is distinct from
     (old.client_id, old.subtotal, old.descuento, old.envio, old.total, old.payment_method,
      old.avance, old.balance, old.created_at, old.order_number) then
    raise exception 'Solo se puede cambiar el estado del pedido';
  end if;
  if old.status = 'cancelado' and new.status <> 'cancelado' then
    raise exception 'Un pedido cancelado no se puede reabrir; la clienta debe hacer uno nuevo';
  end if;
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    update products p set stock = p.stock + oi.cantidad
      from order_items oi where oi.order_id = new.id and oi.product_id = p.id;
    update clients set balance_pendiente = greatest(balance_pendiente - old.balance, 0)
      where id = new.client_id;
  end if;
  return new;
end;
$$;
create trigger trg_proteger_pedido before update on orders
for each row execute function proteger_pedido();

-- Crea el pedido de la clienta conectada. Los precios salen de la tabla de
-- productos; el crédito se valida contra lo que el personal le aprobó.
-- items: [{"product_id": "...", "cantidad": 2}, ...]
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

  -- Bloquea los productos en orden fijo para que dos pedidos simultáneos no
  -- vendan la misma existencia dos veces.
  perform 1 from products where id in (select (x->>'product_id')::uuid from jsonb_array_elements(items) x)
    order by id for update;

  for it in select * from jsonb_array_elements(items) loop
    cant := (it->>'cantidad')::int;
    if cant is null or cant < 1 or cant > 999 then raise exception 'Cantidad no válida'; end if;
    select * into prod from products where id = (it->>'product_id')::uuid;
    if prod.id is null or not prod.disponible then
      raise exception 'Un producto del carrito ya no está disponible';
    end if;
    if prod.stock < cant then
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
    update products set stock = stock - cant where id = prod.id;
  end loop;

  update clients set balance_pendiente = balance_pendiente + v_balance where id = cli.id;
  return ord;
end;
$$;
revoke all on function crear_pedido(jsonb, text, uuid, uuid, text, numeric, text) from public;
grant execute on function crear_pedido(jsonb, text, uuid, uuid, text, numeric, text) to authenticated;

-- ---------- 7. PAGOS ----------------------------------------------------

create table payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id),
  monto          numeric(12,2) not null check (monto > 0),
  metodo         text not null,
  fecha          timestamptz not null default now(),
  registrado_por uuid references profiles(id)
);

create or replace function registrar_pago(p_order_id uuid, p_monto numeric, p_metodo text)
returns payments language plpgsql security definer set search_path = public as $$
declare ord orders; pago payments;
begin
  if not tiene_permiso('registrar_pagos') then raise exception 'No tienes permiso para registrar pagos'; end if;
  select * into ord from orders where id = p_order_id for update;
  if ord.id is null then raise exception 'Pedido no encontrado'; end if;
  if ord.status = 'cancelado' then raise exception 'El pedido está cancelado'; end if;
  if p_monto is null or p_monto <= 0 or p_monto > ord.balance then
    raise exception 'El pago debe ser mayor que 0 y no mayor que el balance (%)', ord.balance;
  end if;
  insert into payments (order_id, monto, metodo, registrado_por)
  values (p_order_id, p_monto, coalesce(nullif(trim(p_metodo), ''), 'efectivo'), auth.uid())
  returning * into pago;
  perform set_config('keraven.pago_en_curso', 'si', true);
  update orders set balance = balance - p_monto where id = p_order_id;
  perform set_config('keraven.pago_en_curso', 'no', true);
  update clients set balance_pendiente = greatest(balance_pendiente - p_monto, 0) where id = ord.client_id;
  return pago;
end;
$$;
revoke all on function registrar_pago(uuid, numeric, text) from public;
grant execute on function registrar_pago(uuid, numeric, text) to authenticated;

-- ---------- 8. CONFIGURACIÓN --------------------------------------------

create table bank_accounts (
  id          uuid primary key default gen_random_uuid(),
  banco       text not null,
  tipo_cuenta text,
  numero      text not null,
  titular     text not null,
  moneda      text not null default 'RD$',
  activo      boolean not null default true
);

create table company_settings (
  id        int primary key default 1,
  nombre    text default 'KERAVEN PROFESIONAL',
  logo_url  text,
  telefono  text,
  whatsapp  text,
  correo    text,
  direccion text,
  constraint single_row check (id = 1)
);
insert into company_settings (id) values (1);

-- ============================================================
-- REGLAS DE ACCESO (RLS)
-- ============================================================
alter table pedidos_permisos     enable row level security;
alter table pedidos_roles        enable row level security;
alter table pedidos_rol_permisos enable row level security;
alter table profiles             enable row level security;
alter table clients              enable row level security;
alter table client_phones        enable row level security;
alter table client_addresses     enable row level security;
alter table categories           enable row level security;
alter table products             enable row level security;
alter table delivery_stops       enable row level security;
alter table orders               enable row level security;
alter table order_items          enable row level security;
alter table order_status_history enable row level security;
alter table payments             enable row level security;
alter table bank_accounts        enable row level security;
alter table company_settings     enable row level security;

-- Roles y permisos: el personal los lee (para su menú); solo el supremo escribe.
create policy permisos_leer on pedidos_permisos for select to authenticated using (es_personal());
create policy roles_leer    on pedidos_roles    for select to authenticated using (es_personal());
create policy roles_supremo on pedidos_roles    for all    to authenticated using (es_supremo()) with check (es_supremo());
create policy rp_leer       on pedidos_rol_permisos for select to authenticated using (es_personal());
create policy rp_supremo    on pedidos_rol_permisos for all    to authenticated using (es_supremo()) with check (es_supremo());

-- Perfiles: cada quien lee el suyo; el supremo lee todos; quien ve clientas
-- lee los perfiles de clientas. NADIE los escribe desde la app: solo la
-- función de servidor admin-usuarios (que valida permisos).
create policy profiles_leer on profiles for select to authenticated using (
  id = auth.uid() or es_supremo() or (tipo = 'clienta' and tiene_permiso('ver_clientas'))
);

-- Clientas
create policy clients_leer on clients for select to authenticated using (
  profile_id = auth.uid() or tiene_permiso('ver_clientas') or tiene_permiso('ver_pedidos')
);
create policy phones_leer on client_phones for select to authenticated using (
  tiene_permiso('ver_clientas') or tiene_permiso('ver_pedidos')
  or client_id in (select id from clients where profile_id = auth.uid())
);
create policy addresses_leer on client_addresses for select to authenticated using (
  tiene_permiso('ver_clientas') or tiene_permiso('ver_pedidos')
  or client_id in (select id from clients where profile_id = auth.uid())
);

-- Catálogo: lo leen todos los conectados; lo escribe quien tenga "productos".
create policy categories_leer    on categories for select to authenticated using (es_usuario_activo());
create policy categories_escribir on categories for all to authenticated using (tiene_permiso('productos')) with check (tiene_permiso('productos'));
create policy products_leer      on products for select to authenticated using (es_usuario_activo());
create policy products_escribir  on products for all to authenticated using (tiene_permiso('productos')) with check (tiene_permiso('productos'));

-- Paradas, bancos y empresa: lectura para conectados; escritura con "configuracion".
create policy stops_leer     on delivery_stops for select to authenticated using (es_usuario_activo());
create policy stops_escribir on delivery_stops for all to authenticated using (tiene_permiso('configuracion')) with check (tiene_permiso('configuracion'));
create policy bank_leer      on bank_accounts for select to authenticated using (es_usuario_activo());
create policy bank_escribir  on bank_accounts for all to authenticated using (tiene_permiso('configuracion')) with check (tiene_permiso('configuracion'));
create policy settings_leer  on company_settings for select to authenticated using (es_usuario_activo());
create policy settings_escribir on company_settings for update to authenticated using (tiene_permiso('configuracion')) with check (tiene_permiso('configuracion'));

-- Pedidos: la clienta ve los suyos; el personal con permiso ve todos.
-- Nadie inserta directo: la clienta usa crear_pedido().
create policy orders_leer on orders for select to authenticated using (
  tiene_permiso('ver_pedidos') or tiene_permiso('despacho')
  or client_id in (select id from clients where profile_id = auth.uid())
);
create policy orders_estado on orders for update to authenticated
  using (tiene_permiso('cambiar_estado') or tiene_permiso('despacho'))
  with check (tiene_permiso('cambiar_estado') or tiene_permiso('despacho'));

create policy items_leer on order_items for select to authenticated using (
  order_id in (select id from orders)   -- hereda la regla de orders
);
create policy history_leer on order_status_history for select to authenticated using (
  order_id in (select id from orders)
);
create policy payments_leer on payments for select to authenticated using (
  order_id in (select id from orders)
);

-- La clienta no debe poder leer el código interno de nadie: no se guarda en
-- texto. Ella solo ve su código el día que se lo entregan.

-- ============================================================
-- DATOS INICIALES (puedes cambiarlos desde la app)
-- ============================================================
insert into categories (nombre) values ('Shampoo'), ('Acondicionador'), ('Mascarilla'), ('Tratamientos');
insert into delivery_stops (nombre, zona) values ('Parada Centro', 'Zona 1');
