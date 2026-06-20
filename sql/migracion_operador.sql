-- ============================================================
-- MIGRACIÓN: rol "operador" de sucursal + auditoría de quién valida/entrega
--   * nuevo rol operador (mostrador de la sucursal), scopeado por usuario_sucursales
--   * columnas validado_por / entregado_por
--   * el operador puede: marcar recibido en sucursal (enviado -> recibido),
--     validar el pago en sucursal, y entregar retiros en mostrador
--   * el RPC de validación se generaliza para que lo pueda usar el operador
-- Correr DESPUÉS de migracion_estados_pago.sql, en Supabase -> SQL Editor.
-- ============================================================

-- 1) Sumar el rol operador al check de perfiles (sin importar cómo se llame
--    el constraint actual: lo buscamos y lo reemplazamos).
do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'perfiles'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%rol%';
  if c is not null then
    execute 'alter table perfiles drop constraint ' || quote_ident(c);
  end if;
end $$;

alter table perfiles add constraint perfiles_rol_check
  check (rol in ('admin', 'gerencia', 'encargado', 'fletero', 'operador'));

-- 2) Columnas de auditoría: quién validó y quién entregó.
alter table pedidos
  add column if not exists validado_por uuid references perfiles(id),
  add column if not exists entregado_por uuid references perfiles(id);

-- 3) RLS del operador (políticas aditivas, no tocan las existentes).
--    Acceso por pertenencia a la sucursal vía usuario_sucursales.
drop policy if exists pedidos_operador_select on pedidos;
create policy pedidos_operador_select on pedidos for select to authenticated
  using ( mi_rol() = 'operador'
    and exists (select 1 from usuario_sucursales us
                where us.usuario_id = auth.uid() and us.sucursal_id = pedidos.sucursal_id) );

drop policy if exists pedidos_operador_update on pedidos;
create policy pedidos_operador_update on pedidos for update to authenticated
  using ( mi_rol() = 'operador'
    and exists (select 1 from usuario_sucursales us
                where us.usuario_id = auth.uid() and us.sucursal_id = pedidos.sucursal_id) )
  with check ( mi_rol() = 'operador'
    and exists (select 1 from usuario_sucursales us
                where us.usuario_id = auth.uid() and us.sucursal_id = pedidos.sucursal_id) );

drop policy if exists sucursales_operador_select on sucursales;
create policy sucursales_operador_select on sucursales for select to authenticated
  using ( mi_rol() = 'operador'
    and exists (select 1 from usuario_sucursales us
                where us.usuario_id = auth.uid() and us.sucursal_id = sucursales.id) );

drop policy if exists pedido_eventos_operador_insert on pedido_eventos;
create policy pedido_eventos_operador_insert on pedido_eventos for insert to authenticated
  with check ( mi_rol() = 'operador'
    and exists (select 1 from pedidos p
                join usuario_sucursales us on us.sucursal_id = p.sucursal_id
                where p.id = pedido_eventos.pedido_id and us.usuario_id = auth.uid()) );

drop policy if exists evidencias_operador_insert on evidencias;
create policy evidencias_operador_insert on evidencias for insert to authenticated
  with check ( mi_rol() = 'operador'
    and exists (select 1 from pedidos p
                join usuario_sucursales us on us.sucursal_id = p.sucursal_id
                where p.id = evidencias.pedido_id and us.usuario_id = auth.uid()) );

drop policy if exists evidencias_operador_select on evidencias;
create policy evidencias_operador_select on evidencias for select to authenticated
  using ( mi_rol() = 'operador'
    and exists (select 1 from pedidos p
                join usuario_sucursales us on us.sucursal_id = p.sucursal_id
                where p.id = evidencias.pedido_id and us.usuario_id = auth.uid()) );

-- 4) Guard del fletero: misma lógica, sumando validado_por y entregado_por
--    a las columnas que el fletero NO puede tocar.
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
     or (new.validado_por           is distinct from old.validado_por)
     or (new.entregado_por          is distinct from old.entregado_por)
    then
      raise exception
        'Un fletero solo puede cambiar estado_actual y cobro_realizado.';
    end if;
  end if;
  return new;
end;
$$;

-- 5) RPC de validación generalizado: lo puede usar el fletero asignado
--    O un miembro de la sucursal que no sea fletero (operador/encargado).
--    Registra validado_por. El dato sensible nunca sale del servidor.
create or replace function validar_pago_pedido(p_pedido_id uuid, p_ultimos4 text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esperado text;
  v_suc uuid;
  v_fletero uuid;
  v_coincide boolean;
  v_autorizado boolean;
begin
  select tarjeta_ultimos4, sucursal_id, fletero_id
    into v_esperado, v_suc, v_fletero
  from pedidos
  where id = p_pedido_id;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  v_autorizado := (v_fletero = auth.uid())
    or (mi_rol() <> 'fletero'
        and exists (select 1 from usuario_sucursales us
                    where us.usuario_id = auth.uid() and us.sucursal_id = v_suc));

  if not v_autorizado then
    raise exception 'No autorizado para validar este pedido';
  end if;

  v_coincide := (v_esperado is not null and v_esperado = p_ultimos4);

  perform set_config('app.bypass_guard', 'on', true);
  update pedidos
     set pago_validado = v_coincide,
         validado_por  = auth.uid()
   where id = p_pedido_id;

  insert into pedido_eventos (pedido_id, estado, motivo, usuario_id)
  values (
    p_pedido_id,
    'validacion_pago',
    case when v_coincide then 'coincide' else 'no_coincide' end,
    auth.uid()
  );
  perform set_config('app.bypass_guard', 'off', true);

  return v_coincide;
end;
$$;

grant execute on function validar_pago_pedido(uuid, text) to authenticated;

-- 6) Al entregar, registrar quién entregó (fletero u operador), vía bypass
--    para no chocar con el guard cuando lo marca el propio fletero.
create or replace function pedidos_set_entregado_por()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado_actual = 'entregado'
     and old.estado_actual is distinct from 'entregado'
     and new.entregado_por is null
  then
    perform set_config('app.bypass_guard', 'on', true);
    update pedidos set entregado_por = auth.uid() where id = new.id;
    perform set_config('app.bypass_guard', 'off', true);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_pedidos_set_entregado_por on pedidos;
create trigger trg_pedidos_set_entregado_por
  after update on pedidos
  for each row execute function pedidos_set_entregado_por();

notify pgrst, 'reload schema';
