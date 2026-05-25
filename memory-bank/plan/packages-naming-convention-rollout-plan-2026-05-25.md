# Packages Naming Convention Rollout Plan

Date: 2026-05-25

## Overview

Rename all 32 active workspace packages in one coordinated cutover so every package directory follows `packages/universo-react-<name>/` and every package name follows `@universo-react/<name>`.

This is a mechanical workspace identity rollout, not a domain behavior rewrite. The implementation must preserve package boundaries, dependency graph semantics, build artifacts, runtime routes, database schemas, metahub templates, and application behavior. There is no compatibility layer: no aliases, symlinks, re-export packages, or old `@universo/*` imports.

## Research And Planning Inputs

- Local mode rules: `.gemini/rules/custom_modes/plan_mode.md`.
- Architecture skill: `.agents/skills/universo-platform-architecture/SKILL.md`.
- Runtime UI skills: `.agents/skills/mui-runtime-ux-patterns/SKILL.md`, `.agents/skills/runtime-ux-qa`.
- Playwright skill: `.agents/skills/playwright-best-practices/SKILL.md`.
- Turborepo skill: `.agents/skills/turborepo/SKILL.md`.
- Steering rules: `.kiro/steering/recommendations.md`, `.kiro/steering/structure.md`, `.kiro/steering/pnpm-not-npm.md`.
- Current Memory Bank: `memory-bank/tasks.md`, `memory-bank/techContext.md`, `memory-bank/systemPatterns.md`.
- Context7 documentation:
  - pnpm workspace/filtering docs: workspace protocol dependencies must point to package names that exist in the workspace; `pnpm --filter <package_selector>` uses package selectors.
  - Turborepo docs: workspace dependency names drive task graph ordering; `package.json` and root lockfile changes invalidate cache inputs.
- Subagent findings:
  - Source/config risk map for lazy imports, deep subpath imports, Vite/Vitest aliases, mocks, module compiler allowlist, and fixture strings.
  - CI/tooling/docs risk map for root scripts, E2E env paths, Jest module mappers, local Supabase helpers, docs, steering, and skills.
  - Verification matrix for pnpm, Turbo, Jest, Vitest, Playwright, local Supabase, and frozen lockfile behavior.

No external web search artifact is required because the task is repository-local. Current package-manager behavior was checked through Context7 official docs.

## Current Package Inventory

The current workspace has 32 packages:

| Current directory | Current package | New directory | New package |
| --- | --- | --- | --- |
| `admin-backend` | `@universo/admin-backend` | `universo-react-admin-backend` | `@universo-react/admin-backend` |
| `admin-frontend` | `@universo/admin-frontend` | `universo-react-admin-frontend` | `@universo-react/admin-frontend` |
| `applications-backend` | `@universo/applications-backend` | `universo-react-applications-backend` | `@universo-react/applications-backend` |
| `applications-frontend` | `@universo/applications-frontend` | `universo-react-applications-frontend` | `@universo-react/applications-frontend` |
| `apps-template-mui` | `@universo/apps-template-mui` | `universo-react-apps-template-mui` | `@universo-react/apps-template-mui` |
| `auth-backend` | `@universo/auth-backend` | `universo-react-auth-backend` | `@universo-react/auth-backend` |
| `auth-frontend` | `@universo/auth-frontend` | `universo-react-auth-frontend` | `@universo-react/auth-frontend` |
| `extension-sdk` | `@universo/extension-sdk` | `universo-react-extension-sdk` | `@universo-react/extension-sdk` |
| `metahubs-backend` | `@universo/metahubs-backend` | `universo-react-metahubs-backend` | `@universo-react/metahubs-backend` |
| `metahubs-frontend` | `@universo/metahubs-frontend` | `universo-react-metahubs-frontend` | `@universo-react/metahubs-frontend` |
| `metapanel-frontend` | `@universo/metapanel-frontend` | `universo-react-metapanel-frontend` | `@universo-react/metapanel-frontend` |
| `migration-guard-shared` | `@universo/migration-guard-shared` | `universo-react-migration-guard-shared` | `@universo-react/migration-guard-shared` |
| `modules-engine` | `@universo/modules-engine` | `universo-react-modules-engine` | `@universo-react/modules-engine` |
| `profile-backend` | `@universo/profile-backend` | `universo-react-profile-backend` | `@universo-react/profile-backend` |
| `profile-frontend` | `@universo/profile-frontend` | `universo-react-profile-frontend` | `@universo-react/profile-frontend` |
| `schema-ddl` | `@universo/schema-ddl` | `universo-react-schema-ddl` | `@universo-react/schema-ddl` |
| `start-backend` | `@universo/start-backend` | `universo-react-start-backend` | `@universo-react/start-backend` |
| `start-frontend` | `@universo/start-frontend` | `universo-react-start-frontend` | `@universo-react/start-frontend` |
| `universo-api-client` | `@universo/api-client` | `universo-react-api-client` | `@universo-react/api-client` |
| `universo-block-editor` | `@universo/block-editor` | `universo-react-block-editor` | `@universo-react/block-editor` |
| `universo-core-backend` | `@universo/core-backend` | `universo-react-core-backend` | `@universo-react/core-backend` |
| `universo-core-frontend` | `@universo/core-frontend` | `universo-react-core-frontend` | `@universo-react/core-frontend` |
| `universo-database` | `@universo/database` | `universo-react-database` | `@universo-react/database` |
| `universo-i18n` | `@universo/i18n` | `universo-react-i18n` | `@universo-react/i18n` |
| `universo-migrations-catalog` | `@universo/migrations-catalog` | `universo-react-migrations-catalog` | `@universo-react/migrations-catalog` |
| `universo-migrations-core` | `@universo/migrations-core` | `universo-react-migrations-core` | `@universo-react/migrations-core` |
| `universo-migrations-platform` | `@universo/migrations-platform` | `universo-react-migrations-platform` | `@universo-react/migrations-platform` |
| `universo-rest-docs` | `@universo/rest-docs` | `universo-react-rest-docs` | `@universo-react/rest-docs` |
| `universo-store` | `@universo/store` | `universo-react-store` | `@universo-react/store` |
| `universo-template-mui` | `@universo/template-mui` | `universo-react-template-mui` | `@universo-react/template-mui` |
| `universo-types` | `@universo/types` | `universo-react-types` | `@universo-react/types` |
| `universo-utils` | `@universo/utils` | `universo-react-utils` | `@universo-react/utils` |

