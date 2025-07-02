# Publish Service (@universo/publish-srv)

Backend service for the publication system in Universo Platformo, refactored into a workspace package for modularity, clean integration, and type sharing.

## Project Structure

The project is structured as a **workspace package** (`@universo/publish-srv`), enabling clean separation and clear dependency management within the monorepo:

```
apps/publish-srv/base/
├── package.json              # Package config with scoped name "@universo/publish-srv"
├── tsconfig.json             # TypeScript configuration
└── src/
   ├── controllers/
   │  └── publishController.ts   # REST API controller (exported)
   ├── services/
   │  └── FlowDataService.ts     # Business logic for fetching flow data
   ├── routes/
   │  └── createPublishRoutes.ts # Express routes factory (exported)
   ├── types/
   │  └── publication.types.ts  # Shared UPDL types (exported)
   └── index.ts                 # Entry point with all package exports
```

### Workspace Package Architecture

This service is implemented as a **pnpm workspace package** that:

-   **Package Name**: `@universo/publish-srv` (scoped name for organization)
-   **Integration**: Used as a dependency `"@universo/publish-srv": "workspace:*"` in the main server.
-   **Exports**: Key modules (routes, types, services, controllers) are exported via `src/index.ts` for clean, controlled imports.
-   **Type Sharing**: Acts as the source of truth for UPDL types (`IUPDLSpace`, `IUPDLObject`, etc.), which are consumed by the `@universo/publish-frt` frontend package.

## Features

-   **Publication Management**: Provides API endpoints to create and retrieve publication records.
-   **Flow Data Provider**: Serves raw `flowData` from the database, delegating all UPDL processing to the frontend.
-   **Centralized Types**: Exports shared UPDL and publication-related TypeScript types for use across the platform.
-   **Modular and Decoupled**: Fully independent from `packages/server` business logic. It no longer contains UPDL generation code.

## Integration with Main Flowise Server

The service is tightly integrated with the main Flowise server, leveraging its core infrastructure while remaining modular.

### Asynchronous Route Initialization

**Critical Fix**: To solve race conditions where routes were registered before the database connection was ready, this package uses an **asynchronous routes factory**, similar to `@universo/profile-srv`.

The `createPublishRoutes(dataSource)` function is exported and called from the main server **after** the `DataSource` has been initialized. This ensures that the `FlowDataService` and its underlying repository are always available when the first request hits the controller.

```typescript
// Main server (simplified)
import { createPublishRoutes } from '@universo/publish-srv'

// ... after AppDataSource.initialize()
const publishRoutes = createPublishRoutes(AppDataSource)
this.app.use('/api/v1/publish', publishRoutes)
```

### Key Integration Points

1.  **Route Registration**: Asynchronous `createPublishRoutes` function ensures routes are registered safely.
2.  **Database Access**: The `FlowDataService` directly accesses the Flowise database via the TypeORM `DataSource` passed from the main server.
3.  **Authentication**: Inherits the main server's JWT authentication middleware, which is applied before the package's routes.

## REST API

The API is now streamlined to handle publication records and serve raw flow data.

### Endpoints:

-   `POST /api/v1/publish/arjs` - Creates or updates a publication record.
-   `GET /api/v1/publish/arjs/public/:publicationId` - Gets the raw `flowData` for a given publication.

### `POST /api/v1/publish/arjs`

Creates a publication record associated with a `chatflowId`. The body should contain the chatflow ID and any metadata required by the frontend.

**Example Request:**

```json
{
    "chatflowId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
    "isPublic": true,
    "projectName": "My AR Experience",
    "libraryConfig": {
        "arjs": { "version": "3.4.7", "source": "kiberplano" },
        "aframe": { "version": "1.7.1", "source": "official" }
    }
}
```

### `GET /api/v1/publish/arjs/public/:publicationId`

Retrieves the raw `flowData` (as a JSON string) and `libraryConfig` for a given `publicationId` (which is the `chatflowId`). The frontend is responsible for parsing and processing this data with `UPDLProcessor`.

**Example Response:**

```json
{
    "success": true,
    "flowData": "{\"nodes\":[...],\"edges\":[...]}",
    "libraryConfig": {
        "arjs": { "version": "3.4.7", "source": "kiberplano" },
        "aframe": { "version": "1.7.1", "source": "official" }
    }
}
```

## Architectural Changes Summary

-   **Decoupling**: The `utilBuildUPDLflow` logic was entirely **removed** from the backend and moved to the `UPDLProcessor` class in the `publish-frt` package.
-   **Single Responsibility**: This service is now only responsible for database interactions (CRUD on publications, fetching `flowData`) and is no longer involved in UPDL logic.
-   **Type-Driven Development**: This package is the source of truth for all publication-related types, ensuring consistency.

## Setup and Development

```bash
# Install dependencies from the project root
pnpm install

# Build the workspace package
pnpm --filter @universo/publish-srv build

# Run in development/watch mode
pnpm --filter @universo/publish-srv dev
```

---

_Universo Platformo | Publication Service_
