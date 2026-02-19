# @universo/metahubs-backend

> ✨ **Modern Package** — TypeScript-first architecture with Express.js, TypeORM, Knex and Zod

Backend service for managing metahubs, hubs, catalogs, attributes, elements, memberships, templates, and dynamic DDL schemas with strict metahub-level isolation.

## Package Information

| Field | Value |
|-------|-------|
| **Version** | 0.1.0 |
| **Type** | Backend Service Package (TypeScript) |
| **Status** | ✅ Active Development |
| **Architecture** | Express.js + TypeORM + Knex + Zod |
| **Package Name** | `@universo/metahubs-backend` |

## Key Features

### Domain Model
- **Metahubs** — Top-level organizational units with complete data isolation
- **Hubs** — Content containers within metahubs (N:M relationship with Catalogs)
- **Catalogs** — Schema definitions for structured data (N:M relationship with Hubs)
- **Attributes** — Field definitions within catalogs
- **Elements** — Data entries conforming to catalog schemas (JSONB)
- **Memberships** — User-metahub membership with roles and permissions
- **Templates** — Reusable metahub blueprints with versioned manifests
- **Branches** — Isolated PostgreSQL schemas per metahub branch (`mhb_<uuid>_b<n>`)

### Declarative DDL & System Tables
- **Typed Definitions** — All system tables described as `SystemTableDef` data structures instead of imperative Knex code
- **Shared Field Sets** — `_upl_*` (platform audit) and `_mhb_*` (metahub lifecycle) fields defined once, appended to all tables automatically
- **Version Registry** — `SYSTEM_TABLE_VERSIONS` map associates each version number with its complete table set
- **DDL Generator** — `SystemTableDDLGenerator` converts declarative definitions into Knex DDL (idempotent, skips existing tables)

### Migration Engine

Safe, additive-only migration system with advisory locks and full history tracking.

> **Full documentation**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

### Template System
- **Built-in Templates** — Pre-defined templates seeded at application startup (e.g., `basic` dashboard)
- **Versioned Manifests** — Each template version stores a full `MetahubTemplateManifest` with SHA-256 hash for change detection
- **Idempotent Seeding** — `TemplateSeeder` skips unchanged templates via hash comparison (`json-stable-stringify` + SHA-256)
- **Zod Validation** — Template manifests validated against strict Zod schemas before DB insertion
- **Auto-Assignment** — When creating a metahub without explicit `templateId`, the default template is auto-resolved
- **Fresh Seeding** — `TemplateSeedExecutor` populates empty branch schemas atomically within a single DB transaction
- **Incremental Seeding** — `TemplateSeedMigrator` adds only NEW seed items to existing schemas without overwriting user data

### Data Isolation & Security
- Complete metahub isolation — no cross-metahub data access
- Application-level authorization with metahub/hub/catalog guards
- Rate limiting protection against DoS attacks
- Optimistic locking with `_upl_version` counter for concurrent edit detection

### Structured Blockers & Migration Guard

i18n-ready structured blockers and migration guard endpoints. See [MIGRATIONS.md](MIGRATIONS.md) for details.

### ColumnsContainer Seed Config
- **Default layout seed** in `layoutDefaults.ts` includes `columnsContainer` widget in center zone
- **2-column default**: 9/12 width `detailsTable` + 3/12 width `productTree`
- **Config structure**: `ColumnsContainerConfig` type with `columns: ColumnsContainerColumn[]`
- **Per-column widgets**: `ColumnsContainerColumnWidget[]` supporting multiple widgets per column
- **buildDashboardLayoutConfig()** generates boolean flags from active widget list, zone-aware

## Installation

```bash
# Install from workspace root
pnpm install

# Build the package
pnpm --filter @universo/metahubs-backend build
```

## Usage

### Express Router Integration

```typescript
import express from 'express'
import { createMetahubsServiceRoutes, initializeRateLimiters } from '@universo/metahubs-backend'

const app = express()
app.use(express.json())

await initializeRateLimiters()

app.use('/api/v1', createMetahubsServiceRoutes(ensureAuth, getDataSource))

app.listen(3000)
```

