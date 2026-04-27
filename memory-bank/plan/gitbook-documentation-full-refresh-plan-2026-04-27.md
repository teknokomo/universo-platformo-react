# GitBook Documentation Full Refresh Plan

> **Date**: 2026-04-27  
> **Scope**: `docs/en/**`, `docs/ru/**`, GitBook screenshots, documentation validation tooling, and adjacent README truth sources  
> **Mode**: implemented and QA-remediated; completion is tracked in `memory-bank/tasks.md` and `memory-bank/progress.md`.

## Overview

The current GitBook documentation must be treated as a product surface, not as a historical archive. The project has moved from the Flowise-derived canvas era through the removed hardcoded Hub/Catalog/Set/Enumeration model into the current entity-first metahub architecture. Any documentation that still describes removed modules, compatibility-era route ownership, or transitional V2 behavior should be deleted or rewritten instead of preserved as legacy wording.

The English documentation remains the canonical source. The Russian documentation must mirror the English structure, page coverage, heading depth, examples, screenshots, and validation surface while translating user-facing terms whenever a natural Russian term exists.

## Original Findings And Closure Status

- The current code and package READMEs already describe the entity-first contract:
  standard kinds are direct entity type presets, `empty.template.ts` exists, `EntityTypeUIConfig.resourceSurfaces` exists, and resource surface labels are persisted localized metadata.
- The current backend package tree confirms the entity-owned model:
  `packages/metahubs-backend/base/src/domains/entities/**` owns entity routes and metadata seams, while the old hardcoded top-level domain folders for `catalogs`, `attributes`, `enumerations`, `elements`, `hubs`, `sets`, and `constants` are not present as active domain directories.
- `docs/en` and `docs/ru` now have matching GitBook page trees and are checked as 78 EN/RU page pairs.
- Line-count parity, heading count parity, code fence parity, list parity, table parity, and image parity are now enforced by `tools/docs/check-i18n-docs.mjs`.
- RU metahub front matter issues were fixed and the checker now fails malformed front matter.
- `docs/en/architecture/backend.md` and the RU counterpart were rewritten around the current entity-owned route model instead of old hardcoded domain families.
- Transitional vocabulary such as `legacy`, `V2`, `catalog-compatible`, `legacy-compatible`, `custom.*-v2`, and Flowise-derived wording was removed from public GitBook pages.
- Outdated roadmap and development-plan content was removed from public GitBook pages while roadmap materials are being reworked.
- Previously unlinked public GitBook pages were added to the locale `SUMMARY.md` files, and duplicate/missing summary coverage is now checked.
- GitBook is already configured externally to use separate locale roots. Keep the current repository layout with independent `docs/en/README.md` + `docs/en/SUMMARY.md` and `docs/ru/README.md` + `docs/ru/SUMMARY.md`; do not add `.gitbook.yaml`, `book.json`, or `LANGS.md` in this documentation refresh unless the publishing setup changes later.
- Current screenshots exist in both locales, compatibility-era screenshot names have been removed from GitBook assets, and old `metahub-catalogs-v2-parity` visual baselines were removed from the documentation screenshot path.
- The current GitBook pages now reference 72 local images per locale across 45 pages, all referenced image files exist, and the documentation generators reproduce the current EN/RU UI assets.
- Existing Playwright generators are the right base for screenshot refresh:
  `tools/testing/e2e/specs/generators/docs-entity-screenshots.spec.ts` and
  `tools/testing/e2e/specs/generators/docs-quiz-tutorial-screenshots.spec.ts`.
- Context7 Playwright documentation confirms the desired automation direction:
  use semantic locators, CLI/browser screenshots, auto-waiting assertions, traces, and deterministic isolated flows rather than manual captures.
- Official GitBook documentation confirms that Git Sync content uses a configurable root plus `readme` and `summary` paths, that `SUMMARY.md` mirrors the table of contents, and that the same Markdown file should not be referenced twice in one summary. GitBook's documentation-structure guidance also recommends workflow-oriented information architecture, H1-H4 consistency, explicit cross-links, limited nesting, and keeping key facts in text rather than only in screenshots.
- `I18N_SCOPE=all pnpm docs:i18n:check` is now scoped to the GitBook locale roots and passes as a trustworthy final gate.

