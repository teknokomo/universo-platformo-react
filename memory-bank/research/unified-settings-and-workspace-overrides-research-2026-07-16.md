# Research: Unified Settings and Workspace Overrides

> Created: 2026-07-16
> Status: Draft
> Trigger: RESEARCH request for the local manager brief on unified settings and workspace overrides
> Follow-up plan: ../plan/unified-settings-and-workspace-overrides-plan-2026-07-16.md

## Research Question

What implementation approach best fits the repository for unified settings across metahub, application, and workspace layers, while preserving materialized application sync, template-first reuse, and the existing runtime UX patterns?

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
|--------|------|------------------|----------------|
| Local manager brief for unified settings and workspace overrides | Local brief | 2026-07-16 | Primary decision input and acceptance contract. |
| Local source TZ for unified settings and workspace overrides | Local source TZ | 2026-07-16 | User intent and non-goals, including no schema/template version bump. |
| `memory-bank/tasks.md` | Local memory bank | 2026-07-16 | Existing Interpretation Network work confirms similar materialized settings patterns and workspace/runtime boundaries. |
| `.agents/skills/universo-platform-architecture/SKILL.md` + `references/configuration-workflow.md` | Local skill/reference | 2026-07-16 | Confirms metahub/application/workspace ownership split. |
| `.agents/skills/mui-runtime-ux-patterns/SKILL.md` | Local skill | 2026-07-16 | Confirms no raw JSON/IDs on normal runtime surfaces and `apps-template-mui` isolation. |
| `.agents/skills/runtime-ux-qa/SKILL.md` | Local skill | 2026-07-16 | Defines user-facing QA contract and failure modes. |
| `docs/en/platform/metahubs.md` | Local documentation | 2026-07-16 | Confirms metahub ownership and separated settings layers. |
| `docs/en/guides/application-layouts.md` | Local documentation | 2026-07-16 | Confirms materialized app layout sync and capability-driven tabs. |
| `docs/en/architecture/interpretation-network-data-model.md` | Local documentation | 2026-07-16 | Confirms the matrix config contract and split-pane semantics. |
| React docs via Context7 (`/reactjs/react.dev`) | Primary docs | Queried 2026-07-16 | Confirms single source of truth and lifted state. |
| Material UI docs via Context7 (`/websites/mui_material-ui`) | Primary docs | Queried 2026-07-16 | Confirms responsive dialogs and accessible tabs. |
| TanStack Query docs via Context7 (`/tanstack/query`) | Primary docs | Queried 2026-07-16 | Confirms optimistic updates with rollback and invalidateQueries. |
| Zod docs via Context7 (`/websites/zod_dev`) | Primary docs | Queried 2026-07-16 | Confirms strict object parsing and safeParse patterns. |
| https://react.dev/learn/sharing-state-between-components | Primary docs | 2026-07-16 | Confirms lifting state up / single source of truth. |
| https://mui.com/material-ui/react-dialog/ | Primary docs | 2026-07-16 | Confirms responsive full-screen dialogs with `useMediaQuery`. |
| https://mui.com/material-ui/react-tabs/ | Primary docs | 2026-07-16 | Confirms accessible tabs and tabpanel relationships. |
| https://mui.com/material-ui/react-use-media-query/ | Primary docs | 2026-07-16 | Confirms viewport-aware branching for responsive UIs. |
| https://tanstack.com/query/latest | Primary docs | 2026-07-16 | Confirms query invalidation and mutation rollback patterns. |
| https://zod.dev/ | Primary docs | 2026-07-16 | Confirms schema-driven strict parsing. |
| `packages/universo-react-types/src/common/metahubs.ts` | Local code | 2026-07-16 | Current metahub registry shape is narrow and does not yet model scope/ownership/policy. |
| `packages/universo-react-types/src/common/applicationLayouts.ts` | Local code | 2026-07-16 | Existing layout/application contract already has sync state and expectedVersion semantics. |
| `packages/universo-react-applications-frontend/src/pages/ApplicationSettings.tsx` | Local code | 2026-07-16 | Application settings tabs are partially capability-driven but still hardcode matrix/learning content logic. |
| `packages/universo-react-applications-frontend/src/pages/ApplicationLayouts.tsx` | Local code | 2026-07-16 | Raw JSON fallback still exists for unsupported widget configs. |
| `packages/universo-react-applications-backend/src/services/runtimeWorkspaceService.ts` | Local code | 2026-07-16 | Workspace model currently stores workspace identity/membership, not generic settings overrides. |
| `packages/universo-react-apps-template-mui/src/workspaces/RuntimeWorkspacesPage.tsx` | Local code | 2026-07-16 | Published-app workspace UI presently covers dashboard/access only. |
| `packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx` | Local code | 2026-07-16 | Workspace route parser and menu wiring will need a third section. |
| `packages/universo-react-apps-template-mui/src/standalone/DashboardApp.tsx` | Local code | 2026-07-16 | Standalone runtime host also hardcodes workspace sections. |
| `packages/universo-react-applications-backend/src/controllers/runtimeWorkspaceController.ts` | Local code | 2026-07-16 | Owner-only workspace mutation contract must be respected or extended explicitly. |
| `packages/universo-react-applications-backend/src/services/applicationWorkspaces.ts` | Local code | 2026-07-16 | Confirms workspace support tables are created dynamically and `_app_settings` already has a different purpose. |
| `packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts` | Local code | 2026-07-16 | Existing application sync already has explicit local_modified/conflict/source_removed semantics. |
| `tools/testing/e2e/support/checkInterpretationNetworkFixtureDrift.ts` | Local code | 2026-07-16 | Shows product fixture validation and drift-gate expectations. |

