# Current Research

## 2026-09-20: Unified Entity-backed widget authoring and Marketing Hero pilot research

-   Research artifact created: memory-bank/research/unified-entity-backed-widget-authoring-hero-pilot-research-2026-09-20.md.
-   Decision-focused implementation plan created on 2026-09-22: `memory-bank/plan/unified-entity-backed-widget-authoring-hero-pilot-plan-2026-09-22.md`. It resolves the remaining questions with a strict versioned `__layout.bindings` contract, one seeded default Hero placement with repeatable additional placements bound to distinct Hero records, a protected `MarketingPageHero/default` record, source-owned application binding, visibly separate content/presentation saves, one bounded authenticated/public resolver, full lifecycle/hash/cache coverage, and Jest/Vitest/real-PG/Playwright/GitBook gates.
-   QA-refined on 2026-09-21 against the original input/spec, `.backup/Архитектура-виджетов.md`, linked prior research, current source, exact-version Context7 MUI documentation, current primary web sources, OntoIndex, and independent read-only subagents. The artifact now records the repository-pinned MUI 9.2.0 / React 18.3.1 / Zod 3.25.76 compatibility baseline.
-   Current source confirms that the marketing.hero seed has a dead MarketingPageSection/hero copy path: both backend serializers load it, but the normalized Hero model uses MarketingPageSiteSettings only. The clean pilot should delete the duplicate path and move Hero content to a dedicated Object-backed MarketingPageHero record.
-   Recommended PLAN boundary: add neutral binding-slot metadata to the shared widget registry, prefer the semantic instance in the existing reserved layout envelope after extending hash/baseline transports, keep renderer config presentation-only, and make the Hero binding source-owned while application authoring changes presentation only.
-   QA found that current marketing `recordKey` filters an adapter-built `semanticKey`; it is not yet a universal Entity-record identity. The neutral contract must therefore define a typed semantic selector/key capability instead of baking `recordKey` into every Entity kind.
-   QA tightened the shared contract to be capability/Component-first, with `allowedEntityKinds` only as optional narrowing, and aligned it with package guidance: shared types evolve additively, while consumer packages own routes, permissions, queries, cache invalidation, and server-error presentation.
-   QA also found that raw `_app_widgets.source_config` preserves the full encoded widget config, while typed application mapping currently exposes renderer-only `sourceConfig`. This is acceptable while Hero rebinding is source-owned/hidden, but future application rebinding needs an explicit typed source-binding baseline.
-   The lifecycle risk is explicit: binding metadata must participate in source_config/reset/sync, snapshot/materialization, effective-layout output, and semantic hashes; otherwise a binding change can render differently without invalidating conflicts or caches.
-   QA resolved the Hero pilot cardinality and surface contract: `marketing.hero` remains repeatable, with one seeded default placement and a human-readable select-existing/create-new record flow for additional placements; server mutations enforce binding validity, placement deletion never deletes an Entity record, the application panel is presentation-only, and published Workspace exposes no Hero CRUD. The artifact now records the exact current seed field limits, EN/RU dirty-state rules, `StandardDialog` requirement, responsive internal scrolling, and the metahub/generic-Entity/application/Workspace ownership matrix.
-   QA added the missing server and cache contracts: source-owned binding must be rejected by direct application widget-config API calls, and binding/content mutation, publish/sync/reset, and target switching need complete query keys plus targeted awaited invalidation. The Hero action/resource fields must retain server-side safe URL, target/rel, allowlist, and CSP boundaries; media remains a separate resource widget.
-   Additional lifecycle review confirms that snapshot restore only remaps allowlisted physical references and overlay materialization replaces widget config as a whole; the PLAN must prove semantic binding round-trip/remap behavior separately and keep instanceKey distinct from content identity.
-   The artifact includes the field-level UI contract, metahub/application/entity-editor ownership split, fail-closed resolver requirements, MUI/Context7 and primary web evidence, prior-research reconciliation, and the remaining decisions required before PLAN. No product code, schema/template version, or MANAGER file changed in RESEARCH mode.

## 2026-09-15: Consortium marketing product, anonymous public runtime, and application aliases research

-   Research artifact created, QA-reviewed, and corrected: `memory-bank/research/consortium-marketing-public-runtime-aliases-research-2026-09-15.md` from the linked MANAGER input/brief, the full Consortium landing draft, prior marketing research, direct source inspection, Context7 MUI/React Router documentation, primary MUI/PostgreSQL/OWASP/React Router/RFC sources, OntoIndex exploration, and read-only subagent reviews.
-   Product decision: keep the built-in `marketing-page` generic and generate a dedicated `metahubs-73rd-meridian-app-snapshot.json` through real authoring/export APIs plus a product fixture contract. Shared snapshot-fixture validation proves envelope/importability, while a separate Consortium-specific generator/contract/E2E flow must prove publication/materialization/runtime and export/import round trip. Consortium development/funding stages use the existing generic collection/highlights-style cards; the SaaS pricing widget is omitted rather than populated with fake prices.
-   Media decision: split the current Hero preview into a generic static-config marketing image widget using the existing safe `ResourceSource`/marketing-media primitives. Add an explicit widget data-ownership mode instead of making every entity source optional; that mode must drive the shared `MarketingWidgetConfigDialog` as well as validation/runtime so static widgets never need fake Object sources. Remove Hero's parallel media ownership across template seed/components, runtime record schema, normalization/types/materialization, rendering, and tests, and deliberately retain the current MUI `dashboard.jpg` URL only as the user's temporary editable placeholder.
-   Public-runtime decision: normal `/a/:applicationId/*` and the applications backend are authenticated today, while existing `/public/a/.../links/:slug` routes are guest/access-link semantics. Add a separate anonymous published-read boundary, dedicated public frontend/API client adapter, and redacted public effective-layout projection; do not impersonate a user, reuse the authenticated `/applications/:id/runtime/*` client, accept visitor `workspaceId` as authority, expose authenticated mutation/admin APIs, or serialize effective-layout lineage/hashes. Unknown/private/deleted/archived/unpublished/unready references share one non-enumerating public-unavailable outcome. QA additionally confirmed that workspace-bound public reads must stay inside one `DbExecutor.transaction(...)` because pool queries are not connection-pinned while `set_config(..., true)` is transaction-local.
-   Public-workspace decision: the existing `is_default_workspace` flag belongs to `_app_workspace_user_roles` and is a per-user preference, so it cannot authorize anonymous runtime. Add an explicit workspace-level, server-owned public-entry designation for an active non-personal workspace and fail closed when workspaces are enabled but no valid public entry exists.
-   Public-readiness decision: do not reuse the frontend's broad “runtime schema exists” heuristic. Anonymous public runtime rejects `draft`, `pending`, `maintenance`, and `error`; `synced` is eligible; `outdated` / `update_available` are eligible only when the server proves and serves a coherent previously installed release/materialization, otherwise fail closed. Archive/publication/runtime readiness must be explicit because the generic active-row helper checks soft deletion only.
-   Alias decision: cleanly delete `obj_applications.slug` and every internal consumer, move release/sync identity to immutable application UUID, and add a normalized global alias registry with application-level direct/canonical policy, database uniqueness/primary invariants, transactional primary changes, explicit alias release, and server-derived same-origin canonical targets.
-   Authorization/admin decision: alias CRUD gets its own shared `applicationAliases → ApplicationAlias` capability. Root `Superuser` uses the existing `isSuperuser()` bypass, while the same assignable permission can later be granted to existing default or custom roles through the normal delegation ceiling. No new `Superadmin` role is created. The Admin-shell entry predicate must recognize this capability because `admin.has_admin_permission()` checks shell access before endpoint-specific permission checks. Add the matching CASL subject/module mapping; ordinary `Application/manageApplication` authority must not substitute for alias authority.
-   Lifecycle decision: public readiness must explicitly include archive/publication/runtime state because the generic active-row helper covers soft deletion only. Alias routability is disabled by archive/delete/readiness state, while alias reservation survives soft deletion; any future physical purge must have explicit privileged release semantics instead of freeing aliases accidentally through a cascade.
-   Redirect/security decision: mutable secondary aliases use SPA history replacement or a temporary server redirect by default. RFC 9110 makes permanent redirect semantics inappropriate for an administrator-changeable primary alias without an explicit immutability/cache policy. The workspace is currently locked to `react-router`/`react-router-dom` 6.30.4 and `@remix-run/router` 1.23.2; current advisories still justify patching to the safe v6 line before adding redirect behavior, while QA records that GHSA-2j2x explicitly exempts Declarative `BrowserRouter` from its React Router path and therefore does not by itself prove a current `/a` exploit.
-   Remaining PLAN inputs are now only content approval: identify the authoritative investment-memorandum/content revision and approve the first EN product translations. No product code, schema, template version, or MANAGER file was changed in RESEARCH mode.

## 2026-09-12: Composable marketing header and generic layout-zone settings research

-   Research artifact created: `memory-bank/research/marketing-header-widget-zone-settings-research-2026-09-12.md`.
-   QA on 2026-09-12 rechecked the brief, current source, three prior research artifacts, Context7 MUI/Zod documentation, primary MUI/MDN/React/Zod/WAI sources, and three independent read-only subagent reviews. The artifact was corrected in place; no product code or MANAGER brief was changed.
-   Current source confirms that `marketing-header` is only nominally compositional: each `marketing.navigation` still owns a fixed AppBar shell, brand/auth/theme/mobile Drawer behavior, while the first navigation instance receives the separately persisted language switcher through a `sharedLayoutWidgets` side channel.
-   The recommended clean-break architecture uses one zone-owned banner/AppBar shell plus atomic persisted `marketing.brand`, repeatable `marketing.navigation`, `marketing.auth`, shared `languageSwitcher`, and shared `colorModeSwitcher`; the mobile trigger/Drawer remain one shell-owned responsive affordance.
-   QA fixed the storage/snapshot ambiguity: existing serialized layout `config` remains the single physical carrier for reserved neutral metadata; decoded/effective contracts may expose typed zone settings only after one canonical neutral layout-envelope codec strips and validates them before strict renderer parsing. No second snapshot wire format is recommended.
-   Application synchronization has a concrete baseline gap: layout rows retain source hashes but no source config baseline. Accepted source sync must atomically update a stored `sourceZoneSettings` baseline while preserving any application-local sparse override; a dedicated Zone Settings reset removes only that override and reuses layout OCC instead of changing the whole marketing appearance reset.
-   Header placement remains a required typed logical `start | end` capability with localized keyboard-accessible authoring, but its physical encoding is intentionally deferred to PLAN. The runtime contract also requires exactly one accessible banner owner, one active mobile projection per persisted control, and measured fixed-header scroll padding/geometry rather than per-navigation constants.
-   No product code, database migration, template version, manager brief, or implementation plan was changed in RESEARCH mode. Remaining PLAN decisions are bounded to the exact reserved JSON key/possible composition normalization, logical-placement encoding, sync convergence policy, shared-widget cardinality timing, and mobile projection of language/theme controls.

## 2026-09-08: Unified application-template widgets and scoped-layout implementation closeout

-   Implementation is complete; durable outcome is target-first effective-layout resolution with Page/Object/global precedence, publication-lineage validation, optimistic versions, UUID v7 identities, fail-closed errors, and a shared neutral widget/zone registry in `@universo-react/types`. Detailed implementation and verification evidence belongs in `progress.md`/`tasks.md`.
-   Remaining evidence boundary at closeout: standalone-browser and separate real-database concurrency wrappers were not provisioned in that checkout; OntoIndex was dirty/degraded for the worktree and Thermos/autoreview could not initialize its read-only state database.

## 2026-09-07: Unified application-template widgets and scoped-layout research

