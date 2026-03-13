# Plan: System-App Structural Convergence — Final Completion

> **Date**: 2026-03-12 (QA-revised, second pass)
> **Mode**: PLAN
> **Status**: QA-CORRECTIONS APPLIED — READY FOR IMPLEMENTATION APPROVAL
> **Supersedes**:
> - [system-app-definition-unification-plan-2026-03-11.md](system-app-definition-unification-plan-2026-03-11.md)
> - [system-app-unification-completion-master-plan-2026-03-11.md](system-app-unification-completion-master-plan-2026-03-11.md)
> - [system-app-unification-final-completion-plan-2026-03-11.md](system-app-unification-final-completion-plan-2026-03-11.md)

---

## Overview

The original technical brief requires that **all platform functionality** (Admin, Metahubs, Applications, Profiles) is structured **like applications** — as if their definitions were exported from a metahub, saved to files, and used to create database schemas at startup.

**What is already done:**
- Table naming convention converged (`cat_*`, `doc_*`, `rel_*`, `cfg_*`) ✅
- `_app_objects` and `_app_attributes` metadata tables exist in all 4 schemas ✅
- System-app manifest definitions exist for all 4 schemas ✅
- Compiler, bootstrap, registry, CLI, doctor infrastructure complete ✅
- Frontend page-level acceptance coverage extensive ✅
- `applications` schema business tables already have `_upl_*` + `_app_*` system fields ✅

**What is NOT done — the structural gap:**

| Schema | Current system fields | Target system fields | Gap |
|---|---|---|---|
| `admin.cfg_instances` | `created_at`, `updated_at` only | `_upl_*` + `_app_*` | ❌ Missing all system fields |
| `admin.cat_roles` | `created_at`, `updated_at`, `_upl_deleted` | `_upl_*` + `_app_*` | ❌ Partial `_upl_*`, missing `_app_*` |
| `admin.rel_role_permissions` | `created_at` only, `_upl_deleted` | `_upl_*` + `_app_*` | ❌ Minimal columns |
| `admin.rel_user_roles` | `created_at` only | `_upl_*` + `_app_*` | ❌ Missing all system fields |
| `admin.cfg_locales` | `created_at`, `updated_at`, `_upl_deleted` | `_upl_*` + `_app_*` | ❌ Partial `_upl_*`, missing `_app_*` |
| `admin.cfg_settings` | `created_at`, `updated_at`, `_upl_deleted` | `_upl_*` + `_app_*` | ❌ Partial `_upl_*`, missing `_app_*` |
| `profiles.cat_profiles` | `created_at`, `updated_at` only | `_upl_*` + `_app_*` | ❌ Missing all system fields |
| `metahubs.cat_metahubs` | `_upl_*` + `_mhb_*` | `_upl_*` + `_app_*` | ❌ Wrong second-layer prefix |
| `metahubs.cat_metahub_branches` | `_upl_*` + `_mhb_*` | `_upl_*` + `_app_*` | ❌ Wrong second-layer prefix |
| `metahubs.rel_metahub_users` | `_upl_*` + `_mhb_*` | `_upl_*` + `_app_*` | ❌ Wrong second-layer prefix |
| `metahubs.doc_publications` | `_upl_*` + `_mhb_*` | `_upl_*` + `_app_*` | ❌ Wrong second-layer prefix |
| `metahubs.doc_publication_versions` | `_upl_*` + `_mhb_*` | `_upl_*` + `_app_*` | ❌ Wrong second-layer prefix |
| `metahubs.cat_templates` | `_upl_*` only | `_upl_*` + `_app_*` | ❌ Missing `_app_*` entirely |
| `metahubs.doc_template_versions` | `_upl_*` only | `_upl_*` + `_app_*` | ❌ Missing `_app_*` entirely |
| `applications.*` (all tables) | `_upl_*` + `_app_*` | `_upl_*` + `_app_*` | ⚠️ `rel_connector_publications` missing 10 fields |

### Why `_app_*` instead of `_mhb_*` for metahubs platform tables?

The three-level system fields architecture defines:
- `_upl_*` = Platform level (base for ALL entities)
- `_mhb_*` = Metahub design-time (inside `mhb_*_bN` branch schemas)
- `_app_*` = Application runtime (inside `app_*` schemas AND all fixed system-app schemas)

There are **two distinct DDL systems** in the codebase:

1. **Fixed system-app schemas** (`admin`, `profiles`, `metahubs`, `applications`):
   - Created by platform migrations (SQL in `*-backend/src/platform/migrations/`)
   - These are *catalogs* that store platform-level data: list of metahubs, list of publications, roles, profiles, etc.
   - As system applications, their business tables must use `_upl_*` + `_app_*` fields.
   - **This plan targets ONLY these schemas.**

2. **Dynamic metahub branch schemas** (`mhb_<uuid>_bN`):
   - Created by `MetahubBranchesService` using DDL definitions from `systemTableDefinitions.ts`
   - These are design-time workspaces with system tables `_mhb_objects`, `_mhb_attributes`, `_mhb_constants`, `_mhb_values`, `_mhb_elements`, etc.
   - Their tables correctly use `_upl_*` + `_mhb_*` fields.
   - **This plan does NOT change anything inside branch schemas.**

3. **Dynamic application schemas** (`app_<uuid>`):
   - Created by `SchemaGenerator.createEntityTable()` via `SchemaMigrator`
   - These are runtime schemas published from metahub branches.
   - Their tables use `_upl_*` + `_app_*` fields — this is the reference model.
   - **This plan does NOT change anything inside application schemas.**

The `metahubs` **platform** schema is NOT a metahub branch — it is a **system application catalog**. Its tables (`cat_metahubs`, `doc_publications`, `cat_templates`, etc.) store the registry of all metahubs, their publications, and templates. When we treat this as an application (which the original brief demands), the second-layer fields should be `_app_*`.

The `_mhb_*` prefix stays correct and untouched in **metahub branch schemas** (`mhb_<uuid>_bN`), which are actual design-time workspaces with their own independently managed DDL system (`systemTableDefinitions.ts`).

---

## Non-Negotiable Constraints

1. **Fresh database reset** — no legacy data migration needed, test DB will be recreated
2. **UUID v7** mandatory everywhere
3. **No TypeORM** — SQL-first via Knex.js query builder only
4. **No metahub version bump** — structure/template versions stay unchanged
5. **Current UI shells remain** — `universo-template-mui` + `apps-template-mui`
6. **All text i18n-first** via `@universo/i18n`
7. **Shared types/utils** via `@universo/types` and `@universo/utils`
8. **TanStack Query** patterns for frontend data fetching
9. **pnpm workspace** — centralized version management
10. **Reconcile migrations removed** — since DB is fresh, no legacy bridge code needed

---

## QA Addendum (2026-03-12)

Comprehensive QA review identified corrections required before implementation. All issues below are integrated into the execution phases.

### QA Corrections Applied (Second Pass)

