# Progress Log

> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

## IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release      | Date       | Codename                    | Highlights                                                                               |
| ------------ | ---------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| 0.64.0-alpha | 2026-05-19 | Learning Compass 🧭         | LMS generic table widgets, Track Learner Player, runtime form UX safety, search          |
| 0.63.0-alpha | 2026-05-13 | Local Universe 🪐           | Local Supabase minimal stack, Object/Component terminology refactoring, workspace policy |
| 0.62.0-alpha | 2026-05-06 | Dynamic Portal 🌀           | LMS portal runtime MVP, Page entity authoring, Node.js 22 migration                      |
| 0.61.0-alpha | 2026-04-30 | Hardened Surface 🛡️         | Data-driven entity resource surfaces, runtime workspace management, GitBook docs refresh |
| 0.60.0-alpha | 2026-04-23 | Academic Foundation 🎓      | LMS MVP platform support, application layout management, empty template                  |
| 0.59.0-alpha | 2026-04-17 | Universal Entities 🧩       | Entity Component Architecture, entity-first transition, i18n refactoring                 |
| 0.58.0-alpha | 2026-04-08 | Ancient Manuscripts 📜      | Metahub scripting, quiz runtime, General section, shared attributes                      |
| 0.57.0-alpha | 2026-04-03 | Good Eyesight 🧐            | Playwright E2E coverage, QA hardening, controllers extraction                            |
| 0.56.0-alpha | 2026-03-27 | Cured Disease 🤒            | JSONB/VLC unification, security fixes, CSRF middleware                                   |
| 0.55.0-alpha | 2026-03-19 | Best Role 🎬                | Bootstrap superuser, admin roles, metapanel dashboard, workspaces                        |
| 0.54.0-alpha | 2026-03-13 | Beaver Migration 🦫         | Knex.js migration system, system app convergence, optimistic CRUD                        |
| 0.53.0-alpha | 2026-03-05 | Lucky Set 🍱                | Sets and constants, drag-and-drop ordering, metahub settings                             |
| 0.52.0-alpha | 2026-02-25 | Tabular Infinity 🤪         | TABLE attribute type, inline editing, NUMBER field improvements                          |
| 0.51.0-alpha | 2026-02-19 | Counting Sticks 🥢          | Enumerations, migration guard, data-driven MainGrid                                      |
| 0.50.0-alpha | 2026-02-13 | Great Love ❤️               | Template system, declarative DDL, layout widgets, cloning                                |
| 0.49.0-alpha | 2026-02-05 | Stylish Cow 🐮              | Layouts system, MUI 7 migration, display attributes, VLC support                         |
| 0.48.0-alpha | 2026-01-29 | Joint Work 🪏                | Metahub branches, three-level system fields, optimistic locking                          |
| 0.47.0-alpha | 2026-01-23 | Friendly Integration 🫶      | Publication versioning, schema-ddl package, runtime migrations                           |
| 0.46.0-alpha | 2026-01-16 | Running Stream 🌊           | Applications modules, metahubs publications, DDD refactoring                             |
| 0.45.0-alpha | 2026-01-11 | Structured Structure 😳     | Catalogs functionality, VLC localization, i18n integration                               |
| 0.44.0-alpha | 2026-01-04 | Fascinating Acquaintance 🖖 | Onboarding wizard, GDPR consent, Yandex SmartCaptcha                                     |
| 0.43.0-alpha | 2025-12-27 | New Future 🏋️‍♂️               | Onboarding wizard, start pages i18n, pagination fixes                                    |
| 0.42.0-alpha | 2025-12-18 | Dance Agents 👯‍♀️             | VLC system, dynamic locales, Flowise 3.x agents integration                              |
| 0.41.0-alpha | 2025-12-11 | High Mountains 🌄           | UUID v7 infrastructure, auth-frontend package, dynamic roles                             |
| 0.40.0-alpha | 2025-12-05 | Straight Rows 🎹            | Admin panel with RBAC, package extraction, global naming refactoring                     |
| 0.39.0-alpha | 2025-11-25 | Mighty Campaign 🧙🏿          | Campaigns integration, storages management, useMutation pattern                          |
| 0.38.0-alpha | 2025-11-21 | Secret Organization 🥷      | Organizations module, projects hierarchy, AR.js quiz nodes                               |
| 0.37.0-alpha | 2025-11-13 | Smooth Horizons 🌅          | Agents system, clusters module, OpenAPI 3.1 refactoring                                  |
| 0.36.0-alpha | 2025-11-07 | Revolutionary Indicators 📈 | Metaverse dashboard, analytics charts, sections refactoring                              |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃               | Rate limiting with Redis, i18n refactoring, TypeScript modernization                     |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️              | Global monorepo refactoring, tsdown implementation, dependency centralization            |
| 0.33.0-alpha | 2025-10-16 | School Test 💼              | Metaverses module, quiz timer, publication system fixes                                  |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴            | Publication system, Base58 links, access control, role-based permissions                 |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆         | Canvas versioning, Material-UI template system, UPDL refactoring                         |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪                | Passport.js + Supabase hybrid auth, Vitest coverage, AR.js camera mode                   |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒         | Metaverses architecture, cluster/domain/resource isolation, publication settings         |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨           | Resources and entities services, spaces refactoring, CTE queries                         |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣           | Template modularization, finance module, multiplayer-colyseus integration                |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌            | MMOOMM template extraction, PlayCanvas integration, Kiro IDE config                      |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼            | Metaverse module MVP, Space Builder, Gemini Code Assist rules                            |
| 0.24.0-alpha | 2025-08-12 | Stellar Backdrop 🌌         | Space Builder prompt-to-flow, AR.js wallpaper mode, uniks extraction                     |
| 0.23.0-alpha | 2025-08-05 | Vanishing Asteroid ☄️       | UPDL conditional parameters, custom modes system, Russian docs                           |
| 0.22.0-alpha | 2025-07-27 | Global Impulse ⚡️          | MMOOMM modular architecture, laser mining, inventory refactoring                         |
| 0.21.0-alpha | 2025-07-20 | Firm Resolve 💪             | PlayCanvas MMOOMM stabilization, handler refactoring, ship controls                      |

---

## 2026-06-01 - PlayCanvas Editor Host UX QA Closure

### Summary

Closed the remaining host UX QA gap for the PlayCanvas Editor metahub
authoring surface by making frame readiness explicit and adding browser
regressions for failure states that previously depended on implicit iframe
behavior.

### Completed

-   Added localized loading and load-failure states to the PlayCanvas Editor host
    iframe flow, and only show the artifact-ready state after the iframe has
    actually loaded.
-   Added same-origin artifact preflight handling so unavailable artifact routes
    fail closed with user-facing copy instead of exposing raw paths, HTTP
    statuses, or browser error details.
-   Closed the autoreview asset-loading defect by switching same-origin iframe
    artifacts to a short-lived tokenized artifact URL, preserving the host
    sandbox without `allow-same-origin` while allowing the sandboxed document to
    load static JS/CSS chunks without session cookies.
-   Closed the follow-up core middleware gap by routing dynamic signed artifact
    URLs through the shared API whitelist matcher and proving that neighboring
    metahub package routes remain authenticated.
-   Strengthened Playwright `@packages` coverage for user-facing metahub
    navigation, blocked and misconfigured host descriptors, and iframe load
    failure without raw technical leakage or horizontal overflow, including an
    anonymous browser-context request to the tokenized artifact URL.
-   Updated backend route tests, OpenAPI generation, and GitBook docs for the
    tokenized artifact route.

### Verification

-   `pnpm --filter @universo-react/metahubs-frontend build`
-   `pnpm --filter @universo-react/metahubs-backend build`
-   `pnpm --filter @universo-react/metahubs-backend test -- --runInBand src/tests/routes/packagesRoutes.test.ts src/tests/persistence/packagesStore.test.ts src/tests/services/MetahubPackagesService.test.ts src/tests/services/PackageSeeder.test.ts src/tests/services/SnapshotSerializer.test.ts src/tests/platform/packageAuthoringSettingsMigration.test.ts src/tests/platform/metahubsSchemaParityContract.test.ts`
-   `pnpm --dir packages/universo-react-metahubs-frontend exec vitest run --config vitest.config.ts src/domains/packages/ui/__tests__/MetahubPackagesTab.test.tsx --coverage.enabled=false`
-   `pnpm --filter @universo-react/rest-docs build`
-   `pnpm --filter @universo-react/utils test -- src/routes/__tests__/publicRoutes.test.ts`
-   `pnpm --filter @universo-react/utils build`
-   `pnpm --filter @universo-react/core-backend build`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm run build:e2e`
-   `node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "@packages"`
-   `pnpm run check:playcanvas-editor-isolation`
-   `git diff --check`

---

## 2026-06-01 - PlayCanvas Editor Metahub Authoring Settings Final QA Closure

### Summary

Closed the final QA findings for the PlayCanvas Editor metahub authoring
surface. Static artifact serving now uses deterministic package resolution and
realpath containment, config mutations are guarded against stale package
versions, and browser evidence covers the settings and embedded host flows
without weakening the iframe sandbox.

### Completed

-   Rejected duplicate authoring package slugs instead of selecting an arbitrary
    match, and resolved artifact manifest/index paths through the backend
    artifact boundary.
-   Added realpath-based containment checks for static artifact availability so
    symlink escapes and traversal attempts fail closed.
-   Normalized default attachment config from the registered authoring
    descriptor during attach and guarded config updates with the expected
    package id to close version/config races.
-   Expanded backend route, store, and service tests for artifact headers,
    manifest failures, symlink escapes, slug collisions, runtime filtering,
    copy behavior, and design-time snapshot config preservation.
-   Strengthened frontend and Playwright coverage for keyboard package actions,
    settings modes, localized validation, iframe sandbox/referrer/allow
    attributes, visual host evidence, direct read-only host denial, and
    read-only disabled controls.
-   Updated Russian user-facing copy from internal development URL terminology
    to the localized "development address" wording and documented the final
    behavior.
-   Closed the post-QA hardening pass: parent host responses now include
    `frame-src` and `child-src`, package OpenAPI schemas are generated from the
    OpenAPI source generator instead of hand-edited output, snapshot imports
    prevalidate package configs before attachment replacement, active
    PlayCanvas Editor package slugs are unique, and the placeholder artifact is
    locale-aware without loosening the iframe sandbox to `allow-same-origin`.

### Verification

-   `pnpm --filter @universo-react/metahubs-backend test -- --runInBand src/tests/routes/packagesRoutes.test.ts src/tests/persistence/packagesStore.test.ts src/tests/services/MetahubPackagesService.test.ts src/tests/services/MetahubModulesService.test.ts src/tests/services/SnapshotSerializer.test.ts src/tests/services/PackageSeeder.test.ts`
-   `pnpm --dir packages/universo-react-metahubs-frontend exec vitest run --config vitest.config.ts src/domains/packages/ui/__tests__/MetahubPackagesTab.test.tsx --coverage.enabled=false`
-   `pnpm --filter @universo-react/playcanvas-editor test`
-   `pnpm --filter @universo-react/playcanvas-editor editor:build`
-   `pnpm --filter @universo-react/playcanvas-editor editor:smoke`
-   `pnpm --filter @universo-react/playcanvas-editor editor:browser-smoke`
-   `pnpm run check:snapshot-fixtures-contract`
-   `pnpm --filter @universo-react/core-backend test -- --runInBand src/__tests__/App.initDatabase.test.ts`
-   `pnpm --filter @universo-react/types build`
-   `pnpm --filter @universo-react/core-backend build`
-   `pnpm --filter @universo-react/metahubs-frontend build`
-   `pnpm --filter @universo-react/metahubs-backend build`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase pnpm run build:e2e`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "@packages"`
-   `pnpm supabase:e2e:stop`
-   `pnpm run check:playcanvas-editor-isolation`
-   `git diff --check`

## 2026-06-01 - PlayCanvas Editor Metahub Authoring Settings QA Remediation

### Summary

Closed the QA findings for the PlayCanvas Editor metahub authoring surface
settings implementation. The package host and artifact routes are now
owner/admin design-time surfaces, attachment configs are validated against the
registered package descriptor, and metahub snapshots preserve authoring-only
settings without leaking them into runtime publication snapshots.

### Completed

-   Added a shared backend package config validator and applied it to config
    PATCH requests, snapshot restore, and package version changes.
-   Required `manageMetahub` for the PlayCanvas Editor authoring host and static
    artifact routes, and made host availability require both the manifest and
    `index.html`.
-   Split package snapshot listing into runtime publication mode and metahub
    export/import mode so authoring-only configs remain portable but do not
    propagate to published applications.
-   Added localized frontend development URL validation and disabled saving
    invalid settings before the backend request.
-   Strengthened backend route/store/serializer/seeder tests, frontend settings
    payload tests, and Playwright responsive/UX oracles for the packages tab and
    PlayCanvas Editor host.
-   Replaced the artifact unavailable page's internal smoke-mode wording with
    user-facing EN/RU status copy.

### Verification

-   `pnpm --filter @universo-react/metahubs-backend test -- --runInBand src/tests/routes/packagesRoutes.test.ts src/tests/persistence/packagesStore.test.ts src/tests/services/SnapshotSerializer.test.ts src/tests/services/PackageSeeder.test.ts`
-   `pnpm --dir packages/universo-react-metahubs-frontend exec vitest run --config vitest.config.ts src/domains/packages/ui/__tests__/MetahubPackagesTab.test.tsx --coverage.enabled=false`
-   `pnpm --filter @universo-react/playcanvas-editor test`
-   `pnpm --filter @universo-react/types build`
-   `pnpm --filter @universo-react/metahubs-frontend build`
-   `pnpm --filter @universo-react/metahubs-backend build`
-   `pnpm run build:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "@packages"`
-   `pnpm run check:playcanvas-editor-isolation`
-   `git diff --check`

## 2026-05-29 - MMOOMM Multi-Ship Authoritative Sync

### Summary

Implemented the MMOOMM multiplayer flight slice for published applications:
two authenticated users can connect to the same Colyseus world room, receive
separate server-owned ships, send movement intents only, and observe each
other's motion in real time through the PlayCanvas runtime.

### Completed

-   Added generic Colyseus helper coverage for deterministic safe spawn search,
    keyed snapshot interpolation, and prediction queue acknowledgement.
-   Refactored the fixed tick scene room to authoritative multi-ship state with
    per-user ownership, strict Zod intent validation, duplicate sequence
    rejection, safe spawn reservation, and `onAuth`/`onDrop`/`onReconnect`
    lifecycle handling.
-   Updated the isolated `apps-template-mui` PlayCanvas widget for local
    prediction, remote interpolation, local ship assignment, remote primitive
    rendering, localized realtime states, SDK reconnection, and non-passive
    canvas wheel ownership.
-   Regenerated the MMOOMM flight metahub snapshot from the Playwright
    generator with module-backed spawn options and multi-ship acceptance
    metadata, without changing metahub schema or template versions.
-   Expanded E2E coverage for two authenticated browser contexts, bidirectional
    ship movement visibility, stop, reconnect without duplicate ships, canvas
    rendering evidence, and no page-level overflow.
-   Updated GitBook flight simulator docs in English and Russian.

### Verification

-   `pnpm exec prettier --write ...`
-   `pnpm --filter @universo-react/colyseus-client test`
-   `pnpm --filter @universo-react/colyseus-server test`
-   `pnpm --filter @universo-react/applications-backend test -- src/tests/realtime/applicationsRealtimeRuntime.test.ts`
-   `pnpm --filter @universo-react/apps-template-mui test -- src/dashboard/components/__tests__/PlayCanvasCanvasWidget.test.tsx`
-   `pnpm --filter @universo-react/modules-engine test -- src/compiler.test.ts`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase pnpm run build:e2e`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "mmoomm flight metahub"`
-   `pnpm run check:mmoomm-flight-fixture-contract`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "imported MMOOMM flight snapshot"`

### Notes

-   The E2E runtime evidence includes the generated screenshots and trace/video
    artifacts from Playwright. The final runtime flow passed after switching
    canvas wheel zoom to a native non-passive listener so browser scrolling is
    blocked at the canvas boundary.
-   The targeted apps-template Vitest run still emits pre-existing React `act`
    and MUI `anchorEl` warnings from unrelated dialog/menu tests, but all 327
    package tests passed.

## 2026-05-29 - MMOOMM Multi-Ship Runtime QA Evidence Closure

### Summary

Closed the remaining browser-evidence gaps from the multi-ship runtime QA:
unauthorized realtime users now have explicit no-movement browser assertions,
and pointer capture release is directly asserted during PlayCanvas camera drag
and Escape handling.

### Completed

-   Added unauthorized realtime E2E assertions for disabled movement toolbar
    controls, canvas click, canvas double-click, Enter, Escape, no emitted
    movement intent, and no local movement drift.
-   Added a stable canvas `data-pointer-captured` test probe and Playwright
    assertions for capture during drag, release on pointer up, and release by
    Escape while capture is active.
-   Preserved the user-facing runtime surface: the new probe is a non-visible
    `data-*` oracle and does not expose IDs, JSON, room/session data, or server
    details.

### Verification

-   `pnpm exec prettier --write memory-bank/tasks.md packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx tools/testing/e2e/specs/flows/snapshot-import-mmoomm-flight-runtime.spec.ts`
-   `pnpm --filter @universo-react/apps-template-mui test -- src/dashboard/components/__tests__/PlayCanvasCanvasWidget.test.tsx`
-   `pnpm run test:e2e:mmoomm-flight-runtime:local-supabase`
-   `pnpm supabase:e2e:stop`

