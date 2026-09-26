# Active Context

> Current-focus memory only. Completed implementation history lives in [progress.md](progress.md); actionable checklists live in [tasks.md](tasks.md).

## Current Focus: PR #910 delivery closeout (2026-09-26)

-   Stabilize the existing Entity-backed Marketing Hero/shared-dropdown PR after implementation and QA; fix only confirmed CI/reviewer findings and preserve established architecture.
-   Keep the regenerated 73rd Meridian fixture aligned with the current Marketing Page contract: Hero values live in `MarketingPageHero`, not `MarketingPageSiteSettings`.
-   Preserve the existing feature branch/PR, avoid unrelated refactors or schema/template version bumps, and do not launch `pnpm dev`.

## Preserved platform/runtime baseline

-   Marketing header widget-zone QA remediation is complete; current work should preserve that verified baseline rather than reopen finished implementation.
-   Shared layout-authoring labels and zone-setting options use centralized EN/RU `common` i18n; metahub/application layout screens consume the same registry labels.
-   Zone Settings uses shared `StandardDialog` presentation, including standard footer spacing, read-only/busy states, focus handling, and localized validation.
-   Marketing fixed mode preserves original MUI demo geometry: frame offset + 28px visual margin, viewport-edge background ownership, measured header reservation, and no compensating document spacer drift.
-   Marketing flow mode remains normal document flow and leaves no fixed spacer/scroll-padding residue after scrolling.
-   Persisted header composition is authoritative; inactive brand/navigation/auth/language/theme widgets render no controls.
-   Header shell owns one MUI AppBar/banner and one responsive Drawer; projected brand/navigation/auth/language/color-mode controls come from persisted composition.
-   Start/End placement, sparse zone-setting inheritance/reset, application source baselines, sync resolutions, snapshot round-trip, and copied local lineage are verified.
-   Snapshot capture/restore and layout mutations share transaction-scoped PostgreSQL advisory graph locking; copy creates new local lineage and UUID v7 physical identities.
-   No schema, migration, snapshot format, UUID policy, or metahub-template version bump was introduced by the widget-zone work.
-   Canonical local-Supabase marketing verification passed 36/36 workspace build tasks, 15 Chromium flows + one explicit standalone opt-in skip, and all 5 visual projects with zero retries/unexpected outcomes.
-   Fresh EN/RU, light/dark, desktop/tablet/mobile fixed/flow screenshots were inspected; no horizontal overflow, raw technical leakage, or unexpected browser issues remained.
-   Changed-surface Jest/Vitest, package lint/typecheck/build, OpenAPI, Prettier, docs provenance/assets/links/i18n, and `git diff --check` passed for the completed feature.
-   OntoIndex `gn_verify_diff` passed for the complete feature dirty-worktree allowlist; graph breadth can still classify large service edits as high impact and require manual review.
-   Local autoreview/Thermos infrastructure has repeatedly failed to return a structured verdict because of external stream/context/state limits; do not claim a clean automated review without fresh terminal evidence.

## Immediate Next Step / Blocker

-   The only unchecked historical task is the final independent review gate for the MUI 9 marketing-page upgrade from an environment where OntoIndex and Thermos/autoreview can complete; product implementation and feasible local/browser/docs gates are already complete.
-   Treat unavailable standalone deployment proof separately: hosted runtime is verified; standalone browser acceptance remains opt-in/BLOCKED when no authenticated standalone shell and target/template environment variables are configured.
-   Before new product edits, re-baseline the real worktree and current task scope; preserve unrelated dirty changes.
-   If a new feature starts, replace this section with that feature's current state and move completed context to `progress.md`.

## Runtime / Layout Contracts To Preserve

-   `apps-template-mui` is the isolated published-application runtime; do not couple it to `template-mui` or legacy feature UI packages.
-   Persisted widget composition is authoritative when present; do not revive boolean demo controls, implicit top-widget fallbacks, or `sharedLayoutWidgets` legacy readers.
-   Effective layout is target-aware and template-aware; global and entity-scoped Page/custom-Object targets must use the canonical resolver and cache identity.
-   Runtime materialization preserves explicit source lineage, physical UUID v7 identities, `instanceKey`, optimistic versions, and independent application composition.
-   Repeatable widgets remain repeatable; singleton enforcement applies only to shell-owned capabilities explicitly marked singleton by registry metadata.
-   Marketing navigation instances must remain geometrically non-overlapping and semantically distinct; unique landmarks/Drawer ids and keyboard/focus behavior are required.
-   Dashboard rendering treats persisted composition as authoritative and must not recreate hidden legacy shell ownership when top composition is absent.
-   Layout/widget config uses strict neutral envelopes; reject malformed/unsupported template/zone/widget combinations and direct user injection into system-owned `__layout` metadata.
-   Application/metahub mutations keep authorization, optimistic concurrency, advisory-lock ordering, schema-qualified parameterized SQL, and fail-closed `RETURNING` semantics.
-   Content/effective-layout multi-request reads use the expected layout-hash handshake so torn reads fail closed with localized conflict behavior.
-   Application-owned/inherited lineage must remain distinguishable in authoring UX without exposing raw ids or internal metadata.
-   Runtime UI must remain localized, keyboard accessible, responsive at 1920/768/390-class viewports, and free of page-level horizontal overflow.

