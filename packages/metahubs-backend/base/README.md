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

### Records Endpoints
```http
GET    /metahub/:m/hub/:h/catalog/:c/records                      # List records (hub scope)
POST   /metahub/:m/hub/:h/catalog/:c/records                      # Create record (hub scope)
GET    /metahub/:m/hub/:h/catalog/:c/record/:recordId             # Get record (hub scope)
PATCH  /metahub/:m/hub/:h/catalog/:c/record/:recordId             # Update record (hub scope)
DELETE /metahub/:m/hub/:h/catalog/:c/record/:recordId             # Delete record (hub scope)

GET    /metahub/:m/catalog/:c/records                             # List records (direct)
POST   /metahub/:m/catalog/:c/records                             # Create record (direct)
GET    /metahub/:m/catalog/:c/record/:recordId                    # Get record (direct)
PATCH  /metahub/:m/catalog/:c/record/:recordId                    # Update record (direct)
DELETE /metahub/:m/catalog/:c/record/:recordId                    # Delete record (direct)
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
POST /metahub/:metahubId/hub/:hubId/catalog/:catalogId/records
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
│   ├── records/
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
