# Research: Interpretation Network Configuration and Runtime UX

> Created: 2026-07-13
> Status: Reviewed after QA on 2026-07-14
> Trigger: `RESEARCH` request for the Interpretation Network configuration and runtime UX brief.
> Follow-up plan: To be created in PLAN mode.

## Research Question

What implementation decisions will make the Interpretation Network template-based published workspace meet the requested multilingual editing, styling, hierarchy, layout, and fixture requirements while preserving the `apps-template-mui` boundary and avoiding a schema or template-version increase?

The decision applies to a fresh disposable test database. It must therefore favour a coherent current contract over compatibility shims for historic seeded records.

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
|---|---|---|---|
| Stakeholder request for Interpretation Network runtime UX | Stakeholder source | 2026-07-13 | Defines the ten requested outcomes and explicit no-legacy/no-version-bump constraints. |
| Interpretation Network configuration/runtime UX brief | Project brief | 2026-07-13 | Provides the intended cross-layer scope and template-first boundary. |
| `packages/universo-react-apps-template-mui/README.md` and runtime/template/test sources cited below | Project primary source | Re-inspected 2026-07-14 | Establish current behavior, architectural seams, materialized-layout ownership, runtime write validation gaps, and fixture path. |
| `https://mui.com/material-ui/react-breadcrumbs/` and Context7 `/mui/material-ui` | Primary vendor documentation | Re-verified 2026-07-14 | Confirms labelled breadcrumb navigation, Tooltip naming behaviour, and end-ellipsis CSS requirements. |
| `https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/` | Primary accessibility guidance | Accessed 2026-07-13 | Confirms breadcrumb landmark, parent navigation, and current-page semantics. |
| `https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/` | Primary accessibility guidance | Accessed 2026-07-13 | Defines the keyboard and ARIA contract for a resizable pane separator. |
| Context7 `/bvaughn/react-resizable-panels` | Primary project documentation via Context7 | Re-verified 2026-07-14 | Documents current `Group`/`Panel`/`Separator` APIs, bounds, keyboard support, disabled separators, and layout reset through `setLayout`. |
| `https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/color`, `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value`, and Context7 `/mdn/content` | Primary web-platform documentation | Re-verified 2026-07-14; CSS color page last modified 2026-04-20 | Shows that both CSS and modern color inputs accept more than a safe persisted application contract; application validation must define the limited format. |
| `https://lmn.rs/` and `https://lmn.rs/krugozor/iz/124.html` | External comparison source | Accessed 2026-07-13 | Confirms the domain precedent for table/grid presentation with independently meaningful fill, text, and border colour; it is not an implementation source. |
| `https://github.com/movefasta/elm-suz-dal` | Historical comparison source | Accessed 2026-07-13 | Confirms only historical two-pane, breadcrumb, and coloured-cell concepts; no identity, terms, Elm code, or deployment design may be ported. |
| `.backup/elm-suz-dal-master` | Local historical comparison source | Inspected 2026-07-14 | Confirms the historical breadcrumb, fill/text/border, and selection concepts. Its terms, IPFS model, implementation, and right-edge-only `CheckedCell` selection treatment are explicitly non-transferable. |

## Key Findings

### 1. The multilingual edit defect is an initial-data resolver bug, not a dialog limitation

- Fact: `useInterpretationNetworkWorkspaceState.ts` builds `structureInitialData` with only `editingStructure?.[field.id]`.
- Fact: `toFieldConfig` assigns `id` from the runtime physical field, while a returned row may contain the complete Versioned Localized Content (VLC) under its codename, component ID, physical key, or nested `row.data`.
- Fact: `FormDialog` and `LocalizedInlineField` already show all active locales when they receive the complete VLC object. The structure update mutation forwards the submitted object rather than intentionally reducing it to the active locale.
- Inference: a reusable runtime-field resolver is the narrow correct repair. It must check de-duplicated field ID, codename, component ID, matched runtime-column ID/codename/physical key, both on the row and in `row.data`, and must return the raw value rather than formatted locale text.
- Existing related pattern: `matrixCellData.ts` already falls back through several keys for a cell edit; it is a useful starting point but does not yet cover `row.data` and all structure-field identities.

### 2. The unwanted navigation heading is a template default

- Fact: `interpretation-network.template.ts` seeds `menuWidget.config.showTitle: true` with the localized Interpretation Network title.
- Fact: `MenuContent` renders the visible title only when that flag is true, while its navigation label can still use the menu title when the visible heading is hidden.
- Decision implication: change only the Interpretation Network template default to `false`; retain the generic menu-title capability and accessible navigation name. Update the template-shape test, fixture contract, and generated snapshot. The existing fixture contract currently verifies menu entries but not this flag.

