-- Cada clienta recibe siempre en la misma parada de la ruta. Guardarla en su
-- ficha evita preguntárselo en cada pedido: el checkout ya la trae puesta.
alter table clients add column if not exists delivery_stop_id uuid references delivery_stops(id) on delete set null;

-- Punto de referencia de la parada (frente a la farmacia, al lado del parque…).
alter table delivery_stops add column if not exists referencia text;
