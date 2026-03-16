# Start System App — Onboarding Architecture Migration Plan

> **Date**: 2026-03-15
> **Status**: DRAFT v3 — Updated after two QA reviews (11 + 8 findings incorporated)
> **Complexity**: Level 3 (Significant)
> **Scope**: Convert the Start/Onboarding section from legacy stubs into a fixed system-app with predefined catalog data, user selection tracking, full test coverage, and i18n VLC data

---

## QA Review Summary

### Round 1 (v1→v2): 11 findings

The following findings from the first comprehensive QA audit have been incorporated:

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| F1 | HIGH | Plan reinvented VLC type (`VlcContent`) | Use existing `VersionedLocalizedContent<T>` from `@universo/types` |
| F2 | HIGH | Plan reinvented VLC resolver (`vlcResolver.ts`) | Use existing `getVLCString()` / `resolveLocalizedContent()` from `@universo/utils/vlc` — same as metahubs-frontend |
| F3 | MEDIUM | Wrong function name `resolveAuthUserId` | Keep existing local `resolveAuthUser()` pattern already in onboardingRoutes.ts |
| F4 | MEDIUM | Wrong executor API `getDbExecutor()` from `@universo/utils` | Use `getPoolExecutor()` from `@universo/database`; route receives executor via factory argument |
| F5 | MEDIUM | Plan imported `SqlPlatformMigrationDefinition` from shared package | Define `SqlMigrationStatement` + `SqlMigrationDefinition` LOCALLY in migration file (codebase convention) |
| F6 | MEDIUM | Missing local helpers | Add local `createDropPolicyIfTableExistsStatement` and `normalizeSql` helpers (all existing migrations define them locally) |
| F7 | LOW | VLC seed dates `2026-03-15T00:00:00.000Z` | Use `2024-12-06T00:00:00.000Z` for consistency with existing admin seeds |
| F8 | LOW | Goals had 9 items, now resolved | Updated to 10 items (10th: "Экологическая техноцивилизация") |
| F9 | LOW | Inconsistent RLS policy naming | Follow admin-backend snake_case convention for consistency |
| F10 | INFO | Frontend double-fetch (AuthenticatedStartPage + OnboardingWizard) | Address via TanStack Query caching — single fetch, shared query key |
| F11 | INFO | Store functions lack RETURNING pattern | Add `RETURNING` for INSERT/UPDATE matching profile store pattern |

### Round 2 (v2→v3): 8 findings

The following findings from the second QA audit of the updated v2 plan have been incorporated:

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| F1-v2 | MEDIUM | `user_id` in `rel_user_selections` used `AttributeDataType.STRING` — admin-backend uses `AttributeDataType.REF` for `user_id` in `rel_user_roles` | Changed to `AttributeDataType.REF` for metadata consistency |
| F2-v2 | MEDIUM | `start-frontend/base/package.json` missing `@universo/types` dependency — needed for `import type { VersionedLocalizedContent }` | Added `@universo/types: workspace:*` to Step 3.1 package.json changes |
| F3-v2 | MEDIUM | `universo-migrations-platform/base/package.json` missing `@universo/start-backend` dependency — needed for `require('@universo/start-backend/platform-definition')` | Added `@universo/start-backend: workspace:*` to Step 1.4 |
| F4-v2 | LOW | Step 1.5 showed wrong `PolicyRewrite` format (`{ schema, table, policy }`) — real interface uses `{ table, name, forClause, using?, withCheck? }` | Replaced with correct `PolicyRewrite` entries matching admin-backend pattern |
| F5-v2 | LOW | `item_id` in `rel_user_selections` used `AttributeDataType.STRING` — as a UUID reference to catalog items, `AttributeDataType.REF` is more semantically correct | Changed to `AttributeDataType.REF` (polymorphic reference without `targetTableCodename`) |
| F6-v2 | INFO | `start-frontend/base/package.json` missing from File Change Summary Modified Files | Added to Modified Files table |
| F7-v2 | INFO | Seed data ordering: `CREATE UNIQUE INDEX` on `codename` must exist before `INSERT ... ON CONFLICT (codename)` | Clarified statement ordering requirement in migration discussion |
| F8-v2 | INFO | Route sketch for `POST /complete` references `ProfileService.markOnboardingCompleted()` without showing instantiation | Added explicit `new ProfileService(exec)` instantiation in route sketch |

---

## 1. Overview

The platform's onboarding wizard currently returns **empty arrays** after the legacy Projects/Campaigns/Clusters packages were removed. The goal is to restore full onboarding functionality using the **fixed system-app architecture** — the same battle-tested pattern used by `admin`, `profiles`, `metahubs`, and `applications`.

**New `start` schema** will contain:
- **3 catalog tables** with predefined VLC seed data (Goals, Topics, Features) — 10 items each (30 total)
- **1 relation table** for tracking user selections
- Full RLS security, system fields (`_upl_*` + `_app_*`), UUID v7 PKs
- Backend store modules with raw SQL through `DbExecutor` + `RETURNING` pattern
- Updated API routes for real data retrieval and selection persistence
- Updated frontend using existing `VersionedLocalizedContent<T>` type and `getVLCString()` from `@universo/utils/vlc` (no new VLC types or resolvers)
- Comprehensive test suite across all layers

**Key principle**: No legacy code preserved. Fresh schema, fresh DB. No version bumps needed.

---

## 2. Architecture Decisions

### 2.1 Schema Design: `start`

```
PostgreSQL schema: "start"

┌─────────────────────────────────────────────┐
│  System tables (auto-generated by compiler) │
│  _app_migrations, _app_attributes,          │
│  _app_objects, _app_settings                │
├─────────────────────────────────────────────┤
│  cat_goals       — "Choose Your Global Goals"│
│  cat_topics      — "Define Interesting Topics"│
│  cat_features    — "Select Platform Features" │
│  rel_user_selections — User → Item tracking  │
└─────────────────────────────────────────────┘
```

### 2.2 Table: `cat_goals` / `cat_topics` / `cat_features` (identical structure)

Each catalog table has the same column layout:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() | Primary key |
| `codename` | VARCHAR(50) | NOT NULL, UNIQUE (active) | Stable internal identifier |
| `name` | JSONB | NOT NULL, DEFAULT '{}' | VLC localized name (≤100 chars per locale) |
| `description` | JSONB | DEFAULT '{}' | VLC localized description (≤500 chars per locale) |
| `sort_order` | INTEGER | NOT NULL, DEFAULT 0 | Display ordering |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Soft visibility toggle |
| `_upl_*` | (16 fields) | Standard platform system fields | |
| `_app_*` | (11 fields) | Standard application system fields | |

