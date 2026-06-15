-- ============================================================
-- HARDENING: el fletero solo puede modificar estado_actual y cobro_realizado
-- Correr DESPUÉS de migracion_validaciones.sql, en el SQL Editor de Supabase.
-- Cierra el agujero de que un fletero altere monto, tarjeta_ultimos4,
-- pago_validado, dirección, etc. usando la API directamente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Trigger guardián sobre UPDATE de pedidos
-- ------------------------------------------------------------
create or replace function pedidos_fletero_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo aplica a fleteros. Admin/encargado pasan sin restricción
  -- (su control de columnas se maneja en el panel de sucursal a futuro).
  if mi_rol() = 'fletero'
     -- La función validar_pago_pedido habilita este "permiso" para poder
     -- escribir pago_validado. El fletero NO puede prenderlo por su cuenta:
     -- desde la API (PostgREST) no se puede setear una variable de sesión.
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
     or (new.tarjeta_ultimos4 is distinct from old.tarjeta_ultimos4)
     or (new.pago_validado    is distinct from old.pago_validado)
     or (new.cobra_fletero    is distinct from old.cobra_fletero)
     or (new.monto_a_cobrar   is distinct from old.monto_a_cobrar)
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

drop trigger if exists trg_pedidos_fletero_guard on pedidos;
create trigger trg_pedidos_fletero_guard
  before update on pedidos
  for each row execute function pedidos_fletero_guard();

-- ------------------------------------------------------------
-- 2) Reemplazar validar_pago_pedido para que habilite el bypass
--    (idéntica a la de la migración, más la línea set_config)
-- ------------------------------------------------------------
create or replace function validar_pago_pedido(p_pedido_id uuid, p_ultimos4 text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esperado text;
  v_coincide boolean;
begin
  select tarjeta_ultimos4 into v_esperado
  from pedidos
  where id = p_pedido_id and fletero_id = auth.uid();

  if not found then
    raise exception 'Pedido no encontrado o no asignado a este usuario';
  end if;

  v_coincide := (v_esperado is not null and v_esperado = p_ultimos4);

  -- Habilitar el bypass del guard SOLO dentro de esta transacción
  perform set_config('app.bypass_guard', 'on', true);
  update pedidos set pago_validado = v_coincide where id = p_pedido_id;

  insert into pedido_eventos (pedido_id, estado, motivo, usuario_id)
  values (
    p_pedido_id,
    'validacion_pago',
    case when v_coincide then 'coincide' else 'no_coincide' end,
    auth.uid()
  );

  return v_coincide;
end;
$$;

grant execute on function validar_pago_pedido(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 3) OPCIONAL — solo si el nombre de la zona aparece vacío en el detalle.
--    Activalo únicamente si "zonas" tiene RLS habilitado sin lectura.
-- ============================================================
-- drop policy if exists "zonas_select_autenticados" on zonas;
-- create policy "zonas_select_autenticados"
--   on zonas for select to authenticated using (true);
