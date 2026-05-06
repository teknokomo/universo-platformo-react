# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Runtime Start Section Stale Placeholder Suppression — Complete (2026-05-06)

-   **Latest runtime closure**: the published application root no longer briefly renders a non-start section, such as Access Links, while the menu-defined start page is being selected and fetched.
-   **Failure mode addressed**: `useCrudDashboard` could expose React Query placeholder/fallback data whose backend active section differed from the menu start section, producing a visible transient table before the Welcome page rendered.
-   **Generic fix**: mismatched section data is suppressed as a loading state whenever the initial menu start section or selected section is still resolving.
-   **Regression proof**: hook-level Vitest simulates the stale Access Links -> Welcome transition, and the Chromium LMS import/runtime flow asserts that Access Links is absent on initial runtime root load.
-   **Validation**: focused `useCrudDashboard` Vitest, `@universo/apps-template-mui` lint/build, root `pnpm build`, Chromium LMS import/runtime Playwright, and `git diff --check` passed.
-   Details: progress.md#2026-05-06-runtime-start-section-stale-placeholder-suppression

## Previous Focus: Application Sync RLS Transaction Boundary — Complete (2026-05-06)

-   **Latest backend closure**: application schema sync no longer runs inside the request-scoped RLS transaction. The sync route uses plain authenticated middleware while preserving application access checks and sync-engine advisory locks.
-   **Failure mode addressed**: the LMS Connector Board 500 was caused by long-running DDL sync being wrapped in an idle request RLS transaction that could fail at final `COMMIT`.
-   **Regression proof**: the LMS import/runtime Playwright flow now drives the real Connector Board diff dialog and schema sync button path instead of bypassing it with a direct API helper.
-   **Validation**: applications-backend build/lint, core-backend build/lint, focused core route Jest, Chromium LMS import/runtime Playwright, root `pnpm build`, and `git diff --check` passed.
-   Details: progress.md#2026-05-06-application-sync-rls-transaction-boundary-closure

## Previous Focus: Generic Localized Variant Tabs For Page Content — Complete (2026-05-06)

-   **Shared tab surface**: Page content language tabs now render through `LocalizedVariantTabs` in `@universo/template-mui`, not a Page-local `Stack` / `ButtonBase` layout.
-   **Typography parity**: the shared variant tabs use the same tab typography values as the metahub MUI tab customization, and the Chromium Pages UX flow compares Page tab typography with Catalog tabs.
-   **Primary marker**: the primary content locale is marked with the same 16px `Star` icon affordance used for display attributes.
-   **Control alignment**: the language action buttons and add-language button share the same compact 28px geometry and are browser-asserted on the same vertical centerline.
-   **Fixture decision**: no LMS snapshot regeneration was needed because this closure changed shared UI only, not template seed data.
-   **Validation**: focused template-mui Jest, block editor Jest, package lints/builds, full root `pnpm build`, Chromium Basic Pages UX Playwright, and `git diff --check` passed.
-   Details: progress.md#2026-05-06-generic-localized-variant-tabs-for-page-content

## Previous Focus: LMS Page Content Import And Editor.js UX Closure — Complete (2026-05-06)

-   **Fixture content**: the canonical LMS snapshot now contains one visible Welcome page with full EN/RU Editor.js block content, not the short basic preset page.
-   **Stable codename**: `LearnerHome` remains the internal codename while localized presentation labels show `Welcome` / `Добро пожаловать`; this is supported by the general `localizeCodenameFromName` seed option.
-   **Editor first render**: Page block content renders on first open after late entity data arrives, without requiring a content-language tab switch.
-   **Toolbox geometry**: the Editor.js block picker stays visible and scrollable inside the viewport; the Chromium Basic Pages UX flow now asserts this against real browser geometry.
-   **Validation**: focused backend/template tests, block editor tests, LMS generator Playwright, Basic Pages UX Playwright, LMS import/runtime Playwright, full root `pnpm build`, and `git diff --check` passed.
-   Details: progress.md#2026-05-06-lms-page-content-import-and-editorjs-ux-closure