## Key Findings

- The repository already follows the architectural ownership split: metahub for canonical defaults, application for deployed-instance defaults, workspace for runtime isolation.
- The repository docs agree with the code: metahubs own canonical design-time state, application layouts are materialized runtime copies, and Interpretation Network widget settings stay in the application-layer materialized config rather than the metahub template alone.
- `ApplicationSettings` already distinguishes capability-driven tabs from always-on panels, but the logic is still hardcoded around `learningContent` and `matrix`, not a shared registry.
- `ApplicationLayouts` still allows raw JSON editing for unsupported widget configs, which conflicts with the target UX contract.
- `runtimeWorkspaceService` handles workspace CRUD, members, roles, default-workspace state, and soft delete; there is no generic workspace settings store or override resolver yet.
- The workspace surface is currently routed only through `dashboard` and `access`; a new Settings surface will need route parsing, navigation, and test updates.
- The application settings page already has hardcoded gates for `matrix` and `learningContent`, so the next design must separate registry metadata from tab visibility.
- Existing app/runtime route hosts already append workspace content into their menu trees, so a new Settings section must be wired into both the application runtime host and the standalone dashboard host, not just the workspace page itself.
- Existing application sync already models materialized source/local state with optimistic versions and conflict states, so the new settings design should reuse that pattern rather than invent live inheritance.
- React, MUI, TanStack Query, and Zod documentation all support the brief’s intended patterns: derive shared values from one source of truth, render responsive dialogs/tabs, rollback optimistic mutations, and reject unknown fields strictly.

## Conflicts And Uncertainty

- The exact catalog of workspace-eligible settings is not yet fixed.
- The right storage shape for workspace overrides is still open: the codebase has strong materialized app settings and workspace tables, but no generic override table.
- `ApplicationSettings` currently treats `owner`, `admin`, `editor`, and `member` as application roles; the brief wants workspace settings to use real workspace roles plus application-admin permissions, so the authorization mapping needs explicit design.
- `_app_settings` already exists for workspace seed metadata, so any new workspace override design must use a distinct namespace or a schema-guarded extension instead of reusing that key/value table blindly.
- The route shape is also open: the workspace page currently knows only `dashboard|access`, and both runtime hosts hardcode that two-section structure.

## Project Implications

- The new settings contract should probably live in `@universo-react/types` as a shared registry with per-setting metadata rather than in ad hoc page logic.
- Application and workspace layers need explicit projection/resolver logic on top of the shared registry.
- `ApplicationLayouts.tsx` and `ApplicationSettings.tsx` are the first UI surfaces that will need refactoring away from raw JSON and hardcoded tab gating.
- The workspace service will need a new persistence boundary and likely a new runtime settings route/service pair.
- `packages/universo-react-apps-template-mui/src/standalone/DashboardApp.tsx` and `packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx` will need route propagation for any new workspace settings screen.
- The current docs already state that Application Settings derive feature tabs from materialized runtime widgets, so the new registry should preserve that projection behavior instead of replacing it with a second source of truth.
- Browser QA should focus on EN/RU, role-gated visibility, responsive dialogs/tabs, and absence of raw IDs/JSON in normal surfaces.

## Recommended Decision

Use a shared settings registry with explicit scope, target, persistence, and ACL metadata. Keep metahub canonical defaults, application materialized defaults, and workspace overrides as separate persisted layers tied together by effective-value resolution. Do not try to retrofit the existing workspace service into a generic settings API without a dedicated settings store and contract.

## Open Questions Before PLAN

- Which exact settings are workspace-eligible in phase 1?
- Should per-user preferences remain out of scope entirely, or be reserved in the registry with no storage path yet?
- What is the exact persistence shape for workspace overrides: new tables, reuse of runtime schema bootstrap tables, or a hybrid?
- Which runtime routes should surface the workspace Settings page in `apps-template-mui`?
- Should unsupported application layout widget configs be replaced with typed fallback editors before the new settings registry lands, or after?
- Should the workspace Settings route be accessible from both the application runtime host and the standalone dashboard host in phase 1?

## Sources

- Local manager brief for unified settings and workspace overrides
- Local source TZ for unified settings and workspace overrides
- `memory-bank/tasks.md`
- `.agents/skills/universo-platform-architecture/SKILL.md`
- `.agents/skills/mui-runtime-ux-patterns/SKILL.md`
- `.agents/skills/runtime-ux-qa/SKILL.md`
- `packages/universo-react-types/src/common/metahubs.ts`
- `packages/universo-react-types/src/common/applicationLayouts.ts`
- `packages/universo-react-applications-frontend/src/pages/ApplicationSettings.tsx`
- `packages/universo-react-applications-frontend/src/pages/ApplicationLayouts.tsx`
- `packages/universo-react-applications-backend/src/services/runtimeWorkspaceService.ts`
- `packages/universo-react-apps-template-mui/src/workspaces/RuntimeWorkspacesPage.tsx`
- `packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts`
- `tools/testing/e2e/support/checkInterpretationNetworkFixtureDrift.ts`
