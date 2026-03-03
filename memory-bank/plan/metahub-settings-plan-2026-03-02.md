# Plan: Metahub Settings Section

> **Date**: 2026-03-02
> **Complexity**: Level 3 (multi-domain feature: backend + frontend + types + validation + i18n)
> **Feature**: "Settings" page for Metahubs — tabbed UI with codename style, entity defaults, general options

---

## Overview

Add a full "Settings" section to the Metahub designer. The section reads/writes key-value pairs in the existing `_mhb_settings` system table (per-branch schema). The UI will use MUI Tabs to group settings into 5 tabs: **Основное (General), Общие (Common), Хабы (Hubs), Каталоги (Catalogs), Перечисления (Enumerations)**. The centerpiece feature is **Codename Style** — switching between `kebab-case` (default) and `1C:Enterprise PascalCase` (Cyrillic+Latin).

---

## Table of Contents

1. [DB Schema & Existing State](#1-db-schema--existing-state)
2. [Settings Registry (Types)](#2-settings-registry-types)
3. [Backend: MetahubSettingsService](#3-backend-metahubsettingsservice)
4. [Backend: settingsRoutes.ts](#4-backend-settingsroutests)
5. [Backend: Integration in router.ts](#5-backend-integration-in-routerts)
6. [Codename Style: Validation Extension](#6-codename-style-validation-extension)
7. [Template Seed Update](#7-template-seed-update)
8. [Frontend: Settings API Client](#8-frontend-settings-api-client)
9. [Frontend: Query Keys & Hooks](#9-frontend-query-keys--hooks)
10. [Frontend: SettingsPage UI](#10-frontend-settingspage-ui)
11. [Frontend: Route & Menu Registration](#11-frontend-route--menu-registration)
12. [Frontend: i18n Keys](#12-frontend-i18n-keys)
13. [Integration: Codename Validation Reads Settings](#13-integration-codename-validation-reads-settings)
14. [Integration: Entity-Level Settings Enforcement](#14-integration-entity-level-settings-enforcement)
15. [Implementation Checklist](#15-implementation-checklist)
16. [Potential Challenges](#16-potential-challenges)

---

## 1. DB Schema & Existing State

### Current _mhb_settings Table (28 columns)

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | `uuid_generate_v7()` | PK |
| `key` | varchar(100) | — | UNIQUE constraint |
| `value` | jsonb | `'{}'::jsonb` | Flexible value storage |
| `_upl_created_at` | timestamptz | `CURRENT_TIMESTAMP` | Platform audit |
| `_upl_created_by` | uuid | null | |
| `_upl_updated_at` | timestamptz | `CURRENT_TIMESTAMP` | |
| `_upl_updated_by` | uuid | null | |
| `_upl_version` | integer | `1` | Optimistic locking |
| `_upl_archived` | boolean | `false` | |
| `_upl_archived_at/by` | timestamptz/uuid | null | |
| `_upl_deleted` | boolean | `false` | Soft delete (platform) |
| `_upl_deleted_at/by` | timestamptz/uuid | null | |
| `_upl_purge_after` | timestamptz | null | TTL |
| `_upl_locked` | boolean | `false` | |
| `_upl_locked_at/by/reason` | various | null | |
| `_mhb_published` | boolean | `true` | Metahub publish flag |
| `_mhb_published_at/by` | timestamptz/uuid | null | |
| `_mhb_archived` | boolean | `false` | |
| `_mhb_archived_at/by` | timestamptz/uuid | null | |
| `_mhb_deleted` | boolean | `false` | Soft delete (metahub) |
| `_mhb_deleted_at/by` | timestamptz/uuid | null | |

### Existing Seed Data (from basic.template.ts)

```
general.language = { _value: "en" }
general.timezone = { _value: "UTC" }
```

### Key Format Convention

Dot-notation grouping: `{tab}.{setting}`, e.g.:
- `general.language`
- `general.timezone`
- `general.codenameStyle`
- `catalogs.allowCopy`
- `catalogs.allowDelete`
- `hubs.allowCopy`
- `enumerations.allowDelete`

---

## 2. Settings Registry (Types)

**File**: `packages/universo-types/base/src/common/metahubs.ts`

Add a typed settings registry so both backend and frontend know all possible settings, their types, defaults, and which tab they belong to.

### New Types

```typescript
// ═══════════════════════════════════════
// Metahub Settings Types
// ═══════════════════════════════════════

/** Codename naming styles supported by the platform. */
export type CodenameStyle = 'kebab-case' | '1c-pascal-case'

/** Tab groups for the Settings UI. */
export type SettingsTab = 'general' | 'common' | 'hubs' | 'catalogs' | 'enumerations'

/** Value type discriminator for settings. */
export type SettingValueType = 'string' | 'boolean' | 'select' | 'multiselect' | 'number'

/** Individual setting definition in the registry. */
export interface SettingDefinition {
    /** Dot-notation key stored in _mhb_settings.key */
    key: string
    /** Which tab this setting belongs to */
    tab: SettingsTab
    /** Value type for UI rendering */
    valueType: SettingValueType
    /** Default value (used when setting doesn't exist in DB) */
    defaultValue: unknown
    /** For 'select' / 'multiselect' type — list of allowed values */
    options?: readonly string[]
    /** Sort order within its tab */
    sortOrder: number
}

/**
 * Shape of a setting row returned by the API.
 * Matches _mhb_settings table structure.
 */
export interface MetahubSettingRow {
    id: string
    key: string
    value: Record<string, unknown>
    _upl_version: number
    _upl_updated_at: string
    _upl_updated_by: string | null
}

/**
 * Bulk update payload: array of { key, value } pairs.
 * Backend will upsert (insert if missing, update if exists).
 */
export interface SettingsUpdatePayload {
    settings: Array<{
        key: string
        value: Record<string, unknown>
    }>
}
```

### Settings Registry (shared constant)

```typescript
/**
 * All known metahub settings with their metadata.
 * Single source of truth for both backend validation and frontend UI rendering.
 */
export const METAHUB_SETTINGS_REGISTRY: readonly SettingDefinition[] = [
    // ── General ──
    // NOTE: `general.language` = UI language for the metahub designer interface.
    // `common.defaultLocale` = default locale for *content* (entity names, descriptions).
    // They may coincide but serve different purposes, so both are kept.
    {
        key: 'general.language',
        tab: 'general',
        valueType: 'select',
        defaultValue: 'en',
        options: ['en', 'ru'] as const,
        sortOrder: 1
    },
    {
        key: 'general.timezone',
        tab: 'general',
        valueType: 'select',
        defaultValue: 'UTC',
        options: ['UTC', 'Europe/Moscow', 'Asia/Tokyo', 'America/New_York', 'Europe/London'] as const,
        sortOrder: 2
    },
    {
        key: 'general.codenameStyle',
        tab: 'general',
        valueType: 'select',
        defaultValue: 'kebab-case',
        options: ['kebab-case', '1c-pascal-case'] as const,
        sortOrder: 3
    },

    // ── Common ──
    {
        key: 'common.defaultLocale',
        tab: 'common',
        valueType: 'select',
        defaultValue: 'en',
        options: ['en', 'ru'] as const,
        sortOrder: 1
    },

    // ── Hubs ──
    {
        key: 'hubs.allowCopy',
        tab: 'hubs',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 1
    },
    {
        key: 'hubs.allowDelete',
        tab: 'hubs',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 2
    },

    // ── Catalogs ──
    {
        key: 'catalogs.allowCopy',
        tab: 'catalogs',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 1
    },
    {
        key: 'catalogs.allowDelete',
        tab: 'catalogs',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 2
    },
    {
        key: 'catalogs.attributeCodenameScope',
        tab: 'catalogs',
        valueType: 'select',
        defaultValue: 'per-level',
        options: ['per-level', 'global'] as const,
        sortOrder: 3
    },
    {
        key: 'catalogs.allowedAttributeTypes',
        tab: 'catalogs',
        valueType: 'multiselect',
        defaultValue: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'],
        options: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'] as const,
        sortOrder: 4
    },

    // ── Enumerations ──
    {
        key: 'enumerations.allowCopy',
        tab: 'enumerations',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 1
    },
    {
        key: 'enumerations.allowDelete',
        tab: 'enumerations',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 2
    },
    {
        key: 'enumerations.allowedValueTypes',
        tab: 'enumerations',
        valueType: 'multiselect',
        defaultValue: ['STRING', 'NUMBER', 'BOOLEAN'],
        options: ['STRING', 'NUMBER', 'BOOLEAN'] as const,
        sortOrder: 3
    }
] as const

/** Helper to get settings for a specific tab. */
export const getSettingsForTab = (tab: SettingsTab): SettingDefinition[] =>
    METAHUB_SETTINGS_REGISTRY.filter(s => s.tab === tab).sort((a, b) => a.sortOrder - b.sortOrder)

/** Helper to get a setting definition by key. */
export const getSettingDefinition = (key: string): SettingDefinition | undefined =>
    METAHUB_SETTINGS_REGISTRY.find(s => s.key === key)
```

---

## 3. Backend: MetahubSettingsService

**File**: `packages/metahubs-backend/base/src/domains/settings/services/MetahubSettingsService.ts`

Follows the `MetahubObjectsService` pattern — uses `MetahubSchemaService` for schema resolution and Knex for queries.

```typescript
import { KnexClient } from '../../ddl'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { incrementVersion } from '../../../utils/optimisticLock'
import { METAHUB_SETTINGS_REGISTRY, getSettingDefinition } from '@universo/types'

const TABLE = '_mhb_settings'

export class MetahubSettingsService {
    constructor(private schemaService: MetahubSchemaService) {}

    private get knex() {
        return KnexClient.getInstance()
    }

    /**
     * Get all settings (non-deleted).
     * Merges DB rows with registry defaults for keys not yet in DB.
     */
    async findAll(metahubId: string, userId?: string): Promise<any[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.knex
            .withSchema(schemaName)
            .from(TABLE)
            .where({ _upl_deleted: false, _mhb_deleted: false })
            .select('*')
            .orderBy('key', 'asc')
    }

    /**
     * Get a single setting by key.
     */
    async findByKey(metahubId: string, key: string, userId?: string): Promise<any | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.knex
            .withSchema(schemaName)
            .from(TABLE)
            .where({ key, _upl_deleted: false, _mhb_deleted: false })
            .first()
    }

    /**
     * Upsert a single setting (insert or update).
     * Returns the upserted row.
     */
    async upsert(
        metahubId: string,
        key: string,
        value: Record<string, unknown>,
        userId?: string
    ): Promise<any> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await this.findByKey(metahubId, key, userId)

        if (existing) {
            return incrementVersion(this.knex, schemaName, TABLE, existing.id, {
                value,
                _upl_updated_at: new Date(),
                _upl_updated_by: userId ?? null
            })
        }

        const now = new Date()
        const [created] = await this.knex
            .withSchema(schemaName)
            .into(TABLE)
            .insert({
                key,
                value,
                _upl_created_at: now,
                _upl_created_by: userId ?? null,
                _upl_updated_at: now,
                _upl_updated_by: userId ?? null,
                _upl_version: 1,
                _upl_archived: false,
                _upl_deleted: false,
                _upl_locked: false,
                _mhb_published: true,
                _mhb_archived: false,
                _mhb_deleted: false
            })
            .returning('*')
        return created
    }

    /**
     * Bulk upsert: update multiple settings in a single transaction.
     * Validates keys against METAHUB_SETTINGS_REGISTRY.
     * All-or-nothing: if any upsert fails, the entire batch is rolled back.
     */
    async bulkUpsert(
        metahubId: string,
        settings: Array<{ key: string; value: Record<string, unknown> }>,
        userId?: string
    ): Promise<any[]> {
        // Validate all keys are known (before starting transaction)
        const unknownKeys = settings
            .map(s => s.key)
            .filter(k => !getSettingDefinition(k))
        if (unknownKeys.length > 0) {
            throw new Error(`Unknown setting keys: ${unknownKeys.join(', ')}`)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const now = new Date()

        return this.knex.transaction(async (trx) => {
            const results: any[] = []
            for (const setting of settings) {
                const existing = await trx
                    .withSchema(schemaName)
                    .from(TABLE)
                    .where({ key: setting.key, _upl_deleted: false, _mhb_deleted: false })
                    .first()

                if (existing) {
                    const [updated] = await trx
                        .withSchema(schemaName)
                        .from(TABLE)
                        .where({ id: existing.id })
                        .update({
                            value: setting.value,
                            _upl_updated_at: now,
                            _upl_updated_by: userId ?? null,
                            _upl_version: trx.raw('_upl_version + 1')
                        })
                        .returning('*')
                    results.push(updated)
                } else {
                    const [created] = await trx
                        .withSchema(schemaName)
                        .into(TABLE)
                        .insert({
                            key: setting.key,
                            value: setting.value,
                            _upl_created_at: now,
                            _upl_created_by: userId ?? null,
                            _upl_updated_at: now,
                            _upl_updated_by: userId ?? null,
                            _upl_version: 1,
                            _upl_archived: false,
                            _upl_deleted: false,
                            _upl_locked: false,
                            _mhb_published: true,
                            _mhb_archived: false,
                            _mhb_deleted: false
                        })
                        .returning('*')
                    results.push(created)
                }
            }
            return results
        })
    }

    /**
     * Reset a setting to its default value (delete from DB).
     * The frontend will fall back to the registry default.
     */
    async resetToDefault(metahubId: string, key: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        await this.knex
            .withSchema(schemaName)
            .from(TABLE)
            .where({ key })
            .update({
                _mhb_deleted: true,
                _mhb_deleted_at: new Date(),
                _mhb_deleted_by: userId ?? null,
                _upl_updated_at: new Date(),
                _upl_updated_by: userId ?? null
            })
    }
}
```

### Key Design Decisions

1. **Upsert pattern**: Settings may not exist in DB yet (only seed values from template). `upsert` handles both insert and update.
2. **Registry validation**: `bulkUpsert` rejects unknown keys. This prevents typos and ensures type safety.
3. **Soft delete for reset**: "Reset to default" soft-deletes the row. Frontend falls back to `METAHUB_SETTINGS_REGISTRY` default.
4. **No pagination**: Settings are a small, finite set (<50 keys). Simple `findAll` is sufficient.

---

## 4. Backend: settingsRoutes.ts

**File**: `packages/metahubs-backend/base/src/domains/settings/routes/settingsRoutes.ts`

Follows the `catalogsRoutes.ts` pattern — factory function, service instantiation per request, Zod validation.

```typescript
import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { Metahub } from '../../../database/entities/Metahub'
import { getRequestManager } from '../../../utils'
import { ensureMetahubAccess } from '../../shared/guards'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubSettingsService } from '../services/MetahubSettingsService'
import { METAHUB_SETTINGS_REGISTRY } from '@universo/types'

type RequestWithUser = Request & { user?: { id?: string; sub?: string } }

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as RequestWithUser).user
    return user?.id ?? user?.sub
}

const settingsUpdateSchema = z.object({
    settings: z.array(z.object({
        key: z.string().min(1).max(100),
        value: z.record(z.unknown())
    })).min(1).max(50)
})

export function createSettingsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const services = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        const schemaService = new MetahubSchemaService(ds, undefined, manager)
        const settingsService = new MetahubSettingsService(schemaService)
        return { settingsService }
    }

    // GET /metahub/:metahubId/settings
    // Returns all settings merged with registry defaults
    router.get(
        '/metahub/:metahubId/settings',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const userId = resolveUserId(req)
            const ds = getDataSource()
            const metahub = await ensureMetahubAccess(ds, metahubId, userId)
            const { settingsService } = services(req)

            const dbRows = await settingsService.findAll(metahubId, userId)

            // Merge with registry defaults
            const dbMap = new Map(dbRows.map((r: any) => [r.key, r]))
            const merged = METAHUB_SETTINGS_REGISTRY.map(def => {
                const dbRow = dbMap.get(def.key)
                if (dbRow) {
                    return {
                        key: def.key,
                        value: dbRow.value,
                        id: dbRow.id,
                        version: dbRow._upl_version,
                        updatedAt: dbRow._upl_updated_at,
                        isDefault: false
                    }
                }
                return {
                    key: def.key,
                    value: { _value: def.defaultValue },
                    id: null,
                    version: 0,
                    updatedAt: null,
                    isDefault: true
                }
            })

            res.json({ settings: merged, registry: METAHUB_SETTINGS_REGISTRY })
        })
    )

    // PUT /metahub/:metahubId/settings
    // Bulk upsert settings (transactional)
    router.put(
        '/metahub/:metahubId/settings',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId } = req.params
            const userId = resolveUserId(req)
            const ds = getDataSource()
            const metahub = await ensureMetahubAccess(ds, metahubId, userId)

            const parsed = settingsUpdateSchema.safeParse(req.body)
            if (!parsed.success) {
                res.status(400).json({ error: 'Invalid settings payload', details: parsed.error.issues })
                return
            }

            const { settingsService } = services(req)
            const results = await settingsService.bulkUpsert(metahubId, parsed.data.settings, userId)
            res.json({ settings: results })
        })
    )

    // GET /metahub/:metahubId/setting/:key
    // Get a single setting (singular path for single resource)
    router.get(
        '/metahub/:metahubId/setting/:key',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, key } = req.params
            const userId = resolveUserId(req)
            const ds = getDataSource()
            await ensureMetahubAccess(ds, metahubId, userId)
            const { settingsService } = services(req)

            const row = await settingsService.findByKey(metahubId, key, userId)
            if (!row) {
                // Return default from registry
                const def = METAHUB_SETTINGS_REGISTRY.find(s => s.key === key)
                if (!def) {
                    res.status(404).json({ error: `Unknown setting key: ${key}` })
                    return
                }
                res.json({ key: def.key, value: { _value: def.defaultValue }, isDefault: true })
                return
            }
            res.json({ key: row.key, value: row.value, isDefault: false, version: row._upl_version })
        })
    )

    // DELETE /metahub/:metahubId/setting/:key
    // Reset setting to default (singular path for single resource)
    router.delete(
        '/metahub/:metahubId/setting/:key',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, key } = req.params
            const userId = resolveUserId(req)
            const ds = getDataSource()
            await ensureMetahubAccess(ds, metahubId, userId)
            const { settingsService } = services(req)

            await settingsService.resetToDefault(metahubId, key, userId)
            res.json({ message: 'Setting reset to default', key })
        })
    )

    return router
}
```

### API Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/metahub/:metahubId/settings` | Get all settings (merged with defaults) |
| `PUT` | `/metahub/:metahubId/settings` | Bulk update settings (transactional) |
| `GET` | `/metahub/:metahubId/setting/:key` | Get single setting (singular) |
| `DELETE` | `/metahub/:metahubId/setting/:key` | Reset setting to default (singular) |

> **URL convention**: plural `/settings` for the collection, singular `/setting/:key` for a specific resource — matching the project's established pattern (e.g. `/metahub/:id/publications` vs `/metahub/:id/publication/:id`).

> **Pattern notes**: Uses `Router({ mergeParams: true })`, `router.use(ensureAuth)`, and `asyncHandler` wrapper — matching `catalogsRoutes.ts` exactly.

---

## 5. Backend: Integration in router.ts

**File**: `packages/metahubs-backend/base/src/domains/router.ts`

### Changes

1. Import `createSettingsRoutes` from `./settings/routes/settingsRoutes`
2. Register: `router.use('/', createSettingsRoutes(ensureAuth, getDataSource, read, write))`
3. Export: `export { createSettingsRoutes } from './settings/routes/settingsRoutes'`

Place it after layouts and before templates (logical grouping — settings belong to the "infrastructure" group along with migrations and branches).

---

## 6. Codename Style: Validation Extension

**File**: `packages/universo-utils/base/src/validation/codename.ts`

### Changes

Add parallel validation for 1C:Enterprise PascalCase codenames. Keep existing kebab-case as default. The style selection comes from settings.

```typescript
// Existing (unchanged):
export const CODENAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// NEW: 1C:Enterprise PascalCase pattern
// Rules (from 1C standard std474):
// - Starts with uppercase Latin or Cyrillic letter (PascalCase)
// - Then any mix of Latin, Cyrillic (upper/lower), digits, underscores
// - No spaces, no hyphens
// - Max 80 chars (std474 п.2.3)
// - No letter "ё" / "Ё" (std474 п.4)
// - Note: In Unicode, А-Я = U+0410–U+042F (Ё=U+0401 is outside this range)
//   and а-я = U+0430–U+044F (ё=U+0451 is outside this range),
//   so simple ranges А-Я and а-я correctly exclude ё/Ё.
export const CODENAME_1C_PATTERN = /^[A-ZА-Я][A-ZА-Яa-zа-яA-Za-z0-9_]{0,79}$/

/** Check if a codename is valid for 1C PascalCase style. */
export const isValid1CCodename = (value: string): boolean =>
    CODENAME_1C_PATTERN.test(value) && !value.includes('ё') && !value.includes('Ё')

/**
 * Validate codename against the specified style.
 * @param value - Codename to validate
 * @param style - 'kebab-case' (default) or '1c-pascal-case'
 */
export const isValidCodenameForStyle = (
    value: string,
    style: 'kebab-case' | '1c-pascal-case' = 'kebab-case'
): boolean => {
    if (style === '1c-pascal-case') return isValid1CCodename(value)
    return isValidCodename(value)
}

/**
 * Normalize a string to 1C PascalCase format.
 * Splits on spaces/hyphens/underscores, capitalizes first letter of each word.
 * Transliterates if needed (configurable).
 */
export const normalize1CCodename = (value: string): string =>
    value
        .trim()
        .split(/[\s\-_]+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')
        .replace(/[ёЁ]/g, match => match === 'ё' ? 'е' : 'Е')
        .replace(/[^A-ZА-ЯA-Za-zа-яA-Za-z0-9_]/g, '')
        .slice(0, 80)

/**
 * Normalize codename per style.
 */
export const normalizeCodenameForStyle = (
    value: string,
    style: 'kebab-case' | '1c-pascal-case' = 'kebab-case'
): string => {
    if (style === '1c-pascal-case') return normalize1CCodename(value)
    return normalizeCodename(value)
}
```

### Backend Integration

The codename validation functions are called in 6+ route files. We need a way for these routes to know the current codename style. Two approaches:

**Approach A (recommended): Read setting at validation time**
- Add optional `codenameStyle` parameter to route handlers
- Fetch `general.codenameStyle` from `_mhb_settings` once per request and cache in request context
- Pass style to `isValidCodenameForStyle()`

**Approach B: Middleware**
- Create `loadCodenameStyleMiddleware` that reads the setting and attaches `req.codenameStyle`
- All routes that validate codenames use `req.codenameStyle`

We recommend **Approach A** because it's explicit and doesn't require middleware refactoring.

### Implementation Pattern for Route Integration

```typescript
// In catalogsRoutes.ts (and similar routes):
const getCodenameStyle = async (settingsService: MetahubSettingsService, metahubId: string, userId?: string) => {
    const row = await settingsService.findByKey(metahubId, 'general.codenameStyle', userId)
    return (row?.value?._value as string) || 'kebab-case'
}

// In create handler:
const codenameStyle = await getCodenameStyle(settingsService, metahubId, userId)
if (!isValidCodenameForStyle(codename, codenameStyle as CodenameStyle)) {
    return res.status(400).json({ error: `Invalid codename for style "${codenameStyle}"` })
}
```

---

## 7. Template Seed Update

**File**: `packages/metahubs-backend/base/src/domains/templates/data/basic.template.ts`

### Changes

Add `general.codenameStyle` to the seed settings:

```typescript
settings: [
    { key: 'general.language', value: { _value: 'en' } },
    { key: 'general.timezone', value: { _value: 'UTC' } },
    { key: 'general.codenameStyle', value: { _value: 'kebab-case' } }
]
```

This ensures every new metahub starts with an explicit codename style.

---

## 8. Frontend: Settings API Client

**File**: `packages/metahubs-frontend/base/src/domains/settings/api/settingsApi.ts`

Follows the existing API client pattern using `createAuthClient`.

```typescript
import { createAuthClient } from '../../shared/api/apiClient'

const api = createAuthClient({ baseURL: '/api/v1' })

export interface SettingResponse {
    key: string
    value: Record<string, unknown>
    id: string | null
    version: number
    updatedAt: string | null
    isDefault: boolean
}

export interface SettingsResponse {
    settings: SettingResponse[]
    registry: Array<{
        key: string
        tab: string
        valueType: string
        defaultValue: unknown
        options?: readonly string[]
        sortOrder: number
    }>
}

export const settingsApi = {
    /** Get all settings merged with defaults. */
    getAll: async (metahubId: string): Promise<SettingsResponse> => {
        const { data } = await api.get(`/metahubs/${metahubId}/settings`)
        return data
    },

    /** Get single setting (singular path). */
    getByKey: async (metahubId: string, key: string) => {
        const { data } = await api.get(`/metahubs/${metahubId}/setting/${key}`)
        return data
    },

    /** Bulk update settings (collection path). */
    update: async (metahubId: string, settings: Array<{ key: string; value: Record<string, unknown> }>) => {
        const { data } = await api.put(`/metahubs/${metahubId}/settings`, { settings })
        return data
    },

    /** Reset a setting to default (singular path). */
    resetToDefault: async (metahubId: string, key: string) => {
        const { data } = await api.delete(`/metahubs/${metahubId}/setting/${key}`)
        return data
    }
}
```

---

## 9. Frontend: Query Keys & Hooks

### Query Keys Extension

**File**: `packages/metahubs-frontend/base/src/domains/shared/queryKeys.ts`

```typescript
// Add to metahubsQueryKeys:

// ============ SETTINGS ============
settings: (metahubId: string) =>
    [...metahubsQueryKeys.detail(metahubId), 'settings'] as const,

settingsList: (metahubId: string) =>
    [...metahubsQueryKeys.settings(metahubId), 'list'] as const,

settingDetail: (metahubId: string, key: string) =>
    [...metahubsQueryKeys.settings(metahubId), 'detail', key] as const,
```

### Cache Invalidation

```typescript
export const invalidateSettingsQueries = {
    all: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.settings(metahubId) }),

    lists: (queryClient: QueryClient, metahubId: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.settingsList(metahubId) }),

    detail: (queryClient: QueryClient, metahubId: string, key: string) =>
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.settingDetail(metahubId, key) })
}
```

### Hooks

**File**: `packages/metahubs-frontend/base/src/domains/settings/hooks/useSettings.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { settingsApi } from '../api/settingsApi'
import { metahubsQueryKeys, invalidateSettingsQueries } from '../../shared/queryKeys'

export const useSettings = () => {
    const { metahubId } = useParams<{ metahubId: string }>()

    return useQuery({
        queryKey: metahubsQueryKeys.settingsList(metahubId!),
        queryFn: () => settingsApi.getAll(metahubId!),
        enabled: !!metahubId,
        staleTime: 5 * 60 * 1000 // 5 min — settings change rarely
    })
}

export const useUpdateSettings = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (settings: Array<{ key: string; value: Record<string, unknown> }>) =>
            settingsApi.update(metahubId!, settings),
        onSuccess: () => {
            invalidateSettingsQueries.all(queryClient, metahubId!)
        }
    })
}

export const useResetSetting = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (key: string) => settingsApi.resetToDefault(metahubId!, key),
        onSuccess: () => {
            invalidateSettingsQueries.all(queryClient, metahubId!)
        }
    })
}
```

---

## 10. Frontend: SettingsPage UI

**File**: `packages/metahubs-frontend/base/src/domains/settings/ui/SettingsPage.tsx`

### Component Structure

```
SettingsPage (reuses existing template-mui components)
├── TemplateMainCard (as MainCard) — page wrapper
│   ├── disableHeader, border={false}, shadow={false}
│   ├── contentSX={{ px: 0, py: 0 }}
│   └── disableContentPadding
├── ViewHeaderMUI (as ViewHeader) — search + title
│   ├── search={true}
│   ├── searchPlaceholder={t('settings.search')}
│   ├── onSearchChange — client-side filter (via useDebouncedSearch)
│   ├── title={t('settings.title')}
│   └── (no ToolbarControls children — no card/list toggle, no "Create" button)
├── MUI Tabs (5 tabs, same pattern as CatalogList/AttributeList)
│   ├── Tab: General (Основное)
│   ├── Tab: Common (Общие)
│   ├── Tab: Hubs (Хабы)
│   ├── Tab: Catalogs (Каталоги)
│   └── Tab: Enumerations (Перечисления)
├── TabPanel (active tab content)
│   └── SettingsList (filtered by search + active tab)
│       └── SettingRow (per setting)
│           ├── Label (i18n'd)
│           ├── Description (i18n'd)
│           ├── Control (Switch/Select/MultiSelect/TextField)
│           └── Reset button (if non-default) — via ConfirmDialog + useConfirm
└── Save button (bulk update via PUT /metahub/:id/settings)
```

### Reused Components from `@universo/template-mui`

| Component | Usage | Import |
|-----------|-------|--------|
| `TemplateMainCard` (as MainCard) | Root page wrapper | `import { TemplateMainCard as MainCard } from '@universo/template-mui'` |
| `ViewHeaderMUI` (as ViewHeader) | Header with search field, Ctrl+F shortcut | `import { ViewHeaderMUI as ViewHeader } from '@universo/template-mui'` |
| `useDebouncedSearch` | Search state hook with debounce | `import { useDebouncedSearch } from '@universo/template-mui'` |
| `ConfirmDialog` + `useConfirm` | "Reset to default" confirmation dialog | `import { ConfirmDialog, useConfirm } from '@universo/template-mui'` |
| `EmptyListState` + `APIEmptySVG` | Empty tab / error state | `import { EmptyListState, APIEmptySVG } from '@universo/template-mui'` |

> **NOT creating new reusable components** — only domain-specific sub-components:
> - `SettingControl.tsx` — renders the appropriate MUI control based on `valueType` (Switch, Select, Multiselect checkboxes, TextField)
> - `CodenameStylePreview.tsx` — live preview of codename format (unique to this feature)

### Key UI Patterns

1. **MainCard wrapper** — `<MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>` (same as CatalogList.tsx)
2. **ViewHeader with search** — `<ViewHeader search title={...} searchPlaceholder={...} onSearchChange={handleSearchChange}>` (following CatalogList/AttributeList pattern)
3. **MUI Tabs** — follows `AttributeList.tsx` pattern with `sx={{ borderBottom: 1, borderColor: 'divider' }}`
4. **Controlled form** — `useState` for modified settings, diff against DB values for "Save" button enablement
5. **Optimistic updates** — show changes immediately, revert on error
6. **Search** — filter settings by label/description text (client-side via `useDebouncedSearch` since <50 items)
7. **Codename Style selector** with live preview showing example codename
8. **Reset confirmation** — `ConfirmDialog` from `@universo/template-mui` for "Reset to default" action

### UI Wireframe (Tab: General)

```
┌──────────────────────────────────────────┐
│ ⚙ Settings                               │
├──────────────────────────────────────────┤
│ [Основное] [Общие] [Хабы] [Каталоги] [Перечисл.]│
├──────────────────────────────────────────┤
│ 🔍 Search settings...                   │
├──────────────────────────────────────────┤
│ Language                                  │
│ Default language for new content         │
│ [English ▼]                              │
│                                          │
│ Timezone                                 │
│ Default timezone for dates               │
│ [UTC ▼]                                  │
│                                          │
│ Codename Style                           │
│ Naming convention for entity codenames   │
│ [kebab-case ▼]                           │
│ Preview: my-catalog-name                 │
│                                          │
│           [Save Changes]                 │
└──────────────────────────────────────────┘
```

### Sub-components

1. **`SettingControl.tsx`** — renders the appropriate MUI control based on `valueType`:
   - `boolean` → `Switch`
   - `select` → `Select` with `MenuItem` for each option
   - `multiselect` → `FormGroup` with `Checkbox` items (for `catalogs.allowedAttributeTypes`)
   - `string` → `TextField`
   - `number` → `TextField` with `type="number"`

2. **`CodenameStylePreview.tsx`** — shows live preview of codename format:
   - kebab-case: `my-catalog-name` (Latin, lowercase, hyphens)
   - 1c-pascal-case: `МойСправочникНаименование` (PascalCase, Cyrillic allowed, first letter uppercase)

---

## 11. Frontend: Route & Menu Registration

### Route Registration

**File**: `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`

Add under `metahub/:metahubId` children:

```tsx
{
    path: 'settings',
    element: <MetahubSettings />
}
```

Add lazy import at top:

```tsx
const MetahubSettings = lazy(() =>
    import('@universo/metahubs-frontend').then(m => ({ default: m.MetahubSettings }))
)
```

### Menu Registration (2 files)

**File 1**: `packages/universo-template-mui/base/src/navigation/menuConfigs.ts`

Add after `access` item in `getMetahubMenuItems`:

```typescript
{
    id: 'metahub-divider-footer',
    type: 'divider'
},
{
    id: 'metahub-settings',
    titleKey: 'settings',
    url: `/metahub/${metahubId}/settings`,
    icon: IconSettings,
    type: 'item'
}
```

Import `IconSettings` from `@tabler/icons-react`.

**File 2**: `packages/metahubs-frontend/base/src/menu-items/metahubDashboard.ts`

Add after `access` item:

```typescript
{
    id: 'settings',
    title: 'menu:settings',
    type: 'item',
    url: '/settings',
    icon: icons.IconSettings,
    breadcrumbs: true
}
```

Import `IconSettings` from `@tabler/icons-react`.

### Export from metahubs-frontend/index.ts

```typescript
export { default as MetahubSettings } from './domains/settings/ui/SettingsPage'
```

---

## 12. Frontend: i18n Keys

### English (`metahubs-frontend/base/src/i18n/locales/en/metahubs.json`)

Add `"settings"` section to the JSON:

```json
"settings": {
    "title": "Settings",
    "tabs": {
        "general": "General",
        "common": "Common",
        "hubs": "Hubs",
        "catalogs": "Catalogs",
        "enumerations": "Enumerations"
    },
    "search": "Search settings...",
    "save": "Save Changes",
    "saved": "Settings saved successfully",
    "resetToDefault": "Reset to default",
    "resetConfirm": "Are you sure you want to reset this setting to its default value?",
    "isDefault": "Default",
    "isCustom": "Custom",
    "keys": {
        "general.language": "Language",
        "general.language.description": "Default language for new content",
        "general.timezone": "Timezone",
        "general.timezone.description": "Default timezone for date/time display",
        "general.codenameStyle": "Codename Style",
        "general.codenameStyle.description": "Naming convention for entity codenames throughout the metahub",
        "common.defaultLocale": "Default Locale",
        "common.defaultLocale.description": "Default locale for new localized content",
        "hubs.allowCopy": "Allow Copy",
        "hubs.allowCopy.description": "Allow copying hubs within this metahub",
        "hubs.allowDelete": "Allow Delete",
        "hubs.allowDelete.description": "Allow deleting hubs from this metahub",
        "catalogs.allowCopy": "Allow Copy",
        "catalogs.allowCopy.description": "Allow copying catalogs within this metahub",
        "catalogs.allowDelete": "Allow Delete",
        "catalogs.allowDelete.description": "Allow deleting catalogs from this metahub",
        "catalogs.attributeCodenameScope": "Attribute Codename Scope",
        "catalogs.attributeCodenameScope.description": "Whether attribute codenames must be unique per nesting level or globally within a catalog",
        "catalogs.allowedAttributeTypes": "Allowed Attribute Types",
        "catalogs.allowedAttributeTypes.description": "Which attribute data types can be used when creating attributes in catalogs",
        "enumerations.allowCopy": "Allow Copy",
        "enumerations.allowCopy.description": "Allow copying enumerations within this metahub",
        "enumerations.allowDelete": "Allow Delete",
        "enumerations.allowDelete.description": "Allow deleting enumerations from this metahub"
    },
    "codenameStyles": {
        "kebab-case": "kebab-case (my-catalog-name)",
        "1c-pascal-case": "1C PascalCase (МойСправочникНаименование)"
    },
    "codenamePreview": {
        "title": "Preview",
        "kebab-case": "my-catalog-name",
        "1c-pascal-case": "МойСправочникНаименование"
    },
    "attributeCodenameScopes": {
        "per-level": "Per nesting level (separate for root and each table attribute)",
        "global": "Global (unique across all attributes in catalog)"
    }
}
```

### Russian (`metahubs-frontend/base/src/i18n/locales/ru/metahubs.json`)

```json
"settings": {
    "title": "Настройки",
    "tabs": {
        "general": "Основное",
        "common": "Общие",
        "hubs": "Хабы",
        "catalogs": "Каталоги",
        "enumerations": "Перечисления"
    },
    "search": "Поиск настроек...",
    "save": "Сохранить изменения",
    "saved": "Настройки сохранены",
    "resetToDefault": "Сбросить по умолчанию",
    "resetConfirm": "Вы уверены, что хотите сбросить эту настройку к значению по умолчанию?",
    "isDefault": "По умолчанию",
    "isCustom": "Изменено",
    "keys": {
        "general.language": "Язык",
        "general.language.description": "Язык по умолчанию для нового контента",
        "general.timezone": "Часовой пояс",
        "general.timezone.description": "Часовой пояс по умолчанию для отображения дат",
        "general.codenameStyle": "Стиль кодовых имён",
        "general.codenameStyle.description": "Соглашение об именовании кодовых имён сущностей в метахабе",
        "common.defaultLocale": "Локаль по умолчанию",
        "common.defaultLocale.description": "Локаль по умолчанию для нового локализованного контента",
        "hubs.allowCopy": "Разрешить копирование",
        "hubs.allowCopy.description": "Разрешить копирование хабов в этом метахабе",
        "hubs.allowDelete": "Разрешить удаление",
        "hubs.allowDelete.description": "Разрешить удаление хабов из этого метахаба",
        "catalogs.allowCopy": "Разрешить копирование",
        "catalogs.allowCopy.description": "Разрешить копирование каталогов в этом метахабе",
        "catalogs.allowDelete": "Разрешить удаление",
        "catalogs.allowDelete.description": "Разрешить удаление каталогов из этого метахаба",
        "catalogs.attributeCodenameScope": "Область уникальности кодового имени атрибута",
        "catalogs.attributeCodenameScope.description": "Должны ли кодовые имена атрибутов быть уникальными на каждом уровне вложенности или глобально во всём каталоге",
        "catalogs.allowedAttributeTypes": "Допустимые типы атрибутов",
        "catalogs.allowedAttributeTypes.description": "Какие типы данных атрибутов можно использовать при создании атрибутов в каталогах",
        "enumerations.allowCopy": "Разрешить копирование",
        "enumerations.allowCopy.description": "Разрешить копирование перечислений в этом метахабе",
        "enumerations.allowDelete": "Разрешить удаление",
        "enumerations.allowDelete.description": "Разрешить удаление перечислений из этого метахаба"
    },
    "codenameStyles": {
        "kebab-case": "kebab-case (my-catalog-name)",
        "1c-pascal-case": "1C ПаскальКейс (МойСправочникНаименование)"
    },
    "codenamePreview": {
        "title": "Предпросмотр",
        "kebab-case": "my-catalog-name",
        "1c-pascal-case": "МойСправочникНаименование"
    },
    "attributeCodenameScopes": {
        "per-level": "По уровню вложенности (раздельно для основных и дочерних в каждой таблице)",
        "global": "Глобально (уникально среди всех атрибутов каталога)"
    }
}
```

### i18n registry update

**File**: `packages/metahubs-frontend/base/src/i18n/index.ts`

Add `settings` to the `MetahubsBundle` interface and `consolidateMetahubsNamespace`.

---

## 13. Integration: Codename Validation Reads Settings

After the settings API is built, we need to update the 6 route files that validate codenames:

| Route File | Entity | Changes |
|------------|--------|---------|
| `metahubsRoutes.ts` | Metahubs | Not affected (metahub codenames are platform-level, always kebab-case) |
| `catalogsRoutes.ts` | Catalogs | Read `general.codenameStyle` setting, pass to `isValidCodenameForStyle()` |
| `hubsRoutes.ts` | Hubs | Same as catalogs |
| `enumerationsRoutes.ts` | Enumerations | Same as catalogs |
| `attributesRoutes.ts` | Attributes | Same as catalogs + read `catalogs.attributeCodenameScope` for uniqueness check + read `catalogs.allowedAttributeTypes` to validate data type |
| `branchesRoutes.ts` | Branches | Not affected (branch codenames are infrastructure, always kebab-case) |

### Shared helper (avoids code duplication)

**File**: `packages/metahubs-backend/base/src/domains/shared/codenameStyleHelper.ts`

```typescript
import { MetahubSettingsService } from '../settings/services/MetahubSettingsService'
import type { CodenameStyle } from '@universo/types'

const DEFAULT_STYLE: CodenameStyle = 'kebab-case'

/**
 * Read the codename style setting for a metahub.
 * Returns 'kebab-case' if not set.
 */
export async function getCodenameStyle(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<CodenameStyle> {
    const row = await settingsService.findByKey(metahubId, 'general.codenameStyle', userId)
    const style = row?.value?._value
    if (style === 'kebab-case' || style === '1c-pascal-case') return style
    return DEFAULT_STYLE
}

/**
 * Read attribute codename uniqueness scope setting.
 * Returns 'per-level' if not set (current default behavior).
 */
export async function getAttributeCodenameScope(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<'per-level' | 'global'> {
    const row = await settingsService.findByKey(metahubId, 'catalogs.attributeCodenameScope', userId)
    const scope = row?.value?._value
    if (scope === 'per-level' || scope === 'global') return scope
    return 'per-level'
}

/**
 * Read allowed attribute types setting.
 * Returns all types if not set.
 */
export async function getAllowedAttributeTypes(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<string[]> {
    const row = await settingsService.findByKey(metahubId, 'catalogs.allowedAttributeTypes', userId)
    const types = row?.value?._value
    if (Array.isArray(types) && types.length > 0) return types
    return ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE']
}
```

### Integration in attributesRoutes.ts

```typescript
// In create/update handler:
const codenameScope = await getAttributeCodenameScope(settingsService, metahubId, userId)
const parentForUniqueness = codenameScope === 'global' ? undefined : parentAttributeId
const existing = await attributesService.findByCodename(metahubId, catalogId, normalizedCodename, parentForUniqueness, userId)

// Validate data type is allowed:
const allowedTypes = await getAllowedAttributeTypes(settingsService, metahubId, userId)
if (!allowedTypes.includes(dataType)) {
    return res.status(400).json({ error: `Attribute data type "${dataType}" is not allowed by metahub settings` })
}
```

---

## 14. Integration: Entity-Level Settings Enforcement

Settings like `catalogs.allowCopy`, `catalogs.allowDelete` need to be checked by the respective route handlers.

### Pattern

In `catalogsRoutes.ts` copy handler:

```typescript
// Before performing copy:
const allowCopy = await settingsService.findByKey(metahubId, 'catalogs.allowCopy', userId)
if (allowCopy && allowCopy.value?._value === false) {
    return res.status(403).json({ error: 'Copying catalogs is disabled in metahub settings' })
}
```

In `catalogsRoutes.ts` delete handler:

```typescript
const allowDelete = await settingsService.findByKey(metahubId, 'catalogs.allowDelete', userId)
if (allowDelete && allowDelete.value?._value === false) {
    return res.status(403).json({ error: 'Deleting catalogs is disabled in metahub settings' })
}
```

### Frontend enforcement

The frontend should also check these settings to hide/disable copy/delete buttons. This can be done via a shared hook:

```typescript
export const useEntityPermissions = (metahubId: string, entityType: 'hubs' | 'catalogs' | 'enumerations') => {
    const { data } = useSettings()
    if (!data) return { allowCopy: true, allowDelete: true }

    const copyKey = `${entityType}.allowCopy`
    const deleteKey = `${entityType}.allowDelete`

    const copySetting = data.settings.find(s => s.key === copyKey)
    const deleteSetting = data.settings.find(s => s.key === deleteKey)

    return {
        allowCopy: copySetting?.value?._value !== false,
        allowDelete: deleteSetting?.value?._value !== false
    }
}
```

---

## 15. Implementation Checklist

### Phase 1: Types & Shared Code
- [ ] Add `CodenameStyle`, `SettingsTab`, `SettingDefinition`, `SettingValueType` (incl. `'multiselect'`), `MetahubSettingRow`, `SettingsUpdatePayload` to `packages/universo-types/base/src/common/metahubs.ts`
- [ ] Add `METAHUB_SETTINGS_REGISTRY` (with `catalogs.attributeCodenameScope`, `catalogs.allowedAttributeTypes`, `enumerations.allowedValueTypes`), `getSettingsForTab`, `getSettingDefinition` to `packages/universo-types/base/src/common/metahubs.ts`
- [ ] Export new types from `packages/universo-types/base/src/index.ts`
- [ ] Add `CODENAME_1C_PATTERN` (`/^[A-ZА-Я][A-ZА-Яa-zа-яA-Za-z0-9_]{0,79}$/`), `isValid1CCodename`, `isValidCodenameForStyle`, `normalize1CCodename`, `normalizeCodenameForStyle` to `packages/universo-utils/base/src/validation/codename.ts`
- [ ] Export new validation functions from `packages/universo-utils/base/src/validation/index.ts`

### Phase 2: Backend Service & Routes
- [ ] Create `MetahubSettingsService.ts` in `packages/metahubs-backend/base/src/domains/settings/services/`
  - `bulkUpsert` must wrap all operations in `this.knex.transaction(async (trx) => { ... })`
- [ ] Create `settingsRoutes.ts` in `packages/metahubs-backend/base/src/domains/settings/routes/`
  - Use `Router({ mergeParams: true })`, `router.use(ensureAuth)`, all handlers wrapped in `asyncHandler`
  - URL convention: `/metahub/:metahubId/settings` (collection), `/metahub/:metahubId/setting/:key` (single)
- [ ] Register settings routes in `packages/metahubs-backend/base/src/domains/router.ts`
- [ ] Create `codenameStyleHelper.ts` in `packages/metahubs-backend/base/src/domains/shared/`
  - Exports: `getCodenameStyle()`, `getAttributeCodenameScope()`, `getAllowedAttributeTypes()`
- [ ] Add `general.codenameStyle` seed to `basic.template.ts`

### Phase 3: Backend Integration (Codename Style + Entity Permissions + Attribute Scope)
- [ ] Update `catalogsRoutes.ts` — codename style check for create/update, `allowCopy`/`allowDelete` enforcement
- [ ] Update `hubsRoutes.ts` — same as catalogs
- [ ] Update `enumerationsRoutes.ts` — same as catalogs, plus `allowedValueTypes` check if needed
- [ ] Update `attributesRoutes.ts`:
  - Codename style check for create/update
  - `catalogs.attributeCodenameScope` check: if `'global'` → uniqueness across all attrs in catalog (not per-level)
  - `catalogs.allowedAttributeTypes` check: reject attribute types not in the allowed list

### Phase 4: Frontend Domain
- [ ] Create `packages/metahubs-frontend/base/src/domains/settings/api/settingsApi.ts`
  - Use `/metahub/:metahubId/settings` for collection, `/metahub/:metahubId/setting/:key` for single
- [ ] Create `packages/metahubs-frontend/base/src/domains/settings/hooks/useSettings.ts`
- [ ] Create `packages/metahubs-frontend/base/src/domains/settings/hooks/useEntityPermissions.ts`
- [ ] Create `SettingsPage.tsx` — reuse `TemplateMainCard`, `ViewHeaderMUI` (built-in search), `ConfirmDialog`/`useConfirm`
  - Do NOT create new reusable components; leverage existing template-mui abstractions
- [ ] Create `SettingControl.tsx` — support all `SettingValueType` including `'multiselect'` (MUI Checkbox group or Autocomplete multi)
- [ ] Create `CodenameStylePreview.tsx`

### Phase 5: Frontend Integration
- [ ] Add settings query keys to `queryKeys.ts`
- [ ] Add `invalidateSettingsQueries` to `queryKeys.ts`
- [ ] Add i18n keys to `locales/en/metahubs.json` (incl. `attributeCodenameScope`, `allowedAttributeTypes`, `allowedValueTypes`)
- [ ] Add i18n keys to `locales/ru/metahubs.json` (same keys)
- [ ] Add `settings` to `MetahubsBundle` interface and `consolidateMetahubsNamespace` in `i18n/index.ts`
- [ ] Export `MetahubSettings` from `packages/metahubs-frontend/base/src/index.ts`

### Phase 6: Route & Menu Registration
- [ ] Add settings route in `MainRoutesMUI.tsx` (path: `settings`)
- [ ] Add settings menu item in `menuConfigs.ts` (getMetahubMenuItems)
- [ ] Add settings menu item in `metahubDashboard.ts`

### Phase 7: Build & Verify
- [ ] Build full project: `pnpm build`
- [ ] Test settings API endpoints (collection & single-resource URLs)
- [ ] Test codename validation with both styles (`kebab-case` & `1c-pascal-case`)
- [ ] Test `attributeCodenameScope` = `'global'` vs `'per-level'`
- [ ] Test `allowedAttributeTypes` filtering
- [ ] Test multiselect settings UI (checkbox group rendering + save)
- [ ] Test entity copy/delete permission enforcement
- [ ] Update memory-bank

---

## 16. Potential Challenges

### 1. Codename Style Migration Risk
**Problem**: If a metahub switches from `kebab-case` to `1c-pascal-case`, existing kebab codenames become "invalid" under the new style.
**Mitigation**: The style setting only affects **new** codenames. Existing codenames are never re-validated. Document this clearly: changing the style is a forward-looking decision.

### 2. Settings Cache & Performance
**Problem**: Every codename validation now requires a DB read for `general.codenameStyle`.
**Mitigation**: Load settings once at the start of Route handlers that need them, then pass the loaded values to helper functions. This avoids multiple DB queries per request. The `codenameStyleHelper.ts` functions (`getCodenameStyle()`, `getAttributeCodenameScope()`, `getAllowedAttributeTypes()`) each make one query. If a handler needs multiple settings, consider a single `findAll()` call and extract needed values from the result:

```typescript
// In a route handler that needs multiple settings:
const allSettings = await settingsService.findAll(metahubId, userId)
const codenameStyle = extractSettingValue(allSettings, 'general.codenameStyle', 'kebab-case')
const attrScope = extractSettingValue(allSettings, 'catalogs.attributeCodenameScope', 'per-level')
```

For Phase 1, per-request loading is sufficient. True per-request caching (e.g., `res.locals`) or in-memory caching (e.g., LRU with TTL) can be added later if profiling shows settings reads are a bottleneck.

### 3. Template Seed Compatibility
**Problem**: Existing metahubs created before this feature have no `general.codenameStyle` row.
**Mitigation**: The API falls back to `METAHUB_SETTINGS_REGISTRY` defaults. Missing keys return the default value (`kebab-case`). No migration needed.

### 4. 1C PascalCase — Ё Character
**Problem**: 1C:Enterprise convention prohibits the letter "ё"/"Ё" in identifiers.
**Mitigation**: `normalize1CCodename` replaces "ё"→"е", "Ё"→"Е" automatically. `isValid1CCodename` rejects strings containing these characters. Clear i18n message for user.

### 5. Codename Uniqueness Scope
**Problem**: If `catalogs.attributeCodenameScope = 'global'`, attribute codename uniqueness checks need to ignore `parent_attribute_id` and enforce uniqueness across ALL attributes in a catalog. Currently, uniqueness is per-level (root attributes vs child attributes in each table attribute).
**Mitigation**: In `attributesRoutes.ts`, when scope is `'global'`, call `findByCodename()` without `parentAttributeId` parameter (or pass `null` to skip the parent filter). This changes only the application-level check; the DB partial unique indexes remain as-is (they provide sufficient constraint for per-level mode and don't conflict with global mode since the app-level check is stricter). If DB-level enforcement for global mode is needed later, a new non-partial unique index on `(object_id, codename)` can be added via migration.

### 6. Frontend Bundle Size
**Problem**: MUI Tabs, Switch, Select add UI weight.
**Mitigation**: These MUI components are already used elsewhere in the app (Tabs in AttributeList, Switch in layouts). No additional bundle impact.

---

## Design Notes

### Why Typed Registry Instead of Dynamic DB-driven Settings?

1. **Type safety**: Both backend and frontend know all possible keys at compile time
2. **Defaults without migration**: Missing DB rows = registry default, no data migration needed
3. **Validation**: `bulkUpsert` rejects unknown keys
4. **UI generation**: Registry drives tab grouping and control rendering
5. **Extensibility**: Adding a new setting = add to registry + i18n keys (no DB change)

### Why Bulk Upsert Instead of Single Updates?

1. **UX**: Users configure multiple settings before clicking "Save"
2. **Performance**: One batch request instead of N individual PUTs
3. **Atomicity**: All-or-nothing update (validated before any writes)

### Settings Value Structure

All values are stored as JSONB with `{ _value: <actual_value> }` wrapping. This matches the existing convention (see seed data) and allows future extension with metadata (e.g., `{ _value: 'en', _setBy: 'admin', _setAt: '...' }`).

### Service Location: `domains/settings/` (not `domains/metahubs/`)

The settings service and routes live in their own domain folder (`domains/settings/`) rather than being nested inside `domains/metahubs/`. This follows the pattern where each domain has its own service + routes directory. The shared `codenameStyleHelper.ts` lives in `domains/shared/` because it's consumed by multiple domains (catalogs, hubs, enumerations, attributes).