## Affected Areas

- `packages/*/package.json`: `name`, workspace dependency keys, peer/dev/optional dependency keys.
- All TypeScript/JavaScript imports in `packages/**` and `tools/**`, including deep subpaths.
- Runtime dynamic imports and i18n side-effect imports in `universo-react-core-frontend`.
- Vite config, Vitest configs, Jest base mapper, TypeScript paths, ESLint overrides.
- Root `package.json` scripts and dependencies.
- `vitest.workspace.ts`.
- Local Supabase and E2E env path helpers under `tools/local-supabase/**` and `tools/testing/e2e/**`.
- `tools/lint-db-access.mjs`, `tools/testing/check-runtime-no-lms-forks.mjs`, `tools/check-no-package-base-paths.mjs`.
- OpenAPI generation source paths in `universo-react-rest-docs`.
- Module compiler allowlist and authored module source strings: `@universo/extension-sdk` becomes `@universo-react/extension-sdk`.
- Seeded metahub template module source, committed snapshot fixtures, E2E fixtures, and module authoring tests.
- `.github/workflows/**`, `.github/instructions/**`, `.github/agents/**`.
- `.kiro/steering/**`.
- `AGENTS.md`, `.gemini/**`, `.qoder/**`, `.claude/**` where tracked files contain active package naming guidance.
- `.manager/specs/**`, `.manager/projects/**`, `.manager/ecosystem/**`, and `.manager/prompts/**`; only exact archived files listed in the rename-audit allowlist may retain historical old names.
- `.codex/agents/**` tracked subagent definitions and reviewer prompts.
- `.vscode/tasks.json` and other tracked IDE/task runner configs.
- `.dockerignore`, Docker/deploy ignore rules, and tracked env examples that mention package paths.
- `.agents/skills/**` project-local references.
- `README.md`, `README-RU.md`, package READMEs, `docs/en/**`, `docs/ru/**`, `memory-bank/**`.
- `packages/**/public/**` and other shipped static assets/comments that contain package paths.
- `pnpm-lock.yaml`, regenerated after the rename.

## Non-Goals And Guardrails

- Do not preserve old `@universo/*` imports.
- Do not create npm alias packages, symlinks, or compatibility re-export packages.
- Do not change runtime route paths, API contracts, database schemas, migration versions, metahub template versions, or seeded domain data beyond package/import strings.
- Do not merge/split packages.
- Do not introduce package version bumps solely for compatibility.
- Do not publish anything to the public npm registry.
- Do not run `pnpm dev`; use build and Playwright wrapper commands.
- Do not rewrite archived Memory Bank plans/research wholesale. Update current Memory Bank context and the new rollout plan/progress only.

## Implementation Plan

### Phase 0: Baseline And Worktree Safety

- [ ] Confirm the worktree state with `git status --short`; record unrelated existing changes and avoid reverting them.
- [ ] Confirm the toolchain:

```bash
node -v
pnpm -v
pnpm exec turbo --version
```

- [ ] Capture current workspace inventory:

```bash
pnpm -r list --depth -1
find packages -maxdepth 2 -name package.json -print | sort
```

- [ ] Capture the pre-rename dependency graph and manifest dependency sections so the rollout can prove that package identities changed but dependency edges did not:

```bash
mkdir -p memory-bank/implementation
pnpm -r list --depth -1 --json > memory-bank/implementation/packages-naming-pre-rename-workspace-list.json
node tools/collect-workspace-dependency-graph.mjs \
  --out memory-bank/implementation/packages-naming-pre-rename-dependency-graph.json
```

