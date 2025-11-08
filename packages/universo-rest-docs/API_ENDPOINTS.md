# Universo Platformo API Endpoints - Master List

> **Last Updated:** 2025-11-02  
> **API Version:** 2.0.0  
> **Base URL:** `/api/v1`

## Overview

This document provides a comprehensive list of all REST API endpoints in Universo Platformo, organized by functional domains.

## Authentication

All protected endpoints require JWT authentication via Supabase.

**Header Format:**
```
Authorization: Bearer <jwt_token>
```

**Security Model:**
- Row Level Security (RLS) enforced at database level
- User context automatically applied via `ensureAuthWithRls` middleware
- Rate limiting: 100 req/min (read), 60 req/min (write)

---

## 1. Workspace Management (Uniks)

**Base Path:** `/uniks`

### Collection Operations

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/uniks` | List all workspaces for current user | ✅ | ✅ |
| POST | `/uniks` | Create new workspace | ✅ | ✅ |

**Query Parameters (GET /uniks):**
- `limit` (integer, 1-1000, default: 100) - Pagination limit
- `offset` (integer, min: 0, default: 0) - Pagination offset
- `sortBy` (enum: name, created, updated, default: updated) - Sort field
- `sortOrder` (enum: asc, desc, default: desc) - Sort direction

**Response Headers (GET /uniks):**
- `X-Pagination-Limit` - Applied limit
- `X-Pagination-Offset` - Applied offset
- `X-Total-Count` - Total items count
- `X-Pagination-Has-More` - More items available (true/false)

### Individual Operations

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId` | Get workspace details | ✅ | ✅ |
| PUT | `/unik/:unikId` | Update workspace (owner/admin only) | ✅ | ✅ |
| DELETE | `/unik/:unikId` | Delete workspace (owner only) | ✅ | ✅ |

---

## 2. Space Management

**Base Path:** `/unik/:unikId/spaces`

### Space Collection Operations

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/spaces` | List all spaces in workspace | ✅ | ✅ |
| POST | `/unik/:unikId/spaces` | Create new space (auto-creates default canvas) | ✅ | ✅ |

### Individual Space Operations

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/spaces/:spaceId` | Get space details with canvases | ✅ | ✅ |
| PUT | `/unik/:unikId/spaces/:spaceId` | Update space metadata | ✅ | ✅ |
| DELETE | `/unik/:unikId/spaces/:spaceId` | Delete space and all canvases | ✅ | ✅ |

---

## 3. Canvas Management

**Base Path:** `/unik/:unikId/spaces/:spaceId/canvases`

### Canvas Collection Operations

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/spaces/:spaceId/canvases` | List canvases in space | ✅ | ✅ |
| POST | `/unik/:unikId/spaces/:spaceId/canvases` | Create new canvas | ✅ | ✅ |
| POST | `/unik/:unikId/spaces/:spaceId/canvases/import` | Import canvas from template | ✅ | ✅ |

### Individual Canvas Operations

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/spaces/:spaceId/canvases/:canvasId` | Get canvas details | ✅ | ✅ |
| PUT | `/unik/:unikId/spaces/:spaceId/canvases/:canvasId` | Update canvas | ✅ | ✅ |
| DELETE | `/unik/:unikId/spaces/:spaceId/canvases/:canvasId` | Delete canvas | ✅ | ✅ |
| PUT | `/unik/:unikId/spaces/:spaceId/canvases/reorder` | Reorder canvases | ✅ | ✅ |

### Canvas Version Operations

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/spaces/:spaceId/canvases/:canvasId/versions` | List canvas versions | ✅ | ✅ |
| POST | `/unik/:unikId/spaces/:spaceId/canvases/:canvasId/versions` | Create new version | ✅ | ✅ |
| PUT | `/unik/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId` | Update version | ✅ | ✅ |
| POST | `/unik/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId/activate` | Activate version | ✅ | ✅ |
| DELETE | `/unik/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId` | Delete version | ✅ | ✅ |

### Canvas Utility Operations

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/spaces/:spaceId/canvases/:canvasId/streaming` | Check streaming validity | ✅ | ✅ |
| GET | `/unik/:unikId/spaces/:spaceId/canvases/:canvasId/uploads` | Check uploads validity | ✅ | ✅ |

---

## 4. Metaverse Management

**Base Path:** `/metaverses`

### Collection Operations

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/metaverses` | List all metaverses | ✅ | ✅ |
| POST | `/metaverses` | Create new metaverse | ✅ | ✅ |

**Query Parameters (GET /metaverses):**
- `limit`, `offset`, `sortBy`, `sortOrder` - Standard pagination
- `search` (string) - Search by name or description

### Individual Operations

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/metaverses/:id` | Get metaverse details | ✅ | ✅ |
| PUT | `/metaverses/:id` | Update metaverse | ✅ | ✅ |
| DELETE | `/metaverses/:id` | Delete metaverse | ✅ | ✅ |

---

## 5. Section Management

**Base Path:** `/sections`

Similar structure to Metaverses (GET, POST, GET/:id, PUT/:id, DELETE/:id)

---

## 6. Entity Management

**Base Path:** `/entities`

Similar structure to Metaverses with additional relationship operations.

---

## 7. Publication System

**Base Path:** `/publish`

### AR.js Publication

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| POST | `/publish/arjs` | Create/update AR.js publication | ✅ | ✅ |
| GET | `/publish/links/arjs` | Get AR.js publication links | ✅ | ✅ |

