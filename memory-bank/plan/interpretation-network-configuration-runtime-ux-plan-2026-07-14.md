# Interpretation Network Configuration and Runtime UX Plan

> Created: 2026-07-14  
> Status: Draft for discussion — QA revised 2026-07-14  
> Mode: PLAN — no product code is changed by this document  
> Research input: [Interpretation Network Configuration and Runtime UX research](../research/interpretation-network-configuration-runtime-ux-research-2026-07-13.md) (reviewed 2026-07-14)  
> Source brief: Interpretation Network configuration/runtime UX brief (2026-07-13)  
> Source stakeholder request: Interpretation Network runtime UX request (2026-07-13)

## 1. Overview

Deliver a coherent current-data implementation for the Interpretation Network template: preserve all localized Structure values while editing, remove the seeded menu heading, make breadcrumbs and selected cells visually correct, introduce safe custom cell/text/border colours, move Structure controls to their parent surface, and add an optional accessible transient pane resizer.

The implementation remains template-first. It strengthens the existing `object`, `page`, `set`, and `enumeration` configuration; it does **not** introduce an entity preset, a new runtime shell, a database migration, a schema-version increase, or a metahub-template-version increase. The published application continues to be rendered solely by `packages/universo-react-apps-template-mui` and retains its copied MUI dashboard language.

Because the test database will be recreated, this plan deliberately removes obsolete Interpretation Network compatibility paths instead of carrying legacy value formats forward. The one implementation deliverable is a new configuration contract for newly seeded data, validated at every write/import boundary.

## 2. Planning evidence and checked sources

### Local evidence

-   The research artifact above traced the current generator → fixture contract → drift → import → runtime path and the relevant runtime, authoring, template, and backend seams.
-   `useInterpretationNetworkWorkspaceState.ts` currently reads only `editingStructure?.[field.id]`; `FormDialog` and `LocalizedInlineField` already display every language when given the complete VLC value.
-   The runtime consumes an **application-materialized** widget configuration. It does not dynamically merge a metahub source at runtime. The lifecycle is therefore `metahub seed/source → materialized application-local widget config → runtime`, plus a user's transient in-memory splitter position.
-   The five colour fields are currently `REF` values to `CellColor`; current runtime string coercion does not enforce `validationRules.pattern` for child-row writes.
-   Existing product proof already has a canonical UI generator, fixture contract, normalized drift check, imported-snapshot flow, smoke flow, visual workspace test, and local-minimal Supabase scripts. It must be extended, not replaced.

### Current external/documentation refresh

-   Context7, `react-resizable-panels` (`/bvaughn/react-resizable-panels`), confirmed the current `Group`, `Panel`, `Separator`, stable panel IDs, and `groupRef.current.setLayout({ panelId: percent })` API. It is a candidate dependency, not an approval to install an unpinned version.
-   Context7, MUI v7.3.2 (`/mui/material-ui/v7_3_2`), confirms the normal MUI accessible-label patterns. Implementation must preserve the `Breadcrumbs` label, give a truncated interactive crumb its complete accessible name, and use a tooltip only as a description rather than its replacement.
-   The reviewed research retains WAI-ARIA Breadcrumb and Window Splitter patterns as acceptance sources. A direct W3C fetch in this environment could not resolve DNS; the plan therefore treats the existing reviewed research links and the final rendered DOM/browser evidence as the verification source rather than claiming a second live W3C fetch.

## 3. Resolved decisions and implementation boundaries

### 3.1 Ownership and domain placement

| Concern                                                                   | Owner                                                                               | Implementation boundary                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Structures, Interpretations, Relations, Materials, Table Templates, Cells | Existing Interpretation Network `object`/`page` entities in the published workspace | User-authored records and transient selection only; UUID v7 remains system-owned.              |
| Initial menu visibility, cell-field metadata, default split enablement    | Interpretation Network metahub template                                             | `interpretation-network.template.ts` and `interpretation-network.stage2.ts`.                   |
| Deployed-instance split enablement                                        | Application Settings over active, materialized widgets                              | One normalized batch update; no separate duplicate configuration store.                        |
| Display configuration validation and defaults                             | `@universo-react/types`                                                             | Strict widget schema and pure normalizers.                                                     |
| User's adjusted pane ratio                                                | Workspace component state                                                           | Never persisted to metahub/application config, local storage, URL, or server.                  |
| Rendered workspace                                                        | `@universo-react/apps-template-mui`                                                 | Reuse its dialog, MUI card, table, dashboard, and i18n conventions; no legacy-package imports. |

### 3.2 Current-data contract

1. **No legacy compatibility.** Remove only the persisted-widget-config `hierarchyLayout` migration/preprocess, its authoring save/allow-list parsing, and the runtime `normalizeLegacyMatrixViewRequest` compatibility branch. The strict widget schema must reject that removed key. Retain the current internal, derived `MatrixHierarchyLayout`/`resolveMoveHierarchyLayout` mechanics for drag geometry (or rename them in a separate refactor): they are derived from the selected current Matrix view and table projection, not a persisted legacy setting. Preserve their DnD tests. After all callers have moved, remove `CellColor`, its option values, preset-ID types, REF decoder, `cellStylePicker` metadata, and the obsolete `CellStyleDialogField`/`FormDialog` hook as one retirement slice. No feature code should accept old colour IDs, `REF` records, or historical palette records.
2. **Canonical colour values.** The six scalar colour fields are nullable `STRING` fields: `CellFillColor`, `TextColor`, `BorderTopColor`, `BorderRightColor`, `BorderBottomColor`, and `BorderLeftColor`. Their sole persisted form is uppercase `#RRGGBB` or `null`.
    - The editor may accept `#RGB` and immediately normalise it to `#RRGGBB`.
    - It rejects `#RGBA`, `#RRGGBBAA`, named colours, `rgb()`, `hsl()`, variables, URLs, expressions, arrays, objects, JSON, and whitespace-padded/otherwise malformed values.
    - `null` means no fill, no explicit border colour (width/style still decide visibility), or theme-default text respectively.
    - Preset swatches are a local UI shortcut that writes the same canonical hex; they are not entities, refs, or a second persistence grammar.
