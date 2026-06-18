-- ============================================================
-- DATOS: sucursales (depósitos)
-- Correr en Supabase → SQL Editor. Es re-ejecutable (on conflict).
-- ============================================================

-- Agregar el código de depósito. Texto, para preservar ceros a la izquierda.
alter table sucursales
  add column if not exists codigo text unique;

insert into sucursales (codigo, nombre, direccion) values
  ('002', 'CENT. DISTRIB. (CORDOBA)',     'CORDOBA (CARBONADA)'),
  ('001', 'CENT. DISTRIB. (RIO SEGUNDO)', 'RUTA 9, RIO SEGUNDO'),
  ('005', 'ENE & EME',                    'PJE. EMILIO HUESPE 131'),
  ('006', 'JESUS MARIA',                  'KENNEDY 165'),
  ('016', 'MENDOZA',                      'JOAQUIN V. GONZALEZ 450'),
  ('031', 'PASEO RIVERA',                 'BODERAU Y RICARDO ROJAS'),
  ('010', 'RIO SEGUNDO',                  'SAN JUAN Y LAS HERAS'),
  ('011', 'RODRIGUEZ BUSTO',              'FRAY LUIS BELTRAN Y CARDEÑOSA'),
  ('039', 'ROSARIO',                      'BV. OROÑO 6000-ROSARIO-SANTA FE'),
  ('033', 'SABATTINI',                    'SABATTINI 3250'),
  ('017', 'SALTA',                        'AV. EX COMB. MALVINAS Y AV. TAVELLA'),
  ('008', 'SAN JUAN',                     'E. ORTIZ Y LATERAL CIRCUNVALACION'),
  ('034', 'SANTIAGO DEL ESTERO',          'AV. PERON S/N'),
  ('009', 'VILLA ALLENDE',                'RIO DE JANEIRO 1725'),
  ('044', 'W - DEPOSITO E-COMMERCE',      'CORDOBA (CARBONADA)')
on conflict (codigo) do nothing;
