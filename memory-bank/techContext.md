# Technical Context

## Custom Modifications To Preserve

### Authentication Architecture

- Previous: multi-user Supabase JWT authentication.
- Current: Passport.js session auth integrated with Supabase identity.
- Frontend contract: cookie/session + CSRF protection.
- Backend contract: request-scoped auth can still bridge into RLS-aware database execution.

### Access Control Evolution

- Current model: application-level access control with request-scoped DB middleware.
- Primary components: `WorkspaceAccessService`, strict TypeScript role enum, `DbExecutor` / `DbSession`, request cache.
- Durable rule: Unik-scoped routes must use `ensureUnikMembershipResponse(...)` or `requireUnikRole` middleware.
- Security layers: request-scoped membership validation, RLS fallback, request cache.

### Internationalization

- Base locale: English.
- Full parity locale: Russian.
- Feature packages register namespaces through package-local `src/i18n/index.ts`.
- Consolidated namespace bundles must explicitly merge every new top-level block or the UI renders raw keys.

### Metahub Identifier And Schema Model

- `metahubs.metahubs` uses `slug` as the URL-friendly identifier.
- Design-time metadata lives in the central `metahubs` schema.
- Runtime data lives in isolated `mhb_<UUID>` schemas.
- Design-time changes trigger DDL in the corresponding branch schema through `MetahubSchemaService`.

## Codename And VLC Contract

- Codename normalization and validation live in `@universo/utils/validation/codename`.
- Storage converged on one persisted `codename JSONB` field using the canonical VLC shape.
- Uniqueness and ordering use extracted primary-locale codename text, not a second stored machine-codename column.
- `general.codenameLocalizedEnabled` shapes the persisted VLC payload; it does not switch storage away from JSONB.
- Copy flows must extract primary codename text for retry/uniqueness logic and persist the final value through shared VLC/store helpers.
- Changing the fixed-schema codename contract for live installations requires a new versioned migration.

## Platform System Attributes Governance

- Global policy source: `admin.cfg_settings` under the `metahubs` category.
- Admin keys: `platformSystemAttributesConfigurable`, `platformSystemAttributesRequired`, `platformSystemAttributesIgnoreMetahubSettings`.
- Backend policy resolution lives in `platformSystemAttributesPolicy.ts`.
- Template seeding and repair must reuse the same policy helper.
- Frontend relies on metahub attributes `meta` plus dedicated `/system` routes instead of calling admin settings directly.

## Shared Abstractions And Refactoring Baseline

- Backend controller factories: `createMetahubHandler(services)` and `asyncHandler(fn)`.
- Backend domain errors: `MetahubDomainError` plus typed subclasses.
- Backend pagination/query validation: `paginateItems(...)` and `validateListQuery(...)`.
- Frontend mutation error handling: `createDomainErrorHandler(...)`.
- Frontend mutation types and display converters are extracted into dedicated modules.
- Shared metahub hub caching uses `useMetahubTrees(metahubId)`.
- Shared VLC mapping uses `mapBaseVlcFields(entity, locale)` from `@universo/utils`.

## Page Spacing And Shell Contract

- `pageSpacing.ts` is the shared source of truth for route-aware metahub inset decisions.
- `MainLayoutMUI` uses a narrower metahub shell gutter and the default workspace shell keeps the wider gutter.
- Metahubs frontend pages must not reintroduce local negative `mx` bleed or extra horizontal wrappers.
- Metahub loading states align through `SkeletonGrid insetMode='content'` and the stable `skeleton-grid` test id.
- The shared `Header` inset remains required because the spacing browser proof still depends on it.

## Self-Hosted Fixture Contract

- Canonical source: `tools/testing/e2e/support/selfHostedAppFixtureContract.mjs`.
- Regeneration path: use the supported Playwright generator, not hand edits.
- The committed fixture exports all four published legacy-compatible V2 entity definitions.
- The fixture contract asserts expected automation components for the V2 presets.
- `versionEnvelope.structureVersion` in the committed fixture stays pinned to the canonical contract until the generator contract changes.
- Browser import/export proof must validate the full self-hosted envelope contract after re-export.

## ECAE / Entity Architecture Technical Baseline

- Standard metadata kinds are now direct DB-stored entity type definitions keyed by `catalog`, `hub`, `set`, and `enumeration`; the shipped type/runtime contract no longer depends on a builtin registry, `source` discriminator, or `includeBuiltins` API behavior.
- Shared shell, fixture, snapshot, and runtime consumers must treat standard and custom kinds uniformly and resolve display metadata from the stored entity definition.

### Backend Service Foundation

