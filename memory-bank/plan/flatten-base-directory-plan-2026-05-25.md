# Flatten Base Directory Plan

Date: 2026-05-25
Research: [flatten-base-directory-research-2026-05-25.md](../research/flatten-base-directory-research-2026-05-25.md)

## Overview

Flatten all package roots that currently live under `packages/<name>/base` so
each package follows the standard workspace layout:
`packages/<name>/package.json`. Keep package names, versions, public exports,
source structure, schemas, migrations, and metahub template versions unchanged.

This is a mechanical monorepo-layout migration, but it touches almost every
build, test, runtime, E2E, documentation, and developer-tooling path. The
implementation must therefore be done as a single coordinated branch with
preflight inventories and fail-closed residue checks.

## Affected Areas

- Package roots under `packages/`.
- `pnpm-workspace.yaml`, root `package.json` workspace globs and scripts, and
  `pnpm-lock.yaml`.
- Root `turbo.json` and package-local `turbo.json` files.
- Package-local `tsconfig.json`, `vitest.config.ts`, `jest.config.js`,
  `vite.config.js`, package-local `.eslintrc.js`, and package `package.json`
  metadata.
- Test harnesses:
  `vitest.workspace.ts`, `tools/testing/backend/jest.base.config.cjs`,
  `tools/testing/e2e/**`, Playwright wrappers, and local Supabase tooling.
- Repository tools: DB access linting, OpenAPI source verification, docs
  checkers, runtime UX/LMS invariant scanners, package scripts, and CI
  workflows/instructions.
- Repository-level ignore and lint metadata: `.dockerignore`, `.eslintrc.js`,
  root `.gitignore`, and package-level `.gitignore` / `.npmignore` files.
- Documentation: root READMEs, `packages/README*`, package READMEs,
  `.github/instructions/**`, `.gemini/**`, active `.agents/skills/**`,
  `AGENTS.md`, and GitBook docs under `docs/en` and `docs/ru`.
- Historical Memory Bank files are reference history and should not be bulk
  rewritten. New Memory Bank entries must use the flattened paths.

## Plan Steps

- [ ] 1. Preflight the live package inventory.
  - Re-run `find packages -mindepth 1 -maxdepth 1 -type d` and
    `find packages -path '*/base/package.json'`.
  - Confirm the current live count. On 2026-05-25 the checkout has 32 package
    directories, 30 `base` packages, and 2 already-flat packages
    (`apps-template-mui`, `universo-rest-docs`), which differs from the brief.
  - Fail the implementation if any package has a sibling implementation
    directory next to `base/` that would be overwritten.

- [ ] 2. Create an implementation ledger before moving files.
  - Record the exact package list.
  - Record the planned moved paths.
  - Record generated directories to ignore (`node_modules`, `.turbo`, `dist`,
    `build`, `coverage`).
  - Record tracked dotfiles under `base/` that must move with `git mv`, such as
    `.env.example`, `.env.e2e.example`, `.npmignore`, and package-local
    `.gitignore` files.
  - Record ignored local profile files under `base/` before moving, especially
    backend/frontend `.env`, `.env.e2e`, `.env.local`, `.env.local-supabase`,
    and `.env.e2e.local-supabase`. These files are intentionally ignored by
    git but still matter for local developer and E2E workflows.
  - Record generated or dependency artifacts under `base/` that must not be
    moved into source history: `node_modules`, `.turbo`, `dist`, `build`,
    `coverage`, `logs`, and package-local temp output.
  - Keep this ledger in Memory Bank or the implementation summary, not inside
    package source.

- [ ] 3. Move package contents with `git mv`.
  - For each `packages/<name>/base`, move every tracked child into
    `packages/<name>/` with `git mv`.
  - Move ignored local `.env*` profile files separately with `mv` only after
    recording them in the implementation ledger. Do not print secret values.
  - Delete generated/dependency artifacts under `base/` after confirming they
    are ignored or rebuildable: `node_modules`, `.turbo`, `dist`, `build`,
    `coverage`, and `logs`. Do not use destructive cleanup outside the package
    directories being flattened.
  - Remove the empty `base/` directory only after tracked files, ignored local
    profile files, and generated artifacts have been handled.
  - Do not touch the already-flat packages except for references that point to
    other moved packages.
  - Preserve dotfiles such as `.env.example`, package-local `.gitignore`, and
    `turbo.json`.

  Example tracked-file move helper:

  ```bash
  while IFS= read -r base_dir; do
    pkg_dir="$(dirname "$base_dir")"
    git ls-files -z "$base_dir" |
      while IFS= read -r -d '' tracked_file; do
        target="$pkg_dir/${tracked_file#"$base_dir/"}"
        mkdir -p "$(dirname "$target")"
        git mv "$tracked_file" "$target"
      done
  done < <(find packages -mindepth 2 -maxdepth 2 -type d -name base | sort)
  ```