**Request Body (POST /publish/arjs):**
```json
{
  "canvasId": "uuid",
  "versionGroupId": "uuid",
  "technology": "arjs",
  "template": "quiz",
  "settings": {}
}
```

### PlayCanvas Publication

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| POST | `/publish/playcanvas` | Create/update PlayCanvas publication | ✅ | ✅ |
| GET | `/publish/links/playcanvas` | Get PlayCanvas publication links | ✅ | ✅ |

### Publication Retrieval

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/publish/:publicationId/flowdata` | Get raw flowData for publication | ✅ | ✅ |

---

## 8. Profile Management

**Base Path:** `/profile`

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/profile` | Get current user profile | ✅ | ✅ |
| PUT | `/profile` | Update user profile | ✅ | ✅ |

---

## 9. Space Builder (AI)

**Base Path:** `/space-builder`

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| POST | `/space-builder/generate` | Generate space from AI prompt | ✅ | ✅ |

**Request Body:**
```json
{
  "prompt": "Create a 3D art gallery with paintings",
  "credentialId": "uuid",
  "options": {}
}
```

---

## 10. Unik-Scoped Resources

**Base Path:** `/unik/:unikId`

The following resources are scoped to specific workspaces:

### Flow Configuration

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/flow-config/:id` | Get canvas configuration | ✅ | ✅ |

### Tools

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/tools` | List tools | ✅ | ✅ |
| POST | `/unik/:unikId/tools` | Create tool | ✅ | ✅ |
| GET | `/unik/:unikId/tools/:id` | Get tool details | ✅ | ✅ |
| PUT | `/unik/:unikId/tools/:id` | Update tool | ✅ | ✅ |
| DELETE | `/unik/:unikId/tools/:id` | Delete tool | ✅ | ✅ |

### Variables

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/variables` | List variables | ✅ | ✅ |
| POST | `/unik/:unikId/variables` | Create variable | ✅ | ✅ |
| GET | `/unik/:unikId/variables/:id` | Get variable | ✅ | ✅ |
| PUT | `/unik/:unikId/variables/:id` | Update variable | ✅ | ✅ |
| DELETE | `/unik/:unikId/variables/:id` | Delete variable | ✅ | ✅ |

### Credentials

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/credentials` | List credentials | ✅ | ✅ |
| POST | `/unik/:unikId/credentials` | Create credential | ✅ | ✅ |
| GET | `/unik/:unikId/credentials/:id` | Get credential | ✅ | ✅ |
| PUT | `/unik/:unikId/credentials/:id` | Update credential | ✅ | ✅ |
| DELETE | `/unik/:unikId/credentials/:id` | Delete credential | ✅ | ✅ |

### Assistants (AI)

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/assistants` | List assistants | ✅ | ✅ |
| POST | `/unik/:unikId/assistants` | Create assistant | ✅ | ✅ |
| GET | `/unik/:unikId/assistants/:id` | Get assistant | ✅ | ✅ |
| PUT | `/unik/:unikId/assistants/:id` | Update assistant | ✅ | ✅ |
| DELETE | `/unik/:unikId/assistants/:id` | Delete assistant | ✅ | ✅ |

### API Keys

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/apikey` | List API keys | ✅ | ✅ |
| POST | `/unik/:unikId/apikey` | Create API key | ✅ | ✅ |
| PUT | `/unik/:unikId/apikey/:id` | Update API key | ✅ | ✅ |
| DELETE | `/unik/:unikId/apikey/:id` | Delete API key | ✅ | ✅ |

### Document Store

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/unik/:unikId/document-store` | List document stores | ✅ | ✅ |
| POST | `/unik/:unikId/document-store` | Create document store | ✅ | ✅ |
| GET | `/unik/:unikId/document-store/:id` | Get document store | ✅ | ✅ |
| PUT | `/unik/:unikId/document-store/:id` | Update document store | ✅ | ✅ |
| DELETE | `/unik/:unikId/document-store/:id` | Delete document store | ✅ | ✅ |

---

## 11. Public Endpoints

**Base Path:** `/public`

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/public/canvases/:id` | Get public canvas (no auth) | ❌ | ❌ |

---

## 12. Utility Endpoints

### Health Check

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/ping` | Server health check | ❌ | ❌ |

### Version

| Method | Endpoint | Description | Auth | RLS |
|--------|----------|-------------|------|-----|
| GET | `/version` | Get API version | ❌ | ❌ |

---

## Rate Limiting

All authenticated endpoints are protected by distributed rate limiting (Redis-based):

- **Read operations** (GET): 100 requests/minute
- **Write operations** (POST, PUT, DELETE): 60 requests/minute

**Response Headers:**
- `X-RateLimit-Limit` - Total allowed requests
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Time when limit resets (Unix timestamp)

**429 Response:**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "statusCode": 429,
  "retryAfter": 45
}
```

---

## Error Responses

All errors follow a consistent schema:

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "statusCode": 400,
  "timestamp": "2025-11-02T10:00:00Z",
  "path": "/api/v1/uniks"
}
```

**Common Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Notes

1. **Pagination:** All list endpoints support consistent pagination via `limit`, `offset`, `sortBy`, `sortOrder` query parameters.

2. **RLS Context:** All database queries automatically filter results based on user's workspace membership via Row Level Security policies.

3. **Version Control:** Canvas versioning system maintains history of all changes with ability to activate/deactivate versions.

4. **Multi-Technology Export:** Publication system supports multiple rendering engines (AR.js, PlayCanvas, Babylon.js planned).

---

**See Also:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and terminology
- [README.md](./README.md) - Getting started guide
- [Swagger UI](http://localhost:6655/api-docs) - Interactive API documentation
