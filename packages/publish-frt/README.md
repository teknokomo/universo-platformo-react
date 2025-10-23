# 📦 publish-frt

> Front-end package for publishing and exporting AR/VR content in Universo Platformo

[Русская версия](./README-RU.md)

## 🎯 Description

The `publish-frt` package provides UI components and logic for publishing interactive content created in Universo Platformo. Supports export to various formats and technologies:

- **AR.js** - WebAR publication for mobile devices
- **PlayCanvas** - 3D publication with multiplayer support

## 📁 Project Structure

```
packages/publish-frt/
├── base/
│   ├── src/
│   │   ├── api/              # API clients and Query Key Factory
│   │   │   ├── queryKeys.ts  # Centralized cache key management
│   │   │   └── index.ts
│   │   ├── components/       # Reusable components
│   │   ├── features/         # Feature modules
│   │   │   ├── arjs/         # AR.js publisher and exporter
│   │   │   └── playcanvas/   # PlayCanvas publisher
│   │   ├── hooks/            # Custom React hooks
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utilities
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## 🚀 Tech Stack

### Core Technologies
- **React 18** - UI framework
- **TypeScript** - Type safety
- **TanStack Query v5** (React Query) - Server state management
- **Material-UI** - UI components

### Data Fetching Architecture
- **Global QueryClient** - Single source of truth for the entire application
- **Query Key Factory** - Centralized cache key management
- **Automatic Request Deduplication** - Prevents duplicate requests
- **Smart Retry Policy** - Intelligent error handling

## 📚 Architecture Patterns

### 1. TanStack Query Integration

The package uses **TanStack Query v5** for server state management, following official best practices.

#### Key Principles:

✅ **Single Global QueryClient** - One QueryClient for the entire application
```javascript
// packages/flowise-ui/src/index.jsx
const queryClient = createGlobalQueryClient()

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

✅ **Query Key Factory** - Centralized key management
```typescript
// packages/publish-frt/base/src/api/queryKeys.ts
import { publishQueryKeys } from '@/api/queryKeys'

// Usage in components
const { data } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: fetchCanvas
})
```

✅ **Declarative useQuery()** instead of imperative fetchQuery()
```javascript
// ❌ DON'T DO THIS (imperative, no deduplication)
useEffect(() => {
  const data = await queryClient.fetchQuery({ /* ... */ })
}, [dependencies])

// ✅ DO THIS (declarative, automatic deduplication)
const { data, isLoading } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: fetchCanvas,
  enabled: !!unikId
})
```

### 2. Query Key Factory Pattern

#### What is it?

Query Key Factory is a centralized system for managing TanStack Query cache keys.

#### Why do we need it?

1. **Type Normalization** - prevents cache mismatches
2. **Consistency** - single source of truth for keys
3. **Easy Invalidation** - simple cache invalidation
4. **TypeScript Support** - autocomplete and type safety

#### Usage Example:

```typescript
import { publishQueryKeys, invalidatePublishQueries } from '@packages/publish-frt/base/src/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// 1. Fetching data using Query Key Factory
const MyComponent = ({ unikId, canvasId }) => {
  const { data: canvas } = useQuery({
    queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
    queryFn: async () => {
      const response = await PublicationApi.getCanvasById(unikId, canvasId)
      return response?.data
    }
  })

  return <div>{canvas?.name}</div>
}

// 2. Cache invalidation after mutation
const MyMutation = () => {
  const queryClient = useQueryClient()

  const handleSave = async () => {
    await saveCanvas()
    
    // Invalidate all canvas queries
    invalidatePublishQueries.canvas(queryClient, canvasId)
  }
}
```

#### Available Keys:

| Function | Description | Example Key |
|----------|-------------|-------------|
| `publishQueryKeys.all` | All publish queries | `['publish']` |
| `publishQueryKeys.canvas()` | All canvas queries | `['publish', 'canvas']` |
| `publishQueryKeys.canvasByUnik(unikId, canvasId)` | Canvas by unikId and canvasId | `['publish', 'canvas', 'unik123', 'canvas456']` |
| `publishQueryKeys.links()` | All publication links | `['publish', 'links']` |
| `publishQueryKeys.linksByTechnology(tech)` | Links by technology | `['publish', 'links', 'arjs']` |
| `publishQueryKeys.linksByVersion(tech, flowId, versionId)` | Links by version | `['publish', 'links', 'arjs', '123', 'v1']` |

### 3. Hybrid Approach: useQuery + useQueryClient

**Correct usage pattern:**

```javascript
const MyPublisher = ({ flow }) => {
  // 1. Get queryClient for imperative operations
  const queryClient = useQueryClient()
  
  // 2. useQuery for component data (AUTOMATIC deduplication)
  const { data: canvasData } = useQuery({
    queryKey: publishQueryKeys.canvasByUnik(unikId, flow?.id),
    queryFn: async () => await PublicationApi.getCanvasById(unikId, flow.id),
    enabled: !!flow?.id,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
  
  // 3. queryClient.fetchQuery for callbacks (on-demand fetching)
  const loadPublishLinks = useCallback(async () => {
    const records = await queryClient.fetchQuery({
      queryKey: publishQueryKeys.linksByVersion('arjs', flow.id, versionId),
      queryFn: fetchLinks
    })
    return records
  }, [queryClient, flow.id, versionId])
  
  // 4. Cache invalidation after mutations
  const handlePublish = async () => {
    await publishCanvas()
    invalidatePublishQueries.linksByTechnology(queryClient, 'arjs')
  }
}
```

