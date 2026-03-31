# Plan: Metahubs & Applications Comprehensive Refactoring

> **Date**: 2026-03-29
> **Mode**: PLAN
> **Status**: DRAFT — pending user review
> **Complexity**: Level 4 (Major/Complex)
> **Estimated Scope**: ~121,000 LOC across 4 packages, 18+ files > 1,000 lines

---

## 1. Overview

This plan addresses accumulated technical debt in the metahubs and applications subsystems: monolithic route files (up to 5,120 lines), duplicated CRUD patterns across 60+ handlers, repeated frontend component structure across 10+ List components, and inline business logic that belongs in service layers. The refactoring applies modern Express.js + React patterns (controller–service–store layering, custom hooks extraction, generic CRUD factories) while preserving all existing API contracts, security guarantees, and test coverage.

### Key Goals

1. **Reduce file sizes** — no file > 500 lines (routes), no component > 600 lines
2. **Eliminate duplication** — extract shared patterns into typed generic utilities
3. **Improve performance** — eliminate N+1 queries, consolidate redundant fetches
4. **Harden security** — eliminate manual `BEGIN/COMMIT/ROLLBACK`, unify error responses
5. **Increase testability** — controller + service separation enables unit test isolation
6. **Full test coverage** — every new abstraction must have unit tests; integration tests for critical paths
7. **Update documentation** — README files, `docs/` GitBook pages, REST API docs

### Current State (Problem Analysis)

#### Backend — Monolithic Route Files

| File | Lines | Handlers | Inline Logic |
|------|-------|----------|-------------|
| applicationsRoutes.ts | **5,120** | 26 | 65% inline |
| applicationSyncRoutes.ts | **3,726** | ~12 | 60% inline |
| attributesRoutes.ts | 2,291 | 14 | 40% inline |
| enumerationsRoutes.ts | 2,248 | ~10 | 45% inline |
| catalogsRoutes.ts | 1,959 | 16 | 50% inline |
| publicationsRoutes.ts | 1,754 | ~12 | 45% inline |
| metahubsRoutes.ts | 1,640 | ~15 | 50% inline |
| hubsRoutes.ts | 1,276 | — | — |
| setsRoutes.ts | 1,119 | — | — |
| constantsRoutes.ts | 1,027 | — | — |

**Total backend**: ~35,885 (metahubs) + ~14,872 (applications) = **~50,757 LOC**

#### Identified Backend Problems

1. **Manual transaction control** — `applicationsRoutes.ts` uses raw `BEGIN/COMMIT/ROLLBACK` with `.catch()` for ROLLBACK errors (silent failures). Must use `executor.transaction()`.
2. **Error handling inconsistency** — 5 different patterns: early-return 401, custom `UpdateFailure` classes, service re-throw, specific error mapping, silent fallback. No centralized error response format.
3. **Duplicated patterns** across route files:
   - Auth check + service initialization: ~10 lines × 60+ handlers = ~600 LOC
   - Query validation + in-memory pagination: ~100 lines × 6 files = ~600 LOC
   - Schema sync try-catch: ~30 lines × 50 occurrences = ~1,500 LOC
   - Error type guards (`isTableChildLimitReachedError`, etc.): ~50 lines × 6 files = ~300 LOC
4. **Inline business logic** — especially in `applicationsRoutes.ts` where runtime row copy (60+ lines), soft-delete cascade, and schema resolution (5-level query nesting) are inlined in handlers.

#### Frontend — Monolithic List Components

| Component | Lines | useState | useMemo |
|-----------|-------|----------|---------|
| ElementList.tsx | 2,246 | 11 | 10+ |
| AttributeList.tsx | 1,868 | 14 | 8+ |
| EnumerationList.tsx | 1,724 | — | — |
| CatalogList.tsx | 1,715 | 12 | 6+ |
| SetList.tsx | 1,698 | — | — |
| HubList.tsx | 1,444 | — | — |
| ChildAttributeList.tsx | 1,435 | — | — |
| ConstantList.tsx | 1,239 | — | — |

**Total frontend**: ~54,925 (metahubs) + ~15,625 (applications) = **~70,550 LOC**

#### Identified Frontend Problems

1. **Structural boilerplate**: all 5+ List components repeat ~300–400 lines of identical setup: router params → query client → hub-scoped logic → paginated query → search/filter → conflict resolution → actions filtering.
2. **Dialog state explosion**: 5 dialog states (new, edit, copy, delete, conflict) × 5 components = 25 nearly identical `useState` blocks.
3. **N+1 queries** in `ElementList.tsx`: N separate API calls for child attributes of TABLE attributes.
4. **Redundant hub list fetch**: each List component independently fetches the same hub list.
5. **Mutation hooks boilerplate**: create/update/delete/copy/reorder all follow the same optimistic pattern but each is a separate function with ~80–120 lines.
6. **Display converter duplication**: 12 identical `toXxxDisplay()` functions in `types.ts`.

#### Shared Packages — What Already Exists

| Package | Purpose | Assessment |
|---------|---------|------------|
| `@universo/types` | Core types, VLC, pagination | ✅ Well-organized |
| `@universo/utils` | VLC helpers, codename validation, DB utils, optimistic state | ✅ Comprehensive |
| `@universo/template-mui` | UI components, `usePaginated()`, dialogs, guards | ✅ Rich component library |
| `@universo/i18n` | i18n instance, hooks, namespaces | ✅ Clean |
| `@universo/store` | Redux, CASL abilities | ✅ Minimal |

**What Should Be Moved to Shared**:
- `fetchAllPaginatedItems()` from metahubs-frontend → `@universo/utils/api`
- `optimisticReorder()` from metahubs-frontend → `@universo/template-mui/hooks`
- Display converter pattern → generic factory in `@universo/utils/vlc`

