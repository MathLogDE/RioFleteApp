-- ============================================================
-- MIGRACIÓN: eliminar la columna heredada zonas.precio_fletero
--
-- La tabla zonas (creada en el esquema inicial, fuera de estas migraciones)
-- tenía una columna precio_fletero NOT NULL. Después migracion_zonas_tarifa.sql
-- agregó pago_fletero como la columna canónica que usa TODA la app, pero
-- precio_fletero quedó ahí, obligatoria. Resultado: cualquier INSERT de zona
-- (que solo setea pago_fletero) fallaba con:
--   null value in column "precio_fletero" ... violates not-null constraint
--
-- Acá consolidamos en pago_fletero y borramos la columna redundante.
-- Correr en Supabase -> SQL Editor. Aditiva salvo por el DROP COLUMN final.
-- ============================================================

-- Por si alguna zona vieja tuviera tarifa solo en la columna heredada,
-- la copiamos a pago_fletero antes de borrarla (no perdemos datos).
update zonas
   set pago_fletero = precio_fletero
 where pago_fletero is null
   and precio_fletero is not null;

alter table zonas drop column if exists precio_fletero;

notify pgrst, 'reload schema';
