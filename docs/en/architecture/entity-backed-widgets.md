---
description: Entity records own widget content; registry slots and layout placements define safe composition and presentation.
---

# Entity-backed widgets

Widgets compose a layout and expose the presentation controls registered for that widget. Content-bearing widgets resolve their content from ordinary platform Entity records, normally Objects with Components. This contract does not add a page-builder content store or a new Entity kind.

![Published marketing-page runtime rendering Entity-backed widget content](../.gitbook/assets/marketing-page/marketing-page-runtime-en-light.png)

## Ownership

| Layer                         | Owns                                                                                              | Does not own                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Metahub                       | Entity schemas and records, canonical seed data, source widget placements, and binding selections | Deployment-specific presentation overrides             |
| Application control panel     | Registered presentation options and permitted activation, order, and placement overrides          | Metahub content, source selection, or binding identity |
| Published application runtime | A validated, bounded read projection of the authorized Entity records                             | Authoring or arbitrary Entity-table access             |
| Workspace                     | Runtime-authored content only when a feature explicitly defines that lifecycle                    | A duplicate of source-owned Marketing Page content     |

The widget registry is the cross-package contract. Definitions declare compatible templates and zones, binding slots, source and result cardinality, required Entity capabilities and Component semantics, ordering and visibility roles, record policies, allowed authoring operations, and presentation fields. These declarative slot definitions are separate from the binding instance stored on each placement.

Renderer configuration carries presentation. The versioned binding envelope is stored in reserved neutral layout metadata (<code>\_\_layout.bindings</code>), not as renderer content. Application materialization preserves the trusted source envelope separately from local presentation state.

## Safe selector contract

Bindings use a strict discriminated union with three selector kinds:

| Selector                  | Meaning                                                                     | Persisted selector shape                                             |
| ------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| <code>semantic-key</code> | Select one record by a registered semantic Component and value              | <code>{"kind":"semantic-key","field":"key","value":"default"}</code> |
| <code>record-set</code>   | Select the bounded record set exposed by one compatible Entity source       | <code>{"kind":"record-set"}</code>                                   |
| <code>relation-set</code> | Select the bounded child set related to the source selected by another slot | <code>{"kind":"relation-set","parentSlot":"tiers"}</code>            |

A binding target identifies an Entity kind and semantic codename. Its projection must match the Component projection declared by the slot registry. Clients cannot supply SQL, physical table or column names, row UUIDs, arbitrary filters, relation predicates, ordering rules, visibility rules, or a renderer-authored projection. The authoring UI presents localized source and record labels rather than binding JSON or storage identifiers.

Compatibility is checked against the slot's required Entity capabilities and Component types, validation rules, and relation target. A declared Entity-kind restriction may narrow compatibility. Built-in Marketing Page codenames identify default seed sources; a compatible source does not require a new entry in a central Marketing codename allowlist.

For current Marketing Page placements, each required slot selects exactly one source target. The selector determines how many rows that source can resolve: a semantic key resolves one record, while a record set or relation set resolves an ordered set. Registry-owned <code>maxResolvedRecords</code> and the shared resolver ceiling bound that result. Registered ordering and visibility Components are applied before the limit; a placement's <code>maxItems</code> can reduce the result further but cannot raise the hard limit. Set-like binding metadata is canonicalized for stable hashes without changing Entity record order.

## Marketing Page slot contract

Before a Marketing snapshot is published, imported, restored, activated, or synchronized, validation checks selected record values against registered Component requirements as well as checking the binding envelope. It verifies required values, data types, field limits and patterns, required English and Russian values for localized Components, safe media/action formats, and every relation-set child reference. Invalid records fail closed before they reach the published runtime.

The built-in template seeds 14 placements. Eleven placements have Entity bindings; the authentication, language, and color-mode controls are host capabilities without editorial source data.

| Placement                                                     | Binding slots                                                                                                                                                | Metahub add and duplicate behavior                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| <code>marketing.brand</code>                                  | <code>site</code>: semantic record in <code>MarketingPageSiteSettings</code>                                                                                 | Seeded singleton                                                 |
| <code>marketing.navigation</code>                             | <code>items</code>: ordered <code>record-set</code>                                                                                                          | Select a compatible source; duplicate shares the binding         |
| <code>marketing.auth</code>                                   | None; host-derived                                                                                                                                           | Singleton                                                        |
| <code>languageSwitcher</code>, <code>colorModeSwitcher</code> | None; host-derived                                                                                                                                           | Existing shared-widget behavior                                  |
| <code>marketing.hero</code>                                   | <code>content</code>: semantic record                                                                                                                        | Create or select a record; duplicate clones the bound record     |
| <code>marketing.image</code>                                  | <code>content</code>: semantic record in <code>MarketingPageImage</code>                                                                                     | Create or select a record; duplicate clones the bound record     |
| <code>marketing.collection</code>                             | <code>section</code>: semantic record; <code>items</code>: <code>record-set</code>                                                                           | Select sources for the chosen variant; duplicate shares bindings |
| <code>marketing.pricing</code>                                | <code>section</code>: semantic record; <code>tiers</code>: <code>record-set</code>; <code>benefits</code>: <code>relation-set</code> over <code>tiers</code> | Select sources; duplicate shares bindings                        |
| <code>marketing.footer</code>                                 | <code>site</code>: semantic record; <code>links</code>: <code>record-set</code>                                                                              | Select sources; duplicate shares bindings                        |

