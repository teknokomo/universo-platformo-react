# Universo Platformo API Architecture

> **Last Updated:** 2025-11-02  
> **Version:** 2.0.0

## Overview

This document describes the architectural principles, terminology, and design patterns used in the Universo Platformo REST API.

---

## 1. Core Terminology

**Unik (Workspace):**
- Top-level container for a user's work
- Equivalent to a "project" or "organization"
- Contains: spaces, tools, credentials, variables, assistants
- **Database Table:** `uniks`

**Space:**
- Logical grouping of related canvases
- Example: "Marketing Department", "Product Demos", "AI Agents"
- Contains: multiple canvases, shared configuration
- **Database Table:** `spaces`

**Canvas:**
- Individual 3D scene, AI workflow, or interactive experience
- The fundamental unit of content creation
- Contains: node graph (flowData), version history, execution config
- **Database Table:** `canvases`

**Metaverse:**
- Thematic collection connecting multiple spaces/canvases
- Examples: "Corporate Universe", "Educational Hub", "Gaming Realm"
- **Database Table:** `metaverses`

**Section & Entity:**
- **Section:** Organizational unit within a metaverse (e.g., "Reception Area")
- **Entity:** Individual 3D object or interactive element
- **Database Tables:** `sections`, `entities`

---

## 2. Hierarchical Structure

```
User (Supabase Auth)
  │
  ├── Unik (Workspace) 1
  │     │
  │     ├── Space 1
  │     │     ├── Canvas 1 (v1, v2, v3...)
  │     │     ├── Canvas 2
  │     │     └── Canvas 3
  │     │
  │     ├── Space 2
  │     │     └── Canvas 4
  │     │
  │     ├── Tools (shared across all spaces)
  │     ├── Credentials (shared)
  │     └── Variables (shared)
  │
  ├── Unik (Workspace) 2
  │     └── ...
  │
  └── Metaverses
        ├── Metaverse 1
        │     ├── Section 1
        │     │     └── Entity 1
        │     └── Section 2
        └── Metaverse 2
```

**Design Principles:**

1. **Workspace Isolation:** Uniks are fully isolated; users cannot access other users' workspaces unless explicitly shared
2. **Space Grouping:** Spaces organize canvases by theme, project, or department
3. **Shared Resources:** Tools, credentials, and variables are shared across all spaces in a unik
4. **Version Control:** Each canvas maintains a full version history with rollback capability
5. **Public Access:** Individual canvases can be made public via `/public/canvases/:id` endpoint

---

## 3. Security Architecture

### Row Level Security (RLS)

**Implementation:**
- All database queries use **Supabase RLS policies**
- User context automatically injected via `ensureAuthWithRls` middleware
- Zero trust model: application code cannot bypass policies

**Policy Structure:**
```sql
-- Example: Canvas access policy
CREATE POLICY "canvas_access_policy" ON canvases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM unik_members
      WHERE unik_members.unik_id = canvases.unik_id
        AND unik_members.user_id = auth.uid()
    )
  );
```

**Middleware Chain:**
1. `verifyToken()` - Validates JWT signature
2. `ensureAuthWithRls()` - Sets RLS context (`SET LOCAL role = 'authenticated'`)
3. `rateLimiter()` - Enforces request limits
4. Route handler executes with user context

**Authorization Levels:**

| Role | Permissions | Notes |
|------|-------------|-------|
| **Owner** | Full CRUD on unik, spaces, canvases | Cannot transfer ownership |
| **Admin** | CRUD on spaces, canvases | Cannot delete unik |
| **Editor** | Create/update canvases | Cannot delete |
| **Viewer** | Read-only access | Cannot modify |

### Rate Limiting

**Technology:** Redis-based distributed rate limiter (ioredis + rate-limiter-flexible)

**Configuration:**
```typescript
const readLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 100,        // requests
  duration: 60,       // per minute
  blockDuration: 60   // block for 60 seconds
});

const writeLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 60,
  duration: 60,
  blockDuration: 120  // longer block for abuse
});
```

**Headers:**
- `X-RateLimit-Limit` - Total allowed requests
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Unix timestamp of reset

---

## 4. Data Model Patterns

### TypeORM Repository Pattern

**Principle:** All database access goes through TypeORM repositories (no raw SQL or direct Supabase calls).