### 3. Long breadcrumb labels require a separately constrained text child

- Fact: `HierarchicalMatrixTableView.tsx` already labels `Breadcrumbs`, applies `whiteSpace: 'nowrap'` and `textOverflow: 'ellipsis'`, and separately supports finite-depth path collapse.
- Fact: its breadcrumb buttons still contain the title directly, and MUI buttons centre content by default. The constrained parent alone can therefore expose a middle slice rather than a reliably start-aligned end ellipsis.
- Decision implication: preserve the full path/depth-collapse mechanism, but render each visible label in a start-aligned, min-width-zero inner text element with end ellipsis. Give an interactive crumb the complete `aria-label`; wrap it in a MUI Tooltip with `describeChild` so the tooltip supplements rather than replaces that name. Keep `aria-label` on the `Breadcrumbs` landmark and `aria-current='page'` on the current item.

### 4. The present colour model cannot meet arbitrary-colour requirements

- Fact: the current 22 shared TABLE child components use `REF` fields targeting the `CellColor` enumeration for fill and each border side. `CellStyleDialogField`, `model.ts`, and `tabularColumns.tsx` resolve only those named preset IDs.
- Fact: there is no `TextColor` field or renderer path. Matrix buttons, hierarchical table cells, and previews currently force theme `text.primary`.
- Fact: both `InterpretationMatrix` and `TemplateMatrix` reuse the same child-component array, so one metadata change changes both contracts. Their `maxChildComponents` validations and fixture checks must remain exactly synchronized.
- Fact: CSS `<color>` accepts functions, relative/device colours, variables, keywords, and other grammar that is unsuitable for a small deterministic persistence contract. A native `<input type='color'>` supports the required simple picker but should not be treated as permission to persist arbitrary CSS.
- Fact: the runtime child-row create and update paths call `coerceRuntimeValue`, but its current `STRING` branch verifies only the type; it does not enforce `validationRules.pattern`. `MetahubRecordsService` has a pattern validator, but it is not the published-application child-row write path. Server-side colour validation is therefore new required work, not an existing protection.
- Recommended current-data contract: make the existing five colour fields bounded nullable `STRING` values and store canonical opaque `#RRGGBB` only when a color is selected; use the old named palette solely as UI shortcuts that produce the same canonical value. Add one nullable `TextColor` `STRING` field to the shared child definition, making the field count 23. `null`/absence means no fill, transparent/no explicit border colour (with width/style still deciding whether a border is visible), or the theme default text colour respectively. This preserves the existing `none`/reset semantics without a second colour grammar.
- Put a pure `#RRGGBB | null` colour parser/normalizer at a neutral shared boundary (for example, `@universo-react/types`); it must not import DOM controls or VLC/UI resolvers. It may expand user-entered `#RGB`, but persists one chosen `#RRGGBB` casing only, and rejects `#RGBA`, `#RRGGBBAA`, CSS functions, names, variables, URLs, expressions, and raw JSON. Do not persist `rgb()` or `hsl()` merely because CSS or a particular user agent accepts them. Do not opt into `alpha` or `colorspace` on the native input. The runtime backend must invoke this contract for exactly six designated Matrix TABLE child fields (fill, `TextColor`, and four border colours) before create/update; template/fixture validation and snapshot restore/import must invoke it for the same fields. A localized Clear/Reset action, native picker, textual hex readout/input, and palette swatches must all use that same normalizer.
- `TextColor` must flow into `MatrixCell.style`, `MatrixCellButton` including its drag overlay, `MatrixTableView` for independent axes, `HierarchicalMatrixTableView` including its header card, and `tabularColumns` previews. Breadcrumb pills are navigation, not cell content: keep their theme/navigation semantics and separately test their contrast against a cell-coloured background.
- A contrast result must be calculated from canonical colours: normal cell text needs 4.5:1 at WCAG AA, large text needs 3:1, and non-text UI/focus/selection indicators need 3:1. Colour cannot be the only state signal. PLAN must choose a deterministic failing-contrast policy—block save or replace the attempted pairing with an announced safe pairing; a localized non-blocking warning alone is insufficient. The non-colour focus and selection treatments remain mandatory.
- This corrects the brief's broad `#hex`/`rgb`/`hsl` acceptance wording: the requested simple arbitrary-colour editor is fully satisfied by a safe hex-only persistence contract.