## Previous Focus: LMS Runtime Welcome Assertion Closure — Complete (2026-05-05)

-   **Runtime assertion fix**: the LMS import/runtime Playwright flow now asserts the expanded Welcome page content through shared fixture contract constants instead of old inline placeholder text.
-   **Fixture alignment**: `LMS_WELCOME_PAGE` mirrors the canonical LMS template and regenerated snapshot EN/RU Welcome page blocks.
-   **Timeout fit**: the scenario timeout now reflects the full-reset workload: migrations, snapshot import, publication, linked application creation, schema sync, runtime checks, and public guest progress recording.
-   **Validation**: Chromium LMS import/runtime Playwright passed end to end, including EN/RU runtime checks and public guest progress writes; full root `pnpm build` and `git diff --check` passed.
-   Details: progress.md#2026-05-05-lms-runtime-welcome-assertion-closure

## Previous Focus: Page Shared Action Icons And LMS Welcome Content Closure — Complete (2026-05-05)

-   **Latest closure**: Page action menus now share the same centralized CRUD icon factories as Catalogs, so the shared `BaseEntityMenu` no longer receives different Page-specific glyphs.
-   **Menu cause clarified**: Pages were not using a separate menu container; they used the shared container with different action icon descriptors from the generic Entity list.
-   **Editor geometry**: Editor.js add/tune controls are positioned inside the editor card and left of block text, with Playwright assertions for both editor bounds and text overlap.
-   **Tab parity**: Page content language tabs use the standard metahub tab typography scale and compact sibling icon buttons aligned on the same centerline.
-   **Locale ordering**: Page content opens the stored primary content locale first when variants exist; the active UI locale remains the default only for pages with no content variants.
-   **LMS fixture**: the LMS template now seeds full localized Welcome/Learner Home Editor.js content, and `tools/fixtures/metahubs-lms-app-snapshot.json` was regenerated by the official Playwright generator.
-   **Validation**: focused Vitest suites, affected package lint/build checks, Chromium Basic Pages UX Playwright, LMS fixture generator, full root `pnpm build`, and `git diff --check` passed.
-   Details: progress.md#2026-05-05-page-shared-action-icons-and-lms-welcome-content-closure

## Previous Focus: Page Entity Menu Parity And Hubs Column Closure — Complete (2026-05-05)

-   **Menu cause**: Page menus differed from Catalogs because the generic Entity list added Page/block-content-specific `Open content` and `Edit properties` descriptors.
-   **Menu fix**: Page card/table three-dot menus now use the standard CRUD action model: `Edit`, `Copy`, and danger-group `Delete`. Content opening remains on card/row click.
-   **Column label**: the table tree-assignment column now renders `Hubs` when an Entity type uses the `hubs` tab alias; the generic `Containers` label remains for custom Entity types that use `treeEntities`.
-   **Regression coverage**: unit tests assert the standard Page menu and `Hubs` column label; Chromium Basic Pages UX checks the real table header and menu items.
-   **Validation**: focused Vitest, metahubs frontend lint/build, core frontend build, Chromium Basic Pages UX Playwright, full root `pnpm build`, and `git diff --check` passed.
-   Details: progress.md#2026-05-05-page-entity-menu-parity-and-hubs-column-closure

## Previous Focus: Page Hubs Picker VLC Codename Crash Closure — Complete (2026-05-05)

-   **Crash source**: the Page create dialog `Hubs` add picker rendered `TreeEntity.codename` directly as secondary text. `codename` is VLC data, so React received an object child and raised error #31.
-   **Picker fix**: regular and parent container selection panels now resolve both display labels and codenames through `getVLCString` before falling back to stable ids.
-   **Regression coverage**: focused component tests cover both container pickers with VLC codenames, and the Chromium Basic Pages UX flow opens the Page create dialog `Hubs` tab and presses `Add`.
-   **Validation**: focused Vitest, `@universo/metahubs-frontend` lint/build, `@universo/core-frontend` build, Chromium Basic Pages UX Playwright, full root `pnpm build`, and `git diff --check` passed.
-   Details: progress.md#2026-05-05-page-hubs-picker-vlc-codename-crash-closure

