# Plan: Remove 10 Legacy Packages (Campaigns, Clusters, Organizations, Projects, Storages)

**Date**: 2026-03-01
**Complexity**: Level 4 (multi-layer cross-cutting change)
**Status**: DRAFT — awaiting approval

---

## Overview

Remove 10 legacy packages completely (5 backend + 5 frontend):
- `campaigns-backend`, `campaigns-frontend`
- `clusters-backend`, `clusters-frontend`
- `organizations-backend`, `organizations-frontend`
- `projects-backend`, `projects-frontend`
- `storages-backend`, `storages-frontend`

All cross-references in routes, entities, migrations, menus, breadcrumbs, hooks, permissions, i18n, package.json dependencies, validation schemas, README docs, and GitBook docs must be cleaned up.

**Critical safety note**: The test database will be deleted and recreated — no migration reversal needed for DB tables. We only need to remove migration *registrations* from the code to prevent TypeORM from trying to create those tables.

---

## Affected Areas

### Backend (flowise-core-backend)
| File | What to remove |
|------|---------------|
| `src/routes/index.ts` (L42-46) | 5 imports + 5 lazy router blocks (~80 lines) |
| `src/index.ts` (L32-36, L342-354) | 5 rate limiter imports + 5 `await` calls |
| `src/database/entities/index.ts` (L17-21, L36-43, L67-74) | 5 entity imports + 5 Object.fromEntries + 5 spreads |
| `src/database/migrations/postgres/index.ts` (L40-44, L93-97) | 5 migration imports + 5 spreads |
| `package.json` (L79, L93, L95) | 3 explicit deps (clusters, organizations, projects) |

### Frontend — universo-template-mui
| File | What to remove |
|------|---------------|
| `src/routes/MainRoutesMUI.tsx` (L8-12) | 5 i18n imports |
| `src/routes/MainRoutesMUI.tsx` (L167-230) | ~30 Loadable lazy imports for 5 modules |
| `src/routes/MainRoutesMUI.tsx` (L665-855) | ~190 lines of route definitions |
| `src/navigation/menuConfigs.ts` (L260-415) | 5 context menu functions + 5 rootMenuItems entries |
| `src/components/dashboard/MenuContent.tsx` (L66-83, L100-110) | 5 URL matchers + 5 conditional branches |
| `src/components/dashboard/NavbarBreadcrumbs.tsx` (L16-26, L82-105, L196-200, L548-750) | imports, hooks, menuMap entries, breadcrumb builders |
| `src/hooks/useBreadcrumbName.ts` (L205-253) | 5 hook definitions (useClusterName, etc.) + 5 truncate functions |
| `src/hooks/index.ts` (L20-25, L38-42) | 10 re-exports (5 hooks + 5 truncate functions) |

### Frontend — flowise-core-frontend
| File | What to remove |
|------|---------------|
| `src/index.jsx` (L28-29) | 2 i18n imports (organizations, storages) |
| `package.json` (L40, L44) | 2 deps (organizations-frontend, storages-frontend) |
| `vite.config.js` (L67) | 1 optimizeDeps entry (organizations-frontend) |

### Shared Types — universo-types
| File | What to remove |
|------|---------------|
| `src/common/admin.ts` (L249-266, L280-286) | 5 PermissionSubject union members + 5 PERMISSION_SUBJECTS entries |
| `src/index.ts` (L19-22) | 4 re-exports (clusters, projects, organizations, storages) |
| `src/validation/clusters.ts` | Entire file |
| `src/validation/projects.ts` | Entire file |
| `src/validation/organizations.ts` | Entire file |
| `src/validation/storages.ts` | Entire file |

### Admin — permissions
| File | What to remove |
|------|---------------|
| `admin-backend/src/schemas/index.ts` (L70-76) | 5 entries from PermissionSubjects array |
| `admin-frontend/src/i18n/en/admin.json` (L218-223) | 5 subject translations EN |
| `admin-frontend/src/i18n/ru/admin.json` (same lines) | 5 subject translations RU |

### Documentation
| File | Action |
|------|--------|
| `packages/README.md` | Remove 10 packages from listing, update counts |
| `packages/README-RU.md` | Same for Russian README |
| `docs/en/` | Replace with GitBook stub pages |
| `docs/ru/` | Replace with GitBook stub pages |

---

## Plan Steps (Execution Order)

