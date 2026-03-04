# Creative Design: Metahub Template System

> **Status:** Design Complete — Ready for PLAN  
> **Complexity:** Level 4 (Major/Complex)  
> **Scope:** metahubs-backend, schema-ddl, metahubs-frontend, universo-core-backend (entities/migrations)

---

## 1. Problem Statement

Currently, `MetahubSchemaService.initSystemTables()` hardcodes the creation of 6 system tables and seeds default layout/widget data via imperative Knex calls (~470 lines). This makes it impossible to:

- Offer different "starter templates" (CRM, E-commerce, Blank, etc.)
- Version and track structural changes to the system table DDL
- Seed default content declaratively from JSON
- Let users choose a template when creating a new metahub

The goal is to replace this hardcoded logic with a **JSON-driven template system** that separates structure (DDL) from content (seed data) and supports versioning for both.

---

## 2. Existing Formats Analysis

### 2.1 MetahubSnapshot (version: 1) — Publication-Level

**File:** `SnapshotSerializer.ts`  
**Purpose:** Captures the CONTENT state of a metahub at publication time.

```
MetahubSnapshot
├─ version: 1
├─ metahubId: string
├─ generatedAt: string
├─ entities: Record<id, MetaEntitySnapshot>  ← catalogs + hubs with fields
├─ elements?: Record<objectId, MetaElementSnapshot[]>  ← predefined data rows
├─ layouts?: MetahubLayoutSnapshot[]  ← UI layout definitions
├─ layoutZoneWidgets?: MetahubLayoutZoneWidgetSnapshot[]  ← widget assignments
├─ defaultLayoutId?: string
└─ layoutConfig?: Record<string, unknown>
```

**Key traits:**
- Uses real UUIDs as identifiers (runtime artifacts)
- Captures user-created content (catalogs, attributes, elements, layouts)
- Does NOT describe the DDL of the 6 system tables themselves
- Stored in `publication_versions.snapshot_json` as JSONB

### 2.2 SchemaSnapshot (current version) — Application DDL Level

**File:** `schema-ddl/src/types.ts`  
**Purpose:** Captures the physical DDL state of user-created tables in application schemas.

```
SchemaSnapshot
├─ version: current
├─ generatedAt: string
├─ hasSystemTables: boolean
└─ entities: Record<id, SchemaEntitySnapshot>
   ├─ kind, codename, tableName
   └─ fields: Record<id, SchemaFieldSnapshot>
      └─ codename, columnName, dataType, isRequired, targetEntityId
```

**Key traits:**
- Physical DDL representation (column names, data types)
- Used by `SchemaMigrator` for diff-based migrations of application schemas
- Does NOT include system table DDL, layout data, or element data

### 2.3 System Tables DDL (Currently HARDCODED)

**File:** `MetahubSchemaService.ts`, method `initSystemTables()`  
**6 tables:** `_mhb_objects`, `_mhb_attributes`, `_mhb_elements`, `_mhb_settings`, `_mhb_layouts`, `_mhb_widgets`

**Key traits:**
- All tables share identical `_upl_*` and `_mhb_*` system field sets
- Each table has specific business columns + custom indexes
- Seed data: default "Dashboard" layout with 22 zone widgets from `layoutDefaults.ts`
- This layer is NOT captured by either existing snapshot format

