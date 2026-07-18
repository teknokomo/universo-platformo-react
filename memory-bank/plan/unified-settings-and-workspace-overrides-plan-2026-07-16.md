# Plan: Unified Settings and Workspace Overrides

> Created: 2026-07-16
> Status: Draft
> Based on:
> - `memory-bank/research/unified-settings-and-workspace-overrides-research-2026-07-16.md`
> - Local manager brief for unified settings and workspace overrides
> - Local source TZ for unified settings and workspace overrides

## Overview

Deliver one shared settings system that exposes the same setting through contextual editors and aggregated Settings screens across metahub, application, and workspace layers. Keep metahub defaults canonical, keep application values materialized, add explicit workspace overrides, and preserve fail-closed sync semantics.

## Constraints

- No schema-version or template-version bump.
- No legacy preservation work for disposable test data.
- `packages/universo-react-apps-template-mui` stays isolated and remains the published-app UI boundary.
- All new text must be i18n-ready from the start.
- Use UUID v7 for new persisted rows.
- No raw JSON/object cells or raw IDs on normal user-facing runtime surfaces.

## Affected Areas

- `packages/universo-react-types`
- `packages/universo-react-metahubs-frontend`
- `packages/universo-react-metahubs-backend`
- `packages/universo-react-applications-frontend`
- `packages/universo-react-applications-backend`
- `packages/universo-react-apps-template-mui`
- `tools/testing/e2e`
- `docs/`
- `memory-bank/research/`

## UI Contract

The plan must produce a consistent runtime UX contract for all settings surfaces:

- Each setting row shows localized label, description, effective value, source, and target context.
- Contextual editors and aggregated Settings screens edit the same underlying setting contract.
- Long text uses multiline controls by default.
- Structured widget settings use typed controls, not raw JSON editors.
- Inherited/locked values show parent source and reset-to-parent action where allowed.
- Workspace Settings exposes only allowed keys and never reveals raw internal identifiers.
- Reuse the existing MUI dashboard settings/dialog/tab primitives; do not invent a one-off shell where the existing surfaces already fit.
- Responsive behavior must be proven at desktop, tablet, and mobile widths with screenshots.

## Plan Steps

### Phase 0 — Lock the setting matrix

- [ ] Create a canonical setting-by-setting matrix for the first implementation slice.
- [ ] Classify each setting by owner, scope, target, persistence layer, ACL, workspace eligibility, and reset behavior.
- [ ] Separate shared settings from per-user preferences; keep per-user preferences out of phase 1 unless a complete contract exists.
- [ ] Decide which workspace overrides are allowed, locked, or application-only.
- [ ] Validate the matrix against all built-in templates currently registered in code: `basic`, `basic-demo`, `empty`, `lms`, `1c-compatible`, `playcanvas`, and `interpretation-network`.
- [ ] Reuse existing structured normalizers for widget settings, including the Interpretation Network matrix config contract, instead of flattening them into ad hoc scalar fields.
- [ ] Record the matrix in the plan and use it as the implementation contract.

### Phase 1 — Build the shared contract

- [ ] Extend and harden the existing typed shared settings registry in `packages/universo-react-types`.
- [ ] Model setting metadata explicitly: key, label keys, description keys, scope, target kind, control type, default value, allowed sources, lock policy, and persistence owner.
- [ ] Add Zod normalization for every structured setting shape so frontend and backend share the same strict parser.
- [ ] Define effective-value resolution helpers for metahub -> application -> workspace precedence.
- [ ] Add stable query-key helpers and normalized setting projection helpers for cache reuse.
- [ ] Keep the contract generic enough for all current built-in templates, but do not invent new entity kinds or a new workspace preference store.

### Phase 2 — Add workspace override persistence and API

- [ ] Extend the existing `_app_workspace_settings` runtime-schema path in `applicationWorkspaces.ts`; do not introduce a second workspace override table, a parallel namespace, or any schema/template version bump.
- [ ] Design a dedicated workspace override store instead of reusing `_app_settings` blindly.
- [ ] Implement SQL-first persistence with schema-qualified, parameterized queries and request-scoped `DbExecutor`.
- [ ] Add expected-version / 409 semantics for workspace override mutations.
- [ ] Treat first-write unique-key collisions on `(workspace_id, key)` as fail-closed conflicts and cover the concurrent insert/update/reset race path in tests.
- [ ] Add atomic batch updates, reset-to-inherited behavior, and fail-closed rejection for locked keys.
- [ ] Reuse runtime-schema bootstrap/ensure lifecycle for new workspace tables, indexes, and copy/delete behavior.
- [ ] Revalidate existing workspace overrides when application override policy changes or when workspace copies/imports occur; locked keys must stay inaccessible and must not silently become effective.
- [ ] Keep effective-value reads authoritative on the backend and avoid live metahub merge behavior.

### Phase 3 — Refactor metahub authoring surfaces