Where:
- `ensureAuth` — your authentication middleware
- `getDataSource` — returns a TypeORM `DataSource`

### Template Seeding at Startup

Templates are seeded automatically when the application starts. The seeder is called from `flowise-core-backend`:

```typescript
import { seedTemplates } from '@universo/metahubs-backend'

// Call once after DataSource initialization
await seedTemplates(dataSource) // Idempotent — safe to call every startup
```

### Adding a New Template

1. Create a new file in `src/domains/templates/data/` (e.g., `catalog.template.ts`):

```typescript
import type { MetahubTemplateManifest, VersionedLocalizedContent } from '@universo/types'

const vlc = (en: string, ru: string): VersionedLocalizedContent<string> => ({
  _schema: '1', _primary: 'en',
  locales: {
    en: { content: en, version: 1, isActive: true, createdAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' },
    ru: { content: ru, version: 1, isActive: true, createdAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' }
  }
})

export const catalogTemplate: MetahubTemplateManifest = {
  $schema: 'metahub-template/v1',
  codename: 'catalog-manager',
  version: '1.0.0',
  minStructureVersion: 1,
  name: vlc('Catalog Manager', 'Менеджер каталогов'),
  description: vlc('Template for product catalog management', 'Шаблон для управления каталогами товаров'),
  meta: { author: 'universo-platformo', tags: ['catalog'], icon: 'Inventory' },
  seed: {
    layouts: [/* ... */],
    layoutZoneWidgets: {/* ... */},
    settings: [/* ... */],
    entities: [/* ... */]
  }
}
```

2. Register in `src/domains/templates/data/index.ts`:

```typescript
import { catalogTemplate } from './catalog.template'

export const builtinTemplates: MetahubTemplateManifest[] = [
  basicTemplate,
  catalogTemplate   // ← add here
]
```

3. The template will be auto-seeded on next application startup.

### Adding a New Structure Version / Updating Existing Metahubs

Step-by-step guides for adding new structure versions and how existing metahubs are auto-migrated (DDL changes, template updates, TypeORM entities).

> **Full documentation**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

## Architecture

### System Tables (per Branch Schema)

Each metahub branch gets an isolated PostgreSQL schema (`mhb_<uuid>_b<n>`) with these system tables:

| Table | Version | Description |
|-------|---------|-------------|
| `_mhb_objects` | V1 | Unified registry of objects (catalogs, hubs, documents) with presentation and config |
| `_mhb_attributes` | V1 | Field definitions with data types, validation rules, and UI configuration |
| `_mhb_elements` | V1 | Predefined data entries for catalogs (JSONB) |
| `_mhb_settings` | V1 | Key-value settings for branch configuration |
| `_mhb_layouts` | V1 | UI layouts for published applications (dashboard templates) |
| `_mhb_widgets` | V1 | Widget assignments per layout zone with sort order and config |
| `_mhb_migrations` | V1 | Migration history with version tracking and metadata |

All tables automatically include:
- **`_upl_*` fields** (16 columns) — platform-level audit trail, optimistic locking, soft delete, archive, record locking
- **`_mhb_*` fields** (9 columns) — metahub-level publication, archive, and soft delete

### Schema Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  Application Startup                                             │
│  TemplateSeeder.seed() → upsert templates into DB (idempotent)  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  MetahubSchemaService.ensureSchema(metahubId, userId)           │
│  1. Resolve branch (default or user-active)                      │
│  2. Acquire advisory lock                                        │
│  3. CREATE SCHEMA IF NOT EXISTS                                  │
│  4. initSystemTables() → DDL from structure version registry     │
│     └─ SystemTableDDLGenerator.createAll(tableDefs)             │
│  5. TemplateSeedExecutor.apply(seed) → populate seed data        │
│  6. Auto-migrate if structureVersion < CURRENT_STRUCTURE_VERSION │
│     ├─ SystemTableMigrator.migrate(from, to) → DDL changes      │
│     └─ TemplateSeedMigrator.migrateSeed(seed) → new seed items   │
│  7. Update branch.structureVersion = CURRENT                     │
│  8. Release advisory lock                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Declarative DDL Flow

