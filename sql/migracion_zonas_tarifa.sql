-- ============================================================
-- MIGRACIÓN: zonas por sucursal + tarifa (pago al fletero)
--   * sucursal_id  -> cada zona pertenece a UNA sucursal
--   * pago_fletero -> lo que se le paga al fletero por entregar en esa zona
--                     (indistinto de lo que se le cobre al cliente)
--   * unique(sucursal_id, nombre) -> nombres claros, no repetidos por sucursal
--   * RLS: lectura para autenticados, escritura para admin/gerencia
--          (para la futura pantalla de autogestión)
-- La tabla zonas está VACÍA (0 filas), así que es seguro pedir NOT NULL.
-- Correr en Supabase -> SQL Editor. Incremental.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columnas nuevas
-- ------------------------------------------------------------
alter table zonas
  add column if not exists sucursal_id uuid references sucursales(id) on delete cascade,
  add column if not exists pago_fletero numeric(12,2);

-- Tabla vacía -> podemos exigir que toda zona tenga sucursal de acá en más.
alter table zonas alter column sucursal_id set not null;

-- ------------------------------------------------------------
-- 2) Nombre único POR sucursal (no global).
--    Si hubiera un unique global sobre (nombre), lo quitamos.
-- ------------------------------------------------------------
do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.zonas'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) = 'UNIQUE (nombre)';
  if c is not null then
    execute 'alter table zonas drop constraint ' || quote_ident(c);
  end if;
end $$;

alter table zonas drop constraint if exists zonas_sucursal_nombre_key;
alter table zonas add constraint zonas_sucursal_nombre_key unique (sucursal_id, nombre);

-- ------------------------------------------------------------
-- 3) Índice para el filtro por sucursal del formulario
-- ------------------------------------------------------------
create index if not exists idx_zonas_sucursal on zonas(sucursal_id);

-- ------------------------------------------------------------
-- 4) RLS
-- ------------------------------------------------------------
alter table zonas enable row level security;

-- Lectura: cualquier autenticado (el formulario de pedido necesita las zonas).
drop policy if exists "zonas_select" on zonas;
create policy "zonas_select" on zonas for select to authenticated using (true);

-- Escritura: solo admin/gerencia (la pantalla de autogestión).
drop policy if exists "zonas_write" on zonas;
create policy "zonas_write" on zonas for all to authenticated
  using (mi_rol() in ('admin', 'gerencia'))
  with check (mi_rol() in ('admin', 'gerencia'));

notify pgrst, 'reload schema';