## Previous Focus: Page Content Visual And Generic Capability Closure — Complete (2026-05-05)

-   **Compact language controls**: Page content language action buttons and the add-language button now use the shared 28px compact icon-button surface and are center-aligned in the tab row.
-   **Editor.js toolbar geometry**: the shared Editor.js wrapper positions add/tune controls to the left of block content without overlapping the text, and the browser flow asserts both control bounding boxes.
-   **Stable menu close behavior**: content-language tab/add menus keep their current menu model through the close transition, so stale tab/add items do not flash during click-away close.
-   **Generic Page capability parity**: Page create/edit/copy dialogs now expose `Hubs` and `Layouts` from generic Entity capability metadata by accepting the standard `hubs` tab alias.
-   **Snapshot decision**: no LMS snapshot regeneration was required in this closure because the Page template capability metadata already contained the needed `hubs` and `layout` declarations.
-   **Validation**: focused Entity list unit tests, affected package lint/build checks, full root build, `git diff --check`, and Chromium Basic Pages UX Playwright passed.
-   Details: progress.md#2026-05-05-page-content-visual-and-generic-capability-closure

## Previous Focus: Generic Page Entity UX Parity Closure — Complete (2026-05-05)

-   **Stable Page labels**: generic Entity list helpers and navbar breadcrumbs now render localized built-in Page labels before asynchronous Entity type metadata arrives, preventing transient `page` / `pages` leaks.
-   **Loading parity**: generic Entity instance lists now keep skeletons visible while the initial instance query is still loading, so Pages no longer flash a false empty state before existing rows render.
-   **Entity-driven dialog titles**: standard Entity presets expose localized `presentation.dialogTitles`, including Page-specific inflected Russian labels such as `Создать страницу`, without hardcoding dialog titles in the Page route.
-   **Content tab visual parity**: Page content language tabs use the same typography scale as other metahub tab surfaces, and the three-dot/add-language icon buttons are compact sibling controls aligned to the tab centerline.
-   **Editor.js spacing**: the shared Editor.js wrapper keeps block toolbar controls off the text while reducing the reserved left gap to better match the card padding.
-   **LMS snapshot**: the canonical LMS fixture was regenerated through the Playwright generator and now includes the updated Entity presentation metadata.
-   **Validation**: focused unit tests, affected package lint/build checks, full root build, `git diff --check`, Chromium Basic Pages UX Playwright, and the LMS snapshot generator passed.
-   Details: progress.md#2026-05-05-generic-page-entity-ux-parity-closure

## Previous Focus: Localized Editor.js Page Content QA Closure — Complete (2026-05-05)

-   **Locale-aware editor adapter**: `EditorJsBlockEditor` now separates UI locale from content locale and renders the selected content locale into Editor.js.
-   **Localized merge safety**: Editor.js saves now update only the selected content locale and preserve other localized Page block values instead of flattening EN/RU content into a single string.
-   **Independent language switcher**: the metahub Page content route exposes content-language tabs from admin content locales, allowing authors to add, change, remove, and mark the primary block-content locale without changing the full interface language.
-   **Accessible tab actions**: Page content language actions are sibling icon controls beside tab buttons, avoiding nested buttons inside MUI tab labels while preserving the shared three-dot action pattern.
-   **VLC fixture contract**: the Page preset and regenerated LMS snapshot store Editor.js block text inside VLC locale sections, so RU UI renders RU content while preserving EN content.
-   **Editor.js RU i18n**: the shared Editor.js dictionary now covers core popover labels, block tunes, enabled tool names, and used tool labels.
-   **Popover positioning**: the shared editor reserves toolbar space and keeps the block tune menu inside the content card rather than under the metahub sidebar.
-   **Validation**: focused shared editor tests, affected package lints/builds, full root build, `git diff --check`, and targeted Chromium Basic Pages UX Playwright passed after a full e2e reset. The Playwright flow now creates a third content locale and exercises add, change, remove, and primary language actions through the browser.
-   Details: progress.md#2026-05-05-localized-editorjs-page-content-qa-closure

## Previous Focus: Page Block Content Constraint Closure — Complete (2026-05-04)

