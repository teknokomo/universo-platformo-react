# PlayCanvas Editor Frontend Package Rename Plan

> Date: 2026-06-05
> Scope: rename `packages/universo-react-playcanvas-editor` (`@universo-react/playcanvas-editor`) to `packages/universo-react-playcanvas-editor-frontend` (`@universo-react/playcanvas-editor-frontend`).
> Mode: PLAN only.

## Overview

Rename the current PlayCanvas Editor artifact package so its internal workspace boundary clearly represents the frontend artifact layer. Keep the user-facing metahub package, route slug, and package card identity as `playcanvas-editor` / `PlayCanvas Editor`; only the PNPM workspace package folder and npm package name change.

This work does not create the future PlayCanvas Editor backend package and does not change metahub schema/template versions. The test database can be recreated, so active seed/default data may be updated directly without preserving a compatibility alias for the old npm package name.

## Research And Documentation Context

- No separate external research artifact is required for this rename because the task is a local workspace refactor.
- Context7 pnpm documentation check: PNPM resolves workspace packages by `package.json.name`; filters and `workspace:` dependencies must match the active workspace package name, and missing workspace targets can fail with `ERR_PNPM_NO_MATCHING_VERSION_INSIDE_WORKSPACE`.
- Turborepo context: prefer package-local scripts and update root/CI filters to the new package name instead of adding root-only task logic.
- Universo architecture context: keep the metahub product package slug stable and separate it from the npm artifact package name.

## Architecture Decisions

- Rename the workspace package folder:
  - From `packages/universo-react-playcanvas-editor`
  - To `packages/universo-react-playcanvas-editor-frontend`
- Rename the npm package:
  - From `@universo-react/playcanvas-editor`
  - To `@universo-react/playcanvas-editor-frontend`
- Keep the metahub package slug unchanged:
  - `packageSlug: "playcanvas-editor"`
  - Routes such as `/resources/packages/playcanvas-editor/editor` remain unchanged.
- Keep user-facing labels unchanged:
  - `PlayCanvas Editor`
  - Existing EN/RU i18n copy should describe this as the frontend artifact package where technical package names are shown.
- Do not add a compatibility alias for `@universo-react/playcanvas-editor`, because the user explicitly allows rebuilding the test database and recreating metahubs/applications.
- Do not create `@universo-react/playcanvas-editor-backend` in this slice. The backend package belongs to the later PlayCanvas upstream backend strategy work.

## Affected Areas

- Workspace package:
  - `packages/universo-react-playcanvas-editor/**`
  - `package.json`
  - `pnpm-lock.yaml`
  - `vitest.workspace.ts`
  - `.eslintrc.js`
  - `.github/workflows/main.yml`
- Guardrail tooling:
  - `tools/check-playcanvas-editor-isolation.mjs`
  - `tools/check-catalog-versions.mjs`
  - root `test:e2e:agent` script
- Shared type/package constants:
  - `packages/universo-react-types/src/common/packages.ts`
  - `packages/universo-react-types/src/common/playcanvasProjects.ts`
- Metahub package registry and defaults:
  - `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json`
  - `packages/universo-react-metahubs-backend/src/domains/packages/services/packageConfigValidation.ts`
  - `packages/universo-react-metahubs-backend/src/domains/metahubs/services/systemTableDefinitions.ts`
  - `packages/universo-react-metahubs-backend/src/domains/packages/controllers/packagesController.ts`
- Frontend package UI constants:
  - `packages/universo-react-metahubs-frontend/src/domains/packages/ui/MetahubPackagesTab.tsx`
- Tests:
  - PlayCanvas Editor package tests
  - Metahubs backend package seed/config/project tests
  - Metahubs frontend package tab tests
  - Utils publication snapshot hash tests
  - Playwright flow specs that assert package names, while preserving slug route expectations
- Documentation:
  - Renamed package `README.md` and `README-RU.md`
  - GitBook docs under `docs/en/platform/**` and `docs/ru/platform/**`
  - Current Memory Bank files where the current package identity is described, while treating historical research/plan artifacts as historical unless an explicit stale-reference gate requires rewriting them.

## Plan Steps

### Phase 1. Preflight And Reference Inventory

- [ ] Confirm the working tree status and note unrelated local changes without reverting them.
- [ ] Run literal reference scans before editing:

```bash
rg '@universo-react/playcanvas-editor|packages/universo-react-playcanvas-editor|universo-react-playcanvas-editor'
rg 'playcanvas-editor'
```