### Phase 1: @universo/types Cleanup (Foundation — must be first!)

Other packages import from `@universo/types`, so removing types first prevents build cascade issues.

- [ ] **Step 1.1**: Remove validation schema files

  Delete these 4 files entirely:
  - `packages/universo-types/base/src/validation/clusters.ts`
  - `packages/universo-types/base/src/validation/projects.ts`
  - `packages/universo-types/base/src/validation/organizations.ts`
  - `packages/universo-types/base/src/validation/storages.ts`

  Note: there is no `campaigns.ts` in validation/ — campaigns schemas are only in the backend package.

- [ ] **Step 1.2**: Remove re-exports from `universo-types/base/src/index.ts`

  **REMOVE** (lines 19-22):
  ```typescript
  // REMOVE these 4 lines:
  export * from './validation/clusters'
  export * from './validation/projects'
  export * from './validation/organizations'
  export * from './validation/storages'
  ```

- [ ] **Step 1.3**: Clean up PermissionSubject type and PERMISSION_SUBJECTS array

  File: `packages/universo-types/base/src/common/admin.ts`

  **Before** (lines 248-287):
  ```typescript
  export type PermissionSubject =
      | 'metaverses'
      | 'clusters'
      | 'projects'
      | 'spaces'
      | 'storages'
      | 'organizations'
      | 'campaigns'
      | 'uniks'
      | 'sections'
      | 'entities'
      | 'canvases'
      | 'publications'
      | 'roles'
      | 'instances'
      | 'users'
      | '*'

  export const PERMISSION_SUBJECTS: PermissionSubject[] = [
      'metaverses',
      'clusters',
      'projects',
      'spaces',
      'storages',
      'organizations',
      'campaigns',
      'uniks',
      'sections',
      'entities',
      'canvases',
      'publications',
      'roles',
      'instances',
      'users'
  ]
  ```

  **After**:
  ```typescript
  export type PermissionSubject =
      | 'metaverses'
      | 'spaces'
      | 'uniks'
      | 'sections'
      | 'entities'
      | 'canvases'
      | 'publications'
      | 'roles'
      | 'instances'
      | 'users'
      | '*'

  export const PERMISSION_SUBJECTS: PermissionSubject[] = [
      'metaverses',
      'spaces',
      'uniks',
      'sections',
      'entities',
      'canvases',
      'publications',
      'roles',
      'instances',
      'users'
  ]
  ```

---

### Phase 2: Backend Cleanup (flowise-core-backend)

- [ ] **Step 2.1**: Remove imports from `routes/index.ts` (lines 42-46)

  **REMOVE**:
  ```typescript
  import { initializeRateLimiters as initializeClustersRateLimiters, createClustersServiceRoutes } from '@universo/clusters-backend'
  import { initializeRateLimiters as initializeProjectsRateLimiters, createProjectsServiceRoutes } from '@universo/projects-backend'
  import { createCampaignsServiceRoutes } from '@universo/campaigns-backend'
  import { createOrganizationsServiceRoutes } from '@universo/organizations-backend'
  import { createStoragesServiceRoutes } from '@universo/storages-backend'
  ```

- [ ] **Step 2.2**: Remove 5 lazy router blocks from `routes/index.ts` (lines 403-513)

  Remove each block of form:
  ```typescript
  // Universo Platformo | Clusters, Domains, Resources
  // Note: Rate limiters initialized via initializeClustersRateLimiters() in server startup
  // This mounts: /clusters, /domains, /resources
  // Lazy initialization: router created on first request (after initializeClustersRateLimiters called)
  let clustersRouter: ExpressRouter | null = null
  router.use((req: Request, res: Response, next: NextFunction) => {
      if (!clustersRouter) {
          clustersRouter = createClustersServiceRoutes(ensureAuthWithRls, () => getDataSource())
      }
      if (clustersRouter) {
          clustersRouter(req, res, next)
      } else {
          next()
      }
  })
  ```

  Repeat for: `projectsRouter`, `campaignsRouter`, `organizationsRouter`, `storagesRouter`.

- [ ] **Step 2.3**: Remove rate limiter imports from `index.ts` (lines 32-36)

  **REMOVE**:
  ```typescript
  import { initializeRateLimiters as initializeClustersRateLimiters } from '@universo/clusters-backend'
  import { initializeRateLimiters as initializeProjectsRateLimiters } from '@universo/projects-backend'
  import { initializeRateLimiters as initializeCampaignsRateLimiters } from '@universo/campaigns-backend'
  import { initializeRateLimiters as initializeOrganizationsRateLimiters } from '@universo/organizations-backend'
  import { initializeRateLimiters as initializeStoragesRateLimiters } from '@universo/storages-backend'
  ```

