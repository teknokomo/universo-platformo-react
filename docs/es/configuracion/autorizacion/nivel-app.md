---
description: Aprende a configurar el control de acceso a nivel de aplicación en Universo Platformo React
---

# Aplicación

***

## Correo y contraseña

Universo Platformo utiliza un sistema de sesiones basado en [**Passport.js**](https://www.passportjs.org/) y Supabase. Cuando un usuario inicia sesión, sus credenciales se validan mediante Supabase, el token de acceso se guarda dentro de la sesión del servidor y cada llamada posterior se autoriza a través de esa sesión. Las cookies son HTTP-only, se renuevan automáticamente antes de caducar y pueden reforzarse con variables de entorno adicionales.

Para migrar del flujo básico heredado, configura Supabase y habilita los endpoints `/api/v1/auth` según se describe a continuación.

<figure><img src="../../.gitbook/assets/image (18) (1) (1).png" alt="" width="387"><figcaption></figcaption></figure>

### Variables de entorno obligatorias

Añade las siguientes variables a `packages/flowise-server/.env` (o proporciónalas mediante flags de CLI):

- `SESSION_SECRET` — Cadena secreta para firmar las sesiones de Express.
- `SUPABASE_URL` — URL de tu proyecto Supabase.
- `SUPABASE_ANON_KEY` — Clave anon pública (utilizada para CSRF e inicio de sesión).
- `SUPABASE_JWT_SECRET` — Secreto JWT de servicio para validar los tokens de acceso de Supabase.

### Ajustes opcionales de cookies

- `SESSION_COOKIE_NAME` — Nombre de la cookie (por defecto `up.sid`).
- `SESSION_COOKIE_MAXAGE` — Vida útil en milisegundos (por defecto `86400000`).
- `SESSION_COOKIE_SAMESITE` — Política SameSite (`lax`, `strict` o `none`).
- `SESSION_COOKIE_SECURE` — Establece `true` en producción con HTTPS.

### npm

1. Instala las dependencias

```bash
npm install -g flowise
```

2. Inicia el servidor con las variables necesarias (expórtalas en tu shell o guárdalas en `.env`):

```bash
SESSION_SECRET=super-secret SUPABASE_URL=https://xyz.supabase.co \
SUPABASE_ANON_KEY=public-anon SUPABASE_JWT_SECRET=service-secret \
npx flowise start
```

3. Abre [http://localhost:3000](http://localhost:3000) e inicia sesión mediante `/auth`.

### Docker

1. Ve a la carpeta `docker`.

```bash
cd docker
```

2. Crea un archivo `.env` con las nuevas variables de autenticación:

```dotenv
PORT=3000
SESSION_SECRET=super-secret
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=public-anon
SUPABASE_JWT_SECRET=service-secret
```

3. Declara los valores en `docker-compose.yml`:

```yaml
environment:
  - PORT=${PORT}
  - SESSION_SECRET=${SESSION_SECRET}
  - SUPABASE_URL=${SUPABASE_URL}
  - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
  - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
```

4. `docker compose up -d`
5. Abre [http://localhost:3000](http://localhost:3000)
6. Detén los contenedores con `docker compose stop`.

### Git clone

Si ejecutas desde el código fuente, añade las variables a `packages/flowise-server/.env`:

```dotenv
SESSION_SECRET=super-secret
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=public-anon
SUPABASE_JWT_SECRET=service-secret
```

## Usuario y contraseña (obsoleto)

La protección heredada `FLOWISE_USERNAME`/`FLOWISE_PASSWORD` se ha eliminado. Utiliza el flujo de sesión basado en Supabase descrito anteriormente para todos los despliegues nuevos.