---

## 2. Architecture Patterns (Modern Best Practices)

### 2.1 Backend: Controller–Service–Store Layered Architecture

Based on Express.js best practices (2025/2026), web research, and Context7 documentation.

**Layer responsibilities:**

```
Route (thin) → Controller (HTTP) → Service (business logic) → Store (SQL)
```

- **Route**: Mount path + middleware (rate limiter, auth guard). No logic.
- **Controller**: Parse `req.params`/`req.body`/`req.query`, validate with Zod, call service, format response. Max ~30 lines per handler.
- **Service**: Business logic, transactions, cross-entity coordination. Testable without HTTP.
- **Store**: Raw parameterized SQL queries. Already exists and is excellent.

#### Example: Current vs. Refactored

**BEFORE** (inline in route handler, ~200 lines):
```typescript
router.post('/metahub/:metahubId/hub/:hubId/catalog/:catalogId/copy', writeLimiter, asyncHandler(async (req, res) => {
  const userId = await ensureMetahubRouteAccess(req, res, req.params.metahubId)
  if (!userId) return
  const { exec } = services(req)
  
  // 30 lines of Zod validation
  // 20 lines of codename preparation  
  // 50 lines of transaction with retry logic
  // 30 lines of schema sync with error handling
  // 20 lines of response building
  // 40 lines of error mapping
}))
```

**AFTER** — Route (5 lines):
```typescript
// catalogsRoutes.ts — thin route declarations only
router.post(
  '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/copy',
  writeLimiter,
  asyncHandler(catalogsController.copy)
)
```

**AFTER** — Controller (~30 lines):
```typescript
// catalogsController.ts
import { copyCatalogSchema } from '../schemas/catalogSchemas'
import { CatalogsService } from '../services/CatalogsService'

export const copy = createMetahubHandler(async ({ req, res, userId, metahubId, services }) => {
  const { hubId, catalogId } = req.params
  const validated = copyCatalogSchema.parse(req.body)

  const result = await services.catalogs.copy({
    metahubId,
    hubId,
    catalogId,
    userId,
    ...validated,
  })

  return res.status(201).json(result)
})
```

**AFTER** — Service (business logic, testable):
```typescript
// CatalogsService.ts
export class CatalogsService {
  constructor(private readonly exec: DbExecutor, private readonly schemaService: MetahubSchemaService) {}

  async copy(input: CopyCatalogInput): Promise<CatalogRecord> {
    return this.exec.transaction(async (trx) => {
      const source = await catalogsStore.findById(trx, input.catalogId)
      if (!source) throw new NotFoundError('catalog', input.catalogId)

      const codename = await this.resolveUniqueCodename(trx, input)
      const created = await catalogsStore.insert(trx, { ...source, id: uuidv7(), codename, ...input })

      if (input.copyAttributes) {
        await this.copyAttributes(trx, input.catalogId, created.id, input.userId)
      }

      await this.schemaService.syncSchema(trx, input.metahubId, input.userId, 'catalog copy')
      return created
    })
  }
}
```

### 2.2 Backend: Generic Metahub Handler Factory

Eliminates the auth-check + service-init boilerplate repeated 60+ times:

```typescript
// domains/shared/createMetahubHandler.ts
import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo/utils'

interface MetahubHandlerContext {
  req: Request
  res: Response
  userId: string
  metahubId: string
  services: MetahubServices
  exec: DbExecutor
}

type MetahubHandlerFn = (ctx: MetahubHandlerContext) => Promise<Response | void>

/**
 * Factory that wraps route handlers with standardized:
 * 1. Auth check via ensureMetahubRouteAccess
 * 2. Service initialization
 * 3. Error handling with consistent response format
 */
export function createMetahubHandler(handler: MetahubHandlerFn) {
  return async (req: Request, res: Response): Promise<void> => {
    const metahubId = req.params.metahubId
    const userId = await ensureMetahubRouteAccess(req, res, metahubId)
    if (!userId) return

    const svc = services(req)

    try {
      await handler({ req, res, userId, metahubId, services: svc, exec: svc.exec })
    } catch (error) {
      handleMetahubError(res, error)
    }
  }
}
```

### 2.3 Backend: Unified Error Handling

Extend the **existing** `MetahubDomainError` hierarchy in [domainErrors.ts](packages/metahubs-backend/base/src/domains/shared/domainErrors.ts) with new subclasses (preserving its payload-based constructor pattern):

```typescript
// domains/shared/domainErrors.ts — EXTEND existing file

// Extend the MetahubErrorCode union:
export type MetahubErrorCode =
  | 'MIGRATION_REQUIRED' | 'CONNECTION_POOL_EXHAUSTED' | 'SCHEMA_LOCK_TIMEOUT' | 'MIGRATION_APPLY_LOCK_TIMEOUT'
  // NEW codes:
  | 'NOT_FOUND' | 'CONFLICT' | 'LIMIT_REACHED' | 'SCHEMA_SYNC_FAILED' | 'VALIDATION_ERROR'

// NEW subclasses (same payload constructor pattern as existing MetahubMigrationRequiredError):
export class MetahubNotFoundError extends MetahubDomainError {
  constructor(entity: string, id: string) {
    super({
      message: `${entity} not found`,
      statusCode: 404,
      code: 'NOT_FOUND',
      details: { entity, id }
    })
    this.name = 'MetahubNotFoundError'
  }
}

export class MetahubConflictError extends MetahubDomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ message, statusCode: 409, code: 'CONFLICT', details })
    this.name = 'MetahubConflictError'
  }
}

export class MetahubLimitReachedError extends MetahubDomainError {
  constructor(entity: string, limit: number) {
    super({
      message: `${entity} limit reached`,
      statusCode: 409,
      code: 'LIMIT_REACHED',
      details: { entity, limit }
    })
    this.name = 'MetahubLimitReachedError'
  }
}

export class MetahubSchemaSyncError extends MetahubDomainError {
  constructor(operation: string, cause?: unknown) {
    super({
      message: 'Schema sync failed',
      statusCode: 500,
      code: 'SCHEMA_SYNC_FAILED',
      details: { operation }
    })
    this.name = 'MetahubSchemaSyncError'
    if (cause) this.cause = cause
  }
}

// Update existing isMetahubDomainError guard to handle new error classes
// (no changes needed — it already checks instanceof MetahubDomainError)
```