-   Research artifact created: memory-bank/research/unified-application-template-widgets-scoped-layouts-research-2026-09-07.md.
-   Current source review confirms that marketing widget lifecycle support is already implemented; the remaining problem is a template-neutral capability contract, target-first effective-layout resolution, cross-template entity-scoped selection, and removal of runtime fail-open placement/error handling.
-   Concrete blockers recorded for PLAN: hosted and standalone dispatch commit to the global template before resolving an entity target; application authoring derives scoped template from the global layout; metahub materialization rejects template-mismatched overlays; dashboard runtime rows omit top/bottom zones and can reclassify or ignore failures; current tests do not prove the cross-template precedence/hosted/standalone matrix.
-   The recommended clean-break direction preserves separate template renderers, adds neutral capability/semantic-region metadata and one resolver, keeps existing storage/version boundaries, treats cross-template selection as an independent composition by default, and fails closed on invalid or incomplete layouts.
-   MUI official documentation, WAI landmark guidance, React stable-key guidance, Context7 /mui/material-ui/v9.2.0, OntoIndex, direct source, prior research, and prior implementation records were checked on 2026-09-07. No product code, schema, or manager file was changed in RESEARCH mode.
-   QA on 2026-09-07 found and corrected a broken PLAN link, incomplete source inventory, missing UI/cache/concurrency/zone-transport contracts, and documentation drift. The artifact is reviewed but remains gated for a decision-focused PLAN until the open contract decisions are resolved.
-   Current OntoIndex QA state is indexed at HEAD but dirty/degraded: seven dirty files include the research updates, embeddings are unavailable, and ambiguous symbol queries limit graph evidence; direct source remains authoritative.
-   QA also added an executable QA/Test Oracle Matrix covering resolver precedence, cross-template hosted/standalone dispatch, zone transport, materialization failures, API/RBAC, concurrency, cache invalidation, publication/snapshot, UX, and MUI primitive reuse. These cells are requirements and current status is partial/missing/blocked, not acceptance.
-   Closeout review additionally tightened application-scoped materialization, target-aware bootstrap request identity, UUID v7/remapped lineage invariants, deterministic malformed-versus-corrupt error classes, exact languageSwitcher and primitive-reuse test targets, and catalog-range versus lockfile-version reporting.
-   Decision-focused PLAN created and QA-refined: `memory-bank/plan/unified-application-template-widgets-scoped-layouts-plan-2026-09-07.md`. It preserves the no-version-bump/clean-break boundary and adds exact target unions, source-chain precedence, independent-versus-overlay lineage rules, deterministic capability/error contracts, real-database concurrency, shared runtime UX oracles, hosted/standalone Playwright wrappers, visual provenance, and GitBook closeout gates. No product code was changed in PLAN mode.

## 2026-09-04: Widgetized marketing-page runtime research

-   Research artifact created: `memory-bank/research/marketing-page-widgetized-runtime-research-2026-09-04.md`.
-   Direct source review confirms that marketing is entity-data-driven but still rendered through a fixed section map; current layout, authoring, seed, snapshot, and sync paths remain dashboard-shaped or explicitly skip marketing widgets.
-   Before PLAN, the neutral widget envelope, stable instance identity, no-schema-bump storage strategy, scope precedence, entity/public route selection, server-owned data binding, and template-aware lifecycle must be decided.
-   QA review on 2026-09-04 corrected source inventory/test paths, added explicit layer ownership and Zod 3 boundary guidance, narrowed unsupported claims, and recorded runtime/DDL/snapshot/sync/legacy-surface evidence; implementation planning remains gated by the documented contract decisions.
-   No product code, database schema, or template version was changed in RESEARCH mode.

## 2026-09-04: Widgetized marketing-page implementation closeout

-   Implementation is complete and tracked in `progress.md`/`tasks.md`: marketing composition now uses the typed widget registry and entity-backed runtime read model in isolated `apps-template-mui`, reusing the existing layout authoring surface without a compatibility reader or separate workbench.
-   Durable invariant: semantic hashing excludes physical/lineage IDs, source baseline config, timestamps, and mutable versions while covering effective layout/widget configuration and source binding; no schema, snapshot, or metahub-template version bump was required. Independent Thermos/autoreview remained unavailable because the environment-owned Codex state database was read-only.

## 2026-08-31: MUI 9 marketing-page implementation verification continuation

-   Implementation verification is recorded permanently in `progress.md`; research-relevant baseline is the clean-break MUI 9 policy plus a data-driven `marketing-page` path with strict shared contracts, RLS/RBAC-bounded runtime transport, a discriminated template envelope, and provider-free rendering in `apps-template-mui`.
-   Durable oracle: post-publish/post-sync runtime materialization compares semantic content while ignoring generated IDs/timestamps/provenance; browser acceptance covers authoring, sync/reload, export/import, EN/RU light/dark responsive views, accessibility, safe links/media, no technical leakage, and no page-level overflow. Production Storage/imgproxy/media-origin behavior and the resource-sensitive full workspace-widget tail remained outside that local acceptance boundary.

## 2026-08-30: MUI 9 platform upgrade and data-driven marketing-page template

-   Research artifact created: `memory-bank/research/mui-9-marketing-page-template-research-2026-08-30.md`.
-   QA pass completed: added MUI System-prop and Core test-runtime gates, React 18/`react-is` resolution, deprecated `@mui/base`/Base UI handling, Drawer/Menu/Switch slot and Charts CSS migrations, Data Grid v9 locale/DOM checks, exact seven-to-eight template registry accounting, and the normative marketing entity mapping.
-   Follow-up QA completed: added direct-dependency ownership findings (`apps-template-mui` Pro type augmentation, admin icons and root test helper), `ListItemText` and exhaustive Grid migration scans, legacy start-page ownership, full app-bar/hero/footer parity keys, `.backup` provenance, neutral registry ownership, URL/media safety rules, and golden-visual provenance requirements.
-   Current verdict: the reviewed brief is directionally sound but implementation-blocked until template-aware runtime transport, publication/sync normalization, and seed ownership semantics are made explicit.
-   External freshness: official Material UI 9.4.0 and MUI X 9.12.0 pages, MUI migration guides, Context7 and the repository source were checked on 2026-08-30.
-   Critical planning gates: coherent Core/X dependency policy and Pro-license decision; `templateKey` discriminated runtime envelope; no dashboard fallback/injection for marketing; republish must not silently overwrite authored workspace content; deterministic fixture and locale/theme/viewport browser evidence.
-   Next step: create the linked PLAN artifact after resolving the open questions in the research document. No product code was changed in RESEARCH mode.

## 2026-08-25: PlayCanvas Editor assets pipeline and MMOOMM script-asset runtime loading

-   Research artifact created: `memory-bank/research/playcanvas-editor-assets-and-mmoomm-script-assets-research-2026-08-25.md`. Source: manager-only PlayCanvas Editor assets and script-assets brief.
-   Implementation tracking: `memory-bank/plan/playcanvas-editor-assets-and-mmoomm-script-assets-plan-2026-08-25.md`; the implementation and P6 documentation/version pass are complete. The final evidence and checklist are recorded in `tasks.md` and `progress.md`.
-   Editor contracts pinned from vendored v2.30.4 source: create response needs only `{id}` (HTTP 200/201, multipart); the panel updates only via a messenger `asset.new` push; folder tree requires `path:number[]` on every asset doc; script parsing is a `pipeline{script-attributes}` realtime round-trip ending in messenger `scriptAttrsFinished:<job_id>` plus ShareDB ops `data.scripts.<name>`; delete uses the `fs{op:'delete'}` frame plus messenger events; file content is `GET /api/assets/:id/file/:filename` raw text.
-   Token constraint: assets created after the current realtime auth cannot be subscribed until the full-boot token is refreshed AND the socket re-authenticates (allow-list extension happens only at auth time).
-   Runtime verdict: the module worker sandbox cannot host script assets (no DOM/WebGL, shadowed globals, one-shot 15 s workers, compiler forbids `import()`); the viable path is main-thread dynamic `import()` of `text/javascript` artifacts + injected import map resolving `playcanvas` + `registerScript` + script components with `attributeValues` matched by `sceneEntityStableId`; document-level CSP is absent, so this is unblocked. `artifactUrl` is currently `data:application/octet-stream;base64` — wrong MIME; a proper serving path is required. Import-map constraints (QA-added): the map must precede the SPA's main module (build-time HTML transform or classic blocking injector; runtime injection at widget mount fails in Firefox), maps do not apply inside workers, and the `integrity` key can carry `artifactHash`.
-   Pipeline verdict: the modules compiler (CJS-only, `playcanvas` import rejected) cannot produce script-asset artifacts; a separate ESM pipeline (esbuild, `playcanvas` external) is needed. Public PlayCanvas REST docs differ from vendored editor internals — vendored source is normative.
-   Open for PLAN: trust boundary for main-thread script execution; built-in catalog import semantics (copy vs live reference); code-editor `documents` collection scope; import-map injection point; visual-lab migration.

## 2026-08-21: PlayCanvas Engine, Editor, and Colyseus stable upgrade gate

-   Research artifact created and reviewed: `memory-bank/research/playcanvas-engine-editor-colyseus-stable-upgrade-research-2026-08-21.md`. Source: manager-only PlayCanvas Engine, Editor, and Colyseus upgrade brief.
-   Version decision: treat `playcanvas 2.21.4`, Editor `v2.30.4` with embedded Engine `2.21.3`, and Colyseus Core/SDK/Schema/transport `0.17.50/0.17.43/4.0.31/0.17.13` as a dated candidate, not an implementation freeze. Schema remains quarantined until 2026-08-25 04:10 UTC, and the same-day vendored Editor tag needs a separate soak/approval decision.
-   Editor blockers: full recursive schema-v1 migration needs an owned/licensed catalog source; Code Editor needs ShareDB `documents`; Editor/Blank/Code Editor/Launch need individual config and route verdicts; five-minute artifact-token expiry can break late lazy assets; font generation requires a complete asset mutation pipeline; MCP stays disabled by default; automatic upstream migrations need checkpoint/recovery semantics.
-   Engine/runtime findings: directly used `2.18.1` APIs remain present in tagged `2.21.4`, but static widget import currently pulls the complete Engine toward the main frontend chunk. PLAN should baseline a lazy PlayCanvas widget/Engine boundary, resolve multi-canvas identity/global input ownership, and retain real WebGL resize, picking, context-loss, cleanup, and performance proof.
-   Registry/runtime blocker: freeze the exact legacy three-row seed checksum and add upgraded wrappers through a forward migration. The browser and server module runtimes currently resolve hard-coded helpers by package name and ignore wrapper version, so PLAN must preserve ABI identity or introduce version-aware resolution.
-   Colyseus blockers: verify the coherent set with the real server/transport/two clients; decide the non-awaited `allowReconnection` lifecycle; resolve the candidate Core `0.17.50` optional Zod 4 peer newly introduced against the installed Core `0.17.43` Zod 3 contract; and prove the still-open LocalPresence prototype-key path unreachable or mitigate it. The default Server configuration currently does use the local presence path even without an explicit import.
-   Context7 was available and queried for `/playcanvas/engine`, `/playcanvas/editor`, and `/colyseus/docs`; tagged source/releases/manifests remain normative for version-specific deltas.
-   Planning implication: proceed to PLAN only after re-freezing versions/provenance and resolving schema ownership, surface capability policy, registry versioning, Zod/LocalPresence, and release-age/soak gates. Real browser/WebGL, iframe, ShareDB, artifact-lifetime, and multi-client WebSocket evidence is mandatory.

## 2026-07-19: Interpretation Network single system Structure and workspace templates

