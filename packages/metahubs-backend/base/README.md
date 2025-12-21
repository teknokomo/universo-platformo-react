# MetaHubs Backend

Backend service for MetaHub management in Universo Platformo.

## Overview

MetaHubs provides a metadata-driven architecture (MDA) for creating dynamic entities and fields without runtime DDL. This module enables users to define their own data structures through configurations stored as metadata.

## Architecture

The module follows a hybrid JSONB approach:
- **sys_entity**: Defines entity schemas (like database tables)
- **sys_field**: Defines field specifications for entities
- **user_data_store**: Stores actual user records as JSONB

## Key Features

- Dynamic entity/field definitions via metadata
- JSONB-based record storage for flexibility
- RLS-enabled for multi-tenant security
- Server-driven UI support via view configurations

## API Endpoints

- `GET /metahubs` - List all metahubs (with pagination, search, sort)
- `POST /metahubs` - Create a new metahub
- `GET /metahubs/:id` - Get metahub details
- `PUT /metahubs/:id` - Update metahub
- `DELETE /metahubs/:id` - Delete metahub

### Entity Endpoints (within a metahub context)
- `GET /metahubs/:metahubId/entities` - List entities in a metahub
- `POST /metahubs/:metahubId/entities` - Create entity definition
- `GET /metahubs/:metahubId/entities/:entityId` - Get entity details
- `PUT /metahubs/:metahubId/entities/:entityId` - Update entity
- `DELETE /metahubs/:metahubId/entities/:entityId` - Delete entity

### Field Endpoints
- `GET /metahubs/:metahubId/entities/:entityId/fields` - List fields
- `POST /metahubs/:metahubId/entities/:entityId/fields` - Create field
- `PUT /metahubs/:metahubId/entities/:entityId/fields/:fieldId` - Update field
- `DELETE /metahubs/:metahubId/entities/:entityId/fields/:fieldId` - Delete field

### Records Endpoints
- `GET /metahubs/:metahubId/entities/:entityId/records` - List records
- `POST /metahubs/:metahubId/entities/:entityId/records` - Create record
- `GET /metahubs/:metahubId/entities/:entityId/records/:recordId` - Get record
- `PUT /metahubs/:metahubId/entities/:entityId/records/:recordId` - Update record
- `DELETE /metahubs/:metahubId/entities/:entityId/records/:recordId` - Delete record

## Database Schema

All tables are in the `metahubs` schema with RLS enabled.

## Development

```bash
# Build
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```
