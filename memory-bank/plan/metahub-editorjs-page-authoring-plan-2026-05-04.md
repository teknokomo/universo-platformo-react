# Plan: Editor.js Block Authoring For Metahub Pages

## Overview

Add a real block editor for Entity instances that enable the `blockContent` component, starting with the standard `page` metadata type in the Basic metahub template. The implementation must preserve the existing entity architecture: the Entity component manifest defines whether block content is available, Page is just the first standard type that enables it, and published applications continue to render safe normalized block data without loading Editor.js.

The current state already has:

-   `blockContent` in the shared Entity component manifest.
-   `pageBlockContentSchema` and `runtimePageBlockSchema` in `@universo/types`.
-   Runtime rendering in `packages/apps-template-mui/src/dashboard/components/PageBlocksView.tsx`.
-   A temporary JSON `TextField` authoring surface in `EntityInstanceListContent`.

The target state is:

-   Metahub Page cards open a detail route, not the edit dialog.
-   Page detail has a proper `Content` authoring surface with Editor.js.
-   Entity properties remain editable through the existing shared dialog/menu pattern.
-   The editor is available for any Entity type with `components.blockContent.enabled === true`, not hardcoded only for `page`.

## Research Findings

-   Official package: `@editorjs/editorjs` is current and suitable as the source of truth. `npm view` on 2026-05-04 returned version `2.31.6`, Apache-2.0, modified 2026-04-07.
-   Official block tools are separate packages. Current checked versions include `@editorjs/header@2.8.8`, `@editorjs/list@2.0.9`, `@editorjs/quote@2.7.6`, `@editorjs/table@2.4.5`, `@editorjs/embed@2.8.0`, `@editorjs/delimiter@1.4.2`, `@editorjs/image@2.10.3`.
-   The old React wrappers `@react-editor-js/core` and `react-editor-js` are unofficial and stale. `npm view` returned version `2.1.0`, modified 2022-07-02. Do not use them as the platform integration layer.
-   Editor.js official documentation confirms the core model: initialize `new EditorJS({ holder, tools, data, onChange })`, connect tools through the `tools` config, save with `editor.saver.save()`, and clean up with `editor.destroy()`.
-   React integration should therefore be a small local adapter around the official Editor.js core, with careful React 18 StrictMode cleanup.
-   Editor.js tool output must not be persisted directly. The current `@editorjs/list` 2.x package saves list items as nested objects with `{ content, meta, items }`, while the existing runtime schema accepts a flat `items: string[]` contract. The implementation must include per-tool adapters and tests with real saved payloads.
-   Editor.js text fields can include sanitized inline markup depending on tool and inline-toolbar configuration. This phase should store canonical plain text only, disable inline tools that emit HTML, and reject or strip unexpected HTML before server persistence. Do not rely on React escaping as the only long-term safety boundary.
-   The backend already has a generic `validateEntityConfigForComponents()` boundary for `config.blockContent`. The Editor.js implementation must reuse and harden this server-side validation instead of adding only frontend validation.

Reference links:

-   Editor.js getting started: https://editorjs.io/getting-started/
-   Editor.js Context7 library: `/codex-team/editor.js`
-   npm packages: https://www.npmjs.com/package/@editorjs/editorjs, https://www.npmjs.com/package/@react-editor-js/core

## Affected Areas

