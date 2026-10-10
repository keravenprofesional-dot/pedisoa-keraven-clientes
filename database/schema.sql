-- ============================================================
-- KERAVEN PROFESIONAL — Esquema de base de datos (Supabase/Postgres)
-- Ejecutar en el SQL Editor de tu proyecto Supabase, en orden.
-- ============================================================

-- 1. PERFILES (extiende auth.users de Supabase)
-- Supabase ya maneja auth.users (incluye login por teléfono + OTP).
-- Este perfil guarda el rol y datos propios de la app.
create type user_role as enum ('administrador', 'despacho', 'clienta');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'clienta',
  full_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. CLIENTES (datos comerciales, separado del perfil de auth)
create sequence client_number_seq start 1;

create table clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  client_number text unique,           -- número de cliente visible, ej. CL-000042 (se genera solo)
  full_name text not null,
  access_code text unique,             -- código de acceso de la clienta (se genera solo)
  cedula_enc text,                     -- guardar cifrada desde la app, nunca en texto plano
  correo text,
  direccion text,
  sector text,
  ciudad text,
  provincia text,
  payment_condition text default 'contado', -- contado | avance | credito
  credit_enabled boolean default false,
  credit_limit numeric(12,2) default 0,
  balance_pendiente numeric(12,2) default 0,
  created_at timestamptz not null default now()
);

-- Asigna el número de cliente automáticamente (mismo patrón que el número de pedido)
create or replace function set_client_number()
returns trigger as $$
begin
  if new.client_number is null then
    new.client_number := 'CL-' || lpad(nextval('client_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_set_client_number
before insert on clients
for each row execute function set_client_number();

-- Generador de código de acceso: 8 caracteres, sin 0/O/1/I para evitar confusión al escribirlo
create or replace function generate_access_code()
returns text as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random()*length(chars)+1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

-- Asigna el código automáticamente si no viene definido, garantizando que sea único
create or replace function set_client_access_code()
returns trigger as $$
declare
  candidate text;
  tries int := 0;
begin
  if new.access_code is null then
    loop
      candidate := generate_access_code();
      exit when not exists (select 1 from clients where access_code = candidate);
      tries := tries + 1;
      if tries > 20 then
        raise exception 'No se pudo generar un código único, intenta de nuevo';
      end if;
    end loop;
    new.access_code := candidate;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_set_client_access_code
before insert on clients
for each row execute function set_client_access_code();

create table client_phones (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  phone text not null,
  is_primary boolean default false
);

create table client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  address text not null,
  sector text,
  is_default boolean default false
);

-- 3. CATÁLOGO
create table categories (
  id uuid primary key default gen_random_uuid(),
  nombre text not null
);

create table products (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categories(id),
  nombre text not null,
  descripcion text,
  precio numeric(12,2) not null,
  disponible boolean default true,
  stock integer default 0,
  foto_url text,
  created_at timestamptz not null default now()
);

-- 4. ENTREGA
create table delivery_stops (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  zona text,
  activo boolean default true
);

-- 5. PEDIDOS + NUMERACIÓN SEGURA (KP-000001, KP-000002…)
create sequence order_number_seq start 1;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,                 -- se llena con trigger, nunca desde el frontend
  client_id uuid not null references clients(id),
  status text not null default 'recibido',  -- recibido|confirmado|preparacion|listo|despachado|en_entrega|entregado|cancelado
  subtotal numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  envio numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text not null default 'contado', -- contado|avance|credito
  avance numeric(12,2) default 0,
  balance numeric(12,2) default 0,
  delivery_method text not null default 'parada', -- parada|envio|recogida|otra
  delivery_stop_id uuid references delivery_stops(id),
  address_id uuid references client_addresses(id),
  observaciones text,
  created_at timestamptz not null default now()
);

-- Función + trigger: asigna order_number de forma atómica al insertar
create or replace function set_order_number()
returns trigger as $$
begin
  new.order_number := 'KP-' || lpad(nextval('order_number_seq')::text, 6, '0');
  return new;
end;
$$ language plpgsql;

create trigger trg_set_order_number
before insert on orders
for each row execute function set_order_number();

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  cantidad integer not null,
  precio_unitario numeric(12,2) not null,
  subtotal numeric(12,2) not null
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status text not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now()
);

