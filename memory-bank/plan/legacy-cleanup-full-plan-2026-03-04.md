# Plan: Full Legacy Cleanup — Remove 38 Packages & Refactor Core

**Date**: 2026-03-04
**Complexity**: Level 4 (Major/Complex — cross-cutting, multi-layer, ~60 files affected)
**Status**: DRAFT v2 — updated after QA analysis (2026-03-04)

---

## Overview

Remove **38 legacy Flowise/UPDL packages** from the monorepo, clean all cross-references in routes, entities, migrations, menus, permissions, i18n, and dependencies. Then:
1. Migrate essential code from `flowise-core-backend` → `universo-core-backend`, delete the former
2. Rename `flowise-core-frontend` → `universo-core-frontend` (package name + directory)
3. Decide fate of `flowise-store` and `flowise-template-mui` (rename or merge)
4. Update all docs (READMEs, GitBook stubs)
5. Clean root configs and full rebuild

**Critical safety note**: The test database will be deleted and recreated — no migration rollback needed. We only remove migration *registrations* to prevent TypeORM from trying to create deleted tables.

---

## Packages to DELETE (38)

### Flowise AI Legacy (28 packages)
| # | Directory | npm name | Type |
|---|-----------|----------|------|
| 1 | `flowise-agents-backend` | `@flowise/agents-backend` | backend |
| 2 | `flowise-agents-frontend` | `@flowise/agents-frontend` | frontend |
| 3 | `flowise-apikey-backend` | `@flowise/apikey-backend` | backend |
| 4 | `flowise-apikey-frontend` | `@flowise/apikey-frontend` | frontend |
| 5 | `flowise-assistants-backend` | `@flowise/assistants-backend` | backend |
| 6 | `flowise-assistants-frontend` | `@flowise/assistants-frontend` | frontend |
| 7 | `flowise-chatmessage-backend` | `@flowise/chatmessage-backend` | backend |
| 8 | `flowise-chatmessage-frontend` | `@flowise/chatmessage-frontend` | frontend |
| 9 | `flowise-components` | `flowise-components` | shared |
| 10 | `flowise-credentials-backend` | `@flowise/credentials-backend` | backend |
| 11 | `flowise-credentials-frontend` | `@flowise/credentials-frontend` | frontend |
| 12 | `flowise-customtemplates-backend` | `@flowise/customtemplates-backend` | backend |
| 13 | `flowise-customtemplates-frontend` | `@flowise/customtemplates-frontend` | frontend |
| 14 | `flowise-docstore-backend` | `@flowise/docstore-backend` | backend |
| 15 | `flowise-docstore-frontend` | `@flowise/docstore-frontend` | frontend |
| 16 | `flowise-executions-backend` | `@flowise/executions-backend` | backend |
| 17 | `flowise-executions-frontend` | `@flowise/executions-frontend` | frontend |
| 18 | `flowise-leads-backend` | `@flowise/leads-backend` | backend |
| 19 | `flowise-leads-frontend` | `@flowise/leads-frontend` | frontend |
| 20 | `flowise-tools-backend` | `@flowise/tools-backend` | backend |
| 21 | `flowise-tools-frontend` | `@flowise/tools-frontend` | frontend |
| 22 | `flowise-variables-backend` | `@flowise/variables-backend` | backend |
| 23 | `flowise-variables-frontend` | `@flowise/variables-frontend` | frontend |

### Universo Legacy (15 packages)
| # | Directory | npm name | Type |
|---|-----------|----------|------|
| 24 | `analytics-frontend` | `@universo/analytics-frontend` | frontend |
| 25 | `metaverses-backend` | `@universo/metaverses-backend` | backend |
| 26 | `metaverses-frontend` | `@universo/metaverses-frontend` | frontend |
| 27 | `multiplayer-colyseus-backend` | `@universo/multiplayer-colyseus-backend` | backend |
| 28 | `publish-backend` | `@universo/publish-backend` | backend |
| 29 | `publish-frontend` | `@universo/publish-frontend` | frontend |
| 30 | `space-builder-backend` | `@universo/space-builder-backend` | backend |
| 31 | `space-builder-frontend` | `@universo/space-builder-frontend` | frontend |
| 32 | `spaces-backend` | `@universo/spaces-backend` | backend |
| 33 | `spaces-frontend` | `@universo/spaces-frontend` | frontend |
| 34 | `template-mmoomm` | `@universo/template-mmoomm` | template |
| 35 | `template-quiz` | `@universo/template-quiz` | template |
| 36 | `uniks-backend` | `@universo/uniks-backend` | backend |
| 37 | `uniks-frontend` | `@universo/uniks-frontend` | frontend |
| 38 | `updl` | `@universo/updl` | shared |

### Also to DELETE (special refactor)
| Package | Action |
|---------|--------|
| `flowise-core-backend` | Migrate essential code → `universo-core-backend`, then delete |
| `flowise-core-frontend` | Rename to `universo-core-frontend`, clean legacy imports |
| `flowise-store` | Rename to `@universo/store` (or merge into core-frontend — user decision needed) |
| `flowise-template-mui` | Rename to `@universo/legacy-mui` or merge shared components — user decision needed |

---

## Packages to KEEP (after cleanup: ~23)

`admin-backend`, `admin-frontend`, `applications-backend`, `applications-frontend`,
`apps-template-mui`, `auth-backend`, `auth-frontend`, `metahubs-backend`, `metahubs-frontend`,
`migration-guard-shared`, `profile-backend`, `profile-frontend`, `schema-ddl`,
`start-backend`, `start-frontend`, `universo-api-client`, `universo-core-backend` (enriched),
`universo-core-frontend` (renamed), `universo-i18n`, `universo-rest-docs`,
`universo-template-mui`, `universo-types`, `universo-utils`,
`flowise-store` (renamed to `@universo/store`), `flowise-template-mui` (renamed to legacy or merged)

---

## Affected Areas Map

### Backend — flowise-core-backend (→ universo-core-backend)

| File | Lines | What to change |
|------|-------|----------------|
| `src/routes/index.ts` (656L) | ~400 lines to remove | Remove 15+ service imports, 30+ route mounts, error handlers for deleted services |
| `src/index.ts` (419L) | ~100 lines to remove | Remove NodesPool, CachePool, AbortControllerPool, deleted rate limiters, publish-frontend assets, Canvas import |
| `src/DataSource.ts` (199L) | Migrate as-is | Move to universo-core-backend (good code, no deleted refs except entity/migration files) |
| `src/Interface.ts` (357L) | Remove ~200 lines | Remove all re-exports from deleted packages, Flowise-specific interfaces (IReactFlowNode, INodeData, etc.) |
| `src/Interface.Metrics.ts` | Keep or migrate | Check if used by kept packages |
| `src/NodesPool.ts` (178L) | DELETE entirely | Loads flowise-components + UPDL nodes — both deleted |
| `src/CachePool.ts` | DELETE entirely | Used only by canvas flow execution (flowise-components) |
| `src/AbortControllerPool.ts` | DELETE entirely | Used only by canvas prediction abort |
| `src/AppConfig.ts` | DELETE or simplify | `showCommunityNodes` irrelevant, `apiKeys.storageType` irrelevant |
| `src/utils/` (21 files) | DELETE most | Most are canvas/flow-specific (buildCanvasFlow, buildAgentGraph, SSEStreamer, upsertVector, validateKey, prompt, addCanvasCount, createAttachment, getUploadsConfig, hub, fileRepository). KEEP: logger, config, getRunningExpressApp, rlsHelpers, rateLimit, typeormDataSource |
| `src/database/entities/index.ts` | Remove 15+ imports | Remove all entity registrations for deleted packages |
| `src/database/migrations/postgres/index.ts` | Remove 14 arrays | Remove migration registrations for deleted packages (phases 2, 2b, 4, 5, 6, 7) |
| `package.json` | Remove 17 workspace deps | Remove all deleted backend package dependencies |
| `bin/` (run, dev scripts) | Migrate to universo-core-backend | oclif CLI entry point |

### Frontend — flowise-core-frontend (→ universo-core-frontend)

| File | What to change |
|------|----------------|
| `src/index.jsx` (129L) | Remove 10+ i18n imports from deleted packages, remove `setupBuilders()`, remove `browserModuleMap`, change `@flowise/store` → `@universo/store` |
| `src/App.jsx` (218L) | Change `@flowise/template-mui` → new location, remove CaslDebugger TODO |
| `package.json` (128L) | Remove 9+ deps on deleted frontend packages, remove `reactflow`, `flowise-embed`, `flowise-react-json-view`, `codemirror*`, `react-code-blocks`, etc. |
| `vite.config.js` | Remove optimizeDeps for deleted packages |

### Frontend — universo-template-mui

