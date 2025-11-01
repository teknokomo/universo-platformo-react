# @universo/rest-docs

> 📚 REST API documentation for Universo Platformo

## Package Information

| Field | Value |
|-------|-------|
| **Package Name** | `@universo/rest-docs` |
| **Version** | See `package.json` |
| **Type** | Node.js API Documentation |
| **Build** | TypeScript with Swagger/OpenAPI |
| **Purpose** | Interactive documentation for Flowise public APIs |

## 🚀 Key Features

- 📚 **Complete API Documentation** - List of all Flowise public APIs
- 🔧 **Programmatic Access** - Execute tasks programmatically as in GUI
- 📖 **Interactive Documentation** - Swagger UI for API testing
- 🎯 **Standalone Mode** - Can run independently from main server
- 🔄 **Development Mode** - Auto-reload on changes

## Description

A comprehensive REST API documentation for the Universo Platformo ecosystem. This package provides a Swagger UI interface that documents all public APIs, allowing users to programmatically execute the same tasks available in the GUI.

The documentation is auto-generated from OpenAPI/Swagger specifications and includes:
- Authentication endpoints
- Chatflow management
- Workspace operations
- Space builder APIs
- Publishing workflows
- Profile management

## API Overview

### Core Endpoints

| Endpoint Category | Base Path | Description |
|------------------|-----------|-------------|
| **Authentication** | `/api/auth` | User login, registration, session management |
| **Chatflows** | `/api/chatflows` | AI chatflow CRUD operations |
| **Workspaces** | `/api/uniks` | Workspace management and collaboration |
| **Spaces** | `/api/spaces` | 3D/AR/VR space management |
| **Publishing** | `/api/publish` | Export workflows to various platforms |
| **Profiles** | `/api/profiles` | User profile and settings |

### Example API Calls

#### List All Chatflows
```bash
curl -X GET "http://localhost:3000/api/chatflows" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Create a New Workspace
```bash
curl -X POST "http://localhost:3000/api/uniks" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Workspace", "description": "Project workspace"}'
```

#### Export Space to PlayCanvas
```bash
curl -X POST "http://localhost:3000/api/publish/playcanvas" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"spaceId": "space-uuid", "target": "production"}'
```

## Usage

### Standalone Mode

To run this standalone:

1. Spin up Flowise server:
    ```sh
    cd Flowise
    pnpm start
    ```
2. Start API Docs server:
    ```sh
    cd packages/universo-rest-docs
    pnpm start
    ```

### Development Mode

To run in dev mode:

```sh
cd Flowise
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
Documentation is versioned to track changes:
- **v1**: Initial public API
- **v2**: Enhanced workspace collaboration (current)

## Configuration

### Environment Variables

```env
# API Documentation Server Port
REST_DOCS_PORT=6655

# Main Flowise Server URL (for standalone mode)
FLOWISE_SERVER_URL=http://localhost:3000

# OpenAPI Specification Path
OPENAPI_SPEC_PATH=./openapi.yaml
```

## Integration

This package integrates with:
- **Flowise Server**: Mounts documentation at `/api-docs` endpoint
- **Authentication System**: Validates session tokens for protected endpoints
- **TypeScript Types**: Shared type definitions from `@universo/types`

## Development

### Updating API Docs

When adding new endpoints:
1. Update OpenAPI specification in `openapi.yaml`
2. Add JSDoc annotations to route handlers
3. Rebuild the documentation: `pnpm build`
4. Verify changes in Swagger UI

### Testing

```bash
pnpm --filter universo-rest-docs test
```

## License

Source code in this repository is made available under the Apache License Version 2.0.
