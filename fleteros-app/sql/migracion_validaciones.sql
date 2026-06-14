-- ============================================================
-- MIGRACIÓN: validación de pago e identidad + fletes con cobro
-- Ejecutar en Supabase → SQL Editor → New Query → pegar y RUN.
-- Es incremental (usa "if not exists"), no toca los datos existentes.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Nuevas columnas en "pedidos"
-- ------------------------------------------------------------
alter table pedidos
  add column if not exists metodo_pago text
    check (metodo_pago in ('tarjeta','transferencia','mercadopago','contra_entrega'))
    default 'tarjeta',

  -- IMPORTANTE: SOLO los últimos 4 dígitos. Nunca el número completo,
  -- el vencimiento ni el CVV (eso sería dato prohibido por PCI-DSS).
  add column if not exists tarjeta_ultimos4 text
    check (tarjeta_ultimos4 is null or tarjeta_ultimos4 ~ '^[0-9]{4}$'),

  -- Resultado de la validación hecha en la entrega (null = todavía sin validar)
  add column if not exists pago_validado boolean,

  -- Flete con cobro: el cliente le paga al fletero contra entrega
  add column if not exists cobra_fletero boolean not null default false,
  add column if not exists monto_a_cobrar numeric(12,2),
  add column if not exists cobro_realizado boolean,

  -- A futuro: dónde se valida la identidad/pago
  add column if not exists validacion_lugar text
    check (validacion_lugar in ('en_entrega','en_sucursal'))
    default 'en_entrega';

-- ------------------------------------------------------------
-- 2) Proteger el dato sensible a NIVEL DE COLUMNA
--    El rol "authenticated" (la app en el teléfono) NO puede leer
--    tarjeta_ultimos4 ni siquiera con una consulta directa. Solo la
--    función de validación (security definer) lo lee internamente.
-- ------------------------------------------------------------
revoke select (tarjeta_ultimos4) on pedidos from authenticated;
-- Nota: por esto la app debe seleccionar columnas explícitas, nunca "select *".

-- ------------------------------------------------------------
-- 3) Función de validación de pago
--    Compara los 4 dígitos que tipea el fletero contra el esperado,
--    SIN devolver nunca el valor esperado. Deja rastro en el historial
--    pero no guarda el número ingresado.
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
  -- Solo el fletero asignado puede validar su propio pedido.
  select tarjeta_ultimos4 into v_esperado
  from pedidos
  where id = p_pedido_id and fletero_id = auth.uid();

  if not found then
    raise exception 'Pedido no encontrado o no asignado a este usuario';
  end if;

  v_coincide := (v_esperado is not null and v_esperado = p_ultimos4);

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

-- Refrescar el caché de esquema de la API.
notify pgrst, 'reload schema';

-- ============================================================
-- RECORDATORIO de policies RLS que el fletero necesita (si fallan
-- las escrituras desde la app): update en pedidos, insert en
-- pedido_eventos e insert en evidencias, sobre SUS pedidos.
-- ============================================================
