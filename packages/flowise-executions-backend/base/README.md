# @flowise/executions-backend

Backend package for agent execution tracking in Universo Platformo.

## Overview

This package provides TypeORM entities, database migrations, service layer, and API routes for managing agent flow executions. Adapted from Flowise 3.0.12.

## Features

- **Execution Entity**: Track agent flow execution state, data, and metadata
- **Service Layer**: Factory-based service with Zod validation
- **API Routes**: RESTful endpoints for CRUD operations
- **Soft Delete**: Support for soft deletion of executions
- **Canvas Integration**: Foreign key relationship to Canvas entity

## Installation

```bash
pnpm add @flowise/executions-backend
```

## Usage

### Service Factory

```typescript
import { createExecutionsService } from '@flowise/executions-backend'

const executionsService = createExecutionsService({
    getDataSource: () => dataSource
})
```

### Router Factory

```typescript
import { createExecutionsRouter } from '@flowise/executions-backend'

const executionsRouter = createExecutionsRouter(executionsService)
app.use('/api/v1/executions', executionsRouter)
```

## Database Schema

The `execution` table includes:
- `id`: UUID primary key
- `canvas_id`: Foreign key to Canvas
- `executionData`: JSON execution data
- `state`: Execution state (INPROGRESS, FINISHED, ERROR, etc.)
- `sessionId`: Session identifier
- `isPublic`: Public visibility flag
- Soft delete support

## License

Apache 2.0 (see LICENSE-Flowise.md for attribution)