- Metahubs backend owns `EntityTypeService`, `ActionService`, `EventBindingService`, `EntityEventRouter`, and `EntityMutationService`.
- Actions and event bindings are object-owned rows in `_mhb_actions` and `_mhb_event_bindings`.
- Event bindings may reference only actions owned by the same object.
- `before*` hooks run on the active transaction runner; `after*` hooks dispatch only after commit.

### Backend Route Surface

- Entity types use top-level metahub routes.
- Actions and event bindings use object-scoped routes.
- Controllers stay thin and follow the same metahub handler/domain-error pattern as other backend domains.

### Shared Resolver Extension

- `EntityTypeResolver` resolves built-ins from the in-code registry first.
- Custom kinds fall through to DB-backed resolution only when metahub context exists.
- Resolver consumers must treat `resolve(...)`, `resolveOrThrow(...)`, and `isComponentEnabled(...)` as async.

### Generic Custom Entity CRUD

- Generic entity instance routes are custom-only.
- Built-in kinds continue to use legacy routes until compatibility phases explicitly widen the shared surface.
- `MetahubObjectsService` accepts generic kind strings, explicit create-time ids, and optional `SqlQueryable` runners.
- Generic detail reads stay active-row-only by default; deleted inspection requires `includeDeleted=true`.
- Compatibility-aware delete uses full compatible kind arrays for blocker queries.

### Top-Level Managed Metadata Route Ownership

- `domains/router.ts` no longer mounts top-level legacy hubs/catalogs/sets/enumerations route families.
- `createEntityInstancesRoutes(...)` now owns the public top-level metadata surface.
- Managed metadata requests are dispatched from compatibility metadata plus entity-type lookup.
- Child-resource domains still own their direct surfaces but also expose entity-owned aliases where needed.

### Design-Time Genericization And Reuse

- `MetahubAttributesService` exposes object-scoped system-attribute helpers while preserving legacy wrappers.
- `copyDesignTimeObjectChildren(...)` centralizes attribute/element/constant/value copy logic.
- Low-level blocker services are compatibility-aware and array-based.

### Reusable Entity Presets

- Presets live in the existing metahub template registry as `definition_type='entity_type_preset'`.
- Shared DTOs expose `definitionType` and `activeVersionManifest`.
- Built-in presets are seeded through the shared builtin template registry and validator path.
- Hub V2 and Enumeration V2 rely on explicit component overrides for automation uplift.

### Browser / Workspace Proof

- `metahub-entities-workspace.spec.ts` is the focused browser proof for preset-backed create and backend-confirmed persistence.
- The same entities workspace flow now also probes the direct entity-owned `hub`, `set`, and `enumeration` managed surfaces before entering the preset-backed create path, so managed browser proof is not catalog-only.
- Visual proof for the entity create dialog lives in the dedicated Playwright visual spec.
- `EntitiesWorkspace` list mode must render a visible fallback `row.name || row.kindKey`.

## Scripting Runtime Contract

- Shared source of truth for script roles, source kinds, capability enums, allowlists, and normalization lives in `@universo/types`.
- `@universo/extension-sdk` keeps the stable root import while remaining modular internally.
- `@AtServerAndClient()` is the explicit dual-target contract.
- Authoring is limited to `embedded` sources in the current UI.
- Common/general scripting uses `attachedToKind='general'`, `attachedToId=null`, and `moduleRole='library'`.
- Compiler boundary: SDK-only imports; reject unsupported static imports, `require()`, dynamic `import()`, and `import.meta`.
- Browser runtime uses a restricted Worker contract and fails closed when Worker support is unavailable.
- Server runtime uses pooled `isolated-vm` isolates with health monitoring.
- Runtime sync must fail closed when `_app_scripts` bootstrap or persistence fails.
- `sdkApiVersion` is enforced as a real compatibility contract; current supported version is `1.0.0`.

## Quiz Snapshot Fixture Contract

- Canonical source: `tools/testing/e2e/support/quizFixtureContract.ts`.
- Committed artifact: `tools/fixtures/metahubs-quiz-app-snapshot.json` generated through the dedicated Playwright generator.
- Import proof: `snapshot-import-quiz-runtime.spec.ts` validates browser import, restored design-time scripts, application creation, and the full EN/RU quiz runtime contract.

## Dialog Presentation Contract

- Dialog behavior is registry-driven through shared common settings keys for size preset, fullscreen, resize, and close behavior.
- `@universo/template-mui` owns `DialogPresentationProvider` / `useDialogPresentation(...)`.
- `@universo/metahubs-frontend` bridges those settings through `MetahubDialogSettingsProvider` and `withMetahubDialogSettings(...)`.
- Dialog resize state is stored in localStorage and scoped by metahub id.
- `EntityScriptsTab` uses `ResizeObserver` on the rendered container, not viewport breakpoints.

