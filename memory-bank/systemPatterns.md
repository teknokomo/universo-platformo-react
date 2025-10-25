# System Patterns

## i18n Architecture Patterns

### Defense-in-Depth i18n Registration (Best Practice)

**Pattern**: Multi-layer protection to ensure translation namespaces are registered before components use them.

**When to Use**:
- React Router lazy loading (`React.lazy`)
- Code-split applications with async routes
- Monorepo with multiple i18n packages
- Production builds with aggressive tree-shaking

**Implementation Layers**:

**Layer 1: Package Configuration (Prevent Tree-Shaking)**
```json
// package.json
{
  "sideEffects": [
    "dist/i18n/index.mjs",
    "dist/i18n/index.js"
  ]
}
```

**Layer 2: Build Configuration (Compile i18n Entry)**
```typescript
// tsdown.config.ts
export default defineConfig({
  entry: {
    'i18n/index': './src/i18n/index.ts'
  },
  format: ['esm', 'cjs'],
  dts: true
})
```

**Layer 3: Global Registration (Application Root)**
```typescript
// flowise-ui/src/index.jsx
import '@universo/i18n'  // Core instance
import '@universo/template-mui/i18n'
import '@universo/uniks-frt/i18n'
import '@universo/metaverses-frt/i18n'
// ... render App
```

**Layer 4: Route-Level Registration (Before Lazy Components)**
```typescript
// routes/MainRoutesMUI.tsx
import { lazy } from 'react'

// CRITICAL: Import BEFORE lazy() calls
import '@universo/template-mui/i18n'
import '@universo/uniks-frt/i18n'
import '@universo/metaverses-frt/i18n'

const UnikList = Loadable(lazy(() => import('@universo/uniks-frt/pages/UnikList')))
const MetaverseList = Loadable(lazy(() => import('@universo/metaverses-frt/pages/MetaverseList')))
```

**How It Works**:
1. `sideEffects` array prevents bundlers from removing i18n imports during optimization
2. Explicit imports at route level guarantee synchronous registration before lazy components load
3. Global imports provide fallback for non-lazy routes and initial render

**Common Pitfall**:
```typescript
// ❌ WRONG - i18n registered too late
const routes = {
  element: <Layout />,
  children: [
    { path: 'uniks', element: lazy(() => import('UnikList')) }  // May load before i18n ready
  ]
}
import '@universo/uniks-frt/i18n'  // Too late!

// ✅ CORRECT - i18n registered before route definition
import '@universo/uniks-frt/i18n'  // Registration first
const routes = {
  element: <Layout />,
  children: [
    { path: 'uniks', element: lazy(() => import('UnikList')) }  // Safe to use translations
  ]
}
```

**Verification Checklist**:
- [ ] `dist/i18n/index.js` and `index.mjs` exist after build
- [ ] `sideEffects` array includes i18n files
- [ ] Global imports at app root (`index.jsx`)
- [ ] Route-level imports before lazy components
- [ ] Production build tested (not just dev mode)
- [ ] Browser console shows no i18n warnings

---

## UPDL Node Patterns and Visual Programming

### Key Design Principles

1. **Universal Description Layer**

    - UPDL nodes describe "what" should happen, not "how"
    - Technical implementation details are hidden from the developer
    - The same node graph works across different platforms

2. **Hierarchical Structure**

    - Space node serves as the root container (formerly Scene)
    - Objects can contain other objects (parent-child relationship)
    - Cameras and lights can be attached to objects or directly to space

3. **Typed Ports and Connections**
    - Each port has a specific data type
    - Connections are validated for type compatibility
    - The editor prevents incompatible connections

### Connector Implementation Guide ✅ **COMPLETE**

**Key Principles for UPDL node connectors:**

1. **Input Connectors**: Define in parent node's `inputs` array with matching `type` property
2. **Output Connectors**: Use empty `outputs: []` for default Flowise behavior
3. **Type Safety**: Centralize connector types in `CONNECTABLE_TYPES` constant
4. **Terminal Nodes**: Use empty arrays for self-contained nodes (e.g., ActionNode)

**Connection Structure:**

-   **Entity** accepts: Components, Events
-   **Event** accepts: Actions
-   **Space** accepts: Entities, Universo, legacy nodes
-   **Universo** connects to Space for global context

## Template Package Architecture Patterns