| Area                                         | Planned changes                                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm-workspace.yaml`                        | Add Editor.js core/tool versions to the central catalog.                                                                                                         |
| `packages/universo-template-mui`             | Add a domain-neutral `EditorJsBlockEditor` shared component, exported from the package root.                                                                     |
| `packages/universo-types`                    | Keep and harden Editor.js-compatible block schemas, add editor config normalization types only if needed.                                                        |
| `packages/universo-utils`                    | Add shared normalization/sanitization helpers only if they are needed by more than one package; keep server enforcement in backend routes/services.              |
| `packages/metahubs-frontend`                 | Add Entity block-content detail route, use the shared editor, remove JSON authoring as the default Page UX, wire save/query invalidation through TanStack Query. |
| `packages/universo-core-frontend`            | Register new entity-owned content route.                                                                                                                         |
| `packages/metahubs-backend`                  | No new table should be required for Page `objectConfig` storage; add route/service tests around update validation and snapshot preservation if touched.          |
| `packages/apps-template-mui`                 | Keep runtime renderer; no Editor.js dependency should be added to published runtime unless a separate runtime editing feature is requested later.                |
| `packages/universo-i18n` and package locales | Add EN/RU keys for editor UI, Page detail route, save states, validation, and fallback JSON view.                                                                |
| `docs/` and package READMEs                  | Document Page content authoring, block component configuration, supported blocks, and runtime rendering boundary.                                                |
| `tools/testing/e2e`                          | Add browser proof for editor route, screenshots, save/reload, publication/runtime render, and regression checks for no raw JSON default UX.                      |

## Architecture Decisions

### Decision 1: Use official Editor.js core, not React wrappers

Use `@editorjs/editorjs` directly and wrap it in our own React component. This avoids stale wrapper behavior and gives us explicit lifecycle control.

Catalog additions:

```yaml
catalog:
    '@editorjs/editorjs': ^2.31.6
    '@editorjs/header': ^2.8.8
    '@editorjs/list': ^2.0.9
    '@editorjs/quote': ^2.7.6
    '@editorjs/table': ^2.4.5
    '@editorjs/embed': ^2.8.0
    '@editorjs/delimiter': ^1.4.2
    '@editorjs/image': ^2.10.3
```

Install these only as direct dependencies of `@universo/template-mui` if the shared editor lives there.

### Decision 2: Place the editor adapter in `@universo/template-mui`

The editor component should be domain-neutral and reusable:

-   It receives `value`, `allowedBlockTypes`, `readOnly`, `locale`, `labels`, `onChange`, `onReady`, and `onValidationError`.
-   It emits normalized Editor.js-compatible output.
-   It does not know about metahubs, pages, applications, LMS, or routes.
-   It is imported by `@universo/metahubs-frontend` only where the Entity type enables `blockContent`.

This keeps metahub business logic in `metahubs-frontend` and generic presentation/lifecycle logic in the shared UI package.

### Decision 3: Published runtime stays renderer-only

`packages/apps-template-mui` should not load Editor.js for viewing published pages. It should keep using `PageBlocksView` and `runtimePageBlockSchema` because:

-   Runtime is safer when it renders a constrained schema, not arbitrary editor plugins.
-   Runtime bundles stay smaller.
-   The authoring editor and runtime renderer have different security responsibilities.

### Decision 4: Page detail route is generic `blockContent` route

Do not create a one-off `/pages/:id` route. Use the existing entity-owned route shape:

```text
/metahub/:metahubId/entities/:kindKey/instance/:entityId/content
```

This route should render for any Entity type whose persisted `components.blockContent.enabled` is true. The standard `page` kind is only the first built-in consumer.

### Decision 5: Card click opens detail route, menu action edits properties

For `blockContent` entity kinds:

-   Clicking a card/table row navigates to the content detail route.
-   Three-dot menu keeps actions such as `Open`, `Edit properties`, `Copy`, `Delete`.
-   The edit dialog should edit metadata properties and automation tabs, not be the main content editor.
-   Page creation should create the Page and then optionally navigate to the content editor.

### Decision 6: Persist a canonical safe block schema, not raw Editor.js `OutputData`

Editor.js is the authoring UI, not the storage contract. Saved editor data must pass through this pipeline before persistence:

```text
Editor.js OutputData
  -> per-tool adapter
  -> plain-text and URL normalization
  -> pageBlockContentSchema.parse()
  -> backend validateEntityConfigForComponents()
  -> _mhb_objects.config.blockContent