- [ ] **Step 2.4**: Remove rate limiter calls from `index.ts` (lines 342-354)

  **REMOVE**:
  ```typescript
  // Initialize rate limiters for clusters service
  await initializeClustersRateLimiters()

  // Initialize rate limiters for projects service
  await initializeProjectsRateLimiters()

  // Initialize rate limiters for campaigns service
  await initializeCampaignsRateLimiters()

  // Initialize rate limiters for organizations service
  await initializeOrganizationsRateLimiters()

  // Initialize rate limiters for storages service
  await initializeStoragesRateLimiters()
  ```

- [ ] **Step 2.5**: Remove entities from `database/entities/index.ts`

  **REMOVE imports** (lines 17-21):
  ```typescript
  import { clustersEntities } from '@universo/clusters-backend'
  import { projectsEntities } from '@universo/projects-backend'
  import { campaignsEntities } from '@universo/campaigns-backend'
  import { organizationsEntities } from '@universo/organizations-backend'
  import { storagesEntities } from '@universo/storages-backend'
  ```

  **REMOVE Object.fromEntries** (lines 36-43):
  ```typescript
  const clustersEntitiesObject = Object.fromEntries(clustersEntities.map((entity) => [entity.name, entity]))
  const projectsEntitiesObject = Object.fromEntries(projectsEntities.map((entity) => [entity.name, entity]))
  const campaignsEntitiesObject = Object.fromEntries(campaignsEntities.map((entity) => [entity.name, entity]))
  const organizationsEntitiesObject = Object.fromEntries(organizationsEntities.map((entity) => [entity.name, entity]))
  const storagesEntitiesObject = Object.fromEntries(storagesEntities.map((entity) => [entity.name, entity]))
  ```

  **REMOVE spreads** in entities object (lines 67-74):
  ```typescript
  // Clusters service entities
  ...clustersEntitiesObject,
  // Projects service entities
  ...projectsEntitiesObject,
  // Campaigns service entities
  ...campaignsEntitiesObject,
  // Organizations service entities
  ...organizationsEntitiesObject,
  // Storages service entities
  ...storagesEntitiesObject,
  ```

- [ ] **Step 2.6**: Remove migrations from `database/migrations/postgres/index.ts`

  **REMOVE imports** (lines 40-44):
  ```typescript
  import { clustersMigrations } from '@universo/clusters-backend'
  import { projectsMigrations } from '@universo/projects-backend'
  import { campaignsMigrations } from '@universo/campaigns-backend'
  import { organizationsMigrations } from '@universo/organizations-backend'
  import { storagesMigrations } from '@universo/storages-backend'
  ```

  **REMOVE spreads** in Phase 3 (lines 93-97):
  ```typescript
  ...clustersMigrations,
  ...projectsMigrations,
  ...campaignsMigrations,
  ...organizationsMigrations,
  ...storagesMigrations,
  ```

- [ ] **Step 2.7**: Remove backend package.json dependencies

  File: `packages/flowise-core-backend/base/package.json`

  **REMOVE** 3 explicit deps:
  ```json
  "@universo/clusters-backend": "workspace:*",
  "@universo/organizations-backend": "workspace:*",
  "@universo/projects-backend": "workspace:*",
  ```

  Note: `campaigns-backend` and `storages-backend` are NOT in package.json (implicit resolution through pnpm workspace).

---

### Phase 3: Admin Permissions Cleanup

- [ ] **Step 3.1**: Clean PermissionSubjects in admin-backend schema

  File: `packages/admin-backend/base/src/schemas/index.ts`

  **Before** (lines 68-86):
  ```typescript
  const PermissionSubjects = [
      'metaverses',
      'clusters',
      'projects',
      'spaces',
      'storages',
      'organizations',
      'campaigns',
      'uniks',
      'sections',
      'entities',
      'canvases',
      'publications',
      'roles',
      'instances',
      'users',
      'admin',
      '*'
  ] as const
  ```

  **After**:
  ```typescript
  const PermissionSubjects = [
      'metaverses',
      'spaces',
      'uniks',
      'sections',
      'entities',
      'canvases',
      'publications',
      'roles',
      'instances',
      'users',
      'admin',
      '*'
  ] as const
  ```

