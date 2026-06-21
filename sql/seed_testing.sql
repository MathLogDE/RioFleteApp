-- ============================================================
-- SEED DE TESTING — un pedido por cada camino de la app
-- Reemplaza al viejo seed_pruebas.sql (este no pide pegar UUID).
--
-- Requisitos previos (en este orden):
--   1) Todas las migraciones aplicadas (validaciones, articulos_estado,
--      estados_pago, operador, conciliacion, dashboard).
--   2) seed_sucursales.sql corrido (usa la sucursal 008 = SAN JUAN).
--   3) Usuarios creados en Auth + perfil: al menos un rol 'fletero'.
--      (y admin/gerencia/encargado/operador para recorrer los roles).
--   4) Datos viejos borrados (bloque de limpieza).
--
-- Resuelve los UUID por rol -> no hay que pegar nada.
-- Corré el bloque entero en Supabase -> SQL Editor.
-- ============================================================
do $$
declare
  v_suc   uuid;
  v_flet  uuid;
  v_admin uuid;
  v_id    uuid;
begin
  select id into v_suc from sucursales where codigo = '008';
  if v_suc is null then
    raise exception 'Falta la sucursal 008. Corré seed_sucursales.sql primero.';
  end if;

  select id into v_flet from perfiles where rol = 'fletero' and activo order by id limit 1;
  if v_flet is null then
    raise exception 'No hay ningún perfil con rol fletero. Creá ese usuario primero.';
  end if;

  -- Para el pedido ya "pagado": quién lo marcó. Si no hay admin/gerencia, queda null.
  select id into v_admin from perfiles where rol in ('admin','gerencia') order by id limit 1;

  -- ----------------------------------------------------------------
  -- 1) ENVIADO, sin fletero  ->  el OPERADOR lo "recibe" (enviado->recibido)
  -- ----------------------------------------------------------------
  insert into pedidos
    (sucursal_id, numero_pedido, cliente_nombre, cliente_documento, cliente_telefono,
     direccion_entrega, monto, estado_actual, metodo_pago, metodo_entrega,
     validacion_lugar, tarjeta_ultimos4, pago_fletero)
  values
    (v_suc, 'TEST-01', 'Laura Funes', '30111222', '264 400-0001',
     'Av. Rioja 1200', 54000, 'enviado', 'tarjeta', 'flete',
     'en_sucursal', '1111', 6000)
  returning id into v_id;
  insert into pedido_articulos (pedido_id, codigo, descripcion, cantidad)
  values (v_id, 'ART-01', 'Lámpara de pie', 1);

  -- ----------------------------------------------------------------
  -- 2) RECIBIDO, tarjeta, validar EN SUCURSAL, sin fletero
  --    -> el OPERADOR valida la tarjeta (RPC); luego el ENCARGADO asigna fletero
  -- ----------------------------------------------------------------
  insert into pedidos
    (sucursal_id, numero_pedido, cliente_nombre, cliente_documento, cliente_telefono,
     direccion_entrega, monto, estado_actual, metodo_pago, metodo_entrega,
     validacion_lugar, tarjeta_ultimos4, pago_fletero)
  values
    (v_suc, 'TEST-02', 'Diego Sosa', '28999777', '264 400-0002',
     'Mendoza 455', 73200, 'recibido', 'tarjeta', 'flete',
     'en_sucursal', '2222', 6000)
  returning id into v_id;
  insert into pedido_articulos (pedido_id, codigo, descripcion, cantidad)
  values (v_id, 'ART-02', 'Juego de sábanas', 2);

  -- ----------------------------------------------------------------
  -- 3) RECIBIDO, RETIRO EN MOSTRADOR (metodo_entrega='sucursal'), tarjeta
  --    -> el OPERADOR valida la tarjeta y entrega en mostrador
  -- ----------------------------------------------------------------
  insert into pedidos
    (sucursal_id, numero_pedido, cliente_nombre, cliente_documento, cliente_telefono,
     direccion_entrega, monto, estado_actual, metodo_pago, metodo_entrega,
     validacion_lugar, tarjeta_ultimos4)
  values
    (v_suc, 'TEST-03', 'Marina Paez', '35222111', '264 400-0003',
     'Retira en sucursal', 28900, 'recibido', 'tarjeta', 'sucursal',
     'en_entrega', '3333')
  returning id into v_id;
  insert into pedido_articulos (pedido_id, codigo, descripcion, cantidad)
  values (v_id, 'ART-03', 'Set de copas', 1);

  -- ----------------------------------------------------------------
  -- 4) ASIGNADO al fletero, tarjeta, validar EN LA ENTREGA
  --    -> el FLETERO valida la tarjeta + foto documento + foto entrega + entregar
  -- ----------------------------------------------------------------
  insert into pedidos
    (sucursal_id, fletero_id, numero_pedido, cliente_nombre, cliente_documento,
     cliente_telefono, direccion_entrega, monto, estado_actual, metodo_pago,
     metodo_entrega, validacion_lugar, tarjeta_ultimos4, pago_fletero)
  values
    (v_suc, v_flet, 'TEST-04', 'Carla Ortiz', '31444555', '264 400-0004',
     'Calle 9 esq. 12', 96500, 'asignado', 'tarjeta', 'flete',
     'en_entrega', '4444', 7000)
  returning id into v_id;
  insert into pedido_articulos (pedido_id, codigo, descripcion, cantidad)
  values (v_id, 'ART-04', 'Cuadro decorativo', 1), (v_id, 'ART-05', 'Maceta cerámica', 2);

  -- ----------------------------------------------------------------
  -- 5) ASIGNADO al fletero, CONTRA ENTREGA (el fletero cobra efectivo)
  --    -> el FLETERO cobra $42.000, entrega, marca cobro_realizado
  -- ----------------------------------------------------------------
  insert into pedidos
    (sucursal_id, fletero_id, numero_pedido, cliente_nombre, cliente_documento,
     cliente_telefono, direccion_entrega, monto, estado_actual, metodo_pago,
     metodo_entrega, validacion_lugar, cobra_fletero, monto_a_cobrar, pago_fletero)
  values
    (v_suc, v_flet, 'TEST-05', 'Hernán Quiroga', '29880142', '264 400-0005',
     'San Luis 980', 42000, 'asignado', 'contra_entrega', 'flete',
     'en_entrega', true, 42000, 7000)
  returning id into v_id;
  insert into pedido_articulos (pedido_id, codigo, descripcion, cantidad)
  values (v_id, 'ART-06', 'Auriculares', 1);

  -- ----------------------------------------------------------------
  -- 6) EN CAMINO, tarjeta YA validada en sucursal (pago_validado = true)
  --    -> el FLETERO solo sube foto de entrega y entrega (no valida tarjeta)
  -- ----------------------------------------------------------------
  insert into pedidos
    (sucursal_id, fletero_id, numero_pedido, cliente_nombre, cliente_documento,
     cliente_telefono, direccion_entrega, monto, estado_actual, metodo_pago,
     metodo_entrega, validacion_lugar, tarjeta_ultimos4, pago_validado, pago_fletero)
  values
    (v_suc, v_flet, 'TEST-06', 'Valentina Ríos', '40221769', '264 400-0006',
     'Av. Libertador 3400', 119900, 'en_camino', 'tarjeta', 'flete',
     'en_sucursal', '9999', true, 8000)
  returning id into v_id;
  insert into pedido_articulos (pedido_id, codigo, descripcion, cantidad)
  values (v_id, 'ART-07', 'Cafetera', 1);

  -- ----------------------------------------------------------------
  -- 7) ENTREGADO + FACTURADO  ->  GERENCIA / pagos lo ve "por pagar"
  --    (agrupado por fletero, con enlace "Ver factura")
  -- ----------------------------------------------------------------
  insert into pedidos
    (sucursal_id, fletero_id, numero_pedido, cliente_nombre, direccion_entrega, monto,
     estado_actual, metodo_pago, metodo_entrega, validacion_lugar,
     pago_validado, entregado_por, estado_pago, pago_fletero)
  values
    (v_suc, v_flet, 'TEST-07', 'Pablo Medina', 'Rivadavia 210', 64000,
     'entregado', 'tarjeta', 'flete', 'en_entrega',
     true, v_flet, 'facturado', 8500)
  returning id into v_id;
  -- Evidencia de factura: hace aparecer el enlace "Ver factura".
  -- El archivo no existe físicamente, así que el link dará error al abrirlo
  -- (ver nota). Para la conciliación en sí no hace falta el PDF real.
  insert into evidencias (pedido_id, tipo, archivo_url)
  values (v_id, 'factura', v_id || '/factura_seed.pdf');

  -- ----------------------------------------------------------------
  -- 8) ENTREGADO + PAGADO  ->  GERENCIA / pagos lo ve en "pagados" (historial)
  -- ----------------------------------------------------------------
  insert into pedidos
    (sucursal_id, fletero_id, numero_pedido, cliente_nombre, direccion_entrega, monto,
     estado_actual, metodo_pago, metodo_entrega, validacion_lugar,
     pago_validado, entregado_por, estado_pago, pago_fletero,
     pago_fletero_metodo, pago_fletero_fecha, pago_fletero_pagado_por)
  values
    (v_suc, v_flet, 'TEST-08', 'Sofía Bravo', 'Tucumán 55', 38500,
     'entregado', 'transferencia', 'flete', 'en_entrega',
     true, v_flet, 'pagado', 7000,
     'transferencia', now() - interval '2 days', v_admin)
  returning id into v_id;

  -- ----------------------------------------------------------------
  -- 9) FALLIDO  ->  aparece como "no entregado" en el DASHBOARD
  -- ----------------------------------------------------------------
  insert into pedidos
    (sucursal_id, fletero_id, numero_pedido, cliente_nombre, direccion_entrega, monto,
     estado_actual, metodo_pago, metodo_entrega, validacion_lugar, pago_fletero)
  values
    (v_suc, v_flet, 'TEST-09', 'Ramiro Vega', 'Catamarca 700', 51000,
     'fallido', 'tarjeta', 'flete', 'en_entrega', 0)
  returning id into v_id;

  raise notice 'Seed OK: 9 pedidos de prueba creados para la sucursal 008.';
end $$;
