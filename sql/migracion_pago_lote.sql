-- ============================================================
-- MIGRACIÓN: marcar pagado un lote de fletes (gerencia/admin)
--
-- Antes el panel de pagos hacía un UPDATE directo sobre pedidos. Acá lo
-- movemos a una RPC SECURITY DEFINER (mismo patrón que autorizar_perfil /
-- admin_*): corre como dueño, así no depende de la RLS de update de pedidos,
-- valida el rol y devuelve cuántos pedidos quedaron marcados (para que el UI
-- avise si no había nada por pagar).
--
-- Marca TODOS los pedidos 'facturado' de ese fletero (opcionalmente acotado a
-- una sucursal) como 'pagado', con método/fecha/quién pagó.
-- Correr en Supabase -> SQL Editor. Incremental.
-- ============================================================

create or replace function marcar_pago_fletero(
  p_fletero_id uuid,
  p_metodo text,
  p_sucursal_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if mi_rol() not in ('gerencia', 'admin') then
    raise exception 'Solo gerencia o admin pueden registrar pagos.';
  end if;
  if p_metodo not in ('sucursal', 'transferencia') then
    raise exception 'Método de pago inválido.';
  end if;

  update pedidos
     set estado_pago = 'pagado',
         pago_fletero_metodo = p_metodo,
         pago_fletero_fecha = now(),
         pago_fletero_pagado_por = auth.uid()
   where estado_pago = 'facturado'
     and fletero_id = p_fletero_id
     and (p_sucursal_id is null or sucursal_id = p_sucursal_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function marcar_pago_fletero(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';
