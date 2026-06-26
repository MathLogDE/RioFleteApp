-- ============================================================
-- MIGRACIÓN: documentos del perfil (DNI + alta de AFIP)
--   El bucket 'perfiles' hoy solo acepta imágenes. El alta de AFIP
--   puede venir en PDF, así que sumamos application/pdf a los tipos
--   permitidos. Las políticas de escritura/lectura ya cubren la carpeta
--   del propio usuario (perfiles/{user_id}/...), no hay que tocarlas.
--   Las columnas doc_dni_url / doc_afip_url ya existen (migración de altas).
-- Correr en Supabase -> SQL Editor. Incremental.
-- ============================================================

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'perfiles';

notify pgrst, 'reload schema';