3. **Safe generic semantic validation.** Metadata uses a narrow, allow-listed typed discriminator `validationRules.format: 'hexColor'`, in addition to the declarative `^#[0-9A-F]{6}$` pattern. The shared pure normalizer is applied only when `format` is exactly that known string; an unknown/non-string format is rejected by the metadata/template validator and is never interpreted. The pattern remains declarative/template-shape metadata, not a runtime instruction to construct an arbitrary `RegExp`. Do not execute template-provided regular expressions on runtime input and do not hard-code Interpretation Network codenames in an application controller.
4. **Border editing.** One scoped Interpretation Network cell-style editor presents an all-sides border control by default and atomically writes the four existing colour/width/style fields. An explicit "edit sides separately" control reveals individual values. Existing unequal values enter or visibly signal advanced mode. No `BorderMode` field is persisted.
5. **Text contrast policy.** For every style-editor draft that authors either text or fill, resolve the _effective_ foreground/background pair from the explicit canonical colour or the current MUI theme fallback. Block save with a localized, corrective field error whenever it is below WCAG AA (4.5:1 for normal cell title; 3:1 only where the rendered text qualifies as large). Thus a custom dark fill with `TextColor: null`, or custom text over the theme paper background, cannot bypass validation; the unmodified all-theme default is covered by light/dark theme tests. Apply the same effective-pair rule to secondary material/position text and separately verify coloured breadcrumb navigation. The renderer must never throw on external malformed/out-of-policy input: it resolves a deterministic black-or-white foreground with the **maximum calculated contrast** against the resolved background, without mutating saved data. Keyboard focus, selected state, and drag/drop retain non-colour signals and a 3:1-or-better indicator. The user-visible API never receives a raw internal validation string.
6. **Split configuration is minimal.** Persist `splitPane: { enabled: boolean }`; do not persist a ratio. Export non-configurable shared constants for the 50/50 default and desktop 25–75% bounds. The template initially enables the feature; application settings may turn it off. Reset always returns to the resolved application-effective 50/50 layout. This is a discussion decision because the stakeholder requested enabled-by-option rather than a default state; it can be changed to disabled in one seed/default test without architectural change.
7. **Splitter dependency gate.** Prefer `react-resizable-panels` only after implementation-time approval of its exact current release, licence, bundle impact, type compatibility, MUI integration, and local browser DOM behaviour. Add the approved version once to the root `pnpm-workspace.yaml` catalog and consume it through `catalog:`. The documented Separator gives a `role='separator'`, range values and panel controls, but its documented Home/End action collapses a panel; this conflicts with the required 25–75% range. The adopted implementation must either prove that the chosen release clamps Home/End to the configured bounds or prevent the default and set exact layouts through the group ref: Home = Structure 25% / Materials 75%, End = Structure 75% / Materials 25%. It must expose an explicit localized `aria-label` or `aria-labelledby`; role/range/controls alone are not an accessible name. Stable Panel IDs must render as live DOM `id` values and `aria-controls` must resolve to both panel elements. Verify feasibility of 25–75% against the longest Materials content before approving the bounds. If the gate fails, budget the full WAI-ARIA Window Splitter contract before falling back; a pointer-only CSS divider is not acceptable.

### 3.3 Explicit non-goals

-   No IPFS/IPNS, Elm/reference-product code, reference-product vocabulary, raw JSON colour editor, global theme redesign, or new platform entity kind.
-   No dynamic metahub-to-runtime inheritance. A future source refresh must use the already documented local-modification/conflict model; it cannot silently replace an application-local split setting.
-   No browser storage or hidden server mutation for pane dragging.
-   No raw UUIDs, codenames, raw objects, or JSON on ordinary user surfaces.
-   No manual edit of `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`.

## 4. Runtime UI contract