-   **Entity-specific validation**: the shared Page block normalizer now enforces optional Entity component `allowedBlockTypes` and `maxBlocks` constraints after canonical Editor.js normalization.
-   **Backend safety**: metahub entity create/update/copy flows and snapshot import pass resolved `blockContent` component constraints into the shared normalizer before persistence.
-   **Editor fallback safety**: `EditorJsBlockEditor` applies the same constraints during visual-editor save and fallback JSON editing.
-   **Test signal**: the metahubs frontend Entity list unit harness now mocks the shared three-dot menu behavior and no longer emits MUI `anchorEl` warnings.
-   **Validation**: targeted types/backend/template/frontend tests, package lints, affected builds, `git diff --check`, and Chromium Basic Pages UX Playwright passed.
-   Details: progress.md#2026-05-04-page-block-content-constraint-closure

## Previous Focus: Editor.js Page Authoring QA Closure — Complete (2026-05-04)

-   **Import safety**: `SnapshotRestoreService` now treats imported Page `config.blockContent` as a domain payload, not opaque JSON. It normalizes through the shared Page block schema and rejects unsafe content before `_mhb_objects` insertion.
-   **Metadata isolation**: Page create/edit/copy metadata dialogs no longer include the hidden `blockContentText` JSON path. The dedicated `/content` route remains the single Page content authoring surface.
-   **Editor adapter refresh**: the shared `EditorJsBlockEditor` now renders upstream value changes into a mounted Editor.js instance and normalizes raw Editor.js fallback JSON through the same storage normalizer.
-   **Regression coverage**: backend restore tests cover accepted raw Editor.js output and rejected unsafe imports; frontend tests cover metadata isolation; template tests cover editor refresh and fallback normalization.
-   **Validation**: targeted backend/frontend/template/type tests, package lints, affected package builds, `git diff --check`, and Chromium Basic Pages UX Playwright passed.
-   Details: progress.md#2026-05-04-editorjs-page-authoring-qa-closure

## Previous Focus: Editor.js Page Authoring Route Implementation — Complete (2026-05-04)

-   **Editor dependency choice**: the metahub authoring UI uses official `@editorjs/editorjs` and official Editor.js tools through the central PNPM catalog; unofficial React wrappers were not introduced.
-   **Shared adapter**: `@universo/template-mui` exports a domain-neutral `EditorJsBlockEditor` plus canonical Editor.js tool/output adapters. The editor is lazy-loaded and can fall back to guarded JSON editing if Editor.js fails to initialize.
-   **Storage contract**: Page content writes normalize Editor.js `OutputData` into the canonical Page block schema before persistence. Plain text, supported block types, safe URLs, and Editor.js list 2.x shape are validated in shared types and backend route handling.
-   **Route model**: block-content entity types now have an entity-owned `/content` detail route. Standard Pages use this route by default; cards and rows open content, while metadata remains in the shared three-dot entity menu.
-   **Runtime boundary**: `packages/apps-template-mui` remains Editor.js-free and continues rendering canonical Page blocks through the safe runtime block renderer.
-   **Validation**: focused shared types, backend route, template UI, metahubs frontend tests, affected lints/builds, dependency install checks, Chromium Basic Pages UX Playwright flow, and `git diff --check` passed.
-   Details: progress.md#2026-05-04-editorjs-page-authoring-route-implementation

## Previous Focus: Entity Page UI Parity Cleanup — Complete (2026-05-04)

-   **Breadcrumb labels**: entity-route breadcrumbs now prefer localized Entity type presentation/codename data before falling back to legacy menu keys, so Page routes show `Страницы` instead of raw route keys.
-   **Shared actions**: generic entity Page card and table actions use the shared `BaseEntityMenu` three-dot menu instead of inline Page-specific icon buttons.
-   **Pagination surface**: generic entity pagination now fills the available content width, matching the standard entity list layout.
-   **Regression coverage**: focused frontend tests assert Page breadcrumb label resolution, shared action menu rendering, hidden disabled actions, and the full-width pagination wrapper.
-   **Browser proof**: the Chromium Basic Pages UX flow validates localized breadcrumbs, no raw Page keys, shared row action menus, Page create/edit/copy/delete lifecycle, Sets/Constants, and Page settings.
-   **Validation**: affected package lint/build checks, focused unit tests, Chromium Playwright, Prettier check, and `git diff --check` passed.
-   Details: progress.md#2026-05-04-entity-page-ui-parity-cleanup