| File | Lines | What to change |
|------|-------|----------------|
| `src/routes/MainRoutesMUI.tsx` (699L) | Remove ~350 lines | Remove 8 i18n imports, ~40 Loadable lazy imports, ~200 lines of route definitions for deleted packages |
| `src/navigation/menuConfigs.ts` (387L) | Remove ~150 lines | Remove `getUnikMenuItems()`, `getMetaverseMenuItems()`, rootMenuItems entries |
| `src/components/dashboard/MenuContent.tsx` | Remove ~40 lines | Remove useMetaverseName, unik/metaverse context detection, related menu branches |
| `src/components/dashboard/NavbarBreadcrumbs.tsx` | Remove ~150 lines | Remove metaverse/unik breadcrumb builders, hooks, menuMap entries |
| `src/hooks/useBreadcrumbName.ts` | Remove ~50 lines | Remove useMetaverseName, useUnikName, useSpaceName hooks + truncate functions |
| `src/hooks/index.ts` | Remove ~12 re-exports | Remove deleted hook re-exports |
| `src/components/table/FlowListTable.tsx` | Change import | Remove `FlowListMenu` import from `@flowise/template-mui` |
| `package.json` | Remove ~10 deps | Remove deps on deleted `@flowise/*-frontend` packages |

### Shared — universo-types

| File | What to change |
|------|----------------|
| `src/updl/index.ts` (~200L) | DELETE entire file | UPDL types no longer needed |
| `src/index.ts` | Remove `export * from './updl'` line |
| `src/abilities/index.ts` | Remove 8 Subjects: `Metaverse`, `Cluster`, `Project`, `Space`, `Storage`, `Organization`, `Campaign`, `Unik` |
| `src/validation/metaverses.ts` | DELETE entire file |
| `src/validation/leads.ts` | DELETE entire file |
| `src/validation/vlc.ts` | Review — likely DELETE |
| `src/index.ts` | Remove re-exports for deleted validation files |

### Admin — Permissions

| File | What to change |
|------|----------------|
| `admin-backend/src/schemas/index.ts` | Remove `'metaverses'`, `'spaces'`, `'uniks'` from PermissionSubjects. Review: `'sections'`, `'entities'`, `'canvases'` |
| `admin-frontend/src/i18n/en/admin.json` | Remove translations: metaverses, spaces, uniks, (sections?, entities?, canvases?) |
| `admin-frontend/src/i18n/ru/admin.json` | Same for Russian |

### Shared — universo-i18n

| File | What to change |
|------|----------------|
| `src/instance.ts` | Remove ~20 comment lines referencing deleted `@flowise/*` packages |

### Shared — flowise-store (→ @universo/store)

| File | What to change |
|------|----------------|
| `package.json` | Rename `"name"` from `@flowise/store` → `@universo/store` |
| All consumers | Update imports from `@flowise/store` → `@universo/store` |

### Shared — flowise-template-mui

| Dependencies | What to change |
|------|----------------|
| `package.json` deps | Remove `@flowise/credentials-frontend`, `@flowise/tools-frontend`, `@flowise/assistants-frontend` (deleted packages) |
| Rename to `@universo/legacy-mui` | Or merge used parts into `universo-template-mui` |

### Infrastructure

| File | What to change |
|------|----------------|
| Root `package.json` scripts | Change `packages/flowise-core-backend/base/bin` → `packages/universo-core-backend/base/bin` |
| `Dockerfile` | No package-specific refs (uses `pnpm build` / `pnpm start`) — update if start scripts change |
| `docker/Dockerfile` | Uses global `flowise` npm install — review if still valid post-rename |
| `docker/docker-compose.yml` | Review environment variables |
| `pnpm-workspace.yaml` | No changes needed (glob pattern `packages/*` + `packages/*/base`) |
| `turbo.json` | No changes needed (uses generic pipeline) |
| Root `tsconfig.json` | Review path mappings if any |

### Documentation

| File | What to change |
|------|----------------|
| `packages/README.md` | Remove 38 packages from listing, update counts |
| `packages/README-RU.md` | Same for Russian |
| `README.md` | Review for stale references |
| `README-RU.md` | Same |
| `docs/en/`, `docs/ru/` | Remove pages for deleted features, update navigation |

---

## Plan Steps (Execution Order)

> **Key principle**: Each phase must end with a buildable project. Phases are ordered so that upstream dependencies are cleaned first.

---

### Phase 0: Preparation & Safety Net

- [ ] **Step 0.1**: Create a dedicated git branch
  ```bash
  git checkout -b cleanup/remove-legacy-packages
  ```

- [ ] **Step 0.2**: Verify clean baseline
  ```bash
  pnpm build  # Must succeed before starting
  ```

- [ ] **Step 0.3**: Document the starting package count
  ```bash
  ls -d packages/*/base/package.json packages/apps-template-mui/package.json packages/universo-rest-docs/package.json | wc -l
  # Expected: ~62
  ```

---

### Phase 1: @universo/types Cleanup (Foundation — must be first!)

Other packages import from `@universo/types`. Removing types first prevents downstream build errors.

- [ ] **Step 1.1**: Delete UPDL type file
  ```bash
  rm packages/universo-types/base/src/updl/index.ts
  rmdir packages/universo-types/base/src/updl/
  ```

- [ ] **Step 1.2**: Delete legacy validation files
  ```bash
  rm packages/universo-types/base/src/validation/metaverses.ts
  rm packages/universo-types/base/src/validation/leads.ts
  rm packages/universo-types/base/src/validation/vlc.ts  # Review first — keep if used by kept packages
  ```

- [ ] **Step 1.3**: Clean `universo-types/base/src/index.ts` — remove deleted re-exports
  
  **REMOVE** these lines:
  ```typescript
  export * from './updl'
  export * from './validation/metaverses'
  export * from './validation/leads'
  export * from './validation/vlc'   // if deleted in 1.2
  ```

- [ ] **Step 1.4**: Clean Subjects in `universo-types/base/src/abilities/index.ts`
  
  **BEFORE** (remove highlighted):
  ```typescript
  export type Subjects =
      | 'Metaverse'    // ← REMOVE
      | 'Cluster'      // ← REMOVE
      | 'Project'      // ← REMOVE
      | 'Space'        // ← REMOVE
      | 'Storage'      // ← REMOVE
      | 'Organization' // ← REMOVE
      | 'Campaign'     // ← REMOVE
      | 'Unik'         // ← REMOVE
      | 'Section'      // ← REMOVE (if no longer used)
      | 'Entity'       // ← REMOVE (if no longer used)
      | 'Canvas'       // ← REMOVE (if no longer used)
      | 'Publication'
      | 'Admin'
      | 'Role'
      | 'Instance'
      | 'all'
  ```
  
  **AFTER**:
  ```typescript
  export type Subjects =
      | 'Publication'
      | 'Admin'
      | 'Role'
      | 'Instance'
      | 'all'
  ```
  
  > **Decision point**: Confirm with user which subjects to keep. `'Section'`, `'Entity'`, `'Canvas'` may still be used by metahubs/applications context.

- [ ] **Step 1.5**: Verify universo-types builds
  ```bash
  pnpm --filter universo-types build
  ```

---

### Phase 2: Admin Permissions Cleanup

- [ ] **Step 2.1**: Clean `admin-backend/base/src/schemas/index.ts` — PermissionSubjects

  **BEFORE**:
  ```typescript
  const PermissionSubjects = [
      'metaverses',     // ← REMOVE
      'spaces',         // ← REMOVE
      'uniks',          // ← REMOVE
      'sections',       // ← REVIEW
      'entities',       // ← REVIEW
      'canvases',       // ← REVIEW
      'publications',
      'roles',
      'instances',
      'users',
      'settings',
      'admin',
      '*'
  ] as const
  ```
  
  **AFTER** (conservative — keep sections/entities/canvases if used by metahubs, review separately):
  ```typescript
  const PermissionSubjects = [
      'sections',
      'entities',
      'canvases',
      'publications',
      'roles',
      'instances',
      'users',
      'settings',
      'admin',
      '*'
  ] as const
  ```

- [ ] **Step 2.2**: Clean admin-frontend i18n — EN
  
  In `admin-frontend/base/src/i18n/en/admin.json`, remove:
  ```json
  "metaverses": "Metaverses",
  "spaces": "Spaces",
  "uniks": "Uniks",
  ```

- [ ] **Step 2.3**: Clean admin-frontend i18n — RU
  
  In `admin-frontend/base/src/i18n/ru/admin.json`, remove:
  ```json
  "metaverses": "Метавселенные",
  "spaces": "Пространства",
  "uniks": "Уники",
  ```

- [ ] **Step 2.4**: Verify admin packages build
  ```bash
  pnpm --filter admin-backend build && pnpm --filter admin-frontend build
  ```

---

### Phase 3: Delete 38 Package Directories

This is the bulk delete. Do it in one step since all cross-references will be cleaned in subsequent phases.

