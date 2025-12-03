# Publication Frontend (publish-frontend)

Frontend for the publication system in Universo Platformo, supporting AR.js and PlayCanvas.

See also: Creating New packages/Packages (best practices)

- ../../../docs/en/universo-platformo/shared-guides/creating-apps.md
## UI Components Migration (October 2024)

This package consolidates all **"Publish & Export"** UI components from various parts of the monorepo into a single location. The migration improves maintainability, eliminates scattered QueryClient instances causing 429 request storms, and provides a unified entry point for all publication-related interfaces.

### Migration Details

**Migrated from:** `packages/flowise-core-frontend/base/src/views/publish/` and `packages/flowise-core-frontend/base/src/views/canvases/`  
**Migration date:** October 2024  
**Total files migrated:** 14 component files

#### Migrated Components Structure

```
src/features/
├─ dialog/              # Publication dialog components (from canvases/)
│  ├─ APICodeDialog.jsx       # Main publish dialog (1031 lines)
│  ├─ Configuration.jsx       # Display mode settings
│  ├─ EmbedChat.jsx           # Chat embed code generator
│  └─ index.ts                # Barrel exports
├─ chatbot/             # Chatbot publication components (from publish/bots/)
│  ├─ ChatBotSettings.jsx     # Chatbot configuration UI
│  ├─ BaseBot.jsx             # Base bot display component
│  ├─ BaseBotSettings.jsx     # Base bot settings
│  ├─ BotRouter.jsx           # Bot routing logic
│  ├─ ChatBotViewer.jsx       # Bot viewer component
│  ├─ embed/
│  │  ├─ BaseBotEmbed.jsx    # Base bot embed code
│  │  ├─ ChatBotEmbed.jsx    # Chatbot embed code
│  │  └─ index.ts            # Embed exports
│  └─ index.ts                # Chatbot exports
└─ api/                 # API code sharing components (from publish/)
   ├─ APIShare.jsx            # API sharing interface
   ├─ PythonCode.jsx          # Python code generator
   ├─ JavaScriptCode.jsx      # JavaScript code generator
   ├─ LinksCode.jsx           # Links code generator
   └─ index.ts                # API exports
```

### Critical Architecture Fix: Single QueryClient

**Problem Identified:** Multiple QueryClient instances across `ARJSPublisher`, `PlayCanvasPublisher`, and individual publishers caused race conditions and 429 (Too Many Requests) errors.

**Solution Implemented:** A single global `QueryClient` is now created at the UI root (`packages/flowise-core-frontend/base/src/index.jsx`). All publish features consume this shared client directly, eliminating redundant providers and network storms.

#### Global QueryClient Provider

**Location:** `packages/flowise-core-frontend/base/src/index.jsx`

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: true,
      refetchOnWindowFocus: false
    }
  }
})

root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
```

**Usage:** All publish-related dialogs and components now rely on the global `QueryClient` provided at the UI root. There is no longer a dedicated `PublishDialog.tsx` wrapper or a separate `PublishQueryProvider`.

```typescript
// Example usage of the main publish dialog component
import APICodeDialog from '../features/dialog/APICodeDialog'

// The QueryClientProvider is now set up at the app root, so you can use publish dialogs directly:

<APICodeDialog
  show={showDialog}
  type={dialogType}
  data={dialogData}
  onConfirm={handleConfirm}
  onCancel={handleCancel}
/>
```

### Localization Migration

All publish-related i18n keys migrated from `packages/flowise-core-frontend/base/src/i18n/locales/{en,ru}/views/canvases.json` to `packages/publish-frontend/base/src/i18n/locales/{en,ru}/main.json`.

**New i18n section:** `apiCodeDialog`

**Keys migrated:**
- `noAuthorization`, `addNewKey`, `chooseApiKey`, `apiEndpoint`
- `shareAPI`, `configuration`, `embed`, `viewInBrowser`
- `publish`, `unpublish`, `publishing`, `unpublishing`
- `pythonCode`, `javascriptCode`, `links`
- And all sub-keys for each section

### Package Exports

**Entry Point:** `src/index.ts`

```typescript
// Dialog components (migrated from canvases/)
export { default as APICodeDialog } from './features/dialog/APICodeDialog'
export { default as Configuration } from './features/dialog/Configuration'
export { default as EmbedChat } from './features/dialog/EmbedChat'

// Chatbot components (migrated from publish/bots/)
export { default as ChatBotSettings } from './features/chatbot/ChatBotSettings'
export { default as BaseBot } from './features/chatbot/BaseBot'
export { default as BaseBotSettings } from './features/chatbot/BaseBotSettings'
export { default as BotRouter } from './features/chatbot/BotRouter'
export { default as ChatBotViewer } from './features/chatbot/ChatBotViewer'

// Chatbot embed components
export { default as BaseBotEmbed } from './features/chatbot/embed/BaseBotEmbed'
export { default as ChatBotEmbed } from './features/chatbot/embed/ChatBotEmbed'

// API components (migrated from publish/)
export { default as APIShare } from './features/api/APIShare'
export { default as PythonCode } from './features/api/PythonCode'
export { default as JavaScriptCode } from './features/api/JavaScriptCode'
export { default as LinksCode } from './features/api/LinksCode'