### Shared Package Pattern

**Purpose**: Centralize common functionality across multiple applications

**Structure**:

```
packages/package-name/
├── base/
│   ├── src/
│   │   ├── interfaces/     # TypeScript interfaces
│   │   ├── utils/          # Utility functions
│   │   └── index.ts        # Package entry point
│   ├── dist/               # Compiled output
│   │   ├── cjs/           # CommonJS modules
│   │   ├── esm/           # ES modules
│   │   └── types/         # TypeScript declarations
│   ├── package.json
│   └── README.md
```

**Key Principles**:

-   **Dual Build System**: Support both CJS and ESM for maximum compatibility
-   **Type-Only Packages**: Separate types from runtime code when possible
-   **Workspace Dependencies**: Use `workspace:*` for internal dependencies
-   **Zero Runtime Dependencies**: Minimize external dependencies in shared packages

### Template Package Pattern

**Purpose**: Encapsulate platform-specific template functionality

**Structure**:

```
packages/template-name/
├── base/
│   ├── src/
│   │   ├── platform/       # Platform-specific implementations
│   │   ├── handlers/       # UPDL node handlers
│   │   ├── builders/       # Main builder classes
│   │   ├── common/         # Shared utilities
│   │   └── index.ts        # Package entry point
│   ├── dist/               # Compiled output (CJS + ESM + Types)
│   ├── package.json
│   └── README.md
```

**Key Principles**:

-   **Handler Separation**: Separate handlers for different UPDL node types
-   **Builder Interface**: Implement consistent ITemplateBuilder interface
-   **Platform Isolation**: Keep platform-specific code in dedicated directories
-   **Modular Architecture**: Enable easy testing and maintenance

### Template Registry Pattern

**Purpose**: Dynamic template loading and management

**Implementation**:

```typescript
class TemplateRegistry {
    private static templates = new Map<string, TemplateInfo>()

    static registerTemplate(template: TemplateInfo) {
        this.templates.set(template.id, template)
    }

    static createBuilder(templateId: string): ITemplateBuilder {
        const template = this.templates.get(templateId)
        return new template.builder()
    }
}
```

**Key Principles**:

-   **Dynamic Loading**: Templates are loaded at runtime
-   **Type Safety**: All templates implement ITemplateBuilder interface
-   **Extensibility**: Easy to add new templates without core changes
-   **Isolation**: Templates are self-contained packages

### UPDLProcessor Pattern

**Purpose**: Convert flow data to structured UPDL representations

**Key Features**:

-   **Multi-Scene Detection**: Automatically detect single vs multi-scene flows
-   **Node Relationship Mapping**: Maintain edge relationships between nodes
-   **Type Safety**: Use shared types from @universo-platformo/types
-   **Error Handling**: Robust error handling with fallbacks

### Template-Specific Implementation Patterns

#### PlayCanvas MMOOMM Template Patterns

**Physics Fallback Pattern:**

```typescript
// Graceful degradation from physics to direct movement
if (!entity.rigidbody.body) {
    this.moveDirectly(direction) // Fallback method
}
```

### Common UPDL Patterns

**High-Level Node Patterns:**

-   **Space** → **Entity** → **Component** (modern approach)
-   **Space** → **Object** → **Animation** → **Interaction** (legacy support)
-   **Multi-Space**: Connected spaces for complex experiences

**Export Features:**

-   Automatic addition of missing required elements (camera, lighting)
-   Platform-specific transformations and optimizations
-   Technology-specific parameter handling

**Rendering Patterns:**

-   **Iframe-based Rendering**: Isolated script execution for proper library loading and security
-   **Template System**: Reusable export templates across multiple technologies
-   **Static Library Integration**: CDN and local library sources with fallback support

## Build, Packaging, and Integration Patterns (2025-08-31)

### Build Order & Workspace Graph

-   Combine Turborepo `dependsOn: ["^build"]` with explicit `workspace:*` dependencies in consumers to enforce correct order. Example: `flowise-ui` → `@universo/template-quiz`, `@universo/template-mmoomm`, `publish-frt`.
-   Avoid cycles: feature/front packages (e.g., `finance-frt`) must never depend on UI (`flowise-ui`). UI is the top-level consumer.
-   Cold start requires upstream packages (templates/publish) to build before UI/server; declare deps accordingly. Optionally add `publish-frt` as a server dep to ensure `/assets` exist.