- [ ] **Step 3.1**: Delete all 38 package directories

  ```bash
  # Flowise AI Legacy (23 packages — agents through variables)
  rm -rf packages/flowise-agents-backend
  rm -rf packages/flowise-agents-frontend
  rm -rf packages/flowise-apikey-backend
  rm -rf packages/flowise-apikey-frontend
  rm -rf packages/flowise-assistants-backend
  rm -rf packages/flowise-assistants-frontend
  rm -rf packages/flowise-chatmessage-backend
  rm -rf packages/flowise-chatmessage-frontend
  rm -rf packages/flowise-components
  rm -rf packages/flowise-credentials-backend
  rm -rf packages/flowise-credentials-frontend
  rm -rf packages/flowise-customtemplates-backend
  rm -rf packages/flowise-customtemplates-frontend
  rm -rf packages/flowise-docstore-backend
  rm -rf packages/flowise-docstore-frontend
  rm -rf packages/flowise-executions-backend
  rm -rf packages/flowise-executions-frontend
  rm -rf packages/flowise-leads-backend
  rm -rf packages/flowise-leads-frontend
  rm -rf packages/flowise-tools-backend
  rm -rf packages/flowise-tools-frontend
  rm -rf packages/flowise-variables-backend
  rm -rf packages/flowise-variables-frontend
  
  # Universo Legacy (15 packages)
  rm -rf packages/analytics-frontend
  rm -rf packages/metaverses-backend
  rm -rf packages/metaverses-frontend
  rm -rf packages/multiplayer-colyseus-backend
  rm -rf packages/publish-backend
  rm -rf packages/publish-frontend
  rm -rf packages/space-builder-backend
  rm -rf packages/space-builder-frontend
  rm -rf packages/spaces-backend
  rm -rf packages/spaces-frontend
  rm -rf packages/template-mmoomm
  rm -rf packages/template-quiz
  rm -rf packages/uniks-backend
  rm -rf packages/uniks-frontend
  rm -rf packages/updl
  ```

- [ ] **Step 3.2**: Verify deleted packages are gone
  ```bash
  ls -d packages/flowise-agents-* packages/flowise-apikey-* 2>/dev/null | wc -l
  # Expected: 0
  ```

> **Note**: Build will FAIL at this point — that's expected. We'll fix all references in Phases 4-7.

---

### Phase 4: Clean flowise-core-backend (The Big Refactor)

This is the most complex phase. The `flowise-core-backend` is the central hub that imports from all deleted packages.

#### 4A: Clean Database Layer

- [ ] **Step 4A.1**: Rewrite `src/database/entities/index.ts`
  
  **AFTER** (only kept entity registrations):
  ```typescript
  // Database entity registry — only active packages
  import { metahubsEntities } from '@universo/metahubs-backend'
  import { applicationsEntities } from '@universo/applications-backend'
  import { AuthUser } from '@universo/auth-backend'
  import { Profile } from '@universo/profile-backend'
  import { adminEntities } from '@universo/admin-backend'

  export const entities = {
      ...metahubsEntities,
      ...applicationsEntities,
      ...Object.fromEntries(
          Object.entries(adminEntities).map(([k, v]) => [k, v])
      ),
      AuthUser,
      Profile,
  }
  ```

- [ ] **Step 4A.2**: Rewrite `src/database/migrations/postgres/index.ts`
  
  **AFTER**:
  ```typescript
  import { infrastructureMigrations } from '@universo/core-backend'
  import { adminMigrations } from '@universo/admin-backend'
  import { profileMigrations } from '@universo/profile-backend'
  import { metahubsMigrations } from '@universo/metahubs-backend'
  import { applicationsMigrations } from '@universo/applications-backend'

  /**
   * Migration order matters for FK constraints.
   * Phase 0: Infrastructure (UUID v7 function)
   * Phase 1: Admin (roles, users, permissions)
   * Phase 3: Profile, Metahubs, Applications
   *
   * Phases 2, 2b, 4, 5, 6, 7 removed — those packages were deleted.
   */
  export const postgresMigrations = [
      // Phase 0: Infrastructure
      ...infrastructureMigrations,
      // Phase 1: Admin subsystem
      ...adminMigrations,
      // Phase 3: Core domain
      ...profileMigrations,
      ...metahubsMigrations,
      ...applicationsMigrations,
  ]
  ```

#### 4B: Clean Routes

- [ ] **Step 4B.1**: Rewrite `src/routes/index.ts` — remove ALL deleted package imports and routes
  
  This is the largest single file change (~400 lines removed from 656).
  
  **What to KEEP** (route mounts):
  ```
  GET /api/v1/ping
  /api/v1/metahubs/*        (lazy from @universo/metahubs-backend)
  /api/v1/applications/*    (lazy from @universo/applications-backend)
  /api/v1/start/*           (lazy from @universo/start-backend)
  /api/v1/admin/*           (from @universo/admin-backend)
  /api/v1/profile/*         (from @universo/profile-backend)
  /api/v1/public/metahubs/* (from @universo/metahubs-backend)
  /api/v1/bots/*            (from @universo/metahubs-backend — keep if used)
  ```
  
  **What to REMOVE** (routes):
  All of these route groups and their service DI setup:
  ```
  /api/v1/attachments
  /api/v1/components-credentials*
  /api/v1/document-store/*
  /api/v1/export-import
  /api/v1/fetch-links
  /api/v1/flow-config/*
  /api/v1/get-upload-file/*
  /api/v1/get-upload-path
  /api/v1/internal-prediction/*
  /api/v1/load-prompt
  /api/v1/marketplaces/*
  /api/v1/node-*
  /api/v1/nodes
  /api/v1/openai-*
  /api/v1/prediction/*
  /api/v1/prompts-list/*
  /api/v1/public/* (canvas-related)
  /api/v1/stats/*
  /api/v1/vector/*
  /api/v1/verify/*
  /api/v1/version
  /api/v1/upsert-history/*
  /api/v1/nvidia-nim
  /api/v1/uniks/*
  /api/v1/metaverses/* (lazy)
  /api/v1/canvas-streaming/*
  /api/v1/space-builder/*
  /api/v1/publish/*
  /api/v1/leads/*
  /api/v1/public-executions/*
  ```
  
  **What to REMOVE** (service DI):
  ```typescript
  // DELETE all of these service instantiations:
  const toolsService = new (await import('@flowise/tools-backend')).ToolsService(...)
  const credentialsService = new (await import('@flowise/credentials-backend')).CredentialsService(...)
  const variablesService = new (await import('@flowise/variables-backend')).VariablesService(...)
  const apikeyService = ... // apikey-backend
  const assistantsService = ... // assistants-backend
  const leadsService = ... // leads-backend
  const executionsService = ... // executions-backend
  const chatMessagesService = ... // chatmessage-backend
  const feedbackService = ... // chatmessage-backend
  ```
  
  **What to REMOVE** (error handlers):
  ```typescript
  // DELETE all error handlers for deleted services
  toolsService.on('error', ...)
  credentialsService.on('error', ...)
  variablesService.on('error', ...)
  // ... etc for all deleted services
  ```

  **AFTER** — clean route file structure:
  ```typescript
  import express from 'express'
  import { Request, Response, NextFunction } from 'express'
  
  export default (app: express.Application) => {
      // Health check
      app.get('/api/v1/ping', (req, res) => res.json({ status: 'ok' }))
      
      // Lazy routers for domain packages
      const metahubsRouter = express.Router()
      let metahubsRouterInitialized = false
      app.use('/api/v1/metahubs', async (req, res, next) => {
          if (!metahubsRouterInitialized) {
              const { createMetahubsRouter } = await import('@universo/metahubs-backend')
              metahubsRouter.use(createMetahubsRouter())
              metahubsRouterInitialized = true
          }
          metahubsRouter(req, res, next)
      })
      
      // ... similar lazy routers for applications, start
      
      // Direct routers
      const { createAdminRouter } = await import('@universo/admin-backend')
      app.use('/api/v1/admin', createAdminRouter())
      
      const { createProfileRouter } = await import('@universo/profile-backend')
      app.use('/api/v1/profile', createProfileRouter())
      
      // Public routes
      const { createPublicMetahubsRouter } = await import('@universo/metahubs-backend')
      app.use('/api/v1/public/metahubs', createPublicMetahubsRouter())
  }
  ```

#### 4C: Clean App Entry (index.ts)

