-- ============================================================
-- MIGRACIÓN: dos líneas de vida del pedido
--   * estado_pago  -> ciclo de cobro del fletero
--   * tipo         -> logística inversa (venta / devolución / cambio)
--   * cómo/cuándo/quién pagó (soporta un futuro perfil "pagos")
-- La línea de ENTREGA no cambia: se reinterpretan los valores
-- existentes de estado_actual (pendiente = en preparación,
-- enviado = enviado a sucursal, recibido = en sucursal,
-- fallido = no entregado). No se tocan datos.
-- Correr en Supabase -> SQL Editor. Incremental.
-- ============================================================

-- 1) Columnas nuevas
alter table pedidos
  add column if not exists estado_pago text not null default 'no_aplica',
  add column if not exists tipo text not null default 'venta',
  add column if not exists pago_fletero_metodo text,
  add column if not exists pago_fletero_fecha timestamptz,
  add column if not exists pago_fletero_pagado_por uuid references perfiles(id);

alter table pedidos drop constraint if exists pedidos_estado_pago_check;
alter table pedidos add constraint pedidos_estado_pago_check
  check (estado_pago in ('no_aplica', 'pendiente_facturar', 'facturado', 'pagado'));

alter table pedidos drop constraint if exists pedidos_tipo_check;
alter table pedidos add constraint pedidos_tipo_check
  check (tipo in ('venta', 'devolucion', 'cambio'));

alter table pedidos drop constraint if exists pedidos_pago_metodo_check;
alter table pedidos add constraint pedidos_pago_metodo_check
  check (pago_fletero_metodo is null or pago_fletero_metodo in ('sucursal', 'transferencia'));

-- 2) Al ENTREGAR, se abre el ciclo de pago (pendiente de facturar).
--    Va en un trigger AFTER con bypass, para no chocar con el guard
--    cuando es el propio fletero quien marca la entrega.
create or replace function pedidos_set_pago_pendiente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado_actual = 'entregado'
     and old.estado_actual is distinct from 'entregado'
     and new.estado_pago = 'no_aplica'
  then
    perform set_config('app.bypass_guard', 'on', true);
    update pedidos set estado_pago = 'pendiente_facturar' where id = new.id;
    perform set_config('app.bypass_guard', 'off', true);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_pedidos_set_pago_pendiente on pedidos;
create trigger trg_pedidos_set_pago_pendiente
  after update on pedidos
  for each row execute function pedidos_set_pago_pendiente();

-- 3) Cuando el fletero sube la factura, el pago pasa a "facturado".
--    También con bypass, porque el update lo dispara su sesión.
create or replace function evidencias_set_pago_facturado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'factura' then
    perform set_config('app.bypass_guard', 'on', true);
    update pedidos
       set estado_pago = 'facturado'
     where id = new.pedido_id
       and estado_pago = 'pendiente_facturar';
    perform set_config('app.bypass_guard', 'off', true);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_evidencias_set_pago_facturado on evidencias;
create trigger trg_evidencias_set_pago_facturado
  after insert on evidencias
  for each row execute function evidencias_set_pago_facturado();

-- 4) Guard del fletero ampliado: además de lo anterior, NO puede tocar
--    estado_pago, tipo, ni los datos de pago (eso es de gerencia/pagos).
create or replace function pedidos_fletero_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if mi_rol() = 'fletero'
     and coalesce(current_setting('app.bypass_guard', true), 'off') <> 'on'
  then
    if  (new.sucursal_id            is distinct from old.sucursal_id)
     or (new.fletero_id             is distinct from old.fletero_id)
     or (new.zona_id                is distinct from old.zona_id)
     or (new.numero_pedido          is distinct from old.numero_pedido)
     or (new.cliente_nombre         is distinct from old.cliente_nombre)
     or (new.cliente_documento      is distinct from old.cliente_documento)
     or (new.cliente_telefono       is distinct from old.cliente_telefono)
     or (new.direccion_entrega      is distinct from old.direccion_entrega)
     or (new.monto                  is distinct from old.monto)
     or (new.notas                  is distinct from old.notas)
     or (new.metodo_pago            is distinct from old.metodo_pago)
     or (new.metodo_entrega         is distinct from old.metodo_entrega)
     or (new.tarjeta_ultimos4       is distinct from old.tarjeta_ultimos4)
     or (new.pago_validado          is distinct from old.pago_validado)
     or (new.cobra_fletero          is distinct from old.cobra_fletero)
     or (new.monto_a_cobrar         is distinct from old.monto_a_cobrar)
     or (new.pago_fletero           is distinct from old.pago_fletero)
     or (new.validacion_lugar       is distinct from old.validacion_lugar)
     or (new.pedido_origen_id       is distinct from old.pedido_origen_id)
     or (new.estado_pago            is distinct from old.estado_pago)
     or (new.tipo                   is distinct from old.tipo)
     or (new.pago_fletero_metodo    is distinct from old.pago_fletero_metodo)
     or (new.pago_fletero_fecha     is distinct from old.pago_fletero_fecha)
     or (new.pago_fletero_pagado_por is distinct from old.pago_fletero_pagado_por)
    then
      raise exception
        'Un fletero solo puede cambiar estado_actual y cobro_realizado.';
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