**Active row predicate**: `_upl_deleted = false AND _app_deleted = false AND is_active = true`

**Rationale for `is_active`**: Predefined items may be hidden without deletion; this gives the admin panel future control over which onboarding options are visible.

### 2.3 Table: `rel_user_selections`

**Design decision**: Single relation table with `catalog_kind` discriminator instead of 3 separate junction tables.

**Rationale**:
- All three catalog structures are identical — no benefit from separate FK targets
- Simpler backend code (one store, one query builder)
- Single RLS policy covers all selection types
- Matches the 1C:Enterprise "Register of Information" (Регистр сведений) pattern — dimensional data with user, catalog_kind, item_id axes
- Future-proof for aggregated queries across all selection types
- 30 total items maximum — no performance concern from polymorphic FK

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() | Primary key |
| `user_id` | UUID | NOT NULL | Authenticated user reference |
| `catalog_kind` | VARCHAR(20) | NOT NULL, CHECK IN ('goals','topics','features') | Discriminator |
| `item_id` | UUID | NOT NULL | Reference to the selected item |
| `_upl_*` | (16 fields) | Standard platform system fields | |
| `_app_*` | (11 fields) | Standard application system fields | |

**Unique constraint**: `(user_id, catalog_kind, item_id) WHERE _upl_deleted = false AND _app_deleted = false`

**Why no FK to individual catalog tables**: PostgreSQL cannot define a single FK that targets 3 different tables based on a discriminator value. Application-level validation is used instead — the backend verifies that `item_id` exists in the correct catalog table before inserting. This is standard practice for polymorphic references (same approach used in 1C register dimensions).

### 2.4 RLS Security Model

**Naming convention**: snake_case (following admin-backend convention). All policies use `(select auth.uid())` wrapping for performance (handled by `OptimizeRlsPolicies`).

| Table | Policy | Rule |
|-------|--------|------|
| `cat_goals` | `authenticated_read_goals` | SELECT: `true` (all authenticated users) |
| `cat_goals` | `admin_manage_goals` | ALL: `admin.has_admin_permission(auth.uid())` |
| `cat_topics` | `authenticated_read_topics` | SELECT: `true` |
| `cat_topics` | `admin_manage_topics` | ALL: `admin.has_admin_permission(auth.uid())` |
| `cat_features` | `authenticated_read_features` | SELECT: `true` |
| `cat_features` | `admin_manage_features` | ALL: `admin.has_admin_permission(auth.uid())` |
| `rel_user_selections` | `users_read_own_selections` | SELECT: `user_id = (select auth.uid())` |
| `rel_user_selections` | `users_manage_own_selections` | INSERT/UPDATE/DELETE: `user_id = (select auth.uid())` |
| `rel_user_selections` | `admin_manage_all_selections` | ALL: `admin.has_admin_permission(auth.uid())` |

**Security approach**: Catalog data is public for read (all authenticated users can see onboarding options). User selections are strictly self-only via RLS — enforced at DB level, verified at application level.

### 2.5 VLC Data Format

All name/description fields use the existing `VersionedLocalizedContent<string>` type from `@universo/types/common/admin.ts`. Seed VLC dates use `2024-12-06T00:00:00.000Z` to match existing admin seed convention:

```json
{
    "_schema": "1",
    "_primary": "en",
    "locales": {
        "en": {
            "content": "English text here",
            "version": 1,
            "isActive": true,
            "createdAt": "2024-12-06T00:00:00.000Z",
            "updatedAt": "2024-12-06T00:00:00.000Z"
        },
        "ru": {
            "content": "Русский текст здесь",
            "version": 1,
            "isActive": true,
            "createdAt": "2024-12-06T00:00:00.000Z",
            "updatedAt": "2024-12-06T00:00:00.000Z"
        }
    }
}
```

### 2.6 Frontend VLC Resolution (Existing Infrastructure — No New Code)

**DO NOT create** `vlcResolver.ts` or `VlcContent` type. The platform already provides:

| What | Where | Import Pattern |
|------|-------|----------------|
| `VersionedLocalizedContent<T>` type | `@universo/types` | `import type { VersionedLocalizedContent } from '@universo/types'` |
| `getVLCString(vlc, locale)` | `@universo/utils/vlc` | `import { getVLCString } from '@universo/utils/vlc'` |
| `getVLCStringWithFallback(vlc, locale, fallback)` | `@universo/utils/vlc` | Same import path |
| `resolveLocalizedContent(vlc, locale, fallback?)` | `@universo/utils/vlc` | Same import path |
| `buildVLC(enContent, ruContent)` | `@universo/utils/vlc` | Same import path |
| VLC Zod schemas | `@universo/types/validation/vlc` | `import { VersionedLocalizedContentSchema } from '@universo/types/validation/vlc'` |

**Reference pattern**: metahubs-frontend uses `import { getVLCString } from '@universo/utils/vlc'` for all VLC resolution.

---

## 3. Implementation Plan

### Phase 1: Backend — System App Definition & Migrations

#### Step 1.1: Create `start-backend` platform definition infrastructure

**Files to create:**
- `packages/start-backend/base/src/platform/systemAppDefinition.ts`
- `packages/start-backend/base/src/platform/migrations/index.ts`

**`systemAppDefinition.ts`** — SystemAppDefinition manifest:

```typescript
import { createSystemAppManifestPresentation, type SystemAppDefinition } from '@universo/migrations-core'
import { AttributeDataType } from '@universo/types'
import { finalizeStartSchemaSupportMigrationDefinition, prepareStartSchemaSupportMigrationDefinition } from './migrations'

const p = createSystemAppManifestPresentation

// Common catalog fields template for goals/topics/features
const createCatalogFields = (maxNameLength: number, maxDescLength: number) => [
    {
        codename: 'codename',
        physicalColumnName: 'codename',
        dataType: AttributeDataType.STRING,
        physicalDataType: 'VARCHAR(50)',
        isRequired: true,
        presentation: p('Codename', 'Stable internal identifier'),
        validationRules: { maxLength: 50, pattern: '^[a-z0-9_-]+$' }
    },
    {
        codename: 'name',
        physicalColumnName: 'name',
        dataType: AttributeDataType.JSON,
        defaultSqlExpression: `'{}'::jsonb`,
        isDisplayAttribute: true,
        presentation: p('Name', 'Localized display name'),
        validationRules: { maxLength: maxNameLength }
    },
    {
        codename: 'description',
        physicalColumnName: 'description',
        dataType: AttributeDataType.JSON,
        defaultSqlExpression: `'{}'::jsonb`,
        presentation: p('Description', 'Localized description text'),
        validationRules: { maxLength: maxDescLength }
    },
    {
        codename: 'sort_order',
        physicalColumnName: 'sort_order',
        dataType: AttributeDataType.NUMBER,
        physicalDataType: 'INTEGER',
        defaultSqlExpression: '0',
        isRequired: true
    },
    {
        codename: 'is_active',
        physicalColumnName: 'is_active',
        dataType: AttributeDataType.BOOLEAN,
        defaultSqlExpression: 'true',
        isRequired: true
    }
]

const startBusinessTables = [
    {
        kind: 'catalog' as const,
        codename: 'goals',
        tableName: 'cat_goals',
        presentation: p('Goals', 'Predefined global goals for onboarding'),
        fields: createCatalogFields(100, 500)
    },
    {
        kind: 'catalog' as const,
        codename: 'topics',
        tableName: 'cat_topics',
        presentation: p('Topics', 'Predefined interesting topics for onboarding'),
        fields: createCatalogFields(100, 500)
    },
    {
        kind: 'catalog' as const,
        codename: 'features',
        tableName: 'cat_features',
        presentation: p('Features', 'Predefined platform features for onboarding'),
        fields: createCatalogFields(100, 500)
    },
    {
        kind: 'relation' as const,
        codename: 'user_selections',
        tableName: 'rel_user_selections',
        presentation: p('User Selections', 'Records of user onboarding choices'),
        fields: [
            {
                codename: 'user_id',
                physicalColumnName: 'user_id',
                dataType: AttributeDataType.REF,     // QA F1-v2: REF matches admin-backend rel_user_roles.user_id
                physicalDataType: 'UUID',
                isRequired: true,
                presentation: p('User', 'Authenticated user who made the selection')
            },
            {
                codename: 'catalog_kind',
                physicalColumnName: 'catalog_kind',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(20)',
                isRequired: true,
                presentation: p('Catalog Kind', 'Type of catalog: goals, topics, or features')
            },
            {
                codename: 'item_id',
                physicalColumnName: 'item_id',
                dataType: AttributeDataType.REF,     // QA F5-v2: REF for UUID reference (polymorphic, no targetTableCodename)
                physicalDataType: 'UUID',
                isRequired: true,
                presentation: p('Item', 'Reference to the selected catalog item')
            }
        ]
    }
] as const

export const startSystemAppDefinition: SystemAppDefinition = {
    manifestVersion: 1,
    key: 'start',
    displayName: 'Start',
    ownerPackage: '@universo/start-backend',
    engineVersion: '0.1.0',
    structureVersion: '0.1.0',
    configurationVersion: '0.1.0',
    schemaTarget: {
        kind: 'fixed',
        schemaName: 'start'
    },
    runtimeCapabilities: {
        supportsPublicationSync: false,
        supportsTemplateVersions: false,
        usesCurrentUiShell: 'universo-template-mui'
    },
    currentStorageModel: 'application_like',
    targetStorageModel: 'application_like',
    currentStructureCapabilities: {
        appCoreTables: true,
        catalogTables: true,
        documentTables: false,
        relationTables: true,
        settingsTables: false,
        layoutTables: false,
        widgetTables: false,
        attributeValueTables: false
    },
    targetStructureCapabilities: {
        appCoreTables: true,
        catalogTables: true,
        documentTables: false,
        relationTables: true,
        settingsTables: false,
        layoutTables: false,
        widgetTables: false,
        attributeValueTables: false
    },
    currentBusinessTables: startBusinessTables,
    targetBusinessTables: startBusinessTables,
    summary: 'Fixed-schema platform definition for the start/onboarding system app',
    migrations: [
        {
            kind: 'sql',
            definition: prepareStartSchemaSupportMigrationDefinition,
            bootstrapPhase: 'pre_schema_generation'
        },
        {
            kind: 'sql',
            definition: finalizeStartSchemaSupportMigrationDefinition,
            bootstrapPhase: 'post_schema_generation'
        }
    ],
    repeatableSeeds: []
}
```

#### Step 1.2: Create SQL migration definitions

**File**: `packages/start-backend/base/src/platform/migrations/index.ts`

**IMPORTANT (QA F5, F6)**: Migration interfaces and helpers are defined LOCALLY in each migration file — this is the established codebase convention. Do NOT import `SqlPlatformMigrationDefinition` from `@universo/migrations-core`. Instead:

1. Define `SqlMigrationStatement` and `SqlMigrationDefinition` interfaces locally (identical to admin-backend/profile-backend pattern)
2. Define `normalizeSql` helper locally for SQL-prefix-based splitting
3. Define `createDropPolicyIfTableExistsStatement` helper locally for safe RLS down-migration

```typescript
// ──── LOCAL INTERFACES (codebase convention — duplicated per migration file) ────

export interface SqlMigrationStatement {
    sql: string
    warningMessage?: string
}

export interface SqlMigrationDefinition {
    id: string
    version: string
    summary: string
    up: readonly SqlMigrationStatement[]
    down: readonly SqlMigrationStatement[]
}

// ──── LOCAL HELPERS ────

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

const createDropPolicyIfTableExistsStatement = (
    policyName: string,
    schemaName: string,
    tableName: string
): SqlMigrationStatement => ({
    sql: `
DO $$
BEGIN
    IF to_regclass('${schemaName}.${tableName}') IS NOT NULL THEN
        BEGIN
            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON %I.%I',
                '${policyName}',
                '${schemaName}',
                '${tableName}'
            );
        EXCEPTION
            WHEN undefined_table THEN NULL;
        END;
    END IF;
END $$;
    `
})
```

The migration file contains the full `createStartSchemaMigrationDefinition` with all DDL and seed SQL, then splits into prepare/finalize using the admin-backend `normalizeSql()` filter pattern:

**`prepareStartSchemaSupportMigrationDefinition`** (pre_schema_generation):
- `CREATE SCHEMA IF NOT EXISTS start`

**`finalizeStartSchemaSupportMigrationDefinition`** (post_schema_generation):
- Unique indexes on codename (active rows) for each catalog
- Unique constraint on `(user_id, catalog_kind, item_id)` for selections
- CHECK constraint on `catalog_kind`
- Partial indexes for performance (`is_active`, `_app_deleted`)
- Enable RLS on all 4 tables
- Create RLS policies per the security model (Section 2.4)
- **Seed data**: 30 items across 3 catalogs with full VLC (en/ru)

