# Plan: Metahub Self-Hosted Application & Snapshot Export/Import

> **Created**: 2026-04-03  
> **Updated**: 2026-04-03 (v3 — post-QA-v2 deep-dive revision)  
> **Complexity**: Level 4 (Multi-Package, Architecture Extension)  
> **Status**: DRAFT v3 — awaiting approval

---

## Overview

Extend the platform to support:

1. **Metahub Snapshot File Export/Import** — JSON envelope transport for MetahubSnapshot, enabling offline backup, sharing, and migration between instances. Import creates a **new metahub** from snapshot (dropdown option on MetahubList "Create" button). Additionally, publication-level version import is supported.
2. **Enhanced `apps-template-mui` Runtime** — Card views, search/filter bar, pagination, view toggles (card/table), DnD reordering, increased row height, multi-line field support — all driven by metahub-authored layout configuration. **Reuses existing `@universo/template-mui` components** (`ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `FlowListTable`, `PaginationControls`, `useViewPreference`).
3. **Self-Hosted Metahub Application** — Create a metahub that models all sections of itself (catalogs, attributes, sets, constants, elements, enumerations, hubs, branches, publications, layouts, migrations, settings), publish it, test via application runtime UI.
4. **Comprehensive Testing** — Unit, integration, and E2E (Playwright) tests with visual verification at each step.
5. **Documentation** — Update READMEs and GitBook docs in `docs/`.

### Guiding Principles

- **No deletions** — all existing functionality preserved.
- **No new metahub entity types** — use existing types (catalogs, hubs, sets, enumerations, constants).
- **Reuse existing components** — extend `@universo/template-mui` components already proven in metahubs-frontend entity lists; do NOT create duplicate toolbar/card/pagination components.
- **Follow established patterns** — entity list pattern (ViewHeader → ToolbarControls → ItemCard/FlowListTable → PaginationControls), Controller–Service–Store backend pattern, existing DashboardLayoutConfig pipeline (`buildDashboardLayoutConfig()` → Zod schema → Dashboard).
- **Modern patterns** — TanStack Query v5, Zod validation, VLC, UUID v7.
- **Security first** — validate all imports server-side with Zod, sanitize filenames with RFC 5987 encoding, enforce size limits.
- **i18n from start** — all user-facing text uses i18n keys in `en` and `ru`.

### QA-Identified Corrections (v2)

| Issue | v1 Status | v2 Fix |
|-------|-----------|--------|
| Import at publication level only | Wrong level | Import on MetahubList Create dropdown + metahub-level backend endpoint |
| New RuntimeToolbar/RuntimeCardGrid | Reinvention | Reuse ViewHeaderMUI, ToolbarControls, ItemCard, FlowListTable from `@universo/template-mui` |
| buildDashboardLayoutConfig pipeline | Not updated | Update `buildDashboardLayoutConfig()` + Zod schema + widgetKey registry |
| Row height / multi-line fields | Missing | Add `rowHeight` config + `getRowHeight` prop in DataGrid |
| Self-model incomplete (4 catalogs) | Missing 9 sections | Expand to all 13 metahub sections |
| Filename Unicode sanitization | Lossy | Use RFC 5987 `filename*` with `encodeURIComponent` |
| Envelope validation manual | Fragile | Replace with Zod schema |
| res.json() + Content-Disposition | Incompatible | Use `res.type().send()` |
| JSON.parse without try/catch | Missing | Add error handling |
| Deep import `@universo/utils/snapshot` | Non-standard | Barrel re-export from index |
| Layout full-page editing | Missing | Add design note + Phase 4 step |
| Workspaces/multi-user | Missing | Document as future scope |

### QA-Identified Corrections (v3 — deep-dive codebase verification)

| Issue | v2 Status | v3 Fix |
|-------|-----------|--------|
| `@universo/template-mui` not in `apps-template-mui` deps | **CRITICAL** — missing dependency | Add `"@universo/template-mui": "workspace:*"` to `apps-template-mui/package.json` |
| PaginationControls interface mismatch | **CRITICAL** — plan uses MUI TablePagination API | Rewrite to use actual `{ pagination: PaginationState, actions: PaginationActions }` interface |
| CSRF protection absent on `/api/v1/*` mutation routes | **CRITICAL** — security gap | Add CSRF middleware to new import routes + document global fix as prerequisite |
| `buildDashboardLayoutConfig()` rawConfig param | **HIGH** — wrong entry point | Remove Phase 4.2 modification; new view fields persist in `layout.config` JSONB and flow through `attachLayoutsToSnapshot()` pipeline automatically |
| `buildCodenameFromPrimary()` doesn't exist | **HIGH** — function not found | Replace with `createCodenameVLC(primaryLocale, codenameText)` from `@universo/utils` |
| `createVersionFromSnapshot()` doesn't exist | **HIGH** — method not found | Replace with direct `createPublicationVersion(exec, input)` from persistence store |
| Hash normalization conflict | **HIGH** — `computeSnapshotHash` vs `SnapshotSerializer.calculateHash` | Reuse existing `normalizePublicationSnapshotForHash()` from `@universo/utils/serialization` in export path |
| No prototype pollution guard for imported JSON | **MEDIUM** — OWASP risk | Add `__proto__`/`constructor`/`prototype` key sanitization in `validateSnapshotEnvelope()` |
| No JSON nesting depth limit | **MEDIUM** — DoS risk | Add max nesting depth check (50 levels) before `JSON.parse()` |
| Zod `snapshot` field too permissive | **MEDIUM** — accepts any object | Add minimal structural validation: `version`, `metahubId`, `entities` required |
| `@dnd-kit` not in `apps-template-mui` deps | **MEDIUM** — missing for FlowListTable DnD | Not needed: `FlowListTable` re-exports DnD internally from `@universo/template-mui` |

---

## Affected Areas

| Package | Changes |
|---------|---------|
| `universo-core-backend` | **(v3)** Apply CSRF protection globally to `/api/v1` routes |
| `metahubs-backend` | New export/import routes + controllers + services; new `importMetahubFromSnapshot` service; new `SnapshotRestoreService` |
| `metahubs-frontend` | Import dropdown on MetahubList Create button; Export button on PublicationVersionList; ImportSnapshotDialog |
| `apps-template-mui` | **(v3)** Add `@universo/template-mui` dependency; integrate shared components for card/table view toggle, search, pagination (using real `PaginationState`/`PaginationActions` interface); extend `CustomizedDataGrid` with row height; update widgetRenderer |
| `universo-types` | Shared snapshot transport types + Zod envelope schema (v3: tightened `snapshot` field validation) |
| `universo-utils` | Snapshot archive helpers (build/parse/validate) — barrel re-exported; **(v3)** reuses `normalizePublicationSnapshotForHash` for hash compatibility; adds prototype pollution + depth guards |
| `universo-i18n` | Shared i18n keys for export/import actions |
| `universo-template-mui` | No new components needed — existing components already sufficient |
| `tools/testing/e2e` | New Playwright specs |
| `docs/` | GitBook pages for snapshot format, app template extensions |

---

## Phase 1: Snapshot Transport Types & Helpers

### 1.1 Shared Types + Zod Schema in `@universo/types`

**File**: `packages/universo-types/base/src/common/snapshots.ts`

```typescript
import { z } from 'zod'

/** Zod schema for snapshot transport envelope — used by both backend and frontend */
export const MetahubSnapshotTransportEnvelopeSchema = z.object({
  kind: z.literal('metahub_snapshot_bundle'),
  bundleVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  sourceInstance: z.string().optional(),
  metahub: z.object({
    id: z.string().uuid(),
    name: z.record(z.unknown()),
    description: z.record(z.unknown()).optional(),
    codename: z.record(z.unknown()),
    slug: z.string().optional(),
  }),
  publication: z.object({
    id: z.string().uuid(),
    name: z.record(z.unknown()),
    versionId: z.string().uuid(),
    versionNumber: z.number().int().positive(),
  }).optional(),
  /** Structural snapshot validation — requires version, metahubId, entities at minimum */
  snapshot: z.object({
    version: z.string(),
    metahubId: z.string().uuid(),
    entities: z.record(z.unknown()),
  }).passthrough(),
  snapshotHash: z.string().min(64).max(64),
})

export type MetahubSnapshotTransportEnvelope = z.infer<typeof MetahubSnapshotTransportEnvelopeSchema>

/** Constraints for import validation */
export const SNAPSHOT_BUNDLE_CONSTRAINTS = {
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,  // 50 MB
  MAX_ENTITIES: 500,
  MAX_FIELDS_PER_ENTITY: 200,
  MAX_ELEMENTS_PER_ENTITY: 10_000,
  MAX_JSON_NESTING_DEPTH: 50,
} as const
```

**Re-export from index**: Add `export * from './common/snapshots'` to `packages/universo-types/base/src/index.ts`.

### 1.2 Snapshot Helpers in `@universo/utils`

**File**: `packages/universo-utils/base/src/snapshot/snapshotArchive.ts`

Uses `json-stable-stringify` (already in workspace catalog) for deterministic hashing. **No JSZip dependency** — single JSON file with HTTP gzip compression.

> **Design Decision**: Ship a single `.json` file (not `.zip`) for V1. The envelope is self-contained. Gzip HTTP compression handles wire size. This avoids adding JSZip dependency (supply chain risk, bundle size). The spec mentioning "archive" is satisfied by the self-contained envelope format. V2 can add multi-file ZIP if needed, gated by `bundleVersion: 2`.

> **CRITICAL (v3)**: Must reuse the existing `normalizePublicationSnapshotForHash()` from `@universo/utils/serialization` for hash computation to stay compatible with `SnapshotSerializer.calculateHash()`. The existing normalization sorts entities, fields, and elements deterministically and normalizes absent optional keys. Using raw `stableStringify(snapshot)` without normalization would produce different hashes.

```typescript
import { createHash } from 'node:crypto'
import stableStringify from 'json-stable-stringify'
import type { MetahubSnapshotTransportEnvelope } from '@universo/types'
import { MetahubSnapshotTransportEnvelopeSchema, SNAPSHOT_BUNDLE_CONSTRAINTS } from '@universo/types'
import { normalizePublicationSnapshotForHash } from '../serialization'
import type { PublicationSnapshotHashInput } from '../serialization'

/** Dangerous keys that could enable prototype pollution */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Recursively sanitize an object by removing keys that could cause prototype pollution.
 * Must be applied before Zod parsing since Zod does not strip __proto__ keys.
 */
function sanitizeKeys(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(sanitizeKeys)
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([key]) => !DANGEROUS_KEYS.has(key))
      .map(([key, val]) => [key, sanitizeKeys(val)])
  )
}

