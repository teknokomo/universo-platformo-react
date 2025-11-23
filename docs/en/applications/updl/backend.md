# `packages/updl` — UPDL Backend — [Status: N/A]

## Purpose

UPDL is a pure **frontend module with node definitions** for the Flowise editor. A backend component **does not exist** in this package.

## Architecture

UPDL follows the principle of **clean separation of concerns**:

- **Node Definitions**: Handled in `packages/updl` (frontend only)
- **Space Building Logic**: Handled in `packages/publish-srv` and `packages/space-builder-srv`
- **Export APIs**: Handled in publication services
- **Data Storage**: Handled in Flowise Server via TypeORM

## Why No Backend Component?

UPDL is a **node definitions module** that:

1. **Requires No API**: Nodes are loaded directly into Flowise via NodesPool mechanism
2. **Stores No State**: Node definitions are static and require no database
3. **Executes No Business Logic**: Execution logic is handled in publication services
4. **Handles No Requests**: All interaction happens through Flowise UI

## Related Backend Services

If you need backend functionality for working with UPDL spaces, refer to:

- **[Publish Backend](../publish/backend.md)** — API for publishing UPDL spaces to AR.js/PlayCanvas
- **[Space Builder Backend](../space-builder/backend.md)** — API for AI-generated UPDL spaces
- **[Flowise Server](../../getting-started/installation.md)** — Main backend for Flowise editor

## Typical Workflow

```
UPDL Definitions (Frontend)
        ↓
Flowise Editor (UI)
        ↓
Space Builder API (Backend) ← AI generation
        ↓
Publish API (Backend) ← Export to technologies
        ↓
AR.js / PlayCanvas / Others
```

## See Also

- [UPDL Frontend](./frontend.md) — Node definitions and integration
- [UPDL README](./README.md) — System overview
- [Publish Backend](../publish/backend.md) — Publication API
- [Space Builder Backend](../space-builder/backend.md) — AI generation API
