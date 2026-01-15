# @universo/applications-backend

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js and TypeORM

Backend service for managing applications, connectors, and memberships with strict application-level isolation.

## Package Information

- **Package**: `@universo/applications-backend`
- **Version**: `0.1.0`
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Express.js + TypeORM + Zod

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
- TypeORM Repository pattern for all data operations
- PostgreSQL with JSONB support for metadata
- Automated migrations through central registry
- CASCADE deletion with UNIQUE constraints

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

app.use('/api/v1', createApplicationsRoutes(ensureAuth, getDataSource))
```

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
- **SQL Injection Prevention**: TypeORM parameterized queries
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
- `@flowise/core-backend` - Core backend with DataSource and migrations
- `@universo/types` - Shared TypeScript types

## License

Omsk Open License