If the helper does not exist yet, implement it as a small manifest parser that reads every workspace `package.json` and records `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies` by package name, dependency section, and range. It must not infer edges from source imports.

- [ ] Run pre-rename static inventory for old names:

```bash
rg -n "@universo/|packages/(admin-|applications-|apps-template-mui|auth-|extension-sdk|metahubs-|metapanel-|migration-guard-shared|modules-engine|profile-|schema-ddl|start-|universo-)" \
  AGENTS.md package.json pnpm-lock.yaml pnpm-workspace.yaml vitest.workspace.ts turbo.json tsconfig.json .dockerignore \
  .github .kiro .agents .codex .gemini .qoder .claude .manager .vscode tools docs memory-bank packages \
  --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/.turbo/**' --glob '!**/coverage/**'
```

### Phase 1: Build A Deterministic Rename Ledger

- [ ] Create an implementation-local rename ledger from actual package manifests instead of hand-maintained strings.
- [ ] Use the same transformation for directory names and npm names:
  - Directory: strip one leading `universo-` if present, then prefix `universo-react-`.
  - Package: replace `@universo/<name>` with `@universo-react/<name>`.
- [ ] Fail on duplicate new names or unexpected non-`@universo/*` workspace names before moving files.

Example safe mapping logic:

```js
const toNewDirectoryName = (directoryName) => {
  const baseName = directoryName.startsWith('universo-')
    ? directoryName.slice('universo-'.length)
    : directoryName
  return `universo-react-${baseName}`
}

const toNewPackageName = (packageName) => {
  if (!packageName.startsWith('@universo/')) {
    throw new Error(`Unexpected workspace package name: ${packageName}`)
  }
  return packageName.replace(/^@universo\//, '@universo-react/')
}
```

- [ ] Store the final ledger in the implementation notes or generated verification output so reviewers can audit every mapping.
- [ ] Write the machine-readable ledger to `memory-bank/implementation/packages-naming-ledger.json`.
- [ ] Emit two machine-readable lists from the ledger for later guards:
  - exact old package names, for example `@universo/types`;
  - exact old package-relative paths, for example `packages/universo-types/` and `packages/universo-types`.
- [ ] Create an explicit allowlist file at `memory-bank/implementation/packages-naming-legacy-reference-allowlist.json`. It must use exact file paths, not broad globs, and must classify every permitted legacy reference into one of these categories:
  - `rollout_audit_artifacts`: this rollout plan, the manager rollout spec/brief, generated rename ledger, final implementation/QA evidence;
  - `historical_memory_bank`: exact archived Memory Bank files retained as history, if any;
  - `generated_regenerated`: exact generated files that still contain old names before regeneration and are regenerated during the rollout.

These files must not contain old names as active instructions, commands, imports, filters, or examples. Old names are allowed only in clearly labeled mapping/evidence sections.

Do not use a broad post-rename path pattern like `packages/universo-`, because it also matches valid new paths such as `packages/universo-react-types`.

### Phase 2: Move Package Directories

- [ ] Move every active package directory with `git mv` using the ledger.
- [ ] Preserve ignored local env files by moving the package directories as a whole, especially:
  - `packages/universo-react-core-backend/.env`
  - `packages/universo-react-core-backend/.env.e2e`
  - any local Supabase `.env.*local-supabase` files.
- [ ] Do not move generated `dist/`, `build/`, `.turbo/`, or `coverage/` as meaningful source; clean or regenerate them if they appear in the tracked change set.

### Phase 3: Update Workspace Manifests And Dependency Graph

- [ ] Update all `packages/universo-react-*/package.json` `name` fields to `@universo-react/*`.
- [ ] Update every workspace dependency key in `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`.
- [ ] Preserve existing `workspace:*`, `workspace:^`, and peer range semantics unless the existing range explicitly references the old package name.
- [ ] Update root `package.json` dependency keys and scripts:
  - `pnpm --filter @universo/types` → `pnpm --filter @universo-react/types`
  - `pnpm --filter @universo/migrations-platform` → `pnpm --filter @universo-react/migrations-platform`
  - core backend/frontend env paths to new directories.
- [ ] Preserve dependency section and range semantics for every renamed edge. A dependency that was in `devDependencies` must not move to `dependencies`; `workspace:*`, `workspace:^`, and peer ranges must stay semantically equivalent.
- [ ] Keep `pnpm-workspace.yaml` as `packages/*`; no per-package path entries are needed.

### Phase 4: Update Source Imports And Runtime Module Strings

- [ ] Replace every code import from `@universo/*` to `@universo-react/*`, including:
  - bare imports: `@universo/types`
  - subpath imports: `@universo/utils/database`, `@universo/template-mui/components/dialogs`
  - dynamic imports: `import('@universo/metahubs-frontend/pages/...')`
  - CommonJS requires: `require('@universo/migrations-platform')`
  - test mocks: `vi.mock('@universo/template-mui')`, `jest.mock('@universo/store')`
  - TypeScript inline import types: `import('@universo/schema-ddl').EntityDefinition`.