// Existing publishers
export { ARJSPublisher } from './features/arjs/ARJSPublisher'
export { PlayCanvasPublisher } from './features/playcanvas/PlayCanvasPublisher'
```

**Package.json configuration:**

```json
{
  "main": "dist/publish-frontend/base/src/index.js",
  "module": "dist/publish-frontend/base/src/index.js",
  "exports": {
    ".": {
      "import": "./dist/publish-frontend/base/src/index.js",
      "require": "./dist/publish-frontend/base/src/index.js"
    }
  }
}
```

### MVP Constraints & Future Work

#### Current State (MVP)

**Import Strategy:** Kept `@/` imports pointing to `flowise-ui` for stability:
```javascript
// Current approach in migrated files
import { useTranslation } from 'react-i18next'
import '@/views/canvases/CanvasHeader.css'
import { SyntaxHighlighter, CodeBlock } from '@/ui-components/SyntaxHighlighter'
```

**Build Output:** TypeScript compiles to CommonJS (per `tsconfig.json`), Gulp copies static assets.

#### Known Issues

1. **CommonJS/ESM Incompatibility:** Direct imports of `publish-frontend` components in `flowise-ui` fail due to Vite expecting ESM while TypeScript produces CommonJS.
   - **Impact:** Cannot yet use `import { PublishDialog } from 'publish-frontend'` in main UI
   - **Workaround:** Keep original imports (`@/views/canvases/APICodeDialog`) for now

2. **Import Migration Pending:** Full conversion from `@/` imports to workspace paths (`@universo/...`) deferred to future iteration.

#### Future Improvements

- [ ] Convert TypeScript compilation to ESM (update `tsconfig.json` module target)
- [ ] Migrate all internal `@/` imports to workspace paths
- [ ] Enable direct `publish-frontend` imports in `flowise-ui`
- [ ] Remove original files from `packages/flowise-core-frontend/base` once stability confirmed
- [ ] Performance testing of single QueryClient approach
- [ ] Integration tests for publish dialog from UI

### Migration Success Metrics

✅ **Build Status:** Both `publish-frontend` and `flowise-ui` build successfully  
✅ **QueryClient Fix:** Multiple QueryClient instances eliminated  
✅ **Code Organization:** All publish UI components in one location  
✅ **Localization:** Complete i18n migration for English and Russian  
✅ **Exports:** All components available via barrel exports  

### Testing Recommendations

1. **Manual Testing:**
   - Open any canvas and trigger "Publish & Export" dialog
   - Verify all tabs (API, Configuration, Embed) work correctly
   - Test AR.js and PlayCanvas publishers
   - Confirm no 429 errors during publication operations

2. **Performance Monitoring:**
   - Monitor request counts during publish operations
   - Verify single QueryClient behavior in browser DevTools
   - Check for reduced duplicate requests

3. **Regression Testing:**
   - Ensure existing publish workflows continue working
   - Test all configuration options (markers, libraries, display modes)
   - Verify public links generation and viewing

---

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

---

## 📚 Architecture Patterns

### 1. TanStack Query Integration

The package uses **TanStack Query v5** for server state management, following official best practices.

#### Key Principles:

✅ **Single Global QueryClient** - One QueryClient for the entire application
```javascript
// packages/flowise-core-frontend/base/src/index.jsx
const queryClient = createGlobalQueryClient()

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

✅ **Query Key Factory** - Centralized key management
```typescript
// packages/publish-frontend/base/src/api/queryKeys.ts
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
import { publishQueryKeys, invalidatePublishQueries } from '@packages/publish-frontend/base/src/api'
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
// packages/flowise-core-frontend/base/src/config/queryClient.js
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

---

## 🔧 API Reference

### publishQueryKeys

Exported from `@packages/publish-frontend/base/src/api`

```typescript
import { publishQueryKeys } from '@packages/publish-frontend/base/src/api'

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
import { invalidatePublishQueries } from '@packages/publish-frontend/base/src/api'

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

---

## 🐛 Debugging

### React Query DevTools

React Query DevTools are available in development mode:

```javascript
// Automatically included in packages/flowise-core-frontend/base/src/index.jsx
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

---

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

---

## 🚀 Development

### Install dependencies
```bash
pnpm install
```

### Build
```bash
# Build only publish-frontend
pnpm --filter publish-frontend build