The existing `asyncHandler` already forwards errors to Express error middleware via `.catch(next)`. Update the global error middleware to handle `MetahubDomainError`:

```typescript
// In error middleware (or metahubs router-level error handler):
if (isMetahubDomainError(error)) {
  return res.status(error.statusCode).json({
    error: error.message,
    code: error.code,
    details: error.details,
  })
}
```

### 2.4 Backend: Shared Pagination Helper

The `ListQuerySchema` and `validateListQuery()` **already exist** in [queryParams.ts](packages/metahubs-backend/base/src/domains/shared/queryParams.ts). Only add the missing `paginateItems()` helper:

```typescript
// domains/shared/queryParams.ts — ADD to existing file (after validateListQuery)

/**
 * Apply in-memory pagination to a pre-sorted array.
 * Uses existing ListQueryParams type from ListQuerySchema.
 */
export function paginateItems<T>(
  items: T[],
  query: Pick<ListQueryParams, 'limit' | 'offset'>
): { items: T[]; pagination: { limit: number; offset: number; total: number; hasMore: boolean } } {
  const total = items.length
  const paged = items.slice(query.offset, query.offset + query.limit)
  return {
    items: paged,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total,
      hasMore: query.offset + query.limit < total,
    },
  }
}
```

### 2.5 Frontend: useListDialogs — Dialog State Management Hook

Replaces 5+ useState blocks per List component with a single useReducer:

```typescript
// @universo/template-mui/hooks/useListDialogs.ts

type DialogType = 'create' | 'edit' | 'copy' | 'delete' | 'conflict'

interface DialogState<TEntity> {
  create: { open: boolean }
  edit: { open: boolean; item: TEntity | null }
  copy: { open: boolean; item: TEntity | null }
  delete: { open: boolean; item: TEntity | null }
  conflict: { open: boolean; data: unknown }
}

type DialogAction<TEntity> =
  | { type: 'OPEN_CREATE' }
  | { type: 'OPEN'; dialog: 'edit' | 'copy' | 'delete'; item: TEntity }
  | { type: 'OPEN_CONFLICT'; data: unknown }
  | { type: 'CLOSE'; dialog: DialogType }

function createDialogReducer<TEntity>() {
  return (state: DialogState<TEntity>, action: DialogAction<TEntity>): DialogState<TEntity> => {
    switch (action.type) {
      case 'OPEN_CREATE':
        return { ...state, create: { open: true } }
      case 'OPEN':
        return { ...state, [action.dialog]: { open: true, item: action.item } }
      case 'OPEN_CONFLICT':
        return { ...state, conflict: { open: true, data: action.data } }
      case 'CLOSE':
        return { ...state, [action.dialog]: { open: false, item: null, data: null } }
      default:
        return state
    }
  }
}

/**
 * Manages dialog open/close state for entity list pages.
 * Replaces 5 separate useState calls per component.
 * Components compose this with usePaginated() + useDebouncedSearch() from @universo/template-mui.
 */
export function useListDialogs<TEntity>() {
  const [dialogs, dispatch] = useReducer(
    createDialogReducer<TEntity>(),
    { create: { open: false }, edit: { open: false, item: null }, copy: { open: false, item: null }, delete: { open: false, item: null }, conflict: { open: false, data: null } }
  )
  return { dialogs, dispatch }
}
```

> **QA NOTE**: The original plan proposed a `useListManager` uber-hook that combined data fetching, dialogs, search, queryClient, t, and enqueueSnackbar in one hook. This violates SRP. Instead, components should compose existing hooks:
> ```typescript
> // In CatalogList.tsx — composing focused hooks:
> const { dialogs, dispatch } = useListDialogs<CatalogDisplay>()
> const pagination = usePaginated<CatalogDisplay>({...})     // from @universo/template-mui
> const { searchValue, onSearchChange } = useDebouncedSearch() // from @universo/template-mui
> ```
### 2.6 Frontend: useHubScopedList — Hub-Scoped Data Abstraction

Replaces the hub-scoped vs. global branching repeated in all 5+ List components:

```typescript
// @universo/template-mui/hooks/useHubScopedList.ts

interface HubScopedListConfig<T> {
  metahubId: string | undefined
  hubId: string | undefined
  /** Query key builder for hub-scoped mode */
  hubScopedKeyFn: (metahubId: string, hubId: string, params: PaginationParams) => readonly unknown[]
  /** Query key builder for global (all-hubs) mode */
  globalKeyFn: (metahubId: string, params: PaginationParams) => readonly unknown[]
  /** API call for hub-scoped mode */
  hubScopedFetchFn: (metahubId: string, hubId: string, params: PaginationParams) => Promise<PaginatedResponse<T>>
  /** API call for global mode */
  globalFetchFn: (metahubId: string, params: PaginationParams) => Promise<PaginatedResponse<T>>
}

export function useHubScopedList<T extends { id: string }>(config: HubScopedListConfig<T>) {
  const isHubScoped = Boolean(config.hubId)

  const paginationResult = usePaginated<T>({
    queryKeyFn: (params) =>
      isHubScoped && config.hubId
        ? config.hubScopedKeyFn(config.metahubId!, config.hubId, params)
        : config.globalKeyFn(config.metahubId!, params),
    queryFn: (params) =>
      isHubScoped && config.hubId
        ? config.hubScopedFetchFn(config.metahubId!, config.hubId, params)
        : config.globalFetchFn(config.metahubId!, params),
    enabled: Boolean(config.metahubId),
  })

  return { ...paginationResult, isHubScoped }
}
```