-   Research artifact created: `memory-bank/research/interpretation-network-single-structure-and-templates-research-2026-07-19.md`.
-   Settings decision: use `structureMode: multiple | singleSystem` in the strict `interpretationNetworkWorkspace` widget config. Metahub owns the source default, Application owns a materialized override/reset, and Workspace does not override the mode.
-   Aggregate decision: one system Structure actually requires one server-owned Structure + canonical Interpretation + root Matrix cell. Create/resolve it through one idempotent workspace-RLS transaction with concurrency serialization; do not reuse the current three-client-request helper.
-   Identity decision: add a hidden server-owned system key and keep valid localized internal Structure/Interpretation names, while hiding those names and the Structure ID from ordinary single-mode UI/routes.
-   Template decision: TableTemplates stay workspace-local. Saving and instantiating require two separate CellId/ParentCellId/axis-key/MaterialRef remaps; Relations and binary resource cloning are excluded from phase 1.
-   Product conflict: ordinary “Create Structure from template” is incompatible with the exactly-one invariant. Recommended phase 1 keeps instantiation in multi mode only; applying/replacing the system Matrix would need a separate contract.
-   Evidence decision: keep the fixture free of runtime rows, configure single mode through the product generator, retain a separate multi-mode regression, and split focused single-mode/template/permission browser flows.
-   External evidence: current React, MUI, React Router 6.30.4, Playwright, and PostgreSQL primary docs were refreshed through GitHub MCP in the original research run and rechecked through the built-in web tool in the resumed QA pass. Context7 OAuth failed originally, and no Context7 query tool was callable during resume.

## 2026-07-13: Interpretation Network configuration and runtime UX

-   Research artifact created: `memory-bank/research/interpretation-network-configuration-runtime-ux-research-2026-07-13.md`.
-   Core finding: the Structure multilingual edit issue is an initial-value key-resolution defect, not a limitation in the standard localized dialog; preserve the whole VLC through a field-ID/codename/runtime-key/`row.data` resolver.
-   Configuration decision (QA-corrected 2026-07-14): the template supplies a seed/source default that is materialized into an application-local effective widget configuration; the runtime consumes that materialized value and a user's pane size is transient. This is not live metahub inheritance. Add a bounded accessible separator with a visible `setLayout` reset to the effective 50/50 default.
-   Styling decision: colour `REF` fields cannot represent arbitrary values. For a disposable database, replace them with canonical `#RRGGBB | null` `STRING` values, retain palette shortcuts only in the UI, add `TextColor`, and implement default all-edge border editing without a persisted border-mode field. The shared normalizer and a new runtime-backend validation path must reject arbitrary CSS grammar at UI, child-row write, seed/fixture, and snapshot-import boundaries.
-   Evidence decision: extend the existing product generator → fixture contract → drift check → imported snapshot/visual E2E pipeline; do not hand-edit the snapshot. Browser proof must include populated Structure, labels with end ellipsis, selection outline, resize/reset, keyboard path, localization, and responsive no-overflow checks.

## 2026-07-10: Interpretation Network hierarchical Matrix Table navigation

-   Research artifact created: `memory-bank/research/interpretation-network-hierarchical-table-navigation-research-2026-07-10.md`. Brief: local Platformo Interpretation Network hierarchical table brief tracked outside the repository; source TZ: local Interpretation Network hierarchical table input plus screenshot QA input.
-   Core finding: hierarchical Table is not just a `defaultMatrixView` change. The current template/fixture already default to `table`, but runtime fallback still defaults to `horizontalRows`, and `buildMatrixTableModel` still builds the table from independent `rowKey`/`colKey` axes instead of the focused `parentCellId` path.
-   Screenshot finding: the full local set contains twelve PNGs, not two. They show the expected workflow: tree-to-table switch, breadcrumb chips, finite-depth ellipsis, upward breadcrumb navigation, hierarchy-derived row labels, colored child cells, right content/material pane, and an optional vertical toolbar. The raw address/CID-like diagnostic blocks visible in the legacy UI must not appear on normal published runtime surfaces.
-   Decision for PLAN: keep the independent row/column table available as a secondary setting, but make the new hierarchical breadcrumb table the default Interpretation Network projection. The existing implementation can be refactored substantially; only the user-facing capability must remain available.
-   Toolbar decision: plan `toolbarLayout` as a setting with the current horizontal toolbar as default and vertical toolbar as opt-in.
-   Evidence: Context7 confirmed current MUI Breadcrumbs collapse props and Playwright web-first assertion guidance; WAI-ARIA APG confirms breadcrumb landmark semantics; lmn.rs pages confirm table-oriented domain representation; local Elm source confirms path-stack navigation behavior as reference only.

## 2026-06-20: MMOOMM PlayCanvas Visual Linkup Lab

-   Research artifact created and QA-updated: `memory-bank/research/mmoomm-playcanvas-visual-linkup-lab-research-2026-06-20.md`. Brief: local cross-project MMOOMM PlayCanvas Visual Linkup Lab brief, dated 2026-06-20; source TZ: local MMOOMM PlayCanvas Visual Linkup Lab input, dated 2026-06-20.
-   Core finding: the visual lab should start as a second bound PlayCanvas project in the existing MMOOMM metahub fixture flow, not as a new package or new built-in entity kind. The low-risk first visual stack is `FOG_EXP2`, white translucent `StandardMaterial`, additive/emissive glow shell geometry, and low-band sphere/primitive geometry. CameraFrame, shader chunks, screen-space outlines, dither/noise, and custom post passes are valid but gated enhancements until projection and browser evidence prove them.
-   Codebase risk finding: the current generator/contract/runtime path is still conceptually "one playable MMOOMM project + one published flight scene". PLAN must make project-row targeting, publish actions, manifest lookup, and widget published-scene selection deterministic by project identity before publishing or validating two PlayCanvas projects.
-   Runtime projection finding: `PlayCanvasCanvasWidget.tsx` currently consumes only `metadata.mmoomm.scene.objects` and renders every object as a white box. It cannot prove spheres, material opacity/emissive glow, fog, low-poly segmentation, or glow shells without a runtime projection extension or separate lab rendering path.
-   Fixture contract implication: keep `MMOOMM Authoring` as the playable flight project requiring ship/station MMOOMM metadata, and add a separate `MMOOMM Visual Linkup Lab` role/contract. If the lab is published, do not require every runtime manifest to carry flight `metadata.mmoomm`; either define `metadata.mmoomm.visualLab` or validate the lab through its Editor scene payload.
-   QA update (2026-06-20): added missing local-doc evidence from `browser-e2e-testing.md`, `mmoomm-flight-simulator.md`, `playcanvas-projects.md`, `playcanvas-editor.md`, and the PlayCanvas Engine README; strengthened runtime-visible lab gates to require nonblank bounded canvas, viewport matrix, focus behavior, no overflow, no technical leakage, and cleanup ownership for any CameraFrame/runtime path.
-   Subagent QA follow-up (2026-06-20): clarified that PlayCanvas snippets are runtime-helper candidates, not proof of current Editor serialization; Editor-only lab acceptance now requires visible Editor/fullscreen canvas evidence plus serialized-scene assertions; PlayCanvas version authority wording now separates runtime package-local d.ts from vendored Editor metadata.
-   Tooling note: Context7 and the web-search helper were requested but unavailable in this session (`unsupported call: mcp__context7`, `unsupported call: omniroute_web_search`). Official PlayCanvas docs/API/source plus local `playcanvas@2.18.1` d.ts were used instead. No application code or generated snapshot was edited in RESEARCH mode.
-   Open PLAN decisions: Editor-only vs published vs runtime-visible lab; 16 recommended variants vs exactly 20; visual-only asteroid objects vs domain model asteroid types; whether generic runtime helpers belong in `@universo-react/playcanvas-engine` now or later.
-   Implementation update (2026-06-21): the accepted path is both Editor-reviewable and runtime-visible. The generator authors 16 variants in a second bound project (`MMOOMM Visual Linkup Lab`), publishes both projects, and validates manifests by role/project identity. The runtime projection is a generic extension of `@universo-react/playcanvas-engine` plus the existing `apps-template-mui` `playcanvasCanvas` widget, driven by `metadata.mmoomm.visualLab`. No new asteroid domain object types were added; asteroid semantics are visual-lab metadata only for this slice.

## 2026-06-17: PlayCanvas metahub template + "Projects" entity type, MMOOMM snapshot regeneration

-   Research artifact: `memory-bank/research/playcanvas-template-projects-entity-type-research-2026-06-17.md`. Brief: MANAGER cross-project brief (tracked outside the repository).
-   Core finding: a new "Projects" section does NOT need a new builtin entity KIND. The 11 one-c-compatible presets are the precedent — registered presets with custom `kindKey`s, object-like capabilities, mapping to the OBJECT metadata surface and rendering through the generic entity UI. "Projects" = `kindKey: 'project'`, object-like-minimal, `sidebarSection: 'objects'`, `sidebarOrder < 10` (above Hub=10).
-   The Entity Type Constructor (`EntitiesWorkspace.tsx`) is fully generic and exposes every field needed (kindKey, icon, tabs, sidebarSection, sidebarOrder integer, capability toggles with dependency graph, resourceSurfaces, behaviorProfile, preset selector). Menu + instance routing (`/entities/:kindKey/instances`) are data-driven — no menu/code edits to place "Projects" above Hubs.
-   The ONLY genuinely new platform capability is the PlayCanvas project binding / launch-editor surface: `resourceSurfaces` are capability-bound (`ENTITY_RESOURCE_SURFACE_CAPABILITIES`), so a first-class binding surface needs a new generic capability (Option A) — this is the TZ's "add missing configurator functionality" clause. The existing metahub PlayCanvas project store (`domains/playcanvas-projects`) is the backing store; binding (not absorption), branches/checkpoints stay inside the PlayCanvas project.
-   QA pass (2026-06-17): artifact `Status: Reviewed`. Verified against source: `ENTITY_RESOURCE_SURFACE_CAPABILITIES = ['dataSchema','fixedValues','optionValues']` (binding needs a new capability); metahub-create dialog already has a `TemplateSelector`; the PlayCanvas project store is ALREADY current-baseline system tables (`_mhb_playcanvas_projects` with unique-active `codename` + siblings), `CURRENT_STRUCTURE_VERSION = 1`, with an `ADDITIVE_CURRENT_BASELINE_TABLE_NAMES` no-bump path.
-   User directives locked: DELETE the legacy Packages "PlayCanvas projects" panel (no legacy code, no dual surface); NO structure/template version bump (achievable — store already baseline, link lives in the instance record/config referencing `_mhb_playcanvas_projects.codename`); test DB recreated (no back-compat); major refactor permitted. Three prior open questions resolved.
-   Remaining PLAN decisions: Option A (new capability+surface) vs Option B (ref field+action); object-like-minimal capability set; snapshot/hash representation of the instance↔project link; dedicated sidebar section vs `'objects'`+`sidebarOrder<10`; commit fixture now vs after E2E stabilization. Generator rework (`metahubs-mmoomm-app-export.spec.ts` + `mmoommAppFixtureContract.ts` + check/import helpers) is bounded.
-   Recommended workflow: PLAN (this artifact is the required input). No blocking external unknowns; PlayCanvas Project model + open-source Editor frontend confirmed via vendor docs.

## 2026-06-16: OntoIndex code-intelligence adoption (CLI + MCP for AI agents)