# Build publish-frontend + flowise-ui
pnpm --filter publish-frontend build && pnpm --filter flowise-ui build
```

### Linting
```bash
pnpm --filter publish-frontend lint
pnpm --filter publish-frontend lint --fix
```

---

## 📖 Additional Resources

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Query Key Factory Pattern](https://tkdodo.eu/blog/effective-react-query-keys)

---

## 📄 License

MIT License - see LICENSE file for details

---

## Project Structure

The project follows a unified structure for applications in the monorepo:

```
packages/publish-frontend/base/
├─ package.json
├─ tsconfig.json
├─ gulpfile.ts
└─ src/
   ├─ assets/              # Static files (images, fonts, icons)
   │  ├─ icons/            # SVG icons for components and UI
   │  ├─ images/           # Images for UI elements
   │  └─ libs/             # Local libraries for CDN-blocked regions
   │     ├─ aframe/        # A-Frame library versions
   │     └─ arjs/          # AR.js library versions
   ├─ api/                 # HTTP clients for backend interaction
   │  ├─ common.ts         # Base API utilities (auth, URL parsing, base URL)
   │  ├─ index.ts          # Central API exports module
   │  └─ publication/      # Publication-specific API clients
   │     ├─ PublicationApi.ts        # Base publication API for all technologies
   │     ├─ ARJSPublicationApi.ts    # AR.js specific publication API
   │     ├─ PlayCanvasPublicationApi.ts # PlayCanvas specific publication API
   │     ├─ StreamingPublicationApi.ts # Streaming publication API
   │     └─ index.ts       # Publication API exports with compatibility aliases
   ├─ builders/            # UPDL to target platform builders with template-first architecture
   │  ├─ common/           # Shared builder infrastructure
   │  │  ├─ AbstractTemplateBuilder.ts # Abstract base class for all templates
   │  │  ├─ BaseBuilder.ts           # Base builder class for high-level builders
   │  │  ├─ BuilderRegistry.ts       # Registry for managing high-level builders
   │  │  ├─ TemplateRegistry.ts      # Registry for managing template implementations
   │  │  ├─ types.ts                 # Common types and interfaces
   │  │  └─ setup.ts                 # Builder and template registration setup
   │  │  # Note: UPDLProcessor is now imported from @universo-platformo/utils
   │  ├─ templates/        # Template-first organization (NEW ARCHITECTURE)
   │  │  ├─ quiz/          # Quiz template for educational content
   │  │  │  └─ arjs/       # AR.js implementation of quiz template
   │  │  │     ├─ ARJSBuilder.ts         # High-level AR.js builder
   │  │  │     ├─ ARJSQuizBuilder.ts     # Quiz template implementation
   │  │  │     ├─ config.ts              # Quiz template configuration
   │  │  │     ├─ handlers/              # UPDL node processors for quiz
   │  │  │     │  ├─ ActionHandler.ts    # Action node processing
   │  │  │     │  ├─ CameraHandler.ts    # Camera node processing
   │  │  │     │  ├─ ComponentHandler.ts # Component node processing
   │  │  │     │  ├─ DataHandler.ts      # Data/Questions processing
   │  │  │     │  ├─ EntityHandler.ts    # Entity node processing
   │  │  │     │  ├─ EventHandler.ts     # Event node processing
   │  │  │     │  ├─ LightHandler.ts     # Light node processing
   │  │  │     │  ├─ ObjectHandler.ts    # Object node processing
   │  │  │     │  ├─ SpaceHandler.ts     # Space node processing
   │  │  │     │  ├─ UniversoHandler.ts  # Universo node processing
   │  │  │     │  └─ index.ts            # Handlers export
   │  │  │     ├─ utils/                 # Template-specific utilities
   │  │  │     │  └─ SimpleValidator.ts  # Validation utilities
   │  │  │     └─ index.ts               # Quiz AR.js exports
   │  │  └─ (external)     # MMOOMM moved to external package: @universo/template-mmoomm
   │  └─ index.ts          # Main builders export
   ├─ components/          # Presentation React components
   ├─ features/            # Functional modules for different technologies
   │  ├─ arjs/             # AR.js components and logic
   │  └─ playcanvas/       # PlayCanvas components and logic
   ├─ pages/               # Page components
   │  ├─ public/           # Public pages (ARViewPage, PlayCanvasViewPage)
   │  └─ ...
   └─ index.ts             # Entry point
