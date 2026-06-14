# Entregas — Fleteros (frontend)

PWA para gestión y evidencia de entregas. Frontend en React + Vite, backend en
Supabase. Esta es la primera etapa: **login + ruteo por rol + lista de pedidos
asignados al fletero** (modo online).

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

## Supuestos de esquema a confirmar

El código asume estos nombres de columna. Si en tu base son distintos, hay que
ajustarlos:

- **perfiles**: `id` (= id de auth), `nombre`, `rol`, `sucursal_id`
  (ver `context/AuthContext.jsx`).
- **pedidos**: `id`, `fletero_id`, `estado`, `created_at`, y datos del cliente
  (`cliente_nombre`, `direccion`, etc. — la lista usa nombres con respaldo
  hasta confirmar; ver `pages/FleteroPedidos.jsx`).
- Estados de pedido usados: `pendiente`, `asignado`, `en_camino`, `entregado`,
  `fallido`.

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

## Próximo paso

Detalle del pedido + escaneo del documento (PDF417) + captura de evidencia, y
después la capa offline (IndexedDB / Dexie) y la compresión de imágenes.