- [ ] **Step 3.2**: Remove admin i18n subject translations

  File: `packages/admin-frontend/base/src/i18n/en/admin.json`

  **REMOVE** from `roles.permissions.subjects`:
  ```json
  "clusters": "Clusters",
  "projects": "Projects",
  "storages": "Storages",
  "organizations": "Organizations",
  "campaigns": "Campaigns",
  ```

  File: `packages/admin-frontend/base/src/i18n/ru/admin.json`

  **REMOVE** same keys with Russian translations.

---

### Phase 4: Frontend Cleanup — universo-template-mui

- [ ] **Step 4.1**: Remove i18n imports from `MainRoutesMUI.tsx` (lines 8-12)

  **REMOVE**:
  ```tsx
  import '@universo/clusters-frontend/i18n'
  import '@universo/projects-frontend/i18n'
  import '@universo/campaigns-frontend/i18n'
  import '@universo/organizations-frontend/i18n'
  import '@universo/storages-frontend/i18n'
  ```

- [ ] **Step 4.2**: Remove Loadable lazy imports from `MainRoutesMUI.tsx` (lines ~167-230)

  **REMOVE** all `const ClusterList = Loadable(...)` through `const StorageMembers = Loadable(...)` — 25 component definitions across 5 modules:
  - ClusterList, ClusterBoard, DomainList, ResourceList, ClusterMembers
  - ProjectList, ProjectBoard, MilestoneList, TaskList, ProjectMembers
  - CampaignList, CampaignBoard, EventList, ActivityList, CampaignMembers
  - OrganizationList, OrganizationBoard, DepartmentList, PositionList, OrganizationMembers
  - StorageList, StorageBoard, ContainerList, SlotList, StorageMembers

- [ ] **Step 4.3**: Remove route definitions from `MainRoutesMUI.tsx` (lines ~665-855)

  **REMOVE** all route blocks for paths:
  - `/clusters`, `/cluster/:clusterId`, `/clusters/:clusterId/*`
  - `/projects`, `/project/:projectId`, `/projects/:projectId/*`
  - `/campaigns`, `/campaign/:campaignId`, `/campaigns/:campaignId/*`
  - `/organizations`, `/organization/:organizationId`, `/organizations/:organizationId/*`
  - `/storages`, `/storage/:storageId`, `/storages/:storageId/*`

  Plus standalone routes: `/milestones`, `/tasks`, `/events`, `/activities`, `/departments`, `/positions`, `/resources`, `/domains`, `/containers`, `/slots`

- [ ] **Step 4.4**: Remove context menu functions from `menuConfigs.ts` (lines 260-415)

  **REMOVE** 5 functions:
  - `getClusterMenuItems()`
  - `getProjectMenuItems()`
  - `getOrganizationMenuItems()`
  - `getStorageMenuItems()`
  - `getCampaignMenuItems()`

  **REMOVE** 5 entries from `rootMenuItems` array:
  ```typescript
  // REMOVE these 5 entries:
  { id: 'clusters', ... },
  { id: 'projects', ... },
  { id: 'organizations', ... },
  { id: 'storages', ... },
  { id: 'campaigns', ... },
  ```

  Also remove unused icon imports: `IconFlag` (if only used by campaigns).

- [ ] **Step 4.5**: Clean `MenuContent.tsx` (lines 66-83, 100-110)

  **REMOVE** 5 URL matchers:
  ```tsx
  const clusterMatch = location.pathname.match(/^\/clusters?\/([^/]+)/)
  const clusterId = clusterMatch ? clusterMatch[1] : null
  const projectMatch = location.pathname.match(/^\/projects?\/([^/]+)/)
  const projectId = projectMatch ? projectMatch[1] : null
  const organizationMatch = location.pathname.match(/^\/organizations?\/([^/]+)/)
  const organizationId = organizationMatch ? organizationMatch[1] : null
  const storageMatch = location.pathname.match(/^\/storages?\/([^/]+)/)
  const storageId = storageMatch ? storageMatch[1] : null
  const campaignMatch = location.pathname.match(/^\/campaigns?\/([^/]+)/)
  const campaignId = campaignMatch ? campaignMatch[1] : null
  ```

  **REMOVE** 5 conditional branches in the menuItems ternary chain:
  ```tsx
  : clusterId
  ? getClusterMenuItems(clusterId)
  : projectId
  ? getProjectMenuItems(projectId)
  : organizationId
  ? getOrganizationMenuItems(organizationId)
  : storageId
  ? getStorageMenuItems(storageId)
  : campaignId
  ? getCampaignMenuItems(campaignId)
  ```

  **REMOVE** corresponding imports at top of file for the 5 menu functions.