## Source Of Truth

Use these sources to decide whether documentation text is current:

- Root README files:
  `README.md`, `README-RU.md`
- Package README files:
  `packages/metahubs-frontend/base/README.md`,
  `packages/metahubs-backend/base/README.md`,
  `packages/applications-frontend/base/README.md`,
  `packages/applications-backend/base/README.md`,
  `packages/universo-types/base/README.md`,
  `packages/universo-template-mui/base/README.md`,
  `packages/apps-template-mui/README.md`,
  `packages/universo-i18n/base/README.md`
- Current implementation:
  `packages/metahubs-backend/base/src/domains/templates/data/**`,
  `packages/metahubs-backend/base/src/domains/entities/**`,
  `packages/metahubs-frontend/base/src/domains/entities/**`,
  `packages/metahubs-frontend/base/src/domains/shared/**`,
  `packages/applications-backend/base/src/routes/sync/**`,
  `packages/applications-frontend/base/src/**`
- E2E and generator flows:
  `tools/testing/e2e/specs/flows/**`,
  `tools/testing/e2e/specs/generators/**`,
  `tools/testing/e2e/support/backend/api-session.mjs`
- Memory Bank:
  `memory-bank/tasks.md`,
  `memory-bank/progress.md`,
  `memory-bank/systemPatterns.md`,
  `memory-bank/techContext.md`

## Affected Areas

- GitBook configuration decision:
  repository-local `.gitbook.yaml` / `LANGS.md` if the project decides to make locale roots explicit in Git instead of relying on external GitBook settings.
- GitBook navigation:
  `docs/en/SUMMARY.md`, `docs/ru/SUMMARY.md`
- GitBook pages:
  `docs/en/**`, `docs/ru/**`
- GitBook assets:
  `docs/en/.gitbook/assets/**`, `docs/ru/.gitbook/assets/**`
- Screenshot generators:
  `tools/testing/e2e/specs/generators/docs-entity-screenshots.spec.ts`,
  `tools/testing/e2e/specs/generators/docs-quiz-tutorial-screenshots.spec.ts`
- Documentation validation:
  `tools/docs/check-i18n-docs.mjs`
- Optional adjacent references:
  package READMEs and `tools/testing/e2e/README.md` only when they contradict the final GitBook text.

## Phase 0: GitBook Locale-Root Contract

- [x] Preserve the current externally configured GitBook publishing model:
  `docs/en` and `docs/ru` are separate locale roots, each with its own `README.md` and `SUMMARY.md`.
- [x] Do not introduce repository-local GitBook config files in this refresh; the accepted contract is separate locale roots managed by the existing GitBook setup.
- [x] Validate each locale root independently, then validate EN/RU structural parity across the two roots.
- [x] Ensure every page intended for publication is linked from the appropriate `SUMMARY.md`; unlinked Markdown pages must either be added to navigation or moved out of public GitBook source.
- [x] Verify `SUMMARY.md` contains no duplicate page references and that each title matches the intended sidebar title for that locale.
- [x] Keep GitBook nesting shallow: prefer major sections plus one subpage level unless a product workflow genuinely needs deeper hierarchy.

## Phase 1: Documentation Inventory And Rewrite Map

- [x] Build a full inventory table of every `docs/en/**/*.md` page and its `docs/ru/**/*.md` counterpart.
- [x] For each page, classify it as:
  keep with light edits, rewrite fully, merge into another page, or delete from GitBook navigation.
- [x] Record every page that mentions removed or transitional concepts:
  Flowise, legacy workspace taxonomy, V2, catalog-compatible, legacy-compatible, old top-level standard-kind routes, old Common/General naming, and hardcoded Hub/Catalog/Set/Enumeration module ownership.
- [x] Record every page that contains outdated development-plan content:
  roadmap, planned layer, planned role, planned expansion, future capability, future client, expected to, eventually, intended future behavior, and the Russian equivalents.
