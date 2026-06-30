-- ============================================================
-- MIGRACIÓN: perfiles.rol puede ser NULL (rol sin asignar)
--
-- Por qué: el trigger handle_new_user() deja rol = NULL a propósito
-- cuando el alta no trae un rol válido en la metadata ("lo define el
-- admin"). Pero la columna rol era NOT NULL sin default, así que ese
-- insert fallaba y la transacción de creación del usuario hacía
-- rollback -> "Database error creating new user".
--
-- Esto rompía el alta desde el dashboard de Auth (Add user), que no
-- manda metadata, y era un bug latente para cualquier alta vía API o
-- invite sin rol.
--
-- Seguro porque:
--   * el CHECK rol in (...) pasa con NULL (no es false, es unknown)
--   * un perfil sin rol nace pendiente/inactivo -> gate PendienteAprobacion
--   * mi_rol() = NULL en las policies -> sin acceso (correcto)
--   * App.jsx ya tiene el caso default "Cuenta sin rol asignado"
--
-- El admin asigna el rol al autorizar el perfil (autorizar_perfil).
-- Correr en Supabase -> SQL Editor. Aditiva, no destructiva.
-- ============================================================

alter table perfiles alter column rol drop not null;

notify pgrst, 'reload schema';