## 2026-05-28 - MMOOMM Flight Simulator Runtime Usability Closure

### Summary

Closed the manual QA findings for the MMOOMM flight simulator runtime. The
generated snapshot now exposes only the Welcome and Space runtime sections,
keeps the PlayCanvas widget scoped to Space, fills the available viewport
without page scroll, supports long-distance 3D double-click movement along the
camera ray, and rotates the controlled ship toward its movement direction.

### Completed

-   Replaced inherited runtime menu behavior with an explicit Welcome and Space
    navigation model in the fixture generator and fixture contract.
-   Added generic widget `visibleFor` support so module-backed widgets can be
    scoped by section id or codename without MMOOMM-specific template logic.
-   Adjusted PlayCanvas fit-viewport sizing so the canvas uses the runtime
    height budget without reintroducing vertical page scroll.
-   Changed empty-space double-click from a horizontal-plane pick to a
    camera-ray target with a default 720 meter intent distance.
-   Rotated the controlled ship toward predicted and authoritative movement
    direction and exposed stable `data-ship-forward-*` evidence for tests.
-   Strengthened browser evidence for curated navigation, no lower details
    widgets, canvas fill height, no page overflow, wheel zoom ownership,
    3D vertical movement, long travel distance, ship orientation, stop,
    station guard behavior, and read-only observer behavior.
-   Fixed module compiler bundling for target-specific runtime package imports
    so client-only and server-only wrapper imports do not break the opposite
    bundle.

### Verification

-   `pnpm exec prettier --write ...`
-   `pnpm --filter @universo-react/types test -- applicationLayouts --runInBand`
-   `pnpm --filter @universo-react/types build`
-   `VITEST_COVERAGE=false pnpm --filter @universo-react/apps-template-mui test -- src/dashboard/components/__tests__/PlayCanvasCanvasWidget.test.tsx --runInBand`
-   `pnpm --filter @universo-react/modules-engine test -- compiler --runInBand`
-   `pnpm --filter @universo-react/modules-engine build`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase pnpm run build:e2e`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "mmoomm flight"`
-   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/testing/e2e/support/checkMmoommFlightFixtureContract.ts tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "imported MMOOMM flight snapshot"`
-   `pnpm build`
-   `git diff --check`
-   `.agents/skills/autoreview/scripts/autoreview --mode local --no-web-search`

### Notes

-   Root build is green with existing non-fatal warnings for tsdown module type
    detection, unresolved external package references in the template/admin
    build, Vite CJS API deprecation, Dart Sass legacy API deprecation,
    PlayCanvas worker-thread browser externalization, and large Vite chunks.
-   Autoreview initially found a P1 compiler bundling issue for target-specific
    package imports; the compiler plugin now provides disabled virtual modules
    for the opposite bundle target, and the final autoreview pass reported no
    actionable findings.

## 2026-05-28 - MMOOMM Flight Simulator QA Remediation

### Summary

Closed the follow-up QA gaps found after the MMOOMM flight simulator
implementation. The generated metahub snapshot now explicitly includes movement
command and simulation-constant metadata entities, the fixture contract fails
closed on those entities and duplicate scene object ids, and browser evidence now
imports the product snapshot through the normal UI before creating the linked
application.

### Completed

-   Added the `MovementCommands` Enumeration with `MoveToPoint`, `MoveToObject`,
    and `Stop` values to the MMOOMM flight fixture generator.
-   Added the `FlightSimulationConstants` Set with finite NUMBER constants for
    cruise speed, acceleration, deceleration, and arrival radius.
-   Hardened the flight fixture contract to require the command/constant
    entities, fixed values, option values, module/widget bindings, and unique
    PlayCanvas scene object ids.
-   Added schema-level PlayCanvas scene validation so duplicate scene object ids
    fail during layout config parsing.
-   Expanded the PlayCanvas canvas widget realtime state model with localized
    unavailable, unauthorized, reconnecting, and disconnected states, plus
    presentation prediction that is corrected by authoritative state.
-   Replaced API-only runtime setup in the MMOOMM browser flow with UI snapshot
    import and UI application creation before runtime validation.
-   Clarified Colyseus matchmaker startup by using the default
    `matchMaker.accept()` call and revalidated realtime joins through browser
    E2E.

### Verification

-   `pnpm --filter @universo-react/types test -- --runInBand`
-   `pnpm --filter @universo-react/apps-template-mui test -- PlayCanvasCanvasWidget --runInBand`
-   `pnpm --filter @universo-react/applications-backend test -- applicationsRealtimeRuntime --runInBand`
-   `pnpm --filter @universo-react/apps-template-mui build`
-   `pnpm --filter @universo-react/applications-backend build`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm run build:e2e` with local Supabase E2E env
-   `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "mmoomm flight"` with local Supabase E2E env
-   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/testing/e2e/support/checkMmoommFlightFixtureContract.ts tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json`
-   `node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "imported MMOOMM flight snapshot"` with local Supabase E2E env
-   `git diff --check`
-   `.agents/skills/autoreview/scripts/autoreview --mode local --no-web-search`
-   `pnpm build`
-   `pnpm supabase:e2e:stop`

### Notes

-   Root build remains green with existing non-fatal warnings from tsdown module
    type detection, Vite/Dart Sass deprecations, PlayCanvas worker-thread
    externalization, and large Vite chunks.
-   Subagent startup was attempted but the environment reported the active agent
    thread limit, so remediation and verification were completed locally.

## 2026-05-28 - MMOOMM Flight Simulator QA Closure

### Summary

Closed the MMOOMM flight simulator QA implementation pass. The published
metahub snapshot now drives the PlayCanvas widget through a configured client
runtime module and the Colyseus room through a configured server runtime module,
with fail-closed module loading, hardened runtime-module responses, stronger
control/observer access coverage, and browser evidence for the playable flight
loop.

### Completed

-   Executed the configured PlayCanvas widget client module method before scene
    mount and exposed runtime execution evidence through stable canvas data
    attributes.
-   Added a browser-module runtime allowlist for compiled client bundles that
    import the generic PlayCanvas and Colyseus wrapper helpers.
-   Made realtime matchmake load the published server module by codename and use
    its internal room options instead of accepting stale widget-only module
    references.
-   Hardened runtime module bundle/call responses with safer error messages,
    content headers, and fail-closed behavior.
-   Fixed Colyseus control authorization propagation so editable member clients
    can send movement intents while observer clients stay read-only.
-   Stabilized the PlayCanvas widget lifecycle so React re-renders do not
    recreate the PlayCanvas application repeatedly.
-   Regenerated the MMOOMM flight snapshot through the product Playwright
    fixture generator and strengthened the snapshot contract checks.

### Verification

-   `pnpm install`
-   `pnpm exec prettier --write ...` for touched runtime, fixture, test, and
    Memory Bank files.
-   `pnpm --filter @universo-react/types build`
-   `pnpm --filter @universo-react/apps-template-mui build`
-   `pnpm --filter @universo-react/applications-backend test -- --runInBand src/tests/realtime/applicationsRealtimeRuntime.test.ts src/tests/services/runtimeModulesService.test.ts src/tests/routes/applicationsRoutes.test.ts`
-   `pnpm --filter @universo-react/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/runtime/__tests__/browserModuleRuntime.test.ts src/dashboard/components/__tests__/PlayCanvasCanvasWidget.test.tsx`
-   `pnpm run build:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "mmoomm flight"`
-   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/testing/e2e/support/checkMmoommFlightFixtureContract.ts`
-   `pnpm build`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "imported MMOOMM flight snapshot"`
-   `.agents/skills/autoreview/scripts/autoreview --mode local --no-web-search`

## 2026-05-28 - MMOOMM Flight Simulator Manual Runtime QA Closure

### Summary

Closed the manual runtime QA findings from the imported MMOOMM flight snapshot.
The runtime layout no longer inherits the lower details widgets, the PlayCanvas
surface owns wheel zoom without page scrolling, the canvas height fits the
available viewport, and station collision guarding now accounts for the full
controlled ship body both in package helpers and module runtime shims.

### Completed

-   Removed inherited `detailsTitle` and `detailsTable` widgets from the
    generated flight runtime layout and made the fixture contract fail closed if
    they return.
-   Added `heightMode: "fitViewport"` to the PlayCanvas widget schema and
    generated snapshot so the flight scene fills the runtime area without
    page-level vertical overflow.
-   Made the PlayCanvas widget prevent default wheel scrolling while hovered and
    route wheel input to follow-camera zoom.
-   Expanded server-side station guard checks by the controlled ship half
    extents, including the Colyseus server helper, realtime room options, and
    isolated-vm server module package shim.
-   Added client-side prediction guard expansion so visual prediction does not
    briefly draw the ship inside the station before authoritative correction.
-   Strengthened fixture, unit, and Playwright browser evidence for missing
    lower widgets, no vertical overflow, wheel zoom ownership, and continuous
    ship-vs-station AABB checks during movement.

### Verification

-   `pnpm exec prettier --write ...` for touched runtime, fixture, test, and
    Memory Bank files.
-   `pnpm --filter @universo-react/types test -- applicationLayouts --runInBand`
-   `pnpm --filter @universo-react/colyseus-server test -- --runInBand`
-   `pnpm --filter @universo-react/apps-template-mui test -- PlayCanvasCanvasWidget --runInBand`
-   `pnpm --filter @universo-react/applications-backend test -- applicationsRealtimeRuntime --runInBand`
-   `pnpm --filter @universo-react/modules-engine test -- runtime --runInBand`
-   `pnpm --filter @universo-react/modules-engine build`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase pnpm run build:e2e`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "mmoomm flight"`
-   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/testing/e2e/support/checkMmoommFlightFixtureContract.ts tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "imported MMOOMM flight snapshot"`
-   `git diff --check`
-   `.agents/skills/autoreview/scripts/autoreview --mode local --no-web-search`
-   `pnpm build`
-   `pnpm supabase:e2e:stop`

### Notes

-   The first autoreview pass found a real module-runtime shim mismatch for
    `controlledHalfExtents`; the shim was fixed and covered with a
    `modules-engine` regression test, and the second autoreview pass was clean.
-   Root build remains green with existing non-fatal warnings from tsdown module
    type detection, Vite/Dart Sass deprecations, PlayCanvas worker-thread
    externalization, and large Vite chunks.
-   Local minimal Supabase was stopped after the Playwright evidence run.

### Notes

-   The full build still emits existing non-fatal warnings from tsdown package
    module type detection, Vite CJS API deprecation, Dart Sass legacy API,
    PlayCanvas worker-thread externalization, and large Vite chunks.
-   A requested subagent review could not be started because the environment
    reported the active agent thread limit.

## 2026-05-27 - Autoreview Project Skill Adoption

### Summary

Vendored and adapted the OpenClaw `autoreview` skill as a project-local
`.agents/skills/autoreview/` workflow. The local skill now provides concise
Universo-specific closeout review guidance, copied helper scripts, explicit MIT
attribution, and validation commands that avoid live review-engine execution by
default.

### Completed

-   Added `.agents/skills/autoreview/SKILL.md` with project-local review
    triggers, target selection, engine guidance, no-`pnpm dev` constraints, and
    final-report expectations.
-   Copied upstream `scripts/autoreview` and `scripts/test-review-harness` from
    OpenClaw `agent-skills` commit
    `7b6ca5b2078af2746d1c4424fe90211901b997ae`.
-   Added SPDX/provenance comments to copied scripts and changed the harness
    default to Codex-only while keeping other engines opt-in.
-   Registered the imported skill and OpenClaw MIT notice in
    `.agents/skills/SOURCES.md`.

### Verification

-   `python3 /home/vladimir/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/autoreview`
-   `python3 - <<'PY' ... ast.parse(Path('.agents/skills/autoreview/scripts/autoreview').read_text(), filename='.agents/skills/autoreview/scripts/autoreview') ... PY`
-   `bash -n .agents/skills/autoreview/scripts/test-review-harness`
-   `.agents/skills/autoreview/scripts/autoreview --help`
-   `.agents/skills/autoreview/scripts/autoreview --dry-run`
-   `.agents/skills/autoreview/scripts/test-review-harness --help`
-   `pnpm exec prettier --write .agents/skills/autoreview/SKILL.md .agents/skills/SOURCES.md memory-bank/tasks.md memory-bank/progress.md memory-bank/plan/autoreview-skill-adoption-plan-2026-05-27.md memory-bank/research/autoreview-skill-adoption-research-2026-05-27.md`
-   `git diff --check`
-   Targeted grep check for upstream-specific operational wording in
    `.agents/skills/autoreview/`

### QA Closure

-   Replaced the implicit `git fetch origin --quiet` in branch bundle generation
    with an explicit `--fetch` opt-in so normal helper runs do not mutate remote
    refs.
-   Documented the `--fetch` behavior in `.agents/skills/autoreview/SKILL.md`.
-   Removed generated Python bytecode from the skill directory and switched the
    syntax validation command to AST parsing so validation does not recreate
    `__pycache__`.

### Final QA Closure

-   Made the explicit `--fetch` path fail closed when `git fetch origin --quiet`
    fails, preventing review against stale refs after a requested fetch.
-   Wrapped Codex and Droid temporary prompt/schema file cleanup in `finally`
    blocks so engine startup failures do not leave review bundles on disk.
-   Marked the saved adoption plan as completed and retained the detailed QA
    closure status in `memory-bank/tasks.md`.
-   Verified fetch failure in a temporary git repository without invoking a live
    review engine, and verified missing Codex/Droid binaries leave no temporary
    review prompt/schema files behind.

## 2026-05-27 - Metahub Packages QA Remediation

### Summary

Closed the QA remediation pass for the Metahub Packages MVP. Package
attachments now preserve data integrity across metahub copy, snapshot restore,
and runtime sync, with duplicate package-name guards, registry/source
validation, and explicit snapshot-empty replacement semantics.

### Completed

-   Strengthened package persistence, RLS predicates, copy/restore behavior,
    and application runtime sync validation so package attachments fail closed
    on unregistered, duplicated, or mismatched package data.
-   Removed normal-user raw package identifiers from the Packages tab and seed
    descriptions while keeping pinned upstream versions visible as user-facing
    dependency metadata.
-   Added an accessible table label, localized mutation fallback copy, and
    inline error alerts in mutation dialogs so failed attach/change operations
    remain visible even when snackbar rendering is unavailable.
-   Fixed the Resources page shared-container query so opening the Packages tab
    does not trigger read-only users into a forbidden shared-container
    bootstrap request.
-   Expanded backend, frontend, wrapper-package, and Playwright coverage for
    copy/restore/sync edge cases, read-only roles, attach/detach, localized RU
    error states, technical-leakage checks, and responsive viewport evidence.

### Verification

-   `pnpm install`
-   `pnpm --filter @universo-react/metahubs-backend test -- packagesStore.test.ts metahubsSoftDeleteParity.test.ts metahubsRoutes.test.ts SnapshotRestoreService.test.ts PackageSeeder.test.ts`
-   `pnpm --filter @universo-react/applications-backend test -- syncPackagePersistence.test.ts`
-   `pnpm --filter @universo-react/metahubs-frontend exec vitest run --config vitest.config.ts src/domains/packages/ui/__tests__/MetahubPackagesTab.test.tsx src/domains/entities/shared/ui/__tests__/SharedResourcesPage.test.tsx`
-   `pnpm --filter @universo-react/metahubs-frontend exec vitest run --config vitest.config.ts src/domains/packages/ui/__tests__/MetahubPackagesTab.test.tsx`
-   Targeted lint/build checks for applications backend, metahubs backend,
    metahubs frontend, template-mui, and the three wrapper packages.
