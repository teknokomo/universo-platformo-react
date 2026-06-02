# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Active: Modules as External Files for PlayCanvas-Ready Authoring Implementation (2026-06-01)

> Goal: implement file-backed metahub module source files that are readable by the running platform without root rebuild, while preserving compiler security, snapshots, copy/import behavior, runtime bundle-only sync, UI quality, docs, and tests.

### IMPLEMENT Action Plan

-   [x] Establish shared module storage contracts and baseline `_mhb_modules` schema fields/indexes.
-   [x] Implement the backend module source file service, resolver, source-status semantics, and safe generated paths.
-   [x] Refactor metahub module service/controller/routes for inline/file create and update, compile-time source resolution, and unsupported-schema handling.
-   [x] Update compiler diagnostics, snapshot/hash/export/import/copy behavior, and preserve `_app_modules` runtime bundle-only boundaries.
-   [x] Update metahubs frontend API, Modules tab UI, EN/RU i18n, generated path workflow, and technical-details visibility.
-   [x] Add focused backend/frontend/utils/compiler/schema tests for file-backed modules.
-   [x] Update GitBook/rest-docs documentation and Memory Bank progress.
-   [x] Run Prettier, focused build/test checks, docs i18n check, and final autoreview.

### Follow-Up Scope

### QA Closure Action Plan

-   [x] Fix file-backed module save so unchanged-path saves recompile when the external file checksum changed.
-   [x] Add backend regression coverage for changed-file recompilation and unchanged-file metadata saves.
-   [x] Add Playwright local minimal Supabase evidence with screenshots for the file-backed Modules tab workflow.
-   [x] Run formatting, focused backend/frontend/build checks, local minimal Supabase Playwright evidence, and autoreview.

### Final QA Defect Closure Action Plan

-   [x] Harden module source file scope/path containment before filesystem mutations.
-   [x] Add optimistic update locking with module version and source checksum propagation.
-   [x] Fix file-backed create/edit UX, localized source-path errors, and Playwright evidence.
-   [x] Clean file-backed source trees/files during metahub and module deletion.
-   [x] Close template seed and publication snapshot checksum consistency gaps.
-   [x] Run formatting, targeted tests/builds, docs checks, Playwright local Supabase evidence, and autoreview.

### Post-QA Lifecycle Hardening Action Plan

-   [x] Require fail-closed module version and source checksum guards for destructive file-backed deletes and source-path cleanup.
-   [x] Make snapshot restore stale source cleanup checksum-aware and fail closed for externally edited files.
-   [x] Clean imported metahub source trees when snapshot import rolls back after file-backed restore.
-   [x] Include file-backed `sourceStorage.path` in canonical publication snapshot hashes.
-   [x] Add focused regression tests for destructive lifecycle, restore/import cleanup, and hash normalization.
-   [x] Run Prettier, focused backend/utils/frontend checks, local minimal Supabase Playwright evidence, and autoreview.

### Final Snapshot/Delete Integrity Closure Action Plan

-   [x] Include shared-library module sources in portable publication snapshots without changing runtime bundle-only application sync.
-   [x] Normalize and validate restored file-backed snapshot paths and reject tampered snapshot source checksums.
-   [x] Require live file checksum confirmation before destructive file-backed module deletes.
-   [x] Add a localized confirmation dialog for file-backed module deletion and strengthen keyboard/mobile browser evidence.
-   [x] Add focused backend, frontend, and Playwright regressions for the final QA defects.
-   [x] Run formatting, focused tests/builds, local minimal Supabase Playwright evidence, repository guards, and autoreview.

### Follow-Up Scope

-   [ ] Add explicit extract-to-file and inline-from-file commands if product workflow needs them beyond create/update/publish compilation.

---

## Active: PlayCanvas Editor Metahub Authoring Surface Settings Implementation (2026-06-01)

> Goal: add metahub design-time package settings and a safe route-first PlayCanvas Editor artifact host while keeping authoring-only packages out of runtime publication.

### IMPLEMENT Action Plan

-   [x] Establish contracts and safety boundaries for `authoringSurface`, attachment `config`, package slugs, local-only development URLs, and authoring-only runtime exclusion.
-   [x] Extend shared package types and backend schema/system-app metadata for authoring descriptors and per-attachment config.
-   [x] Seed `@universo-react/playcanvas-editor` as an authoring-only package and update package store/controller/routes with typed config and slug host APIs.
-   [x] Preserve config through metahub copy and design-time snapshot import/export while filtering authoring-only packages from runtime publication and Modules imports.
-   [x] Add authenticated artifact status/static serving through the metahubs package domain with traversal, manifest, CSP/header, iframe sandbox, and nested asset-route safeguards.
-   [x] Update the metahub Packages UI with authoring-aware table labels, row action menu, typed settings dialog, route-first host page, and EN/RU i18n.
-   [x] Update OpenAPI and GitBook documentation for package settings, artifact-only status, local-only development URL mode, copy/snapshot behavior, and deferred runtime propagation.
-   [x] Add backend, frontend, and local minimal Supabase Playwright coverage for config persistence, runtime non-propagation, localization, UI package flows, and the PlayCanvas Editor host iframe route.
-   [x] Run Prettier plus targeted type/build/test checks and update Memory Bank progress.

### QA Remediation Action Plan

-   [x] Harden backend authoring package permissions, descriptor-aware config validation, artifact availability checks, version-change compatibility, and snapshot import/export behavior.
-   [x] Add frontend development URL validation and stronger browser UX oracles for the settings dialog and PlayCanvas Editor host route.
-   [x] Expand backend, frontend, and E2E regression tests for permissions, validation, artifact safety, snapshot/package behavior, and responsive host evidence.
-   [x] Run formatting, focused test/build checks, isolation guard, and update Memory Bank progress.

### Final QA Closure Action Plan

-   [x] Harden static artifact containment, manifest validation, and deterministic authoring slug resolution.
-   [x] Close package config lifecycle races and default-config normalization gaps.
-   [x] Strengthen backend tests for artifact routes, permissions, runtime filtering, copy/snapshot config preservation, and authoring slug collisions.
-   [x] Strengthen frontend and Playwright coverage for settings modes, keyboard flow, localized validation, iframe attributes, and host browser evidence.
-   [x] Update user-facing RU copy and documentation/memory-bank notes for the final closure.
-   [x] Run formatting, focused backend/frontend tests, build checks, Playwright local minimal Supabase evidence, and repository guards.

### QA Findings Closure Action Plan

-   [x] Keep the already-applied built-in package seed migration checksum immutable and move the PlayCanvas Editor seed/authoring reseed contract behind the new authoring-settings migration.
-   [x] Preserve iframe sandboxing for open-separately mode by opening a route-first host page instead of the raw artifact URL.
-   [x] Normalize/backfill existing `{}` package attachment configs to descriptor defaults and preserve valid configs through snapshot/copy/restore.
-   [x] Increment package attachment `_upl_version` on attach, version change, config update, detach, copy conflict updates, and snapshot replacement mutations.
-   [x] Recompute compatible/default config when `POST /packages` reattaches an already-active package to a different version.
-   [x] Strengthen backend regression tests for migration checksum immutability, config backfill/defaults, version bumps, and reattach config compatibility.
-   [x] Strengthen frontend and Playwright evidence for open-separately sandboxing, settings dialog viewport/keyboard UX, missing artifact, blocked development URL, and noopener/noreferrer.
-   [x] Run Prettier, focused backend/frontend/package tests, builds, local minimal Supabase Playwright evidence, repository guards, and autoreview.

### Final QA Hardening Closure Action Plan

-   [x] Add strict backend validation for package `authoringSurface` descriptors on registry/seed boundaries, with malformed descriptor regression tests.
-   [x] Improve PlayCanvas Editor host user-facing failure/context states with localized permission and unavailable copy.
-   [x] Document that metahub snapshot/export files preserve package display settings and can include owner-managed development URLs.
-   [x] Add browser evidence for mobile package action completion and RU PlayCanvas Editor settings/host surfaces.
-   [x] Run Prettier, focused backend/frontend tests, builds, local minimal Supabase Playwright evidence, repository guards, and autoreview.

### Post-QA Defect Closure Action Plan

-   [x] Add parent PlayCanvas Editor host CSP `frame-src`/`child-src` restrictions for artifact and development URL modes.
-   [x] Make the PlayCanvas Editor artifact placeholder locale-aware and update browser assertions to require one active locale.
-   [x] Fix snapshot fixture hash drift without matching payload changes.
-   [x] Harden snapshot package replacement and authoring slug uniqueness before mutating package attachments.
-   [x] Document typed package config/authoring-host contracts in OpenAPI.
-   [x] Strengthen Playwright evidence for development URL validation and stable dialog screenshots.
-   [x] Run Prettier, focused tests/builds, Playwright local minimal Supabase evidence, isolation guard, diff checks, and autoreview.

### Final QA Evidence Closure Action Plan

-   [x] Add a database-level authoring slug owner guard in baseline and additive migrations without blocking same-package version rows.
-   [x] Replace programmatic mobile table action scrolling with user-like Playwright gesture evidence.
-   [x] Add keyboard focus enter/exit evidence for the PlayCanvas Editor host iframe.
-   [x] Add RU browser validation evidence for invalid Development URL settings.
-   [x] Run formatting, focused backend/frontend checks, local minimal Supabase Playwright evidence, repository guards, and autoreview.

---

## Active: PlayCanvas Editor Package Foundation Implementation (2026-05-31)

> Goal: add the isolated `@universo-react/playcanvas-editor` workspace package for the official PlayCanvas Editor frontend artifact, pinned to an upstream release, with reproducible wrapper metadata/scripts, repository guardrails, tests, docs, and no direct MUI/runtime integration.

### IMPLEMENT Action Plan

-   [x] Establish the upstream baseline, pinned tag/commit, and implementation scope.
-   [x] Create the `@universo-react/playcanvas-editor` package skeleton with metadata, attribution, README files, and package-local scripts.
-   [x] Vendor the pinned PlayCanvas Editor snapshot safely without exposing upstream `package.json` to workspace/package scanners.
-   [x] Implement artifact metadata, build/smoke helpers, Vitest coverage, and package-local browser smoke scaffolding.
-   [x] Add repository guardrails for `.tmp`, catalog scanning, lint isolation, package isolation, CI/agent gates, and Vitest workspace coverage.
-   [x] Add GitBook documentation and Memory Bank progress updates.
-   [x] Run formatting, focused package tests, guard checks, install/build/smoke verification as feasible, and record any blockers honestly.

### QA Remediation Action Plan