## Common Section And Catalog Layout Overlay Contract

- Layout authoring entrypoint lives under `/metahub/:metahubId/common`.
- `GeneralPage` owns the only shell for the Common section.
- `_mhb_layouts` scopes catalog layouts through `catalog_id` and links them to a global source through `base_layout_id`.
- `catalogBehavior` lives inside layout `config` and is the runtime behavior source of truth.
- Frontend catalog payloads/types and backend flows no longer expose `runtimeConfig` as the canonical behavior source.
- Inherited catalog widget behavior uses sparse overrides plus `sharedBehavior` gates.

## Shared Snapshot V2 And Override Transaction Contract

- Snapshot export emits `sharedAttributes`, `sharedConstants`, `sharedEnumerationValues`, and `sharedEntityOverrides`.
- Runtime and schema-sync consumers materialize shared sections before deserializing executable entities.
- Applications sync/release-bundle flows hash the materialized snapshot, not the raw publication snapshot.
- `SharedEntityOverridesService.upsertOverride(...)` accepts an explicit runner so request-scoped routes and parent mutations can reuse their current executor/transaction.

## Build, Test, And Tooling Notes

- Package management: PNPM workspaces.
- Supply-chain policy: minimum release age, exotic-subdependency blocking, and trust-policy no-downgrade remain active.
- Primary root validation command: `pnpm build` from the repository root.
- Turbo 2 is the workspace orchestrator; repeated root builds should reuse the local Turbo cache.
- Generated artifacts must stay out of task `inputs` so the cache remains effective.
- `@universo/rest-docs` OpenAPI source is generated from `scripts/generate-openapi-source.js`; canonical entity-owned managed metadata paths appear only if `entityInstancesRoutes.ts` is included in that generator inventory.
- Backend package `test` scripts use the custom Jest wrapper under `tools/testing/backend/run-jest.cjs`.
- Focused backend runs pass file paths positionally after `--`.

## Database Pooling And Environment Baseline

- Shared Knex pool is owned by `@universo/database`.
- Default pool max is `DATABASE_POOL_MAX` or 15.
- Request-scoped RLS execution uses pinned connections wrapped by `createRlsExecutor(...)`.
- Port `6543` implies Supavisor transaction mode; port `5432` implies direct/session mode.
- Pool status is logged when utilization is high or waiting connections exist.
- `.env` files in the repository remain placeholder-only; live secrets stay outside version control.

## Request-Scoped DB Access Standard

- Tier 1: `getRequestDbExecutor(req, getDbExecutor())` for authenticated routes.
- Tier 2: `getPoolExecutor()` for admin/bootstrap/background jobs.
- Tier 3: `getKnex()` only for schema-ddl, migration runners, and explicit DDL boundaries.
- Identifier safety comes from `qSchema()`, `qTable()`, `qColumn()`, and `qSchemaTable()`.
- Business-table UPDATE/DELETE/RESTORE flows fail closed on zero-row results.
- `node tools/lint-db-access.mjs` is the CI enforcement layer.

## UUID v7 Baseline

- The project uses UUID v7 for time-ordered ids.
- PostgreSQL support comes from the dedicated infrastructure migration that creates `public.uuid_generate_v7()`.
- Backend code uses `@universo/utils/uuid` when it needs application-generated ids.
- SQL-first migrations and schema bootstrap use `DEFAULT public.uuid_generate_v7()`.

## Runtime And Platform Foundation Notes

- `@universo/schema-ddl` provides shared runtime DDL logic.
- Optional global catalog mode remains controlled by `UPL_GLOBAL_MIGRATION_CATALOG_ENABLED`.
- Managed schema naming/validation is shared through `@universo/migrations-core` helpers.
- Applications runtime sync and release-bundle flows are owned by `@universo/applications-backend`.
- Fixed system-app bootstrap uses the converged application-like model documented in the architecture docs.
- Runtime system fields follow the current lifecycle contract instead of assuming `_upl_deleted` / `_app_deleted` families always exist.

## UPDL And Template Export Surface

- UPDL nodes and template-driven export remain the high-level authoring layer for AR.js, PlayCanvas, and related generated experiences.
- This surface is durable product scope and should stay isolated from current shell/auth/runtime foundation work.

---

For reusable rules, see [systemPatterns.md](systemPatterns.md).
For product rationale, see [productContext.md](productContext.md).
For the current execution focus, see [activeContext.md](activeContext.md).
