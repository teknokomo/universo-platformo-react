# `packages/publish-backend` — Publication System Backend — [Status: MVP]

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo.

## Purpose

Backend service for managing publications, providing UPDL flow data, and serving public URLs for published AR.js and PlayCanvas content.

## Role in Architecture

-   Managing publication records in the database
-   Serving raw `flowData` from the database
-   Exporting shared UPDL and publication-related TypeScript types
-   Full independence from `packages/flowise-core-backend/base` business logic
-   Asynchronous route initialization to prevent race conditions

## Key Features

### Publication Management

-   **Create Publications**: API endpoints for creating AR.js and PlayCanvas publication records
-   **Retrieve Publications**: Serving public URLs for published content
-   **Flow Data Provider**: Providing raw `flowData` from the database
-   **Processing Delegation**: All UPDL processing delegated to frontend

### Centralized Types

-   **TypeScript Types**: Exporting shared UPDL types for frontend use
-   **Publication Interfaces**: Defining data structures for publications
-   **Type Consistency**: Single source of truth for publication types

## API Endpoints

### Create Publication

#### AR.js Publication

```
POST /api/v1/publish/arjs

Headers:
  Authorization: Bearer <jwt_token>

Body: {
  "canvasId": "uuid",
  "isPublic": true,
  "projectName": "My AR Experience",
  "libraryConfig": {
    "arjs": { "version": "3.4.7", "source": "kiberplano" },
    "aframe": { "version": "1.7.1", "source": "official" }
  },
  "renderConfig": {
    "arDisplayType": "wallpaper",
    "wallpaperType": "sphere"
  }
}

Response: {
  "success": true,
  "publicationId": "abc123",
  "publicUrl": "/p/arjs/abc123"
}
```

#### PlayCanvas Publication

```
POST /api/v1/publish/playcanvas

Headers:
  Authorization: Bearer <jwt_token>

Body: {
  "canvasId": "uuid",
  "isPublic": true,
  "projectName": "My 3D Experience",
  "libraryConfig": { ... }
}

Response: {
  "success": true,
  "publicationId": "xyz789",
  "publicUrl": "/p/playcanvas/xyz789"
}
```

### Get Publication Data

#### AR.js Public Data

```
GET /api/v1/publish/arjs/public/:publicationId

Response: {
  "success": true,
  "flowData": "{\"nodes\":[...],\"edges\":[...]}",
  "libraryConfig": {
    "arjs": { "version": "3.4.7", "source": "kiberplano" },
    "aframe": { "version": "1.7.1", "source": "official" }
  },
  "renderConfig": {
    "arDisplayType": "wallpaper",
    "wallpaperType": "sphere"
  }
}
```

#### PlayCanvas Public Data

```
GET /api/v1/publish/playcanvas/public/:publicationId

Response: {
  "success": true,
  "flowData": "{\"nodes\":[...],\"edges\":[...]}",
  "libraryConfig": { ... },
  "templateConfig": {
    "template": "mmoomm",
    "options": { ... }
  }
}
```

## Workspace Package Architecture

The backend is implemented as a **pnpm workspace package**:

-   **Package Name**: `@universo/publish-backend`
-   **Integration**: Used as dependency in main server
-   **Exports**: Routes, types, services, controllers via `src/index.ts`
-   **Type Sharing**: Source of truth for UPDL types consumed by frontend

### Package Structure

```
packages/publish-backend/
├── src/
│   ├── controllers/        # API controllers
│   ├── services/           # Business logic
│   ├── routes/             # Express route definitions
│   ├── types/              # TypeScript types and interfaces
│   └── index.ts            # Package entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Database Integration

### Publications Table

```sql
CREATE TABLE publications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    canvas_id UUID REFERENCES canvases(id),
    platform VARCHAR(50) NOT NULL, -- 'arjs' | 'playcanvas'
    public_id VARCHAR(255) UNIQUE NOT NULL,
    is_public BOOLEAN DEFAULT true,
    project_name VARCHAR(255),
    library_config JSONB,
    render_config JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Row-Level Security (RLS)

```sql
-- Read policy: public publications accessible to everyone
CREATE POLICY "Public publications are viewable by everyone"
ON publications FOR SELECT
USING (is_public = true);

-- Create policy: only authenticated users
CREATE POLICY "Users can create their own publications"
ON publications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update policy: only owner
CREATE POLICY "Users can update their own publications"
ON publications FOR UPDATE
USING (auth.uid() = user_id);
```

## Asynchronous Initialization

Routes are initialized asynchronously to prevent race conditions:

```typescript
// Asynchronous route creation function
export async function createPublishRoutes(): Promise<Router> {
    const router = Router()
    
    // Wait for database connection readiness
    await ensureDatabaseConnection()
    
    // Register routes
    router.post('/arjs', authenticateJWT, createARJSPublication)
    router.post('/playcanvas', authenticateJWT, createPlayCanvasPublication)
    router.get('/arjs/public/:id', getPublicARJSPublication)
    router.get('/playcanvas/public/:id', getPublicPlayCanvasPublication)
    
    return router
}
```

## Development

### Setup

```bash
# Install dependencies (from project root)
pnpm install

# Build workspace package
pnpm --filter @universo/publish-backend build
```

### Development Mode

```bash
# Development with watch mode
pnpm --filter @universo/publish-backend dev
```

### Testing

```bash
# Unit tests
pnpm --filter @universo/publish-backend test

# Integration tests
pnpm --filter @universo/publish-backend test:integration

# Linting
pnpm --filter @universo/publish-backend lint
```

## Security

-   **JWT Authentication**: All create endpoints require valid JWT token
-   **RLS Policies**: Database-level security for access control
-   **Input Validation**: Comprehensive validation of all input parameters
-   **Public Access**: Only public publications accessible without authentication

## Roadmap

### Phase 1: Basic Functionality ✅
- ✅ Create and retrieve AR.js publications
- ✅ Create and retrieve PlayCanvas publications
- ✅ Public URLs for published content

### Phase 2: Advanced Features
- ⏳ Publication versioning
- ⏳ View analytics
- ⏳ Custom domains

### Phase 3: Scaling
- ⏳ CDN integration for static assets
- ⏳ Public publication caching
- ⏳ Rate limiting for public endpoints

## See Also

- [Publish Frontend](./frontend.md) - Frontend component of publication system
- [Publish README](./README.md) - Publication system overview