-   [x] Harden the PlayCanvas Editor script guard against missed install/package-manager command variants.
-   [x] Add regression tests for the missed direct and split-argument command variants.
-   [x] Run formatting, focused tests, artifact build/smoke, Playwright browser smoke, and repository guard checks.

## Active: MMOOMM Multi-Ship Authoritative Sync Implementation (2026-05-29)

> Goal: extend the MMOOMM flight runtime from single authoritative ship to two authenticated controllable ships with server-owned Colyseus state, safe spawn placement, generic wrapper helpers, updated fixture, docs, and browser evidence.

### QA Evidence Closure Action Plan

-   [x] Add browser evidence that unauthorized users cannot trigger movement through toolbar, canvas, or keyboard paths.
-   [x] Add direct browser evidence that PlayCanvas pointer capture is released after camera drag and Escape.
-   [x] Run formatting plus focused unit/E2E checks and record the closure result.

### Role Update Regression Closure Action Plan

-   [x] Fix application member role update regression so existing members can be edited without a backend 500 or frontend dialog data rejection.
-   [x] Run focused backend and frontend regression tests for member role updates.
-   [x] Re-run focused formatting/build checks for touched packages and update progress.

### Manual Flight Control QA Closure Action Plan

-   [x] Fix free-space double-click so lower-screen clicks produce a long-distance planar target in the clicked direction instead of a short target near the camera/cursor.
-   [x] Replace over-conservative station and ship collision envelopes with axis-aware MVP contact checks that prevent overlap without large visible gaps.
-   [x] Strengthen component, backend, fixture, and Playwright oracles for lower-screen long-distance clicks, repeated double-clicks, and max visual clearance to stations/ships.
-   [x] Run Prettier, focused unit/backend/frontend checks, fixture contract, local minimal Supabase Playwright evidence as feasible, and update progress.

### IMPLEMENT Action Plan

-   [x] Add generic spawn and keyed realtime helper coverage in the Colyseus wrapper packages.
-   [x] Refactor the application Colyseus room from singleton `state.ship` to multi-ship authoritative state with per-user ownership, queued intents, spawn safety, and reconnect lifecycle.
-   [x] Update the PlayCanvas canvas widget for local plus remote runtime entities, trusted local identity, sequenced intents, prediction/interpolation, observer behavior, reconnect states, i18n, and UX probes.
-   [x] Update the MMOOMM fixture generator, snapshot contract checker/script, generated snapshot, and runtime E2E flow for two authenticated browser contexts.
-   [x] Update docs and Memory Bank progress for the multiplayer runtime slice.
-   [x] Run formatting, focused unit/build checks, fixture contract, local minimal Supabase Playwright evidence, and root build as feasible.

## Active: MMOOMM Flight Simulator QA Closure (2026-05-28)

> Goal: close the QA findings for the MMOOMM flight simulator so the published app is module-driven, security-hardened, and covered by stronger runtime/browser evidence.

### Runtime Usability QA Closure Action Plan

-   [x] Replace the inherited runtime navigation with the product-level Welcome and Space sections only.
-   [x] Make the PlayCanvas canvas fit the available runtime viewport height without leaving a large blank lower area or creating page scroll.
-   [x] Implement 3D double-click movement along the camera pick ray with a longer default intent distance.
-   [x] Rotate the controlled ship to face its movement direction during prediction and authoritative correction.
-   [x] Strengthen fixture, unit, and Playwright evidence for navigation, canvas fill height, 3D movement, ship orientation, and longer travel distance.
-   [x] Run Prettier, focused tests/builds, local minimal Supabase generator/runtime Playwright evidence, full build, autoreview, update progress, and stop Supabase.

### Manual Runtime QA Closure Action Plan

-   [x] Remove inherited lower details widgets from the flight runtime layout and make the fixture contract fail closed when they return.
-   [x] Make the PlayCanvas widget own wheel input and fit the available runtime viewport without page-level vertical scroll.
-   [x] Harden the station guard so the controlled ship AABB cannot enter the station AABB during move-to-object or move-to-point commands.
-   [x] Strengthen unit, fixture, and browser evidence for no lower widgets, no vertical scroll, wheel zoom, and continuous collision guard behavior.
-   [x] Run Prettier, focused tests/builds, local minimal Supabase Playwright evidence, full build, autoreview, and update progress.

### IMPLEMENT Action Plan

-   [x] Execute the configured PlayCanvas widget client module method before mounting the scene and fail closed with localized runtime states.
-   [x] Make realtime matchmake validate and consume the published server module configuration instead of accepting stale widget-only module references.
-   [x] Harden runtime module API error/header behavior.
-   [x] Strengthen unit and Playwright evidence for module execution, visual canvas behavior, observer/control access, and responsive UI.
-   [x] Run Prettier, focused tests/builds, local minimal Supabase Playwright evidence, full build, and autoreview closeout.
-   [x] Update Memory Bank progress with the implementation outcome.

## Active: Autoreview Project Skill Adoption (2026-05-27)

> Goal: vendor and adapt the OpenClaw `autoreview` skill as a project-local `.agents/skills/autoreview/` workflow with MIT attribution, Universo-specific closeout guidance, and script validation.

### IMPLEMENT Action Plan

-   [x] Establish the implementation baseline and preserve unrelated active work.
-   [x] Copy upstream `autoreview` scripts into `.agents/skills/autoreview/` with executable permissions.
-   [x] Rewrite `.agents/skills/autoreview/SKILL.md` for the Universo project-local workflow.
-   [x] Conservatively adapt copied scripts for provenance, local paths, and project-neutral wording.
-   [x] Update `.agents/skills/SOURCES.md` with OpenClaw source, commit, MIT license, and adaptation notes.
-   [x] Validate skill shape and helper scripts without invoking live review engines.
-   [x] Run formatting and repository content checks for touched files.
-   [x] Update Memory Bank progress with the implementation outcome.

### QA Closure Action Plan

-   [x] Make branch-mode remote ref updates explicit with `--fetch` instead of implicit `git fetch`.
-   [x] Remove generated Python bytecode from `.agents/skills/autoreview/` and validate without recreating it.
-   [x] Re-run skill, syntax, CLI, formatting, whitespace, and targeted content checks.

### Final QA Closure Action Plan

-   [x] Make explicit `--fetch` fail closed when origin fetch fails.
-   [x] Ensure Codex and Droid temporary prompt/schema files are cleaned up even when engine startup fails.
-   [x] Mark the saved plan artifact as completed and record QA closure status.
-   [x] Re-run skill, syntax, CLI, formatting, whitespace, generated-artifact, and targeted content checks.

## Active: MMOOMM 3D And Multiplayer Project Skills (2026-05-27)

> Goal: implement the approved project-local skill set for MMOOMM PlayCanvas Engine, Colyseus authoritative multiplayer, browser 3D runtime integration, and browser game runtime QA, with source attribution and documentation alignment.

### IMPLEMENT Action Plan

-   [x] Establish the implementation baseline and preserve unrelated active work.
-   [x] Create `playcanvas-engine-runtime` with Engine-only PlayCanvas runtime and procedural geometry references.
-   [x] Create `colyseus-authoritative-multiplayer` with Colyseus 0.17 room lifecycle, auth, schema, fixed tick, interpolation, reconnection, and scaling references.
-   [x] Create `browser-3d-runtime-integration` with `apps-template-mui`, runtime UI contract, game loop, input, cleanup, and package import constraints.
-   [x] Create `browser-game-runtime-qa` with canvas/WebGL, multiplayer, reconnect, runtime UX, and Playwright evidence oracles.
-   [x] Update `.agents/skills/SOURCES.md` with local skill entries, external reference-source attribution, and wrapper package relationships.
-   [x] Align wrapper/docs notes for MMOOMM package runtime targets, compiler import constraints, and browser-game QA guidance.
-   [x] Run focused Markdown formatting and documentation/content checks.
-   [x] Update Memory Bank progress with the implementation outcome.

## Active: 1C-Compatible Metahub Template Implementation (2026-05-26)

> Goal: implement the `1C-Compatible` metahub template as an opt-in template with reusable Entity Type Constructor typed behavior contracts, preview-safe preset manifests, safety gates, i18n, docs, and test scaffolding without changing the default `basic` template.

### IMPLEMENT Action Plan

-   [x] Establish the implementation baseline and preserve unrelated active tasks/history in this file.
-   [x] Add shared typed behavior contracts and validators for `singleValue`, `catalogBehavior`, `documentBehavior`, `documentPosting`, `journalBehavior`, `registerBehavior`, `accountChartBehavior`, `dynamicCharacteristic`, and `calculationTypeGraph` in `@universo-react/types`.
-   [x] Add focused unit tests for typed behavior normalization, positive contracts, negative fail-closed references, and preview/non-materializable guards.
-   [x] Add `1C-Compatible` preview template and preset manifests in metahubs backend using existing manifest patterns and no template version bump for existing templates.
-   [x] Extend backend manifest validation/tests so implemented presets register safely and preview/roadmap presets cannot materialize accidentally.
-   [x] Add i18n keys and template/preset picker metadata for EN/RU user-facing copy, including non-affiliation wording.
-   [x] Add UI/runtime UX guard scaffolding and Playwright fixture/spec placeholders for `@1c-compatible` and `@runtime-ux-canary` without using `pnpm dev`.
-   [x] Add GitBook documentation pages and a clean-room/non-affiliation docs checker.
-   [x] Run Prettier/lint/build/focused tests for touched packages; record unresolved blockers honestly if full runtime phases cannot be completed in this slice.
-   [x] Update Memory Bank active context and progress with the implementation result.

### Post-QA Closure Action Plan

-   [x] Replace the incomplete runtime-ready claim with a fail-closed milestone model until each preset has behavior, UI, storage, and tests.
-   [x] Protect template-managed entity type presets from structural update/delete without hardcoding a 1C-only rule.
-   [x] Validate behavior cross-references against the enabled template/default-instance graph and fail when preset toggles create dangling references.
-   [x] Complete the 12-preset 1C-compatible catalog as explicit runtime/preview manifests and guard preview presets from accidental materialization.
-   [x] Fix Constant capabilities so top-level constants do not inherit object/document lifecycle behavior.
-   [x] Expand typed behavior contract tests for accounting, dynamic characteristic, and calculation configs.
-   [x] Strengthen backend manifest/template tests for reference validation, preset toggle closure, protected entity types, and preview non-materialization.
-   [x] Strengthen EN/RU template selector copy and remove rough localized wording.
-   [x] Replace shallow Playwright picker coverage with browser creation, keyboard, RU, viewport, overflow, and cleanup coverage.
-   [x] Run formatting, focused unit tests, docs checks, builds, and local minimal Supabase Playwright evidence.
-   [x] Update Memory Bank active context and progress with the QA closure result.

