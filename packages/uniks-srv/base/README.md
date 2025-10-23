# Uniks Server (uniks-srv)

Backend workspace package for workspace management functionality in the Universo Platformo ecosystem.

> Q3 2025 Update: Migrated to dedicated Postgres schema `uniks` with RLS, expanded role model (`owner|admin|editor|member`), Passport.js + Supabase hybrid session auth, and TypeORM Repository pattern replacing legacy Supabase REST usage.

## Overview

The Uniks Server is a backend workspace package (`@universo/uniks-srv`) that provides workspace management functionality. It handles workspace CRUD operations, member management, and integrates with the main Flowise server to provide workspace-specific routing.

## Key Features

- **Workspace CRUD**: TypeORM repositories, schema-qualified (`uniks.uniks`)
- **Member Management**: Role-based with strict union types
- **Expanded Roles**: `owner`, `admin`, `editor`, `member` (replaces legacy owner/member)
- **Hybrid Authentication**: Passport.js session + Supabase token validation
- **RLS Enforcement**: Postgres Row Level Security policies scoped by membership
- **Per-Request Membership Cache**: Avoids redundant lookups in request lifecycle
- **Secure Routing**: Centralized access guard service
- **Type Safety**: Strict TypeScript enums & runtime guards

## Structure

```
src/
├── routes/         # Express routes for Uniks operations
│   └── uniksRoutes.ts  # Main router with CRUD endpoints
├── database/       # Database-related files
│   ├── entities/   # TypeORM entity definitions
│   └── migrations/ # PostgreSQL migration files
├── types/          # TypeScript type declarations
│   └── flowiseRoutes.d.ts  # External module declarations
└── index.ts        # Package entry point
```

## API Endpoints (Updated)

### Workspace Management

- `GET /uniks` – List workspaces visible to user (membership required)
- `POST /uniks` – Create workspace (creator becomes `owner`)
- `GET /uniks/:id` – Details (any member)
- `PUT /uniks/:id` – Update (roles: `admin|owner`)
- `DELETE /uniks/:id` – Delete (role: `owner`)

### Member Management

- `GET /uniks/:id/members` – List members (any member)
- `POST /uniks/:id/members` – Add member (roles: `admin|owner`)
- `PUT /uniks/:id/members/:userId` – Change role (role: `owner`)
- `DELETE /uniks/:id/members/:userId` – Remove member (role: `owner`)

## Database Schema (Current)

### Schema & Tables
All tables reside in dedicated schema `uniks`:

```sql
CREATE SCHEMA IF NOT EXISTS uniks;

CREATE TABLE uniks.uniks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE uniks.uniks_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    unik_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner','admin','editor','member')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, unik_id)
);
```

### TypeORM Entities (Excerpt)
```typescript
export const UNIK_ROLES = ['owner','admin','editor','member'] as const
export type UnikRole = typeof UNIK_ROLES[number]

@Entity({ schema: 'uniks', name: 'uniks' })
export class Unik { /* id, name, description, timestamps, memberships */ }

@Entity({ schema: 'uniks', name: 'uniks_users' })
export class UnikUser { /* id, userId, unikId, role, createdAt */ }
```

### RLS Policies (Conceptual)
```sql
ALTER TABLE uniks.uniks ENABLE ROW LEVEL SECURITY;
ALTER TABLE uniks.uniks_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY uniks_select_members ON uniks.uniks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM uniks.uniks_users mu
            WHERE mu.unik_id = uniks.id AND mu.user_id = auth.uid()
        )
    );
```

## Integration

This package integrates with:

- **Main Server**: Route mounting + session context injection
- **Passport.js**: Session layer; user identity hydration
- **Supabase**: Token validation & identity source
- **TypeORM**: Repository access, schema-scoped entities
- **Express**: Routing & middleware chain

## Development

### Prerequisites

- Node.js 18+
- PNPM package manager
- PostgreSQL with `pgcrypto` (for `gen_random_uuid()`)
- Supabase project access (URL, anon/service keys)

### Installation

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run in development mode
pnpm dev
```

### Build Commands

```bash
# Build for production
pnpm build

# Build with watch mode
pnpm dev

# Build specific package
pnpm build --filter @universo/uniks-srv
```

## Configuration

The package uses the following configuration:

-   **TypeScript**: Strict type checking enabled
-   **TypeORM**: Database ORM configuration
-   **Express**: Web framework setup
-   **Supabase**: Authentication and database integration

## Dependencies

### Core Dependencies

-   `express`: Web framework
-   `typeorm`: Database ORM
-   `pg`: PostgreSQL driver
-   `@supabase/supabase-js`: Supabase client

### Development Dependencies

-   `typescript`: TypeScript compiler
-   `@types/express`: TypeScript definitions for Express
-   `@types/node`: TypeScript definitions for Node.js

## Database Migrations

Single in-place updated migration (`AddUniks`) modified to:

- Introduce schema `uniks`
- Rename legacy `user_uniks` → `uniks.uniks_users`
- Add composite uniqueness `(user_id, unik_id)`
- Expand role set + CHECK constraint
- Enable RLS + membership policies
- Add indexes for membership lookup

## Type Declarations

The package provides TypeScript declarations for external modules:

-   `flowiseRoutes.d.ts`: Declarations for Flowise route modules
-   Entity interfaces for database models
-   API request/response types

## Security

- **Hybrid Auth**: Passport.js session + Supabase JWT verification
- **Role Authorization**: Central guard (`WorkspaceAccessService.ensure`)
- **RLS Defense-in-Depth**: DB isolation + application checks
- **SQL Injection Protection**: TypeORM parameterization
- **Input Validation**: DTO-level sanitization & schema checks
- **Least Privilege**: Multi-tier roles allow minimization of power

## Error Handling

Standardized error taxonomy:

- **401 Unauthorized**: Missing/invalid session or token
- **403 Forbidden**: Role insufficient (logged & anonymized)
- **404 Not Found**: Workspace inaccessible or absent
- **409 Conflict**: Duplicate membership
- **422 Unprocessable Entity**: Validation failure
- **500 Internal Error**: Unexpected server fault (correlated via request ID)

## Contributing

When contributing to this package:

1. Follow TypeScript best practices
2. Maintain database migration compatibility
3. Add proper error handling
4. Include TypeScript type definitions
5. Follow the project's coding standards

## Related Documentation

-   [Main Apps Documentation](../README.md)
-   [Uniks Frontend Documentation](../uniks-frt/base/README.md)
-   [Platform Architecture](../../../docs/en/applications/README.md)

---

**Universo Platformo | Uniks Server Package**

## Testing

Execute backend unit tests with Jest:

```bash
pnpm --filter @universo/uniks-srv test
```

The suite uses the shared Supabase client mock from `@testing/backend/mocks`, so no external services are required.