```
SystemTableDef[]              ──→ SystemTableDDLGenerator  ──→ Knex DDL (CREATE TABLE)
       │                                                            │
       └──→ calculateSystemTableDiff() ──→ SystemTableDiff  ──→ SystemTableMigrator
                                            │                       │
                                            ├─ additive[]     ──→ Applied automatically
                                            └─ destructive[]  ──→ Logged, NOT applied
```

### Template Seed Flow

```
MetahubTemplateManifest
  └─ seed: MetahubTemplateSeed
       ├─ layouts[]              ──→  _mhb_layouts
       ├─ layoutZoneWidgets{}    ──→  _mhb_widgets
       ├─ settings[]             ──→  _mhb_settings
       ├─ entities[]             ──→  _mhb_objects + _mhb_attributes
       └─ elements{}             ──→  _mhb_elements
```

Two execution paths:
- **Fresh schema** → `TemplateSeedExecutor` — inserts all seed data transactionally
- **Existing schema** → `TemplateSeedMigrator` — adds only NEW items that don't conflict with current state

### System Fields Architecture

All system tables use a three-level field architecture:

#### Platform Level (`_upl_*`) — 16 columns
- `_upl_created_at`, `_upl_created_by` — Creation audit trail
- `_upl_updated_at`, `_upl_updated_by` — Modification audit trail
- `_upl_version` — Optimistic locking version counter
- `_upl_archived`, `_upl_archived_at`, `_upl_archived_by` — Archive status
- `_upl_deleted`, `_upl_deleted_at`, `_upl_deleted_by`, `_upl_purge_after` — Soft delete
- `_upl_locked`, `_upl_locked_at`, `_upl_locked_by`, `_upl_locked_reason` — Record locking

#### Metahub Level (`_mhb_*`) — 9 columns
- `_mhb_published`, `_mhb_published_at`, `_mhb_published_by` — Publication status
- `_mhb_archived`, `_mhb_archived_at`, `_mhb_archived_by` — Metahub-level archive
- `_mhb_deleted`, `_mhb_deleted_at`, `_mhb_deleted_by` — Metahub-level soft delete

### Optimistic Locking

All PATCH/PUT endpoints support optimistic locking to prevent concurrent edit conflicts:

```http
PATCH /metahub/:metahubId
Content-Type: application/json

{
  "name": "Updated Name",
  "expectedVersion": 3
}
```

If the entity was modified by another user, the server responds with HTTP 409:

```json
{
  "error": "Conflict: entity was modified by another user",
  "code": "OPTIMISTIC_LOCK_CONFLICT",
  "conflict": {
    "entityId": "uuid",
    "entityType": "metahub",
    "expectedVersion": 3,
    "actualVersion": 4,
    "updatedAt": "2024-01-15T10:30:00Z",
    "updatedBy": "user-uuid",
    "updatedByEmail": "user@example.com"
  }
}
```

## API Reference

### Metahubs Endpoints
```http
GET    /metahubs                               # List metahubs
POST   /metahubs                               # Create metahub
GET    /metahub/:metahubId                     # Get metahub details
PUT    /metahub/:metahubId                     # Update metahub
DELETE /metahub/:metahubId                     # Delete metahub (CASCADE)

GET    /metahub/:metahubId/members             # List metahub members
POST   /metahub/:metahubId/members             # Add member
PATCH  /metahub/:metahubId/member/:memberId    # Update member
DELETE /metahub/:metahubId/member/:memberId    # Remove member
```

### Branches Endpoints
```http
GET    /metahub/:metahubId/branches                          # List branches
GET    /metahub/:metahubId/branches/options                  # List branches (select options format)
GET    /metahub/:metahubId/branch/:branchId                  # Get branch details
POST   /metahub/:metahubId/branches                          # Create branch (clone from source)
PATCH  /metahub/:metahubId/branch/:branchId                  # Update branch metadata
POST   /metahub/:metahubId/branch/:branchId/activate         # Set active branch for user
POST   /metahub/:metahubId/branch/:branchId/default          # Set default branch for metahub
GET    /metahub/:metahubId/branch/:branchId/blocking-users   # Users with this branch active
DELETE /metahub/:metahubId/branch/:branchId                  # Delete branch
```

