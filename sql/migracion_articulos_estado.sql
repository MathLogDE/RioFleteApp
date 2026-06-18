-- ============================================================
-- MIGRACIÓN: artículos del pedido + método de entrega + estado "recibido"
-- Correr en Supabase → SQL Editor. Es incremental.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Artículos del pedido (sin precio por línea)
-- ------------------------------------------------------------
create table if not exists pedido_articulos (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references pedidos(id) on delete cascade,
  codigo      text,
  descripcion text not null,
  cantidad    integer not null default 1 check (cantidad > 0),
  created_at  timestamptz not null default now()
);

create index if not exists idx_pedido_articulos_pedido
  on pedido_articulos(pedido_id);

alter table pedido_articulos enable row level security;

-- Ve los artículos quien puede ver el pedido (mismo criterio que evidencias)
drop policy if exists "articulos_select" on pedido_articulos;
create policy "articulos_select" on pedido_articulos for select
using (exists (
  select 1 from pedidos p
  where p.id = pedido_articulos.pedido_id
  and (
    mi_rol() in ('admin', 'gerencia')
    or (mi_rol() = 'encargado' and tengo_sucursal(p.sucursal_id))
    or (mi_rol() = 'fletero'   and p.fletero_id = auth.uid())
  )
));

-- Carga/edita artículos: la sucursal (encargado) o admin. El fletero NO.
drop policy if exists "articulos_write" on pedido_articulos;
create policy "articulos_write" on pedido_articulos for all
using (exists (
  select 1 from pedidos p
  where p.id = pedido_articulos.pedido_id
  and (mi_rol() = 'admin' or (mi_rol() = 'encargado' and tengo_sucursal(p.sucursal_id)))
))
with check (exists (
  select 1 from pedidos p
  where p.id = pedido_articulos.pedido_id
  and (mi_rol() = 'admin' or (mi_rol() = 'encargado' and tengo_sucursal(p.sucursal_id)))
));

-- ------------------------------------------------------------
-- 2) Método de entrega
-- ------------------------------------------------------------
alter table pedidos
  add column if not exists metodo_entrega text
    check (metodo_entrega in ('sucursal', 'flete', 'courier'))
    default 'flete';

-- ------------------------------------------------------------
-- 3) Nuevo estado "recibido" (llegó a la sucursal)
--    Reemplaza el check de estado_actual sumando el valor.
--    Si al insertar un pedido 'recibido' diera error de check, puede ser
--    que el constraint tenga otro nombre: ejecutá
--      select conname from pg_constraint where conrelid = 'pedidos'::regclass and contype='c';
--    y reemplazá el nombre de abajo.
-- ------------------------------------------------------------
alter table pedidos drop constraint if exists pedidos_estado_actual_check;
alter table pedidos add constraint pedidos_estado_actual_check
  check (estado_actual in (
    'pendiente', 'recibido', 'asignado', 'enviado', 'en_camino',
    'entregado', 'fallido',
    'devolucion_pendiente', 'devolucion_retirada', 'cambiado'
  ));

notify pgrst, 'reload schema';
