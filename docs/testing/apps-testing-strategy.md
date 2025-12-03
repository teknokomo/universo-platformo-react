# Apps Testing Strategy

## Current testing assets by package

- `@universo/spaces-backend` already wires Jest with `ts-jest` and Supertest via the `test` and `test:watch` scripts, and maintains controller-level tests under `src/tests/` that mock TypeORM repositories and Supabase accessors.【F:packages/spaces-backend/base/package.json†L2-L42】【F:packages/spaces-backend/base/src/tests/api.test.ts†L1-L156】
- `@universo/metaverses-backend` and `@universo/resources-backend` expose placeholder `node --test` commands but do not yet include source-aligned test files, so they will migrate to the shared Jest toolchain for consistency.【F:packages/metaverses-backend/base/package.json†L1-L37】【F:packages/resources-backend/base/package.json†L1-L33】
- `@universo/metaverses-frontend` and `@universo/resources-frontend` already depend on Vitest and Testing Library with jsdom-driven suites located in `src/pages/__tests__`.【F:packages/metaverses-frontend/base/package.json†L1-L44】【F:packages/metaverses-frontend/base/src/pages/__tests__/useApiOnce.test.tsx†L1-L25】【F:packages/resources-frontend/base/package.json†L1-L41】【F:packages/resources-frontend/base/src/pages/__tests__/useApiOnce.test.tsx†L1-L54】
- `@universo/spaces-frontend` ships a Jest-style component test in `src/components/__tests__/`, yet the package lacks a configured `test` script or Jest dependencies, so it will be migrated to Vitest for parity with other React modules.【F:packages/spaces-frontend/base/src/components/__tests__/CanvasTabs.test.jsx†L1-L120】【F:packages/spaces-frontend/base/package.json†L1-L37】
- Remaining front-end and back-end bases currently have no automated testing scripts, providing a clean slate for adopting the agreed toolchain (e.g., `analytics-frontend`, `finance-backend`, `publish-frontend`).【F:packages/analytics-frontend/base/package.json†L1-L27】【F:packages/finance-backend/base/package.json†L1-L35】【F:packages/publish-frontend/base/package.json†L1-L36】

### React Vitest adoption snapshot (Q1 2025)

- `@universo/publish-frontend` runs Vitest via the shared base config, resolves workspace aliases through `loadTsconfigAliases`, and emits coverage into `packages/publish-frontend/base/coverage` (current run: ~25% statements while the ARJS wizard happy-path is covered). Follow-up: add negative-path assertions for PlayCanvas export and network failures to raise branches.【F:packages/publish-frontend/base/vitest.config.ts†L1-L38】【96bcf7†L7-L52】
- `@universo/analytics-frontend` mounts dashboards with mocked services and now delivers ~78% statements / ~65% branches coverage written under `packages/analytics-frontend/base/coverage`. Follow-up gaps include empty dataset states and API error banners.【F:packages/analytics-frontend/base/vitest.config.ts†L1-L38】【3d36e2†L33-L47】
- `@universo/uniks-frontend` exercises the workspace dashboard navigation with hoisted mocks, persisting reports to `packages/uniks-frontend/base/coverage` at ~8% statements (only shortcut happy-path covered). Next steps: cover list/grid toggles and mutation flows.【F:packages/uniks-frontend/base/vitest.config.ts†L1-L38】【73d4b6†L33-L55】
- `@universo/profile-frontend` restores its password flow tests (no longer skipped) and records ~62% statements coverage while writing to `packages/profile-frontend/base/coverage`. Outstanding: add email/profile update success/error scenarios and resilience checks around Supabase responses.【F:packages/profile-frontend/base/src/pages/__tests__/Profile.test.tsx†L1-L118】【993bd7†L11-L21】

## Toolchain commitments

### Node/Express services

All service packages (suffix `-backend`) will standardise on **Jest + ts-jest + Supertest** to cover unit and integration layers. Jest's TypeScript support via `ts-jest` enables controller/service unit tests alongside Supertest-powered HTTP contract checks against Express routers. Shared setup will include:

1. Bootstrapping a dedicated Jest preset (`ts-jest`) per service with isolated coverage thresholds.
2. Using Supertest to exercise REST endpoints over in-memory Express instances.
3. Mocking TypeORM `DataSource` and Supabase clients where used to avoid external dependencies during CI.

### React/TSX front-ends

All front-end bases (suffix `-frontend`) will adopt **Vitest + Testing Library + jsdom** for unit and component testing. Vitest aligns with the existing Vite tooling and offers fast watch mode; Testing Library ensures accessible-first component assertions, and jsdom simulates the browser environment. Each React package will:

1. Add a shared `vitest.config.ts` that maps workspace aliases and configures jsdom.
2. Provide Testing Library helpers for consistent rendering with themes/providers.
3. Mock localisation (`react-i18next`) or data-fetching modules as required per component.

### End-to-end coverage

Cross-app user journeys will be validated via **Cypress**. The Cypress workspace will live at the repo root with spec folders grouped by domain so that a single E2E suite can exercise interactions between front-end shells and exposed service APIs. Runs will execute against locally started dev servers (documented runbooks only; agents do not auto-start servers). Component smoke tests can later complement Cypress by mounting individual React components if needed.

## Implementation considerations

