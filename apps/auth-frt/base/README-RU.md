# @universo/auth-frt

Переиспользуемые примитивы авторизации (React-компоненты и хуки) для Universo Platformo. Пакет собирается в формате CJS и ESM и подключается напрямую из `packages/ui`.

## Что входит

- `createAuthClient(options)` — Axios-клиент с поддержкой CSRF и cookies
- `useSession({ client })` — React-хук для `/auth/me`, `/auth/logout`
- `LoginForm` — контролируемая форма входа с настраиваемыми подписями

## Использование

```ts
import { createAuthClient, LoginForm, useSession } from '@universo/auth-frt'

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/v1` })

const { user, refresh } = useSession({ client: authClient })
```

```tsx
<LoginForm
  client={authClient}
  labels={{ submit: 'Войти', submitting: 'Входим…' }}
  onSuccess={refresh}
/>
```

## Сборка

```bash
pnpm --filter @universo/auth-frt build
```

Результат сборки: CommonJS в `dist/` и ESM в `dist/esm/`.
