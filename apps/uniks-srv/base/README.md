# Uniks Server (uniks-srv)

Backend workspace package for workspace management functionality in the Universo Platformo ecosystem.

## Overview

The Uniks Server is a backend workspace package (`@universo/uniks-srv`) that provides workspace management functionality. It handles workspace CRUD operations, member management, and integrates with the main Flowise server to provide workspace-specific routing.

## Key Features

-   **Workspace CRUD Operations**: Create, read, update, and delete workspaces
-   **Member Management**: Add and remove workspace members
-   **Database Integration**: TypeORM entities and PostgreSQL migrations
-   **Authentication**: Supabase integration for user authentication
-   **Route Integration**: Nested route mounting under `/:unikId` prefix
-   **Type Safety**: Full TypeScript support with type declarations

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

## API Endpoints

### Workspace Management

-   `GET /uniks` - List all workspaces for the authenticated user
-   `POST /uniks` - Create a new workspace
-   `GET /uniks/:id` - Get workspace details
-   `PUT /uniks/:id` - Update workspace
-   `DELETE /uniks/:id` - Delete workspace

### Member Management

-   `POST /uniks/members` - Add member to workspace
-   `DELETE /uniks/members/:userId` - Remove member from workspace
-   `GET /uniks/:id/members` - List workspace members

## Database Schema

### Unik Entity

```typescript
interface Unik {
    id: string
    name: string
    description?: string
    owner_id: string
    created_at: Date
    updated_at: Date
}
```

### UserUnik Entity

```typescript
interface UserUnik {
    id: string
    user_id: string
    unik_id: string
    role: 'owner' | 'member'
    created_at: Date
}
```

## Integration

This package integrates with:

-   **Main Server**: Provides workspace routes to the main Flowise server
-   **Supabase**: Uses authentication and database services
-   **TypeORM**: Database ORM for entity management
-   **Express**: Web framework for route handling

## Development

### Prerequisites

-   Node.js 18+
-   PNPM package manager
-   PostgreSQL database
-   Supabase project access

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

The package includes PostgreSQL migrations for:

-   Creating the `uniks` table
-   Creating the `user_uniks` table
-   Setting up proper indexes and constraints
-   Adding foreign key relationships

## Type Declarations

The package provides TypeScript declarations for external modules:

-   `flowiseRoutes.d.ts`: Declarations for Flowise route modules
-   Entity interfaces for database models
-   API request/response types

## Security

-   **Authentication**: All routes require valid Supabase JWT tokens
-   **Authorization**: Workspace operations are restricted to owners/members
-   **SQL Injection Protection**: Uses TypeORM parameterized queries
-   **Input Validation**: Request validation for all endpoints

## Error Handling

The package implements comprehensive error handling:

-   **Database Errors**: Proper error responses for database operations
-   **Authentication Errors**: 401 responses for invalid tokens
-   **Authorization Errors**: 403 responses for unauthorized access
-   **Validation Errors**: 400 responses for invalid input data

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