### 2.7 Frontend: Domain Error Handler Factory + Simple Mutation Factory

> **QA NOTE**: The original plan proposed a generic `useEntityMutation` that replaces all mutation hooks. Investigation of real mutation code shows this is too simplified — real mutations use `generateOptimisticId()`, `applyOptimisticCreate()`, `confirmOptimisticCreate()` with `serverEntity`, and 6+ domain-specific error codes per mutation with i18n-translated messages. A generic factory cannot cover this without becoming as complex as the mutations themselves.
>
> **Instead**: Create two smaller utilities:

#### 2.7a: Domain Error Handler Factory (high impact)

Replaces the repetitive `if (errorCode === 'X') { enqueueSnackbar(...) }` chains found in all mutation `onError` callbacks:

```typescript
// metahubs-frontend/domains/shared/createDomainErrorHandler.ts

type ErrorCodeHandler = (data: Record<string, unknown>, t: TFunction) => string

/**
 * Creates a domain error handler that maps backend error codes
 * to i18n-translated snackbar messages.
 * Eliminates repetitive if/else chains in mutation onError callbacks.
 */
export function createDomainErrorHandler(
  errorCodeMap: Record<string, ErrorCodeHandler>,
  namespace: string = 'metahubs'
) {
  return (error: Error & { response?: { data?: { code?: string; message?: string; error?: string } } }, t: TFunction, enqueueSnackbar: EnqueueSnackbar, fallbackMessage: string) => {
    const errorCode = error?.response?.data?.code
    const responseData = error?.response?.data ?? {}

    if (errorCode && errorCodeMap[errorCode]) {
      enqueueSnackbar(errorCodeMap[errorCode](responseData, t), { variant: 'warning' })
      return
    }

    const backendMessage = responseData.message || responseData.error
    enqueueSnackbar(backendMessage || error.message || t(fallbackMessage), { variant: 'error' })
  }
}

// Usage in attributes mutations:
const handleAttributeError = createDomainErrorHandler({
  'ATTRIBUTE_LIMIT_REACHED': (data, t) => t('attributes.limitReached', { limit: data.limit ?? '—' }),
  'TABLE_CHILD_LIMIT_REACHED': (data, t) => t('attributes.tableValidation.maxChildAttributes', { max: data.maxChildAttributes ?? '—' }),
  'TABLE_ATTRIBUTE_LIMIT_REACHED': (data, t) => t('attributes.tableValidation.maxTableAttributes', { max: data.maxTableAttributes ?? '—' }),
  'TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN': (_data, t) => t('attributes.tableValidation.tableCannotBeDisplay'),
  'NESTED_TABLE_FORBIDDEN': (_data, t) => t('attributes.tableValidation.nestedTableNotAllowed'),
})

// In mutation hooks:
onError: (error, _vars, context) => {
  rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
  handleAttributeError(error, t, enqueueSnackbar, 'attributes.createError')
}
```

#### 2.7b: Simple Mutation Factory (for delete + reorder)

For mutations that follow a simple pattern (no optimistic entity, standard error handling):

```typescript
// metahubs-frontend/domains/shared/useSimpleMutation.ts

interface SimpleDeleteMutationConfig<TParams> {
  mutationKey: readonly unknown[]
  deleteFn: (params: TParams) => Promise<void>
  getQueryKeyPrefix: (params: TParams) => readonly unknown[]
  getInvalidateKeys: (params: TParams) => readonly QueryKey[]
  successMessage: string
  namespace: string
}

export function useSimpleDeleteMutation<TParams extends { [key: string]: string }>(
  config: SimpleDeleteMutationConfig<TParams>
) {
  const queryClient = useQueryClient()
  const { enqueueSnackbar } = useSnackbar()
  const { t } = useTranslation(config.namespace)

  return useMutation({
    mutationKey: config.mutationKey,
    mutationFn: config.deleteFn,
    onMutate: async (vars) => applyOptimisticDelete({
      queryClient,
      queryKeyPrefix: config.getQueryKeyPrefix(vars),
      entityId: vars.attributeId || vars.catalogId || vars.hubId,  // entity-specific
    }),
    onSuccess: () => enqueueSnackbar(t(config.successMessage), { variant: 'success' }),
    onError: (_err, _vars, ctx) => rollbackOptimisticSnapshots(queryClient, ctx?.previousSnapshots),
    onSettled: (_d, _e, vars) => config.getInvalidateKeys(vars).forEach(k => queryClient.invalidateQueries({ queryKey: k })),
  })
}
```

### 2.8 Frontend: Display Converter Base Utility

> **QA NOTE**: Renamed from `mapEntityToDisplay()` to `mapBaseVlcFields()`. Investigation shows that 5 of 12 `toXxxDisplay()` functions have entity-specific logic (nested hub mapping, codename repair via `ensureEntityCodenameContent()`, fallback chains). The utility covers the common subset; domain-specific converters remain but use it internally.

Replace the common VLC extraction logic (used in ~7 converters) with a shared base utility:

```typescript
// @universo/utils/vlc/mapBaseVlcFields.ts
import { getVLCString, getLocalizedContentText } from './getters'
import type { VersionedLocalizedContent } from '@universo/types'

interface VlcMappableEntity {
  codename?: VersionedLocalizedContent<string> | string | null
  name?: VersionedLocalizedContent<string> | null
  description?: VersionedLocalizedContent<string> | null
}

/**
 * Extracts VLC strings for the standard codename/name/description triple.
 * Use as a building block inside domain-specific toXxxDisplay() functions.
 * Does NOT replace functions with entity-specific logic (nested mapping, codename repair).
 */
export function mapBaseVlcFields<T extends VlcMappableEntity>(
  entity: T,
  locale: string = 'en'
): T & { codename: string; name: string; description: string } {
  return {
    ...entity,
    codename:
      typeof entity.codename === 'string'
        ? entity.codename
        : entity.codename
          ? getLocalizedContentText(entity.codename, locale, '')
          : '',
    name: entity.name ? getVLCString(entity.name, locale) ?? '' : '',
    description: entity.description ? getVLCString(entity.description, locale) ?? '' : '',
  }
}

// Usage in domain converters:
// Simple case (full replacement):
export const toMetahubDisplay = (m: Metahub, locale = 'en') => mapBaseVlcFields(m, locale)

// Complex case (as building block):
export function toCatalogDisplay(catalog: Catalog, locale = 'en'): CatalogDisplay {
  const base = mapBaseVlcFields(catalog, locale)
  return {
    ...base,
    name: base.name || base.codename,  // ← fallback logic preserved
    hubs: catalog.hubs?.map(hub => ({   // ← nested mapping preserved
      id: hub.id,
      name: getVLCString(hub.name, locale) || hub.codename,
      codename: hub.codename
    }))
  }
}
```

---

## 3. Phased Implementation Plan

### Phase 1: Foundation — Shared Backend Abstractions (non-breaking)

**Goal**: Create shared utilities without changing any existing route files. All new code, zero risk.

> **QA NOTE**: `domains/shared/domainErrors.ts` already exists with `MetahubDomainError` hierarchy (payload-based constructor). `domains/shared/queryParams.ts` already exists with `ListQuerySchema` + `validateListQuery()`. These must be EXTENDED, not recreated.

- [ ] **1.1** EXTEND existing `domains/shared/domainErrors.ts` — add subclasses to existing `MetahubDomainError`: `NotFoundError`, `ConflictError`, `LimitReachedError`, `SchemaSyncError`, `ValidationError`. Must use existing payload-based `MetahubDomainErrorPayload` constructor pattern, not positional args.
  - Extend `MetahubErrorCode` type union with new codes
  - Unit tests: `domainErrors.test.ts` (extend existing tests)

- [ ] **1.2** Extract `asyncHandler` into `domains/shared/asyncHandler.ts` — currently copy-pasted **19 times** across 16 metahubs-backend + 3 applications-backend route files (identical 5-line function)
  - Unit tests: `asyncHandler.test.ts` (promise rejection forwarding)
  - > This is NOT mentioned in the original plan but is the most straightforward deduplication win

- [ ] **1.3** Extract `createMetahubServices(req)` into `domains/shared/services.ts` — currently copy-pasted in every route file (~8 lines × 13 files). Returns `{ exec, attributesService, objectsService, enumerationValuesService, constantsService, schemaService, settingsService }`.
  - This is a PREREQUISITE for the handler factory (1.4)

- [ ] **1.4** Create `domains/shared/createMetahubHandler.ts` — generic handler factory combining auth check + service init + error delegation. Must use `createEnsureMetahubRouteAccess(getDbExecutor)` from existing guards.ts. Should NOT duplicate error handling already provided by `asyncHandler` — instead throw typed `MetahubDomainError` subclasses and let Express error middleware handle them.
  - Unit tests: `createMetahubHandler.test.ts` (auth failure, success delegation)

- [ ] **1.5** Add `paginateItems<T>()` helper to existing `domains/shared/queryParams.ts` (or separate `paginationHelpers.ts`) — in-memory pagination utility. Do NOT recreate `ListQuerySchema` or `validateListQuery()` — they already exist in queryParams.ts with correct `z.preprocess()` for booleans.
  - Unit tests: `paginateItems.test.ts` (edge cases, sorting)

- [ ] **1.6** Consolidate error type guards into `domains/shared/errorGuards.ts`
  - Move `isTableChildLimitReachedError`, `isSystemAttributeGuardError`, `isReservedSystemCodenameError`, `isSchemaSyncFailure`, `respondSchemaSyncFailure`, `syncMetahubSchemaOrThrow` (currently duplicated across multiple route files)
  - Unit tests: `errorGuards.test.ts`

- [ ] **1.7** Extend `domains/shared/index.ts` exports
  - Validate build: `pnpm build --filter metahubs-backend`

### Phase 2: Foundation — Shared Frontend Abstractions (non-breaking)

**Goal**: Create shared hooks and utilities without changing existing components.

> **QA NOTE**: Do NOT create a monolithic `useListManager` hook — it violates SRP. Instead create 2 focused hooks: `useListDialogs` and `useHubScopedList`. Components will compose `usePaginated()` + `useListDialogs()` + `useDebouncedSearch()` themselves.
> **QA NOTE**: `useEntityMutation` factory is too simplified for real mutation hooks that have domain-specific error code handling (6+ error codes per domain), complex `applyOptimisticCreate/confirmOptimisticCreate` flows with `generateOptimisticId`. Keep factory only for simple mutations (delete, reorder). Instead create a shared error handler factory (`createDomainErrorHandler`).

- [ ] **2.1** Create `useListDialogs<T>()` hook in `@universo/template-mui` — useReducer-based dialog state management for create/edit/copy/delete/conflict dialogs (replaces 5+ useState per List component)
  - Unit tests: `useListDialogs.test.ts` (open/close, state transitions)

