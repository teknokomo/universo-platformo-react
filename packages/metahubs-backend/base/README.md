# @universo/metahubs-backend

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js and TypeORM

Backend service for managing metahubs, hubs, catalogs, attributes, elements, and memberships with strict metahub-level isolation.

## Package Information

- **Version**: 0.1.0
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Express.js + TypeORM + Zod

## Key Features

### Domain Model
- **Metahubs**: Top-level organizational units with complete data isolation
- **Hubs**: Content containers within metahubs (N:M relationship with Catalogs)
- **Catalogs**: Schema definitions for structured data (N:M relationship with Hubs)
- **Attributes**: Field definitions within catalogs
- **Elements**: Data entries conforming to catalog schemas
- **Memberships**: User-metahub membership with roles and permissions

### Data Isolation & Security
- Complete metahub isolation - no cross-metahub data access
- Many-to-many relationship between Hubs and Catalogs (a catalog can belong to multiple hubs)
- Idempotent operations for relationship management
- Comprehensive input validation with clear error messages
- Application-level authorization with metahub/hub/catalog guards
- Rate limiting protection against DoS attacks

### DDL & Schema Generation
- Dynamic PostgreSQL schema generation from Metahub definitions
- System metadata tables (`_app_objects`, `_app_attributes`, `_app_migrations`) for runtime introspection
- Transactional DDL+DML operations with automatic rollback on failure
- Schema diff calculation and incremental migrations
- Advisory locks for concurrent migration protection

### Database Integration
- TypeORM Repository pattern for all data operations
- PostgreSQL with JSONB support for metadata
- Automated migrations through central registry
- CASCADE delete relationships with UNIQUE constraints

### System Fields Architecture

All entities use a three-level system fields architecture for audit trails, soft delete, and concurrency control:

#### Platform Level (`_upl_*`)
Present on ALL tables across the platform:
- `_upl_created_at`, `_upl_created_by` — Creation audit trail
- `_upl_updated_at`, `_upl_updated_by` — Modification audit trail
- `_upl_version` — Optimistic locking version counter
- `_upl_archived`, `_upl_archived_at`, `_upl_archived_by` — Archive status
- `_upl_deleted`, `_upl_deleted_at`, `_upl_deleted_by`, `_upl_purge_after` — Soft delete
- `_upl_locked`, `_upl_locked_at`, `_upl_locked_by`, `_upl_locked_reason` — Record locking

#### Metahub Level (`_mhb_*`)
Present on dynamic tables in `mhb_*` schemas:
- `_mhb_published`, `_mhb_published_at`, `_mhb_published_by` — Publication status
- `_mhb_archived`, `_mhb_archived_at`, `_mhb_archived_by` — Metahub-level archive
- `_mhb_deleted`, `_mhb_deleted_at`, `_mhb_deleted_by` — Metahub-level soft delete
- `_mhb_order` — Sort order within collections
- `_mhb_readonly` — Read-only flag

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

## Installation

```bash
# Install from workspace root
pnpm install

# Build the package
pnpm --filter @universo/metahubs-backend build
```

## Usage

### Express Router Integration (recommended)
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
- `ensureAuth` is your authentication middleware
- `getDataSource` returns a TypeORM `DataSource`

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

#### Create Element
```http
POST /metahub/:metahubId/hub/:hubId/catalog/:catalogId/elements
Content-Type: application/json

{
  "data": {
    "name": "Player Avatar",
    "model": "character.fbx",
    "animations": ["idle", "walk", "run"]
  }
}
```

## Data Model

### Core Entities (high level)

- `Metahub`: top-level container (organization/workspace).
- `Hub`: content container within metahub.
- `Catalog`: schema definition for structured data (N:M with Hubs via junction table).
- `Attribute`: field definition within catalog (name, type, constraints).
- `Element`: data entry conforming to catalog schema (JSONB data).
- `MetahubUser`: membership with role and permissions.

### Junction Tables

- `CatalogHub`: links catalogs to hubs (N:M relationship).

Notes:
- Junction tables use `UNIQUE` constraints per pair and `ON DELETE CASCADE` for referential integrity.
- A catalog can belong to multiple hubs within the same metahub.

### System Tables (per Application schema)

When a Metahub is published to an Application, the following system tables are created:

- `_app_objects`: Registry of all metadata objects (catalogs, documents, hubs) with presentation and config.
- `_app_attributes`: Field definitions with data types, validation rules, and UI configuration.
- `_app_migrations`: History of applied schema migrations.

These tables enable runtime introspection and Server-Driven UI generation.