## Previous Focus: LMS Snapshot Import Failure Closure — Complete (2026-05-04)

-   **Import bootstrap**: `POST /metahubs/import` now creates the temporary metahub branch without standard seed presets, including the newly added `page` preset, before restoring the imported snapshot.
-   **Readable errors**: backend import compensation normalizes structured thrown values, and frontend metahub/publication import mutations format structured API errors without leaking `[object Object]`.
-   **Regression coverage**: route tests assert import disables `hub/page/catalog/set/enumeration`, and frontend tests assert structured rollback/cleanup errors render readable details.
-   **Browser proof**: the Chromium LMS snapshot import/runtime flow passed after a full e2e reset: import, linked app creation, schema sync, runtime navigation, guest progress, and guest submit.
-   **Validation**: focused frontend/backend tests, package lints, metahubs backend/frontend builds, core frontend build, Chromium LMS Playwright, and whitespace checks passed.
-   Details: progress.md#2026-05-04-lms-snapshot-import-failure-closure

## Previous Focus: LMS Page QA Closure — Complete (2026-05-04)

-   **Page list loading**: standard Page metadata routes now enable the generic entity authoring query pipeline; browser-created Pages appear in the list without manual reloads.
-   **Page action permissions**: Page copy/delete affordances read `entity.page.allowCopy` and `entity.page.allowDelete`; edit remains governed by metahub management permission.
-   **Regression coverage**: `EntityInstanceList` tests assert Page pagination is enabled and Page copy/delete actions are hidden when Page settings disable them.
-   **Browser proof**: Chromium Basic Pages UX flow now creates, reopens/edits, copies, and deletes a Page through the real UI while preserving RU label/order/settings checks.
-   **Validation**: focused frontend tests, frontend/backend lint, metahubs/core frontend builds, Chromium Playwright, and `git diff --check` passed.
-   Details: progress.md#2026-05-04-lms-page-qa-closure

## Previous Focus: LMS Basic Template Sets And Page UX Cleanup — Complete (2026-05-04)

-   **LMS Basic baseline**: the LMS template and regenerated product fixture include the standard Basic presets by default, including Sets and Constants-backed fixed values for LMS configuration.
-   **Standard metadata ordering**: Basic, basic-demo, and LMS entity type ordering is Hubs, Pages, Catalogs, Sets, Enumerations.
-   **Page UX cleanup**: the Page collection route uses localized `pages.*` title/search/empty-state strings, no generic entity-owned route helper copy, no deleted toggle, a simple `Create` action, and a localized `Content` tab for Editor.js block data.
-   **Page settings**: Page copy/delete settings are part of the shared metahub settings registry, and the settings API/UI expose only tabs for entity types present in the current metahub.
-   **Regression proof**: focused backend/frontend/types/template tests, package lints/builds, docs i18n check, Playwright LMS fixture generator, Chromium Basic Pages UX flow with screenshots, fixture inspection, and `git diff --check` passed.
-   Details: progress.md#2026-05-04-lms-basic-template-sets-and-page-ux-cleanup

## Previous Focus: LMS Workspace Policy And Runtime Menu Cleanup — Complete (2026-05-04)