| Surface                      | User-facing behaviour                                                                                                                                                                              | Guardrails and responsive proof                                                                                                                                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure create/edit dialog | Name and Description are localized semantic fields. Edit receives the full VLC, shows all authored locales, and saves the full VLC object. Descriptions remain multiline.                          | Resolve raw values by physical field, codename, component ID, and `row.data`; never use locale-formatted display text as edit data. All errors EN/RU.                                                                                                           |
| App navigation               | The Interpretation Network template does not visibly repeat its title above the left navigation.                                                                                                   | Retain a localized accessible navigation name; generic `showTitle` remains available to other configurations.                                                                                                                                                   |
| Breadcrumb path              | Each constrained visible label starts at its beginning and ends with an ellipsis. Full title is readable on keyboard/pointer hover and announced as the control name.                              | Keep depth-collapse separate; `Breadcrumbs` has a label; current item exposes `aria-current='page'`; focus is visible and not clipped. Test full accessible name, constrained inner node, computed start-aligned ellipsis styling, then inspect the screenshot. |
| Matrix cell style editor     | Palette swatches, native colour picker, validated hex entry, current preview, and Clear exist for fill, text, and borders. Default border controls cover all edges; advanced controls cover sides. | No field ID/codename or JSON; localised labels/errors; every effective authored text/fill pair passes contrast; swatches expose localized name and selected state; picker, hex input, preview, and Clear have labels and 24px targets.                          |
| Matrix/table/drag display    | Fill, explicit text colour, and four borders render consistently in normal cards, drag overlay, independent-axes Table, hierarchy Table/header card, and tabular previews.                         | Apply non-throwing display resolution and the safe contrast fallback. Breadcrumbs keep navigation colouring/semantics instead of inheriting TextColor. Secondary material/position text remains visibly distinct and contrast-safe.                             |
| Selected state               | Selection is painted exactly at the card edge and remains visible without overflow clipping.                                                                                                       | Use an in-bounds pseudo-element/box-shadow, not outward outline; retain separate `:focus-visible` and drag/drop indication.                                                                                                                                     |
| Structure workspace          | Once a Structure is open, a single outlined parent header with title and Back action appears above Matrix and Materials panes.                                                                     | List view remains unchanged. Back restores keyboard focus to the Structure card/button that opened it. At mobile widths panes stack beneath the parent header.                                                                                                  |
| Pane resizing                | On desktop with split enabled, a named, focusable separator adjusts panes from 25–75%, supports pointer/touch, Arrow, exact bounded Home/End, and visible Reset.                                   | Live DOM panel IDs and `aria-controls`; `role='separator'`, localized name, `tabindex`, vertical orientation, min/max/current values, at least 24px target; Home = 25/75, End = 75/25; no separator when disabled or stacked; no page horizontal overflow.      |

The plan passes the runtime UX planning gate: it reuses MUI/dashboard primitives, keeps long text multiline, localizes messages, hides system fields, supplies keyboard paths, and explicitly requires desktop/tablet/mobile overflow evidence.

## 5. Affected areas

-   `packages/universo-react-types`
    -   `src/common/interpretationNetworkLayout.ts`, a new neutral colour/format helper, exports, `src/common/metahubs.ts`, and their tests/README files.
-   `packages/universo-react-metahubs-backend`
    -   `src/domains/templates/data/interpretation-network.stage2.ts`, `interpretation-network.template.ts`, snapshot/import semantic validation seam, template-shape tests, README files.
-   `packages/universo-react-applications-backend`
    -   `src/shared/runtimeHelpers.ts`, `src/controllers/runtimeChildRowsController.ts`, `src/controllers/runtimeRowsController.ts`, `src/routes/sync/syncHelpers.ts`, `syncSeeding.ts`, direct Jest tests, README files.
-   `packages/universo-react-metahubs-frontend`
    -   `InterpretationNetworkWorkspaceWidgetEditorDialog.tsx`, local EN/RU translations and focused tests.
-   `packages/universo-react-applications-frontend`
    -   `ApplicationSettings.tsx`, `application-settings/MatrixSettingsPanel.tsx`, local EN/RU translations and Vitest tests.
-   `packages/universo-react-apps-template-mui`
    -   `InterpretationNetworkWorkspaceWidget.tsx`, Interpretation Network model/workspace components, scoped cell editor, tabular preview utility, feature locales, tests, README files.
-   Root/tooling/docs
    -   `pnpm-workspace.yaml`, `package.json`, generator/contract/drift/import/flow/visual E2E support, generated fixture, E2E README files, EN/RU GitBook pages and screenshot evidence tooling.

## 6. Detailed implementation plan

### Phase 0 — protect the current contract and establish baselines

-   [ ] Read the current package READMEs and local package instructions before each implementation slice. Keep pre-existing unrelated changes in `AGENTS.md`, `CLAUDE.md`, root READMEs, `package.json`, and Memory Bank research untouched.
-   [ ] Before editing any function/class/method, run OntoIndex impact analysis and record caller count/risk. The already inspected `normalizeInterpretationNetworkTableSettings` has MEDIUM impact across the metahub editor, Matrix Settings, Application Settings, and runtime `toConfig`; it requires a coordinated change and focused re-test. Stop for user direction if a new impact report is HIGH or CRITICAL.
-   [ ] Add failing acceptance tests before refactoring: complete VLC edit data, the future no-`CellColor`/six-colour-field template shape, Matrix rendering, materialized settings save, and generated fixture contract. This makes the intentional legacy removal observable rather than accidental without preserving a legacy test contract.
-   [ ] Decide and document the exact centrally catalogued splitter version only after checking its release notes, licence, dependency weight, TypeScript declaration/API, and browser accessibility. Do not install an unpinned package and do not place a version in an individual package.

### Phase 1 — establish one strict shared configuration and colour format contract

-   [ ] In `packages/universo-react-types/src/common/interpretationNetworkLayout.ts`, add a strict `splitPane` schema, typed settings, normalizer, shared 50/50 layout constant, and 25/75 bounds. Keep it a companion to `normalizeInterpretationNetworkTableSettings`, not an overloaded argument list.
-   [ ] Add a neutral pure `interpretationNetworkColor` module, exported from `@universo-react/types`, for `MatrixColor`, strict opaque-hex normalization, **non-throwing** display resolution (`invalid → null/default`), contrast calculation, and maximum-contrast black/white foreground selection. It must not import React, MUI, DOM APIs, VLC helpers, database code, or runtime columns. The UI passes resolved MUI `text.primary`/`background.paper` literals into that pure contract, so it does not duplicate theme logic.
-   [ ] Extend shared validation-rule typing with the closed `format: 'hexColor'` discriminator used by generic boundary code. Update the component and fixed-value metadata Zod schemas and replace the template manifest's current `validationRules: z.record(z.unknown())` acceptance with an equivalent allow-list so only `hexColor | undefined` is allowed; test non-string/foreign formats. Do not introduce arbitrary evaluation of regexes or executable metadata.
-   [ ] Delete only the obsolete persisted `hierarchyLayout` config migration/preprocess (`migrateDeprecatedInterpretationNetworkConfigKeys`), `normalizeLegacyMatrixViewRequest`, and their config-migration tests. Preserve current supported Matrix view configuration, hierarchy row mode, toolbar settings, and the internal derived `MatrixHierarchyLayout` DnD geometry type/tests.
-   [ ] Retire the `CellColor` preset entity contracts in `common/metahubs.ts` only after consumers are migrated. Keep border widths/styles typed only when they are owned by the new grouped editor, add `text` to the actual Matrix style model, and do not retain the old preset state representation as a parallel compatibility contract.

