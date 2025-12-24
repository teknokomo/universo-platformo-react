# System Patterns

> **Note**: Reusable architectural patterns and best practices. For completed work → progress.md. For current tasks → tasks.md.

---

## Source-Only Package PeerDependencies Pattern (CRITICAL)

**Rule**: Source-only packages (no dist/) MUST use peerDependencies, NOT dependencies.

**Required**: `peerDependencies` in package.json for all external imports; parent app has actual `dependencies`.

**Detection**: `find packages/*/base -name "package.json" -exec grep -L '"main":' {} \; | xargs grep '"dependencies":'`

**Why**: Source code imported directly by Vite; parent app resolves dependencies via workspace graph.

---

## RLS Integration Pattern (CRITICAL)

**Location**: `memory-bank/rls-integration-pattern.md`

**Rule**: All database access via TypeORM Repository pattern with user context for RLS policies.

**Required**:
- `getDataSource()` for connection
- `getRepository(Entity)` for CRUD
- User ID in request context
- Ensure RLS context persists across queries (session-scoped settings + reset on cleanup, or a single explicit transaction for the whole request)

**Detection**: `grep -r "supabaseClient" packages/*/src --exclude-dir=node_modules` (antipattern)

**Full documentation**: See `rls-integration-pattern.md`

---

## i18n Architecture (CRITICAL)

**Rule**: Core namespaces in `@universo/i18n`; feature packages ship own translations via `registerNamespace`.

**Required**:
- Feature packages expose `register<Feature>I18n()` (see `@flowise/docstore-frontend/i18n`)
- Apps import feature packages before rendering: `import '@flowise/docstore-frontend/i18n'`
- `getInstance()` for singleton, `registerNamespace(name, { en, ru })` for setup
- `useTranslation('[namespace]')` in components

**Detection**: `grep -r "i18next.use" packages/*/src` (antipattern)

**Why**: Single source of truth, prevents duplicates, easier testing.

---

## RBAC + CASL Authorization Pattern (CRITICAL)

**Rule**: Hybrid RBAC (database) + CASL (application) for flexible, isomorphic permission checks.

**Architecture**:
1. **Database**: `admin.roles`, `admin.role_permissions`, `admin.user_roles`, SQL functions
2. **Backend**: `createAbilityMiddleware()`, `req.ability.can('delete', 'Metaverse')`
3. **Frontend**: `AbilityContextProvider`, `<Can I="create" a="Project">`, `useAbility()`

**Wildcards**: `module='*'` + `action='*'` → CASL `subject='all'` + `action='manage'`

**Key Files**:
- Types: `@universo/types/abilities`
- Backend: `@universo/auth-backend` (permissionService, abilityMiddleware)
- Frontend: `@flowise/store` (AbilityContextProvider, Can, useAbility)
- Migration: `admin-backend/migrations/1733400000000-CreateAdminSchema.ts`

---

## Admin Route Guards Pattern

**Rule**: Database-driven CRUD permission checks instead of hardcoded role names.

**Antipattern**: `if (roleName !== 'superadmin') throw 403` ❌

**Pattern**: `const hasPermission = await permissionService.hasPermission(userId, module, action)` ✅

**Usage**: `router.delete('/:id', ensureGlobalAccess('roles', 'delete'), ...)`

---

## Scoped-API Pattern for RLS

**Rule**: Use parent-scoped endpoints for child entities (e.g., `/metaverse/:id/entities` not `/entities`) to ensure RLS works with global permissions.

**Frontend**: Conditionally use scoped API when parent ID in params.

**Backend**: Pass parent context to RLS policies.

---

## Public Execution Share Contract Pattern

**Rule**: Shareable execution details must use a stable, cross-package contract.

**Frontend (no-auth route)**:
- Use Minimal layout route: `/execution/:id`

**Backend (public endpoint)**:
- Expose: `GET /public-executions/:id`

**API Client**:
- `getPublicExecutionById(id)` must call `/public-executions/:id`

**Why**: Keeps share links, UI routing, api-client, and server routes aligned and avoids “link opens but API 404/401” regressions.