### Template Package Exports & Types

-   Ship dual builds with proper `exports` mapping to `dist/esm` and `dist/cjs`, plus `dist/types`. Provide multi-entry exports (`./arjs`, `./playcanvas`) when needed.
-   Consumers reference template declaration files via tsconfig `paths` to `dist/index.d.ts` instead of source.

### i18n Entry Points (TypeScript)

-   Use `.ts` entry files for package i18n to ensure inclusion in `dist` and strong typing; keep `resolveJsonModule: true` for JSON locales.
-   Provide typed helpers like `getTemplateXxxTranslations(language: string)` to return a single namespace.

### Vite + Workspace Libraries

-   Prefer building libraries prior to UI. Use `optimizeDeps.include` and `build.commonjsOptions.include` for workspace packages only if necessary; avoid aliasing to `src` in production builds.

### Uniks Child Resource Integration

-   New bounded contexts (e.g., Finance) integrate as Uniks children:
  -   Server: export `entities` and `migrations` arrays and `createXxxRouter()`; mount under `/api/v1/unik/:unikId/...` (preferred) — legacy `/api/v1/uniks/:unikId/...` remains supported for backward compatibility.
    -   UI: add nested routes inside Unik workspace and include namespaced i18n.

  Fallback behavior: a normalization middleware maps `:id` → `unikId`, and controllers use `req.params.unikId || req.params.id` to eliminate intermittent missing parameter errors.

### URL Parsing Patterns (2025-09-16)

-   **Frontend URL Parsing**: When extracting `unikId` from `window.location.pathname`, always support both new singular `/unik/:unikId` and legacy `/uniks/:unikId` patterns for backward compatibility:
    ```typescript
    // Correct pattern - support both singular and legacy
    const unikSingularMatch = pathname.match(/\/unik\/([^\/]+)/)
    const unikLegacyMatch = pathname.match(/\/uniks\/([^\/]+)/)
    if (unikSingularMatch && unikSingularMatch[1]) {
        result.unikId = unikSingularMatch[1]
    } else if (unikLegacyMatch && unikLegacyMatch[1]) {
        result.unikId = unikLegacyMatch[1]
    }
    ```
-   **Priority**: Always prioritize new singular pattern first, fallback to legacy pattern for compatibility.
-   **Reference Implementation**: See `CanvasHeader.jsx extractUnikId()` and `getCurrentUrlIds()` in `common.ts`.

## Data Isolation and Entity Relationship Patterns

### Three-Tier Architecture Pattern

**Purpose**: Implement hierarchical data organization with complete isolation between top-level containers

**Structure**:
```
Clusters (Top-level isolation)
├── Domains (Logical groupings within clusters)
│   └── Resources (Individual assets within domains)
```

**Key Principles**:
- **Complete Isolation**: Data from different clusters is never visible across boundaries
- **Mandatory Associations**: Child entities must be associated with parent entities
- **Cascade Operations**: Deleting parent entities removes all child relationships
- **Idempotent Operations**: Relationship creation is safe to retry

### Junction Table Pattern

**Purpose**: Manage many-to-many relationships with data integrity

**Implementation**:
```typescript
@Entity({ name: 'entities_parents' })
export class EntityParent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Entity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entity_id' })
  entity: Entity

  @ManyToOne(() => Parent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: Parent

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE constraint on (entity_id, parent_id)
}
```

**Key Features**:
- **CASCADE Delete**: Automatically clean up relationships when entities are deleted
- **UNIQUE Constraints**: Prevent duplicate relationships
- **Indexed Foreign Keys**: Optimize query performance
- **Audit Trail**: Track relationship creation timestamps

### Cluster-Scoped API Pattern

**Purpose**: Maintain data isolation through URL routing and context preservation

**Implementation**:
```typescript
// Cluster-scoped endpoints
GET    /clusters/:clusterId/domains
POST   /clusters/:clusterId/domains/:domainId  // Link domain to cluster
GET    /clusters/:clusterId/resources
POST   /clusters/:clusterId/resources/:resourceId  // Link resource to cluster

// Context-aware creation
POST   /resources { domainId: required, clusterId: optional }
POST   /domains { clusterId: required }
```