Illustrative pure contract (the implementation must add tests before relying on it):

```ts
declare const matrixColorBrand: unique symbol
export type MatrixColor = (string & { readonly [matrixColorBrand]: true }) | null

export function normalizeInterpretationNetworkHexColor(value: unknown): MatrixColor {
    if (value === null) return null
    if (typeof value !== 'string') throw new Error('invalidHexColor')

    const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value)
    if (!match) throw new Error('invalidHexColor')

    const hex = match[1]
    return `#${hex.length === 3 ? [...hex].map((part) => part + part).join('') : hex}`.toUpperCase() as MatrixColor
}
```

The Clear action maps its empty UI state to `null` before this helper is called. The surrounding UI converts `invalidHexColor` to a feature-local EN/RU message; it must never render that internal token to an end user.

### Phase 2 — replace template metadata and validate seed/import paths

-   [ ] Refactor `interpretation-network.stage2.ts`'s shared Matrix child-field array once: replace five colour `REF`s with nullable `STRING` fields, add `TextColor`, stamp `format: 'hexColor'` plus a canonical hex pattern/max length, and replace `cellStylePicker` metadata with scoped-editor metadata that carries no legacy scalar-picker/REF semantics. Update style-preview metadata with `textColorField: 'TextColor'` as well as fill/border fields. Both `InterpretationMatrix` and `TemplateMatrix` must have exactly 23 child fields and matching `maxChildComponents`.
-   [ ] Remove `CellColor` seed entity and `optionValues` from `interpretation-network.template.ts`. Move the well-known palette to the scoped runtime editor as a readonly list of canonical hex swatches, with labels localised there.
-   [ ] Change only the Interpretation Network menu seed to `showTitle: false`; preserve the generic menu capability and its accessible navigation label.
-   [ ] Add `splitPane: { enabled: true }` to the template widget configuration. Keep 50/50 and bounds in shared constants; do not turn transient width into seed data.
-   [ ] Keep snapshot concerns at their real boundary. Full-metahub and publication-version import must validate fixture **metadata** shape (six nullable `STRING + format: 'hexColor'`, no REF/`CellColor`) before `SnapshotRestoreService` persists the snapshot or the publication endpoint persists `snapshot_json`; invoke the same pure metadata validator in both endpoints after envelope/hash validation. The canonical fixture intentionally has no seeded runtime TABLE rows, so do not claim it proves user-value validation or add a fictitious restore boundary.
-   [ ] For a crafted, re-hashed published snapshot that contains `elements` TABLE data, prove the application schema-sync/materialization path rejects malformed child colours in `syncSeeding → normalizeChildFieldValue` before inserting runtime rows. Runtime user mutations are proven separately in Phase 3. Preserve envelope size/hash protections and make every rejection fail closed and atomic.
-   [ ] Do not add a migration, schema/template version increment, or UUID retrofit. Existing template seeding continues to generate UUID v7 identities.

### Phase 3 — enforce colour validation in every write path

-   [ ] In `applications-backend`, make `coerceRuntimeValue` and `normalizeRuntimeTableChildInsertValue`/`normalizeRuntimeTableChildInsertValueByMeta` apply only the closed `hexColor` formatter for nullable `STRING` fields. Centralize that one normalizer so it reaches `runtimeChildRowsController` create/update/batch/uniform/copy and all `runtimeRowsController` inline TABLE payload create/update/replace/batch/copy paths before parameterized SQL binding. Retain `DbExecutor`, `$n` values, identifier quoting, RLS/request-executor selection, `RETURNING`, and zero-row fail-closed behaviour.
-   [ ] Apply the same pure validation to child values seeded or materialized through `syncHelpers.normalizeChildFieldValue` and `syncSeeding`. Do not trust a browser picker, generic string coercion, frontend Zod, or the fixture contract as a security boundary.
-   [ ] Represent format failure as a stable safe code (for example, `INVALID_FIELD_FORMAT`) plus a nontechnical field reference, not `Invalid value for ${childFieldPath}: ${err.message}`. Controllers return that stable contract; the runtime maps it to a feature-local EN/RU corrective colour message. Do not localize business logic in backend controllers and never expose a codename/path/internal exception.
-   [ ] Add direct unit/service tests that prove all six fields accept `null`, `#abc` → `#AABBCC`, and `#AABBCC`; reject CSS function/variable/URL/object variants before a mutation. Cover every public child-row and parent TABLE write family plus sync materialization, asserting no SQL write/partial batch occurs after rejection. Direct API tests prove the stable code; EN/RU UI tests prove the local message with no raw backend text.

Illustrative generic boundary use:

```ts
if (component.validationRules?.format === 'hexColor') {
    return normalizeInterpretationNetworkHexColor(rawValue)
}
return coerceByDeclaredDataType(component.dataType, rawValue)
```