```

Rules for the first implementation:

-   `paragraph`, `header`, `quote`, `table`, and list item content are stored as plain text, not HTML.
-   Inline toolbar tools that emit HTML are disabled until a first-class sanitized inline-mark model is designed.
-   `raw`, `code`, arbitrary HTML, unsafe URLs, protocol-relative URLs, and unknown tools are rejected.
-   `@editorjs/list` 2.x output is configured with `maxLevel: 1` for this phase and adapted from `{ content, meta, items }[]` to the existing flat `items: string[]` runtime contract. Nested lists can be added later only with a runtime schema and renderer extension.
-   Image authoring is URL-only and optional until a tested URL adapter is in place; authenticated uploads are a separate storage project.

### Decision 7: Reuse existing Entity UI primitives

The content detail page must reuse the existing metahub shell and shared UI primitives:

-   `ViewHeaderMUI`, `ItemCard`, `FlowListTable`, `PaginationControls`, `BaseEntityMenu`, `EntityFormDialog`, and `ConflictResolutionDialog`.
-   Existing Entity query/mutation hooks and `invalidateEntitiesQueries`.
-   Existing automation tabs for scripts/actions/events when metadata editing opens in the properties dialog.

Do not introduce a Page-only card system, table system, sidebar, breadcrumb implementation, or action menu.

## Implementation Plan

### Phase 1: Dependency and shared editor foundation

-   [ ] Add Editor.js packages to `pnpm-workspace.yaml` catalog and `packages/universo-template-mui/base/package.json`.
-   [ ] Add a shared `components/block-editor/EditorJsBlockEditor.tsx` in `@universo/template-mui`.
-   [ ] Export `EditorJsBlockEditor` and its types from `packages/universo-template-mui/base/src/components/index.ts` and root index.
-   [ ] Use dynamic imports inside the component so Editor.js code loads only when the editor is mounted.
-   [ ] Make lifecycle StrictMode-safe: create once per holder, await `isReady`, guard unmount races, destroy only after ready, and clear refs.
-   [ ] Add a fallback `JsonBlockContentEditor` behind a developer/debug toggle or error boundary, not as the default UX.

Example lifecycle pattern:

```tsx
type EditorJsBlockEditorProps = {
    value: PageBlockContent
    allowedBlockTypes: readonly string[]
    readOnly?: boolean
    locale: 'en' | 'ru' | string
    onChange: (nextValue: PageBlockContent) => void
    onValidationError?: (message: string) => void
}