-   `pnpm run build:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase pnpm --filter @universo-react/core-frontend build`
-   `pnpm run check:package-naming`
-   `pnpm run check:no-package-base-paths`
-   `pnpm --filter @universo-react/colyseus-client test`
-   `pnpm --filter @universo-react/colyseus-server test`
-   `pnpm --filter @universo-react/playcanvas-engine test`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep @packages`
-   `pnpm supabase:e2e:stop`

## 2026-05-25 - Packages Naming Convention Rollout

### Summary

Completed the repository-wide package naming cutover. All 32 active workspace
packages now use the canonical `packages/universo-react-<name>/` directory
layout and `@universo-react/<name>` npm package name. Existing legacy
`universo-*` package folders were flattened into the new prefix rather than
double-prefixed, and the implementation introduced no compatibility aliases,
re-export packages, publish aliases, or symlinks for the old `@universo/*`
scope.

### Implemented

-   Renamed every active workspace package directory and package manifest to
    the `universo-react` convention.
-   Rewrote active cross-package imports, root scripts, workspace dependencies,
    Turbo/Vitest/Jest/Playwright tooling, local Supabase helpers, CI
    instructions, agent guidance, GitBook docs, package READMEs, steering docs,
    and Memory Bank references to the new scope.
-   Published the canonical package naming convention in
    `.kiro/steering/structure.md` and `memory-bank/techContext.md`.
-   Added fail-closed repository guards for package naming, dependency graph
    drift, stale package-base references, `apps-template-mui` isolation, and
    React package loading.
-   Regenerated `pnpm-lock.yaml` from the renamed workspace tree.
-   Kept schema and template versions unchanged; only the canonical LMS fixture
    hash was refreshed after name-only snapshot content changes.

### Verification

-   `pnpm install`
-   `pnpm install --frozen-lockfile`
-   `pnpm exec turbo run build --force`
-   `pnpm build`
-   `pnpm run build:e2e:local-supabase`
-   `pnpm run test:e2e:smoke:local-supabase` (11 Playwright smoke tests through
    local minimal Supabase, no `pnpm dev`)
-   `pnpm run test:vitest` (192 files, 1263 tests)
-   Backend Jest matrix for `@universo-react/admin-backend`,
    `@universo-react/core-backend`, `@universo-react/applications-backend`, and
    `@universo-react/metahubs-backend`.
-   `pnpm lint --quiet`
-   `pnpm lint` (passed with existing warning-only lint debt)
-   `pnpm run check:package-naming`
-   `pnpm run check:apps-template-isolation`
-   `pnpm run check:no-package-base-paths`
-   `pnpm run check:react-bundle`
-   `pnpm run check:runtime-ux-agents`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm run check:lms-fixture-contract`
-   `pnpm run check:catalog-versions`
-   `pnpm docs:i18n:check`
-   `pnpm docs:gitbook-screenshot-assets:check`
-   `pnpm docs:lms-user-guide:check`
-   `node tools/compare-workspace-dependency-graph.mjs
memory-bank/implementation/packages-naming-convention-dependency-graph-before.json
memory-bank/implementation/packages-naming-convention-dependency-graph-after.json`
-   Final active-source searches found no remaining `@universo/*` imports or
    stale old package path references outside ignored/generated coverage and
    historical planning artifacts.

## 2026-05-26 - Packages Naming Convention QA Closure

### Summary

Closed the QA findings found after the repository-wide package naming rollout.
The follow-up removed active stale examples from agent guidance, public README
and GitBook architecture docs, and Memory Bank convention context. The package
naming guard now checks current docs/tooling/guidance for double-prefixed
package names, stale removed package examples, and generic package-layout text
that should use the canonical `packages/universo-react-<name>/package.json`
form. The DB access linter was also synchronized with the renamed package paths
so the existing Tier 3 exclusions apply to `packages/universo-react-*`
directories.

### Implemented

-   Fixed double-prefixed package-scope and package-path references in
    `memory-bank/techContext.md`.
-   Updated active `.gemini`, `.qoder`, `.github`, `AGENTS.md`, README, and
    GitBook monorepo-structure guidance to use real
    `packages/universo-react-*` examples and `@universo-react/*` filters.
-   Updated `tools/lint-db-access.mjs` excluded Tier 3 boundary paths from the
    old package directories to the renamed `packages/universo-react-*`
    directories.
-   Strengthened `tools/check-package-naming-convention.mjs` to fail closed on
    active double-prefix references, removed package examples, legacy filter
    examples, and active generic package-layout wording.
-   Added `pnpm check:package-naming` and `pnpm check:apps-template-isolation`
    to the main GitHub Actions workflow.

### Verification

-   `git ls-files -z --cached --others --exclude-standard | node
tools/check-package-naming-convention.mjs --from-ledger
memory-bank/implementation/packages-naming-ledger.json --allowlist
memory-bank/implementation/packages-naming-legacy-reference-allowlist.json
--stdin0`
-   `pnpm run check:package-naming`
-   `pnpm run check:apps-template-isolation`
-   `pnpm run check:no-package-base-paths`
-   `pnpm run check:react-bundle`
-   `node tools/lint-db-access.mjs`
-   `pnpm --filter @universo-react/auth-backend test -- --runInBand`
-   `pnpm --filter @universo-react/admin-backend test -- --runInBand`
-   `pnpm --filter @universo-react/applications-backend test -- --runInBand`
-   `pnpm lint --quiet`
-   `pnpm docs:i18n:check`
-   `pnpm docs:gitbook-screenshot-assets:check`
-   `pnpm install --frozen-lockfile`
-   `pnpm build`
-   `git diff --check`
-   A sidecar QA pass found no remaining blocker, major, or minor package
    naming rollout issues after the closure fixes.

## 2026-05-25 - Flatten Base Directory Index And Backend Matrix Closure

### Summary

Closed the final implementation gaps found by the last QA pass for the flat
package layout migration. The working tree was already flattened, but the Git
index still needed to be synchronized so staged verification no longer carried
old `packages/<name>/base` references. The backend Jest package matrix also
found stale package-local Jest mappers in migration packages and old virtual
mocks in core-backend tests that only surfaced once workspace packages resolved
from their flat package roots.

### Implemented

-   Synchronized the Git index with the flat package layout and included the
    Memory Bank plan, research, and implementation ledger artifacts in the
    tracked change set.
-   Removed the unnecessary root `@universo-react/migrations-platform` development
    dependency; root-level tools directly import `@universo-react/types` and
    `@universo-react/utils`, while migration commands execute through
    `pnpm --filter @universo-react/migrations-platform`.
-   Centralized the backend Jest mapper for `@universo-react/migrations-core` in
    `tools/testing/backend/jest.base.config.cjs` and removed stale package-local
    mappings from profile and migration package Jest configs.
-   Updated core-backend Jest mocks so existing tests continue to isolate
    workspace packages after flat package resolution, while preserving real
    `@universo-react/utils` exports where downstream imports need them.

### Verification

-   `pnpm install --frozen-lockfile`
-   Backend Jest matrix with `--runInBand --silent`:
    `@universo-react/admin-backend`, `@universo-react/applications-backend`,
    `@universo-react/auth-backend`, `@universo-react/metahubs-backend`,
    `@universo-react/profile-backend`, `@universo-react/schema-ddl`,
    `@universo-react/start-backend`, `@universo-react/core-backend`,
    `@universo-react/database`, `@universo-react/migrations-catalog`,
    `@universo-react/migrations-core`, and `@universo-react/migrations-platform`.
-   `pnpm --filter @universo-react/types build`
-   `pnpm --filter @universo-react/utils build`
-   `pnpm --filter @universo-react/migrations-platform build`
-   `pnpm --filter @universo-react/core-backend build`
-   `pnpm check:no-package-base-paths`
-   `find packages -mindepth 2 -maxdepth 2 -type d -name base -print`
-   `git grep -n -E 'packages/[A-Za-z0-9._-]+/base|packages/\*/base|/base/src|/base/package\.json|/base/README' -- . ':!memory-bank/**' ':!.manager/specs/**' ':!tools/fixtures/**'`
-   `git diff --check`
-   `pnpm exec turbo ls --output=json` (32 flat workspace packages)

## 2026-05-25 - Flatten Base Directory Final QA Remediation

### Summary

Closed the remaining QA blockers after the flat package layout migration. The
previous implementation had already moved package roots to
`packages/universo-react-<name>/package.json`, but final QA found several integration gaps:
new required files were not yet tracked, one core-backend Jest import expected a
commands barrel, one flat package Vitest config was missing from the root
workspace, the stale package-base guard was not part of CI or the agent E2E gate,
and local Supabase script tests did not assert exact flat frontend env paths.

### Implemented

-   Added the new stale path checker and `start-frontend` views components
    barrel to the tracked change set.
-   Added `packages/universo-react-core-backend/src/commands/index.ts` so existing
    command tests and compiled oclif startup can resolve `../commands` from the
    flat package root.
-   Included `packages/universo-react-block-editor/vitest.config.ts` in the root
    Vitest workspace.
-   Wired `pnpm check:no-package-base-paths` into the main GitHub Actions
    workflow and the `test:e2e:agent` gate.
-   Strengthened local Supabase package-script tests to assert exact flat
    frontend env paths for development and E2E profiles.

### Verification

-   `pnpm --filter @universo-react/core-backend test -- --runInBand`
-   `pnpm test:local-supabase:tools`
-   `pnpm --filter @universo-react/block-editor test`
-   `pnpm exec prettier --check package.json .github/workflows/main.yml vitest.workspace.ts tools/local-supabase/__tests__/package-scripts.test.mjs tools/check-no-package-base-paths.mjs packages/universo-react-core-backend/src/commands/index.ts packages/universo-react-start-frontend/src/views/components/index.ts memory-bank/tasks.md`
-   `pnpm build` (31/31 Turbo tasks passed; existing build warnings only)
-   `pnpm lint` (passed with existing warning-only lint debt)
-   `pnpm test:vitest` (192 files, 1263 tests)
-   `pnpm check:no-package-base-paths`
-   `git diff --check`
-   `find packages -mindepth 2 -maxdepth 2 -type d -name base -print`
-   `pnpm exec turbo ls --output=json` (32 flat workspace packages)
-   `pnpm test:e2e:smoke:local-supabase` (11 Playwright smoke tests through
    local minimal Supabase, no `pnpm dev`)
-   `pnpm supabase:e2e:stop`

## 2026-05-25 - Flatten Base Directory Implementation Closure

### Summary

Completed the package layout flattening refactor. Active workspace packages now use the flat `packages/universo-react-<name>/package.json` layout, `pnpm-workspace.yaml` discovers packages through `packages/*`, and the old package-root `base` layer has been removed from active package directories. Workspace, Turbo/package exports, local Supabase, E2E runner, OpenAPI/docs tooling, agent instructions, GitBook docs, and package README references were updated to the flat layout.

The final QA pass removed remaining active documentation references that still described package roots as `base/` directories, including repository guidelines, Kiro steering structure docs, and the Universo core frontend README tree. The stale path guard now also catches standalone active package-layout guidance and package tree snippets, while avoiding false positives such as "Supabase" and env-file base wording. The new `packages/universo-react-start-frontend/src/views/components/index.ts` barrel was verified as intentional because `src/views/index.ts` re-exports `./components` and the package build exposes the compiled `views/index` entry.

### Verification

-   `pnpm exec prettier --write .github/instructions/repository-guidelines.instructions.md .kiro/steering/structure.md packages/universo-react-core-frontend/README.md packages/universo-react-core-frontend/README-RU.md tools/check-no-package-base-paths.mjs memory-bank/tasks.md`
-   `pnpm check:no-package-base-paths`
-   `find packages -mindepth 2 -maxdepth 2 -type d -name base -print`
-   `pnpm build`
-   `pnpm lint` (passed with existing warning-only lint debt)
-   `pnpm test:vitest` (190 files, 1251 tests)
-   `pnpm test:e2e:smoke:local-supabase` (11 Playwright smoke tests through local minimal Supabase, no `pnpm dev`)
-   `pnpm supabase:e2e:stop`

## 2026-05-25 - Scripts To Modules Final QA Fix Closure

### Summary

Closed the final QA issues found after the Scripts to Modules rename implementation. Runtime client bundle downloads now use the same client-visible module predicate as the runtime module list, so direct bundle access cannot expose a module that has a client bundle but no client-targeted manifest methods. Deprecated snapshot compatibility aliases unrelated to the no-legacy rename contract were removed from application sync contracts, snapshot restore/serialization, canonical snapshot hashing, fixture contracts, and E2E import assertions. Committed fixture hashes were refreshed from the current canonical hash implementation.

### Verification

-   `pnpm --filter @universo-react/utils test -- publicationSnapshotHash snapshotArchive snapshotFixtures`
-   `pnpm --filter @universo-react/applications-backend test -- runtimeModulesService applicationsRoutes publicApplicationsRoutes`
-   `pnpm --filter @universo-react/metahubs-backend test -- SnapshotRestoreService SnapshotSerializer`
-   `pnpm docs:i18n:check`
-   `pnpm --filter @universo-react/applications-backend lint`
-   `pnpm --filter @universo-react/metahubs-backend lint`
-   `pnpm --filter @universo-react/utils lint`
-   `pnpm --filter @universo-react/utils build`
-   `pnpm --filter @universo-react/applications-backend build`
-   `pnpm --filter @universo-react/metahubs-backend build`
-   No Playwright rerun in this pass: the remaining fixes were backend/security and snapshot-hash contract changes, with prior module runtime browser evidence already recorded for the UI rename.

## 2026-05-25 - Scripts To Modules QA Fix Closure

### Summary

Closed the backend QA findings from the Scripts to Modules rename implementation. Snapshot module restore now stores source and normalized metadata only, drops imported precompiled bundles, derives a local restore checksum, and relies on publication-time compilation before modules reach application runtime. Snapshot module attachment kinds now fail closed unless they are known module anchors or match the kind of the restored source entity. Module updates no longer preserve out-of-scope library modules as legacy-compatible state.

### Verification

-   `pnpm --filter @universo-react/metahubs-backend test -- SnapshotRestoreService MetahubModulesService`
-   `pnpm --filter @universo-react/metahubs-backend test -- SnapshotSerializer publicationsController`
-   `pnpm --filter @universo-react/applications-backend test -- syncModulePersistence runtimeModulesService applicationsRoutes`
-   `pnpm --filter @universo-react/metahubs-backend lint`
-   `pnpm --filter @universo-react/metahubs-backend build`
-   `git diff --check`

## 2026-05-24 - LMS User Guide Final QA Gate Closure

### Summary

Closed the final QA issues in the LMS GitBook user-guide implementation. The generator and checker now fail closed on raw route identifiers, whole-viewport technical leakage, weak block-editor dialog coverage, and duplicate workflow screenshots that previously allowed visually repeated learner/course states.

### Implemented

-   Normalized dynamic application, public-link, UUID, and 32-hex route segments in screenshot provenance so committed evidence is stable and does not expose generated identifiers.
-   Added a provenance checker assertion that fails when any captured route still contains a raw UUID-like path segment.
-   Moved screenshot safety checks to the whole viewport before every full-window capture, including raw UUID substring checks, DataGrid leakage checks, and forbidden visible text checks.
-   Added LMS dialog oracles for semantic multiline fields and Editor.js body controls, verifying the visible editor holder instead of a single inner content block.
-   Made the learner-experience capture path idempotent for already-completed progress and changed the final persistence screenshot to show a distinct post-reload course selector state.
-   Folded `check:runtime-no-lms-forks` into `docs:lms-user-guide:check` so the standalone documentation check also guards against LMS-only runtime branches.

### Validation

-   `pnpm docs:lms-user-guide:verify:local-supabase`
-   `pnpm exec eslint tools/docs/check-lms-user-guide-docs.mjs tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts`
-   `git diff --check`
-   `node - <<'NODE' ... provenance raw-route check ... NODE`
-   `pnpm supabase:e2e:stop`

## 2026-05-24 - LMS User Guide Screenshot Oracle Hardening

### Summary

Closed the remaining LMS user-guide implementation gaps found by strict QA. The screenshot pipeline now rejects duplicate screenshots across the whole localized guide, records per-capture provenance for overview and workflow-step assets, and exercises edit/copy/delete/project/guest/report user paths before accepting regenerated documentation screenshots.

### Implemented

-   Strengthened `tools/docs/check-lms-user-guide-docs.mjs` with global duplicate PNG hash detection across all LMS guide assets.
-   Added per-capture provenance assertions for screenshot id, locale, normalized route, viewport, capture type, and workflow step mapping.
-   Expanded forbidden user-guide wording checks for implementation-only language such as source records, progress-store, application IDs, target IDs, and session tokens.
-   Added runtime form lifecycle coverage for edit and copy row actions to the LMS user-guide Playwright generator.
-   Reworked duplicate-prone captures so Learning Content create-menu, Projects create-menu, and Page resource overview screenshots represent distinct user states.
-   Included `check:runtime-no-lms-forks` in both LMS user-guide verify scripts so the documentation pipeline also guards against LMS-only runtime forks.

### Validation

-   `pnpm docs:lms-user-guide:verify:local-supabase`
-   `pnpm exec eslint tools/docs/check-lms-user-guide-docs.mjs tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts`
-   `git diff --check`
-   `rg -n "runtime|source record|progress-store|application IDs|target IDs|session tokens|Favorites|Действия строки|действия строки|ID рабочих пространств|внутренности хранилища|исходной записи|сырых идентификаторов" docs/en/lms docs/ru/lms docs/en/SUMMARY.md docs/ru/SUMMARY.md`
-   `sha256sum docs/ru/.gitbook/assets/lms-user-guide/getting-around-step-2.png docs/ru/.gitbook/assets/lms-user-guide/learning-content-library-step-1.png docs/en/.gitbook/assets/lms-user-guide/projects-step-1.png docs/en/.gitbook/assets/lms-user-guide/learning-content-library-step-4.png docs/en/.gitbook/assets/lms-user-guide/resources-pages-links.png docs/en/.gitbook/assets/lms-user-guide/resources-pages-links-step-2.png`
-   `pnpm supabase:e2e:stop`

---

## 2026-05-24 - LMS User Guide User-Facing Text And CI Gate Closure

### Summary

Closed the final QA blockers in the LMS GitBook user guide. The guide no longer relies on hidden screenshot comments, the user-facing pages avoid implementation-only terminology, and the docs checker now blocks both visible placeholder comments and internal language regressions.

### Implemented

-   Removed all `<!-- screenshot: ... -->` comments from English and Russian LMS guide pages while preserving the real visible per-step screenshot images.
-   Refactored `tools/docs/check-lms-user-guide-docs.mjs` so screenshot coverage is validated from the manifest, visible image references, committed assets, and provenance instead of hidden Markdown comments.
-   Added LMS user-guide checker failures for TODO/FIXME/placeholder markers and user-hostile technical wording such as raw ID/JSON/UUID, metahub, source-preview, workspace-selector, and row-action terminology.
-   Replaced internal setup, resource-source, row-action, and technical-value wording in the English and Russian guide pages with user-facing copy.
-   Broadened `.github/workflows/docs-lms-user-guide-screenshots.yml` so the local minimal Supabase screenshot verification runs for every pull request.

### Validation

-   `pnpm exec prettier --write docs/en/lms docs/ru/lms tools/docs/check-lms-user-guide-docs.mjs .github/workflows/docs-lms-user-guide-screenshots.yml memory-bank/tasks.md memory-bank/progress.md package.json`
-   `pnpm docs:lms-user-guide:check`
-   `pnpm docs:i18n:check`
-   `pnpm docs:gitbook-screenshot-assets:check`
-   `pnpm docs:lms-user-guide:verify:local-supabase`
-   `pnpm exec eslint tools/docs/check-lms-user-guide-docs.mjs tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts`
-   `git diff --check`

---

## 2026-05-24 - LMS User Guide Step Screenshot Closure

### Summary

Closed the second LMS GitBook user-guide remediation pass. The documentation now uses detailed English and Russian workflow pages with real per-step localized screenshots, the Playwright generator captures meaningful state changes instead of duplicating overview buffers, the learner-experience step screenshots no longer duplicate each other, and the docs checker rejects stale placeholders, duplicate step images, weak manifest coverage, and user-visible technical leakage.

### Implemented

-   Reworked the LMS user-guide screenshot generator so every workflow step performs a concrete UI action before capture.
-   Regenerated English and Russian `1920x1080` full-window screenshots through the local minimal Supabase E2E stack.
-   Strengthened `docs:lms-user-guide:check` to fail on duplicated step screenshot hashes, stale assets, missing visible images, raw IDs, raw ISO dates, TanStack or React Query devtools text, and forbidden English fallback text on Russian pages.
-   Adjusted the learner-experience generator path so the second documented step selects a different outline item before capture, then returns to the first item for completion, preventing repeated screenshots from passing.
-   Updated manifest evidence for the deterministic EN/RU generation order, including the RU project count after the EN-created project persists and the localized RU guest-content assertion.
-   Added `docs:lms-user-guide:verify` and `docs:lms-user-guide:verify:local-supabase` so teams can run build, screenshot regeneration, and all docs checks in the correct order.
-   Added a targeted LMS user-guide screenshots workflow that runs the local minimal Supabase browser generator before the static documentation checks for PRs touching the LMS docs/runtime screenshot surface, then fails if regenerated screenshots or provenance were not committed.
-   Removed the tracked `.env.e2e.backup` file from the Git index and local workspace; the existing `**/.env*.backup` ignore rule now keeps backup files out of future commits.
-   Expanded LMS user-guide pages and related guide cross-links while preserving English/Russian structural parity.
-   Fixed localized LMS fixture/report data paths that could otherwise leak English report labels, instructor names, or raw technical values into Russian runtime screenshots.

### Validation

-   `pnpm docs:lms-user-guide:screenshots:local-supabase`
-   `pnpm docs:lms-user-guide:verify:local-supabase`
-   `pnpm docs:lms-user-guide:check`
-   `pnpm docs:i18n:check`
-   `pnpm docs:gitbook-screenshot-assets:check`
-   `pnpm exec prettier --write .github/workflows/docs-lms-user-guide-screenshots.yml package.json memory-bank/tasks.md memory-bank/progress.md tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts tools/docs/lms-user-guide-screenshot-manifest.json`
-   `pnpm exec eslint tools/docs/check-lms-user-guide-docs.mjs tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts tools/testing/e2e/support/browser/runtimeUx.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/support/lmsSnapshotImport.ts packages/universo-react-applications-backend/src/controllers/runtimeReportsController.ts packages/universo-react-apps-template-mui/src/api/api.ts packages/universo-react-apps-template-mui/src/dashboard/components/MainGrid.tsx packages/universo-react-apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/universo-react-apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx packages/universo-react-apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo-react/apps-template-mui test -- widgetRenderer`
-   `pnpm --filter @universo-react/metahubs-backend test -- templateManifestValidator`
-   `pnpm --filter @universo-react/applications-backend build`
-   `pnpm --filter @universo-react/apps-template-mui build`
-   `pnpm --filter @universo-react/core-frontend build`

---

## 2026-05-24 - LMS User Guide QA Remediation

### Summary

Closed the QA blockers in the LMS GitBook user guide. Russian user-guide pages now have localized boilerplate headings and role/goal labels, every workflow step has a visible GitBook image instead of an invisible screenshot comment placeholder, and the LMS docs checker now fails closed on the exact regression classes that were missed: English RU boilerplate and numbered steps without adjacent visible screenshots.

### Implemented

-   Localized Russian LMS user-guide section labels: role, goal, prerequisites, workflow, result, checks, and related pages.
-   Added visible step-level screenshots after every numbered workflow step in all English and Russian LMS user-guide pages.
-   Added derived step-level screenshot assets for all manifest `workflowStepIds` and updated the Playwright generator to refresh those assets whenever overview screenshots are regenerated.
-   Strengthened `tools/docs/check-lms-user-guide-docs.mjs` to validate H1 headings against the manifest, enforce workflow step counts, require `step -> visible image -> marker`, inspect step image dimensions, and reject English boilerplate in Russian pages.

### Validation

-   `pnpm run docs:lms-user-guide:screenshots:local-supabase`
-   `pnpm run docs:lms-user-guide:check`
-   `pnpm run docs:i18n:check`
-   `node tools/docs/check-gitbook-links.mjs && node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm exec eslint tools/docs/check-lms-user-guide-docs.mjs tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts tools/testing/e2e/support/lmsSnapshotImport.ts`

---

## 2026-05-24 - LMS User Guide GitBook Documentation

### Summary

Implemented the first-class bilingual GitBook LMS user guide for applications created from `tools/fixtures/metahubs-lms-app-snapshot.json`. The guide now has matching English and Russian task-based pages, localized `1920x1080` screenshot assets, existing guide cross-links, a manifest-driven documentation checker, and a Playwright generator that recreates screenshots from the canonical LMS snapshot on the dedicated local minimal Supabase E2E profile.

### Implemented

-   Added `docs/en/lms/` and `docs/ru/lms/` as a new top-level GitBook section with 13 paired user-facing workflow pages.
-   Updated both `SUMMARY.md` files and existing LMS guide pages with links into the new runtime user guide.
-   Added localized LMS screenshot assets under `.gitbook/assets/lms-user-guide/` with manifest coverage and strict dimension validation.
-   Added `tools/docs/check-lms-user-guide-docs.mjs` and package scripts for user-guide documentation QA.
-   Added a Playwright screenshot generator that imports the canonical LMS snapshot through the UI, creates and syncs an application, captures whole-window `1920x1080` screenshots, blocks TanStack Query banner leakage, scans for raw IDs/raw ISO/object leakage, and verifies RU fallback text is not visible.

### Validation

-   `pnpm run build:e2e:local-supabase`
-   `pnpm run docs:lms-user-guide:screenshots:local-supabase`
-   `pnpm run docs:lms-user-guide:check`
-   `pnpm run docs:i18n:check`
-   `node tools/docs/check-gitbook-links.mjs && node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm exec eslint tools/docs/check-lms-user-guide-docs.mjs tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts tools/testing/e2e/support/lmsSnapshotImport.ts`

---

## 2026-05-23 - LMS Runtime UX/i18n Release Blocker Remediation

### Summary

Closed the screenshot-driven LMS runtime UX/i18n blockers. Normal runtime surfaces now format date and datetime values for the active locale instead of exposing raw ISO timestamps, ResourcePreview uses the correct application i18n namespace, LMS seeded runtime copy is bilingual on Russian surfaces, Learning Content toolbar/detail spacing is more consistent, and the browser suite has executable canaries for the exact defect classes reported by the user.

### Implemented

-   Added generic locale-aware DATE/DATETIME display formatting for runtime values, DataGrid columns, cards, and detail surfaces.
-   Fixed ResourcePreview localization for resource type/action labels and normalized page/source body rendering so Russian previews no longer show English fallback text for localized content.
-   Normalized LMS template and generated snapshot body text to VLC where the content is user-facing, without introducing LMS-only runtime forks.
-   Tightened existing MUI toolbar controls and detail spacing to avoid mixed button heights and cramped module transitions.
-   Strengthened Playwright UX oracles for raw ISO timestamps, English fallback text on Russian LMS surfaces, DataGrid technical leakage, toolbar control geometry, and page-level horizontal overflow.
-   Fixed the generic `records.union` backend projection path so localized string fields and referenced labels use the requested runtime locale.

### Validation

-   `pnpm exec prettier --write ...` for the touched runtime UI, backend, LMS template, fixture, and E2E files.
-   `pnpm exec vitest run --workspace vitest.workspace.ts packages/universo-react-apps-template-mui/src/utils/__tests__/displayValue.test.ts packages/universo-react-apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx packages/universo-react-apps-template-mui/src/components/runtime-ui/__tests__/runtimeUi.test.tsx`: 28 passed.
-   `pnpm run check:lms-fixture-contract`: passed.
-   `pnpm run check:runtime-no-lms-forks`: passed.
-   `pnpm --filter @universo-react/applications-backend test -- src/tests/routes/applicationsRoutes.test.ts --runInBand`: 155 passed.
-   `pnpm --filter @universo-react/applications-backend build`: passed.
-   `pnpm run build:e2e:local-supabase`: passed on local minimal Supabase.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium --grep "lms snapshot fixture imports"`: 2 passed in 3.6 minutes on local minimal Supabase.