The actual helper must retain its structured error type and controller mapping rather than throwing an internal string directly into HTTP output.

### Phase 4 — wire the single config into metahub and application authoring

-   [ ] Update `InterpretationNetworkWorkspaceWidgetEditorDialog.tsx` to edit the shared `splitPane.enabled` field with accessible/localized help that distinguishes default configuration from a user drag. Use the shared normalizer/schema rather than a local object shape.
-   [ ] Update `MatrixSettingsPanel.tsx` and `ApplicationSettings.tsx`: parse, allow-list, normalize, compare dirty state, batch-save through the existing `updateApplicationLayoutWidgetConfigsBatch` path to every active materialized Interpretation Network widget, update/invalidate the TanStack Query cache, and show a localized divergence warning when widgets differ. Preserve its sorted locking, `expectedVersion`, all-or-nothing conflict failure/rollback and refetch behaviour; do not create a split-specific endpoint or second store. The Matrix tab remains absent without an active matching widget.
-   [ ] Remove legacy `hierarchyLayout` parsing/allow-list/equality behaviour in both authoring surfaces; update their tests to expect strict rejection rather than silent migration.
-   [ ] Prove lifecycle accurately: an application override remains effective after source synchronization until the platform's explicit local-change conflict handling resolves it. Do not falsely test or document live source inheritance.
-   [ ] Place EN/RU keys by ownership: runtime cell/workspace keys in the apps-template Interpretation Network namespace; metahub/editor and Application Settings keys in their local package namespaces; only truly reusable generic terms in `@universo-react/i18n`.

### Phase 5 — fix Structure VLC preparation and refactor runtime style modelling

-   [ ] Extract a pure raw runtime-field resolver near the existing `readColumnValue` logic. Its documented deterministic precedence is resolved physical runtime field → field ID/component ID → codename, checking each candidate first at the row root then at `row.data`; skip only `undefined` so an explicit `null` stays authoritative. Return the original raw object, never formatted display text. Test collisions containing different VLCs for both Name and Description.
-   [ ] Use this resolver in `useInterpretationNetworkWorkspaceState.ts` to build `structureInitialData` for every Structure field. Keep `FormDialog`/`LocalizedInlineField` unchanged except for focused regression coverage, since they already render VLC language variants correctly.
-   [ ] Refactor `model.ts`: remove `CELL_COLOR_HEX`/option-ID decoding, use non-throwing canonical display resolution for raw values, add `style.text`, construct four borders from colour/width/style, and use `null` defaults in `buildDefaultMatrixCellData`. Strict normalizing remains a write-boundary concern; no malformed external value may crash a renderer or inject CSS.
-   [ ] Render `style.text` consistently in `MatrixCellButton` (including drag overlay), `MatrixTableView`, `HierarchicalMatrixTableView` including header card, and `utils/tabularColumns.tsx` preview. Extend `CellStylePreviewConfig` with `textColorField`, resolve it with the canonical display helper, and test canonical/null/malformed preview values. Resolve position/material secondary text safely so it stays readable rather than blindly inheriting a custom title colour.
-   [ ] Preserve breadcrumbs as navigation. They may use fill when enabled but retain navigation foreground, hover, focus, name, and contrast semantics independent of TextColor.

### Phase 6 — create the scoped style editor and polish visual interaction

-   [ ] Retire—not repurpose—the current Interpretation-Network-specific `CellStyleDialogField`. First prove all callers, then remove the component, `FormDialog` auto-detection/import, `cellStylePicker` metadata, preset colour types/REF decoder, tests, preview mappings, fixture assertions and README claims. Add a final `rg`/fixture guard proving no `CellColor`, `CELL_COLOR_HEX`, old preset-ID/REF decoder, or `cellStylePicker` remains. Keep width/style constants only where the new editor actually uses them.
-   [ ] Introduce one `InterpretationNetworkCellStyleEditor` local to `dashboard/components/interpretation-network`, rendered from `CellEditDialog.tsx` with the full draft so it can update all sides atomically. It composes existing MUI Dialog/Stack/Tabs/TextField/Switch/Button/Tooltip primitives and `LocalizedInlineField` conventions—no new dashboard shell/global widget, `react-color`, legacy-template, admin, or authoring-package import. A generic non-template-MUI colour-control sub-primitive is allowed only if an immediate second surviving consumer proves it is genuinely reusable.
-   [ ] The scoped editor provides palette swatches, `<input type='color'>` without alpha/colorspace extensions, labelled canonical hex input/readout, current preview, Clear action, contextual labels, and localized errors for fill, text, and borders. Its state uses strict shared normalization at every write boundary. Swatches carry localized accessible names plus selected state; the native picker, hex input, preview, and Clear have explicit names.
-   [ ] Implement all-sides border writes as one immutable update to four colour/width/style fields. The advanced mode only alters selected side fields. Reflect the effective state in the preview and detect unequal persisted values on dialog open.
-   [ ] Calculate contrast in the editor against every effective pair (explicit or theme fallback); block submission for a failing authored pair and show an actionable localized message that explains how to correct it. In renderer code, apply the maximum-contrast black/white fallback to malformed or failing effective pairs while retaining focus/selection/drop affordances. Test current light/dark theme values, explicit/null permutations, title/secondary/breadcrumb paths, preview/overlay/table/header, and 3:1 focus/selection treatment.
-   [ ] Change selection paint in `MatrixCellButton` and hierarchical/table cards to an edge-aligned in-bounds treatment (`inset: 0` or tested inset box-shadow), not an outward outline that an `overflow: hidden` ancestor clips. Keep `:focus-visible` independently obvious.
-   [ ] Refactor each visible breadcrumb label to a start-aligned `minWidth: 0` inner text node with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`; parent buttons use `justifyContent: 'flex-start'`. Add full `aria-label`, Tooltip `describeChild`, breadcrumb landmark label, and `aria-current='page'` semantics. Test that its full accessible name is unchanged, `scrollWidth > clientWidth` under a constrained label, and computed ellipsis/one-line/start styles before using a screenshot to confirm the visible first characters and final ellipsis.

Illustrative layout/ellipsis shape:

```tsx
<Tooltip title={title} describeChild>
    <Button aria-label={title} sx={{ minWidth: 0, justifyContent: 'flex-start' }}>
        <Box component='span' sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
            {title}
        </Box>
    </Button>