---

## Testing Environment Pattern (CRITICAL)

**Rule**: Tests use Vitest, no Jest. UI tests use Testing Library, E2E uses Playwright.

**Required**:
- `vitest.config.ts` per package
- `@testing-library/react` for UI
- `playwright.config.ts` for E2E

---

## Service Factory + NodeProvider Pattern (CRITICAL)

**Rule**: Backend services use factory functions with `{ getDataSource, ...providers }` config.

**Pattern**:
```typescript
export const createXxxService = (config: {
  getDataSource: GetDataSourceFn
  telemetryProvider?: ITelemetryProvider
}) => ({ method1, method2 })
```

**Why**: Testability without full app context, flexible provider injection.

---

## Universal List Pattern (CRITICAL)

**Rule**: All entity lists use unified pattern: `usePaginated` + `useDebouncedSearch` + `PaginationControls` + card/table toggle.

**Required Components**:
- `ViewHeader` with search/filters
- `ItemCard` for card view
- `FlowListTable` for table view
- `PaginationControls` at bottom
- `localStorage` for view persistence

**Key Files**:
- Hook: `@universo/template-mui/hooks/usePaginated.ts`
- Components: `@universo/template-mui/components/lists/`

---

## React StrictMode Pattern (CRITICAL)

**Rule**: StrictMode ONLY in development (conditional wrapper).

**Pattern**:
```tsx
const StrictModeWrapper = import.meta.env.DEV ? React.StrictMode : React.Fragment
<StrictModeWrapper><App /></StrictModeWrapper>
```

**Why**: Prevents double-mount issues in production, keeps dev benefits.

---

## ReactFlow AgentFlow Node Config Dialog Pattern

**Rule**: Node settings dialogs must be opened from the Canvas (ReactFlow-level events), not from node component DOM handlers.

**Pattern**:
- Use `onNodeDoubleClick` on the universal canvas (`views/canvas/index.jsx`).
- Gate behavior by node render type (e.g., `node.type === 'agentFlow'`), and explicitly exclude sticky notes.
- Open a portal dialog (`EditNodeDialog`) with `{ data: node.data, inputParams: visibleInputParams }`.

**Why**: Matches Flowise 3.x behavior and avoids event bubbling / inconsistent behavior across custom node renderers.

---

## TypeORM Repository Pattern (CRITICAL)

**Rule**: All database operations via `getDataSource().getRepository(Entity)`.

**Required**:
- User context for RLS
- No raw SQL in services
- Cross-schema JOINs via separate queries + map

**Antipattern**: `ds.query("SELECT ...")` ❌

**Pattern**: `const repo = ds.getRepository(Metaverse); await repo.find({ where: { id } })` ✅

---

## TanStack Query v5 Patterns (CRITICAL)

**Rule**: Query key factories for cache invalidation; `useQuery` for fetching; `useMutation` for state changes.

**Query Keys**:
```typescript
export const metaversesQueryKeys = {
  all: ['metaverses'] as const,
  lists: () => [...metaversesQueryKeys.all, 'list'] as const,
  list: (params) => [...metaversesQueryKeys.lists(), params] as const,
  details: () => [...metaversesQueryKeys.all, 'detail'] as const,
  detail: (id) => [...metaversesQueryKeys.details(), id] as const,
}
```

**Mutations**:
```typescript
const createMutation = useMutation({
  mutationFn: metaversesApi.createMetaverse,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: metaversesQueryKeys.lists() })
})
```

**Why**: Declarative data fetching, automatic background updates, built-in loading/error states.

---

## Factory Functions for Actions Pattern (CRITICAL)

**Rule**: Use `createEntityActions` factory + `createMemberActions` factory for consistent action definitions.

**Pattern**:
```typescript
const metaverseActions = createEntityActions({
  entityType: 'metaverse',
  showEdit: true,
  showDelete: (can) => can('delete', 'Metaverse'),
  navigate: (action, id) => `/metaverse/${id}/${action}`
})

const memberActions = createMemberActions({
  entityType: 'metaverse',
  availableRoles: ['owner', 'admin', 'editor', 'member'],
  getMemberId: (member) => member.user_id
})
```