## 2026-05-23 - LMS Learning Content Post-QA Release Blocker Remediation

### Summary

Closed the post-QA release blockers for the public LMS guest runtime and generic runtime row mutation contracts. Guest progress is now server-owned, restore and reorder mutations fail closed under workspace limits and locked-row constraints, duplicate public access-link slugs inside one workspace are rejected, and the public guest browser evidence now exercises a realistic content-plus-quiz journey on local minimal Supabase.

### Implemented

-   Converted public guest progress writes to an action-intent API; browser requests can only send the participant/session/content identity and an action, while the backend derives status, percent, and last accessed item from persisted content data.
-   Validated public guest progress content-item references before writing progress and rejected browser-owned `status`, `progressPercent`, and `lastAccessedItemIndex` payload fields through strict schema parsing.
-   Made same-workspace duplicate public access-link slugs fail closed while preserving the existing cross-workspace ambiguity protection.
-   Enforced workspace object row limits before restoring deleted runtime rows.
-   Blocked persisted runtime row reordering when any selected row is locked and guarded the update statement against locked targets.
-   Aligned public workspace documentation with the implemented policy that public runtime links resolve through non-personal shared workspaces, not personal `Main` workspaces.
-   Strengthened the LMS public guest Playwright flow with real learning content, embedded quiz questions, answer submission, `Score 2 / 2` verification, viewport screenshots, no page-level overflow checks, technical-leakage checks, and guest-progress request-body assertions.

### Validation

-   `pnpm exec prettier --write` on the updated backend, frontend, E2E, docs, and Memory Bank files.
-   `pnpm --filter @universo-react/applications-backend test -- --runTestsByPath src/tests/routes/publicApplicationsRoutes.test.ts src/tests/routes/applicationsRoutes.test.ts --runInBand`: 2 suites and 181 tests passed.
-   `pnpm --dir packages/universo-react-apps-template-mui exec vitest run --config vitest.config.ts src/standalone/__tests__/GuestApp.test.tsx`: 14 tests passed.
-   `pnpm exec eslint` on the changed backend controllers/tests, `GuestApp`, `GuestApp.test`, and LMS public guest E2E spec: passed.
-   `pnpm run check:runtime-no-lms-forks`: passed.
-   `pnpm run check:lms-fixture-contract`: passed.
-   `pnpm --filter @universo-react/applications-backend build`: passed.
-   `pnpm --filter @universo-react/apps-template-mui build`: passed.
-   `pnpm run build:e2e:local-supabase`: passed against local minimal Supabase.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --grep "enforce the guest journey"`: 2 browser tests passed against local minimal Supabase after fixing the completion-response assertion to wait for the `complete` request body.
-   `git diff --check`: passed before the final Memory Bank update.

## 2026-05-23 - LMS Learning Content Final QA Remediation Follow-up

### Summary

Closed the remaining QA follow-up items after the public workspace isolation pass. Public guest writes now serialize progress and assessment-attempt mutations, duplicate active public access-link slugs across public workspaces fail closed, runtime access-entry validation is applied during copy, and public guest browser evidence now covers positive viewport/no-overflow paths and RU negative link errors on local Supabase.

### Implemented

-   Added transaction-scoped advisory locks for public guest content-progress writes and assessment attempt numbering.
-   Moved public guest assessment attempt-number calculation into the same transaction that writes responses.
-   Changed workspace-aware public access-link lookup to return a link only when exactly one active non-personal public workspace owns the requested slug or id.
-   Applied runtime access-entry membership validation to copied rows before any copy insert can run.
-   Strengthened backend regression tests for duplicate public slugs, guest progress locks, guest assessment locks, transactional attempt numbering, and access-entry copy validation.
-   Strengthened public guest Playwright coverage with viewport matrix screenshots, no page-level horizontal overflow checks, technical-leakage checks, and RU wrong-slug error coverage.
-   Reconciled the active Memory Bank follow-up: the parent ACL and public workspace isolation items were already completed in the previous security gate entry; only the concurrency, duplicate slug, copy validation, and browser evidence items remained active in this pass.

### Validation

-   `pnpm exec prettier --write` on the updated backend, E2E, and Memory Bank files.
-   `pnpm --filter @universo-react/applications-backend test -- --runInBand src/tests/routes/publicApplicationsRoutes.test.ts src/tests/routes/applicationsRoutes.test.ts`: 2 suites and 177 tests passed.
-   `pnpm --filter @universo-react/applications-backend lint`: passed.
-   `pnpm exec eslint tools/testing/e2e/support/browser/runtimeUx.ts tools/testing/e2e/specs/flows/lms-guest-public-runtime.spec.ts tools/testing/e2e/specs/flows/lms-guest-public-runtime-negative.spec.ts`: passed.
-   `pnpm run check:lms-fixture-contract`: passed.
-   `pnpm run check:runtime-no-lms-forks`: passed.
-   `pnpm run check:runtime-ux-agents`: passed.
-   `git diff --check`: passed.
-   `pnpm supabase:e2e:start:minimal`: local E2E Supabase minimal stack started.
-   `pnpm env:e2e:local-supabase`: local E2E env files regenerated.
-   `pnpm doctor:e2e:local-supabase`: passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-guest-public-runtime.spec.ts tools/testing/e2e/specs/flows/lms-guest-public-runtime-negative.spec.ts --project=chromium`: 3 browser tests passed on local Supabase.

## 2026-05-23 - LMS Learning Content Final Security Gate Remediation

### Summary

Closed the final security and release-gate remediation slice for the LMS Learning Content productization work. Runtime record commands now enforce row-level edit access, LMS child outline objects inherit parent record access through generic metadata, restore-to-original fails closed when the original parent is no longer valid, and public guest browser coverage verifies negative access-link paths without technical leakage.

### Implemented

-   Enforced runtime row-level edit access on direct `post`, `unpost`, and `void` record-state commands by applying the edit ACL in both the locked row selection and final update.
-   Added generic `runtimeRecordParentAccess` metadata support with parent-reference validation and SQL access inheritance for child outline records.
-   Configured LMS `CourseSections`, `CourseItems`, `TrackStages`, and `TrackSteps` to inherit access from their parent `Courses` or `LearningTracks` records.
-   Hardened create, update, bulk update, restore, and original-target restore paths so invalid or unauthorized parent references fail closed instead of silently reviving or moving rows.
-   Updated the LMS template fixture, fixture-contract checks, and CI/agent gates for the new parent-access metadata and no-fork runtime constraints.
-   Normalized public access-link dates and numeric counters returned by Postgres so guest links expire and exhaust consistently across unit tests, built server runs, and browser E2E.
-   Strengthened public guest Playwright flows for active, wrong-slug, expired, and exhausted access links, including technical-leakage checks on public runtime pages.
-   Removed stale post-V2 and legacy wording from LMS Learning Content docs.
-   Sanitized `.env.e2e.backup` to placeholders after local secret-like values were present in the working diff; any real exposed credentials still need external rotation and history cleanup.

### Validation

-   `pnpm exec prettier --write` on the updated backend, template, fixture, E2E, docs, CI, and Memory Bank files.
-   `pnpm --filter @universo-react/applications-backend lint`: passed.
-   `pnpm exec eslint tools/testing/e2e/specs/flows/lms-guest-public-runtime.spec.ts tools/testing/e2e/specs/flows/lms-guest-public-runtime-negative.spec.ts tools/testing/e2e/support/lmsRuntime.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`: passed.
-   `pnpm --filter @universo-react/applications-backend test -- --runInBand src/tests/services/runtimeReportsService.test.ts src/tests/routes/applicationsRoutes.test.ts src/tests/routes/publicApplicationsRoutes.test.ts`: 3 suites and 185 tests passed.
-   `pnpm --filter @universo-react/metahubs-backend test -- --runInBand --testPathPattern "templateManifestValidator.test.ts|metahubSchemaService.test.ts" --testNamePattern "lms|LMS|built-in lms|template"`: 20 passed, 6 skipped.
-   `pnpm --filter @universo-react/applications-backend build`: passed.
-   `pnpm --filter @universo-react/metahubs-backend build`: passed after rerunning sequentially instead of concurrently with the applications backend build.
-   `pnpm run check:lms-fixture-contract`: passed.
-   `pnpm run check:runtime-no-lms-forks`: passed.
-   `pnpm docs:i18n:check`: passed for 75 EN/RU pairs.
-   `node tools/docs/check-gitbook-links.mjs && node tools/docs/check-gitbook-screenshot-assets.mjs`: passed.
-   `pnpm audit --prod --audit-level=low`: passed with no known vulnerabilities.
-   `pnpm run check:runtime-ux-agents`: passed.
-   `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-guest-public-runtime.spec.ts --project=chromium`: 2 passed for the positive guest runtime flow.
-   `E2E_FULL_RESET_MODE=off node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-guest-public-runtime-negative.spec.ts --project=chromium`: 2 passed for wrong-slug, expired, and exhausted guest-link behavior.
-   A normal full-reset negative E2E run also passed the browser tests, but final Supabase cleanup hit a transient `EAI_AGAIN` DNS error; the follow-up `pnpm run test:e2e:cleanup` completed successfully.
-   `git diff --check`: passed.

