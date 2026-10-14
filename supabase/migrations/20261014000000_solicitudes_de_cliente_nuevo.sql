-- SOLICITUDES DE CLIENTE NUEVO (el buzón del login)
--
-- Una persona que todavía NO es cliente llena un formulario en la pantalla
-- de entrada pidiendo que le creen su perfil. Esa solicitud cae en un buzón
-- que ven todos los administradores con permiso de crear clientes.
--
-- Clave del diseño: quien solicita NO tiene cuenta todavía, así que entra
-- como "anon" (sin iniciar sesión). Por eso insertar una solicitud NO se
-- hace directo sobre la tabla (eso dejaría a cualquiera escribir lo que
-- quisiera), sino a través de una función controlada que valida los datos.

create table if not exists solicitudes_cliente (
  id                  uuid primary key default gen_random_uuid(),
  nombre_completo     text not null,
  telefono            text not null,            -- el de quien solicita
  telefono_referencia text,                     -- otro número, de referencia
  cedula              text,
  direccion           text,
  correo              text not null,            -- por aquí se le avisa
  estado              text not null default 'pendiente'
                        check (estado in ('pendiente','aprobada','rechazada')),
  nota_admin          text,                     -- por qué se aprobó o rechazó
  atendida_por        uuid references profiles(id) on delete set null,
  atendida_en         timestamptz,
  cliente_id          uuid references clients(id) on delete set null, -- si se aprobó y se creó
  creado_en           timestamptz not null default now()
);

create index if not exists idx_solicitudes_estado on solicitudes_cliente (estado, creado_en desc);

-- Permiso nuevo para ver y atender el buzón. Se lo damos por defecto a quien
-- ya puede crear clientes: atender una solicitud termina en crear el cliente.
insert into pedidos_permisos (clave, descripcion, orden) values
  ('ver_solicitudes', 'Ver y atender el buzón de solicitudes de clientes nuevos', 55)
on conflict (clave) do nothing;

insert into pedidos_rol_permisos (rol_id, permiso)
select r.id, 'ver_solicitudes' from pedidos_roles r
where exists (select 1 from pedidos_rol_permisos rp where rp.rol_id = r.id and rp.permiso = 'crear_clientas')
on conflict do nothing;

-- ---------- Enviar una solicitud (desde el login, sin cuenta) ----------
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
  v_id   uuid;
begin
  -- Lo mínimo para poder contactar a la persona.
  if length(v_nom) < 3 then raise exception 'Escribe tu nombre completo'; end if;
  if length(v_tel) < 10 then raise exception 'Escribe un teléfono válido'; end if;
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
  values (upper(v_nom), v_tel, nullif(v_tel2,''), nullif(btrim(coalesce(p_cedula,'')),''),
          nullif(btrim(coalesce(p_direccion,'')),''), v_cor)
  returning id into v_id;
  return v_id;
end;
$$;

-- Cualquiera (aún sin cuenta) puede ENVIAR una solicitud; nadie más toca la tabla directo.
revoke all on function solicitar_cliente(text,text,text,text,text,text) from public;
grant execute on function solicitar_cliente(text,text,text,text,text,text) to anon, authenticated;

-- ---------- Atender una solicitud (desde el buzón del admin) ----------
create or replace function atender_solicitud(
  p_id     uuid,
  p_estado text,            -- 'aprobada' o 'rechazada'
  p_nota   text
) returns solicitudes_cliente language plpgsql security definer set search_path = public as $$
declare s solicitudes_cliente;
begin
  if not (tiene_permiso('ver_solicitudes') or tiene_permiso('crear_clientas')) then
    raise exception 'No tienes permiso para atender solicitudes';
  end if;
  if p_estado not in ('aprobada','rechazada') then
    raise exception 'Estado no válido';
  end if;
  update solicitudes_cliente
     set estado = p_estado, nota_admin = nullif(btrim(coalesce(p_nota,'')),''),
         atendida_por = auth.uid(), atendida_en = now()
   where id = p_id and estado = 'pendiente'
   returning * into s;
  if s.id is null then raise exception 'Esa solicitud ya fue atendida o no existe'; end if;
  return s;
end;
$$;
grant execute on function atender_solicitud(uuid,text,text) to authenticated;

-- ---------- Quién puede LEER el buzón ----------
alter table solicitudes_cliente enable row level security;

drop policy if exists solicitudes_leer     on solicitudes_cliente;
drop policy if exists solicitudes_atender  on solicitudes_cliente;

-- Solo el personal con permiso ve las solicitudes. Quien solicita NO puede
-- leer el buzón; la función de arriba es su única puerta para escribir.
create policy solicitudes_leer on solicitudes_cliente for select to authenticated
  using (tiene_permiso('ver_solicitudes') or tiene_permiso('crear_clientas'));
create policy solicitudes_atender on solicitudes_cliente for update to authenticated
  using (tiene_permiso('ver_solicitudes') or tiene_permiso('crear_clientas'))
  with check (tiene_permiso('ver_solicitudes') or tiene_permiso('crear_clientas'));