- [ ] **Step 4C.1**: Rewrite `src/index.ts` — remove deleted references from App class
  
  **REMOVE** these imports/usages:
  ```typescript
  // DELETE:
  import { Canvas } from '@universo/spaces-backend'
  import { getAPIKeysFromJson } from '@flowise/apikey-backend'
  import { initializeRateLimiters } from '@universo/metaverses-backend'
  import { seedMetahubTemplates } from '@universo/metahubs-backend'  // KEEP if still needed
  import { NodesPool } from './NodesPool'
  import { CachePool } from './CachePool'
  import { AbortControllerPool } from './AbortControllerPool'
  ```
  
  **REMOVE** from `initDatabase()`:
  ```typescript
  // DELETE:
  this.nodesPool = new NodesPool()
  await this.nodesPool.initialize()
  this.cachePool = new CachePool()
  this.abortControllerPool = new AbortControllerPool()
  ```
  
  **REMOVE** from `config()`:
  ```typescript
  // DELETE:
  - Canvas rate limiter setup
  - metaverses rate limiter setup  
  - publish-frontend assets serving
  - NodesPool references in static path resolution
  ```
  
  **UPDATE** static UI serving:
  ```typescript
  // BEFORE:
  const packagePath = getNodeModulesPackagePath('@flowise/core-frontend')
  // AFTER:
  const packagePath = getNodeModulesPackagePath('@universo/core-frontend')
  ```

#### 4D: Delete Unused Source Files

- [ ] **Step 4D.1**: Delete files that are completely obsolete
  ```bash
  rm packages/flowise-core-backend/base/src/NodesPool.ts
  rm packages/flowise-core-backend/base/src/CachePool.ts
  rm packages/flowise-core-backend/base/src/AbortControllerPool.ts
  rm packages/flowise-core-backend/base/src/AppConfig.ts
  ```

- [ ] **Step 4D.2**: Delete obsolete utils
  ```bash
  # Canvas/flow-specific — no longer needed
  rm packages/flowise-core-backend/base/src/utils/buildCanvasFlow.ts
  rm packages/flowise-core-backend/base/src/utils/buildAgentGraph.ts
  rm packages/flowise-core-backend/base/src/utils/SSEStreamer.ts
  rm packages/flowise-core-backend/base/src/utils/upsertVector.ts
  rm packages/flowise-core-backend/base/src/utils/validateKey.ts
  rm packages/flowise-core-backend/base/src/utils/prompt.ts
  rm packages/flowise-core-backend/base/src/utils/addCanvasCount.ts
  rm packages/flowise-core-backend/base/src/utils/createAttachment.ts
  rm packages/flowise-core-backend/base/src/utils/getUploadsConfig.ts
  rm packages/flowise-core-backend/base/src/utils/hub.ts
  rm packages/flowise-core-backend/base/src/utils/fileRepository.ts
  rm packages/flowise-core-backend/base/src/utils/XSS.ts
  ```
  
  **KEEP** these utils:
  ```
  utils/logger.ts              — universal logger
  utils/config.ts              — env config parsing
  utils/getRunningExpressApp.ts — singleton access pattern
  utils/rlsHelpers.ts          — RLS helper functions
  utils/rateLimit.ts           — rate limiter utility
  utils/typeormDataSource.ts   — TypeORM helper
  utils/index.ts               — re-exports (clean up removed refs)
  utils/constants.ts           — review and clean
  ```

- [ ] **Step 4D.3**: Clean `src/Interface.ts` — remove all Flowise-specific types
  
  **REMOVE** all of these:
  ```typescript
  // DELETE re-exports from deleted packages:
  export type { IAssistant, AssistantType } from '@flowise/assistants-backend'
  export type { IChatMessage, IChatMessageFeedback, GetChatMessageParams } from '@flowise/chatmessage-backend'
  export type { ILead, CreateLeadBody } from '@flowise/leads-backend'
  import type { CanvasFlowResult } from '@universo/spaces-backend'
  import { IAction, ICommonObject, IFileUpload, INode, INodeData, ... } from 'flowise-components'
  import type { IDocumentStoreUpsertData, ... } from '@flowise/docstore-backend'
  export { DocumentStoreStatus, IDocumentStore, ... } from '@flowise/docstore-backend'
  
  // DELETE all Flowise-specific interfaces:
  interface ITool { ... }
  interface ICredential { ... }
  interface IVariable { ... }
  interface IUpsertHistory { ... }
  interface IComponentNodes { ... }
  interface IComponentCredentials { ... }
  interface IReactFlowNode { ... }
  interface IReactFlowEdge { ... }
  interface IReactFlowObject { ... }
  interface INodeData extends INodeDataFromComponent { ... }
  // ... and all canvas/flow/prediction-related interfaces
  // ... and all IExecuteDocStore*, IExecutePreviewLoader, IExecuteVectorStore* interfaces
  ```
  
  **KEEP** only:
  ```typescript
  export enum MODE { QUEUE = 'queue', MAIN = 'main' }
  // And any interfaces actually used by kept packages
  ```

#### 4E: Clean package.json

- [ ] **Step 4E.1**: Remove workspace dependencies for deleted packages from `flowise-core-backend/base/package.json`
  
  **REMOVE** these dependencies:
  ```json
  "@flowise/apikey-backend": "workspace:*",
  "@flowise/assistants-backend": "workspace:*",
  "@flowise/chatmessage-backend": "workspace:*",
  "@flowise/credentials-backend": "workspace:*",
  "@flowise/customtemplates-backend": "workspace:*",
  "@flowise/docstore-backend": "workspace:*",
  "@flowise/leads-backend": "workspace:*",
  "@flowise/tools-backend": "workspace:*",
  "@flowise/variables-backend": "workspace:*",
  "@universo/metaverses-backend": "workspace:*",
  "@universo/multiplayer-colyseus-backend": "workspace:*",
  "@universo/publish-backend": "workspace:*",
  "@universo/space-builder-backend": "workspace:*",
  "@universo/spaces-backend": "workspace:*",
  "@universo/uniks-backend": "workspace:*",
  "flowise-components": "workspace:^",
  "@flowise/core-frontend": "workspace:^"
  ```
  
  Also remove npm dependencies no longer needed:
  ```json
  "flowise-nim-container-manager": "^1.0.11",
  // And any other deps only used by deleted code
  ```

- [ ] **Step 4E.2**: Verify flowise-core-backend builds
  ```bash
  pnpm --filter flowise-core-backend build
  ```

---

### Phase 5: Migrate flowise-core-backend → universo-core-backend

After Phase 4, `flowise-core-backend` is clean. Now migrate the code.

- [ ] **Step 5.1**: Copy source files to universo-core-backend
  
  ```bash
  # Copy cleaned source files
  cp -r packages/flowise-core-backend/base/src/routes packages/universo-core-backend/base/src/
  cp -r packages/flowise-core-backend/base/src/utils packages/universo-core-backend/base/src/
  cp packages/flowise-core-backend/base/src/index.ts packages/universo-core-backend/base/src/app.ts
  cp packages/flowise-core-backend/base/src/DataSource.ts packages/universo-core-backend/base/src/
  cp packages/flowise-core-backend/base/src/Interface.ts packages/universo-core-backend/base/src/
  cp packages/flowise-core-backend/base/src/Interface.Metrics.ts packages/universo-core-backend/base/src/
  
  # Copy database layer (entities + migrations already have index files)
  cp packages/flowise-core-backend/base/src/database/entities/index.ts packages/universo-core-backend/base/src/database/entities/index.ts
  # Migrations already exist in universo-core-backend — merge the index
  
  # Copy bin scripts
  cp -r packages/flowise-core-backend/base/bin packages/universo-core-backend/base/
  ```

- [ ] **Step 5.2**: Update `universo-core-backend/base/package.json`
  
  - Change `"name"` to `"@universo/core-backend"` (already correct)
  - Add all dependencies from cleaned flowise-core-backend package.json
  - Add `"bin"` config if using oclif
  - Ensure correct `"main"` entry point

- [ ] **Step 5.3**: Update internal imports to use new paths
  
  All `from '../...'` relative imports within the migrated code should still work since the directory structure is preserved. But verify package-scoped imports.

- [ ] **Step 5.4**: Merge migration registries
  
  `universo-core-backend` already has `infrastructureMigrations`. Merge with copied migration index to avoid duplicates:
  ```typescript
  // universo-core-backend/base/src/database/migrations/postgres/index.ts
  import { AddUuidV7Function1500000000000 } from './1500000000000-InitializeUuidV7Function'
  import { adminMigrations } from '@universo/admin-backend'
  import { profileMigrations } from '@universo/profile-backend'
  import { metahubsMigrations } from '@universo/metahubs-backend'
  import { applicationsMigrations } from '@universo/applications-backend'
  
  export const infrastructureMigrations = [AddUuidV7Function1500000000000]
  
  export const postgresMigrations = [
      ...infrastructureMigrations,
      ...adminMigrations,
      ...profileMigrations,
      ...metahubsMigrations,
      ...applicationsMigrations,
  ]
  ```

- [ ] **Step 5.5**: Verify universo-core-backend builds
  ```bash
  pnpm --filter universo-core-backend build
  ```

- [ ] **Step 5.6**: Delete flowise-core-backend
  ```bash
  rm -rf packages/flowise-core-backend
  ```

---