### 5. Unified borders belong in a grouped editor, not a new stored mode

- Fact: the current `CellStyleDialogField` is invoked once per scalar field and changes only the current fill or one border side. `CellEditDialog` maps the existing style fields independently.
- Decision implication: create a grouped style editor at the cell-dialog level. Its default presentation has one border colour/width/line-style control that writes all four existing side fields atomically. An explicit “edit sides separately” mode reveals the four per-side controls; unequal existing values should open or visibly indicate that advanced state.
- No `BorderMode` persistence field is necessary. This keeps the stored representation simple, makes the requested default real, and preserves individually styled borders.

### 6. Selected-cell visuals are deliberately inset in two renderers

- Fact: `MatrixCellButton.tsx` and `HierarchicalMatrixTableView.tsx` both draw selection with an `::after` pseudo-element using `inset: 3` inside an `overflow: hidden` card.
- Decision implication: use an edge-aligned in-bounds selection paint (`inset: 0` or an inset box shadow) in both paths. Do not use an outward outline for the selection state, because ancestor clipping is the historic failure mode. Preserve a separate keyboard `:focus-visible` indication and drag/drop states. The local historical `CheckedCell` highlights only a right edge, so it is not a visual implementation model for the requested complete boundary.

### 7. The parent Structure surface belongs in `WorkspaceShell`

- Fact: the selected Structure title and back action currently live inside `StructurePane`, while `WorkspaceShell` only renders the equal-width structure/details row.
- Decision implication: lift the selected Structure title and back action into a dedicated outlined parent header above the two panes, supplied by `WorkspaceShell` props. Keep the unselected list view intact and retain responsive stacking. This satisfies the ownership relationship without introducing a configuration-specific dashboard shell or importing legacy template code.

### 8. Split-pane behavior needs one strict shared configuration and transient runtime state

- Fact: `packages/universo-react-types/src/common/interpretationNetworkLayout.ts` already owns the strict widget Zod schema and configuration normalizers. It has no split-pane schema today.
- Fact: metahub widget editing and application settings independently normalize/parse/save the current matrix settings. Application Settings reads the active materialized widgets, allow-lists their configuration, and batch-saves a complete effective configuration to every active Interpretation Network widget. Runtime `toConfig` consumes only that materialized widget configuration plus code fallbacks; it does not dynamically query or merge its metahub source.
- Correct lifecycle: **metahub template seed/source default → materialized application-local effective widget configuration → runtime**, plus a user's transient in-memory pane size. The application's effective configuration initially equals the seed, but application-local edits replace it. Reset restores the resolved application-effective default; it equals the seed only until application-local changes exist. User dragging must not write either configuration and, because the requirement calls it transient, must not enable a persistence callback or browser storage by default. Dynamic inheritance/source sync would be a new explicit model, requiring conflict semantics and tests; it must not be assumed from the three-layer ownership model.
- Recommended initial bounds: 25–75% on desktop, equal 50/50 default, and no interactive separator when disabled or when the small-screen layout stacks. PLAN should confirm these particular bounds against the longest supported Materials content.
- WAI-ARIA requires a focusable, named separator with value/range semantics and keyboard operation. If the dependency is approved, the currently documented `react-resizable-panels` `Separator` provides pointer, touch, keyboard, range attributes, and a disabled state; the application must still prove the final DOM has stable left/right panel IDs, a named `role='separator'`, `aria-controls`, range values, a 24px target, and keyboard Arrow plus Home/End behavior. The implementation must use an `aria-labelledby` primary-pane heading or a localized `aria-label`; an optional Enter/double-click policy cannot replace an explicit action. Reset must be a visible localized control calling `groupRef.current.setLayout(effectiveDefaultLayout)` with the stable IDs. Test disabled/no-separator state, touch/pointer resizing, keyboard resizing, and stacked mobile fallback. The dependency is not installed in `apps-template-mui`, so PLAN must pin and re-verify its exact version, API, licence, bundle impact, and MUI-style integration. If it is rejected, PLAN must explicitly budget the complete WAI-ARIA Window Splitter implementation rather than shipping pointer-only dragging.

### 9. The fixture delivery pipeline already exists and must be extended, not recreated