-   Research artifact: `memory-bank/research/ontoindex-code-intelligence-research-2026-06-16.md`. Brief: MANAGER cross-project brief (tracked outside the repository).
-   Tool identity confirmed against primary README: OntoIndex is graph **code intelligence** (CLI/MCP/HTTP/web UI), AGPL-3.0-or-later, current project pin `v2.0.10`, node `20|22 LTS`, local-first `.ontoindex/` + `~/.ontoindex/`. NOT RDF/SPARQL, NOT runtime/business-data search.
-   Version/port conflicts resolved: pin a version (currently `v2.0.10`) — README prose is not authoritative; serve port is **4747** (`3000` in the Gemini doc is stale from the LobeHub listing).
-   Repo MCP state: greenfield but Claude is pre-enabled (`.claude/settings.json:34` → `enableAllProjectMcpServers: true`), so a committed root `.mcp.json` stdio entry is idiomatic and auto-approved. **QA correction:** `claude mcp add` defaults to **local** scope — use `--scope project` (or hand-author) to write the shared `.mcp.json`. Codex uses `~/.codex/config.toml` TOML (not `.mcp.json`) and is git-ignored → Codex/Gemini/Qoder MCP config is per-developer via docs. `check:agent-profiles` unaffected and not in CI.
-   CI gates that apply: `main.yml` (`pnpm lint`/`build`) and `docs-i18n-check.yml` (EN/RU lockstep + screenshot policy). `.ontoindex/` must be gitignored before first `analyze`.
-   Resolved by user (2026-06-16): **Phase A only**, everything runs **locally**, **AGPL not a concern** (owner confirms compliance). No blocking questions remain; current pin is `v2.0.10`, with manual reindex + documented `detect-changes`.
-   QA pass (2026-06-16): artifact `Status: Reviewed`; OntoIndex facts re-verified against primary README (no change); corrected Claude Code MCP scope mechanics and Codex TOML distinction via official Claude Code + Codex docs.

## 2026-06-15: PlayCanvas Editor v2.23.4 → v2.24.2 upstream update and vendor governance

-   Research artifact created: `memory-bank/research/playcanvas-editor-upstream-2-24-2-update-research-2026-06-15.md`.
-   Source TZ and brief: MANAGER PlayCanvas Editor upstream-update materials (tracked outside the repository).
-   Upstream diff confirmed: 8 commits, 42 files, peeled commit `00360100b3b5747648eb3d7287421ef25491f5c7`, upstream `playcanvas@2.19.5`, Node `>=22.22.0`. All other devDependencies identical to v2.23.4.
-   Architecture finding: the diff is dominated by a version-control picker rewrite (11 widget files removed, 9 new modules under `src/editor/pickers/version-control/`) and a builds panel rewrite (`picker-builds-publish.ts` is essentially ground-up). New public `editor.method` API replaces 10 widget methods with `picker:versioncontrol:hasRetainedDiff/releaseDiff/transformCheckpointData` and `vcgraph:*` set. `picker-conflict-manager.ts` adds a hard dep on `picker:versioncontrol:hasRetainedDiff`. `picker-project.ts` adds `picker:project:suspend/resume`. `Branch` type gains `latestCheckpointId`. `gizmo.ts` adds a single `viewport:render` call after gizmo:type change.
-   Local drift finding: `vendor/playcanvas-editor/sass/common/_fonts.scss` is byte-for-byte identical to upstream v2.23.4 AND v2.24.2. The 20 `playcanvas.com/static-assets/fonts/...` URLs are upstream-owned and have not been touched locally. The user's hypothesis in the TZ is incorrect. The real pre-existing local SASS drift is in `sass/editor/_editor-main.scss`, which is naturally absorbed by the v2.24.2 rewrite of that file. No upstream `package.json` exists under `vendor/playcanvas-editor/`. Boundary rule preserved.
-   Reference count: 38 active files cite `v2.23.4` / `2.23.4` / `c4916f4…`. The update is mechanical (constant/tag swap) across frontend metadata, types contract, backend tests, metahubs services/tests, rest-docs OpenAPI emitter, package README, EN/RU docs, and 9 PlayCanvas Editor Skills. Memory Bank `tasks.md`/`progress.md`/`currentResearch.md` references are historical, not stale — keep out of the metadata guard's active set.
-   Governance recommendation: add `editor:check-metadata` (metadata consistency), `editor:vendor-check` (vendor drift), and `.prettierignore` for `vendor/playcanvas-editor/**` (formatter protection). Extend `playcanvas-editor-authoring` Skill with a short "Upstream update governance" checklist; do not create a new top-level Skill. Keep `playcanvas-engine-runtime` (Editor `playcanvas@2.19.5`) and `@universo-react/playcanvas-engine` (runtime `playcanvas@2.18.1`) as separate version-guarded stacks.
-   Compatibility backend finding: the new picker calls reach REST endpoints the Universo compatibility backend already exposes as cloud-only no-op descriptors. **No new backend routes are required for this update.** The single-user, branch-equivalent, no-ShareDB-history contract from `protocol.describe` stays valid.
-   Open questions to be resolved in PLAN: (1) vendor drift guard as package-local `editor:vendor-check` or root guard; (2) `.prettierignore` vs restricted root `format` glob; (3) browser smoke sub-assertion for new picker selectors inside existing `editor:browser-smoke` vs a separate script; (4) skip `engines.node` in this slice (use script-level `assertNodeVersion()`) or add it; (5) confirm v2.23.4 mentions in `memory-bank/{tasks,progress,currentResearch,plan,research}` are out of the active metadata guard's scope.

## 2026-06-15: PlayCanvas Editor v2.23.4 → v2.24.2 — PLAN artifact

-   PLAN handoff artifact: `memory-bank/plan/playcanvas-editor-upstream-2-24-2-update-plan-2026-06-15.md`; it implements the reviewed v2.24.2 research as one coordinated 8-phase change covering vendor replacement, metadata/types/OpenAPI propagation, skills/docs, update-governance guards, browser/E2E proof, and closeout.
-   Durable planning constraints: keep runtime `@universo-react/playcanvas-engine` separate, avoid schema/template/application version bumps in this slice, preserve Node/lockfile/build-script safeguards, and land the vendor update atomically with its metadata/governance changes.

## 2026-06-10: MMOOMM PlayCanvas Editor main functionality and runtime projection

-   Research artifact created: `memory-bank/research/mmoomm-playcanvas-editor-main-functionality-runtime-projection-research-2026-06-10.md`.
-   Capability gap: current Editor implementation has full-upstream UI boot foundations, metahub project storage, scene/settings persistence, and single-user ShareDB-compatible snapshot persistence, but still lacks broad binary asset pipeline, Code Editor sourcefile support, durable ShareDB op history, real multi-user collaboration, and version-control surfaces.
-   QA-updated on 2026-06-10: added the source TZ clean-test-DB/refactor/no-schema-template-bump constraint, existing Resources/Packages/PlayCanvas project/Modules UI paths, publication hash/application sync gates, script lifecycle/runtime cleanup evidence, DB/DDL/package ownership safeguards, root-build/Editor-artifact decision points, and Thermos/autoreview expectations.
-   Planning implication: the next PLAN must start with the step-by-step browser product journey, then map it to a main Editor capability matrix, explicitly separate optional PlayCanvas Cloud/commercial extras from required user-facing Editor behavior, and reuse/generalize the existing MMOOMM runtime Playwright oracle for the new Editor-authored fixture.

## 2026-06-05: PlayCanvas Editor upstream UI full boot

-   Research artifact created: `memory-bank/research/playcanvas-editor-upstream-ui-full-boot-research-2026-06-05.md`.
-   Blocking contract: current `universo-hosted` config points realtime, messenger, and relay to `/disabled`, while the backend slice explicitly leaves WebSocket runtime outside scope; upstream scene loading depends on realtime authentication and document loading.
-   Planning implication: the next PLAN must target a full upstream UI boot mode with real same-origin config/realtime/messenger behavior, Playwright screenshots, DOM/network/WebSocket tracing, and an acceptance gate that fails if only the fallback UI appears.

## 2026-06-05: PlayCanvas Editor minimal compatibility backend

-   Research artifact created: `memory-bank/research/playcanvas-editor-minimal-compatibility-backend-research-2026-06-05.md`.
-   Scope decision: the next slice is not another bounded postMessage bridge extension; it is an upstream-compatible backend investigation for shell/config, REST facade, ShareDB realtime, messenger stubs, and metahub-scoped persistence.
-   Core finding: unmodified upstream Editor expects a broad `window.config`, PlayCanvas-shaped REST endpoints, ShareDB collections for `scenes`, `assets`, and `settings`, and a separate messenger WebSocket. A pure REST save or current bridge command API is not enough for full upstream UI behavior.
-   Implementation follow-up: the corrective slice keeps ShareDB persistence explicitly `not-implemented`, validates compatibility contracts with Zod, adds a separate `@universo-react/playcanvas-editor-backend` package, and exposes manager-only same-origin `/playcanvas/editor-compatible/...` REST routes for config, scenes, assets, settings, and typed cloud-only no-op surfaces while continuing to persist scene edits through secured metahub PlayCanvas storage.
-   QA implication: acceptance needs browser evidence for real upstream boot, stable realtime/messenger behavior, visible hierarchy/inspector/viewport, one mutation, persistence, reload/reopen, security negatives, and no layout overflow.

## 2026-06-04: PlayCanvas Editor runtime host, bridge, and storage adapter

-   Research artifact created: `memory-bank/research/playcanvas-editor-runtime-host-bridge-storage-adapter-research-2026-06-04.md`.
-   Scope decision: proceed to PLAN only after treating the first implementation as a proof of the real Editor host seam, not as full PlayCanvas Cloud parity.
-   Critical finding: the current `@universo-react/playcanvas-editor-frontend` artifact is still intentionally `artifact-only`; the build overwrites `dist/editor/index.html` with a safe unavailable page, so implementation must add a real supported artifact mode and manifest/readiness contract before the iframe can become usable.
-   Bridge/security implication: the current iframe sandbox can produce opaque-origin messaging; the bridge must validate `event.source`, session nonce/expiry, schema, request ids, and capabilities, and any `allow-same-origin`/CSP relaxation must be an explicit security decision.
-   Implementation closure: the first real hosted bridge slice is now implemented with request-bound iframe bootstrap, typed session-backed bridge commands, replay/idempotency handling, metadata-first scene persistence with guarded file writes, browser smoke, and local minimal Supabase `@packages` E2E evidence.

## 2026-06-03: PlayCanvas project storage model for metahubs

-   Research artifact created: `memory-bank/research/playcanvas-project-storage-model-for-metahubs-research-2026-06-03.md`.
-   Scope decision: plan PlayCanvas project storage as a metahub authoring store before Editor bridge/adapter work; do not store scene/asset/script payloads in package attachment config or application runtime sync by default.
-   Runtime implication: the current `playcanvasCanvas` widget is module/widget-driven, not Editor scene-driven. Publication should produce a normalized runtime manifest or explicit widget projection; direct Editor scene JSON consumption requires separate stability/versioning proof.

## 2026-06-01: Modules as external files for PlayCanvas-ready authoring

-   Research artifact created: `memory-bank/research/modules-external-files-playcanvas-research-2026-06-01.md`.
-   Scope decision: implement file-backed Modules as a backend source-resolution/file-service contract, not as a simple `sourceKind` enum flip or a PlayCanvas Editor asset bridge.
-   Storage recommendation: keep `sourceKind` semantics stable in the first slice and add a distinct physical storage contract such as `storageMode: inline | file`, with path/checksum/status metadata and explicit inline/file conversion actions.
-   PlayCanvas implication: TS/TSX external module files are only future source inputs; Editor script assets still need generated JS/ESM artifacts, asset ids, virtual paths, hashes, and script-attribute metadata handling in a later bridge/storage brief.

## 2026-06-01: PlayCanvas Editor metahub authoring surface settings

-   Research artifact created: `memory-bank/research/playcanvas-editor-metahub-authoring-surface-settings-research-2026-06-01.md`.
-   Storage recommendation: add validated per-attachment config directly to `metahubs.rel_metahub_packages` with a versioned JSON envelope, and add a separate package-version authoring/display descriptor outside `source.runtimeTargets`.
-   Static serving implication: the Editor artifact route must be reserved, traversal-safe, mounted before the core SPA fallback, and guarded with explicit availability checks, CSP/frame/sandbox/referrer/cache/content-type policy.

## 2026-05-31: PlayCanvas Editor package foundation

