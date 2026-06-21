-- ============================================================
-- MIGRACIÓN: el OPERADOR puede subir archivos (DNI) al bucket privado
-- 'evidencias'. La policy de tabla (evidencias_operador_insert) ya existe,
-- pero subir el archivo al Storage necesita su propia policy en
-- storage.objects. Sin esto, el upload del DNI falla con error de permisos
-- aunque la fila de evidencias sí se pueda insertar.
--
-- Scope: solo pedidos de SU sucursal. La ruta del archivo es
--   <pedido_id>/<tipo>_<timestamp>.jpg
-- así que la primera carpeta del path es el id del pedido.
--
-- Si este CREATE diera error de permisos en el SQL Editor, creá la misma
-- policy desde Storage -> Policies en el dashboard.
-- Correr en Supabase -> SQL Editor. Aditiva.
-- ============================================================

drop policy if exists evidencias_operador_storage_insert on storage.objects;
create policy evidencias_operador_storage_insert on storage.objects for insert to authenticated
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

notify pgrst, 'reload schema';