**QA F7-v2 — Statement ordering requirement**: In the `createStartSchemaMigrationDefinition.up` array, the `CREATE UNIQUE INDEX` on `codename` must appear BEFORE any `INSERT ... ON CONFLICT (codename)` statements, otherwise the `ON CONFLICT` clause won't function. The `postGeneration` filter preserves original array order, so the source `.up` array must be ordered as: `[CREATE SCHEMA, CREATE TABLE..., CREATE INDEX..., ALTER TABLE ENABLE RLS..., CREATE POLICY..., INSERT seed...]`.

**Splitting pattern** (admin-backend convention using `normalizeSql()` filter):

```typescript
const startSchemaPreludeStatements = createStartSchemaMigrationDefinition.up.filter(
    (statement) => normalizeSql(statement.sql) === 'CREATE SCHEMA IF NOT EXISTS start'
)

const startSchemaPostGenerationStatements = createStartSchemaMigrationDefinition.up.filter(
    (statement) => !normalizeSql(statement.sql).startsWith('CREATE TABLE IF NOT EXISTS start.')
)

export const prepareStartSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'PrepareStartSchemaSupport1710000000000',
    version: '1710000000000',
    summary: 'Prepare start support objects before definition-driven schema generation',
    up: startSchemaPreludeStatements,
    down: [] as const
}

export const finalizeStartSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'FinalizeStartSchemaSupport1710000000001',
    version: '1710000000001',
    summary: 'Finalize start support objects after definition-driven schema generation',
    up: startSchemaPostGenerationStatements,
    down: [] as const
}
```

**Seed data format** — uses `ON CONFLICT ... DO UPDATE` for idempotency and VLC dates matching admin convention (`2024-12-06T00:00:00.000Z`):

```sql
INSERT INTO start.cat_goals (codename, name, description, sort_order, is_active)
VALUES (
    'teknokomo-era',
    '{"_schema":"1","_primary":"en","locales":{"en":{"content":"Teknokomo Era","version":1,"isActive":true,"createdAt":"2024-12-06T00:00:00.000Z","updatedAt":"2024-12-06T00:00:00.000Z"},"ru":{"content":"Эра Текнокомо","version":1,"isActive":true,"createdAt":"2024-12-06T00:00:00.000Z","updatedAt":"2024-12-06T00:00:00.000Z"}}}'::jsonb,
    '{"_schema":"1","_primary":"en","locales":{"en":{"content":"The sixth technological revolution...","version":1,"isActive":true,"createdAt":"2024-12-06T00:00:00.000Z","updatedAt":"2024-12-06T00:00:00.000Z"},"ru":{"content":"Шестой технологический уклад...","version":1,"isActive":true,"createdAt":"2024-12-06T00:00:00.000Z","updatedAt":"2024-12-06T00:00:00.000Z"}}}'::jsonb,
    1,
    true
)
ON CONFLICT (codename) WHERE _upl_deleted = false AND _app_deleted = false
DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
             sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active
```

**Full seed data list** (30 items total — 10 per catalog):

**cat_goals** (10 items — from `.backup/Из-проектов.txt`):
1. `teknokomo-era` — Teknokomo Era / Эра Текнокомо
2. `world-communism` — World Communism / Всемирный коммунизм
3. `global-cooperation` — Global Cooperation / Глобальная кооперация
4. `social-capitalism` — Social Capitalism / Социальный капитализм
5. `anarchist-communities` — Anarchist Communities / Анархические сообщества
6. `space-empire` — Space Empire / Космическая империя
7. `market-socialism` — Market Socialism / Рыночный социализм
8. `technocratic-governance` — Technocratic Governance / Технократическое управление
9. `expert-meritocracy` — Expert Meritocracy / Экспертная меритократия
10. `ecological-technocivilization` — Ecological Technocivilization / Экологическая техноцивилизация

**cat_topics** (10 items — from `.backup/Из-кампаний.txt`):
1. `computer-games` — Computer Games / Компьютерные игры
2. `board-games` — Board Games / Настольные игры
3. `sports-lifestyle` — Sports & Active Lifestyle / Спорт и активный образ жизни
4. `programming` — Programming & Development / Программирование и разработка
5. `robotics` — Robotics & Automation / Робототехника и автоматизация
6. `science` — Science & Knowledge / Наука и популяризация знаний
7. `space-futurism` — Space & Futurism / Космос и футурология
8. `cinema` — Cinema & Screenwriting / Кино, сериалы и сценаристика
9. `design-3d` — Design & 3D Visualization / Дизайн, 3D и визуализация
10. `learning` — Learning & Self-Development / Обучение и саморазвитие

**cat_features** (10 items — from `.backup/Из-кластеров.txt`):
1. `kiberplano` — Universo Kiberplano
2. `mmoomm` — Universo MMOOMM
3. `cad-system` — CAD System / CAD-система
4. `erp-system` — ERP System / ERP-система
5. `plm-system` — PLM System / PLM-система
6. `crm-system` — CRM System / CRM-система
7. `bpm-workflow` — BPM / Workflow System / BPM / Workflow-система
8. `wms-system` — WMS System / WMS-система
9. `tms-system` — TMS System / TMS-система
10. `courier-delivery` — Courier Delivery System / Система курьерской доставки

#### Step 1.3: Update `start-backend/base/package.json`

Add platform-definition exports (same pattern as admin-backend):

```json
{
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "require": "./dist/index.js",
            "default": "./dist/index.js"
        },
        "./platform-definition": {
            "types": "./dist/platform/systemAppDefinition.d.ts",
            "require": "./dist/platform/systemAppDefinition.js",
            "default": "./dist/platform/systemAppDefinition.js"
        },
        "./platform-migrations": {
            "types": "./dist/platform/migrations/index.d.ts",
            "require": "./dist/platform/migrations/index.js",
            "default": "./dist/platform/migrations/index.js"
        }
    },
    "typesVersions": {
        "*": {
            "platform-definition": ["./dist/platform/systemAppDefinition.d.ts"],
            "platform-migrations": ["./dist/platform/migrations/index.d.ts"]
        }
    }
}
```

Add dependencies:
```json
{
    "dependencies": {
        "@universo/migrations-core": "workspace:*",
        "@universo/types": "workspace:*"
    }
}
```

#### Step 1.4: Register in `universo-migrations-platform`

**File**: `packages/universo-migrations-platform/base/src/systemAppDefinitions.ts`

Add to the existing imports and systemAppDefinitions array:

```typescript
const { startSystemAppDefinition } = require('@universo/start-backend/platform-definition') as {
    startSystemAppDefinition: SystemAppDefinition
}

export const systemAppDefinitions: SystemAppDefinition[] = [
    publicSystemAppDefinition,
    adminSystemAppDefinition,
    profileSystemAppDefinition,
    metahubsSystemAppDefinition,
    applicationsSystemAppDefinition,
    startSystemAppDefinition          // ← NEW
]
```

