# @universo/applications-backend

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js, native SQL platform migrations, and SQL-first persistence helpers

Backend service for managing applications, connectors, and memberships with strict application-level isolation.

## Package Information

- **Package**: `@universo/applications-backend`
- **Version**: `0.1.0`
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Express.js + native SQL platform migrations + SQL-first persistence helpers + Zod

## Key Features

### Domain Model
- **Applications**: Top-level organizational units with complete data isolation
- **Connectors**: Data containers within applications
- **Memberships**: User-application membership with roles and permissions

### Data Isolation & Security
- Complete application isolation - no cross-application data access
- Comprehensive input validation with clear error messages
- Application-level authorization with guards
- DoS protection via rate limiting

### Database Integration
- SQL-first persistence stores for applications, connectors, and memberships
- PostgreSQL with JSONB support for metadata
- Unified platform migrations through native SQL definitions
- CASCADE deletion with UNIQUE constraints

> **Migration documentation**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

## Installation

```bash
# Install from workspace root
pnpm install

# Build the package
pnpm --filter @universo/applications-backend build
```

## Usage

### Express Router Integration (Recommended)
```typescript
import express from 'express'
import { createApplicationsRoutes, initializeRateLimiters } from '@universo/applications-backend'

const app = express()
app.use(express.json())

await initializeRateLimiters()

app.use('/api/v1', createApplicationsRoutes(ensureAuth, getDbExecutor))
```

Where:
- `ensureAuth` - your authentication middleware
- `getDbExecutor` - returns a `DbExecutor` from `@universo/utils`

## API Endpoints

### Applications
```
GET    /applications                           # List applications
POST   /applications                           # Create application
GET    /applications/:applicationId            # Get application details
PUT    /applications/:applicationId            # Update application
DELETE /applications/:applicationId            # Delete application
```

### Connectors
```
GET    /applications/:applicationId/connectors              # List connectors
POST   /applications/:applicationId/connectors              # Create connector
GET    /applications/:applicationId/connectors/:connectorId # Get connector details
PUT    /applications/:applicationId/connectors/:connectorId # Update connector
DELETE /applications/:applicationId/connectors/:connectorId # Delete connector
```

### Members
```
GET    /applications/:applicationId/members              # List members
POST   /applications/:applicationId/members              # Invite member
PUT    /applications/:applicationId/members/:memberId    # Update member role
DELETE /applications/:applicationId/members/:memberId    # Remove member
```

## Database Schema

### Core Entities
- `Application`: Top-level container with localized name/description (VLC)
- `Connector`: Data container within an application with codename and sort order
- `ApplicationUser`: Junction table for user-application membership with roles

### Relationships
```
Application (1) ─────┬───── (N) Connector
                     │
                     └───── (N) ApplicationUser ───── (1) User
```

## Roles & Permissions

| Role    | Manage Members | Manage App | Create Content | Edit Content | Delete Content |
|---------|----------------|------------|----------------|--------------|----------------|
| owner   | ✅              | ✅          | ✅              | ✅            | ✅              |
| admin   | ✅              | ✅          | ✅              | ✅            | ✅              |
| editor  | ❌              | ❌          | ✅              | ✅            | ✅              |
| member  | ❌              | ❌          | ❌              | ❌            | ❌              |

## Security Features

- **Input Validation**: All inputs validated with Zod schemas
- **Authorization Guards**: Role-based access control on all endpoints
- **Rate Limiting**: Configurable rate limits per endpoint
- **SQL Injection Prevention**: Parameterized SQL through shared executors and persistence helpers
- **CORS**: Configurable cross-origin resource sharing

## Development

### Running Tests
```bash
pnpm --filter @universo/applications-backend test
```

### Building
```bash
pnpm --filter @universo/applications-backend build
```

## Related Packages

- `@universo/applications-frontend` - Frontend UI for applications
- `@universo/core-backend` - Core backend with DataSource and migrations
- `@universo/types` - Shared TypeScript types

## License

Omsk Open License
