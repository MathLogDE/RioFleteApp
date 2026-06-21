-- ============================================================
-- MIGRACIÓN: policies de Storage del bucket privado 'evidencias'
--
-- Fuente de verdad de la RLS sobre storage.objects para 'evidencias'.
-- Reúne policies que antes estaban dispersas o solo en el dashboard:
--   * fletero_sube_evidencia            (INSERT) — el fletero sube a SUS pedidos
--   * ver_evidencia_propia_o_sucursal   (SELECT) — fletero (propio) / admin / encargado (su sucursal)
--   * evidencias_operador_storage_insert(INSERT) — el operador sube a pedidos de SU sucursal
--   * evidencias_gerencia_storage_select(SELECT) — admin / gerencia ven todo
--
-- Las policies del bucket 'perfiles' (perfiles_foto_*) NO van acá:
-- ya están en migracion_ficha_fletero.sql.
--
-- IMPORTANTE: storage.objects pertenece a otro owner. Si estos CREATE dan
-- "must be owner of table objects" en el SQL Editor, aplicá las mismas
-- definiciones desde Storage -> Policies en el dashboard. El archivo igual
-- queda como fuente de verdad versionada de qué policies deben existir.
--
-- Depende de: pedidos, usuario_sucursales, y las funciones mi_rol() /
-- tengo_sucursal(). Correr DESPUÉS de las migraciones que las crean
-- (al final de la cadena, tras migracion_operador.sql).
-- Idempotente (drop if exists + create). Aditiva.
-- ============================================================

-- 1) INSERT del fletero: sube evidencias a pedidos asignados a él.
drop policy if exists fletero_sube_evidencia on storage.objects;
create policy fletero_sube_evidencia on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and exists (
      select 1 from pedidos
       where pedidos.id::text = (storage.foldername(name))[1]
         and pedidos.fletero_id = auth.uid()
    )
  );

-- 2) SELECT de evidencias: el fletero ve las suyas; admin ve todo;
--    el encargado ve las de su sucursal.
drop policy if exists ver_evidencia_propia_o_sucursal on storage.objects;
create policy ver_evidencia_propia_o_sucursal on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidencias'
    and exists (
      select 1 from pedidos
       where pedidos.id::text = (storage.foldername(name))[1]
         and (
              pedidos.fletero_id = auth.uid()
           or mi_rol() = 'admin'
           or (mi_rol() = 'encargado' and tengo_sucursal(pedidos.sucursal_id))
         )
    )
  );

-- 3) INSERT del operador: sube evidencias (DNI) a pedidos de su sucursal.
drop policy if exists evidencias_operador_storage_insert on storage.objects;
create policy evidencias_operador_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and mi_rol() = 'operador'
    and exists (
      select 1
        from pedidos p
        join usuario_sucursales us on us.sucursal_id = p.sucursal_id
       where p.id::text = (storage.foldername(name))[1]
         and us.usuario_id = auth.uid()
    )
  );

-- 4) SELECT de gerencia/admin: ven cualquier evidencia del bucket
--    (lo que destraba "Ver factura" en el dashboard de gerencia).
drop policy if exists evidencias_gerencia_storage_select on storage.objects;
create policy evidencias_gerencia_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidencias'
    and mi_rol() in ('admin', 'gerencia')
  );

notify pgrst, 'reload schema';
