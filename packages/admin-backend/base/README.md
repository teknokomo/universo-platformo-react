# @universo/admin-backend

> 🏗️ **Modern Package** - TypeScript-first architecture with Express.js, SQL-first persistence, and Zod

Backend service for global admin management with system roles, editable custom roles, and SQL-first RBAC.

## Package Information

- **Version**: 0.1.0
- **Type**: Backend Service Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Modern with Express.js + SQL-first persistence helpers + Zod validation

## Key Features

### 🔐 RBAC System
- **System Roles**: `Superuser`, `Registered`, and `User`, plus editable custom global roles
- **Permission Model**: subject/action rules with wildcard support and localized role metadata
- **Role Metadata**: Localized display names, colors, and descriptions

### 🛡️ Security
- Environment-controlled activation (`GLOBAL_ADMIN_ENABLED`)
- Request-level role validation middleware
- SQL injection protection with parameterized queries
- RLS integration via PostgreSQL functions
- Authenticated DB sessions may introspect only their own admin permissions and roles through helper SQL functions; privileged cross-user reads stay in backend/bootstrap flows

### 📊 Database
- SQL-first stores in the `admin` schema
- PostgreSQL with JSONB for localized content
- PostgreSQL functions reused for consistent permission and access checks

## API Reference

### Global Users Endpoints

```http
GET    /api/v1/admin/global-users                # List global users (read permission)
GET    /api/v1/admin/global-users/me             # Get current user's global-role summary
POST   /api/v1/admin/global-users/create-user    # Provision auth user + assign initial roles
PUT    /api/v1/admin/global-users/:memberId/roles # Replace the user's full role set
PATCH  /api/v1/admin/global-users/:memberId      # Legacy single-role compatibility wrapper
DELETE /api/v1/admin/global-users/:memberId      # Revoke all global roles for the user
```

### Dashboard Endpoints

```http
GET    /api/v1/admin/dashboard/stats       # Shared admin/metapanel dashboard statistics
```

### Roles Endpoints

```http
GET    /api/v1/admin/roles                 # List all roles
GET    /api/v1/admin/roles/global          # List roles with global access
POST   /api/v1/admin/roles/:id/copy        # Copy an existing role into a new editable role
```

## Usage

### Express Integration

```typescript
import {
  createAuthUserProvisioningService,
  createGlobalUsersRoutes,
  createGlobalAccessService
} from '@universo/admin-backend'
import { getPermissionService } from '@universo/auth-backend'
import { createKnexExecutor, getKnex } from '@universo/database'
import { createClient } from '@supabase/supabase-js'

const globalAccessService = createGlobalAccessService({ getDbExecutor: () => createKnexExecutor(getKnex()) })
const permissionService = getPermissionService()
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const provisioningService = createAuthUserProvisioningService({
  getDbExecutor: () => createKnexExecutor(getKnex()),
  globalAccessService,
  supabaseAdmin
})
const globalUsersRoutes = createGlobalUsersRoutes({ globalAccessService, permissionService, provisioningService })

app.use('/api/v1/admin/global-users', globalUsersRoutes)
```

Use the shared provisioning service when you enable direct admin-side user provisioning via `POST /create-user`.
This keeps startup bootstrap and admin-side create-user on the same rollback-safe pipeline.

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

### admin.obj_roles

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| codename | JSONB | Canonical VLC codename payload persisted as `codename JSONB` |
| name | JSONB | Localized role display name |
| description | JSONB | Localized role description |
| color | VARCHAR(7) | UI color |
| is_superuser | BOOLEAN | Exclusive full-access system role |
| is_system | BOOLEAN | Protected from deletion |

### admin.rel_user_roles

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to auth.users |
| role_id | UUID | Reference to admin.obj_roles |
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
