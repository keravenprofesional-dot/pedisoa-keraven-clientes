-- La cédula pasa a ser obligatoria (decisión del dueño, 14 oct 2026): con ella
-- el ERP reconoce al cliente sin duplicarlo.
--   · Cliente nuevo: sin cédula válida (11 dígitos) no se crea.
--   · Cliente que ya existe sin cédula: sigue entrando y pidiendo; se le pide
--     al editarlo, y no se le puede borrar una vez puesta.
--   · Siempre se guarda igual: 000-0000000-0.
--   · Dos clientes no pueden tener la misma cédula.
--   · La solicitud de "Soy nuevo" también la pide.

create or replace function cedula_formato(p text)
returns text language sql immutable as $$
  select case when length(d) = 11 then substr(d,1,3) || '-' || substr(d,4,7) || '-' || substr(d,11,1) end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x
$$;

create or replace function revisar_cedula_cliente()
returns trigger language plpgsql set search_path = public as $$
declare
  otro text;
begin
  if tg_op = 'UPDATE' and new.cedula is not distinct from old.cedula then return new; end if;

  if coalesce(btrim(new.cedula), '') = '' then
    if tg_op = 'INSERT' then raise exception 'La cédula es obligatoria'; end if;
    if coalesce(btrim(old.cedula), '') <> '' then raise exception 'La cédula es obligatoria: no se puede borrar'; end if;
    return new;
  end if;

  if cedula_formato(new.cedula) is null then
    raise exception 'La cédula debe tener 11 números (ejemplo: 001-1234567-8)';
  end if;
  new.cedula := cedula_formato(new.cedula);

  select client_number into otro from clients
   where id <> new.id and cedula_formato(cedula) = new.cedula limit 1;
  if otro is not null then raise exception 'Ya existe un cliente con esa cédula (%)', otro; end if;
  return new;
end $$;

drop trigger if exists trg_cedula_cliente on clients;
create trigger trg_cedula_cliente before insert or update of cedula on clients
for each row execute function revisar_cedula_cliente();

-- "Soy nuevo": la misma regla
create or replace function solicitar_cliente(
  p_nombre     text,
  p_telefono   text,
  p_telefono2  text,
  p_cedula     text,
  p_direccion  text,
  p_correo     text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tel  text := regexp_replace(coalesce(p_telefono,''), '\D', '', 'g');
  v_tel2 text := regexp_replace(coalesce(p_telefono2,''), '\D', '', 'g');
  v_cor  text := lower(btrim(coalesce(p_correo,'')));
  v_nom  text := btrim(coalesce(p_nombre,''));
  v_ced  text := cedula_formato(p_cedula);
  v_id   uuid;
begin
  -- Lo mínimo para poder contactar a la persona.
  if length(v_nom) < 3 then raise exception 'Escribe tu nombre completo'; end if;
  if length(v_tel) < 10 then raise exception 'Escribe un teléfono válido'; end if;
  if v_ced is null then raise exception 'Escribe tu cédula (11 números, ejemplo: 001-1234567-8)'; end if;
  if v_cor !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido'; end if;

  -- Si ya tiene una solicitud pendiente, no se duplica (doble toque o spam).
  if exists (
    select 1 from solicitudes_cliente
    where estado = 'pendiente'
      and (lower(correo) = v_cor or regexp_replace(telefono,'\D','','g') = v_tel)
  ) then
    raise exception 'Ya tienes una solicitud en revisión. Pronto te contactamos.';
  end if;

  insert into solicitudes_cliente (nombre_completo, telefono, telefono_referencia, cedula, direccion, correo)
  values (upper(v_nom), v_tel, nullif(v_tel2,''), v_ced,
          nullif(btrim(coalesce(p_direccion,'')),''), v_cor)
  returning id into v_id;
  return v_id;
end;
$$;
