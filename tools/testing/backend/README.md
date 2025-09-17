# Backend testing utilities

Reusable Jest configuration, setup helpers, and mocks for backend services live in this folder. They provide a consistent testing experience across all Universo Platformo Node applications.

## Base Jest configuration

Add the shared configuration to a backend app by importing the base config from `tools/testing/backend/jest.base.config.cjs` and extending it if necessary:

```js
// apps/example-srv/base/jest.config.cjs
const baseConfig = require('../../tools/testing/backend/jest.base.config.cjs')

module.exports = {
  ...baseConfig,
  displayName: 'example-srv',
  // Add overrides such as custom coverage exclusions when needed.
}
```

The base configuration provides:

- `ts-jest` preset with the workspace `tsconfig.json` so path aliases just work.
- Node test environment, source roots, and default `testMatch` patterns.
- Consistent coverage collection that excludes generated artefacts.
- `setupFilesAfterEnv` pointing to `setupAfterEnv.ts` (described below).
- Module name mapping for `@testing/backend/*` so tests can import shared helpers without relative paths.

## Runtime setup (`setupAfterEnv.ts`)

The setup file runs after the Jest environment is created and is responsible for:

- Registering reusable globals: `createMockSupabaseClient`, `createMockRepository`, `createMockQueryBuilder`, and `createMockDataSource`.
- Providing a default mock implementation for `@supabase/supabase-js`'s `createClient`.
- Adding the custom matcher `toHaveBeenCalledOnceWith` to Jest's `expect`.
- Clearing mocks after every test and forcing `NODE_ENV` to `test` when it is not defined.

All helpers are exported so they can be imported explicitly as well:

```ts
import { createMockDataSource } from '@testing/backend/setupAfterEnv'
```

## TypeORM helpers (`typeormMocks.ts`)

`createMockQueryBuilder`, `createMockRepository`, and `createMockDataSource` create deeply mocked TypeORM primitives used by service unit tests. They are chainable by default and expose the most common terminal methods (`getOne`, `getMany`, `execute`, etc.).

```ts
import { createMockDataSource } from '@testing/backend/setupAfterEnv'

const dataSource = createMockDataSource()
const repository = dataSource.getRepository(MyEntity)
repository.findOne.mockResolvedValue(mockEntity)
```

A convenience `asMockRepository` cast helper is also provided for safely treating existing repositories as mocks inside tests.

## Supabase client mock

`createMockSupabaseClient` produces an object compatible with the Supabase JavaScript client. It includes the most common query builder methods (`select`, `insert`, `eq`, `single`, etc.), auth helpers, storage buckets, and edge function invocation. Consumers can provide overrides:

```ts
const supabase = createMockSupabaseClient({
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: mockSession } })
  }
})
```

Because `setupAfterEnv.ts` automatically assigns this factory to `global.createMockSupabaseClient`, tests may use it without importing when preferred.

## Path aliases

The repository root `tsconfig.json` defines the `@testing/backend/*` path alias. Any backend package that relies on the shared utilities should ensure its TypeScript configuration extends or respects the root options so the alias resolves inside editors and during type-checking.