- [x] Record every Russian page with avoidable English prose or untranslated terms.
- [x] Record every page with malformed or inconsistent front matter.
- [x] Record every image reference and map it to the generator that should own it.
- [x] Decide the final page taxonomy before editing text so `SUMMARY.md` changes happen once.

## Phase 2: Canonical Information Architecture

- [x] Keep GitBook concise but complete:
  getting started, platform concepts, metahubs, applications, architecture, API reference, guides, contributing.
- [x] Make the metahub section explain the current product flow:
  create metahub, choose template, model entity types, create design-time instances, author resources, publish, create application, connect publication, sync runtime schema, open runtime.
- [x] Make Entities the central metahub authoring model:
  standard kinds are presets, custom types use the same registry, resource surfaces are data-driven, and runtime visibility follows publication sync.
- [x] Remove public documentation about old development plans while roadmap materials are being updated. The GitBook can mention only current shipped behavior, current alpha limitations, and current operational constraints.
- [x] Decide whether old pages should remain separate:
  shared attributes/constants/values can stay as focused reference pages only if rewritten around entity resource surfaces instead of catalog/set/enumeration compatibility.
- [x] Remove or rewrite pages whose main purpose was explaining deleted route families or compatibility layers.
- [x] Remove or rewrite pages whose main purpose is a not-yet-current roadmap layer:
  `platform/metaverses.md`, planned Kiberplano/MMOOMM platform layers, future analytics layers, planned space-builder generation assistance, and future UPDL coordination claims should not remain as current GitBook content unless rewritten as current implementation boundaries.
- [x] Ensure every GitBook page has a clear role:
  concept page, task guide, architecture reference, API reference, or testing/contributing page.

## Phase 3: English Rewrite

- [x] Rewrite English pages first.
- [x] Delete stale text instead of qualifying it with historical warnings.
- [x] Use current product vocabulary consistently:
  Metahub, Entity Type, Entity Instance, Resource Surface, Resources Workspace, Publication, Application, Connector, Runtime Schema, Shared Layout, Shared Script.
- [x] Avoid obsolete wording:
  old hardcoded Hub/Catalog/Set/Enumeration modules, compatibility aliases, V2, legacy top-level routes, and Flowise-derived behavior.
- [x] Avoid outdated roadmap wording:
  planned layers, future features, long-term goals, expected capabilities, upcoming work, and speculative integration promises.
- [x] Add concrete task flows with exact current route concepts and UI labels.
- [x] Add short architectural diagrams in Markdown where they clarify ownership.
- [x] Make API reference pages match actual REST behavior and OpenAPI generation.
- [x] Make architecture pages match package boundaries, SQL-first backend rules, request-scoped executors, TanStack Query usage, shared UI packages, and current template packages.

### Example English Page Pattern

```md
# Entity Types

Entity types define the design-time objects available inside one metahub.
Built-in types such as Tree Entities, Linked Collections, Value Groups, and Option Lists are presets stored in the same entity type registry as user-defined types.

## Typical Flow

1. Open the metahub.
2. Open Entities.
3. Create an entity type from a preset or from an empty type.
4. Configure components and resource surfaces.
5. Create instances.
6. Publish the metahub when the model is ready for application sync.

## Runtime Boundary

Publishing does not mutate application runtime tables by itself.
Runtime schema changes are materialized when an application connector syncs from a publication.
```

## Phase 4: Russian Mirror Rewrite

- [x] Translate from the finished English pages, not from the current Russian pages.
- [x] Preserve the same file structure, heading order, table structure, list count, code fence count, image count, and link targets.
- [x] Translate terms where natural Russian equivalents exist:
  Resources Workspace -> Рабочее пространство ресурсов,
  Entity Type -> Тип сущности,
  Entity Instance -> Экземпляр сущности,
  Resource Surface -> Ресурсная поверхность or Поверхность ресурса, choose one and use consistently,
  Publication -> Публикация,
  Runtime Schema -> Рантайм-схема,
  Shared Layout -> Общий макет.