## Interpretation Network Baseline To Preserve

-   `interpretation-network` is an active built-in metahub template, not a one-off fixture; it seeds Structures, Interpretations, Relations, Materials, Cells, reusable table/matrix models, and the runtime workspace widget.
-   Single-system structure/template work is complete: reusable structures can be authored, selected, copied, and applied without duplicating platform-level entity primitives.
-   Matrix runtime supports hierarchical navigation, child-cell creation, aggregate move/create contracts, materials linkage, selection/refetch, and localized empty/error states.
-   Runtime menu and settings use generic app-template primitives; do not reintroduce Interpretation-only shell or settings forks for capabilities already shared by the platform.
-   Unified settings/workspace overrides remain layered and target-aware; workspace/user overrides must not mutate the canonical metahub/application configuration.
-   Imported Interpretation Network fixtures are generated through product flows and guarded by contract + drift checks; preserve server-owned placement/system-field filtering.
-   Browser evidence must use the visible language switcher and real reload persistence, not localStorage-only shortcuts; hidden mobile Drawer copies require visible-surface-scoped locators.
-   Child Matrix cell flows require UUID v7 responses and must keep server-managed placement fields out of user mutation payloads.
-   User-facing tables/cards must render semantic values rather than raw ids/objects/JSON; long content remains multiline and localized validation remains user-facing.
-   Existing full apps-template serial coverage is the stronger baseline when broad parallel Vitest runs show resource-sensitive timeouts in unchanged suites.

## Current Platform Baseline

-   Repository version: `0.83.0-alpha`; latest published GitHub release in the Memory Bank table is `0.81.0-alpha` (2026-09-14).
-   Package manager: `pnpm@12.4.1`; Turbo: `2.10.12`; Node root requirement: `>=22.6.0`.
-   UI baseline: React 18.3.1, Material UI Core 9.2.0, MUI X 9.8.0.
-   Built-in templates: `basic`, `basic-demo`, `empty`, `lms`, `1c-compatible`, `playcanvas`, `interpretation-network`, `marketing-page`.
-   Core entity presets: `hub`, `object`, `project`, `page`, `set`, `enumeration`, `ledger`, `fixed-values-library`; 1C-compatible template registers additional specialized presets.
-   TypeORM is removed; domain data path remains Knex connection/transactions + raw SQL through `DbExecutor`, with `schema-ddl` for runtime DDL.
-   UUID v7 is the canonical identifier baseline for new persisted entities.
-   Configuration hierarchy remains Metahub → Application → Workspace; end-user content belongs in workspaces.

## PlayCanvas / MMOOMM State To Preserve

-   PlayCanvas Editor frontend vendors upstream `v2.30.4` at commit `cf296bcb669bdcb168778bf2979160a9fe8f67de` with Editor-side `playcanvas@2.21.3`; runtime engine wrapper uses `playcanvas@2.21.4`.
-   Realtime baseline: Colyseus core 0.17.50, SDK 0.17.43, schema 4.0.31, ws-transport 0.17.13.
-   Keep `packages/universo-react-playcanvas-editor-frontend/vendor` upstream-oriented; Universo integration belongs in backend/bridge/metahub/runtime boundaries.
-   PlayCanvas project store lives in metahub default-branch schema; route binding validation/ownership/cascade through `PlayCanvasProjectsService`.
-   `project` preset is dedicated/non-object-like: capabilities `treeAssignment + projectBinding`; tabs `general`, `hubs`, `project`; do not re-add generic Object data/components/layout/module capabilities.
-   `config.projectBinding.projectCodename` is canonical; `projectId` is only a remappable cache and must not be the sole editor-open reference.
-   Sharing a project across instances is allowed; bound-project cascade deletion is reference-counted across active bindings.
-   Create+bind is a two-step flow with rollback; copied entities strip `projectBinding` so copies do not accidentally share project ownership.
-   Editor open behavior is mode-aware and project-pinned through the shared host helper; do not hand-build editor URLs.
-   Runtime script startup waits for realtime + generated script-artifact readiness; artifact hashes are verified before blob import/register/attach.
-   Snapshot/provider/path validation remains traversal-safe and project-scoped even when referenced files are missing.
-   ShareDB buffers and JSON0 path validation stay bounded/fail-closed; prototype-polluting paths remain rejected.
-   MMOOMM fixtures must be regenerated through documented product/Playwright generators after binding, project, asset, or runtime-manifest changes.

## Database / Security Guardrails

