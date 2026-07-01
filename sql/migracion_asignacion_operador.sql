-- ============================================================
-- MIGRACIÓN: la asignación de fletero pasa al operador (mostrador)
--   Antes la hacía el encargado (SucursalPanel). Ahora la hace el
--   operador desde OperadorPanel.
--
-- Lo que YA está y NO hace falta tocar:
--   * El operador puede actualizar pedidos de su sucursal
--     (policy pedidos_operador_update, sin restricción de columnas).
--   * El trigger pedidos_fletero_guard solo limita al rol 'fletero'.
--   => El operador ya puede escribir fletero_id y estado_actual.
--
-- Lo único que falta:
--   * Que el operador pueda LEER la lista de fleteros (perfiles) para
--     poblar el selector. Hoy leen perfiles: uno mismo, admin, gerencia
--     y encargado. Agregamos al operador, acotado a su sucursal (igual
--     que el encargado, vía comparto_sucursal).
--
-- Correr en Supabase -> SQL Editor. Incremental.
-- ============================================================

drop policy if exists "perfiles_operador_select" on perfiles;
create policy "perfiles_operador_select" on perfiles for select
  using (mi_rol() = 'operador' and comparto_sucursal(perfiles.id));

notify pgrst, 'reload schema';