- Fact: the existing path is product Playwright generator → `interpretationNetworkFixtureContract.ts` → normalized fixture-drift check → imported-snapshot/smoke/visual runtime flows. Root scripts include the local-Supabase fixture gate.
- Fact: the imported-snapshot flow already asserts equal desktop panes; the visual spec currently captures only an empty workspace. Neither is sufficient for the requested populated Structure header, long breadcrumb, colour, outline, and resize evidence.
- Decision implication: regenerate `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` only through the product generator after its UI/seed contract has materially changed. Extend the existing contract for the hidden menu title, nullable `#RRGGBB` colour-field contract, `TextColor`, child count, and split-pane default. Add negative runtime/API and snapshot-import coverage for malformed hex, `rgb()`, `url()`, CSS variables, and raw JSON. Add source-sync/conflict coverage proving that an application-local split setting remains the runtime effective setting unless a separately designed sync operation deliberately resolves the conflict. Extend unit/component and browser evidence for all new behavior rather than editing the snapshot manually.

### 10. Template-first architecture remains compatible with the requested refactor

- Fact: the published application is already rendered through `packages/universo-react-apps-template-mui`; the package is intentionally isolated from legacy `template-mui` and feature-package imports.
- Decision implication: extract reusable primitives inside `apps-template-mui` or stable shared types where both authoring and runtime need them. Do not import `react-color` from authoring packages, recreate a legacy Elm surface, expose field IDs/JSON, or preserve obsolete colour-ID compatibility merely for the disposable database. The brief's request to preserve historical palette references conflicts with this requirement: PLAN must remove historical `REF` decoding and either remove the now-unreferenced `CellColor` enumeration or retain it solely as documented template palette metadata, never as record compatibility.
- Existing behavior to retain: hierarchy-first Table default, click-up breadcrumbs, finite-depth collapse, root/no-selection recovery, and the horizontal toolbar default. These were delivered before this brief and remain part of the user-facing contract.

## Conflicts And Uncertainty

- The brief currently mentions testing arbitrary `#hex`/`rgb`/`hsl` values. MDN evidence shows that a browser can accept wide CSS colour grammar; this research supersedes that broad acceptance with persisted `#RRGGBB | null` only. PLAN should update the acceptance wording before implementation.
- The brief asks for legacy palette round trips, but the stakeholder explicitly allows a disposable test database and no legacy code. This research chooses no historical record compatibility; PLAN must decide whether an unreferenced `CellColor` enumeration is removed or kept only as palette documentation.
- `react-resizable-panels` is not in the workspace dependency graph. Its documented APIs make it a candidate lower-risk accessibility choice, but the exact dependency version, licence, bundle impact, and MUI integration are not yet approved. A CSS-only alternative is valid only with the full Window Splitter keyboard/ARIA contract.
- The stakeholder specified a bounded resize range but not numbers, nor whether the resolved 50/50 default must become an explicit configurable ratio. The 25–75% recommendation is a starting product decision, not a discovered requirement.
- The platform's layer placement identifies ownership, not live inheritance. Today a template config is materialized into the application. If a later metahub-to-application refresh is intended to alter an application-local split setting, PLAN must first define explicit sync timing, conflict resolution, and user-facing consequences.
- `lmn.rs` and the historical Elm repository establish domain and interaction precedent only. Their terminology, HTML/Elm implementation, deployment assumptions, and product identity are explicitly outside scope.
- Current screenshot coverage cannot prove the proposed visual behavior until the populated workspace scenario is added; no claim of browser implementation verification is made by this research artifact.

## Project Implications

### Ownership and configuration

| Concern | Owning layer | Main implementation surfaces |
|---|---|---|
| Seed/source defaults: hidden menu title, colour-field shape, palette metadata, and initial split setting | Metahub template | `interpretation-network.template.ts`, `interpretation-network.stage2.ts`, template-shape tests |
| Materialized, application-local effective split setting | Application control panel | `MatrixSettingsPanel.tsx`, `ApplicationSettings.tsx`, shared normalizer and batch widget-config save |
| Structure data, selection, transient in-memory pane width, header and matrix interaction | Published workspace | `InterpretationNetworkWorkspaceWidget.tsx`, workspace state/content/shell and matrix renderers |
| Configuration schema and normalization, not live inheritance | Shared types | `interpretationNetworkLayout.ts` |
| Generated proof of a fresh configuration | Product E2E pipeline | generator, fixture contract, drift checker, imported-snapshot and visual specs |

This placement follows the platform's metahub → application → workspace ownership model. No new entity preset, schema migration, template version, or legacy compatibility layer is required for a fresh test database.

### Required cross-cutting updates

