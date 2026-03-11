# Final Comprehensive Plan: Complete TypeORM Removal From Metahubs & Applications

> Date: 2026-03-09 (QA-revised)
> Mode: PLAN
> Complexity: Level 4 (major backend refactor)
> Status: DRAFT v2 — post-QA revision
> Supersedes: `final-remove-typeorm-metahubs-applications-roadmap-2026-03-09.md` for execution detail
> Scope: Remove ALL TypeORM from `@universo/metahubs-backend` and `@universo/applications-backend`, replace the RLS transport, validate on a fresh database with a comprehensive test system.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Audit](#2-current-state-audit)
3. [Architecture Rules](#3-architecture-rules)
4. [Safe Code Patterns With Examples](#4-safe-code-patterns-with-examples)
5. [Implementation Batches](#5-implementation-batches)
6. [Comprehensive Test System](#6-comprehensive-test-system)
7. [Definition of Done](#7-definition-of-done)
8. [Recommended PR Slices](#8-recommended-pr-slices)

---

## 1. Executive Summary

### What is already done

- Backend startup uses Knex-based platform migration runner (no more `TypeORM.runMigrations()`).
- `metahubs` and `applications` platform schemas run from native SQL definitions.
- Runtime migration events mirror into `upl_migrations`.
- `applications-backend` is ~80% SQL-first: connectors, top-level CRUD, members, runtime schema lookup, copy flow all use `applicationsStore.ts` with raw SQL.
- Shared `DbSession` / `DbExecutor` / `RequestDbContext` contracts exist in `@universo/utils/database`.
- `QueryRunner` is no longer publicly exposed — hidden behind neutral `DbSession`.

### What remains

| Area | Files affected | Effort |
|------|---------------|--------|
| **applications-backend**: 3 `dataSource.transaction()` calls in `applicationsStore.ts` | 1 file | Small |
| **applications-backend**: `import type { DataSource }` in 5 src files | 5 files | Small |
| **applications-backend**: 5 entity files in `src/database/entities/` | 5 files to delete | Small |
| **RLS transport**: `ensureAuthWithRls.ts` uses TypeORM `QueryRunner` | 1 critical file | Medium |
| **metahubs-backend**: 31 files with `typeorm` imports | 31 files | Large |
| **metahubs-backend**: 7 entity files in `src/database/entities/` | 7 files to delete | Small |
| **metahubs-backend**: `TemplateSeeder.ts` uses ORM `.save()` / `.findOne()` | 1 file | Medium |
| **metahubs-backend**: `createLinkedApplication.ts` uses 4 entity repos | 1 file | Medium |
| **metahubs-backend**: `queryHelpers.ts` uses `SelectQueryBuilder` / `Repository` | 1 file | Medium |
| **metahubs-backend**: 16 route files pass `DataSource` through factory | 16 files | Medium |
| **core-backend**: entity registry imports from both packages | 1 file | Small |

### Critical finding from code audit

**~85–90% of metahubs-backend code is already raw SQL** (`manager.query()` or Knex). Only these spots use real ORM operations:

1. `TemplateSeeder.ts` — `.findOne()`, `.save()`, `.create()`, `.update()` on Template/TemplateVersion
2. `createLinkedApplication.ts` — `repo.save()`, `repo.createQueryBuilder().update()` on 4 entities
3. `queryHelpers.ts` — `applySoftDeleteFilter()` on `SelectQueryBuilder`, `softDelete()` / `restoreDeleted()` on `Repository`

Everything else is `manager.query(sql, params)` routed through the request-scoped `DataSource` — the TypeORM import is only for the `DataSource` type signature, not for ORM operations.

### Requirement Coverage Matrix (Original TZ → Plan Batches)

| # | TZ Requirement | Covering Batches | Status |
|---|---|---|---|
| 1 | Analyze and improve migration architecture, fully unify Metahubs and Applications | Batches 1–9 (TypeORM removal), Batch 11 (unified runtime history), Batch 12 (application-definition model) | ✅ Full |
| 2 | Move from reset-only workflow to reliable production-grade migration/data change system | Already done (platform migration runner). Batch 13 validates | ✅ Full |
| 3 | Fully replace TypeORM migrations and TypeORM persistence with the new system | Batches 1–10 — core of this plan | ✅ Full |
| 4 | Prepare DB/file structure-template workflow for future editor flows | Batch 12 (definition registry, `definitions` + `definitions_draft` tables, export/import) | ✅ Full |
| 5 | Maximize unification because Metahubs are a temporary special case | Batch 11 (shared `RuntimeMigrationStore`), Batch 12 (`definition_type` enum, unified template model) | ✅ Full |
| 6 | Support fixed schema names like `metahubs` and remove old TypeORM kernel path | Already done (native SQL definitions). Batches 1–9 complete removal | ✅ Full |
| 7 | Redefine Metahub structure/template as application-definition concepts | Batch 12.5–12.8 (template `definition_type`, conceptual model documentation) | ✅ Full |
| 8 | Preserve exact `metahubs` schema parity | Section 6.4 (Schema Parity Tests), Batch 13 | ✅ Full |
| 9 | Preserve full fresh-DB product flow | Batch 13 + Section 6.6 (Fresh-Database Acceptance) | ✅ Full |

---

## 2. Current State Audit

### 2.1 applications-backend (9 TypeORM imports)

```
src/persistence/applicationsStore.ts    → import type { DataSource }  ← 3 × dataSource.transaction()
src/routes/applicationsRoutes.ts        → import type { DataSource }  ← type only, no ORM ops
src/routes/connectorsRoutes.ts          → import type { DataSource }  ← type only, no ORM ops
src/routes/guards.ts                    → import type { DataSource }  ← type only, no ORM ops
src/routes/index.ts                     → import type { DataSource }  ← type only, passes DS to factories
src/database/entities/Application.ts    → TypeORM decorators           ← to delete
src/database/entities/ApplicationUser.ts→ TypeORM decorators           ← to delete
src/database/entities/Connector.ts      → TypeORM decorators           ← to delete
src/database/entities/ConnectorPublication.ts → TypeORM decorators     ← to delete
src/database/entities/index.ts          → re-exports entities         ← to delete
```

**Key insight**: The 3 `dataSource.transaction()` calls in `applicationsStore.ts` already contain pure SQL inside — they only use `manager.query()`. The TypeORM `DataSource` is used solely as a transaction coordinator. Replacing `DataSource.transaction()` with `DbExecutor.transaction()` is mechanical.

### 2.2 metahubs-backend (31 TypeORM imports)

**Routes (16 files)** — all follow the pattern:
```ts
import type { DataSource } from 'typeorm'
export function createXxxRoutes(ensureAuth, getDataSource: () => DataSource, read, write): Router
```
Inside the routes: `const manager = getRequestManager(req, getDataSource())` → `manager.query(sql, params)`.

**Services (6+ files)** — mostly raw SQL through `manager.query()`.

**ORM holdouts (3 files)**:
- `TemplateSeeder.ts` — uses `repo.findOne()`, `repo.save()`, `repo.create()`, `repo.update()`
- `createLinkedApplication.ts` — uses `repo.save()`, `repo.createQueryBuilder().update()`
- `queryHelpers.ts` — uses `SelectQueryBuilder`, `Repository` types

**Entities (7 files)** — decorators only, no business logic.

### 2.3 RLS Transport (auth-backend)

`ensureAuthWithRls.ts` current flow:
```
ds.createQueryRunner() → runner.connect() → set_config('request.jwt.claims', ..., false)
    → req.dbContext = createRequestDbContext(runner.manager, session)
    → res.once('finish', cleanup) → runner.query("SELECT set_config('request.jwt.claims', '', false)")
    → runner.release()
```

**Critical**: Uses session-scoped `set_config(..., false)` — NOT transaction-scoped. This means the JWT claims persist on the connection until explicitly reset. Cleanup happens via `res.once('finish')`.

### 2.4 Cross-package dependencies

**metahubs-backend → @universo/applications-backend** (5 files, not 1):

| File | Imports |
|------|--------|
| `domains/publications/helpers/createLinkedApplication.ts` | `Application`, `ApplicationUser`, `Connector`, `ConnectorPublication` |
| `domains/publications/routes/publicationsRoutes.ts` | `Application`, `ApplicationSchemaStatus`, `Connector`, `ConnectorPublication` |
| `domains/applications/routes/applicationMigrationsRoutes.ts` | `Application`, `ApplicationUser`, `ApplicationSchemaStatus`, `Connector`, `ConnectorPublication`, `ensureApplicationAccess` |
| `domains/applications/routes/applicationSyncRoutes.ts` | `Application`, `Connector`, `ConnectorPublication`, `ApplicationSchemaStatus`, `ensureApplicationAccess` |
| `domains/applications/services/ApplicationSchemaStateStore.ts` | `ApplicationSchemaStatus` (enum only) |

**Note**: `ApplicationSchemaStatus` is an enum, not an entity. It and `ensureApplicationAccess` guard should be moved to `@universo/types` or a shared neutral module to break the cross-package entity chain cleanly.

**universo-core-backend → entity registries**:
```
universo-core-backend → imports applicationsEntities from @universo/applications-backend
                      → imports metahubsEntities from @universo/metahubs-backend
                      → imports adminEntities from @universo/admin-backend
                      (in database/entities/index.ts for TypeORM entity registry)
```

**Other TypeORM consumers outside plan scope** (known remaining debt):

| Package | Files | Notes |
|---------|-------|-------|
| `start-backend` | `routes/index.ts`, `routes/onboardingRoutes.ts` | `import type { DataSource }` — type-only |
| `admin-backend` | 6+ route/service files | Heavy: repositories, QueryBuilder, `In` operator, `getRequestManager()` |
| `profile-backend` | routes, services, controller | `Repository<Profile>`, `DataSource` |
| `universo-utils` | `database/manager.ts`, `database/userLookup.ts` | Core contract — migrated in Batch 10 |
| `universo-migrations-platform` | `typeormAdapter.ts`, `platformMigrations.ts` | TypeORM adapter — intentionally kept |

---

## 3. Architecture Rules

### Non-negotiable

1. **No new ORM** — do not introduce Prisma, MikroORM, Drizzle, or a homegrown pseudo-ORM.
2. **SQL stays explicit** — no query DSL, no identity map, no lazy loading.
3. **`DbSession` / `DbExecutor` stay thin** — just `query()` + `transaction()` + `isReleased()`.
4. **Set-based SQL** — prefer `INSERT ... SELECT` over app-side loops for bulk operations.
5. **Schema-qualified SQL** — always use `applications.applications`, `metahubs.metahubs`, etc.
6. **Parameterized queries only** — never interpolate user input into SQL strings.
7. **UUID v7 everywhere** — use `public.uuid_generate_v7()` in SQL or the shared helper.
8. **All user-facing text must be i18n-ready** — use `@universo/i18n` keys.

### Allowed patterns

- Thin query-store modules (like existing `applicationsStore.ts`, `connectorsStore.ts`)
- Row type interfaces (plain TypeScript, no decorators)
- SQL fragment constants for SELECT/RETURNING clauses
- Explicit transaction helpers via `DbExecutor.transaction()`
- Schema-name validation via `@universo/schema-ddl` utilities

### Forbidden patterns

- `BaseRepository<T>` generic class
- Automatic relation materialization
- Runtime object graphs built by default
- Any import from `typeorm` in `applications-backend` or `metahubs-backend`

---

## 4. Safe Code Patterns With Examples

### Pattern 1: Replace `DataSource.transaction()` with `DbExecutor.transaction()`

**Before** (current `applicationsStore.ts`):
```ts
import type { DataSource } from 'typeorm'

export async function createApplicationWithOwner(
    dataSource: DataSource,
    input: { ... }
): Promise<ApplicationRecord> {
    return dataSource.transaction(async (manager) => {
        const executor: SqlExecutor = {
            query: <TRow = unknown>(sql: string, parameters?: unknown[]) =>
                manager.query(sql, parameters ?? []) as Promise<TRow[]>
        }
        // ... pure SQL inside ...
    })
}
```

**After** (neutral contract):
```ts
import type { DbExecutor } from '@universo/utils'

export async function createApplicationWithOwner(
    executor: DbExecutor,
    input: { ... }
): Promise<ApplicationRecord> {
    return executor.transaction(async (trx) => {
        const [{ id }] = await trx.query<{ id: string }>(
            `SELECT public.uuid_generate_v7() AS id`
        )
        const schemaName = input.resolveSchemaName(id)

        const insertedRows = await trx.query<ApplicationRecord>(
            `
            INSERT INTO applications.applications (
                id, name, description, slug, is_public, schema_name,
                _upl_created_by, _upl_updated_by
            )
            VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8)
            RETURNING ${APPLICATION_RETURNING}
            `,
            [id, JSON.stringify(input.name), JSON.stringify(input.description),
             input.slug ?? null, input.isPublic, schemaName,
             input.userId, input.userId]
        )

        await trx.query(
            `
            INSERT INTO applications.applications_users (
                application_id, user_id, role, _upl_created_by, _upl_updated_by
            )
            VALUES ($1, $2, 'owner', $3, $4)
            `,
            [id, input.userId, input.userId, input.userId]
        )

        return insertedRows[0]
    })
}
```

**Call site change**:
```ts
// Before:
const app = await createApplicationWithOwner(getDataSource(), input)

// After:
const executor = getRequestDbExecutor(req, getDataSource())
const app = await createApplicationWithOwner(executor, input)
```

### Pattern 2: Replace `TemplateSeeder` ORM operations with SQL

**Before** (current):
```ts
const existing = await this.templateRepo.findOne({
    where: { codename: manifest.codename, _uplDeleted: false }
})
// ...
const template = templateRepo.create({ codename: manifest.codename, ... })
const savedTemplate = await templateRepo.save(template)
const version = versionRepo.create({ templateId: savedTemplate.id, ... })
const savedVersion = await versionRepo.save(version)
await templateRepo.update(savedTemplate.id, { activeVersionId: savedVersion.id })
```

**After** (SQL-first):
```ts
export async function seedTemplate(
    executor: DbExecutor,
    manifest: MetahubTemplateManifest,
    hash: string
): Promise<'created' | 'updated' | 'skipped'> {
    // Check existing
    const [existing] = await executor.query<{ id: string; active_version_id: string | null }>(
        `
        SELECT id, active_version_id
        FROM metahubs.templates
        WHERE codename = $1
          AND COALESCE(_upl_deleted, false) = false
        LIMIT 1
        `,
        [manifest.codename]
    )

    if (!existing) {
        return createTemplate(executor, manifest, hash)
    }
    return updateTemplateIfChanged(executor, existing, manifest, hash)
}

async function createTemplate(
    executor: DbExecutor,
    manifest: MetahubTemplateManifest,
    hash: string
): Promise<'created'> {
    return executor.transaction(async (trx) => {
        // Insert template
        const [template] = await trx.query<{ id: string }>(
            `
            INSERT INTO metahubs.templates (
                codename, name, description, icon,
                is_system, is_active, sort_order
            )
            VALUES ($1, $2::jsonb, $3::jsonb, $4, true, true, 0)
            RETURNING id
            `,
            [manifest.codename, JSON.stringify(manifest.name),
             JSON.stringify(manifest.description), manifest.meta?.icon ?? null]
        )

        // Insert first version
        const [version] = await trx.query<{ id: string }>(
            `
            INSERT INTO metahubs.template_versions (
                template_id, version_number, version_label,
                min_structure_version, manifest_json, manifest_hash, is_active
            )
            VALUES ($1, 1, $2, $3, $4::jsonb, $5, true)
            RETURNING id
            `,
            [template.id, manifest.version, manifest.minStructureVersion,
             JSON.stringify(manifest), hash]
        )

        // Set active version pointer
        await trx.query(
            `UPDATE metahubs.templates SET active_version_id = $1 WHERE id = $2`,
            [version.id, template.id]
        )

        return 'created' as const
    })
}
```

### Pattern 3: Replace `createLinkedApplication.ts` entity repos with SQL

**Before** (current):
```ts
const applicationRepo = manager.getRepository(Application)
const appUserRepo = manager.getRepository(ApplicationUser)
const connectorRepo = manager.getRepository(Connector)
const connectorPublicationRepo = manager.getRepository(ConnectorPublication)

const application = applicationRepo.create({ name, description, ... })
await applicationRepo.save(application)
await applicationRepo.createQueryBuilder().update().set({ schemaName }).where('id = :id', { id: application.id }).execute()
const appUser = appUserRepo.create({ applicationId: application.id, userId, role: 'owner', ... })
await appUserRepo.save(appUser)
const connector = connectorRepo.create({ applicationId: application.id, name: metahubName, ... })
await connectorRepo.save(connector)
const connectorPublication = connectorPublicationRepo.create({ connectorId: connector.id, ... })
await connectorPublicationRepo.save(connectorPublication)
```

**After** (SQL-first, set-based):
```ts
export async function createLinkedApplication(
    executor: DbExecutor,
    input: {
        metahubName: VersionedLocalizedContent<string> | null
        metahubDescription: VersionedLocalizedContent<string> | null
        publicationId: string
        userId: string
        resolveSchemaName: (applicationId: string) => string
    }
): Promise<LinkedApplicationResult> {
    return executor.transaction(async (trx) => {
        // 1. Generate application ID
        const [{ id: applicationId }] = await trx.query<{ id: string }>(
            `SELECT public.uuid_generate_v7() AS id`
        )
        const schemaName = input.resolveSchemaName(applicationId)

        // 2. Create application with schema_name in one INSERT (no separate UPDATE)
        const [application] = await trx.query<ApplicationRecord>(
            `
            INSERT INTO applications.applications (
                id, name, description, schema_name,
                _upl_created_by, _upl_updated_by
            )
            VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6)
            RETURNING id, name, description, schema_name AS "schemaName",
                      _upl_created_at AS "createdAt"
            `,
            [applicationId,
             JSON.stringify(input.metahubName ?? { _primary: 'en', en: 'Application' }),
             JSON.stringify(input.metahubDescription),
             schemaName, input.userId, input.userId]
        )

        // 3. Create owner membership
        await trx.query(
            `
            INSERT INTO applications.applications_users (
                application_id, user_id, role,
                _upl_created_by, _upl_updated_by
            )
            VALUES ($1, $2, 'owner', $3, $4)
            `,
            [applicationId, input.userId, input.userId, input.userId]
        )

        // 4. Create connector
        const [connector] = await trx.query<{ id: string }>(
            `
            INSERT INTO applications.connectors (
                application_id, name, description, sort_order,
                _upl_created_by, _upl_updated_by
            )
            VALUES ($1, $2::jsonb, $3::jsonb, 0, $4, $5)
            RETURNING id
            `,
            [applicationId,
             JSON.stringify(input.metahubName ?? { _primary: 'en', en: 'Connector' }),
             JSON.stringify(input.metahubDescription),
             input.userId, input.userId]
        )

        // 5. Create connector-publication link
        await trx.query(
            `
            INSERT INTO applications.connectors_publications (
                connector_id, publication_id, sort_order,
                _upl_created_by, _upl_updated_by
            )
            VALUES ($1, $2, 0, $3, $4)
            `,
            [connector.id, input.publicationId, input.userId, input.userId]
        )

        return { application, connector, appSchemaName: schemaName }
    })
}
```

**Key improvement**: The original code does INSERT then separate UPDATE for `schemaName` — the SQL version includes `schema_name` directly in the INSERT, removing one round-trip.

### Pattern 4: Replace `queryHelpers.ts` with SQL functions

**Before** (TypeORM query builder):
```ts
import type { SelectQueryBuilder, Repository, ObjectLiteral } from 'typeorm'

export function applySoftDeleteFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>, alias: string, options: SoftDeleteOptions = {}
): SelectQueryBuilder<T> {
    if (onlyDeleted) return qb.andWhere(`${alias}.is_deleted = :isDeleted`, { isDeleted: true })
    if (!includeDeleted) return qb.andWhere(`${alias}.is_deleted = :isDeleted`, { isDeleted: false })
    return qb
}

export async function softDelete<T extends ObjectLiteral>(
    repo: Repository<T>, id: string, userId?: string
): Promise<void> {
    await repo.createQueryBuilder().update()
        .set({ is_deleted: true, deleted_at: () => 'NOW()', deleted_by: userId ?? null } as unknown as T)
        .where('id = :id', { id }).execute()
}
```

**After** (pure SQL helpers):
```ts
/**
 * Returns a SQL WHERE clause fragment for soft-delete filtering.
 * Use with parameterized queries — this returns static SQL only.
 */
export function softDeleteWhereClause(
    alias: string,
    options: { includeDeleted?: boolean; onlyDeleted?: boolean } = {}
): string {
    if (options.onlyDeleted) return `AND COALESCE(${alias}._upl_deleted, false) = true`
    if (!options.includeDeleted) return `AND COALESCE(${alias}._upl_deleted, false) = false`
    return ''
}

/**
 * Canonical allowlist of schema-qualified table names that accept soft-delete
 * operations. This is enforced inside softDeleteById / restoreSoftDeleteById
 * to guarantee SQL injection is impossible even if a call site makes a mistake.
 */
const SOFT_DELETE_ALLOWED_TABLES = new Set([
    'metahubs.metahubs',
    'metahubs.metahub_branches',
    'metahubs.publications',
    'metahubs.publication_versions',
    'metahubs.templates',
    'metahubs.template_versions',
    'applications.applications',
    'applications.connectors',
    'applications.connectors_publications',
    // extend as needed — but NEVER accept user input here
])

function assertValidTable(table: string): void {
    if (!SOFT_DELETE_ALLOWED_TABLES.has(table)) {
        throw new Error(`[softDelete] Forbidden table name: ${table}`)
    }
}

/**
 * Soft-deletes an entity by ID using the three-level system field convention.
 * Table name is validated against a built-in allowlist to prevent SQL injection.
 */
export async function softDeleteById(
    executor: DbExecutor,
    table: string,  // e.g. 'metahubs.metahubs'
    id: string,
    userId?: string
): Promise<boolean> {
    assertValidTable(table)
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE ${table}
        SET _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_updated_by = $2
        WHERE id = $1
        RETURNING id
        `,
        [id, userId ?? null]
    )
    return rows.length > 0
}

/**
 * Restores a soft-deleted entity by ID.
 * Table name is validated against a built-in allowlist to prevent SQL injection.
 */
export async function restoreSoftDeleteById(
    executor: DbExecutor,
    table: string,
    id: string
): Promise<boolean> {
    assertValidTable(table)
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE ${table}
        SET _upl_deleted = false,
            _upl_deleted_at = NULL,
            _upl_deleted_by = NULL,
            _upl_updated_at = NOW()
        WHERE id = $1
        RETURNING id
        `,
        [id]
    )
    return rows.length > 0
}
```

**SECURITY NOTE**: The `table` parameter is validated by `assertValidTable()` inside every call — SQL injection is impossible as long as `SOFT_DELETE_ALLOWED_TABLES` is not dynamically extended. Call sites should still use hardcoded string constants for clarity.

### Pattern 5: Replace RLS QueryRunner Transport with Knex

**Before** (current `ensureAuthWithRls.ts`):
```ts
const ds = getDataSource()
const runner = ds.createQueryRunner()
await runner.connect()

const session = createDbSession({
    query: <T = unknown>(sql: string, parameters?: unknown[]) =>
        runner.query(sql, parameters) as Promise<T[]>,
    isReleased: () => runner.isReleased
})

await applyRlsContext(session, access)
;(req as RequestWithDbContext).dbContext = createRequestDbContext(runner.manager, session)

// Cleanup:
res.once('finish', async () => {
    await runner.query(`SELECT set_config('request.jwt.claims', '', false)`)
    await runner.release()
})
```

**After** (Knex-backed, transaction-scoped):
```ts
import type { Knex } from 'knex'

export function createEnsureAuthWithRls(options: {
    getKnex: () => Knex
}): RequestHandler {
    const { getKnex } = options

    return async (req, res, next) => {
        // ... auth check as before ...

        const knex = getKnex()

        // Acquire a raw connection from the Knex pool for the request lifetime.
        // We intentionally do NOT use a Knex transaction here, because:
        // 1. Most requests execute multiple independent statements, not one atomic unit.
        // 2. A transaction would auto-rollback on any statement error, which is too aggressive
        //    for a read-heavy request lifecycle.
        // 3. RLS context needs session-scoped set_config (false), not transaction-local (true),
        //    because the connection may serve multiple query() calls across handlers.
        //
        // Instead, we acquire a dedicated connection, set the RLS claims, and release + reset
        // on response completion — exactly like the current QueryRunner flow.

        const rawConnection = await knex.client.acquireConnection()

        let cleanupStarted = false

        const session = createDbSession({
            query: async <T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]> => {
                const result = await knex.raw(sql, parameters ?? []).connection(rawConnection)
                return result.rows ?? result
            },
            isReleased: () => cleanupStarted
        })

        const executor = createDbExecutor({
            query: session.query,
            transaction: async <T>(callback: (trx: DbExecutor) => Promise<T>): Promise<T> => {
                // For explicit transactions within the request, use Knex transaction
                // on the same raw connection to preserve RLS context
                return knex.transaction(async (trx) => {
                    const trxExecutor = createDbExecutor({
                        query: async <TRow = unknown>(sql: string, params?: unknown[]) => {
                            const res = await trx.raw(sql, params ?? [])
                            return (res.rows ?? res) as TRow[]
                        },
                        transaction: async <TInner>(cb: (e: DbExecutor) => Promise<TInner>) =>
                            cb(trxExecutor), // reuse existing transaction
                        isReleased: () => cleanupStarted
                    })
                    return callback(trxExecutor)
                }, { connection: rawConnection })
            },
            isReleased: () => cleanupStarted
        })

        const cleanup = async () => {
            if (cleanupStarted) return
            cleanupStarted = true
            try {
                await knex.raw(
                    `SELECT set_config('request.jwt.claims', '', false)`
                ).connection(rawConnection)
            } catch (err) {
                console.warn('[RLS] Failed to reset session context:', err)
            }
            try {
                knex.client.releaseConnection(rawConnection)
            } catch (err) {
                console.error('[RLS] Error releasing connection:', err)
            }
            delete (req as RequestWithDbContext).dbContext
        }

        res.once('finish', cleanup)
        res.once('close', cleanup)

        try {
            await applyRlsContext(session, access)

            ;(req as RequestWithDbContext).dbContext = {
                session,
                executor,
                isReleased: () => cleanupStarted,
                query: session.query
            }

            next()
        } catch (error) {
            await cleanup()
            // ... error handling as before ...
            next(error)
        }
    }
}
```

**IMPORTANT safety notes for RLS replacement**:

1. **Session-scoped set_config is intentional** — web search confirmed Knex issue #6220 warns about RLS leakage when using connection pools. The current design with session-scoped `set_config(..., false)` + explicit reset on cleanup is correct.

2. **Do NOT switch to transaction-scoped `set_config(..., true)`** — that would require wrapping the entire request in a single transaction, which is too aggressive for read-heavy flows.

3. **Raw connection pinning** — the request needs a dedicated pooled connection for RLS. The Knex `client.acquireConnection()` / `client.releaseConnection()` API achieves the same connection pinning as TypeORM's `QueryRunner.connect()` / `QueryRunner.release()`.

4. **Pool budget preservation** — the current pool budget formula (`knexReserve = max(4, floor(budget/3))`) must be revisited. When TypeORM's QueryRunner pool is eliminated, the entire budget goes to Knex. This simplifies pool management significantly.

**Note on `acquireConnection` stability**: This API is already used in production in `@universo/schema-ddl/locking.ts` for advisory lock acquisition (Knex 3.1.0 + pg 8.11.1). No stability concerns.

### Pattern 6: Route factory signature change

**Before**:
```ts
import type { DataSource } from 'typeorm'

export function createMetahubsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    read: RequestHandler,
    write: RequestHandler
): Router {
    // ...
    const manager = getRequestManager(req, getDataSource())
    const rows = await manager.query(sql, params)
}
```

**After**:
```ts
import type { DbExecutor } from '@universo/utils'

export function createMetahubsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    read: RequestHandler,
    write: RequestHandler
): Router {
    // ...
    const executor = getRequestDbExecutor(req, getDbExecutor())
    const rows = await executor.query(sql, params)
}
```

**No new `DbProvider` interface** — `DbExecutor` already has the exact contract needed (`query()`, `transaction()`, `isReleased()`). Introducing a duplicate interface adds cognitive overhead with zero benefit. The key change is that the route factory type signature no longer mentions `DataSource`.

### Pattern 7: Remove `RequestDbContext.manager` and `RequestDbContext.getRepository()`

**Before** (current `manager.ts`):
```ts
export interface RequestDbContext {
    session: DbSession
    executor: DbExecutor
    manager: EntityManager         // ← TypeORM leak
    isReleased(): boolean
    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>
    getRepository<Entity extends ObjectLiteral>(entity: EntityTarget<Entity>): Repository<Entity>  // ← TypeORM leak
}
```

**After**:
```ts
export interface RequestDbContext {
    session: DbSession
    executor: DbExecutor
    isReleased(): boolean
    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>
}
```

**Updated factory signature**:
```ts
// Before: createRequestDbContext(manager: EntityManager, session: DbSession)
// After:
export function createRequestDbContext(session: DbSession, executor: DbExecutor): RequestDbContext {
    return {
        session,
        executor,
        isReleased: () => session.isReleased(),
        query: <T = unknown>(sql: string, parameters?: unknown[]) => session.query<T>(sql, parameters)
    }
}
```

The `manager` and `getRepository()` fields must be removed, because:
- `applications-backend` and `metahubs-backend` won't use them after cutover.
- Other packages (`admin-backend`, `profile-backend`) still use TypeORM — they retain their own `DataSource` access but must NOT route through the shared request context contract.

**Migration path**: Keep `manager` as an optional deprecated field during the transition, then remove it when all consumers are migrated. The legacy `createRequestDbContext(manager, session)` signature is kept as a separate function in `@universo/utils/database/legacy` for admin/profile.

---

## 5. Implementation Batches

### Batch 1: Finish `applications-backend` TypeORM removal

**Goal**: Zero `typeorm` imports in `applications-backend/base/src/`.

**Steps**:

- [ ] Step 1.1: Replace `dataSource: DataSource` parameter in `applicationsStore.ts` functions (`createApplicationWithOwner`, `copyApplicationWithOptions`, `deleteApplicationWithSchema`) with `executor: DbExecutor` — the inner SQL is already pure.
- [ ] Step 1.2: Update `applicationsRoutes.ts` call sites to pass `getRequestDbExecutor(req, ...)` instead of `getDataSource()`.
- [ ] Step 1.3: Replace `import type { DataSource }` in `guards.ts` with neutral `DbExecutor` or `DbSession` — guards already use `getRequestDbSession()`.
- [ ] Step 1.4: Replace `import type { DataSource }` in `connectorsRoutes.ts` — already SQL-first.
- [ ] Step 1.5: Replace `import type { DataSource }` in `routes/index.ts` — change factory signature.
- [ ] Step 1.6: Remove `getRequestManager()` usage from all applications-backend files.
- [ ] Step 1.7: Delete `src/database/entities/` directory (5 entity files).
- [ ] Step 1.8: Remove `applicationsEntities` export from package index.
- [ ] Step 1.9: Remove `typeorm` from `package.json` dependencies.
- [ ] Step 1.10: Update applications-backend README.
- [ ] Step 1.11: Run `pnpm --filter @universo/applications-backend test` and `pnpm --filter @universo/applications-backend build`.

**Exit gate**: `rg "typeorm" packages/applications-backend/base/src/` returns nothing.

### Batch 2: Clean up core-backend entity registry for applications

**Goal**: `universo-core-backend` no longer imports `applicationsEntities`.

**Steps**:

- [ ] Step 2.1: Remove `applicationsEntities` import from `packages/universo-core-backend/base/src/database/entities/index.ts`.
- [ ] Step 2.2: Remove `applicationsEntities` spread from the aggregated entities array.
- [ ] Step 2.3: Verify that no other core-backend code imports Application/ApplicationUser/Connector/ConnectorPublication entities.
- [ ] Step 2.4: Run `pnpm --filter @universo/core-backend build`.

**Exit gate**: No applications-backend entity references in core-backend.

### Batch 3: Isolate TypeORM from shared request DB contract

**Goal**: `req.dbContext` exposes only neutral `DbSession`/`DbExecutor`. TypeORM `EntityManager` is hidden behind a separate legacy accessor for packages that still need it (`admin-backend`, `profile-backend`).

**Approach**: Keep the current TypeORM QueryRunner as the INTERNAL connection-pinning mechanism. The RLS middleware continues to use `ds.createQueryRunner()` under the hood (which is battle-tested), but the public contract changes:
- `req.dbContext` → neutral `{ session, executor, query, isReleased }`
- `req.dbLegacyManager` → TypeORM `EntityManager` for admin/profile only (clearly deprecated)

Full Knex-only transport (Pattern 5) becomes a **future** batch after admin/profile are migrated off TypeORM.

**Steps**:

- [ ] Step 3.1: Split `RequestDbContext` into neutral interface (no `manager`/`getRepository`) and legacy interface.
- [ ] Step 3.2: Update `createRequestDbContext()` signature: `(session: DbSession, executor: DbExecutor)` for the neutral path.
- [ ] Step 3.3: Create `createLegacyRequestDbContext(manager: EntityManager, session: DbSession)` that returns both neutral fields AND `manager`.
- [ ] Step 3.4: Update `ensureAuthWithRls.ts` to attach neutral `req.dbContext` AND separate `req.dbLegacyManager` (TypeORM `EntityManager`).
- [ ] Step 3.5: Update `getRequestDbExecutor()` fallback to use Knex `getKnexInstance()` instead of `DataSource.query()` for packages that don't need TypeORM.
- [ ] Step 3.6: Verify that `admin-backend` routes use `req.dbLegacyManager` or `getRequestManager()` from legacy subpath — no visible breakage.
- [ ] Step 3.7: Verify that `profile-backend` routes continue working through legacy path.
- [ ] Step 3.8: Add focused integration test for RLS context: set claims → query → verify isolation.
- [ ] Step 3.9: Add focused test for cleanup: verify claims are reset after response.
- [ ] Step 3.10: Run full `pnpm build` and manual smoke test.

**Exit gate**: `req.dbContext` interface has no TypeORM types. Admin/profile routes compile and pass smoke tests via legacy accessor.

**Future batch** (after admin/profile migration): Replace TypeORM QueryRunner internals with Knex `acquireConnection()` (Pattern 5). At that point, TypeORM pool can be eliminated entirely.

### Batch 4: Build SQL-first foundations for `metahubs-backend`

**Goal**: Shared query-store modules exist for all metahubs entities.

**Steps**:

- [ ] Step 4.1: Create `packages/metahubs-backend/base/src/persistence/` directory.
- [ ] Step 4.2: Create `metahubsStore.ts` — SQL-first CRUD for `metahubs.metahubs` table.
- [ ] Step 4.3: Create `branchesStore.ts` — SQL-first CRUD for `metahubs.metahub_branches`.
- [ ] Step 4.4: Create `publicationsStore.ts` — SQL-first CRUD for `metahubs.publications` and `metahubs.publication_versions`.
- [ ] Step 4.5: Create `templatesStore.ts` — SQL-first CRUD for `metahubs.templates` and `metahubs.template_versions`.
- [ ] Step 4.6: Create `hubsStore.ts` — if needed for hub-related SQL queries.
- [ ] Step 4.7: Replace `queryHelpers.ts` with neutral `metahubsQueryHelpers.ts` (Pattern 4 above).
- [ ] Step 4.8: Add row-type interfaces (plain TypeScript, no decorators) in each store module.

**Exit gate**: All store modules compile and have basic type coverage.

### Batch 5: Port `TemplateSeeder.ts` to SQL-first

**Goal**: `TemplateSeeder` no longer uses TypeORM repositories.

**Steps**:

- [ ] Step 5.1: Rewrite `TemplateSeeder` constructor to accept `DbExecutor` instead of `DataSource`.
- [ ] Step 5.2: Replace `repo.findOne()` with `SELECT ... WHERE codename = $1 LIMIT 1`.
- [ ] Step 5.3: Replace `repo.save()` / `repo.create()` with `INSERT ... RETURNING`.
- [ ] Step 5.4: Replace `repo.update()` with `UPDATE ... WHERE id = $1`.
- [ ] Step 5.5: Replace `dataSource.transaction()` with `executor.transaction()`.
- [ ] Step 5.6: Add focused test for template seeding on empty table + idempotent re-seed.

**Exit gate**: `TemplateSeeder.ts` has no `typeorm` imports.

### Batch 6: Port cross-package entity imports in metahubs-backend to SQL-first

**Goal**: `metahubs-backend` no longer imports entity classes from `@universo/applications-backend`. Application creation from publications uses SQL. Shared enums/guards are extracted to neutral packages.

**Steps**:

- [ ] Step 6.1: Move `ApplicationSchemaStatus` enum from `@universo/applications-backend` to `@universo/types` (it's a pure type, not an entity).
- [ ] Step 6.2: Move `ensureApplicationAccess` guard to a neutral location (either `@universo/utils` or a shared guards module) so metahubs-backend can import it without pulling application entities.
- [ ] Step 6.3: Rewrite `createLinkedApplication.ts` to accept `DbExecutor` and use SQL INSERT (Pattern 3 above). Remove imports of `Application`, `ApplicationUser`, `Connector`, `ConnectorPublication` entity classes.
- [ ] Step 6.4: Update `publicationsRoutes.ts` — replace `Application`, `Connector`, `ConnectorPublication` entity imports with SQL queries and the moved `ApplicationSchemaStatus` enum from `@universo/types`.
- [ ] Step 6.5: Update `applicationMigrationsRoutes.ts` — replace entity imports with SQL queries, use moved `ApplicationSchemaStatus` and `ensureApplicationAccess`.
- [ ] Step 6.6: Update `applicationSyncRoutes.ts` — same treatment as 6.5.
- [ ] Step 6.7: Update `ApplicationSchemaStateStore.ts` — import `ApplicationSchemaStatus` from `@universo/types` instead of `@universo/applications-backend`.
- [ ] Step 6.8: Add focused tests for linked application creation and cross-package guard behavior.
- [ ] Step 6.9: Update `@universo/applications-backend` to re-export `ApplicationSchemaStatus` from `@universo/types` for backward compatibility.

**Exit gate**: `metahubs-backend` has zero entity class imports from `@universo/applications-backend`. Only enum/type imports from `@universo/types`.

### Batch 7: Port metahubs-backend route factories

**Goal**: All 16 route factory files accept neutral `DbExecutor` instead of `DataSource`.

**Steps**:

- [ ] Step 7.1: Update `router.ts` — change `createMetahubsServiceRoutes` signature to accept `() => DbExecutor` instead of `() => DataSource`.
- [ ] Step 7.2: Update each route factory file (`metahubsRoutes.ts`, `branchesRoutes.ts`, `hubsRoutes.ts`, `catalogsRoutes.ts`, `setsRoutes.ts`, `enumerationsRoutes.ts`, `attributesRoutes.ts`, `constantsRoutes.ts`, `elementsRoutes.ts`, `layoutsRoutes.ts`, `settingsRoutes.ts`, `templatesRoutes.ts`, `publicationsRoutes.ts`, `metahubMigrationsRoutes.ts`, `applicationMigrationsRoutes.ts`, `applicationSyncRoutes.ts`).
- [ ] Step 7.3: Replace `getRequestManager(req, getDataSource())` with `getRequestDbExecutor(req, getDbExecutor())` in each route.
- [ ] Step 7.4: Replace `manager.query(sql, params)` with `executor.query(sql, params)` — this is mostly a search-and-replace.
- [ ] Step 7.5: Replace any remaining `manager.getRepository(...)` calls with SQL.

**Exit gate**: No route file in metahubs-backend imports `typeorm`.

### Batch 8: Port metahubs-backend services

**Goal**: Services like `MetahubBranchesService`, `MetahubSchemaService`, etc. use neutral contracts.

**Steps**:

- [ ] Step 8.1: Port `MetahubBranchesService` — already mostly raw SQL via `manager.query()`.
- [ ] Step 8.2: Port `MetahubSchemaService` — uses Knex for DDL, may have `DataSource` type.
- [ ] Step 8.3: Port remaining services under `domains/**/services/`.
- [ ] Step 8.4: Port guard files that still reference `DataSource`.

**Exit gate**: No service file in metahubs-backend imports `typeorm`.

### Batch 9: Delete `metahubs-backend/src/database` and clean up

**Goal**: Zero TypeORM in metahubs-backend.

**Steps**:

- [ ] Step 9.1: Delete `src/database/entities/` (7 entity files).
- [ ] Step 9.2: Delete any legacy migration helpers in `src/database/`.
- [ ] Step 9.3: Remove `metahubsEntities` export from package index.
- [ ] Step 9.4: Remove `typeorm` from `package.json` dependencies.
- [ ] Step 9.5: Update metahubs-backend README.
- [ ] Step 9.6: Remove `metahubsEntities` import from `core-backend/database/entities/index.ts`.

**Exit gate**: `rg "typeorm" packages/metahubs-backend/base/src/` returns nothing.

### Batch 10: Remove `RequestDbContext.manager` and `getRequestManager()`

**Goal**: The shared request DB contract is fully TypeORM-free for migrated packages.

**Steps**:

- [ ] Step 10.1: Remove `manager` field from `RequestDbContext` interface.
- [ ] Step 10.2: Remove `getRepository()` from `RequestDbContext`.
- [ ] Step 10.3: Remove `getRequestManager()` and `getRequestRepository()` exports from `@universo/utils/database` main barrel.
- [ ] Step 10.4: Move `getRequestManager()`, `getRequestRepository()`, `createRequestDbContext(manager, session)` (the legacy overload), and associated TypeORM types to `@universo/utils/database/legacy` subpath export. This is unconditional — `admin-backend` and `profile-backend` both depend on these functions.
- [ ] Step 10.5: Update `admin-backend` imports: `import { getRequestManager } from '@universo/utils/database/legacy'`.
- [ ] Step 10.6: Update `profile-backend` imports similarly.
- [ ] Step 10.7: Update `start-backend` imports if they use `getRequestManager()`.
- [ ] Step 10.8: Update all remaining codebase imports.
- [ ] Step 10.9: Verify `@universo/utils/database` main exports have no TypeORM types (only `DbSession`, `DbExecutor`, `RequestDbContext` neutral version).

**Exit gate**: `@universo/utils/database` main exports have no TypeORM types. Legacy subpath compiles and admin/profile/start tests pass.

### Batch 11: Unify runtime history contracts

**Goal**: `_mhb_migrations` and `_app_migrations` share one mental model and a common code path.

**Steps**:

- [ ] Step 11.1: Extract a shared `RuntimeMigrationHistory` interface in `@universo/migrations-core` that describes the common shape of `_mhb_migrations` and `_app_migrations` tables (columns: `id`, `migration_name`, `checksum`, `applied_at`, `run_id`, etc.).
- [ ] Step 11.2: Create a shared `RuntimeMigrationStore` module in `@universo/migrations-core` with functions: `recordRuntimeMigrationRun(trx, schemaName, tableName, run)`, `listRuntimeHistory(executor, schemaName, tableName)`, `getLastApplied(executor, schemaName, tableName)`.
- [ ] Step 11.3: Refactor `metahubs-backend` runtime migration path to use `RuntimeMigrationStore` instead of direct SQL against `_mhb_migrations`.
- [ ] Step 11.4: Refactor `applications-backend` runtime migration path to use `RuntimeMigrationStore` instead of direct SQL against `_app_migrations`.
- [ ] Step 11.5: Normalize global catalog write paths — both runtime flows must use the same `mirrorToGlobalCatalog()` helper.
- [ ] Step 11.6: Evaluate whether the per-schema compatibility tables (`_mhb_migrations`, `_app_migrations`) can be replaced with a single `_runtime_migrations` table per dynamic schema, or if backward compatibility requires keeping separate names.
- [ ] Step 11.7: Add regression tests proving that history queries return identical shapes from both paths.

**Exit gate**: Runtime migration recording code is shared, DRY, and tested. Both paths write to the global catalog identically.

### Batch 12: DB/file desired-state registry and application-definition model

**Goal**: Canonical definition registry supports DB-stored desired state. Metahub structure/template concepts are redefined as application-definition primitives, preparing for the future where "Metahub" is just one lens on the unified model.

**Steps**:

- [ ] Step 12.1: Define a `DefinitionArtifact` interface in `@universo/migrations-catalog` representing a single schema definition unit (table, index, RLS policy, seed data). Fields: `kind`, `name`, `schemaQualifiedName`, `sql`, `checksum`, `dependencies[]`.
- [ ] Step 12.2: Add a `definitions` table to the catalog schema (`upl_migrations.definitions`) storing: `id`, `artifact_kind`, `schema_name`, `name`, `sql_hash`, `sql_content`, `source` (file|db|editor), `created_at`, `updated_at`.
- [ ] Step 12.3: Implement `registerDefinition(trx, artifact)` and `listDefinitions(executor, filter)` in `@universo/migrations-catalog`.
- [ ] Step 12.4: Implement round-trip: `exportDefinitions(executor, schemaName) → DefinitionArtifact[]` (query live schema → produce artifacts) and `importDefinitions(trx, artifacts[]) → void` (write artifacts to definitions table).
- [ ] Step 12.5: **Application-definition model**: Define the conceptual mapping where a Metahub template = an application definition template. Concretely:
  - Rename/alias `metahubs.templates` as the canonical "definition template" registry.
  - Add a `definition_type` column (or enum) to distinguish: `metahub_template`, `application_template`, `custom`.
  - Ensure the `template_versions.manifest_json` structure can describe both Metahub-specific manifest and generic application manifest.
- [ ] Step 12.6: Add a migration that extends `metahubs.templates` with `definition_type` column (default: `metahub_template` for backward compatibility).
- [ ] Step 12.7: Update `TemplateSeeder` to set `definition_type = 'metahub_template'` on seeded templates.
- [ ] Step 12.8: Document the application-definition model in `systemPatterns.md`: how Metahubs are a specialization of a generic application-definition pattern, and how templates will eventually support non-Metahub definitions.
- [ ] Step 12.9: Prepare for future editor flow — add a `definitions_draft` table (same schema as `definitions` but with `status: draft|review|published`) to support the upcoming definition editor UI. No editor UI in this task.
- [ ] Step 12.10: Add tests for definition registry CRUD and round-trip export/import.

**Exit gate**: Definitions can be stored, exported, and imported. Template model supports `definition_type`. No editor UI, but the data layer is ready.

### Batch 13: Full acceptance and performance closure

**Goal**: The original technical brief is validated end-to-end on a fresh database.

**Steps**:

- [ ] Step 13.1: Run full test system (see Section 6).
- [ ] Step 13.2: Fresh-database acceptance test (see Section 6.6).
- [ ] Step 13.3: Performance regression baseline.
- [ ] Step 13.4: Update all memory-bank files.

---

## 6. Comprehensive Test System

### 6.1 Unit Tests

**Scope**: Pure logic, no database required.

```
packages/universo-utils/base/src/database/__tests__/
├── dbSession.test.ts          — DbSession contract
├── dbExecutor.test.ts         — DbExecutor contract, transaction reuse
├── requestDbContext.test.ts   — Context creation, fallback behavior
└── sqlHelpers.test.ts         — softDeleteWhereClause, assertValidTable

packages/applications-backend/base/src/tests/
├── persistence/
│   └── applicationsStore.test.ts  — SQL query shape, parameter binding
└── utils/
    └── queryHelpers.test.ts       — (if any neutral helpers remain)

packages/metahubs-backend/base/src/tests/
├── persistence/
│   ├── metahubsStore.test.ts
│   ├── branchesStore.test.ts
│   ├── publicationsStore.test.ts
│   └── templatesStore.test.ts
├── services/
│   └── templateSeeder.test.ts     — Seed idempotency, hash comparison
└── utils/
    └── metahubsQueryHelpers.test.ts
```

**Test patterns**:

```ts
// Example: applicationsStore unit test
describe('createApplicationWithOwner', () => {
    it('should call transaction with INSERT for application and membership', async () => {
        const queries: Array<{ sql: string; params: unknown[] }> = []
        const mockExecutor: DbExecutor = {
            query: async (sql, params) => {
                queries.push({ sql, params: params ?? [] })
                if (sql.includes('uuid_generate_v7')) return [{ id: 'test-uuid' }] as any
                if (sql.includes('INSERT INTO applications.applications')) {
                    return [{ id: 'test-uuid', name: {}, schemaName: 'app_test' }] as any
                }
                return [] as any
            },
            transaction: async (cb) => cb(mockExecutor),
            isReleased: () => false
        }

        await createApplicationWithOwner(mockExecutor, {
            name: { _primary: 'en', en: 'Test' },
            description: null,
            isPublic: false,
            userId: 'user-1',
            resolveSchemaName: (id) => `app_${id}`
        })

        expect(queries).toHaveLength(3) // uuid, insert app, insert membership
        expect(queries[1].sql).toContain('INSERT INTO applications.applications')
        expect(queries[2].sql).toContain('INSERT INTO applications.applications_users')
        expect(queries[2].sql).toContain("'owner'")
    })
})
```

### 6.2 Route Integration Tests

**Scope**: HTTP-level tests with mocked DB layer.

These already exist for `applicationsRoutes` (26 tests) and should be extended:

```ts
describe('POST /applications', () => {
    it('should create application with owner membership in one transaction', async () => {
        // Mock DbExecutor.transaction to capture inner calls
        // Verify SQL shape and parameter binding
        // Verify response status and body shape
    })

    it('should return 409 on duplicate slug', async () => { ... })
    it('should return 403 for non-member', async () => { ... })
})
```

**New test files needed**:

```
packages/metahubs-backend/base/src/tests/routes/
├── metahubsRoutes.test.ts
├── branchesRoutes.test.ts
├── publicationsRoutes.test.ts
├── templatesRoutes.test.ts
├── hubsRoutes.test.ts
├── catalogsRoutes.test.ts
├── setsRoutes.test.ts
├── enumerationsRoutes.test.ts
├── attributesRoutes.test.ts
├── constantsRoutes.test.ts
├── elementsRoutes.test.ts
├── layoutsRoutes.test.ts
└── settingsRoutes.test.ts
```

### 6.3 Database-Backed Integration Tests

**Scope**: Real PostgreSQL, real transactions, real RLS.

**Setup**: Use a test database with the platform migration runner:

```ts
// test-setup.ts
import { createDatabaseTestContext } from './helpers/testDb'

let ctx: DatabaseTestContext

beforeAll(async () => {
    ctx = await createDatabaseTestContext()
    // Runs platform migrations, creates test schemas
})

afterAll(async () => {
    await ctx.destroy()
})
```

**Test cases**:

```ts
describe('RLS isolation', () => {
    it('should only return rows visible to the authenticated user', async () => {
        // Create two users with separate applications
        // Query as user A → should not see user B's applications
        // Query as user B → should not see user A's applications
    })

    it('should reset claims after request cleanup', async () => {
        // Set claims for user A
        // Call cleanup
        // Verify claims are empty
        // Set claims for user B
        // Verify user B's context is clean
    })
})

describe('Transaction atomicity', () => {
    it('should rollback all changes on mid-transaction error', async () => {
        // Start createApplicationWithOwner
        // Inject error after INSERT application but before INSERT membership
        // Verify neither row exists
    })
})

describe('Bulk copy operations', () => {
    it('should copy application with members and connectors in one transaction', async () => {
        // Create source application with 3 members and 2 connectors
        // Copy it
        // Verify all rows exist in target
        // Verify source rows unchanged
    })
})
```

### 6.4 Schema Parity Tests

**Scope**: Verify that the live schema matches the expected SQL source of truth.

```ts
describe('Schema parity', () => {
    it('metahubs schema should match native SQL definition', async () => {
        // Query information_schema.tables for 'metahubs' schema
        // Compare table list against expected set
        // For each table: compare column names, types, defaults
        // Compare indexes, constraints, RLS policies
    })

    it('applications schema should match native SQL definition', async () => {
        // Same as above for 'applications' schema
    })

    it('should have all expected RLS policies', async () => {
        const policies = await ctx.query(`
            SELECT schemaname, tablename, policyname, cmd, qual
            FROM pg_policies
            WHERE schemaname IN ('metahubs', 'applications')
            ORDER BY schemaname, tablename, policyname
        `)
        expect(policies).toMatchSnapshot()
    })
})
```

### 6.5 Concurrency Tests

```ts
describe('Concurrent operations', () => {
    it('should handle parallel metahub sync without deadlocks', async () => {
        // Launch 3 concurrent sync operations for different metahubs
        // All should complete without deadlock
    })

    it('should handle competing membership updates with optimistic locking', async () => {
        // Two concurrent updates to the same membership
        // One should succeed, one should get version conflict
    })

    it('should handle parallel startup migration runner', async () => {
        // Launch 2 concurrent bootstrap sequences
        // Advisory lock should serialize them
        // Both should complete successfully
    })
})
```

### 6.6 Full Fresh-Database Acceptance Test

**Scope**: End-to-end flow on a completely clean database.

```ts
describe('Fresh database acceptance', () => {
    beforeAll(async () => {
        // Drop and recreate test database
        // Run platform migration runner (bootstrap)
    })

    it('Step 1: platform schemas exist after bootstrap', async () => {
        const schemas = await query(`
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name IN ('metahubs', 'applications', 'upl_migrations')
        `)
        expect(schemas.map(s => s.schema_name).sort())
            .toEqual(['applications', 'metahubs', 'upl_migrations'])
    })

    it('Step 2: can create a metahub', async () => {
        const metahub = await createMetahub(executor, {
            name: { _primary: 'en', en: 'Test Metahub' },
            slug: 'test-metahub',
            userId: testUserId
        })
        expect(metahub.id).toBeDefined()
    })

    it('Step 3: first branch schema mhb_* exists', async () => {
        const branches = await listBranches(executor, metahubId)
        expect(branches).toHaveLength(1)
        const schemas = await query(`
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name LIKE 'mhb_%'
        `)
        expect(schemas).toHaveLength(1)
    })

    it('Step 4: can create catalog and attributes', async () => { ... })
    it('Step 5: can create publication and version', async () => { ... })
    it('Step 6: can create application via connector', async () => { ... })

    it('Step 7: application runtime schema app_* exists', async () => {
        const schemas = await query(`
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name LIKE 'app_%'
        `)
        expect(schemas).toHaveLength(1)
    })

    it('Step 8: runtime data transfer works', async () => { ... })

    it('Step 9: template seeding works on fresh database', async () => {
        const templates = await query(
            `SELECT codename FROM metahubs.templates WHERE is_system = true`
        )
        expect(templates.length).toBeGreaterThan(0)
    })
})
```

### 6.7 Negative / Recovery Tests

```ts
describe('Error recovery', () => {
    it('should fail fast on bootstrap migration failure', async () => {
        // Inject a failing migration
        // Verify server does not start
    })

    it('should not leave split state on sync failure', async () => {
        // Start application sync
        // Inject error mid-transaction
        // Verify _app_migrations and schema_snapshot are both absent
    })

    it('should handle connection timeout gracefully', async () => {
        // Simulate pool exhaustion
        // Verify 503 response, not crash
    })
})
```

### 6.8 Performance Regression Tests

```ts
describe('Query performance', () => {
    it('application list query should use index scan', async () => {
        const plan = await query(`EXPLAIN (FORMAT JSON) ${applicationListSQL}`, params)
        const nodeTypes = extractNodeTypes(plan)
        expect(nodeTypes).not.toContain('Seq Scan')
    })

    it('hot endpoints should not exceed query count threshold', async () => {
        const counter = createQueryCounter(executor)
        await listApplications(counter, { ... })
        expect(counter.count).toBeLessThanOrEqual(1) // single query with window function
    })
})
```

---

## 7. Definition of Done

The roadmap is closed only when ALL of the following are true:

### Package-level gates

- [ ] `packages/applications-backend/base/src/database` directory does not exist
- [ ] `packages/metahubs-backend/base/src/database` directory does not exist
- [ ] `packages/applications-backend/base/package.json` has no `typeorm` dependency
- [ ] `packages/metahubs-backend/base/package.json` has no `typeorm` dependency
- [ ] `rg "typeorm" packages/applications-backend/base/src/` returns 0 matches
- [ ] `rg "typeorm" packages/metahubs-backend/base/src/` returns 0 matches

### Transport-level gates

- [ ] Request-scoped DB execution for applications/metahubs does not use `QueryRunner` directly
- [ ] `req.dbContext` for migrated packages exposes only neutral `DbSession`/`DbExecutor` (no `EntityManager`)
- [ ] TypeORM `EntityManager` is accessible only via `@universo/utils/database/legacy` for admin/profile
- [ ] Pool budget is documented and rational (single Knex pool + TypeORM reduced to admin/profile)

### Behavioral gates

- [ ] `metahubs` platform schema matches expected native SQL exactly
- [ ] `applications` platform schema matches expected native SQL exactly
- [ ] Runtime `mhb_*` and `app_*` schema flows still work
- [ ] Template seeding still works on fresh database
- [ ] Application creation via publication connector still works
- [ ] Copy/delete flows still work with correct atomicity

### Test gates

- [ ] Unit tests for all new store modules pass
- [ ] Route integration tests pass (existing 26 + new metahubs tests)
- [ ] Database-backed integration tests pass
- [ ] Schema parity tests pass
- [ ] Fresh-database acceptance test passes
- [ ] Root `pnpm build` passes (all packages)
- [ ] `pnpm --filter @universo/applications-backend test` passes
- [ ] `pnpm --filter @universo/metahubs-backend test` passes

### Documentation gates

- [ ] Package READMEs updated (no TypeORM usage instructions)
- [ ] `memory-bank/systemPatterns.md` updated (RLS pattern, repository pattern, application-definition model)
- [ ] `memory-bank/techContext.md` updated (pool budget, transport change)
- [ ] Application-definition conceptual model documented in `systemPatterns.md`

---

## 8. Recommended PR Slices

| PR | Batch | Title | Risk |
|----|-------|-------|------|
| PR-1 | 1–2 | Finish applications-backend TypeORM removal | Low |
| PR-2 | 3 | Isolate TypeORM from shared request DB contract | Medium |
| PR-3 | 4–5 | Metahubs persistence foundations + TemplateSeeder | Low |
| PR-4 | 6 | Port cross-package entity imports to SQL + extract shared enums | Medium |
| PR-5 | 7 | Port metahubs route factories to neutral DbExecutor contract | Medium |
| PR-6 | 8 | Port metahubs services | Medium |
| PR-7 | 9 | Delete metahubs-backend/src/database | Low |
| PR-8 | 10 | Remove RequestDbContext.manager, create legacy subpath | Medium |
| PR-9 | 11 | Unify runtime migration history contracts | Medium |
| PR-10 | 12 | Definition registry + application-definition model | Medium |
| PR-11 | 13 | Full acceptance closure | Low |

**Order is mandatory**: Each PR depends on the previous one being merged and validated.

**PR-1** is the safest starting point and can be done immediately — `applications-backend` is 80% done and the remaining work is mechanical (type signature changes + entity deletion).

**PR-2** (isolate TypeORM from shared contract) is the highest-risk item. The approach is conservative: keep TypeORM QueryRunner internally, only change the public surface. Full Knex-only transport is deferred until admin/profile are migrated.

**PR-4** is expanded compared to v1: it now covers all 5 files with cross-package entity imports, not just `createLinkedApplication.ts`.

---

## Appendix A: Files To Delete

### applications-backend/src/database/
```
entities/Application.ts
entities/ApplicationUser.ts
entities/Connector.ts
entities/ConnectorPublication.ts
entities/index.ts
```

### metahubs-backend/src/database/
```
entities/Metahub.ts
entities/MetahubBranch.ts
entities/MetahubUser.ts
entities/Publication.ts
entities/PublicationVersion.ts
entities/Template.ts
entities/TemplateVersion.ts
entities/index.ts  (if exists)
```

## Appendix B: Pool Budget After TypeORM Removal

**Current**:
```
Knex: max(4, floor(budget/3))  — DDL, advisory locks, schema inspection
TypeORM: budget - knexReserve  — RLS QueryRunners, entity CRUD
```

**After** (applications + metahubs migrated):
```
Knex: budget                    — everything (DDL, RLS, queries)
TypeORM: reduced to admin/profile only, or eliminated entirely
```

If admin/profile are also migrated later, TypeORM pool can be removed entirely, simplifying:
```
Knex: budget                    — single pool for all DB operations
TypeORM: 0                      — removed from project
```

## Appendix C: Knex RLS Safety — Web Search Findings

**Knex issue #6220**: Warns about RLS leakage when using connection pool. If `set_config` is session-scoped and the connection returns to the pool without reset, the next request inherits stale claims.

**Mitigation** (already in place):
1. Reset `request.jwt.claims` to empty string before releasing connection
2. Use connection-level cleanup via `res.once('finish')` and `res.once('close')`
3. Guard against double-cleanup with `cleanupStarted` flag

**Best practice from web search**:
- Use dedicated connection per request (not shared from default pool)
- Always reset session variables before releasing
- Consider transaction-local settings (`set_config(..., true)`) for individual atomic operations within the request

This matches the current implementation's design and should be preserved in the Knex migration.

## Appendix D: Known Remaining TypeORM Consumers (Outside Plan Scope)

These packages still use TypeORM after this plan is completed. They are intentionally excluded from scope but documented for future planning.

| Package | TypeORM usage | Migration priority |
|---------|--------------|-------------------|
| `admin-backend` | Repository pattern (`getRequestManager`, `In` operator, `QueryBuilder`), 6+ route files, `globalAccessService.ts` | Medium — after this plan completes |
| `profile-backend` | `Repository<Profile>`, `DataSource`, controller/service layer | Low — small surface |
| `start-backend` | `import type { DataSource }` in 2 route files | Low — type-only imports |
| `auth-backend` | `QueryRunner` in `ensureAuthWithRls.ts` (internal implementation detail after Batch 3) | Deferred — replaced when full Knex transport lands |
| `universo-utils` | `database/legacy` subpath (created in Batch 10), `database/userLookup.ts` | Deferred — removed when all consumers migrate |
| `universo-migrations-platform` | `typeormAdapter.ts` — intentionally kept for TypeORM-era migration compatibility | Permanent — legacy adapter |
| `universo-core-backend` | `DataSource.ts`, `rlsHelpers.ts`, entity registry (admin only after Batches 2+9) | Reduces naturally as packages migrate |