### 2.4 Three-Layer Model Discovery

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: System Tables DDL                              │
│   _mhb_objects, _mhb_attributes, _mhb_elements, ...    │
│   WHO CHANGES IT: Platform developers (code releases)   │
│   CAPTURED BY: Nothing (hardcoded in code)     ← GAP    │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Default Content (Seed Data)                    │
│   Default layout "Dashboard", 22 zone widgets,          │
│   default settings, optional starter entities           │
│   WHO CHANGES IT: Template authors                      │
│   CAPTURED BY: Nothing (hardcoded in code)     ← GAP    │
├─────────────────────────────────────────────────────────┤
│ Layer 3: User Content                                   │
│   User-created catalogs, attributes, elements, layouts  │
│   WHO CHANGES IT: Metahub users (design-time)           │
│   CAPTURED BY: MetahubSnapshot (at publication)          │
└─────────────────────────────────────────────────────────┘
```

The template system needs to fill Layers 1 and 2.

---

## 3. Design Topic: Structure Version

### Objectives
Define a versioning scheme for the DDL of system tables that allows tracking changes over time and migrating existing metahub schemas.

### Option A: Structure DDL in JSON (table definitions as data)

Encode every system table's columns, indexes, and constraints in JSON within the template.

**Pros:**
- Fully declarative, template is self-contained
- Could theoretically support arbitrary table structures per template

**Cons:**
- Extremely verbose (~200+ lines of JSON per table × 6 tables = 1200+ lines just for DDL)
- System fields (`_upl_*`, `_mhb_*`) are identical across all tables — massive duplication
- Custom indexes require expressing raw SQL in JSON — fragile and error-prone
- Every template would need to repeat the exact same DDL structure
- Two sources of truth: JSON definition + code that interprets it

### Option B: Structure version as integer, DDL stays in code ← CHOSEN

Structure version is a monotonically increasing integer managed in code. Each version maps to a TypeScript handler that knows how to create/migrate system tables. Templates only declare a compatibility floor (`minStructureVersion`).

**Pros:**
- System table DDL remains in TypeScript/Knex — the right tool for the job
- No duplication of system field definitions across JSON templates
- Clean separation: code owns structure, JSON owns content
- Migration between structure versions is a well-understood pattern (like DB migrations)
- Templates are small and focused on seed data

**Cons:**
- Templates can't define entirely custom system tables (acceptable — system tables are platform infrastructure)

### Decision: Option B

**Rationale:** System tables are platform infrastructure, not template-level customization. The DDL of `_mhb_objects` should never differ between a "CRM" template and an "E-commerce" template — only the CONTENT inside those tables differs. Structure version is an internal platform concern; templates just declare compatibility.

### Structure Version Design

```typescript
// In MetahubSchemaService or a dedicated StructureVersionRegistry

const CURRENT_STRUCTURE_VERSION = 1

interface StructureVersionSpec {
  version: number
  tables: string[]
  description: string
  init: (knex: Knex, schemaName: string) => Promise<void>
  migrateFrom?: Map<number, (knex: Knex, schemaName: string) => Promise<void>>
}

// Registry
const structureVersions: Map<number, StructureVersionSpec> = new Map([
  [1, {
    version: 1,
    tables: [
      '_mhb_objects', '_mhb_attributes', '_mhb_elements',
      '_mhb_settings', '_mhb_layouts', '_mhb_widgets'
    ],
    description: 'Initial system tables: objects, attributes, elements, settings, layouts, zone widgets',
    init: initSystemTablesV1  // extracted from current initSystemTables()
  }]
])
```

**Future example (v2):**
```typescript
[2, {
  version: 2,
  tables: [...v1.tables, '_mhb_documents', '_mhb_workflows'],
  description: 'Added documents and workflows tables',
  init: initSystemTablesV2,
  migrateFrom: new Map([
    [1, migrateV1toV2]  // adds _mhb_documents and _mhb_workflows to existing schema
  ])
}]
```

### Metahub Branch Tracking

The `metahubs_branches` table gets a new column `structure_version INTEGER NOT NULL DEFAULT 1` to track which structure version a branch's schema was created with. This enables future migration detection: "branch schema is v1, current code supports v2 → migration needed".

---

## 4. Design Topic: Template JSON Format (MetahubTemplateManifest)

### Objectives
Define a JSON format for metahub templates that:
1. Describes seed data declaratively
2. Uses codenames (not UUIDs) for cross-references
3. Is compatible with but distinct from MetahubSnapshot
4. Is versioned with SemVer

### Option A: Template seed IS MetahubSnapshot with placeholder IDs

Re-use MetahubSnapshot format directly, with synthetic UUIDs that get replaced at creation time.

**Pros:** Same format everywhere, minimal new types  
**Cons:** UUIDs are runtime artifacts — using them in a template authored by a developer is unnatural and error-prone. Need UUID replacement logic. Confusing semantics.

### Option B: Codename-based reference format ← CHOSEN

Template seed uses codenames and sortOrder for references instead of UUIDs. IDs are generated at runtime by the seed executor.

**Pros:** Clean, declarative, developer-friendly. Codenames are stable identifiers. No fake UUIDs.  
**Cons:** Different from MetahubSnapshot — requires conversion logic. But the conversion is simple and one-directional.

### Decision: Option B

### Full MetahubTemplateManifest Schema

```typescript
/**
 * Root template manifest — stored as JSON file in the codebase
 * and as JSONB in templates_versions.manifest_json.
 */
interface MetahubTemplateManifest {
  /** Template manifest format version (for future schema evolution) */
  $schema: 'metahub-template/v1'

