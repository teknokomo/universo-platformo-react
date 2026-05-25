# Flatten Base Directory Research

Date: 2026-05-25

## Research Question

Should the repository flatten `packages/<name>/base` workspaces into the standard
`packages/<name>` layout, and what implementation risks must be planned before
moving package roots?

## Source Inventory

- Context7 Turborepo documentation, library `/vercel/turborepo`, queried
  2026-05-25. Source excerpt referenced
  `apps/docs/content/docs/crafting-your-repository/structuring-a-repository.mdx`.
- Context7 pnpm documentation, library `/websites/pnpm_io`, queried
  2026-05-25. Source excerpt referenced `pnpm-workspace_yaml` and
  `catalogs`.
- Local repository source, inspected 2026-05-25:
  `pnpm-workspace.yaml`, `package.json`, `turbo.json`,
  `vitest.workspace.ts`, `tools/**`, `.github/**`, `docs/**`,
  `.gemini/**`, `.agents/skills/**`, `packages/**/tsconfig.json`, package
  READMEs, and package-local `turbo.json` files.

## Key Findings

- Current Turborepo documentation presents the common package-manager workspace
  layout as `apps/*` and `packages/*`. For pnpm this is expressed in
  `pnpm-workspace.yaml`; root `package.json` scripts delegate to
  `turbo run <task>`.
- Current pnpm documentation supports a flat `packages/*` workspace glob and
  keeps centralized dependency versions in `pnpm-workspace.yaml` through the
  default `catalog` field. Flattening package directories does not require
  abandoning the repository's catalog-based version policy.
- The repository currently has 32 first-level directories under `packages/`.
  30 have `packages/<name>/base/package.json`; 2 are already flat:
  `apps-template-mui` and `universo-rest-docs`. This differs from the brief's
  31-of-33 count and must be revalidated immediately before implementation.
- No sibling implementation directory was found next to `base/` in the active
  package tree. The only non-`base` package children observed were generated or
  dependency artifacts under already-flat packages (`node_modules`, `.turbo`,
  `coverage`, `dist`) and source/tooling folders.
- The migration is not only a filesystem move. Active tooling and runtime
  references to `base` exist in:
  - `package.json` workspaces and scripts, including start scripts, local
    Supabase scripts, E2E scripts, and docs screenshot scripts.
  - `pnpm-workspace.yaml`.
  - `pnpm-lock.yaml`, which will need regeneration by `pnpm install`.
  - `vitest.workspace.ts`.
  - `tools/testing/backend/jest.base.config.cjs`.
  - `tools/testing/e2e/support/env/load-e2e-env.mjs`.
  - `tools/local-supabase/*.mjs` and matching tests.
  - `tools/lint-db-access.mjs`.
  - `packages/universo-react-rest-docs/scripts/*` and generated OpenAPI source
    references.
  - Package-local `tsconfig.json`, `vitest.config.ts`, `jest.config.js`, and
    Vite aliases.
  - Package-local `.eslintrc.js` files, including depth-sensitive `extends`
    values.
  - Package-level scripts that reference shared test helpers with
    `../../../tools/...`; after flattening, these paths must become shallower.
  - Repository-level `.eslintrc.js` overrides and `.dockerignore` entries.
  - Hard-coded scanner paths such as
    `tools/testing/check-runtime-no-lms-forks.mjs`.
  - Active agent and custom-mode instructions under `.gemini/**`,
    `.github/**`, and `.agents/skills/**`, plus `.github/FILE_NAMING.md`.
  - Tool README files under `tools/testing/**`.
  - Package metadata such as `repository.directory` in
    `packages/universo-react-i18n/base/package.json`.
  - Package-local `turbo.json` files in `extension-sdk` and
    `universo-core-frontend`.
  - Root and package READMEs, `.github/instructions/**`, `AGENTS.md`, and
    GitBook documentation under `docs/en` and `docs/ru`.
- Historical Memory Bank and manager specs contain many `base` paths. Existing
  historical plans and research should not be rewritten wholesale during
  implementation, but the new plan/progress/context entries must use the new
  paths after the migration.

## Conflicts And Uncertainty

- The brief says 31 packages with `base` and 33 total packages, while the
  current checkout has 30 `base` packages and 32 total package directories.
  Implementation must treat the live filesystem as authoritative after a
  preflight audit.
- The lockfile will likely show path changes for every workspace. This is
  expected, but it increases review noise. After `pnpm install`, stale
  `packages/*/base` importer or `link:` paths in `pnpm-lock.yaml` should be
  treated as active workspace breakage, not documentation residue.
- Some `.env*` files under current `base/` directories are ignored local files,
  not tracked git files. A tracked-only `git mv` pass will not preserve them
  unless the implementation records and moves them separately without exposing
  secret values.
- Generated artifacts under current `base/` directories (`node_modules`,
  `.turbo`, `dist`, `build`, `coverage`, `logs`) can keep `base/` directories
  present after tracked files move. Implementation must clean only package-local
  rebuildable artifacts before enforcing the zero-`base` gate.
- The repository has generated snapshots and OpenAPI artifacts that include
  historical source paths. Implementation must decide whether to regenerate
  those artifacts, rewrite them mechanically, or keep historical references
  only where they are not used by validation.

## Project Implications

- The move should be done with `git mv` per package to preserve rename
  detection.
- A generic path-rewrite helper is safer than hand editing hundreds of path
  occurrences, but it must be scoped to active files and followed by grep
  gates.
- Package-local relative references need depth-aware rewrites:
  - from a moved package root, references like `../../other/base/...` become
    `../other/...`;
  - from an already-flat package root, references like `../other/base/...`
    become `../other/...`;
  - references like `../../../packages/x/base/...` become
    `../../packages/x/...`;
  - root-relative strings like `packages/x/base/...` become `packages/x/...`.
- Residue checking must include relative and Windows-style paths, not only
  root-relative POSIX paths. Active files can contain `../package/base`,
  `../../package/base`, `/base/README*`, `/base/package.json`, or
  `packages\\package\\base`.
- Root scripts that `cd packages/universo-react-core-backend/base/bin` must target
  `packages/universo-react-core-backend/bin`.
- E2E env profile paths must target
  `packages/universo-react-core-frontend/.env.e2e.local-supabase` and matching
  backend paths.
- The root `turbo.json` can likely keep its current task definitions, but
  package-local `turbo.json` files must move with package contents and their
  path assumptions must be rechecked.

## Recommended Decision

Proceed with the flattening as a single mechanical migration branch, but divide
the implementation into strict phases: preflight inventory, `git mv`, automated
path rewrites, lockfile refresh, targeted tool/test fixes, documentation
updates, and staged validation. Do not combine this with unrelated package API
or schema changes.

## Open Questions

- Should historical Memory Bank files be left untouched except for the new plan
  and final progress notes? Recommended: yes, to avoid rewriting project
  history.
- Should generated fixture bundles containing embedded `../../../universo-react-extension-sdk/base`
  source comments be regenerated immediately? Recommended: only if an active
  checker consumes those strings; otherwise keep fixture regeneration as a
  follow-up to avoid broad non-functional diffs.
- Should the implementation include a temporary compatibility symlink from
  `base` to the package root? Recommended: no, because the goal is to remove
  the layout and fail closed on stale paths.