export function EditorJsBlockEditor(props: EditorJsBlockEditorProps) {
    const holderRef = useRef<HTMLDivElement | null>(null)
    const editorRef = useRef<EditorJS | null>(null)

    useEffect(() => {
        let cancelled = false

        async function mountEditor() {
            const [{ default: EditorJS }, tools] = await Promise.all([import('@editorjs/editorjs'), import('./editorJsTools')])

            if (!holderRef.current || cancelled) return

            const editor = new EditorJS({
                holder: holderRef.current,
                data: toEditorJsOutputData(props.value),
                tools: buildEditorJsTools(tools, props.allowedBlockTypes, props.locale),
                readOnly: props.readOnly,
                i18n: buildEditorJsI18n(props.locale),
                async onChange(api) {
                    const saved = await api.saver.save()
                    const normalized = normalizeEditorJsSavedData(saved)
                    props.onChange(normalized)
                }
            })

            await editor.isReady

            if (cancelled) {
                editor.destroy()
                return
            }

            editorRef.current = editor
        }

        void mountEditor()

        return () => {
            cancelled = true
            const editor = editorRef.current
            editorRef.current = null
            if (editor) {
                void editor.isReady.then(() => editor.destroy()).catch(() => undefined)
            }
        }
    }, [props.allowedBlockTypes, props.locale, props.readOnly])

    return <Box ref={holderRef} data-testid='editorjs-block-editor' />
}
```

### Phase 2: Tool configuration and safe data normalization

-   [ ] Create `editorJsTools.ts` in `@universo/template-mui` with a strict allowlist for supported tools.
-   [ ] Initially support only the block types already accepted by `runtimePageBlockSchema`: `paragraph`, `header`, `list`, `quote`, `table`, `embed`, `image`, `delimiter`.
-   [ ] Do not enable `raw`, `code`, custom HTML, or arbitrary plugin tools.
-   [ ] Configure text-capable tools without inline toolbars in this phase so saved text remains plain text.
-   [ ] Configure `@editorjs/list` with `maxLevel: 1` and only `ordered` / `unordered` styles; do not enable checklist until the runtime schema has a checklist contract.
-   [ ] Add per-tool adapter functions:
    -   `adaptParagraphBlock()`
    -   `adaptHeaderBlock()`
    -   `adaptListBlock()`
    -   `adaptQuoteBlock()`
    -   `adaptTableBlock()`
    -   `adaptEmbedBlock()`
    -   `adaptImageBlock()`
    -   `adaptDelimiterBlock()`
-   [ ] Normalize Editor.js `OutputData` into the existing `PageBlockContent` shape only after every block has been adapted to the canonical schema:

```ts
export function normalizeEditorJsSavedData(saved: OutputData): PageBlockContent {
    return pageBlockContentSchema.parse({
        format: 'editorjs',
        data: {
            time: Number.isFinite(saved.time) ? saved.time : Date.now(),
            version: typeof saved.version === 'string' ? saved.version : undefined,
            blocks: saved.blocks.map(adaptEditorJsBlock).filter(isRuntimePageBlock)
        }
    })
}
```

-   [ ] Add a `normalizePlainBlockText()` helper that trims control characters, enforces max length, and removes/rejects unexpected HTML tags before `pageBlockContentSchema.parse()`.
-   [ ] Preserve current runtime compatibility by keeping `normalizeRuntimePageBlocks()` able to read both root `blocks` and nested `data.blocks`.
-   [ ] Add a dedicated image plan:
    -   MVP: allow URL-only images with `http`/`https` URLs and schema validation if the official image tool can be configured without upload endpoints.
    -   If a safe URL-only image adapter is not ready, keep image blocks renderable/importable but omit image creation from the editor toolbar for the first implementation.
    -   Later: add authenticated storage/upload flow separately if required.
-   [ ] Debounce local `onChange` state updates, but save to backend only on explicit Save button click.
-   [ ] Add a dirty-state guard before navigation if content changed and was not saved.
-   [ ] Add real fixture payloads from each supported Editor.js tool to unit tests so tool package upgrades cannot silently break persistence.

### Phase 3: Entity component configurator support

-   [ ] Extend `EntitiesWorkspace` component builder UI so `blockContent` is configurable for custom Entity types, not only locked standard Page.
-   [ ] Expose `blockContent` config fields from `BlockContentComponentConfig`:
    -   storage mode, initially fixed to `objectConfig` until `recordJsonb` is implemented.
    -   default format, fixed to `editorjs`.
    -   allowed block types.
    -   max blocks.
-   [ ] Keep standard Page structure locked but readable in the configurator, consistent with other standard metadata types.
-   [ ] Ensure Basic and basic-demo Page presets continue to enable `blockContent` by default.
-   [ ] Add template validator coverage so invalid `blockContent` configs fail before seeding/import.

### Phase 4: Metahub Page/detail route

-   [ ] Add a route in `packages/universo-core-frontend/base/src/routes/MainRoutes.tsx`:

```tsx
{
  path: 'entities/:kindKey/instance/:entityId/content',
  element: <EntityBlockContentPage />
}
```

-   [ ] Export `EntityBlockContentPage` from `@universo/metahubs-frontend`.
-   [ ] Implement `EntityBlockContentPage` in `packages/metahubs-frontend/base/src/domains/entities/ui/EntityBlockContentPage.tsx`.
-   [ ] Load:
    -   metahub id and route params.
    -   entity type by `kindKey`.
    -   entity instance by `entityId`.
    -   metahub permissions.
-   [ ] Fail closed if the Entity type does not have `components.blockContent.enabled`.
-   [ ] Use the existing update mutation with `expectedVersion` to avoid overwriting concurrent edits.
-   [ ] Use the same shell components as other metahub pages: `ViewHeader`, `MainCard` or current page shell primitives, `BaseEntityMenu`, `EntityFormDialog` for properties.
-   [ ] Make breadcrumbs resolve:

```text
Metahubs > {metahub} > Entities > {localized entity type name} > {page name} > Content
```

-   [ ] Update `NavbarBreadcrumbs` to understand `/content` under entity instance routes.

### Phase 5: Change Page list interaction model

-   [ ] In `EntityInstanceListContent`, detect `showPageBlocksTab` / `components.blockContent.enabled`.
-   [ ] For block-content entities, make row/card click navigate to the content route instead of opening the edit dialog.
-   [ ] Rename menu action from generic `Edit` to `Edit properties` for block-content entity lists, while preserving generic `Edit` for non-block-content entities.
-   [ ] Add an explicit `Open content` menu action if it improves keyboard discoverability.
-   [ ] Remove the `Content` tab from the generic edit dialog for block-content entity types once the detail route is available.
-   [ ] Keep `Content` in copy payloads so copied Pages duplicate their block data safely with a new UUID v7 entity id.
-   [ ] After creating a Page, navigate to its content route by default if the user has edit permission.

### Phase 6: Save flow and conflict safety

-   [ ] Build a focused save hook around existing `useUpdateEntityInstance`:
    -   maintains local editor state.
    -   adapts Editor.js output to canonical blocks.
    -   validates with `pageBlockContentSchema`.
    -   sends `config.blockContent` only after explicit Save.
    -   includes `expectedVersion`.
    -   invalidates list and detail queries through existing `invalidateEntitiesQueries`.
-   [ ] Reuse and harden backend `validateEntityConfigForComponents()` for create, update, copy, and import flows:
    -   reject `config.blockContent` when the resolved Entity type does not enable `components.blockContent`.
    -   reject unsupported block types and unsupported tool output shapes.
    -   reject or strip unexpected HTML according to the canonical plain-text policy.
    -   reject unsafe image/embed URLs.
    -   normalize accepted payloads before storing.
-   [ ] Display validation and conflict errors through existing snackbar/error patterns.
-   [ ] On optimistic lock conflict, reuse the existing `ConflictResolutionDialog` pattern where practical.
-   [ ] Add "Reload remote content" and "Keep editing locally" affordances if conflict handling needs user choice.

Example payload:

```ts
await updateEntityInstance({
    metahubId,
    entityId,
    data: {
        expectedVersion: entity.version,
        config: {
            ...safeExistingConfig,
            blockContent: pageBlockContentSchema.parse(nextBlockContent)
        }
    }
})
```

### Phase 7: Internationalization

-   [ ] Add shared editor keys to `packages/universo-i18n/base/src/locales/{en,ru}/core/common.json` only for domain-neutral labels.
-   [ ] Add metahub-specific keys to `packages/metahubs-frontend/base/src/i18n/locales/{en,ru}/metahubs.json`:
    -   `entities.instances.actions.openContent`
    -   `entities.instances.actions.editProperties`
    -   `entities.instances.content.title`
    -   `entities.instances.content.save`
    -   `entities.instances.content.saved`
    -   `entities.instances.content.unsavedChanges`
    -   `entities.instances.content.validationInvalid`
    -   `entities.instances.content.editorLoadError`
-   [ ] Add Editor.js tool labels in EN/RU.
-   [ ] Add tests that fail on raw keys for Page list, Page detail, editor toolbar, and breadcrumbs.

### Phase 8: Template and LMS fixture policy

-   [ ] Do not regenerate the LMS snapshot only because the editor UI changed.
-   [ ] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only if template manifests, default Page content, fixture contracts, or serialized block config changes.
-   [ ] If regeneration is needed, use the existing Playwright generator and then run import/runtime proof.
-   [ ] Ensure Basic and basic-demo still include the Page preset with `blockContent.enabled`.
-   [ ] Ensure custom empty-template metahubs can import/export without implicitly forcing Page or Editor.js.

### Phase 9: Runtime renderer compatibility

-   [ ] Keep `apps-template-mui` renderer schema-based and Editor.js-free.
-   [ ] Add any missing renderer parity only if the authoring editor saves a block shape already accepted by `runtimePageBlockSchema`.
-   [ ] If Editor.js tool output differs from the current schema, normalize on save rather than weakening runtime rendering.
-   [ ] Re-test runtime Page rendering after publication sync and application schema sync.

### Phase 10: Tests

#### Unit and component tests

-   [ ] `@universo/types`: extend `pageBlocks.test.ts` for real Editor.js `OutputData` from supported tools and invalid tool rejection.
-   [ ] `@universo/types` or `@universo/utils`: add adapter tests for:
    -   `@editorjs/list` 2.x nested `{ content, meta, items }` output with `maxLevel: 1`.
    -   nested list rejection or flattening rules.
    -   inline HTML rejection/stripping in paragraph, header, quote, table, and list content.
    -   URL-only image/embed validation.
-   [ ] `@universo/template-mui`: add Jest tests for `EditorJsBlockEditor` with mocked dynamic imports:
    -   initializes once.
    -   calls `destroy()` on unmount.
    -   handles React StrictMode double mount.
    -   emits normalized `PageBlockContent`.
    -   rejects unsupported block data.
    -   renders load/error states.
-   [ ] `@universo/metahubs-frontend`: add Vitest tests for:
    -   Page card click navigates to `/content`.
    -   menu has `Open content` and `Edit properties`.
    -   edit dialog no longer shows JSON Content as the main default path.
    -   content route fails closed for an Entity type without `blockContent`.
    -   save mutation sends `expectedVersion` and normalized `config.blockContent`.
    -   conflict handling preserves local unsaved data.
-   [ ] `@universo/template-mui` breadcrumb tests: entity instance `/content` route resolves localized Entity type and instance names.

#### Backend/API tests

-   [ ] `metahubs-backend` route/service tests:
    -   update Page block content validates schema.
    -   create/update/copy/import all pass through the same `validateEntityConfigForComponents()` block-content boundary.
    -   invalid URLs are rejected by schema path.
    -   inline HTML is rejected or normalized according to the canonical plain-text policy.
    -   `@editorjs/list` 2.x raw nested output is not stored directly.
    -   unsupported blocks fail closed.
    -   copy preserves content with a distinct entity id.
    -   snapshot export/import preserves `blockContent`.

#### Playwright browser tests

-   [ ] Extend `metahub-basic-pages-ux.spec.ts`:
    -   create Basic metahub.
    -   open Pages.
    -   click Page card and assert URL `/entities/page/instance/:id/content`.
    -   assert no raw JSON editor is the default visible control.
    -   type a header and paragraph in Editor.js.
    -   save.
    -   reload the detail route and verify content persists.
    -   edit properties through the three-dot menu.
    -   copy Page and verify copied Page content exists.
    -   delete copied Page safely.
    -   capture screenshots of Page list, Page content editor, saved state, and runtime render.
-   [ ] Add a publication/runtime flow:
    -   publish metahub.
    -   create linked app and sync schema.
    -   open published app.
    -   verify updated Page content renders through `PageBlocksView`.
-   [ ] Add mobile viewport screenshot for editor controls and text overflow.
-   [ ] Run Playwright through the existing CLI on port 3100, not `pnpm dev`.

### Phase 11: Documentation

-   [ ] Update `packages/metahubs-frontend/base/README.md` and `README-RU.md`:
    -   Page detail route.
    -   `blockContent` authoring.
    -   Editor.js integration boundary.
-   [ ] Update `packages/universo-template-mui/base/README.md`:
    -   shared `EditorJsBlockEditor`.
    -   dependency/lifecycle notes.
-   [ ] Update `packages/universo-types/base/README.md`:
    -   `PageBlockContent` / `runtimePageBlockSchema` contract.
-   [ ] Update GitBook docs:
    -   `docs/en/architecture/lms-entities.md`
    -   `docs/ru/architecture/lms-entities.md`
    -   LMS setup/overview pages if the workflow screenshots or text mention Page content.
-   [ ] Add a short security note: runtime does not render arbitrary HTML and only allowed block schemas are accepted.

### Phase 12: Validation commands

-   [ ] `pnpm --filter @universo/types test -- pageBlocks.test.ts`
-   [ ] `pnpm --filter @universo/template-mui test -- EditorJsBlockEditor.test.tsx NavbarBreadcrumbs.test.tsx`
-   [ ] `pnpm --filter @universo/metahubs-frontend test -- EntityInstanceList.test.tsx EntityBlockContentPage.test.tsx`
-   [ ] `pnpm --filter @universo/metahubs-backend test -- entityInstancesRoutes.test.ts SnapshotRestoreService.test.ts`
-   [ ] `pnpm --filter @universo/template-mui lint`
-   [ ] `pnpm --filter @universo/metahubs-frontend lint`
-   [ ] `pnpm --filter @universo/template-mui build`
-   [ ] `pnpm --filter @universo/metahubs-frontend build`
-   [ ] `pnpm --filter @universo/core-frontend build`
-   [ ] `node tools/testing/e2e/run-playwright-suite.mjs --project=chromium tools/testing/e2e/specs/flows/metahub-basic-pages-ux.spec.ts`
-   [ ] Run LMS import/runtime Playwright if the LMS fixture or template manifests change.
-   [ ] `pnpm exec prettier --check ...`
-   [ ] `git diff --check`

## Potential Challenges And Mitigations

| Risk                                       | Mitigation                                                                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| React 18 StrictMode double initialization  | Own the lifecycle in a local adapter, wait for `isReady`, and always destroy the previous instance safely.                                            |
| Stale React wrappers                       | Do not depend on `@react-editor-js/core` or `react-editor-js`; use official core directly.                                                            |
| Bundle size                                | Dynamic-import Editor.js and tools only inside the content route/editor component. Keep runtime renderer Editor.js-free.                              |
| Unsafe HTML or unsupported plugins         | Do not enable `raw`/`code`; normalize through `pageBlockContentSchema`; keep runtime rendering schema-constrained.                                    |
| Image uploads                              | Start with URL-only images and existing safe URL validation. Add storage upload later as a separate feature.                                          |
| Editor.js inline markup in text fields     | Disable inline tools in this phase and enforce canonical plain text in adapters plus backend validation.                                              |
| `@editorjs/list` 2.x nested output         | Configure `maxLevel: 1`, adapt item objects to flat strings, and test real package output fixtures before storage.                                    |
| Data loss during navigation                | Add dirty-state guard and explicit Save. Do not auto-save every keystroke to backend.                                                                 |
| Concurrent edits                           | Use `expectedVersion`; reuse conflict dialog patterns.                                                                                                |
| Page-only hardcoding                       | Gate behavior by `components.blockContent.enabled`, not by `kindKey === 'page'`, except for standard template defaults and localized standard labels. |
| Snapshot drift                             | Regenerate fixtures only through Playwright generators when serialized template data changes.                                                         |
| Editor tool output differs from our schema | Normalize output before persistence instead of weakening runtime schemas.                                                                             |

## Open Questions For Review

1. Should Page creation automatically redirect to the content editor after saving, or should it stay on the list and show an `Open content` action?
2. Should the JSON fallback be visible to normal users under a menu action, or hidden behind a developer/debug-only affordance?
3. Should image support be URL-only for this phase, or should authenticated upload/storage be included as a separate subproject?
4. Should custom Entity types be allowed to enable `blockContent` immediately in the configurator, or should the first implementation expose it only read-only for standard Page and enable custom authoring in a follow-up?

## Recommended Scope For First Implementation

Implement the editor route and URL-only block authoring for `components.blockContent.enabled` Entity types, with Page as the shipped default. Keep runtime rendering unchanged, remove JSON as the default Page editing UX, and defer upload/storage and advanced custom block tools to later phases.

## QA Review Addendum 2026-05-04

The plan is architecturally correct after the refinements above: Editor.js belongs in the metahub authoring surface, `apps-template-mui` remains renderer-only, and Page stays a standard Entity type with `blockContent` enabled rather than a hardcoded LMS feature.

Required implementation guardrails:

-   Do not persist raw Editor.js `OutputData`.
-   Do not allow frontend-only validation; backend create/update/copy/import paths must validate `config.blockContent`.
-   Do not introduce Page-only UI primitives. Reuse the existing Entity route shell, list/card/table/menu/dialog components, and query/mutation hooks.
-   Do not enable inline HTML or rich inline tools until the platform has an explicit sanitized inline mark contract.
-   Do not add Editor.js to `packages/apps-template-mui`; published applications should render only normalized blocks.
-   Do not regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` unless serialized template or fixture content changes.