- [x] Keep code identifiers, route paths, package names, API paths, and configuration keys in English.
- [x] Replace avoidable English fragments in Russian prose:
  `target object`, `shared row`, `runtime sections`, `authoring flow`, `builder`, `rollout`, `focused tests`, `browser proof`.
- [x] Replace avoidable roadmap/future Russian wording:
  `в планах`, `планируемый слой`, `будущие сценарии`, `ожидается`, `долгосрочная цель`, unless the phrase describes the current documentation rewrite plan outside public GitBook pages.
- [x] Keep Russian screenshots visually Russian by running the generator under Russian browser preferences.

### Example Russian Mirror Pattern

```md
# Типы сущностей

Типы сущностей определяют проектные объекты, доступные внутри одного метахаба.
Встроенные типы, например древовидные сущности, связанные коллекции, группы значений и списки вариантов, являются пресетами и хранятся в том же реестре типов сущностей, что и пользовательские типы.

## Типичный сценарий

1. Откройте метахаб.
2. Откройте раздел «Сущности».
3. Создайте тип сущности из пресета или из пустого типа.
4. Настройте компоненты и ресурсные поверхности.
5. Создайте экземпляры.
6. Опубликуйте метахаб, когда модель готова к синхронизации с приложением.

## Граница рантайма

Публикация сама по себе не изменяет рантайм-таблицы приложения.
Изменения рантайм-схемы материализуются при синхронизации коннектора приложения с публикацией.
```

## Phase 5: Screenshot Strategy

- [x] Replace compatibility-era image names with final product names where useful:
  for example, `catalog-compatible-edit-general-panel.png` should become an entity/resource-surface name if the page still needs that image.
- [x] Keep English and Russian assets in parallel directories:
  `docs/en/.gitbook/assets/**`,
  `docs/ru/.gitbook/assets/**`.
- [x] Update `docs-entity-screenshots.spec.ts` so it captures only current UI states and uses final route names, final asset names, and final product vocabulary.
- [x] Update `docs-quiz-tutorial-screenshots.spec.ts` so the quiz tutorial screenshots match current application layout, runtime, and publication flows.
- [x] Add `docs-admin-screenshots.spec.ts` so admin docs use current EN/RU browser screenshots instead of generic platform images.
- [x] Use the E2E wrapper and generator project; do not use `pnpm dev`.
- [x] Use stable Playwright patterns:
  role-based locators, test ids from existing selector contracts, web-first assertions, traces on failure, deterministic generated test data, and isolated cleanup.
- [x] Capture desktop screenshots first; add mobile screenshots only for pages where responsive behavior is central to the guide.
- [x] Review every generated image manually before accepting the diff.

## Phase 6: Page-Level Rewrite Targets

### Highest Priority

- [x] `docs/en/platform/metahubs.md` and `docs/ru/platform/metahubs.md`
- [x] `docs/en/platform/metahubs/*.md` and `docs/ru/platform/metahubs/*.md`
- [x] `docs/en/guides/custom-entity-types.md` and `docs/ru/guides/custom-entity-types.md`
- [x] `docs/en/guides/general-section.md` and `docs/ru/guides/general-section.md`
- [x] `docs/en/architecture/entity-systems.md` and `docs/ru/architecture/entity-systems.md`
- [x] `docs/en/architecture/backend.md` and `docs/ru/architecture/backend.md`
- [x] `docs/en/api-reference/rest-api.md` and `docs/ru/api-reference/rest-api.md`
- [x] `docs/en/api-reference/shared-entity-overrides.md` and `docs/ru/api-reference/shared-entity-overrides.md`

### Secondary Priority