- [ ] **Step 4.6**: Clean `NavbarBreadcrumbs.tsx`

  **REMOVE from imports** (lines 16-26):
  ```tsx
  useClusterName,
  truncateClusterName,
  useProjectName,
  truncateProjectName,
  useCampaignName,
  truncateCampaignName,
  useOrganizationName,
  truncateOrganizationName,
  useStorageName,
  truncateStorageName,
  ```

  **REMOVE** 5 URL extractors + hook calls (lines 82-105):
  ```tsx
  // Extract clusterId from URL...
  const clusterIdMatch = ...
  const clusterId = ...
  const clusterName = useClusterName(clusterId)
  // (repeat for project, campaign, organization, storage)
  ```

  **REMOVE** 5 menuMap entries (lines ~196-200):
  ```tsx
  clusters: 'clusters',
  projects: 'projects',
  campaigns: 'campaigns',
  organizations: 'organizations',
  storages: 'storages',
  ```

  **REMOVE** 10 breadcrumb builder blocks (primary === 'clusters', 'cluster', 'projects', 'project', 'campaigns', 'campaign', 'organizations', 'organization', 'storages', 'storage') — approximately 200 lines (L548-750).

- [ ] **Step 4.7**: Clean breadcrumb hooks

  File: `packages/universo-template-mui/base/src/hooks/useBreadcrumbName.ts`

  **REMOVE** 5 hook definitions (lines 205-253):
  ```typescript
  export const useOrganizationName = createEntityNameHook({ entityType: 'organization', apiPath: 'organizations' })
  export const useClusterName = createEntityNameHook({ entityType: 'cluster', apiPath: 'clusters' })
  export const useProjectName = createEntityNameHook({ entityType: 'project', apiPath: 'projects' })
  export const useCampaignName = createEntityNameHook({ entityType: 'campaign', apiPath: 'campaigns' })
  export const useStorageName = createEntityNameHook({ entityType: 'storage', apiPath: 'storages' })
  ```

  Also remove corresponding `truncateOrganizationName`, `truncateClusterName`, `truncateProjectName`, `truncateCampaignName`, `truncateStorageName` definitions (they use `createTruncateFunction`).

  File: `packages/universo-template-mui/base/src/hooks/index.ts`

  **REMOVE** 10 re-exports:
  ```typescript
  useOrganizationName,
  useClusterName,
  useProjectName,
  useCampaignName,
  useStorageName,
  truncateOrganizationName,
  truncateClusterName,
  truncateProjectName,
  truncateCampaignName,
  truncateStorageName,
  ```

- [ ] **Step 4.8**: Update test file

  File: `packages/universo-template-mui/base/src/hooks/__tests__/useBreadcrumbName.test.ts`

  Remove test cases for `useClusterName` and any other removed hooks.

---

### Phase 5: Frontend Cleanup — flowise-core-frontend

- [ ] **Step 5.1**: Remove i18n imports from `src/index.jsx` (lines 28-29)

  **REMOVE**:
  ```jsx
  import '@universo/organizations-frontend/i18n'
  import '@universo/storages-frontend/i18n'
  ```

- [ ] **Step 5.2**: Remove package.json dependencies

  File: `packages/flowise-core-frontend/base/package.json`

  **REMOVE**:
  ```json
  "@universo/organizations-frontend": "workspace:*",
  "@universo/storages-frontend": "workspace:*",
  ```

- [ ] **Step 5.3**: Remove from vite.config.js

  File: `packages/flowise-core-frontend/base/vite.config.js`

  **REMOVE** (line 67):
  ```javascript
  '@universo/organizations-frontend',
  ```

---

### Phase 6: Delete Package Directories

