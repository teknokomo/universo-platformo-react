# @universo/flowise-tools-srv

Backend package for Tools domain in Universo Platformo (extracted from flowise-server).

## Overview

This package provides backend functionality for managing custom tools that can be used in AI workflows. Tools allow integration of external APIs and custom functions into chatflows and agentflows.

## Package Information

- **Package**: `@universo/flowise-tools-srv`
- **Version**: `0.1.0`
- **Type**: Backend (Modern)
- **Framework**: Express.js, TypeORM, TypeScript
- **Dependencies**: `@universo/uniks-srv` (Unik entity relation)

## Key Features

### 🗄️ Database Layer
- **Tool Entity**: TypeORM entity with Unik relation for multi-tenant isolation
- **Migrations**: PostgreSQL migrations for tool table schema

### 🔧 Service Layer
- **ToolsService**: CRUD operations with DI pattern
- **Validation**: Zod schemas for create/update operations
- **Error Handling**: Custom error classes with proper HTTP status codes

### 🛣️ Routes Layer
- **Express Router**: RESTful API endpoints with error handling middleware
- **DI Pattern**: Factory functions for dependency injection

## Installation

```bash
pnpm add @universo/flowise-tools-srv
```

## Usage

```typescript
import {
    createToolsService,
    createToolsRouter,
    Tool,
    toolsMigrations
} from '@universo/flowise-tools-srv'

// Create service with DI
const toolsService = createToolsService({
    getDataSource: () => dataSource,
    telemetry: telemetryService,
    metrics: metricsProvider
})

// Create router
const toolsRouter = createToolsRouter({ toolsService })

// Mount router
app.use('/api/v1/unik/:unikId/tools', toolsRouter)
```

## Exports

### Database
- `Tool` - TypeORM entity
- `toolsMigrations` - Array of migrations

### Services
- `createToolsService` - Service factory function
- `IToolsService` - Service interface
- `ToolsServiceConfig` - Configuration type
- `ToolsServiceError` - Custom error class
- `createToolSchema`, `updateToolSchema` - Zod validation schemas

### Routes
- `createToolsRouter` - Router factory function
- `toolsErrorHandler` - Express error handling middleware
- `ToolsControllerError` - Controller error class

## File Structure

```
packages/flowise-tools-srv/
├── base/
│   ├── src/
│   │   ├── database/
│   │   │   ├── entities/      # Tool entity
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
| GET | `/unik/:unikId/tools` | Get all tools for a Unik |
| GET | `/unik/:unikId/tools/:id` | Get specific tool by ID |
| POST | `/unik/:unikId/tools` | Create new tool |
| PUT | `/unik/:unikId/tools/:id` | Update existing tool |
| DELETE | `/unik/:unikId/tools/:id` | Delete tool |

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
