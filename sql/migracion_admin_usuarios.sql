-- ============================================================
-- MIGRACIÓN: gestión de usuarios ya autorizados (solo admin)
--
-- Complementa migracion_usuarios_alta.sql (que cubre el ALTA: pendientes
-- -> autorizar/rechazar). Acá agregamos la EDICIÓN de usuarios existentes:
--   * cambiar rol
--   * reasignar sucursales (usuario_sucursales)
--   * dar de baja / reactivar (activo + estado)
--
-- Todo vía funciones SECURITY DEFINER admin-only, igual que autorizar_perfil:
-- así no dependemos de afinar RLS para lecturas/escrituras cruzadas, y el
-- guard perfiles_update_guard ya deja pasar al admin (mi_rol() = 'admin').
--
-- Correr en Supabase -> SQL Editor. Incremental.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Nuevo estado 'suspendido' (baja reversible). 'rechazado' queda para
--    altas no aprobadas; 'suspendido' para una cuenta que estuvo activa.
-- ------------------------------------------------------------
alter table perfiles drop constraint if exists perfiles_estado_check;
alter table perfiles add constraint perfiles_estado_check
  check (estado in ('pendiente', 'autorizado', 'rechazado', 'suspendido'));

-- ------------------------------------------------------------
-- 2) Listado de usuarios gestionables (todos menos los pendientes, que se
--    ven en Altas). Devuelve las sucursales vinculadas como arreglo de ids.
-- ------------------------------------------------------------
create or replace function admin_listar_usuarios()
returns table (
  id uuid,
  nombre_completo text,
  email text,
  rol text,
  estado text,
  activo boolean,
  sucursal_ids uuid[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if mi_rol() <> 'admin' then
    raise exception 'Solo un administrador puede listar usuarios.';
  end if;
  return query
    select p.id, p.nombre_completo, p.email, p.rol, p.estado, p.activo,
           coalesce(
             array_agg(us.sucursal_id) filter (where us.sucursal_id is not null),
             '{}'::uuid[]
           )
      from perfiles p
      left join usuario_sucursales us on us.usuario_id = p.id
     where p.estado <> 'pendiente'
     group by p.id
     order by p.nombre_completo;
end;
$$;

-- ------------------------------------------------------------
-- 3) Cambiar el rol de un usuario. No se puede tocar el propio rol
--    (evita que el admin se auto-bloquee por error).
-- ------------------------------------------------------------
create or replace function admin_cambiar_rol(p_perfil_id uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if mi_rol() <> 'admin' then
    raise exception 'Solo un administrador puede cambiar roles.';
  end if;
  if p_rol not in ('admin', 'gerencia', 'encargado', 'operador', 'fletero') then
    raise exception 'Rol inválido.';
  end if;
  if p_perfil_id = auth.uid() then
    raise exception 'No podés cambiar tu propio rol.';
  end if;
  update perfiles set rol = p_rol where id = p_perfil_id;
end;
$$;

-- ------------------------------------------------------------
-- 4) Reemplazar las sucursales vinculadas a un usuario por el set dado.
-- ------------------------------------------------------------
create or replace function admin_set_sucursales(p_perfil_id uuid, p_sucursal_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if mi_rol() <> 'admin' then
    raise exception 'Solo un administrador puede asignar sucursales.';
  end if;
  delete from usuario_sucursales where usuario_id = p_perfil_id;
  if p_sucursal_ids is not null and array_length(p_sucursal_ids, 1) > 0 then
    insert into usuario_sucursales (usuario_id, sucursal_id)
    select p_perfil_id, s
      from unnest(p_sucursal_ids) as s
    on conflict do nothing;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 5) Dar de baja / reactivar. La baja deja estado 'suspendido' (no entra a
--    ningún panel: ProtectedRoute bloquea todo lo que no sea 'autorizado').
--    No se puede dar de baja a uno mismo.
-- ------------------------------------------------------------
create or replace function admin_set_activo(p_perfil_id uuid, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if mi_rol() <> 'admin' then
    raise exception 'Solo un administrador puede dar de baja o reactivar.';
  end if;
  if p_perfil_id = auth.uid() and p_activo = false then
    raise exception 'No podés desactivar tu propia cuenta.';
  end if;
  update perfiles
     set activo = p_activo,
         estado = case when p_activo then 'autorizado' else 'suspendido' end
   where id = p_perfil_id;
end;
$$;

grant execute on function admin_listar_usuarios() to authenticated;
grant execute on function admin_cambiar_rol(uuid, text) to authenticated;
grant execute on function admin_set_sucursales(uuid, uuid[]) to authenticated;
grant execute on function admin_set_activo(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
