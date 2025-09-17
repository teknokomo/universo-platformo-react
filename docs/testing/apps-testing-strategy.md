# Apps Testing Strategy

## Current testing assets by package

- `@universo/spaces-srv` already wires Jest with `ts-jest` and Supertest via the `test` and `test:watch` scripts, and maintains controller-level tests under `src/tests/` that mock TypeORM repositories and Supabase accessors.【F:apps/spaces-srv/base/package.json†L2-L42】【F:apps/spaces-srv/base/src/tests/api.test.ts†L1-L156】
- `@universo/metaverses-srv` and `@universo/resources-srv` expose placeholder `node --test` commands but do not yet include source-aligned test files, so they will migrate to the shared Jest toolchain for consistency.【F:apps/metaverses-srv/base/package.json†L1-L37】【F:apps/resources-srv/base/package.json†L1-L33】
- `@universo/metaverses-frt` and `@universo/resources-frt` already depend on Vitest and Testing Library with jsdom-driven suites located in `src/pages/__tests__`.【F:apps/metaverses-frt/base/package.json†L1-L44】【F:apps/metaverses-frt/base/src/pages/__tests__/useApiOnce.test.tsx†L1-L25】【F:apps/resources-frt/base/package.json†L1-L41】【F:apps/resources-frt/base/src/pages/__tests__/useApiOnce.test.tsx†L1-L54】
- `@universo/spaces-frt` ships a Jest-style component test in `src/components/__tests__/`, yet the package lacks a configured `test` script or Jest dependencies, so it will be migrated to Vitest for parity with other React modules.【F:apps/spaces-frt/base/src/components/__tests__/CanvasTabs.test.jsx†L1-L120】【F:apps/spaces-frt/base/package.json†L1-L37】
- Remaining front-end and back-end bases currently have no automated testing scripts, providing a clean slate for adopting the agreed toolchain (e.g., `analytics-frt`, `finance-srv`, `publish-frt`).【F:apps/analytics-frt/base/package.json†L1-L27】【F:apps/finance-srv/base/package.json†L1-L35】【F:apps/publish-frt/base/package.json†L1-L36】

## Toolchain commitments

### Node/Express services

All service packages (suffix `-srv`) will standardise on **Jest + ts-jest + Supertest** to cover unit and integration layers. Jest's TypeScript support via `ts-jest` enables controller/service unit tests alongside Supertest-powered HTTP contract checks against Express routers. Shared setup will include:

1. Bootstrapping a dedicated Jest preset (`ts-jest`) per service with isolated coverage thresholds.
2. Using Supertest to exercise REST endpoints over in-memory Express instances.
3. Mocking TypeORM `DataSource` and Supabase clients where used to avoid external dependencies during CI.

### React/TSX front-ends

All front-end bases (suffix `-frt`) will adopt **Vitest + Testing Library + jsdom** for unit and component testing. Vitest aligns with the existing Vite tooling and offers fast watch mode; Testing Library ensures accessible-first component assertions, and jsdom simulates the browser environment. Each React package will:

1. Add a shared `vitest.config.ts` that maps workspace aliases and configures jsdom.
2. Provide Testing Library helpers for consistent rendering with themes/providers.
3. Mock localisation (`react-i18next`) or data-fetching modules as required per component.

### End-to-end coverage

Cross-app user journeys will be validated via **Cypress**. The Cypress workspace will live at the repo root with spec folders grouped by domain so that a single E2E suite can exercise interactions between front-end shells and exposed service APIs. Runs will execute against locally started dev servers (documented runbooks only; agents do not auto-start servers). Component smoke tests can later complement Cypress by mounting individual React components if needed.

## Implementation considerations

