-- ============================================================
-- MIGRACIÓN: ficha completa del usuario (fletero) + foto + privacidad
-- Correr en Supabase → SQL Editor. Incremental.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Campos nuevos en perfiles
--    nombre_completo ya existe (nombre y apellido O razón social).
--    Las sucursales se vinculan por usuario_sucursales (ya existe).
-- ------------------------------------------------------------
alter table perfiles
  add column if not exists tipo_persona text
    check (tipo_persona in ('fisica', 'juridica')) default 'fisica',
  add column if not exists dni text,
  add column if not exists cuit text,
  add column if not exists fecha_nacimiento date,
  add column if not exists direccion text,
  add column if not exists foto_url text;   -- ruta en el bucket 'perfiles'

-- ------------------------------------------------------------
-- 2) Helper: ¿comparto alguna sucursal con otro usuario?
--    security definer → puede leer usuario_sucursales sin chocar con su RLS.
-- ------------------------------------------------------------
create or replace function comparto_sucursal(otro uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from usuario_sucursales a
    join usuario_sucursales b on a.sucursal_id = b.sucursal_id
    where a.usuario_id = auth.uid() and b.usuario_id = otro
  );
$$;

-- ------------------------------------------------------------
-- 3) Endurecer la lectura de perfiles
--    ANTES: cualquier autenticado veía TODOS los perfiles.
--    AHORA: uno mismo, admin/gerencia, y el encargado a su gente.
-- ------------------------------------------------------------
drop policy if exists "perfiles_select_autenticados" on perfiles;

-- (perfiles_self_select y perfiles_admin_all ya existen; los dejamos)

drop policy if exists "perfiles_gerencia_select" on perfiles;
create policy "perfiles_gerencia_select" on perfiles for select
  using (mi_rol() = 'gerencia');

drop policy if exists "perfiles_encargado_select" on perfiles;
create policy "perfiles_encargado_select" on perfiles for select
  using (mi_rol() = 'encargado' and comparto_sucursal(perfiles.id));

-- ------------------------------------------------------------
-- 4) Bucket privado para las fotos de perfil
--    Convención de path: perfiles/{user_id}/foto.jpg
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('perfiles', 'perfiles', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Subir/editar: la propia persona su carpeta, o admin cualquiera
drop policy if exists "perfiles_foto_write" on storage.objects;
create policy "perfiles_foto_write" on storage.objects for insert
to authenticated
with check (
  bucket_id = 'perfiles'
  and ((storage.foldername(name))[1] = auth.uid()::text or mi_rol() = 'admin')
);

drop policy if exists "perfiles_foto_update" on storage.objects;
create policy "perfiles_foto_update" on storage.objects for update
to authenticated
using (
  bucket_id = 'perfiles'
  and ((storage.foldername(name))[1] = auth.uid()::text or mi_rol() = 'admin')
);

-- Ver: uno mismo, admin/gerencia, o el encargado de esa persona
drop policy if exists "perfiles_foto_select" on storage.objects;
create policy "perfiles_foto_select" on storage.objects for select
to authenticated
using (
  bucket_id = 'perfiles'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or mi_rol() in ('admin', 'gerencia')
    or (mi_rol() = 'encargado'
        and comparto_sucursal(((storage.foldername(name))[1])::uuid))
  )
);

notify pgrst, 'reload schema';