- Add a shared raw-field/VLC resolver and unit coverage for top-level and nested `row.data` identities.
- Define one pure shared `#RRGGBB | null` parser/normalizer and add a runtime-backend validator/normalizer for exactly six designated Matrix TABLE child fields (fill, `TextColor`, four border colours); the present generic runtime `STRING` coercion does not enforce a pattern. Enforce the contract in the picker, runtime child-row create/update, template/fixture generation, and snapshot restore/import; client validation is not the trust boundary. Add negative API/import tests for malformed hex, `rgb()`, `url()`, CSS variables, and raw JSON. Replace colour-ID-only normalization in `MatrixCellButton` and drag overlay, `MatrixTableView`, `HierarchicalMatrixTableView` including its header card, and `tabularColumns` previews. Preserve breadcrumb contrast and navigation semantics independently from `TextColor`.
- Keep the full cell-style editor free of raw JSON and internal field names, with localized labels and errors.
- Add one shared split-pane schema/normalizer and wire it through the metahub editor, `MatrixSettingsPanel` type/local state/dirty state, Application Settings parse/allow-list/equality/batch-save/cache paths, runtime `toConfig`, seed, fixture contract, and tests. The materialized application widget config, not a runtime metahub lookup, supplies the effective default.
- Add browser evidence at desktop, tablet, and mobile sizes; verify keyboard navigation/resize (Arrow, Home/End, named separator, range and controls attributes), pointer/touch resize, visible Reset, disabled/no-separator and stacked fallback, no page-level horizontal overflow, EN/RU localized structure editing, and visible selection boundaries.

## Recommended Decision

Proceed to PLAN with these decisions as the baseline:

1. Repair Structure edit with a shared full-VLC runtime-field resolver; do not redesign `FormDialog`.
2. Set only the Interpretation Network template menu title default to hidden while retaining menu accessibility.
3. Implement start-preserving breadcrumb end ellipsis with full accessible labels, independent from path-depth collapse.
4. Replace palette `REF` storage with a nullable canonical `#RRGGBB` `STRING` colour contract, retain presets only as UI shortcuts, add nullable `TextColor`, and use a native simple colour input plus a Clear/Reset action in a reusable `apps-template-mui` control. Add the missing pure shared and runtime-backend validation at child-row write and snapshot/import boundaries; do not accept historical `REF` values, arbitrary CSS, `rgb()`, or `hsl()` persistence. Apply `TextColor` to all Matrix, table, header, drag-overlay, and preview renderers, while keeping breadcrumbs as separately accessible navigation. Remove `CellColor` or retain it only as documented palette metadata, never as legacy-record compatibility.
5. Implement default all-edge border editing as an atomic grouped dialog operation; reveal per-edge controls only on explicit advanced selection or unequal saved values.
6. Move only Structure-parent controls (title/back) to an outlined `WorkspaceShell` header and repair selection paint in both matrix renderers with an unclipped, in-bounds edge treatment.
7. Add `splitPane` configuration to the shared schema with enabled flag, default 50/50 layout, bounded desktop range, materialized application-local effective setting, responsive stacking, and transient user-local size. Treat the metahub value strictly as the materialized source default, not a live runtime override. If the dependency is approved after review, use the then-verified splitter API with stable panel IDs, a named keyboard-accessible separator, and explicit `setLayout` reset action.
8. Extend the existing generator/contract/drift/import/visual proof chain and regenerate the tracked fixture only through the generator after materialized defaults change.

## Open Questions Before PLAN

- Which splitter implementation and exact version are approved after dependency, licence, bundle, accessibility, and MUI-style review?
- Are 25–75% desktop bounds acceptable for the longest Matrix and Materials content?
- Is 50/50 always the resolved default, or should metahub/application configuration carry an explicit default ratio?
- Does a failing text/fill contrast ratio block saving or trigger an announced safe automatic correction? A warning alone is not sufficient; either answer must preserve non-colour focus and selection indicators.
- After the `REF` removal, should the unreferenced `CellColor` enumeration be deleted or retained solely as documented palette metadata?
- If a future metahub-to-application source refresh is introduced, what explicit sync moment and conflict policy prevent it from silently overwriting application-local split settings?

## Sources

- https://mui.com/material-ui/react-breadcrumbs/
- https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
- https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
- https://github.com/bvaughn/react-resizable-panels
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/color
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value
- https://lmn.rs/
- https://lmn.rs/krugozor/iz/124.html
- https://github.com/movefasta/elm-suz-dal
