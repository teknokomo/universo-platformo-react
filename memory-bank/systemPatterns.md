# System Patterns

> **Note**: Reusable architectural patterns and best practices. For completed work, see progress.md. For current tasks, see tasks.md.

---

## Source-Only Package PeerDependencies Pattern (CRITICAL)

**Rule**: Source-only packages (no dist/) must use peerDependencies, NOT dependencies.

**Required**:
- `package.json`: peerDependencies for all external imports
- Parent app: dependencies for actual installation
- Example: `@flowise/template-mui` (source-only) → `flowise-ui` (installs deps)

**Detection**:
```bash
# Find source-only packages with wrong deps
find packages/*/base -name "package.json" -exec grep -L '"main":' {} \; | xargs grep '"dependencies":'
```

**Symptoms**:
- Vite error: "Cannot find module '@mui/material'"
- PNPM workspace resolution errors
- Missing node_modules in source-only packages

**Fix**:
```json
{
  "peerDependencies": {
    "react": "catalog:react",
    "@mui/material": "catalog:mui"
  }
}
```

**Why**: Source code is imported directly by Vite. Parent app resolves all dependencies via workspace graph.

---

## RLS Integration Pattern (CRITICAL)

**Location**: `memory-bank/rls-integration-pattern.md`

**Rule**: All database access MUST go through TypeORM Repository pattern with user context.

**Required**:
- `getDataSource()` for database connection
- `getRepository(Entity)` for CRUD operations
- User ID in request context for RLS policies

**Detection**:
```bash
# Find direct Supabase client usage (antipattern)
grep -r "supabaseClient" packages/*/src --exclude-dir=node_modules
```

**Pattern**: See full documentation in `rls-integration-pattern.md`

---

## i18n Architecture (CRITICAL)

**Rule**: Centralized namespace registration in `@universo/i18n`, consumed by apps.

**Required**:
- `packages/universo-i18n/base/src/namespaces/[namespace]/index.ts` - Registration
- `getInstance()` to access i18n singleton
- `registerNamespace(name, {en, ru})` for setup
- `useTranslation('[namespace]')` in components

**Detection**:
```bash
# Find direct i18next.use() calls (antipattern)
grep -r "i18next.use" packages/*/src --exclude-dir=node_modules
```

**Example**:
```typescript
// Register (once, in namespace file)
import { getInstance, registerNamespace } from '@universo/i18n'
import metaversesEn from './en.json'
import metaversesRu from './ru.json'

getInstance()
registerNamespace('metaverses', { en: metaversesEn, ru: metaversesRu })

// Consume (in components)
const { t } = useTranslation('metaverses')
```

**Why**: Single source of truth, prevents duplicate registrations, easier testing.

---

## Testing Environment Pattern (CRITICAL)

**Rule**: Use happy-dom for 4-9x faster tests vs jsdom.

**Required**:
- `vitest.config.ts`: `environment: 'happy-dom'`
- Mock rehype/remark to prevent jsdom fallback:
  ```typescript
  vi.mock('rehype-mathjax', () => ({ default: () => () => {} }))
  ```

**Performance**:
- jsdom: 2-5s initialization
- happy-dom: 566ms initialization

**Detection**:
```bash
# Find packages still using jsdom
grep -r "jsdom" packages/*/vitest.config.ts
```

**Why**: Native browser APIs, no canvas.node dependency, faster CI/CD.

---

## Universal List Pattern (CRITICAL)

**Rule**: Reusable list component with backend pagination, search, sorting.

**Required**:
- Backend: Zod pagination schema + TypeORM repository
- Frontend: TanStack Query + usePaginated hook
- Generic types: `<TItem, TFormData>`

**Components**:
- `SectionList` (sections CRUD)
- `EntityList` (entities CRUD)
- `MetaverseMembers` (member management)

**Pattern**:
```typescript
// Backend
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

// Frontend
const { data, isLoading } = usePaginated<TItem>({
  queryKey: ['items', filters],
  queryFn: ({ pageParam }) => fetchItems(pageParam),
  initialPageParam: { page: 1, limit: 10 }
})
```

**Detection**:
```bash
# Find lists not using pattern
grep -r "useState.*page" packages/*/src --exclude="*List.tsx"
```

**Why**: DRY, consistent UX, type-safe, easy to test.

---

## React StrictMode Pattern (CRITICAL)

**Rule**: StrictMode ONLY in development (causes double-mount in React 18).