-   Authenticated domain routes use request-scoped `DbExecutor`; admin/bootstrap/background work uses pool executor; raw Knex stays inside infrastructure/migration/explicit DDL boundaries.
-   Dynamic SQL identifiers use `qSchema`, `qTable`, `qColumn`, or `qSchemaTable`; values use bind parameters.
-   UPDATE/DELETE/RESTORE flows that require row confirmation fail closed on zero rows.
-   Public runtime exposure stays publication-backed rather than raw design-time flags.
-   WebSocket upgrades preserve explicit Origin validation; omitted validators fail closed on sensitive realtime paths.
-   Do not log credentials, tokens, private file-system paths, PII, or raw internal identifiers into user-facing errors.
-   Keep CSRF and current RBAC/workspace membership checks on mutating application/metahub routes.
-   Snapshot/hash consumers canonicalize materialized data before hashing; do not hash inconsistent pre-materialized representations.

## Testing / Tooling Guardrails

-   Agents must not run `pnpm dev`; browser E2E uses repository-owned runners and `http://127.0.0.1:3100` where defined.
-   Dedicated local-Supabase E2E profile uses ports 55321/55322/55323; shared/main Supabase E2E requires explicit `E2E_ALLOW_MAIN_SUPABASE=true` and reset protection.
-   Full/minimal local Supabase startup scripts must run the doctor against explicit `.env.local-supabase` profiles before application startup/reset.
-   Distinguish Supabase Studio `http://127.0.0.1:54323` from API `http://127.0.0.1:54321` in local docs.
-   User-visible runtime changes require real browser evidence, including localization, accessibility, responsive behavior, no overflow, and browser-error monitoring.
-   Non-published authoring/admin dropdowns use `@universo-react/template-mui/dropdowns`; keep the published apps template isolated and guard the boundary with an AST import test.
-   Fixture changes use documented generators; do not hand-edit generated snapshots to manufacture passing drift checks.
-   Package/build checks should include TypeScript compilation where type-scope regressions are possible; Vitest/esbuild alone is insufficient.
-   OntoIndex graph claims must account for index freshness and dirty/untracked worktree limits; direct source/diff remains authoritative for unindexed changes.
-   Do not claim Thermos/autoreview, remote CI, standalone browser, or other external gate success without terminal evidence from that gate.

## Terminology / Compatibility Constraints

-   Canonical kind key: `object`; canonical field-definition vocabulary: `components`; capability manifest key: `capabilities`.
-   `_mhb_objects.kind` accepts built-in/custom kinds; custom kinds define physical table prefixes through constructor metadata.
-   `catalog` remains valid only for migration-catalog terminology, not the renamed Object entity type.
-   Do not reintroduce `includeBuiltins`, `isBuiltin`, `source`, `custom.*-v2`, obsolete managed-route families, or deleted frontend `domains/catalogs|hubs|sets|enumerations` folders.
-   Old test databases are disposable in current clean-break work; add compatibility shims only when an explicit migration requirement exists.
-   Snapshot/template versions must change only for a real contract/versioning need, never as a workaround for disposable local state.
-   Shared runtime UX patterns belong in generic template packages; do not create LMS/Marketing/Interpretation-only forks for generic problems.

## Continuation Discipline

-   Read `tasks.md` first for the single current open item; do not treat completed September checklists as new work.
-   Use `progress.md` for historical evidence instead of copying completed verification logs back into active context.
-   Reusable technical rules belong in `systemPatterns.md`; preserve every heading tagged `CRITICAL` during future Memory Bank maintenance.
-   Canon files were refreshed on 2026-09-26 for repository `0.83.0-alpha`, Entity-backed Marketing Hero authoring, and the shared non-published dropdown baseline; re-run Canon Refresh after repository version, package inventory, core terminology, or architecture changes.
-   Latest GitHub release table is authoritative for published releases; root `package.json` may legitimately be ahead during unreleased development.
-   Preserve clean-break decisions where the test DB is disposable; do not add migration/compatibility debt unless the user explicitly needs old persisted state supported.
-   When resuming interrupted work, inspect live processes, current diff, and actual test state before rerunning long gates.
-   External/review tooling limitations must remain explicit evidence gaps, never silently converted into PASS claims.

## References

-   [tasks.md](tasks.md) — active/open checklist plus recent completions.
-   [progress.md](progress.md) — permanent chronological completion record and GitHub release table.
-   [systemPatterns.md](systemPatterns.md) — reusable architecture patterns; CRITICAL sections must survive compression unchanged in substance.
-   [techContext.md](techContext.md) — refreshed 2026-09-26 technical baseline.
-   [projectbrief.md](projectbrief.md) — refreshed 2026-09-26 mission/configuration/package inventory.
-   [productContext.md](productContext.md) — refreshed 2026-09-26 product rationale and active configurations.
-   [plan/unified-application-template-widgets-scoped-layouts-plan-2026-09-07.md](plan/unified-application-template-widgets-scoped-layouts-plan-2026-09-07.md) — unified widget/layout plan.
-   [plan/marketing-header-widget-zone-settings-plan-2026-09-12.md](plan/marketing-header-widget-zone-settings-plan-2026-09-12.md) — current marketing-header contract/evidence plan.
-   [plan/playcanvas-editor-assets-and-mmoomm-script-assets-plan-2026-08-25.md](plan/playcanvas-editor-assets-and-mmoomm-script-assets-plan-2026-08-25.md) — PlayCanvas asset/script implementation detail.