**Key Principles**:
- **URL Context**: Cluster ID in URL maintains context throughout operations
- **Scoped Queries**: All list operations filtered by cluster context
- **Idempotent Linking**: Safe to retry relationship creation
- **Validation**: Server validates entity existence before creating relationships

### Frontend Validation Pattern

**Purpose**: Prevent invalid data entry with clear user feedback

**Implementation**:
```typescript
// Material-UI required field pattern
<InputLabel id='field-label'>{t('namespace.field')}</InputLabel>
<Select
  required
  error={!selectedValue}
  value={selectedValue || ''}
  onChange={handleChange}
>
  {/* No empty option for required fields */}
  {options.map(option => (
    <MenuItem key={option.id} value={option.id}>
      {option.name}
    </MenuItem>
  ))}
</Select>

// Conditional save button
<Button
  disabled={!isFormValid}
  onClick={handleSave}
>
  {t('common.save')}
</Button>
```

**Key Features**:
- **Required Indicators**: Automatic asterisk display for required fields
- **Error States**: Visual feedback for validation errors
- **Conditional Actions**: Disable actions until form is valid
- **No Empty Options**: Remove empty/dash options for required selections

## APPs Architecture Pattern (v0.21.0-alpha)

**6 Working Applications** with modular architecture:

-   **UPDL**: High-level abstract nodes (Space, Entity, Component, Event, Action, Data, Universo)
-   **Publish Frontend/Backend**: Multi-technology export (AR.js, PlayCanvas)
-   **Analytics**: Quiz performance tracking
-   **Profile Frontend/Backend**: Enhanced user management with workspace packages

### Key Benefits

-   **Separation of Concerns**: Core Flowise unchanged, functionality isolated in apps
-   **Template-First Architecture**: Reusable export templates across technologies
-   **Interface Separation**: Core UPDL vs simplified integration interfaces
-   **Easy Extension**: New technologies and node types added modularly

## UPDL Node System ✅ **COMPLETE**

**High-Level Abstract Nodes** (v0.21.0-alpha):

### 7 Core Node Types

-   **Space**: Root container for 3D environments
-   **Entity**: Game objects with transform and behavior
-   **Component**: Attachable behaviors (geometry, material, script)
-   **Event**: Trigger system for interactions
-   **Action**: Executable behaviors and responses
-   **Data**: Information storage and quiz functionality
-   **Universo**: Global connectivity and network features

### Architecture Features

-   **Universal Description**: Platform-independent intermediate representation
-   **Template-Based Export**: Multi-technology support (AR.js, PlayCanvas)
-   **Hierarchical Structure**: Parent-child relationships with typed connections
-   **Version Compatibility**: Forward/backward compatibility via `updlVersion`

## React Hooks Patterns

### ⚠️ React useEffect Antipattern Warning

**CRITICAL**: Never use `useCallback` functions in `useEffect` dependencies array for mount-only effects.

**Antipattern (Creates Infinite Loop)**:
```javascript
const loadData = useCallback(async () => {
    // ... fetch data, setState
}, [dep1, dep2])

useEffect(() => {
    loadData()
}, [loadData])  // ❌ WRONG! Creates infinite loop
```

**Problem**: 
- Functions are objects in JavaScript
- Each render creates new function reference (even with `useCallback`)
- `useEffect` sees new reference → runs → `setState` → re-render → new reference → loop

**Correct Pattern (Mount-Only Execution)**:
```javascript
const loadData = useCallback(async () => {
    // ... fetch data, setState
}, [dep1, dep2])

// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
    loadData()
}, [])  // ✅ CORRECT! Empty array = mount-only
```

**Why It Works**: JavaScript closures capture current values. `loadData` has access to latest `dep1` and `dep2` even with empty deps array.

**When to Use**:
- Event-driven data loading (load on mount, reload after user actions)
- Single-user MVP contexts
- Initial data fetch that doesn't need automatic refresh

**Real Example** (Publication System):
- PlayCanvasPublisher.jsx line 212
- PublishVersionSection.tsx line 167
- Bug caused continuous 429 errors (infinite requests)
- Fix: Changed `[loadFunction]` → `[]` with eslint-disable comment

---

### useAutoSave Hook Pattern

**Purpose**: Standardized auto-save functionality with debouncing, status indication, and data loss protection

**Location**: `packages/publish-frt/base/src/hooks/useAutoSave.ts`