### Hubs Endpoints
```http
GET    /metahub/:metahubId/hubs                # List hubs in metahub
POST   /metahub/:metahubId/hubs                # Create hub
GET    /metahub/:metahubId/hub/:hubId          # Get hub details
PATCH  /metahub/:metahubId/hub/:hubId          # Update hub
DELETE /metahub/:metahubId/hub/:hubId          # Delete hub
```

### Catalogs Endpoints
```http
GET    /metahub/:metahubId/catalogs                               # List all catalogs in metahub
POST   /metahub/:metahubId/catalogs                               # Create catalog at metahub level
GET    /metahub/:metahubId/catalog/:catalogId                     # Get catalog (metahub scope)
PATCH  /metahub/:metahubId/catalog/:catalogId                     # Update catalog (metahub scope)
DELETE /metahub/:metahubId/catalog/:catalogId                     # Delete catalog (metahub scope)

GET    /metahub/:metahubId/hub/:hubId/catalogs                     # List catalogs in hub
POST   /metahub/:metahubId/hub/:hubId/catalogs                     # Create catalog in hub
GET    /metahub/:metahubId/hub/:hubId/catalog/:catalogId           # Get catalog (hub scope)
PATCH  /metahub/:metahubId/hub/:hubId/catalog/:catalogId           # Update catalog (hub scope)
DELETE /metahub/:metahubId/hub/:hubId/catalog/:catalogId           # Delete catalog (hub scope)
```

### Attributes Endpoints
```http
GET    /metahub/:m/hub/:h/catalog/:c/attributes                   # List attributes (hub scope)
POST   /metahub/:m/hub/:h/catalog/:c/attributes                   # Create attribute (hub scope)
GET    /metahub/:m/hub/:h/catalog/:c/attribute/:attrId            # Get attribute (hub scope)
PATCH  /metahub/:m/hub/:h/catalog/:c/attribute/:attrId            # Update attribute (hub scope)
DELETE /metahub/:m/hub/:h/catalog/:c/attribute/:attrId            # Delete attribute (hub scope)
PATCH  /metahub/:m/hub/:h/catalog/:c/attribute/:attrId/move       # Reorder attribute (hub scope)

GET    /metahub/:m/catalog/:c/attributes                          # List attributes (direct)
POST   /metahub/:m/catalog/:c/attributes                          # Create attribute (direct)
GET    /metahub/:m/catalog/:c/attribute/:attrId                   # Get attribute (direct)
PATCH  /metahub/:m/catalog/:c/attribute/:attrId                   # Update attribute (direct)
DELETE /metahub/:m/catalog/:c/attribute/:attrId                   # Delete attribute (direct)
PATCH  /metahub/:m/catalog/:c/attribute/:attrId/move              # Reorder attribute (direct)
```

### Elements Endpoints
```http
GET    /metahub/:m/hub/:h/catalog/:c/elements                     # List elements (hub scope)
POST   /metahub/:m/hub/:h/catalog/:c/elements                     # Create element (hub scope)
GET    /metahub/:m/hub/:h/catalog/:c/element/:elementId           # Get element (hub scope)
PATCH  /metahub/:m/hub/:h/catalog/:c/element/:elementId           # Update element (hub scope)
DELETE /metahub/:m/hub/:h/catalog/:c/element/:elementId           # Delete element (hub scope)

GET    /metahub/:m/catalog/:c/elements                            # List elements (direct)
POST   /metahub/:m/catalog/:c/elements                            # Create element (direct)
GET    /metahub/:m/catalog/:c/element/:elementId                  # Get element (direct)
PATCH  /metahub/:m/catalog/:c/element/:elementId                  # Update element (direct)
DELETE /metahub/:m/catalog/:c/element/:elementId                  # Delete element (direct)
```