### Phase 6: Rename flowise-core-frontend → universo-core-frontend

- [ ] **Step 6.1**: Clean `src/index.jsx` — remove all deleted package imports
  
  **REMOVE** i18n imports:
  ```jsx
  // DELETE all of these:
  import '@universo/spaces-frontend/i18n'
  import '@universo/publish-frontend/i18n'
  import '@universo/analytics-frontend/i18n'
  import '@universo/uniks-frontend/i18n'
  import '@universo/metaverses-frontend/i18n'
  import '@universo/template-mmoomm/i18n'
  import '@universo/template-quiz/i18n'
  import '@flowise/template-mui/i18n'
  ```
  
  **REMOVE** code:
  ```jsx
  // DELETE:
  import { setupBuilders } from '@universo/publish-frontend'
  setupBuilders()
  const browserModuleMap = { ... }  // UPDL-related
  ```
  
  **UPDATE** store import:
  ```jsx
  // BEFORE:
  import { store } from '@flowise/store'
  // AFTER:
  import { store } from '@universo/store'
  ```

- [ ] **Step 6.1b**: Delete all legacy view directories and legacy api directory
  
  All views are for deleted features (canvases, agentflows, chatbot, publish, settings).
  The `api/` directory is also legacy except `client.ts` which will be updated.
  ```bash
  rm -rf packages/flowise-core-frontend/base/src/views/
  rm -rf packages/flowise-core-frontend/base/src/api/
  ```
  
  Also delete stale build artifacts:
  ```bash
  rm -rf packages/flowise-core-frontend/base/build/
  ```

- [ ] **Step 6.2**: Clean `src/App.jsx`
  
  **UPDATE** imports (flowise-template-mui is being deleted — use @universo/template-mui):
  ```jsx
  // BEFORE:
  import routes from '@flowise/template-mui/routes'
  import themes from '@flowise/template-mui/themes'
  import NavigationScroll from '@flowise/template-mui/layout/NavigationScroll'
  // AFTER:
  import routes from '@universo/template-mui/routes'
  import themes from '@universo/template-mui/themes'
  import NavigationScroll from '@universo/template-mui/layout/NavigationScroll'
  ```
  > NOTE: These components must first be migrated to universo-template-mui in Phase 9.

- [ ] **Step 6.3**: Clean `package.json` — remove deleted dependencies
  
  **REMOVE**:
  ```json
  "@flowise/customtemplates-frontend": "workspace:*",
  "@flowise/tools-frontend": "workspace:*",
  "@universo/metaverses-frontend": "workspace:*",
  "@universo/publish-frontend": "workspace:*",
  "@universo/space-builder-frontend": "workspace:*",
  "@universo/spaces-frontend": "workspace:*",
  "@universo/template-mmoomm": "workspace:*",
  "@universo/template-quiz": "workspace:*",
  "@universo/uniks-frontend": "workspace:*"
  ```
  
  **REMOVE** legacy npm deps (no longer used after cleanup):
  ```json
  "reactflow": ...,
  "flowise-embed": ...,
  "flowise-embed-react": ...,
  "flowise-react-json-view": ...,
  "@uiw/codemirror-*": ...,
  "react-code-blocks": ...,
  "react-color": ...,
  "react-markdown": ...,
  "react-syntax-highlighter": ...
  ```
  
  **UPDATE**:
  ```json
  "@flowise/store": "workspace:*" → "@universo/store": "workspace:*"
  ```

- [ ] **Step 6.4**: Clean `vite.config.js` — remove optimizeDeps for deleted packages

- [ ] **Step 6.5**: Rename package
  
  ```bash
  # Rename directory
  mv packages/flowise-core-frontend packages/universo-core-frontend
  ```
  
  In `packages/universo-core-frontend/base/package.json`:
  ```json
  "name": "@universo/core-frontend"
  ```

- [ ] **Step 6.6**: Verify universo-core-frontend builds
  ```bash
  pnpm --filter universo-core-frontend build
  ```

---

### Phase 7: Clean universo-template-mui

- [ ] **Step 7.1**: Clean `src/routes/MainRoutesMUI.tsx`
  
  **REMOVE** i18n imports (lines 13-28):
  ```typescript
  // DELETE:
  import '@flowise/tools-frontend/i18n'
  import '@flowise/credentials-frontend/i18n'
  import '@flowise/variables-frontend/i18n'
  import '@flowise/apikey-frontend/i18n'
  import '@flowise/assistants-frontend/i18n'
  import '@flowise/executions-frontend/i18n'
  import '@flowise/docstore-frontend/i18n'
  import '@flowise/customtemplates-frontend/i18n'
  import '@universo/uniks-frontend/i18n'
  import '@universo/metaverses-frontend/i18n'
  import '@universo/analytics-frontend/i18n'
  ```
  
  **REMOVE** Loadable lazy imports (lines 56-99):
  ```typescript
  // DELETE all of these:
  const Tools = Loadable(lazy(() => import('@flowise/tools-frontend/pages/Tools')))
  const Credentials = Loadable(lazy(() => import('@flowise/credentials-frontend/pages/Credentials')))
  const Variables = Loadable(lazy(() => import('@flowise/variables-frontend/pages/Variables')))
  const ApiKeys = Loadable(lazy(() => import('@flowise/apikey-frontend/pages/APIKey')))
  const DocumentStores = Loadable(lazy(() => import('@flowise/docstore-frontend/pages/docstore')))
  const DocumentStoreDetail = ...
  const LoaderConfigPreviewChunks = ...
  const ShowStoredChunks = ...
  const VectorStoreConfigure = ...
  const VectorStoreQuery = ...
  const Assistants = Loadable(lazy(() => import('@flowise/assistants-frontend/pages/Assistants')))
  const CustomAssistantLayout = ...
  const CustomAssistantConfigurePreview = ...
  const OpenAIAssistantLayout = ...
  const Executions = ...
  const PublicExecutionDetails = ...
  const Templates = Loadable(lazy(() => import('@flowise/customtemplates-frontend/pages/Templates')))
  // Also remove unik/metaverse page imports from @universo/*
  ```
  
  **REMOVE** route definitions (~200 lines):
  All routes under:
  - `unik/:unikId/tools`
  - `unik/:unikId/credentials`
  - `unik/:unikId/variables`
  - `unik/:unikId/apikey`
  - `unik/:unikId/document-stores/*`
  - `unik/:unikId/assistants/*`
  - `unik/:unikId/executions/*`
  - `unik/:unikId/analytics`
  - `unik/:unikId/templates`
  - `unik/:unikId/access`
  - `unik/:unikId/sections`
  - `unik/:unikId/entities`
  - `unik/*` (all remaining)
  - `metaverses/*`
  - `execution/:id`
  - `dashboard` (→ UnikList was the old dashboard)

- [ ] **Step 7.2**: Clean `src/navigation/menuConfigs.ts`
  
  **REMOVE**:
  ```typescript
  // DELETE functions:
  export function getUnikMenuItems(): MenuItem[] { ... }
  export function getMetaverseMenuItems(): MenuItem[] { ... }
  
  // DELETE from rootMenuItems:
  { id: 'uniks', ... }
  { id: 'metaverses', ... }
  ```

- [ ] **Step 7.3**: Clean `src/components/dashboard/MenuContent.tsx`
  
  **REMOVE**:
  ```typescript
  // DELETE import:
  import { useMetaverseName } from '../hooks'
  
  // DELETE unik/metaverse context detection logic
  // DELETE getUnikMenuItems, getMetaverseMenuItems calls
  ```

- [ ] **Step 7.4**: Clean `src/components/dashboard/NavbarBreadcrumbs.tsx`
  
  **REMOVE**:
  - Metaverse/unik breadcrumb builder functions
  - Related hook calls (useMetaverseName, useUnikName)
  - MenuMap entries for deleted contexts

- [ ] **Step 7.5**: Clean `src/hooks/useBreadcrumbName.ts` and `src/hooks/index.ts`
  
  **REMOVE**:
  ```typescript
  // DELETE hooks:
  export function useMetaverseName(...) { ... }
  export function useUnikName(...) { ... }
  export function useSpaceName(...) { ... }
  export function truncateMetaverseName(...) { ... }
  export function truncateUnikName(...) { ... }
  export function truncateSpaceName(...) { ... }
  ```

- [ ] **Step 7.6**: Clean `src/components/table/FlowListTable.tsx`
  
  **REMOVE** or replace:
  ```typescript
  // DELETE import from deleted package:
  import { FlowListMenu } from '@flowise/template-mui'
  // Replace with local component or remove usage
  ```