### Security QA Closure Action Plan

-   [x] Reserve all registered platform preset `kindKey` values so user-authored custom entity types cannot squat future template-managed kinds such as `document` or `catalog`.
-   [x] Map template-managed object-like preset kinds into the generic Object metadata policy surface only when the row is a registered preset-managed type.
-   [x] Route object-like 1C preset kinds through existing Object-compatible nested list/create/update/delete and blocking-reference handlers without adding 1C-only route families.
-   [x] Fail closed during preset sync when an existing non-template-managed row already uses a platform preset `kindKey`, preventing silent overwrite of legacy/custom rows.
-   [x] Correct nested Object-compatible creation access from `editContent` to `createContent`.
-   [x] Add route, metadata, EntityTypeService, and schema-sync regression tests for the reserved-kind, object-compatible routing, delete preflight, and overwrite-safety contracts.
-   [x] Re-run Prettier, focused backend tests/build/lint, types tests/build/lint, metahubs frontend build/lint, docs checks, and local minimal Supabase Playwright evidence.
-   [x] Update Memory Bank active context and progress with the security QA closure result.

### Runtime UX QA Closure Action Plan

-   [x] Remove duplicate preview labeling and replace the 1C-compatible template description/non-affiliation wording.
-   [x] Rename 1C-compatible entity preset display names to neutral metadata-object names across manifests and tests.
-   [x] Make generic entity-instance collection pages use metadata-driven clean titles, actions, dialog titles, and no internal banners for template-managed/custom surfaces.
-   [x] Add constructor/runtime UX guard coverage for namespaced `ui.nameKey`, clean collection pages, and create dialogs for new preset kinds.
-   [x] Re-run Prettier, focused frontend/backend/type tests, lint/build checks, docs checks, and local minimal Supabase Playwright evidence.
-   [x] Update Memory Bank active context and progress with the runtime UX QA closure result.

### Constructor UX And Lifecycle QA Closure Action Plan

-   [x] Remove normal-user raw kind/capability keys from Entity Type Constructor list and card surfaces.
-   [x] Replace mixed Russian/English constructor copy with localized user-facing wording.
-   [x] Move behavior profile data out of the shared workspace component into a reusable constructor preset module.
-   [x] Align settings labels for 1C-compatible requisites with metadata terminology instead of generic components where the surfaced type uses requisites.
-   [x] Expand 1C-compatible test coverage for constructor leakage, runtime lifecycle, RU validation, multiline description fields, resources/settings viewport evidence, and the complete preset catalog policy.
-   [x] Run Prettier, focused frontend/backend/type tests, lint/build checks, docs checks, and local minimal Supabase Playwright evidence.
-   [x] Update Memory Bank active context and progress with the constructor UX and lifecycle QA closure result.

## Recently Closed: Packages Naming Convention Rollout (2026-05-25)

> Goal: rename every active workspace package to
> `packages/universo-react-<name>/` and `@universo-react/<name>` in one
> coordinated cutover, publish the convention, and prove the rename did not
> alter package boundaries, dependency graph semantics, runtime behavior, DB
> schemas, or UI primitives.

### IMPLEMENT Action Plan

-   [x] Capture baseline inventory, dependency graph, and legacy-reference
        search evidence.
-   [x] Generate deterministic rename ledger and exact legacy-reference
        allowlist artifacts.
-   [x] Move all package directories with `git mv` and preserve local env
        files.
-   [x] Rewrite manifests, workspace dependencies, root scripts, imports,
        dynamic module strings, fixtures, configs, CI, tools, docs, Memory
        Bank, steering, manager context, and agent guidance.
-   [x] Add fail-closed guards for package naming, dependency graph drift, and
        `apps-template-mui` isolation.
-   [x] Regenerate `pnpm-lock.yaml` and verify workspace discovery.
-   [x] Run formatting, static checks, focused package tests/builds, OpenAPI,
        docs, full build/lint/test matrix, local Supabase, and Playwright
        runtime evidence.
-   [x] Update Memory Bank active context and progress with the final rollout
        outcome.

### QA Closure Action Plan

-   [x] Remove stale active agent guidance and public docs that still used old
        package examples or generic package-layout wording.
-   [x] Fix double-prefixed package-scope and package-path references in the
        published Memory Bank convention context.
-   [x] Update `tools/lint-db-access.mjs` Tier 3 exclusion paths to the renamed
        workspace package directories and restore CI DB-lint to zero violations.
-   [x] Strengthen `check:package-naming` so active docs/tooling/guidance fail
        closed on double-prefix and stale package example regressions.
-   [x] Add package naming and apps-template isolation guards to the main CI
        workflow.
-   [x] Re-run formatting, rename guards, DB lint, security/access backend
        tests, docs checks, frozen install, and full root build.

## Active: Flatten Base Directory Layout (2026-05-25)

> Goal: remove the unused `base/` package-root layer from all active
> workspaces, update tooling/documentation references, and prove pnpm/Turbo,
> tests, local Supabase, OpenAPI, docs, and runtime UX gates still work.

### IMPLEMENT Action Plan

-   [x] Establish the live package inventory and implementation ledger.
-   [x] Move tracked package files with `git mv`, preserve ignored local env
        profiles, and clean rebuildable generated artifacts under old `base/`
        directories.
-   [x] Rewrite workspace, root script, package config, test harness, local
        Supabase, OpenAPI, docs, agent, and manager path references.
-   [x] Add a fail-closed stale `base/` path checker covering root-relative,
        relative, and Windows-style paths.
-   [x] Regenerate workspace lock/importer metadata with `pnpm install` and
        verify pnpm/Turbo package discovery against the implementation ledger.
-   [x] Run formatting, targeted static/unit/build/docs checks, package-local
        script oracles, and local Supabase validation.
-   [x] Run local minimal Supabase Playwright evidence for smoke/runtime UX
        flows without using `pnpm dev`.
-   [x] Update Memory Bank progress and active context with the final outcome.

### Post-QA Closure Action Plan

-   [x] Remove active stale documentation that still describes package roots as
        `base/` directories.
-   [x] Extend the stale package-base checker so standalone active layout
        guidance and package tree snippets fail closed.
-   [x] Verify the new `start-frontend` views components barrel is intentional
        and required by package exports/build.
-   [x] Run formatting and focused validation after the QA follow-up fixes.
-   [x] Record the closure outcome in Memory Bank.

### Final QA Closure Action Plan

-   [x] Add the new stale-path checker and `start-frontend` views components
        barrel to the tracked change set.
-   [x] Fix the `@universo-react/core-backend` Jest command import regression.
-   [x] Include all flat-package Vitest configs in the root Vitest workspace.
-   [x] Wire the stale package-base guard into CI and agent verification gates.
-   [x] Strengthen local Supabase tests for exact flattened frontend env paths.
-   [x] Run formatting, focused Jest/Vitest/tooling checks, full validation,
        and local minimal Supabase Playwright smoke.
-   [x] Record the final QA closure outcome in Memory Bank.

### Final Index And Backend Matrix Closure Action Plan

-   [x] Sync the Git index with the flat package layout and include the Memory
        Bank plan, research, and implementation ledger artifacts in the tracked
        change set.
-   [x] Re-verify the root workspace development dependencies required by the
        E2E/tooling entry points after flattening.
-   [x] Run the backend Jest package matrix that was not fully covered by the
        previous QA closure.
-   [x] Re-run stale-path, formatting, and Git whitespace guards against the
        worktree and staged index.
-   [x] Record the final closure outcome in Memory Bank.

## Active: Scripts To Modules Rename (2026-05-25)

> Goal: rename the metahub attached TypeScript-code capability from Scripts/Scripting to Modules across code, database contracts, API routes, UI, i18n, fixtures, docs, and tests with no legacy compatibility layer.

### IMPLEMENT Action Plan

-   [x] Establish the implementation ledger for Scripts -> Modules rename.
-   [x] Rename shared type contracts, capability keys, package boundaries, and engine/SDK public names.
-   [x] Rename backend database tables, route families, stores, services, migrations, snapshots, template seeds, and action attachment contracts.
-   [x] Rename frontend APIs, MUI authoring surfaces, runtime widget contracts, i18n keys, and visible labels while reusing existing UI primitives.
-   [x] Rename fixtures, E2E flows, docs screenshot generators, and GitBook documentation with EN/RU parity.
-   [x] Close final rename residue in test helper names and rerun the no-legacy grep inventory.
-   [x] Run Prettier and targeted Jest/Vitest/backend/frontend/docs checks; run local minimal Supabase Playwright evidence where feasible.
-   [x] Update active context and progress with the final implementation outcome.

### QA Fix Action Plan

-   [x] Harden snapshot module restore so imported snapshots cannot bypass module compilation boundaries.
-   [x] Validate snapshot module attachment kinds with the same module attachment contract as design-time APIs.
-   [x] Remove the out-of-scope library compatibility allowance from module updates.
-   [x] Add regression tests for the QA findings and rerun focused backend verification.

### Final QA Fix Action Plan

-   [x] Enforce the runtime client-module visibility predicate on direct client bundle fetches.
-   [x] Remove unrelated deprecated snapshot compatibility aliases found during the final QA pass.
-   [x] Add regression tests and rerun focused backend/frontend/docs checks.

### Post-QA Closure Action Plan

-   [x] Update current EN/RU snapshot docs and Memory Bank architecture notes to use `sharedFixedValues` and `sharedOptionValues`.
-   [x] Fix the modules quiz runtime E2E fixture so the published runtime exercises the real client-to-server submit flow.
-   [x] Re-run focused formatting, docs, unit/build, and local minimal Supabase Playwright checks.
-   [x] Record the final closure status in Memory Bank.

## Recently Closed: LMS User Guide Screenshot QA (2026-05-24)

-   [x] Add a global duplicate screenshot gate for all localized LMS user-guide PNG assets.
-   [x] Add per-capture provenance evidence for overview and workflow-step screenshots.
-   [x] Exercise edit, copy, delete, project, report, learner, and guest flows in the Playwright screenshot generator.
-   [x] Remove user-facing implementation wording from English and Russian LMS guide pages.
-   [x] Include `check:runtime-no-lms-forks` in the LMS user-guide verification scripts.
-   [x] Normalize generated route identifiers in screenshot provenance and fail the docs check when raw route IDs remain.
-   [x] Run whole-viewport technical-leakage and DataGrid-leakage checks before every full-window screenshot.
-   [x] Add block-editor and semantic multiline dialog oracles to the LMS screenshot generator.
-   [x] Make learner-experience progress screenshots deterministic and distinct from course preview screenshots.
-   [x] Re-run the full local minimal Supabase verification pipeline after regenerating screenshots.