### Layouts Endpoints
```http
GET    /metahub/:metahubId/layouts                                        # List layouts
POST   /metahub/:metahubId/layouts                                        # Create layout
GET    /metahub/:metahubId/layout/:layoutId                               # Get layout details
PATCH  /metahub/:metahubId/layout/:layoutId                               # Update layout
DELETE /metahub/:metahubId/layout/:layoutId                               # Delete layout

GET    /metahub/:metahubId/layout/:layoutId/zone-widgets/catalog          # List available widget types
GET    /metahub/:metahubId/layout/:layoutId/zone-widgets                  # List assigned zone widgets
PUT    /metahub/:metahubId/layout/:layoutId/zone-widget                   # Assign widget to zone
PATCH  /metahub/:metahubId/layout/:layoutId/zone-widgets/move             # Move/reorder zone widget
DELETE /metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId         # Remove zone widget
PATCH  /metahub/:metahubId/layout/:layoutId/zone-widget/:widgetId/config  # Update widget config
```

### Publications Endpoints (Schema Sync)
```http
GET    /metahub/:metahubId/publications                           # List publications
POST   /metahub/:metahubId/publications                           # Create publication
GET    /metahub/:metahubId/publication/:id                        # Get publication details
PATCH  /metahub/:metahubId/publication/:id                        # Update publication
DELETE /metahub/:metahubId/publication/:id                        # Delete publication + schema
GET    /metahub/:metahubId/publication/:id/diff                   # Get schema diff
POST   /metahub/:metahubId/publication/:id/sync                   # Sync schema to database
```

### Application Endpoints (Runtime Schema)
```http
POST   /application/:applicationId/sync                                  # Create or update runtime schema
GET    /application/:applicationId/diff                                  # Calculate schema diff

GET    /application/:applicationId/migrations                            # List all migrations
GET    /application/:applicationId/migration/:migrationId                # Get migration details
GET    /application/:applicationId/migration/:migrationId/analyze        # Analyze rollback feasibility
POST   /application/:applicationId/migration/:migrationId/rollback       # Rollback to migration
```

### Metahub Migrations Endpoints
```http
GET    /metahub/:metahubId/migrations/status                              # Check migration status (blockers, version info)
POST   /metahub/:metahubId/migrations/apply                               # Apply pending migrations (body: { cleanupMode: 'keep' })
```

> **Response format and details**: [MIGRATIONS.md](MIGRATIONS.md)
```

### Templates Endpoints
```http
GET    /templates                              # List all active templates
GET    /templates/:templateId                  # Get template with active version manifest
```

### Public API Endpoints (No Authentication Required)
```http
GET    /api/public/metahub/:slug                                                    # Get public metahub by slug
GET    /api/public/metahub/:slug/hub/:hubCodename                                   # Get hub by codename
GET    /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename          # Get catalog
GET    /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename/attributes   # List attributes
GET    /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename/elements     # List elements
GET    /api/public/metahub/:slug/hub/:hubCodename/catalog/:catalogCodename/element/:id  # Get element
```

### Request/Response Examples

#### Create Metahub
```http
POST /metahubs
Content-Type: application/json