- [ ] **Step 7.7**: Clean `package.json`
  
  **REMOVE** deps:
  ```json
  "@flowise/template-mui": "workspace:*",
  "@flowise/apikey-frontend": "workspace:*",
  "@flowise/assistants-frontend": "workspace:*",
  "@flowise/credentials-frontend": "workspace:*",
  "@flowise/customtemplates-frontend": "workspace:*",
  "@flowise/docstore-frontend": "workspace:*",
  "@flowise/executions-frontend": "workspace:*",
  "@flowise/tools-frontend": "workspace:*",
  "@flowise/variables-frontend": "workspace:*"
  ```
  
  **UPDATE**:
  ```json
  "@flowise/store": "workspace:*" → "@universo/store": "workspace:*"
  ```

- [ ] **Step 7.8**: Verify universo-template-mui builds
  ```bash
  pnpm --filter universo-template-mui build
  ```

---

### Phase 8: Rename flowise-store → @universo/store + Clean Legacy Content

> **Decision**: Rename directory + npm name to `@universo/store` (user confirmed).
> After deleting all canvas consumers (spaces-frontend, flowise-core-frontend/views),
> canvas-specific Redux code becomes dead. Clean it to avoid tech debt.

- [ ] **Step 8.1**: Update `package.json` name
  
  In `packages/flowise-store/base/package.json`:
  ```json
  "name": "@universo/store"
  ```

- [ ] **Step 8.2**: Clean dead canvas/flow code from store internals
  
  **In `src/actions.js`** — REMOVE canvas actions (no consumers remain after Phase 3+6):
  ```javascript
  // DELETE — canvas reducer actions:
  export const SET_DIRTY = '@canvas/SET_DIRTY'
  export const REMOVE_DIRTY = '@canvas/REMOVE_DIRTY'
  export const SET_CANVAS = '@canvas/SET_CANVAS'
  export const SHOW_CANVAS_DIALOG = '@canvas/SHOW_CANVAS_DIALOG'
  export const HIDE_CANVAS_DIALOG = '@canvas/HIDE_CANVAS_DIALOG'
  export const SET_COMPONENT_NODES = '@canvas/SET_COMPONENT_NODES'
  export const SET_COMPONENT_CREDENTIALS = '@canvas/SET_COMPONENT_CREDENTIALS'
  ```
  
  **KEEP**: customization actions, notifier actions, dialog (SHOW/HIDE_CONFIRM), snackbar helpers.
  
  **In `src/constant.js`** — REMOVE Flowise-specific constants:
  ```javascript
  // DELETE:
  export const FLOWISE_CREDENTIAL_ID = 'FLOWISE_CREDENTIAL_ID'
  export const REDACTED_CREDENTIAL_VALUE = '_FLOWISE_BLANK_07167752-...'
  ```
  
  **KEEP**: `gridSpacing`, `drawerWidth`, `appDrawerWidth`, `headerHeight`, `maxScroll`, `baseURL`, `uiBaseURL`.
  
  **In `src/reducer.jsx`** — REMOVE canvas reducer (the entire `canvasReducer` section).
  
  **In `src/index.ts`** — REMOVE canvas context exports:
  ```typescript
  // DELETE:
  export { flowContext, ReactFlowContext } from './context/ReactFlowContext.jsx'
  ```
  
  **Delete file**: `src/context/ReactFlowContext.jsx` (canvas-only).
  
  **KEEP**: ConfirmContext, AbilityContext, useAbility, Can/Cannot, useHasGlobalAccess, store/persister, notifier actions.

- [ ] **Step 8.3**: Update ALL consumer imports
  
  Files that import from `@flowise/store` (in KEPT packages only):
  ```
  packages/universo-template-mui/base/src/components/dashboard/NavbarBreadcrumbs.tsx
  packages/universo-template-mui/base/src/components/dashboard/MenuContent.tsx
  packages/universo-template-mui/base/src/components/toolbar/ToolbarControls.tsx
  packages/universo-template-mui/base/src/components/dialogs/SettingsDialog.tsx
  packages/universo-template-mui/base/src/components/routing/AdminGuard.tsx
  packages/universo-core-frontend/base/src/index.jsx (after rename)
  packages/universo-core-frontend/base/src/App.jsx (after rename)
  ```
  
  **Find and replace** across all files:
  ```bash
  grep -rn "@flowise/store" packages/*/base/src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | grep -v node_modules
  ```
  Then: `@flowise/store` → `@universo/store` in all matched files.

- [ ] **Step 8.4**: Update ALL consumer `package.json` deps
  
  In every `package.json` that has `"@flowise/store": "workspace:*"`:
  - Change to `"@universo/store": "workspace:*"`
  
  Known consumers:
  - `universo-template-mui/base/package.json`
  - `universo-core-frontend/base/package.json` (after rename)
  - ~~`flowise-template-mui/base/package.json`~~ (deleted in Phase 9)

- [ ] **Step 8.5**: Rename directory
  ```bash
  mv packages/flowise-store packages/universo-store
  ```

- [ ] **Step 8.6**: Verify universo-store builds
  ```bash
  pnpm --filter universo-store build
  ```

---

### Phase 9: Merge flowise-template-mui → universo-template-mui, then DELETE

> **Decision**: User chose **full deletion** with merge of needed parts into `universo-template-mui`.
> QA analysis identified the exact components still needed by KEPT packages.

#### 9A: Identify and migrate needed components

The following components from `@flowise/template-mui` are imported by KEPT packages:

| Component | Consumer(s) | Action |
|-----------|-------------|--------|
| `FlowListMenu` (button) | universo-template-mui/FlowListTable.tsx | Move to universo-template-mui/components/button/ |
| `MainCard` (card) | profile-frontend/Profile.jsx | Move to universo-template-mui/components/cards/ |
| `InputHintDialog` (dialog) | metahubs-frontend tests, applications-frontend tests (vi.mock) | Move to universo-template-mui/components/dialogs/ |
| `themes` (theme config) | flowise-core-frontend/App.jsx (→ universo-core-frontend) | Move to universo-template-mui/themes/ |
| `NavigationScroll` (layout) | flowise-core-frontend/App.jsx (→ universo-core-frontend) | Move to universo-template-mui/layout/ |
| `routes` (routing) | flowise-core-frontend/App.jsx (→ universo-core-frontend) | Already exists as MainRoutesMUI — rewire |

- [ ] **Step 9A.1**: Copy needed source files from `flowise-template-mui` to `universo-template-mui`
  ```bash
  # Cards
  cp packages/flowise-template-mui/base/src/ui-components/cards/MainCard.jsx \
     packages/universo-template-mui/base/src/components/cards/
  
  # Buttons
  cp packages/flowise-template-mui/base/src/ui-components/button/FlowListMenu.jsx \
     packages/universo-template-mui/base/src/components/button/
  
  # Dialogs
  cp packages/flowise-template-mui/base/src/ui-components/dialog/InputHintDialog.jsx \
     packages/universo-template-mui/base/src/components/dialogs/
  
  # Themes (if not already duplicated)
  cp -r packages/flowise-template-mui/base/src/themes/* \
     packages/universo-template-mui/base/src/themes/ 2>/dev/null || true
  
  # Layout
  cp packages/flowise-template-mui/base/src/layout/NavigationScroll.jsx \
     packages/universo-template-mui/base/src/layout/
  ```

- [ ] **Step 9A.2**: Update imports inside migrated files
  - Change `@flowise/store` → `@universo/store` in migrated files
  - Change any `@flowise/template-mui` internal imports to relative paths
  - Remove any imports from deleted packages (`@flowise/credentials-frontend`, `@flowise/tools-frontend`)

- [ ] **Step 9A.3**: Export migrated components from `universo-template-mui/index.ts`
  ```typescript
  // Add to index.ts:
  export { default as MainCard } from './components/cards/MainCard'
  export { default as FlowListMenu } from './components/button/FlowListMenu'
  export { default as InputHintDialog } from './components/dialogs/InputHintDialog'
  export { default as NavigationScroll } from './layout/NavigationScroll'
  ```

#### 9B: Update all consumers to use @universo/template-mui

- [ ] **Step 9B.1**: `universo-template-mui/FlowListTable.tsx`
  ```typescript
  // BEFORE:
  import { FlowListMenu } from '@flowise/template-mui'
  // AFTER:
  import FlowListMenu from '../button/FlowListMenu'  // now local
  ```

- [ ] **Step 9B.2**: `profile-frontend/pages/Profile.jsx`
  ```jsx
  // BEFORE:
  import { MainCard } from '@flowise/template-mui'
  // AFTER:
  import { MainCard } from '@universo/template-mui'
  ```

- [ ] **Step 9B.3**: `metahubs-frontend` + `applications-frontend` test mocks
  ```typescript
  // BEFORE:
  vi.mock('@flowise/template-mui', async () => { ... })
  // AFTER:
  vi.mock('@universo/template-mui', async () => { ... })
  ```

- [ ] **Step 9B.4**: `universo-core-frontend/App.jsx` (from Phase 6.2)
  - Confirm all `@flowise/template-mui` imports now point to `@universo/template-mui`

#### 9C: Delete flowise-template-mui