**QA F3-v2**: Also add `@universo/start-backend` to `packages/universo-migrations-platform/base/package.json` dependencies:

```json
{
    "dependencies": {
        "@universo/start-backend": "workspace:*"
    }
}
```

#### Step 1.5: Update `rlsPolicyOptimization.ts`

**File**: `packages/universo-migrations-platform/base/src/rlsPolicyOptimization.ts`

**QA F4-v2**: Add start schema policies using the correct `PolicyRewrite` interface format (matching admin/profile/metahubs patterns):

```typescript
// New start schema policies — add to a startPolicies array, then spread into allPolicies
const startPolicies: PolicyRewrite[] = [
    {
        table: 'start.cat_goals',
        name: 'admin_manage_goals',
        forClause: 'FOR ALL',
        using: '(select admin.has_admin_permission((select auth.uid())))'
    },
    {
        table: 'start.cat_topics',
        name: 'admin_manage_topics',
        forClause: 'FOR ALL',
        using: '(select admin.has_admin_permission((select auth.uid())))'
    },
    {
        table: 'start.cat_features',
        name: 'admin_manage_features',
        forClause: 'FOR ALL',
        using: '(select admin.has_admin_permission((select auth.uid())))'
    },
    {
        table: 'start.rel_user_selections',
        name: 'users_read_own_selections',
        forClause: 'FOR SELECT',
        using: 'user_id = (select auth.uid())'
    },
    {
        table: 'start.rel_user_selections',
        name: 'users_manage_own_selections',
        forClause: 'FOR ALL',
        using: 'user_id = (select auth.uid())',
        withCheck: 'user_id = (select auth.uid())'
    },
    {
        table: 'start.rel_user_selections',
        name: 'admin_manage_all_selections',
        forClause: 'FOR ALL',
        using: '(select admin.has_admin_permission((select auth.uid())))'
    }
]
```

---

### Phase 2: Backend — Store Modules & Route Refactoring

#### Step 2.1: Create store modules

**File**: `packages/start-backend/base/src/persistence/onboardingStore.ts`

**QA F11**: All INSERT/UPDATE functions use `RETURNING` to return affected business columns, matching profile store convention. DELETE returns only `id`.

```typescript
import type { DbExecutor } from '@universo/utils/database'

export type CatalogKind = 'goals' | 'topics' | 'features'

export interface OnboardingCatalogRow {
    id: string
    codename: string
    name: Record<string, unknown>  // VersionedLocalizedContent JSON
    description: Record<string, unknown>  // VersionedLocalizedContent JSON
    sort_order: number
    is_active: boolean
}

export interface UserSelectionRow {
    id: string
    user_id: string
    catalog_kind: CatalogKind
    item_id: string
}

const CATALOG_TABLE_MAP: Record<CatalogKind, string> = {
    goals: 'start.cat_goals',
    topics: 'start.cat_topics',
    features: 'start.cat_features'
}

const ACTIVE_PREDICATE = '_upl_deleted = false AND _app_deleted = false'

const CATALOG_COLUMNS = 'id, codename, name, description, sort_order, is_active'
const SELECTION_COLUMNS = 'id, user_id, catalog_kind, item_id'

/** Fetch all active items from a catalog */
export async function fetchCatalogItems(
    exec: DbExecutor,
    kind: CatalogKind
): Promise<OnboardingCatalogRow[]> {
    const table = CATALOG_TABLE_MAP[kind]
    return exec.query<OnboardingCatalogRow>(
        `SELECT ${CATALOG_COLUMNS}
         FROM ${table}
         WHERE ${ACTIVE_PREDICATE} AND is_active = true
         ORDER BY sort_order ASC, _upl_created_at ASC`,
        []
    )
}

/** Fetch all user selections for a given catalog kind */
export async function fetchUserSelections(
    exec: DbExecutor,
    userId: string,
    kind: CatalogKind
): Promise<UserSelectionRow[]> {
    return exec.query<UserSelectionRow>(
        `SELECT ${SELECTION_COLUMNS}
         FROM start.rel_user_selections
         WHERE user_id = $1 AND catalog_kind = $2 AND ${ACTIVE_PREDICATE}`,
        [userId, kind]
    )
}

/** Fetch all user selections across all kinds */
export async function fetchAllUserSelections(
    exec: DbExecutor,
    userId: string
): Promise<UserSelectionRow[]> {
    return exec.query<UserSelectionRow>(
        `SELECT ${SELECTION_COLUMNS}
         FROM start.rel_user_selections
         WHERE user_id = $1 AND ${ACTIVE_PREDICATE}`,
        [userId]
    )
}

/** Validate that item_id exists in the target catalog */
export async function validateItemExists(
    exec: DbExecutor,
    kind: CatalogKind,
    itemId: string
): Promise<boolean> {
    const table = CATALOG_TABLE_MAP[kind]
    const rows = await exec.query<{ id: string }>(
        `SELECT id FROM ${table} WHERE id = $1 AND ${ACTIVE_PREDICATE} AND is_active = true LIMIT 1`,
        [itemId]
    )
    return rows.length > 0
}

/** Sync user selections for a specific catalog kind (replace strategy) */
export async function syncUserSelections(
    exec: DbExecutor,
    userId: string,
    kind: CatalogKind,
    itemIds: string[]
): Promise<{ added: number; removed: number }> {
    // Get existing selections
    const existing = await fetchUserSelections(exec, userId, kind)
    const existingItemIds = new Set(existing.map(r => r.item_id))
    const desiredItemIds = new Set(itemIds)

    // Items to add
    const toAdd = itemIds.filter(id => !existingItemIds.has(id))
    // Items to remove (soft delete)
    const toRemove = existing.filter(r => !desiredItemIds.has(r.item_id))

    // Soft-delete removed selections (RETURNING id per convention)
    if (toRemove.length > 0) {
        const ids = toRemove.map(r => r.id)
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
        await exec.query<{ id: string }>(
            `UPDATE start.rel_user_selections
             SET _upl_deleted = true, _upl_deleted_at = NOW(), _upl_deleted_by = $${ids.length + 1}
             WHERE id IN (${placeholders}) AND ${ACTIVE_PREDICATE}
             RETURNING id`,
            [...ids, userId]
        )
    }

    // Insert new selections (RETURNING full row per convention)
    for (const itemId of toAdd) {
        await exec.query<UserSelectionRow>(
            `INSERT INTO start.rel_user_selections (user_id, catalog_kind, item_id, _upl_created_by, _upl_updated_by)
             VALUES ($1, $2, $3, $1, $1)
             ON CONFLICT (user_id, catalog_kind, item_id) WHERE _upl_deleted = false AND _app_deleted = false
             DO NOTHING
             RETURNING ${SELECTION_COLUMNS}`,
            [userId, kind, itemId]
        )
    }

    return { added: toAdd.length, removed: toRemove.length }
}
```

