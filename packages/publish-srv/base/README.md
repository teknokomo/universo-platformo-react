# Publish Service (@universo/publish-srv)

Backend service for the publication system in Universo Platformo, refactored into a workspace package for modularity, clean integration, and type sharing.

## Project Structure

The project is structured as a **workspace package** (`@universo/publish-srv`), enabling clean separation and clear dependency management within the monorepo:

```
packages/publish-srv/base/
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
-   **Modular and Decoupled**: Fully independent from `packages/flowise-server` business logic. It no longer contains UPDL generation code.
-   **PlayCanvas Ready**: The same raw data endpoints are used by the PlayCanvas builder and templates.
-   **Canvas Integration**: Fully supports the new Canvas structure while maintaining backward compatibility with ChatFlow.
-   **Chatbot Publication**: Handles chatbot publication using Canvas-based configuration stored in `chatbotConfig` field.

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

#### Canvas-based Endpoints (New)
-   `POST /api/v1/publish/canvas` - Creates or updates a Canvas publication record.
-   `GET /api/v1/publish/canvas/public/:canvasId` - Gets the raw `flowData` for a given Canvas.
-   `GET /api/v1/publish/canvas/:canvasId` - Direct access to Canvas flow data for streaming.

#### Legacy Endpoints (Backward Compatibility)
-   `POST /api/v1/publish/arjs` - Creates or updates a publication record. Provide `canvasId` (legacy `chatflowId` is still accepted for compatibility).
-   `GET /api/v1/publish/arjs/public/:publicationId` - Gets the raw `flowData` for a given publication.
-   `GET /api/v1/publish/arjs/stream/:canvasId` - Legacy streaming endpoint (deprecated, use Canvas endpoints).

#### Chatbot Endpoints
-   `GET /api/v1/bots/:canvasId/config` - Gets chatbot configuration from Canvas.
-   `GET /api/v1/bots/:canvasId` - Renders chatbot interface for Canvas.
-   `GET /api/v1/bots/:canvasId/stream/:sessionId?` - Provides streaming chat functionality.

### `POST /api/v1/publish/canvas` (New)

Creates a publication record associated with a `canvasId`. The body should contain the canvas ID and any metadata required by the frontend.

**Example Request:**

```json
{
    "canvasId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
    "isPublic": true,
    "projectName": "My AR Experience",
    "libraryConfig": {
        "arjs": { "version": "3.4.7", "source": "kiberplano" },
        "aframe": { "version": "1.7.1", "source": "official" }
    }
}
```

### `POST /api/v1/publish/arjs` (Legacy)

Legacy alias for backwards compatibility. Accepts the same payload as the new endpoint but proxies `canvasId` when present. `canvasId` is maintained only for legacy clients and should be removed from new integrations.

**Example Request (legacy client):**

```json
{
    "canvasId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
    "canvasId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3", // Optional legacy field
    "isPublic": true,
    "projectName": "My AR Experience"
}
```

### `GET /api/v1/publish/canvas/public/:canvasId` (New)

Retrieves the raw `flowData` (as a JSON string) and configuration for a given `canvasId`. The frontend is responsible for parsing and processing this data with `UPDLProcessor`.

**Example Response:**

```json
{
    "success": true,
    "publicationId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
    "canvasId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
    "flowData": "{\"nodes\":[...],\"edges\":[...]}",
    "libraryConfig": {
        "arjs": { "version": "3.4.7", "source": "kiberplano" },
        "aframe": { "version": "1.7.1", "source": "official" }
    },
    "renderConfig": {
        "arDisplayType": "wallpaper",
        "wallpaperType": "standard"
    },
    "playcanvasConfig": {
        "gameMode": "singleplayer"
    }
}
```

### `GET /api/v1/publish/arjs/public/:publicationId` (Legacy)

Retrieves the raw `flowData` for a given `publicationId` (which can be either `canvasId` or legacy `chatflowId`). Maintains backward compatibility.

### Chatbot Configuration

Chatbot configuration is extracted from the Canvas `chatbotConfig` field:

```json
{
    "botType": "chat",
    "title": "My Chat Bot",
    "backgroundColor": "#ffffff",
    "textColor": "#303235",
    "allowedOrigins": ["https://example.com"]
}
```

## AR.js Render Configuration in Public API

The AR.js public endpoint now returns optional `renderConfig` derived from `chatbotConfig.arjs` to guide markerless or marker-based rendering on the frontend.

### Response Extension

```json
{
  "success": true,
  "publicationId": "<id>",
  "flowData": "{...}",
  "libraryConfig": { /* existing */ },
  "renderConfig": {
    "arDisplayType": "wallpaper" | "marker",
    "wallpaperType": "standard",
    "markerType": "preset" | "pattern",
    "markerValue": "hiro" | "<pattern-url>"
  }
}
```

### Source of Values

-   Extracted by `FlowDataService` from `canvas.chatbotConfig.arjs` if present.
-   Absent for legacy records; the frontend falls back to marker mode.

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

## Security Improvements (MVP)

Small, safe changes were added to improve API robustness without breaking clients:

- Rate limiting with `express-rate-limit`:
    - 60 req/min for write routes (POST/PATCH/DELETE /links)
    - 200 req/min for read routes (GET /links, GET /public/:slug)
    - Uses `standardHeaders: true`, `legacyHeaders: false`.
- Minimal runtime input validation:
    - `src/utils/validators.ts` checks required fields (e.g., `unikId`) and basic types.
    - Applied in `PublishController.createPublishLink` and `updatePublishLink`.
- Error sanitization:
    - `src/utils/errorSanitizer.ts` hides internal error details in production;
        logs still contain full context for debugging.

No public API shapes were changed; existing clients continue to work.

## Testing

Run Jest tests for services and routes:

```bash
pnpm --filter @universo/publish-srv test
```

The Flow data scenarios use the shared TypeORM factories and `createFlowDataServiceMock`/`createSupabaseClientMock` helpers from `@testing/backend/mocks`.

## Deployment note: trust proxy

If the main server runs behind a reverse proxy (Nginx, Traefik, Kubernetes ingress), ensure Express is configured with `app.set('trust proxy', 1)` (or a stricter value suitable for your topology). This allows rate limiting and IP-dependent features to read the real client IP from `X-Forwarded-For`.

The main server is responsible for this setting; this package only provides route-level middlewares.