{
  "name": "Gaming Hub",
  "description": "Virtual gaming worlds and assets"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Gaming Hub",
    "description": "Virtual gaming worlds and assets",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

## Data Model

### Core Entities (TypeORM)

| Entity | Table | Description |
|--------|-------|-------------|
| `Metahub` | `metahubs` | Top-level container (organization/workspace) |
| `MetahubBranch` | `metahub_branches` | Branch with isolated schema, structure version tracking |
| `MetahubUser` | `metahub_users` | Membership with role, permissions, active branch selection |
| `Publication` | `publications` | Publication linking metahub to application schema |
| `PublicationVersion` | `publication_versions` | Snapshot of published schema state |
| `Template` | `templates` | Reusable metahub template definition |
| `TemplateVersion` | `template_versions` | Immutable snapshot of template manifest (SHA-256 hashed) |

### Junction Tables

- `CatalogHub` — links catalogs to hubs (N:M relationship, `UNIQUE` per pair, `ON DELETE CASCADE`)

### System Tables (per Branch Schema) — Dynamic

See [Architecture → System Tables](#system-tables-per-branch-schema) for the full list of 7 tables with descriptions.

## Validation & Business Rules

- `metahubId` is required for all operations
- `hubId` is required for creating catalogs
- `catalogId` is required for creating attributes and elements
- UUID parameters are validated, and access is enforced by guards
- Template manifests are validated via Zod schemas before DB insertion
- Structure version migrations are safe (additive only) and recorded in `_mhb_migrations`

## Database Schema

### Migrations & Entity Registration

Metahubs entities and migrations are registered in the Flowise core backend. See [MIGRATIONS.md](MIGRATIONS.md) for details.

## File Structure

```
src/
├── index.ts                          # Public API exports
├── database/
│   ├── entities/                     # TypeORM entities
│   │   ├── Metahub.ts
│   │   ├── MetahubBranch.ts
│   │   ├── MetahubUser.ts
│   │   ├── Publication.ts
│   │   ├── PublicationVersion.ts
│   │   ├── Template.ts
│   │   ├── TemplateVersion.ts
│   │   └── index.ts
│   └── migrations/
│       └── postgres/
├── domains/
│   ├── metahubs/
│   │   ├── routes/
│   │   │   ├── metahubsRoutes.ts             # Authenticated metahub CRUD + members
│   │   │   └── publicMetahubsRoutes.ts       # Public read-only API (no auth)
│   │   ├── services/
│   │   │   ├── MetahubSchemaService.ts       # Schema lifecycle orchestrator
│   │   │   ├── SystemTableDDLGenerator.ts    # Declarative DDL → Knex DDL
│   │   │   ├── SystemTableMigrator.ts        # Additive migration engine
│   │   │   ├── systemTableDefinitions.ts     # Declarative table definitions (V1 baseline)
│   │   │   ├── systemTableDiff.ts            # Diff engine (old vs new version)
│   │   │   ├── structureVersions.ts          # Version registry, CURRENT_STRUCTURE_VERSION
│   │   │   ├── MetahubAttributesService.ts
│   │   │   ├── MetahubElementsService.ts
│   │   │   ├── MetahubHubsService.ts
│   │   │   ├── MetahubObjectsService.ts
│   │   │   └── schemaSync.ts
│   │   └── index.ts
│   ├── templates/
│   │   ├── data/
│   │   │   ├── basic.template.ts             # Built-in "basic" template manifest
│   │   │   └── index.ts                      # Template registry + DEFAULT_TEMPLATE_CODENAME
│   │   ├── routes/
│   │   │   └── templatesRoutes.ts            # GET /templates endpoints
│   │   └── services/
│   │       ├── TemplateSeeder.ts             # Startup seeder (SHA-256 dedup)
│   │       ├── TemplateSeedExecutor.ts       # Fresh schema seed (transactional)
│   │       ├── TemplateSeedMigrator.ts       # Incremental seed migration
│   │       └── TemplateManifestValidator.ts  # Zod validation schemas
│   ├── branches/
│   │   ├── routes/
│   │   │   └── branchesRoutes.ts             # Branch CRUD + activate/default
│   │   └── services/
│   │       └── MetahubBranchesService.ts
│   ├── hubs/
│   │   └── routes/
│   ├── catalogs/
│   │   └── routes/
│   ├── attributes/
│   │   └── routes/
│   ├── elements/
│   │   └── routes/
│   ├── publications/
│   │   ├── routes/
│   │   │   └── publicationsRoutes.ts
│   │   └── services/
│   │       └── SnapshotSerializer.ts
│   ├── layouts/
│   │   ├── routes/
│   │   │   └── layoutsRoutes.ts              # Layout + zone widget CRUD
│   │   └── services/
│   │       └── MetahubLayoutsService.ts
│   ├── applications/
│   │   └── routes/
│   │       ├── applicationSyncRoutes.ts      # Schema sync + diff
│   │       └── applicationMigrationsRoutes.ts # Migration history + rollback
│   ├── migrations/
│   │   ├── routes/
│   │   │   └── metahubMigrationsRoutes.ts    # Migration status + apply endpoints
│   │   └── services/
│   │       └── TemplateSeedCleanupService.ts  # Structured blocker generation (11 sites)
│   ├── ddl/
│   │   ├── KnexClient.ts                    # Singleton Knex instance
│   │   ├── definitions/
│   │   │   └── catalogs.ts
│   │   └── index.ts                          # Re-exports from @universo/schema-ddl
│   ├── shared/
│   │   ├── guards.ts                         # ensureMetahubAccess, ensureHubAccess, etc.
│   │   ├── layoutDefaults.ts                 # DEFAULT_DASHBOARD_ZONE_WIDGETS + columnsContainer seed
│   │   ├── queryParams.ts
│   │   └── index.ts
│   └── router.ts                             # Service route aggregator
├── tests/
├── types/
└── utils/
```

## Integration Points

### Workspace Dependencies
- **`@universo/types`** — Shared TypeScript types (`MetahubTemplateManifest`, `MetahubTemplateSeed`, VLC, dashboard zones/widgets)
- **`@universo/schema-ddl`** — DDL utilities (`SchemaGenerator`, `SchemaMigrator`, `KnexClient`, advisory locks)
- **`@universo/auth-backend`** — Authentication middleware
- **`@universo/admin-backend`** — Admin service integration
- **`@universo/applications-backend`** — Application schema management
- **`@universo/utils`** — Shared utility functions (rate limiting, validation, localized content)

### Startup Integration
- `seedTemplates()` is called from `flowise-core-backend` at application startup
- Template seeding is idempotent and non-fatal (logs errors, does not crash server)

## Development

### Available Scripts
```bash
pnpm --filter @universo/metahubs-backend build    # Build the package
pnpm --filter @universo/metahubs-backend dev      # Watch mode
pnpm --filter @universo/metahubs-backend test     # Run tests
pnpm --filter @universo/metahubs-backend lint     # Run linter
```

### Key Design Decisions
1. **Declarative over Imperative** — System tables are described as typed data structures, not as imperative Knex builder calls. This enables diff-based migrations.
2. **Additive-only Auto-Migrations** — Destructive schema changes (DROP TABLE/COLUMN) are never applied automatically, ensuring data safety.
3. **Dual Seeding Paths** — Fresh schemas use `TemplateSeedExecutor` (full insert); existing schemas use `TemplateSeedMigrator` (incremental, non-destructive).
4. **Lazy Per-Branch Migration** — Existing metahubs are updated lazily on first access after a version bump, not eagerly at startup. This avoids long startup times.
5. **Advisory Locking** — PostgreSQL advisory locks prevent race conditions during concurrent schema creation.

## Security

- Application-level authorization with `ensureMetahubAccess`, `ensureHubAccess`, and `ensureCatalogAccess` guards
- Rate limiting initialized via `initializeRateLimiters()` (read: 600/15min, write: 240/15min)
- Row-Level Security at PostgreSQL level via Supabase integration
- Public API endpoints serve only metahubs with `isPublic=true` flag, read-only

## Related Packages

- [`@universo/metahubs-frontend`](../../metahubs-frontend/base/README.md) — Frontend UI for metahub management
- [`@universo/schema-ddl`](../../schema-ddl/base/README.md) — DDL generation and schema management
- [`@universo/types`](../../universo-types/base/README.md) — Shared TypeScript type definitions
- [`@universo/auth-backend`](../../auth-backend/base/README.md) — Authentication service
- [`@universo/applications-backend`](../../applications-backend/base/README.md) — Application schema service

## Contributing

### Development Workflow
1. Create feature branch from `main`
2. Implement changes following coding standards
3. Add appropriate tests for new functionality
4. Update documentation as needed
5. Submit pull request for review

## License

Apache License Version 2.0 — See the [LICENSE](../../../LICENSE) file for details.

---

**Support**: For questions, issues, or feature requests, please refer to the project documentation or create an issue in the repository.

*Part of [Universo Platformo](../../../README.md)*
