-- CONFIRMACIÓN DE PAGO con la cuenta bancaria.
--
-- Un pedido de contado se guarda con balance 0, así que registrar_pago()
-- (que baja el balance de crédito) no sirve para él. Este es el registro
-- de "cuánto se pagó, cómo y a qué cuenta", para cualquier pedido:
--   1) El cliente reporta "ya pagué": monto, transferencia/depósito/efectivo,
--      la cuenta de Keraven a la que pagó y el número de referencia.
--   2) El personal con 'registrar_pagos' lo confirma o lo rechaza.
--      (Si el que lo registra es del personal, queda confirmado de una vez.)
--   3) Confirmado, el pedido muestra a qué cuenta se pagó. Si el pedido
--      tenía balance de crédito, también lo baja (igual que registrar_pago).
-- La cuenta se copia en texto al reportar: si luego cambian o borran la
-- cuenta, el pago sigue diciendo a cuál se hizo.

create table if not exists pagos_reportados (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  monto          numeric(12,2) not null check (monto > 0),
  metodo         text not null check (metodo in ('transferencia','deposito','efectivo')),
  cuenta_id      uuid references bank_accounts(id) on delete set null,
  cuenta_texto   text,
  referencia     text,
  estado         text not null default 'reportado' check (estado in ('reportado','confirmado','rechazado')),
  nota           text,
  reportado_por  uuid references profiles(id),
  confirmado_por uuid references profiles(id),
  confirmado_en  timestamptz,
  payment_id     uuid references payments(id),
  creado_en      timestamptz not null default now()
);
create index if not exists pagos_rep_pedido on pagos_reportados (order_id);
create index if not exists pagos_rep_estado on pagos_reportados (estado, creado_en);

-- Los pagos de crédito también guardan la cuenta, para el historial.
alter table payments add column if not exists cuenta_texto text;
alter table payments add column if not exists referencia   text;

alter table pagos_reportados enable row level security;
revoke insert, update, delete on pagos_reportados from anon, authenticated;
drop policy if exists pagos_rep_leer on pagos_reportados;
-- Lo ve quien ve el pedido (el cliente los suyos; el personal con permiso).
create policy pagos_rep_leer on pagos_reportados for select to authenticated using (
  order_id in (select id from orders) or tiene_permiso('registrar_pagos')
);

-- Confirmar o rechazar (uso interno y del personal).
create or replace function confirmar_pago(p_id uuid, p_estado text, p_nota text default null)
returns pagos_reportados language plpgsql security definer set search_path = public as $$
declare
  rep   pagos_reportados;
  ord   orders;
  abono numeric(12,2);
  pago  payments;
begin
  if not tiene_permiso('registrar_pagos') then raise exception 'No tienes permiso para confirmar pagos'; end if;
  if p_estado not in ('confirmado', 'rechazado') then raise exception 'Estado no válido'; end if;
  select * into rep from pagos_reportados where id = p_id for update;
  if rep.id is null then raise exception 'Pago no encontrado'; end if;
  if rep.estado <> 'reportado' then raise exception 'Este pago ya fue %', rep.estado; end if;
  if p_estado = 'rechazado' and coalesce(trim(p_nota), '') = '' then
    raise exception 'Escribe por qué se rechaza (el cliente lo verá)';
  end if;

  if p_estado = 'confirmado' then
    select * into ord from orders where id = rep.order_id for update;
    -- Si el pedido debía algo (crédito/avance), el pago lo baja.
    abono := least(rep.monto, greatest(ord.balance, 0));
    if abono > 0 then
      insert into payments (order_id, monto, metodo, registrado_por, cuenta_texto, referencia)
      values (ord.id, abono, rep.metodo, auth.uid(), rep.cuenta_texto, rep.referencia)
      returning * into pago;
      perform set_config('keraven.pago_en_curso', 'si', true);
      update orders set balance = balance - abono where id = ord.id;
      perform set_config('keraven.pago_en_curso', 'no', true);
      update clients set balance_pendiente = greatest(balance_pendiente - abono, 0) where id = ord.client_id;
    end if;
  end if;

  update pagos_reportados
     set estado = p_estado, nota = nullif(left(trim(coalesce(p_nota, '')), 300), ''),
         confirmado_por = auth.uid(), confirmado_en = now(), payment_id = pago.id
   where id = p_id
  returning * into rep;
  return rep;
end $$;

-- Reportar un pago. Lo usa el cliente (queda "reportado") o el personal
-- con permiso (queda "confirmado" de una vez).
create or replace function reportar_pago(
  p_order_id   uuid,
  p_monto      numeric,
  p_metodo     text,
  p_cuenta_id  uuid,
  p_referencia text
) returns pagos_reportados language plpgsql security definer set search_path = public as $$
declare
  ord       orders;
  cta       bank_accounts;
  es_staff  boolean := tiene_permiso('registrar_pagos');
  ya        numeric(12,2);
  rep       pagos_reportados;
begin
  select * into ord from orders where id = p_order_id for update;
  if ord.id is null then raise exception 'Pedido no encontrado'; end if;
  if not es_staff and not exists (
    select 1 from clients c join profiles p on p.id = c.profile_id
     where c.id = ord.client_id and c.profile_id = auth.uid() and p.active
  ) then
    raise exception 'Solo puedes reportar pagos de tus pedidos';
  end if;
  if ord.status = 'cancelado' then raise exception 'El pedido está cancelado'; end if;
  if p_metodo not in ('transferencia', 'deposito', 'efectivo') then raise exception 'Forma de pago no válida'; end if;

  if p_metodo <> 'efectivo' then
    select * into cta from bank_accounts where id = p_cuenta_id and activo;
    if cta.id is null then raise exception 'Elige la cuenta a la que pagaste'; end if;
    if length(trim(coalesce(p_referencia, ''))) < 3 then
      raise exception 'Escribe el número de referencia de la transferencia o depósito';
    end if;
  end if;

  if not es_staff and exists (select 1 from pagos_reportados where order_id = ord.id and estado = 'reportado') then
    raise exception 'Ya tienes un pago de este pedido en revisión';
  end if;

  select coalesce(sum(monto), 0) into ya from pagos_reportados
   where order_id = ord.id and estado in ('reportado', 'confirmado');
  if p_monto is null or p_monto <= 0 or p_monto > ord.total - ya then
    raise exception 'El monto debe ser mayor que 0 y no mayor que lo que falta (RD$%)', ord.total - ya;
  end if;

  insert into pagos_reportados (order_id, monto, metodo, cuenta_id, cuenta_texto, referencia, reportado_por)
  values (ord.id, p_monto, p_metodo, cta.id,
          case when cta.id is not null then
            cta.banco || coalesce(' · ' || cta.tipo_cuenta, '') || ' · ' || cta.numero || ' · ' || cta.titular end,
          nullif(left(trim(coalesce(p_referencia, '')), 60), ''), auth.uid())
  returning * into rep;

  if es_staff then
    rep := confirmar_pago(rep.id, 'confirmado', 'Registrado por el personal');
  end if;
  return rep;
end $$;

revoke all on function reportar_pago(uuid, numeric, text, uuid, text) from public, anon;
grant execute on function reportar_pago(uuid, numeric, text, uuid, text) to authenticated;
revoke all on function confirmar_pago(uuid, text, text) from public, anon;
grant execute on function confirmar_pago(uuid, text, text) to authenticated;