- [ ] **2.2** Create `useHubScopedList<T>()` hook in `@universo/template-mui` — hub-scoped vs. global list abstraction, composing existing `usePaginated()` hook
  - Unit tests: `useHubScopedList.test.ts` (hub mode, global mode, disabled state)

- [ ] **2.3** Create `createDomainErrorHandler()` factory in metahubs-frontend `domains/shared` — maps backend error codes to i18n-translated snackbar messages. Replaces repetitive per-mutation error `if/else` chains.
  - Example: `handleAttributeError = createDomainErrorHandler({ 'ATTRIBUTE_LIMIT_REACHED': (data, t) => t('attributes.limitReached', { limit: data.limit }) })`
  - Unit tests: `createDomainErrorHandler.test.ts`

- [ ] **2.3b** Create `useSimpleMutation()` factory in metahubs-frontend `domains/shared` for basic mutations (delete, reorder) that follow a standard pattern. Complex mutations (create, update with optimistic + error mapping) should keep `useMutation()` directly.
  - Unit tests: `useSimpleMutation.test.ts`

- [ ] **2.4** Move `fetchAllPaginatedItems()` from `metahubs-frontend/domains/shared` to `@universo/utils/api`
  - Add re-export alias in metahubs-frontend for backwards compatibility
  - Unit tests: `fetchAllPaginatedItems.test.ts`

- [ ] **2.5** Move `optimisticReorder()` from `metahubs-frontend/domains/shared` to `@universo/template-mui/hooks`
  - Add re-export alias for backwards compatibility
  - Unit tests: `optimisticReorder.test.ts`

- [ ] **2.6** Create `mapBaseVlcFields()` in `@universo/utils/vlc`
  - Use as building block inside domain-specific `toXxxDisplay()` converters (see section 2.8)
  - Unit tests: `mapBaseVlcFields.test.ts`

- [ ] **2.7** Validate build: `pnpm build`

### Phase 3: Backend Refactoring — metahubs-backend routes

**Goal**: Split monolithic route files into controller + service layers, one domain at a time.

**Order**: Start with smallest files (less risk), progress to largest.

- [ ] **3.1** Refactor `constantsRoutes.ts` (1,027 lines → ~200 lines routes + ~300 lines controller + existing service)
  - Create `constantsController.ts`
  - Migrate all handlers to use `createMetahubHandler()`
  - Replace inline pagination with `parseListQuery()` + `paginateItems()`
  - Replace inline error handling with `DomainError` throws
  - Integration tests: `constantsRoutes.integration.test.ts`
  - Validate: `pnpm build --filter metahubs-backend` + existing tests pass

- [ ] **3.2** Refactor `setsRoutes.ts` (1,119 lines) — same pattern as 3.1
  - Create `setsController.ts`
  - Integration tests: `setsRoutes.integration.test.ts`

- [ ] **3.3** Refactor `hubsRoutes.ts` (1,276 lines)
  - Create `hubsController.ts`
  - Integration tests: `hubsRoutes.integration.test.ts`

- [ ] **3.4** Refactor `layoutsRoutes.ts` (760 lines)
  - Create `layoutsController.ts`
  - Integration tests

- [ ] **3.5** Refactor `branchesRoutes.ts` (671 lines)
  - Create `branchesController.ts`
  - Integration tests

- [ ] **3.6** Refactor `elementsRoutes.ts` (443 lines)
  - Create `elementsController.ts`
  - Integration tests

- [ ] **3.7** Refactor `metahubsRoutes.ts` (1,640 lines)
  - Create `metahubsController.ts`
  - Extract member management into `metahubMembersController.ts` if needed
  - Integration tests

- [ ] **3.8** Refactor `publicationsRoutes.ts` (1,754 lines)
  - Create `publicationsController.ts`
  - Move application sync logic preparation to service layer
  - Integration tests

- [ ] **3.9** Refactor `catalogsRoutes.ts` (1,959 lines)
  - Create `catalogsController.ts`
  - Move copy with hub associations to `CatalogsService`
  - Move element operations to `CatalogElementsService`
  - Integration tests

- [ ] **3.10** Refactor `enumerationsRoutes.ts` (2,248 lines)
  - Create `enumerationsController.ts`
  - Separate value-level operations into `enumerationValuesController.ts`
  - Integration tests

- [ ] **3.11** Refactor `attributesRoutes.ts` (2,291 lines)
  - Create `attributesController.ts`
  - Move codename locking, copy retry, global-scope logic to `AttributesCopyService`
  - Integration tests

- [ ] **3.12** Refactor `metahubMigrationsRoutes.ts` (951 lines)
  - Create `migrationsController.ts`
  - Integration tests

- [ ] **3.13** Full validation: `pnpm build` + all metahubs-backend tests pass

### Phase 4: Backend Refactoring — applications-backend routes

**Goal**: Split the two largest files in the project.

> **QA NOTE**: applications-backend has a DIFFERENT architecture from metahubs-backend:
> - Auth: uses `ensureApplicationAccess()` (returns `ApplicationMembershipContext`), not `ensureMetahubRouteAccess` (which returns `string | null`)
> - No `services(req)` factory — uses direct store function imports + `getRequestDbExecutor(req, getDbExecutor())`
> - NO existing service classes — all logic inline in routes
> - Must create a SEPARATE `createApplicationHandler()` factory, not reuse `createMetahubHandler()`
>
> **QA CORRECTION (Transactions)**: applicationsRoutes.ts uses MIXED patterns — only 3 instances of manual `BEGIN/COMMIT/ROLLBACK` (lines ~3550, ~3839, ~3976), while 10 other transactions correctly use `.transaction()`. applicationSyncRoutes.ts already COMPLETELY uses `knex.transaction()` (6 instances, 0 manual).

