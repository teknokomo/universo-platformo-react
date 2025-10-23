# @universo/api-client

TypeScript API client for Universo Platformo. Centralized, type-safe client for all backend API calls.

## Features

- ✅ **TypeScript** - Full type safety for API requests and responses
- ✅ **Class-based API** - Modern, extensible architecture
- ✅ **TanStack Query Integration** - Built-in query keys for caching
- ✅ **Authentication** - Built on @universo/auth-frt with CSRF support
- ✅ **Error Handling** - Automatic 401 redirect, retry logic
- ✅ **Tree-shakeable** - Only bundle what you use

## Installation

```bash
pnpm add @universo/api-client
```

## Usage

### Basic Usage

```typescript
import { createUniversoApiClient } from '@universo/api-client'

// Create client instance
const api = createUniversoApiClient({ baseURL: '/api/v1' })

// Use async/await
const canvases = await api.canvases.getCanvases(unikId, spaceId)
```

### With TanStack Query

```typescript
import { useQuery } from '@tanstack/react-query'
import { createUniversoApiClient, canvasQueryKeys } from '@universo/api-client'

const api = createUniversoApiClient({ baseURL: '/api/v1' })

function CanvasList({ unikId, spaceId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: canvasQueryKeys.list(unikId, spaceId),
    queryFn: () => api.canvases.getCanvases(unikId, spaceId),
    enabled: !!unikId && !!spaceId,
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      {data.canvases.map(canvas => (
        <div key={canvas.id}>{canvas.name}</div>
      ))}
    </div>
  )
}
```

### Available APIs

Currently implemented:

- **canvases** - Canvas/Chatflow management
  - `getCanvases()` - List all canvases
  - `getCanvas()` - Get single canvas
  - `createCanvas()` - Create new canvas
  - `updateCanvas()` - Update canvas
  - `deleteCanvas()` - Delete canvas
  - `duplicateCanvas()` - Duplicate canvas
  - `exportCanvas()` - Export canvas
  - `importCanvas()` - Import canvas
  - `reorderCanvases()` - Reorder canvases

More APIs coming soon...

## Development

```bash
# Build the package
pnpm build

# Watch mode
pnpm dev

# Lint
pnpm lint
```

## Migration from old API

Old pattern (flowise-ui):
```javascript
import canvasesApi from '@/api/canvases'

const response = await canvasesApi.getCanvases(unikId, spaceId)
const canvases = response.data
```

New pattern:
```typescript
import { api } from '@/api/client' // or create instance

const canvases = await api.canvases.getCanvases(unikId, spaceId)
// Response is already unwrapped (.data)
```

## License

MIT