-   Research artifact created: `memory-bank/research/playcanvas-editor-package-foundation-research-2026-05-31.md`.
-   Scope decision: first slice should create a private `@universo-react/playcanvas-editor-frontend` artifact package, not a MUI component library and not a metahub storage/API bridge.
-   Package-boundary decision: use an Universo-owned top-level manifest at `packages/universo-react-playcanvas-editor-frontend/`; keep upstream `playcanvas/editor` source isolated so upstream `package.json` does not blindly drive pnpm workspace install or catalog checks.
-   Build implication: do not include the package in root `pnpm build` until Node, pnpm, Turbo output, catalog, and supply-chain constraints are proven. Start with package-local build/smoke commands.
-   Integration implication: do not seed `@universo-react/playcanvas-editor-frontend` into the metahub package registry or use Modules/external files for the Editor app in the foundation slice.

## 2026-05-28: MMOOMM flight simulator metahub configuration

-   Research artifact created: `memory-bank/research/mmoomm-flight-simulator-metahub-research-2026-05-28.md`.
-   Scope decision: implement the first playable MMOOMM flight simulator as a metahub configuration that attaches the existing `@universo-react/playcanvas-engine`, `@universo-react/colyseus-client`, and `@universo-react/colyseus-server` packages; do not create an MMOOMM-specific workspace package.
-   Repository finding: package registry seeding, publication snapshot serialization, and snapshot restore already support package dependencies, while `apps-template-mui` does not yet have a generic PlayCanvas canvas widget.
-   QA implication: the generated snapshot must be a real importable product artifact and browser evidence must prove nonblank PlayCanvas rendering, click-to-move, stop, follow-camera zoom/orbit, observer sync, and no runtime layout overflow.

## 2026-05-27: MMOOMM 3D and multiplayer project-local skills

-   Research artifact created: `memory-bank/research/mmoomm-3d-multiplayer-skills-research-2026-05-27.md`.
-   Source decision: use `freshtechbro/claudedesignskills` only as MIT-licensed inspiration for boundaries and patterns; do not import vendor-specific `.claude/skills` layouts, slash-command flows, marketplace instructions, or verbatim content.
-   Scope decision: PlayCanvas Editor, PCUI/Graph, Blender/asset-pipeline, React Three Fiber, and external skill installation remain deferred outside the MMOOMM MVP skill foundation.

## 2026-05-26: 1C-Compatible metahub template

-   Research artifact created and updated: `memory-bank/research/1c-compatible-metahub-template-research-2026-05-26.md`.
-   Scope decision: use `1C-Compatible` as the user-facing template name. This supersedes the earlier neutral-name recommendation.
-   Planning implication: PLAN must resolve Constants storage, posting expression model, accumulation totals consistency, and Document Journal view/query strategy before implementation steps are finalized.

## 2026-05-20: LMS Learning Content product roadmap after V2

-   Research artifact created: `memory-bank/research/lms-learning-content-product-roadmap-research-2026-05-20.md`.
-   Repository-specific decision candidate: keep Workspaces as the operational boundary and keep iSpring-like Projects as workspace-scoped `ContentProjects`; improve generic `records.union`, `detailsTable`, `relationBuilder`, runtime record pickers, player/progress/status descriptors, Trash restore, and column/report metadata before adding any LMS-only UI.
-   UX implication: the follow-up PLAN must include a UI Contract for Learning Content workbench, project/access dialogs, page authoring, course/track builders, enrollment wizard, learner player, Trash, column settings, and application Learning Content settings, with browser evidence across desktop/tablet/mobile and no raw IDs/JSON/object cells.

## 2026-05-19: AI agent workflow for user-friendly MUI runtime UI

-   Research artifact created: `memory-bank/research/ai-agent-mui-ux-workflow-research-2026-05-19.md`.
-   Workflow decision candidate: keep root agent instructions short, add project-local MUI runtime UX and runtime UX QA skills, and require UI plans/implementations/QA to include field-control contracts, DataGrid display contracts, localized validation checks, responsive browser proof, and anti-technical-leakage assertions.
-   Testing implication: focused Playwright helpers should assert no raw user-facing IDs, no raw JSON/object cells, multiline semantic long-text fields, localized error messages, and no page-level horizontal overflow across realistic viewports.

## 2026-05-18: LMS runtime copy UI integration

-   Implementation outcome: published-app Copy actions now call the generic runtime copy endpoint instead of recreating copied rows through `createRow`.
-   Backend invariant: copy overrides are normalized through the same component metadata coercion, read-only REF label protection, fixed set-constant protection, record-picker validation, required-when validation, date derivation, and date-order validation used by create/update flows.
-   Validation proof: focused applications-backend copy route tests, apps-template API/hook Vitest coverage, lint, and package builds passed on Node 22.

## 2026-05-18: LMS runtime copy relations

-   Implementation outcome: Phase 7 course copy semantics and the matching Phase 9 track copy behavior are now closed through a generic runtime copy relation contract.
-   Safety invariant: relation copy fails closed for invalid Object, parent-field, order-field, or reference-remap metadata; linked learning resources, enrollments, progress, reports, and audit-like rows are not copied unless metadata declares them.
-   Validation proof: focused backend route coverage, applications/metahubs package lint and builds, template validator, fixture contract ESLint, full local-Supabase E2E build, Playwright snapshot generation, and imported LMS runtime flow passed on Node 22.
-   Remaining implementation focus: close the remaining Phase 6/7/8/9/12 checklist labels that are still broader than the now-implemented copy/progress slices.

## 2026-05-18: LMS explicit runtime progress actions

-   Implementation outcome: the Phase 8 explicit complete/recalculate action gap is closed through the existing generic runtime progress endpoint.
-   Backend invariant: `POST /runtime/progress/content` now accepts `action: update | complete | recalculate`; update remains backward compatible, complete derives 100 percent completed progress server-side, and recalculate refuses browser-supplied progress/status values.
-   Safety invariant: recalculation fails closed with `PROGRESS_RECALCULATION_UNAVAILABLE` when metadata is missing and keeps invalid aggregation metadata behind `PROGRESS_AGGREGATION_INVALID`.
-   Remaining implementation focus: close stale Phase 6/7/9/12 checklist labels and run any final browser screenshot matrix gaps tracked in `memory-bank/tasks.md`.

## 2026-05-18: LMS Track Learner Player Implementation Note

### Notes

-   The Course Builder learner player was already generic enough for Track Builder except for target object resolution.
-   This keeps LearningTracks and TrackSteps inside the workspace-scoped published app runtime and avoids an LMS-specific player widget.

## 2026-05-17: LMS parent progress aggregation closure

-   Implementation outcome: the next Phase 8 gap is closed with generic runtime progress aggregation from child records into parent records.
-   Backend invariant: `runtimeProgress.aggregateParents` recalculates parent progress in the same transaction as the child progress write, using the existing ContentProgress store and parameterized SQL over resolved metadata columns.
-   Fixture invariant: the LMS fixture contract rejects CourseItems or TrackSteps without `runtimeProgress.aggregateParents`.
-   Remaining implementation focus: explicit recalculate actions, deeper learner-player behavior, Trash/restore operations, and visual documentation polish remain tracked in `memory-bank/tasks.md`.

## 2026-05-17: LMS enrollment due-date derivation closure

-   Implementation outcome: the remaining Phase 10 enrollment wizard due-date gap is closed with generic metadata-driven date-offset derivation.
-   UI invariant: `FormDialog` can derive hidden date fields from `uiConfig.derivedDateOffset`, so `DueDateMode=ForPeriod` submits a computed `DueDate`, while `DueDateMode=NoDueDate` submits a clear value without exposing raw JSON or LMS-only form logic.
-   Later slices closed parent progress aggregation; remaining implementation focus is explicit recalculate actions, deeper learner-player behavior, and visual documentation polish.

## 2026-05-17: LMS generic learner player shell

-   Implementation outcome: Course Builder now includes a metadata-defined `learnerPlayer` widget that reads Courses as the parent datasource and CourseItems as the playable outline.
-   UI invariant: the player reuses MUI layout primitives, existing resource preview rendering, Editor.js page block rendering, and localized dashboard strings; it does not introduce an LMS-only page shell.
-   Fixture invariant: the LMS fixture contract now rejects Course Builder layouts without a generic learner-player tab over Courses and CourseItems.
-   Browser proof: the imported LMS runtime flow includes a Course Builder Player tab screenshot and verifies CourseItems progress persistence through `/runtime/progress/content`.

## 2026-05-17: LMS server-owned sequence progress guard

-   Implementation outcome: direct progress writes now enforce metadata-defined sequence availability for runtime targets before inserting or updating the generic progress store.
-   SQL invariant: sequence evaluation uses existing metadata components to resolve safe column identifiers, generated lowercase aliases for selected dynamic fields, parameterized scope filters, and workspace-aware progress lookup.
-   Fixture invariant: the LMS fixture contract now rejects CourseItems or TrackSteps without runtime sequence guard metadata.
-   Remaining implementation focus: fuller learner-player UX and learner-player screenshot coverage remain tracked in `memory-bank/tasks.md`.

## 2026-05-17: LMS scoped sequence availability in generic details tables

-   Implementation outcome: Course Builder and Track Builder completion tabs now surface sequence availability through the existing `detailsTable` DataGrid widget.
-   Shared contract invariant: `sequencePolicy.scopeFieldCodename` groups availability evaluation by a parent record such as `CourseId` or `TrackId`, so rows from different courses or tracks do not lock each other.
-   Fixture invariant: the LMS fixture contract rejects completion tabs that omit scoped sequential metadata.
-   Remaining implementation focus: fuller learner-player behavior, direct locked-item API rejection, Trash/restore operations, and final learner-player screenshot coverage remain tracked in `memory-bank/tasks.md`.

## 2026-05-17: LMS course and track enrollment list tabs

-   Implementation outcome: Course Builder and Track Builder enrollment tabs now combine scoped `relationBuilder` authoring with a generic `detailsTable` enrollment list.
-   Fixture invariant: the LMS fixture contract now rejects Course Builder or Track Builder layouts that omit the enrollment list widget or use the wrong target-type filter.
-   Remaining implementation focus: richer learner player/progress behavior, Trash/restore operations, and final visual documentation screenshots remain tracked in `memory-bank/tasks.md`.

## 2026-05-17: LMS catalog-ready course and track metadata

-   Implementation outcome: Courses and LearningTracks now expose metadata-driven catalog readiness fields through the existing Object/component model.
-   Shared contract invariant: catalog publication policy is validated by `catalogPublicationPolicySchema` with only `disabled` and `open` self-enrollment modes; approval workflows remain explicitly deferred.
-   Remaining implementation focus: enrollment list tab/export, richer learner player/progress, Trash/restore operations, and final visual documentation screenshots remain tracked in `memory-bank/tasks.md`.

## 2026-05-17: LMS enrollment wizard and conditional due-date closure

-   Implementation outcome: course and track enrollment creation now uses a generic metadata-defined `createWizard` in the shared relation-builder form.
-   Backend invariant: conditional required fields are enforced by reusable Object-level `runtimeValidations.requiredWhen` before runtime row create, single-field update, and bulk update persistence.
-   Remaining implementation focus: broader learner-player behavior, richer catalog/self-enrollment policy, Trash/restore operations, and final Learning Content documentation screenshots remain tracked in `memory-bank/tasks.md`.

## 2026-05-17: LMS enrollment validation and permission proof

-   Implementation outcome: Enrollments now use generic Object-level `runtimeValidations.dateOrder` metadata, enforced by the runtime rows controller before create/update persistence.
-   Security invariant: direct runtime enrollment creation still depends on generic `createContent`; focused route coverage proves member-role calls fail with `403` before runtime metadata reads.
-   Remaining implementation focus: full guided Enrollment Wizard, due-for-period/no-due-date wizard UX, and full course/track learner-player behavior remain open in `memory-bank/tasks.md`.