/**
 * Check maximum nesting depth of a JSON value.
 * Prevents stack overflow from deeply nested structures (DoS protection).
 */
function checkNestingDepth(value: unknown, maxDepth: number, currentDepth = 0): void {
  if (currentDepth > maxDepth) {
    throw new Error(`JSON nesting depth exceeds maximum of ${maxDepth}`)
  }
  if (typeof value !== 'object' || value === null) return
  if (Array.isArray(value)) {
    for (const item of value) {
      checkNestingDepth(item, maxDepth, currentDepth + 1)
    }
  } else {
    for (const val of Object.values(value)) {
      checkNestingDepth(val, maxDepth, currentDepth + 1)
    }
  }
}

/**
 * Compute deterministic SHA-256 hash of a snapshot.
 * Uses the SAME normalization as SnapshotSerializer.calculateHash() to ensure
 * hash compatibility between export and the existing publication pipeline.
 */
export function computeSnapshotHash(snapshot: Record<string, unknown>): string {
  const normalized = normalizePublicationSnapshotForHash(
    snapshot as PublicationSnapshotHashInput
  )
  const canonical = stableStringify(normalized)
  if (canonical === undefined) {
    throw new Error('Failed to stringify snapshot for hash calculation')
  }
  return createHash('sha256').update(canonical).digest('hex')
}

export function buildSnapshotEnvelope(params: {
  snapshot: Record<string, unknown>
  metahub: MetahubSnapshotTransportEnvelope['metahub']
  publication?: MetahubSnapshotTransportEnvelope['publication']
  sourceInstance?: string
}): MetahubSnapshotTransportEnvelope {
  const snapshotHash = computeSnapshotHash(params.snapshot)
  return {
    kind: 'metahub_snapshot_bundle',
    bundleVersion: 1,
    exportedAt: new Date().toISOString(),
    sourceInstance: params.sourceInstance,
    metahub: params.metahub,
    publication: params.publication,
    snapshot: params.snapshot,
    snapshotHash,
  }
}

/**
 * Validate an imported envelope — throws ZodError on invalid input.
 *
 * Security layers (defense-in-depth):
 * 1. Nesting depth check (DoS protection)
 * 2. Prototype pollution sanitization
 * 3. Zod structural validation (type + shape)
 * 4. Integrity check (SHA-256 hash verification)
 * 5. Entity count limit check
 */