**Why this works:**
- `useQuery()` - declarative, automatic deduplication between components
- `queryClient.fetchQuery()` - imperative, on-demand fetching in callbacks
- Both patterns are valid and complement each other

### 4. Configuration Best Practices

#### QueryClient Configuration

```javascript
// packages/flowise-ui/src/config/queryClient.js
export const createGlobalQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,        // 5 minutes - reduces API calls
        gcTime: 30 * 60 * 1000,          // 30 minutes - memory management
        refetchOnWindowFocus: false,      // Prevents unnecessary refetch
        retry: (failureCount, error) => {
          // Don't retry: 401, 403, 404, 429
          if ([401, 403, 404, 429].includes(error?.response?.status)) {
            return false
          }
          // Retry 5xx errors up to 2 times
          if (error?.response?.status >= 500) {
            return failureCount < 2
          }
          return false
        }
      }
    }
  })
```

#### Component Best Practices

```javascript
// ✅ Correct: computed values via useMemo
const resolvedVersionGroupId = useMemo(() => {
  if (normalizedVersionGroupId) return normalizedVersionGroupId
  if (canvasData) return FieldNormalizer.normalizeVersionGroupId(canvasData)
  return null
}, [normalizedVersionGroupId, canvasData])

// ✅ Correct: conditional loading via enabled
const { data } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: fetchCanvas,
  enabled: !!unikId && !!canvasId  // Don't run query without IDs
})

// ✅ Correct: handling loading and error states
const { data, isLoading, isError, error } = useQuery({ /* ... */ })

if (isLoading) return <CircularProgress />
if (isError) return <Alert severity="error">{error.message}</Alert>
```

## 🔧 API Reference

### publishQueryKeys

Exported from `@packages/publish-frt/base/src/api`

```typescript
import { publishQueryKeys } from '@packages/publish-frt/base/src/api'

// Canvas queries
publishQueryKeys.all                    // ['publish']
publishQueryKeys.canvas()               // ['publish', 'canvas']
publishQueryKeys.canvasById(id)         // ['publish', 'canvas', id]
publishQueryKeys.canvasByUnik(uId, cId) // ['publish', 'canvas', uId, cId]

// Links queries
publishQueryKeys.links()                           // ['publish', 'links']
publishQueryKeys.linksByTechnology(tech)           // ['publish', 'links', tech]
publishQueryKeys.linksByFlow(tech, flowId)         // ['publish', 'links', tech, flowId]
publishQueryKeys.linksByVersion(tech, fId, vId)    // ['publish', 'links', tech, fId, vId]

// Templates queries
publishQueryKeys.templates()                // ['publish', 'templates']
publishQueryKeys.templatesByTechnology(tech) // ['publish', 'templates', tech]

// Versions queries
publishQueryKeys.versions()              // ['publish', 'versions']
publishQueryKeys.versionsByGroup(vgId)   // ['publish', 'versions', vgId]
```

### invalidatePublishQueries

Helper functions for cache invalidation:

```typescript
import { invalidatePublishQueries } from '@packages/publish-frt/base/src/api'

const queryClient = useQueryClient()

// Invalidate all publish queries
invalidatePublishQueries.all(queryClient)

// Invalidate all links
invalidatePublishQueries.links(queryClient)

// Invalidate links by technology
invalidatePublishQueries.linksByTechnology(queryClient, 'arjs')

// Invalidate canvas
invalidatePublishQueries.canvas(queryClient, canvasId)

// Invalidate templates
invalidatePublishQueries.templates(queryClient)

// Invalidate versions
invalidatePublishQueries.versions(queryClient)
```

## 🐛 Debugging

### React Query DevTools

React Query DevTools are available in development mode:

```javascript
// Automatically included in packages/flowise-ui/src/index.jsx
{process.env.NODE_ENV === 'development' && (
  <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
)}
```

**How to use:**
1. Open DevTools (bottom-right corner)
2. Find query by key
3. Check status (fresh/stale/fetching/error)
4. Check fetch count (should be 1, not 10+)

### Common Issues

#### Problem: Duplicate requests
```
❌ Symptom: See 10+ identical HTTP requests in Network tab
✅ Solution: Use useQuery() instead of fetchQuery() in useEffect
```

#### Problem: Cache mismatches
```
❌ Symptom: Data doesn't update after mutation
✅ Solution: Use publishQueryKeys for key consistency
```

#### Problem: 429 Rate Limiting
```
❌ Symptom: Getting 429 Too Many Requests
✅ Solution: useQuery() automatically deduplicates requests
```

## 📝 Migration Guide

### From fetchQuery to useQuery

**Before (anti-pattern):**
```javascript
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  const fetchData = async () => {
    const result = await queryClient.fetchQuery({ /* ... */ })
    setData(result)
    setLoading(false)
  }
  fetchData()
}, [canvasId])
```

**After (best practice):**
```javascript
const { data, isLoading } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: fetchCanvas,
  enabled: !!canvasId
})
```

**Benefits:**
- ✅ -40 lines of code
- ✅ Automatic deduplication
- ✅ No manual state management
- ✅ Declarative approach

## 🚀 Development

### Install dependencies
```bash
pnpm install
```

### Build
```bash
# Build only publish-frt
pnpm --filter publish-frt build

# Build publish-frt + flowise-ui
pnpm --filter publish-frt build && pnpm --filter flowise-ui build
```

### Linting
```bash
pnpm --filter publish-frt lint
pnpm --filter publish-frt lint --fix
```

## 📖 Additional Resources

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Query Key Factory Pattern](https://tkdodo.eu/blog/effective-react-query-keys)

## 📄 License

MIT License - see LICENSE file for details
