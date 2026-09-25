---
description: Entity records own widget content; layout instances own composition and presentation through validated semantic bindings.
---

# Entity-backed widgets

Widgets are authoring and presentation interfaces. They compose the application and expose only the presentation controls declared by their registry definition. Business and editorial content remains in records of the platform's existing Entity types, normally Objects with Components. This contract does not add an Entity kind or a second page-builder data model.

![Published marketing-page runtime rendering Hero content from an Entity record](../.gitbook/assets/marketing-page/marketing-page-runtime-en-light.png)

## Ownership

| Layer                     | Owns                                                                                  | Does not own                                          |
| ------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Metahub                   | Entity schemas, canonical seeded content, source widget placements and their bindings | Deployed-application presentation overrides           |
| Application control panel | Deployment-wide presentation overrides and exclusions                                 | Entity content or source binding identity             |
| Published application     | A validated, read-only runtime projection of the published records                    | Authoring or arbitrary Entity-table access            |
| Workspace                 | User-authored runtime data where a feature explicitly defines that lifecycle          | Source-owned Hero content in the marketing-page pilot |

For the marketing-page pilot, `MarketingPageHero` is the canonical standard Object. One `default` record is seeded, while `marketing.hero` remains repeatable. Adding a Hero normally creates a fresh Entity record and its placement in one transaction; duplicating a Hero clones the source record into a new record before binding the new placement. Advanced source settings let an author deliberately reuse an existing compatible record or provision a separate compatible Object whose Components follow the registered Hero slot contract. Deleting a placement never deletes its record. The `default` record and any live-bound record cannot be deleted or have their semantic key changed.

## Binding contract

The widget registry declares the required slots, cardinality, capabilities and semantic Component projection. A persisted widget instance stores the selected target in its reserved `__layout.bindings` metadata. The versioned envelope uses semantic Entity/Component codenames and a bounded semantic-key selector; it contains no physical table names, row UUIDs, Component UUIDs, SQL identifiers or executable query fragments.

The widget `instanceKey` identifies one composition instance. A binding selector identifies its content record. These identities are independent: the default add/duplicate flow gives repeated placements distinct records, while advanced source selection can deliberately share one compatible record. When a record is already used by another Hero placement, the authoring UI reports that shared usage before rebinding or editing so the author knows that record changes affect every consumer.

The server validates every binding against the registered slot, Entity capabilities, Component metadata, selector policy, projection and cardinality. The client cannot grant access by submitting a codename or a forged binding. Authenticated authoring APIs enforce their existing metahub/application permissions. Application presentation mutations preserve the trusted source binding and cannot replace it.

## Lifecycle and runtime boundary

Bindings travel with the widget instance through seed, layout snapshots, restore, publication, application materialization, source synchronization, reset and effective-layout resolution. Canonical ordering and semantic hashing make equivalent bindings stable while preserving conflict detection. Copying a Hero-containing layout into an application is rejected for this pilot because it would create an application-owned, unbound source.

Authenticated and anonymous published runtimes use bounded server-side loaders over the existing SQL-first data-access boundary. They resolve semantic selectors to an allowlisted, localized view model; public output contains only approved content and remains `Cache-Control: no-store`. Published clients receive that typed view model and never query persistence directly. The Hero DTO preserves the established outer `data.records` envelope and contains exactly one `heroContent` record with a nested bounded `content` projection; no Entity row identifier or persistence metadata crosses the boundary. Generic runtime-row write endpoints reject writes to source-owned Hero records.

The public route `/public/applications/:applicationRef/runtime` keeps its path, while the Hero payload intentionally replaces the former `siteSettings`/`sectionCopy` fields with `heroContent`. This is a breaking clean-cutover contract with no compatibility DTO. Deploy the backend and `@universo-react/apps-template-mui` runtime client together; stale clients expecting the former Hero payload are unsupported.

Content editing reuses the normal Object record list and dynamic record form. The ordinary **Add Hero** and **Duplicate Hero** actions provision independent Entity content automatically, without a binding wizard. The binding editor remains available as an advanced path: it can select another compatible Object/record, provision a separate compatible Object from the registered field contract, and link to the standard Components surface for further metadata customization. Presentation editing uses the shared layout configuration primitives. All labels, validation, shared-source warnings and denied states are localized. No normal user surface displays binding JSON, storage codenames or technical identifiers; the Object codename is exposed only inside the explicit advanced model-provisioning form.

## Marketing Hero pilot contract

-   The canonical content model is the seeded `MarketingPageHero` Object whose Components define localized title, accent, description, labels and typed actions. Advanced authoring may provision or select another Object only when its record policy and Components satisfy the same registered `marketing.hero/content` slot contract.
-   `marketing.hero` stays repeatable and owns placement, order, active state and presentation such as `showLeadForm`.
-   A required `content` slot projects only registered semantic fields from a validated Object record.
-   Adding a new Hero automatically creates and binds a fresh record in the canonical source; duplicating a Hero automatically clones its bound record into the same compatible source. Record creation, semantic-key generation and placement insertion commit atomically.
-   Advanced source settings are opt-in. They can bind an existing compatible record or provision a separate compatible Object and initial record. Explicitly sharing a record shows a usage warning because edits are visible through every placement bound to that record.
-   Hero content is removed from `MarketingPageSiteSettings` and the obsolete `MarketingPageSection/hero` copy path; no compatibility reader remains.
-   Application layouts can tune or reset presentation but cannot edit content or rebind the source-owned Hero.
-   New placement assignment uses an explicit auto/existing content mode, validates UUID v7 and layout versions, and keeps automatic record creation in the layout transaction. The authenticated rebind endpoint continues to accept `{ recordId, expectedVersion }` for an existing placement. Hero authoring enforces required English and Russian text and keeps optional localized fields all-or-none by locale.
-   The authoritative Hero record policy is server-managed for the canonical and provisioned compatible Objects: generic metadata edits cannot weaken runtime write denial, deletion protection or the immutable binding key; incompatible Objects fail closed.
-   No database migration or schema/metahub-template version increase is required; the test database is recreated from the clean seed.

**Clean cutover required:** Existing marketing-page metahubs, layouts, snapshots, publications and applications are not converted automatically. Use the new contract by creating a metahub from the current template seed, publishing it, and creating a new application from that publication. Recreate the disposable test database from the current seed. No compatibility reader or automatic data migration is provided.

The bilingual user workflow and current seed fields are documented in [Marketing Page Template](../platform/marketing-page-template.md).
