# @universo/flowise-apikey-srv

Backend package for API Key management in Universo Platformo (extracted from flowise-server).

## Overview

This package provides backend functionality for managing API keys used to authenticate external access to chatflows and agentflows. API keys allow secure programmatic access to published AI workflows.

## Package Information

- **Package**: `@universo/flowise-apikey-srv`
- **Version**: `0.1.0`
- **Type**: Backend (Modern)
- **Framework**: Express.js, TypeORM, TypeScript
- **Dependencies**: `@universo/uniks-srv` (Unik entity relation)

## Key Features

### 🗄️ Database Layer
- **ApiKey Entity**: TypeORM entity with Unik relation for multi-tenant isolation
- **Migrations**: PostgreSQL migrations for api_key table schema

### 🔧 Service Layer
- **ApiKeyService**: CRUD operations with DI pattern
- **Key Generation**: Secure API key generation
- **Validation**: Zod schemas for create/update operations
- **Error Handling**: Custom error classes with proper HTTP status codes

### 🔒 Security
- **Key Hashing**: API keys are hashed for secure storage
- **Unik Isolation**: API keys are scoped to individual Uniks

### 🛣️ Routes Layer
- **Express Router**: RESTful API endpoints with error handling middleware
- **Verification Endpoint**: Validate API keys for external access
- **DI Pattern**: Factory functions for dependency injection

## Installation

```bash
pnpm add @universo/flowise-apikey-srv
```

## Usage

```typescript
import {
    createApiKeyService,
    createApiKeyRouter,
    ApiKey,
    apiKeyMigrations
} from '@universo/flowise-apikey-srv'

// Create service with DI
const apiKeyService = createApiKeyService({
    getDataSource: () => dataSource,
    telemetry: telemetryService,
    metrics: metricsProvider
})

// Create router
const apiKeyRouter = createApiKeyRouter({ apiKeyService })

// Mount router
app.use('/api/v1/unik/:unikId/apikeys', apiKeyRouter)
```

## Exports

### Database
- `ApiKey` - TypeORM entity
- `apiKeyMigrations` - Array of migrations

### Services
- `createApiKeyService` - Service factory function
- `IApiKeyService` - Service interface
- `ApiKeyServiceConfig` - Configuration type
- `ApiKeyServiceError` - Custom error class

### Routes
- `createApiKeyRouter` - Router factory function
- `apiKeyErrorHandler` - Express error handling middleware
- `ApiKeyControllerError` - Controller error class

### Utils
- `generateAPIKey` - Function to generate secure API keys
- `jsonStorage` - Utility for JSON storage operations

## File Structure

```
packages/flowise-apikey-srv/
├── base/
│   ├── src/
│   │   ├── database/
│   │   │   ├── entities/      # ApiKey entity
│   │   │   └── migrations/    # PostgreSQL migrations
│   │   ├── services/          # Business logic
│   │   ├── routes/            # Express router
│   │   ├── utils/             # Utility functions
│   │   └── index.ts           # Entry point
│   ├── dist/                  # Compiled output
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md              # This file
│   └── README-RU.md           # Russian documentation
└── package.json               # Workspace configuration
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/unik/:unikId/apikeys` | Get all API keys for a Unik |
| GET | `/unik/:unikId/apikeys/:id` | Get specific API key by ID |
| POST | `/unik/:unikId/apikeys` | Create new API key |
| PUT | `/unik/:unikId/apikeys/:id` | Update existing API key |
| DELETE | `/unik/:unikId/apikeys/:id` | Delete API key |
| GET | `/unik/:unikId/apikey/:apikey` | Verify API key |

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run linting
pnpm lint

# Watch mode
pnpm dev
```

## License

Apache License Version 2.0 - See the [LICENSE](../../../LICENSE) file for details.
