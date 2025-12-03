# @flowise/customtemplates-backend

Backend service for Custom Templates management in Universo Platformo.

## Overview

This package provides the backend functionality for managing user-created templates. Users can save their Canvas configurations or custom Tools as templates for later reuse.

## Features

- **CustomTemplate Entity**: TypeORM entity for storing templates in PostgreSQL
- **CRUD Service**: Create, Read, Delete operations for custom templates
- **Unik Scoping**: Templates are scoped to workspaces (Uniks)
- **RLS Support**: Row-Level Security policies for multi-tenant isolation

## Installation

```bash
pnpm add @flowise/customtemplates-backend
```

## Usage

### Entity Registration

Register the entity in your TypeORM DataSource:

```typescript
import { CustomTemplate } from '@flowise/customtemplates-backend'

const entities = {
    // ... other entities
    CustomTemplate
}
```

### Migration Registration

Add migrations to your migration array:

```typescript
import { customTemplatesMigrations } from '@flowise/customtemplates-backend'

export const postgresMigrations = [
    // ... other migrations
    ...customTemplatesMigrations
]
```

### Service Usage

```typescript
import { createCustomTemplatesService } from '@flowise/customtemplates-backend'

const service = createCustomTemplatesService({ dataSource })

// Get all templates for a workspace
const templates = await service.getAll(unikId)

// Create a new template
const template = await service.create({
    name: 'My Template',
    flowData: JSON.stringify(canvasData),
    unikId: 'workspace-id',
    type: 'Canvas'
})

// Delete a template
await service.delete(templateId, unikId)
```

## Template Types

- **Canvas**: Saved Canvas configurations (flowData contains nodes and edges)
- **Tool**: Saved custom tools (flowData contains iconSrc, schema, func)

## Database Schema

The `custom_template` table is created by this package's migration:

```sql
CREATE TABLE custom_template (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar NOT NULL,
    flowData text NOT NULL,
    description text,
    badge text,
    framework text,
    usecases text,
    type text,
    createdDate timestamptz DEFAULT now(),
    updatedDate timestamptz DEFAULT now()
);
```

**Note**: The `unik_id` column, FK constraint, and index are added later by the `AddUniksAndLinked` migration from `@universo/uniks-backend`. This follows the same pattern as `tool`, `credential`, `assistant`, and other Flowise tables.

## License

Omsk Open License