export function validateSnapshotEnvelope(
  raw: unknown,
): MetahubSnapshotTransportEnvelope {
  // 0. Type guard
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Expected a JSON object')
  }

  // 1. Nesting depth check (before deep traversal)
  checkNestingDepth(raw, SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_JSON_NESTING_DEPTH)

  // 2. Prototype pollution sanitization
  const sanitized = sanitizeKeys(raw)

  // 3. Structural validation through Zod
  const envelope = MetahubSnapshotTransportEnvelopeSchema.parse(sanitized)

  // 4. Integrity check (not expressible in Zod)
  const expectedHash = computeSnapshotHash(envelope.snapshot as Record<string, unknown>)
  if (envelope.snapshotHash !== expectedHash) {
    throw new Error('Snapshot integrity check failed: hash mismatch')
  }

  // 5. Entity count limits
  const entities = (envelope.snapshot as Record<string, unknown>).entities
  if (entities && typeof entities === 'object') {
    const entityCount = Object.keys(entities).length
    if (entityCount > SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_ENTITIES) {
      throw new Error(`Too many entities: ${entityCount} > ${SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_ENTITIES}`)
    }
  }

  return envelope
}
```

**Barrel re-export**: Add `export * from './snapshot/snapshotArchive'` to `packages/universo-utils/base/src/index.ts`. All consumers import via `import { computeSnapshotHash, buildSnapshotEnvelope, validateSnapshotEnvelope } from '@universo/utils'`.

**Tests**: `packages/universo-utils/base/src/snapshot/__tests__/snapshotArchive.test.ts`

---

## Phase 2: Backend Export/Import Routes

### 2.0 CSRF Protection Prerequisite (NEW in v3)

**File**: `packages/universo-core-backend/base/src/index.ts`

The existing CSRF middleware (`createCsrfProtection()`) is currently only applied to `/api/v1/auth` routes. All other `/api/v1/*` mutation routes (metahubs, admin, applications) are **unprotected** against CSRF attacks. This is a pre-existing gap, but adding a 50MB JSON import endpoint significantly raises the risk.

**Fix**: Apply `csrfProtection` to the `/api/v1` router before the feature-specific routers:

```typescript
// Before:
// this.app.use('/api/v1/auth', createAuthRouter(csrfProtection, ...))
// this.app.use('/api/v1', apiV1Router)  // ← NO CSRF

// After:
this.app.use('/api/v1/auth', createAuthRouter(csrfProtection, ...))
this.app.use('/api/v1', csrfProtection, apiV1Router)  // ← CSRF applied globally
```

> **Note**: The existing CSRF middleware already skips safe methods (GET, HEAD, OPTIONS), so GET endpoints (export, lists) are unaffected. Existing frontend API client already sends CSRF tokens via headers (`x-csrf-token`), so no frontend changes are needed for existing features. Verify with E2E suite after applying.

### 2.1 Publication Version Export

**File**: `packages/metahubs-backend/base/src/domains/publications/routes/publicationsRoutes.ts` (extend existing)

New endpoint: `GET /metahub/:metahubId/publication/:publicationId/versions/:versionId/export`

```typescript
router.get(
  '/metahub/:metahubId/publication/:publicationId/versions/:versionId/export',
  asyncHandler(async (req, res) => {
    const { metahubId, publicationId, versionId } = req.params
    const { exec } = services(req)
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'readMetahub')
    if (!userId) return

    const publication = await findPublicationById(exec, publicationId)
    if (!publication || publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found' })
    }
    const version = await findPublicationVersionById(exec, versionId)
    if (!version || version.publicationId !== publicationId) {
      return res.status(404).json({ error: 'Version not found' })
    }

    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

    const envelope = buildSnapshotEnvelope({
      snapshot: version.snapshotJson,
      metahub: {
        id: metahub.id,
        name: metahub.name as Record<string, unknown>,
        description: metahub.description as Record<string, unknown> | undefined,
        codename: metahub.codename as Record<string, unknown>,
        slug: metahub.slug ?? undefined,
      },
      publication: {
        id: publication.id,
        name: publication.name as Record<string, unknown>,
        versionId: version.id,
        versionNumber: version.versionNumber,
      },
    })

    // RFC 5987 filename encoding for Unicode support
    const primary = getCodenamePrimary(metahub.codename) ?? metahub.id
    const asciiFilename = `metahub-${primary.replace(/[^a-zA-Z0-9\-_.]/g, '_')}-v${version.versionNumber}.json`
    const utf8Filename = `metahub-${primary}-v${version.versionNumber}.json`

    res.type('application/json')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`
    )
    return res.send(JSON.stringify(envelope))
  })
)
```

### 2.2 Direct Metahub Export (without publication)

**File**: Add to `metahubsRoutes.ts`.

New endpoint: `GET /metahub/:metahubId/export`

Calls `SnapshotSerializer.serializeMetahub()` + `attachLayoutsToSnapshot()` to build a fresh snapshot from current branch state, wraps it in the transport envelope, and sends it as a download. Same RFC 5987 filename pattern.

### 2.3 Import Metahub from Snapshot (PRIMARY import path)

**File**: `packages/metahubs-backend/base/src/domains/metahubs/routes/metahubsRoutes.ts` (extend existing)

New endpoint: `POST /metahubs/import`

This is the **primary import path** — creates a new metahub from an imported snapshot. It follows the same Controller–Service–Store pattern as the existing `POST /metahubs` create route.

> **CSRF (v3)**: The CSRF middleware is currently only applied to `/api/v1/auth` routes. Before implementing the import endpoint, apply `csrfProtection` to all authenticated mutation routes on `/api/v1`. This is a **prerequisite** step that must happen in Phase 2.0 (see below).

```typescript
// In metahubsRoutes.ts:
router.post('/metahubs/import', writeLimiter, asyncHandler(ctrl.importFromSnapshot))
```

**Controller method** in `metahubsController.ts`:

```typescript
async importFromSnapshot(req: Request, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  // 1. Validate envelope (with prototype pollution + depth + hash checks)
  let envelope: MetahubSnapshotTransportEnvelope
  try {
    envelope = validateSnapshotEnvelope(req.body)
  } catch (err) {
    const message = err instanceof ZodError
      ? err.errors.map(e => e.message).join('; ')
      : err instanceof Error ? err.message : 'Validation failed'
    return res.status(400).json({ error: 'Invalid snapshot envelope', details: message })
  }

  // 2. Extract metahub metadata from envelope
  //    Generate new codename with "-imported" suffix to avoid collisions
  //    Uses createCodenameVLC from @universo/utils (verified v3)
  const sourceCodename = getCodenamePrimary(envelope.metahub.codename)
  const importedCodename = createCodenameVLC(
    DEFAULT_LOCALE,
    `${sourceCodename}-imported-${Date.now()}`
  )

  // 3. Create new metahub (reuse existing MetahubSchemaService)
  //    - Create metahub record with imported name/description
  //    - Create default branch + schema
  //    - Skip template seeding (we'll restore from snapshot)
  const metahub = await this.metahubSchemaService.createMetahub({
    name: envelope.metahub.name,
    description: envelope.metahub.description,
    codename: importedCodename,
    userId,
    storageMode: 'main_db',
    createHub: false,
    createCatalog: false,
    createSet: false,
    createEnumeration: false,
  })

  // 4. Restore entities from snapshot into new metahub's branch schema
  await this.snapshotRestoreService.restoreFromSnapshot(
    metahub.id,
    metahub.defaultBranchId,
    envelope.snapshot as MetahubSnapshot,
    userId
  )

  // 5. Create publication + version with the imported snapshot
  //    Uses createPublicationVersion store function directly (verified v3)
  const publication = await this.publicationsService.createPublication({
    metahubId: metahub.id,
    name: envelope.publication?.name ?? envelope.metahub.name,
    userId,
  })

  const version = await createPublicationVersion(exec, {
    publicationId: publication.id,
    versionNumber: 1,
    name: envelope.publication?.name ?? envelope.metahub.name,
    description: null,
    snapshotJson: envelope.snapshot as Record<string, unknown>,
    snapshotHash: envelope.snapshotHash,
    branchId: null,
    isActive: true,
    userId,
  })

  return res.status(201).json({
    metahub,
    publication: { id: publication.id },
    version: { id: version.id, versionNumber: version.versionNumber },
    importedFrom: {
      sourceMetahubId: envelope.metahub.id,
      exportedAt: envelope.exportedAt,
    },
  })
}
```

### 2.4 SnapshotRestoreService (NEW)

**File**: `packages/metahubs-backend/base/src/domains/metahubs/services/SnapshotRestoreService.ts`

This service restores metahub branch schema entities from a snapshot. It uses the existing entity creation services to replay the snapshot into a fresh branch.

> **(v3)**: Must follow the same 3-pass creation order as `TemplateSeedExecutor` to satisfy FK constraints:
> 1. **Pass 1**: Create entities + seed system attributes
> 2. **Pass 2**: Create constants
> 3. **Pass 3**: Create attributes + children → enum values → elements

```typescript
export class SnapshotRestoreService {
  /**
   * Restore entities from a MetahubSnapshot into a metahub's branch schema.
   *
   * CRITICAL: Follows TemplateSeedExecutor 3-pass creation order:
   *
   * Pass 1 — Entities + system attributes:
   *   - For each entity in snapshot.entities:
   *     - Create entity record via existing service (catalog/hub/set/enumeration)
   *     - Seed system attributes from snapshot.systemFields[entityId]
   *
   * Pass 2 — Constants:
   *   - For each entry in snapshot.constants → create constants
   *
   * Pass 3 — Attributes → enum values → elements:
   *   - For each entity: create attributes/fields via MetahubAttributesService
   *   - For each entry in snapshot.enumerationValues → create enum values
   *   - For each entry in snapshot.elements → create elements
   *
   * Final pass — Layouts:
   *   - Restore layouts from snapshot.layouts + snapshot.layoutZoneWidgets
   *
   * All wrapped in a single DB transaction for atomicity.
   */
  async restoreFromSnapshot(
    metahubId: string,
    branchId: string,
    snapshot: MetahubSnapshot,
    userId: string,
  ): Promise<void> {
    // Implementation uses existing domain services:
    // - MetahubEntitiesService for entity CRUD
    // - MetahubAttributesService for attribute CRUD + system field seeding
    // - MetahubElementsService for element CRUD
    // - MetahubEnumerationValueService for enum values
    // - MetahubConstantsService for constants
    // - MetahubLayoutsService for layouts + zone widgets
    // All wrapped in a transaction for atomicity
  }
}
```

### 2.5 Publication Version Import (SECONDARY path)

**File**: `packages/metahubs-backend/base/src/domains/publications/routes/publicationsRoutes.ts` (extend existing)

New endpoint: `POST /metahub/:metahubId/publication/:publicationId/versions/import`

This secondary path adds a new version to an existing publication from an imported snapshot (does NOT create a new metahub).

```typescript
router.post(
  '/metahub/:metahubId/publication/:publicationId/versions/import',
  asyncHandler(async (req, res) => {
    const { metahubId, publicationId } = req.params
    const { exec } = services(req)
    const userId = await ensureMetahubRouteAccess(req, res, metahubId, 'manageMetahub')
    if (!userId) return

    // 1. Validate envelope via Zod
    let envelope: MetahubSnapshotTransportEnvelope
    try {
      envelope = validateSnapshotEnvelope(req.body)
    } catch (err) {
      const message = err instanceof ZodError
        ? err.errors.map(e => e.message).join('; ')
        : err instanceof Error ? err.message : 'Validation failed'
      return res.status(400).json({ error: 'Invalid snapshot envelope', details: message })
    }

    // 2. Verify publication exists
    const publication = await findPublicationById(exec, publicationId)
    if (!publication || publication.metahubId !== metahubId) {
      return res.status(404).json({ error: 'Publication not found' })
    }

    // 3. Create version from imported snapshot
    const versions = await listPublicationVersions(exec, publicationId)
    const nextVersionNumber = Math.max(0, ...versions.map(v => v.versionNumber)) + 1

    const result = await exec.transaction(async (tx) => {
      await deactivatePublicationVersions(tx, publicationId)

      const version = await createPublicationVersion(tx, {
        publicationId,
        versionNumber: nextVersionNumber,
        name: buildLocalizedContent(
          { en: `Imported v${nextVersionNumber}` },
          'en'
        )!,
        description: null,
        snapshotJson: envelope.snapshot,
        snapshotHash: envelope.snapshotHash,
        branchId: null,
        isActive: true,
        userId,
      })

      await tx.query(
        'UPDATE metahubs.doc_publications SET active_version_id = $1 WHERE id = $2',
        [version.id, publicationId]
      )
      return version
    })

    await notifyLinkedApplicationsUpdateAvailable(exec, publicationId, result.id)

    return res.status(201).json({
      ...result,
      importedFrom: {
        sourceMetahubId: envelope.metahub.id,
        sourceSnapshotHash: envelope.snapshotHash,
        exportedAt: envelope.exportedAt,
      },
    })
  })
)
```

---

## Phase 3: Frontend Export/Import UI

### 3.1 i18n Keys

**File**: `packages/universo-i18n/base/src/locales/en/common.json` (extend)

```json
{
  "export": {
    "exportSnapshot": "Export Snapshot",
    "exportMetahub": "Export Metahub",
    "importSnapshot": "Import Snapshot",
    "importMetahub": "Import Metahub",
    "importSuccess": "Metahub imported successfully",
    "importVersionSuccess": "Snapshot imported as version {{version}}",
    "importError": "Failed to import snapshot",
    "downloading": "Preparing download…",
    "fileSelectLabel": "Select snapshot file (.json)",
    "fileSizeError": "File too large (max {{maxMB}} MB)",
    "invalidFormat": "Invalid snapshot file format",
    "invalidJson": "File does not contain valid JSON",
    "confirmImportMetahub": "Import this snapshot as a new metahub?",
    "confirmImportVersion": "Import as a new publication version?",
    "sourceInfo": "Exported from: {{source}} on {{date}}"
  }
}
```

Mirror in `ru/common.json` with Russian translations.

### 3.2 MetahubList — Import Dropdown on Create Button

**Modified in**: `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubList.tsx`

The existing MetahubList already uses `ToolbarControls` with `primaryAction`. Add `primaryActionMenuItems` to create a split-button with "Import" dropdown option. This follows the exact same pattern already used in `HubList.tsx`, `CatalogList.tsx`, `SetList.tsx`.

```tsx
// In the ToolbarControls render:
<ToolbarControls
  viewToggleEnabled
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  primaryAction={{
    label: tc('create'),
    onClick: handleAddNew,
    startIcon: <AddRoundedIcon />
  }}
  primaryActionMenuItems={[
    {
      label: t('export.importMetahub'),
      onClick: () => setImportDialogOpen(true),
      startIcon: <FileUploadIcon />
    }
  ]}