- [ ] **Step 9C.1**: Remove `@flowise/template-mui` from all `package.json` deps
  
  Known consumers:
  - `universo-template-mui/base/package.json` → remove line
  - `universo-core-frontend/base/package.json` → remove line (after rename)

- [ ] **Step 9C.2**: Delete the package
  ```bash
  rm -rf packages/flowise-template-mui
  ```

- [ ] **Step 9C.3**: Verify affected packages build
  ```bash
  pnpm --filter universo-template-mui build
  pnpm --filter profile-frontend build
  ```

---

### Phase 10: Clean universo-i18n

- [ ] **Step 10.1**: Remove stale comments referencing deleted packages
  
  In `universo-i18n/base/src/instance.ts`, remove ~20 comment lines like:
  ```typescript
  // apiKeys translations removed - now in @flowise/apikey-frontend
  // assistants translations removed - now in @flowise/assistants-frontend
  // chatmessage translations removed - now in @flowise/chatmessage-frontend
  // document-store translations removed - now in @flowise/docstore-frontend
  // vector-store translations removed - now in @flowise/docstore-frontend
  // ... etc
  ```

- [ ] **Step 10.2**: Verify universo-i18n builds
  ```bash
  pnpm --filter universo-i18n build
  ```

---

### Phase 11: Clean Remaining Kept Packages

#### 11A: Clean universo-api-client

> QA analysis found `universo-api-client` has **22 API modules**, ~19 of which serve deleted features.
> The `lead.ts` module also has a direct `import type { ILead } from '@flowise/leads-backend'` — broken ref.
> None of the KEPT frontend packages import from `@universo/api-client` (only deleted packages do).

- [ ] **Step 11A.1**: Delete API modules for deleted features
  ```bash
  # These API modules correspond to removed backend routes:
  rm packages/universo-api-client/base/src/api/apikey.ts
  rm packages/universo-api-client/base/src/api/assistants.ts
  rm packages/universo-api-client/base/src/api/canvasMessages.ts
  rm packages/universo-api-client/base/src/api/canvasVersions.ts
  rm packages/universo-api-client/base/src/api/canvases.ts
  rm packages/universo-api-client/base/src/api/chatmessagefeedback.ts
  rm packages/universo-api-client/base/src/api/credentials.ts
  rm packages/universo-api-client/base/src/api/documentstore.ts
  rm packages/universo-api-client/base/src/api/executions.ts
  rm packages/universo-api-client/base/src/api/exportimport.ts
  rm packages/universo-api-client/base/src/api/lead.ts
  rm packages/universo-api-client/base/src/api/nodes.ts
  rm packages/universo-api-client/base/src/api/prediction.ts
  rm packages/universo-api-client/base/src/api/prompt.ts
  rm packages/universo-api-client/base/src/api/scraper.ts
  rm packages/universo-api-client/base/src/api/spaces.ts
  rm packages/universo-api-client/base/src/api/templates.ts
  rm packages/universo-api-client/base/src/api/tools.ts
  rm packages/universo-api-client/base/src/api/variables.ts
  rm packages/universo-api-client/base/src/api/vectorstore.ts
  ```
  
  **KEEP**: `config.ts`, `feedback.ts`, `validation.ts`, `attachments.ts` (review if still needed).

- [ ] **Step 11A.2**: Clean `client.ts` — remove deleted API group instantiations
  
  Remove all imports and object properties for deleted API classes. After cleanup, `client.ts` should only have:
  ```typescript
  return {
      config: new ConfigApi(client),
      feedback: new FeedbackApi(client),
      validation: createValidationApi(client),
      // attachments: new AttachmentsApi(client),  // review if needed
      $client: client
  }
  ```

- [ ] **Step 11A.3**: Remove `@flowise/leads-backend` from `package.json`
  ```json
  // DELETE from dependencies:
  "@flowise/leads-backend": "workspace:*"
  ```

- [ ] **Step 11A.4**: Verify universo-api-client builds
  ```bash
  pnpm --filter universo-api-client build
  ```

#### 11B: Clean profile-frontend

- [ ] **Step 11B.1**: Update import (depends on Phase 9 completion)
  
  In `packages/profile-frontend/base/src/pages/Profile.jsx`:
  ```jsx
  // BEFORE:
  import { MainCard } from '@flowise/template-mui'
  // AFTER:
  import { MainCard } from '@universo/template-mui'
  ```

#### 11C: Clean test mocks in metahubs-frontend & applications-frontend

- [ ] **Step 11C.1**: metahubs-frontend — update test mock
  
  In `packages/metahubs-frontend/base/src/domains/metahubs/ui/__tests__/MetahubMembers.test.tsx`:
  ```typescript
  // BEFORE:
  vi.mock('@flowise/template-mui', async () => {
      const actual = await vi.importActual<any>('@flowise/template-mui')
  // AFTER:
  vi.mock('@universo/template-mui', async () => {
      const actual = await vi.importActual<any>('@universo/template-mui')
  ```

- [ ] **Step 11C.2**: applications-frontend — update test mock
  
  In `packages/applications-frontend/base/src/pages/__tests__/ApplicationMembers.test.tsx`:
  ```typescript
  // BEFORE:
  vi.mock('@flowise/template-mui', async () => {
      const actual = await vi.importActual<any>('@flowise/template-mui')
  // AFTER:
  vi.mock('@universo/template-mui', async () => {
      const actual = await vi.importActual<any>('@universo/template-mui')
  ```

---

### Phase 12: Update Root Configs & Infrastructure

- [ ] **Step 12.1**: Update root `package.json` start scripts
  
  **BEFORE**:
  ```json
  "start:windows": "cd packages/flowise-core-backend/base/bin && run start",
  "start:default": "cd packages/flowise-core-backend/base/bin && ./run start",
  "start-worker:windows": "cd packages/flowise-core-backend/base/bin && run worker",
  "start-worker:default": "cd packages/flowise-core-backend/base/bin && ./run worker"
  ```
  
  **AFTER**:
  ```json
  "start:windows": "cd packages/universo-core-backend/base/bin && run start",
  "start:default": "cd packages/universo-core-backend/base/bin && ./run start",
  "start-worker:windows": "cd packages/universo-core-backend/base/bin && run worker",
  "start-worker:default": "cd packages/universo-core-backend/base/bin && ./run worker"
  ```

