-- ============================================================
-- MIGRACIÓN: pago al fletero por pedido + carga de facturas
-- Correr en Supabase → SQL Editor. Incremental.
-- ============================================================

-- 1) Monto que la empresa le paga al fletero por este pedido (moneda)
alter table pedidos
  add column if not exists pago_fletero numeric(12,2);

-- 2) El fletero NO puede cambiar su propio pago (ni el método de entrega).
--    Reescribimos el guard sumando pago_fletero y metodo_entrega a lo bloqueado.
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
    if  (new.sucursal_id      is distinct from old.sucursal_id)
     or (new.fletero_id       is distinct from old.fletero_id)
     or (new.zona_id          is distinct from old.zona_id)
     or (new.numero_pedido    is distinct from old.numero_pedido)
     or (new.cliente_nombre   is distinct from old.cliente_nombre)
     or (new.cliente_documento is distinct from old.cliente_documento)
     or (new.cliente_telefono is distinct from old.cliente_telefono)
     or (new.direccion_entrega is distinct from old.direccion_entrega)
     or (new.monto            is distinct from old.monto)
     or (new.notas            is distinct from old.notas)
     or (new.metodo_pago      is distinct from old.metodo_pago)
     or (new.metodo_entrega   is distinct from old.metodo_entrega)
     or (new.tarjeta_ultimos4 is distinct from old.tarjeta_ultimos4)
     or (new.pago_validado    is distinct from old.pago_validado)
     or (new.cobra_fletero    is distinct from old.cobra_fletero)
     or (new.monto_a_cobrar   is distinct from old.monto_a_cobrar)
     or (new.pago_fletero     is distinct from old.pago_fletero)
     or (new.validacion_lugar is distinct from old.validacion_lugar)
     or (new.pedido_origen_id is distinct from old.pedido_origen_id)
    then
      raise exception
        'Un fletero solo puede cambiar estado_actual y cobro_realizado.';
    end if;
  end if;
  return new;
end;
$$;

-- 3) Permitir "factura" como tipo de evidencia
alter table evidencias drop constraint if exists evidencias_tipo_check;
alter table evidencias add constraint evidencias_tipo_check
  check (tipo in ('foto_entrega', 'escaneo_documento', 'firma', 'factura'));

-- 4) Permitir PDF (además de imágenes) en el bucket de evidencias
update storage.buckets
  set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  where id = 'evidencias';

notify pgrst, 'reload schema';