#### Step 2.2: Refactor onboarding routes

**File**: `packages/start-backend/base/src/routes/onboardingRoutes.ts` — complete rewrite

**QA F3**: Keep the existing local `resolveAuthUser` pattern (returns `{ id?, email? }`) — there is no shared `resolveAuthUserId` function in the codebase.

**QA F4**: The route already receives `getRequestDbExecutor` as a factory argument from core-backend mounting: `createStartServiceRoutes(ensureAuthWithRls, (r) => getRequestDbExecutor(r, getPoolExecutor()))`. Do NOT import `getDbExecutor` from anywhere — use the injected factory.

New API contract:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/onboarding/items` | Returns all 3 catalogs with items + user's current selections + onboarding status |
| POST | `/onboarding/selections` | Sync user selections for all 3 catalogs at once |
| POST | `/onboarding/complete` | Mark onboarding as completed (separate from selections) |

**GET `/onboarding/items`** response:

```typescript
// Uses VersionedLocalizedContent<string> from @universo/types — NOT a custom VlcContent
interface OnboardingItemsResponse {
    onboardingCompleted: boolean
    goals: OnboardingCatalogItem[]
    topics: OnboardingCatalogItem[]
    features: OnboardingCatalogItem[]
}

interface OnboardingCatalogItem {
    id: string
    codename: string
    name: Record<string, unknown>  // VersionedLocalizedContent JSON — frontend resolves via getVLCString()
    description: Record<string, unknown>  // VersionedLocalizedContent JSON
    sortOrder: number
    isSelected: boolean  // Derived from join with user selections
}
```

**Backend route implementation** (sketch):

```typescript
import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { ProfileService } from '@universo/profile-backend'
import type { DbExecutor } from '@universo/utils/database'
import {
    fetchCatalogItems, fetchAllUserSelections, syncUserSelections,
    validateItemExists, type CatalogKind, type OnboardingCatalogRow
} from '../persistence/onboardingStore'

// Keep existing local pattern (QA F3)
const resolveAuthUser = (req: Request): { id?: string; email?: string } => {
    const user = (req as unknown as { user?: { id?: string; email?: string } }).user
    return { id: user?.id, email: user?.email }
}

export function createOnboardingRoutes(
    ensureAuth: RequestHandler,
    getRequestDbExecutor: (req: unknown) => DbExecutor,  // Injected from core-backend (QA F4)
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    router.get('/items', readLimiter, async (req: Request, res: Response) => {
        const { id: userId } = resolveAuthUser(req)
        if (!userId) return res.status(401).json({ error: 'User not authenticated' })

        const exec = getRequestDbExecutor(req)

        // Parallel fetch: 3 catalogs + all user selections + profile status
        const [goals, topics, features, selections, profileRows] = await Promise.all([
            fetchCatalogItems(exec, 'goals'),
            fetchCatalogItems(exec, 'topics'),
            fetchCatalogItems(exec, 'features'),
            fetchAllUserSelections(exec, userId),
            exec.query<{ onboarding_completed: boolean }>(
                'SELECT onboarding_completed FROM profiles.cat_profiles WHERE user_id = $1 AND _upl_deleted = false AND _app_deleted = false LIMIT 1',
                [userId]
            )
        ])

        const selectionSet = new Set(selections.map(s => s.item_id))
        const mapItems = (rows: OnboardingCatalogRow[]) => rows.map(r => ({
            id: r.id,
            codename: r.codename,
            name: r.name,
            description: r.description,
            sortOrder: r.sort_order,
            isSelected: selectionSet.has(r.id)
        }))

        res.json({
            onboardingCompleted: profileRows[0]?.onboarding_completed ?? false,
            goals: mapItems(goals),
            topics: mapItems(topics),
            features: mapItems(features)
        })
    })

    // ... POST /selections and POST /complete handlers ...
}
```

**POST `/onboarding/selections`** request body:

```typescript
const selectionsSchema = z.object({
    goals: z.array(z.string().uuid()),
    topics: z.array(z.string().uuid()),
    features: z.array(z.string().uuid())
})
```

**POST `/onboarding/complete`** — calls `ProfileService.markOnboardingCompleted()` (existing, unchanged, idempotent).

**QA F8-v2 — ProfileService instantiation**: The route handler must instantiate the service with the request-scoped executor:

```typescript
router.post('/complete', writeLimiter, async (req: Request, res: Response) => {
    const { id: userId, email } = resolveAuthUser(req)
    if (!userId) return res.status(401).json({ error: 'User not authenticated' })

    const exec = getRequestDbExecutor(req)
    const profileService = new ProfileService(exec)  // ← request-scoped executor
    const profile = await profileService.markOnboardingCompleted(userId, email)
    res.json({ success: true, onboardingCompleted: profile.onboarding_completed })
})
```

#### Step 2.3: Update main exports

**File**: `packages/start-backend/base/src/index.ts`

Add store exports and new types:
```typescript
export { initializeRateLimiters, getRateLimiters, createStartServiceRoutes } from './routes/index'
export { startSystemAppDefinition } from './platform/systemAppDefinition'
export type { CatalogKind, OnboardingCatalogRow, UserSelectionRow } from './persistence/onboardingStore'
```

---

### Phase 3: Frontend — API & Types Update

#### Step 3.1: Update shared types

**File**: `packages/start-frontend/base/src/types/index.ts`

**QA F1**: Use `VersionedLocalizedContent<string>` from `@universo/types` for VLC fields. Do NOT define a local `VlcContent` interface.

```typescript
import type { VersionedLocalizedContent } from '@universo/types'

export interface OnboardingCatalogItem {
    id: string
    codename: string
    name: VersionedLocalizedContent<string>       // ← existing type, NOT custom VlcContent
    description: VersionedLocalizedContent<string> // ← existing type
    sortOrder: number
    isSelected: boolean
}

export interface OnboardingItems {
    onboardingCompleted: boolean
    goals: OnboardingCatalogItem[]
    topics: OnboardingCatalogItem[]
    features: OnboardingCatalogItem[]
}

export interface SyncSelectionsRequest {
    goals: string[]
    topics: string[]
    features: string[]
}