## Active: Node.js 22 Migration (2026-05-06)

> Goal: Migrate project from Node.js 20 to Node.js 22.6.0+ to enable autoskills tool support.

### Critical Finding from QA

**isolated-vm version incompatibility discovered:**

-   Current: isolated-vm@5.0.4 (requires Node.js >=18.0.0, does NOT support Node.js 22)
-   Required: isolated-vm@6.x (requires Node.js >=22.0.0, mandatory for Node.js 22)

**Migration sequence must be:**

1. First upgrade isolated-vm to 6.x on Node.js 20
2. Verify all tests pass
3. Then migrate to Node.js 22

### Phase 1: Preparation and Risk Assessment

-   [x] Step 1.1: Create comprehensive dependency audit for Node.js 22 compatibility
-   [x] Step 1.2: Review isolated-vm 6.x CHANGELOG for breaking changes
-   [x] Step 1.3: Audit AWS SDK dependencies compatibility

### Phase 2: Local Development Migration

-   [x] Step 2.1: Update package.json engines field to >=22.6.0
-   [x] Step 2.2: Create .nvmrc file at project root with "22"
-   [x] Step 2.3: Verify server startup scripts have --no-node-snapshot flag
-   [x] Step 2.4: Install Node.js 22 locally via nvm
-   [x] Step 2.5: Upgrade isolated-vm from 5.0.4 to 6.1.2
-   [x] Step 2.6: Clean install with new Node.js version

### Phase 3: Build and Test Validation

-   [x] Step 3.1: Run full build (pnpm build) - PASSED (3m1s)
-   [x] Step 3.2: Run linting (pnpm lint) - PASSED (modules-engine fixed)
-   [x] Step 3.3: Run unit tests (pnpm test:vitest) - PASSED (911 tests, 173s)
-   [ ] Step 3.4: Run E2E smoke tests (pnpm test:e2e:smoke)
-   [ ] Step 3.5: Run Playwright flow tests (pnpm test:e2e:flows)
-   [x] Step 3.6: Verify modules engine runtime (pnpm benchmark) - PASSED (mean: 1.47ms, p95: 2.16ms)

### Validation Summary (2026-05-07)

-   Build: All 30 packages built successfully
-   Lint: Fixed prettier formatting in modules-engine
-   Unit tests: 911 tests passed across 161 test files
-   Modules engine: isolated-vm 6.x works correctly with Node.js 22
-   Remaining: E2E tests (require running server)

### Phase 4: CI/CD Pipeline Update

-   [x] Step 4.1: Update GitHub Actions workflow to Node.js 22.x
-   [x] Step 4.2: Update pnpm version in CI if needed (no change required)
-   [ ] Step 4.3: Verify CI build passes (USER ACTION: push to test branch)

### Phase 5: Production Deployment Preparation

-   [x] Step 5.1: Update deployment documentation
-   [ ] Step 5.2: Create deployment checklist (environment-specific)
-   [ ] Step 5.3: Staging environment test (environment-specific)

### Phase 6: Documentation and Knowledge Transfer

-   [x] Step 6.1: Update tech.md steering file with Node.js 22 requirements
-   [x] Step 6.2: Update README.md prerequisites section
-   [x] Step 6.3: Update memory-bank/techContext.md
-   [x] Step 6.4: Create migration guide for developers

## Notes For The Next Session

-   Keep the active ledger centered on only genuinely new regressions
-   When one open active item closes, record the durable outcome in `progress.md` first and then update this ledger
-   `tasks.md` should remain the operational checklist, not a second full progress log
-   Do not reopen the 2026-04-13+ QA remediation waves unless fresh failing evidence appears

## Planned: Dedicated E2E Supabase And Agent Playwright Guidance (2026-05-13)

-   [ ] Review and approve [e2e-dedicated-supabase-and-agent-playwright-guidance-plan-2026-05-13.md](plan/e2e-dedicated-supabase-and-agent-playwright-guidance-plan-2026-05-13.md)
-   [ ] Implement separate local E2E Supabase profile, source policy guards, and repository-specific Playwright skill guidance after approval

## Recently Completed (Full Detail)

## Completed: LMS User Guide User-Facing Text And CI Gate Closure (2026-05-24)

> Goal: close the final LMS GitBook user-guide QA blockers by removing implementation-only screenshot markers, replacing internal/QA wording with user-facing language, and making the screenshot workflow run broadly enough to catch runtime documentation regressions.

### IMPLEMENT Action Plan

-   [x] Remove all `<!-- screenshot: ... -->` comments from English and Russian LMS user-guide Markdown while keeping visible per-step screenshots.
-   [x] Refactor `docs:lms-user-guide:check` so screenshot coverage is driven by the manifest, visible images, assets, and provenance rather than hidden Markdown comments.
-   [x] Add checker failures for TODO/FIXME/placeholder markers and user-facing technical wording such as raw ID/JSON/UUID/metahub/source-preview/row-action terminology.
-   [x] Replace internal LMS setup, source-preview, row-action, and technical-value wording in the user guide with user-facing English and Russian copy.
-   [x] Make the LMS user-guide screenshot GitHub Actions workflow run for every pull request instead of only a narrow path set.
-   [x] Run Prettier, static docs checks, and the local minimal Supabase Playwright verification after the final text/checker edits.

---

## Completed: LMS User Guide Step Screenshot And Detail Remediation (2026-05-24)

> Goal: close the QA blockers in the GitBook LMS user guide so every documented workflow step has a real localized 1920x1080 screenshot, the guide text is detailed enough for end users, and checks fail on duplicated placeholder screenshots.

### IMPLEMENT Action Plan

-   [x] Replace overview-buffer step screenshot generation with real per-step capture actions and assertions.
-   [x] Strengthen `docs:lms-user-guide:check` so duplicated step screenshots, weak manifests, and stale placeholder assets fail closed.
-   [x] Expand English and Russian LMS guide pages into detailed user-facing workflows while keeping EN/RU structural parity.
-   [x] Regenerate localized LMS guide screenshots through local minimal Supabase Playwright and verify no TanStack banner, raw IDs, raw ISO dates, or English RU fallback text.
-   [x] Fix the learner-experience screenshot flow so step 2 captures a distinct outline-item state instead of duplicating another step.
-   [x] Update screenshot manifest evidence after the EN/RU generation order changed project counts and RU guest-content assertions.
-   [x] Add a first-class LMS user-guide verify command and CI workflow that regenerate browser screenshots before running static docs checks.
-   [x] Run Prettier, docs checks, targeted lint, local minimal Supabase Playwright generator, update Memory Bank, and leave the repo ready for QA.

---

## Completed: LMS User Guide QA Remediation (2026-05-24)

> Goal: close the documentation QA blockers found after the first LMS user-guide implementation: Russian pages must be fully localized, every workflow step must show a visible GitBook image, and the docs checker must reject invisible screenshot-comment placeholders.

### IMPLEMENT Action Plan

-   [x] Localize Russian LMS user-guide boilerplate headings and role/goal labels without changing the EN/RU structural parity required by GitBook checks.
-   [x] Add visible step-level screenshot images after every numbered workflow step in EN/RU LMS user-guide pages.
-   [x] Add or generate referenced step-level screenshot assets and update the Playwright generator so regenerated docs assets keep those references valid.
-   [x] Strengthen `docs:lms-user-guide:check` so it rejects English RU boilerplate and numbered steps without adjacent visible images.
-   [x] Run Prettier, docs checks, targeted lint, and local-minimal-Supabase Playwright generator, then update `progress.md`.

---

## Completed: LMS User Guide GitBook Documentation (2026-05-24)

> Goal: implement the approved bilingual GitBook user documentation plan for the published LMS application generated from `tools/fixtures/metahubs-lms-app-snapshot.json`, including localized user-guide pages, screenshot assets, manifest-driven docs QA, and a Playwright screenshot generator that uses `1920x1080` whole-window captures by default.

### IMPLEMENT Action Plan

-   [x] Add the first-class `docs/<locale>/lms/` GitBook section and update existing LMS guides with user-guide cross-links.
-   [x] Write matching English and Russian LMS user-guide pages with task-based workflows, role assumptions, results, and localized screenshot references.
-   [x] Add localized LMS user-guide screenshot assets, a manifest, and a docs checker that enforces EN/RU parity, screenshot coverage, dimensions, no stale assets, and no technical leakage.
-   [x] Add a Playwright docs screenshot generator with local-minimal-Supabase-compatible setup, `1920x1080` capture defaults, RU fallback checks, runtime UX oracles, and toolbar/overflow guards.
-   [x] Run Prettier and targeted docs/checker/generator validation, then update `progress.md`.

---

## Completed: LMS Runtime UX QA Findings Closure (2026-05-23)

> Goal: close the latest QA findings that still prevent release-ready status: duplicate primary create controls, insufficient RU control-label oracles, weak spacing/toolbar geometry checks, missing ID uniqueness assertions after create/copy/restore, and backend regression gaps for reorder and hostile locale inputs.

### IMPLEMENT Action Plan

-   [x] Suppress duplicate top-level create actions when a metadata details widget owns the create-target toolbar.
-   [x] Strengthen browser UX oracles for RU control labels, single primary create action, module spacing/overlap, and toolbar geometry across desktop/tablet/mobile.
-   [x] Add create/copy/delete/restore ID uniqueness assertions and additional ISO leakage scans for date-heavy runtime grids.
-   [x] Add backend regressions for reorder duplicate/version-map failures and hostile `records.union` locale input.
-   [x] Run Prettier, focused unit/backend/fixture tests, local minimal Supabase E2E, and update progress with the closure outcome.

---

## Completed: LMS Runtime UX/i18n Release Blocker Remediation (2026-05-23)

> Goal: close the latest user-visible Learning Content blockers without LMS-only forks: locale-aware runtime dates, Russian resource preview labels, bilingual seeded LMS content on normal runtime surfaces, consistent toolbar/detail spacing, and executable Playwright UX oracles that catch these regressions.

### IMPLEMENT Action Plan

