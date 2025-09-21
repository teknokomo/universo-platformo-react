# @universo/auth-frt

Reusable authentication primitives (React components + hooks) for Universo Platformo. The package ships a dual ESM/CJS build and is consumed directly from `packages/ui`.

## What’s inside

- `createAuthClient(options)` — Axios client with CSRF handling and cookie support
- `useSession({ client })` — React hook for `/auth/me`, `/auth/logout`
- `LoginForm` — controlled form component with customizable labels

## Usage

```ts
import { createAuthClient, LoginForm, useSession } from '@universo/auth-frt'

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/v1` })

const { user, refresh } = useSession({ client: authClient })
```

```tsx
<LoginForm
  client={authClient}
  labels={{ submit: 'Sign in', submitting: 'Signing in…' }}
  onSuccess={refresh}
/>
```

## Build

```bash
pnpm --filter @universo/auth-frt build
```

The build produces CommonJS output in `dist/` and ESM output in `dist/esm/`.