export interface SyncSelectionsResponse {
    success: boolean
    added: { goals: number; topics: number; features: number }
    removed: { goals: number; topics: number; features: number }
}

export interface CompleteOnboardingResponse {
    success: boolean
    onboardingCompleted: boolean
}

export type OnboardingStep = 'welcome' | 'goals' | 'topics' | 'features' | 'completion'
```

#### Step 3.2: Update API client

**File**: `packages/start-frontend/base/src/api/onboarding.ts`

```typescript
import apiClient from './apiClient'
import type { OnboardingItems, SyncSelectionsRequest, SyncSelectionsResponse, CompleteOnboardingResponse } from '../types'

export const getOnboardingItems = async (): Promise<OnboardingItems> => {
    const response = await apiClient.get<OnboardingItems>('/onboarding/items')
    return response.data
}

export const syncSelections = async (data: SyncSelectionsRequest): Promise<SyncSelectionsResponse> => {
    const response = await apiClient.post<SyncSelectionsResponse>('/onboarding/selections', data)
    return response.data
}

export const completeOnboarding = async (): Promise<CompleteOnboardingResponse> => {
    const response = await apiClient.post<CompleteOnboardingResponse>('/onboarding/complete')
    return response.data
}
```

#### Step 3.3: VLC Resolution in Components — Use Existing Infrastructure

**QA F2**: DO NOT create `packages/start-frontend/base/src/utils/vlcResolver.ts`. Instead, use the existing VLC utilities from `@universo/utils/vlc`:

```typescript
// In OnboardingWizard / SelectionStep components:
import { getVLCString } from '@universo/utils/vlc'

// Usage:
const displayName = getVLCString(item.name, currentLocale) ?? item.codename
const displayDescription = getVLCString(item.description, currentLocale) ?? ''
```

This matches the established pattern in metahubs-frontend components.

#### Step 3.4: Update OnboardingWizard and SelectionStep

- Change step names from `projects/campaigns/clusters` to `goals/topics/features`
- Use `getVLCString(item.name, currentLocale)` for display (not custom resolver)
- Pass VLC-resolved text to `SelectableListCard`
- Update i18n keys in `onboarding.json` (en/ru)
- Replace `joinItems()` with `syncSelections()` then `completeOnboarding()`

**QA F10 (double-fetch)**: If TanStack Query is adopted (see open question below), the `AuthenticatedStartPage` and `OnboardingWizard` will share a single query key (`['onboarding', 'items']`), and TanStack Query's built-in caching eliminates the double-fetch naturally. If TanStack Query is not adopted yet, lift state up to `AuthenticatedStartPage` and pass data down as props.

#### Step 3.5: Update i18n translation files

**`en/onboarding.json`**: Update step labels and descriptions:
- `steps.goals` instead of `steps.projects`
- `steps.topics` instead of `steps.campaigns`
- `steps.features` instead of `steps.clusters`
- Update welcome text and step subtitles

**`ru/onboarding.json`**: Same structural changes with Russian text.

---

### Phase 4: Testing Strategy

#### 4.1 Backend Unit Tests

**File**: `packages/start-backend/base/src/tests/persistence/onboardingStore.test.ts`

Test all store functions against mock DbExecutor:
- `fetchCatalogItems` — correct SQL, parameter binding, ordering
- `fetchUserSelections` — user scoping, kind filtering
- `fetchAllUserSelections` — returns all kinds for user
- `validateItemExists` — existing item returns true, missing returns false
- `syncUserSelections` — add + remove + idempotent scenarios
- RETURNING: verify INSERT/UPDATE queries include RETURNING clause

**File**: `packages/start-backend/base/src/tests/routes/onboardingRoutes.test.ts` — rewrite

Using supertest with mock DbExecutor (existing pattern):

| Test Case | Scenario |
|-----------|----------|
| GET /items returns catalog data with selections | Happy path — mock 3 catalogs + selections + profile |
| GET /items marks items as selected correctly | Selection join logic |
| GET /items returns onboardingCompleted=false for new user | No profile scenario |
| GET /items returns 401 for unauthenticated | No user on request |
| POST /selections syncs user choices | Happy path — mock store calls |
| POST /selections validates UUID format | Zod validation rejection |
| POST /selections validates item_id exists | Application-level FK validation |
| POST /selections returns 401 for unauthenticated | Auth check |
| POST /complete marks onboarding done | Calls markOnboardingCompleted |
| POST /complete returns 401 for unauthenticated | Auth check |

**File**: `packages/start-backend/base/src/tests/platform/systemAppDefinition.test.ts`

Validate manifest structure:
- Definition key is 'start', schema name is 'start'
- All 4 business tables are defined with correct kinds
- Migration entries have correct bootstrap phases
- Structure capabilities match business table kinds

#### 4.2 Backend Integration Tests (Migration)

**File**: `packages/universo-migrations-platform/base/src/__tests__/startSystemApp.test.ts`

Verify:
- `startSystemAppDefinition` is loadable via require
- Definition passes `validateSystemAppDefinitions()`
- Schema generation plan compiles without errors
- Definition artifacts compile successfully
- No duplicate system app keys after adding 'start'

#### 4.3 Frontend Unit Tests

**Note on VLC resolver tests**: Since we use the existing `getVLCString()` from `@universo/utils/vlc` (which is already tested in that package), we do NOT create separate VLC resolver tests. This is a direct consequence of QA F1/F2 — no custom VLC code means no custom VLC tests needed.

**File**: `packages/start-frontend/base/src/__tests__/components/OnboardingWizard.test.tsx`

Using @testing-library/react + vitest:
- Renders welcome step initially
- Navigates forward through steps
- Renders catalog items with VLC-resolved text (using `getVLCString`)
- Selection toggles update state
- Calls syncSelections on final step
- Calls completeOnboarding after sync
- Shows loading state during API calls
- Shows error alert on API failure

**File**: `packages/start-frontend/base/src/__tests__/components/SelectionStep.test.tsx`

- Renders title, subtitle, and item list
- Calls onSelectionChange when item toggled
- Shows skeleton loader when isLoading=true
- Shows no items message when items array is empty

**File**: `packages/start-frontend/base/src/__tests__/api/onboarding.test.ts`

Mock axios/apiClient:
- getOnboardingItems returns correct shape
- syncSelections sends correct payload
- completeOnboarding sends POST to correct endpoint

#### 4.4 Test Configuration

Add `start-frontend` to `vitest.workspace.ts`:
```typescript
export default defineWorkspace([
    // ...existing...
    'packages/start-frontend/base/vitest.config.ts',  // NEW
])
```

Create `packages/start-frontend/base/vitest.config.ts` following the metahubs-frontend pattern.

---

### Phase 5: Build & Integration

#### Step 5.1: Validate build chain

```bash
# 1. Build start-backend with new platform definition
pnpm --filter @universo/start-backend build