- [ ] Classify each hit as one of:
  - npm package name/path that must change;
  - metahub slug/route that must stay `playcanvas-editor`;
  - upstream vendor path/protocol wording that should stay;
  - historical Memory Bank text that should either stay historical or receive a current-state note.

### Phase 2. Workspace Package Rename

- [ ] Move the package directory:

```bash
mv packages/universo-react-playcanvas-editor packages/universo-react-playcanvas-editor-frontend
```

- [ ] Update the package manifest:

```json
{
  "name": "@universo-react/playcanvas-editor-frontend",
  "description": "Universo frontend artifact boundary for the PlayCanvas Editor"
}
```

- [ ] Keep package-local scripts unchanged unless a path/name inside a script references the old folder or package name.
- [ ] Treat `dist/`, `.tmp/`, and `coverage/` as generated outputs. Rebuild them through package scripts rather than manually synchronizing stale artifacts.

### Phase 3. Workspace, CI, And Tooling Updates

- [ ] Update root package filters and ignore paths:
  - `test:e2e:agent`
  - `eslintIgnore`
- [ ] Update `.eslintrc.js` ignore paths for `vendor/**` and `.tmp/**`.
- [ ] Update `.github/workflows/main.yml` package filters:

```yaml
pnpm --filter @universo-react/playcanvas-editor-frontend test
pnpm --filter @universo-react/playcanvas-editor-frontend editor:build
pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke
pnpm --filter @universo-react/playcanvas-editor-frontend exec playwright install --with-deps chromium
pnpm --filter @universo-react/playcanvas-editor-frontend editor:browser-smoke
```

- [ ] Update `vitest.workspace.ts` to point at the renamed package config.
- [ ] Update `tools/check-playcanvas-editor-isolation.mjs`:
  - package directory constant;
  - blocked/allowed package name checks;
  - vendor path allowlist entries.
- [ ] Update `tools/check-catalog-versions.mjs` exception key for the Vite version exception.
- [ ] Regenerate `pnpm-lock.yaml` with `pnpm install --lockfile-only` or `pnpm install`; do not hand-edit lockfile importers.

### Phase 4. Domain Constants And Registry Data

- [ ] Update shared constants to the new npm package name while preserving slug semantics.
- [ ] Prefer explicit separation between package name and slug if the touched module currently conflates them:

```ts
export const PLAYCANVAS_EDITOR_PACKAGE_SLUG = 'playcanvas-editor' as const
export const PLAYCANVAS_EDITOR_FRONTEND_PACKAGE_NAME = '@universo-react/playcanvas-editor-frontend' as const
```

- [ ] If changing exported constant names would create unnecessary churn, keep the existing constant name but update the value, and add a separate slug constant only where slug/name ambiguity already causes risk.
- [ ] Update `seed-packages.json` technical package metadata:
  - `packageName`
  - `source.packageName`
  - `source.importName`
  - `authoringSurface.artifact.packageName`
- [ ] Keep `packageSlug`, resource routes, and user-facing package title unchanged.
- [ ] Update `packageConfigValidation.ts` literals to the new package name.
- [ ] Update `systemTableDefinitions.ts` default `package_name` to the new package name. No schema/template version bump is planned because the database will be rebuilt.
- [ ] Update `packagesController.ts` artifact path to the renamed folder.
- [ ] Avoid cross-package relative imports from metahubs backend into the frontend artifact package. The backend should continue resolving a filesystem artifact path, not importing package code.

### Phase 5. Tests And Fixtures

- [ ] Update unit/integration tests that assert the npm package name.
- [ ] Keep tests that assert route slug or URL path on `playcanvas-editor`.
- [ ] Pay special attention to tests that construct the old name indirectly, for example:

```ts
const packageName = `@universo-react/${'playcanvas-editor'}`
```

- [ ] Update seed checksum tests and expected package registry migration behavior to reflect the new active seed value.
- [ ] Update PlayCanvas project tests so `packageName` stores the new npm package name.
- [ ] Update publication snapshot hash tests only where the package reference is an active package name, not a route slug.
- [ ] Do not add a new deep test suite solely for the rename. Strengthen existing tests if they currently fail to distinguish npm package name from slug.

### Phase 6. Documentation And Memory Bank

- [ ] Update renamed package `README.md` and `README-RU.md`:
  - headings;
  - package-local commands;
  - artifact boundary wording.
- [ ] Update GitBook docs in both EN and RU:
  - `docs/en/platform/playcanvas-editor.md`
  - `docs/ru/platform/playcanvas-editor.md`
  - `docs/en/platform/playcanvas-projects.md`
  - `docs/ru/platform/playcanvas-projects.md`
  - `docs/en/platform/metahubs/packages.md`
  - `docs/ru/platform/metahubs/packages.md`