  /** Unique template identifier (lowercase, hyphens OK) */
  codename: string  // e.g., "basic", "crm", "ecommerce"

  /** SemVer version of this template revision */
  version: string   // e.g., "1.0.0"

  /** Minimum structure version required by this template */
  minStructureVersion: number  // e.g., 1

  /** Localized template name (VLC format) */
  name: VersionedLocalizedContent<string>

  /** Localized template description (VLC format) */
  description?: VersionedLocalizedContent<string>

  /** Template metadata */
  meta?: {
    author?: string
    tags?: string[]     // e.g., ["starter", "dashboard"]
    icon?: string       // MUI icon name, e.g., "Dashboard"
    previewUrl?: string // screenshot/preview image URL
  }

  /** Seed data — everything that gets created in the metahub branch schema */
  seed: MetahubTemplateSeed
}

/**
 * Seed data section — all content that populates system tables.
 * Uses CODENAMES for cross-references, not UUIDs.
 */
interface MetahubTemplateSeed {
  /** Layout definitions */
  layouts: TemplateSeedLayout[]

  /**
   * Zone widget assignments, grouped by layout codename.
   * Key = layout codename from layouts[].codename
   */
  layoutZoneWidgets: Record<string, TemplateSeedZoneWidget[]>

  /** Default settings key/value pairs */
  settings?: TemplateSeedSetting[]

  /**
   * Starter entity definitions (catalogs, hubs).
   * Optional — "blank" template has none.
   */
  entities?: TemplateSeedEntity[]

  /**
   * Predefined element data, grouped by entity codename.
   * Key = entity codename from entities[].codename
   */
  elements?: Record<string, TemplateSeedElement[]>
}

// ─── Seed Sub-types ─────────────────────────────────────────

interface TemplateSeedLayout {
  /** Codename for cross-referencing (unique within template) */
  codename: string        // e.g., "dashboard"
  templateKey: string     // layout template type, e.g., "dashboard"
  name: VersionedLocalizedContent<string>
  description?: VersionedLocalizedContent<string> | null
  isDefault: boolean
  isActive: boolean
  sortOrder: number
  /** Config is auto-generated from zone widgets — can be omitted or overridden */
  config?: Record<string, unknown>
}

interface TemplateSeedZoneWidget {
  zone: string            // e.g., "left", "top", "center", "right", "bottom"
  widgetKey: string       // e.g., "brandSelector", "menuWidget"
  sortOrder: number
  config?: Record<string, unknown>
}

interface TemplateSeedSetting {
  key: string
  value: Record<string, unknown> | string | number | boolean
}

interface TemplateSeedEntity {
  codename: string
  kind: 'CATALOG' | 'HUB' | 'DOCUMENT'
  name: VersionedLocalizedContent<string>
  description?: VersionedLocalizedContent<string>
  config?: Record<string, unknown>
  attributes?: TemplateSeedAttribute[]
  /** Hub codenames this entity belongs to (references entities[].codename) */
  hubs?: string[]
}

interface TemplateSeedAttribute {
  codename: string
  dataType: string        // AttributeDataType enum value
  name: VersionedLocalizedContent<string>
  description?: VersionedLocalizedContent<string>
  isRequired?: boolean
  isDisplayAttribute?: boolean
  sortOrder?: number
  /** Target entity codename for REF fields (not UUID!) */
  targetEntityCodename?: string
  targetEntityKind?: string
  validationRules?: Record<string, unknown>
  uiConfig?: Record<string, unknown>
}

