# Entities Service

The Entities Service (`entities-srv`) handles entity templates, instances and their resource assignments.

## Features
- Template and status registries
- Hierarchical entities with parent-child relations
- Ownership and resource attachment per entity
- Optional arbitrary relations between entities

## API Endpoints
See [apps/entities-srv/base/README.md](../../../../apps/entities-srv/base/README.md) for full endpoint list.

## Data Model
Core entities:
- **EntityStatus** – status codes
- **EntityTemplate** – reusable templates
- **Entity** – instantiated entity with hierarchy
- **EntityOwner** – user ownership records
- **EntityResource** – resource links
- **EntityRelation** – optional links between entities

## Development
```bash
pnpm --filter @universo/entities-srv build
```
