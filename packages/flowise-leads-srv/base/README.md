# @universo/flowise-leads-srv

Backend package for Leads domain in Universo Platformo (extracted from flowise-server).

## Overview

This package provides backend functionality for managing leads (contact information) captured during chat interactions. Leads allow tracking user contacts for follow-up and analytics purposes.

## Package Information

- **Package**: `@universo/flowise-leads-srv`
- **Version**: `0.1.0`
- **Type**: Backend (Modern)
- **Framework**: Express.js, TypeORM, TypeScript
- **Dependencies**: None (standalone domain)

## Key Features

### 🗄️ Database Layer
- **Lead Entity**: TypeORM entity for storing contact information
- **Migrations**: PostgreSQL migrations for lead table schema

### 🔧 Service Layer
- **LeadsService**: CRUD operations with DI pattern
- **Validation**: Zod schemas for create operations
- **Error Handling**: Custom error classes with proper HTTP status codes

### 🛣️ Routes Layer
- **Express Router**: RESTful API endpoints with error handling middleware
- **DI Pattern**: Factory functions for dependency injection

## Installation

```bash
pnpm add @universo/flowise-leads-srv
```

## Usage

```typescript
import {
    createLeadsService,
    createLeadsRouter,
    Lead,
    leadsMigrations
} from '@universo/flowise-leads-srv'

// Create service with DI
const leadsService = createLeadsService({
    getDataSource: () => dataSource
})

// Create router
const leadsRouter = createLeadsRouter(leadsService)

// Mount router
app.use('/api/v1/leads', leadsRouter)
```

## Exports

### Database
- `Lead` - TypeORM entity
- `leadsMigrations` - Array of migrations

### Services
- `createLeadsService` - Service factory function
- `ILeadsService` - Service interface
- `LeadsServiceConfig` - Configuration type
- `LeadsServiceError` - Custom error class
- `createLeadSchema` - Zod validation schema

### Routes
- `createLeadsRouter` - Router factory function
- `leadsErrorHandler` - Express error handling middleware
- `LeadsControllerError` - Controller error class

### Types
- `ILead` - Lead entity interface
- `CreateLeadBody` - Create request body type

## File Structure

```
packages/flowise-leads-srv/
├── base/
│   ├── src/
│   │   ├── database/
│   │   │   ├── entities/      # Lead entity
│   │   │   └── migrations/    # PostgreSQL migrations
│   │   ├── services/          # Business logic
│   │   ├── routes/            # Express router
│   │   ├── Interface.ts       # Type definitions
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
| POST | `/leads` | Create a new lead |
| GET | `/leads/:id` | Get all leads for a canvas |

## License

Omsk Open License