- [ ] Update authored module source strings and compiler allowlists:
  - `packages/universo-react-modules-engine/src/compiler.ts`
  - `packages/universo-react-modules-engine/src/compiler.test.ts`
  - `packages/universo-react-metahubs-backend/src/domains/templates/data/lms.template.ts`
  - `packages/universo-react-metahubs-backend/src/domains/metahubs/services/SnapshotRestoreService.ts`
  - E2E specs and fixtures under `tools/testing/e2e/**`
  - committed snapshots under `tools/fixtures/**`.
- [ ] Update user-facing module documentation so new module authors import `@universo-react/extension-sdk`.

Example target code:

```ts
const ALLOWED_MODULE_IMPORTS = new Set(['@universo-react/extension-sdk'])
```

```ts
const LMS_ENROLLMENT_POSTING_MODULE_SOURCE = `import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'
// existing module body remains unchanged
`
```

### Phase 5: Update Build, Test, And Resolver Configs

- [ ] Update every `tsconfig*.json` paths map to new package names and directories.
- [ ] Update `vitest.workspace.ts` package config paths.
- [ ] Update package-local `vitest.config.ts` aliases that point at old sibling directories.
- [ ] Update package-local build/test configs that may contain explicit package names or sibling paths:
  - `packages/*/tsdown.config.ts`;
  - `packages/*/jest.config.js`;
  - any package-local `babel.config.*`, `craco.config.*`, `vite.config.*`, `vitest.config.*`, or test setup files found by the ledger scanner.
- [ ] Update `packages/universo-react-core-frontend/vite.config.js`:
  - `optimizeDeps.include`
  - `optimizeDeps.exclude`
  - `resolve.dedupe`
  - any manual alias/path entry.
- [ ] Update `tools/testing/backend/jest.base.config.cjs` `moduleNameMapper` and `transformIgnorePatterns`.
- [ ] Update `.eslintrc.js` package-specific overrides.
- [ ] Update `tools/testing/frontend/resolveWorkspacePackage.ts` only if package-name assumptions are embedded there.

Example target Jest mapper pattern:

```js
moduleNameMapper: {
  '^@universo-react/types$': path.join(repoRoot, 'packages/universo-react-types/src/index.ts'),
  '^@universo-react/types/(.*)$': path.join(repoRoot, 'packages/universo-react-types/src/$1')
}
```

### Phase 6: Update Tooling, Local Supabase, E2E, And OpenAPI Paths

- [ ] Update local Supabase helpers:
  - `tools/local-supabase/shared.mjs`
  - `tools/local-supabase/write-env.mjs`
  - `tools/local-supabase/__tests__/*.test.mjs`.
- [ ] Update E2E env loaders:
  - `tools/testing/e2e/support/env/load-e2e-env.mjs`
  - `tools/testing/e2e/README.md`
  - `tools/testing/e2e/README-RU.md`.
- [ ] Update DB access lint package scan directories in `tools/lint-db-access.mjs`.
- [ ] Update LMS fork guard scan directories in `tools/testing/check-runtime-no-lms-forks.mjs`.
- [ ] Extend or replace `tools/check-no-package-base-paths.mjs` with a new package naming guard:
  - fail if a workspace directory under `packages/` does not start with `universo-react-`;
  - fail if a workspace package name does not start with `@universo-react/`;
  - fail if legacy active references remain outside exact files and categories in `memory-bank/implementation/packages-naming-legacy-reference-allowlist.json`.
- [ ] Add or extend a concrete `apps-template-mui` isolation guard, exposed as `pnpm run check:apps-template-isolation`, that verifies:
  - `packages/universo-react-apps-template-mui/package.json` has no dependency, peer dependency, optional dependency, or dev dependency on `@universo-react/template-mui`, legacy feature packages, or old `@universo/*` names;
  - `packages/universo-react-apps-template-mui/src/**` has no imports from `@universo-react/template-mui`, legacy feature packages, or old `@universo/*` names;
  - package-local tests, fixtures, stories, examples, and config files do not contain active imports or developer-facing examples that break the same isolation rule;
  - shared infrastructure packages such as `@universo-react/types`, `@universo-react/utils`, `@universo-react/i18n`, and other already-approved shared packages remain allowed.
- [ ] Update OpenAPI source generation and verification:
  - `packages/universo-react-rest-docs/scripts/generate-openapi-source.js`
  - `packages/universo-react-rest-docs/scripts/verify-route-sources.js`
  - generated `packages/universo-react-rest-docs/src/openapi/index.yml`.
- [ ] Update shipped static/public references, including comments in `packages/universo-react-core-frontend/public/index.html`.
- [ ] Update Docker/deploy ignore rules, especially `.dockerignore` entries that protect backend/frontend `.env` files.