- [ ] **Step 12.2**: Clean root `package.json` — remove ghost workspaces, stale overrides, dead deps

  **12.2a — Remove ghost workspaces entries** (these directories don't exist):
  ```json
  // DELETE from "workspaces" array:
  "components",
  "universo-rest-docs"
  ```

  **12.2b — Remove AI/LLM overrides** (only used by deleted flowise-components):
  ```json
  // DELETE from pnpm.overrides:
  "@langchain/core": "...",
  "@langchain/openai": "...",
  "@langchain/community": "...",
  "langchain": "...",
  "langsmith": "...",
  "openai": "...",
  "mysql2": "...",
  "sqlite3": "..."
  ```

  **12.2c — Remove stale resolutions** (same reason):
  ```json
  // DELETE from resolutions:
  "@langchain/core": "...",
  "langchain": "...",
  "openai": "...",
  "langsmith": "...",
  "protobufjs": "...",
  "@types/express-serve-static-core": "..."
  ```
  > Verify `protobufjs` and `@types/express-serve-static-core` are not used by kept packages first.

  **12.2d — Remove dead root dependencies**:
  ```json
  // DELETE from dependencies:
  "@colyseus/ws-transport": "..."  // used by deleted multiplayer-colyseus-backend
  ```

  **12.2e — Clean onlyBuiltDependencies**:
  ```json
  // DELETE from pnpm.onlyBuiltDependencies:
  "faiss-node",  // only used by deleted flowise-components
  "sqlite3"      // only used by deleted flowise-components
  ```

- [ ] **Step 12.3**: Clean `pnpm-workspace.yaml` catalog of stale entries

  Grep each catalog entry against remaining `package.json` files. Entries that are **only** referenced by deleted packages should be removed:
  ```yaml
  # VERIFY each, DELETE if no remaining consumer:
  reactflow: ...              # canvas-only → DELETE
  flowise-react-json-view: ...  # flowise-components only → DELETE
  '@uiw/codemirror-extensions-basic-setup': ...  # canvas editor → DELETE
  '@uiw/codemirror-theme-sublime': ...            # canvas editor → DELETE
  '@uiw/codemirror-theme-vscode': ...             # canvas editor → DELETE
  '@uiw/react-codemirror': ...                    # canvas editor → DELETE
  react-color: ...             # verify usage → likely DELETE
  react-code-blocks: ...       # verify usage → likely DELETE
  react-syntax-highlighter: ... # verify usage → likely DELETE
  framer-motion: ...           # verify — may be used by kept MUI packages → CHECK
  ```
  
  **Verification command**:
  ```bash
  for pkg in reactflow flowise-react-json-view @uiw/codemirror @uiw/react-codemirror react-color react-code-blocks react-syntax-highlighter framer-motion; do
    echo "=== $pkg ==="
    grep -rn "$pkg" packages/*/base/package.json | grep -v node_modules
  done
  ```

- [ ] **Step 12.4**: Review root `Dockerfile`
  
  Current Dockerfile uses `pnpm build` and `pnpm start` — should work after root package.json update. No package-specific references.

- [ ] **Step 12.5**: Review `docker/Dockerfile`
  
  This uses `npm install -g flowise` which installs the upstream Flowise package globally — this is NOT our monorepo build. This Dockerfile may be legacy and should be marked as such or updated.

- [ ] **Step 12.6**: Review root `tsconfig.json` for path references to deleted packages

---

### Phase 13: Update Documentation

- [ ] **Step 13.1**: Update `packages/README.md`
  - Remove all 38 deleted packages from the listing
  - Update package counts
  - Add notes about renamed packages

- [ ] **Step 13.2**: Update `packages/README-RU.md` (same changes, Russian)

- [ ] **Step 13.3**: Update root `README.md` — remove Flowise-specific feature mentions

- [ ] **Step 13.4**: Update root `README-RU.md` (same changes, Russian)

- [ ] **Step 13.5**: Update/remove GitBook docs
  - `docs/en/` — remove pages for deleted features
  - `docs/ru/` — same

---

### Phase 14: Full Rebuild & Verification

- [ ] **Step 14.1**: Clean install
  ```bash
  pnpm clean:all
  pnpm install
  ```

- [ ] **Step 14.2**: Full build
  ```bash
  pnpm build
  ```
  
  > Expected: All remaining packages build successfully.

- [ ] **Step 14.3**: Verify package count
  ```bash
  ls -d packages/*/base/package.json packages/apps-template-mui/package.json packages/universo-rest-docs/package.json 2>/dev/null | wc -l
  # Expected: ~24 (down from ~62)
  ```

- [ ] **Step 14.4**: Search for orphan references
  ```bash
  # Should return 0 results:
  grep -rn "@flowise/agents\|@flowise/apikey\|@flowise/assistants\|@flowise/chatmessage\|@flowise/credentials\|@flowise/customtemplates\|@flowise/docstore\|@flowise/executions\|@flowise/leads\|@flowise/tools\|@flowise/variables\|flowise-components\|@universo/metaverses\|@universo/spaces\|@universo/uniks\|@universo/publish\|@universo/space-builder\|@universo/multiplayer\|@universo/analytics\|@universo/updl\|@universo/template-mmoomm\|@universo/template-quiz\|@flowise/template-mui\|@flowise/store\|@flowise/core-backend\|@flowise/core-frontend" packages/*/base/src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | grep -v node_modules | grep -v "\.d\.ts"
  ```

- [ ] **Step 14.5**: Run linting on critical packages
  ```bash
  pnpm --filter universo-core-backend lint
  pnpm --filter universo-core-frontend lint
  pnpm --filter universo-template-mui lint
  ```

---

### Phase 15: Update Memory Bank

- [ ] **Step 15.1**: Update `memory-bank/tasks.md` — mark cleanup task complete
- [ ] **Step 15.2**: Update `memory-bank/progress.md` — add completion entry
- [ ] **Step 15.3**: Update `memory-bank/activeContext.md` — reflect new state
- [ ] **Step 15.4**: Update `memory-bank/techContext.md` — update package counts, remove deleted package references
- [ ] **Step 15.5**: Update `memory-bank/systemPatterns.md` — update architecture patterns if needed

---

## Potential Challenges

### 1. Interface.ts Deep Dependencies
The current `Interface.ts` in `flowise-core-backend` re-exports types from many deleted packages. If any **kept** packages import these types transitively through `@flowise/core-backend`, those imports will break.

**Mitigation**: Before Phase 4, run:
```bash
grep -rn "from '@flowise/core-backend'" packages/*/base/src --include="*.ts" | grep -v node_modules | grep -v flowise-core-backend
```
**Current result**: No kept packages import from `@flowise/core-backend` directly ✅

### 2. Admin Permission Subjects Alignment
The `PermissionSubjects` in `admin-backend/schemas/index.ts` must stay aligned with:
- `Subjects` type in `universo-types/abilities/index.ts`
- Actual CASL rules stored in the database

**Mitigation**: Since the test DB will be recreated, this is safe. But ensure both files are updated consistently.

### 3. Runtime Import Failures
Some route registrations use dynamic `await import(...)`. If any import path is missed, it will fail at runtime (not at build time).

**Mitigation**: After cleanup, start the server and test all remaining API endpoints:
```bash
pnpm start
# Then test:
curl http://localhost:3000/api/v1/ping
curl http://localhost:3000/api/v1/metahubs (with auth)
# etc.
```

### 4. Static UI Asset Path
The backend serves the frontend build from a path resolved via `getNodeModulesPackagePath('@flowise/core-frontend')`. After rename to `@universo/core-frontend`, this must be updated.

**Mitigation**: Step 4C.1 covers this explicitly.

### 5. oclif CLI Entry Point
The `bin/run` script uses `@oclif/core` for CLI commands. Ensure the `oclif` config in `package.json` is migrated correctly to `universo-core-backend`.

**Mitigation**: Review `flowise-core-backend/base/package.json` for `oclif` configuration section.

---

## Decisions (Resolved)

All decision points have been resolved. Final answers:

| # | Question | Decision | Implemented in |
|---|----------|----------|----------------|
| 1 | **flowise-template-mui fate** | **C) Merge needed components into `universo-template-mui`, then DELETE** | Phase 9 (9A/9B/9C) |
| 2 | **Permission subjects cleanup scope** | **B) Remove ALL including sections/entities/canvases** | Phase 2 |
| 3 | **flowise-store directory rename** | **A) Rename to `universo-store`** (both directory and npm name) | Phase 8 |
| 4 | **seedMetahubTemplates call** | **A) Keep in App startup** (idempotent, needed for metahub initialization) | No change needed |
| 5 | **CachePool/AbortControllerPool** | Delete entirely — dead code after canvas removal | Phase 4 |
| 6 | **Interface.ts migration scope** | Migrate minimal (only MODE enum + what's actually used) | Phase 5 |

---

## Summary

| Phase | Description | Estimated effort | Risk |
|-------|-------------|-----------------|------|
| 0 | Preparation & safety net | 5 min | None |
| 1 | universo-types cleanup | 15 min | Low — isolated |
| 2 | Admin permissions cleanup (remove ALL subjects incl. sections/entities/canvases) | 10 min | Low — isolated |
| 3 | Delete 38 package directories | 5 min | None (bulk delete) |
| 4 | Clean flowise-core-backend (routes, services, Interface.ts, controllers) | 2-3 hours | **HIGH** — central hub, many files |
| 5 | Migrate to universo-core-backend (copy + merge + re-wire) | 1 hour | Medium — copy + verify |
| 6 | Rename flowise-core-frontend → universo-core-frontend + delete views/api/build | 1 hour | Medium — rename + clean |
| 7 | Clean universo-template-mui (routes, menus, dead imports) | 1-2 hours | Medium — many route/menu changes |
| 8 | Rename flowise-store → universo-store + clean dead canvas actions/constants | 45 min | Low-Medium — content cleanup added |
| 9 | Merge flowise-template-mui → universo-template-mui, then DELETE | 45 min | Medium — 6 components to migrate |
| 10 | Clean universo-i18n (stale comments) | 5 min | None |
| 11 | Clean remaining: universo-api-client (~19 dead modules), profile-frontend, test mocks | 45 min | Medium — api-client is large |
| 12 | Root configs: package.json overrides/ghosts, pnpm catalog, Dockerfiles, tsconfig | 30 min | Low |
| 13 | Documentation (READMEs, GitBook) | 30 min | None |
| 14 | Full rebuild & verification (clean install, build, orphan search, lint) | 30-60 min | Build errors possible |
| 15 | Memory Bank update | 15 min | None |
| **Total** | | **~10-13 hours** | |

---

## Execution Notes

1. **Build verification after each phase** is critical. Don't proceed to the next phase until the current one builds.
2. **Phase 4 is the hardest** — routes/index.ts alone has 656 lines with complex imports. Consider splitting into sub-steps and building after each sub-step.
3. **Git commits after each phase** — allows rollback to last working state.
4. **The flowise-core-backend → universo-core-backend migration** (Phase 5) should only happen after Phase 4 produces a clean, building result.
5. **pnpm install --force** after deleting packages to rebuild the lockfile.
6. **Phase 9 must complete before Phase 11B/11C** — profile-frontend and test mocks depend on migrated components in universo-template-mui.
7. **Phase 12 catalog cleanup** — verify each entry by grepping remaining package.json files before deleting.