**Example:**
```typescript
import { getDataSource } from '@universo/flowise-server/DataSource';
import { Canvas } from '@universo/flowise-server/database/entities/Canvas';

// Repository-based query
const canvasRepo = getDataSource().getRepository(Canvas);
const canvas = await canvasRepo.findOne({
  where: { id: canvasId },
  relations: ['space', 'versions']
});
```

### Entity Registration

**Central Registry:** `packages/flowise-core-backend/base/src/database/entities/index.ts`

All entities must be:
1. Defined in their package's `src/database/entities/` directory
2. Exported from the central `index.ts`
3. Registered in `AppDataSource` initialization

**Migration Registration:** `packages/flowise-core-backend/base/src/database/migrations/postgres/index.ts`

Each package exports its migrations, which are combined into `postgresMigrations` array.

### Version Control Schema

**Canvas Versions Table:**
```typescript
@Entity()
class CanvasVersion {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Canvas, canvas => canvas.versions)
  canvas: Canvas;

  @Column('text')
  flowData: string; // JSON node graph

  @Column('int')
  versionNumber: number;

  @Column('boolean', { default: false })
  isActive: boolean;

  @Column('timestamp')
  createdAt: Date;

  @Column('varchar', { length: 255 })
  createdBy: string; // User ID
}
```

**Activation Logic:**
1. On activation, set `isActive = false` for all other versions
2. Set `isActive = true` for target version
3. Copy `flowData` to parent `Canvas.flowData` (for performance)

---

## 5. API Design Patterns

### RESTful Hierarchy

**Pattern:** Nested resources reflect database relationships

```
/unik/:unikId/spaces/:spaceId/canvases/:canvasId
```

**Benefits:**
- Self-documenting URLs
- Natural authorization scoping
- Predictable CRUD operations

### Pagination

**Standard Parameters:**
```typescript
interface PaginationParams {
  limit?: number;      // 1-1000, default: 100
  offset?: number;     // min: 0, default: 0
  sortBy?: string;     // default: 'updated'
  sortOrder?: 'asc' | 'desc'; // default: 'desc'
}
```

**Response Headers:**
```
X-Pagination-Limit: 100
X-Pagination-Offset: 0
X-Total-Count: 350
X-Pagination-Has-More: true
```

**Implementation:**
```typescript
const [items, total] = await repo.findAndCount({
  take: limit,
  skip: offset,
  order: { [sortBy]: sortOrder }
});

res.header('X-Total-Count', total.toString());
res.header('X-Pagination-Has-More', (offset + limit < total).toString());
```

### Error Handling

**Standard Error Schema:**
```typescript
interface ApiError {
  error: string;        // Error type (e.g., "ValidationError")
  message: string;      // User-facing message
  statusCode: number;   // HTTP status code
  timestamp: string;    // ISO 8601 timestamp
  path: string;         // Request path
  details?: object;     // Optional validation details
}
```

**Example:**
```json
{
  "error": "ValidationError",
  "message": "Invalid canvas configuration",
  "statusCode": 400,
  "timestamp": "2025-11-02T10:30:00Z",
  "path": "/api/v1/unik/abc-123/spaces/xyz-789/canvases",
  "details": {
    "flowData": "Must be valid JSON",
    "name": "Must be between 1 and 255 characters"
  }
}
```

---

## 6. Publication System Architecture

### Multi-Technology Export

**Supported Engines:**
- **AR.js** - WebXR marker-based augmented reality
- **PlayCanvas** - High-performance 3D WebGL engine
- **Babylon.js** (planned) - Full-featured 3D framework

**Publication Flow:**
```
1. User requests publication via POST /publish/{technology}
2. System creates Publication record (DB)
3. Converter transforms flowData → technology-specific format
   - AR.js: Converts to UPDL (Universo Pattern Description Language)
   - PlayCanvas: Generates scene JSON + scripts
4. Static files generated and uploaded to CDN
5. Publication links returned to user
```

**Database Schema:**
```typescript
@Entity()
class Publication {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Canvas)
  canvas: Canvas;

  @Column('varchar')
  technology: 'arjs' | 'playcanvas' | 'babylonjs';

  @Column('varchar')
  template: string; // e.g., 'quiz', 'gallery', 'game'

  @Column('jsonb')
  settings: object; // Technology-specific settings

  @Column('text')
  publicUrl: string; // CDN URL

  @Column('timestamp')
  publishedAt: Date;
}
```

