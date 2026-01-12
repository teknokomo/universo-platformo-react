# @universo/metahubs-backend

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js and TypeORM

Backend service for managing metahubs, hubs, catalogs, attributes, records, and memberships with strict metahub-level isolation.

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
- **Records**: Data entries conforming to catalog schemas
- **Memberships**: User-metahub membership with roles and permissions

### Data Isolation & Security
- Complete metahub isolation - no cross-metahub data access
- Many-to-many relationship between Hubs and Catalogs (a catalog can belong to multiple hubs)
- Idempotent operations for relationship management
- Comprehensive input validation with clear error messages
- Application-level authorization with metahub/hub/catalog guards
- Rate limiting protection against DoS attacks

### Database Integration
- TypeORM Repository pattern for all data operations
- PostgreSQL with JSONB support for metadata
- Automated migrations through central registry
- CASCADE delete relationships with UNIQUE constraints

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
GET    /metahubs/:metahubId                    # Get metahub details
PUT    /metahubs/:metahubId                    # Update metahub
DELETE /metahubs/:metahubId                    # Delete metahub (CASCADE)

GET    /metahubs/:metahubId/members            # List metahub members
POST   /metahubs/:metahubId/members            # Add member
PATCH  /metahubs/:metahubId/members/:memberId  # Update member
DELETE /metahubs/:metahubId/members/:memberId  # Remove member
```

### Hubs Endpoints
```http
GET    /metahubs/:metahubId/hubs               # List hubs in metahub
POST   /metahubs/:metahubId/hubs               # Create hub
GET    /metahubs/:metahubId/hubs/:hubId        # Get hub details
PUT    /metahubs/:metahubId/hubs/:hubId        # Update hub
DELETE /metahubs/:metahubId/hubs/:hubId        # Delete hub
```

### Catalogs Endpoints
```http
GET    /metahubs/:metahubId/catalogs           # List all catalogs in metahub
GET    /metahubs/:metahubId/hubs/:hubId/catalogs                  # List catalogs in hub
POST   /metahubs/:metahubId/hubs/:hubId/catalogs                  # Create catalog in hub
GET    /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId       # Get catalog details
PUT    /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId       # Update catalog
DELETE /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId       # Delete catalog

POST   /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId/link  # Link existing catalog to hub
DELETE /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId/unlink # Unlink catalog from hub
```

### Attributes Endpoints
```http
GET    /metahubs/:m/hubs/:h/catalogs/:c/attributes                # List attributes
POST   /metahubs/:m/hubs/:h/catalogs/:c/attributes                # Create attribute
GET    /metahubs/:m/hubs/:h/catalogs/:c/attributes/:attrId        # Get attribute
PUT    /metahubs/:m/hubs/:h/catalogs/:c/attributes/:attrId        # Update attribute
DELETE /metahubs/:m/hubs/:h/catalogs/:c/attributes/:attrId        # Delete attribute
```

### Records Endpoints
```http
GET    /metahubs/:m/hubs/:h/catalogs/:c/records                   # List records
POST   /metahubs/:m/hubs/:h/catalogs/:c/records                   # Create record
GET    /metahubs/:m/hubs/:h/catalogs/:c/records/:recordId         # Get record
PUT    /metahubs/:m/hubs/:h/catalogs/:c/records/:recordId         # Update record
DELETE /metahubs/:m/hubs/:h/catalogs/:c/records/:recordId         # Delete record
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

#### Create Record
```http
POST /metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId/records
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
- `Record`: data entry conforming to catalog schema (JSONB data).
- `MetahubUser`: membership with role and permissions.

### Junction Tables

- `CatalogHub`: links catalogs to hubs (N:M relationship).

Notes:
- Junction tables use `UNIQUE` constraints per pair and `ON DELETE CASCADE` for referential integrity.
- A catalog can belong to multiple hubs within the same metahub.

## Validation & Business Rules

- `metahubId` is required for all operations.
- `hubId` is required for creating catalogs.
- `catalogId` is required for creating attributes and records.
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
├── routes/
├── schemas/
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