- [ ] In docs, use precise language:
  - user package/product: `PlayCanvas Editor`;
  - technical frontend artifact package: `@universo-react/playcanvas-editor-frontend`;
  - resource slug/route: `playcanvas-editor`.
- [ ] Update `memory-bank/currentResearch.md`, `memory-bank/progress.md`, or `memory-bank/tasks.md` only where they describe the current state. Do not rewrite completed historical research/plan artifacts unless the final stale-reference policy requires zero old-name hits outside `.manager/`.

### Phase 7. Verification Commands

- [ ] Run package/workspace guardrails:

```bash
pnpm install --lockfile-only
pnpm run check:package-naming
pnpm run check:catalog-versions
pnpm run check:playcanvas-editor-isolation
```

- [ ] Run package-local checks:

```bash
pnpm --filter @universo-react/playcanvas-editor-frontend test
pnpm --filter @universo-react/playcanvas-editor-frontend editor:build
pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke
pnpm --filter @universo-react/playcanvas-editor-frontend editor:browser-smoke
```

- [ ] Run affected integration tests:

```bash
pnpm --filter @universo-react/types test
pnpm --filter @universo-react/metahubs-backend test
pnpm --filter @universo-react/metahubs-frontend test
pnpm --filter @universo-react/utils test
```

- [ ] Run Prettier on touched source/docs:

```bash
pnpm exec prettier --write \
  "packages/universo-react-playcanvas-editor-frontend/**/*.{ts,tsx,js,mjs,json,md}" \
  "docs/{en,ru}/platform/**/*.md" \
  "memory-bank/**/*.md"
```

- [ ] If E2E validation is needed, use the Playwright wrapper and local minimal Supabase as requested:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use --silent 22
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase \
  UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase \
  node tools/testing/e2e/run-playwright-suite.mjs --grep "metahub packages"
pnpm supabase:e2e:stop
```

- [ ] Run final workspace proof when practical:

```bash
pnpm build
```

### Phase 8. Final Stale-Reference Gate

- [ ] Run final scans:

```bash
rg '@universo-react/playcanvas-editor|packages/universo-react-playcanvas-editor|universo-react-playcanvas-editor'
rg 'playcanvas-editor'
```

- [ ] The first scan should have no active code, config, CI, docs, or current Memory Bank references to the old npm package/folder name.
- [ ] Remaining `playcanvas-editor` hits must be intentional slug, route, upstream vendor folder, or user-facing product references.
- [ ] If old names remain in historical Memory Bank artifacts, either:
  - leave them as historical evidence and document that decision in the final answer; or
  - update them if the implementation acceptance criteria require zero old-name hits outside `.manager/`.

## Potential Challenges

- The npm package name and metahub slug are easy to conflate. The implementation must keep `@universo-react/playcanvas-editor-frontend` separate from `playcanvas-editor`.
- `packageName` appears in active seed/default data, not only build tooling. Because the test DB will be recreated, direct seed/default updates are acceptable; for a live production migration this would need alias/migration planning.
- Some tests construct the old name indirectly and may not be caught by only scanning `@universo-react/playcanvas-editor`.
- `pnpm-lock.yaml` importer paths must be regenerated by PNPM.
- Guardrail scripts can fail in either direction after rename: they may still block the old path or accidentally stop checking the new path.
- Browser/E2E proof should not be over-scoped. This rename should only require package/resource open-flow proof if route/package attachment behavior changes or affected tests expose a regression.
- Historical Memory Bank files can legitimately contain old names. Decide during implementation whether acceptance is "no old active references" or "no old references anywhere outside `.manager/`".

## Acceptance Criteria

- `packages/universo-react-playcanvas-editor-frontend/package.json` exists with `name: "@universo-react/playcanvas-editor-frontend"`.
- No active code, CI, workspace config, package registry seed, or GitBook doc refers to `@universo-react/playcanvas-editor` as the current package name.
- `packageSlug: "playcanvas-editor"` and routes under `/resources/packages/playcanvas-editor/...` remain stable.
- Package-local tests/build/smoke checks run through the new PNPM filter.
- Metahub backend/frontend tests use the new package name where they represent package metadata.
- Guardrail scripts and CI check the renamed package.
- Lockfile and workspace metadata are consistent after PNPM regeneration.
- Documentation clearly explains the distinction between the PlayCanvas Editor product, the frontend artifact package, and the stable metahub slug.