/>
```

**Import state + dialog** in MetahubList:

```tsx
const [importDialogOpen, setImportDialogOpen] = useState(false)

const importMutation = useImportMetahubFromSnapshot()

const handleImportConfirm = useCallback(async (file: File) => {
  let json: unknown
  try {
    const text = await file.text()
    json = JSON.parse(text)
  } catch {
    enqueueSnackbar(t('export.invalidJson'), { variant: 'error' })
    return
  }
  importMutation.mutate(json, {
    onSuccess: (data) => {
      setImportDialogOpen(false)
      enqueueSnackbar(t('export.importSuccess'), { variant: 'success' })
      navigate(`/metahubs/${data.metahub.id}`)
    },
  })
}, [importMutation, navigate, enqueueSnackbar, t])

// In JSX:
<ImportSnapshotDialog
  open={importDialogOpen}
  onClose={() => setImportDialogOpen(false)}
  onConfirm={handleImportConfirm}
  isLoading={importMutation.isPending}
  error={importMutation.error?.message}
/>
```

### 3.3 Import Mutation Hooks

**File**: `packages/metahubs-frontend/base/src/domains/metahubs/hooks/mutations.ts` (extend)

```typescript
/** Import a new metahub from snapshot (primary path) */
export function useImportMetahubFromSnapshot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (envelopeJson: unknown) => {
      const { data } = await apiClient.post('/metahubs/import', envelopeJson)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() })
    },
  })
}
```

**File**: `packages/metahubs-frontend/base/src/domains/publications/hooks/versionMutations.ts` (extend)

```typescript
/** Import a snapshot as a new publication version (secondary path) */
export function useImportSnapshotVersion(metahubId: string, publicationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      let json: unknown
      try {
        const text = await file.text()
        json = JSON.parse(text)
      } catch {
        throw new Error('Invalid JSON file')
      }
      return apiClient.post(
        `/metahubs/metahub/${metahubId}/publication/${publicationId}/versions/import`,
        json
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['metahubs', metahubId, 'publications', publicationId, 'versions'],
      })
    },
  })
}
```

### 3.4 ImportSnapshotDialog (shared component)

**File**: `packages/metahubs-frontend/base/src/domains/publications/ui/ImportSnapshotDialog.tsx`

```tsx
import { useState, useCallback } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Alert, Typography, CircularProgress
} from '@mui/material'
import { useTranslation } from '@universo/i18n'
import { SNAPSHOT_BUNDLE_CONSTRAINTS } from '@universo/types'

interface ImportSnapshotDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (file: File) => Promise<void> | void
  isLoading?: boolean
  error?: string | null
  title?: string
  confirmLabel?: string
}

