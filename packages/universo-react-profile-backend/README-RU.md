# Profile Service Backend (@universo-react/profile-backend)

SQL-first backend-пакет для пользовательских профилей и пользовательских настроек в Universo Platformo.

## Overview

Этот пакет отвечает за CRUD профилей, проверку nickname, автоматическое создание профилей и сохранение пользовательских настроек.
Он интегрируется через нейтральные контракты `DbExecutor` и `DbSession`, а также через native SQL platform migration definitions.

## Package Structure

```text
packages/universo-react-profile-backend/
├── src/
│   ├── controllers/          # REST controller helpers
│   ├── persistence/          # SQL-first profile queries
│   ├── platform/migrations/  # Native SQL platform migration definitions
│   ├── routes/               # Express routes
│   ├── services/             # ProfileService business logic
│   ├── tests/                # Route and service regression tests
│   ├── types/                # DTOs and settings contracts
│   └── index.ts              # Public package surface
├── jest.config.js
├── package.json
└── tsconfig.json
```

## Runtime Responsibilities

-   `ProfileService.getUserProfile()` и `updateProfile()` реализуют основной CRUD-поток профиля.
-   `ProfileService.getOrCreateProfile()` автоматически создаёт профиль с уникальным сгенерированным nickname.
-   `ProfileService.updateUserSettings()` глубоко объединяет ветки `admin` и `display` и создаёт профиль при необходимости.
-   `profileStore.ts` является каноническим SQL-first persistence layer для чтения и записи профилей.
-   `src/platform/migrations/` экспортирует native SQL definitions, которые потребляет `@universo-react/migrations-platform`.

## Integration Pattern

```typescript
import { createProfileRoutes } from '@universo-react/profile-backend'
import { createKnexExecutor, getKnex } from '@universo-react/database'
import { getRequestDbExecutor } from '@universo-react/utils/database'

const profileRoutes = createProfileRoutes(
    {
        getDbExecutor: () => createKnexExecutor(getKnex()),
        getRequestDbExecutor: (req) => getRequestDbExecutor(req, createKnexExecutor(getKnex()))
    },
    ensureAuthWithRls
)

app.use('/api/v1/profile', profileRoutes)
```

## Database Notes

-   Данные хранятся в `profiles.obj_profiles`.
-   RLS policies ограничивают строки контекстом аутентифицированного пользователя.
-   SQL-функции поддерживают bootstrap профиля, обновление email и потоки проверки или смены пароля.
-   Platform bootstrap выполняет migration definitions пакета до монтирования роутов.

## Testing

```bash
pnpm --filter @universo-react/profile-backend test
pnpm --filter @universo-react/profile-backend build
```

Фокусное regression coverage существует для:

-   profile service CRUD operations
-   nickname availability и collision retry behavior
-   auto-create flow в `getOrCreateProfile()`
-   deep-merge behavior в `updateUserSettings()`
-   route-level request handling

## Related Packages

-   `@universo-react/auth-backend` поставляет контекст аутентифицированного запроса и RLS middleware.
-   `@universo-react/database` поставляет shared Knex runtime и executor factories.
-   `@universo-react/migrations-platform` регистрирует native SQL platform definitions пакета.
