-- ============================================================
-- MIGRACIÓN: lectura de sucursales para el dashboard de gerencia
-- (perfiles ya tiene su policy de gerencia desde migracion_ficha_fletero)
-- Aditiva. Correr en Supabase.
-- ============================================================

drop policy if exists sucursales_gerencia_select on sucursales;
create policy sucursales_gerencia_select on sucursales for select to authenticated
  using (mi_rol() in ('gerencia', 'admin'));

notify pgrst, 'reload schema';