export function ImportSnapshotDialog({
  open,
  onClose,
  onConfirm,
  isLoading,
  error,
  title,
  confirmLabel,
}: ImportSnapshotDialogProps) {
  const { t } = useTranslation('metahubs')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLocalError(null)
    if (file.size > SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_FILE_SIZE_BYTES) {
      setLocalError(t('export.fileSizeError', { maxMB: 50 }))
      return
    }
    if (!file.name.endsWith('.json')) {
      setLocalError(t('export.invalidFormat'))
      return
    }
    setSelectedFile(file)
  }, [t])

  const handleConfirm = useCallback(async () => {
    if (!selectedFile) return
    await onConfirm(selectedFile)
  }, [selectedFile, onConfirm])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title ?? t('export.importSnapshot')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t('export.fileSelectLabel')}
        </Typography>
        <input
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          disabled={isLoading}
        />
        {(localError || error) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {localError ?? error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          {t('common:cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedFile || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {confirmLabel ?? t('export.importSnapshot')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

### 3.5 Export Button on PublicationVersionList

Add an "Export" action to `PublicationVersionList.tsx` row actions menu.

**API function** in `packages/metahubs-frontend/base/src/domains/publications/api/publications.ts`:

```typescript
export async function exportPublicationVersion(
  metahubId: string,
  publicationId: string,
  versionId: string,
): Promise<void> {
  const response = await apiClient.get(
    `/metahubs/metahub/${metahubId}/publication/${publicationId}/versions/${versionId}/export`,
    { responseType: 'blob' }
  )
  const blob = new Blob([response.data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const disposition = response.headers['content-disposition'] ?? ''
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
  a.download = filenameMatch?.[1] ?? 'metahub-snapshot.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

---

## Phase 4: Enhanced `apps-template-mui` Runtime Views

### Design Principle: Reuse `@universo/template-mui`

All metahub entity lists (CatalogList, AttributeList, ElementList, EnumerationList, HubList, BranchList, PublicationList, MetahubList) already use a proven **pattern** from `@universo/template-mui`:

```
ViewHeaderMUI (title + search + children slot)
  └─ ToolbarControls (view toggle, create button with dropdown)
MainCard
  ├─ ItemCard grid (card view)    ← using Grid + ItemCard
  └─ FlowListTable (list view)   ← with DnD, sortable columns
PaginationControls                ← { pagination: PaginationState, actions: PaginationActions }
```

The `apps-template-mui` dashboard MUST adopt the **same components** rather than creating duplicates. The integration strategy is to make `Dashboard.tsx` / `MainGrid.tsx` able to render these shared components when the layout config enables them, while keeping backward compatibility for existing dashboards.

### 4.0 Dependency Prerequisites (NEW in v3)

**File**: `packages/apps-template-mui/package.json`

`@universo/template-mui` is **NOT** currently listed as a dependency of `apps-template-mui`. This must be added before any imports work.

```json
"dependencies": {
  // ... existing deps ...
  "@universo/template-mui": "workspace:*"
}
```

> **Note on `@dnd-kit`**: `FlowListTable` internally imports from `@dnd-kit` via `@universo/template-mui`, which re-exports the needed DnD context. No separate `@dnd-kit` dependency is needed in `apps-template-mui` — it's a transitive dependency through `@universo/template-mui`.

### 4.1 DashboardLayoutConfig Extensions

Extend the existing `DashboardLayoutConfig` with new optional fields. These are backward-compatible (all optional, default to current behavior).

**New fields**:

```typescript
// Added to existing DashboardLayoutConfig interface in Dashboard.tsx
export interface DashboardLayoutConfig {
  // ... existing 19+ boolean flags remain unchanged ...

  /** Enable card/table view toggle for entity lists (default: false → existing DataGrid) */
  showViewToggle?: boolean
  /** Default view mode when toggle is enabled: 'table' (default) or 'card' */
  defaultViewMode?: 'table' | 'card'
  /** Enable search/filter bar above the data area (default: false) */
  showFilterBar?: boolean
  /** Enable row DnD reordering (default: false) */
  enableRowReordering?: boolean
  /** Number of card columns in card view: 2, 3, or 4 (default: 3) */
  cardColumns?: number
  /** Custom row height for DataGrid (default: undefined → density='compact') */
  rowHeight?: number | 'auto'
}
```

### 4.2 Backend Pipeline — NO modification needed to `buildDashboardLayoutConfig()` (v3 correction)

**Previous plan (v2)** proposed adding a `rawConfig` parameter to `buildDashboardLayoutConfig()`. This was **incorrect**.

**How the pipeline actually works** (verified):

1. `buildDashboardLayoutConfig(items)` — accepts widget items, returns `Record<string, boolean>` with 19 boolean flags derived from widget presence/zone. This is a **widget-derived** config builder.
2. `attachLayoutsToSnapshot()` in `publicationsController.ts` reads layout rows from DB and sets `snapshot.layoutConfig = defaultLayout?.config ?? {}` — this is the **layout's own `config` JSONB column**, which already passes through to the application.
3. The application receives `AppDataResponse.layoutConfig` which is this combined config.

**The new view settings** (`showViewToggle`, `showFilterBar`, `enableRowReordering`, `cardColumns`, `rowHeight`, `defaultViewMode`) are **config-based** fields, not widget-derived. They should be stored directly in the layout's `config` JSONB column and flow through the existing pipeline automatically.

**What needs to change on the backend**: Nothing in `buildDashboardLayoutConfig()`. The layout `config` JSONB column already supports arbitrary keys. When the layout is saved with new view settings via the existing layout update endpoint, those keys will be stored and passed through to the snapshot.

> **Important**: The Zod schema in `apps-template-mui` (Phase 4.3) must be extended to parse these new optional keys from the config it receives. The backend pipeline doesn't need changes — only the consumer needs to understand the new fields.

### 4.3 Update Zod Schema in `apps-template-mui`

**File**: `packages/apps-template-mui/src/api/api.ts`

```typescript
export const dashboardLayoutConfigSchema = z.object({
    // ... existing boolean fields ...
    showViewToggle: z.boolean().optional(),
    defaultViewMode: z.enum(['table', 'card']).optional(),
    showFilterBar: z.boolean().optional(),
    enableRowReordering: z.boolean().optional(),
    cardColumns: z.number().int().min(2).max(4).optional(),
    rowHeight: z.union([z.number().int().min(36).max(200), z.literal('auto')]).optional(),
}).optional()
```

### 4.4 Integrate Shared Components in MainGrid

**Modified in**: `packages/apps-template-mui/src/dashboard/components/MainGrid.tsx`

The `detailsTable` widget rendering path will be enhanced. When the new layout config flags are enabled, `MainGrid` imports and renders the shared `@universo/template-mui` components.

> **v3 fix**: Import from `@universo/template-mui` (added as dependency in Phase 4.0). PaginationControls uses `{ pagination: PaginationState, actions: PaginationActions }` interface — NOT MUI TablePagination props.

```tsx
import {
    ViewHeaderMUI as ViewHeader,
    ToolbarControls,
    ItemCard,
    type ItemCardData,
    PaginationControls,
    type PaginationState,
    type PaginationActions,
    FlowListTable,
    useViewPreference,
} from '@universo/template-mui'

// Inside the details section rendering:
function EnhancedDetailsSection({
    layoutConfig,
    details,
}: {
    layoutConfig: DashboardLayoutConfig
    details: DashboardDetailsSlot
}) {
    // Use same view preference hook as metahubs entity lists
    const [viewMode, setViewMode] = useViewPreference(
        'app-details-view',
        (layoutConfig.defaultViewMode as 'table' | 'card') ?? 'table'
    )
    const [search, setSearch] = useState('')

    // Client-side filter using same debounced pattern
    const filteredRows = useMemo(() => {
        if (!search.trim() || !details.rows) return details.rows ?? []
        const lower = search.toLowerCase()
        return (details.rows ?? []).filter(row =>
            Object.values(row).some(val =>
                typeof val === 'string' && val.toLowerCase().includes(lower)
            )
        )
    }, [details.rows, search])

    // Determine if enhanced mode is active
    const isEnhancedMode = layoutConfig.showViewToggle || layoutConfig.showFilterBar

    if (!isEnhancedMode) {
        // Fallback: render existing CustomizedDataGrid unchanged
        return <CustomizedDataGrid rows={details.rows ?? []} columns={details.columns ?? []} ... />
    }

    // Build PaginationState + PaginationActions from DataGrid paginationModel
    // This bridges the DataGrid pagination model to the PaginationControls interface
    const page = details.paginationModel?.page ?? 0
    const pageSize = details.paginationModel?.pageSize ?? 20
    const totalItems = details.rowCount ?? filteredRows.length

    const paginationState: PaginationState = {
        currentPage: page + 1,  // PaginationControls uses 1-based pages
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        hasNextPage: (page + 1) * pageSize < totalItems,
        hasPreviousPage: page > 0,
        search,
    }

    const paginationActions: PaginationActions = {
        goToPage: (p: number) => details.onPaginationModelChange?.({
            page: p - 1,  // Convert back to 0-based for DataGrid
            pageSize,
        }),
        nextPage: () => details.onPaginationModelChange?.({
            page: page + 1,
            pageSize,
        }),
        previousPage: () => details.onPaginationModelChange?.({
            page: Math.max(0, page - 1),
            pageSize,
        }),
        setSearch: (s: string) => setSearch(s),
        setSort: () => {},  // DataGrid handles sorting internally
        setPageSize: (size: number) => details.onPaginationModelChange?.({
            page: 0,
            pageSize: size,
        }),
    }

    return (
        <>
            {/* Reuse ViewHeaderMUI for search + title */}
            <ViewHeader
                title={details.title}
                search={layoutConfig.showFilterBar}
                searchValue={search}
                onSearchChange={(e) => setSearch(e.target.value)}
            >
                {/* Reuse ToolbarControls for view toggle + actions */}
                <ToolbarControls
                    viewToggleEnabled={layoutConfig.showViewToggle}
                    viewMode={viewMode === 'card' ? 'card' : 'list'}
                    onViewModeChange={(mode) => setViewMode(mode === 'card' ? 'card' : 'table')}
                />
                {details.actions}
            </ViewHeader>

            {viewMode === 'card' ? (
                /* Card view: reuse ItemCard in a Grid — same pattern as CatalogList/MetahubList */
                <Grid container spacing={2}>
                    {filteredRows.map((row) => {
                        const displayCol = details.columns?.find(
                            c => c.field !== 'id' && c.field !== 'actions'
                        )
                        const descCol = details.columns?.find(
                            c => c.field !== 'id' &&
                                 c.field !== displayCol?.field &&
                                 c.field !== 'actions'
                        )
                        const cardData: ItemCardData = {
                            name: String(row[displayCol?.field ?? ''] ?? row.id),
                            description: descCol
                                ? String(row[descCol.field] ?? '')
                                : undefined,
                        }
                        return (
                            <Grid key={row.id} size={{ xs: 12, sm: 6, md: 12 / (layoutConfig.cardColumns ?? 3) }}>
                                <ItemCard data={cardData} />
                            </Grid>
                        )
                    })}
                </Grid>
            ) : (
                /* Table view: enhanced CustomizedDataGrid with row height */
                <CustomizedDataGrid
                    rows={filteredRows}
                    columns={details.columns ?? []}
                    loading={details.loading}
                    rowCount={details.rowCount}
                    paginationModel={details.paginationModel}
                    onPaginationModelChange={details.onPaginationModelChange}
                    pageSizeOptions={details.pageSizeOptions}
                    localeText={details.localeText}
                    rowHeight={layoutConfig.rowHeight}
                />
            )}

            {/* Pagination: reuse PaginationControls with actual interface (v3 fix) */}
            {totalItems > 0 && (
                <PaginationControls
                    pagination={paginationState}
                    actions={paginationActions}
                />
            )}
        </>
    )
}
```

### 4.5 Extend CustomizedDataGrid with Row Height

**File**: `packages/apps-template-mui/src/dashboard/components/CustomizedDataGrid.tsx`

Add optional `rowHeight` prop to support increased row height and multi-line fields.

```typescript
export interface CustomizedDataGridProps {
    // ... existing props ...
    /** Custom row height: number for fixed px, 'auto' for multi-line content */
    rowHeight?: number | 'auto'
}

export default function CustomizedDataGrid({
    // ... existing destructured props ...
    rowHeight,
}: CustomizedDataGridProps) {
    return (
        <DataGrid
            // ... existing props ...
            density={rowHeight ? undefined : 'compact'}
            getRowHeight={
                rowHeight === 'auto'
                    ? () => 'auto'
                    : rowHeight
                    ? () => rowHeight
                    : undefined
            }
            sx={{
                // ... existing sx ...
                // When auto row height, allow multi-line text wrapping
                ...(rowHeight === 'auto' && {
                    '& .MuiDataGrid-cell': {
                        whiteSpace: 'normal',
                        wordWrap: 'break-word',
                        lineHeight: 1.5,
                        py: 1,
                    }
                }),
            }}
        />
    )
}
```

### 4.6 DnD Row Reordering

When `enableRowReordering` is true in layout config, replace `CustomizedDataGrid` with `FlowListTable` from `@universo/template-mui` which already has full `@dnd-kit` support (sortable rows, drag handles, etc.). This is the same component used for attribute/element ordering in `metahubs-frontend`.

### 4.7 i18n Updates for `apps-template-mui`

**File**: `packages/apps-template-mui/src/i18n/en.json` (extend)

```json
{
  "toolbar": {
    "search": "Search…",
    "viewMode": "View mode",
    "tableView": "Table view",
    "cardView": "Card view"
  },
  "cards": {
    "noData": "No items to display",
    "loading": "Loading…"
  }
}
```

Mirror in `ru.json`.
---

## Phase 5: Metahub Layout Configuration Extensions

### 5.1 Add New Layout Config Fields to UI

**File**: `packages/metahubs-frontend/base/src/domains/layouts/ui/LayoutDetails.tsx` (extend)

The existing `LayoutDetails.tsx` manages zones and widgets with drag-and-drop. Add a new **"Application View Settings"** section (Accordion or Panel) below the existing zone management, with form controls for the new config fields:

- `showViewToggle` — Switch
- `defaultViewMode` — Select: table / card
- `showFilterBar` — Switch
- `enableRowReordering` — Switch
- `cardColumns` — Select: 2 / 3 / 4
- `rowHeight` — Select: compact (default) / normal (52px) / auto (multi-line)

These values are persisted into the layout's `config` JSONB column (no schema migration needed) and flow through `attachLayoutsToSnapshot()` → publication → `AppDataResponse.layoutConfig` → Dashboard.

### 5.2 Layout Full-Page Editing (Design Note)

The spec mentions layout editing should use a full page rather than a modal dialog for complex configurations. The current `LayoutDetails.tsx` already opens as a separate page (routed, not a dialog). The layout **creation/edit metadata** dialog (`EntityFormDialog` for name/description) remains modal, which is appropriate for simple fields.

> **Decision**: The "Application View Settings" form in `LayoutDetails.tsx` is rendered as a full-page panel section, consistent with the existing zone management on the same page. No separate full-page route is needed for V1 since all layout configuration is already on one LayoutDetails page.

---

## Phase 6: Self-Hosted Metahub Application (All Sections)

### 6.1 Strategy

Create a regular metahub via the existing UI that models the metahub's own complete structure. This demonstrates the system's self-referential capability — **no code changes needed** for this step, only data.

### 6.2 Complete Metahub Structure Definition

Create a metahub named "Metahub Self-Model" with catalogs for **ALL 13 sections**:

| # | Catalog Codename | Kind | Attributes | Purpose |
|---|-----------------|------|------------|---------|
| 1 | `metahubs` | catalog | `name:STRING`, `description:STRING`, `slug:STRING`, `is_public:BOOLEAN`, `storage_mode:STRING` | Model metahub entities |
| 2 | `catalogs` | catalog | `name:STRING`, `codename:STRING`, `kind:STRING`, `metahub_ref:REF→metahubs` | Model catalog entities |
| 3 | `attributes` | catalog | `name:STRING`, `codename:STRING`, `data_type:STRING`, `is_required:BOOLEAN`, `is_display:BOOLEAN`, `catalog_ref:REF→catalogs` | Model attributes |
| 4 | `elements` | catalog | `name:STRING`, `codename:STRING`, `catalog_ref:REF→catalogs`, `sort_order:NUMBER` | Model catalog elements |
| 5 | `sets` | set | `name:STRING`, `codename:STRING`, `metahub_ref:REF→metahubs` | Model sets |
| 6 | `enumerations` | enumeration | `name:STRING`, `codename:STRING`, `metahub_ref:REF→metahubs` | Model enumerations |
| 7 | `enum_values` | catalog | `name:STRING`, `codename:STRING`, `enumeration_ref:REF→enumerations`, `sort_order:NUMBER` | Model enumeration values |
| 8 | `constants` | catalog | `name:STRING`, `codename:STRING`, `data_type:STRING`, `catalog_ref:REF→catalogs` | Model constants |
| 9 | `hubs` | hub | `name:STRING`, `codename:STRING`, `metahub_ref:REF→metahubs` | Model hubs |
| 10 | `branches` | catalog | `name:STRING`, `codename:STRING`, `hub_ref:REF→hubs`, `is_default:BOOLEAN` | Model branches |
| 11 | `publications` | catalog | `name:STRING`, `version_number:NUMBER`, `is_active:BOOLEAN`, `metahub_ref:REF→metahubs` | Model publications |
| 12 | `layouts` | catalog | `name:STRING`, `template_key:STRING`, `is_default:BOOLEAN`, `sort_order:NUMBER` | Model layouts |
| 13 | `settings` | catalog | `key:STRING`, `value:STRING`, `category:STRING` | Model metahub/admin settings |

### 6.3 Layout Configuration

- Dashboard layout with side menu showing all catalogs
- `showViewToggle: true` — demonstrate card/table toggle
- `showFilterBar: true` — demonstrate search functionality
- `defaultViewMode: 'card'` — showcase card view as default
- `cardColumns: 3` — three-column card grid
- `rowHeight: 'auto'` — show multi-line fields in table view

### 6.4 Automated Creation Script

Create a utility script at `tools/create-self-model-metahub.mjs` that uses the backend API to:
1. Create the metahub with all 13 catalogs + attributes
2. Configure layout with zone widgets + new view settings
3. Populate sample data (a few rows per catalog)
4. Create publication + version
5. Create linked application
6. Export snapshot to `tools/fixtures/self-model-metahub-snapshot.json`

This script is used for development/testing and is not production code. The exported fixture can be used to test import functionality.

---

## Phase 7: Comprehensive Testing

### 7.1 Unit Tests

| Test File | Coverage |
|-----------|----------|
| `packages/universo-utils/base/src/snapshot/__tests__/snapshotArchive.test.ts` | `computeSnapshotHash()` — round-trip compatibility with `SnapshotSerializer.calculateHash()`, `buildSnapshotEnvelope()`, `validateSnapshotEnvelope()` — valid, tampered, oversized, missing fields, Zod validation errors, prototype pollution keys stripped, nesting depth exceeded, snapshot without required `version`/`metahubId`/`entities` rejected |

### 7.2 Integration Tests

| Test File | Coverage |
|-----------|----------|
| `packages/metahubs-backend/base/src/tests/routes/publicationsRoutes.test.ts` | Export endpoint (200, 404), Version import endpoint (201, 400 invalid, 400 tampered hash, 404 missing pub) |
| `packages/metahubs-backend/base/src/tests/routes/metahubsRoutes.test.ts` | Metahub import endpoint (201 creates metahub+publication+version, 400 invalid envelope, 401 unauthorized) |
| `packages/metahubs-backend/base/src/tests/services/SnapshotRestoreService.test.ts` | Round-trip: serialize → export → import → entities match original |
| `packages/metahubs-backend/base/src/tests/services/SnapshotSerializer.test.ts` (extend) | Round-trip: serialize → export envelope → validate → deserialize produces equivalent entity definitions |

### 7.3 E2E Tests (Playwright)

**New spec**: `tools/testing/e2e/specs/flow/snapshot-export-import.spec.ts`

```typescript
test.describe('Snapshot Export/Import Flow', () => {
  test('can export a publication version and reimport as new metahub', async ({ page }) => {
    // 1. Navigate to metahubs list
    // 2. Open first metahub with a publication
    // 3. Navigate to Publications tab
    // 4. Click Export on latest version → verify download triggered
    // 5. Read downloaded file → verify valid JSON with 'metahub_snapshot_bundle' kind
    // 6. Go back to MetahubList
    // 7. Click Create dropdown → "Import" option
    // 8. Upload the exported file
    // 9. Verify new metahub appears in list
    // 10. Verify metahub has expected catalogs/attributes
  })

  test('can import snapshot as publication version', async ({ page }) => {
    // 1. Export a version
    // 2. Navigate to another publication
    // 3. Click Import on publication version list
    // 4. Upload exported file
    // 5. Verify new version appears with incremented number
  })

  test('rejects tampered snapshot on import', async ({ page }) => {
    // 1. Export a version
    // 2. Modify the downloaded JSON (change snapshotHash)
    // 3. Try to import → verify error message displayed
  })
})
```

**New spec**: `tools/testing/e2e/specs/flow/app-runtime-views.spec.ts`

```typescript
test.describe('Application Runtime View Modes', () => {
  test('can toggle between table and card view', async ({ page }) => {
    // 1. Navigate to an application with view toggle enabled
    // 2. Verify table view is default (or card if configured)
    // 3. Click view toggle
    // 4. Verify cards displayed (ItemCard-style elements)
    // 5. Toggle back, verify DataGrid
  })

  test('search bar filters displayed rows', async ({ page }) => {
    // 1. Navigate to application with filter bar enabled
    // 2. Type search text → verify row count decreases
    // 3. Clear search → verify original count restored
  })

  test('multi-line fields display correctly with auto row height', async ({ page }) => {
    // 1. Navigate to application with rowHeight: 'auto'
    // 2. Verify rows have variable height
    // 3. Verify long text wraps properly
  })
})
```

### 7.4 Security Tests

| Test | Description |
|------|-------------|
| `import rejects non-JSON content type` | POST with text/plain → 400 |
| `import rejects oversized payload` | Body > 50MB → 413 |
| `import rejects script injection in snapshot` | Snapshot with `<script>` in string fields → stored as escaped string, no XSS |
| `export requires authentication` | Unauthenticated GET → 401 |
| `export requires metahub access` | Wrong user → 403 |
| `import-metahub requires authentication` | Unauthenticated POST → 401 |
| `import rejects prototype pollution keys` | Snapshot with `__proto__`, `constructor`, `prototype` keys → keys stripped, import succeeds without pollution |
| `import rejects deeply nested JSON` | JSON with >50 levels nesting → 400 with depth error |
| `import validates CSRF token` | POST without CSRF token → 403/419 |
| `hash mismatch between export and import` | Tampered `snapshotHash` → 400 integrity error |
| `import rejects snapshot without required fields` | Missing `version`, `metahubId`, or `entities` → 400 Zod validation error |

---

## Phase 8: Documentation Updates

### 8.1 GitBook Docs

**New page**: `docs/en/guides/snapshot-export-import.md`

Contents:
- Overview of snapshot export/import
- Export from publication version or metahub directly
- Import as new metahub (Create dropdown) or as publication version
- File format specification (envelope schema)
- Security considerations (hash verification, size limits)

**New page**: `docs/en/guides/app-template-views.md`

Contents:
- Card/table view toggle configuration
- Search/filter bar setup
- Row height and multi-line field support
- DnD row reordering
- Layout configuration walkthrough

Mirror both pages in `docs/ru/guides/`.

### 8.2 README Updates

- `packages/apps-template-mui/README.md` — document new `DashboardLayoutConfig` fields and shared component integration
- `packages/metahubs-backend/base/README.md` — document export/import API endpoints

---

## Implementation Order (Recommended)

| Step | Phase | Tasks | Key Files |
|------|-------|-------|-----------|
| 0 | 2.0 | **[PREREQ]** Apply CSRF protection globally to `/api/v1` routes | 1 file (`core-backend/index.ts`) |
| 1 | 1.1 | Shared types + Zod schema in `@universo/types` | 2 files |
| 2 | 1.2 | Snapshot helpers in `@universo/utils` (with hash normalization compat + security guards) + tests | 3 files |
| 3 | 2.1–2.2 | Backend export routes (publication + direct) | 2 files |
| 4 | 2.3–2.5 | Backend import routes (metahub + version) + SnapshotRestoreService | 4 files |
| 5 | 7.1–7.2 | Unit + integration tests for Phases 1–2 | 4 files |
| 6 | 3.1–3.5 | Frontend export/import UI + i18n (MetahubList dropdown, dialogs, mutations) | 5 files |
| 7 | 4.0 | Add `@universo/template-mui` dependency to `apps-template-mui/package.json` | 1 file |
| 8 | 4.1, 4.3–4.7 | `apps-template-mui` enhancements (reuse shared components, PaginationControls adapter, row height, Zod schema) | 4 files |
| 9 | 5.1–5.2 | Layout config extensions (UI + view settings in config JSONB) | 2 files |
| 10 | 6.1–6.4 | Self-model metahub creation script + fixture | 2 files |
| 11 | 7.3–7.4 | E2E Playwright specs | 2 files |
| 12 | 8.1–8.2 | Documentation + GitBook | 4–6 files |
| 13 | — | Full `pnpm build` + E2E validation | — |

---

## Potential Challenges

1. **SnapshotRestoreService Complexity** — Restoring a full metahub from snapshot requires replaying all entity types (catalogs, attributes, elements, enum values, constants, sets, enumerations, hubs) in correct dependency order. Mitigation: follow the 3-pass order from `TemplateSeedExecutor` (1. entities+system attrs, 2. constants, 3. attributes+children → enum values → elements); atomic transaction wrapping; comprehensive integration tests.

2. **Snapshot Compatibility** — Imported snapshots from older/newer versions may have different entity shapes. Mitigation: strict Zod validation at envelope level; `snapshot.version` field check in SnapshotRestoreService.

3. **Large Snapshots** — Metahubs with many entities/elements could produce multi-MB JSON. Mitigation: Express body-parser limit at 50MB, entity count validation, HTTP gzip compression.

4. **Card View Column Mapping** — The card view needs to intelligently map DataGrid columns to card fields (title, description). Mitigation: Use `isDisplayAttribute` flag from column schema when present; fall back to first non-id column.

5. **Layout Config Backward Compatibility** — Existing publications without new layout flags should render identically to current behavior. Mitigation: all new fields are optional, `isEnhancedMode` guard prevents any change when flags are absent.

6. **Client-Side Search Performance** — Filtering all rows client-side can be slow for large datasets. Mitigation: debounced search input (300ms), limit to string fields, consider server-side search in V2 for datasets > 1000 rows.

7. **Self-Model Metahub REF Relationships** — The catalogs referencing each other via REF attributes. This is a data modeling pattern, not a code issue — the REF type already supports arbitrary target entities.

8. **Codename Collision on Import** — Imported metahub codename may collide with existing. Mitigation: auto-generate imported codename with timestamp suffix; user can rename after import.

9. **(v3) Hash Normalization Compatibility** — `computeSnapshotHash()` must produce the same hash as `SnapshotSerializer.calculateHash()` for the same snapshot. Mitigation: both now use `normalizePublicationSnapshotForHash()` from `@universo/utils/serialization`. Round-trip test: serialize → export → import → re-hash must match.

10. **(v3) CSRF Protection Regression Risk** — Applying `csrfProtection` globally to `/api/v1` may break existing unauthenticated or public endpoints if they exist. Mitigation: the CSRF middleware already skips GET/HEAD/OPTIONS; verify with full E2E suite. The existing frontend API client already sends CSRF tokens via `x-csrf-token` header.

11. **(v3) Prototype Pollution via Imported JSON** — User-uploaded 50MB JSON could contain `__proto__` keys to pollute Object prototype. Mitigation: `sanitizeKeys()` in `validateSnapshotEnvelope()` strips dangerous keys before Zod parsing.

12. **(v3) JSON Bomb / Deep Nesting DoS** — Deeply nested JSON can cause stack overflow during parsing or hash computation. Mitigation: `checkNestingDepth()` limits to 50 levels.

---

## Dependencies & Coordination

- **No new npm dependencies** — uses existing `json-stable-stringify`, `node:crypto`, `@mui/*`, `@tanstack/react-query`, `@dnd-kit/*` from workspace catalog. `@universo/template-mui` is an existing workspace package (added as explicit dependency to `apps-template-mui` in Phase 4.0).
- **No database migrations** — all new data fits existing JSONB columns (`config`, `snapshot_json`).
- **No upstream shell changes** — all changes are in feature packages, except the CSRF fix in `universo-core-backend` (Phase 2.0) which fixes a pre-existing security gap.
- **Backward compatible** — existing publications, applications, and layouts continue to work unchanged.
- **(v3) Prerequisite**: CSRF global application (Phase 2.0) should be implemented first and validated with the full E2E suite before proceeding with import routes.

---

## Design Notes

### JSON Envelope vs ZIP Archive

**Chosen: JSON envelope** for V1. Rationale:
- Single-file format is simpler to implement, validate, and debug
- HTTP gzip provides similar compression benefits
- No new dependency (JSZip) needed
- The envelope is self-contained with integrity hash
- Migration path: V2 can switch to ZIP (`bundleVersion: 2`) with multi-file structure (entities.json, layouts.json, assets/) if snapshot size warrants it

> **NOTE**: This deviates from the spec's mention of "archive with multiple JSON files." This was a conscious V1 simplification. If the user requires ZIP format from the start, update `bundleVersion` handling and add JSZip dependency.

### Reuse Strategy: `@universo/template-mui` Components

**Chosen: Integrate existing components** rather than creating new `RuntimeToolbar`/`RuntimeCardGrid`. Rationale:
- `ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `FlowListTable`, `PaginationControls` are already proven across 8+ entity lists
- `useViewPreference` provides SSR-safe localStorage persistence
- `ToolbarControls` already supports split-button with dropdown (same pattern needed for Import)
- Avoids maintaining two parallel toolbar/card implementations

> **(v3)**: `PaginationControls` uses `{ pagination: PaginationState, actions: PaginationActions }` interface — NOT MUI TablePagination props. Phase 4.4 includes a pagination state/actions adapter that bridges DataGrid's paginationModel to this interface.

> **(v3)**: `@universo/template-mui` must be added as an explicit dependency of `apps-template-mui` (currently missing). Phase 4.0 handles this.

### Import at Metahub Level

**Chosen: Primary import on MetahubList Create dropdown** + secondary on publication version list. Rationale:
- Spec explicitly says "при создании метахаба... опцию у кнопки 'Создать', выпадающий вариант 'Импорт'"
- `ToolbarControls.primaryActionMenuItems` already supports this exact dropdown pattern (used in HubList, CatalogList, SetList)
- Import creates a complete new metahub (not just a publication version)
- The SnapshotRestoreService handles full entity restoration from snapshot

### Validation: Zod over Manual Checks

**Chosen: Zod schema** for envelope validation. Rationale:
- Project standard — all API input validated with Zod
- Type-safe parsed result (no `as unknown as` casts)
- Better error messages for end users
- Single source of truth for type + runtime validation

> **(v3)**: Validation is defense-in-depth with 5 layers: (1) nesting depth check, (2) prototype pollution sanitization, (3) Zod structural validation, (4) SHA-256 integrity hash, (5) entity count limits. The `snapshot` field now requires `version`, `metahubId`, `entities` at minimum instead of accepting any object.

### Hash Compatibility Strategy (NEW in v3)

**Chosen: Reuse `normalizePublicationSnapshotForHash()`** from `@universo/utils/serialization`. Rationale:
- `SnapshotSerializer.calculateHash()` already uses this normalization (sorts entities, fields, elements deterministically; normalizes absent optional keys)
- A naïve `stableStringify(rawSnapshot)` would produce **different** hashes for the same logical snapshot
- Export path: `computeSnapshotHash()` → `normalizePublicationSnapshotForHash()` → `stableStringify()` → SHA-256
- Import verification: re-hash imported snapshot using the same pipeline → compare with `envelope.snapshotHash`
- Round-trip guarantee: `SnapshotSerializer.calculateHash(snap) === computeSnapshotHash(snap)`

### Future Scope (Not in V1)

- **Workspaces / Multi-user** — the spec mentions "функционал рабочих пространств." This is a separate large feature requiring workspace entity modeling, permission scoping, and UI. Documented here as V2 scope.
- **ZIP archive with multi-file structure** — V2 if snapshot sizes warrant it
- **Server-side search** — V2 for datasets > 1000 rows
- **Layout full-page editing redesign** — Current LayoutDetails page is already a full page; modal is used only for metadata. V2 may redesign the metadata flow if needed.