-   **Workspace policy cleanup**: publication versions now support only `optional|required`; the old no-workspaces publication policy and special connector `disabled` value were removed.
-   **LMS runtime navigation**: the LMS menu no longer renders inert Learning hub labels or a `More` overflow entry for Development/Reports.
-   **Workspace bootstrap**: workspace-enabled apps start with personal `Main` workspaces only; the former automatic shared workspace and special public-workspace codename path were removed.
-   **Workspace UI**: default workspace state is shown with a star beside the name, and Set default lives inside the three-dot workspace actions menu.
-   **Validation**: Playwright LMS fixture generator and full LMS import/runtime flow passed after targeted tests, lint, builds, docs i18n check, and `git diff --check`.
-   **Connector sync persistence**: connector publication `schema_options` are now saved only after an applied schema sync result. Pending destructive confirmations no longer persist requested workspace choices.
-   **Irreversible workspace acknowledgement**: first-time workspace enablement requires explicit acknowledgement in shared validation, backend sync, connector UI, and affected e2e flows.
-   **Connector-owned schema creation**: direct application schema generation from publication creation/application creation paths is disabled. Publications can still create linked apps, but schema installation is owned by connector schema sync.
-   **Page authoring**: `blockContent` Page entities expose a generic Editor.js JSON authoring tab in the existing entity form dialog with shared Zod validation.
-   **LMS product model**: the LMS template and regenerated snapshot now cover Departments, Learning Tracks, Assignments, Training Events, Certificates, Reports, and supporting enumerations through generic entity metadata.
-   **Validation**: focused Jest/Vitest tests, targeted builds, targeted lint, `apps-template-mui` build, docs i18n check, Playwright fixture generator, final Chromium LMS import/runtime flow, and `git diff --check` passed.
-   Details: progress.md#2026-05-03-lms-workspace-and-page-qa-hardening

## Previous Focus: LMS Security And Page UX QA Closure — Complete (2026-05-03)

-   **Guest runtime security**: guest session storage now binds the issued access link id, workspace id, secret, and expiry. Runtime validation rejects tampered transport link ids/workspace ids before using the guest token.
-   **Page menu authoring**: `page` is a first-class shared menu item kind. Metahub and application menu editors expose Page menu items through existing `menuWidget` editors with localized validation.
-   **Page block rendering**: published runtime Page content renders all accepted block types through `apps-template-mui` MUI surfaces: paragraphs, headers, lists, tables, images, embeds as safe links, delimiters, and quotes.
-   **Connector workspace browser proof**: the connector Schema Changes Playwright flow now clicks the workspace decision UI, asserts `workspaceModeRequested: enabled`, and confirms application workspace state after sync.
-   **LMS runtime proof**: targeted Chromium LMS snapshot/runtime flow passed with snapshot import, linked app creation, schema sync, guest session, guest progress, and guest submit.
-   **Validation**: targeted backend/types/apps-template tests, affected package lint/build checks, Chromium connector flow, Chromium LMS runtime flow, and `git diff --check` passed.
-   Details: progress.md#2026-05-03-lms-security-and-page-ux-qa-closure

## Previous Focus: LMS Page Workspace QA Closure — Complete (2026-05-03)

-   **Page metadata type**: `page` is a standard nonphysical metadata kind with `blockContent` support. Basic, basic-demo, page, and LMS templates include the Page preset; LMS now seeds `LearnerHome` with Editor.js-compatible blocks.
-   **Page content safety**: Page block-content writes use shared Zod schemas and published runtime payloads are normalized fail-closed; unsafe external Page block URLs are rejected.
-   **Runtime DDL contract**: schema DDL, sync diff, seeding, workspace bootstrap, and runtime row loading use one physical-table contract. Pages stay in metadata with `table_name = NULL` and never create runtime record tables.
-   **Workspace policy**: publication versions store `runtimePolicy.workspaceMode` in the snapshot. Valid policies are `optional` and `required`; once a publication or application requires/enables workspaces, later versions/syncs cannot turn off that requirement.
-   **Connector sync ownership**: application creation no longer owns workspace mode. Connector schema sync resolves the publication policy, persists connector schema options, and updates installed application workspace state only after successful sync.
-   **Snapshot restore idempotency**: LMS snapshot import updates existing active standard entity type definitions by `kind_key` instead of inserting duplicate rows.
-   **Runtime template parity**: `apps-template-mui` renders Page blocks through the existing dashboard details surface and keeps LMS navigation on the shared `menuWidget` contract.
-   **Fixture/docs**: `tools/fixtures/metahubs-lms-app-snapshot.json` was regenerated by the official Playwright generator and starts from `LearnerHome`; EN/RU GitBook docs describe the new publication-version and connector-sync workflow.
-   **Validation**: focused shared/backend/frontend/template tests, package lint/build checks, `pnpm run build:e2e`, `git diff --check`, and targeted Chromium Playwright LMS snapshot/runtime flow passed.
-   Details: progress.md#2026-05-03-lms-page-workspace-qa-closure