- [ ] 4. Update workspace discovery and lockfile inputs.
  - Change `pnpm-workspace.yaml` to a single package glob:

    ```yaml
    packages:
        - 'packages/*'
    ```

  - Keep the existing `catalog`, `minimumReleaseAge`, `blockExoticSubdeps`,
    and `trustPolicy` settings unchanged.
  - Remove root `package.json` `"packages/*/base"` from `workspaces`.
  - Run `pnpm install` after path rewrites so `pnpm-lock.yaml` records the new
    importer paths.

- [ ] 5. Rewrite active path references with a scoped script, then review.
  - Rewrite root-relative strings:
    `packages/<name>/base/` -> `packages/<name>/`.
  - Rewrite package-relative strings after the move:
    `../../<name>/base/` -> `../<name>/` and
    `../../../packages/<name>/base/` -> `../../packages/<name>/`.
  - Rewrite generated path regexes such as `packages/.*/base/dist` to
    `packages/.*/dist`.
  - Exclude `node_modules`, `.git`, `dist`, `build`, `.turbo`, and `coverage`.
  - Treat `memory-bank/**` and `.manager/**` as historical unless a current
    active task/context file must be updated.
  - Do not only search for root-relative `packages/<name>/base`. Also fail on
    active relative references such as `../<name>/base`,
    `../../<name>/base`, `../../../packages/<name>/base`, `/base/src`,
    `/base/README*`, and `/base/package.json`.
  - Treat `.manager/**` as a mixed area: archived specs can remain historical,
    but operational project context such as `.manager/projects/**` must be
    explicitly classified and updated if MANAGER mode still consumes it after
    flattening.

  Example fail-closed path helper logic:

  ```js
  const activeFileGlobs = [
    'AGENTS.md',
    'README*.md',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'vitest.workspace.ts',
    '.dockerignore',
    '.eslintrc.js',
    '.gitignore',
    '.github/**/*.md',
    '.github/**/*.yml',
    '.gemini/**/*.md',
    '.agents/skills/**/*.md',
    '.manager/projects/**/*.md',
    'docs/**/*.md',
    'tools/**/*.{js,mjs,cjs,ts,md}',
    'packages/**/*.{json,js,mjs,cjs,ts,tsx,md,yml,yaml,html}'
  ]

  const rewrites = [
    [/packages\/\.\*\/base\/dist/g, 'packages/.*/dist'],
    [/\.\.\/([^/\s"'`)]+)\/base\//g, '../$1/'],
    [/packages\/([^/\s"'`)]+)\/base\//g, 'packages/$1/'],
    [/\.\.\/\.\.\/([^/\s"'`)]+)\/base\//g, '../$1/'],
    [/\.\.\/\.\.\/\.\.\/packages\/([^/\s"'`)]+)\/base\//g, '../../packages/$1/'],
    [/packages\/\.\*\/base/g, 'packages/*']
  ]
  ```

- [ ] 6. Fix root scripts and development entrypoints.
  - `start:default` and `start:windows` should `cd
    packages/universo-core-backend/bin`.
  - Worker scripts should use the same flattened backend bin path.
  - Local Supabase scripts should point
    `UNIVERSO_FRONTEND_ENV_FILE` to
    `packages/universo-core-frontend/.env.local-supabase`.
  - E2E scripts should point to
    `packages/universo-core-frontend/.env.e2e.local-supabase`.
  - Keep `pnpm dev` as a user-run command only; do not add automatic agent
    runs for it.
  - Update `.dockerignore` entries that currently point to backend/frontend
    `.env` files under `base/`.

- [ ] 7. Fix test harnesses and build tooling.
  - Update `vitest.workspace.ts` package config paths.
  - Update `tools/testing/backend/jest.base.config.cjs` moduleNameMapper paths
    and ignore patterns.
  - Update package-local Jest configs in backend packages.
  - Update package-local Vitest configs in frontend packages and
    `apps-template-mui`.
  - Update package-level `test` scripts that currently call
    `../../../tools/testing/backend/run-jest.cjs`; after the package root moves
    up one level, they should use the correct shallower relative path.
  - Update package-level Vitest imports that currently load shared frontend test
    helpers through `../../../tools/testing/frontend/*`.
  - Update Vite aliases in `universo-core-frontend`.
  - Update package-local `tsconfig.json` path aliases and includes.
  - Update package-local `tsconfig.json` `extends` values. Most packages that
    currently extend `../../../tsconfig.json` from `base/` will need
    `../../tsconfig.json` after flattening.
  - Update package-local `.eslintrc.js` files and their depth-sensitive
    `extends` values, for example `packages/universo-utils/.eslintrc.js`.
  - Update `.eslintrc.js` overrides that currently target
    `packages/*/base/src/**`.
  - Update hard-coded scanner paths such as
    `tools/testing/check-runtime-no-lms-forks.mjs`.
  - Update `repository.directory` metadata in package manifests, for example
    `packages/universo-i18n/base` -> `packages/universo-i18n`.
  - Move package-local `turbo.json` files with their packages, then update any
    depth-sensitive inputs such as `packages/universo-core-frontend/turbo.json`.

- [ ] 8. Fix local Supabase and Playwright E2E infrastructure.
  - Update `tools/testing/e2e/support/env/load-e2e-env.mjs`.
  - Update `tools/local-supabase/write-env.mjs`, `shared.mjs`, tests, and
    README files.
  - Use local minimal Supabase for E2E verification:
    `pnpm supabase:e2e:start:minimal`, `pnpm env:e2e:local-supabase`,
    `pnpm doctor:e2e:local-supabase`, then the wrapper-owned Playwright suite.
  - Do not run `pnpm dev`; use `tools/testing/e2e/run-playwright-suite.mjs`
    as the owner of app startup and cleanup.

- [ ] 9. Fix OpenAPI and documentation-source tooling.
  - Update `packages/universo-rest-docs/scripts/generate-openapi-source.js`.
  - Update `packages/universo-rest-docs/scripts/verify-route-sources.js`.
  - Regenerate or rewrite OpenAPI route source descriptions if the checker
    expects exact file paths.
  - Run the route-source verifier and docs checks after the path update.

- [ ] 10. Update documentation.
  - Update root `README.md` and `README-RU.md`.
  - Update `packages/README.md` and `packages/README-RU.md`.
  - Update package READMEs where they describe their own location or link to
    sibling package READMEs.
  - Update tool READMEs that document package paths, including
    `tools/testing/backend/README.md`, `tools/testing/e2e/README.md`, and
    `tools/testing/e2e/README-RU.md`.
  - Update active agent and mode instructions that encode package paths:
    `.gemini/GEMINI.md`, `.gemini/rules/**`, `.github/instructions/**`,
    `.github/agents/**`, `.github/FILE_NAMING.md`, and active
    `.agents/skills/**` files. These are operational instructions, not
    historical docs.
  - Update GitBook docs:
    `docs/en/architecture/monorepo-structure.md`,
    `docs/ru/architecture/monorepo-structure.md`,
    `docs/en/contributing/creating-packages.md`,
    `docs/ru/contributing/creating-packages.md`,
    `docs/en/contributing/development-setup.md`,
    `docs/ru/contributing/development-setup.md`,
    `docs/en/getting-started/configuration.md`,
    `docs/ru/getting-started/configuration.md`,
    `docs/en/guides/browser-e2e-testing.md`,
    `docs/ru/guides/browser-e2e-testing.md`, and
    `docs/*/guides/updating-system-app-schemas.md`.
  - Keep EN/RU structural parity for GitBook pages.
  - Update `.github/instructions/**` and `AGENTS.md` so future agents do not
    recreate `base/`.

- [ ] 11. Add or tighten migration-specific automated checks.
  - Add a repository check script such as `tools/check-no-package-base-paths.mjs`
    that fails when active source/tooling docs still contain
    `packages/*/base`, `packages/<name>/base`, relative `../<name>/base` /
    `../../<name>/base`, `/base/src`, `/base/README*`, or
    `/base/package.json`.
  - Include Windows/backslash variants such as `packages\\<name>\\base` and
    `..\\<name>\\base` in the residue check.
  - Scope the check away from historical Memory Bank, archived manager specs,
    generated fixture bundles, `node_modules`, and build outputs. Do not ignore
    `pnpm-lock.yaml` after `pnpm install`; stale lockfile importer or link paths
    are active workspace breakage.
  - Add a Vitest test for local Supabase path generation after flattening.
  - Add a focused Jest/Vitest check for backend Jest moduleNameMapper path
    resolution if existing harness coverage does not catch it.

  Example path-residue check:

  ```js
  const forbidden = /\bpackages\/[^/\s"'`)]+\/base\b|\bpackages\/\*\/base\b/
  const ignored = [
    /^memory-bank\/(plan|research|creative|archive)\//,
    /^\.manager\//,
    /^tools\/fixtures\//,
    /(^|\/)(node_modules|dist|build|coverage|\.turbo)\//
  ]

  for (const file of trackedTextFiles) {
    if (ignored.some((rule) => rule.test(file))) continue
    const text = fs.readFileSync(file, 'utf8')
    if (forbidden.test(text)) {
      throw new Error(`Stale base path in ${file}`)
    }
  }
  ```

- [ ] 12. Run staged validation.
  - `pnpm install`.
  - `pnpm check:catalog-versions`.
  - `pnpm test:local-supabase:tools`.
  - `pnpm test:vitest`.
  - `pnpm exec turbo run dev --dry=json` to validate dev task discovery without
    starting persistent dev servers.
  - `pnpm exec turbo run build --dry=json` and
    `pnpm exec turbo run test --dry=json`, then compare discovered tasks against
    the implementation ledger, including packages without matching scripts.
  - `pnpm -r list --depth -1 --json`, then compare discovered workspace
    package names and paths against the implementation ledger. Fail on missing,
    extra, or `base`-rooted package paths.
  - `pnpm -r test --if-present` or an equivalent ledger-targeted package test
    command so stale package-local script paths cannot survive.
  - `test -x packages/universo-core-backend/bin/run` and, if safe in the local
    environment, `pnpm --filter @universo/core-backend exec node ./bin/run --help`
    to validate the flattened CLI/bin entrypoint without starting the server.
  - Targeted backend Jest packages with path-heavy configs:
    `@universo/core-backend`, `@universo/metahubs-backend`,
    `@universo/applications-backend`, `@universo/migrations-platform`.
  - `pnpm --filter @universo/rest-docs verify:route-sources`.
  - `pnpm --filter @universo/rest-docs generate:openapi`.
  - `pnpm --filter @universo/rest-docs build`.
  - `rg "packages/[^\\s\"'`)]+/base|packages/\\*/base|/base/src" packages/universo-rest-docs/src/openapi/index.yml`
    must return zero hits after OpenAPI generation.
  - `pnpm build`.
  - `pnpm docs:i18n:check` and
    `pnpm docs:gitbook-screenshot-assets:check`.
  - `pnpm check:runtime-ux-agents`.
  - `pnpm check:runtime-no-lms-forks`.
  - `pnpm env:local-supabase`.
  - `pnpm doctor:local-supabase`.
  - `pnpm supabase:e2e:start:minimal`.
  - `pnpm env:e2e:local-supabase`.
  - `pnpm doctor:e2e:local-supabase`.
  - `pnpm test:e2e:smoke:local-supabase`.
  - `pnpm test:e2e:flows:local-supabase` if smoke is green.
  - `pnpm test:e2e:visual` or the focused visual/UI specs only if the move
    changes rendered runtime behavior or screenshots.

- [ ] 13. Collect browser evidence where runtime UI can be affected.
  - Because this migration should not change UI behavior, use browser proof as
    a regression check, not as a design task.
  - No runtime screens, dialogs, tables, cards, dashboards, or CRUD flows are
    intentionally changed or added by this migration.
  - Capture screenshots only through the Playwright wrapper on
    `http://127.0.0.1:3100`.
  - Browser evidence must cover named EN/RU smoke routes at desktop, tablet, and
    mobile widths using the existing runtime UX viewport matrix
    (`1920x1080`, `768x1024`, `390x844`) unless a narrower-support exception is
    explicitly documented. Minimum surfaces: authenticated shell, metahubs
    workspace, applications workspace, and public runtime smoke flow.
  - Run a focused runtime UX suite, not only generic smoke. It must use existing
    helpers such as `expectRuntimeUxViewportMatrix`,
    `expectNoTechnicalLeakage`, `expectNoDataGridTechnicalLeakage`,
    `expectSemanticFieldControls`, and `expectLocalizedValidation` on relevant
    flows.
  - Include create/edit/copy/delete lifecycle coverage where the existing flow
    supports it, or document the supported subset for each selected flow.
  - Include semantic multiline fields, localized validation failures,
    resource/media/block-content cells, and DataGrid-contained scrolling where
    those surfaces are present in the selected flows.
  - Verify no page-level horizontal overflow, no raw IDs/JSON/object cells on
    normal surfaces, no visible filesystem/package paths, no internal field
    names or validation text, and no localization fallback in EN/RU smoke flows.
  - Use user-facing locators and existing E2E helpers; do not add one-off UI
    controls only to make the migration testable.

- [ ] 14. Final residue and review gates.
  - Run active-source grep:
    `rg "packages/[^\\s\"'`)]+/base|packages/\\*/base|/base/src|/base/package\\.json"`.
  - Run relative-path residue grep:
    `rg "\\.\\./[^\\s\"'`)]+/base|\\.\\./\\.\\./[^\\s\"'`)]+/base|/base/README|/base/package\\.json"`.
  - Run Windows-path residue grep:
    `rg "packages\\\\[^\\\\\\s\"'`)]+\\\\base|\\.\\.\\\\[^\\\\\\s\"'`)]+\\\\base"`.
  - Classify any remaining hits as:
    active blocker, historical Memory Bank, archived manager spec, generated
    fixture, or intentional external backup reference.
  - Run `rg "packages/[^\\s\"'`)]+/base|packages/\\*/base" pnpm-lock.yaml` and
    require zero hits after `pnpm install`.
  - Run `find packages -mindepth 2 -maxdepth 2 -type d -name base` and require
    zero active package roots.
  - Run `find packages -mindepth 2 -maxdepth 2 -name package.json` and require
    package manifests directly under `packages/<name>/`.

## Testing Strategy

- Unit tests:
  - Existing Vitest workspace after path rewrite.
  - New residue checker test or script.
  - Local Supabase env path-generation tests.
- Backend integration/Jest:
  - Backend packages that use shared Jest aliases.
  - Migration CLI packages that use cross-package `dist`/`src` path aliases.
- Build:
  - Targeted filters first for changed packages, then root `pnpm build`.
  - Root build is mandatory because cross-package dependency paths and lockfile
    importers all change.
- Playwright:
  - Use local minimal Supabase when running local E2E.
  - Use wrapper-owned startup on port `3100`.
  - Run smoke before flow suites.
  - Keep screenshots as evidence only for runtime regression checks, not for
    invented UI changes.
- Docs:
  - GitBook EN/RU parity and docs asset checks.
  - OpenAPI route-source verification.

## UI Contract

This migration has no intended MUI runtime UI changes and should not introduce
new user-facing text or controls.

- Controls: unchanged.
- Display values: unchanged.
- Hidden/system-owned fields: unchanged and still hidden from normal user
  surfaces.
- Defaults: unchanged.
- Localization: no new runtime strings are expected. Documentation text must be
  updated in both English and Russian.
- Validation: unchanged.
- Responsive proof: use existing Playwright smoke/flow/visual checks to prove
  that the shell still renders without horizontal overflow and without raw
  technical values on normal runtime surfaces.

## Potential Challenges

- The live package count differs from the brief. The implementation must be
  inventory-driven.
- `pnpm-lock.yaml` will produce large importer-path diffs.
- Path rewrites have different relative-depth rules depending on whether the
  file moved out of `base`.
- Some generated fixtures embed compiled source comments with old relative
  paths. These should not block the migration unless an active checker consumes
  them.
- Package-local configs may have both source and `dist` aliases. A naive global
  replacement can break depth-sensitive paths.
- Historical Memory Bank references are useful history. Bulk rewriting them
  would create noise and obscure past decisions.
- Browser E2E can be expensive. Run smoke first, then flow/visual suites only
  after static/build checks are green.
- Ignored local `.env*` files are outside git history. A tracked-only `git mv`
  pass can leave them behind and prevent `base/` removal unless the
  implementation explicitly moves them without logging contents.
- Generated or dependency artifacts under `base/` (`node_modules`, `.turbo`,
  `dist`, `build`, `coverage`, `logs`) can keep the directory present after all
  tracked files are moved. They must be cleaned in package scope before the
  zero-`base` gate runs.
- Root and package-level relative paths change by one directory level after the
  move. Test scripts and shared test-helper imports are especially sensitive to
  this.

## Dependencies

- Node 22 environment must be active for Playwright and repository scripts.
- `pnpm install` must be run after workspace path changes.
- Local minimal Supabase must be available for local E2E verification.
- CI workflows must be updated in the same branch so remote validation uses the
  flattened paths immediately.

## Discussion Points Before Implementation

- Confirm whether historical Memory Bank files should remain untouched except
  for new/current context entries.
- Confirm whether generated OpenAPI and fixture artifacts should be regenerated
  or mechanically path-rewritten when they only carry source-reference strings.
- Confirm whether the implementation should add a permanent
  `check:no-package-base-paths` root script to prevent regressions.