```

**Type System**: UPDL types are imported from `@universo/publish-backend` package, ensuring centralized type definitions and consistency across frontend and backend components.

## Publication Links: Workflow and Data Model

The publication system supports two link types and Base58 short slugs:

- Group link: points to the "active" version within a version group. Public URL prefix: `/p/{slug}`.
- Version link: points to a specific immutable version UUID. Public URL prefix: `/b/{slug}`.

Key fields:

- `versionGroupId`: required for group links (server can fallback from flow data when absent).
- `targetType`: `group` or `version`.
- `slug`: Base58-encoded short id (generated on the server).

Client API: use the unified `PublishLinksApi` to list/create/update links. When creating a group link, pass the normalized `versionGroupId`.

## Normalizing versionGroupId on the client

Backend may return either `versionGroupId` or legacy `version_group_id`. To avoid scattered fallbacks, the frontend uses a tiny utility:

- `src/utils/fieldNormalizer.ts` exports `FieldNormalizer.normalizeVersionGroupId(flow)` returning a string or undefined.

In AR.js/PlayCanvas publishers, use it before creating or listing links so that `PublishLinksApi` receives a consistent value.

Notes:

- This is a non-breaking addition; consumers using old fields continue to work.
- Prefer using `PublishLinksApi` over any legacy per-tech API imports.

## Security/Robustness notes (MVP)

Server-side improvements were added without changing public contracts:

- Rate limiting for publish routes (write/read tiers)
- Minimal DTO validation for create/update link payloads
- Sanitized error messages in production

Frontend implications:

- Pass only the required fields (`unikId`, `canvasId`/`spaceId` if applicable, `versionGroupId` for group links).
- Handle 400 responses by showing a concise validation error to the user.

## Server-state management and retries

Starting from October 2025 the publication UI uses **TanStack Query** to manage server-side state:

- `PublishQueryProvider` (see `src/providers/PublishQueryProvider.tsx`) hosts a shared `QueryClient` with sensible defaults (`staleTime` 30 s, `gcTime` 5 min, retries only for 5xx).
- AR.js и PlayCanvas издатели запрашивают `/publish/links` и `/canvases/:id` через `queryClient.fetchQuery`, что исключает параллельные повторные запросы и кеширует полученные данные.
- Для пользовательских повторных попыток показано уведомление с кнопкой «Retry», которое инвалидацирует связанные ключи (`publish/canvas`, `publish/links/*`) и перезапускает загрузку.

Серверные лимитеры теперь отправляют `Retry-After`, `X-RateLimit-*`. Клиент уважает эти заголовки и больше не пытается повторять запросы агрессивно. При необходимости можно расширить стратегию, добавив собственный `QueryCache` или очереди, но для MVP достаточно встроенных возможностей TanStack Query + наглядных ошибок.

## Critical Architecture: Iframe-Based AR.js Rendering

**IMPORTANT**: AR.js content must be rendered using iframe approach for proper library loading and script execution.

### Why Iframe is Essential

The AR.js libraries (A-Frame and AR.js) require proper script execution context that React's `dangerouslySetInnerHTML` cannot provide:

-   **Script Isolation**: Iframe creates isolated execution context for AR.js scripts
-   **Library Loading**: Enables proper loading of external/local JavaScript libraries
-   **Browser Compatibility**: Prevents conflicts with React's virtual DOM
-   **Security**: Isolates AR.js/PlayCanvas code from main application context

### Implementation Pattern (ARViewPage.tsx, PlayCanvasViewPage.tsx)

```typescript
// ❌ WRONG: dangerouslySetInnerHTML (scripts don't execute)
;<div dangerouslySetInnerHTML={{ __html: html }} />

// ✅ CORRECT: iframe approach (full script execution)
const iframe = document.createElement('iframe')
iframe.style.width = '100%'
iframe.style.height = '100%'
iframe.style.border = 'none'
container.appendChild(iframe)

const iframeDoc = iframe.contentDocument
iframeDoc.open()
iframeDoc.write(html) // AR.js HTML with <script> tags
iframeDoc.close()
```

### Static Libraries Integration

The frontend works with local AR.js libraries served directly by the main Flowise server:

#### Server Configuration (packages/flowise-core-backend/base/src/index.ts)

```typescript
// Static assets served by main Flowise server
const publishFrtAssetsPath = path.join(__dirname, '../../../packages/publish-frontend/base/dist/assets')
this.app.use('/assets', express.static(publishFrtAssetsPath))
```

#### Library Sources

-   **Local (Kiberplano)**: `/assets/libs/aframe/1.7.1/aframe.min.js` - served by main server
-   **Official (CDN)**: `https://aframe.io/releases/1.7.1/aframe.min.js` - external CDN

#### Benefits

-   **CDN Blocking Solution**: Local libraries work in restricted regions
-   **Single Server**: No separate static file server needed
-   **Performance**: Direct serving from main Flowise instance
-   **Maintenance**: Libraries bundled with frontend distribution

## Template-Based Builders Architecture

The builders system has been refactored into a **modular, template-based architecture**. This provides maximum flexibility and extensibility for converting UPDL spaces to different target platforms (AR.js, PlayCanvas, etc.).

#### Key Components

-   **`AbstractTemplateBuilder`**: A new abstract base class that all templates (e.g., for AR.js quizzes, PlayCanvas scenes) must extend. It provides common functionality like library management and document structure wrapping.
-   **`TemplateRegistry`**: A central registry for managing and creating instances of different template builders.
-   **`ARJSBuilder`**: The high-level builder that now acts as a controller. It identifies the required template and delegates the entire build process to the corresponding template builder from the registry.
-   **`ARJSQuizBuilder`**: A concrete implementation of a template for generating AR.js HTML quizzes. It contains its own set of `Handlers` to process different UPDL nodes.
-   **`PlayCanvasMMOOMMBuilder` (external)**: Provided by `@universo/template-mmoomm` for generating PlayCanvas MMOOMM scenes with MMO-specific functionality.
-   **`Handlers`**: Specialized processors for different UPDL node types are now encapsulated within each template (e.g., `builders/templates/quiz/arjs/handlers/`). MMOOMM handlers now live inside `@universo/template-mmoomm`. This makes each template self-contained while keeping `publish-frontend` thin.

#### Template-First Architecture

The new architecture organizes code by **template first, then by technology**:

```
builders/templates/
├─ quiz/                    # Educational quiz template
│  └─ arjs/                 # AR.js implementation
│     ├─ ARJSBuilder.ts     # High-level controller
│     ├─ ARJSQuizBuilder.ts # Template implementation
│     └─ handlers/          # Quiz-specific processors
└─ (external)               # MMO gaming template moved to @universo/template-mmoomm
```

#### Features

-   **Maximum Extensibility**: Easy to add new target platforms (e.g., Three.js) by creating a new template implementation under existing template folders.
-   **Template Reusability**: The same template (e.g., `quiz`) can support multiple technologies (AR.js, PlayCanvas, etc.) with shared abstract logic.
-   **Clear Separation of Concerns**: High-level builders are simple controllers, while template implementations contain all specific logic.
-   **Self-Contained Templates**: Each template bundles its own logic, handlers, and required libraries, preventing conflicts.
-   **Type Safe**: Full TypeScript support with robust interfaces (`ITemplateBuilder`, `TemplateConfig`).
-   **Shared Functionality**: Common logic like library source resolution and HTML document wrapping is handled by the abstract base class, reducing code duplication.
-   **Future-Ready**: The architecture supports unlimited template and technology combinations.

#### Recent Improvements

-   **PlayCanvasViewPage Refactoring**: Uses `TemplateRegistry` for dynamic template selection via `config.templateId`. MMOOMM builder is provided by `@universo/template-mmoomm`.
-   **ENABLE_BACKEND_FETCH Flag**: Added feature flag (default: false) for optional backend data fetching. When disabled, component expects data via props, improving security and reliability.
-   **Exclusive Publication Logic**: Fixed logic in `PublicationApi.savePublicationSettings()` to only affect supported technologies (`chatbot`, `arjs`, `playcanvas`) and prevent accidental modification of unrelated config properties.
-   **Localization Enhancement**: Added missing `publish.playcanvas.loading` translation keys for improved multilingual support.

#### AR.js Builder Usage

```typescript
import { ARJSBuilder } from './builders'

const builder = new ARJSBuilder()

// Build using the default 'quiz' template
const result = await builder.buildFromFlowData(flowDataString, {
    projectName: 'My AR Experience',
    markerType: 'preset',
    markerValue: 'hiro',
    libraryConfig: {
        arjs: { version: '3.4.7', source: 'kiberplano' },
        aframe: { version: '1.7.1', source: 'official' }
    }
})

// Or specify a different template if available
const anotherResult = await builder.buildFromFlowData(flowDataString, {
    templateId: 'another-template'
    // ... other options
})

console.log(result.html) // Generated AR.js HTML
console.log(result.metadata) // Build metadata
```

### PlayCanvas Builder Usage

```typescript
import { PlayCanvasBuilder } from './builders'

const builder = new PlayCanvasBuilder()
const result = await builder.buildFromFlowData(flowDataString, {
    projectName: 'MMOOMM Demo',
    templateId: 'mmoomm'
})

console.log(result.html) // PlayCanvas HTML
```

### PlayCanvas Scripts System

The MMOOMM template includes a simple scripts system for reusable PlayCanvas behaviors:

```typescript
import { RotatorScript, getDefaultRotatorScript } from './scripts'

// Create a rotation script
const rotator = RotatorScript.createDefault()

// Get default rotator for demo mode
const defaultRotator = getDefaultRotatorScript()
```

#### Key Features

-   **Simple Architecture**: Clean, minimal implementation for MVP
-   **Type Safety**: Full TypeScript support
-   **Modular Design**: Scripts organized as separate modules
-   **Demo Integration**: Provides smooth animations for demo modes

#### Built-in Scripts

-   **RotatorScript**: Simple Y-axis rotation animation for demo cube

The scripts system provides smooth rotation animation for the default red cube in demo mode, extracted from the main builder for better code organization.

### Universo MMOOMM Template

The `mmoomm` template provides a fully functional space MMO environment with advanced game mechanics:

#### Core Features

-   **Industrial Laser Mining System**: Auto-targeting laser mining with 3-second cycles and inventory integration
-   **Space Ship Controls**: WASD+QZ movement with physics-based flight mechanics
-   **Inventory Management**: 20m³ cargo hold with real-time capacity tracking
-   **Entity System**: Ships, asteroids, stations, and gates with networking capabilities
-   **Real-time HUD**: Mining progress, cargo status, and system indicators

#### Game Mechanics

-   **Mining**: Target asteroids within 75-unit range, extract 1.5m³ resources per cycle
-   **Movement**: Full 6DOF ship movement with camera following
-   **Physics**: Collision detection, rigidbody dynamics, and realistic space physics

Select **PlayCanvas MMOOMM Template** in the configuration or pass `templateId: 'mmoomm'` when using the builder.
Publish the project and open the public link to explore the fully functional MMO environment.

**Detailed Documentation:** MMOOMM PlayCanvas Template is provided by the external package `@universo/template-mmoomm`.

### Entity Types System

The MMOOMM template includes a comprehensive entity system with specialized types for space MMO gameplay:

#### Available Entity Types

-   **Ship**: Player-controlled spacecraft with laser mining system, inventory, and physics
-   **Asteroid**: Mineable objects with resource yield and destruction mechanics
-   **Station**: Trading posts and docking facilities for commerce
-   **Gate**: Teleportation portals for inter-system travel
-   **Player**: Network-aware player entities for multiplayer support
-   **Interactive**: Objects with custom interaction behaviors
-   **Vehicle**: Alternative movement entities with different physics
-   **Static**: Non-interactive environmental objects

#### Entity Features

-   **Modular Architecture**: Each entity type has dedicated logic in `entityTypes/` directory
-   **Component Integration**: Entities work seamlessly with UPDL Component nodes
-   **Network Support**: Built-in networking capabilities for multiplayer scenarios
-   **Physics Integration**: Collision detection, rigidbody dynamics, and spatial relationships
-   **Memory Management**: Automatic cleanup and reference management

## UPDL Processing Architecture

The frontend now includes independent UPDL processing capabilities through the `UPDLProcessor` class, eliminating dependencies on backend utilities.

### Key Components

-   **UPDLProcessor**: Central class for UPDL flow processing (migrated from `packages/flowise-core-backend/base/src/utils/buildUPDLflow.ts`)
-   **Type Imports**: UPDL types imported from `@universo/publish-backend` package
-   **Frontend Independence**: Complete UPDL processing on frontend without backend dependencies

### Features

-   **Flow Analysis**: Identifies UPDL nodes and ending nodes
-   **Space Chain Processing**: Handles multi-space scenarios and scene sequences
-   **Data Integration**: Processes Data nodes connected to Spaces
-   **Object Relationships**: Maps Object nodes to Data nodes
-   **Type Safety**: Full TypeScript support with centralized type definitions

### Usage

```typescript
import { UPDLProcessor } from './builders/common/UPDLProcessor'
import { IUPDLSpace, IUPDLMultiScene } from '@universo/publish-backend'

const result = UPDLProcessor.processFlowData(flowDataString)
if (result.multiScene) {
    // Handle multi-space scenario
} else if (result.updlSpace) {
    // Handle single space scenario
}
```

## Library Configuration System

User-selectable library sources for AR.js and A-Frame to solve CDN blocking issues.

### How It Works

Users can choose library sources through the UI:

1. **AR.js Configuration**:

    - Version: Currently supports 3.4.7
    - Source: "Официальный сервер" (CDN) or "Сервер Kiberplano" (local)

2. **A-Frame Configuration**:
    - Version: Currently supports 1.7.1
    - Source: "Официальный сервер" (CDN) or "Сервер Kiberplano" (local)

### Library Sources

-   **Официальный сервер**: External CDN sources

    -   A-Frame: `https://aframe.io/releases/1.7.1/aframe.min.js`
    -   AR.js: `https://raw.githack.com/AR-js-org/AR.js/3.4.7/aframe/build/aframe-ar.js`

-   **Сервер Kiberplano**: Local server (solves CDN blocking)
    -   A-Frame: `/assets/libs/aframe/1.7.1/aframe.min.js`
    -   AR.js: `/assets/libs/arjs/3.4.7/aframe-ar.js`

### Configuration Storage

Library preferences are stored in Supabase `chatbotConfig.arjs.libraryConfig`:

```json
{
    "arjs": {
        "libraryConfig": {
            "arjs": { "version": "3.4.7", "source": "kiberplano" },
            "aframe": { "version": "1.7.1", "source": "official" }
        }
    }
}
```

### Benefits

-   **Solves CDN Blocking**: Users in restricted regions can use local libraries
-   **User Choice**: Each user decides their preferred library source
-   **Persistent Settings**: Configuration saved per canvas
-   **Backward Compatibility**: Existing flows continue working with defaults
-   **Future Extensibility**: Easy to add new library versions

## Backend Integration

The application maintains modular architecture with clean separation between frontend and backend components.

### Current Architecture

-   **Frontend Processing**: UPDL flow processing handled by `UPDLProcessor` class in frontend
-   **API Communication**: Backend interaction exclusively through REST API using clients from `api/` directory
-   **Type Sharing**: UPDL types centralized in `@universo/publish-backend` package and imported by frontend
-   **Service Layer**: Backend provides `FlowDataService` for flow data management
-   **Independence**: No direct imports from `packages/flowise-core-backend/base` - complete modular independence

### Flow Processing Workflow

1. **Frontend Request**: User initiates publication through `ARJSPublisher` or `PlayCanvasPublisher` component.
2. **API Call**: Frontend sends request to `/api/v1/publish/arjs` (or other tech-specific endpoint).
3. **Backend Processing**: `FlowDataService` retrieves flow data from Flowise database.
4. **Frontend Processing**: `UPDLProcessor` analyzes and converts flow data to UPDL structures.
5. **Builder Generation**: The high-level builder (`ARJSBuilder`, `PlayCanvasBuilder`) delegates the build process to a registered template builder (e.g., `ARJSQuizBuilder`, `PlayCanvasMMOOMMBuilder`), which converts the UPDL space to the target format.
6. **Result**: Generated content served through public URLs with iframe rendering.

### Migration Benefits

-   **Performance**: Frontend processing reduces backend load
-   **Modularity**: Clear separation of concerns between frontend and backend
-   **Type Safety**: Centralized type definitions prevent inconsistencies
-   **Scalability**: Frontend can handle complex UPDL processing independently
-   **Maintenance**: Simplified architecture with fewer cross-package dependencies

### Integration with Bots System

This frontend application is closely integrated with the main bots publication system located in `packages/flowise-core-frontend/base/src/views/publish/bots/`:

-   **Configuration Integration**: The AR.js publisher is accessible through the main publication interface in the bots system
-   **Shared Publication State**: Publication settings are stored in Supabase using the same `chatbotConfig` structure as the main bots system
-   **Technology-Specific Configuration**: AR.js and PlayCanvas settings are stored in their respective blocks (`arjs`, `playcanvas`) within `chatbotConfig`, maintaining separation from chatbot settings.
-   **API Route Consistency**: Uses the same Flowise API routes (`/api/v1/uniks/{unikId}/canvases/{canvasId}`) as the main system

### Supabase Integration

Publication state persistence is handled through Supabase integration:

-   **Multi-Technology Structure**: Settings stored in `chatbotConfig` field with structure `{"chatbot": {...}, "arjs": {...}, "playcanvas": {...}}`
-   **Independent Publication States**: Each technology (chatbot, AR.js, PlayCanvas) has its own `isPublic` flag.
-   **Exclusive Publication**: The system ensures only one technology can be public at a time. If one is enabled, all others are automatically disabled.
-   **Auto-save Functionality**: Settings automatically saved when parameters change
-   **State Restoration**: Previous settings restored when component mounts
-   **Global Publication Status**: Overall `isPublic` flag set to true if any technology is public

#### Exclusive Publication Logic

The system implements exclusive publication: only one technology can be public at a time.
When enabling publication for one technology (AR.js, PlayCanvas, Chatbot),
all other technologies are automatically disabled. This ensures clear content delivery
and prevents conflicts between different publication modes.

## Main Components

-   `UPDLProcessor` - Central class for UPDL flow processing (migrated from backend)
-   `ARJSPublisher` - Component for AR.js project streaming publication with Supabase integration
-   `ARJSExporter` - Demo component for AR.js code export
-   `ARViewPage` - Page component for AR space viewing using iframe approach
-   `ARJSBuilder` - The high-level controller that delegates to the template system.
-   `ARJSQuizBuilder` - A concrete template implementation for AR.js quizzes.
-   `PlayCanvasPublisher` - Component for PlayCanvas publication settings.
-   `PlayCanvasBuilder` - Builder for PlayCanvas HTML output with template support.
-   `PlayCanvasViewPage` - Page component for viewing PlayCanvas scenes.
-   `PlayCanvasMMOOMMBuilder` - A concrete template implementation for the Universo MMOOMM project with:
    -   Industrial laser mining system with auto-targeting and state machine
    -   Comprehensive entity system (ships, asteroids, stations, gates)
    -   Physics-based space flight mechanics and inventory management
    -   Real-time HUD with mining progress and cargo status
-   `PlayCanvas Scripts System` - Simple system for reusable PlayCanvas behaviors:
    -   `BaseScript` - Abstract base class for PlayCanvas scripts
    -   `RotatorScript` - Simple Y-axis rotation animation script

## API Architecture

The application uses a modular API architecture organized into layers:

#### Core API Utilities (`api/common.ts`)

-   `getAuthHeaders()` - Authentication token management from localStorage
-   `getCurrentUrlIds()` - Extract unikId and canvasId from URL
-   `getApiBaseUrl()` - Dynamic API base URL resolution

#### Publication API Layer (`api/publication/`)

-   **`PublicationApi`** - Base class for publication functionality across all technologies. Manages multi-technology settings in `chatbotConfig`.
-   **`ARJSPublicationApi`** - AR.js specific publication settings management (extends PublicationApi)
-   **`PlayCanvasPublicationApi`** - PlayCanvas specific publication settings management (extends PublicationApi)
-   **`StreamingPublicationApi`** - Real-time content generation and streaming publication

#### API Integration Features

-   **Multi-Technology Support**: Publication API designed to support AR.js, PlayCanvas, Chatbot, and future technologies
-   **Supabase Integration**: Persistent storage using `chatbotConfig` structure with technology-specific blocks
-   **Backward Compatibility**: Includes compatibility aliases (`CanvasesApi`, `ARJSPublishApi`) for seamless migration
-   **Proper Authentication**: Uses correct Flowise routes with `unikId` and `x-request-from: internal` headers
-   **Circular Dependency Prevention**: Clean architecture with `common.ts` utilities to prevent import cycles

## Creating AR.js Quizzes with UPDL

AR quizzes are built using a chain of UPDL **Space** nodes. Each space may include **Data** nodes with questions. A question can have multiple **Data** answer nodes connected to it. Correct answers are marked with `isCorrect`, and answer nodes can also define `enablePoints` and `pointsValue` for the scoring system. Each answer node may be linked to an **Object** node that appears when the answer is selected.

Spaces can form a sequence via their `nextSpace` connection to create multi‑question quizzes. A space with no Data nodes can collect user info (`collectName`, `collectEmail`, `collectPhone`) and save it to Supabase leads. The final space in a chain can enable `showPoints` to display the participant score. Participant scores are now persisted in the dedicated `lead.points` integer column (the previous temporary storage in `lead.phone` is no longer used).

High‑level nodes are connected in a chain: **Entity** holds **Components**, components can raise **Events**, and events run **Actions**. This relationship `Entity → Component → Event → Action` describes interactive behaviour used by builders such as PlayCanvas MMOOMM.

## Workflow

The implementation uses streaming generation for AR.js from UPDL nodes with persistent configuration:

1. Settings are automatically loaded from Supabase when component mounts
2. User configures project parameters (title, marker, library sources) - settings auto-saved
3. User toggles "Make Public" - triggers publication and saves state to Supabase
4. The `ARJSPublisher` component sends a POST request to `/api/v1/publish/arjs` with the `canvasId` and selected options
5. The backend `PublishController.publishARJS` handler returns a response with `publicationId` and publication metadata
6. When accessing the public URL (`/p/{publicationId}`), the `PublicFlowView` component is rendered, which then determines the technology and renders the appropriate viewer (`ARViewPage` or `PlayCanvasViewPage`).
7. The page component makes a GET request to `/api/v1/publish/arjs/public/:publicationId` (or similar for other techs), which returns flow data from the backend.
8. The `UPDLProcessor` analyzes the flow data and converts it to UPDL structures on the frontend.
9. The appropriate Builder system (`ARJSBuilder`, `PlayCanvasBuilder`) converts the UPDL space to renderable elements using the correct template.
10. **Critical**: Generated HTML is rendered in an iframe for proper script execution and library loading.

## Setup and Development

To run the project:

```bash
pnpm run dev
```

To build:

```bash
pnpm run build
```

## Build Process

The build process involves two steps:

1. **TypeScript Compilation**: Compiles TypeScript files to JavaScript
2. **Gulp Tasks**: Copies static assets (SVG, PNG, JSON, CSS, JS libraries) to the dist folder

### Available Scripts

-   `pnpm clean` - Clean the dist directory
-   `pnpm build` - Build the package (TypeScript + Gulp)
-   `pnpm dev` - Watch mode for development
-   `pnpm lint` - Lint the source code

### Gulp Tasks

The Gulp process copies all static files (SVG, PNG, JPG, JSON, CSS, JS) from the source directories to the dist folder, preserving the directory structure. This ensures that assets and local libraries are available at runtime.

## Dependencies

Make sure to install dependencies from the root of the project using:

```bash
pnpm install
```

## Development

When adding new components or pages, follow these practices:

1. Create components in the appropriate directory
2. Use TypeScript interfaces for props and state
3. Add appropriate static assets to the same folder (they will be copied during build)
4. Implement internationalization support using the i18n system
5. **For AR.js content**: Always use iframe approach for proper script execution

## Demo Mode

For testing and demonstration, the `ARJSPublisher` component has a DEMO_MODE that can be activated by setting the constant `DEMO_MODE = true`. In this mode:

1. Template selection is displayed (currently only one demo template "Quiz")
2. No real API requests are made during publication
3. A fixed publication URL is provided
4. All UI interactions work, but without actual server operations
5. Supabase integration is disabled

## Current Limitations

-   No support for offline mode or space caching for reuse
-   No optimization for mobile devices
-   The Export tab is a demo only, without full HTML/ZIP export functionality

---

_Universo Platformo | Publication Frontend Module_

## AR.js Wallpaper Mode (Markerless)

The AR.js exporter now supports a markerless "wallpaper" display mode for quizzes.

### What it does

-   Renders a safe animated background behind the quiz UI without requiring a physical marker.
-   Uses an animated wireframe sphere placed in the camera as a lightweight AR‑style backdrop.

### UI changes (ARJSPublisher)

-   New selector: `AR Display Type` with options `AR‑wallpaper` and `Standard marker`.
-   When `AR‑wallpaper` is selected:
    -   Marker selector and marker preview are hidden.
    -   A new selector appears: `Wallpaper type` (currently `standard`).
    -   Publication instructions switch to markerless instructions.
-   Disabled technologies in the main mode selector are now visually dimmed (Babylon.js, A‑Frame) for clarity.

### Persistence

Settings are saved per space to Supabase in `chatbotConfig.arjs`:

```json
{
    "arjs": {
        "isPublic": true,
        "projectTitle": "My AR Quiz",
        "generationMode": "streaming",
        "arDisplayType": "wallpaper",
        "wallpaperType": "standard",
        "libraryConfig": {
            "arjs": { "version": "3.4.7", "source": "official" },
            "aframe": { "version": "1.7.1", "source": "official" }
        }
    }
}
```

### Builder behavior

-   `ARJSQuizBuilder` renders without `<a-marker>` when `arDisplayType = 'wallpaper'`.
-   Adds an animated wireframe sphere as background; rotation duration set to `90000ms` (slower, smoother motion).
-   Quiz UI overlays remain unchanged.

### Public view rendering

-   `ARViewPage` retrieves `renderConfig` from the public API and forwards it to `ARJSBuilder.buildFromFlowData`:

```json
{
    "renderConfig": {
        "arDisplayType": "wallpaper",
        "wallpaperType": "standard",
        "markerType": "preset", // present for legacy
        "markerValue": "hiro" // present for legacy
    }
}
```

-   Fallbacks preserve legacy marker behavior when `renderConfig` is missing.

---

## 📖 Additional Resources

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Query Key Factory Pattern](https://tkdodo.eu/blog/effective-react-query-keys)

---

## 📄 License

MIT License - see LICENSE file for details

