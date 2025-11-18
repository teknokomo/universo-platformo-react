# @universo/rest-docs

> 📚 REST API documentation for Universo Platformo

## Package Information

| Field | Value |
|-------|-------|
| **Package Name** | `@universo/rest-docs` |
| **Version** | See `package.json` |
| **Type** | Node.js API Documentation |
| **Build** | TypeScript with Swagger/OpenAPI 3.1 |
| **Purpose** | Interactive documentation for Universo Platformo public APIs |

## 🚀 Key Features

- 📚 **Complete API Documentation** - All Universo Platformo REST APIs documented
- 🔧 **Programmatic Access** - Execute tasks programmatically as in GUI
- 📖 **Interactive Documentation** - Swagger UI for live API testing
- 🎯 **OpenAPI 3.1 Compliant** - Modern specification with JSON Schema support
- 🔄 **Type-Safe Schemas** - Auto-generated from Zod validation schemas
- ⚡ **Real-Time Validation** - Test endpoints with instant feedback

## Description

A comprehensive REST API documentation for the Universo Platformo ecosystem. This package provides a Swagger UI interface that documents all public APIs, allowing users to programmatically execute the same tasks available in the GUI.

The documentation is auto-generated from OpenAPI 3.1 specifications and includes:
- Authentication endpoints (Supabase JWT)
- Canvas management (3D scenes, AI workflows)
- Workspace operations (Uniks)
- Space hierarchy (Spaces → Canvases)
- Metaverse system (collections, sections, entities)
- Publishing workflows (AR.js, PlayCanvas export)
- Profile management
- Space Builder AI APIs

## API Overview

### Core Endpoints

| Endpoint Category | Base Path | Description |
|------------------|-----------|-------------|
| **Authentication** | `/api/auth` | User login, registration, session management |
| **Workspaces (Uniks)** | `/api/uniks` | Workspace collection management |
| **Spaces** | `/api/unik/:id/spaces` | Space hierarchy within workspaces |
| **Canvases** | `/api/unik/:id/spaces/:id/canvases` | 3D scenes and AI workflow management |
| **Metaverses** | `/api/metaverses` | Thematic collections of spaces |
| **Sections & Entities** | `/api/sections`, `/api/entities` | Metaverse components |
| **Publishing** | `/api/publish` | Export to AR.js, PlayCanvas, Babylon.js |
| **Profiles** | `/api/profile` | User profile and settings |
| **Space Builder AI** | `/api/space-builder` | AI-powered space generation |

### Example API Calls

#### List All Canvases in a Space
```bash
curl -X GET "http://localhost:3000/api/v1/unik/{unikId}/spaces/{spaceId}/canvases" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Create a New Workspace (Unik)
```bash
curl -X POST "http://localhost:3000/api/v1/uniks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Workspace", "description": "Project workspace"}'
```

#### Publish Canvas to AR.js
```bash
curl -X POST "http://localhost:3000/api/v1/publish/arjs" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "canvasId": "canvas-uuid",
    "versionGroupId": "version-uuid",
    "technology": "arjs",
    "template": "quiz"
  }'
```

#### Generate Space with AI
```bash
curl -X POST "http://localhost:3000/api/v1/space-builder/generate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a 3D art gallery with paintings",
    "credentialId": "openai-credential-uuid"
  }'
```

## Usage

### Standalone Mode

To run this standalone:

1. Spin up Universo Platformo server:
    ```sh
    cd universo-platformo-react
    pnpm start
    ```
2. Start API Docs server (in separate terminal):
    ```sh
    cd packages/universo-rest-docs
    pnpm start
    ```

### Development Mode

To run in dev mode:

```sh
cd universo-platformo-react
pnpm dev
```

### Accessing Documentation

Once running, the interactive Swagger UI will be available at:
- **Local**: `http://localhost:6655/api-docs`
- **Production**: `https://your-domain.com/api-docs`

## Features

### Interactive Testing
- **Try It Out**: Execute API calls directly from the documentation
- **Authentication**: Test endpoints with your API keys or session tokens
- **Response Validation**: See real-time responses and status codes
- **Schema Inspection**: Examine request/response models in detail

### Code Generation
The Swagger UI provides code snippets in multiple languages:
- cURL
- JavaScript/Node.js
- Python
- Java
- C#

### API Versioning
Documentation follows semantic versioning:
- **v1**: Current stable API with Space+Canvas hierarchy
- All endpoints use `/api/v1` prefix for stability

## Configuration

### Environment Variables

```env
# API Documentation Server Port
REST_DOCS_PORT=6655

# Main Universo Platformo Server URL (for standalone mode)
UNIVERSO_SERVER_URL=http://localhost:3000

# OpenAPI Specification Path  
OPENAPI_SPEC_PATH=./src/openapi/index.yml

# Supabase Configuration (for auth testing)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Integration

This package integrates with:
- **Universo Platformo Server**: Mounts documentation at `/api-docs` endpoint
- **Supabase Authentication**: Validates JWT tokens for protected endpoints
- **TypeScript Types**: Shared Zod schemas from `@universo/types`
- **Rate Limiting**: Redis-based distributed rate limiting (100 read, 60 write req/min)

## Development

### Modern OpenAPI 3.1.0 Features

This package uses the latest OpenAPI 3.1.0 specification with these modern features:

- **JSON Schema 2020-12**: Full compatibility with modern JSON Schema validation
- **Webhooks Support**: Define webhook endpoints for async notifications (future)
- **Improved Discriminators**: Better polymorphic type handling
- **$ref Simplifications**: Cleaner schema references and composition
- **License Identifiers**: SPDX license expressions

### Zod Schema Integration

API schemas are auto-generated from Zod validation schemas using `@asteasolutions/zod-to-openapi`:

```typescript
// Define Zod schema in @universo/types/api
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
}).openapi('Workspace', {
  description: 'Workspace (Unik) entity',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'My Project',
    description: 'Main workspace for AR projects'
  }
});
```

This generates OpenAPI components automatically:

```yaml
components:
  schemas:
    Workspace:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
          minLength: 1
          maxLength: 255
        description:
          type: string
          maxLength: 2000
```

**Benefits:**
- ✅ Single source of truth (Zod schema used for both validation and docs)
- ✅ Type-safe API contracts (TypeScript types inferred from Zod)
- ✅ Automatic documentation updates when schemas change
- ✅ Runtime validation matches documentation exactly

### Validation

Validate OpenAPI specification against 3.1.0 standard:

```bash
pnpm validate
```

This runs `@redocly/openapi-cli` to check for:
- Syntax errors in YAML
- Invalid schema references
- Missing required fields
- Best practice violations
- Security scheme issues

### Updating API Docs

When adding new endpoints:
1. Define Zod schemas in `@universo/types/api`
2. Update OpenAPI specification in `src/yml/swagger.yml`
3. Add JSDoc annotations to route handlers
4. Rebuild the documentation: `pnpm build`
5. Validate spec: `pnpm validate`
6. Verify changes in Swagger UI at `http://localhost:6655/api-docs`

### Testing

```bash
pnpm --filter universo-rest-docs test
```

## License

Source code in this repository is made available under the Apache License Version 2.0.