-   [x] Add generic runtime DATE/DATETIME display formatting that never exposes raw ISO timestamps on normal grids, cards, details tables, or player surfaces.
-   [x] Fix ResourcePreview i18n namespace usage and add regression coverage for Russian resource type/action labels.
-   [x] Normalize LMS template/snapshot user-facing strings so Russian runtime surfaces do not fall back to English seeded titles/body copy.
-   [x] Tighten Learning Content toolbar/detail spacing through existing MUI primitives without LMS-only runtime forks.
-   [x] Strengthen Playwright/runtime UX oracles for raw ISO dates, English fallback text, DataGrid leakage, control geometry, and no page-level overflow.
-   [x] Run Prettier, focused unit/fixture tests, local minimal Supabase E2E where feasible, and update progress with the remediation outcome.

---

## Completed: LMS Learning Content Post-QA Release Blocker Remediation (2026-05-23)

> Goal: close the latest release-blocking QA findings: make guest progress truly server-owned, enforce workspace limits on restore, prevent locked-row reorder mutations, remove public access-link slug ambiguity, align public workspace documentation with behavior, and replace weak public guest browser evidence with a realistic quiz/content flow.

### IMPLEMENT Action Plan

-   [x] Convert public guest progress to an action-intent API where the backend derives status/progress values.
-   [x] Enforce workspace row limits when restoring deleted runtime rows.
-   [x] Block persisted row reordering for locked runtime rows.
-   [x] Fail closed on duplicate public access-link slugs inside the same workspace and cover same-workspace/cross-workspace ambiguity.
-   [x] Align public workspace documentation with the implemented non-personal public workspace policy.
-   [x] Strengthen public guest Playwright evidence with real quiz questions, viewport/no-overflow checks, and request-body assertions.
-   [x] Run Prettier, focused lint/tests, fixture/no-fork gates, local minimal Supabase E2E, and update progress.

---

## Completed: LMS Learning Content Final QA Remediation Follow-up (2026-05-23)

> Goal: close the remaining post-QA findings that still block release-ready status after the previous public workspace isolation pass: guest progress/assessment concurrency, duplicate public-link slug ambiguity, runtime copy access-entry validation parity, and missing browser UX evidence for public guest viewport/localized negative paths.

### IMPLEMENT Action Plan

-   [x] Reconcile the previous follow-up checklist against the code and document which parent ACL/public workspace items were already completed.
-   [x] Make public guest progress writes concurrency-safe and fail closed without duplicate progress rows.
-   [x] Make public guest assessment attempt numbering concurrency-safe and covered by backend regression tests.
-   [x] Fail closed when the same public access-link slug exists in multiple active non-personal public workspaces.
-   [x] Apply access-entry membership validation parity to runtime copy overrides and add backend regression coverage.
-   [x] Strengthen Playwright UX evidence for public guest positive viewport/no-overflow paths and RU negative guest error pages.
-   [x] Run Prettier, focused lint/tests, release gates, local minimal Supabase browser E2E where feasible, and update progress with the remediation outcome.

---

## Completed: LMS Learning Content Final Security Gate Remediation (2026-05-23)

> Goal: close the latest QA blockers before the Learning Content plan can be treated as release-ready: enforce parent-derived row access for LMS outline records, apply row-level access to record posting commands, make original restore targets fail closed, wire executable release gates into CI/agent paths, remove stale docs wording, and strengthen guest/public UX leakage coverage.

### IMPLEMENT Action Plan

-   [x] Enforce runtime row-level edit access on direct `post`, `unpost`, and `void` record commands.
-   [x] Add generic parent-record access inheritance for child outline records and configure the LMS course/track child objects through metadata.
-   [x] Make original restore targets fail closed by validating existing parent references before undelete.
-   [x] Strengthen backend regression tests for record commands, child outline mutation boundaries, and restore target authorization.
-   [x] Wire LMS fixture/no-fork release gates into normal agent/CI checks and remove stale post-V2 docs wording.
-   [x] Strengthen public guest browser UX leakage coverage without LMS-only runtime forks.
-   [x] Run Prettier, focused lint/tests, fixture/no-fork/docs/audit checks, and update progress with the remediation outcome.

---

## Completed: LMS Learning Content QA Findings Remediation (2026-05-22)

> Goal: close the latest QA findings before the Learning Content plan can be treated as release-ready: enforce owner/shared access consistently across workflow, reference, and report helper paths; make mutation outcomes fail closed; remove user-facing option codenames; and add executable tests for the corrected contracts.

### IMPLEMENT Action Plan

-   [x] Enforce runtime row-level access on workflow actions, record-picker reference validation, and report reference-label joins.
-   [x] Make progress and reorder mutation paths fail closed with affected-row confirmation and duplicate-progress protection where the runtime contract supports it.
-   [x] Render string option values in runtime tables/cards with metadata labels instead of stored codenames.
-   [x] Add focused backend and frontend tests for the security, mutation, and display contracts.
-   [x] Run Prettier, focused lint/tests, fixture/no-fork gates, and update progress with the remediation outcome.

## Completed: LMS Learning Content QA Release Gate Closure (2026-05-22)

> Goal: close the post-QA release-gate gaps without adding LMS-only runtime forks: make the acceptance matrix honest about release vs deferred scope, prove reports through the UI, derive learner-player progress from persisted rows, and remove remaining localized-validation/display heuristics debt.

### IMPLEMENT Action Plan

-   [x] Tighten the LMS acceptance matrix so deferred or API-only areas cannot be counted as browser-proven release gates.
-   [x] Derive learner-player completion counts from persisted runtime item status as well as local completion state.
-   [x] Add UI-level Playwright evidence for running/exporting the primary Learning Content report surface.
-   [x] Close remaining generic validation and technical-field display heuristics that can leak internal text or hide legitimate business fields.
-   [x] Run Prettier, focused runtime UI tests, fixture/no-fork/docs guards, audit, and LMS Playwright validation.

---

## Completed: LMS Learning Content QA Blocker Remediation (2026-05-22)

> Goal: resolve the post-QA blocker list before considering the Learning Content productization plan closed: runtime access-entry integrity, owner/shared mutation boundaries, shared edit semantics, restore target authorization, backend suite stability, mobile runtime toolbar usability, accessible/localized row actions, and missing Playwright UX evidence.

### IMPLEMENT Action Plan

-   [x] Harden runtime access-entry creation/update so share rows cannot be forged through generic CRUD.
-   [x] Apply owner/shared row-level access consistently to update, bulk update, restore-target, reorder, and mutation access predicates.
-   [x] Distinguish shared read and shared edit access for copy/delete/restore/update-style mutations.
-   [x] Stabilize the full applications-backend test suite after canonical schema-name validation.
-   [x] Fix generic records-union mobile toolbar visibility and localized/row-aware action accessibility.
-   [x] Strengthen Playwright/browser UX evidence for mobile controls, reports UI/export, RU validation, and keyboard paths.
-   [x] Run Prettier, focused tests, full backend suite, app-template tests/lint/build, fixture/no-fork/docs/audit checks, and LMS Playwright validation.

---

## Completed: LMS Learning Content Final QA Fixes (2026-05-22)

> Goal: close the final QA findings after the Learning Content productization pass: enforce row-level runtime access on direct reads, reports, progress, copy, delete, and restore; finish numeric tabular UX; remediate moderate production dependency advisories; and re-run the focused validation chain.

### IMPLEMENT Action Plan

-   [x] Qualify and test runtime row-level access predicates for direct reads, reports, progress, copy, delete, and restore.
-   [x] Integrate and verify generic numeric tabular validation UX fixes.
-   [x] Remediate moderate production dependency audit advisories with minimal supported overrides/upgrades.
-   [x] Strengthen focused backend and runtime UX/test-oracle coverage for the QA gaps.
-   [x] Run Prettier, focused backend/frontend tests, fixture/no-fork/docs checks, dependency audit, and package builds.

---

## Completed: LMS Learning Content QA Remediation (2026-05-22)

> Goal: close the QA blockers found after the productization pass without LMS-only runtime forks: fail closed on sensitive runtime helper objects, prevent viewer re-share escalation, fix remaining generic runtime UX defects, strengthen executable fixture and browser oracles, and re-run the focused validation chain.

### IMPLEMENT Action Plan

-   [x] Harden runtime access controls for `records.union` helper-object targets and `library/shared` grants.
-   [x] Add backend coverage for union helper-object denial and shared-viewer re-share denial.
-   [x] Hide server-owned LMS author fields and add fixture contract coverage for duplicate/system-owned metadata regressions.
-   [x] Render semantic long text in tabular editors as multiline controls and add accessible row action labels.
-   [x] Strengthen frontend unit coverage for tabular long-text editing and accessibility labels.
-   [x] Strengthen Playwright UX oracles for fixed waits, copy lifecycle, reports/export, player leakage, and localized validation.
-   [x] Remediate production dependency audit high/critical findings where patched versions are available.
-   [x] Run Prettier, focused backend/frontend tests, fixture/no-fork/docs checks, audit, and LMS Playwright validation.

## Completed: Generic Runtime Table Column Visibility (2026-05-21)

-   [x] Add a generic runtime column visibility control to existing MUI toolbar primitives.
-   [x] Apply safe local column visibility preferences to current-object `detailsTable` and `records.union` DataGrid surfaces.
-   [x] Force technical runtime columns such as `ProjectId`, `TargetRecordId`, source JSON, and hidden internal fields out of the user-facing column menu.
-   [x] Keep at least one business column visible and preserve action/control columns outside normal user configuration.
-   [x] Add focused helper, runtime UI, and records.union widget tests for safe column visibility behavior.
-   [x] Run focused Prettier, apps-template tests, lint, build, no-LMS-fork, E2E, and whitespace validation.

## Completed: Generic Records Union Runtime Search (2026-05-21)

-   [x] Add a generic `showSearch` details-table metadata flag for `records.union` runtime widgets.
-   [x] Reuse the existing `ViewHeaderMUI` search control instead of adding an LMS-only toolbar or custom widget.
-   [x] Delegate runtime search to the server-side `records.union` datasource request while preserving static metadata search and resetting pagination to the first page.
-   [x] Enable search in the LMS Learning Content all/recent/starred/shared views and Trash view through template metadata.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator.
-   [x] Add schema, widget, fixture-contract, and browser E2E coverage for the generic search behavior.
-   [x] Run focused Prettier, type schema tests, apps-template tests, lint, builds, fixture contract, no-LMS-fork guard, generator, runtime E2E, and whitespace validation.

## Completed: LMS Guest Public Workspace Isolation QA Closure (2026-05-23)