**Features**:
- **Debouncing**: Configurable delay (default 500ms) to reduce API calls
- **Status Indication**: Returns `idle | saving | saved | error` for UI feedback
- **Unsaved Changes Tracking**: `hasUnsavedChanges` flag for conditional logic
- **Manual Save**: `triggerSave()` function for immediate saves
- **Beforeunload Protection**: Optional warning on page close with unsaved changes
- **First Render Skip**: Prevents save on component initialization

**Usage Pattern**:
```typescript
const { status, hasUnsavedChanges, triggerSave } = useAutoSave({
    data: settingsData,
    onSave: async (data) => await api.saveSettings(data),
    delay: 500,
    enableBeforeUnload: true
})

// Visual indicator in UI
<TextField
    helperText={
        status === 'saving' ? t('common.saving') :
        status === 'saved' ? t('common.saved') :
        status === 'error' ? t('common.saveError') : ''
    }
/>
```

**When to Use**:
- Forms with frequent updates (settings, configurations)
- Preventing data loss on accidental page close
- Consistent auto-save UX across application
- Reducing API calls via debouncing

**When NOT to Use**:
- Single-field forms (use inline debounce)
- Critical data requiring explicit save confirmation
- Real-time collaborative editing (use dedicated sync library)

## Event-Driven Data Loading Pattern

**Purpose**: Efficient data fetching without polling overhead for single-user MVP contexts

**Implementation** (Publication System):

**Key Principles**:
1. **Load on Mount**: Single initial request via `useEffect(() => { loadData() }, [])` (mount-only, see antipattern warning above)
2. **Reload After Actions**: Call `loadData()` after create/delete operations
3. **No Polling**: Remove `setInterval` - periodic updates unnecessary for single-user context
4. **AbortController**: Cancel stale requests to prevent race conditions

**Pattern Example**:
```javascript
const statusRef = useRef({
    loading: false,
    abortController: null
})

const loadData = useCallback(async () => {
    if (statusRef.current.loading) return []
    
    // Cancel previous request
    if (statusRef.current.abortController) {
        statusRef.current.abortController.abort()
    }
    
    const abortController = new AbortController()
    statusRef.current.loading = true
    statusRef.current.abortController = abortController
    
    try {
        const data = await api.fetchData({ signal: abortController.signal })
        setData(data)
        return data
    } catch (error) {
        if (error.name === 'AbortError' || error.name === 'CanceledError') {
            return []
        }
        console.error('Load failed:', error)
        return []
    } finally {
        statusRef.current.loading = false
        statusRef.current.abortController = null
    }
}, [dependencies])

// Mount-time load (mount-only pattern, see antipattern warning)
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => { loadData() }, [])

// Reload after action
const handleCreate = async () => {
    await api.create(item)
    await loadData() // Refresh data
}
```

**Benefits**:
- 92% reduction in API requests (from 12 req/min polling to 1 initial + action-triggered)
- Eliminates rate limit errors (429)
- Simpler codebase (no throttling cache logic)
- Race condition protection via AbortController

**When to Use**:
- Single-user scenarios (admin dashboards, settings)
- Data that changes only via user actions
- MVP/early-stage products
- Rate-limited APIs

**When NOT to Use**:
- Multi-user collaborative features
- Real-time data requirements
- Server-driven updates (use WebSocket/SSE)
- High-frequency external data changes

---

## TanStack Query v5 Architecture Patterns (2025-01-16)

### Overview

**TanStack Query v5** (formerly React Query) is used for server state management across the application. This section documents our patterns and best practices.

**Installation**:
- `@tanstack/react-query`: ^5.90.3 (production)
- `@tanstack/react-query-devtools`: ^5.90.2 (development)

### 1. Global QueryClient Pattern

✅ **CORRECT**: Single QueryClient at application root

```javascript
// packages/flowise-ui/src/index.jsx
import { QueryClientProvider } from '@tanstack/react-query'
import { createGlobalQueryClient } from '@/config/queryClient'

const queryClient = createGlobalQueryClient()

root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
```

❌ **WRONG**: Multiple QueryClient instances per component
```javascript
// Don't create local QueryClient in components
const MyComponent = () => {
  const queryClient = new QueryClient() // ❌ NO!
  // ...
}
```

**Why**: 
- One QueryClient = one cache for entire app
- Enables automatic request deduplication
- Persistent cache across component lifecycle
- Follows official TanStack Query v5 best practices

