# Entregas — Fleteros (frontend)

PWA para gestión y evidencia de entregas. Frontend en React + Vite, backend en
Supabase. Flujo del fletero (online): **login → pedidos asignados → detalle →
iniciar entrega → validar pago (últimos 4 de la tarjeta, contra el servidor) →
capturar evidencia (foto + documento, con compresión) → marcar
entregado/fallido**, persistiendo estado y eventos en Supabase.

> Antes de usar las validaciones hay que correr `sql/migracion_validaciones.sql`
> en el SQL Editor de Supabase (agrega columnas de pago/cobro y la función
> `validar_pago_pedido`). Los últimos 4 dígitos de la tarjeta se guardan en una
> columna protegida que la app NO puede leer: solo los compara la función del
> servidor. Nunca se guarda el número completo, vencimiento ni CVV.

## Stack

- **React 18 + Vite** — base del frontend.
- **vite-plugin-pwa** — manifest + service worker para instalar la app desde el
  navegador ("agregar a pantalla de inicio").
- **react-router-dom** — ruteo y protección de rutas.
- **@supabase/supabase-js** — auth + base de datos.

## Correr en local

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Crear el archivo de entorno:
   ```bash
   cp .env.example .env
   ```
   y completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores de
   tu proyecto (Supabase → Settings → API). Usá **solo la anon key**, nunca la
   service_role.
3. Levantar el server de desarrollo:
   ```bash
   npm run dev
   ```

## Estructura

```
src/
  lib/supabase.js          Cliente de Supabase (lee el .env)
  context/AuthContext.jsx  Sesión + perfil (rol, sucursal)
  components/
    ProtectedRoute.jsx     Protege rutas por sesión y rol
    StatusBadge.jsx        Etiqueta de estado del pedido
  pages/
    Login.jsx              Inicio de sesión
    FleteroPedidos.jsx     Lista de pedidos asignados (fletero)
    PedidoDetalle.jsx      Detalle (stub para el próximo paso)
  App.jsx                  Rutas + redirección por rol
  index.css                Sistema de diseño (tokens + estilos)
```

## Esquema (confirmado contra Supabase)

El código usa estos nombres reales de columna:

- **perfiles**: `id` (= id de auth), `nombre_completo`, `rol`, `activo`.
  La sucursal NO está acá: se vincula por `usuario_sucursales`.
- **pedidos**: `id`, `sucursal_id`, `fletero_id`, `zona_id`, `numero_pedido`,
  `cliente_nombre`, `cliente_documento`, `cliente_telefono`,
  `direccion_entrega`, `monto`, `notas`, `estado_actual`, `pedido_origen_id`,
  `created_at`, `updated_at`.
- Estados de `pedidos.estado_actual`: `pendiente`, `asignado`, `enviado`,
  `en_camino`, `entregado`, `fallido`, `devolucion_pendiente`,
  `devolucion_retirada`, `cambiado`. La lista del fletero muestra solo los
  activos: `asignado`, `enviado`, `en_camino`.

## Desplegar en Vercel

1. Subir este proyecto a un repo de GitHub.
2. En Vercel: **New Project** → importar el repo. Detecta Vite automáticamente
   (build: `npm run build`, output: `dist`).
3. En **Settings → Environment Variables** cargar:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Cada push a la rama principal redepliega solo.

> Para que el ruteo del lado del cliente (react-router) funcione en recargas de
> página, Vercel ya sirve `index.html` como fallback en proyectos Vite/SPA. Si
> alguna ruta diera 404 al recargar, agregá un `vercel.json` con un rewrite de
> `/(.*)` a `/index.html`.

## Íconos de la PWA (pendiente)

Falta agregar en `public/`: `icon-192.png`, `icon-512.png` e
`icon-512-maskable.png`. Hasta entonces la app funciona, pero el ícono de
instalación usa el favicon.

## Permisos (RLS) necesarios para el fletero

Para que el flujo de entrega funcione, el rol `fletero` necesita, sobre sus
propios pedidos:

- `update` en `pedidos` (columna `estado_actual`).
- `insert` en `pedido_eventos`.
- `insert` en `evidencias` y `insert` de objetos en el bucket `evidencias`
  (la policy del bucket usa `storage.foldername(name)[1]` = `pedido_id`, por
  eso la ruta del archivo arranca con el id del pedido).

Si al entregar aparece un error de permisos, casi seguro falta una de estas
policies.

## Próximo paso

- Escaneo real del DNI (PDF417) reemplazando la foto del documento, idealmente
  probado en un celular físico.
- Capa offline (IndexedDB / Dexie) para entregas sin señal.
- Panel de sucursal (carga de pedidos, asignación a fleteros).