The pricing benefit REF Component (<code>TierRef</code>) points to the authoritative pricing tier record ID. Runtime relation selection uses those record IDs; the tier's semantic key is not a second relation identity.

## Authoring, permissions, and lifecycle

Metahub Add, Edit, Duplicate, and Rebind behavior comes from registry capabilities. Semantic-record slots use a human-readable record picker and may offer create/edit actions. Record-set slots choose an Entity source; rows, order, and visibility are managed through normal Entity record authoring. Relation-set slots declare their parent slot and use the normal REF editing contract for child records. Changing a parent source requires the dependent relation to remain compatible before saving.

After choosing a compatible source, an author can create a separate empty source model for that slot. The server creates a normal Object in the Marketing Page Hub and copies only the registered Component schema and its presentation metadata through the existing Entity services. It does not copy records. For a relation slot, the new REF Component targets the selected parent Object. Records are then authored through the ordinary Entity record workflow.

Hero and Image duplication clone the selected Entity record and bind the new placement to that clone in one backend transaction. The copy uses the ordinary record validation and unique-key rules; if placement creation fails, the record copy rolls back with it. Collection, Navigation, Pricing, and Footer duplication shares their source bindings; it does not clone the source rows. Singleton capabilities do not offer duplication. Removing a widget placement does not delete its Entity records. Registry record policies and Entity integrity checks protect required fields, semantic keys, live bindings, and relation targets.

Metahub layout and content permissions are checked by the authoring UI and revalidated by the server. A visible control is not an authorization boundary. Binding writes validate the complete registered slot set, resolve compatible active Entity metadata under the layout graph lock, and use optimistic layout versions.

Application source-managed Marketing placements are presentation-only: Application writes cannot add or duplicate a required-bound placement, edit its Entity content, or replace its binding. The editor hides Add and Duplicate for these source-owned placements. When a placement has a customized presentation and a source baseline, the editor offers Reset to source. Use Metahub authoring for placement and content changes, then publish and synchronize the already linked application.

Publication, snapshots, restore, and application synchronization preserve the placement binding envelope. Application source state keeps the trusted source config and a complete baseline for editable renderer presentation, activation, sort order, zone, and logical placement. Sync compares these semantic fields and Reset restores the current source baseline while retaining the inherited binding.

Scoped Marketing overlays inherit binding identity from the resolved base placement. Overlay rows and imported snapshots may carry only permitted presentation and placement changes; binding envelopes are rejected at the overlay write and transport boundaries, while materialization and binding-reference checks use the base placement as the single authority.

When a source layout is removed, an Entity-bound placement cannot be copied into application ownership. The diff marks that copy unavailable, and persistence rechecks the rule before writing. Choosing <code>keep_local</code> preserves source lineage, deactivates the removed layout, and tombstones its dependent widgets in the same transaction; a later safe resync can restore them. Choosing <code>skip_source</code> explicitly retains the current application state.

## Runtime DTO boundary

Authenticated and public Marketing runtimes use the same registry validation, selector, relation, ordering, visibility, projection, and hard-limit semantics. They inject different authorized persistence loaders: the authenticated path uses the current application/workspace scope, while the public path reads only the published data allowed by the public runtime boundary.

The resolver hands typed semantic records to Marketing adapters. Strict runtime schemas validate the final DTO. Public DTOs contain only allowlisted content and safe media projections; they omit physical Entity and Component identities, binding envelopes, table metadata, and arbitrary row data. Public ResourceSource media must resolve to an allowed URL. Invalid bindings, missing required sources, invalid relations, or malformed DTOs fail closed.

The public Marketing DTO requires <code>headerPosition</code> and <code>headerWidgets</code>. Layout-copy requests use the strict <code>entityBindingCopyMode</code> field. This is a coordinated clean-cutover contract: deploy the server and bundled clients together; earlier payload and request shapes are not supported, and no compatibility fallback is provided.

Authenticated Marketing runtime responses expose only the effective layout version and content hash needed for stale-layout refresh checks. Physical layout IDs and source-lineage IDs or hashes remain internal to the runtime request and are not serialized.

<code>@universo-react/apps-template-mui</code> consumes the typed <code>data.records</code> view model and renders it without importing persistence or querying Entity tables. It does not read the retired Marketing <code>source</code> or <code>copySource</code> contract.

## Localization

Localized Entity Components remain the content authority. Slot policies declare required locales; Marketing snapshot validation requires both English and Russian content for localized fields. The Metahub source and record pickers, editor labels, empty/loading states, validation, permission failures, and conflicts use the English and Russian translation resources. The runtime selects localized content through the shared Marketing DTO contract.

## Related documentation

-   [Marketing Page Template](../platform/marketing-page-template.md)
-   [Application Layouts](../guides/application-layouts.md)
