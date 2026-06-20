-- ============================================================
-- MIGRACIÓN: permisos para la conciliación de pagos (gerencia)
--   * gerencia/admin pueden leer y actualizar pedidos (marcar pagado)
--   * gerencia/admin pueden leer las evidencias y descargar las facturas
--     del bucket privado 'evidencias'
-- Políticas aditivas: no tocan las existentes. Correr en Supabase.
-- ============================================================

drop policy if exists pedidos_gerencia_select on pedidos;
create policy pedidos_gerencia_select on pedidos for select to authenticated
  using (mi_rol() in ('gerencia', 'admin'));

drop policy if exists pedidos_gerencia_update on pedidos;
create policy pedidos_gerencia_update on pedidos for update to authenticated
  using (mi_rol() in ('gerencia', 'admin'))
  with check (mi_rol() in ('gerencia', 'admin'));

drop policy if exists evidencias_gerencia_select on evidencias;
create policy evidencias_gerencia_select on evidencias for select to authenticated
  using (mi_rol() in ('gerencia', 'admin'));

-- Descarga de los archivos (facturas) del bucket privado.
-- Si este CREATE diera error de permisos en el SQL Editor, se puede crear
-- la misma policy desde Storage -> Policies en el dashboard.
drop policy if exists evidencias_gerencia_storage_select on storage.objects;
create policy evidencias_gerencia_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and mi_rol() in ('admin', 'gerencia'));

notify pgrst, 'reload schema';