- [ ] **Step 6.1**: Delete all 10 package directories

  ```bash
  rm -rf packages/campaigns-backend
  rm -rf packages/campaigns-frontend
  rm -rf packages/clusters-backend
  rm -rf packages/clusters-frontend
  rm -rf packages/organizations-backend
  rm -rf packages/organizations-frontend
  rm -rf packages/projects-backend
  rm -rf packages/projects-frontend
  rm -rf packages/storages-backend
  rm -rf packages/storages-frontend
  ```

---

### Phase 7: Update Documentation

- [ ] **Step 7.1**: Update `packages/README.md`

  Remove 10 packages from the package listing table/list. Update package counts.

- [ ] **Step 7.2**: Update `packages/README-RU.md`

  Same changes for Russian README.

- [ ] **Step 7.3**: Replace `docs/en/` with GitBook stub pages

  Simplify to point users to the main GitBook site. Keep the SUMMARY.md structure but replace content with redirect stubs:
  - `docs/en/README.md` → Landing page pointing to `https://teknokomo.gitbook.io/up`
  - `docs/en/SUMMARY.md` → Minimal table of contents
  - Remove deep content directories and pages that reference removed modules

- [ ] **Step 7.4**: Replace `docs/ru/` with GitBook stub pages

  Same as EN but in Russian, pointing to the same GitBook URL.

---

### Phase 8: Build Verification & Cleanup

- [ ] **Step 8.1**: Run `pnpm install` to regenerate lockfile

  After deleting packages and removing deps, the lockfile needs updating.

- [ ] **Step 8.2**: Run `pnpm build`

  Full rebuild to verify 0 errors across all remaining packages.
  Expected: package count drops from 66 to 56 (or similar, depending on base+wrapper structure).

- [ ] **Step 8.3**: Run `pnpm lint` (or targeted lint on modified packages)

  Verify no lint errors in modified files:
  ```bash
  pnpm --filter @universo/template-mui lint
  pnpm --filter @flowise/core-backend lint
  pnpm --filter @flowise/core-frontend lint
  pnpm --filter @universo/types lint
  pnpm --filter @universo/admin-backend lint
  pnpm --filter @universo/admin-frontend lint
  ```

---

### Phase 9: Memory Bank Updates

- [ ] **Step 9.1**: Update `memory-bank/tasks.md` — mark this task complete
- [ ] **Step 9.2**: Update `memory-bank/progress.md` — log milestone
- [ ] **Step 9.3**: Update `memory-bank/activeContext.md` — reflect new state
- [ ] **Step 9.4**: Update `memory-bank/systemPatterns.md` — remove references to deleted modules

---

## Potential Challenges & Mitigations

### 1. Hidden cross-references
**Risk**: Some file might import from removed packages that we missed.
**Mitigation**: After Phase 6 (deleting dirs), `pnpm build` will fail on any missed import. Fix incrementally.

### 2. Database migration ordering
**Risk**: Removing migration registrations might cause TypeORM sync issues.
**Mitigation**: User confirmed test DB will be deleted and recreated — no migration rollback needed. Just remove from the array.

### 3. PermissionSubject type narrowing — existing DB data
**Risk**: Existing permission records in DB may reference 'clusters', 'projects', etc.
**Mitigation**: DB will be recreated. In production, a data migration would be needed, but not for test environment.

### 4. pnpm-workspace.yaml auto-discovery
**Risk**: pnpm-workspace.yaml uses glob `packages/*` and `packages/*/base`. After deletion, pnpm will simply stop discovering those packages. No manual workspace config change needed.
**Mitigation**: Just delete dirs + run `pnpm install`.

### 5. turbo.json pipeline
**Risk**: No package-specific config in turbo.json — it uses generic `dependsOn: ["^build"]` pattern. Safe.
**Mitigation**: None needed.

### 6. Unused icon imports after menu removal
**Risk**: Tabler icons like `IconFlag`, `IconFolder`, `IconDatabase`, `IconBuildingStore` might become unused in menuConfigs.ts after removing entries.
**Mitigation**: Check usage of each icon after removal. `IconFlag` is likely only used by campaigns. Others are used by remaining entries too.

---

## Execution Notes

- **Recommended branch name**: `chore/remove-legacy-packages`
- **Estimated file changes**: ~20 files modified, ~10 directories deleted, ~2 files created (GitBook stubs)
- **Estimated total lines removed**: ~800+ lines across modified files, plus entire package dirs
- **Build target**: `pnpm build` should succeed with reduced package count
- **No `pnpm dev` needed** — build verification is sufficient for this change