</Tooltip>
```

### Phase 7 — give the opened Structure a parent header and accessible pane layout

-   [ ] Lift only the selected Structure name/Back action from `StructurePane` into a typed `structureHeader` prop rendered by `WorkspaceShell` as an outlined MUI parent island above both panes. Retain the unselected Structure list and its existing actions.
-   [ ] Introduce the desktop splitter in `WorkspaceShell` only, fed by materialized `toConfig(...).splitPane`. Keep a normal MUI responsive `Stack` when disabled or below the selected breakpoint; no separator is mounted on the stacked mobile layout.
-   [ ] If dependency due diligence passes, implement stable panel IDs `interpretation-network-structure-pane` and `interpretation-network-details-pane` that render as DOM IDs, a named separator whose `aria-controls` resolves to both, and a localized reset control. Do not hook a layout-change callback to persistence.
-   [ ] Ensure a drag is constrained 25–75%, handles pointer/touch and keyboard, preserves minimum usable content widths, and restores the application-effective equal layout. Verify actual DOM `role='separator'`, accessible name, `tabindex`, `aria-orientation='vertical'`, `aria-valuemin/max/now`, live controlled panel IDs, and exact Arrow/Home/End results (Home 25/75, End 75/25), rather than relying only on a dependency claim. Test a touch-enabled browser context, not only mouse-pointer simulation.

Illustrative reset path (panel IDs are stable DOM identifiers, not entity UUIDs):

```ts
const resetPaneSizes = () => {
    groupRef.current?.setLayout({
        'interpretation-network-structure-pane': 50,
        'interpretation-network-details-pane': 50
    })
}
```

### Phase 8 — regenerate the product fixture through the supported path

-   [ ] Update `interpretationNetworkFixtureContract.ts` and template-shape tests for hidden menu title, no `CellColor`/`cellStylePicker`, 23 shared child fields, six nullable semantic hex fields, `TextColor` + `textColorField` preview metadata, default split enablement, strict config absence of persisted `hierarchyLayout`, and child-count limits. Keep canonical generated fixture evidence limited to metadata because it intentionally contains no seeded Structure/Matrix TABLE rows.
-   [ ] Extend the product generator only where it must interact with the revised user-facing metahub/template UI. Generate the snapshot to the controlled artifact location and validate it with the existing contract and normalised drift check.
-   [ ] Parameterize/import the exact generated artifact into the follow-up runtime flow, then prove the artifact—not merely the checked-in fixture—works. Keep input paths repository-scoped and prevent arbitrary path injection.
-   [ ] Replace `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` only with generated output after the gate passes; never manually alter its JSON or integrity hash.

### Phase 9 — documentation and maintainable developer evidence

-   [ ] Update EN/RU pairs in lockstep:
    -   `docs/{en,ru}/guides/interpretation-network.md`: multilingual edit, parent header, breadcrumb behaviour, colour/clear/contrast workflow, grouped/advanced border controls, application-controlled resizing, and mobile fallback.
    -   `docs/{en,ru}/architecture/interpretation-network-data-model.md`: the six `#RRGGBB | null` fields, no colour refs/legacy IDs, `TextColor`, semantic validation, split config, and UUID v7/system fields.
    -   `docs/{en,ru}/guides/application-layouts.md`: materialized source/application/runtime lifecycle and local-change conflict behaviour, explicitly not dynamic inheritance.
    -   `docs/{en,ru}/guides/browser-e2e-testing.md`: minimal-Supabase Interpretation Network gate and browser/screenshot evidence expectations.
-   [ ] Update EN/RU README sections only for packages actually changed: `types`, `apps-template-mui`, `applications-frontend`, `applications-backend`, `metahubs-backend`, `metahubs-frontend`, plus `tools/testing/e2e/README.md`/`README-RU.md` if commands change. Update `@universo-react/i18n` README only if a real public shared namespace is added.
-   [ ] Capture and manually inspect the required Playwright evidence as a mandatory QA artifact. Add an LMS-style GitBook screenshot generator/manifest/provenance/check pipeline **only if** the finalized EN/RU guide embeds durable product screenshots or documentation policy approves removing its current exemption; otherwise do not create a second documentation-artifact system merely to satisfy QA screenshots.
-   [ ] If the conditional documentation asset pipeline is approved, reuse the LMS generator/manifest/provenance/check shape, store checked assets under `docs/{en,ru}/.gitbook/assets/interpretation-network/`, use a normalized route (no UUID), capture EN/RU 1920×1080 evidence, and add scoped scripts. Remove only `guides/interpretation-network.md` from `screenshotExemptPages` after real EN/RU assets, manifest, provenance, and checks exist; keep `browser-e2e-testing.md` exempt unless it receives an actual product screenshot. Update EN/RU `SUMMARY.md` only if a new page, not merely updated content, is added.

### Phase 10 — close out with layered proof and review

