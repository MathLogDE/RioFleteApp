-- ============================================================
-- MIGRACIÓN: WhatsApp del mostrador por sucursal
--   Guarda el número al que el sistema redirige tras crear un pedido,
--   para que el mostrador confirme la recepción.
--   El número es un dato de la SUCURSAL (institucional), no de un usuario:
--   sobrevive a la rotación de personal.
--   Correr en Supabase -> SQL Editor. Es incremental.
-- ============================================================

alter table sucursales
  add column if not exists whatsapp text;

comment on column sucursales.whatsapp is
  'Número del mostrador para avisos por WhatsApp. Recomendado: formato '
  'internacional completo para wa.me, ej. 5492645555667 (54 + 9 + '
  'característica sin 0 + número sin 15). El front igual normaliza si se '
  'carga el número local.';

-- ------------------------------------------------------------
-- Carga de números (ajustar y descomentar por sucursal).
-- Ejemplos con los códigos de seed_sucursales.sql:
-- ------------------------------------------------------------
-- update sucursales set whatsapp = '5492645555667' where codigo = '008'; -- SAN JUAN
-- update sucursales set whatsapp = '5493515551234' where codigo = '002'; -- CORDOBA
-- update sucursales set whatsapp = '5492615559876' where codigo = '016'; -- MENDOZA

notify pgrst, 'reload schema';
