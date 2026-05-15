# Profile Service Backend (@universo/profile-backend)

SQL-first backend package for user profiles and user settings in Universo Platformo.

## Overview

This package owns profile CRUD, nickname checks, auto-created profiles, and persisted user settings.
It integrates through neutral `DbExecutor` and `DbSession` contracts and native SQL platform migration definitions.

## Package Structure

```text
packages/profile-backend/base/
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

- `ProfileService.getUserProfile()` and `updateProfile()` provide the main profile CRUD flow.
- `ProfileService.getOrCreateProfile()` auto-creates a profile with a generated unique nickname.
- `ProfileService.updateUserSettings()` deep-merges `admin` and `display` settings and creates a profile when needed.
- `profileStore.ts` is the canonical SQL-first persistence layer for profile reads and writes.
- `src/platform/migrations/` exports the native SQL definitions consumed by `@universo/migrations-platform`.

## Integration Pattern

```typescript
import { createProfileRoutes } from '@universo/profile-backend'
import { createKnexExecutor, getKnex } from '@universo/database'
import { getRequestDbExecutor } from '@universo/utils/database'

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

- Data is stored in `profiles.obj_profiles`.
- RLS policies limit rows to the authenticated user context.
- SQL functions support profile bootstrap, email update, and password validation or update flows.
- Platform bootstrap runs the package migration definitions before routes are mounted.

## Testing

```bash
pnpm --filter @universo/profile-backend test
pnpm --filter @universo/profile-backend build
```

Focused regression coverage exists for:

- profile service CRUD operations
- nickname availability and collision retry behavior
- `getOrCreateProfile()` auto-create flow
- `updateUserSettings()` deep-merge behavior
- route-level request handling

## Related Packages

- `@universo/auth-backend` supplies authenticated request context and RLS middleware.
- `@universo/database` supplies the shared Knex runtime and executor factories.
- `@universo/migrations-platform` registers the package's native SQL platform definitions.
