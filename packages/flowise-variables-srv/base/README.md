# @universo/flowise-variables-srv

Backend package for Variables domain in Universo Platformo (extracted from flowise-server).

## Overview

This package provides backend functionality for managing variables that can be used across AI workflows. Variables allow storing reusable values like prompts, configurations, and dynamic data that can be referenced in chatflows and agentflows.

## Package Information

- **Package**: `@universo/flowise-variables-srv`
- **Version**: `0.1.0`
- **Type**: Backend (Modern)
- **Framework**: Express.js, TypeORM, TypeScript
- **Dependencies**: `@universo/uniks-srv` (Unik entity relation)

## Key Features

### 🗄️ Database Layer
- **Variable Entity**: TypeORM entity with Unik relation for multi-tenant isolation
- **Migrations**: PostgreSQL migrations for variable table schema

### 🔧 Service Layer
- **VariablesService**: CRUD operations with DI pattern
- **Validation**: Zod schemas for create/update operations
- **Error Handling**: Custom error classes with proper HTTP status codes

### 🛣️ Routes Layer
- **Express Router**: RESTful API endpoints with error handling middleware
- **DI Pattern**: Factory functions for dependency injection

## Installation

```bash
pnpm add @universo/flowise-variables-srv
```

## Usage

```typescript
import {
    createVariablesService,
    createVariablesRouter,
    Variable,
    variablesMigrations
} from '@universo/flowise-variables-srv'

// Create service with DI
const variablesService = createVariablesService({
    getDataSource: () => dataSource,
    telemetry: telemetryService,
    metrics: metricsProvider
})

// Create router
const variablesRouter = createVariablesRouter({ variablesService })

// Mount router
app.use('/api/v1/unik/:unikId/variables', variablesRouter)
```

## Exports

### Database
- `Variable` - TypeORM entity
- `variablesMigrations` - Array of migrations

### Services
- `createVariablesService` - Service factory function
- `IVariablesService` - Service interface
- `VariablesServiceConfig` - Configuration type
- `VariablesServiceError` - Custom error class

### Routes
- `createVariablesRouter` - Router factory function
- `variablesErrorHandler` - Express error handling middleware
- `VariablesControllerError` - Controller error class

## File Structure

```
packages/flowise-variables-srv/
├── base/
│   ├── src/
│   │   ├── database/
│   │   │   ├── entities/      # Variable entity
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
| GET | `/unik/:unikId/variables` | Get all variables for a Unik |
| GET | `/unik/:unikId/variables/:id` | Get specific variable by ID |
| POST | `/unik/:unikId/variables` | Create new variable |
| PUT | `/unik/:unikId/variables/:id` | Update existing variable |
| DELETE | `/unik/:unikId/variables/:id` | Delete variable |

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
