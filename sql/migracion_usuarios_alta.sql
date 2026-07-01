-- ============================================================
-- MIGRACIÓN: alta de usuarios (autoregistro + autorización admin)
--
-- Flujo:
--   1) La persona se registra por link (signUp con metadata).
--   2) Este trigger crea su perfil en estado 'pendiente', SANITIZANDO:
--      - rol forzado a fletero/operador (cualquier otra cosa => null)
--      - estado SIEMPRE 'pendiente', activo SIEMPRE false
--      pase lo que pase en la metadata del navegador.
--   3) Valida su mail (Supabase) e inicia sesión -> cae en "pendiente".
--   4) Solo el ADMIN autoriza: asigna rol + sucursal, activa, y
--      materializa el vínculo en usuario_sucursales.
--   5) Ya autorizado, edita sus datos en "Mi perfil" (un guard impide
--      que se toque a sí mismo rol/estado/activo/email/documento).
--
-- Correr en Supabase -> SQL Editor. Incremental.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columnas nuevas en perfiles
-- ------------------------------------------------------------
alter table perfiles
  add column if not exists estado text,
  add column if not exists email text,
  add column if not exists telefono text,
  add column if not exists documento text,
  add column if not exists cuit text,
  add column if not exists condicion_iva text,
  add column if not exists razon_social text,
  add column if not exists cbu_alias text,
  add column if not exists sucursal_solicitada uuid references sucursales(id),
  add column if not exists doc_afip_url text,
  add column if not exists doc_dni_url text;

-- Los perfiles que ya existían son usuarios reales en uso: autorizados.
update perfiles set estado = 'autorizado' where estado is null;

alter table perfiles alter column estado set default 'pendiente';
alter table perfiles alter column estado set not null;

alter table perfiles drop constraint if exists perfiles_estado_check;
alter table perfiles add constraint perfiles_estado_check
  check (estado in ('pendiente', 'autorizado', 'rechazado'));

alter table perfiles drop constraint if exists perfiles_condicion_iva_check;
alter table perfiles add constraint perfiles_condicion_iva_check
  check (condicion_iva is null or condicion_iva in
         ('monotributo', 'responsable_inscripto', 'exento', 'consumidor_final'));

-- ------------------------------------------------------------
-- 2) Trigger que crea el perfil pendiente al registrarse (auth.users)
--    SECURITY DEFINER: corre con privilegios para insertar en perfiles.
-- ------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_iva text;
  v_suc uuid;
begin
  -- Rol: SOLO fletero u operador. Cualquier otra cosa => null (el admin lo define).
  v_rol := nullif(new.raw_user_meta_data->>'rol', '');
  if v_rol is distinct from 'fletero' and v_rol is distinct from 'operador' then
    v_rol := null;
  end if;

  -- Condición de IVA: solo valores válidos; si no, null.
  v_iva := nullif(new.raw_user_meta_data->>'condicion_iva', '');
  if v_iva not in ('monotributo', 'responsable_inscripto', 'exento', 'consumidor_final') then
    v_iva := null;
  end if;

  -- Sucursal solicitada: si no es un uuid válido o no existe, => null.
  begin
    v_suc := (new.raw_user_meta_data->>'sucursal_solicitada')::uuid;
  exception when others then
    v_suc := null;
  end;
  if v_suc is not null and not exists (select 1 from sucursales where id = v_suc) then
    v_suc := null;
  end if;

  insert into perfiles (
    id, email, nombre_completo, telefono, documento,
    cuit, condicion_iva, razon_social, cbu_alias,
    rol, sucursal_solicitada, estado, activo
  )
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'nombre_completo', ''), new.email),
    nullif(new.raw_user_meta_data->>'telefono', ''),
    nullif(new.raw_user_meta_data->>'documento', ''),
    nullif(new.raw_user_meta_data->>'cuit', ''),
    v_iva,
    nullif(new.raw_user_meta_data->>'razon_social', ''),
    nullif(new.raw_user_meta_data->>'cbu_alias', ''),
    v_rol,
    v_suc,
    'pendiente',   -- SIEMPRE pendiente, ignora la metadata del cliente
    false          -- SIEMPRE inactivo
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------
-- 3) Guard de auto-edición: en "Mi perfil", uno no puede cambiarse
--    a sí mismo los campos de identidad/autorización. El admin sí.
-- ------------------------------------------------------------
create or replace function perfiles_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if mi_rol() = 'admin' then
    return new;  -- el admin autoriza: puede cambiar todo
  end if;
  if  (new.rol                 is distinct from old.rol)
   or (new.estado              is distinct from old.estado)
   or (new.activo              is distinct from old.activo)
   or (new.email               is distinct from old.email)
   or (new.documento           is distinct from old.documento)
   or (new.sucursal_solicitada is distinct from old.sucursal_solicitada)
   or (new.id                  is distinct from old.id)
  then
    raise exception 'Solo el administrador puede cambiar rol, estado, activo, email o documento.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_perfiles_update_guard on perfiles;
create trigger trg_perfiles_update_guard
  before update on perfiles
  for each row execute function perfiles_update_guard();

-- Política para que cada uno pueda editar su propio perfil (columnas
-- permitidas según el guard de arriba).
drop policy if exists "perfiles_self_update" on perfiles;
create policy "perfiles_self_update" on perfiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------
-- 4) Autorización (solo admin), atómica y server-side.
-- ------------------------------------------------------------
create or replace function autorizar_perfil(p_perfil_id uuid, p_rol text, p_sucursal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if mi_rol() <> 'admin' then
    raise exception 'Solo un administrador puede autorizar perfiles.';
  end if;
  if p_rol not in ('admin', 'gerencia', 'encargado', 'operador', 'fletero') then
    raise exception 'Rol inválido.';
  end if;

  update perfiles
     set rol = p_rol,
         estado = 'autorizado',
         activo = true,
         sucursal_solicitada = null
   where id = p_perfil_id;

  if p_sucursal_id is not null
     and not exists (select 1 from usuario_sucursales
                     where usuario_id = p_perfil_id and sucursal_id = p_sucursal_id) then
    insert into usuario_sucursales (usuario_id, sucursal_id)
    values (p_perfil_id, p_sucursal_id);
  end if;
end;
$$;

create or replace function rechazar_perfil(p_perfil_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if mi_rol() <> 'admin' then
    raise exception 'Solo un administrador puede rechazar perfiles.';
  end if;
  update perfiles set estado = 'rechazado', activo = false where id = p_perfil_id;
end;
$$;

grant execute on function autorizar_perfil(uuid, text, uuid) to authenticated;
grant execute on function rechazar_perfil(uuid) to authenticated;

notify pgrst, 'reload schema';