Example guard:

```js
for (const workspace of workspaces) {
  if (!workspace.directory.startsWith('universo-react-')) {
    throw new Error(`Workspace directory violates naming convention: ${workspace.directory}`)
  }
  if (!workspace.packageName.startsWith('@universo-react/')) {
    throw new Error(`Workspace package violates naming convention: ${workspace.packageName}`)
  }
}
```

### Phase 7: Update CI And Agent Guidance

- [ ] Update `.github/workflows/**` only where hardcoded package names, paths, filters, or cache keys appear.
- [ ] Keep broad path globs like `packages/**/README.md`; they remain valid.
- [ ] Update `.github/instructions/**` and `.github/agents/**` examples from `@universo/*` and old package paths.
- [ ] Update tracked `.codex/agents/**` reviewer/subagent definitions when they mention old package names, old package paths, or package-specific filters.
- [ ] Update active root and hidden agent instructions that are used by local tooling:
  - `AGENTS.md`;
  - `.gemini/GEMINI.md`;
  - `.gemini/rules/**`;
  - `.gemini/agents/**` where active guidance contains package paths;
  - `.qoder/rules/**`;
  - `.qoder/agents/**` where active guidance contains package paths;
  - `.claude/**` where active guidance contains package paths.
- [ ] Update tracked IDE/task configs such as `.vscode/tasks.json`.
- [ ] Update `.manager/specs/**`, `.manager/projects/**`, `.manager/ecosystem/**`, and `.manager/prompts/**` wherever files are active current guidance or current planning context. Historical files may keep old examples only when their exact path is present in `memory-bank/implementation/packages-naming-legacy-reference-allowlist.json`.
- [ ] Update `.kiro/steering/structure.md` with a new `Package Naming Convention` section:
  - directory: `packages/universo-react-<name>/`;
  - npm name: `@universo-react/<name>`;
  - legacy `universo-` flattening rule;
  - no aliases or compatibility packages.
- [ ] Update `.kiro/steering/recommendations.md` workspace import examples to `@universo-react/types`.
- [ ] Update `.kiro/steering/tech.md` and `.kiro/steering/pnpm-not-npm.md` package paths.
- [ ] Update project-local skills and references:
  - `.agents/skills/universo-platform-architecture/**`
  - `.agents/skills/mui-runtime-ux-patterns/**`
  - `.agents/skills/playwright-best-practices/**`
  - leave generic third-party skill examples unchanged unless they reference this repository specifically.

### Phase 8: Update Documentation And GitBook Content

- [ ] Update root `README.md` and `README-RU.md`.
- [ ] Update every package README and README-RU if present.
- [ ] Update GitBook docs in `docs/en/**` and `docs/ru/**` with EN/RU parity where matching localized files exist:
  - architecture package names;
  - getting-started env paths;
  - browser E2E paths;
  - system app schema paths;
  - REST docs package filters;
  - module authoring examples.
- [ ] Update `memory-bank/techContext.md` with the new package naming convention.
- [ ] Update `memory-bank/systemPatterns.md` if a reusable rename/guard pattern is added.
- [ ] Update `memory-bank/projectbrief.md`, `memory-bank/activeContext.md`, and `memory-bank/progress.md` with current facts.
- [ ] Do not mass-edit old archived plan/research files unless they are used as active current context.

### Phase 9: Regenerate Lockfile And Workspace Links

- [ ] Run a clean root install from the repository root:

```bash
pnpm install
pnpm install --frozen-lockfile
```

- [ ] Confirm `pnpm-lock.yaml` importer keys use new package paths and `@universo-react/*` dependency keys.
- [ ] Confirm old workspace package names are not present in active lockfile importers or root/package manifests.
- [ ] Capture the post-install workspace list and dependency graph using the same helper and output shape as Phase 0:

```bash
pnpm -r list --depth -1 --json > memory-bank/implementation/packages-naming-post-rename-workspace-list.json
node tools/collect-workspace-dependency-graph.mjs \
  --out memory-bank/implementation/packages-naming-post-rename-dependency-graph.json
```

### Phase 10: Static Fail-Closed Checks

- [ ] Run the package naming guard.
- [ ] Run old scope/path residue checks. The implementation should intentionally whitelist only exact historical or audit files recorded in `memory-bank/implementation/packages-naming-legacy-reference-allowlist.json`.
- [ ] Use a tracked-file scanner based on `git ls-files`, the Phase 1 ledger, and the explicit allowlist file. The scanner must:
  - scan active tracked files, including dot-directories such as `.gemini`, `.qoder`, `.claude`, `.vscode`, `.manager`, `.github`, `.kiro`, and root files such as `AGENTS.md`, `.dockerignore`, and `pnpm-workspace.yaml`;
  - scan `.codex/agents/**` because tracked subagent definitions can become stale active guidance;
  - skip generated/cache/build outputs such as `dist/**`, `build/**`, `.turbo/**`, `coverage/**`, and generated artifacts only when they are untracked or explicitly regenerated in the same rollout;
  - fail on exact old package names from the ledger;
  - fail on exact old package paths from the ledger;
  - permit old names only in exact files listed in `memory-bank/implementation/packages-naming-legacy-reference-allowlist.json`;
  - permit old names in `rollout_audit_artifacts` only when the match is inside an explicit old/new mapping or evidence block;
  - permit old names in `historical_memory_bank` only when the file is archived historical context, not current guidance;
  - permit old names in `generated_regenerated` only when the file was regenerated in this rollout and the remaining old reference is documented as unavoidable historical data;
  - fail if a rename-audit artifact uses an old name as a live command, import, filter, dependency, or current guidance example;
  - avoid broad `packages/universo-` matching because valid new names start with `packages/universo-react-`.