-   [x] Seed LMS public guest links into a shared public workspace during the snapshot-import E2E flow and restore the main personal workspace as the default runtime workspace.
-   [x] Harden public guest runtime SQL reads so content, quiz, tabular child rows, and access-link usage updates are explicitly scoped by workspace when a public link belongs to a workspace.
-   [x] Split main-workspace and shared-public-workspace row-count assertions so guest participants, quiz responses, and content progress prove isolation instead of relying on aggregate counts.
-   [x] Prevent the MUI guest app from reusing a previous public-link session after navigating to another slug or locale.
-   [x] Add focused unit regression coverage for public-link session scoping and rerun the full local minimal Supabase snapshot-import browser flow.

---

## Historical Tasks (Condensed) ✅

### LMS Learning Content Productization Implementation ✅ (2026-05-20)

-   Phase 0: re-audit implementation seams and add executable acceptance gates for technical leakage, static LMS-fork drift, and docs/screenshot drift.
-   Details: progress.md#2026-05-20-lms-learning-content-productization-implementation

### Remaining Product Acceptance Closure ✅ (Older)

-   Reconcile the fixture-contract acceptance matrix against the remaining Phase 1 and Phase 3-8 checklist wording.
-   Details: progress.md#lder-remaining-product-acceptance-closure

### Final Release Validation ✅ (Older)

-   Verify the executable LMS product acceptance matrix has no open gates.
-   Details: progress.md#lder-final-release-validation

### LMS Product Acceptance Matrix Reconciliation ✅ (Older)

-   Inspect `LMS_PRODUCT_ACCEPTANCE_MATRIX` through the executable fixture-contract module.
-   Details: progress.md#lder-lms-product-acceptance-matrix-reconciliation

### Knowledge Base Actionable Gate ✅ (Older)

-   Confirm Phase 1 `records.union` foundation is already server-side and covered by generic backend/app-template tests.
-   Details: progress.md#lder-knowledge-base-actionable-gate

### Reports Audited Gate ✅ (Older)

-   Mark `reports.audited` complete in the fixture contract based on existing saved-report authorization, execution, export, and runtime identifier suppression coverage.
-   Details: progress.md#lder-reports-audited-gate

### Knowledge Base Audited Gate ✅ (Older)

-   Mark `knowledgeBase.audited` complete in the fixture contract based on seeded Knowledge spaces/folders/articles/bookmarks, published-app article create/edit evidence, and generic mutation/trash lifecycle coverage.
-   Details: progress.md#lder-knowledge-base-audited-gate

### Role Visibility Scoped Gate ✅ (Older)

-   Mark `roleVisibility.actionable` and `roleVisibility.audited` complete in the fixture contract for the current supported scope: workspace membership, owner/shared record access, and fail-closed unsupported scoped role-policy rules.
-   Details: progress.md#lder-role-visibility-scoped-gate

### Standalone LMS Fixture Contract Gate ✅ (Older)

-   Add a repository-supported root command for validating the committed LMS snapshot fixture contract without starting Playwright.
-   Details: progress.md#lder-standalone-lms-fixture-contract-gate

### Generic Course Field Report Coupling ✅ (Older)

-   Add one reusable Course business component to Learning Content union projections, default column settings, and the summary report filter/export path.
-   Details: progress.md#lder-generic-course-field-report-coupling

### Generic Guest Runtime Error Sanitization ✅ (Older)

-   Route public guest link, session, runtime, and quiz submit errors through the shared runtime error sanitizer.
-   Details: progress.md#lder-generic-guest-runtime-error-sanitization

### Generic Learner Player ID Fallback Safety ✅ (Older)

-   Replace learner-player user-facing row-id title fallbacks with localized untitled labels.
-   Details: progress.md#lder-generic-learner-player-id-fallback-safety

### Generic Runtime Record Picker Load Error Sanitization ✅ (Older)

-   Route runtime record picker load failures through the shared runtime error sanitizer.
-   Details: progress.md#lder-generic-runtime-record-picker-load-error-sanitization

### Generic Workspace Switcher ID Fallback Safety ✅ (Older)

-   Replace workspace-name raw ID fallbacks with localized untitled workspace labels.
-   Details: progress.md#lder-generic-workspace-switcher-id-fallback-safety

### Generic Datasource Load Error UX Safety ✅ (Older)

-   Show localized sanitized load errors for `records.list` details-table widgets.
-   Details: progress.md#lder-generic-datasource-load-error-ux-safety

### Generic Runtime Workspaces Raw-ID And Error Leakage Safety ✅ (Older)

-   Replace Runtime Workspaces page name/member fallbacks that expose workspace IDs or user IDs with localized labels.
-   Details: progress.md#lder-generic-runtime-workspaces-raw-id-and-error-leakage-safety

### Generic Workflow Row-Action Label Fallback Safety ✅ (Older)

-   Replace workflow action menu fallback labels that expose action codenames with localized generic labels.
-   Details: progress.md#lder-generic-workflow-row-action-label-fallback-safety

### Generic Runtime Record Picker ID Fallback Safety ✅ (Older)

-   Replace runtime record picker option fallbacks that expose row IDs with localized untitled record labels.
-   Details: progress.md#lder-generic-runtime-record-picker-id-fallback-safety

### Generic Details Tabs And Sequence Label Fallback Safety ✅ (Older)

-   Replace details-tabs missing-label fallbacks that expose tab IDs with localized tab labels.
-   Details: progress.md#lder-generic-details-tabs-and-sequence-label-fallback-safety

### Generic Relation Builder And Runtime List Fallback Safety ✅ (Older)

-   Replace relation-builder wizard step and panel label fallbacks that expose raw IDs with localized safe labels.
-   Details: progress.md#lder-generic-relation-builder-and-runtime-list-fallback-safety

### Generic Runtime Flow-List Cell Display Safety ✅ (Older)

-   Replace default flow-list description rendering that can expose raw JSON/object values with safe runtime formatting.
-   Details: progress.md#lder-generic-runtime-flow-list-cell-display-safety

### Generic Runtime Chart Axis Display Safety ✅ (Older)

-   Replace runtime chart x-axis fallback formatting that can expose raw JSON/object/UUID values with safe runtime formatting.
-   Details: progress.md#lder-generic-runtime-chart-axis-display-safety

### Generic Runtime Chart Metric Value Display Safety ✅ (Older)

-   Sanitize configured runtime chart metric values before passing them to chart components.
-   Details: progress.md#lder-generic-runtime-chart-metric-value-display-safety

### Generic Runtime DataGrid Cell Display Safety ✅ (Older)

-   Replace default runtime DataGrid cell formatting that can expose raw UUID values with safe runtime formatting.
-   Details: progress.md#lder-generic-runtime-datagrid-cell-display-safety

### Generic Runtime Stat Card Metric Value Display Safety ✅ (Older)

-   Sanitize configured overview stat-card metric values before rendering.
-   Details: progress.md#lder-generic-runtime-stat-card-metric-value-display-safety

### Generic Runtime Quiz Widget Text Display Safety ✅ (Older)

-   Sanitize quiz widget title, description, question, option, feedback, and empty-state text before rendering.
-   Details: progress.md#lder-generic-runtime-quiz-widget-text-display-safety

### Generic Runtime Object Display-Key Fallback Safety ✅ (Older)

-   Stop treating object-only `codename` and `id` fields as normal user-facing display labels.
-   Details: progress.md#lder-generic-runtime-object-display-key-fallback-safety

### Generic Resource Preview Title And Description Safety ✅ (Older)

-   Sanitize `ResourcePreview` title and description before rendering.
-   Details: progress.md#lder-generic-resource-preview-title-and-description-safety

### Generic Records Union Card-Mode Display Safety ✅ (Older)

-   Sanitize records-union card title and description values with the shared safe runtime display formatter.
-   Details: progress.md#lder-generic-records-union-card-mode-display-safety

### Generic Form Dialog JSON Field Display Safety ✅ (Older)

-   Stop rendering raw JSON strings for normal JSON fields without an approved runtime widget.
-   Details: progress.md#lder-generic-form-dialog-json-field-display-safety

### Generic Localized Inline Validation Helper Safety ✅ (Older)

-   Replace technical `min:` and `max:` helper text with localized user-facing length helper text.
-   Details: progress.md#lder-generic-localized-inline-validation-helper-safety

### Generic Target Picker Option Label Safety ✅ (Older)

-   Stop using object/record `Codename` fields as default user-facing target-picker labels.
-   Details: progress.md#lder-generic-target-picker-option-label-safety

### Generic Target And Share Mutation Error Sanitization Coverage ✅ (Older)

-   Add target-field mutation error coverage proving SQL, relation names, and UUIDs do not leak.
-   Details: progress.md#lder-generic-target-and-share-mutation-error-sanitization-coverage

### Generic Workspace Invite Email Validation ✅ (Older)

-   Validate workspace invite email input against the shared email contract before mutation submission.
-   Details: progress.md#lder-generic-workspace-invite-email-validation

### Generic Tabular Fetch Error Sanitization ✅ (Older)

-   Route TABLE child-row fetch errors through the shared runtime error sanitizer.
-   Details: progress.md#lder-generic-tabular-fetch-error-sanitization

### Generic Report Table Technical Column Safety ✅ (Older)

-   Filter unsafe technical report columns before rendering normal saved-report DataGrid surfaces.
-   Details: progress.md#lder-generic-report-table-technical-column-safety

### Generic Ledger Table Technical Field Safety ✅ (Older)

-   Filter technical ledger datasource columns before rendering normal runtime DataGrid surfaces.
-   Details: progress.md#lder-generic-ledger-table-technical-field-safety

### Generic Tabular String Object Display Safety ✅ (Older)

-   Replace `STRING` tabular object-value stringification with the shared safe runtime display formatter.
-   Details: progress.md#lder-generic-tabular-string-object-display-safety

### Generic Runtime Technical Column Safety ✅ (Older)

-   Filter technical runtime columns out of normal current-object and records-list grid column sets, even when metadata presets try to make them visible.
-   Details: progress.md#lder-generic-runtime-technical-column-safety

### Generic Resource Source Type Selector Labels ✅ (Older)

-   Replace raw resource type fallback labels in the `resourceSource` authoring selector with safe localized labels.
-   Details: progress.md#lder-generic-resource-source-type-selector-labels

### Generic Resource Preview Title Wrapping ✅ (Older)

-   Let long `ResourcePreview` titles wrap inside the existing MUI preview surface instead of truncating them with `noWrap`.
-   Details: progress.md#lder-generic-resource-preview-title-wrapping

### Generic Resource Preview Type Labels ✅ (Older)

-   Replace raw `ResourceSource.type` captions in `ResourcePreview` with localized resource type labels.
-   Details: progress.md#lder-generic-resource-preview-type-labels