## Previous Focus: Runtime Workspace PR Review Hardening — Complete (2026-04-29)

-   Workspace copy resets runtime system metadata instead of copying from source rows
-   Runtime workspace API returns stable error codes for localized UI errors
-   Workspace navigation uses host-provided SPA navigation, preserving standalone template mode
-   Details: progress.md#2026-04-29-runtime-workspace-pr-review-hardening

## Previous Focus: Runtime Workspace UI QA Remediation — Complete (2026-04-28)

-   `/a/:applicationId/workspaces` hides demo overview/stat/chart/footer, workspace management is primary content
-   Fallback side menus no longer render demo `Sitemark`, `Riley Carter`, logout, notification content
-   Runtime workspace create/edit/copy/list/detail contracts are name-only (no machine-name field)
-   Browser proof: Playwright flow covers card/list mode, search, pagination, owner/member UI permissions, screenshots, personal/shared runtime-row isolation
-   Details: progress.md#2026-04-28-runtime-workspace-ui-qa-remediation-closure

## Previous Focus: Mutable Application Visibility And Runtime Workspace Management — Complete (2026-04-27)

-   `isPublic` mutable through application update path; `workspacesEnabled` is structural and becomes immutable once connector schema sync enables it
-   Runtime workspace/member endpoints support paginated/searchable responses, profile fields, email-based invites, transaction-scoped default switching
-   Application settings expose saveable visibility switch and read-only workspace mode
-   Published workspace management renders as full dashboard section using existing card/list/pagination primitives
-   Browser proof: full LMS workspace-management Playwright flow passed, including shared workspace creation, member invite, owner/member workspace switching, and personal/shared data isolation
-   Details: progress.md#2026-04-27-mutable-application-visibility-and-runtime-workspace-management

## Previous Focus: Application Layout Management — Complete (2026-04-22)

-   Converged application/metahub layout detail onto shared `LayoutAuthoringDetails` in `@universo/template-mui`
-   Extracted shared `LayoutAuthoringList` for both application and metahub layout lists
-   Added `Layouts` entry to application sidebar via `getApplicationMenuItems()`
-   Conflict-resolution Playwright flow stable, read-access policy honors per-application settings
-   Shared widget-config validation uses schema-driven parsers in `@universo/types`
-   Details: progress.md#2026-04-22-application-layout-management-shared-list-and-parity-closure

## Previous Focus: Entity-First Final Refactoring — Complete (2026-04-14 to 2026-04-18)

-   Eliminated all top-level legacy `domains/attributes|constants|elements|hubs|catalogs|sets|enumerations` folders from frontend/backend
-   Neutralized metadata route segments: `field-definitions`, `fixed-values`, `records`, `record`
-   Neutralized all public type exports, API helpers, mutation hooks, route builders, authoring path builders, local aliases
-   Backend: removed all specialized child-controller factories, moved to generic entity controller + behavior registry
-   Public runtime routes neutralized to `tree-entities`, `linked-collections`, `field-definitions`, `records`
-   Standard entity copy and branch copy contracts neutralized across all layers
-   Bulk parameter/variable renaming: `hubId`->`treeEntityId`, `catalogId`->`linkedCollectionId`, `setId`->`valueGroupId`, `enumerationId`->`optionListId` across all 7 affected packages
-   Entity type naming refactored from surface-key terminology to traditional names (Hubs, Catalogs, Sets, Enumerations) in display strings
-   Resources tabs made dynamic, deriving visibility from entity type `ComponentManifest` fields
-   Plan: [entity-first-final-refactoring-plan-2026-04-16.md](plan/entity-first-final-refactoring-plan-2026-04-16.md)
-   Details: progress.md#2026-04-17-distributed-noodling-ullman-plan-continuation-closure