# 2. Build migrations-platform (depends on start-backend/platform-definition)
pnpm --filter @universo/migrations-platform build

# 3. Build start-frontend
pnpm --filter @universo/start-frontend build

# 4. Full workspace build
pnpm build
```

#### Step 5.2: Verify DB bootstrap

After build, the platform startup should:
1. Run `PrepareStartSchemaSupport` → creates `start` schema
2. Schema compiler generates `cat_goals`, `cat_topics`, `cat_features`, `rel_user_selections` with all system fields
3. Run `FinalizeStartSchemaSupport` → indexes, RLS, seed data
4. Optional: `OptimizeRlsPolicies` wraps start schema `auth.uid()` calls

#### Step 5.3: Run tests

```bash
# Backend tests
pnpm --filter @universo/start-backend test

# Migration integration tests
pnpm --filter @universo/migrations-platform test

# Frontend tests
pnpm --filter @universo/start-frontend test

# CI-level verification
pnpm test
```

---

## 4. File Change Summary

### New Files

| File | Description |
|------|-------------|
| `packages/start-backend/base/src/platform/systemAppDefinition.ts` | System app manifest for 'start' |
| `packages/start-backend/base/src/platform/migrations/index.ts` | SQL migration definitions with local interfaces, helpers, and seed data |
| `packages/start-backend/base/src/persistence/onboardingStore.ts` | SQL store module with RETURNING pattern |
| `packages/start-backend/base/src/tests/persistence/onboardingStore.test.ts` | Store unit tests |
| `packages/start-backend/base/src/tests/platform/systemAppDefinition.test.ts` | Manifest validation tests |
| `packages/start-frontend/base/src/__tests__/components/OnboardingWizard.test.tsx` | Wizard integration tests |
| `packages/start-frontend/base/src/__tests__/components/SelectionStep.test.tsx` | Selection step tests |
| `packages/start-frontend/base/src/__tests__/api/onboarding.test.ts` | API client tests |
| `packages/start-frontend/base/vitest.config.ts` | Vitest configuration |
| `packages/universo-migrations-platform/base/src/__tests__/startSystemApp.test.ts` | Migration integration tests |

### Files NOT Created (QA F1/F2 — eliminated tech debt)

| File | Reason |
|------|--------|
| ~~`packages/start-frontend/base/src/utils/vlcResolver.ts`~~ | Use existing `getVLCString()` from `@universo/utils/vlc` |
| ~~`packages/start-frontend/base/src/__tests__/utils/vlcResolver.test.ts`~~ | No custom VLC code = no custom VLC tests |

### Modified Files

| File | Change |
|------|--------|
| `packages/start-backend/base/package.json` | Add exports, deps, typesVersions |
| `packages/start-backend/base/src/index.ts` | Export new modules |
| `packages/start-backend/base/src/routes/onboardingRoutes.ts` | Complete rewrite — real SQL queries via store, keep local `resolveAuthUser` |
| `packages/start-backend/base/src/routes/index.ts` | Update route mounting if needed |
| `packages/start-backend/base/src/tests/routes/onboardingRoutes.test.ts` | Complete rewrite — new API contract |
| `packages/start-frontend/base/src/types/index.ts` | New types using `VersionedLocalizedContent<string>` from `@universo/types` |
| `packages/start-frontend/base/src/api/onboarding.ts` | New API functions |
| `packages/start-frontend/base/src/components/OnboardingWizard.tsx` | Step name + data handling + `getVLCString()` usage |
| `packages/start-frontend/base/src/components/SelectionStep.tsx` | VLC resolution via `getVLCString()` |
| `packages/start-frontend/base/src/components/SelectableListCard.tsx` | May need minor prop updates |
| `packages/start-frontend/base/src/views/AuthenticatedStartPage.tsx` | Updated API calls, address double-fetch |
| `packages/start-frontend/base/package.json` | Add `@universo/types: workspace:*` dependency (QA F2-v2) |
| `packages/start-frontend/base/src/i18n/locales/en/onboarding.json` | Step label updates |
| `packages/start-frontend/base/src/i18n/locales/ru/onboarding.json` | Step label updates |
| `packages/universo-migrations-platform/base/package.json` | Add `@universo/start-backend: workspace:*` dependency (QA F3-v2) |
| `packages/universo-migrations-platform/base/src/systemAppDefinitions.ts` | Register startSystemAppDefinition |
| `packages/universo-migrations-platform/base/src/rlsPolicyOptimization.ts` | Add start schema policies |
| `vitest.workspace.ts` | Add start-frontend config |

---

## 5. Potential Challenges & Mitigations

| Challenge | Mitigation |
|-----------|------------|
| **Polymorphic FK in `rel_user_selections`** | Application-level validation before INSERT; unique index on (user_id, catalog_kind, item_id) prevents orphan duplicates; RLS prevents cross-user access |
| **VLC resolution performance** | VLC JSON is small per field; PostgreSQL JSONB is indexed; frontend resolves locale client-side from already-fetched data via existing `getVLCString()` |
| **Parallel catalog fetches** | Use `Promise.all` in backend route for 3 catalogs + selections — single round-trip per query, ~5 queries total |
| **Seed data idempotency** | `ON CONFLICT (codename) ... DO UPDATE` ensures re-startable bootstrap |
| **RLS policy count** | 8 new policies; `OptimizeRlsPolicies` wraps `auth.uid()` calls for performance |
| **Frontend backward compatibility** | Step names change from projects/campaigns/clusters to goals/topics/features — UI-only change, no external consumers |
| **Frontend double-fetch** | TanStack Query caching (if adopted) or lifting state to `AuthenticatedStartPage` |
| **Migration interface convention** | Locally-defined `SqlMigrationStatement`/`SqlMigrationDefinition` per codebase convention — do not refactor into shared import |

---

## 6. Open Questions (for user decision before implementation)

1. **English translation tone**: The backup files provide Russian text. The plan includes draft English translations — should these be formal/technical or accessible/conversational?
2. **TanStack Query adoption**: Should this task include adopting TanStack Query for start-frontend (solves double-fetch naturally), or should data fetching stay in the current pattern for now?
3. **Admin UI scope**: Should the implementation include admin panel management of onboarding items, or is that a separate future task?
4. **Resumable onboarding**: Should a partially-completed wizard (some steps done, user closes browser) resume from where they left off on next visit? This would require additional state tracking.
