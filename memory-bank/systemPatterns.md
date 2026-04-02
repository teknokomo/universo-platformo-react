# System Patterns
> **Note**: Reusable architectural patterns and best practices. For completed work -> progress.md. For current tasks -> tasks.md.
---
## Generated REST Docs Source-Of-Truth Pattern (IMPORTANT)
**Rule**: `@universo/rest-docs` must derive its OpenAPI path and method inventory from the live backend route files, not from a hand-maintained historical YAML taxonomy.
**Required**:
- Update `packages/universo-rest-docs/scripts/generate-openapi-source.js` when mounted route families are added, removed, or remapped.
- Keep `packages/universo-rest-docs/src/openapi/index.yml` generated from that script before validate/build.
- Delete removed route families from the generator inputs immediately so Swagger stays fail-closed.
- Keep GitBook API-reference pages aligned with the standalone interactive docs workflow.
**Detection**: `rg "generate-openapi-source|routeSources|interactive-openapi-docs" packages/universo-rest-docs docs`
**Why**: The repository has already removed older workspace-era API domains. Leaving REST docs on a hand-maintained mirror makes deleted route families look alive long after the runtime stopped mounting them.
## Turbo 2 Root Cache Contract Pattern (IMPORTANT)
**Rule**: Root Turborepo tasks must keep generated artifacts out of task `inputs`; otherwise repeated workspace builds self-invalidate and Turbo degrades back into an orchestrator.
**Required**:
- Keep the root config on Turbo 2 `tasks` syntax with `envMode: "strict"`.
- Include root dependency manifests that should invalidate the whole workspace cache, at minimum `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `tsconfig.json`, in `globalDependencies`.
- Exclude generated `dist/**`, `build/**`, `coverage/**`, and `.turbo/**` artifacts from task `inputs` for cached tasks such as `build` and `test`.
- Keep package-level Turbo overrides minimal and evidence-based; the current confirmed exception is `packages/apps-template-mui`, whose `build` script is `tsc --noEmit` and therefore must declare `outputs: []`.
- Validate Turbo contract changes with two consecutive root builds and require the second run to show cache hits before considering the migration complete.
**Detection**: `rg '"tasks"|globalDependencies|outputs|inputs' turbo.json packages/*/turbo.json`
**Why**: The first Turbo 2 migration pass built successfully but still produced `0 cached` on repeated runs because task hashes included `dist/**`, `build/**`, and `.turbo/turbo-build.log` as inputs. Excluding generated artifacts restored `28/28` cache hits on the next repeated root build.
## Fixed System-App Snapshot-Equivalent Baseline Pattern (IMPORTANT)
**Rule**: Package-local docs and implementation for fixed system apps must describe applications and metahubs as separate application-like platform apps whose current baseline is maintained as a manual snapshot-equivalent model, then codified in `SystemAppDefinition` plus file-backed SQL support migrations and materialized during platform bootstrap.
**Required**:
- Update the fixed system-app manifest and the companion parity SQL artifact together when the baseline shape changes.
- Document platform-start fixed-schema bootstrap separately from metahub branch runtime migrations and from application runtime sync/release-bundle flows.
- Keep the current ownership split explicit: `@universo/metahubs-backend` hosts migration-control routes, while `@universo/applications-backend` owns runtime sync and release-bundle execution.
**Detection**: `rg "systemAppDefinition|CreateApplicationsSchema|CreateMetahubsSchema|/application/:applicationId/migrations|/application/:applicationId/sync" packages`
**Why**: Future documentation or refactor waves can easily blur fixed bootstrap, runtime migration ownership, and the temporary manual-baseline origin unless the repository keeps this hybrid model explicit.
## Definition-Driven Fixed-System-App Constraint Promotion Pattern (IMPORTANT)
**Rule**: When a fixed system app relies on definition-driven schema generation for business tables, package-local `CREATE TABLE ... CONSTRAINT ...` SQL embedded in support migrations is not the source of truth for the final table shape and must not be trusted to carry business-table constraints.
**Required**:
- Keep table creation concerns inside the `SystemAppDefinition` business-table model and the schema compiler.
- Express extra business-table constraints that are not representable in the definition model as explicit post-generation SQL, for example `ALTER TABLE ... ADD CONSTRAINT ...` in a `post_schema_generation` migration.
- Add regression tests that assert the post-generation migration contains the explicit constraint statement whenever a package migration intentionally filters out `CREATE TABLE IF NOT EXISTS <schema>.*` support SQL.
**Detection**: `rg "CREATE TABLE IF NOT EXISTS start\.|ADD CONSTRAINT|post_schema_generation|startsWith\('CREATE TABLE IF NOT EXISTS'" packages/*/base/src/platform packages/universo-migrations-platform/base/src/__tests__`
**Why**: The start-system-app PR review exposed that the compiler-generated `start.rel_user_selections` table never received the inline `catalog_kind` CHECK because the support migration intentionally discarded the package-local `CREATE TABLE` statements during bootstrap splitting.
## Platform System Attributes Governance Pattern (IMPORTANT)
**Rule**: Platform catalog system attributes (`_upl_*`) remain part of the shared catalog system-field registry, but their create/visibility behavior is governed by global admin settings rather than only by per-metahub configuration.
**Required**:
- Resolve platform system-attribute policy on the metahubs backend from `admin.cfg_settings` using the `metahubs` category keys `platformSystemAttributesConfigurable`, `platformSystemAttributesRequired`, and `platformSystemAttributesIgnoreMetahubSettings`.
- Pass that policy into shared catalog seeding flows (`ensureCatalogSystemAttributes(...)`) on catalog create/copy paths so platform defaults are enforced consistently even when ordinary attribute copy is skipped.
- Reuse the same backend policy helper for existing `_upl_*` toggle writes and for template-driven catalog seeding; UI visibility is advisory only and must not be the sole enforcement layer.
- Hide `_upl_*` rows from catalog System responses when platform configuration is disabled, but continue returning the resolved policy in list-response `meta` so the frontend can match backend rules.
- Keep the System tab on dedicated `/system` routes rather than query-param tabs, and preserve canonical registry order during optimistic toggle updates.
**Detection**: `rg "platformSystemAttributes|ensureCatalogSystemAttributes\(|/system'|/system\"" packages/admin-* packages/metahubs-* packages/universo-template-mui`
**Why**: Platform attributes must be creatable independently of metahub configuration when required by policy, and UI-only hiding or toggle logic is insufficient unless backend seeding, template repair, existing toggle writes, and optimistic ordering all share the same contract.
## Three-Level System Fields Architecture (CRITICAL)
**Rule**: All entities use prefixed system fields, but runtime business-table lifecycle families are contract-driven rather than unconditional.
**Levels**:
- `_upl_*` (Platform): Base fields for all entities — business tables always keep `created_at`, `created_by`, `updated_at`, `updated_by`, `version`, `purge_after`, `locked`, `locked_at`, `locked_by`, `locked_reason`, while configurable runtime `archived*` and `deleted*` families are emitted only when catalog `config.systemFields.fields` enables them.
- `_app_*` (Application): Run-Time fields for platform system tables and business tables. Business tables always keep `_app_owner_id` and `_app_access_level`, while `published*`, `archived*`, and soft-delete `_app_deleted*` columns are emitted only when the catalog lifecycle contract enables them.
- `_mhb_*` (Metahub Branch): Design-Time fields ONLY inside dynamic branch schemas (`mhb_<uuid>_bN`) — kept separate from `_app_*`.
**Lifecycle source of truth**: metahub catalog system rows live in `_mhb_attributes`, publication snapshots emit `systemFields`, runtime `_app_objects.config.systemFields.lifecycleContract` drives `_app_*`, and runtime `config.systemFields.fields` drives configurable `_upl_archived*` / `_upl_deleted*` presence.
**Active row predicate (platform tables)**: always `_upl_deleted = false`; add `_app_deleted = false` only when the runtime lifecycle contract uses soft delete.
**Active row predicate (branch schemas)**: `_upl_deleted = false AND _mhb_deleted = false`
**Cascade Delete Logic**: runtime soft delete writes `_upl_deleted*` only when the configurable platform delete family is enabled, and writes `_app_deleted*` only when the runtime lifecycle contract uses soft delete; hard delete mode removes the row physically. Branch delete continues to use `_mhb_deleted` → `_upl_deleted`.
**Required**: Always pass `createdBy`/`updatedBy` or `_uplCreatedBy`/`_uplUpdatedBy` when creating/updating entities.
**Detection**: `rg "lifecycleContract|resolvePlatformSystemFieldsContractFromConfig|systemFields|_app_deleted|_upl_deleted" packages/applications-backend packages/schema-ddl packages/metahubs-backend packages/universo-utils`.
**Why**: Runtime schema generation, CRUD predicates, and publication/app sync must agree on the same contract; treating either `_app_*` or configurable `_upl_*` runtime families as unconditional will reintroduce invalid SQL predicates, missing-column bugs, and stale architecture assumptions.
## Codename JSONB Single-Field Pattern (IMPORTANT)
**Rule**: Persist codename in one field only, `codename JSONB`, using the canonical VLC / `VersionedLocalizedContent<string>` shape; do not persist `codename_localized`, string-only codename storage, or `presentation.codename` as a second codename seam.
**Required**:
- Use the extracted primary locale content as the canonical machine identifier for duplicate checks, uniqueness indexes, ordering, and route/store lookups.
- Sanitize every locale entry in the codename VLC document under the configured codename style/alphabet policy, but enforce hard uniqueness only on the extracted primary locale content.
- Implement SQL uniqueness and sort semantics through immutable extracted-primary expression indexes or helper expressions rather than by storing a second machine codename column.
- For fixed system apps, any codename storage/index contract change that must reach already-deployed schemas requires a new versioned `post_schema_generation` migration ID; editing an already-applied bootstrap definition is not a live upgrade path.
- Reuse shared codename helpers from `@universo/types` / `@universo/utils` for codename validation, primary-text extraction, and VLC normalization.
- Runtime request-body handling must normalize JSON codename to its primary text before using codename as a field key; route code must not index request payloads with raw JSON objects.
- Copy flows must follow the same boundary rule as create/update flows: derive uniqueness from extracted primary codename text, but persist through shared VLC/store helpers instead of raw SQL string inserts or `String(jsonbValue)` coercion.
**Detection**: `rg "codename_localized|presentation\?\.codename|ORDER BY codename ASC|data\[[^\]]*codename" packages docs`
**Why**: The approved architecture is one persisted codename field across shared types, fixed schemas, snapshots, and runtime metadata. Reintroducing a second codename seam would recreate the same storage/query drift that this wave is removing.
## Self-Scoped Admin SQL Helper Pattern (IMPORTANT)
**Rule**: Admin `SECURITY DEFINER` helper functions that accept an optional or explicit `user_id` must remain self-scoped for authenticated request sessions and may perform cross-user introspection only from Tier 2 backend/bootstrap contexts where `auth.uid()` is absent.
**Required**:
- Guard helper functions such as `admin.has_permission(...)`, `admin.is_superuser(...)`, `admin.has_admin_permission(...)`, `admin.get_user_permissions(...)`, and `admin.get_user_global_roles(...)` so `p_user_id IS DISTINCT FROM auth.uid()` raises `42501` whenever `auth.uid()` is present.
- Keep `authenticated` execute grants only when the SQL function body itself enforces the self-scope rule; safe `search_path` alone is not sufficient.
- Preserve backend/bootstrap ability to inspect arbitrary users through pool/service execution where no request JWT user is bound.
- Cover this contract in migration-level tests and in at least one live bootstrap path that exercises the existing-user branch.
**Detection**: `rg "Authenticated sessions may inspect only their own|get_user_permissions|get_user_global_roles|has_admin_permission|is_superuser" packages/admin-backend packages/auth-backend`
**Why**: Without a self-scope guard, helper functions granted to `authenticated` can leak cross-user role and permission state even when the surrounding backend routes remain correctly authorized.

## Controller–Service–Store Backend Pattern (IMPORTANT)
**Rule**: Backend route files must stay thin (~30–80 lines of route registrations); all handler logic lives in domain controllers, which delegate to services and stores.
**Required**:
- Route file: `router.get('/path', controller.handler)` — no inline logic.
- Controller: receives `(req, res, next)`, validates input, calls services, formats response.
- Service: orchestrates business logic, transactions.
- Store: raw SQL via `DbExecutor.query(sql, params)`.
- `createMetahubHandler(services)` factory injects shared services into metahub controllers.
- `asyncHandler(fn)` wraps async Express handlers to forward rejected promises to `next()`.
**Detection**: `rg "createMetahubHandler|asyncHandler" packages/metahubs-backend packages/applications-backend`
**Why**: 13 metahubs route files (15,000+ → ~700 lines) and 3 applications route files (5,700+ → ~140 lines) were refactored to this pattern, preventing inline handler bloat.

## Frontend List Component Decomposition Pattern (IMPORTANT)
**Rule**: Large list page components (~1,000–2,500 lines) must be split into a data hook + utils module + presentation component.
**Required**:
- `use<Domain>ListData(metahubId)` hook: encapsulates all React Query calls, pagination, search, filtering, dialog state.
- `<domain>ListUtils.ts`: pure functions (display formatting, sort helpers, VLC mappers).
- Presentation component: consumes hook return value and renders UI.
- `useMetahubHubs(metahubId)` shared hook: centralizes hub list queries with `staleTime: 5min` and automatic React Query deduplication.
**Detection**: `rg "useMetahubHubs|ListData|ListUtils" packages/metahubs-frontend/base/src`
**Why**: 11 list components decomposed; replaced 8 duplicate hub query implementations with one shared hook.

## Domain Error Handler Factory Pattern (IMPORTANT)
**Rule**: Frontend mutation error handling must use `createDomainErrorHandler(config)` factory instead of inline switch/if chains.
**Required**:
- Factory accepts `{ errorCodeMap, fallbackKey, t, enqueueSnackbar }`.
- `errorCodeMap` maps backend error codes to `{ messageKey, severity }`.
- Fallback chain: matched code → `response.data.message` → `error.message` → `t(fallbackKey)`.
- Backend domain errors extend `MetahubDomainError` base class with typed `statusCode` and `code`.
**Detection**: `rg "createDomainErrorHandler|MetahubDomainError" packages/metahubs-frontend packages/metahubs-backend`
**Why**: 6+ mutation files shared nearly identical error handling; the factory eliminates ~20 lines of boilerplate per mutation file.

---
## Public Routes & 401 Redirect Pattern (CRITICAL)
**Rule**: All public route constants live in `@universo/utils/routes`. API clients use `createAuthClient({ redirectOn401: 'auto' })`.
**Required**: `API_WHITELIST_URLS`, `PUBLIC_UI_ROUTES`, `isPublicRoute()`.
**Detection**: `rg "isPublicRoute" packages` (avoid local copies).
**Symptoms**:
- 401 loops after token expiry.
- Public routes redirect to /auth unexpectedly.
**Fix**:
```typescript
const apiClient = createAuthClient({ baseURL: '/api/v1', redirectOn401: 'auto' })
```
**Why**: Centralized public routes prevent drift across frontends.
## CSRF Token Lifecycle + HTTP 419 Contract (CRITICAL)
**Rule**: Backend maps `EBADCSRFTOKEN` -> HTTP 419; frontend retries exactly once.
**Required**: clear cached CSRF after login; logout is idempotent.
**Detection**: `rg "419" packages`.
**Symptoms**:
- Infinite retry loops.
- Random 403 after successful login.
**Fix**: Retry once, then surface error to user.
**Why**: Consistent contract avoids ghost failures on stale tokens.
## Backend Status Codes + PII-safe Logging (CRITICAL)
**Rule**: Preserve 400/403/404 status codes; never log PII or captcha tokens.
**Required**: log only `hasField`, `tokenLength`, or booleans.
**Detection**: `rg "console\.log\(.*token" packages`.
**Symptoms**:
- Logs contain emails/tokens.
- Status code mismatch between backend and frontend.
**Fix**: Sanitize logs; map errors without altering HTTP status.
## ENV Feature Flags + Public Config Endpoint Pattern
**Rule**: Parse env flags in `@universo/utils` and expose via dedicated endpoints.
**Required**: `/auth/auth-config` and `/auth/captcha-config`.
**Detection**: `rg "AUTH_.*ENABLED" packages`.
**Symptoms**:
- Frontend toggles diverge from backend.
**Fix**: Fetch both configs via `Promise.allSettled`.
## Source-Only Package PeerDependencies Pattern (CRITICAL)
**Rule**: Source-only packages (no dist/) must use `peerDependencies`.
**Required**: no `"main"` field in source-only packages.
**Detection**: `find packages/*/base -name "package.json" -exec rg -L '"main"' {} \; | xargs rg '"dependencies"'`.
**Symptoms**:
- Duplicate React instances.
- PNPM hoist conflicts.
**Fix**: Move runtime deps to `peerDependencies`.
## Stable Subpath Export Pattern For tsdown Packages (IMPORTANT)
**Rule**: Every package subpath export that points to `dist/...` must have its own explicit tsdown entry.
**Required**:
- If `package.json` exports `./some-subpath`, tsdown must emit stable files for that subpath (for example `dist/someSubpath.js`, `dist/someSubpath.mjs`, `dist/someSubpath.d.ts`).
- Do not rely on hash-only shared chunks to satisfy exported subpaths.
- Test-only source aliases must stay in Vitest/Vite config, not in package tsconfig files that participate in production builds.
**Symptoms**:
- Workspace package builds fail with `TS2307` for a valid exported subpath.
- Package exports point at files that do not exist in `dist/`.
- Production builds start importing source files outside `rootDir` because a temporary source alias leaked into build-time tsconfig.
**Fix**:
- Add a dedicated tsdown entry for the exported subpath.
- Keep source-resolution overrides local to test config when source-based tests need them.
**Why**: Workspace consumers resolve exported package subpaths during package builds; stable dist outputs are required for TypeScript and bundlers to agree on the same module surface.
## Shell-To-Feature Dependency Direction Pattern (IMPORTANT)
**Rule**: Frontend feature packages rendered by `@universo/template-mui` routes must remain leaf packages and must not depend back on the shell package that imports and routes them.
**Required**:
- Keep the dependency direction one-way: `@universo/template-mui` may depend on feature frontend packages, but those feature packages must not import runtime UI helpers back from `@universo/template-mui`.
- If a feature dashboard needs generic cards/layout primitives, either use MUI directly or move the primitive into a lower shared package that does not itself depend on routed feature packages.
- When adding a new routed feature package, declare it explicitly in the shell package `dependencies` so PNPM/Vite resolve the package from the shell import site.
**Symptoms**:
- `pnpm install` reports a workspace cycle between the shell and a newly added feature package.
- Production builds fail to resolve a feature package subpath imported from `MainRoutesMUI.tsx` even though the package exists in the workspace.
**Detection**:
- `rg "@universo/metapanel-frontend|MainRoutesMUI|@universo/template-mui" packages/*/base/package.json packages/universo-template-mui/base/src/routes`
**Why**: The shell owns routing composition. If a routed feature package also depends on shell UI exports, PNPM creates a cycle and production consumers can fail on package-graph resolution even when local package builds appear green.
## Workspace Shell Access Versus Admin Access Pattern (IMPORTANT)
**Rule**: Workspace shell access and admin-panel access are separate contracts; admin-only roles must not inherit workspace routing just because they can reach `/admin`, and workspace access must be derived from real workspace capabilities instead of hardcoded role codenames.
**Required**:
- Resolve workspace-shell access (`/`, `/metapanel`, registered-user guards, start redirect escape, shared dashboard entry) from actual permissions/CASL ability for workspace subjects such as `Application`, `Metahub`, and `Profile`, not only from `user` / `superuser` role codenames.
- Route authenticated admin-only roles to `/admin` instead of `/metapanel` when resolving the root/home path.
- Keep `registered`-only users fail-closed on `/start`, even when shared dashboard/backend contracts are widened for ordinary workspace users.
- Keep admin navigation visibility driven by `canAccessAdminPanel`, not by the workspace-shell resolver.
- Reuse one shared frontend helper and one aligned backend helper so shell/menu/start/dashboard decisions do not drift.
**Detection**:
- `rg "resolveShellAccess|HomeRouteResolver|RegisteredUserGuard|StartAccessGuard" packages/universo-template-mui/base/src`
**Why**: The admin roles / metapanel QA reopen exposed two separate failure modes: conflating admin access with workspace access routed admin-only roles into the workspace shell, and codename-only workspace checks kept custom capability-based roles out of the shell/dashboard even when their permissions should have allowed entry.
## Compensating Lifecycle Writes Pattern (IMPORTANT)
**Rule**: When auth/admin lifecycle flows cross non-transactional boundaries such as Supabase auth user creation and later role provisioning, the route must compensate already-completed earlier steps if a later required step fails.
**Required**:
- Admin-side user creation must delete the just-created Supabase auth user when `setUserRoles(...)` fails after successful `createUser(...)` or invite provisioning.
- Registration must surface explicit rollback status when post-signup provisioning fails, and should compensate both the local profile row and the auth user when service-role cleanup is available.
- Onboarding completion must revert `profiles.cat_profiles.onboarding_completed` when auto-promotion to `user` fails for a newly completed profile.
- Failures after compensation should stay explicit in the HTTP response instead of being reduced to a silent generic success or ambiguous partial-success state.
**Detection**:
- `rg "deleteUser\(|cleanupRegisteredUser|onboarding_completed = \$1|create-user|assignSystemRole" packages/admin-backend packages/auth-backend packages/start-backend`
**Why**: These flows cannot be made fully atomic across Supabase auth and SQL-side role/profile writes, so correctness depends on explicit compensation rather than optimistic assumption that later steps will always succeed.
## Browser Env Precedence Pattern (IMPORTANT)
**Rule**: Shared browser-facing env helpers must resolve runtime config in this order: host-provided public env → Vite `import.meta.env` → `process.env` → browser origin.
**Required**:
- `@universo/utils` browser consumers must use the dedicated browser env entry instead of the Node/shared env module.
- Host-provided `__UNIVERSO_PUBLIC_ENV__` overrides remain the highest-precedence runtime source.
- Browser helpers may fall back to `window.location.origin` only when no explicit base URL is provided.
- Browser-oriented packages that mirror env access outside `@universo/utils` must preserve the same precedence order.
**Detection**:
- `rg "__UNIVERSO_PUBLIC_ENV__|import.meta.env|getBrowserOrigin" packages/universo-utils/base/src packages/universo-store/base/src`
**Why**: Browser bundles need to preserve Vite runtime configuration without regressing host-level override injection or Node/test fallbacks.
## Dual Entrypoint Export Parity Pattern (IMPORTANT)
**Rule**: Packages that publish both a main/root entrypoint and a browser-specific entrypoint must keep all browser-safe public exports aligned between those entrypoints.
**Required**:
- When a helper is exported from the main package root and is safe for browser bundles, re-export it from the browser entrypoint as well.
- Prefer fixing public-surface parity in the shared package instead of adding consumer-side deep-import workarounds.
- Revalidate at least one downstream dist consumer and the final shell/root build whenever browser entry exports change.
**Detection**:
- `rg "index.browser|browser" packages/*/base/src packages/*/base/package.json`
- `rg "from '@universo/utils'" packages/*/base/src`
**Why**: The codename JSONB closure exposed that `@universo/metahubs-frontend` dist consumed `getCodenamePrimary` from `@universo/utils`, but `@universo/utils/src/index.browser.ts` lagged behind `src/index.ts`. That kind of drift surfaces only at downstream shell-build time and is safer to prevent centrally.
## Fixed-System-App Validation Length Parity Pattern (IMPORTANT)
**Rule**: When a fixed system-app manifest declares `physicalDataType: 'VARCHAR(N)'` for a string field, the manifest `validationRules.maxLength` must not exceed `N` in either the current or target business-table model.
**Required**:
- Keep profile/admin/application/metahub manifest validation metadata aligned with the physical fixed-schema contract.
- Preserve the same limits in compiled schema-plan and compiler-artifact tests, not only in package-local manifest tests.
- Treat UI/manifest metadata that permits longer values than the database column as a correctness bug, not as a soft documentation mismatch.
**Detection**:
- `rg "maxLength:|physicalDataType: 'VARCHAR" packages/*/base/src/platform packages/universo-migrations-platform/base/src/__tests__`
**Why**: Manifest metadata now drives compiler artifacts, docs, and UI validation. If it allows longer values than PostgreSQL accepts, the system can report input as valid and then fail on write.
## Definition Artifact Equivalence Pattern (CRITICAL)
**Rule**: Registered-definition no-op detection must compare the full stable artifact payload signature, not only the compiled SQL checksum.
**Required**:
- `registerDefinition()` may return `unchanged` only when checksum parity and full artifact-equivalence both hold.
- Startup/catalog preflight checks in `@universo/migrations-platform` must compare stored active payload artifacts to the incoming artifacts before skipping sync.
- Dependency lists and other artifact metadata that can change independently of SQL text must be part of the equivalence signature.
**Detection**:
- `rg "areDefinitionArtifactsEquivalent|buildDefinitionArtifactComparisonSignature" packages/universo-migrations-catalog/base/src packages/universo-migrations-platform/base/src`
**Why**: Dependency-only changes are operationally meaningful. Checksum-only parity can leave the active registry payload stale even though the platform reports a false green no-op state.
## Bundle Export Lifecycle Recording Pattern (CRITICAL)
**Rule**: Bundle-oriented catalog exports must record the same published revision export rows as non-bundle export paths.
**Required**:
- After `exportDefinitionBundle(...)`, the platform must record `definition_exports` rows for every exported active published revision.
- Doctor and sync health may rely on the recorded revision lifecycle, not on whether the export was bundle or non-bundle shaped.
- Bundle export metadata should preserve the operational source/target context used to create the bundle.
**Detection**:
- `rg "recordCatalogDefinitionExports|exportDefinitionBundle" packages/universo-migrations-platform/base/src`
**Why**: CLI and operational export paths increasingly use bundles. If bundle exports skip lifecycle recording, doctor/export health drifts from the actual artifacts users generated.
## Definition Lifecycle Import Pattern (CRITICAL)
**Rule**: Active catalog imports must use the real definition lifecycle (`draft` → `review` → `published`) instead of registering active revisions directly.
**Required**:
- `importDefinitions()` must go through lifecycle helpers that create a draft, request review, and publish the draft unless the current active revision already carries published lifecycle provenance.
- `registerDefinition()` must preserve/merge published lifecycle provenance even for unchanged revisions, because repeated imports are allowed to refresh provenance without changing the checksum.
- Platform catalog-state no-op checks and doctor output must treat published lifecycle provenance as part of lifecycle completeness, not only registry/checksum/export parity.
**Detection**:
- `rg "importDefinitions\(|publishDefinitionDraft\(|requestDefinitionReview\(" packages/universo-migrations-catalog/base/src`
- `rg "hasPublishedLifecycle|missingPublishedLifecycleKeys" packages/universo-migrations-platform/base/src`
**Why**: The plan requires real lifecycle operations for drafts, review, publish, export, and import metadata. If active sync/import bypasses that lifecycle, the platform can report a green checksum/export state while still missing the approval-ready lifecycle contract.
## Optional Global Catalog Capability Pattern (CRITICAL)
**Rule**: Global migration catalog features must be explicitly gated by `UPL_GLOBAL_MIGRATION_CATALOG_ENABLED`; disabled mode must preserve local canonical migration history and only keep the minimal platform migration kernel.
**Required**:
- Runtime application and metahub writes keep `_app_migrations` / `_mhb_migrations` as canonical history and may mirror to the global catalog only when the feature flag is enabled.
- Platform execution in disabled mode must use only `upl_migrations.migration_runs` through `PlatformMigrationKernelCatalog`; it must not auto-bootstrap definition-registry tables.
- Catalog-backed commands such as definition sync/import/export must fail explicitly when the feature flag is disabled instead of silently degrading.
- Enabled mode remains fail-closed: if global mirroring or catalog lifecycle work is requested and the catalog path fails, the write must fail.
**Detection**:
- `rg "UPL_GLOBAL_MIGRATION_CATALOG_ENABLED|PlatformMigrationKernelCatalog|globalMigrationCatalogEnabled" packages`
**Why**: The repository now supports two valid operational modes. Reintroducing unconditional full-catalog bootstrap into startup or runtime paths would recreate the original cold-start dependency that this wave removed.
## Release-Bundle Canonical Snapshot-Hash Pattern (CRITICAL)
**Rule**: `application_release_bundle` validation must recompute a canonical embedded snapshot hash before trusting `manifest.snapshotHash` for artifact checksums, installation metadata, or runtime lineage decisions.
**Required**:
- Publication bundles derive the canonical hash from the normalized publication snapshot contract; application-origin bundles derive it from the runtime snapshot checksum contract.
- Bundle validation must fail closed when `manifest.snapshotHash` does not match the embedded snapshot, even if bundle artifact checksums were recomputed to match the tampered manifest.
- Bundle-apply routes and `installed_release_metadata` persistence must use the recomputed canonical hash, not the unchecked manifest field.
**Detection**:
- `rg "calculateCanonicalApplicationReleaseSnapshotHash|resolveApplicationReleaseSnapshotHash|validateApplicationReleaseBundleArtifacts" packages/applications-backend/base/src`
**Why**: `manifest.snapshotHash` drives idempotency and release lineage. Trusting it without recomputation allows a structurally valid but semantically tampered bundle to alter no-op decisions and stored release provenance.
## Publication Snapshot Hash Parity Pattern (CRITICAL)
**Rule**: Publication snapshot hash verification in `@universo/applications-backend` must normalize the same structural payload as `SnapshotSerializer.normalizeSnapshotForHash(...)` in `@universo/metahubs-backend`.
**Required**:
- Keep publication hash normalization aligned across both packages whenever publication snapshots add new top-level metadata or per-entity metadata.
- Include `systemFields` both per entity and as normalized top-level metadata when hashing publication snapshots for release-bundle validation.
- Preserve serializer omission semantics for optional publication/layout keys; do not coerce absent keys like `templateKey`, `widgetKey`, or missing top-level publication metadata to `null` during verification if the producer omitted them.
- Add direct regression coverage whenever publication snapshot structure changes, so an explicit stored publication hash remains acceptable during application sync and connector schema creation.
**Detection**:
- `rg "normalizePublicationSnapshotForHash|normalizeSnapshotForHash|systemFields" packages/applications-backend/base/src packages/metahubs-backend/base/src`
**Why**: The publication version hash is produced on the metahubs side, but connector schema creation validates it on the applications side. If the two normalization contracts drift, including subtle `undefined` vs `null` differences, valid publications start failing at runtime with a false snapshot-hash mismatch.
## Shared Publication Snapshot Hash Helper Pattern (IMPORTANT)
**Rule**: Publication snapshot hash normalization must live in one shared helper in `@universo/utils`, not in duplicated package-local implementations on the producer and consumer sides.
**Required**:
- Keep `packages/universo-utils/base/src/serialization/publicationSnapshotHash.ts` as the only canonical normalization implementation for publication snapshot hashing.
- Make both `@universo/metahubs-backend` and `@universo/applications-backend` call the shared helper rather than re-encoding the same entity/field/layout/systemFields normalization rules locally.
- Preserve caller-specific fallback behavior through helper options, for example the metahub-side default version-envelope fallback, instead of forking the normalization body.
- Add or update direct regression coverage in the shared utils helper whenever publication snapshot structure changes.
**Detection**:
- `rg "publicationSnapshotHash|normalizePublicationSnapshotForHash\(" packages/universo-utils/base/src packages/applications-backend/base/src packages/metahubs-backend/base/src`
**Why**: This seam already regressed once because producer and consumer each carried their own near-identical normalization code. Centralizing the implementation removes one of the easiest ways to reintroduce false snapshot-hash mismatches during future publication-shape changes.
## Scoped Paginated View Isolation Pattern (IMPORTANT)
**Rule**: Screens that switch between semantically different paginated scopes inside the same component instance must not reuse previous-query placeholder data across query-key changes.
**Required**:
- Pass `keepPreviousDataOnQueryKeyChange: false` to `usePaginated(...)` when a route/tab switch changes the list scope itself rather than just the page number.
- Reset local row-specific UI state such as expanded-table ids when the scope/tab changes, so stale per-row UI state does not bleed into the next scoped list.
- Keep this opt-out local to truly scope-changing screens; ordinary page/sort transitions may still keep previous data when the UX benefits from it.
**Detection**:
- `rg "keepPreviousDataOnQueryKeyChange|activeCatalogTab|scope: isSystemView" packages/metahubs-frontend/base/src`

## Publication Executable Payload Lifecycle Hydration Pattern (CRITICAL)
**Rule**: Publication-driven application release bundles must hydrate top-level `snapshot.systemFields` back into each executable entity config before schema snapshot generation or runtime schema apply.
**Required**:
- Keep `createApplicationReleaseBundle(...)` aligned with the publication snapshot contract where catalog lifecycle metadata lives in `snapshot.systemFields`, not only in `snapshot.entities[*].config`.
- Ensure the executable payload entities used for bootstrap and incremental schema execution carry `config.systemFields.lifecycleContract` whenever the publication snapshot defines it.
- Add regression coverage at the release-bundle or sync-route layer whenever publication snapshot lifecycle metadata changes, so schema-ddl is exercised through the real application-sync payload path rather than only through direct generator inputs.
**Detection**:
- `rg "snapshot\.systemFields|resolveReleaseBundleEntities|generateFullSchema\(" packages/applications-backend/base/src`
**Why**: Schema-ddl already honors `entity.config.systemFields.lifecycleContract`, but publication snapshots serialize that contract at the top level. If application release-bundle payloads are rebuilt from raw `snapshot.entities` without rehydrating `systemFields`, fresh application schemas silently recreate default `_app_published`, `_app_archived`, and `_app_deleted` columns even when the metahub disabled them.
**Why**: Reusing placeholder rows across a semantic scope switch can show stale entities from the previous tab and make two different list types appear mixed until a hard refresh.
## Application Release Bundle Sync-State Pattern (CRITICAL)
**Rule**: Publication-backed sync and file-bundle install/update for applications must share the same schema sync engine and the same central persistence seam in `applications.cat_applications`.
**Required**:
- `@universo/applications-backend` owns the canonical `application_release_bundle` contract plus the application release-bundle export/apply routes.
- Successful publication sync and successful bundle apply must both persist `installed_release_metadata` through the existing application schema sync-state contract, not through a second per-app or per-schema metadata store.
- Incremental bundle artifacts must carry a trusted `baseSchemaSnapshot` plus a precomputed `diff`; validation must recompute that diff from the embedded base snapshot and target payload before apply.
- Bundle apply may use release-version checks against `installed_release_metadata`, but for trusted incremental artifacts it must apply the embedded validated diff and reject tracked-schema/base-snapshot mismatches instead of recalculating an opportunistic runtime diff.
**Detection**:
- `rg "release-bundle|installedReleaseMetadata|application_release_bundle" packages/applications-backend/base/src`
**Why**: The optional-catalog architecture explicitly keeps application release/install state centralized. If bundle installs diverge into a separate metadata path, the platform loses one-source-of-truth behavior for sync status, release provenance, and recovery decisions.
## Fixed System-App Baseline Recording Pattern (CRITICAL)
**Rule**: Fixed system-app schema generation must record deterministic local baseline rows in `_app_migrations`, and repeated startup must backfill the baseline row when business tables already exist but local history is missing.
**Required**:
- Baseline migration names must be deterministic and derived from the registered system-app structure version (`baseline_<definition>_structure_<version>` with dots replaced by underscores).
- `SchemaGenerator.generateFullSchema(...)` must accept an explicit `migrationName` so fixed schemas do not depend on timestamp-generated baseline names.
- Repeated startup may backfill only the missing deterministic baseline row; it must not invent a second baseline or overwrite existing local history.
**Detection**:
- `rg "baseline_.*_structure_|migrationName\?: string|baseline_backfilled" packages/universo-migrations-platform/base packages/schema-ddl/base`
**Why**: Fixed schemas already own local `_app_migrations` tables. Without deterministic baseline recording, disabled-mode local history stays empty and repeated startup cannot distinguish a healthy preexisting schema from missing migration history.
## Doctor Lifecycle Export-Health Pattern (CRITICAL)
**Rule**: Registered-platform doctor checks must treat any export row on the active published revision as healthy; only sync/export operations themselves should care about a specific explicit export target.
**Required**:
- Doctor lifecycle inspection for registered platform definitions and system-app artifacts must accept any export recorded for the active revision.
- Sync/export commands must continue to record their explicit `exportTarget` values for provenance and replayability.
- Regression coverage must prove that doctor stays green when the active revision was exported by a non-bootstrap target such as CLI `migration sync`.
**Detection**:
- `rg "any-active-revision-export|inspectDefinitionCatalogLifecycle" packages/universo-migrations-platform/base/src`
**Why**: Doctor is a lifecycle-health check, not a command-origin filter. If it hardcodes a single bootstrap export target, valid active revisions exported by other stable operational paths will appear falsely unhealthy.
## Soft-Delete Parity At Persistence Boundaries (CRITICAL)
**Rule**: SQL-first stores and access guards must treat `_upl_deleted = true` or `_app_deleted = true` rows as inactive in every list/find/count/access query, not only in route-local ad hoc SQL.
**Required**:
- Put active-row predicates directly inside persistence helpers and guard lookups.
- Keep duplicate/single-required checks aligned with the same active-row predicate used by the partial indexes.
- Do not rely on route-level filtering alone for deleted-row exclusion.
**Detection**:
- `rg "FROM applications\\.(applications|connectors|connectors_publications|applications_users)" packages/applications-backend/base/src`
- Check that each read/count/access query also contains `COALESCE(..._upl_deleted, false) = false` and `COALESCE(..._app_deleted, false) = false` where applicable.
**Why**: The platform uses soft-delete flags plus active partial indexes to define live records. If stores or guards skip those predicates, deleted rows can silently reappear in access checks, duplicate-link detection, required-link constraints, and list/detail APIs.
## Metahub Active-Row Parity In SQL-First Stores (CRITICAL)
**Rule**: Metahub-domain SQL-first stores and access guards must treat rows as active only when both `_upl_deleted = false` and `_mhb_deleted = false`.
**Required**:
- Apply the dual predicate in metahub, branch, membership, publication, and publication-version list/find/count/access queries.
- Apply the same dual predicate inside soft-delete helpers and guard membership lookups, not only in route code.
- When soft-deleting metahub-domain rows, update both `_upl_*` delete fields and `_mhb_*` delete fields together.
**Detection**:
- `rg "_upl_deleted = false" packages/metahubs-backend/base/src/persistence packages/metahubs-backend/base/src/domains/shared`
- Verify that metahub-domain queries also include `_mhb_deleted = false` for the same alias or table.
**Why**: The platform schema and active partial indexes for metahub-domain tables define liveness through both delete layers. If SQL-first helpers only enforce `_upl_deleted`, deleted memberships can still grant access and deleted branches/publications can re-enter active reads.
## Cross-Schema Soft-Delete Predicate Pattern (CRITICAL)
**Rule**: Never reuse one domain's active-row predicate on tables from another schema if their lifecycle columns differ.
**Required**:
- Application tables use `_upl_deleted` plus `_app_deleted`.
- Metahub platform tables use `_upl_deleted` plus `_mhb_deleted`.
- Cross-schema joins must apply the predicate that matches each alias's owning schema, even when the query itself lives in one package.
**Detection**:
- `rg "activeRowPredicate\('p'\)|activeRowPredicate\('m'\)|_app_deleted" packages/applications-backend/base/src`
- Inspect joins from `applications.*` into `metahubs.*` and verify alias-specific predicates instead of one shared helper.
**Symptoms**:
- Runtime SQL errors such as `column p._app_deleted does not exist`.
- Connector/publication views fail only when cross-domain metadata is joined.
**Why**: Application and Metahub schemas intentionally keep different lifecycle columns. Cross-domain query helpers must preserve that contract per alias or they will emit invalid SQL despite both sides individually following soft-delete conventions.
## Managed Schema Drop Safety Pattern (CRITICAL)
**Rule**: Any helper that executes `DROP SCHEMA` for runtime application schemas must validate the schema name inside the helper itself, even if callers already performed route-level validation.
**Required**:
- Accept only managed application schemas (`app_*`) that pass the shared schema-name validator.
- Quote the identifier before interpolation into raw SQL.
- Fail before executing any SQL when validation fails.
**Why**: Route-level checks are not a sufficient safety boundary for reusable persistence helpers. The helper itself must enforce managed-schema rules so future callers cannot accidentally bypass the invariant.
## Managed Dynamic Schema Naming Pattern (CRITICAL)
**Rule**: Runtime and bootstrap code must build and validate managed schema names through the shared `@universo/migrations-core` helpers, not with local string templates or local regex checks.
**Required**:
- Use `buildManagedDynamicSchemaName(...)` for canonical managed application and metahub schema names.
- Use `isManagedDynamicSchemaName(...)` when validating incoming/stored managed schema names before DDL or raw SQL.
- Preserve current naming contracts exactly: `app_<uuid32>` for managed application schemas and `mhb_<uuid32>_bN` for metahub branch schemas.
- Align tests/mocks with those canonical names instead of placeholder strings such as `app_publication_1`.
**Why**: Centralizing managed-schema naming eliminates drift between schema-ddl, metahub runtime code, publication compensation paths, and regression fixtures, while keeping the live naming contract stable.
## Fresh-Bootstrap System-App Manifest Pattern (CRITICAL)
**Rule**: On recreatable environments, active system-app manifests must bootstrap only the canonical fresh-schema migration chain and must not keep table-rename reconciliation migrations in the live manifest path.
**Required**:
- The active applications fixed-schema manifest keeps only `CreateApplicationsSchema1800000000000` in its migration chain.
- Fresh bootstrap creates canonical `cat_*` / `rel_*` table names directly.
- Legacy reconcile migrations may exist only as historical references outside the active manifest path, or be deleted when no longer needed.
**Why**: Keeping rename-based reconciliation inside the active manifest hides fresh-DB regressions and violates the expected bootstrap contract for disposable environments.
## Applications Sync Persistence Target Pattern (CRITICAL)
**Rule**: Application runtime sync persistence helpers must write only to the converged fixed-schema tables `applications.cat_applications` and `applications.cat_connectors`, and they must refuse to update soft-deleted rows.
**Required**:
- `persistApplicationSchemaSyncState(...)` targets `cat_applications` with `_upl_deleted = false AND _app_deleted = false`.
- `persistConnectorSyncTouch(...)` targets `cat_connectors` with the same active-row guard.
- Direct service-level regression tests must cover these helpers because route tests may mock them.
**Why**: Route-level application sync tests often stub helper calls; without direct service coverage, stale pre-convergence table names can survive unnoticed until fresh-bootstrap runtime sync executes.
## TypeORM Residue Boundary Pattern (TRANSITIONAL)
**Rule**: Treat TypeORM as removed from the live architecture. No new package, route, service, or helper may introduce `DataSource`, repositories, entities, or TypeORM-specific request helpers.
**Required**: New work must use `@universo/database`, `DbExecutor`, `DbSession`, `SqlQueryable`, and SQL-first persistence stores.
**Detection**: `rg "typeorm|DataSource|getRequestManager\(|getRepository\(" packages`.
**Symptoms**:
- TypeORM APIs leaking back into freshly migrated packages.
- New docs or helpers describing `DataSource` or repository-based flows as current practice.
**Fix**:
```typescript
const executor = getRequestDbExecutor(req, createKnexExecutor(getKnex()))
return applicationsStore.listApplications(executor, userId)
```
**Exception**: compatibility-only comments or historical progress entries may mention removed TypeORM surfaces, but they must not describe them as current architecture.
## DDL Utilities Pattern (schema-ddl)
**Rule**: Runtime schema operations must use `@universo/schema-ddl` with DI-created services.
**Required**: Instantiate via `createDDLServices(knex)` or backend wrapper `getDDLServices()`.
**Avoid**: Deprecated static wrappers (use naming utilities directly) and unsafe raw string interpolation in `knex.raw`.
**Compensation Rule**: If metadata creation commits before a runtime DDL step runs, the caller must fail loudly and compensate the fresh metadata immediately when DDL/runtime sync fails.
**Why**: Consistent DI simplifies testing and reduces SQL injection risk.
## Application Runtime Sync Ownership Boundary (CRITICAL)
**Rule**: Application runtime schema sync and diff endpoints belong to `@universo/applications-backend`; metahubs only supplies publication-derived sync context as a narrow seam.
**Required**:
- Mount `/application/:applicationId/sync` and `/application/:applicationId/diff` from `createApplicationsServiceRoutes(...)`.
- Keep publication compilation and snapshot deserialization inside `@universo/metahubs-backend`, but expose them only through `loadPublishedPublicationRuntimeSource(...)`.
- Build the final application sync context inside `@universo/applications-backend` through `createLoadPublishedApplicationSyncContext(...)`.
- Inject the metahubs publication-runtime seam from `@universo/core-backend` instead of making `@universo/applications-backend` import metahubs internals directly.
**Why**: This preserves application-owned runtime orchestration, avoids cross-package architecture drift, and keeps the HTTP contract stable while separating publication authoring from application runtime schema ownership.
## Fixed-System-App Bootstrap Phase Boundary (CRITICAL)
**Rule**: Platform migrations that read or mutate generated fixed-system-app tables must run only in `post_schema_generation`, never in the prelude wave.
**Required**:
- Keep schema/extension/setup work that does not require generated business tables in `pre_schema_generation`.
- Register `OptimizeRlsPolicies1800000000200` in `post_schema_generation` because it recreates policies on generated fixed tables.
- Register `SeedBuiltinMetahubTemplates1800000000250` in `post_schema_generation` because it writes to `metahubs.cat_templates` after fixed schema generation.
- When adding future platform migrations, classify them by the earliest bootstrap phase in which all referenced schemas/tables definitely exist.
**Why**: Focused tests can miss fresh-start ordering bugs. The live bootstrap contract is `prelude -> fixed schema generation -> post-schema migrations`; violating that boundary produces startup failures even when individual migrations are otherwise correct.
## Cross-System-App Dependency Ordering Pattern (CRITICAL)
**Rule**: A fixed system-app migration that references helper functions, policies, or other bootstrap artifacts owned by another system app must use a version that sorts after the provider app's migration that creates those dependencies.
**Required**:
- Treat global platform migration sorting (`version` then `id`) as the real execution contract across all registered system apps, not just within one package.
- Keep same-app schema enablement/index/seed work in the normal `post_schema_generation` finalize migration, but move cross-system-app policy creation into a later migration when it depends on another app's helper functions.
- Add an ordering regression in `@universo/migrations-platform` whenever a migration depends on artifacts from another fixed system app.
**Why**: Bootstrap phase alone is not enough to guarantee dependency safety. On a clean database, two `post_schema_generation` migrations from different system apps still execute in global sorted order, so cross-app references can fail unless the dependent migration is explicitly versioned after the provider.
## Publication Bootstrap Runtime Sync Sequencing (CRITICAL)
**Rule**: When publication routes create an application schema from a publication snapshot, runtime sync must execute inside the DDL generator's `afterMigrationRecorded(...)` hook, and synced schema state must be persisted in that same post-recording step.
**Required**:
- Call `runPublishedApplicationRuntimeSync(...)` from the publication route only after the initial schema migration record exists.
- Persist application schema sync state immediately after runtime sync via `persistApplicationSchemaSyncState(...)` using the same transaction context supplied to `afterMigrationRecorded(...)`.
- Keep compensation logic outside the metadata transaction and run it only when DDL/runtime sync fails after publication or linked-application metadata already exists.
**Avoid**:
- Running runtime sync before migration history is recorded.
- Persisting `SYNCED` application schema state before runtime sync finishes.
- Treating success-path proof as implied by failure-compensation tests alone.
**Why**: Publication-driven bootstrap must preserve a truthful migration history boundary. The runtime sync contract depends on the recorded migration id and snapshot, and premature state persistence would create false synced metadata after partial DDL success.
## Repeated-Startup Fast-Path Pattern For Fixed Metadata And Catalog Sync (CRITICAL)
**Rule**: `App.initDatabase()` may validate registered migrations and definitions on every startup, but it must skip heavy fixed metadata writes and definition-registry churn when the live state already matches the compiled target state.
**Required**:
- Fixed system-app metadata bootstrap must compare the live `_app_objects` / `_app_attributes` state against the compiled target fingerprint and only call `syncSystemMetadata(...)` when tables, rows, or payloads drift.
- Registered definition catalog sync must bulk-load registry active revisions and export rows, then skip `registerDefinition()` entirely when every artifact checksum and export target already matches.
- Both fast paths must preserve self-healing behavior by falling back to the canonical full sync path whenever fingerprint/checksum/export drift is detected.
**Why**: Idempotent startup is not enough for operational safety in this repository. Replaying hundreds of registry writes and metadata upserts on every clean boot makes startup slow and obscures real drift behind noisy repeated synchronization.
## Explicit RETURNING + Soft-Delete Compensation Pattern (IMPORTANT)
**Rule**: Touched SQL-first stores on platform catalog tables should return explicit column lists, and cleanup/rollback paths should prefer dual-flag soft delete over raw `DELETE` whenever the rows belong to normal soft-deletable platform metadata.
**Required**:
- Prefer `RETURNING id, ...` with the exact row contract expected by the store instead of `RETURNING *`.
- When compensating partially created platform metadata such as role assignments or provisional metahub catalog rows, update both `_upl_*` and `_app_*` delete fields through the shared soft-delete helpers instead of issuing a physical delete.
- If associated child metadata is created in the same flow, compensate it explicitly as well unless an existing hard database cascade is still part of the intended contract.
**Why**: Explicit `RETURNING` clauses prevent silent shape drift when schema support fields change, and soft-delete compensation preserves the repository-wide lifecycle/audit contract even on rollback paths.
## Statement Timeout Helper Pattern (CRITICAL)
**Rule**: PostgreSQL `SET LOCAL statement_timeout` must use the shared validated helper from `@universo/utils/database`, not a bound placeholder.
**Required**:
- Use `buildSetLocalStatementTimeoutSql(timeoutMs)` for `SET LOCAL statement_timeout`.
- Keep timeout values numeric and validated before SQL generation.
- Reuse the same helper in request-scoped RLS middleware and schema-ddl locking paths.
**Avoid**:
- `knex.raw('SET LOCAL statement_timeout TO ?', [...])`
- ad hoc SQL assembly for statement timeout changes
**Why**: PostgreSQL rejected placeholder-style `SET LOCAL` in the live RLS path, so the only safe canonical implementation in this repository is the shared helper that emits a validated literal.
## Codename Retry Policy Pattern (IMPORTANT)
**Rule**: All codename copy/auto-rename flows must use shared retry constants from `codenameStyleHelper.ts`.
**Required constants**:
- `CODENAME_RETRY_MAX_ATTEMPTS` (global retry cap)
- `CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT` (for concurrent conflict retries where applicable)
**Generation rule**:
- `buildCodenameAttempt(base, attempt, 'kebab-case')` appends `-<attempt>` for attempts >= 2
- `buildCodenameAttempt(base, attempt, 'pascal-case')` appends `<attempt>` for attempts >= 2
- Candidate length is capped by style limits (kebab 100, pascal 80)
**Why**: Prevents domain drift (20 vs 1000 attempts), keeps copy behavior deterministic, and reduces collision-related regressions under concurrent writes.
## Database Pool Budget + Error Logging Pattern
**Rule**: Use one shared Knex pool through `@universo/database`; log pool state on errors and under pressure.
**Required**:
- Knex: attach pool error listener and log `used/free/pending` metrics.
- Default pool max comes from `DATABASE_POOL_MAX` and currently defaults to 15.
**Why**: Prevent pool exhaustion and provide actionable diagnostics during incidents.
## DynamicEntityFormDialog Custom Field Rendering
**Rule**: Use `renderField` override to render domain-specific inputs (e.g., REF element selector) without changing default dialog behavior.
**Usage**: Return `undefined` to fall back to the built-in renderer; return a React node to override.
**Why**: Keeps the dialog generic while enabling custom widgets for special field types.
## Headless Controller Hook + Adapter Pattern (IMPORTANT)
**Rule**: CRUD dashboard views must use the shared `useCrudDashboard(adapter)` hook from `apps-template-mui`. Each deployment context (standalone dev, production runtime) provides its own `CrudDataAdapter` implementation.
**Components**:
- `CrudDataAdapter` interface (`api/types.ts`): `fetchList`, `fetchRow`, `createRow`, `updateRow`, `deleteRow`, `queryKeyPrefix`.
- `useCrudDashboard()` hook (`hooks/useCrudDashboard.ts`): headless controller returning all state + handlers (pagination, CRUD dialogs, row actions menu, schema fingerprint, React Query queries/mutations, columns, fieldConfigs, localeText).
- `createStandaloneAdapter()` (`api/adapters.ts`): adapter wrapping raw `fetch()` calls for standalone dev mode.
- `createRuntimeAdapter()` (`applications-frontend/api/runtimeAdapter.ts`): adapter wrapping auth'd `apiClient` calls for production.
- `CrudDialogs` + `RowActionsMenu` (`components/`): shared UI consuming `CrudDashboardState`.
- `CellRendererOverrides` type: per-dataType custom rendering injected via `cellRenderers` option (e.g., inline BOOLEAN checkbox toggle).
**Why**: Eliminates ~80% code duplication between DashboardApp and ApplicationRuntime while preserving full customization via adapters and cell renderer overrides.
**Detection**: `rg "useCrudDashboard" packages`.
## Optimistic Create Confirmation + Dedupe Pattern (IMPORTANT)
**Rule**: Every optimistic create/invite/copy hook must call `confirmOptimisticCreate()` in `onSuccess` when the server returns a real entity ID.
**Required**:
- Create hooks seed `optimisticId` via `applyOptimisticCreate()`.
- Success handlers replace that ID with the real server ID.
- `confirmOptimisticCreate()` must also drop the stale optimistic placeholder if the real entity already entered cache via another refetch or mutation path.
**Where implemented**:
- Shared admin/template helper: `packages/universo-template-mui/base/src/hooks/optimisticCrud.ts`
- Published runtime helper: `packages/apps-template-mui/src/hooks/optimisticCrud.ts`
**Why**: Prevents duplicate rows/cards during the refetch window and guarantees pending markers are removed as soon as the server confirms the entity.
**Detection**: `rg "applyOptimisticCreate|confirmOptimisticCreate" packages`.
## Nested Optimistic Query Scope Pattern (IMPORTANT)
**Rule**: Nested Metahub CRUD screens must mutate the exact query scope they render, not a broader root entity list.
**Required**:
- Child TABLE attribute screens use child-specific hooks/query prefixes (`childAttributes`, child element caches, child enum caches) instead of reusing root attribute hooks.
- Page-level UI code must not dispatch an optimistic mutation and then immediately call manual list invalidation for the same screen.
- Nested screen regressions should assert the actual UI contract (`mutate(...)` + immediate dialog close), not only helper-level cache behavior.
- If a copy flow can be rendered from both a broad metahub list and a hub-scoped list, optimistic create/confirm must target every currently visible matching list family, not only the broad `all*` cache.
**Symptoms**:
- A nested dialog still waits for network completion even though shared optimistic helpers exist.
- Child TABLE rows flicker, disappear, or fail to update because the wrong query family was mutated.
- Page-level `invalidateQueries()` reintroduces refetch flicker right after an optimistic update.
**Fix**:
- Create a dedicated nested hook if the screen renders a different list/query shape than the root entity list.
- Keep invalidation in the mutation lifecycle (`onSettled` / shared invalidators), not as an unconditional page-level follow-up.
- For hub-scoped copy flows, collect the broad metahub query prefix plus any matching hub query prefixes from current cache state, then apply optimistic create/confirm across all of them.
**Why**: Query-scope mismatches were the main reason nested optimistic parity remained incomplete after the shared helper rollout looked green at the top level.
## RLS Request DB Session Reuse for Admin Guards (CRITICAL)
**Rule**: Reuse request-scoped DB session from `req.dbContext`.
**Required**: pass the neutral `DbSession` into guard helpers.
**Detection**: `rg "req\.dbContext" packages`.
**Symptoms**:
- Permission checks outside RLS context.
**Fix**: fallback to a neutral executor or session derived from `@universo/database` only if the request DB session is missing.
## Template Seed Identity Pattern (IMPORTANT)
**Rule**: Widget identity in template seeds is `{layout_id, zone, widget_key, sort_order}`.
**Risk**: When a template update removes or reorders widgets, `sort_order` shifts cause the Migrator to see relocated widgets as "new" (different key) while old positions become orphans.
**Mitigation (current)**: `TemplateSeedMigrator` inherits `is_active` from existing peers with same `zone + widget_key` and auto-cleans orphan duplicates (system-created only, `_upl_created_by IS NULL`).
**Future improvement**: Consider using `{layout_id, zone, widget_key}` as the stable identity (without `sort_order`) to make template reordering transparent.
**Detection**: Duplicate widgets in same zone — `SELECT zone, widget_key, count(*) FROM _mhb_widgets WHERE _mhb_deleted = false GROUP BY zone, widget_key HAVING count(*) > 1`.
## Structured Blocker Pattern (IMPORTANT)
**Rule**: Migration/cleanup blockers must use `StructuredBlocker` type from `@universo/types` instead of plain strings.
**Interface**: `{ code: string, params: Record<string, string>, message: string }`
**Backend**: Services (`TemplateSeedCleanupService`, `metahubMigrationsRoutes`) create blockers with code + params + fallback message.
**Frontend**: `MetahubMigrationGuard.tsx` renders blockers using `t(\`migrations.blockers.\${blocker.code}\`, blocker.params)` with `<ul>/<li>` markup.
**i18n**: 15 blocker keys in EN/RU locales under `migrations.blockers.*` namespace.
**Detection**: `rg "StructuredBlocker" packages`.
**Why**: Type-safe, i18n-ready error reporting. Backend provides structured context, frontend localizes using standard i18n infrastructure.

---
## i18n Architecture (CRITICAL)
**Rule**: Core namespaces in `@universo/i18n`; feature packages use `registerNamespace()`.
**Required**: feature registration called before app render.
**Detection**: `rg "i18next\.use" packages` (antipattern).
**Symptoms**:
- Missing translations after lazy load.
**Fix**: register namespaces in entrypoints and consolidate bundles.
## Canonical Types Pattern (CRITICAL)
**Rule**: Shared types live in `@universo/types` and are re-exported downstream.
**Required**: pagination/filter types in `@universo/types`, UI packages re-export only.
**Detection**: `rg "PaginationMeta|FilterType" packages/*/src/types`.
**Symptoms**:
- Divergent shapes across frontends.
**Fix**: replace local types with `@universo/types` imports.
## Universal List Pattern (CRITICAL)
**Rule**: Entity lists use `usePaginated` + `useDebouncedSearch` + card/table toggle.
**Required**: ViewHeader, ItemCard, FlowListTable, PaginationControls, localStorage persistence.
**Detection**: `rg "usePaginated" packages`.
**Symptoms**:
- Inconsistent pagination behavior across modules.
**Fix**: adopt shared list components from template-mui.

## Page Spacing Contract (IMPORTANT)
**Rule**: Non-list pages (settings, migrations) must use shared spacing constants from `@universo/template-mui`.
- `PAGE_CONTENT_GUTTER_MX` (`{ xs: -1.5, md: -2 }`) as `mx` on content sections below ViewHeader.
- `PAGE_TAB_BAR_SX` (`{ borderBottom: 1, borderColor: 'divider', mb: 2 }`) for tab bars — NO `px`.
- `MainLayoutMUI` provides `px: { xs: 2, md: 3 }`; `ViewHeader` compensates internally with `ml/mr: { xs: 0, md: -2 }`.
**Detection**: `rg "px: 2.*Tabs\|borderBottom.*px" packages/*/base/src` (antipattern: tabs with `px`).
**Symptoms**:
- Tabs indented from content edges; settings/form content narrower than list tables on same pages.
**Fix**: import `PAGE_CONTENT_GUTTER_MX` / `PAGE_TAB_BAR_SX` from `@universo/template-mui`.
## Dual Sidebar Menu Config (IMPORTANT)
**Rule**: There are TWO sidebar menu configurations that must be kept in sync:
1. **`metahubDashboard.ts`** (`packages/metahubs-frontend/base/src/menu-items/`) — Legacy config used by the older shared menu layer
2. **`menuConfigs.ts`** (`packages/universo-template-mui/base/src/navigation/`) — **PRODUCTION config** consumed by `MenuContent.tsx` via `getMetahubMenuItems()`.
**When modifying sidebar items**: Always update BOTH files. The production app uses `menuConfigs.ts`.
## React StrictMode Pattern (CRITICAL)
**Rule**: StrictMode enabled only in DEV builds.
**Fix**:
```tsx
const StrictModeWrapper = import.meta.env.DEV ? React.StrictMode : React.Fragment
```
**Why**: Prevent double-render issues in production.
## Rate Limiting Pattern (CRITICAL)
**Rule**: Redis-based rate limiting for all public API endpoints.
**Required**: `RATE_LIMIT_ENABLED`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`.
**Detection**: `rg "rateLimit" packages/*/src`.
**Symptoms**:
- 429 missing under load.
**Fix**: apply middleware per router.
## Testing Environment Pattern (CRITICAL)
**Rule**: Vitest + Testing Library; Playwright for E2E. No Jest.
**Required**: use shared test utils packages.
**Detection**: `rg "jest" packages/*/package.json`.
**Fix**: migrate Jest tests to Vitest equivalents.
## Service Factory + NodeProvider Pattern (CRITICAL)
**Rule**: Services are factories to inject neutral dependencies (`DbExecutor`, `DbSession`, telemetry, config).
**Fix**:
```typescript
export const createXService = ({ getDbExecutor, telemetryProvider }) => ({ ... })
```
## Runtime Migration Pattern (CRITICAL)
**Rule**: All schema changes must be recorded in `_sys_migrations` table within Application schema.
**Required**: Use `MigrationManager.recordMigration()` after applying DDL changes via `SchemaMigrator`.
**Migration Format**: `YYYYMMDD_HHMMSS_<description>` (e.g., `20260117_143000_add_products_table`).
**Components**:
- `MigrationManager`: CRUD for migrations, rollback analysis.
- `SchemaMigrator.applyAllChanges({ recordMigration: true, description })`: records migration with snapshot.
**Rollback Policy**: Block rollback if path contains destructive changes (DROP_TABLE, DROP_COLUMN, destructive ALTER_COLUMN).
**Detection**: `rg "recordMigration" packages`.
**Symptoms**:
- Schema changes not tracked.
- Rollback fails silently.
**Fix**: Always pass `recordMigration: true` when applying schema changes that should be reversible.
## Applications Runtime Update Targeting (MVP)
**Rule**: Runtime cell updates should include `catalogId` when the application has multiple catalogs.
**Why**: Backend defaults to the first catalog by codename; without `catalogId`, updates can target the wrong table and return 404 (row not found).
## TanStack Query Cache Correctness + v5 Patterns (CRITICAL)
**Rule**: Query key factories must be used for invalidation.
**Required**: `lists()` and `detail(id)` keys; invalidate aggregates explicitly.
**Detection**: `rg "invalidateQueries\(" packages`.
**Fix**: call `invalidateQueries(metaversesQueryKeys.lists())` after mutations.
## Focus-Refetch for Open Dialog Data (No Polling)
**Rule**: `useQuery` with `enabled: open` + `refetchOnWindowFocus: 'always'`.
**Why**: ensures dialog data fresh without polling.
## Reusable Compact List Table Pattern (Dialogs)
**Rule**: Use `CompactListTable` in modal dialogs with sticky header + bounded scroll.
**Required**: `renderRowAction`, `actionColumnWidth` for action column.
**Detection**: `rg "<Table" packages/*/dialogs`.
## Data Modeling + UI Runtime Patterns
**Applications config/data split**: Metahubs store configuration; Applications store runtime data in PostgreSQL schemas. Use `SchemaGenerator` + `SchemaMigrator` with shared `@universo/database` Knex runtime. Naming stays canonical: schema `app_<uuid32>`, table `cat_<uuid32>`, column `attr_<uuid32>`, TABLE-child `tbl_<uuid32>`.
**Attribute types**: `_mhb_attributes.data_type` stores the logical enum and `validation_rules` stores type-specific settings. Canonical mapping is `STRING -> TEXT/VARCHAR/JSONB`, `NUMBER -> NUMERIC`, `DATE -> DATE/TIME/TIMESTAMPTZ`, `BOOLEAN -> BOOLEAN`, `REF -> UUID`, `JSON -> JSONB`; compute physical types through `SchemaGenerator.mapDataType(...)` / `getPhysicalDataType(...)` and surface the resolved PostgreSQL type in the UI.
**Shared UI/data rules**:
- Pagination uses backend `limit/offset/sortBy/sortOrder` plus frontend `usePaginated<T, SortFields>` and `PaginationControls`.
- Error handling uses centralized backend errors (`ValidationError`, `NotFoundError`, `ForbiddenError`) plus frontend boundaries/toasts/Sentry.
- Env access goes through `@universo/utils/env`; migrations stay consolidated/idempotent with RLS policies and no destructive `down()`.
- VLC uses shared `sanitizeLocalizedInput`, `buildLocalizedContent`, and `normalizeCodename`; frontend keeps `slugifyCodename()` for user input.
- Build/naming remain `tsdown` dual output, `pnpm --filter` for package builds, PascalCase/camelCase/kebab-case naming, snake_case DB objects, and dot-notation i18n keys.
**Access/guard rules**:
- RBAC stays hybrid DB + CASL; `module='*'` + `action='*'` maps to `manage/all`, and route protection uses `ensureGlobalAccess(...)`.
- Parent-scoped endpoints carry RLS context where needed; public execution uses `/execution/:id` with `GET /public-executions/:id`.
- Guard redirects stay `AuthGuard -> /auth`, `AdminGuard -> /`, `ResourceGuard -> /`; ReactFlow node dialogs open from canvas events (`onNodeDoubleClick`), not node DOM handlers.
- Public UI routes and API whitelist entries must stay synchronized across packages.
**Antipatterns to avoid**: direct Supabase client access, hardcoded roles, `dependencies` in source-only packages, raw SQL in routes/services, `i18next.use()` inside packages, StrictMode in production, large-list client-side pagination, and duplicate client state stores.
## Metahub Template + Definition Model
**Metahub template/versioning**: Structure versions own system-table DDL in `structureVersions.ts`, while semver template versions own JSON/TS seed manifests under `templates/data/`. Seeds reference entities by codenames, generate UUIDs at apply time, stay idempotent through manifest hashing, keep template entities platform-level (`_upl_*` only), and load from `metahubs.templates` / `metahubs.templates_versions` with DB manifest override support.
**Application-definition model**: Metahubs are one specialization of the generic definition system. `DefinitionArtifact` payloads are stored through `upl_migrations.definition_registry`, immutable `definition_revisions`, optional lifecycle drafts, and export provenance rows in `definition_exports`. `registerDefinition(...)` stays idempotent, `exportDefinitions()` / `importDefinitions()` preserve round-trip storage, template `definition_type` differentiates `metahub_template`, `application_template`, or `custom`, and dependency direction remains `@universo/migrations-catalog` -> `@universo/migrations-core` only.
## Unified Database Access Standard (CRITICAL)
**Rule**: All backend database access must go through one of three permitted tiers. No direct Knex or KnexClient references in domain code.
**Tiers**:
- **Tier 1 — RLS (request-scoped)**: `getRequestDbExecutor(req, getDbExecutor())` / `getRequestDbSession(req, getDbExecutor())`. Used by authenticated route handlers; carries JWT claims for RLS policies.
- **Tier 2 — Admin/Bootstrap (non-RLS)**: `getPoolExecutor()` from `@universo/database`. Used by admin routes, startup provisioning, and background jobs that run outside user context.
- **Tier 3 — DDL/Migration**: `getKnex()` from `@universo/database`. Used only by `schema-ddl` services, migration runners, and explicit package-local DDL boundaries.
**Core Contracts**:
- `DbExecutor` — `query<T>(sql, params): Promise<T[]>`, `transaction<T>(cb): Promise<T>`, `isReleased(): boolean`
- `DbSession` — `query<T>(sql, params): Promise<T[]>`, `isReleased(): boolean`
- `SqlQueryable` — minimal `query<T>(sql, params): Promise<T[]>` for persistence stores
- Bridge: `createKnexExecutor(knex)` wraps a Knex instance as `DbExecutor` for Tier 3 → Tier 1 boundary crossings
**Allowed Tier 3 Boundaries**:
- `@universo/database` owns the shared Knex lifecycle and executor factories.
- `@universo/schema-ddl` plus migration packages own direct Knex DDL orchestration.
- `@universo/applications-backend` keeps raw Knex behind `src/ddl/index.ts` for runtime sync DDL work.
- `@universo/metahubs-backend` keeps raw Knex inside package DDL seams and schema-ddl integration paths.
- Route handlers and SQL-first stores outside these seams must not call `getKnex()` directly.
**Identifier Safety**:
- Use `qSchema()`, `qTable()`, `qColumn()`, `qSchemaTable()` from `@universo/database` for all dynamic identifiers.
- All helpers validate input and quote with double quotes; reject injection payloads.
- Bind parameters (`$1`, `$2`, ...) for all user-supplied values.
**Mutation Rules**:
- Mutating DML uses `RETURNING` when affected-row confirmation matters.
- Zero-row updates, deletes, restores, and sync-state writes fail closed instead of silently succeeding.
- Domain SQL stays schema-qualified; no domain path may rely on `search_path` for business-table resolution.
- Restore/delete flows constrain row state explicitly instead of mutating by bare `id` only.
**Enforcement**:
- `tools/lint-db-access.mjs` runs in CI (GitHub Actions) after ESLint, before build.
- Zero-violation policy: no baseline, no exceptions for domain packages.
- Excluded paths are narrow Tier 3 boundaries only: auth middleware, DDL subsystems, migration seeds, and package-local DDL boundary folders.
- `@universo/applications-backend` sync routes are not excluded from lint; raw Knex ownership for runtime sync now lives behind `src/ddl/index.ts`.
**Detection**: `node tools/lint-db-access.mjs` locally; CI step in `.github/workflows/main.yml`.
**Why**: Prevents SQL injection, enforces RLS correctness, keeps DDL transport isolated, and makes race-prone mutations observable through fail-closed contracts.