### UPDL (Universo Pattern Description Language)

**Purpose:** Domain-specific language for describing 3D scenes

**Example:**
```yaml
scene:
  name: "Art Gallery"
  entities:
    - type: room
      dimensions: [10, 3, 10]
      walls:
        - position: north
          material: brick
          entities:
            - type: painting
              position: [0, 1.5, 0]
              image: /assets/mona-lisa.jpg
```

**Conversion Pipeline:**
```
Canvas flowData (JSON) → UPDL Parser → AR.js Scene Graph → WebXR Export
```

---

## 7. Technology Stack

### Backend

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Runtime** | Node.js 18+ | ES modules enabled |
| **Framework** | Express.js | Minimal middleware |
| **Database** | PostgreSQL 14+ | Via Supabase |
| **ORM** | TypeORM 0.3+ | Repository pattern |
| **Auth** | Supabase Auth | JWT + RLS |
| **Cache** | Redis 7+ | Rate limiting + session storage |
| **Validation** | Zod | Runtime schema validation |

### Frontend

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | React 18 | JSX (migrating to TSX) |
| **UI Library** | Material-UI 5 | Custom theme |
| **State** | Zustand | Minimal boilerplate |
| **API Client** | @universo/api-client | Type-safe requests |

### Build System

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **PNPM** | Workspace package manager | pnpm-workspace.yaml |
| **Turbo** | Monorepo build orchestration | turbo.json |
| **tsdown** | TypeScript dual-build (CJS+ESM) | tsconfig.json + tsconfig.esm.json |
| **ESLint** | Linting | .eslintrc.js |

---

## 8. Development Workflow

### Package Creation Guidelines

**Frontend Packages (TSX):**
```
packages/new-feature-frontend/
├── base/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.tsx
│   ├── dist/           # Generated by tsdown
│   │   ├── index.cjs   # CommonJS build
│   │   └── index.mjs   # ESM build
│   ├── package.json    # name: "@universo/new-feature-frontend"
│   ├── tsconfig.json   # CJS target
│   └── tsconfig.esm.json # ESM target
└── README.md
```

**Backend Packages (TypeORM):**
```
packages/new-service-backend/
├── base/
│   ├── src/
│   │   ├── database/
│   │   │   ├── entities/
│   │   │   │   └── NewEntity.ts
│   │   │   └── migrations/
│   │   │       └── postgres/
│   │   │           ├── Migration1.ts
│   │   │           └── index.ts  # Export migration array
│   │   ├── routes/
│   │   └── services/
│   └── package.json
└── README.md
```

**Entity Registration Steps:**
1. Create entity in package: `src/database/entities/NewEntity.ts`
2. Export from central registry: `packages/flowise-core-backend/base/src/database/entities/index.ts`
3. Create migrations in package: `src/database/migrations/postgres/`
4. Export migrations array: `src/database/migrations/postgres/index.ts`
5. Import into central registry: `packages/flowise-core-backend/base/src/database/migrations/postgres/index.ts`

### Workspace Imports

**✅ CORRECT:**
```typescript
import { Canvas } from '@universo/flowise-server/database/entities';
import { SpaceService } from '@universo/spaces-backend';
import { Button } from '@universo/template-mui';
```

**❌ INCORRECT:**
```typescript
import { Canvas } from '../../../flowise-server/src/database/entities';
import { SpaceService } from '../../spaces-backend/base/src/services';
```

**Rationale:** Workspace protocol imports enable:
- Future extraction to separate repos
- Circular dependency prevention
- IDE autocomplete support
- Consistent module resolution

---

## 9. Documentation Standards

### OpenAPI 3.1.0 Compliance