interface TemplateSeedElement {
  /** Codename for idempotent seeding (unique within entity) */
  codename: string
  data: Record<string, unknown>
  sortOrder: number
}
```

### Example: "basic" Template JSON

```json
{
  "$schema": "metahub-template/v1",
  "codename": "basic",
  "version": "1.0.0",
  "minStructureVersion": 1,
  "name": {
    "_schema": "1",
    "_primary": "en",
    "locales": {
      "en": { "content": "Basic", "version": 1, "isActive": true },
      "ru": { "content": "Базовый", "version": 1, "isActive": true }
    }
  },
  "description": {
    "_schema": "1",
    "_primary": "en",
    "locales": {
      "en": { "content": "Default template with dashboard layout and standard widgets", "version": 1, "isActive": true },
      "ru": { "content": "Шаблон по умолчанию с макетом дашборда и стандартными виджетами", "version": 1, "isActive": true }
    }
  },
  "meta": {
    "author": "universo-platform",
    "tags": ["starter", "dashboard"],
    "icon": "Dashboard"
  },
  "seed": {
    "layouts": [
      {
        "codename": "dashboard",
        "templateKey": "dashboard",
        "name": { "_schema": "1", "_primary": "en", "locales": { "en": { "content": "Dashboard", "version": 1, "isActive": true }, "ru": { "content": "Дашборд", "version": 1, "isActive": true } } },
        "description": { "_schema": "1", "_primary": "en", "locales": { "en": { "content": "Default layout for published applications", "version": 1, "isActive": true }, "ru": { "content": "Макет по умолчанию для опубликованных приложений", "version": 1, "isActive": true } } },
        "isDefault": true,
        "isActive": true,
        "sortOrder": 0
      }
    ],
    "layoutZoneWidgets": {
      "dashboard": [
        { "zone": "left", "widgetKey": "brandSelector", "sortOrder": 1 },
        { "zone": "left", "widgetKey": "divider", "sortOrder": 2 },
        { "zone": "left", "widgetKey": "menuWidget", "sortOrder": 3, "config": { "showTitle": true, "title": { "...VLC..." : "Main / Главное" }, "autoShowAllCatalogs": true, "items": [] } },
        { "zone": "left", "widgetKey": "spacer", "sortOrder": 4 },
        { "zone": "left", "widgetKey": "divider", "sortOrder": 5 },
        { "zone": "left", "widgetKey": "infoCard", "sortOrder": 6 },
        { "zone": "left", "widgetKey": "userProfile", "sortOrder": 7 },
        { "zone": "top", "widgetKey": "appNavbar", "sortOrder": 1 },
        { "zone": "top", "widgetKey": "header", "sortOrder": 2 },
        { "zone": "top", "widgetKey": "breadcrumbs", "sortOrder": 3 },
        { "zone": "top", "widgetKey": "search", "sortOrder": 4 },
        { "zone": "top", "widgetKey": "datePicker", "sortOrder": 5 },
        { "zone": "top", "widgetKey": "optionsMenu", "sortOrder": 6 },
        { "zone": "center", "widgetKey": "overviewTitle", "sortOrder": 1 },
        { "zone": "center", "widgetKey": "overviewCards", "sortOrder": 2 },
        { "zone": "center", "widgetKey": "sessionsChart", "sortOrder": 3 },
        { "zone": "center", "widgetKey": "pageViewsChart", "sortOrder": 4 },
        { "zone": "center", "widgetKey": "detailsTitle", "sortOrder": 5 },
        { "zone": "center", "widgetKey": "detailsTable", "sortOrder": 6 },
        { "zone": "right", "widgetKey": "detailsSidePanel", "sortOrder": 1 },
        { "zone": "bottom", "widgetKey": "footer", "sortOrder": 1 }
      ]
    }
  }
}
```

---

## 5. Design Topic: Unification with Publication Snapshot

### Problem

We now have two "snapshot" concepts:
1. **MetahubTemplateManifest** — seed data for creating new metahubs (codename-based)
2. **MetahubSnapshot** — captured state at publication time (UUID-based)

They describe overlapping data (layouts, widgets, entities, elements) but with different ID conventions.

### Unification Strategy: Shared Conceptual Model, Different ID Schemes

Rather than force one format to be the other, we establish a **directional conversion pipeline**:

```
    ┌───────────────────────┐
    │ MetahubTemplateManifest│  ← Authored by developers (codenames)
    │  (source format)       │
    └───────────┬───────────┘
                │ TemplateSeedExecutor.apply()
                │ (generates UUIDs, inserts into system tables)
                ▼
    ┌───────────────────────┐
    │  System Tables (DB)    │  ← Runtime state (real UUIDs)
    │  _mhb_layouts, etc.   │
    └───────────┬───────────┘
                │ SnapshotSerializer.serializeMetahub()
                │ (reads from DB, converts to snapshot)
                ▼
    ┌───────────────────────┐
    │   MetahubSnapshot      │  ← Captured at publication (UUIDs)
    │   (publication format) │
    └───────────────────────┘
                │ (future) TemplateExporter.export()
                │ (converts UUIDs → codenames)
                ▼
    ┌───────────────────────┐
    │ MetahubTemplateManifest│  ← Auto-generated template (codenames)
    │   (exported)           │
    └───────────────────────┘