#### `_app_objects` — Metadata Object Registry

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key. Matches the source object UUID from Metahub for traceability. |
| `kind` | VARCHAR(20) | Discriminator column indicating object class: `catalog`, `document`, `hub`. Used by the kernel to determine object behavior. |
| `codename` | VARCHAR(100) | System name for API/code usage (e.g., `products`, `orders`). |
| `table_name` | VARCHAR(255) | Physical table name in the schema (e.g., `cat_019bca...`). |
| `presentation` | JSONB | Localized display name and description using VLC format: `{"name": {"_schema": "1", "locales": {"en": "Products"}}}`. |
| `config` | JSONB | Type-specific settings. For catalogs: `{"hierarchy": true}`. For documents: `{"posting": "realtime"}`. |
| `created_at` | TIMESTAMP | Record creation timestamp. |
| `updated_at` | TIMESTAMP | Last modification timestamp. |

#### `_app_attributes` — Field Definitions

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key. Matches the source attribute UUID from Metahub. |
| `object_id` | UUID FK | Reference to `_app_objects.id` (the owning object). |
| `codename` | VARCHAR(100) | System field name for API/code (e.g., `article_number`). |
| `column_name` | VARCHAR(255) | Physical column name in the table (e.g., `attr_019bca...`). |
| `data_type` | VARCHAR(20) | Logical data type: `STRING`, `NUMBER`, `BOOLEAN`, `DATE`, `DATETIME`, `REF`, `JSON`. |
| `is_required` | BOOLEAN | Whether the field is mandatory (NOT NULL constraint). |
| `target_object_id` | UUID FK | For `REF` type only: references `_app_objects.id` of the target object. Enables UI to render relationship selectors. |
| `presentation` | JSONB | Localized field label using VLC format. |
| `validation_rules` | JSONB | Business validation rules beyond basic type: `{"minLength": 3, "maxLength": 100, "pattern": "^[A-Z]+$"}`. |
| `ui_config` | JSONB | UI widget configuration for Server-Driven UI: `{"widget": "textarea", "rows": 5, "placeholder": "Enter description..."}`. |
| `created_at` | TIMESTAMP | Record creation timestamp. |
| `updated_at` | TIMESTAMP | Last modification timestamp. |

#### `_app_migrations` — Schema Migration History

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated UUID v7). |
| `name` | VARCHAR(255) | Unique migration identifier (e.g., `v3_add_customer_table`). |
| `applied_at` | TIMESTAMP | When the migration was applied. |
| `meta` | JSONB | Additional metadata about the migration (changes applied, source version). |

## Validation & Business Rules

- `metahubId` is required for all operations.
- `hubId` is required for creating catalogs.
- `catalogId` is required for creating attributes and elements.
- UUID parameters are validated, and access is enforced by guards.

## Database Schema

### Migrations & Entity Registration

Metahubs entities and migrations are registered in the Flowise core backend:

```typescript
// flowise-core-backend/base/src/database/entities/index.ts
import { metahubsEntities } from '@universo/metahubs-backend'

// flowise-core-backend/base/src/database/migrations/postgres/index.ts
import { metahubsMigrations } from '@universo/metahubs-backend'
```

## Development

### Available Scripts
```bash
pnpm --filter @universo/metahubs-backend build
pnpm --filter @universo/metahubs-backend dev
pnpm --filter @universo/metahubs-backend test
pnpm --filter @universo/metahubs-backend lint
```

### Project Structure
```
src/
├── database/
│   ├── entities/
│   └── migrations/
├── domains/
│   ├── attributes/
│   │   └── routes/
│   ├── catalogs/
│   │   └── routes/
│   ├── hubs/
│   │   └── routes/
│   ├── metahubs/
│   │   └── routes/
│   ├── publications/
│   │   └── routes/
│   ├── elements/
│   │   └── routes/
│   ├── ddl/
│   │   └── definitions/
│   └── shared/
├── tests/
├── types/
├── utils/
└── index.ts
```

## Security

- Application-level authorization with `ensureMetahubAccess`, `ensureHubAccess`, and `ensureCatalogAccess`.
- Rate limiting is initialized via `initializeRateLimiters()`.

## Related Packages
- [`@universo/metahubs-frontend`](../metahubs-frontend/base/README.md) - Frontend client
- [`@universo/auth-backend`](../auth-backend/base/README.md) - Authentication service
- [`@universo/utils`](../universo-utils/base/README.md) - Shared utilities

---
*Part of [Universo Platformo](../../../README.md)*