- [ ] Make metahub Settings aggregate both global registry settings and contextual layout/widget settings.
- [ ] Refactor layout/widget editors so the same canonical setting can be edited from its local context and from the Settings surface.
- [ ] Preserve global vs entity-scoped layout differences and make inheritance/override state visible.
- [ ] Remove duplicate state sources and make the shared registry the single source of truth for labels, controls, and validation.
- [ ] Add localized empty/loading/error states for missing or unsupported setting targets.

### Phase 4 — Refactor application control-panel surfaces

- [ ] Refactor `ApplicationSettings` so tab visibility and controls come from registry metadata, not hardcoded capability branches.
- [ ] Replace raw JSON fallback editors in `ApplicationLayouts` with typed editors or a clearly labeled unsupported state.
- [ ] Keep materialized application sync semantics intact: clean, local_modified, conflict, source_removed.
- [ ] Add application-level policy for which settings may be overridden by workspaces.
- [ ] Ensure application edits continue to affect all workspaces unless a workspace override is explicitly allowed.

### Phase 5 — Add workspace Settings runtime

- [ ] Finish and wire the Workspace Settings route and page in both runtime hosts.
- [ ] Use the existing MUI dashboard primitives from `apps-template-mui`; do not import legacy UI packages.
- [ ] Gate workspace settings by real workspace roles (`owner` / `member`) plus application-admin permissions; do not invent a separate workspace `admin` role.
- [ ] Show only allowed keys, current effective application value, local override, and reset-to-application action.
- [ ] Keep route parsing, menu wiring, and workspace section handling consistent between the application runtime and standalone dashboard host.

### Phase 6 — Internationalization and docs

- [ ] Add all new user-facing text to i18n from the first pass.
- [ ] Update the relevant package READMEs for the new settings architecture and workspace overrides.
- [ ] Update GitBook docs in `docs/` to explain the three-layer model, the new workspace override rules, and the actual seven-template registry instead of the older four-template summary.
- [ ] Update the brief/research backlinks if the implementation scope changes during planning.

### Phase 7 — Test strategy

- [ ] Add shared contract tests for registry validation, effective-value precedence, reset behavior, and locked-key rejection.
- [ ] Add backend tests for workspace override persistence, access control, version conflicts, and batch mutation atomicity.
- [ ] Add backend coverage for duplicate-first-write races, policy-change revalidation, copy propagation, and locked-key cleanup/fail-closed behavior.
- [ ] Add frontend component tests for aggregated Settings and contextual editor parity.
- [ ] Add unit tests for application sync, source removal, and override preservation after sync.
- [ ] Map the suite to the existing stack explicitly: Vitest for shared contract/frontend component tests where the package already uses it, Jest for backend/store/API tests and schema/bootstrap coverage, and Playwright for browser flows.
- [ ] Add Playwright E2E coverage for application owner/admin/member flows plus workspace owner/member contexts, EN/RU locales, and desktop/tablet/mobile viewports.
- [ ] Use `pnpm supabase:e2e:start:minimal` for browser tests that need a local database.
- [ ] Capture screenshots and browser-visible proof; do not treat test success alone as UX proof.
- [ ] For Interpretation Network, cover the product generator, strict fixture contract, normalized drift gate, imported snapshot flow, and runtime visual/browser proof together; regenerate `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` only through the product generator when the canary config changes.

### Phase 8 — Verification and closeout

- [ ] Run focused lint, format, unit, integration, and E2E checks on the touched packages.
- [ ] Verify no new raw JSON, raw IDs, or overflow issues appear on runtime screens.
- [ ] Run Playwright against the Interpretation Network canary as the primary product proof.
- [ ] Validate docs and README updates for consistency with the code changes.
- [ ] Record any remaining follow-up items explicitly instead of hiding them in the implementation.

## Examples of Safe Implementation Patterns

- Use one shared registry and derive all views from it instead of keeping duplicated settings state in separate screens.
- Use strict Zod parsing for all structured settings so unknown keys fail early.
- Use parameterized SQL with explicit ownership boundaries and optimistic version checks.
- Use TanStack Query invalidation and rollback for optimistic writes.
- Use MUI tabs/dialogs with accessible tabpanel relationships and responsive full-screen dialogs on mobile.
- Use template primitives first, then extend them with shared helpers when a real reuse boundary exists.

## Potential Challenges

- The workspace override store is new and must not collide with existing `_app_settings` seed metadata.
- Route propagation must be updated in both runtime hosts, not just the workspace page.
- Application settings currently mix hardcoded capability gates with materialized widget config; this needs a careful refactor.
- The Interpretation Network canary is sensitive to config drift, so generator and snapshot proof must stay in sync.
- Workspace ACL and application-admin permissions need an explicit mapping; do not invent a new ad hoc role.

## Non-Goals

- No support for per-user preferences in phase 1.
- No schema/template version bump.
- No legacy raw-JSON runtime editor fallback on normal user surfaces.
- No live metahub inheritance at runtime.
- No general rewrite of unrelated packages.

## Discussion Points

- Exact phase-1 workspace-eligible setting list.
- Exact workspace override persistence shape.
- Whether unsupported layout/widget settings should be rendered as read-only before a dedicated typed editor exists.
- Whether the workspace Settings route should be linked from all runtime shells in phase 1 or only from the main runtime shell first.