```

### Shared Interfaces

Both formats share the same VLC, widget key, zone, and data type vocabularies. The differences are only:

| Aspect          | TemplateManifest        | MetahubSnapshot          |
|-----------------|------------------------|--------------------------|
| Entity IDs      | codename (string)      | UUID                     |
| Field IDs       | codename (string)      | UUID                     |
| Layout IDs      | codename (string)      | UUID                     |
| Cross-references| by codename            | by UUID                  |
| Elements        | by entity codename     | by object UUID           |
| Purpose         | Create new metahub     | Capture existing state   |

### No Breaking Changes to MetahubSnapshot

MetahubSnapshot (v1) remains unchanged. The template format is a NEW complementary format. In the future, we may bump MetahubSnapshot to v2 to add template provenance metadata, but that's not required for MVP.

---

## 6. Design Topic: DB Tables

### 6.1 New Table: `metahubs.templates`

```sql
CREATE TABLE metahubs.templates (
    id          UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    codename    VARCHAR(100) NOT NULL,
    name        JSONB NOT NULL DEFAULT '{}',
    description JSONB DEFAULT '{}',
    icon        VARCHAR(50),
    is_system   BOOLEAN NOT NULL DEFAULT false,       -- system templates can't be deleted by users
    is_active   BOOLEAN NOT NULL DEFAULT true,         -- soft enable/disable without deletion
    sort_order  INTEGER NOT NULL DEFAULT 0,
    active_version_id  UUID,                           -- FK to templates_versions.id (set after insert)

    -- _upl_* system fields (full set, same as other metahubs entities)
    _upl_created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by   UUID,
    _upl_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_by   UUID,
    _upl_version      INTEGER NOT NULL DEFAULT 1,
    _upl_archived     BOOLEAN NOT NULL DEFAULT false,
    _upl_archived_at  TIMESTAMPTZ,
    _upl_archived_by  UUID,
    _upl_deleted      BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted_at   TIMESTAMPTZ,
    _upl_deleted_by   UUID,
    _upl_purge_after  TIMESTAMPTZ,
    _upl_locked       BOOLEAN NOT NULL DEFAULT false,
    _upl_locked_at    TIMESTAMPTZ,
    _upl_locked_by    UUID,
    _upl_locked_reason TEXT
);

-- Partial unique on codename (excluding soft-deleted)
CREATE UNIQUE INDEX idx_templates_codename_active
    ON metahubs.templates (codename) WHERE _upl_deleted = false;