-- Registra automáticamente cada cambio de estado
create or replace function log_order_status()
returns trigger as $$
begin
  if (tg_op = 'INSERT') or (old.status is distinct from new.status) then
    insert into order_status_history(order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_log_order_status_insert
after insert on orders
for each row execute function log_order_status();

create trigger trg_log_order_status_update
after update on orders
for each row execute function log_order_status();

-- 6. PAGOS Y CRÉDITO
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  monto numeric(12,2) not null,
  metodo text not null,
  fecha timestamptz not null default now(),
  registrado_por uuid references profiles(id)
);

-- 7. CUENTAS BANCARIAS Y CONFIGURACIÓN
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  banco text not null,
  tipo_cuenta text,
  numero text not null,
  titular text not null,
  moneda text default 'RD$',
  activo boolean default true
);

create table company_settings (
  id int primary key default 1,
  nombre text default 'KERAVEN PROFESIONAL',
  logo_url text,
  telefono text,
  whatsapp text,
  correo text,
  direccion text,
  constraint single_row check (id = 1)
);
insert into company_settings (id) values (1);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table clients enable row level security;
alter table client_phones enable row level security;
alter table client_addresses enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_status_history enable row level security;
alter table payments enable row level security;
alter table products enable row level security;
alter table categories enable row level security;
alter table delivery_stops enable row level security;
alter table bank_accounts enable row level security;
alter table company_settings enable row level security;

-- Función auxiliar: rol del usuario autenticado
create or replace function current_role_name()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable;

-- Perfiles: cada quien ve el suyo; admin ve todos
create policy "profiles_self" on profiles for select using (id = auth.uid() or current_role_name() in ('administrador','despacho'));
create policy "profiles_update_self" on profiles for update using (id = auth.uid());

-- Clientes: la clienta ve solo su propio registro; staff ve todos
create policy "clients_select" on clients for select using (
  profile_id = auth.uid() or current_role_name() in ('administrador','despacho')
);
create policy "clients_staff_write" on clients for insert with check (current_role_name() = 'administrador');
create policy "clients_staff_update" on clients for update using (current_role_name() = 'administrador');

-- Teléfonos y direcciones: la clienta ve/gestiona los suyos; staff ve todos
create policy "phones_select" on client_phones for select using (
  current_role_name() in ('administrador','despacho')
  or client_id in (select id from clients where profile_id = auth.uid())
);
create policy "phones_staff_write" on client_phones for all using (current_role_name() = 'administrador');

create policy "addresses_select" on client_addresses for select using (
  current_role_name() in ('administrador','despacho')
  or client_id in (select id from clients where profile_id = auth.uid())
);
create policy "addresses_staff_write" on client_addresses for all using (current_role_name() = 'administrador');

-- Catálogo y config: lectura pública para autenticados, escritura solo admin
create policy "products_read" on products for select using (auth.role() = 'authenticated');
create policy "products_write" on products for all using (current_role_name() = 'administrador');
create policy "categories_read" on categories for select using (auth.role() = 'authenticated');
create policy "categories_write" on categories for all using (current_role_name() = 'administrador');
create policy "stops_read" on delivery_stops for select using (auth.role() = 'authenticated');
create policy "bank_read" on bank_accounts for select using (auth.role() = 'authenticated');
create policy "settings_read" on company_settings for select using (auth.role() = 'authenticated');

-- Pedidos: la clienta solo ve/crea los suyos (vía su client_id); staff ve todos
create policy "orders_select" on orders for select using (
  current_role_name() in ('administrador','despacho')
  or client_id in (select id from clients where profile_id = auth.uid())
);
create policy "orders_insert" on orders for insert with check (
  client_id in (select id from clients where profile_id = auth.uid())
  or current_role_name() in ('administrador','despacho')
);
create policy "orders_update_staff" on orders for update using (
  current_role_name() in ('administrador','despacho')
);

create policy "order_items_select" on order_items for select using (
  order_id in (select id from orders)
);
create policy "order_items_insert" on order_items for insert with check (true);

create policy "history_select" on order_status_history for select using (true);
create policy "payments_select" on payments for select using (
  current_role_name() in ('administrador','despacho')
  or order_id in (select id from orders where client_id in (select id from clients where profile_id = auth.uid()))
);
create policy "payments_staff_write" on payments for insert with check (current_role_name() in ('administrador','despacho'));

-- ============================================================
-- DATOS DE PRUEBA (opcional — borra esta sección en producción)
-- ============================================================
insert into categories (nombre) values ('Shampoo'), ('Tratamientos'), ('Herramientas');
insert into delivery_stops (nombre, zona) values ('Parada Centro', 'Zona 1'), ('Parada Norte', 'Zona 2');
