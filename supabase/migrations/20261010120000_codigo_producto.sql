-- Código corto "hablado" por producto (SH-BAN-32 = Shampoo Banana 32 oz).
-- Sirve para buscarlo rápido y para dictarlo por teléfono.
alter table products add column if not exists codigo text;

-- No puede haber dos productos con el mismo código (sin importar mayúsculas).
create unique index if not exists products_codigo_unico
  on products (upper(codigo)) where codigo is not null;

-- Búsqueda por nombre o código desde la app.
create index if not exists products_nombre_idx on products (lower(nombre));