## 2026-05-17: LMS Learner enrollment visibility

-   Implementation outcome: the LMS home page now exposes learner-facing My Courses and My Tracks through generic `detailsTabs`/`detailsTable` widgets, not through an LMS-only runtime component.
-   Workspace seed invariant: personal workspace seed rows may resolve the same current-user token against the workspace owner, so generated LMS snapshots can contain portable user-scoped seed data without hardcoded user IDs.
-   Browser proof: the local Supabase LMS snapshot import/runtime flow passed with My Courses/My Tracks visibility, course/track enrollment rows, page blocks, builder tabs, inline linking, reorder, progress, and workflow actions.
-   Remaining implementation focus: full guided Enrollment Wizard, direct enrollment permission proof, broader due-date validation, and full course/track learner-player behavior remain open in `memory-bank/tasks.md`.

## 2026-05-17: LMS Manual Enrollment Foundation and enrollment warnings

-   Implementation outcome: Course Builder and Track Builder now use the generic `relationBuilder` for scoped enrollment authoring instead of an LMS-only enrollment UI.
-   Data-model invariant: Enrollments now target content/course/track records through `TargetType` and `TargetId`; the canonical LMS fixture uses `ContentNodeIdRef` for content rows and no longer seeds a separate `Modules` object.
-   Browser proof: the local Supabase LMS snapshot import flow passed with Course Builder and Track Builder active-enrollment warnings, scoped course/track enrollment rows, inline linking, reorder, page progress, and workflow actions.
-   Later slices closed the Enrollment Wizard, learner "My Courses" visibility, direct enrollment permission proof, due-date validation, parent progress aggregation, and learner-player screenshot proof items; remaining implementation focus is explicit recalculate actions, Trash/restore operations, and visual documentation polish.

## 2026-05-17: LMS Relation Builder runtime closure

-   Implementation outcome: the Learning Content Relation Builder slice is now closed through a generic `relationBuilder` widget, not an LMS-only runtime fork.
-   Runtime invariant: parent-scoped builders should prefer authoritative parent datasource rows and may use a metadata-sorted current-section fallback only before the user makes a manual parent selection.
-   Remaining implementation focus: active-enrollment warnings, manual enrollment and learner visibility, and the broader learner-player screenshot matrix remain open in `memory-bank/tasks.md`.

## 2026-05-17: LMS Learning Content research review

-   Research artifact updated: `memory-bank/research/lms-learning-content-ispring-research-2026-05-17.md`.
-   Repository-specific correction: existing May 2026 work already delivered generic block authoring groundwork, safe resource preview/validation, sequence/completion helpers, workflow actions, reports/export, dashboard parity, and deferred resource states. Future PLAN work should focus on product coherence and missing runtime surfaces rather than re-planning that groundwork.
-   Handoff recommendation: PLAN should prioritize Projects, unified content table, runtime page authoring, Course Builder, Track Builder, learner player/progress, Trash, Playwright snapshot regeneration, tests, screenshots, and docs. SCORM/xAPI, broad file import/conversion, messaging, AI generation, and full training/session scheduling remain deferred.

## 2026-05-16: Research gate before PLAN workflow

-   Research outcome implemented: link-driven and current-information tasks now have a dedicated `RESEARCH` / `RPLAN` custom mode that creates a cited Memory Bank artifact before implementation planning.
-   Workflow decision: `VAN` recommends `RESEARCH` / `RPLAN` before PLAN when user-provided links or current external facts are part of the decision input. `PLAN` no longer blocks when research is missing; it performs the needed research inline or through a research-capable subagent when available, then continues planning.
-   Durable references: implementation plan lives in `memory-bank/plan/agent-research-before-plan-mode-plan-2026-05-16.md`; future research artifacts live in `memory-bank/research/`.

## 2026-04-13: Standard-kind contract cleanup and validation sync

-   Research outcome implemented: the remaining legacy-removal drift was a shared contract problem, not a single-controller bug. The stale assumptions lived in `@universo-react/types`, dynamic menu/breadcrumb consumers, self-hosted fixture generation, and the touched runtime/browser proofs that still expected builtin/source or `custom.*-v2` behavior.
-   No open research thread remains for this standard-kind cleanup seam.

## 2026-04-12: PR #763 review comment QA triage

-   Research outcome implemented: only the dialog-related review comments were correct on the live tree. React docs confirmed that `EntityFormDialog` should not write `ref.current` during render, and the first-open reset path was indeed vulnerable to child mount effects overwriting or being overwritten by the passive open-reset cycle.
-   Rejected suggestion with proof: removing the route-aware `Header` inset looked plausible from the nested `Stack` structure, but the targeted Chromium `metahub-shell-spacing.spec.ts` run showed a `16px` breadcrumb/title drift immediately after that patch, so the `Header` inset contract was restored unchanged.
-   Research outcome implemented: the remaining QA debt after the visual spacing acceptance passes was structural, not visual-only. The accepted inset depended on duplicated metahub route detection across shared shell components, metahub loading states still used an implicit numeric override pattern, and the tree lacked real proof for browser geometry plus negative-path generic-entity ACL behavior.
-   Implemented fix set: `pageSpacing.ts` now centralizes the route-aware metahub shell helpers consumed by `MainLayoutMUI` and `Header`; `SkeletonGrid` now exposes semantic `insetMode='page' | 'content'` plus the stable `skeleton-grid` selector; the affected metahub routes now use `insetMode='content'`; focused `entityInstancesRoutes` ACL tests now prove `403` denial behavior for generic delete and catalog-compatible create; and the new authenticated Playwright flow `metahub-shell-spacing.spec.ts` proves breadcrumb/header/loading-skeleton alignment on `/metahubs` during a delayed loading state.
-   Wider `entityInstancesRoutes` permanent-delete policy failures remain an older branch baseline and were not changed in this session; no open research thread remains for the metahub QA-gap closure itself.

## 2026-04-12: Metahub gutter narrowing follow-up

-   Research outcome implemented: removing the old content bleed offsets fixed the original mismatch, but the resulting metahub page inset was still wider than the acceptance screenshots because breadcrumbs remained tied to the shared shell gutter.
-   No open research thread remains for this metahub gutter follow-up.

## 2026-04-12: Metahub page horizontal spacing fix

-   Research outcome implemented: the spacing issue was not isolated to one list page. The same standalone page-shell drift existed across both legacy and entity-based metahub pages because the main layout already provided a gutter while the page content still applied older negative bleed offsets.
-   No open research thread remains for this metahub spacing seam.

## 2026-04-12: Entity V2 post-rebuild regression fix

-   Research outcome implemented: the fresh-import defects were two narrow shipped-surface seams, not a wider entity-definition data-loss problem. The first-open blank fields came from shared dialog state timing, and the missing Hub V2 / Set V2 / Enumeration V2 rows came from an over-narrow compatibility read scope.
-   No open research thread remains for this post-rebuild regression seam.

## 2026-04-12: Self-hosted fixture QA closure

-   Research outcome implemented: the last real QA findings on the current tree were no longer preset manifests or compatibility ACLs; they were a stale committed self-hosted fixture and a browser import flow that still validated only counts/layout structure.
-   No open research thread remains for this self-hosted fixture/import seam.

## 2026-04-12: Entity V2 QA completion follow-up

-   Research outcome implemented: the last real implementation gap after the QA pass was not ACL/runtime parity anymore; it was preset manifest drift. Hub V2 and Enumeration V2 still inherited legacy-disabled component maps even though the approved plan promised V2-only automation uplift.
-   No open research thread remains for this preset-uplift seam.

## 2026-04-12: Entity V2 QA closure completion

-   Research outcome implemented: the last real blocker after the deeper QA review was a low-level SQL seam, not a controller-level permission bug. Delete blocker services still filtered exact built-in `set` / `enumeration` target kinds even though compatible Set V2 / Enumeration V2 rows persisted custom target kinds.
-   No open research thread remains for this blocker-service seam.

## 2026-04-11: Entity V2 completion remediation closure

-   Research outcome implemented: the remaining live browser defects were the delegated Set V2 direct-constants `kindKey` gap, the delegated Enumeration V2 detail/value `kindKey` gap, a backend direct-enumeration update seam that still hardcoded the built-in `enumeration` kind, and a stale snapshot round-trip browser timeout after the self-hosted fixture expanded.
-   No open research thread remains for the Entity V2 completion remediation seam.

## 2026-04-11: PR #757 review comment QA triage

-   Review outcome implemented: the PR bot comments reduced to one real backend lifecycle issue plus a batch of indentation-only comments.
-   Rejected comments: the indentation warnings were not applied because neighboring metahubs-backend controllers/services already use the same indentation style and the bot cited a non-existent `.gemini/styleguide.md` file rather than an actually present repository contract.
-   No open research thread remains for the PR #757 review-triage seam.

## 2026-04-11: Entities automation closure remediation

-   Research outcome implemented: the remaining QA-closure work narrowed to three real seams only: generic create still needed to use the lifecycle boundary, the automation ACL suspicion needed verification against the actual mounted surface instead of a speculative permission patch, and the EN/RU operator docs still under-described the real authoring workflow.
-   Implemented fix set: generic custom-entity create now routes through `EntityMutationService` with a result-resolved committed object id, focused `EntityAutomationTab` coverage is green, catalog-compatible routes were verified to short-circuit into `CatalogList` before the generic automation tabs mount, and EN/RU docs now ship save-first `Modules -> Actions -> Events` guidance plus stable copied visual assets.
-   No open research thread remains for the entities automation closure seam.

## 2026-04-11: Post-rebuild Entities workspace QA closure

-   Research outcome implemented: the residual defects reported after a clean rebuild/reset/import were real shipped-surface mismatches rather than stale local state. The honest remaining scope was limited to `EntitiesWorkspace` polish, shared menu target resolution, product-string pluralization, and supported fixture regeneration.
-   No open research thread remains for the post-rebuild Entities workspace QA seam.

## 2026-04-10: ECAE residual QA hardening closure

-   Research outcome implemented: repository evidence confirmed that Phase 5 remains future-only, so the honest remaining scope was limited to residual hardening on the shipped strict-parity surface rather than hidden unfinished visual-builder work.
-   No open research thread remains for the residual QA hardening seam or for the Phase 5 scope question in this session.

## 2026-04-09: ECAE Phase 3.6-4 closure

-   Research outcome implemented: the remaining builder/browser gap was real checkbox semantics in `EntitiesWorkspace`, not a test bug; after that repair the honest Phase 3.8 closure was focused compatibility proof plus Phase 4 docs rather than widening into a new speculative surface.
-   No open research thread remains for the Phase 3.6-4 closure seam.

## 2026-04-09: ECAE Phase 2.9 browser validation closure

-   Research outcome implemented: the correct Phase 2.9 scope was the already shipped entity-type authoring surface, not a speculative Phase 3 runtime UI. The validation target was therefore `EntitiesWorkspace`, the preset-backed create dialog, backend persistence, RU parity, and a pixel-proof dialog snapshot.
-   No open research thread remains for the Phase 2.9 browser-validation seam.

## 2026-04-09: ECAE Phase 2.7b reusable entity presets closure

-   Research outcome implemented: the safe reusable-preset seam was already present in the metahub template registry. The missing pieces were typed registry/API exposure for `definition_type='entity_type_preset'`, builtin preset manifests, and frontend create-flow consumption.
-   Implemented fix: shared template DTOs/routes now expose `definitionType` plus `activeVersionManifest`, builtin entity presets are validated and seeded through the existing template seeder/migration path, and `EntitiesWorkspace` create mode now reuses the templates hooks/selector seam to prefill entity-type form state from preset manifests.
-   No open research thread remains for the Phase 2.7b reusable-entity-preset seam.

## 2026-04-08: ECAE Phase 2.5c design-time service genericization closure