## 2026-05-22 - LMS Learning Content QA Findings Remediation

### Summary

Closed the remaining QA findings for the LMS Learning Content release gate. Runtime row-level access is now applied consistently to workflow actions, record-picker reference validation, and report reference-label joins; progress and reorder mutations fail closed; and runtime table/card displays render configured option labels instead of stored codenames.

### Implemented

-   Added owner/shared row-access checks for workflow action targets before scripts run.
-   Applied target-row access predicates to record-picker reference validation and runtime reference option hydration.
-   Added access-aware report reference-label metadata and SQL placeholder shifting so report joins cannot reveal labels for rows the caller cannot read.
-   Hardened progress persistence and parent-progress aggregation with advisory locks, `RETURNING` confirmation, and explicit zero-row failure paths.
-   Hardened runtime reorder with affected-row confirmation and backend tests for the new mutation contract.
-   Added generic string-option display formatting for runtime DataGrid, table, and card surfaces so values such as `selectedItems` and `passedFailed` render as localized labels.
-   Strengthened the LMS Playwright flow with visible row-order assertions after reorder and E2E-only API rate-limit overrides for the long browser scenario.
-   Remediated production audit findings for `qs` and `@tootallnate/once` with patched overrides and a narrow `minimumReleaseAgeExclude` entry for the emergency `qs` security patch.

### Validation

-   `pnpm exec prettier --write` on the updated backend, frontend, E2E, and Memory Bank files.
-   `pnpm --filter @universo-react/applications-backend test -- --runInBand src/tests/services/runtimeReportsService.test.ts`: passed.
-   `pnpm --filter @universo-react/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 147 passed.
-   `pnpm --filter @universo-react/apps-template-mui test -- src/utils/__tests__/displayValue.test.ts src/utils/__tests__/columns.test.tsx`: 307 passed across the package suite.
-   `pnpm --filter @universo-react/applications-backend lint`: passed.
-   `pnpm --filter @universo-react/apps-template-mui lint`: passed.
-   `pnpm --filter @universo-react/core-frontend build`: passed.
-   `pnpm exec eslint tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`: passed.
-   `pnpm run check:runtime-no-lms-forks`: passed.
-   `pnpm run check:lms-fixture-contract`: passed on Node.js 22.
-   `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project=chromium --grep "lms snapshot fixture imports"`: 2 passed, including setup and the full LMS browser flow.
-   `git diff --check`: passed.
-   `pnpm install --lockfile-only`: passed.
-   `pnpm install --frozen-lockfile`: passed.
-   `pnpm audit --prod --audit-level=low`: passed with no known vulnerabilities.

### 2026-05-22: LMS Learning Content QA Release Gate Closure ✅

-   Added explicit browser/API/fixture evidence fields to the LMS acceptance matrix and prevented d...

### 2026-05-22: LMS Learning Content QA Remediation Closure ✅

-   Hardened generic runtime access handling for `records.union` helper-object targets and `library...

### 2026-05-22: LMS Learning Content Productization Final Validation ✅

-   Marked Phase 10 complete in `tasks.md` for the current plan state.

### 2026-05-22: Role Visibility Scoped Gate ✅

-   Marked `roleVisibility.actionable` and `roleVisibility.audited` complete in `LMS_PRODUCT_ACCEPT...

### 2026-05-22: Knowledge Base Audited Gate ✅

-   Marked `knowledgeBase.audited` complete in `LMS_PRODUCT_ACCEPTANCE_MATRIX`.

### 2026-05-22: Reports Audited Gate ✅

-   Marked `reports.audited` complete in `LMS_PRODUCT_ACCEPTANCE_MATRIX`.

### 2026-05-22: Knowledge Base Actionable Gate ✅

-   Confirmed the Phase 1 `records.union` datasource foundation is already server-side: the app-tem...

### 2026-05-22: LMS Product Acceptance Matrix Reconciliation ✅

-   Confirmed the matrix has no open gates for content projects, Learning Content shell, standalone...

### 2026-05-22: Standalone LMS Fixture Contract Gate ✅

-   Added `pnpm run check:lms-fixture-contract` as the supported command for validating `tools/fixt...

### 2026-05-22: Generic Resource Preview Title And Description Safety ✅

-   Routed `ResourcePreview` title and description through the shared safe runtime display formatter.

### 2026-05-22: Generic Records Union Card-Mode Display Safety ✅

-   Changed the records-union card value formatter to use `formatRuntimeSafeValue`.

### 2026-05-22: Generic Form Dialog JSON Field Display Safety ✅

-   Replaced the generic JSON fallback editor with a localized read-only structured-data message.

### 2026-05-22: Generic Localized Inline Validation Helper Safety ✅

-   Added a shared length constraint helper for simple, versioned, and localized inline field varia...

### 2026-05-22: Generic Target Picker Option Label Safety ✅

-   Removed `Codename`/`codename` from default target picker label candidates.

### 2026-05-22: Generic Target And Share Mutation Error Sanitization Coverage ✅

-   Added share-member mutation failure coverage for the generic records-union shared action dialog.

### 2026-05-22: Generic Runtime Quiz Widget Text Display Safety ✅

-   Added safe display normalization for quiz title, description, submit/next labels, question prom...

### 2026-05-22: Generic Runtime Object Display-Key Fallback Safety ✅

-   Restricted generic object display keys to explicit human label fields: `label`, `name`, `title`...

### 2026-05-21: Generic Runtime Record Picker And Relation Builder Error Sanitization ✅

-   Routed `FormDialog` runtime record picker load failures through `extractRuntimeErrorMessage`.

### 2026-05-21: Generic Workspace Switcher ID Fallback Safety ✅

-   Replaced current workspace and workspace menu raw ID name fallbacks with `workspace.untitled`.

### 2026-05-21: Generic Guest Runtime Error Sanitization ✅

-   Added sanitized guest error rendering in `GuestApp` for link load, guest session creation, runt...

### 2026-05-21: Generic Learner Player ID Fallback Safety ✅

-   Added a learner-player safe row-text helper backed by the shared runtime safe display formatter.

### 2026-05-21: Generic Tabular Fetch Error Sanitization ✅

-   Routed TABLE child-row fetch errors through `extractRuntimeErrorMessage` via the existing `getT...

### 2026-05-21: Generic Report Table Technical Column Safety ✅

-   Filtered report definition columns with technical fields like `TargetRecordId`, `sourceJson`, a...

### 2026-05-21: Generic Ledger Table Technical Field Safety ✅

-   Filtered ledger datasource columns with the shared runtime technical-field classifier, includin...

### 2026-05-21: Generic Tabular String Object Display Safety ✅

-   Replaced `STRING` tabular object-value `JSON.stringify` fallback with `formatRuntimeSafeValue`.

### 2026-05-21: Generic Runtime Technical Column Safety ✅

-   Exported generic runtime grid column classifiers from `useRuntimeColumnVisibility`.

### 2026-05-21: Generic Resource Source Type Selector Labels ✅

-   Added shared default resource type labels for app-template runtime fallback paths.

### 2026-05-21: Generic Resource Preview Title Wrapping ✅

-   Removed MUI `noWrap` from the generic `ResourcePreview` title.

### 2026-05-21: Generic Resource Preview Type Labels ✅

-   Replaced raw `ResourceSource.type` preview captions with localized resource type labels in the ...

### 2026-05-21: Learning Content Create Menu Deferred Package Evidence ✅

-   Added fixture-contract coverage for the disabled Import package create target and its canonical...

### 2026-05-21: Generic Resource Preview Domain Badge ✅

-   Added a generic domain chip to `ResourcePreview` for safe ready URL sources using the shared `p...

### 2026-05-21: Generic Create Target Capacity Hardening ✅

-   Raised `detailsTable.createTargets` capacity from 8 to 16 in the generic application layout sch...

### 2026-05-21: Generic Report Runtime Filters ✅

-   Added optional ad hoc report filters to generic runtime report run/export payloads.

### 2026-05-21: Generic Report Error UX Safety ✅

-   Added a localized report-load error state to `ReportDetailsTableWidget`.

### 2026-05-21: Generic Records List Column Preset Parity ✅

-   Applied runtime table column presets before building `records.list` MUI DataGrid columns.

### 2026-05-21: Report Export Filename User Label Contract ✅

-   Added a generic report CSV filename builder in the published MUI report widget.

### 2026-05-21: Saved Report Widget Codename Contract ✅

-   Added the generic `detailsTable.reportCodename` metadata contract in shared application layout ...

### 2026-05-21: Builder Report Definition Productization ✅

-   Seeded `CourseBuilderOutline` and `TrackBuilderOutline` report definitions in the LMS template.

### 2026-05-21: LMS Learning Content Generic Learner Player Settings Enforcement ✅

-   Applied `details.pagePlayer.showOutline` to the learner-player item outline and nested Editor.j...

### 2026-05-21: LMS Learning Content Generic Shared Workspace Member Row Actions ✅

-   Extended the shared `library.toggle` row action contract with `principalTarget`, localized dial...

### 2026-05-21: LMS Learning Content Generic Target-Field Row Actions ✅

-   Added the shared `field.updateWithTarget` row action contract with target object collection ref...

### 2026-05-21: Records Union Trash Runtime E2E Stabilization ✅

-   Added a stable `records-union-details-table` runtime marker for generic union table surfaces.

### 2026-05-21: LMS Learning Content Report REF Filtering And Trash Restore Target Picker ✅

-   Extended runtime report SQL generation so `contains`, `startsWith`, `endsWith`, and `equals` fi...

### 2026-05-21: LMS Learning Content Generic Project Create Target And Report REF Safety ✅

-   Added `ContentProjects` to the LMS Learning Content `detailsTable.createTargets` metadata with ...

### 2026-05-21: LMS Learning Content Generic SharedAt Projection And Shared View Ordering ✅

-   Added a generic shared-relation timestamp projection for principal-based `runtimeLibrary.shared...

### 2026-05-21: LMS Learning Content Generic Runtime Shared Relation Mutation ✅

-   Added `shared` to the generic runtime library relation key contract alongside starred and recen...

### 2026-05-21: LMS Learning Content Generic Runtime Recent Ordering ✅

-   Added a generic `recentAt` virtual projection for `records.union` rows, sourced from the config...

### 2026-05-21: LMS Learning Content Generic Runtime Recent Capture ✅

-   Added `recent` as a generic runtime library relation key alongside `starred`.

### 2026-05-21: LMS Learning Content Generic Records Union Project Labels ✅

-   Added an optional generic `records.union` target `projectField` contract.

### 2026-05-20: LMS Learning Content Generic Records Union Starred Actions ✅

-   Added a generic `detailsTable.rowActions` schema for `library.toggle` actions targeting the `st...

### 2026-05-20: LMS Learning Content Generic Runtime Report REF Label Projection ✅

-   Enriched runtime report field metadata with object reference target and display-component label...

### 2026-05-20: LMS Learning Content Generic Runtime Report Primitive ID Output Safety ✅

-   Added generic primitive ID suppression to runtime report CSV serialization for `*Id` fields and...

### 2026-05-20: LMS Learning Content Generic Runtime Report Export Output Safety ✅

-   Replaced generic CSV object fallback serialization with safe report value formatting in `Runtim...

### 2026-05-20: LMS Learning Content Generic Create-Target Resource Policy Availability ✅

-   Added generic create-target availability resolution in `detailsTable` create menus based on `cr...

### 2026-05-20: LMS Learning Content Generic Settings-Derived Create Defaults ✅

-   Added a safe `contextPath` create-default source to the shared application layout schema, inclu...

### 2026-05-21: Generic Records Union Report Execution ✅

-   Reused `executeRuntimeRecordsUnionDatasource` from the runtime rows controller for saved report...

### 2026-05-20: LMS Learning Content Generic Resource Source Policy ✅

-   Added a generic `resourceSourceTypes` policy to `FormDialog`, `CrudDialogs`, and `DashboardDeta...

### 2026-05-20: LMS Learning Content Generic Runtime UX Projection Slice ✅

-   Changed `records.union` rendering so projection columns are merged across all configured target...

### 2026-05-20: LMS Learning Content Runtime Safety Slice ✅

-   Added executable guard scripts for runtime LMS-only branch drift and GitBook link/screenshot as...

### 2026-05-19: Runtime UI UX Viewport Matrix Closure ✅

-   Added `RUNTIME_UX_VIEWPORT_MATRIX` and `expectRuntimeUxViewportMatrix` for `1920x1080`, `768x10...

### 2026-05-19: Runtime UI UX Quality Gate ✅

-   Added portable `mui-runtime-ux-patterns` and `runtime-ux-qa` skills with focused references and...

### 2026-05-18: LMS Learning Content Product UX Remediation ✅

-   Made optional `resourceSource` fields submit as absent until a concrete locator is provided, wh...

### 2026-05-20: LMS Learning Content Records Union Presentation Bridge ✅

-   Preserved `titleField`, `statusField`, `typeField`, and `updatedAtField` from `records.union` t...

### 2026-05-18: LMS Learning Content Final QA Closure ✅

-   Removed public guest runtime compatibility for `module` targets and kept only `content`, `asses...

### 2026-05-18: LMS Learning Content No-Modules Remediation ✅

-   Removed the active `Modules` entity path from the LMS template/generator/fixture contract/snaps...

### 2026-05-18: LMS Runtime Copy UI Integration ✅

-   Routed `useCrudDashboard` copy submissions through `adapter.copyRow`.

### 2026-05-18: LMS Runtime Copy Relations ✅

-   Added `config.runtimeCopy.relations` support to the runtime rows controller.

### 2026-05-17: LMS Parent Progress Aggregation ✅

-   Added `runtimeProgress.aggregateParents` handling to the runtime progress endpoint.

### 2026-05-17: LMS Enrollment Wizard Due-Date Derivation ✅

-   Added generic `uiConfig.derivedDateOffset` handling in the published app `FormDialog`.

### 2026-05-17: LMS Generic Learner Player Shell ✅

-   Added the generic `learnerPlayer` widget to the published MUI app template renderer.

### 2026-05-17: LMS Server-Owned Sequence Progress Guard ✅

-   Added generic Object-level `config.runtimeProgress.sequencePolicy` support for server-owned pro...

### 2026-05-17: LMS Scoped Sequence Availability In Details Tables ✅

-   Added optional `scopeFieldCodename` to the shared sequence policy contract so availability can ...

### 2026-05-17: LMS Course And Track Enrollment List Tabs ✅

-   Added `detailsTable` enrollment-list widgets to Course Builder and Track Builder enrollment tab...

### 2026-05-17: LMS Catalog-Ready Course And Track Metadata ✅

-   Added a shared `catalogPublicationPolicySchema` in `@universo-react/types` with fail-closed self-enro...

### Unknown Date: 2026-05-13: Local Supabase Minimal App Start Commands ✅

-   Added `start:local-supabase:minimal` and `start:allclean:local-supabase:minimal` root scripts s...

### Unknown Date: 2026-05-13: Dedicated E2E Supabase Profile And Agent Playwright Guidance ✅

-   Added a centralized local Supabase profile model with separate dev and E2E project ids, workdir...

### Unknown Date: 2026-04-13 And Earlier: Archive ✅

-   Removed legacy `HubList`/`CatalogList`/`SetList`/`EnumerationList` frontend exports; neutral `g...

### Unknown Date: 2026-05-15: Documentation Refresh Implementation (Phase 1-4 Complete) ✅

-   ✅ Verified legacy terminology already removed from all documentation

### 2026-05-15: LMS Platform Implementation Slice 7B: Published Runtime Workflow Actions ✅

-   Added workflow actions to the apps-template runtime response schema for `section`, `objectColle...

### 2026-05-15: LMS Platform Implementation Slice 7C: Workflow Capability Policy ✅

-   Added `resolveEffectiveRoleCapabilities()` in application access guards.

### 2026-05-15: LMS Platform Implementation Slice 7D: Knowledge and Development Portal Navigation ✅

-   Added `KnowledgeHome` as a Page entity with EN/RU Editor.js blocks describing knowledge spaces,...

### 2026-05-15: LMS Platform Implementation Slice 7E: LMS Workflow Metadata ✅

-   Added reusable LMS workflow action builders in the LMS template.

### 2026-05-15: LMS Platform Implementation Slice 8A: Saved Runtime Report CSV Export ✅

-   Added `POST /applications/:applicationId/runtime/reports/export` for CSV export of saved `recor...