```

**Note:** No `_mhb_*` fields — templates are platform-level entities, not scoped to a specific metahub.

### 6.2 New Table: `metahubs.templates_versions`

```sql
CREATE TABLE metahubs.templates_versions (
    id              UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    template_id     UUID NOT NULL REFERENCES metahubs.templates(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    version_label   VARCHAR(20) NOT NULL,             -- SemVer string: "1.0.0"
    min_structure_version INTEGER NOT NULL DEFAULT 1,
    manifest_json   JSONB NOT NULL,                   -- Full MetahubTemplateManifest
    manifest_hash   VARCHAR(64) NOT NULL,             -- SHA-256 for deduplication
    is_active       BOOLEAN NOT NULL DEFAULT false,
    changelog       JSONB,                            -- Optional: what changed from previous version

    -- _upl_* system fields (full set)
    _upl_created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by   UUID,
    _upl_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_by   UUID,
    _upl_version      INTEGER NOT NULL DEFAULT 1,
    _upl_archived     BOOLEAN NOT NULL DEFAULT false,
    _upl_archived_at  TIMESTAMPTZ,
    _upl_archived_by  UUID,
    _upl_deleted      BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted_at   TIMESTAMPTZ,
    _upl_deleted_by   UUID,
    _upl_purge_after  TIMESTAMPTZ,
    _upl_locked       BOOLEAN NOT NULL DEFAULT false,
    _upl_locked_at    TIMESTAMPTZ,
    _upl_locked_by    UUID,
    _upl_locked_reason TEXT,

    CONSTRAINT uq_template_version UNIQUE (template_id, version_number)
);
```

### 6.3 Alter Table: `metahubs.metahubs`

Add template provenance columns:

```sql
ALTER TABLE metahubs.metahubs
    ADD COLUMN template_id         UUID REFERENCES metahubs.templates(id),
    ADD COLUMN template_version_id UUID REFERENCES metahubs.templates_versions(id);
```

These are nullable — existing metahubs (before templates) can have NULL.

### 6.4 Alter Table: `metahubs.metahubs_branches`

Add structure version tracking:

```sql
ALTER TABLE metahubs.metahubs_branches
    ADD COLUMN structure_version INTEGER NOT NULL DEFAULT 1;
```

### 6.5 Rename: `publication_versions` → `publications_versions`

For naming consistency (plural parent + plural child). Clean-slate — no backward compatibility needed.

**Changes required:**
- Migration DDL: rename table
- TypeORM entity: `@Entity({ name: 'publications_versions' })`
- All route/service code referencing the old name

---

## 7. Design Topic: Seed-at-Startup Mechanism

### Flow

```
Application Start
      │
      ▼
TypeORM Migrations run
(creates metahubs schema, templates/templates_versions tables)
      │
      ▼
TemplateSeeder.seed() is called
      │
      ▼
Read JSON files from filesystem:
  packages/metahubs-backend/base/src/templates/*.template.json
      │
      ▼
For each template JSON file:
  1. Parse and validate against MetahubTemplateManifest schema
  2. Calculate SHA-256 hash of normalized manifest
  3. Look up template by codename
  4. If not found:
     a. INSERT into metahubs.templates
     b. INSERT into metahubs.templates_versions (version_number=1)
     c. UPDATE templates.active_version_id
  5. If found:
     a. Compare hash with active version's manifest_hash
     b. If same → SKIP (idempotent, no changes)
     c. If different:
        i.  INSERT new templates_versions row (version_number = max+1)
        ii. UPDATE templates.active_version_id
        iii. Log the update
  6. Log summary of seed results
```

### Integration Point

```typescript
// In packages/metahubs-backend/base/src/index.ts or startup hook

import { TemplateSeeder } from './domains/templates/services/TemplateSeeder'

// After DataSource initialization, before HTTP server starts
const seeder = new TemplateSeeder(dataSource)
await seeder.seed()
```

### Hash Calculation

Same approach as `SnapshotSerializer.calculateHash()`:
- Normalize the manifest (sort arrays, strip volatile fields like `generatedAt`)
- Use `json-stable-stringify` → SHA-256

### Error Handling

- Invalid JSON → log error, skip file, continue with other templates
- DB write failure → log error, do NOT crash the server (templates are not critical for startup)
- Always log: number of templates processed, created, updated, skipped

### Filesystem Location

```
packages/metahubs-backend/base/src/templates/
├── basic.template.json        ← "Basic" starter template
├── index.ts                   ← exports template file paths for seeder
└── (future) crm.template.json
```

---

## 8. Design Topic: MetahubSchemaService Refactoring

### Current Flow

```
ensureSchema(metahubId)
  → createSchemaIfNotExists(schemaName)
  → initSystemTables(schemaName)   ← HARDCODED DDL + seed data
```

### New Flow

```
ensureSchema(metahubId, templateVersionId?)
  → createSchemaIfNotExists(schemaName)
  → initSystemTables(schemaName, structureVersion)    ← DDL from structure version registry
  → seedFromTemplate(schemaName, templateManifest)    ← seed data from template JSON
```

### Decoupled Responsibilities

```typescript
class MetahubSchemaService {
  // Existing: creates PostgreSQL schema
  async ensureSchema(metahubId: string, templateVersionId?: string): Promise<void> { }

  // REFACTORED: creates ONLY system tables DDL (no seed data)
  private async initSystemTables(schemaName: string, structureVersion: number): Promise<void> {
    const handler = structureVersionRegistry.get(structureVersion)
    if (!handler) throw new Error(`Unknown structure version: ${structureVersion}`)
    await handler.init(this.knex, schemaName)
  }

  // NEW: populates system tables from template manifest
  private async seedFromTemplate(schemaName: string, manifest: MetahubTemplateManifest): Promise<void> {
    const executor = new TemplateSeedExecutor(this.knex, schemaName)
    await executor.apply(manifest.seed)
  }
}
```

### TemplateSeedExecutor

```typescript
class TemplateSeedExecutor {
  constructor(private knex: Knex, private schemaName: string) {}

  async apply(seed: MetahubTemplateSeed): Promise<void> {
    // 1. Create layouts (generate UUIDs, build code→id map)
    const layoutIdMap = await this.createLayouts(seed.layouts)

    // 2. Create zone widgets (resolve layout codename → id)
    await this.createZoneWidgets(seed.layoutZoneWidgets, layoutIdMap)

    // 3. Create settings
    if (seed.settings) await this.createSettings(seed.settings)

    // 4. Create entities (catalogs, hubs) if any
    if (seed.entities) {
      const entityIdMap = await this.createEntities(seed.entities)
      // 5. Create elements if any
      if (seed.elements) await this.createElements(seed.elements, entityIdMap)
    }
  }
}
```

---

## 9. Design Topic: Metahub Creation Flow

### Current

```
POST /metahubs  →  create metahub record  →  create branch  →  (schema created lazily)
```

### New

```
POST /metahubs { ..., templateId?: string }
  → validate templateId (if missing, use default "basic" template)
  → resolve active template version
  → create metahub record (with template_id, template_version_id)
  → create branch (with structure_version from template)
  → (schema still created lazily, but now uses template)
```

### Schema Creation (Lazy, Updated)

```
ensureSchema(metahubId)
  → lookup metahub.templateVersionId
  → fetch manifest from templates_versions
  → initSystemTables(schemaName, manifest.minStructureVersion)
  → seedFromTemplate(schemaName, manifest)
```

---

## 10. Design Topic: Frontend Template Selection UX

### MVP Scope

In the "Create Metahub" dialog, add a template selector:

```
┌─────────────────────────────────────────────────┐
│           Создание нового метахаба               │
│                                                  │
│  Название:     [_______________________]         │
│  Кодовое имя:  [_______________________]         │
│  Описание:     [_______________________]         │
│                                                  │
│  Шаблон:                                         │
│  ┌─────────────────────────────────────────┐     │
│  │ ◉ 📊 Базовый (1.0.0)                   │     │
│  │   Шаблон по умолчанию с дашбордом       │     │
│  │                                          │     │
│  │ ○ 📋 CRM (1.0.0)                        │     │
│  │   Управление контактами и сделками       │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│                   [ Создать ]  [ Отмена ]         │
└─────────────────────────────────────────────────┘
```

### API Endpoint for Templates List

```
GET /api/v1/metahubs/templates
→ [
    {
      id: "uuid",
      codename: "basic",
      name: { ...VLC... },
      description: { ...VLC... },
      icon: "Dashboard",
      version: "1.0.0",
      isSystem: true
    }
  ]
```

### Implementation Notes

- Template selector is a radio-button list or card selector
- Default selection: the first system template marked `is_system: true` and `sort_order: 0`
- If only one template exists, the selector auto-selects it and can be hidden
- POST /metahubs body adds optional `templateId` field
- Frontend package: `packages/metahubs-frontend/base/`

---

## 11. New TypeORM Entities

### Template.ts

```typescript
@Entity({ name: 'templates', schema: 'metahubs' })
export class Template {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ type: 'varchar', length: 100 }) codename!: string
  @Column({ type: 'jsonb', default: {} }) name!: VersionedLocalizedContent<string>
  @Column({ type: 'jsonb', nullable: true }) description?: VersionedLocalizedContent<string>
  @Column({ type: 'varchar', length: 50, nullable: true }) icon?: string
  @Column({ name: 'is_system', type: 'boolean', default: false }) isSystem!: boolean
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean
  @Column({ name: 'sort_order', type: 'integer', default: 0 }) sortOrder!: number
  @Column({ name: 'active_version_id', type: 'uuid', nullable: true }) activeVersionId?: string
  // ... full _upl_* fields (no _mhb_* fields)
}
```

### TemplateVersion.ts

```typescript
@Entity({ name: 'templates_versions', schema: 'metahubs' })
export class TemplateVersion {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'template_id', type: 'uuid' }) templateId!: string
  @Column({ name: 'version_number', type: 'integer' }) versionNumber!: number
  @Column({ name: 'version_label', type: 'varchar', length: 20 }) versionLabel!: string
  @Column({ name: 'min_structure_version', type: 'integer', default: 1 }) minStructureVersion!: number
  @Column({ name: 'manifest_json', type: 'jsonb' }) manifestJson!: MetahubTemplateManifest
  @Column({ name: 'manifest_hash', type: 'varchar', length: 64 }) manifestHash!: string
  @Column({ name: 'is_active', type: 'boolean', default: false }) isActive!: boolean
  @Column({ type: 'jsonb', nullable: true }) changelog?: Record<string, unknown>
  // ... full _upl_* fields (no _mhb_* fields)
}
```

---

## 12. Files to Create/Modify Summary

### New Files

| File | Purpose |
|------|---------|
| `metahubs-backend/.../templates/basic.template.json` | "Basic" template JSON manifest |
| `metahubs-backend/.../templates/index.ts` | Template file path exports |
| `metahubs-backend/.../domains/templates/services/TemplateSeeder.ts` | Seed-at-startup service |
| `metahubs-backend/.../domains/templates/services/TemplateSeedExecutor.ts` | Applies seed data to schema |
| `metahubs-backend/.../domains/templates/services/TemplateManifestValidator.ts` | JSON schema validation |
| `metahubs-backend/.../domains/templates/routes/templatesRoutes.ts` | GET /templates endpoint |
| `metahubs-backend/.../domains/templates/types.ts` | TypeScript interfaces for manifest |
| `metahubs-backend/.../database/entities/Template.ts` | TypeORM entity |
| `metahubs-backend/.../database/entities/TemplateVersion.ts` | TypeORM entity |
| New migration file | DDL for templates, templates_versions, metahub alterations |

### Modified Files

| File | Change |
|------|--------|
| `MetahubSchemaService.ts` | Extract DDL to structure version handlers; add seedFromTemplate() |
| `metahubsRoutes.ts` (POST /metahubs) | Accept templateId, pass to creation flow |
| `Metahub.ts` entity | Add templateId, templateVersionId columns |
| `MetahubBranch.ts` entity | Add structureVersion column |
| `PublicationVersion.ts` entity | Rename table to `publications_versions` |
| `entities/index.ts` | Register Template, TemplateVersion |
| `layoutDefaults.ts` | Extract data into basic.template.json (file becomes a thin re-export or is removed) |
| Migration file | Add new tables, alter existing, rename publication_versions |
| Frontend: Create Metahub dialog | Add template selector UI |

---

## 13. Migration Strategy

Since the user confirmed **clean-slate** (test DB will be dropped and recreated):

1. **Single new migration** that adds templates, templates_versions tables + alters metahubs + renames publication_versions
2. No backward-compatible migration path needed
3. Existing migration `1766351182000-CreateMetahubsSchema.ts` can be MODIFIED directly (or superseded) since there's no production data to preserve

---

## 14. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Template JSON validation errors at startup | Use Zod schema for validation; log and skip invalid files |
| Template seed fails mid-way (partial data) | Wrap seedFromTemplate in a database transaction |
| Structure version mismatch | Validate `minStructureVersion <= CURRENT_STRUCTURE_VERSION` at seed time |
| Circular references in seed entities | Seed entities in kind-order: hubs first, then catalogs (hubs have no dependencies) |
| Large template files slow down startup | Cache hash comparison; skip if unchanged (idempotent) |

---

## 15. Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Structure DDL format | Code (Option B) | System tables are platform infra, not template content |
| Template ID scheme | Codenames (Option B) | Developer-friendly, UUIDs are runtime artifacts |
| Snapshot unification | Shared model, different ID schemes | Clean directional conversion pipeline |
| Template storage | DB (templates + templates_versions) | Enables API access, versioning, activation |
| Seed mechanism | JSON files → startup upsert | Simple, idempotent, no external dependencies |
| _mhb_* fields on templates | None | Templates are platform-level, not metahub-scoped |
| Clean-slate migration | Single migration, modify existing | User confirmed test DB will be recreated |

---

## Appendix A: Full Type System Diagram

```
MetahubTemplateManifest (authored, codename-based)
  │
  ├── seed.layouts[] ──────────┐
  ├── seed.layoutZoneWidgets{} │
  ├── seed.settings[]          ├── TemplateSeedExecutor.apply()
  ├── seed.entities[]          │   (generates UUIDs, INSERTs)
  └── seed.elements{}  ────────┘
                                    │
                                    ▼
                          System Tables (runtime, UUID-based)
                          _mhb_objects, _mhb_attributes, ...
                          _mhb_layouts, _mhb_widgets, ...
                                    │
                                    ├── SnapshotSerializer.serialize()
                                    ▼
                          MetahubSnapshot (publication, UUID-based)
                            stored in publications_versions.snapshot_json
```

## Appendix B: Structure Version vs Template Version

```
Structure Version (integer, owned by code):
  v1: _mhb_objects, _mhb_attributes, _mhb_elements,
      _mhb_settings, _mhb_layouts, _mhb_widgets
  next: (future) + _mhb_documents, _mhb_workflows

Template Version (SemVer, owned by JSON files):
  basic 1.0.0: dashboard layout + 22 standard widgets
  basic 1.0.x: (future) + updated widget set
  crm   1.0.0: (future) dashboard + contacts catalog + deals catalog
```

**Independence:** Structure versions and template versions evolve independently. A template's `minStructureVersion` ensures it doesn't run on an older platform that lacks required tables.
