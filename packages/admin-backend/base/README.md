# @universo/admin-backend

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js and TypeORM

Backend service for global admin management (superadmins and supermoderators) with RBAC system.

## Package Information

- **Version**: 0.1.0
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Modern with Express.js + TypeORM + Zod validation

## Key Features

### 🔐 RBAC System
- **Global Roles**: superadmin, supermoderator with configurable permissions
- **Permission Levels**: 'view' (read-only) and 'manage' (full access)
- **Role Metadata**: Localized display names, colors, and descriptions

### 🛡️ Security
- Environment-controlled activation (`GLOBAL_ADMIN_ENABLED`)
- Request-level role validation middleware
- SQL injection protection with parameterized queries
- RLS integration via PostgreSQL functions

### 📊 Database
- TypeORM entities in `admin` schema
- PostgreSQL with JSONB for localized content
- Hybrid approach: TypeORM for CRUD, SQL functions for RLS consistency

## API Reference

### Global Users Endpoints

```http
GET    /api/v1/admin/global-users          # List global users (view permission)
GET    /api/v1/admin/global-users/me       # Get current user's global role
GET    /api/v1/admin/global-users/stats    # Dashboard statistics
POST   /api/v1/admin/global-users          # Grant global role (manage permission)
PUT    /api/v1/admin/global-users/:id      # Update role/comment (manage permission)
DELETE /api/v1/admin/global-users/:id      # Revoke global access (manage permission)
```

### Roles Endpoints

```http
GET    /api/v1/admin/roles                 # List all roles
GET    /api/v1/admin/roles/global          # List roles with global access
```

## Usage

### Express Integration

```typescript
import { createGlobalUsersRoutes, createGlobalAccessService } from '@universo/admin-backend'
import { getDataSource } from '@universo/flowise-core-backend'

const globalAccessService = createGlobalAccessService({ getDataSource })
const globalUsersRoutes = createGlobalUsersRoutes({ globalAccessService })

app.use('/api/v1/admin/global-users', globalUsersRoutes)
```

### Access Guard in Other Modules

```typescript
import { hasGlobalAccessByDataSource } from '@universo/admin-backend'
import { getDataSource } from '@universo/flowise-core-backend'

// In your access guard
const hasAccess = await hasGlobalAccessByDataSource(getDataSource(), userId)
if (hasAccess) {
    // Bypass ownership checks for global admins
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GLOBAL_ADMIN_ENABLED` | Enable/disable admin panel | `false` |

## Database Schema

### admin.roles

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(50) | Unique role identifier |
| display_name | JSONB | Localized names `{"en": "...", "ru": "..."}` |
| has_global_access | BOOLEAN | Grants platform-wide access |
| is_system | BOOLEAN | Protected from deletion |

### admin.user_roles

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to auth.users |
| role_id | UUID | Reference to admin.roles |
| granted_by | UUID | Admin who assigned the role |
| comment | TEXT | Assignment notes |

## Architecture

### Hybrid SQL + TypeORM Approach

This module uses a deliberate hybrid approach:

- **TypeORM Repository** for simple CRUD operations (roles queries, assignment deletion)
- **Raw SQL** for PostgreSQL functions (`admin.has_global_access()`) to maintain consistency with RLS policies

This design ensures that permission checks in application code match the database-level RLS policies exactly.

## Troubleshooting

### Admin roles list hangs after direct navigation

- **Symptom**: Direct navigation or page reload on `/admin/instance/:id/roles` leaves the UI on skeleton loaders and Network shows pending `GET /api/v1/admin/roles` requests.
- **Root cause**: Admin guard checks executed outside the request-scoped RLS `QueryRunner`, competing for pooled connections and sometimes running after the runner was released, which caused `QueryRunnerAlreadyReleasedError` or hanging requests.
- **Fix**: Reuse the request `QueryRunner` for admin access checks and permission queries, and fall back to `DataSource` only when no active runner exists. No database schema changes required.

## File Structure

```
packages/admin-backend/base/
├── src/
│   ├── database/
│   │   ├── entities/          # TypeORM entities
│   │   │   ├── Role.ts
│   │   │   ├── RolePermission.ts
│   │   │   └── UserRole.ts
│   │   └── migrations/        # Database migrations
│   ├── guards/
│   │   └── ensureGlobalAccess.ts
│   ├── routes/
│   │   └── globalUsersRoutes.ts
│   ├── schemas/
│   │   └── index.ts           # Zod validation schemas
│   ├── services/
│   │   └── globalAccessService.ts
│   └── index.ts               # Package exports
└── package.json
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.2 | HTTP server framework |
| `typeorm` | catalog | Database ORM |
| `zod` | ^3.25.76 | Schema validation |
| `http-errors` | catalog | HTTP error handling |

## Related Packages

- `@universo/admin-frontend` - Frontend UI for admin panel
- `@universo/auth-backend` - Authentication and access guards
- `@universo/types` - Shared TypeScript types