```bash
git ls-files -z \
  | node tools/check-package-naming-convention.mjs \
      --from-ledger memory-bank/implementation/packages-naming-ledger.json \
      --allowlist memory-bank/implementation/packages-naming-legacy-reference-allowlist.json \
      --stdin0
```

The exact script name can differ, but the implementation must provide an equivalent fail-closed ledger-based guard.

- [ ] Compare the pre/post dependency graph through the rename ledger. This must fail on:
  - added or removed workspace dependency edges;
  - a dependency moving between `dependencies`, `devDependencies`, `peerDependencies`, or `optionalDependencies`;
  - changed range semantics, except direct package-name substitutions required by the rename;
  - missing packages or extra packages after mapping old identities to new identities.

```bash
node tools/compare-workspace-dependency-graph.mjs \
  --ledger memory-bank/implementation/packages-naming-ledger.json \
  --before memory-bank/implementation/packages-naming-pre-rename-dependency-graph.json \
  --after memory-bank/implementation/packages-naming-post-rename-dependency-graph.json
```

- [ ] Run repo-specific static checks:

```bash
pnpm run check:no-package-base-paths
pnpm run check:apps-template-isolation
pnpm run check:catalog-versions
node tools/lint-db-access.mjs
pnpm run docs:i18n:check
pnpm run docs:gitbook-screenshot-assets:check
pnpm run docs:lms-user-guide:check
pnpm --filter @universo-react/rest-docs generate:openapi
pnpm --filter @universo-react/rest-docs verify:route-sources
pnpm --filter @universo-react/rest-docs validate
```

### Phase 11: Build And Unit Test Matrix

- [ ] Verify workspace package discovery:

```bash
pnpm -r list --depth -1
```

- [ ] Run focused builds for critical graph roots after rename:

```bash
pnpm --filter @universo-react/types build
pnpm --filter @universo-react/utils build
pnpm --filter @universo-react/modules-engine test
pnpm --filter @universo-react/metahubs-backend test -- --runInBand
pnpm --filter @universo-react/applications-backend test -- --runInBand
pnpm --filter @universo-react/core-frontend build
pnpm --filter @universo-react/core-backend build
```

- [ ] Run full workspace validation:

```bash
pnpm build
pnpm lint
pnpm run test:vitest
pnpm exec turbo run test
```

- [ ] Run fixture/module contract checks:

```bash
pnpm run check:runtime-no-lms-forks
pnpm run check:lms-fixture-contract
```

- [ ] Run OpenAPI/package docs verification:

```bash
pnpm --filter @universo-react/rest-docs build
pnpm --filter @universo-react/rest-docs validate
```

### Phase 12: Playwright, Supabase, And Runtime UX Evidence

- [ ] Use the Playwright wrapper, not `pnpm dev`.
- [ ] Run local minimal Supabase validation unconditionally for this rollout because local-Supabase env paths are being renamed. Hosted E2E may be additional evidence, but it does not prove local path rewrites.
- [ ] For local minimal Supabase:

```bash
docker info
pnpm exec supabase --version
pnpm run test:local-supabase:tools
pnpm supabase:e2e:stop
pnpm supabase:e2e:start:minimal
pnpm supabase:e2e:status
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
```

If Docker or the Supabase CLI is unavailable, record it as an implementation blocker for this rollout. Do not replace this with hosted Supabase evidence, because hosted tests do not validate renamed local env paths and helper scripts.

- [ ] Run E2E build and local minimal smoke:

```bash
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

- [ ] Run the broad browser/runtime flows after local smoke passes:

```bash
pnpm run test:e2e:flows:local-supabase
pnpm run test:e2e:full:local-supabase
pnpm supabase:e2e:stop
```

- [ ] If hosted E2E credentials are available, also run hosted smoke/full as a second environment proof:

```bash
pnpm run build:e2e
pnpm run test:e2e:smoke
pnpm run test:e2e:full
```

- [ ] Capture and inspect screenshots for runtime shell and published application surfaces. This is mandatory, not "where applicable":
  - core shell loads;
  - metahub list/detail navigation loads lazy frontend packages;
  - application list/detail navigation loads lazy frontend packages;
  - published app runtime opens without blank screens;
  - module authoring examples compile with `@universo-react/extension-sdk`;
  - no page-level horizontal overflow.
- [ ] Map the existing Playwright specs, or add narrow smoke specs if coverage is missing, for supported lifecycle paths that exercise renamed lazy packages and dialogs:
  - metahub create, edit/settings, copy/import where supported, and delete/archive where supported;
  - application create, edit/settings/access, copy/publish where supported, and delete/archive where supported;
  - runtime row create, edit, copy/duplicate where supported, and delete where supported;
  - module authoring save/compile/execute path for seeded LMS/basic-demo modules.
- [ ] Use runtime UX oracles in Playwright evidence, either existing helpers or equivalent assertions:
  - no raw UUID-only business labels or user-facing technical IDs;
  - no raw JSON, `[object Object]`, object cells, or internal field names in normal table/card surfaces;
  - semantic long-text fields such as descriptions, content, resource notes, and template/module source editors remain multiline controls in dialogs/forms;
  - no raw i18n keys or internal validation text in EN/RU surfaces;
  - no page-level horizontal overflow; constrained DataGrid/table scroll is allowed only inside its intended container;
  - keyboard navigation can reach the main route entry points and dialogs without traps;
  - screenshots/traces are saved or listed in the implementation report.
- [ ] Run the browser proof across at least these viewports:
  - desktop `1920x1080`;
  - tablet `768x1024`;
  - mobile `390x844`.
- [ ] Run EN and RU locale checks for visible runtime surfaces.

## UI Contract

This rollout does not add or redesign MUI controls, dialogs, tables, or cards. The UI risk is runtime loading: renamed packages can break dynamic imports, side-effect i18n registration, Vite prebundling, and module-authored code compilation.

### Core Shell

- Controls: existing navigation/sidebar/header controls only; no new UI primitives.
- Display values: user-facing route labels remain localized in EN/RU; no raw package names are visible except in developer/admin documentation surfaces.
- Hidden/system fields: unchanged.
- Validation: login/session and route-guard messages remain localized.
- Responsive proof: desktop/tablet/mobile screenshots must show no blank shell and no page-level horizontal overflow.
- Keyboard proof: main navigation and route entry points are reachable without traps.

### Metahub Management Surfaces

- Controls: existing MUI dashboard/list/detail/dialog primitives.
- Display values: metahub names, localized codenames, statuses, and actions remain user-facing; no UUID-only labels, raw object cells, or raw JSON.
- Hidden/system fields: internal ids remain hidden or formatted as admin/debug-only where already designed.
- Validation: create/edit/delete/module errors remain localized and user-facing.
- Responsive proof: list/detail/dialog surfaces fit desktop/tablet/mobile without page-level overflow.

### Application Management Surfaces

- Controls: existing application list/detail/settings/access primitives.
- Display values: application names, visibility/status, workspace labels, and actions remain user-facing; no raw IDs/JSON/object cells.
- Hidden/system fields: internal application/workspace ids remain hidden from normal workflows.
- Validation: access/settings/runtime-sync errors remain localized.
- Responsive proof: list/detail/settings surfaces pass desktop/tablet/mobile viewport checks.

### Published Runtime And `apps-template-mui`

- Controls: existing published app dashboard, cards, tables, widgets, and workspace navigation.
- Display values: runtime rows, page blocks, widget labels, and workspace labels remain user-facing; raw ids/JSON/internal field names are blocking defects.
- Isolation: `apps-template-mui` must not gain dependencies on legacy template/feature packages after rename; prove this with package dependency/import guards.
- Responsive proof: published runtime opens on desktop/tablet/mobile, no blank screen, no unintended page-level overflow.
- Keyboard proof: dashboard navigation and primary runtime actions are reachable.

### Module Authoring And Runtime Module Execution

- Controls: existing module editor/authoring surfaces.
- Display values: examples and generated template code use `@universo-react/extension-sdk`.
- Error states: compile failures must show localized/user-facing errors without raw stack traces or hidden internal import traces on normal surfaces.
- Runtime proof: seeded LMS/basic-demo modules and snapshot-imported modules compile and execute under the new SDK import allowlist.

- Blocking UX failures:
  - blank runtime shell after lazy import;
  - raw i18n keys due to missed side-effect import rename;
  - raw JSON/object cells caused by broken shared renderer import;
  - raw UUID-only labels, raw user/owner/reference ids, or hidden-knowledge workflows on normal user surfaces;
  - horizontal overflow introduced by missing stylesheet/template import;
  - module editor examples showing stale `@universo/extension-sdk` imports;
  - unlocalized module compiler errors or raw stack traces in normal UI.

## Plan UX Reviewer Checklist

- [ ] Does the plan avoid introducing new one-off MUI primitives? Yes; it preserves existing screens and validates runtime loading.
- [ ] Does the plan include browser evidence rather than assuming the UI works? Yes; Playwright smoke/full flows and screenshots are required.
- [ ] Does the plan block raw IDs, raw JSON/object cells, and raw i18n keys? Yes; these are listed as blocking UX failures.
- [ ] Does the plan block long-text regressions? Yes; semantic description/content/resource/module-source fields must remain multiline in dialogs/forms.
- [ ] Does the plan preserve `apps-template-mui` isolation? Yes; it updates names but does not add dependencies from runtime app template to legacy template/feature packages.
- [ ] Does the implementation prove `apps-template-mui` isolation? Require static dependency/import guard evidence after rename.
- [ ] Does the implementation prove no new UI primitive bypass was introduced? Require either no UI source changes beyond package/import strings, or a static diff review listing any touched MUI runtime source files and confirming they only changed import specifiers/package paths.
- [ ] Does the plan avoid `pnpm dev`? Yes; it uses build and Playwright wrapper commands.

## Potential Challenges

- `@universo-react/extension-sdk` is both a workspace package and an authored-code import allowed by the module compiler. Missing this produces metahubs whose modules fail compilation after creation/import.
- `migration-guard-shared` is a pure shared package despite the new react scope. The rollout should rename it mechanically for consistency; do not split it in this PR unless a separate architecture decision is made.
- Vite and Vitest aliases combine npm specifiers and sibling directory paths. Both sides must change together.
- Backend Jest uses explicit `moduleNameMapper` paths. Missing this can make backend tests pass in build but fail in Jest.
- Local Supabase and E2E env paths are string-heavy and covered by tests; update tests with implementation.
- OpenAPI generated source comments include package paths; regenerate or update the generated file after source path changes.
- Historical Memory Bank plans contain many old package names. Mass rewriting them would corrupt history; current context and public tracked docs are the priority.
- `pnpm-lock.yaml` must be regenerated after manifest changes. CI docs workflows use frozen lockfile checks.

## Acceptance Criteria

- [ ] Every active package directory is `packages/universo-react-<name>/`.
- [ ] Every workspace package manifest uses `@universo-react/<name>`.
- [ ] No active source/config/tooling/doc references to `@universo/*` remain outside exact files and categories in `memory-bank/implementation/packages-naming-legacy-reference-allowlist.json`.
- [ ] No active source/config/tooling/doc references to old `packages/<legacy>` directories remain outside exact files and categories in `memory-bank/implementation/packages-naming-legacy-reference-allowlist.json`.
- [ ] Current rollout audit artifacts may contain old names only in structured `old -> new` mapping/evidence blocks, never as live instructions, commands, imports, filters, or current examples.
- [ ] `pnpm install` and `pnpm install --frozen-lockfile` pass from the root.
- [ ] `pnpm build` passes from the root.
- [ ] `pnpm lint`, `pnpm run test:vitest`, and `pnpm exec turbo run test` pass or any unrelated pre-existing failures are documented with evidence.
- [ ] Local Supabase minimal E2E path is validated unconditionally.
- [ ] Local Supabase preflight passes: `docker info`, `pnpm exec supabase --version`, `pnpm run test:local-supabase:tools`, `pnpm supabase:e2e:status`, and clean `pnpm supabase:e2e:stop`; missing Docker/Supabase CLI is documented as a blocker, not replaced with hosted E2E.
- [ ] OpenAPI generation, route-source verification, validation, and package build pass for `@universo-react/rest-docs`.
- [ ] Playwright smoke/full runtime evidence proves core shell, management pages, module authoring, and published app runtime are not blank and have no page-level horizontal overflow.
- [ ] Browser evidence maps supported create/edit/copy/delete lifecycle flows for metahubs, applications, runtime rows, and module authoring to existing or added Playwright specs.
- [ ] Browser evidence covers EN/RU visible surfaces, desktop/tablet/mobile viewports, keyboard navigation, no raw IDs, no raw JSON/object cells, no raw i18n keys, multiline semantic long-text fields, and no internal validation/stack text on normal user surfaces.
- [ ] `apps-template-mui` isolation is proven by `pnpm run check:apps-template-isolation` dependency/import guard evidence after rename.
- [ ] UI source diffs are mechanical package/import/path rewrites only; any touched MUI runtime source file is listed in the implementation report with confirmation that no new one-off UI primitives or interfaces were introduced.
- [ ] Pre/post dependency graph comparison passes through the rename ledger: no added/deleted workspace edges, no dependency-section drift, and no changed range semantics beyond the package-name substitution.
- [ ] `memory-bank/implementation/packages-naming-legacy-reference-allowlist.json` exists, uses exact file paths, and contains only `rollout_audit_artifacts`, `historical_memory_bank`, or `generated_regenerated` entries.
- [ ] `.kiro/steering/structure.md` and `memory-bank/techContext.md` publish the new naming convention.
- [ ] Root README, GitBook docs, package READMEs, steering rules, root/hidden agent rules, `.codex/agents/**`, manager active context, tracked IDE tasks, Docker ignore rules, public asset comments, and project-local skills use the new names.