- **TypeORM-heavy services** (`finance-backend`, `profile-backend`, `publish-backend`, `spaces-backend`, `uniks-backend`, etc.) require a shared mocking helper that provides in-memory repositories and transaction stubs to isolate the business logic from real databases.【F:packages/finance-backend/base/package.json†L1-L35】【F:packages/profile-backend/base/package.json†L1-L33】【F:packages/publish-backend/base/package.json†L1-L36】【F:packages/spaces-backend/base/package.json†L24-L41】【F:packages/uniks-backend/base/package.json†L1-L30】
- **Supabase integrations** (finance, profile, spaces, uniks) will provide a common fake Supabase client or use dependency injection to toggle between real and mocked clients during tests.【F:packages/finance-backend/base/package.json†L20-L30】【F:packages/profile-backend/base/package.json†L18-L28】【F:packages/spaces-backend/base/package.json†L24-L30】【F:packages/uniks-backend/base/package.json†L18-L27】
- **React internationalisation** in `metaverses-frontend` and `resources-frontend` already leverages `react-i18next`, so Vitest setups will centralise i18n mocks similar to the manual mock in the existing Spaces component test.【F:packages/metaverses-frontend/base/package.json†L23-L33】【F:packages/resources-frontend/base/package.json†L23-L33】【F:packages/spaces-frontend/base/src/components/__tests__/CanvasTabs.test.jsx†L1-L33】
- **Library packages** (`template-*`, `universo-types`, `universo-utils`, `updl`) will adopt Jest for pure TypeScript units because they compile to both CJS/ESM, and tests can run on source prior to build outputs.【F:packages/template-mmoomm/base/package.json†L1-L45】【F:packages/template-quiz/base/package.json†L1-L45】【F:packages/universo-types/base/package.json†L1-L33】【F:packages/universo-utils/base/package.json†L1-L39】【F:packages/updl/base/package.json†L1-L33】

## Test planning matrix

| App | Package type | Planned test levels | Required mocks/stubs | Coverage goal |
| --- | --- | --- | --- | --- |
| analytics-frontend | React module | Unit, component (Vitest + Testing Library); participates in shared Cypress flows | Axios/service adapters, optional theme providers | Unit ≥70%, Component ≥60%, E2E smoke |
| finance-frontend | React module | Unit, component (Vitest + Testing Library); Cypress flows for finance dashboards | Data-fetching hooks | Unit ≥70%, Component ≥60%, E2E smoke |
| finance-backend | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM DataSource, Supabase client | Unit ≥80%, Integration ≥65% |
| metaverses-frontend | React module | Unit, component (Vitest), Cypress scenarios for 3D catalog flows | react-i18next mock, axios stubs | Unit ≥75%, Component ≥65%, E2E smoke |
| metaverses-backend | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM repositories | Unit ≥75%, Integration ≥60% |
| multiplayer-colyseus-backend | Realtime Node service | Unit (Jest), integration (Jest) around room lifecycle | Colyseus room/context stubs, TypeORM if added later | Unit ≥70%, Integration ≥55% |
| profile-frontend | React module | Unit, component (Vitest), Cypress profile journeys | Supabase/profile API client mocks | Unit ≥70%, Component ≥60%, E2E smoke |
| profile-backend | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM DataSource, Supabase client | Unit ≥80%, Integration ≥65% |
| publish-frontend | React module | Unit, component (Vitest), Cypress publishing wizards | API adapters, file download stubs | Unit ≥70%, Component ≥60%, E2E smoke |
| publish-backend | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM repositories | Unit ≥75%, Integration ≥60% |
| resources-frontend | React module | Unit, component (Vitest), Cypress resource browsing | react-i18next mock, axios stubs | Unit ≥75%, Component ≥65%, E2E smoke |
| resources-backend | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM repositories | Unit ≥75%, Integration ≥60% |
| space-builder-frontend | React module | Unit, component (Vitest), Cypress builder flows | Drag-and-drop utilities, theme providers | Unit ≥70%, Component ≥60%, E2E smoke |
| space-builder-backend | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM repositories | Unit ≥75%, Integration ≥60% |
| spaces-frontend | React module | Unit, component (Vitest), Cypress workspace navigation | react-i18next mock, drag-and-drop utilities | Unit ≥75%, Component ≥65%, E2E smoke |
| spaces-backend | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM DataSource, Supabase client | Unit ≥80%, Integration ≥65% |
| template-mmoomm | Shared TS library | Unit (Jest) | Minimal (module mocks as needed) | Unit ≥70% |
| template-quiz | Shared TS library | Unit (Jest) | Minimal (module mocks as needed) | Unit ≥70% |
| uniks-frontend | React module | Unit, component (Vitest), Cypress unik management | Supabase client mock, router providers | Unit ≥70%, Component ≥60%, E2E smoke |
| uniks-backend | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM DataSource, Supabase client | Unit ≥80%, Integration ≥65% |
| universo-types | Shared TS library | Unit (Jest) for schema utilities | None | Unit ≥80% |
| universo-utils | Shared TS library | Unit (Jest) for validators/serialisers | Optional mocks for dependencies using Zod schemas | Unit ≥80% |
| updl | Node tooling package | Unit (Jest) for AST transforms | Gulp/task runner stubs | Unit ≥70% |

> **Note:** All packages join the central Cypress E2E plan through shared flows so long as their UI or API surfaces are available within the orchestrated environment. Coverage percentages express minimum line coverage targets per level.
