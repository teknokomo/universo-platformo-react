# @universo/flowise-credentials-backend

Backend package for Credentials domain in Universo Platformo (extracted from flowise-server).

## Overview

This package provides backend functionality for managing encrypted credentials that are used to authenticate with third-party services in AI workflows. Credentials are securely stored with encryption and scoped to individual Uniks.

## Package Information

- **Package**: `@universo/flowise-credentials-backend`
- **Version**: `0.1.0`
- **Type**: Backend (Modern)
- **Framework**: Express.js, TypeORM, TypeScript
- **Dependencies**: `@universo/uniks-backend` (Unik entity relation)

## Key Features

### 🗄️ Database Layer
- **Credential Entity**: TypeORM entity with Unik relation for multi-tenant isolation
- **Migrations**: PostgreSQL migrations for credential table schema

### 🔧 Service Layer
- **CredentialsService**: CRUD operations with encryption support
- **Validation**: Zod schemas for create/update operations
- **Error Handling**: Custom error classes with proper HTTP status codes

### 🔒 Security
- **Encryption**: Credential data is encrypted at rest
- **Unik Isolation**: Credentials are scoped to individual Uniks

### 🛣️ Routes Layer
- **Express Router**: RESTful API endpoints with error handling middleware
- **DI Pattern**: Factory functions for dependency injection

## Installation

```bash
pnpm add @universo/flowise-credentials-backend
```

## Usage

```typescript
import {
    createCredentialsService,
    createCredentialsRouter,
    Credential,
    credentialsMigrations
} from '@universo/flowise-credentials-backend'

// Create service with DI
const credentialsService = createCredentialsService({
    getDataSource: () => dataSource,
    encryptCredentialData: async (data) => encrypt(data),
    decryptCredentialData: async (data) => decrypt(data),
    telemetry: telemetryService,
    metrics: metricsProvider
})

// Create router
const credentialsRouter = createCredentialsRouter({ credentialsService })

// Mount router
app.use('/api/v1/unik/:unikId/credentials', credentialsRouter)
```

## Exports

### Database
- `Credential` - TypeORM entity
- `credentialsMigrations` - Array of migrations

### Services
- `createCredentialsService` - Service factory function
- `ICredentialsService` - Service interface
- `CredentialsServiceConfig` - Configuration type
- `CredentialsServiceError` - Custom error class

### Routes
- `createCredentialsRouter` - Router factory function
- `credentialsErrorHandler` - Express error handling middleware
- `CredentialsControllerError` - Controller error class

## File Structure

```
packages/flowise-credentials-backend/
├── base/
│   ├── src/
│   │   ├── database/
│   │   │   ├── entities/      # Credential entity
│   │   │   └── migrations/    # PostgreSQL migrations
│   │   ├── services/          # Business logic
│   │   ├── routes/            # Express router
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
| GET | `/unik/:unikId/credentials` | Get all credentials for a Unik |
| GET | `/unik/:unikId/credentials/:id` | Get specific credential by ID |
| POST | `/unik/:unikId/credentials` | Create new credential |
| PUT | `/unik/:unikId/credentials/:id` | Update existing credential |
| DELETE | `/unik/:unikId/credentials/:id` | Delete credential |

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
