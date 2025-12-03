# @universo/flowise-assistants-backend

Backend package for Assistants domain in Universo Platformo (extracted from flowise-server).

## Overview

This package provides:
- **Assistant Entity**: TypeORM entity with Unik relation
- **Assistants Service**: CRUD operations + OpenAI integration
- **Assistants Router**: Express router with DI pattern
- **Migration**: Consolidated migration for assistant table

## Installation

```bash
pnpm add @universo/flowise-assistants-backend
```

## Usage

```typescript
import {
    createAssistantsService,
    createAssistantsController,
    createAssistantsRouter,
    Assistant,
    assistantsMigrations
} from '@universo/flowise-assistants-backend'

// Create service with DI
const assistantsService = createAssistantsService({
    getDataSource: () => dataSource,
    decryptCredentialData: async (data) => decrypt(data),
    telemetry: telemetryService,
    metrics: metricsProvider
})

// Create controller
const assistantsController = createAssistantsController({ assistantsService })

// Create router
const assistantsRouter = createAssistantsRouter({ assistantsController })

// Mount router
app.use('/assistants', assistantsRouter)
```

## Exports

- `Assistant` - TypeORM entity
- `IAssistant`, `AssistantType` - TypeScript types
- `assistantsMigrations` - Array of migrations
- `createAssistantsService` - Service factory
- `createAssistantsController` - Controller factory
- `createAssistantsRouter` - Router factory

## Dependencies

- `typeorm` - Database ORM
- `@universo/uniks-backend` - Unik entity relation
- `@universo/flowise-credentials-backend` - Credential entity for OpenAI