**Required**:
```typescript
const isProduction = import.meta.env.MODE === 'production'

root.render(
  isProduction ? (
    <App />
  ) : (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
)
```

**Detection**:
```bash
# Find unconditional StrictMode
grep -r "StrictMode" packages/*/src/main.tsx | grep -v "isProduction"
```

**Symptoms**:
- RouterContext loss after login
- useEffect fires twice
- QueryClient initializes twice

**Why**: StrictMode double-mount breaks singleton patterns (Router, QueryClient) in production.

---

## TypeORM Repository Pattern (CRITICAL)

**Rule**: All database operations via `getRepository(Entity)`, not direct SQL.

**Required**:
- `getDataSource()` from `packages/flowise-server/src/DataSource.ts`
- Repository methods: `find()`, `findOne()`, `save()`, `delete()`
- User context for RLS policies

**Pattern**:
```typescript
import { getDataSource } from '@flowise/server/DataSource'
import { Profile } from '../database/entities'

const profileRepo = getDataSource().getRepository(Profile)
const profile = await profileRepo.findOne({ where: { user_id: userId } })
```

**Testing**:
```typescript
// In tests, cleanup after each test
afterEach(async () => {
  await getDataSource().destroy()
})
```

**Detection**:
```bash
# Find direct SQL queries (antipattern)
grep -r "query\(" packages/*/src --exclude-dir=migrations
```

**Why**: Type safety, automatic RLS, easier mocking, migration compatibility.

---

## TanStack Query v5 Patterns (CRITICAL)

**Rule**: Declarative `useQuery()` in components, imperative `fetchQuery()` in event handlers.

**Required**:
- Global QueryClient in App.tsx
- Query key factories for cache invalidation
- Infinite queries for pagination

**Pattern**:
```typescript
// 1. Global QueryClient
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      retry: 1
    }
  }
})

// 2. Query Keys Factory
export const metaverseKeys = {
  all: ['metaverses'] as const,
  lists: () => [...metaverseKeys.all, 'list'] as const,
  list: (filters: string) => [...metaverseKeys.lists(), { filters }] as const,
  details: () => [...metaverseKeys.all, 'detail'] as const,
  detail: (id: string) => [...metaverseKeys.details(), id] as const
}

// 3. Declarative useQuery (auto-fetch on mount)
const { data, isLoading } = useQuery({
  queryKey: metaverseKeys.detail(id),
  queryFn: () => fetchMetaverse(id)
})

// 4. Imperative fetchQuery (manual trigger)
const handleClick = async () => {
  const data = await queryClient.fetchQuery({
    queryKey: metaverseKeys.detail(id),
    queryFn: () => fetchMetaverse(id)
  })
}
```

**Detection**:
```bash
# Find queries without key factories
grep -r "useQuery" packages/*/src | grep -v "queryKey:"
```

**Why**: Centralized cache management, predictable invalidation, better performance.

---

## Secondary Patterns (Condensed)

### UPDL Node System
- 7 core nodes: Camera, Light, Model, Sound, Video, UI, Logic
- Visual programming for 3D scenes
- Details: See projectbrief.md

### Template Package Architecture
- Shared package: `@flowise/template-mui` (source-only, peerDeps)
- Template registry: Dynamic template loading
- UPDLProcessor: Scene graph execution

### Data Isolation (Metaverses)
- Three-tier: Metaverse → Section → Entity
- Junction tables: `entities_metaverses`, `sections_metaverses`
- Cluster-scoped API: `/api/v1/metaverses/:id/sections`

### React Hooks Antipattern
- ❌ NO: `useEffect()` for data fetching
- ✅ YES: TanStack Query `useQuery()`
- Reason: Prevents race conditions, double-fetch, stale data

### Event-Driven Data Loading
- Pattern: Listen to server events, invalidate queries
- Used in: Chat messages, real-time updates
- Example: `queryClient.invalidateQueries(messageKeys.all)`

### TypeScript Migration
- Dual build: CJS + ESM via tsdown
- Path aliases: `@/*` → `src/*`
- Type exports: `export type { ... }`

### Universal Role System
- Centralized types: `@universo/types/common/roles.ts`
- Hierarchy: `owner > admin > editor > member > guest`
- Utilities: `hasRequiredRole()`, `canManageRole()`

---

**Note**: For full code examples, see Git history or specific package READMEs. This file focuses on rules and detection patterns.