### 2026-05-15: LMS Platform Implementation Slice 8B: Report Aggregation Overview Metrics ✅

-   Added a typed `report.aggregation` metric datasource for stat cards.

### 2026-05-15: LMS Platform Implementation Slice 13A: Deferred xAPI And Broad File Resources ✅

-   Added `xapi` to the shared `ResourceSource` type contract.

### 2026-05-15: LMS Platform Implementation Slice 9A: Runtime Dashboard Card Grid Parity ✅

-   Updated the runtime details card grid to expose a stable test target for visual and unit checks.

### 2026-05-15: LMS Platform Implementation Slice 12A: LMS Resource And Report Docs ✅

-   Updated `docs/en/guides/lms-resource-model.md` and `docs/ru/guides/lms-resource-model.md` for x...

### 2026-05-15: LMS Platform Implementation Slice 7G: Gamification And Achievements ✅

-   Added `GamificationSettings`, `PointAwardRules`, `PointTransactions`, `BadgeDefinitions`, `Badg...

### 2026-05-15: LMS Platform Implementation Slice 11A: Committed LMS Fixture Contract ✅

-   Extended `packages/universo-react-utils/src/snapshot/__tests__/snapshotFixtures.test.ts` with a ...

### 2026-05-15: LMS Platform Implementation Slice 12B: Gamification Guide ✅

-   Added `docs/en/guides/lms-gamification.md`.

### 2026-05-15: LMS Platform Implementation Slice 9B: Workspace Metric Card Parity ✅

-   Replaced the custom `WorkspaceMetricCard` Box surface in `packages/universo-react-apps-template-mui` with `Car...

### 2026-05-16: LMS Platform Implementation Slice 9C/11B: Workspace Metric Screenshot Gate And LMS Flow Cleanup ✅

-   Extended `lms-workspace-management.spec.ts` with dashboard metric-card coverage, a no-horizonta...

### 2026-05-16: LMS Platform Implementation Slice 9D/12C: Published Runtime README Alignment ✅

-   Confirmed Phase 9 acceptance coverage already exists through runtime record-card unit coverage ...

### 2026-05-16: LMS Platform Implementation Slice 1B/12D: Shared Block Editor Package ✅

-   Added `@universo-react/block-editor` with the shared `EditorJsBlockEditor`, locale-aware Editor.js he...

### 2026-05-16: LMS QA Remediation: Runtime Scripts And Workflow Capability Gate ✅

