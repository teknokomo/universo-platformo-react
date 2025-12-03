# System Patterns

> **Note**: Reusable architectural patterns and best practices. For completed work, see progress.md. For current tasks, see tasks.md.

---

## Source-Only Package PeerDependencies Pattern (CRITICAL)

**Rule**: Source-only packages (no dist/) must use peerDependencies, NOT dependencies.

**Required**:
- `package.json`: peerDependencies for all external imports
- Parent app: dependencies for actual installation
- Example: `@flowise/template-mui` (source-only) → `@flowise/core-frontend` (installs deps)

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

**Rule**: Core namespaces live in `@universo/i18n`. Feature packages (docstore, tools, credentials, etc.) ship and register their own translations via `registerNamespace`.

**Required**:
- Shared namespaces stay under `@universo/i18n` (core + generic views/dialogs)
- Feature packages expose `register<Feature>I18n()` helpers (see `@flowise/docstore-frontend/i18n`)
- Apps must import feature packages before rendering related routes: `import '@flowise/docstore-frontend/i18n'`
- `getInstance()` to access i18n singleton
- `registerNamespace(name, { en, ru })` for setup
- `useTranslation('[namespace]')` in components

**Detection**:
```bash
# Find direct i18next.use() calls (antipattern)
grep -r "i18next.use" packages/*/src --exclude-dir=node_modules
```

**Example**: See `@flowise/docstore-frontend/i18n` for reference implementation.

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

## Service Factory + NodeProvider Pattern (CRITICAL)

**Rule**: Abstract runtime dependencies (nodesPool, getRunningExpressApp) behind interfaces for testability.

**Problem**: Direct access to `getRunningExpressApp().nodesPool` creates tight coupling, making unit testing impossible.

**Solution**: Create interfaces that abstract runtime access, inject via factory function.

**Required**:
```typescript
// 1. Define interfaces in DI config (e.g., @flowise/docstore-backend/di/config.ts)
interface INodeProvider {
  getComponentNodes(): Map<string, INodeMetadata>
  getNode(name: string): INodeMetadata | undefined
  getNodesByCategory(category: string): INodeMetadata[]
  createNodeInstance(name: string): Promise<INode>
}

interface DocstoreServiceDependencies {
  dataSource: DataSource
  nodeProvider: INodeProvider  // New provider
}

// 2. Create provider implementation (e.g., flowise-core-backend/base/src/providers/nodeProvider.ts)
export function createNodeProvider(): INodeProvider {
  return {
    getComponentNodes: () => getRunningExpressApp().nodesPool.componentNodes,
    getNode: (name) => convertNodeToMetadata(nodesPool.get(name)),
    // ...
  }
}

// 3. Create service factory (e.g., flowise-core-backend/base/src/services/docstore-integration/index.ts)
let serviceInstance: IDocumentStoreService | null = null

export function createDocstoreServiceDependencies(): DocstoreServiceDependencies {
  return {
    dataSource: getDataSource(),
    nodeProvider: createNodeProvider(),
  }
}

export function getDocumentStoreService(): IDocumentStoreService {
  if (!serviceInstance) {
    serviceInstance = createDocumentStoreService(createDocstoreServiceDependencies())
  }
  return serviceInstance
}

// 4. Use in routes/services
const store = await getDocumentStoreService().createDocumentStore(data)
```

**Benefits**:
- Unit tests can mock `nodeProvider` with static data
- Service logic is testable without running Express app
- Clear separation of concerns

**Detection**:
```bash
# Find direct nodesPool access outside providers (antipattern)
grep -r "nodesPool" packages/flowise-core-backend/base/src/services --exclude-dir=providers
```

**Why**: Enables TDD, cleaner architecture, easier refactoring.

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
- `getDataSource()` from `packages/flowise-core-backend/base/src/DataSource.ts`
- Repository methods: `find()`, `findOne()`, `save()`, `delete()`
- User context for RLS policies

**Pattern**:
```typescript
import { getDataSource } from '@flowise/core-backend/DataSource'
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

## Factory Functions for Actions Pattern (CRITICAL)

**Rule**: Use factory functions to generate reusable action descriptors for CRUD and member management operations.

**Required**:
- Factory in `@universo/template-mui/factories/`
- Generic types for entity and form data
- Configuration object pattern (not multiple parameters)
- i18n key patterns with optional overrides

**Factories Available**:

### 1. `createEntityActions<TEntity, TFormData>` 
For entities with name/description fields (Metaverses, Sections, Entities).

**Pattern**:
```typescript
import { createEntityActions } from '@universo/template-mui'

export default createEntityActions<Metaverse, MetaverseData>({
  i18nPrefix: 'metaverses',
  getInitialFormData: (entity) => ({ 
    initialName: entity.name, 
    initialDescription: entity.description 
  })
})
```

**Result**: Edit/Delete actions using `EntityFormDialog` (name/description fields).

### 2. `createMemberActions<TMember extends BaseMemberEntity>` (NEW)
For member management with email/role/comment fields (Metaverses, Uniks, Finances, Projects).

**Pattern**:
```typescript
import { createMemberActions } from '@universo/template-mui'
import type { MetaverseMember } from '../types'

export default createMemberActions<MetaverseMember>({
  i18nPrefix: 'metaverses',
  entityType: 'metaverse'
})
```

**Result**: Edit/Remove actions using `MemberFormDialog` (email/role/comment fields).

**Benefits**:
- ✅ Eliminates code duplication (130 lines → 11 lines, -91%)
- ✅ Consistent error handling via `notifyError`/`notifyMemberError`
- ✅ Type-safe with TypeScript generics
- ✅ Reusable across multiple modules
- ✅ Centralized i18n key patterns

**Configuration Options**:
```typescript
interface MemberActionsConfig<TMember> {
  i18nPrefix: string        // Module namespace (e.g. 'metaverses', 'uniks')
  entityType: string         // For logging (e.g. 'metaverse', 'unik')
  i18nKeys?: {               // Optional translation key overrides
    editTitle?: string
    confirmRemove?: string
    // ... 8 more keys
  }
  getMemberEmail?: (member: TMember) => string
  getInitialFormData?: (member: TMember) => { 
    initialEmail: string
    initialRole: string
    initialComment: string 
  }
}
```

**Translation Key Patterns**:
- Default: `members.editTitle`, `members.confirmRemove` (relative to i18nPrefix namespace)
- Example: `i18nPrefix='metaverses'` → key `members.editTitle` resolves to `metaverses:members.editTitle`
- Fallback: `@universo/i18n/core/access.json` for common keys (future)
- Override: Via `i18nKeys` configuration

**Required Types**:
```typescript
import type { BaseMemberEntity } from '@universo/types'

interface YourMember extends BaseMemberEntity {
  id: string
  email: string | null
  role: string
  comment?: string
  // ... module-specific fields
}
```

**Detection**:
```bash
# Find Actions files not using factories (antipattern)
find packages/*/src/pages -name "*Actions.tsx" -exec grep -L "createEntityActions\|createMemberActions" {} \;
```

**Why**: DRY principle, consistent UX, type safety, easier testing, faster feature development.

**Code Reduction Example** (Metaverses package):
- Before: 130 lines × 4 Actions files = 520 lines
- After: 11 lines × 4 Actions files = 44 lines
- **Savings: 476 lines (-92%)**

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
