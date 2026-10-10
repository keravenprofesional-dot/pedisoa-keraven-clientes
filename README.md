# KERAVEN PROFESIONAL

Sistema de pedidos, clientes, pagos y despacho. Frontend en React + Tailwind,
backend/base de datos en Supabase (Postgres).

**Acceso de las clientas:** no usan contraseña propia — el administrador
las registra desde el panel con nombre, cédula, teléfono, segundo teléfono,
correo, dirección, ciudad, etc. El sistema genera un **código de acceso
único** (ej. `4KX9-PQ2M`) que se le entrega a la clienta. Ella entra
escribiendo **su teléfono o su correo, más ese código**. Cada clienta
también recibe un número de cliente propio (`CL-000042`), visible en su
perfil y en cada pedido que hace.

## Estructura

```
keraven/
├── database/
│   ├── schema.sql                    → Ejecutar en Supabase (SQL Editor)
│   └── functions/create-client/      → Edge Function: crea clientas + código
└── frontend/                         → App React (Vite)
```

## 1. Crear el proyecto en Supabase

1. Entra a https://supabase.com → **New project**.
2. Ve a **SQL Editor** → pega el contenido completo de `database/schema.sql`
   → **Run**. Esto crea todas las tablas, la secuencia de números de pedido
   (`KP-000001`, `KP-000002`…), la numeración de clientas (`CL-000001`…),
   la generación automática de códigos de acceso, los triggers y las
   políticas de seguridad (RLS).
3. Ve a **Authentication → Providers → Phone** y actívalo. **No** necesitas
   configurar un proveedor de SMS — no se envía ningún mensaje: el teléfono
   se usa solo como identificador junto con el código de acceso (contraseña).
   Si Supabase te pide seleccionar un proveedor para guardar el cambio,
   cualquiera sirve (no se usará para enviar nada).
4. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public key`

## 2. Desplegar la Edge Function `create-client`

Esta función es la que crea a cada clienta junto con su código de acceso
(usa la Service Role Key, por eso vive en el servidor y no en el frontend).

```bash
npm install -g supabase        # si no tienes la CLI de Supabase
supabase login
cd keraven
supabase link --project-ref TU-PROJECT-REF   # lo ves en la URL de tu proyecto
supabase functions deploy create-client
```

Supabase ya inyecta automáticamente `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY` dentro de la función — no hay que configurar
nada adicional.

## 3. Configurar el frontend

```bash
cd frontend
cp .env.example .env
```

Edita `.env` y pega tu URL y anon key de Supabase.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

## 4. Crear el primer administrador

El panel admin es quien crea clientas (con su código). Pero el primer
administrador se crea a mano, una sola vez:

1. **Authentication → Users → Add user** en el panel de Supabase → ingresa
   un correo cualquiera (ej. `admin@keraven.local`) y una contraseña.
2. En **SQL Editor**:

```sql
insert into profiles (id, role, full_name)
values ('UUID-DEL-USUARIO', 'administrador', 'Tu nombre');
```

(El UUID lo ves en Authentication → Users, junto al correo que creaste.)

3. Ese administrador entra a `/login` de la app usando ese correo y
   contraseña (el login por código es solo para clientas; para
   administrador/despacho, ver nota abajo).

> Nota: el `Login.jsx` actual está pensado para clientas (código de acceso).
> Para administrador/despacho falta una pantalla de login con correo y
> contraseña normales — es la siguiente pieza a construir antes de dar
> el panel admin a tu equipo de despacho.

## 5. Crear clientas desde el panel admin

Una vez tengas un administrador:

1. Entra al panel → **Clientas** → **Nueva clienta**.
2. Llena nombre, teléfono, sector, condición de pago.
3. Al guardar, el sistema genera el código y lo muestra en pantalla — cópialo
   y entrégaselo a la clienta (WhatsApp, impreso en su recibo, etc.).
4. La clienta entra a la app y escribe ese código en la pantalla de login.

## 6. Subir a GitHub

```bash
cd keraven
git init
git add .
git commit -m "Keraven Profesional - versión inicial"
git branch -M main
git remote add origin TU-URL-DE-GITHUB
git push -u origin main
```

**Importante:** el archivo `.env` con tus llaves reales NO debe subirse a
GitHub — ya está cubierto por `.gitignore`.

## 7. Desplegar el frontend

Recomendado: Vercel o Netlify, conectando el repositorio de GitHub.

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
  (las mismas del paso 1).

## Qué incluye esta versión (Fases 1–11 del plan)

- Acceso de clientas por código único generado al crearlas (sin SMS ni
  correo real de por medio).
- Catálogo con búsqueda y filtro por categoría.
- Carrito, checkout (entrega, forma de pago, avance/crédito).
- Número de pedido automático y seguro (`KP-000001…`), generado por
  trigger en la base de datos — nunca desde el frontend.
- Historial de pedidos, recibo imprimible/PDF (usando impresión del navegador),
  seguimiento visual del estado del pedido.
- Panel administrativo: dashboard, tablero de pedidos con búsqueda y cambio
  de estado, preparación con checklist, despacho, productos, alta de
  clientas con generación de código, configuración de cuentas bancarias.
- Seguridad por rol (RLS en Postgres): una clienta solo puede ver/crear
  sus propios pedidos, aunque intente manipular la URL o el ID.
- Logo real de Keraven Profesional integrado.

## Pendiente para producción (Fase 12 en adelante)

- Pantalla de login con correo/contraseña para administrador y despacho
  (hoy solo existe el login por código, pensado para clientas).
- Reenviar/regenerar el código de una clienta que lo perdió.
- Cifrado de cédula en la app antes de guardar (`cedula_enc`).
- Registro de pagos parciales sobre el balance (tabla `payments` ya existe;
  falta la pantalla de "Cuentas por cobrar").
- Auditoría detallada de cambios (la tabla `order_status_history` ya
  registra cambios de estado; se puede ampliar a clientes y productos).
- Pruebas end-to-end antes de salir a producción.