| ID | Severity | Fix | Location |
|---|---|---|---|
| A1 | Critical | SECURITY DEFINER functions: 5 unique (not ~14). Functions 6-10 removed (didn't exist). | Phase 2.3, 10.3a, summaries |
| A2 | Critical | Metahubs has NO `AddSoftDeleteColumns` migration. `seedBuiltinTemplatesMigration` is file-based (unfoldable). | Phase 1B |
| A3 | Critical | `cat_templates` + `doc_template_versions` have NO `_mhb_*` (only `_upl_*`). Split into 2 groups. | Overview table, Phase 4.1 |
| A4 | Critical | `rel_connector_publications` missing 10 system fields. Added Phase 4.6. | Phase 4.6, overview table |
| B1 | Important | `softDeleteSetClause` was missing `_upl_updated_by`. Added. | Phase 5 |
| B2 | Important | Helpers placed in `softDelete.ts` (not `systemFields.ts`). | Phase 5 |
| B5 | Important | `has_permission` / `has_admin_permission` join `ur + rp` (not through `r`). Converged version adds `r`. | Phase 2.3 table |
| B6 | Important | `getMhbDeleteConditions()` remains for branch schemas. Note added. | Phase 4.5 |
| C5 | Moderate | Profile purge/GC note for soft-delete accumulation. | Phase 3.4 |
| D7 | Moderate | Prefer explicit `RETURNING column_list` over `RETURNING *`. | QA Addendum |

### Utility Strategy Decision

The codebase already has two complementary utility layers in `@universo/utils/database/`:
- **Object-based** (`systemFields.ts`): `getUplCreateFields()`, `getAppCreateFields()`, `getUplDeleteFields()`, `getAppDeleteFields()` — return `Record<string, unknown>` for Knex-style `.insert()` / `.update()`.
- **Condition-based** (`softDelete.ts`): `getAppDeleteConditions()`, `getMhbDeleteConditions()`, `getUplDeleteConditions()` — return `Record<string, boolean>` for Knex `.where()`.

However, **no store in the codebase currently uses either layer**. All stores write raw parameterized SQL. The plan adds a new **string-based** layer (`activeAppRowCondition()`, `softDeleteSetClause()`) that generates SQL fragments for raw `executor.query()` calls.

**Canonical pattern for this convergence:**
- **WHERE predicates**: Use string-based `activeAppRowCondition(alias)` for raw SQL stores (all current stores are raw SQL).
- **INSERT fields**: Continue using explicit column lists with parameter placeholders (current pattern, proven safe).
- **Soft-delete SET**: Use string-based `softDeleteSetClause(paramRef)` for UPDATE-based deletion.
- **Object-based helpers**: Remain available for future Knex query-builder adoption, but are NOT required for this convergence.

This avoids mixing incompatible paradigms (object helpers in raw SQL queries) while giving stores a type-safe, DRY active-row predicate.

### SECURITY DEFINER Functions: Full Scope

The admin schema migration contains **5 unique SECURITY DEFINER functions** (`has_permission`, `get_user_permissions`, `is_superuser`, `has_admin_permission`, `get_user_global_roles`), each defined 3 times — initial version (without soft-delete), updated soft-delete version, and rollback version in `down` — totaling **15 SQL definitions**. All of them query admin tables and must receive dual-flag predicates after convergence. The full list is documented in Phase 2.3.

> **Note**: `has_permission()` and `has_admin_permission()` currently join only `rel_user_roles` + `rel_role_permissions` (not through `cat_roles`). The converged version adds a JOIN to `cat_roles` to enable dual-flag filtering on all three tables.

### Bug Fix: has_permission() Missing Soft-Delete Filters

The current soft-delete version of `has_permission()` (added in the soft-delete incremental migration) filters only `rp._upl_deleted = false` on `rel_role_permissions`, but **does not filter** `cat_roles` or `rel_user_roles`. This is a pre-existing bug. The converged version fixes this by adding dual-flag predicates on **all three joined tables**. This must be explicitly tested.

### COALESCE vs NOT NULL Decision

Current `applications-backend` stores use `COALESCE(prefix._upl_deleted, false) = false` for safety with nullable columns. After convergence, all system fields have `NOT NULL DEFAULT false`, so COALESCE is unnecessary. The plan uses direct comparison (`_upl_deleted = false`). During implementation, `applications-backend` stores should also be updated to drop COALESCE for consistency.

### RETURNING Clause Best Practice

Current stores use `RETURNING *` after INSERT/UPDATE. Prefer explicit `RETURNING column_list` to avoid accidentally exposing internal system fields to API responses and to make SQL self-documenting. This is a best-practice recommendation — not a blocking requirement for this convergence, but should be adopted wherever INSERT/UPDATE queries are rewritten.

---

## Target State

### Every fixed system schema after bootstrap must contain

```
<schema_name>/
├── _app_objects          ← entity metadata (rows for each business table)
├── _app_attributes       ← field metadata (rows for each business column)
├── _app_migrations       ← migration history
├── _app_settings         ← schema configuration
├── cat_*                 ← catalog business tables
├── doc_*                 ← document business tables
├── rel_*                 ← relation business tables
├── cfg_*                 ← configuration business tables
```

### Every business table (cat_*, doc_*, rel_*, cfg_*) must have

```sql
-- Standard business columns (domain-specific)
id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
<business_columns...>

-- Platform-level system fields (_upl_*)
_upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
_upl_created_by UUID,
_upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
_upl_updated_by UUID,
_upl_version INTEGER NOT NULL DEFAULT 1,
_upl_archived BOOLEAN NOT NULL DEFAULT false,
_upl_archived_at TIMESTAMPTZ,
_upl_archived_by UUID,
_upl_deleted BOOLEAN NOT NULL DEFAULT false,
_upl_deleted_at TIMESTAMPTZ,
_upl_deleted_by UUID,
_upl_purge_after TIMESTAMPTZ,
_upl_locked BOOLEAN NOT NULL DEFAULT false,
_upl_locked_at TIMESTAMPTZ,
_upl_locked_by UUID,
_upl_locked_reason TEXT,

-- Application-level system fields (_app_*)
_app_published BOOLEAN NOT NULL DEFAULT true,
_app_published_at TIMESTAMPTZ,
_app_published_by UUID,
_app_archived BOOLEAN NOT NULL DEFAULT false,
_app_archived_at TIMESTAMPTZ,
_app_archived_by UUID,
_app_deleted BOOLEAN NOT NULL DEFAULT false,
_app_deleted_at TIMESTAMPTZ,
_app_deleted_by UUID,
_app_owner_id UUID,
_app_access_level VARCHAR(20) NOT NULL DEFAULT 'private'
```

This matches exactly what `SchemaGenerator.createEntityTable()` creates for dynamic app schemas.

### Active-row predicate for ALL fixed system schemas

```sql
WHERE _upl_deleted = false AND _app_deleted = false
```

This replaces the current mixed predicates:
- `admin`: was `_upl_deleted = false` (or no predicate at all)
- `metahubs`: was `_upl_deleted = false AND _mhb_deleted = false`
- `profiles`: was no predicate (physical DELETE)
- `applications`: already `_upl_deleted = false AND _app_deleted = false` ✅

---

## Execution Plan

### Phase 0: Freeze baseline and acceptance contract

**Goal**: Record exact current behavior as the acceptance standard. No code changes — only verification and documentation.

**Steps:**
1. Run current `pnpm build` and record success state (27/27 packages)
2. Record the exact current platform migration SQL execution order
3. Document the current SECURITY DEFINER function signatures and their soft-delete filter state
4. Define the acceptance scenario checklist:
   - Fresh DB bootstrap completes
   - Login/register creates a profile
   - Create Metahub → creates `mhb_*_b1`
   - Create publication/version
   - Create application/connector → creates `app_*`
   - Sync publication into application
   - All current UI views work
5. Document current route/API contracts that must remain stable:
   - Admin: `/api/v1/admin/roles`, `/api/v1/admin/instances`, etc.
   - Metahubs: `/api/v1/metahubs`, `/api/v1/metahubs/:id/branches`, etc.
   - Applications: `/api/v1/applications`, `/api/v1/connectors`, etc.
   - Profiles: `/api/v1/profile`
6. Record the current `has_permission()` bug (missing soft-delete filters on `cat_roles` and `rel_user_roles` joins) as a known baseline issue that this convergence fixes.

**Validation**: No code changes required. Baseline recorded in test/comments.

---

### Phase 1: Clean up legacy reconciliation migrations and fold incremental migrations

**Goal**: Remove all reconcile-bridge migrations and fold incremental migrations into main creation SQL. Since the DB is fresh, reconcile migrations are dead code, and incremental migrations can be absorbed into one clean creation migration per schema.

**1A. Remove reconcile migrations (files + exports + registration):**
- `packages/admin-backend/base/src/platform/migrations/index.ts` — remove `reconcileLegacyAdminSchemaNamesMigrationDefinition` (both the definition and its registration in the migrations array)
- `packages/applications-backend/base/src/platform/migrations/` — remove reconcile migration file + registration
- `packages/metahubs-backend/base/src/platform/migrations/1766351182500-ReconcileLegacyMetahubsSchemaNames.sql.ts` — delete file + remove registration
- `packages/profile-backend/base/src/platform/migrations/` — remove reconcile migrations for public.profiles and profiles.profiles
- `packages/universo-migrations-platform/base/src/` — remove legacy fixed-schema inspection gates (doctor, startup checks)

**1B. Fold incremental migration definitions into main creation SQL:**
- `admin-backend`: fold `addAdminSoftDeleteColumnsMigrationDefinition`, `addCodenameAutoConvertMixedSettingMigrationDefinition` into the main creation migration
- `profile-backend`: fold `addOnboardingCompletedMigrationDefinition`, `addConsentFieldsMigrationDefinition`, `updateProfileTriggerMigrationDefinition` into main
- `metahubs-backend`: fold `AddTemplateDefinitionType` into main creation SQL (the only foldable incremental SQL migration)
- `metahubs-backend`: `seedBuiltinTemplatesMigration` is a **file-based (non-SQL) migration** that executes TypeScript logic to seed template data — it **cannot** be folded into the SQL creation migration and must remain as a separate migration definition
- For each: remove the separate definition export, remove from migration registration array

**1C. Remove duplicate initial function versions (admin):**
The admin migration currently contains TWO versions of each of the 5 SECURITY DEFINER functions: the initial version (without soft-delete) and an updated soft-delete version. After folding, keep ONLY the final versions (with soft-delete filters that will be further updated in Phase 2).

**Affected tests**: Update all tests that reference reconcile migrations or incremental definitions.

**Validation**: `pnpm build` green, all focused tests green. Each schema now has exactly ONE creation migration definition.

---

### Phase 2: Rewrite admin schema creation SQL

**Goal**: Admin tables get full `_upl_*` + `_app_*` system fields.

#### 2.1. Rewrite `createAdminSchemaMigrationDefinition`

Current `admin.cfg_instances`:
```sql
-- BEFORE (current)
CREATE TABLE admin.cfg_instances (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    codename VARCHAR(100) NOT NULL UNIQUE,
    name JSONB DEFAULT '{}',
    description JSONB,
    url VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    is_local BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT instances_status_check CHECK (status IN ('active', 'inactive', 'maintenance'))
);
```

Target:
```sql
-- AFTER (converged)
CREATE TABLE admin.cfg_instances (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    codename VARCHAR(100) NOT NULL,
    name JSONB NOT NULL DEFAULT '{}',
    description JSONB DEFAULT '{}',
    url VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    is_local BOOLEAN NOT NULL DEFAULT false,

    -- Platform-level system fields (_upl_*)
    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by UUID,
    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_by UUID,
    _upl_version INTEGER NOT NULL DEFAULT 1,
    _upl_archived BOOLEAN NOT NULL DEFAULT false,
    _upl_archived_at TIMESTAMPTZ,
    _upl_archived_by UUID,
    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted_at TIMESTAMPTZ,
    _upl_deleted_by UUID,
    _upl_purge_after TIMESTAMPTZ,
    _upl_locked BOOLEAN NOT NULL DEFAULT false,
    _upl_locked_at TIMESTAMPTZ,
    _upl_locked_by UUID,
    _upl_locked_reason TEXT,

    -- Application-level system fields (_app_*)
    _app_published BOOLEAN NOT NULL DEFAULT true,
    _app_published_at TIMESTAMPTZ,
    _app_published_by UUID,
    _app_archived BOOLEAN NOT NULL DEFAULT false,
    _app_archived_at TIMESTAMPTZ,
    _app_archived_by UUID,
    _app_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted_at TIMESTAMPTZ,
    _app_deleted_by UUID,
    _app_owner_id UUID,
    _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private',

    CONSTRAINT instances_status_check CHECK (status IN ('active', 'inactive', 'maintenance'))
);

CREATE UNIQUE INDEX idx_cfg_instances_codename_active
ON admin.cfg_instances (codename)
WHERE _upl_deleted = false AND _app_deleted = false;

CREATE INDEX idx_cfg_instances_upl_deleted
ON admin.cfg_instances (_upl_deleted_at)
WHERE _upl_deleted = true;

CREATE INDEX idx_cfg_instances_app_deleted
ON admin.cfg_instances (_app_deleted_at)
WHERE _app_deleted = true;
```

Same pattern applied to ALL admin tables: `cat_roles`, `rel_role_permissions`, `rel_user_roles`, `cfg_locales`, `cfg_settings`.

#### 2.2. Update seed data SQL

The seed data for default `superuser` role and its permissions must include `_upl_*` and `_app_*` default values:

```sql
INSERT INTO admin.cat_roles (
    codename, name, description, color, 
    is_superuser, is_system,
    _upl_created_at, _upl_updated_at, _upl_version,
    _upl_deleted, _app_published, _app_deleted, _app_access_level
) VALUES (
    'superuser',
    '{"_schema":"1","_primary":"en","locales":{"en":{"content":"Super User","version":1,"isActive":true},"ru":{"content":"Суперпользователь","version":1,"isActive":true}}}'::jsonb,
    '{"_schema":"1","_primary":"en","locales":{"en":{"content":"Full platform access","version":1,"isActive":true},"ru":{"content":"Полный доступ к платформе","version":1,"isActive":true}}}'::jsonb,
    '#d32f2f',
    true, true,
    NOW(), NOW(), 1,
    false, true, false, 'public'
) ON CONFLICT (codename) DO UPDATE SET
    name = EXCLUDED.name,
    color = EXCLUDED.color,
    is_superuser = EXCLUDED.is_superuser;
```

#### 2.3. Update ALL admin SECURITY DEFINER functions (BUG FIX + convergence)

The admin schema contains **5 SECURITY DEFINER functions** (15 definitions: 5 × 3 versions). ALL of them query admin tables via JOINs and must receive dual-flag active-row predicates.

**Bug fix**: The current `has_permission()` soft-delete version filters only `rp._upl_deleted = false` on `rel_role_permissions` but misses `cat_roles` and `rel_user_roles`. The converged version fixes this for all functions.

> **Architecture note**: `has_permission()` and `has_admin_permission()` currently do NOT join `cat_roles` — they go directly from `rel_user_roles` to `rel_role_permissions` via `role_id`. The converged version **adds** a `JOIN admin.cat_roles` to these functions so that deleted roles are correctly filtered.

**Full list of functions requiring dual-flag update:**

| # | Function | Current tables joined | Converged tables joined | Current filter | Required filter |
|---|----------|----------------------|------------------------|----------------|-----------------|
| 1 | `admin.has_permission()` | ur + rp | ur + r + rp (**r added**) | `rp._upl_deleted` only | All 3: `_upl_deleted = false AND _app_deleted = false` |
| 2 | `admin.get_user_permissions()` | ur + r + rp | ur + r + rp | `r._upl_deleted`, `rp._upl_deleted` | All 3: dual-flag |
| 3 | `admin.is_superuser()` | ur + r | ur + r | none | Both: dual-flag |
| 4 | `admin.has_admin_permission()` | ur + rp | ur + r + rp (**r added**) | `rp._upl_deleted` only | All 3: dual-flag |
| 5 | `admin.get_user_global_roles()` | ur + r | ur + r | `r._upl_deleted` | Both: dual-flag |

**Pattern for each function:**
```sql
-- Every JOIN to cat_roles, rel_user_roles, rel_role_permissions must include:
AND ur._upl_deleted = false AND ur._app_deleted = false
AND r._upl_deleted = false AND r._app_deleted = false
AND rp._upl_deleted = false AND rp._app_deleted = false  -- only for functions that join rp
```

**Example — converged `has_permission()` (note: `cat_roles` JOIN added for dual-flag filtering):**

```sql
CREATE OR REPLACE FUNCTION admin.has_permission(
    p_user_id UUID DEFAULT NULL,
    p_subject TEXT DEFAULT '*',
    p_action TEXT DEFAULT '*',
    p_context JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;

    RETURN EXISTS (
        SELECT 1
        FROM admin.rel_user_roles ur
        JOIN admin.cat_roles r ON ur.role_id = r.id
        JOIN admin.rel_role_permissions rp ON ur.role_id = rp.role_id
        WHERE ur.user_id = v_user_id
          AND ur._upl_deleted = false AND ur._app_deleted = false
          AND r._upl_deleted = false AND r._app_deleted = false
          AND rp._upl_deleted = false AND rp._app_deleted = false
          AND (rp.subject = '*' OR rp.subject = p_subject)
          AND (rp.action = '*' OR rp.action = p_action)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = admin, public, auth, pg_temp STABLE;
```

**Affected backend stores:**
- `rolesStore.ts` — switch from `_upl_deleted` to `activeAppRowCondition('r')`, add `_app_*` columns to INSERT/UPDATE
- `instancesStore.ts` — add system field predicates to all queries
- `settingsStore.ts` — switch to dual-flag predicate
- `localesStore.ts` — switch to dual-flag predicate

**Example — `rolesStore.ts` WHERE predicate update:**

```typescript
// BEFORE
conditions.push('r._upl_deleted = false')

// AFTER
import { activeAppRowCondition } from '@universo/utils'
conditions.push(activeAppRowCondition('r'))
// Produces: "r._upl_deleted = false AND r._app_deleted = false"
```

**Example — `rolesStore.ts` INSERT update (keep explicit column listing):**

```typescript
// BEFORE: INSERT — manually lists old columns
executor.query(`
    INSERT INTO admin.cat_roles (codename, name, description, color, is_superuser, is_system, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING *
`, [codename, name, description, color, isSuperuser, isSystem])

// AFTER: INSERT — explicit system field columns (current codebase pattern: raw parameterized SQL)
executor.query(`
    INSERT INTO admin.cat_roles (
        codename, name, description, color, is_superuser, is_system,
        _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
        _upl_deleted, _app_published, _app_deleted, _app_access_level
    ) VALUES (
        $1, $2, $3, $4, $5, $6,
        NOW(), $7, NOW(), $7, 1,
        false, true, false, 'public'
    ) RETURNING *
`, [codename, name, description, color, isSuperuser, isSystem, userId])
```

> **Note**: INSERT continues using explicit column lists with parameter placeholders (current proven pattern across all stores). The `getUplCreateFields()` / `getAppCreateFields()` object-based helpers from `@universo/utils` remain available for future Knex query-builder adoption, but are not mixed into raw SQL stores.

**Validation**: Focused lint/test/build for `@universo/admin-backend`.

---

### Phase 3: Rewrite profiles schema creation SQL

**Goal**: Profile table gets full `_upl_*` + `_app_*` system fields.

#### 3.1. Rewrite `addProfileMigrationDefinition`

```sql
-- AFTER (converged)
CREATE TABLE profiles.cat_profiles (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    user_id UUID NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    settings JSONB NOT NULL DEFAULT '{}',
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    terms_accepted BOOLEAN NOT NULL DEFAULT false,
    terms_accepted_at TIMESTAMPTZ,
    privacy_accepted BOOLEAN NOT NULL DEFAULT false,
    privacy_accepted_at TIMESTAMPTZ,
    terms_version VARCHAR(20),
    privacy_version VARCHAR(20),

    -- Platform-level system fields (_upl_*)
    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by UUID,
    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_by UUID,
    _upl_version INTEGER NOT NULL DEFAULT 1,
    _upl_archived BOOLEAN NOT NULL DEFAULT false,
    _upl_archived_at TIMESTAMPTZ,
    _upl_archived_by UUID,
    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted_at TIMESTAMPTZ,
    _upl_deleted_by UUID,
    _upl_purge_after TIMESTAMPTZ,
    _upl_locked BOOLEAN NOT NULL DEFAULT false,
    _upl_locked_at TIMESTAMPTZ,
    _upl_locked_by UUID,
    _upl_locked_reason TEXT,

    -- Application-level system fields (_app_*)
    _app_published BOOLEAN NOT NULL DEFAULT true,
    _app_published_at TIMESTAMPTZ,
    _app_published_by UUID,
    _app_archived BOOLEAN NOT NULL DEFAULT false,
    _app_archived_at TIMESTAMPTZ,
    _app_archived_by UUID,
    _app_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted_at TIMESTAMPTZ,
    _app_deleted_by UUID,
    _app_owner_id UUID,
    _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private',

    CONSTRAINT pk_cat_profiles PRIMARY KEY (id),
    CONSTRAINT uq_cat_profiles_user_id UNIQUE (user_id),
    CONSTRAINT uq_cat_profiles_nickname UNIQUE (nickname)
);
```

#### 3.2. Update profile trigger (`create_user_profile()`)

The trigger that creates a profile on `auth.users` INSERT must set system fields:

```sql
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = profiles, public, auth, pg_temp
AS $func$
DECLARE
    temp_nickname VARCHAR(50);
    attempt_count INTEGER := 0;
BEGIN
    LOOP
        attempt_count := attempt_count + 1;
        temp_nickname := 'user_' || substring(NEW.id::text from 1 for 8);
        IF attempt_count > 1 THEN
            temp_nickname := temp_nickname || '_' || attempt_count;
        END IF;

        BEGIN
            INSERT INTO profiles.cat_profiles (
                user_id, nickname, settings,
                _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                _upl_version, _upl_deleted, _app_published, _app_deleted, _app_access_level
            ) VALUES (
                NEW.id, temp_nickname, '{}',
                now(), NEW.id, now(), NEW.id,
                1, false, true, false, 'private'
            );
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            IF attempt_count >= 5 THEN
                temp_nickname := 'user_' || extract(epoch from now())::bigint;
                INSERT INTO profiles.cat_profiles (
                    user_id, nickname, settings,
                    _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                    _upl_version, _upl_deleted, _app_published, _app_deleted, _app_access_level
                ) VALUES (
                    NEW.id, temp_nickname, '{}',
                    now(), NEW.id, now(), NEW.id,
                    1, false, true, false, 'private'
                );
                EXIT;
            END IF;
        END;
    END LOOP;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$func$;
```

#### 3.3. Update profile stores

Switch `profileStore.ts` from physical DELETE to soft-delete:

```typescript
// BEFORE
async function deleteProfileByUserId(executor: DbExecutor, userId: string): Promise<void> {
    await executor.query(`DELETE FROM profiles.cat_profiles WHERE user_id = $1`, [userId])
}

// AFTER
async function deleteProfileByUserId(executor: DbExecutor, userId: string, deletedBy?: string): Promise<void> {
    await executor.query(`
        UPDATE profiles.cat_profiles
        SET _upl_deleted = true, _upl_deleted_at = now(), _upl_deleted_by = $2,
            _upl_updated_at = now(), _upl_updated_by = $2,
            _app_deleted = true, _app_deleted_at = now(), _app_deleted_by = $2
        WHERE user_id = $1 AND _upl_deleted = false AND _app_deleted = false
    `, [userId, deletedBy ?? null])
}
```

#### 3.4. Update auth-backend profile queries

The auth module inserts/updates profiles during registration/login. These queries must include system fields.

**Affected files:**
- `packages/auth-backend/base/src/routes/auth.ts` — INSERT/UPDATE profile queries

**Validation**: Focused lint/test/build for `@universo/profile-backend`, `@universo/auth-backend`.

> **Future work note (C5)**: Switching profiles from physical DELETE to soft-delete means deleted profile rows accumulate. A purge/garbage-collection mechanism (e.g., scheduled cleanup of rows where `_upl_purge_after < now()`) should be considered as future tech debt. This convergence only adds the soft-delete capability — the purge strategy is out of scope.

---

### Phase 4: Rewrite metahubs PLATFORM schema — switch `_mhb_*` to `_app_*`

**Goal**: Metahubs **platform catalog** tables (in the `metahubs` fixed schema) switch from `_mhb_*` to `_app_*` system fields.

> **IMPORTANT**: This phase affects ONLY the `metahubs` platform schema (the catalog). It does NOT touch:
> - Dynamic metahub branch schemas (`mhb_<uuid>_bN`) — they keep `_mhb_*` fields and `_mhb_objects`/`_mhb_attributes` system tables
> - Dynamic application schemas (`app_<uuid>`) — they already have `_app_*` fields
> - The DDL system in `systemTableDefinitions.ts` that creates branch schemas — it remains entirely unchanged

#### 4.1. Rewrite `CreateMetahubsSchema` SQL

The 7 metahubs tables fall into **two groups** with different migration strategies:

**Group A — 5 tables with existing `_mhb_*` fields (replace `_mhb_*` → `_app_*`):**
- `cat_metahubs`, `cat_metahub_branches`, `rel_metahub_users`, `doc_publications`, `doc_publication_versions`

For these tables, replace:
```sql
_mhb_published BOOLEAN NOT NULL DEFAULT false,
_mhb_published_at TIMESTAMPTZ,
_mhb_published_by UUID,
_mhb_archived BOOLEAN NOT NULL DEFAULT false,
_mhb_archived_at TIMESTAMPTZ,
_mhb_archived_by UUID,
_mhb_deleted BOOLEAN NOT NULL DEFAULT false,
_mhb_deleted_at TIMESTAMPTZ,
_mhb_deleted_by UUID
```
With:
```sql
_app_published BOOLEAN NOT NULL DEFAULT true,   -- Note: default true (not false)
_app_published_at TIMESTAMPTZ,
_app_published_by UUID,
_app_archived BOOLEAN NOT NULL DEFAULT false,
_app_archived_at TIMESTAMPTZ,
_app_archived_by UUID,
_app_deleted BOOLEAN NOT NULL DEFAULT false,
_app_deleted_at TIMESTAMPTZ,
_app_deleted_by UUID,
_app_owner_id UUID,
_app_access_level VARCHAR(20) NOT NULL DEFAULT 'private'
```

**Group B — 2 tables with `_upl_*` ONLY (add new `_app_*` fields):**
- `cat_templates`, `doc_template_versions`

These tables currently have NO second-layer fields — only `_upl_*`. The convergence must **add** the full `_app_*` field set after the existing `_upl_*` columns:
```sql
-- ADD after existing _upl_* fields:
_app_published BOOLEAN NOT NULL DEFAULT true,
_app_published_at TIMESTAMPTZ,
_app_published_by UUID,
_app_archived BOOLEAN NOT NULL DEFAULT false,
_app_archived_at TIMESTAMPTZ,
_app_archived_by UUID,
_app_deleted BOOLEAN NOT NULL DEFAULT false,
_app_deleted_at TIMESTAMPTZ,
_app_deleted_by UUID,
_app_owner_id UUID,
_app_access_level VARCHAR(20) NOT NULL DEFAULT 'private'
```

Also update the existing partial indexes for Group B tables to add `_app_deleted` predicate:
```sql
-- BEFORE (cat_templates):
WHERE _upl_deleted = false

-- AFTER:
WHERE _upl_deleted = false AND _app_deleted = false
```

Plus add missing `_upl_*` fields to tables that don't have the full set.

#### 4.2. Update all indexes

Replace `_mhb_deleted` in partial index predicates with `_app_deleted`:
```sql
-- BEFORE
WHERE _upl_deleted = false AND _mhb_deleted = false

-- AFTER
WHERE _upl_deleted = false AND _app_deleted = false
```

#### 4.3. Update RLS policies

All RLS policies in the metahubs schema that reference `_mhb_deleted` must switch to `_app_deleted`.

#### 4.4. Fold incremental metahubs migrations (already done in Phase 1B)

Phase 1B handles folding incremental definitions. This step just verifies the result: one clean creation migration for metahubs.

#### 4.5. Update metahubs backend stores AND types

**Affected files (stores):**
- `metahubsStore.ts`
- `branchesStore.ts`
- `publicationsStore.ts`
- `templatesStore.ts`
- `metahubsQueryHelpers.ts`

**Affected files (types — must not be missed):**
- `packages/metahubs-backend/base/src/persistence/types.ts` — replace `MhbSystemFields` interface (lines 30-42) with `AppSystemFields` using `_app_*` field names
- `packages/metahubs-backend/base/src/persistence/types.ts` — update SQL aliases (lines 202-209) from `_mhb_*` to `_app_*` mappings

**Affected files (cross-package):**
- `packages/applications-backend/base/src/persistence/connectorsStore.ts` — update `metahubActiveRowPredicate()` to use `activeAppRowCondition()`, drop COALESCE wrappers
- `packages/applications-backend/base/src/persistence/applicationsStore.ts` — drop COALESCE wrappers from `activeRowPredicate()`, replace with `activeAppRowCondition()`

```typescript
// BEFORE (metahubsQueryHelpers.ts)
export function activeMetahubRowCondition(alias?: string): string {
    const prefix = alias ? `${alias}.` : ''
    return `${prefix}_upl_deleted = false AND ${prefix}_mhb_deleted = false`
}

// AFTER
import { activeAppRowCondition } from '@universo/utils'
// This helper already returns: "alias._upl_deleted = false AND alias._app_deleted = false"
export { activeAppRowCondition as activeMetahubRowCondition }
```

All stores must switch from `_mhb_*` column references to `_app_*`. The INSERT operations must include `_app_*` fields instead of `_mhb_*`.

> **IMPORTANT**: The `getMhbDeleteConditions()` function in `@universo/utils/database/softDelete.ts` must **remain** unchanged — it is used by dynamic metahub branch schemas (`mhb_<uuid>_bN`) which still use `_mhb_*` fields. Only the `metahubs` **platform catalog** schema switches to `_app_*`.

**Validation**: Focused lint/test/build for `@universo/metahubs-backend`.

#### 4.6. Fix `rel_connector_publications` missing system fields (applications-backend)

> **QA Finding A4**: The `applications.rel_connector_publications` table in `CreateApplicationsSchema` migration is missing 10 system fields that all other applications tables have (and that `SchemaGenerator.createEntityTable()` creates for dynamic app schemas).

**Missing fields** (must be added to the CREATE TABLE SQL):
```sql
-- Missing _upl_* fields:
_upl_archived BOOLEAN NOT NULL DEFAULT false,
_upl_archived_at TIMESTAMPTZ,
_upl_archived_by UUID,
_upl_purge_after TIMESTAMPTZ,
_upl_locked BOOLEAN NOT NULL DEFAULT false,
_upl_locked_at TIMESTAMPTZ,
_upl_locked_by UUID,
_upl_locked_reason TEXT,

-- Missing _app_* fields:
_app_owner_id UUID,
_app_access_level VARCHAR(20) NOT NULL DEFAULT 'private'
```

**Affected file**: `packages/applications-backend/base/src/platform/migrations/1800000000000-CreateApplicationsSchema.sql.ts`

**Also update**: `connectorsStore.ts` queries to include the new fields in INSERT/UPDATE operations where applicable.

**Validation**: Focused lint/test/build for `@universo/applications-backend`.

---

### Phase 5: Add string-based SQL helpers to existing `@universo/utils` database module

**Goal**: Extend the existing `@universo/utils/database/softDelete.ts` with SQL-string helpers for raw parameterized SQL stores.

> **Context**: The `softDelete.ts` file already contains condition-based helpers (`getAppDeleteConditions`, `getMhbDeleteConditions`, `getUplDeleteConditions`) returning `Record<string, boolean>` for Knex `.where()`. The new string-based helpers complement these for the raw `executor.query()` pattern used by ALL current stores. The companion `systemFields.ts` contains object-based create/update helpers that remain unchanged. No existing API is changed or replaced.

> **Placement rationale**: `activeAppRowCondition()` and `softDeleteSetClause()` are deletion/filtering predicates, making `softDelete.ts` the natural home (alongside existing condition-based helpers). `systemFields.ts` retains its focus on create/update field generation.

```typescript
// packages/universo-utils/base/src/database/softDelete.ts — ADD to existing file

/**
 * Returns the standard active-row SQL predicate for application-like tables.
 * Use in WHERE clauses to filter soft-deleted rows.
 *
 * @example
 * const sql = `SELECT * FROM admin.cat_roles r WHERE ${activeAppRowCondition('r')}`
 * // → "r._upl_deleted = false AND r._app_deleted = false"
 */
export function activeAppRowCondition(alias?: string): string {
    const prefix = alias ? `${alias}.` : ''
    return `${prefix}_upl_deleted = false AND ${prefix}_app_deleted = false`
}

/**
 * Returns soft-delete SET clause for UPDATE-based deletion.
 *
 * @example
 * const sql = `UPDATE ... SET ${softDeleteSetClause('$2')} WHERE ...`
 * // → "_upl_deleted = true, _upl_deleted_at = now(), _upl_deleted_by = $2, ..."
 */
export function softDeleteSetClause(deletedByParam: string): string {
    return [
        `_upl_deleted = true`,
        `_upl_deleted_at = now()`,
        `_upl_deleted_by = ${deletedByParam}`,
        `_upl_updated_at = now()`,
        `_upl_updated_by = ${deletedByParam}`,
        `_app_deleted = true`,
        `_app_deleted_at = now()`,
        `_app_deleted_by = ${deletedByParam}`
    ].join(', ')
}
```

**Validation**: `@universo/utils` build green.

---

### Phase 6: Verify and update systemAppDefinition manifests

**Goal**: Ensure each manifest's business table field definitions match the actual physical columns after the SQL rewrite phases (2-4).

> **Important clarification**: Current manifests already correctly declare ONLY business fields (e.g., `codename`, `name`, `is_superuser`). System fields (`_upl_*`, `_app_*`) are NOT listed in field arrays — they are generated automatically by `bootstrapSystemAppStructureMetadata()` based on `systemTableCapabilities` flags (e.g., `appCoreTables: true`). This is correct and by design.

**What actually needs updating:**
- Verify that `targetStructureCapabilities.appCoreTables` is `true` for all 4 manifests ✅ (already correct)
- Verify that `targetBusinessTables` field arrays match the physical business columns in the rewritten SQL (e.g., if a business column was renamed or added during convergence)
- For `metahubs-backend` manifest: verify no `_mhb_*` references remain in `currentBusinessTables` or `targetBusinessTables` metadata
- The `currentStorageModel` / `targetStorageModel` may need update to reflect the convergence completion
- Verify `structureVersion` stays at `0.1.0` (no artificial bump per non-negotiable constraint #4)

**Affected files:**
- `packages/admin-backend/base/src/platform/systemAppDefinition.ts`
- `packages/profile-backend/base/src/platform/systemAppDefinition.ts`
- `packages/metahubs-backend/base/src/platform/systemAppDefinition.ts`
- `packages/applications-backend/base/src/platform/systemAppDefinition.ts`

**Validation**: Focused lint/test/build for each package.

---

### Phase 7: Update frontend API response contracts

**Goal**: Frontend code must work with the new column names in API responses.

#### 7.1. Admin frontend

Admin routes return raw DB rows. The row types must include system fields:

```typescript
// packages/universo-types — add/update admin types
export interface AdminRoleRow {
    id: string
    codename: string
    name: JsonLocalized
    description: JsonLocalized | null
    color: string
    is_superuser: boolean
    is_system: boolean
    // System fields (replacing created_at/updated_at)
    _upl_created_at: string
    _upl_updated_at: string
    _upl_deleted: boolean
    _app_deleted: boolean
    // ... other system fields as needed by frontend
}
```

**Known anomaly**: `admin-frontend/base/src/types.ts` currently defines `created_at: string` and `updated_at: string` in snake_case (while all other frontends use camelCase). During convergence, update these to reference the new `_upl_created_at` / `_upl_updated_at` fields. If the admin route handler transforms to camelCase, align the type accordingly.

**Approach**: For now, the minimum change is ensuring the stores return the correct data and the frontends don't break on extra columns. A standardized response DTO envelope (`EntityResponse<T>`) is a FUTURE improvement and is NOT part of this convergence scope.

#### 7.2. Profile frontend

Profile routes use a controller pattern. Update the `ProfileRow` type to include system fields.

#### 7.3. Metahubs frontend

Metahub frontend already handles `_mhb_*` fields from API responses. The column rename to `_app_*` will require updating frontend type definitions and any explicit field references.

**Affected files:**
- `packages/metahubs-frontend/base/src/` — types that reference `_mhb_deleted`, `mhbDeleted`, etc. (only in comments and types — ~3 locations)
- `packages/metahubs-backend/base/src/persistence/types.ts` — `MhbSystemFields` interface → rename to `AppSystemFields` or equivalent
- `packages/metahubs-backend/base/src/persistence/types.ts` — SQL aliases mapping `_mhb_*` → camelCase must be updated to `_app_*` → camelCase
- `packages/applications-frontend/base/src/` — minimal changes (already uses `_app_*`)

#### 7.4. Backend response format consistency note

Current backend services are INCONSISTENT in response format:
- Some use camelCase (`MetahubAttributesService`, `ConstantsService`, `EnumerationValuesService`)
- Some use snake_case (`HubsService`, `catalogsRoutes`)

This pre-existing inconsistency is NOT in scope for this convergence. However, when updating stores in Phases 2-4, maintain whatever response format the store currently uses. Do not change the API contract shape.

**Validation**: Focused lint/test/build for all frontend packages.

---

### Phase 8: Update bootstrapSystemAppStructureMetadata flow

**Goal**: Verify the metadata bootstrap correctly populates `_app_objects` and `_app_attributes` for the new column structure.

The `bootstrapSystemAppStructureMetadata` function in `@universo/migrations-platform` uses the `businessTables` from each `systemAppDefinition` to populate metadata. After updating the manifests in Phase 6, the bootstrap should automatically produce correct metadata.

Verify that after bootstrap:
- Each schema's `_app_objects` has rows for all business tables
- Each schema's `_app_attributes` has rows for all business columns including system fields
- The `column_name` values in `_app_attributes` match the actual physical column names

**Validation**: Run bootstrap against an empty DB and query `_app_objects` / `_app_attributes`.

---

### Phase 9: Remove dead code and legacy artifacts

**Goal**: Clean up all code that references removed patterns. This phase handles leftover references NOT already addressed in Phase 1 (which handled migration registration and fold-in).

#### 9.1. Delete orphaned migration files

After Phase 1 removed registrations and Phase 2-4 replaced SQL content, delete any remaining physical files that are no longer imported:
- Verify all reconcile migration `.ts` files deleted (should be done in Phase 1)
- Verify all incremental migration `.ts` files deleted (should be done in Phase 1)
- If any remain (missed imports/re-exports), delete them now

#### 9.2. Remove legacy inspection gates

Remove from `@universo/migrations-platform`:
- `inspectLegacyFixedSchemaLeftovers()` function
- Legacy doctor/startup checks that look for old table names
- References to these in `initDatabase()`

#### 9.3. Codebase grep for stale references (expanded)

```bash
# Find any remaining _mhb_ references in platform stores (should be zero after Phase 4)
grep -r "_mhb_" packages/metahubs-backend/base/src/persistence/ --include="*.ts"
grep -r "_mhb_" packages/metahubs-backend/base/src/platform/ --include="*.ts"
# Exception: systemTableDefinitions.ts is EXPECTED to have _mhb_ — it defines branch schemas

# Find old column names in stores
grep -r "created_at\b" packages/admin-backend/base/src/persistence/ --include="*.ts"
grep -r "updated_at\b" packages/admin-backend/base/src/persistence/ --include="*.ts"
grep -r "created_at\b" packages/profile-backend/base/src/persistence/ --include="*.ts"

# Find any remaining COALESCE wrappers around NOT NULL system fields
grep -r "COALESCE.*_upl_deleted\|COALESCE.*_app_deleted" packages/ --include="*.ts"

# Find remaining MhbSystemFields type references
grep -r "MhbSystemFields\|mhbDeleted\|mhbPublished\|mhbArchived" packages/ --include="*.ts"

# Find references to removed reconcile migrations
grep -r "Reconcile" packages/ --include="*.ts"
grep -r "reconcile" packages/ --include="*.ts" -l
```

**Validation**: Full `pnpm build` green, all focused tests green.

---

### Phase 10: Deep test system

**Goal**: Comprehensive test coverage for the entire convergence.

**Test infrastructure note**: Tests are organized by infrastructure requirement:
- **10.1–10.3, 10.3a**: Pure unit tests using mock executors — no database required
- **10.4–10.5**: Integration tests requiring a real PostgreSQL database (Supabase or local)
- **10.6**: Frontend component tests using existing TanStack Query test patterns
- **10.7**: Manual end-to-end verification against Supabase UP-test

#### 10.1. Unit tests — SQL migration definitions

For each schema, add a test that:
- Validates the migration SQL contains all required `_upl_*` fields
- Validates the migration SQL contains all required `_app_*` fields
- Validates indexes use the dual-flag predicate
- Validates seed SQL includes system field defaults

```typescript
// Example: packages/admin-backend/base/src/platform/__tests__/adminMigrations.test.ts
describe('admin schema creation SQL', () => {
    it('includes full _upl_* system fields for cfg_instances', () => {
        const sql = createAdminSchemaMigrationDefinition.up
            .map(s => s.sql).join('\n')

        expect(sql).toContain('_upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now()')
        expect(sql).toContain('_upl_created_by UUID')
        expect(sql).toContain('_upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()')
        expect(sql).toContain('_upl_updated_by UUID')
        expect(sql).toContain('_upl_version INTEGER NOT NULL DEFAULT 1')
        expect(sql).toContain('_upl_deleted BOOLEAN NOT NULL DEFAULT false')
        expect(sql).toContain('_upl_locked BOOLEAN NOT NULL DEFAULT false')
    })

    it('includes full _app_* system fields for cfg_instances', () => {
        const sql = createAdminSchemaMigrationDefinition.up
            .map(s => s.sql).join('\n')

        expect(sql).toContain('_app_published BOOLEAN NOT NULL DEFAULT true')
        expect(sql).toContain('_app_deleted BOOLEAN NOT NULL DEFAULT false')
        expect(sql).toContain('_app_owner_id UUID')
        expect(sql).toContain('_app_access_level VARCHAR(20)')
    })

    it('uses dual-flag predicate in partial indexes', () => {
        const sql = createAdminSchemaMigrationDefinition.up
            .map(s => s.sql).join('\n')

        // All partial unique indexes must use dual-flag
        const indexMatches = sql.match(/WHERE.*_deleted/g) ?? []
        for (const match of indexMatches) {
            expect(match).toContain('_upl_deleted = false')
            expect(match).toContain('_app_deleted = false')
        }
    })
})
```

#### 10.2. Unit tests — Store active-row predicates

```typescript
// Example: packages/admin-backend/base/src/persistence/__tests__/rolesStore.test.ts
describe('rolesStore', () => {
    it('filters active rows with dual-flag predicate', () => {
        // Mock executor and verify SQL includes correct WHERE clause
        const executor = createMockExecutor()
        await listRoles(executor)

        const lastQuery = executor.getLastQuery()
        expect(lastQuery.sql).toContain('_upl_deleted = false')
        expect(lastQuery.sql).toContain('_app_deleted = false')
    })

    it('includes _upl_* and _app_* fields in INSERT', () => {
        const executor = createMockExecutor()
        await createRole(executor, { codename: 'test', name: {}, userId: 'user-1' })

        const lastQuery = executor.getLastQuery()
        expect(lastQuery.sql).toContain('_upl_created_at')
        expect(lastQuery.sql).toContain('_upl_created_by')
        expect(lastQuery.sql).toContain('_app_published')
        expect(lastQuery.sql).toContain('_app_deleted')
    })

    it('soft-deletes with dual-flag', () => {
        const executor = createMockExecutor()
        await deleteRole(executor, 'role-id', 'user-1')

        const lastQuery = executor.getLastQuery()
        expect(lastQuery.sql).toContain('_upl_deleted = true')
        expect(lastQuery.sql).toContain('_app_deleted = true')
        expect(lastQuery.sql).not.toContain('DELETE FROM')
    })
})
```

#### 10.3. Unit tests — systemAppDefinition manifests

```typescript
// Example: packages/admin-backend/base/src/platform/__tests__/systemAppDefinition.test.ts
describe('adminSystemAppDefinition', () => {
    it('declares appCoreTables capability', () => {
        expect(adminSystemAppDefinition.targetStructureCapabilities.appCoreTables).toBe(true)
    })

    it('has business table definitions for all admin tables', () => {
        const tableNames = adminSystemAppDefinition.businessTables.map(t => t.tableName)
        expect(tableNames).toContain('cfg_instances')
        expect(tableNames).toContain('cat_roles')
        expect(tableNames).toContain('rel_role_permissions')
        expect(tableNames).toContain('rel_user_roles')
        expect(tableNames).toContain('cfg_locales')
        expect(tableNames).toContain('cfg_settings')
    })

    it('field metadata matches physical columns', () => {
        const rolesTable = adminSystemAppDefinition.businessTables
            .find(t => t.tableName === 'cat_roles')!
        const fieldNames = rolesTable.fields.map(f => f.physicalColumnName)

        expect(fieldNames).toContain('codename')
        expect(fieldNames).toContain('name')
        expect(fieldNames).toContain('is_superuser')
        // System fields should NOT be listed as business fields
        expect(fieldNames).not.toContain('_upl_created_at')
        expect(fieldNames).not.toContain('_app_deleted')
    })
})
```

#### 10.3a. Unit tests — SECURITY DEFINER function SQL (BUG FIX verification)

```typescript
// packages/admin-backend/base/src/platform/__tests__/adminFunctions.test.ts
describe('admin SECURITY DEFINER functions', () => {
    const functions = [
        'has_permission', 'get_user_permissions', 'is_superuser',
        'has_admin_permission', 'get_user_global_roles'
    ]

    for (const fnName of functions) {
        it(`${fnName}() applies dual-flag predicate on ALL joined tables`, () => {
            const sql = createAdminSchemaMigrationDefinition.up
                .map(s => s.sql).join('\n')
            
            // Extract function body
            const fnRegex = new RegExp(
                `CREATE OR REPLACE FUNCTION admin\\.${fnName}\\(.*?\\$\\$`,
                'gs'
            )
            const fnMatch = sql.match(fnRegex)
            expect(fnMatch).not.toBeNull()
            
            const fnBody = fnMatch![0]
            
            // Every table alias in a JOIN must have dual-flag filter
            if (fnBody.includes('rel_user_roles')) {
                expect(fnBody).toContain('ur._upl_deleted = false')
                expect(fnBody).toContain('ur._app_deleted = false')
            }
            if (fnBody.includes('cat_roles')) {
                expect(fnBody).toContain('r._upl_deleted = false')
                expect(fnBody).toContain('r._app_deleted = false')
            }
            if (fnBody.includes('rel_role_permissions')) {
                expect(fnBody).toContain('rp._upl_deleted = false')
                expect(fnBody).toContain('rp._app_deleted = false')
            }
        })

        it(`${fnName}() sets explicit search_path`, () => {
            const sql = createAdminSchemaMigrationDefinition.up
                .map(s => s.sql).join('\n')
            
            expect(sql).toContain(`SET search_path = admin`)
        })
    }
})
```

#### 10.4. Integration tests — Bootstrap metadata verification

```typescript
// packages/universo-migrations-platform/base/src/__tests__/bootstrapMetadata.test.ts
describe('bootstrapSystemAppStructureMetadata', () => {
    it('populates _app_objects for all admin business tables', async () => {
        // After bootstrap, query admin._app_objects
        const result = await knex('admin._app_objects')
            .select('codename', 'kind', 'table_name')
            .where('_upl_deleted', false)

        expect(result).toEqual(expect.arrayContaining([
            expect.objectContaining({ codename: 'instances', table_name: 'cfg_instances' }),
            expect.objectContaining({ codename: 'roles', table_name: 'cat_roles' }),
            expect.objectContaining({ codename: 'role_permissions', table_name: 'rel_role_permissions' }),
            expect.objectContaining({ codename: 'user_roles', table_name: 'rel_user_roles' }),
            expect.objectContaining({ codename: 'locales', table_name: 'cfg_locales' }),
            expect.objectContaining({ codename: 'settings', table_name: 'cfg_settings' }),
        ]))
    })

    it('populates _app_attributes with correct column names', async () => {
        const roleObject = await knex('admin._app_objects')
            .where({ codename: 'roles', _upl_deleted: false }).first()

        const attributes = await knex('admin._app_attributes')
            .where({ object_id: roleObject.id, _upl_deleted: false })
            .orderBy('sort_order')

        expect(attributes.map(a => a.column_name)).toContain('codename')
        expect(attributes.map(a => a.column_name)).toContain('name')
        expect(attributes.map(a => a.column_name)).toContain('is_superuser')
        expect(attributes.map(a => a.data_type)).toContain('STRING')
        expect(attributes.map(a => a.data_type)).toContain('BOOLEAN')
    })
})
```

#### 10.5. Structural parity tests — Fixed vs Dynamic schemas

```typescript
// packages/universo-migrations-platform/base/src/__tests__/schemaParity.test.ts
describe('fixed schema structural parity with dynamic app schemas', () => {
    const requiredUplColumns = [
        '_upl_created_at', '_upl_created_by', '_upl_updated_at', '_upl_updated_by',
        '_upl_version', '_upl_archived', '_upl_archived_at', '_upl_archived_by',
        '_upl_deleted', '_upl_deleted_at', '_upl_deleted_by', '_upl_purge_after',
        '_upl_locked', '_upl_locked_at', '_upl_locked_by', '_upl_locked_reason'
    ]

    const requiredAppColumns = [
        '_app_published', '_app_published_at', '_app_published_by',
        '_app_archived', '_app_archived_at', '_app_archived_by',
        '_app_deleted', '_app_deleted_at', '_app_deleted_by',
        '_app_owner_id', '_app_access_level'
    ]

    const systemMetadataTables = [
        '_app_objects', '_app_attributes', '_app_migrations', '_app_settings'
    ]

    for (const schema of ['admin', 'profiles', 'metahubs', 'applications']) {
        describe(`${schema} schema`, () => {
            it('has all required system metadata tables', async () => {
                const tables = await knex.raw(`
                    SELECT table_name FROM information_schema.tables
                    WHERE table_schema = '${schema}'
                    AND table_name LIKE '\\_%'
                    ORDER BY table_name
                `)
                const tableNames = tables.rows.map(r => r.table_name)
                for (const t of systemMetadataTables) {
                    expect(tableNames).toContain(t)
                }
            })

            it('business tables have full _upl_* system fields', async () => {
                const businessTables = await knex.raw(`
                    SELECT table_name FROM information_schema.tables
                    WHERE table_schema = '${schema}'
                    AND table_name NOT LIKE '\\_%'
                `)
                for (const { table_name } of businessTables.rows) {
                    const columns = await knex.raw(`
                        SELECT column_name FROM information_schema.columns
                        WHERE table_schema = '${schema}' AND table_name = '${table_name}'
                    `)
                    const colNames = columns.rows.map(r => r.column_name)
                    for (const col of requiredUplColumns) {
                        expect(colNames).toContain(col)
                    }
                }
            })

            it('business tables have full _app_* system fields', async () => {
                const businessTables = await knex.raw(`
                    SELECT table_name FROM information_schema.tables
                    WHERE table_schema = '${schema}'
                    AND table_name NOT LIKE '\\_%'
                `)
                for (const { table_name } of businessTables.rows) {
                    const columns = await knex.raw(`
                        SELECT column_name FROM information_schema.columns
                        WHERE table_schema = '${schema}' AND table_name = '${table_name}'
                    `)
                    const colNames = columns.rows.map(r => r.column_name)
                    for (const col of requiredAppColumns) {
                        expect(colNames).toContain(col)
                    }
                }
            })
        })
    }
})
```

#### 10.6. Frontend component tests

Update existing test suites to verify they work with the new API response shapes:

- `ApplicationList.test.tsx` — verify list renders correctly
- `MetahubList.test.tsx` — verify `_mhb_*` references replaced with `_app_*`
- `ConnectorList.test.tsx` — verify unchanged (already uses `_app_*`)
- `ApplicationMigrationGuard.test.tsx` — verify guard gates work
- `MetahubMigrationGuard.test.tsx` — verify guard gates work

#### 10.7. End-to-end acceptance scenario (manual verification)

After all code changes, run through:

1. Fresh DB reset in Supabase
2. `pnpm build` — green
3. `pnpm start` — server starts, bootstrap completes
4. Login / register new user
5. Verify `admin` schema: `_app_objects` populated, all tables have system fields
6. Verify `profiles` schema: profile created with system fields via trigger
7. Create metahub → verify `metahubs._app_objects` populated
8. Create entities in metahub branch
9. Publish → create publication/version
10. Create application → create connector → sync
11. Verify dynamic app schema has same structural model as fixed schemas
12. Navigate all current UI views without errors

---

### Phase 11: Update memory-bank documentation

**Goal**: Synchronize all memory-bank files with the new state.

- `tasks.md` — update with final completion status
- `progress.md` — add entry for structural convergence
- `activeContext.md` — reflect current state
- `systemPatterns.md` — update three-level system fields description to note that platform schemas now use `_app_*`
- `techContext.md` — update if needed

---

## Execution Order Summary

| # | Phase | Blocked by | Est. complexity |
|---|-------|-----------|-----------------|
| 0 | Freeze baseline & acceptance contract | None | Low |
| 1 | Clean up reconcile migrations + fold incremental | None | Low-Medium |
| 2 | Rewrite admin schema SQL + stores + ALL SECURITY DEFINER functions | Phase 5 (utility) | High (5 functions × 3 versions) |
| 3 | Rewrite profiles schema SQL + stores | Phase 5 (utility) | Medium |
| 4 | Rewrite metahubs schema SQL + stores + types + aliases | Phase 5 (utility) | High (most tables) |
| 5 | Add string-based SQL helpers to existing utility module | None | Low |
| 6 | Verify & update systemAppDefinition manifests | Phases 2-4 | Low-Medium |
| 7 | Update frontend API contracts + admin-frontend snake_case fix | Phases 2-4 | Medium |
| 8 | Verify bootstrap metadata | Phases 2-4, 6 | Low |
| 9 | Remove dead code + orphaned files + verification grep | Phases 1-4 | Low |
| 10 | Deep test system (incl. 5 SECURITY DEFINER function tests) | Phases 1-9 | High |
| 11 | Update memory-bank | Phase 10 | Low |

**Recommended execution sequence:**
1. Phase 0 (baseline freeze) — snapshot before any changes
2. Phase 5 (utility) — unblocks schema phases
3. Phase 1 (cleanup + fold) — reduces noise, removes duplicates
4. Phase 2 (admin) — high priority due to SECURITY DEFINER bug fix
5. Phase 3 (profiles) — simplest schema (1 table)
6. Phase 4 (metahubs) — most complex (7 tables, RLS, types, aliases)
7. Phase 6 (manifests) — verify existing, update where needed
8. Phase 7 (frontend) — type updates, admin-frontend anomaly fix
9. Phase 8 (bootstrap verification)
10. Phase 9 (dead code cleanup + verification grep)
11. Phase 10 (tests)
12. Phase 11 (docs)

---

## Potential Challenges

1. **`admin.has_permission()` function BUG** — Current version only filters `rp._upl_deleted` on `rel_role_permissions`, missing dual-flag predicates on `cat_roles` and `rel_user_roles`. Must be fixed atomically with column changes. This is a **security-critical bug fix**.

2. **ALL 5 SECURITY DEFINER functions (15 definitions)** — Each must be audited for dual-flag predicates on every joined table. Since they run as the function owner (bypassing RLS), incorrect filters mean deleted rows are visible. Two functions (`has_permission`, `has_admin_permission`) need an additional JOIN to `cat_roles` to enable filtering. See Phase 2.3 for complete inventory.

3. **REVOKE/GRANT for SECURITY DEFINER functions** — Currently no explicit `REVOKE ALL ... GRANT EXECUTE` after function creation. This is a known security hardening gap. Flagged as **future tech debt** — not blocking this convergence but should be addressed in a follow-up security hardening pass.

4. **Profile auto-creation trigger** — Fires on every user registration via Supabase Auth. Must correctly set system fields or the profile will be created without them.

5. **Metahubs stores have the most SQL** — 7 tables with complex joins, RLS policies, and partial indexes. This is the highest-risk phase.

6. **Cross-package soft-delete joins** — `applications-backend` joins `metahubs` tables. After convergence, cross-schema joins must use consistent dual-flag predicates. The existing COALESCE wrapping in `applications-backend` must be removed (all columns are `NOT NULL DEFAULT false`).

7. **Frontend type breakage** — If any frontend code explicitly references `_mhb_deleted` or similar columns, TypeScript will catch it at build time. The admin-frontend snake_case anomaly (`created_at` instead of `createdAt`) requires careful migration.

8. **DDL timeout on Supabase pooler** — Large migration SQL blocks (especially the admin schema with 5 functions × 3 versions = 15 CREATE OR REPLACE FUNCTION statements) may hit statement timeout limits. Consider splitting into multiple migration steps or setting `statement_timeout` explicitly for the migration session.

---

## Files Changed Summary (Estimated)

| Package | Files touched | Nature of change |
|---|---|---|
| `@universo/utils` | 1-2 | Extend `softDelete.ts` with `activeAppRowCondition`, `softDeleteSetClause` string helpers; `systemFields.ts` unchanged |
| `@universo/admin-backend` | ~10 | SQL migration (rewrite), 5 SECURITY DEFINER functions × 3 versions (dual-flag fix), 4 stores, routes, systemAppDefinition |
| `@universo/profile-backend` | ~5 | SQL migration, store, systemAppDefinition |
| `@universo/auth-backend` | ~2 | Profile INSERT/UPDATE queries |
| `@universo/metahubs-backend` | ~14 | SQL migration, 4+ stores, query helpers, `MhbSystemFields` → `AppSystemFields` type, SQL aliases, RLS, systemAppDefinition |
| `@universo/applications-backend` | ~6 | SQL migration (fix `rel_connector_publications` missing fields), cross-schema join updates, `COALESCE` removal, systemAppDefinition verification |
| `@universo/migrations-platform` | ~5 | Remove legacy inspection, update bootstrap validation |
| `@universo/migrations-core` | ~1 | Update capability resolution if needed |
| `@universo/types` | ~2 | Update shared row/response types |
| `@universo/metahubs-frontend` | ~3 | Type updates for `_mhb_*` → `_app_*` |
| `@universo/applications-frontend` | ~1 | Minimal (already correct) |
| `@universo/admin-frontend` | ~3 | Row type updates, `created_at`/`updated_at` → `createdAt`/`updatedAt` |
| `@universo/profile-frontend` | ~1 | Row type updates |
| Tests (new) | ~20+ | Unit (mock executor), SECURITY DEFINER SQL analysis, integration, parity tests |

**Total: ~75-85 files**