- **TypeORM-heavy services** (`finance-srv`, `profile-srv`, `publish-srv`, `spaces-srv`, `uniks-srv`, etc.) require a shared mocking helper that provides in-memory repositories and transaction stubs to isolate the business logic from real databases.【F:apps/finance-srv/base/package.json†L1-L35】【F:apps/profile-srv/base/package.json†L1-L33】【F:apps/publish-srv/base/package.json†L1-L36】【F:apps/spaces-srv/base/package.json†L24-L41】【F:apps/uniks-srv/base/package.json†L1-L30】
- **Supabase integrations** (finance, profile, spaces, uniks) will provide a common fake Supabase client or use dependency injection to toggle between real and mocked clients during tests.【F:apps/finance-srv/base/package.json†L20-L30】【F:apps/profile-srv/base/package.json†L18-L28】【F:apps/spaces-srv/base/package.json†L24-L30】【F:apps/uniks-srv/base/package.json†L18-L27】
- **React internationalisation** in `metaverses-frt` and `resources-frt` already leverages `react-i18next`, so Vitest setups will centralise i18n mocks similar to the manual mock in the existing Spaces component test.【F:apps/metaverses-frt/base/package.json†L23-L33】【F:apps/resources-frt/base/package.json†L23-L33】【F:apps/spaces-frt/base/src/components/__tests__/CanvasTabs.test.jsx†L1-L33】
- **Library packages** (`template-*`, `universo-platformo-types`, `universo-platformo-utils`, `updl`) will adopt Jest for pure TypeScript units because they compile to both CJS/ESM, and tests can run on source prior to build outputs.【F:apps/template-mmoomm/base/package.json†L1-L45】【F:apps/template-quiz/base/package.json†L1-L45】【F:apps/universo-platformo-types/base/package.json†L1-L33】【F:apps/universo-platformo-utils/base/package.json†L1-L39】【F:apps/updl/base/package.json†L1-L33】

## Test planning matrix

| App | Package type | Planned test levels | Required mocks/stubs | Coverage goal |
| --- | --- | --- | --- | --- |
| analytics-frt | React module | Unit, component (Vitest + Testing Library); participates in shared Cypress flows | Axios/service adapters, optional theme providers | Unit ≥70%, Component ≥60%, E2E smoke |
| finance-frt | React module | Unit, component (Vitest + Testing Library); Cypress flows for finance dashboards | Data-fetching hooks | Unit ≥70%, Component ≥60%, E2E smoke |
| finance-srv | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM DataSource, Supabase client | Unit ≥80%, Integration ≥65% |
| metaverses-frt | React module | Unit, component (Vitest), Cypress scenarios for 3D catalog flows | react-i18next mock, axios stubs | Unit ≥75%, Component ≥65%, E2E smoke |
| metaverses-srv | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM repositories | Unit ≥75%, Integration ≥60% |
| multiplayer-colyseus-srv | Realtime Node service | Unit (Jest), integration (Jest) around room lifecycle | Colyseus room/context stubs, TypeORM if added later | Unit ≥70%, Integration ≥55% |
| profile-frt | React module | Unit, component (Vitest), Cypress profile journeys | Supabase/profile API client mocks | Unit ≥70%, Component ≥60%, E2E smoke |
| profile-srv | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM, Supabase client | Unit ≥80%, Integration ≥65% |
| publish-frt | React module | Unit, component (Vitest), Cypress publishing wizards | API adapters, file download stubs | Unit ≥70%, Component ≥60%, E2E smoke |
| publish-srv | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM repositories | Unit ≥75%, Integration ≥60% |
| resources-frt | React module | Unit, component (Vitest), Cypress resource browsing | react-i18next mock, axios stubs | Unit ≥75%, Component ≥65%, E2E smoke |
| resources-srv | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM repositories | Unit ≥75%, Integration ≥60% |
| space-builder-frt | React module | Unit, component (Vitest), Cypress builder flows | Drag-and-drop utilities, theme providers | Unit ≥70%, Component ≥60%, E2E smoke |
| space-builder-srv | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM repositories | Unit ≥75%, Integration ≥60% |
| spaces-frt | React module | Unit, component (Vitest), Cypress workspace navigation | react-i18next mock, drag-and-drop utilities | Unit ≥75%, Component ≥65%, E2E smoke |
| spaces-srv | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM DataSource, Supabase client | Unit ≥80%, Integration ≥65% |
| template-mmoomm | Shared TS library | Unit (Jest) | Minimal (module mocks as needed) | Unit ≥70% |
| template-quiz | Shared TS library | Unit (Jest) | Minimal (module mocks as needed) | Unit ≥70% |
| uniks-frt | React module | Unit, component (Vitest), Cypress unik management | Supabase client mock, router providers | Unit ≥70%, Component ≥60%, E2E smoke |
| uniks-srv | Node/Express service | Unit (Jest), integration (Jest + Supertest) | TypeORM DataSource, Supabase client | Unit ≥80%, Integration ≥65% |
| universo-platformo-types | Shared TS library | Unit (Jest) for schema utilities | None | Unit ≥80% |
| universo-platformo-utils | Shared TS library | Unit (Jest) for validators/serialisers | Optional zod schema mocks | Unit ≥80% |
| updl | Node tooling package | Unit (Jest) for AST transforms | Gulp/task runner stubs | Unit ≥70% |

> **Note:** All packages join the central Cypress E2E plan through shared flows so long as their UI or API surfaces are available within the orchestrated environment. Coverage percentages express minimum line coverage targets per level.
