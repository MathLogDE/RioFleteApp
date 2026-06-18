-- ============================================================
-- DATOS DE PRUEBA — fletero + pedidos para testear el flujo
-- Requisitos: haber corrido antes TODAS las migraciones y el seed de
-- sucursales. Crear primero el fletero en el dashboard
-- (Authentication → Add user) para tener su UUID.
--
-- Editá las DOS líneas marcadas y ejecutá todo el bloque.
-- ============================================================
do $$
declare
  v_fletero  uuid := '<<PEGAR_UUID_DEL_FLETERO>>';  -- <-- del dashboard
  v_codigo   text := '008';                          -- <-- código de sucursal (008 = SAN JUAN)
  v_sucursal uuid;
  v_p1 uuid; v_p2 uuid; v_p3 uuid;
begin
  select id into v_sucursal from sucursales where codigo = v_codigo;
  if v_sucursal is null then
    raise exception 'No existe la sucursal con código %', v_codigo;
  end if;

  -- Perfil mínimo del fletero (el resto de la ficha queda para después)
  insert into perfiles (id, nombre_completo, rol, activo, tipo_persona)
  values (v_fletero, 'Fletero de Prueba', 'fletero', true, 'fisica')
  on conflict (id) do update set rol = 'fletero', activo = true;

  insert into usuario_sucursales (usuario_id, sucursal_id)
  values (v_fletero, v_sucursal)
  on conflict do nothing;

  -- Pedido 1 — TARJETA, valida el fletero (caso completo: 4 dígitos = 1234)
  insert into pedidos
    (sucursal_id, fletero_id, numero_pedido, cliente_nombre, cliente_documento,
     cliente_telefono, direccion_entrega, monto, notas, estado_actual,
     metodo_pago, tarjeta_ultimos4, metodo_entrega, validacion_lugar)
  values
    (v_sucursal, v_fletero, 'TEST-001', 'Rocío Giménez', '32114508',
     '264 512-3344', 'Av. Libertador 1240', 86500, 'Tocar timbre del fondo',
     'asignado', 'tarjeta', '1234', 'flete', 'en_entrega')
  returning id into v_p1;
  insert into pedido_articulos (pedido_id, codigo, descripcion, cantidad) values
    (v_p1, 'ART-100', 'Caja de zapatillas', 1),
    (v_p1, 'ART-205', 'Remera algodón', 3);

  -- Pedido 2 — CONTRA ENTREGA (el fletero cobra $42.000)
  insert into pedidos
    (sucursal_id, fletero_id, numero_pedido, cliente_nombre, cliente_documento,
     cliente_telefono, direccion_entrega, monto, estado_actual,
     metodo_pago, metodo_entrega, validacion_lugar, cobra_fletero, monto_a_cobrar)
  values
    (v_sucursal, v_fletero, 'TEST-002', 'Hernán Quiroga', '29880142',
     '264 488-1107', 'Mendoza 755', 42000, 'enviado',
     'contra_entrega', 'flete', 'en_entrega', true, 42000)
  returning id into v_p2;
  insert into pedido_articulos (pedido_id, codigo, descripcion, cantidad) values
    (v_p2, 'ART-310', 'Auriculares', 1);

  -- Pedido 3 — FLETE con validación EN SUCURSAL (fletero solo sube foto)
  insert into pedidos
    (sucursal_id, fletero_id, numero_pedido, cliente_nombre, cliente_documento,
     cliente_telefono, direccion_entrega, monto, estado_actual,
     metodo_pago, tarjeta_ultimos4, metodo_entrega, validacion_lugar)
  values
    (v_sucursal, v_fletero, 'TEST-003', 'Valentina Ríos', '40221769',
     '264 600-2299', 'Calle 5 esq. 11', 119900, 'en_camino',
     'tarjeta', '9999', 'flete', 'en_sucursal')
  returning id into v_p3;
  insert into pedido_articulos (pedido_id, codigo, descripcion, cantidad) values
    (v_p3, 'ART-512', 'Cafetera', 1),
    (v_p3, 'ART-077', 'Filtros (pack)', 2);

  raise notice 'Listo: fletero y 3 pedidos de prueba creados.';
end $$;