-   Updated runtime script route tests to use canonical application schema names (`app\_<uuid withou...

### 2026-05-16: Node 22 Environment And LMS E2E Remediation ✅

-   Removed obsolete nvm-managed Node versions and set the nvm default runtime to Node 22.22.2.

### 2026-05-16: LMS QA Follow-up Remediation Complete ✅

-   Decoupled published-app metadata workflow actions from broad `editContent` permission in both U...

### 2026-05-16: Final LMS QA Gap Closure ✅

-   Updated `application-runtime-rows.spec.ts` so the test reuses the seeded `Title` component and ...

### 2026-05-16: Published LMS Authoring and Workspace UI Closure ✅

-   Changed the LMS template navigation so primary published-app sections open operational object s...

### 2026-05-17: LMS Relation Builder Runtime Closure ✅

-   Added a generic published-app `RelationBuilderWidget` for parent-scoped child datasources inste...

### 2026-05-16: LMS Final QA Follow-up Closure ✅

-   Raised the LMS runtime menu `maxPrimaryItems` contract to 8 in the template, fixture, snapshot ...

### 2026-05-17: LMS Learning Content Generic Ordering Runtime Closure ✅

-   Added generic persisted row ordering for datasource-backed details tables and reused it for Cou...

### 2026-05-17: LMS Learning Content Builder Tabs Runtime Closure ✅

-   Added `detailsTabs` to the shared dashboard widget registry and strict application layout widge...

### 2026-05-17: LMS Course Item Runtime Record Picker ✅

-   Added generic `stringOptions` rendering for STRING fields so metadata can expose select control...

### 2026-05-17: LMS Runtime Record Picker QA Gap Closure ✅

-   Cleared `runtimeRecordPicker` field values when their configured `targetObjectCodenameField` ch...

### 2026-05-17: LMS Course Builder Policy Controls And Large Outline Warning ✅

-   Added a generic `rowCountWarning` contract to `detailsTable` widget metadata.

### 2026-05-17: LMS Enrollment Wizard And Conditional Due-Date Validation ✅

-   Added `createWizard` metadata to relation-builder panel configuration and rendered it with the ...

### 2026-05-18: LMS Runtime Progress Complete/Recalculate Actions ✅

-   Extended `POST /runtime/progress/content` with `action: update | complete | recalculate` while ...

### 2026-05-18: LMS Track Learner Player Closure ✅

-   Added `targetObjectCodename` to the generic `learnerPlayer` widget config contract.

### 2026-05-18: LMS Learning Content Final QA Closure ✅

-   Renamed the LMS class flow to `lms-class-content-quiz.spec.ts` and updated the browser journey ...

### 2026-05-18: LMS Learning Content Auto-Enrollment QA Remediation ✅

-   Removed `AutoEnrollmentRuleModule` from the active LMS template and regenerated `tools/fixtures...

### 2026-05-20: LMS Learning Content Runtime Table Defaults Bridge ✅

-   Added `tableDefaults.defaultViewMode` and `tableDefaults.columnPreset` to the published dashboa...

### 2026-05-20: LMS Learning Content Runtime Table Defaults UX Canary ✅

-   Added optional raw UUID substring detection to the shared runtime UX Playwright helper.

### 2026-05-20: LMS Learning Content Current-Object Card Safety ✅

-   Hardened `MainGrid` current-object card rendering to ignore `id`, `actions`, `*Id`, owner/user/...

### 2026-05-20: LMS Learning Content Runtime UX Canary Guard Tightening ✅

-   Expanded `expectNoTechnicalLeakage` to detect raw JSON/object text containing `storageKey`, `mi...

### 2026-05-20: LMS Learning Content Generic Relation Builder Display Safety ✅

-   Added shared app-template runtime display helpers for technical field names, raw resource/media...

### 2026-05-20: LMS Learning Content Runtime Form UX Safety ✅

-   Added shared `fieldSemantics` helpers so `Description`, `Summary`, `Body`, `Instructions`, `Fee...

### 2026-05-20: LMS Legacy Concurrency Checklist Closure ✅

-   Verified `deleteRow` and `restoreRow` use `buildRuntimeExpectedVersionPredicate` inside `UPDATE...

### 2026-05-20: LMS Metadata-Driven Union Create Menu ✅

-   Added a generic `detailsTable.createTargets` contract with localized labels, target section/obj...

### 2026-05-20: LMS Create-Target Form Defaults And Resource Type Presets ✅

-   Added a strict `CreateTargetDefault` metadata contract for `detailsTable.createTargets` with ex...

### 2026-05-20: Generic Link Resource Domain Preview ✅

-   Added a generic domain preview chip to the shared `resourceSource` form widget for URL and embe...

### 2026-05-20: LMS Auto-Resolved Page Resource Source Authoring ✅

-   Added metadata-driven auto page resource source resolution to the shared runtime `FormDialog` f...

### 2026-05-20: Generic Records Union Row Actions ✅

-   Added a generic `DashboardRowTarget` action contract for datasource widgets.

### 2026-05-21: Generic Runtime Table Column Visibility ✅

-   Added `useRuntimeColumnVisibilityPreference` with safe model normalization, local persistence, ...

### 2026-05-21: Deferred Assessment Create Targets ✅

-   Added disabled Quiz-lite and Assignment-lite create targets to the LMS Learning Content metadat...

### 2026-05-21: Generic Records Union Runtime Search ✅

-   Added `showSearch` to the generic details-table widget metadata schema.

### 2026-05-21: Generic Records Union Target Filters ✅

-   Added a generic `detailsTable.targetFilters` schema contract for `records.union` widgets with v...

### 2026-05-21: Generic Datasource Load Error UX Safety ✅

-   Routed `records.list` datasource query failures through the shared runtime error sanitizer befo...

### 2026-05-21: Generic Runtime Workspaces Raw-ID And Error Leakage Safety ✅

-   Replaced Runtime Workspaces page workspace-name fallbacks with the localized `workspace.untitle...

### 2026-05-22: Generic Workflow Row-Action Label Fallback Safety ✅

-   Added generic workflow action fallback labels to `RowActionsMenuLabels`.

### 2026-05-22: Generic Runtime Record Picker ID Fallback Safety ✅

-   Changed runtime record picker option label resolution to return a localized fallback instead of...

### 2026-05-22: Generic Details Tabs And Sequence Label Fallback Safety ✅

-   Added safe details-tabs fallback labels that humanize non-technical tab IDs and use localized g...

### 2026-05-22: Generic Relation Builder And Runtime List Fallback Safety ✅

-   Added safe metadata fallback labels for relation-builder panels and create wizard steps.

### 2026-05-22: Generic Runtime Flow-List Cell Display Safety ✅

-   Added a shared flow-list cell rendering helper that preserves real React elements while sanitiz...

### 2026-05-22: Generic Runtime Chart Axis Display Safety ✅

-   Added a `MainGrid` chart-axis formatter that reuses `formatRuntimeSafeValue`.

### 2026-05-22: Generic Runtime Chart Metric Value Display Safety ✅

-   Added a `MainGrid` chart metric formatter that reuses `formatRuntimeSafeValue`.

### 2026-05-22: Generic Runtime DataGrid Cell Display Safety ✅

-   Replaced default `toGridColumns()` display formatting with `formatRuntimeSafeValue`.

### 2026-05-22: LMS Learning Content Final QA Fixes ✅

-   Hardened `buildRuntimeRecordAccessClause` so `runtimeRecordAccess.ownerOrShared` is bypassed on...

### 2026-05-22: Generic Runtime Stat Card Metric Value Display Safety ✅

-   Reused the shared configured metric formatter for overview stat cards and records-series charts.

### 2026-05-22: Generic Workspace Invite Email Validation ✅

-   Reused the shared `emailSchema` contract in the existing invite-member dialog before mutation s...

### 2026-05-23: LMS Runtime UX QA Findings Closure ✅

-   Suppressed top-level metadata create actions when a `detailsTable` widget owns `createTargets`,...

### 2026-05-22: Generic Course Field Report Coupling ✅

-   Added the reusable `Instructor` business component to the Learning Content union projection pat...

### 2026-05-23: LMS Guest Public Workspace Isolation QA Closure ✅

-   Scoped public guest runtime record reads, child TABLE reads, access-link lookup, and access-lin...

### 2026-05-25: Scripts To Modules Rename ✅

-   Completed the no-legacy rename of the metahub attached TypeScript-code capability from Scripts/Scripting to Modules across packages, routes, database contracts, snapshots, fixtures, tests, SDK names, and GitBook docs.
-   Renamed runtime and design-time contracts to `modules`, `_mhb_modules`, `_app_modules`, `/modules`, `/module/:moduleId`, `/runtime/modules`, `moduleId`, `moduleCodename`, `ModuleRole`, and `@universo-react/modules-engine`.
-   Updated LMS template and fixture posting handlers to `*PostingModule` codenames/classes and refreshed the LMS fixture snapshot hash.
-   Replaced stale UI capability helpers and localized module-action validation keys; module list role labels now use localized labels instead of raw enum values.
-   Verified no domain `scripts`/`scripting` leftovers remain outside allowed HTML/security/package-script/external-API contexts.
-   Refreshed workspace links with `pnpm install`, resolving the stale `@universo-react/core-backend` dependency symlink after the engine package was renamed to `@universo-react/modules-engine`.
-   Validation passed: local Supabase smoke Vitest, targeted `@universo-react/types`, applications-backend, metahubs-backend, metahubs-frontend, applications-frontend, and modules-engine tests/builds; `pnpm docs:i18n:check`; `build:e2e` on local minimal Supabase; and the two Chromium module runtime Playwright flows.
-   Browser evidence captured at `test-results/flows-application-runtime--70ed6-before-runtime-verification-chromium/quiz-modules-authoring-dialog.png` and `test-results/flows-application-runtime--e26b0--the-real-a-browser-surface-chromium/quiz-modules-runtime-en.png`.

### 2026-05-25: Scripts To Modules Post-QA Closure ✅

-   Updated current snapshot documentation and Memory Bank architecture notes to use the renamed snapshot contracts `sharedFixedValues`, `sharedOptionValues`, and `sharedComponents`.
-   Fixed the modules quiz runtime E2E fixture so the client-visible `submit` module calls the server-side `validateAnswer` module and the Playwright oracle verifies the real `/runtime/modules/.../call` request.
-   Re-ran focused formatting, GitBook i18n parity, backend/frontend unit tests, package builds, and local minimal Supabase Chromium Playwright for the quiz widget modules flow.

### 2026-05-26: 1C-Compatible Metahub Template Implementation ✅

-   Implemented the opt-in `1C-Compatible` metahub template with codename `1c-compatible` while preserving `basic` as the default starter template.
-   Added reusable typed Entity Type Constructor behavior contracts in `@universo-react/types` for single-value constants, catalogs, documents, posting, journals, registers, account charts, dynamic characteristics, and calculation type graphs.
-   Registered the first 1C-compatible preset family in the metahubs backend: top-level Constant, existing Enumeration, Catalog, Document, Document Journal, Information Register, and Accumulation Register.
-   Extended manifest validation so typed behavior configs fail closed on both preset manifests and preset default instances, without adding 1C-only runtime branches or extending `ObjectRecordBehavior` as the primary design.
-   Updated the template selector with localized EN/RU status and non-affiliation copy, reusing existing MUI primitives.
-   Added GitBook EN/RU documentation plus `docs:1c-compatible:check` clean-room/non-affiliation validation.
-   Added Playwright flow coverage for template registration, default-template preservation, 1C-compatible metahub creation, and runtime UX leakage checks.
-   Verification passed: `pnpm --filter @universo-react/types test`, `pnpm --filter @universo-react/types build`, metahubs backend focused Jest, backend lint/build, metahubs frontend lint/build, `pnpm docs:1c-compatible:check`, local minimal Supabase doctor, full `build:e2e`, and Playwright `@1c-compatible|@runtime-ux-canary`.
-   Browser screenshot evidence was captured at `test-results/flows-metahub-1c-compatibl-ecea6-s-not-leak-technical-labels-chromium/1c-compatible-template-picker.png`.

### 2026-05-26: 1C-Compatible Metahub Template Post-QA Closure ✅

-   Replaced the misleading runtime-ready claim with a preview-safe milestone model: the template selector now shows localized preview status, and docs require behavior, storage, UI, and test evidence before any preset is promoted from preview.
-   Added the generic `systemTemplatePreset` marker for template-managed entity types, protected template-managed preset rows from structural update/delete, and blocked user-authored custom types from claiming the marker.
-   Added merged seed graph validation after preset toggles are applied, so behavior references such as document posting targets fail closed when a required preset is disabled.
-   Completed the 12-preset 1C-compatible catalog as explicit manifests while keeping accounting and calculation presets preview/non-materializable until their runtime engines and UI are implemented.
-   Corrected top-level Constant capabilities so constants remain single-value/data-schema oriented and do not inherit object/document lifecycle, records, hierarchy, posting, modules, or runtime publication behavior.
-   Strengthened tests for typed behavior contracts, protected template-managed types, preview non-materialization, dangling behavior references, preset toggles, and built-in template compatibility.
-   Strengthened Playwright coverage for RU template selection, keyboard submission, viewport/no-overflow checks, seeded 1C kind verification through the API, cleanup, and runtime UX leakage canaries.
-   Verification passed: Prettier on touched files, `@universo-react/types` focused tests/build/lint, metahubs backend focused Jest/build/lint, metahubs frontend build/lint, `pnpm docs:1c-compatible:check`, local minimal Supabase doctor/build, and Playwright `@1c-compatible|@runtime-ux-canary`; local minimal Supabase was stopped after the run.

### 2026-05-26: 1C-Compatible Metahub Template Security QA Closure ✅

-   Reserved all registered platform preset `kindKey` values in `EntityTypeService`, closing user-created `document`/`catalog` kind squatting before preset materialization.
-   Hardened metadata-kind resolution so template-managed object-like preset kinds map to the generic Object policy surface only when the row has a registered preset kind and the `systemTemplatePreset` marker comes from an entity type preset.
-   Routed object-like template-managed preset route kinds through the existing Object-compatible nested list/create/update/delete and blocking-reference handlers, preserving generic behavior and avoiding 1C-only route forks.
-   Fixed nested Object-compatible creation to require `createContent` instead of `editContent`.
-   Made preset sync fail closed when an active non-template-managed entity type already owns a platform preset `kindKey`, preventing silent overwrite of legacy/custom rows.
-   Added regression coverage for object-compatible route filtering/creation, blocking-reference preflight, spoofed template markers, reserved kind creation, and preset-sync overwrite safety.
-   Verification passed: Prettier on touched files, metahubs backend focused Jest suites with 111 tests, metahubs backend build/lint, `@universo-react/types` test/build/lint, metahubs frontend build/lint, `pnpm docs:1c-compatible:check`, local minimal Supabase doctor/build, and Playwright `@1c-compatible|@runtime-ux-canary`; local minimal Supabase was stopped after the run.

### 2026-05-26: 1C-Compatible Metahub Template Final QA Remediation ✅

-   Made object-compatible reference deletion fail closed for specialized template-managed target kinds by treating any active `REF` with the target object id as a blocker.
-   Aligned nested Enumeration deletion with the canonical `entity.enumeration.allowDelete` metahub setting.
-   Made template-managed entity type presentation/UI label edits fail fast through the constructor so schema sync cannot later overwrite accepted edits silently.
-   Replaced normal-surface raw codename fallbacks in the metahub template selector and create-options tab with localized user-facing fallbacks.
-   Strengthened the 1C-compatible Playwright canary to inspect the MUI listbox surface, the create-options tab labels, forbidden `one-c-*` leakage, and desktop/tablet/mobile screenshot evidence.
-   Verification passed: Prettier on touched files, metahubs backend focused Jest suites with 136 tests, backend build/lint, `@universo-react/types` test/build/lint, metahubs frontend build/lint, `pnpm docs:1c-compatible:check`, local minimal Supabase doctor/build, full `build:e2e:local-supabase`, and Playwright `@1c-compatible|@runtime-ux-canary`; local minimal Supabase was stopped after the run.

### 2026-05-26: 1C-Compatible Route Isolation And UX Evidence Closure ✅

-   Forced specialized object-compatible nested routes to own the effective `kindKey` in both query and create body normalization, so routes such as `document` cannot be widened or spoofed by `?kindKey=catalog` or body `kindKey`.
-   Resolved object-compatible nested list/reorder/get/create/update/delete kind sets from the route-owned `kindKey`, and reject stored objects whose persisted kind does not match the specialized route surface.
-   Added backend route regression coverage for conflicting query kind isolation, conflicting create body kind override, and mismatched stored-kind get/delete rejection.
-   Extended the 1C-compatible Playwright canary to open the created metahub entity type workspace, assert localized RU preset labels, verify no technical leakage/overflow, and keyboard-navigate from the Catalog entity type action menu to the Catalog instances page.
-   Verification passed: Prettier on touched files, metahubs backend focused route Jest and 7-suite metadata/schema/template matrix with 138 tests, metahubs backend build/lint, `@universo-react/types` test/build/lint, metahubs frontend build/lint, `pnpm docs:1c-compatible:check`, local minimal Supabase env/doctor, full `build:e2e:local-supabase`, and Playwright `@1c-compatible|@runtime-ux-canary`; local minimal Supabase was stopped after the run.

### 2026-05-26: 1C-Compatible Runtime UX QA Closure ✅

-   Removed the duplicate preview chip and old optional-template wording from the metahub template selector while keeping the template opt-in.
-   Updated the Russian template description to the requested non-affiliation sentence and corrected the adjective agreement in the compatibility wording.
-   Renamed template-managed preset display names away from the old compatibility prefixes and kept neutral metadata-object names for Constants, Catalogs, Documents, Journals, Registers, Charts, and related presets.
-   Cleaned generic entity-instance collection pages so template-managed/custom entity types use metadata-driven titles, create button text, and dialog titles with no raw `ui.nameKey`, `entity-owned`, or `Создать сущность` leakage.
-   Added user-facing Entity Type Constructor behavior profiles for single-value constants, catalogs, documents, journals, information registers, and accumulation registers so the behavior can be reproduced through UI controls instead of JSON-only setup.
-   Added resource-surface shared titles so template-managed object-like entity types expose local requisites and common requisites through metadata instead of hardcoded component labels.
-   Extended metahub settings registry generation to include template-managed custom entity kind tabs and setting keys, with backend validation and UI labels driven by entity type metadata.
-   Prevented specialized entity pages from firing the unrelated hub instances request during loading and made the loading header neutral to avoid transient raw kind/internal fallback text.
-   Strengthened unit and browser coverage for namespaced `ui.nameKey` fallback handling, clean runtime pages, localized create dialogs, and negative assertions for obsolete/product-internal copy.
-   Verification passed: Prettier on touched files, `@universo-react/types` tests and build, metahubs backend focused Jest suites with 31 tests, metahubs frontend Vitest with 293 tests, metahubs frontend/backend lint, `pnpm docs:1c-compatible:check`, full local minimal Supabase `build:e2e`, and Playwright `1C-Compatible` flow with 4/4 tests passing; local minimal Supabase was stopped after the run.

### 2026-05-26: 1C-Compatible QA Findings Closure ✅

-   Enforced 1C-compatible constant delete/permanent-delete policy through the
    metadata behavior setting path and added backend regressions for constant
    copy/delete policy denial.
-   Fixed component deletion cleanup to use the mapped `objectCollectionId`
    instead of a shadowed component row, preventing copied requisite deletion
    from failing with an undefined SQL binding.
-   Hardened component/requisite routes so a specialized route kind must match
    the stored object kind, while the generic `object` route remains valid for
    object-compatible authoring.
-   Removed a React runtime warning from shared entity action dialogs by taking
    `key` out of dynamic dialog spread props and passing it as an explicit JSX
    key.
-   Strengthened Playwright `@1c-compatible` coverage for real UI metahub
    creation, exact preset drift detection, responsive template picker evidence,
    keyboard edit access, requisite create/edit/copy/delete lifecycle, and
    route-tampering rejection.
-   Verification passed: Prettier on touched files, `git diff --check`,
    metahubs backend focused Jest with 108 tests plus component route
    regressions, metahubs backend/template-mui lint and build, full local
    minimal Supabase `build:e2e`, `pnpm docs:1c-compatible:check`, Playwright
    canary 2/2, and full Playwright `@1c-compatible` 4/4.

### 2026-05-26: 1C-Compatible Full Preset QA Remediation Closure ✅

-   Shipped the full 12-preset 1C-compatible template manifest, including
    chart/accounting/calculation preset kinds, while keeping the user-facing
    template name and documentation aligned with clean-room/legal guidance.
-   Extended system component seeding to all object-like 1C-compatible kinds
    and kept constants/enumerations out of component-backed schema scaffolding.
-   Hardened component/requisite route isolation so tampered route-kind access
    fails closed across read, copy, update, move, reorder, required/display,
    child, batch child, codename, and delete handlers.
-   Replaced generic component wording in 1C-compatible requisite/register-field
    edit, copy, delete, and display-control dialogs with localized
    domain-specific terminology.
-   Strengthened regression coverage for full preset drift, seed behavior,
    route-kind tampering, transaction scope, and frontend terminology; updated
    Playwright to create/open the 1C-compatible flow through normal UI paths
    and assert all 12 kind keys.
-   Verification passed: Prettier on touched files, `git diff --check`,
    `pnpm docs:1c-compatible:check`, metahubs backend focused Jest with 74
    tests, `@universo-react/types` Jest with 102 tests, metahubs frontend
    Vitest with 299 tests, metahubs backend/frontend lint and build, full local
    minimal Supabase `build:e2e`, and Playwright `@1c-compatible` with 4/4
    tests passing after updating the browser oracle for the full preset set;
    local minimal Supabase was stopped after the run.

### 2026-05-27: Metahub Packages Final QA Follow-Up ✅

-   Fixed package catalog attachment matching by joining active metahub package
    attachments to registry rows through `package_id`, not only by
    `package_name`, so a metahub connected to one version does not make every
    registry version appear attached.
-   Added a focused store regression covering two registry versions of the same
    package name with only one connected version, plus the SQL assertion that
    locks the `package_id` join condition.
-   Kept the Colyseus server workspace wrapper on `@colyseus/core@0.17.43`
    after verifying that the full `colyseus` package pulls an exotic
    transport dependency blocked by the repository `blockExoticSubdeps`
    supply-chain policy.
-   Verification passed: `pnpm install`, Prettier on touched files,
    package-store Jest, expanded metahubs backend copy/restore/seeder Jest,
    applications backend package sync Jest, Colyseus server wrapper test/build,
    metahubs backend lint/build, metahubs frontend lint/build and full Vitest
    suite, full local minimal Supabase `build:e2e`, and Playwright
    `@packages` with 2/2 tests passing; local minimal Supabase was stopped
    after the run.

### 2026-05-27: MMOOMM 3D And Multiplayer Project Skills ✅

-   Added four project-local MMOOMM skills under `.agents/skills/`:
    `playcanvas-engine-runtime`, `colyseus-authoritative-multiplayer`,
    `browser-3d-runtime-integration`, and `browser-game-runtime-qa`.
-   Anchored the skills to the existing foundation wrappers:
    `@universo-react/playcanvas-engine` -> `playcanvas@2.18.1`,
    `@universo-react/colyseus-client` -> `@colyseus/sdk@0.17.42`, and
    `@universo-react/colyseus-server` -> `@colyseus/core@0.17.43`.
-   Captured Engine-only PlayCanvas guidance, procedural geometry guardrails,
    Colyseus 0.17 room/auth/schema/fixed-tick/reconnect/scaling guidance,
    `apps-template-mui` browser 3D integration rules, and browser-game QA
    oracles for canvas/WebGL/realtime surfaces.
-   Updated `.agents/skills/SOURCES.md` with local skill entries, external
    reference-source attribution, no-verbatim-import notes, and the wrapper
    package relationship.
-   Clarified the Colyseus client wrapper README and GitBook docs so package
    runtime target guidance follows the registry/compiler contract instead of
    implying arbitrary server-side SDK imports.
-   Verification passed: explicit-file Prettier for touched Markdown files,
    `pnpm docs:i18n:check`, `node tools/docs/check-gitbook-links.mjs`,
    `git diff --check`, Memory Bank ASCII scan for the new research/plan
    artifacts, and targeted grep checks for forbidden vendor-specific skill
    layouts, out-of-scope runtime assumptions, and QA review regressions.
    Playwright was not required because this slice adds Markdown skills/docs
    only and no live runtime UI.

### 2026-05-26: 1C-Compatible Constructor UX And Lifecycle QA Closure ✅

-   Moved runtime/constructor behavior presentation into reusable
    `entityBehaviorProfiles` metadata and removed raw normal-user
    `kindKey`/capability key leakage from Entity Type Constructor list and card
    surfaces.
-   Replaced mixed constructor copy with localized EN/RU wording and kept
    template-managed preset names neutral while preserving the 1C-compatible
    template description and non-affiliation disclaimer.
-   Seeded 1C-compatible metahub settings for constants, catalogs, documents,
    journals, information registers, and accumulation registers, including
    requisite/register terminology and copy/delete lifecycle controls.
-   Aligned shared resource presentation with common requisites for
    1C-compatible metahubs and removed the generic unavailable shared-container
    message from the normal resource surface.
-   Extended frontend unit coverage for constructor leakage and settings
    localization, backend focused coverage for templates/settings/instances,
    and Playwright coverage for the full browser flow including responsive
    template picker, resources/settings viewport checks, default hub instance
    400-regression guard, and create/edit/copy/delete lifecycle across the six
    materialized 1C-compatible runtime preset kinds.
-   Verification passed: Prettier on touched files, JSON locale parse, `git
diff --check`, metahubs backend focused Jest with 80 tests, metahubs
    frontend focused Vitest with 38 tests, metahubs frontend/backend lint and
    build, `@universo-react/types` build, `pnpm docs:1c-compatible:check`,
    full local minimal Supabase `build:e2e`, and Playwright `@1c-compatible`
    with 4/4 tests passing; local minimal Supabase was stopped after the run.

### 2026-05-26: 1C-Compatible Requisites Runtime QA Closure ✅

-   Removed PostgreSQL/storage terminology and raw component data-type codes from
    normal requisite/component surfaces, including create/edit dialogs and
    nested component tables.
-   Propagated `oneCCompatible` i18n keys through the metahubs namespace so RU
    runtime pages use localized requisite/register-field labels instead of
    fallback English copy.
-   Hardened direct specialized route behavior with backend regressions for
    access denial, deterministic create collisions, route-owned kind overrides,
    and stored-kind mismatch rejection across get/update/delete/restore/copy
    and blocking-reference flows.
-   Added a specialized top-level hub listing route backed by
    `MetahubTreeEntitiesService`, preventing the normal hub page from emitting
    a background 400 through generic object CRUD.
-   Extended Playwright `@1c-compatible` evidence to create a catalog, open its
    real requisites route, inspect the create dialog and type listbox for
    technical leakage, create a requisite, run viewport/no-overflow checks, and
    keep the default hub instances regression guard clean.
-   Verification passed: Prettier on touched files, metahubs backend focused
    Jest with 59 tests, metahubs frontend focused Vitest with 5 tests,
    metahubs frontend/backend lint, `pnpm docs:1c-compatible:check`, full local
    minimal Supabase `build:e2e:local-supabase`, and Playwright
    `@1c-compatible` with 4/4 tests passing; local minimal Supabase was stopped
    after the run.

### 2026-05-26: 1C-Compatible Runtime QA Remediation Closure ✅

-   Disabled 1C-compatible tree/container assignment metadata until Subsystems
    are implemented, so normal instance tables no longer expose empty
    Containers/Hubs columns for these preset kinds.
-   Renamed the shared 1C-compatible resource surface from Common Requisites to
    Requisites in EN/RU i18n and manifest metadata.
-   Moved 1C-compatible local requisites/register fields out of entity edit
    dialog tabs by routing data-schema authoring through dedicated
    `/requisites` pages and an accessible Open Requisites row action.
-   Registered distinct Tabler sidebar icons for every 1C-compatible preset
    instead of falling back to the generic box icon.
-   Strengthened unit and browser coverage for hidden container columns,
    dedicated requisites navigation, resource labels, icon resolution, and the
    create/edit/copy/delete lifecycle across the six materialized runtime
    preset kinds.
-   Verification passed: Prettier on touched files, metahubs frontend/backend
    and template-mui lint/build checks, backend manifest Jest with 24 tests,
    template-mui Jest with 8 tests, metahubs frontend Vitest with 297 tests,
    `pnpm docs:1c-compatible:check`, local minimal Supabase doctor, full
    local-Supabase `build:e2e`, and Playwright `@1c-compatible` with 4/4 tests
    passing after correcting the browser oracle to account for the dedicated
    requisites route; local minimal Supabase was stopped after the run.

### 2026-05-28: MMOOMM Flight Simulator QA Findings Closure ✅

-   Closed the module runtime import gap by validating supported executable
    wrapper-package exports at compile time and by adding runtime shims for the
    browser worker and server isolated-vm paths.
-   Hardened the generic PlayCanvas canvas widget so discovered default runtime
    modules execute even when `moduleCodename` is omitted, realtime reconnect
    and error states are localized, and movement intent target attributes remain
    deterministic for browser evidence.
-   Scoped realtime server module execution with the authorized workspace, user,
    and effective role permissions before building Colyseus room options.
-   Replaced the runtime E2E API schema-sync shortcut with the real connector
    board UI sync flow and strengthened Playwright evidence for station click,
    target arrival, stop, camera controls, and station guard behavior.
-   Verification passed: Prettier on touched files, modules-engine focused
    tests/build, apps-template-mui PlayCanvas/browser-runtime tests/build,
    applications-backend realtime tests/build, fixture contract validation,
    local minimal Supabase build/e2e generator/runtime Playwright checks, full
    root `pnpm build`, and final autoreview with no actionable findings; local
    minimal Supabase was stopped after the E2E run.

### 2026-05-29: MMOOMM Multi-Ship Access Lifecycle QA Closure ✅

-   Closed the Colyseus private-room access lifecycle gap by tracking every
    authenticated member session, including read-only observers, through the
    same fresh access revalidation path as controlling pilots.
-   Changed revoked controlling sessions to close their Colyseus clients while
    removing ship runtime state, so a user who loses role/workspace access
    cannot remain subscribed to authoritative private room state.
-   Added backend regressions for revoked controlling clients and revoked
    read-only member clients, covering both ship-owning and observer-only room
    connections.
-   Verification passed: Prettier on touched files, applications-backend
    realtime Jest with 18 tests, applications-backend lint/build,
    `tools/lint-db-access.mjs`, `git diff --check`, and local minimal Supabase
    MMOOMM runtime Playwright gate with 2/2 tests passing; local E2E Supabase
    was stopped after the run.

### 2026-05-29: MMOOMM Multi-Ship Final QA Findings Closure ✅

-   Closed the remaining public realtime access lifecycle gap by tracking
    public read-only viewers in the room session registry and revalidating
    public runtime availability on the same periodic fail-closed path as
    member clients.
-   Added backend regressions for revoked public realtime viewers and room-level
    spawn reservation failure, ensuring clients are closed with the sanitized
    realtime access code and no ship state is created when no safe spawn exists.
-   Strengthened MMOOMM Playwright evidence with a visible application-list link
    opening the published runtime, Russian localized runtime assertions, and
    state-based movement stability checks in place of fixed waits.
-   Verification passed: Prettier on touched files, applications-backend
    realtime Jest with 20 tests, applications-backend lint/build,
    apps-template-mui lint, apps-template-mui Vitest with 327 tests,
    `tools/lint-db-access.mjs`, MMOOMM fixture contract validation, local
    minimal Supabase MMOOMM runtime Playwright gate with 2/2 tests passing,
    and `git diff --check`; local E2E Supabase was stopped after the run.

### 2026-05-29: MMOOMM Multi-Ship QA Hardening Closure ✅

-   Closed the final realtime backend hardening findings by using the
    request-scoped DB executor for authenticated member matchmaking, while
    keeping public runtime matchmaking on the pool executor path.
-   Added Colyseus per-client message rate limiting on the fixed-tick scene
    room before intent payload parsing, bounding abusive realtime message
    throughput in addition to the existing per-ship intent queue bound.
-   Hardened room guard parsing so module-provided and signed room guard
    half-extents are normalized to positive values and degenerate zero-sized
    guard boxes are rejected before movement/spawn checks.
-   Added focused backend regressions for executor selection, finite room
    message rate limits, module guard normalization, and signed room option
    guard parsing.
-   Verification passed: Prettier on touched files, applications-backend
    realtime Jest with 23 tests, applications-backend lint/build,
    colyseus-server Vitest with 10 tests, `tools/lint-db-access.mjs`,
    MMOOMM fixture contract validation, root `build:e2e`, local minimal
    Supabase MMOOMM runtime Playwright gate with 2/2 tests passing,
    `git diff --check`, and local E2E Supabase was stopped after the run.

### 2026-05-29: MMOOMM Multi-Ship Multi-Session Lifecycle QA Closure ✅

-   Fixed the Colyseus drop lifecycle for reused same-user ships so one dropped
    controlling session no longer marks the shared authoritative ship state as
    disconnected while another controlling session remains active.
-   Added a backend regression proving two active sessions for one user receive
    the same stable `shipId`, keep a single ship in room state, and remain
    connected after one session drops.
-   Verification passed: Prettier on touched files, applications-backend
    realtime Jest with 24 tests, applications-backend lint/build, and
    `tools/lint-db-access.mjs`.

### 2026-05-29: MMOOMM Multi-Ship Final Browser Contract Closure ✅

-   Added explicit authoritative `currentCommand` and
    `currentCommandObjectId` fields to the fixed-tick Colyseus ship state so
    clients and future systems do not infer command state from target
    heuristics.
-   Strengthened backend regressions for `move_to_point`, `move_to_object`,
    `stop`, and arrival/block reset behavior in the authoritative command
    contract.
-   Hardened PlayCanvas wheel input ownership by handling wheel events on the
    canvas and owning container in capture phase, preventing propagation and
    restoring scroll position if the browser scrolls during canvas zoom.
-   Verification passed: Prettier on touched files, applications-backend
    realtime Jest with 26 tests, applications-backend lint/build,
    apps-template-mui lint, apps-template-mui Vitest with 327 tests,
    `tools/lint-db-access.mjs`, root `build:e2e`, local minimal Supabase
    MMOOMM runtime Playwright gate with 2/2 tests passing, and local E2E
    Supabase was stopped after the run.

### 2026-05-29: Application Member Role Update Regression Closure ✅

-   Fixed the application member role update route so it stores the
    authenticated access context before comparing actor and target role levels,
    preventing a backend 500 during existing member role changes.
-   Kept role mutation fail-closed: admins cannot modify peer admins or assign
    admin to another member, while higher roles can still update lower roles.
-   Fixed the application members action-dialog data guard to accept a
    persisted `commentVlc: null` value from existing members instead of
    rejecting the edit as an invalid member payload.
-   Verification passed: Prettier on touched files, applications-backend member
    route Jest regression with 3 tests, applications-frontend Vitest package
    run with 178 tests, applications-backend lint/build, applications-frontend
    lint/build, and `git diff --check`.

### 2026-05-30: MMOOMM 3D Flight Orientation And Collision Closure ✅

-   Replaced the PlayCanvas ship rotation path with full 3D forward alignment
    from authoritative or predicted headings, so vertical movement pitches the
    primitive ship toward the movement target instead of sliding flat through
    space.
-   Reworked movement and prediction collision envelopes from bounding-radius
    expansion to direction-aware oriented half-extents, preserving station and
    ship contact safety without the large visible nose-to-object standoff.
-   Strengthened tests and browser oracles for the cases previous coverage
    missed: lower-screen free-space double-clicks, vertical free-space targets,
    ship forward vectors, oriented nose/side/vertical approaches, and bounded
    visual clearance around the station.
-   Verification passed: `git diff --check`, colyseus-server Vitest with 18
    tests, apps-template-mui Vitest with 336 tests including 19
    PlayCanvasCanvasWidget tests, MMOOMM fixture contract validation, local
    minimal Supabase MMOOMM runtime Playwright gate with 2/2 tests passing,
    final autoreview with no accepted/actionable findings, and local E2E
    Supabase was stopped after the run.

### 2026-05-31: PlayCanvas Editor Package Foundation Implementation

-   Added the isolated `@universo-react/playcanvas-editor` workspace package
    around a vendored PlayCanvas Editor `v2.22.1` snapshot pinned to commit
    `0fcd44253ba1bba39c13d45b069265167249ecb6`.
-   Implemented artifact-only build and smoke tooling that builds upstream
    Editor from a temporary external workspace, writes a static artifact
    manifest, validates license/version/Node metadata, and avoids exposing
    Editor internals through the package public API.
-   Added repository isolation and catalog guards so PlayCanvas Editor, PCUI,
    Observer, and vendored source cannot leak into other Universo packages.
-   Added package-local Vitest coverage, package-local Playwright artifact
    smoke coverage, GitHub Actions checks, and GitBook EN/RU documentation for
    the foundation package.
-   Verification passed: package-local TypeScript check, Vitest, artifact
    build, artifact smoke, Playwright artifact browser smoke, repository
    isolation/catalog guards, GitBook EN/RU docs checks, root ESLint with
    existing warnings only, and `git diff --check`.

### 2026-05-31: PlayCanvas Editor Package Foundation QA Remediation

-   Closed the QA gaps in the foundation package by adding package-local
    browser smoke to CI and agent gates, extending Playwright evidence to
    desktop/tablet/mobile projects, and strengthening static artifact header
    and traversal checks.
-   Hardened the preview server path boundary with resolved-path and realpath
    checks so encoded sibling traversal and symlink escapes outside
    `dist/editor` fail closed.
-   Strengthened supply-chain guard coverage: build scripts now assert the
    root lockfile hash stays stable, no-install/network checks scan the
    package script tree, negative fixtures prove forbidden commands fail, and
    `ot-text` is pinned to the resolved upstream commit.
-   Made the Editor-specific Vite `7.3.2` dependency an explicit catalog guard
    exception instead of an implicit omission.

### 2026-06-01: PlayCanvas Editor Package Foundation Guard Closure

-   Hardened the PlayCanvas Editor package script guard so package-local build
    scripts fail closed on additional package-manager install and network
    source command variants, including `npm ci`, `pnpm i`, bare Yarn installs,
    Corepack activation/install flows, Bun/Bunx, shell wrapper literals, and
    Git submodule network updates.
-   Expanded negative Vitest fixtures for direct strings and split
    `spawn`/`execFile` command arguments so the previously missed variants are
    regression-covered.
-   Verification passed: PlayCanvas Editor Vitest, TypeScript no-emit,
    artifact build, artifact smoke, Playwright artifact browser smoke across
    desktop/tablet/mobile, catalog guard, package naming guard, no-package-base
    guard, PlayCanvas Editor isolation guard, and GitBook i18n docs check.

### 2026-06-01: PlayCanvas Editor Metahub Authoring Surface Settings Implementation

-   Added shared package contracts for authoring surfaces, deterministic package
    slugs, per-metahub attachment display config, authoring host descriptors,
    and explicit authoring-only runtime boundaries.
-   Extended the metahubs package schema/system-app metadata with
    `obj_packages.authoring_surface` and `rel_metahub_packages.config`,
    including a forward migration and initial schema parity coverage.
-   Seeded `@universo-react/playcanvas-editor` as an authoring-only package with
    empty `runtimeTargets`, default embedded display config, and artifact
    metadata while keeping runtime publication snapshots and module package
    imports filtered to runtime-capable packages only.
-   Added authenticated package config APIs, authoring host resolution, and
    PlayCanvas Editor artifact serving under the metahubs package route with
    manifest checks, traversal protection, cache/content headers, and
    iframe-oriented CSP.
-   Updated the Metahub Resources Packages UI with authoring-aware surface
    labels, a row action menu, localized display settings dialog, and a
    route-first PlayCanvas Editor host page using an iframe sandbox without
    `allow-same-origin`.
-   Resolved the backend artifact-root path against the repository package
    layout, with `PLAYCANVAS_EDITOR_ARTIFACT_ROOT` as an explicit override, so
    the E2E CLI startup from `packages/universo-react-core-backend/bin` serves
    the built editor artifact instead of reporting a false missing artifact.
-   Updated OpenAPI and GitBook EN/RU docs to describe authoring-only package
    settings, runtime exclusion, artifact serving, and development URL
    allowlist behavior.
-   Verification passed: Prettier on touched files, `@universo-react/types`
    build, full metahubs-backend Jest suite, applications-backend runtime sync
    package regression, metahubs-frontend build, core-frontend build, rest-docs
    build, full `build:e2e:local-supabase`, focused Metahub Packages UI Vitest
    without coverage, and local minimal Supabase Playwright `@packages`
    chromium coverage with host-page screenshots. The PlayCanvas Editor
    isolation guard passes with explicit metadata-only allowlisting for package
    registry descriptors and shared types. Full metahubs-frontend Vitest was not
    used as a final signal because an earlier concurrent
    coverage run corrupted its coverage temp files, and a later broad package
    invocation exposed unrelated existing EntitiesWorkspace flake/timeouts
    while the touched Packages test file passed directly.

### 2026-06-01: PlayCanvas Editor Metahub Authoring Surface Settings QA Closure

-   Closed the final QA findings by keeping the legacy built-in package seed
    migration immutable, moving PlayCanvas Editor reseeding/default backfill to
    the authoring-settings migration, and using stable seed-derived checksums
    for authoring settings.
-   Preserved valid PlayCanvas Editor attachment config during direct reattach,
    normalized empty configs to descriptor defaults, made registry updates bump
    `_upl_version` only when seed-backed registry fields actually change, and
    kept runtime publication package definitions free of design-time config.
-   Revalidated saved development URL configs at the authoring-host read
    boundary so an URL that was saved under an older allowlist is blocked and
    omitted from the host descriptor after the current allowlist is removed or
    tightened.
-   Redacted saved development URLs from the read-level package list endpoint
    and made the settings dialog load full display config through the
    manager-only authoring-host surface.
-   Included package attachment config in canonical snapshot hash
    normalization and refreshed affected committed fixture envelope hashes, so
    display settings cannot be tampered inside snapshot bundles without
    failing integrity validation.
-   Kept imported metahub snapshots as design-time data while creating the
    import-created active publication version from runtime-mode serialization,
    preventing authoring-only packages from entering application runtime sync.
-   Kept open-separately mode on the sandboxed route-first host page instead of
    exposing the raw artifact URL, with browser evidence for
    `noopener`/`noreferrer`, sandboxed iframe attributes, missing artifact UI,
    blocked development URL, keyboard focus, viewport checks, and canvas paint.
-   Verification passed: focused metahubs-backend Jest suites, focused
    Metahub Packages Vitest, PlayCanvas Editor package tests, PlayCanvas Editor
    browser smoke, `@universo-react/types` build, metahubs frontend/backend
    builds, full local-Supabase E2E build, local minimal Supabase Playwright
    `@packages` chromium flow, `check:playcanvas-editor-isolation`, and
    `git diff --check`.

### 2026-06-01: PlayCanvas Editor Authoring Surface QA Remediation Follow-Up

-   Hardened the authoring host and static artifact route so stale or disabled
    display configs cannot serve the PlayCanvas Editor artifact after current
    server policy changes.
-   Aligned backend development URL validation with the frontend contract by
    requiring `http` or `https`, rejecting credential-bearing URLs, and exposing
    the currently allowed display modes in the manager-only host descriptor.
-   Redacted artifact internals from read-level package catalog/list responses
    while keeping manager-only host data available for the settings and host
    routes.
-   Updated the Packages settings dialog to hide server-disabled development URL
    mode, show localized policy copy, avoid transient MUI select warnings, and
    keep responsive browser screenshot evidence for the settings dialog and host
    page.
-   Verification passed: focused metahubs-backend Jest suites, focused
    Metahub Packages Vitest, utils snapshot hash Vitest, PlayCanvas Editor
    isolation guard, `@universo-react/types` build, metahubs frontend/backend
    builds, full local-Supabase E2E build, local minimal Supabase Playwright
    `@packages` chromium flow, `git diff --check`, and local autoreview with no
    accepted/actionable findings.

### 2026-06-01: PlayCanvas Editor Authoring Surface Final Hardening Closure

-   Added strict Zod validation for package authoring-surface descriptors at the
    registry and seed boundaries, including malformed descriptor regressions and
    a metadata-only isolation-guard allowlist for the validator contract.
-   Improved the PlayCanvas Editor host failure states with a stable package
    heading, localized permission-denied copy, and contextual unavailable states
    for missing, blocked, disabled, and misconfigured artifacts.
-   Hardened artifact HTML serving with response-level CSP sandboxing so direct
    artifact navigation cannot bypass the route-first iframe sandbox boundary.
-   Preserved design-time snapshot portability by restoring saved development
    URL display configs without applying the current server allowlist during
    import, while keeping host/API runtime validation fail-closed.
-   Updated package snapshot documentation to warn that exported metahub
    snapshots can include owner-managed development URLs and should be treated
    as sensitive artifacts.
-   Extended Playwright evidence for the mobile package action path and Russian
    PlayCanvas Editor settings/host surfaces.
-   Verification passed: Prettier on touched files, focused metahubs-backend
    Jest suites, focused migrations-platform Jest contract, focused Metahub
    Packages Vitest, `@universo-react/types` build, metahubs-backend build,
    migrations-platform build, `build:e2e`, local minimal Supabase Playwright
    `@packages` chromium flow, PlayCanvas Editor isolation guard,
    `git diff --check`, and local autoreview with no accepted/actionable
    findings.

### 2026-06-01: PlayCanvas Editor Authoring Surface Post-Review Defect Closure

-   Closed local autoreview findings by forcing the PlayCanvas Editor host
    launch through document navigation, normalizing development URL CSP frame
    sources to URL origins, and aligning generated OpenAPI package contracts
    with the implemented strict package settings API.
-   Regenerated the OpenAPI source from the fixed generator and verified package
    schemas for the display-config union, `{ items, total }` list responses,
    package catalog `id`, `resetConfig`, and manager-only authoring-host
    descriptors.
-   Verification passed: `build:e2e`, focused metahubs-backend package route
    Jest, focused core-backend CSP/init Jest, `@universo-react/rest-docs`
    build, local minimal Supabase Playwright `@packages` chromium flow,
    PlayCanvas Editor isolation guard, `git diff --check`, and local
    autoreview with no actionable defects.

### 2026-06-01: PlayCanvas Editor Authoring Surface Final QA Evidence Closure

-   Added a database-level authoring slug owner trigger for active PlayCanvas
    Editor `authoringSurface.packageSlug` values in both the baseline metahubs
    schema and the additive authoring-settings migration. The guard rejects slug
    reuse by different package names while preserving the versioned registry
    model for multiple active versions of the same package.
-   Replaced the mobile package action reachability oracle with a real
    horizontal wheel gesture and scroll assertion, so Playwright proves the
    responsive table actions are reachable without direct DOM mutation.
-   Added a localized Back to packages action across PlayCanvas Editor host
    happy, open-separately, missing-artifact, and permission-denied states, and
    strengthened host keyboard evidence around the back action, iframe focus,
    and artifact canvas interaction.
-   Added Russian browser validation evidence for invalid Development URL
    settings while the server policy exposes the development URL mode.
-   Verification passed: Prettier on touched files, focused metahubs-backend
    Jest platform/routes suites, focused Metahub Packages Vitest,
    `build:e2e`, local minimal Supabase Playwright `@packages` chromium flow,
    PlayCanvas Editor isolation guard, `git diff --check`, and local
    autoreview with no accepted/actionable findings.

### 2026-06-01: PlayCanvas Editor Authoring Surface Final QA Findings Closure

-   Revalidated signed Editor artifact-token requests against the issuing
    user's current `manageMetahub` access and the current metahub package
    attachment display mode before serving static files.
-   Changed package version switching so incompatible display configs fail
    closed unless the user explicitly chooses to reset package display settings
    to defaults.
-   Added browser screenshot evidence for the missing-artifact host state and
    documented tokenized artifact request revalidation in GitBook EN/RU docs.
-   Verification passed: Prettier on touched files, focused metahubs-backend
    routes/store Jest, focused Metahub Packages Vitest, metahubs
    frontend/backend builds, full local minimal Supabase `build:e2e`, local
    minimal Supabase Playwright `@packages` chromium flow, PlayCanvas Editor
    isolation guard, `git diff --check`, and subagent review.

### 2026-06-01: PlayCanvas Editor Runtime Contract QA Closure

-   Kept package display settings explicitly design-time for this slice by
    removing the half-read `_app_packages.config` release-loader path while
    preserving metahub copy and snapshot `packages[].config` behavior.
-   Kept `ApplicationPackageDefinition` aligned with runtime publication scope:
    runtime package definitions still carry package identity, source, and active
    state only, not design-time authoring config.
-   Made the signed PlayCanvas Editor artifact-token route resolve the required
    manifest file from the attached artifact descriptor before serving files.
-   Narrowed the authoring-settings platform migration seed pass to the
    PlayCanvas Editor package so its effective data mutation matches the
    migration checksum contract.
-   Verification passed: Prettier on touched files, focused metahubs-backend
    route/store/migration/seeder Jest, focused applications-backend sync/release
    Jest, focused Metahub Packages Vitest, applications-backend build,
    metahubs-frontend build, metahubs-backend build, PlayCanvas Editor isolation
    guard, `git diff --check`, and local autoreview with no actionable findings.