### Learning Content Create Menu Deferred Package Evidence ✅ (Older)

-   Assert the disabled Import package create target reason in fixture-contract and template manifest coverage.
-   Details: progress.md#lder-learning-content-create-menu-deferred-package-evidence

### Generic Resource Preview Domain Badge ✅ (Older)

-   Add a safe domain badge to the generic `ResourcePreview` for URL-backed ready resources.
-   Details: progress.md#lder-generic-resource-preview-domain-badge

### Generic Create Target Capacity Hardening ✅ (Older)

-   Raise the generic `detailsTable.createTargets` schema capacity so LMS Learning Content is not capped at its current eight-item menu.
-   Details: progress.md#lder-generic-create-target-capacity-hardening

### Deferred Assessment Create Targets ✅ (Older)

-   Expose Quiz-lite and Assignment-lite as disabled metadata-defined Learning Content create targets.
-   Details: progress.md#lder-deferred-assessment-create-targets

### Generic Report Runtime Filters ✅ (Older)

-   Accept ad hoc report filters in the generic run/export report API payloads.
-   Details: progress.md#lder-generic-report-runtime-filters

### Generic Report Error UX Safety ✅ (Older)

-   Show a localized report-load error state instead of leaving failed report tables looking empty or stuck.
-   Details: progress.md#lder-generic-report-error-ux-safety

### Generic Records List Column Preset Parity ✅ (Older)

-   Apply `details.tableDefaults.columnPreset` to generic `records.list` details-table columns.
-   Details: progress.md#lder-generic-records-list-column-preset-parity

### Report Export Filename User Label Contract ✅ (Older)

-   Build CSV export filenames from localized report titles instead of technical report codenames.
-   Details: progress.md#lder-report-export-filename-user-label-contract

### Saved Report Widget Codename Contract ✅ (Older)

-   Add a generic `detailsTable.reportCodename` contract for saved report widgets.
-   Details: progress.md#lder-saved-report-widget-codename-contract

### Builder Report Definition Productization ✅ (Older)

-   Seed the Course Builder and Learning Track Builder report definitions that existing report widgets execute by codename.
-   Details: progress.md#lder-builder-report-definition-productization

### Generic Records Union Report Execution ✅ (Older)

-   Reuse the generic `records.union` datasource executor for saved report run/export without adding LMS-only report code.
-   Details: progress.md#lder-generic-records-union-report-execution

### Generic Records Union Target Filters ✅ (Older)

-   Add a generic `records.union` target-filter metadata contract for details-table widgets.
-   Details: progress.md#lder-generic-records-union-target-filters

### Generic Learner Player Settings Enforcement ✅ (Older)

-   Apply existing application-level `pagePlayer` settings to the generic `learnerPlayer` widget without LMS-only branches.
-   Details: progress.md#lder-generic-learner-player-settings-enforcement

### Generic Shared Workspace Member Row Actions ✅ (Older)

-   Add a generic `library.toggle` workspace-member target contract for shared `records.union` row actions.
-   Details: progress.md#lder-generic-shared-workspace-member-row-actions

## 1C-Compatible Template QA Remediation

-   [x] Fix object-compatible reference blockers so 1C-compatible target kinds cannot be deleted while referenced.
-   [x] Align nested enumeration deletion with the canonical `entity.enumeration.allowDelete` setting.
-   [x] Make template-managed entity type customization rules match schema sync behavior.
-   [x] Remove raw preset codename fallbacks from normal metahub create-option surfaces.
-   [x] Strengthen 1C-compatible Playwright UX evidence for listbox leakage, options tab labels, and responsive screenshots.
-   [x] Run Prettier, focused backend/types/frontend tests, lint/build checks, docs guard, and local Supabase Playwright verification.

## 1C-Compatible Route Isolation And UX Evidence Closure

-   [x] Enforce the original specialized route `kindKey` for object-compatible nested list/create/get/update/delete flows.
-   [x] Add backend regression tests for route/body/query kind mismatch rejection.
-   [x] Extend Playwright evidence after metahub creation to open the created metahub UI and check localized labels/no technical leakage.
-   [x] Run Prettier, focused backend/frontend/type checks, docs guard, and local Supabase Playwright verification.

## 1C-Compatible Runtime UX QA Closure

-   [x] Fix the Russian template description grammar and matching browser assertions.
-   [x] Prevent transient raw kind/internal fallback text and the unrelated hub instances request on specialized entity pages.
-   [x] Expose 1C-compatible local requisites and common requisites through entity type resource-surface metadata instead of generic component labels.
-   [x] Extend metahub settings registry/UI to show template-managed custom entity kind settings from entity type metadata.
-   [x] Strengthen tests for loading/network errors, resources terminology, settings tabs, and 1C-compatible create dialogs.
-   [x] Run Prettier, focused unit tests, lint, docs guard, and local Supabase Playwright verification where feasible.

## 1C-Compatible QA Blocker Remediation Action Plan

-   [x] Isolate direct `:kindKey` routes by overriding conflicting query/body kind and rejecting stored kind mismatches for get/update/delete/copy.
-   [x] Add backend route tests for direct route kind mismatch, query/body conflicts, and deterministic create collision responses.
-   [x] Make preset sync migrate legacy builtin rows without `systemTemplatePreset` while preserving conflict protection for custom/reserved non-managed kinds.
-   [x] Wire component/requisite UI and nested object mutation policy to active entity kind settings instead of hardcoded `entity.object.*` settings.
-   [x] Improve constructor/runtime UX evidence and Playwright coverage with user-visible actions and screenshots for resources, settings, and constructor flows.
-   [x] Remove or registry-manage non-affiliation seed settings so template metadata stays maintainable through the settings contract.
-   [x] Run Prettier, focused tests/lint/build checks, documentation guards, local minimal Supabase E2E build, and Playwright `@1c-compatible` verification.

## 1C-Compatible QA Findings Implementation Closure

-   [x] Remove normal-user PostgreSQL/storage details and raw component data-type codes from requisite/component tables and forms.
-   [x] Make 1C-compatible requisite surfaces consistently use user-facing requisite/register-field terminology.
-   [x] Add frontend tests proving requisites do not expose raw enum/PostgreSQL/internal component wording.
-   [x] Add backend regression coverage for 1C route security, collision, and kind-isolation gaps identified by QA.
-   [x] Extend Playwright `@1c-compatible` browser evidence to open and exercise a real requisites surface.
-   [x] Run Prettier, focused tests, lint/build checks, and local minimal Supabase Playwright verification where feasible.

## 1C-Compatible Runtime QA Remediation 2026-05-26

-   [x] Remove user-facing container assignment from 1C-compatible entity type metadata until subsystems are implemented.
-   [x] Rename shared 1C-compatible resource surfaces from Common Requisites to Requisites.
-   [x] Move 1C-compatible requisites authoring out of entity edit dialog tabs and expose an accessible Open Requisites action.
-   [x] Hide container/hub columns when the entity type does not expose tree assignment.
-   [x] Register distinct 1C-compatible sidebar icons instead of falling back to the generic box icon.
-   [x] Extend focused unit/E2E coverage for requisites navigation, resource labels, hidden containers, and icon metadata.
-   [x] Run Prettier, focused tests, lint/build checks, and local minimal Supabase Playwright verification where feasible.

## 1C-Compatible QA Findings Closure 2026-05-26

-   [x] Enforce delete/permanent-delete behavior policy for 1C-compatible constants and add backend regressions.
-   [x] Complete Playwright browser evidence for real UI metahub creation, requisite lifecycle, responsive/i18n/keyboard coverage.
-   [x] Add negative access and route-tampering coverage for 1C-compatible routes and requisites.
-   [x] Strengthen preset catalog assertions so tests reject missing, extra, or preview-only preset drift.
-   [x] Run Prettier, focused lint/build/test checks, docs guard, and local minimal Supabase Playwright verification.

## 1C-Compatible Full QA Remediation 2026-05-26

-   [x] Ship all 12 1C-compatible presets from the metahub template manifest and align tests/docs.
-   [x] Seed system-managed components for all object-like 1C entity kinds, not only the generic Object kind.
-   [x] Apply component/requisite route-kind isolation consistently across read, copy, update, move, reorder, display, child, and delete routes.
-   [x] Replace generic component wording with Requisite/Register Field terminology across 1C requisite edit/copy/delete dialogs.
-   [x] Strengthen backend and frontend regression tests for seed behavior, tampered routes, terminology, and full preset drift.
-   [x] Strengthen Playwright 1C-compatible evidence with normal-user UI creation/opening paths and stricter terminology assertions.
-   [x] Run Prettier, focused lint/build/test checks, docs guard, local minimal Supabase build, and Playwright `@1c-compatible` verification.

## Metahub Packages QA Remediation 2026-05-27

-   [x] Fix package data integrity for metahub copy, snapshot restore, RLS active predicates, and runtime package snapshot validation.
-   [x] Close user-facing UX issues for localized seed text, mutation error fallback, and accessible package table naming.
-   [x] Strengthen automated coverage for copy/restore/sync edge cases and package UI flows.
-   [x] Extend Playwright evidence for normal navigation, detach success, read-only UX, keyboard, responsive screenshots, and localized failure states.
-   [x] Run Prettier, focused tests/lint/build checks, local minimal Supabase build, and Playwright `@packages` verification.

## Metahub Packages Final QA Follow-Up 2026-05-27

-   [x] Fix package catalog attachment matching so only the attached registry version is marked connected when multiple versions share one package name.
-   [x] Add store-level multi-version regression coverage for the catalog attachment state.
-   [x] Keep the Colyseus server wrapper on `@colyseus/core` because the full `colyseus` package violates the workspace `blockExoticSubdeps` supply-chain policy through an exotic transport dependency.
-   [x] Run Prettier, install consistency, focused backend/frontend/wrapper tests, lint/build checks, full local minimal Supabase build, and Playwright `@packages` verification.

## MMOOMM Flight Simulator QA Remediation 2026-05-28

-   [x] Add explicit Movement Command Enumeration and Simulation Constants Set entities to the generated MMOOMM flight snapshot.
-   [x] Strengthen the MMOOMM flight fixture contract and tests so missing command/constants entities and duplicate scene object ids fail closed.
-   [x] Improve the generic PlayCanvas canvas widget realtime state and presentation prediction/correction contract without exposing technical errors.
-   [x] Add UI-level snapshot import evidence for the MMOOMM fixture and preserve the published runtime E2E coverage.
-   [x] Run Prettier, focused unit/contract tests, local minimal Supabase Playwright generator/runtime checks, build, and autoreview.

