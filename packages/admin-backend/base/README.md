# @universo/admin-backend

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js, SQL-first persistence, and Zod

Backend service for global admin management (superadmins and supermoderators) with RBAC system.

## Package Information

- **Version**: 0.1.0
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Modern with Express.js + SQL-first persistence helpers + Zod validation

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
- SQL-first stores in the `admin` schema
- PostgreSQL with JSONB for localized content
- PostgreSQL functions reused for consistent permission and access checks

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
import { createKnexExecutor, getKnex } from '@universo/database'

const globalAccessService = createGlobalAccessService({ getDbExecutor: () => createKnexExecutor(getKnex()) })
const globalUsersRoutes = createGlobalUsersRoutes({ globalAccessService })

app.use('/api/v1/admin/global-users', globalUsersRoutes)
```

### Access Guard in Other Modules

```typescript
import { createGlobalAccessService } from '@universo/admin-backend'
import { createKnexExecutor, getKnex } from '@universo/database'

const globalAccessService = createGlobalAccessService({ getDbExecutor: () => createKnexExecutor(getKnex()) })

// In your access guard
const hasAccess = await globalAccessService.canAccessAdmin(userId)
if (hasAccess) {
    // Bypass ownership checks for global admins
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GLOBAL_ADMIN_ENABLED` | Enable/disable admin panel | `false` |

## Database Schema

### admin.cat_roles

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(50) | Unique role identifier |
| display_name | JSONB | Localized names `{"en": "...", "ru": "..."}` |
| has_global_access | BOOLEAN | Grants platform-wide access |
| is_system | BOOLEAN | Protected from deletion |

### admin.rel_user_roles

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to auth.users |
| role_id | UUID | Reference to admin.cat_roles |
| granted_by | UUID | Admin who assigned the role |
| comment | TEXT | Assignment notes |

## Architecture

### SQL-First Access Pattern

This module uses SQL-first services and neutral database contracts:

- **DbExecutor / DbSession** for all route and service level queries
- **Raw SQL** for PostgreSQL functions such as `admin.is_superuser()` and `admin.has_permission()`
- **Legacy compatibility wrappers** only where other packages still import the historical helpers

This design ensures that permission checks in application code match the database-level permission functions exactly.

### Platform Schema Definition

The admin schema shape is declared in `src/platform/systemAppDefinition.ts` as a
`SystemAppDefinition` manifest. This manifest lists every business table, field,
data type, and FK reference that must exist in the `admin` PostgreSQL schema.

At server startup the platform compares `targetBusinessTables` from the manifest
against the last recorded migration snapshot and applies only the necessary DDL
changes. No hand-written SQL migrations are needed — add or remove fields in
the manifest and restart the server.

See [System App Migration Lifecycle](../../../docs/en/architecture/system-app-migration-lifecycle.md)
and [Updating System App Schemas](../../../docs/en/guides/updating-system-app-schemas.md)
for the full workflow.

## Troubleshooting

### Admin roles list hangs after direct navigation

- **Symptom**: Direct navigation or page reload on `/admin/instance/:id/roles` leaves the UI on skeleton loaders and Network shows pending `GET /api/v1/admin/roles` requests.
- **Root cause**: Admin guard checks executed outside the request-scoped DB session, competing for pooled connections and sometimes running after the request context had already been released.
- **Fix**: Reuse the request `DbSession` for admin access checks and permission queries, and fall back to the pool-level `DbExecutor` only when no active request context exists. No database schema changes required.

## File Structure

```
packages/admin-backend/base/
├── src/
│   ├── guards/
│   │   └── ensureGlobalAccess.ts
│   ├── persistence/           # SQL-first query helpers for roles/settings/locales/instances
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
| `zod` | ^3.25.76 | Schema validation |
| `http-errors` | catalog | HTTP error handling |

## Related Packages

- `@universo/admin-frontend` - Frontend UI for admin panel
- `@universo/auth-backend` - Authentication and access guards
- `@universo/types` - Shared TypeScript types
