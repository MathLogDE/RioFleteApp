-- ============================================================
-- MIGRACIÓN: lista pública de sucursales para el alta de usuarios
--   La página de registro es pública (rol anon), y las RLS de
--   sucursales exigen sesión. Esta función expone SOLO id/código/nombre
--   de las sucursales activas, sin tocar columnas sensibles (whatsapp, etc.).
-- Correr en Supabase -> SQL Editor. Incremental.
-- ============================================================

create or replace function sucursales_para_alta()
returns table (id uuid, codigo text, nombre text)
language sql
security definer
set search_path = public
stable
as $$
  select id, codigo, nombre
  from sucursales
  where activa = true
  order by codigo;
$$;

grant execute on function sucursales_para_alta() to anon, authenticated;

notify pgrst, 'reload schema';