-   Research outcome implemented: the honest safe Phase 2.5c slice was not broad layout-service genericization. The real reusable seam was an object-scoped system-attribute adapter plus one shared design-time child-copy helper that both legacy built-in copy routes and generic custom-entity copy can reuse.
-   No open research thread remains for the Phase 2.5c design-time genericization seam.

## 2026-04-08: ECAE Phase 2.5 generic entity CRUD backend closure

-   Research outcome implemented: the generic object-layer seam was viable, but only as a coexistence-first slice. Built-in catalogs/sets/enumerations still carry extra policy/copy/runtime behavior, so the safe first cut was a custom-only generic route surface rather than a wholesale legacy-route replacement.
-   No open research thread remains for the Phase 2.5 generic entity CRUD backend seam.

## 2026-04-08: ECAE Phase 2.4 resolver DB extension closure

-   Research outcome implemented: the shared entity-type resolver is no longer registry-only. It now understands the hybrid model where built-ins come from code and custom kinds come from metahub data definitions.
-   No open research thread remains for the Phase 2.4 resolver DB extension seam.

## 2026-04-08: ECAE Phase 2.3 backend route surface closure

-   Research outcome implemented: the new ECAE backend foundation is no longer service-only. The metahubs backend now exposes custom entity types, object-owned actions, and object-owned event bindings through the normal route/controller/auth/rate-limit stack.
-   No open research thread remains for the Phase 2.3 backend route surface seam.

## 2026-04-08: ECAE Phase 2.2 backend service foundation closure

-   Research outcome implemented: the first focused Phase 2.2 service run did not reveal domain-logic breakage; it exposed two narrower seams instead: test fixtures used non-canonical schema names, and the new services still had build-only typing gaps around optimistic locking and post-commit dispatch.
-   No open research thread remains for the Phase 2.2 backend service foundation seam.

## 2026-04-08: Post-QA lint closure for the Shared/Common wave

-   Research outcome implemented: after the earlier product/security remediations were closed, the only remaining QA blocker was red package lint in the touched Shared/Common backend/frontend files.
-   Confirmed root cause: the release gate was the error-level Prettier/ESLint drift in the touched metahubs files. The broader warning-only backlog was real but was not the blocker that kept this implementation wave open.
-   No open research thread remains for the lint-closure seam.

## 2026-04-08: Attribute move ownership remediation closure

-   Research outcome implemented: the only blocking post-QA defect left in the Shared/Common wave was a fail-open attribute move seam. The route accepted a routed catalog id plus an arbitrary attribute id, and the service loaded the current row by bare id even though the request was scoped to a specific catalog.
-   No open research thread remains for the attribute move ownership seam.

## 2026-04-08: Strict E2E runner finalization cleanup closure

-   Research outcome implemented: the remaining post-QA cleanup issue was infrastructure noise, not residual state. Under strict `runner-finalize` full reset, route-level manifest cleanup was redundant and only triggered false publication/application delete failures plus savepoint/RLS error logs before the already successful authoritative reset.
-   Confirmed root cause: the Common/shared Chromium wrapper flow was functionally green after the settled-response Playwright fix, but `run-playwright-suite.mjs` still executed `cleanupE2eRun()` first and therefore hit backend delete-route savepoint noise that the subsequent full reset then cleaned anyway.
-   No open research thread remains for the strict finalization cleanup seam.

## 2026-04-08: Shared/Common QA closure sync

-   Research outcome: the final QA follow-up did not uncover additional product-code gaps in the Shared/Common, imported connector, or runtime page-surface waves. The only remaining issue was stale closure state in memory-bank.
-   No open research thread remains for this wave.

## 2026-04-08: Imported connector schema-sync duplicate seams closed

-   Research outcome implemented: the imported self-hosted connector failure was a two-step application-runtime identifier reuse problem, not raw fixture corruption. The first live 500 came from repeated shared field ids across multiple target entities in `_app_attributes`; after that fix landed, the remaining live 500 came from repeated shared enumeration value ids across multiple target enumeration objects in `_app_values` seeding.
-   Confirmed narrowing: the committed raw fixture and the direct runtime-materialized fixture bundle were clean under the new executable-payload checks. The remaining collisions only surfaced on the imported publication runtime path that applications-backend consumes for diff/sync.
-   No open research thread remains for the connector schema-sync duplicate seam.

## 2026-04-07: Remaining shared/Common QA contract gap remediation

-   Research outcome implemented: the last open QA findings were real contract mismatches, not missing compilation/tests. Shared exclusion checkboxes still wrote override rows before the parent dialog was saved, metahub modules needed strict `general/library` handling, and `GET /shared-containers` still created virtual containers from a nominally read-only route.
-   No open research thread remains for this remediation batch.

## 2026-04-07: Residual QA closure for shared/Common docs, route coverage, and runner cleanup

-   Research outcome implemented: the remaining post-QA gaps were narrow and verified. The public REST API docs still described the wrong modules detail path/method, shared entity override routing still lacked direct controller-level `400/403` coverage, and the Common/shared Chromium flow still ended with runner-level manifest cleanup failure even though the browser scenarios were green.
-   No open research thread remains for this residual-gap closure batch.

## 2026-04-07: Shared Common fail-closed closure remediation

-   Research outcome implemented: the reopened QA seams were real and narrow. The Common/shared modules UI already constrained authoring correctly, but the backend still allowed illegal `general` or `library` scope transitions, the browser flow lacked the negative dependency scenarios, and the touched EN/RU docs did not yet describe the operator-facing fail-closed rules explicitly.
-   No open research thread remains for this remediation wave.

## 2026-04-07: Shared Common final closure

-   Research outcome implemented: the last closure defects were request-scoped shared override mutation/savepoint coupling, publication-backed application-sync hash mismatch after shared runtime materialization, and stale browser expectations in the final Common/shared Playwright file.
-   No open research thread remains for the shared Common closure.

## 2026-04-07: Widget shared-behavior closure for inherited catalog widgets

-   Research outcome implemented: the remaining Phase 6 defect was not just missing button hiding. Global widgets had no consistent `sharedBehavior` editor path, inherited widget UI still allowed forbidden drag/toggle actions, and backend resolver/mutation seams still trusted sparse overrides that should have been locked by the base widget.
-   No open research thread remains for the widget shared-behavior wave.

## 2026-04-07: Layout-owned catalog behavior contract closure

-   Research outcome implemented: the reopened QA defect was a contract split, not a runtime-resolution bug. Applications runtime already resolved behavior from layout `catalogBehavior`, but metahubs catalog authoring/API/tests still carried legacy `runtimeConfig`.
-   No open research thread remains for this remediation wave.

## 2026-04-07: Snapshot hash integrity and catalog layout docs closure

-   Research outcome implemented: the reopened QA defect was a real integrity gap, not a false positive. The shared canonical publication snapshot hash/checksum path had not kept up with the current export surface.
-   Confirmed root cause: `normalizePublicationSnapshotForHash(...)` omitted `modules`, `catalogLayouts`, and `catalogLayoutWidgetOverrides`, even though those sections already participate in snapshot export/import and application release lineage.
-   No open research thread remains for this remediation wave.

## 2026-04-07: Self-hosted fixture regeneration and current structure baseline closure

-   Research outcome implemented: the remaining self-hosted generator failure was split across two seams, not one export bug. The generator spec still expected `showDetailsTitle: false` to persist in Settings layout config, while the live contract keeps that behavior as a widget override.
-   Confirmed root cause: current public structure version `0.1.0` still mapped numeric version `1` to `SYSTEM_TABLES_V1`, so freshly created branch schemas omitted `_mhb_modules` and publication creation failed during the generator flow.
-   No open research thread remains for this fixture/baseline wave.

## 2026-04-06: Catalog layout QA remediation closure

-   Research outcome implemented: the remaining QA defects were real contract mismatches, not just copy or CSS polish. Catalog runtime behavior still resolved partly from legacy catalog settings, catalog layouts still stored copied widget-visibility booleans, and the catalog dialog still exposed a fallback-runtime form.
-   Implemented runtime contract: `catalogRuntimeConfig.ts` and `runtimeRowsController.ts` now resolve active catalog behavior only from layout config, with the global layout acting as the default baseline until a catalog-specific layout exists.
-   No open research thread remains for this remediation wave.

## 2026-04-06: Inherited catalog widgets closure

-   Research outcome implemented: the remaining reopened defect was narrow and contract-level, not a broader failure of the General/catalog-layout architecture.
-   Closure validation: focused metahubs-backend service tests passed (`7/7`), focused metahubs-frontend layout tests passed (`4 tests total`), focused applications-backend sync tests passed (`2/2`), `pnpm run build:e2e` completed green, `metahub-general-catalog-layouts.spec.ts` passed (`2 passed`, `1.8m`), and the canonical root `pnpm build` remained green.
-   No open research thread remains for this defect.

## 2026-04-06: Metahub General section plan final contract clarification

-   Research outcome: the revised plan still had one residual ambiguity after the second QA pass. It correctly moved create/edit/copy behavior to the catalog-layout level, but it did not yet specify where that behavior should live in the contract/schema.
-   Planning conclusion applied: the plan now treats those fields as a catalog-layout-level nested behavior block inside the existing layout `config` JSONB, reusing the established catalog runtime setting shape/enums instead of introducing a new standalone schema family.
-   Resulting contract split: dashboard presentation stays in `DashboardLayoutConfig`; catalog-specific runtime behavior that is not part of dashboard layout becomes part of the selected catalog layout's nested behavior config.
-   No open research thread remains for this plan QA pass; the next action is user approval or implementation.

## 2026-04-06: Codename JSONB/VLC contract re-audit

-   Research outcome: the live source contract now persists codename through one `codename` JSONB/VLC field across the touched metahubs/admin flows; the older mixed-storage notes below are historical, not current-state guidance.
-   Workspace audit result: no source file under `packages/**/base/src` still persists `codename_localized` or `presentation.codename`, and no workspace artifact named `admin-role-codename-localized-contract-20260323.json` exists.
-   No open research thread remains for this audit.

## 2026-04-05: Frontend test warning remediation closure

-   Research outcome implemented: the remaining QA debt was not a product bug. The noisy MUI `anchorEl` warning came from jsdom layout validation for `Popover`/`Select` anchors inside modules-related frontend tests.
-   No open research thread remains for this remediation.

## 2026-04-05: Metahub dialog settings and Modules-tab responsiveness closure

-   Research outcome implemented: the narrow-dialog Modules-tab regression was not a CRUD bug; the real failure was container-width geometry plus missing real-browser overflow assertions.
-   Implemented fix: metahub dialog behavior is now driven by shared settings and one template-mui presentation seam with preset sizing, fullscreen toggle, resize persistence, reset-to-default, and strict-modal close handling.
-   No open research thread remains for this wave.

## 2026-04-05: Quiz snapshot fixture export/import closure

-   Research outcome implemented: the newly requested durable quiz fixture could not safely ship on top of the existing import path because metahub export already serialized `snapshot.modules`, but `SnapshotRestoreService` did not restore `_mhb_modules` at all.
-   Implemented durable fixture contract: `tools/testing/e2e/support/quizFixtureContract.ts` now owns the canonical quiz metahub identity, bilingual 10-question content, canonical widget module source, and fail-closed snapshot assertions.
-   No open research thread remains for the 2026-04-05 quiz snapshot fixture wave.

## 2026-04-05: Modules QA gap closure and final plan completion

-   Research outcome implemented: the previously identified modules QA gaps are fully closed, and the final plan-completion wave is now the durable state for the 2026-04-05 modules track.
-   Implemented product proof: browser authoring now exposes `quizWidget` `moduleCodename`, the real browser-authored Playwright flow covers authoring -> publication -> application -> runtime smoke, the shared auth `419` retry defect is fixed, and untouched draft role switches now reapply widget defaults so `rpc.client` remains present.
-   No open research thread remains for the 2026-04-05 modules wave.