- [ ] **4.0** Create `createApplicationHandler()` factory in applications-backend (analogous to `createMetahubHandler` but using applications-specific auth pattern: `ensureApplicationAccess()`, `ApplicationMembershipContext`, direct executor pattern)

- [ ] **4.1** Refactor `applicationsRoutes.ts` (5,120 lines) — the biggest file:
  - Create `applicationsController.ts` — application CRUD + member management (~400 lines)
  - Create `runtimeRowsController.ts` — runtime row CRUD, copy, soft-delete (~500 lines)
  - Create `runtimeChildRowsController.ts` — child row operations (~300 lines)
  - Create `RuntimeRowsService.ts` — extract inline copy, cascade, and schema resolution
  - **Critical**: Migrate 3 manual `BEGIN/COMMIT/ROLLBACK` instances (lines ~3550, ~3839, ~3976) to `.transaction()` — the remaining 10 transactions already use `.transaction()` correctly
  - Integration tests for each new controller
  - Target: route file ≤ 100 lines (declarations only)

- [ ] **4.2** Refactor `applicationSyncRoutes.ts` (3,726 lines):
  - Create `syncController.ts` — thin handlers
  - Extract sync logic into `ApplicationSyncService` (may already partially exist)
  - NOTE: Transaction pattern is already correct (6 `knex.transaction()` calls, 0 manual BEGIN)
  - Integration tests

- [ ] **4.3** Refactor `connectorsRoutes.ts` (618 lines):
  - Create `connectorsController.ts`
  - Integration tests

- [ ] **4.4** Full validation: `pnpm build` + all applications-backend tests pass

### Phase 5: Frontend Refactoring — metahubs-frontend List components

**Goal**: Decompose monolithic List components using new shared hooks.

**Order**: Start with simplest component, validate pattern, then apply to rest.

- [ ] **5.1** Refactor `ConstantList.tsx` (1,239 lines) as pilot:
  - Extract data fetching to `useConstantListData()` hook
  - Use `useListDialogs()` (replaces 5 useState blocks)
  - Use `useHubScopedList()` (replaces hub branching)
  - Target: component ≤ 400 lines, hook ≤ 200 lines
  - Unit tests for new hooks

- [ ] **5.2** Refactor `SetList.tsx` (1,698 lines) — same pattern
- [ ] **5.3** Refactor `HubList.tsx` (1,444 lines)
- [ ] **5.4** Refactor `CatalogList.tsx` (1,715 lines)
- [ ] **5.5** Refactor `EnumerationList.tsx` (1,724 lines)
  - Also refactor `EnumerationValueList.tsx` (1,186 lines)
- [ ] **5.6** Refactor `AttributeList.tsx` (1,868 lines)
  - Also refactor `ChildAttributeList.tsx` (1,435 lines) and `AttributeActions.tsx` (836 lines)
- [ ] **5.7** Refactor `ElementList.tsx` (2,246 lines) — the most complex:
  - Extract `useElementListData()` — queries for attributes, child attributes, enum values
  - Extract `ElementInlineEditor` sub-component (~400 lines)
  - Extract `ElementFormDialogs` sub-component (~400 lines)
  - Target: main component ≤ 500 lines

- [ ] **5.8** Refactor `MetahubList.tsx` (1,001 lines)
- [ ] **5.9** Refactor `PublicationList.tsx` (1,136 lines) + `PublicationVersionList.tsx` (735 lines)
- [ ] **5.10** Refactor `BranchList.tsx` (1,053 lines) + BranchActions.tsx (682 lines)

- [ ] **5.11** Full validation: `pnpm build` + all frontend tests pass

### Phase 6: Frontend Refactoring — Mutation Hooks Consolidation

> **QA NOTE**: Complex mutations (attributes, catalogs) have entity-specific optimistic update logic, 6+ domain error codes, and scoped invalidation trees. These MUST keep direct `useMutation()` calls — only extract shared error handling via `createDomainErrorHandler()`. Simple mutations (delete, reorder, toggle) can use `useSimpleDeleteMutation()` / `useSimpleToggleMutation()` factories.

- [ ] **6.1** Refactor `metahubs-frontend/domains/attributes/hooks/mutations.ts` (1,142 lines)
  - Extract shared error handling via `createDomainErrorHandler()`
  - Keep domain-specific optimistic update and invalidation logic in direct `useMutation()` calls
  - Use `useSimpleDeleteMutation()` for `useDeleteAttribute`, `useDeleteEnumValue`, etc.
  - Target: ≤ 500 lines (conservative — complex optimistic logic stays)

- [ ] **6.2** Refactor `metahubs-frontend/domains/enumerations/hooks/mutations.ts` (816 lines)
  - Same approach: `createDomainErrorHandler()` + `useSimpleDeleteMutation()` for simple ops
  - Target: ≤ 350 lines

- [ ] **6.3** Refactor `applications-frontend/hooks/mutations.ts` (861 lines)
  - Target: ≤ 350 lines

- [ ] **6.4** Consolidate `metahubs-frontend/types.ts` (840 lines)
  - Use `mapBaseVlcFields()` from `@universo/utils/vlc` as building block in domain converters
  - Keep entity-specific converters (toCatalogDisplay, toAttributeDisplay) with their custom logic
  - Target: ≤ 500 lines

- [ ] **6.5** Full validation: `pnpm build`

### Phase 7: Performance Improvements

- [ ] **7.1** Add batch endpoint for child attributes in metahubs-backend
  - `GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId/attributes/children/batch?parentIds=id1,id2,...`
  - Eliminates N+1 query pattern in ElementList
  - Tests: route + store tests

- [ ] **7.2** Lift hub list fetch to shared context/hook
  - Create `useMetahubHubs()` that caches across List components
  - Reduces redundant API calls