-   [ ] Run formatting, `git diff --check`, `pnpm check:catalog-versions`, `pnpm check:apps-template-isolation`, `pnpm check:runtime-no-lms-forks`, scoped type checks/builds, and focused Vitest/Jest suites before broad browser proof.
-   [ ] Run the generated fixture contract + drift gate, import the generated artifact, and execute the focused flow and visual suites against local minimal Supabase. Never run `pnpm dev` for this work. The dedicated local wrapper owns the whole lifecycle and sets its cleanup in `finally`/an equivalent `trap`, so a failed generator or browser assertion cannot leave Supabase running.
-   [ ] Open the produced screenshots in the implementation QA session and inspect actual layout, not just test pass status. Record the viewport/browser evidence in the final handoff.
-   [ ] Run `ontoindex detect-changes --repo universo-platformo-react` or `gn_verify_diff` before a commit and investigate every unexpected process/symbol.
-   [ ] Run Thermos/autoreview after non-trivial code changes. Address all CRITICAL/HIGH findings before merge; explicitly report any environment-only inability to run the advisory tool rather than calling it clean.

## 7. Test and evidence matrix

| Layer                                 | Target tests                                                                                                  | Required assertions                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared types (Vitest)                 | `applicationLayouts.test.ts` plus colour/format tests                                                         | Strict split config/default/bounds; reject persisted legacy `hierarchyLayout`; accept only `format: 'hexColor'`; normalize `#RGB`; accept canonical/null; reject all non-contract grammar; non-throwing display resolution; effective contrast and maximum-contrast fallback across light/dark explicit/null permutations.                                                                                                      |
| Metahub backend (Jest)                | `interpretationNetworkTemplateShape.test.ts`, import-endpoint metadata tests                                  | no `CellColor`/`cellStylePicker`; 23 exact fields; six `STRING + hexColor` metadata including `textColorField`; hidden menu title; split default; both metahub and publication-version imports reject bad metadata before persistence. A canonical fixture has no user TABLE rows, so it must not claim user-value proof.                                                                                                       |
| Applications backend (Jest)           | `runtimeRowsController`, `runtimeChildRowsController`, runtime helpers, sync helpers/seeding                  | child-row and parent TABLE create/update/replace/copy/batch/uniform paths accept valid/null and reject invalid six-field input before SQL with no partial mutation; stable nontechnical format code; a re-hashed seeded-elements snapshot fails in sync materialization.                                                                                                                                                        |
| Metahub/Application frontend (Vitest) | widget editor, `MatrixSettingsPanel`, `ApplicationSettings`                                                   | one normalized split setting; dirty state; existing batch `expectedVersion` all-or-nothing conflict/refetch/cache reconciliation; app override/conflict lifecycle; EN/RU labels; no Matrix tab without widget.                                                                                                                                                                                                                  |
| Apps template (Vitest/RTL)            | model, raw-field resolver, `CellEditDialog`, scoped style editor, workspace/table tests                       | VLC precedence/collisions at root and `row.data`; inactive Name/Description locale survives save model; all-side/advanced editor; clear/custom/palette; localized swatch/picker/hex/preview/Clear controls; local EN/RU hex/contrast error; text/secondary/preview/overlay/table/header rendering; start ellipsis DOM/a11y contract; edge selection; no splitter persistence or legacy picker symbols.                          |
| Fixture/generator                     | existing contract and drift helpers                                                                           | generator output rather than committed fixture is validated, drift-normalized, and passed into import/runtime proof.                                                                                                                                                                                                                                                                                                            |
| Playwright flow                       | new focused `@flow` spec or extracted helpers; do not make the existing very large scenario less maintainable | create RU Structure + add EN Name/Description; reopen/reload/edit one locale while other survives; hidden visible menu heading with retained nav name; header/back with focus restoration; long breadcrumb/depth navigation; styles/reload; EN/RU invalid-hex and contrast errors via `expectLocalizedValidation`; app split override; `expectNoTechnicalLeakage`.                                                              |
| Playwright visual                     | expanded `@visual` workspace evidence                                                                         | empty and populated states; header/breadcrumb; custom fill/text/border; selected edge; enabled/reset/disabled splitter at `1920x1080`, `768x1024`, `390x844`; inspect recorded PNGs; `expectRuntimeUxViewportMatrix` proves no page overflow.                                                                                                                                                                                   |
| Browser accessibility                 | in the same focused Playwright flows plus one human assistive-tech check                                      | keyboard form path; localized swatch selected state and names; named `role=separator`, `tabindex`, `aria-orientation`, live IDs/`aria-controls`, `aria-valuemin/max/now`, exact Arrow/Home/End values, pointer and touch-enabled context, reset, 24px target; no separator in disabled/mobile stack; focus visible/non-colour cues. Before acceptance, manually spot-check screen reader, 200% zoom, and OS high-contrast mode. |

### Local minimal-Supabase verification sequence

Use Node 22 and the managed test runner; do not start a manual dev server.

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use --silent 22

# Add one dedicated wrapper that owns start, build, generator, contract/drift,
# generated-artifact import, focused browser/docs proof, and cleanup in finally.
# It must pass this same environment to every run-playwright-suite invocation:
pnpm run test:e2e:interpretation-network:verify:local-supabase

