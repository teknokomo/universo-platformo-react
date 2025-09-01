# Resources Service

The Resources Service (`resources-srv`) manages reusable content and their hierarchical compositions.

## Features
- Category management with parent-child hierarchy
- Resource CRUD with state, storage type and metadata
- Revision history for each resource
- Recursive compositions of resources

## API Endpoints
See [apps/resources-srv/base/README.md](../../../../apps/resources-srv/base/README.md) for full endpoint list.

## Data Model
Core entities:
- **ResourceCategory** – hierarchical categories
- **ResourceState** – available states
- **StorageType** – storage backends
- **Resource** – main entity with metadata
- **ResourceRevision** – versioned data snapshots
- **ResourceComposition** – parent-child resource links

## Development
```bash
pnpm --filter @universo/resources-srv build
```

## Frontend

The Resources Frontend (`resources-frt`) provides user interfaces for browsing and composing resources.

### Workflows

- **ResourceList** – table of resources with category tree filter
- **ResourceDetail** – tabs for info, revisions and child tree
- **ResourceDialog** – create/edit form with `ResourceConfigTree`

```bash
pnpm --filter @universo/resources-frt build
```