- [ ] **7.3** Review and optimize store queries
  - Verify all critical queries use appropriate indexes
  - Add `EXPLAIN ANALYZE` tests for top-10 queries if possible

### Phase 8: Testing

- [ ] **8.1** Backend unit tests for all new/extended abstractions:
  - `domains/shared/domainErrors.test.ts` (extend existing tests for new subclasses)
  - `domains/shared/createMetahubHandler.test.ts`
  - `domains/shared/createApplicationHandler.test.ts`
  - `domains/shared/paginateItems.test.ts`
  - `domains/shared/asyncHandler.test.ts`
  - `domains/shared/createServices.test.ts`

- [ ] **8.2** Backend integration tests for each refactored route file:
  - Test every HTTP endpoint with valid/invalid payloads
  - Test auth failure scenarios
  - Test pagination edge cases
  - Test concurrent operations (advisory lock paths)
  - Test transaction rollback scenarios

- [ ] **8.3** Frontend unit tests for all new hooks:
  - `useListDialogs.test.ts`
  - `useHubScopedList.test.ts`
  - `createDomainErrorHandler.test.ts`
  - `useSimpleDeleteMutation.test.ts`
  - `mapBaseVlcFields.test.ts`
  - `fetchAllPaginatedItems.test.ts`
  - `optimisticReorder.test.ts`

- [ ] **8.4** Frontend component tests for refactored List components:
  - Verify rendering, dialog interactions, mutation triggering
  - Verify correct query invalidation after mutations
  - Verify error display

- [ ] **8.5** Full regression: `pnpm build` (28/28 green) + all existing tests pass + new tests pass

### Phase 9: Documentation

- [ ] **9.1** Update `packages/metahubs-backend/base/README.md`:
  - Document controller–service–store architecture
  - Document `createMetahubHandler()` usage pattern
  - Document domain error hierarchy
  - Document pagination utility

- [ ] **9.2** Update `packages/metahubs-frontend/base/README.md`:
  - Document shared hooks (`useListDialogs`, `useHubScopedList`, `createDomainErrorHandler`)
  - Document component decomposition pattern
  - Document `mapBaseVlcFields()` usage in domain converters
  
- [ ] **9.3** Update `packages/applications-backend/base/README.md`:
  - Document runtime row controller structure
  - Document transaction patterns

- [ ] **9.4** Update `packages/applications-frontend/base/README.md`

- [ ] **9.5** Update `packages/universo-template-mui/base/README.md`:
  - Document new shared hooks

- [ ] **9.6** Update `docs/en/architecture/` and `docs/ru/architecture/` (GitBook format):
  - Add page: "Backend Controller–Service–Store Pattern"
  - Add page: "Frontend List Component Architecture"
  - Add page: "Shared Hooks Reference"
  - Update existing architecture overview with new patterns

- [ ] **9.7** Update `docs/en/api-reference/` and `docs/ru/api-reference/` if any API changes

- [ ] **9.8** Update REST API docs (`@universo/rest-docs`) if endpoints change

- [ ] **9.9** Update Memory Bank files:
  - `systemPatterns.md` — add Controller–Service–Store pattern, List Component pattern
  - `techContext.md` — update with new shared utilities
  - `progress.md` — log refactoring completion
  - `activeContext.md` — update focus

---

## 4. Potential Challenges & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking API contracts during route splitting | Medium | High | Integration tests before + after each refactor; no URL/body changes |
| Regression in optimistic updates | Medium | Medium | Keep existing optimistic helpers; new factory wraps them |
| Test mock breakage | High | Low | Update mocks incrementally per phase; QA Phase 2 already updated 7 mocks |
| Build failures from cross-package moves | Medium | Medium | Use re-export aliases during transition; remove after full migration |
| Scope creep into feature work | Low | Medium | Strict scope: refactor only, no new features |
| Large PR size | Medium | Medium | One PR per phase, each independently reviewable and mergeable |

## 5. Dependencies & Constraints

- **No backend API contract changes** — all refactoring is internal; HTTP paths, request/response shapes unchanged
- **pnpm workspace** — all package moves must respect workspace:* protocol
- **Existing tests** must continue to pass at every phase boundary
- **28/28 build** must remain green at every phase boundary
- **UUID v7** — continue using for new IDs (uuidv7 from `@universo/utils`)
- **i18n** — all new user-facing strings must use i18n keys in both `en` and `ru`
- **@universo/template-mui** — new hooks go here (or `domains/shared` if metahubs-specific)
- **@universo/types** and `@universo/utils` — shared types and utilities go here

## 6. Recommended Execution Order

1. **Phase 1 + Phase 2** — Foundation (parallel, independent)
2. **Phase 3** — Backend metahubs routes (sequential by domain)
3. **Phase 4** — Backend applications routes
4. **Phase 5 + Phase 6** — Frontend refactoring (can overlap)
5. **Phase 7** — Performance (after main refactoring)
6. **Phase 8** — Testing (ongoing, but final validation here)
7. **Phase 9** — Documentation (after code stabilizes)

**Critical path**: Phase 1 → Phase 3 → Phase 4 (backend must be refactored before frontend to ensure hooks map cleanly to service boundaries)

---

## 7. Success Criteria

- [ ] No backend route file > 500 lines
- [ ] No frontend component file > 600 lines
- [ ] All manual `BEGIN/COMMIT/ROLLBACK` replaced with `executor.transaction()`
- [ ] Single unified error response format across all metahub/application routes
- [ ] 0 duplicated CRUD boilerplate patterns
- [ ] N+1 child attribute queries eliminated
- [ ] All new code has unit tests
- [ ] All refactored routes have integration tests
- [ ] 28/28 build, all existing + new tests pass
- [ ] README + GitBook docs updated
- [ ] Memory Bank updated with new patterns