### 2. Query Key Factory Pattern

**Location**: `packages/publish-frt/base/src/api/queryKeys.ts`

✅ **CORRECT**: Use Query Key Factory for consistency

```typescript
import { publishQueryKeys } from '@/api/queryKeys'

const { data } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: fetchCanvas
})
```

❌ **WRONG**: Hardcoded query keys
```javascript
// Don't hardcode keys - prone to typos and mismatches
const { data } = useQuery({
  queryKey: ['publish', 'canvas', unikId, canvasId], // ❌ NO!
  queryFn: fetchCanvas
})
```

**Benefits**:
- Type normalization (prevents cache mismatches)
- Easy cache invalidation
- TypeScript autocomplete support
- Single source of truth

**Available Keys**:
```typescript
publishQueryKeys.all                              // ['publish']
publishQueryKeys.canvas()                         // ['publish', 'canvas']
publishQueryKeys.canvasByUnik(unikId, canvasId)   // ['publish', 'canvas', uId, cId]
publishQueryKeys.linksByVersion(tech, fId, vId)   // ['publish', 'links', tech, fId, vId]
```

**Cache Invalidation**:
```typescript
import { invalidatePublishQueries } from '@/api/queryKeys'

const queryClient = useQueryClient()

// After mutation
await saveCanvas()
invalidatePublishQueries.canvas(queryClient, canvasId)
```

### 3. Declarative useQuery() vs Imperative fetchQuery()

✅ **CORRECT**: useQuery() for component-level data

```javascript
// Automatic deduplication, loading states, error handling
const { data, isLoading, isError } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, canvasId),
  queryFn: async () => await PublicationApi.getCanvasById(unikId, canvasId),
  enabled: !!unikId && !!canvasId,
  staleTime: 5 * 60 * 1000  // 5 minutes
})
```

❌ **WRONG**: fetchQuery() in useEffect (no deduplication)

```javascript
// This creates duplicate requests if multiple components mount
useEffect(() => {
  const fetch = async () => {
    const data = await queryClient.fetchQuery({ /* ... */ })
    setData(data)
  }
  fetch()
}, [canvasId])
```

**When to use each**:

| Pattern | Use Case | Deduplication |
|---------|----------|---------------|
| `useQuery()` | Component-level data fetching | ✅ Automatic |
| `queryClient.fetchQuery()` | On-demand fetching in callbacks | ❌ Manual |

### 4. Hybrid Approach Pattern

✅ **CORRECT**: Combine useQuery + useQueryClient

```javascript
const MyPublisher = ({ flow }) => {
  // 1. Get queryClient for imperative operations
  const queryClient = useQueryClient()
  
  // 2. useQuery for component data (automatic deduplication)
  const { data: canvasData } = useQuery({
    queryKey: publishQueryKeys.canvasByUnik(unikId, flow?.id),
    queryFn: fetchCanvas,
    enabled: !!flow?.id
  })
  
  // 3. Computed values via useMemo (reactive)
  const resolvedVersionGroupId = useMemo(() => {
    if (normalizedVersionGroupId) return normalizedVersionGroupId
    if (canvasData) return FieldNormalizer.normalizeVersionGroupId(canvasData)
    return null
  }, [normalizedVersionGroupId, canvasData])
  
  // 4. queryClient.fetchQuery for callbacks (on-demand)
  const loadPublishLinks = useCallback(async () => {
    const records = await queryClient.fetchQuery({
      queryKey: publishQueryKeys.linksByVersion('arjs', flow.id, versionGroupId),
      queryFn: fetchLinks
    })
    return records
  }, [queryClient, flow.id, versionGroupId])
  
  // 5. Cache invalidation after mutations
  const handlePublish = async () => {
    await publishCanvas()
    invalidatePublishQueries.linksByTechnology(queryClient, 'arjs')
  }
}
```

**Why this works**:
- `useQuery()` for component state = automatic deduplication
- `useQueryClient()` for imperative actions = manual control when needed
- Both patterns are valid and complement each other

### 5. QueryClient Configuration Best Practices

**Location**: `packages/flowise-ui/src/config/queryClient.js`