# The wrapper performs, in one session:
# pnpm supabase:e2e:start:minimal → env → doctor → build:e2e →
# generator (INTERPRETATION_NETWORK_FIXTURE_OUTPUT_PATH) → contract → drift →
# focused chromium @flow/@visual import tests → optional docs screenshot generator →
# docs checks → finally pnpm supabase:e2e:stop.
pnpm docs:i18n:check
pnpm docs:gitbook-screenshot-assets:check
pnpm run docs:interpretation-network:check
```

The new `test:e2e:interpretation-network:verify:local-supabase` wrapper must be modelled on `runInterpretationNetworkFixtureGateLocalSupabase.mjs`: its `finally` owns the one stop operation, and every narrow call to `run-playwright-suite.mjs` receives `UNIVERSO_ENV_FILE=.env.e2e.local-supabase` plus `UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase`. It must not rely on `pnpm dev`, hard-coded random external URLs, fixed timing sleeps, or manual database setup. Use role/label/test-id locators and web-first assertions. Repeat critical fixture/import tests enough times to detect leaked state or race conditions.

## 8. Risks, mitigations, and review checkpoints

| Risk                                                                                                                      | Mitigation / exit criterion                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The brief's historic `rgb()`/`hsl()` and palette round-trip wording conflicts with disposable-data/no-legacy instruction. | This plan supersedes it with a small canonical hex contract; acceptance tests explicitly reject old persistence grammar.                                                                                                                                                                                      |
| Changing shared normalizers affects authoring and runtime callers.                                                        | Run impact analysis first, change one shared schema/normalizer, use focused integration tests in all three consumers, then verify the diff graph.                                                                                                                                                             |
| Retaining the obsolete scalar picker could preserve a hidden REF/preset compatibility surface.                            | Retire `CellStyleDialogField`, its FormDialog hook/metadata/types/tests and decoder after caller audit; one scoped grouped editor replaces it, with a final no-legacy search/fixture gate.                                                                                                                    |
| Client-only colour validation is bypassable.                                                                              | Apply the closed `format: 'hexColor'` normalizer in parent TABLE, child-row, copy/batch and sync/materialization writes. Test no mutation/partial batch after rejection and map a stable error code to localized UI text. Fixture/import metadata validation stays distinct from runtime user-row validation. |
| Splitter library drift, licence, bundle, or final DOM differs from documentation.                                         | Pin centrally only after due diligence; test DOM/keyboard/touch in Chromium, including bounded Home/End. Fallback must implement the whole accessible separator contract.                                                                                                                                     |
| Stored pane ratio would violate configuration ownership or leak user state.                                               | Persist only `enabled`; no layout callback/storage/network write; assert absence of mutation/local-storage writes.                                                                                                                                                                                            |
| A visually acceptable desktop layout breaks at narrow sizes.                                                              | Stack panes below breakpoint; test desktop/tablet/mobile and `scrollWidth <= clientWidth` for the page root.                                                                                                                                                                                                  |
| Template changes appear locally but are not materialized.                                                                 | Generator-only fixture refresh plus contract, drift, import-the-generated-artifact, and runtime visual proof.                                                                                                                                                                                                 |
| Documentation becomes unverified or EN/RU diverge.                                                                        | Pair edits, i18n/docs checks, and human QA screenshot inspection. Add the generator/manifest/provenance asset pipeline only when the guide actually embeds durable screenshots.                                                                                                                               |

## 9. Acceptance mapping to stakeholder requirements

| Stakeholder item                                              | Planned acceptance evidence                                                                                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. All Structure language variants on edit                    | Raw VLC resolver tests and RU→EN browser save/reopen/reload proof for Name and Description.                                                                                      |
| 2. Hide left-menu title by default                            | Template/fixture assertion `showTitle: false`; browser confirms no visible heading and named nav remains.                                                                        |
| 3. Breadcrumb beginning and trailing ellipsis                 | Full accessible-name/current-page plus constrained DOM/style assertions, then human-inspected screenshot and navigation/depth-collapse flow.                                     |
| 4. Arbitrary colour for every colour option                   | Six-field canonical contract, picker/hex/swatch/clear UI, backend/import validation, renderer and reload proof.                                                                  |
| 5. Text colour                                                | `TextColor`/preview metadata, model, all renderers/previews, theme-aware effective contrast policy, and visual/browser proof.                                                    |
| 6. Unified borders by default with per-side option            | Scoped grouped editor tests for all-side atomic writes, advanced override, and effective preview.                                                                                |
| 7. Parent Structure island above panes                        | `WorkspaceShell` parent header tests/screenshots; Back returns to the list and restores initiating-card keyboard focus.                                                          |
| 8. Edge-aligned visible selected border                       | All matrix renderers use in-bounds edge paint; focused visual/cropped screenshot test proves no clipping.                                                                        |
| 9. Optional bounded pane resize at metahub/application levels | One strict shared config through editor/app/runtime, transient 25–75 desktop interaction, reset, exact Arrow/Home/End keyboard values, touch context, disabled/mobile behaviour. |
| 10. Regenerate product snapshot when needed                   | UI generator → contract → drift → generated artifact import/runtime proof; snapshot only replaced from generator output.                                                         |

## 10. Approval checkpoints

This is ready for IMPLEMENT once the following product choices are approved:

1. Enable pane resizing in the fresh Interpretation Network template by default, with application settings able to disable it; retain 50/50 default/reset and 25–75% desktop bounds.
2. Adopt the canonical persisted `#RRGGBB | null` format and intentionally remove `CellColor`, REF decoding, `rgb()`/`hsl()`, and other legacy colour compatibility.
3. Use the scoped grouped cell-style editor and retire the old scalar `cellStylePicker` path; choose the centrally pinned `react-resizable-panels` release only after the dependency gate passes.
4. Apply the blocking theme-aware effective-contrast rule plus non-throwing maximum-contrast runtime display fallback described above.

No product implementation should start until these decisions are confirmed or adjusted in an explicit `IMPLEMENT` request.