## 2026-04-05: Modules hardening closure follow-up

-   Research outcome implemented: the compiler was still acting like a general esbuild entrypoint. Embedded module compilation now enforces an explicit SDK-only boundary by rejecting unsupported static imports plus `require()`, dynamic `import()`, and `import.meta` before bundling.
-   No open research thread remains for this modules hardening closure wave.

## 2026-04-04: Self-hosted post-import schema diff and runtime inheritance regression wave

-   Research outcome implemented: the connector destructive-diff bug was caused by identity drift, not by harmless UI-only diff rendering. `@universo-react/schema-ddl/calculateSchemaDiff(...)` matches physical entities and fields by `entity.id` / `field.id`, not by codename.
-   Confirmed-and-fixed root cause: `metahubsController.importFromSnapshot` restored the imported snapshot into a fresh branch through `SnapshotRestoreService`, which remapped entity/attribute/layout IDs to new runtime rows, but originally created the initial publication version from the raw imported snapshot payload instead of serializing the restored live branch. The imported publication baseline now serializes from the restored live branch, keeping executable identity aligned with later publications.
-   No open research thread remains for this regression wave.

## 2026-03-23: Unified codename JSONB architecture revalidation

-   Historical note: this section captured the pre-convergence migration gap when the branch still carried mixed codename storage seams.
-   Closure update 2026-03-24: the touched backend/frontend request-contract slice is now implemented and validated; no open research thread remains for this specific codename payload seam.

## 2026-03-17: Admin roles / metapanel live-architecture revalidation

-   Research outcome: the corrected admin-roles/metapanel plan still had hidden integration gaps against the live repository architecture, mainly around root routing, onboarding completion timing, permission refresh ownership, menu section filtering, and dashboard stats contracts.
-   Confirmed root cause: the current root route `/` bypasses the main shell and always enters the start flow for authenticated users, so `RegisteredUserGuard` alone cannot redirect post-onboarding users into Metapanel; a dedicated `/start` route plus root resolver is required.
-   Confirmed root cause: Metapanel currently points at a global-users-specific stats endpoint, while the desired cards aggregate multiple domains; this should be promoted to a dedicated admin dashboard stats contract shared with AdminBoard.
-   No open research thread remains before implementation approval; the next action is user approval or another targeted plan QA pass.

## 2026-03-17: Configurable platform runtime `_upl_*` columns

-   Research outcome implemented: the remaining bug was below the metahub/publication layer. Catalog snapshots already preserved disabled `upl.*` states, but runtime application business-table generation still created configurable `_upl_archived*` / `_upl_deleted*` columns unconditionally.
-   Confirmed root cause: `@universo-react/schema-ddl` consumed only `config.systemFields.lifecycleContract`, while applications runtime CRUD/sync helpers still hardcoded `_upl_deleted` predicates and updates for dynamic business tables.
-   No open research thread remains for this runtime `_upl_*` contract issue.

## 2026-03-17: Catalog tab mixing and basic template layout defaults

-   Research outcome implemented: the tab-mixing defect was a scoped-list UX issue, not a backend data-integrity bug. `AttributeList` was using the shared paginated hook with previous-query placeholder reuse enabled while switching between two different scopes inside the same component instance.
-   Implemented fix: the built-in base template now seeds `appNavbar` in the top zone and only `detailsTable` in the center zone for new metahubs; no template version bump or legacy branch was required because the target environment recreates the database from scratch.
-   No open research thread remains for this wave.

## 2026-03-17: Disabled system attributes still created runtime `_app_*` columns

-   Research outcome implemented: the bug was not in publication snapshot generation and not in schema-ddl itself. Publication snapshots already carried `systemFields.lifecycleContract`, and schema-ddl already omitted `_app_*` lifecycle columns when that contract disabled them.
-   Confirmed root cause: the application release-bundle executable payload builder reconstructed entities directly from `snapshot.entities`, which do not carry the top-level publication `systemFields` data. That dropped `config.systemFields.lifecycleContract` before schema generation and caused runtime tables to fall back to default lifecycle columns.
-   No open research thread remains for this runtime lifecycle propagation issue.

## 2026-03-17: Application connector snapshot-hash mismatch

-   Research outcome implemented: connector schema creation failed because the publication-side hash producer and the application-side hash verifier were normalizing different snapshot payloads.
-   Confirmed root cause: `SnapshotSerializer.normalizeSnapshotForHash(...)` includes `systemFields` and omits absent optional keys, but `normalizePublicationSnapshotForHash(...)` had drifted by omitting `systemFields` and coercing absent optional publication/layout keys to `null`.
-   No open research thread remains for this connector snapshot-hash issue.

## 2026-03-16: Platform system attributes governance closure

-   Research outcome implemented: platform `_upl_*` catalog system attributes no longer depend only on metahub configuration; a global admin policy now decides whether they are configurable, always created, or forced back to platform defaults.
-   Confirmed UX/root-cause findings: the empty platform action menu was caused by `canDisable: false` in the shared registry, and the row-jump bug was caused by optimistic `moveToFront: true` rather than backend `sort_order` rewrites.
-   No open research thread remains for this platform-governance wave.

## 2026-03-16: Metahub catalog system attributes and runtime lifecycle contract planning

-   Code audit result: configurable catalog system attributes cannot be implemented safely as a metahub-only change because `_app_*` lifecycle fields are still hardcoded in runtime schema generation and assumed directly in application sync/CRUD routes.
-   The critical propagation seam is the publication snapshot pipeline: catalog-level system-field metadata must be serialized explicitly and then resolved into a compact runtime lifecycle contract during publication/app sync.
-   Recommended runtime rule: derive the lifecycle contract once during publication/app sync and persist it with application sync or release metadata; runtime requests should consume that contract instead of probing live schema shape or hardcoding `_app_deleted` assumptions.
-   Frontend planning result: add a dedicated `System` tab, standardize catalog tab order to `Attributes -> System -> Elements -> Settings`, keep `Settings` visible from every catalog sub-view, and expose toggle-only controls for system rows with localized labels and type badges.
-   Open decision for implementation review: whether design-time persistence should extend the existing catalog-attribute entity with `isSystem/systemKey/isEnabled` metadata or use a small dedicated side-table if the current schema shape proves too rigid.
-   QA refinement conclusion: because metahub attribute routes, metahub element validation, snapshot serialization, and runtime application metadata all currently consume generic attribute collections, the implementation must exclude system rows from ordinary attribute/business-field flows by default and serialize them through a dedicated lifecycle metadata channel.

## 2026-03-13: Optional global migration catalog true final closure

-   Research outcome implemented: the last remaining gap was not runtime correctness but artifact completeness. `application_release_bundle` now embeds deterministic executable payloads for both baseline and incremental execution instead of checksum-only descriptors.
-   No open research thread remains for this architecture wave.

## 2026-03-13: Optional global migration catalog closure

-   Research outcome implemented: the remaining QA gaps were operational closure issues, not missing core architecture.
-   No open research thread remains for this architecture wave.

## 2026-03-13: Optional global migration catalog architecture audit

-   Code audit: `@universo-react/core-backend` startup still always calls `syncRegisteredPlatformDefinitionsToCatalog(...)`, so global catalog bootstrap remains in the critical startup path.
-   QA refinement finding: the env/config layer should follow the repository’s established small helper pattern in `@universo-react/utils` first, rather than introducing a broader shared capability abstraction prematurely.

## 2026-03-13: Optional global migration catalog implementation closure

-   Research outcome implemented: the repository now supports explicit catalog-enabled and catalog-disabled modes without treating the full global definition registry as a mandatory cold-start dependency.
-   No open research thread remains for this architecture wave.

## 2026-03-13: QA blocker closure wave

-   Research outcome implemented: the still-live blockers were narrow package-level correctness/tooling issues, not missing architecture from the completed system-app program.
-   No open research thread remains for this blocker-closure wave.

## 2026-03-13: Final QA closure gap audit

-   Research outcome implemented: the remaining repository-side gaps were narrow contract and proof issues, not missing architectural waves.
-   No open research thread remains for this final QA closure wave.

## 2026-03-13: QA closure completion revalidation

-   Research outcome implemented: four real residual defects remained after the earlier green state, and all were operational contract issues rather than broad architectural failures.
-   No open research thread remains for this QA closure completion wave.

## 2026-03-13: QA plan completion revalidation

-   Research outcome implemented: the suspected metahubs naming/parity mismatch was not real on the live branch; the parity contract already expects the converged `cat_*` / `doc_*` fixed-schema naming.
-   No open research thread remains for this QA completion wave.

## 2026-03-13: Definition lifecycle closure audit

-   Research outcome implemented: the remaining gap was operational, not storage-level — lifecycle tables and helpers already existed, but live imports still bypassed them.
-   No open research thread remains for this lifecycle closure wave.

## 2026-03-12: Ownership seam and live-start bootstrap investigation

-   Research outcome implemented: the publication-derived runtime sync seam now stops at `loadPublishedPublicationRuntimeSource(...)` in `@universo-react/metahubs-backend`, while `@universo-react/applications-backend` owns the final sync-context adapter.
-   No open research thread remains for this closure wave; future work should treat live startup smoke as mandatory whenever platform migration phases or fixed-schema bootstrap sequencing change.

## 2026-03-11: System-app unification completion planning audit

-   Codebase audit result: the loader/CLI/registry foundation exists, but the completion program still lacks a rich system-app contract, unified schema-target handling across fixed + runtime schemas, runtime application-sync ownership separation, and the deep acceptance test matrix.
-   Existing frontend reuse patterns confirmed during the QA pass: `MigrationGuardShell`, `ApplicationMigrationGuard`, `MetahubMigrationGuard`, `ConnectorDiffDialog`, `EntityFormDialog`, `DynamicEntityFormDialog`, `CrudDialogs`, `RowActionsMenu`, `useCrudDashboard`, `createEntityActions`, `createMemberActions`, and existing optimistic/query invalidation helpers should be treated as the default UI/CRUD surface.

## 2026-03-07: Optimistic create UX redesign audit

-   Existing optimistic create/copy behavior is intentionally immediate in cache **and** immediate in presentation: `ItemCard`, `FlowListTable`, and `CustomizedDataGrid` all react to `__pending` right away instead of deferring visual feedback until user interaction.
-   `MetahubList` and `ApplicationList` table name cells use direct `Link` rendering, so pending entities in those views do not inherit the shared pending-navigation guard behavior.

## 2026-03-04: Codename QA closure follow-up

-   Research outcome implemented: codename retry policy standardized across backend domains using shared constants.
-   No unresolved blocker from this research thread remains.

## 2026-02-10: Application Runtime 404 on Checkbox Update

-   Root cause: runtime update requests did not include `catalogId`, so backend defaulted to the first catalog by codename and returned 404 (row not found) for other catalogs.
-   Fix: include `catalogId` in runtime cell update payloads to target the correct runtime table.

## 2026-02-03: Display Attribute UX Fixes

-   No new external research required; changes were internal UX and default-value adjustments.

## Database pool monitoring (2026-01-31)

### Notes

-   Supabase Pool Size observed at 15 connections for the project tier.
-   Error logging now includes pool state metrics to diagnose exhaustion events.

## schema-ddl cleanup follow-up (2026-01-19)

### Notes

---

-   Parameterized statement_timeout in `@universo-react/schema-ddl` locking helper to avoid raw interpolation
-   Updated tests to use naming utilities directly

## RLS QueryRunner freeze investigation (2026-01-11)

### Observations

### Code audit (createQueryRunner call sites)

### Current hypothesis

---

-   UI can appear to “freeze” after create operations until server restart; server logs show repeated RLS middleware activity (QueryRunner create/connect).
-   The middleware cleanup is now guarded to run once per request to reduce cleanup races.