```javascript
export const createGlobalQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,        // 5 minutes - reduces API calls
        gcTime: 30 * 60 * 1000,          // 30 minutes - memory management
        refetchOnWindowFocus: false,      // Prevents unnecessary refetch
        
        // Smart retry: skip auth errors and rate limits
        retry: (failureCount, error) => {
          const status = error?.response?.status
          if ([401, 403, 404, 429].includes(status)) return false
          if (status >= 500 && status < 600) return failureCount < 2
          return false
        },
        
        // Exponential backoff with Retry-After header support (RFC 7231)
        retryDelay: (attempt, error) => {
          const retryAfter = error?.response?.headers?.['retry-after']
          const parsed = parseRetryAfter(retryAfter)
          if (parsed !== null) {
            return parsed + Math.random() * 150  // Jitter prevents thundering herd
          }
          return Math.min(1000 * Math.pow(2, attempt), 30000)
        }
      },
      
      mutations: {
        retry: false  // Don't retry mutations (may have side effects)
      }
    }
  })
```

**Key Configuration Choices**:

| Option | Value | Rationale |
|--------|-------|-----------|
| `staleTime` | 5 minutes | Balance between freshness and API calls |
| `gcTime` | 30 minutes | Keep data in memory for quick navigation |
| `refetchOnWindowFocus` | false | Prevent unnecessary refetch on tab switch |
| `retry` | Smart policy | Skip 401/403/404/429, retry 5xx up to 2x |
| `retryDelay` | Exponential + jitter | Respect Retry-After, prevent thundering herd |

### 6. React Query DevTools

**Usage** (development only):

```javascript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

{process.env.NODE_ENV === 'development' && (
  <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
)}
```

**How to use**:
1. Open DevTools in browser (bottom-right corner)
2. Find query by key
3. Check status: fresh/stale/fetching/error
4. Verify fetch count (should be 1, not 10+)

### 7. Common Anti-Patterns to Avoid

❌ **Multiple QueryClient instances**
```javascript
// Don't create local QueryClient per component
const MyComponent = () => {
  const queryClient = new QueryClient()  // ❌
}
```

❌ **fetchQuery in useEffect**
```javascript
// No automatic deduplication
useEffect(() => {
  queryClient.fetchQuery({ /* ... */ })  // ❌
}, [deps])
```

❌ **Manual state management for async data**
```javascript
// useQuery handles this automatically
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)  // ❌
```

❌ **Hardcoded query keys**
```javascript
// Use Query Key Factory instead
queryKey: ['publish', 'canvas', id]  // ❌
```

### 8. Migration from Old Patterns

**Before (Anti-pattern)**:
```javascript
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  const fetch = async () => {
    const result = await api.getData()
    setData(result)
    setLoading(false)
  }
  fetch()
}, [id])
```

**After (Best practice)**:
```javascript
const { data, isLoading } = useQuery({
  queryKey: publishQueryKeys.canvasByUnik(unikId, id),
  queryFn: () => api.getData(id),
  enabled: !!id
})
```

**Benefits**:
- ✅ -40 lines of code per component
- ✅ Automatic deduplication (prevents 429 errors)
- ✅ No manual state management
- ✅ Declarative approach
- ✅ Built-in loading/error states

### Documentation

**Detailed guides**:
- `packages/publish-frt/README.md` - Full architecture documentation
- `packages/publish-frt/README-RU.md` - Русская версия
- `packages/publish-frt/base/src/api/queryKeys.ts` - Query Key Factory with JSDoc

**External resources**:
- [TanStack Query v5 Docs](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Query Key Factory Pattern](https://tkdodo.eu/blog/effective-react-query-keys)

---

## Development Principles

### Architecture Patterns

**Editor-Format-Export-Deploy**: Flowise UI → UPDL JSON → Template System → Published Applications

**Modular Communication**: Clear interfaces via UPDL JSON, platform abstraction through unified exporters

### Code Standards

-   **Documentation**: Prefix comments with "Universo Platformo |", concise English documentation
-   **Localization**: Modular i18n with namespace separation (`packages/<app>/i18n/`)
-   **Workspace Packages**: Scoped packages (`@universo/package-name`) for backend services

### Future-Ready Design

-   Workspace packages extractable to separate repositories
-   Microservices architecture evolution support
-   Easy addition of new technologies and node types

---

_For detailed application structure and development guidelines, see [packages/README.md](../packages/README.md). For technical implementation details, see [techContext.md](techContext.md). For project overview, see [projectbrief.md](projectbrief.md)._