## Previous Focus: LMS MVP Implementation — Complete (2026-04-19 to 2026-04-21)

-   Built LMS MVP as metahub configuration data (not hardcoded packages)
-   Guest/public runtime access end-to-end: public link resolution, guest session creation, quiz submission, progress updates, `GuestApp` route rendering
-   LMS fixture/docs scaffolding: `lmsFixtureContract.ts`, EN/RU GitBook pages, refreshed root README
-   Guest runtime credential transport hardened (headers instead of query params)
-   Shared-workspace-safe public access resolution on controller path
-   Canonical LMS snapshot regenerated through official Playwright generator
-   Details: progress.md#2026-04-21-lms-final-closure-and-canonical-fixture-regeneration

## Current Guardrails

-   Do not reintroduce `includeBuiltins`, `isBuiltin`, `source`, `custom.*-v2`, old top-level managed route families, or deleted frontend `domains/catalogs|hubs|sets|enumerations` folder names into production source
-   Do not regress the direct standard-kind persistence model after compatibility helper removal
-   Prefer collapsing transitional contracts entirely over adding new adapter layers
-   Runtime workspace management stays on isolated `apps-template-mui` card/list patterns
-   The committed LMS, quiz, and self-hosted snapshot fixtures match the current hash normalizer; future changes must regenerate through Playwright generators
-   Public runtime access resolves the active workspace that owns the explicit access link or guest session; schema sync no longer creates an automatic shared `Published` workspace.
-   Keep public-runtime exposure tied to publication-backed state, not raw design-time flags
-   Keep the `EntityFormDialog` first-open state hydration pattern intact (no render-phase ref writes)

## Constraints to Preserve

1. Legacy Catalogs/Sets/Enumerations must remain user-visible until entity-based replacements pass acceptance
2. `_mhb_objects.kind` accepts both built-in and custom kind values
3. Snapshot format version bumps preserve backward compatibility for v2 imports
4. All existing E2E tests must remain green at every phase boundary
5. `Entities` must appear below `Common`, and `Catalogs v2` must use dynamic menu mechanism
6. ComponentManifest JSON remains stable contract for advanced Zerocode tooling
7. Arbitrary custom-type components stay gated until proven generic or adapter-backed

## Stored Data Access Preserved (Do NOT rename)

These stored JSONB/DB column names remain unchanged despite neutralization of local variable names:

-   `typed.hubId`, `typed.catalogId`, `typed.sectionId` -- stored JSONB field names
-   `config.parentHubId`, `config.boundHubId`, `config.hubs` -- stored config JSONB
-   `attachmentKind: 'catalog'` -- stored data kind value
-   Kind key strings: 'hub', 'catalog', 'set', 'enumeration' -- database values
-   DB columns: `parent_attribute_id`, `target_constant_id`, `is_display_attribute`, `attribute_id`
-   Settings namespace keys: `catalogs.allowCopy`, `hubs.resetNestingOnce` etc.
-   URL tab segments: `attributes`, `system`, `elements`, `constants`, `values`
-   i18n keys (~758 refs): `t('hubs.*')`, `t('catalogs.*')`, `t('sets.*')`, `t('enumerations.*')`
-   `metahubId` (workspace ID) was never renamed

## Immediate Next Steps

1. Treat any further elimination of `catalog`/`hub`/`set`/`enumeration` folder names under `domains/entities/standard/**` as a larger runtime refactor, not a dead-wrapper cleanup
2. If the user wants an additional QA pass, run the touched Playwright flows against a ready server
3. Keep future backend entity-route unification scoped to real behavior gaps
4. Future fixture changes must be regenerated through documented Playwright generator specs and revalidated with import flows

## References

-   [tasks.md](tasks.md)
-   [progress.md](progress.md)
-   [systemPatterns.md](systemPatterns.md)
-   [techContext.md](techContext.md)
-   [entity-component-architecture-plan-2026-04-08.md](plan/entity-component-architecture-plan-2026-04-08.md)
-   [entity-first-final-refactoring-plan-2026-04-16.md](plan/entity-first-final-refactoring-plan-2026-04-16.md)
