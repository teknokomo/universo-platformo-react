# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: PR Review Follow-up For GH753 - Completed 2026-04-07

- Goal status: bot-review follow-up is implemented and validated on `feature/gh752-general-catalog-layouts`; the remaining step is only to push the ready commit into PR #753.
- Review triage result: accepted fixes were limited to real seams only: malformed EN/RU guide frontmatter, stale Common/General wording across user-facing docs, internal `GeneralPage` naming drift, and duplicated metahub count queries that skipped the branch active-row predicate.
- Code/doc closure: Common/Common -> Layouts terminology now matches the shipped UI throughout the touched docs, catalog-layout guides no longer describe the removed catalog fallback runtime-settings contract, and metahub summary counts now use one filtered aggregate query per branch schema instead of two separate scans.
- Validation evidence: targeted `@universo/metahubs-frontend` tests passed (`4/4`), targeted `@universo/metahubs-backend` metahubs routes passed (`51/51`, `4 skipped`), edited EN/RU docs kept exact line-count parity, and the canonical root `pnpm build` completed successfully (`30 successful`, `25 cached`, `1m28s`).
- Residual note: a full `@universo/metahubs-frontend` package test attempt still exposes unrelated pre-existing `MetahubMigrations.test.tsx` failures caused by an incomplete `@universo/template-mui` mock missing `PAGE_CONTENT_GUTTER_MX`; this follow-up intentionally did not broaden scope into that existing test debt.
- Next workflow step: push the follow-up commit to PR #753 and wait for the next review round; no active code blocker remains inside the accepted PR-review scope.

## Recently Completed Context

- The 2026-04-07 PR-review follow-up now sits on top of the earlier layout-owned behavior closure: docs/user terminology match the shipped Common page, backend metahub summary counts are active-row-safe, and the focused regression/build evidence is green.
- The prior 2026-04-07 snapshot-hash remediation remains valid: canonical publication hash/checksum normalization now covers `scripts`, `catalogLayouts`, and `catalogLayoutWidgetOverrides`, and the catalog-layout docs match the shipped inherited-widget contract.
- The earlier 2026-04-06 QA regression sweep also remains valid: the shared catalog dialog helper/export seam, Common -> Layouts header-mode drift, and backend undefined-JSON update binding were already closed before this narrower layout-owned behavior cleanup.

## Key Architecture Decisions (Revised)

1. **Common Section**: Tabbed page (`GeneralPage.tsx`) following the `SettingsPage` single-shell pattern with `PAGE_TAB_BAR_SX`, first tab = "Layouts". The shipped product wording is `Common` / `Общие`, the real menu item is `metahub-common`, and the route contract now lives under `/common`. `GeneralPage` still owns the only `MainCard`/`ViewHeader` shell, and embedded tabs must reuse shell-less content rather than mount a second standalone page shell.
2. **Catalog Layout Model**: Sparse overlay/inheritance — each catalog layout stores `base_layout_id`, inherited-widget deltas in `_mhb_catalog_widget_overrides`, and catalog-owned widgets in the existing `_mhb_widgets` table.
3. **Multiple Catalog Layouts**: Full CRUD on `_mhb_layouts` with `catalog_id`; is_default + is_active per catalog scope.
4. **No separate layouts menu item**: Layouts only accessible via General section tab.
5. **No platform migration**: DB will be recreated; direct schema update in systemTableDefinitions.ts.
6. **Runtime remains flattened**: publication/sync materializes catalog layouts into ordinary snapshot / `_app_layouts` / `_app_widgets` rows; no runtime override table.
7. **Catalog layout behavior config**: the selected layout owns `showCreateButton`, `searchMode`, and create/edit/copy surface settings. These reuse the existing catalog runtime setting shape/enums and live in layout `config` JSONB as a nested behavior block rather than a new standalone schema family. The global layout is the default catalog baseline until a catalog-specific layout exists; catalog object `runtimeConfig` is no longer the canonical behavior source, and catalog CRUD/API contracts no longer accept or return that legacy field.
8. **UI reuse**: extract and reuse layout list/detail primitives from existing `LayoutList`/`LayoutDetails` instead of building a new mini-list/component family; for embedded reuse, expose a shell-less content layer, keep the standalone page wrapper as a thin public-route shell, and let the shared header own adaptive embedded search behavior.

## Why This Work Exists