**Key Files**:
- `@universo/template-mui/factories/createEntityActions.tsx`
- `@universo/template-mui/factories/createMemberActions.tsx`

---

## Route Protection Guards Pattern

**Rule**: Protected routes redirect unauthorized users; no error pages revealing resource structure.

**Guards**:
| Guard | Checks | Redirect |
|-------|--------|----------|
| `AuthGuard` | Authentication | → `/auth` |
| `AdminGuard` | Admin panel access | → `/` |
| `ResourceGuard` | Resource ownership (API 403/404) | → `/` |

**Usage**:
```tsx
<Route path="admin" element={<AdminGuard><Outlet /></AdminGuard>}>
  <Route index element={<InstanceList />} />
</Route>
```

**Specialized Guards**: Create module-specific wrappers (e.g., `MetaverseGuard` wraps `ResourceGuard`).

---

## Rate Limiting Pattern

**Rule**: Redis-based rate limiting for all public API endpoints.

**Pattern**: Middleware applies limits based on IP/user; returns 429 Too Many Requests.

**Config**: `RATE_LIMIT_ENABLED`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`.

---

## Pagination Pattern

**Backend**:
- Zod schema: `limit` (default 20, max 100), `offset` (default 0), `sortBy`, `sortOrder`
- Response headers: `X-Pagination-Limit`, `X-Total-Count`
- Single query with `getManyAndCount()`

**Frontend**:
- `usePaginated<T, SortFields>` hook
- `PaginationControls` component
- `rowsPerPageOptions={[10, 20, 50, 100]}`

---

## Error Handling Pattern

**Backend**:
- Centralized error handler middleware
- Custom error classes: `ValidationError`, `NotFoundError`, `ForbiddenError`
- Consistent error response: `{ error: { message, code, details } }`

**Frontend**:
- Error boundaries for critical sections
- Toast notifications for user-facing errors
- Sentry integration for monitoring

---

## Env Configuration Pattern

**Rule**: Use `@universo/utils/env` for centralized env config; type-safe access functions.

**Pattern**:
```typescript
// universo-utils/env/adminConfig.ts
export const isAdminPanelEnabled = () => process.env.ADMIN_PANEL_ENABLED !== 'false'
export const isGlobalRolesEnabled = () => process.env.GLOBAL_ROLES_ENABLED !== 'false'
```

**Why**: Single source of truth, avoids string literals, enables mocking for tests.

---

## Migration Pattern

**Rule**: Single consolidated migration per package; idempotent with `IF NOT EXISTS`; no destructive `down()`.

**Pattern**:
- Filename: `<timestamp>-<DescriptiveName>.ts`
- Idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`
- RLS policies included in same migration
- Seed data in separate `SEED_*.sql` file

---

## Build System Patterns

**tsdown**: Dual output (CJS + ESM), path aliases `@/*`, type declarations.

**pnpm workspace**: Run from root, `--filter <package>` for single package, full `pnpm build` required for cross-deps.

**Performance**: `turbo` for caching, parallel builds where possible.

---

## Naming Conventions

**Files**: `PascalCase` for components, `camelCase` for hooks/utils, `kebab-case` for folders/files.

**Database**: `snake_case` for tables/columns, `PascalCase` for TypeORM entities.

**i18n**: Dot notation (`auth.login.button`), namespace prefixes.

---

## Known Antipatterns to Avoid

❌ Direct Supabase client usage (violates RLS pattern)
❌ Hardcoded role checks (use database permissions)
❌ `dependencies` in source-only packages (use `peerDependencies`)
❌ Raw SQL in services (use TypeORM Repository)
❌ `i18next.use()` in packages (use `registerNamespace`)
❌ StrictMode in production builds
❌ Client-side pagination for large datasets
❌ Duplicate state management (prefer TanStack Query cache)

---

**Last Updated**: 2025-12-10

**Note**: For full RLS pattern documentation → `rls-integration-pattern.md`. For implementation history → progress.md.
