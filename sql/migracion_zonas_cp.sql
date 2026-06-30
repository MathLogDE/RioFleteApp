-- ============================================================
-- MIGRACIÓN: código postal (CP) por zona de entrega
--
-- Cada zona suma un CP. En la carga del pedido, en vez de elegir la zona a
-- mano, se tipea el CP y se resuelve la zona (y su tarifa) entre las de la
-- sucursal. Un CP -> una zona por sucursal (índice único parcial).
--
-- CP se guarda como texto (admite el formato viejo de 4 dígitos y el CPA
-- alfanumérico tipo A1234ABC). La normalización (trim/upper) la hace la app.
--
-- Correr en Supabase -> SQL Editor. Aditiva, no destructiva.
-- ============================================================

alter table zonas add column if not exists cp text;

-- Un mismo CP no puede repetirse en zonas de la misma sucursal: así el
-- lookup por CP es determinístico. (Las zonas viejas con cp NULL no chocan.)
create unique index if not exists zonas_sucursal_cp_uniq
  on zonas (sucursal_id, cp) where cp is not null;

notify pgrst, 'reload schema';
