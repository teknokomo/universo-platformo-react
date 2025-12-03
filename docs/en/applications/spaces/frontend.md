# Spaces Frontend (`@universo/spaces-frontend`)

> **📋 Notice**: This documentation is being adapted for Universo Platformo.

## Overview

Frontend for managing Flow-canvases (canvases) and spaces.

## Technology Stack

- React 18 + TypeScript + Material-UI v5
- React Query + React Flow (canvas editor)
- i18next (EN/RU)

## Main Components

- **SpaceList**: List user's spaces
- **SpaceEditor**: Canvas editor (React Flow)
- **NodePalette**: Palette UPDL nodes
- **SpaceSettings**: Settings space

## API Integration

```typescript
import { SpacesApi } from '@universo/spaces-frontend';

await api.getSpaces({ page, limit });
await api.createSpace(data);
await api.getSpace(id);
await api.updateSpaceCanvas(id, canvasData);
```

## Hooks

```typescript
const { spaces, createSpace } = useSpaces();
const { space, updateCanvas } = useSpace(spaceId);
```

## Canvas Format

```json
{
  "nodes": [...],
  "edges": [...],
  "metadata": {...}
}
```

## Related Documentation

- [Spaces Backend](backend.md)
- [Spaces Overview](README.md)
- [UPDL](../updl/README.md)
