# @universo/metahubs-backend

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js and TypeORM

Backend service for managing metahubs, meta sections, meta entities, and memberships with strict metahub-level isolation.

## Package Information

- **Version**: 0.1.0
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Express.js + TypeORM + Zod

## Key Features

### Domain Model
- **Metahubs**: Top-level organizational units with complete data isolation
- **Meta Sections**: Logical groupings linked to metahubs
- **Meta Entities**: Individual assets linked to meta sections and metahubs
- **Memberships**: User-metahub membership with roles and permissions
- **Junction Tables**: Many-to-many relationships with CASCADE delete and UNIQUE constraints

### Data Isolation & Security
- Complete metahub isolation - no cross-metahub data access
- Mandatory associations prevent orphaned entities
- Idempotent operations for relationship management
- Comprehensive input validation with clear error messages
- Application-level authorization with metahub/meta section/meta entity guards
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

### Meta Sections Endpoints
```http
GET    /meta-sections                          # List meta sections
POST   /meta-sections                          # Create meta section (requires metahubId)
GET    /meta-sections/:id                      # Get meta section details
PUT    /meta-sections/:id                      # Update meta section
DELETE /meta-sections/:id                      # Delete meta section
```

### Meta Entities Endpoints
```http
GET    /meta-entities                          # List meta entities
POST   /meta-entities                          # Create meta entity (requires sectionId, optional metahubId)
GET    /meta-entities/:id                      # Get meta entity details
PUT    /meta-entities/:id                      # Update meta entity
DELETE /meta-entities/:id                      # Delete meta entity
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

#### Create Meta Entity with Section Association
```http
POST /meta-entities
Content-Type: application/json

{
  "name": "Player Avatar",
  "description": "3D character model",
  "sectionId": "660e8400-e29b-41d4-a716-446655440001",
  "metahubId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "model": "character.fbx",
    "animations": ["idle", "walk", "run"]
  }
}
```

## Data Model

### Core Entities (high level)

- `Metahub`: top-level container.
- `MetaSection`: content grouping (linked to metahubs via a junction table).
- `MetaEntity`: asset/item with optional `metadata` (JSONB).
- `MetahubUser`: membership with role and permissions.

### Junction Tables

- `MetaSectionMetahub`: links meta sections to metahubs.
- `MetaEntityMetahub`: links meta entities to metahubs.
- `MetaEntityMetaSection`: links meta entities to meta sections.

Notes:
- Junction tables use `UNIQUE` constraints per pair and `ON DELETE CASCADE` for referential integrity.

## Validation & Business Rules

- `metahubId` is required for creating a meta section.
- `sectionId` is required for creating a meta entity.
- `metahubId` is optional for creating a meta entity and is used to link the entity to a metahub.
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

- Application-level authorization with `ensureMetahubAccess`, `ensureSectionAccess`, and `ensureEntityAccess`.
- Rate limiting is initialized via `initializeRateLimiters()`.

## Related Packages
- [`@universo/metahubs-frontend`](../metahubs-frontend/base/README.md) - Frontend client
- [`@universo/auth-backend`](../auth-backend/base/README.md) - Authentication service
- [`@universo/utils`](../universo-utils/base/README.md) - Shared utilities

---
*Part of [Universo Platformo](../../../README.md)*