- [x] `docs/en/platform/README.md` and `docs/ru/platform/README.md`
- [x] `docs/en/platform/metaverses.md` and `docs/ru/platform/metaverses.md`
- [x] `docs/en/platform/space-builder.md` and `docs/ru/platform/space-builder.md`
- [x] `docs/en/platform/analytics.md` and `docs/ru/platform/analytics.md`
- [x] `docs/en/platform/updl/*.md` and `docs/ru/platform/updl/*.md`
- [x] `docs/en/guides/creating-application.md` and `docs/ru/guides/creating-application.md`
- [x] `docs/en/guides/application-layouts.md` and `docs/ru/guides/application-layouts.md`
- [x] `docs/en/guides/app-template-views.md` and `docs/ru/guides/app-template-views.md`
- [x] `docs/en/guides/quiz-application-tutorial.md` and `docs/ru/guides/quiz-application-tutorial.md`
- [x] `docs/en/guides/snapshot-export-import.md` and `docs/ru/guides/snapshot-export-import.md`
- [x] `docs/en/guides/browser-e2e-testing.md` and `docs/ru/guides/browser-e2e-testing.md`
- [x] `docs/en/architecture/metahub-schema.md` and `docs/ru/architecture/metahub-schema.md`
- [x] `docs/en/architecture/system-app-migration-lifecycle.md` and `docs/ru/architecture/system-app-migration-lifecycle.md`

### Broader Cleanup

- [x] Review every page under `docs/en/platform/**` and `docs/ru/platform/**` for old product taxonomy.
- [x] Review every page under `docs/en/guides/**` and `docs/ru/guides/**` for stale UI steps and screenshots.
- [x] Review every page under `docs/en/architecture/**` and `docs/ru/architecture/**` for removed package/module ownership.
- [x] Review every page under `docs/en/api-reference/**` and `docs/ru/api-reference/**` for current endpoint shapes.
- [x] Review unlisted public Markdown pages and either add them to `SUMMARY.md` or move/delete them from GitBook source.
- [x] Review `docs/README.md` itself so its principles no longer say to document planned layers while the roadmap is intentionally being removed from GitBook.

## Phase 7: Documentation Quality Bar

- [x] Each concept page must answer:
  what it is, why it exists, what owns it, where it is configured, what changes at publication/runtime boundaries, and where to go next.
- [x] Each task guide must include:
  prerequisites, exact UI path, expected result, validation step, and related pages.
- [x] Each architecture page must include:
  package ownership, data ownership, request/data flow, persistence boundary, and validation/tests.
- [x] Each API page must include:
  endpoint purpose, auth requirement, main parameters, response shape summary, error behavior, and related UI flow.
- [x] Avoid marketing-only prose inside implementation docs.
- [x] Avoid documenting implementation details that are not stable product contracts unless the page is explicitly an architecture reference.
- [x] Avoid future promises unless clearly marked as planned and not available.

## Phase 8: Validation Tooling

- [x] Improve `tools/docs/check-i18n-docs.mjs` so `I18N_SCOPE=all` becomes useful for the full GitBook tree, not only README/resource-era checks.
- [x] Scope the checker to project-owned documentation only and exclude at least:
  `node_modules`, `.backup`, generated build artifacts, `dist`, `build`, `.turbo`, and third-party template folders where README parity is not part of this task.
- [x] Add checks for:
  missing EN/RU counterparts, line count parity, heading count parity, code fence parity, bullet/table parity, image reference parity, broken local links, malformed front matter, and stale banned terms.
- [x] Add a `SUMMARY.md` coverage check:
  every public GitBook page is linked exactly once or explicitly marked as non-public.
- [x] Add a GitBook locale-root check:
  validate that `docs/en/README.md`, `docs/en/SUMMARY.md`, `docs/ru/README.md`, and `docs/ru/SUMMARY.md` exist and are treated as the two accepted publishing roots.
- [x] Add a documentation asset check:
  every referenced local image exists, and every generated image expected by the screenshot specs is referenced or intentionally archived.
- [x] Add a Russian language drift check for common avoidable English phrases in prose while ignoring code blocks, route paths, package names, and API identifiers.
- [x] Add a stale-roadmap check for public GitBook pages while the roadmap is being reworked:
  fail on `planned`, `future`, `roadmap`, `coming soon`, `eventually`, `long-term goal`, `в планах`, `планируемый`, `будущие`, and similar phrases unless explicitly allowlisted for current alpha limitations.
- [x] Ensure `pnpm docs:i18n:check` is part of the final validation.