- Currently layouts are only metahub-global, and users cannot customize layouts per catalog.
- The sidebar needs a dedicated `Common` / `Общие` grouping section so layouts are no longer exposed as a flat standalone top-level item.
- The catalog runtimeConfig overlay alone is insufficient for full per-catalog layout customization (only show/hide flags, no zone-widget composition).
- A sparse overlay model preserves inheritance of global widget config while allowing catalog-specific widget ownership and reordering without duplicating the entire global layout.

## Final Delivered Contract

- Catalog-layout copy preserves `catalog_id`, `base_layout_id`, catalog-owned widgets, and sparse inherited overrides through backend copy flows, including deactivate-all copy paths.
- Newly created catalog layouts inherit the selected base global layout config while stripping widget-visibility booleans from stored catalog config, and inherited widget config keeps flowing from the base layout until a specific delta is authored.
- Inherited catalog widgets now expose `isInherited`, remain draggable/toggleable, and fail closed on config edits, deletion, or direct reassignment.
- Snapshot export and application sync now flatten catalog layouts into ordinary runtime layout/widget rows while ignoring inherited config overrides and reconstructing dashboard widget-visibility booleans from effective widget placement, so runtime always materializes inherited widgets from base widget config.
- Implicit runtime startup catalog resolution now inspects only the global default or active runtime layout when deriving a menu-bound startup catalog; catalog-scoped runtime layouts participate only when a catalog is explicitly requested.
- Layout authoring UI now treats `permissions.manageMetahub` as the single frontend mutation gate for list and detail surfaces, leaving read-only inspection intact without exposing write affordances that would only fail at the backend.
- The Common page now follows the shipped single-shell contract: `GeneralPage` owns the top-level `MainCard`, while `LayoutListContent` provides shell-less layouts CRUD/search/dialog content with `renderPageShell={false}` for the embedded Layouts tab and the default `LayoutList` wrapper preserves standalone route behavior.
- Shared entity settings dialogs now rely on the same full action context as list-origin dialogs, so Scripts and catalog Layout tabs stay consistent across both top-level lists and nested `Settings` entrypoints.
- The catalog dialog no longer exposes a legacy fallback-runtime form, and catalog create/edit/copy payloads no longer serialize `runtimeConfig`; catalog runtime create/edit/copy behavior is edited only through layout details, with global layouts defining the default baseline and catalog layouts defining overrides.
- The metahubs catalog controller now rejects legacy `runtimeConfig` input on create/update/copy, strips stale persisted `config.runtimeConfig` during unrelated update/copy flows, and no longer returns `runtimeConfig` in catalog responses, so layout-owned behavior cannot silently drift back into the catalog object contract.
- The regenerated self-hosted fixture now contains a dedicated Settings catalog layout override, and imported fixture verification proves both the self-hosted and quiz snapshots still restore, publish, create applications, and run in the browser.

## Latest Validation

- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/metahubs/ui/__tests__/actionsFactories.test.ts` passed (`8/8`).
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/catalogsRoutes.test.ts` passed (`31/31`).
- `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts` passed (`51/51`).
- `pnpm exec eslint packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogActions.tsx packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogList.tsx packages/metahubs-frontend/base/src/domains/catalogs/ui/catalogListUtils.ts packages/metahubs-frontend/base/src/domains/metahubs/ui/__tests__/actionsFactories.test.ts packages/metahubs-frontend/base/src/types.ts packages/metahubs-backend/base/src/domains/catalogs/controllers/catalogsController.ts packages/metahubs-backend/base/src/tests/routes/catalogsRoutes.test.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts` completed with `0` errors (warnings only on pre-existing test `any` usage and one existing hook-deps warning outside this remediation logic).
- `pnpm build` passed successfully (`30 successful`, `28 cached`, `1m8.073s`).

## Immediate Next Steps

- Push the ready follow-up commit to PR #753.
- Wait for QA review or the next user-directed implementation wave.
- Reopen this context only if a fresh browser validation, review finding, or follow-up regression creates a new active blocker.

## References

- [tasks.md](tasks.md)
- [Plan](plan/general-section-catalog-layouts-plan-2026-04-06.md)
- [Creative](creative/creative-general-section-layout-model.md)
- [progress.md](progress.md)
- [systemPatterns.md](systemPatterns.md)
- [techContext.md](techContext.md)