## MMOOMM Flight Simulator QA Findings Closure 2026-05-28

-   [x] Fix attached package import execution contracts so compiled module imports cannot succeed at build time and fail at runtime.
-   [x] Strengthen browser runtime evidence for UI schema sync, arrival/guard assertions, and deterministic realtime/error states.
-   [x] Add focused unit/regression tests for module package import surfaces and PlayCanvas realtime state handling.
-   [x] Regenerate/validate the MMOOMM flight fixture when implementation changes affect generated artifacts.
-   [x] Run Prettier, focused package tests/builds, local minimal Supabase generator/runtime Playwright checks, full build, and autoreview.

## MMOOMM Multi-Ship Access Lifecycle QA Closure 2026-05-29

-   [x] Track every authenticated member room client, including read-only observers, for fresh access revalidation.
-   [x] Close revoked member sockets and remove controlling ship runtime state fail-closed.
-   [x] Add backend regressions for revoked controlling and read-only clients.
-   [x] Run Prettier, focused backend tests, lint/build checks, DB access guard, and local minimal Supabase MMOOMM runtime E2E.

## MMOOMM Multi-Ship Final QA Findings Closure 2026-05-29

-   [x] Revalidate active public realtime viewers and close revoked public sockets fail-closed.
-   [x] Add backend regressions for public realtime revoke and room-level spawn failure.
-   [x] Strengthen Playwright evidence for user-visible runtime navigation and Russian localized runtime UI.
-   [x] Reduce flaky fixed waits in the MMOOMM runtime E2E where state-based assertions are available.
-   [x] Run Prettier, focused backend/frontend tests, lint/build checks, DB access guard, and local minimal Supabase MMOOMM runtime E2E.

## MMOOMM Multi-Ship QA Hardening Closure 2026-05-29

-   [x] Use request-scoped DB executor for authenticated member realtime matchmaking flows.
-   [x] Add server-side per-client Colyseus message rate limiting before intent payload parsing.
-   [x] Normalize module-provided guard half extents before movement/spawn guard checks.
-   [x] Add focused backend regressions for executor selection, rate limiting, and guard normalization.
-   [x] Run Prettier, focused backend tests, lint/build checks, and DB access guard.

## MMOOMM Multi-Ship Multi-Session Lifecycle QA Closure 2026-05-29

-   [x] Keep reused ships connected when one of multiple active controlling sessions drops.
-   [x] Add backend regression coverage for same-user multi-session drop lifecycle.
-   [x] Run Prettier, focused backend tests, lint/build checks, and DB access guard.

## MMOOMM Multi-Ship Final Browser Contract Closure 2026-05-29

-   [x] Add explicit authoritative current movement command state to the fixed-tick Colyseus ship schema.
-   [x] Strengthen backend regressions for `move_to_point`, `move_to_object`, and `stop` command state transitions.
-   [x] Fix PlayCanvas wheel input ownership so canvas zoom cannot scroll the page.
-   [x] Run Prettier, focused backend/frontend tests, lint/build checks, DB access guard, and local minimal Supabase MMOOMM runtime E2E.

## MMOOMM 3D Flight Orientation and Collision QA Closure 2026-05-30

-   [x] Replace planar-only PlayCanvas ship orientation with smooth full-3D forward alignment for local and remote ships.
-   [x] Align client prediction collision checks with the server-oriented body envelope so visual ship/station standoff is bounded.
-   [x] Strengthen generic fixed-tick movement tests for oriented half-extents, nose/side/vertical approach, and bounded standoff.
-   [x] Replace planar widget and Playwright oracles with 3D forward alignment and visual standoff checks.
-   [x] Regenerate or update the MMOOMM flight fixture snapshot when runtime source/module behavior changes.
-   [x] Run Prettier, focused tests, local minimal Supabase E2E where feasible, and autoreview.

## MMOOMM Multi-Ship Final QA Remediation 2026-05-30

-   [ ] Close the initial Colyseus `onJoin` stale-access window with fresh runtime access validation before any session or ship is registered.
-   [ ] Add backend regressions for revoked controlling and read-only access between `onAuth` and `onJoin`.
-   [ ] Strengthen runtime test oracles for localized realtime failure states, remote interpolation smoothness, and reconnect duplicate rendering evidence.
-   [ ] Run Prettier, focused tests, lint/build checks, local minimal Supabase MMOOMM runtime E2E, and autoreview.

## PlayCanvas Editor Package Foundation Implementation 2026-05-31

-   [x] Add an isolated `@universo-react/playcanvas-editor` workspace package with a pinned PlayCanvas Editor `v2.22.1` vendor snapshot.
-   [x] Add reproducible artifact build, manifest, static smoke server, Node/version/license guards, and package-local Vitest coverage.
-   [x] Add Playwright artifact smoke coverage for the generated nonblank safe page and static asset serving contract.
-   [x] Add repository isolation guards, CI entries, catalog-version exclusions, and docs in GitBook EN/RU structure.
-   [x] Run final formatted repo-level verification after implementation updates.

## PlayCanvas Editor Package Foundation QA Remediation 2026-05-31

-   [x] Add package-local browser smoke to required CI and agent verification gates.
-   [x] Harden the package preview server path traversal boundary and cover it with tests.
-   [x] Extend Playwright artifact smoke to desktop, tablet, and mobile viewport evidence.
-   [x] Strengthen the no-install/network and lockfile-mutation supply-chain guard.
-   [x] Make the PlayCanvas Editor Vite catalog exception explicit in the catalog guard.
-   [x] Run Prettier, focused package checks, browser smoke, repository guards, docs checks, lint, and diff checks.

## PlayCanvas Editor Metahub Authoring Surface QA Remediation 2026-06-01

-   [x] Enforce attachment display config at the backend artifact route and harden development URL validation.
-   [x] Surface server display-mode policy in the package settings UI without generic mutation-error workflows.
-   [x] Add focused backend, frontend, and Playwright coverage for the QA findings, including responsive evidence.
-   [x] Run Prettier, focused package tests, local minimal Supabase Playwright packages flow, isolation guard, and autoreview.

## PlayCanvas Editor Metahub Authoring Surface Post-Review Defect Closure 2026-06-01

-   [x] Force PlayCanvas Editor host launch through document navigation so route-specific CSP is applied.
-   [x] Normalize development URL CSP allowlist entries to origins, matching backend config validation.
-   [x] Align generated OpenAPI package schemas with the strict package settings API contract.
-   [x] Regenerate docs artifacts and rerun focused backend, rest-docs, E2E, isolation, diff, and autoreview checks.

## PlayCanvas Editor Host UX QA Closure 2026-06-01

-   [x] Add localized PlayCanvas Editor iframe loading and failure states so artifact readiness is not shown before frame load.
-   [x] Strengthen Playwright host evidence for blocked, misconfigured, iframe-load failure, and user-facing metahub navigation.
-   [x] Run Prettier, focused tests, isolation guard, local minimal Supabase Playwright packages flow, and autoreview.

## PlayCanvas Editor Final QA Findings Closure 2026-06-01

-   [x] Revalidate signed Editor artifact tokens against the current metahub package attachment state before serving static files.
-   [x] Make incompatible package version display-config changes require explicit reset instead of silently falling back to defaults.
-   [x] Add Playwright screenshot evidence for the missing-artifact host state.
-   [x] Run Prettier, focused backend/frontend/E2E checks, isolation guard, diff check, and subagent verification.

## PlayCanvas Editor Runtime Contract QA Closure 2026-06-01

-   [x] Keep runtime `_app_packages.config` propagation explicitly deferred by removing the half-read runtime export path.
-   [x] Align shared runtime package types with the deferred config contract.
-   [x] Make the signed Editor artifact route use the attached artifact descriptor manifest file name.
-   [x] Narrow the authoring-settings migration seed scope to match its checksum contract.
-   [x] Run Prettier, focused tests, isolation guard, diff check, and autoreview.

## Modules External Files Final QA Defect Closure 2026-06-02

-   [x] Route file-backed source-path critical sections through the advisory-lock transaction executor.
-   [x] Hydrate schema-scoped file-backed modules for entity action execution.
-   [x] Harden file write rollback around failed DB mutations and failed transaction commits.
-   [x] Fix file-backed to inline conversion from the Modules tab and add regression coverage.
-   [x] Run Prettier, focused backend/frontend tests, package builds, diff check, and local autoreview.

## Modules External Files Historical Schema Migration Closure 2026-06-02

-   [x] Keep historical `_mhb_modules` system table definitions immutable and move file-backed source columns into the current v4 definition only.
-   [x] Add regression coverage proving v3 definitions do not contain file-backed columns and v3→v4 migration is additive.
-   [x] Run Prettier, focused backend tests/builds, diff check, and local autoreview.

## Modules External Files Optimistic Lock And Source Path Closure 2026-06-02

-   [x] Require module `expectedVersion` for backend file-backed module updates and conversions before source file writes.
-   [x] Serialize file-backed create/update paths that attach to existing source files through the source-path lock and reject stale pre-lock reads.
-   [x] Add regression coverage for missing version guards and existing-file source-path critical sections.
-   [x] Run Prettier, focused backend tests/builds, diff check, local minimal Supabase Playwright flow, and autoreview.

## Modules External Files Checksum Guard QA Closure 2026-06-02

-   [x] Enforce current file checksum guards for file-backed metadata-only recompile and file-to-inline conversion flows.
-   [x] Harden module source tree copy against symlink artifacts and add regression coverage.
-   [x] Add focused backend regressions for stale source checksum rejection without weakening valid external-file recompile.
-   [x] Run Prettier, focused backend/frontend tests, diff check, local minimal Supabase Playwright flow, and autoreview.

## Modules External Files Runtime Sync Normalization Closure 2026-06-02

-   [x] Normalize published snapshot modules through an explicit runtime-field allowlist so authoring source metadata cannot affect `_app_modules` change detection.
-   [x] Add regression coverage proving `sourceCode` and `sourceStorage` in publication snapshots do not make runtime module sync permanently dirty.
-   [x] Run Prettier and focused applications-backend checks for the runtime sync boundary.

## Modules External Files Fixture And Source Root Closure 2026-06-02

-   [x] Add explicit `UPL_MODULE_SOURCE_ROOT` defaults for manual, example, and E2E backend env profiles.
-   [x] Surface the effective absolute file-backed module path in the Modules UI for metahub managers.
-   [x] Refresh the MMOOMM flight fixture snapshot hash after the external-file schema changes.
-   [x] Run Prettier, focused module tests, fixture contract check, and diff checks.