## Phase 9: Implementation Order

- [x] Preserve the accepted separate-locale-root configuration and freeze final page taxonomy.
- [x] Update both `SUMMARY.md` files and resolve currently unlisted public pages.
- [x] Rewrite English high-priority pages.
- [x] Mirror Russian high-priority pages.
- [x] Update screenshot generators and regenerate high-priority screenshots.
- [x] Rewrite secondary pages.
- [x] Mirror Russian secondary pages.
- [x] Regenerate remaining screenshots.
- [x] Tighten validation tooling.
- [x] Run docs checks, focused E2E generators, and final build validation.
- [x] Update Memory Bank progress only after validation passes.

## Phase 10: Validation Commands

Use targeted validation first:

```bash
I18N_SCOPE=all pnpm docs:i18n:check
pnpm --filter @universo/metahubs-frontend lint
pnpm --filter @universo/metahubs-backend lint
pnpm --filter @universo/metahubs-frontend test
pnpm --filter @universo/metahubs-backend test
```

Use the E2E wrapper for screenshots and product proof:

```bash
pnpm run build:e2e
node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "entity documentation screenshots"
node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "quiz tutorial screenshots"
node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "admin documentation screenshots"
```

Finish with:

```bash
pnpm build
```

## Risks And Mitigations

- **Risk**: rewriting docs before UI/screenshot truth is verified can preserve wrong behavior.
  **Mitigation**: run or update Playwright generators before accepting screenshot-backed guide text.
- **Risk**: Russian docs can match file names but diverge in structure or content.
  **Mitigation**: strengthen `docs:i18n:check` and translate from the final English pages only.
- **Risk**: stale terms can be legitimate in code identifiers but wrong in prose.
  **Mitigation**: banned-term checks must ignore code blocks and allow explicitly listed API identifiers.
- **Risk**: screenshots may become stale immediately after UI polish.
  **Mitigation**: keep screenshots tied to generator specs and avoid manual-only assets.
- **Risk**: old docs explain removed flows that still have compatibility redirects.
  **Mitigation**: document only the canonical route and mention redirects only if they are a supported public contract.

## Acceptance Criteria

- GitBook publishing configuration remains unchanged:
  `docs/en` and `docs/ru` are treated as separate externally configured locale roots with independent `README.md` and `SUMMARY.md` files.
- Every public GitBook page is linked from the correct `SUMMARY.md`, and there are no duplicate references in one summary.
- All GitBook pages have valid front matter when front matter is used.
- No GitBook page presents Flowise-derived, hardcoded standard-kind, or V2 compatibility-era behavior as current product truth.
- No GitBook page preserves outdated roadmap or development-plan content while those plans are being reworked.
- English and Russian documentation have matching structure and comparable volume.
- Russian prose is translated except for code identifiers, route paths, package names, API names, and intentionally untranslated product names.
- All referenced local screenshots exist in both locales and were generated from the current UI.
- The documentation explains the actual metahub-to-application flow:
  template -> entity types -> instances/resources -> publication -> application connector -> runtime schema.
- `I18N_SCOPE=all pnpm docs:i18n:check` passes after tooling is strengthened.
- Documentation screenshot generators pass on the E2E wrapper without `pnpm dev`.
- Final `pnpm build` passes.

## Resolved Implementation Decisions

- No open GitBook publishing-model decision remains for this refresh:
  keep separate locale roots under `docs/en` and `docs/ru`.
- `Resource Surface` is translated consistently through the final Russian pages as a resource-surface concept while code identifiers remain in English.
- Shared attributes, constants, values, scripts, exclusions, and behavior settings remain separate focused reference pages because they map to separate current authoring surfaces.
- Pages about Kiberplano, MMOOMM, metaverses, analytics, space-builder, and UPDL were rewritten as current implementation boundaries instead of roadmap promises.
- Screenshot coverage remains desktop-first for this pass; all retained screenshots are tied to Playwright documentation generators.
- Redirects and old `/layouts` compatibility behavior are omitted from public GitBook pages unless a current canonical route requires them.