**Target Specification:** [OpenAPI 3.1.0](https://spec.openapis.org/oas/v3.1.0)

**Key Features Used:**
- **JSON Schema 2020-12:** Full compatibility with modern JSON Schema
- **Webhooks:** Document event-driven endpoints
- **Nullable Types:** `type: [string, null]` instead of `nullable: true`
- **$ref Everywhere:** No restrictions on $ref placement

**Schema Generation Pipeline:**
```
Zod Schemas (@universo/types)
  ↓
zod-to-openapi
  ↓
OpenAPI 3.1 JSON
  ↓
@redocly/openapi-cli (validation)
  ↓
swagger-ui-express (serving)
```

### Code Comments Style

**TypeScript/JavaScript:**
```typescript
/**
 * Creates a new canvas within a space.
 * 
 * @param unikId - Workspace UUID
 * @param spaceId - Space UUID
 * @param data - Canvas creation data
 * @returns Created canvas with auto-generated ID
 * @throws {ValidationError} Invalid flowData structure
 * @throws {ForbiddenError} User lacks Editor role
 * 
 * @example
 * const canvas = await createCanvas('abc-123', 'xyz-789', {
 *   name: 'My Canvas',
 *   flowData: '{"nodes": [], "edges": []}'
 * });
 */
async function createCanvas(unikId: string, spaceId: string, data: CreateCanvasDto) {
  // Implementation
}
```

**OpenAPI YAML:**
```yaml
/unik/{unikId}/spaces/{spaceId}/canvases:
  post:
    summary: Create new canvas
    description: |
      Creates a canvas within the specified space. Automatically creates
      an initial version (v1) and sets it as active.
      
      **Authorization:** Requires Editor or Admin role in the workspace.
    operationId: createCanvas
    tags:
      - Canvas Management
```

---

## 10. Testing Strategy

### Test Coverage Goals

| Layer | Target | Current | Tools |
|-------|--------|---------|-------|
| **Unit Tests** | 80% | ~45% | Jest + ts-jest |
| **Integration Tests** | 60% | ~30% | Supertest + test DB |
| **E2E Tests** | Critical paths | ~10% | Playwright |

### Testing Patterns

**Repository Testing:**
```typescript
describe('CanvasRepository', () => {
  let dataSource: DataSource;
  let repo: Repository<Canvas>;

  beforeAll(async () => {
    dataSource = await createTestDataSource(); // In-memory PostgreSQL
    repo = dataSource.getRepository(Canvas);
  });

  it('should enforce RLS on canvas access', async () => {
    await setRlsContext(dataSource, 'user-123');
    const canvases = await repo.find();
    
    expect(canvases).toHaveLength(2); // User owns 2 canvases
    expect(canvases.every(c => c.unikId === 'user-123-unik')).toBe(true);
  });
});
```

**API Testing:**
```typescript
describe('POST /unik/:id/spaces/:id/canvases', () => {
  it('should return 403 for viewer role', async () => {
    const token = await getTestToken('viewer');
    
    const res = await request(app)
      .post('/api/v1/unik/abc/spaces/xyz/canvases')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Canvas', flowData: '{}' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });
});
```

---

## 11. Observability

### Logging

**Structure:** JSON-formatted logs for centralized aggregation

```json
{
  "timestamp": "2025-11-02T10:00:00Z",
  "level": "info",
  "service": "universo-rest-api",
  "userId": "user-123",
  "unikId": "abc-123",
  "path": "/api/v1/unik/abc-123/spaces",
  "method": "GET",
  "statusCode": 200,
  "duration": 45,
  "message": "Fetched 15 spaces"
}
```

### Metrics (Prometheus)

**Exposed Metrics:**
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency histogram
- `rls_query_duration_seconds` - Database query time with RLS
- `rate_limit_hits_total` - Rate limiter blocks

**Endpoint:** `GET /metrics`

### Tracing (OpenTelemetry)

**Instrumented Operations:**
- HTTP requests (Express auto-instrumentation)
- Database queries (TypeORM instrumentation)
- Redis operations (ioredis instrumentation)

**Export:** OTLP to Grafana Cloud

---

## Conclusion

This architecture document serves as the **source of truth** for API design decisions in Universo Platformo. All new features must adhere to these patterns to maintain consistency and extensibility.

**For implementation details, see:**
- [API_ENDPOINTS.md](./API_ENDPOINTS.md) - Complete endpoint reference
- [README.md](./README.md) - Getting started guide
- Package-specific READMEs in `packages/*/base/README.md`

**For questions or proposals:**
- Open an issue in the repository
- Discuss in the #api-design channel (internal)

---

*Last reviewed: 2025-11-02 by AI Agent (IMPLEMENT mode)*
