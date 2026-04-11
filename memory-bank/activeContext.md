# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Entities QA Closure Remediation Closed

- The 2026-04-11 entities QA closure pass is fully implemented and validated on the current tree.
- Generic custom-entity `create` now crosses the same transaction-aware lifecycle boundary as update/delete/copy by routing through `EntityMutationService` with a result-resolved after-commit object id.
- `EntityInstanceList` keeps the shipped object-scoped `Scripts`, `Actions`, and `Events` authoring flow on edit-only generic custom-entity dialogs, while create/copy dialogs remain intentionally minimal.
- Catalog-compatible ACL alignment is now explicitly verified on the mounted surface: those routes delegate to `CatalogList` before the generic automation tabs mount, so no extra permission widening was required on the current tree.
- EN/RU custom-entity workflow docs now include the save-first `Scripts -> Actions -> Events` authoring sequence, and stable GitBook-compatible visual assets now live under `docs/assets/entities/`.
- Final validation for this closure wave is green: focused backend coverage passed (`27/27`), focused frontend automation coverage passed (`12/12`), `pnpm docs:i18n:check` passed, `pnpm run build:e2e` completed green (`30 successful`, `30 total`), the targeted Chromium automation flow passed (`2 passed` including auth bootstrap), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- Build-only follow-up fixed: the canonical build surfaced a missing `DbExecutor` type import in `EntityActionExecutionService`, and that repair is now part of the validated tree.
- Shared field contract: legacy `CatalogActions`, `EnumerationActions`, and `SetActions` must continue passing explicit `nameLabel`, `descriptionLabel`, `codenameLabel`, and `codenameHelper` props into `GeneralTabFields`; otherwise the localized fields silently lose accessible labels and the real browser copy flow breaks at `getByLabel(...)`.
- Visual proof nuance: catalog-compatible create/copy dialogs remain whole-dialog visual parity surfaces, but edit parity should be evaluated on the shared General panel plus shared save/tab affordances because the entity edit shell intentionally adds an `Attributes` tab and keeps delete as an external row action.
- Read-only contract: metahub members may load entity-type definitions needed by `EntitiesWorkspace` and `EntityInstanceList`, while create/update/delete entity-type routes remain gated by `manageMetahub` and the frontend continues hiding authoring affordances for read-only members.
- Scope guard: Phase 5 remains explicitly marked as future post-parity work in the ECAE plan; this session closes the validated QA-closure defects instead of silently widening into a new product wave.

- Goal: preserve the validated generic automation authoring contract, catalog-compatible route ownership, and strict acceptance parity between legacy Catalogs and Catalogs v2.
- Branch context: on `main` — the broad ECAE surface is implemented and validated, and the last QA-proven catalog-compatible ACL/policy seam is now closed; future work should preserve this contract instead of reopening Phase 1-4 scope.
- Architecture decision: Hybrid approach — Code Registry (5 built-in types, TypeScript-safe) + Data Definitions (custom types per metahub in `_mhb_entity_type_definitions`).
- Component system: Pragmatic Component Registry — 10 declarative descriptors, with `relations` and `nestedCollections` reusing existing attribute/reference seams instead of inventing new system tables.
- Rollout strategy: coexistence-first — legacy Catalogs/Sets/Enumerations stay live while the new `Entities` workspace and dynamic published sections (starting with `Catalogs v2`) are introduced.
- ECAE: entity type definitions enable Actions/Events capability, while concrete Actions (`_mhb_actions`) and Event Bindings (`_mhb_event_bindings`) are object-owned and dispatched through a transaction-aware `EntityMutationService` instead of route-only hooks.
- Generic design-time CRUD: metahubs backend now exposes custom-only generic entity instance routes (`/metahub/:metahubId/entities`, `/entity/:entityId`, copy/restore/permanent/reorder) backed by transaction-aware `MetahubObjectsService` mutations; built-in kinds still stay on legacy routes, but Phase 2.5b now shares delete/detach/reorder safety semantics underneath those legacy routes through internal compatibility helpers.
- Design-time copy seam: Phase 2.5c now adds a shared `copyDesignTimeObjectChildren(...)` helper for attributes/elements/constants/values, keeps legacy catalog/set/enumeration routes authoritative while reusing that helper underneath copy flows, and lets generic custom-entity copy derive child-copy breadth from enabled design-time components.
- System-attribute adapter seam: `MetahubAttributesService` now exposes object-scoped system-attribute adapters (`listObjectSystemAttributes`, `getObjectSystemFieldsSnapshot`, `ensureObjectSystemAttributes`) while preserving the legacy catalog-named wrappers so platform `_upl_*` governance can be reused without reopening built-in routes.
- UI: fixed `Entities` menu item below `Common`, plus a separate dynamic published-section zone below legacy hardcoded object items. The first `EntitiesWorkspace` is now wired through package exports, core frontend lazy routes, shared template-mui navigation, breadcrumbs, EN/RU metahubs namespace coverage, and shared query-key smoke tests; Phase 3.2 now also ships permission-aware shell filtering plus published custom-kind links inserted between the built-in object cluster and the publications/admin cluster. Zerocode MVP stays in current scope, built from existing shared UI primitives with a strict `EntityFormDialog` vs `DynamicEntityFormDialog` split.
- Phase 3.1 UI closure: the first generic `EntityInstanceList` page now ships for custom kinds with list/card view, create/edit/copy/delete/restore/permanent-delete flows, deleted-item toggling, hub-assignment reuse, edit-only embedded attributes/layout tabs, explicit scripts-unavailable gating, EN/RU copy, focused frontend coverage, and validated route/export/workspace wiring.
- Phase 3.2 closure: the QA remediation checkpoint is now complete. Generic permanent delete fails closed unless the row is already soft-deleted, entity authoring affordances and shell navigation reuse the metahub-details permission seam, published custom kinds expose `published` metadata through the entity-type list contract, and browser coverage now proves the dynamic sidebar link opens the generic custom-kind instances path in EN and RU.
- Post-QA closure detail: shared template-mui shell queries now use `useAuth().client` instead of raw `fetch`, `ConflictResolutionDialog` keeps hook order stable across null/payload rerenders, and focused regressions plus touched-package lint/tests/builds are green on the remediated surface.
- Runtime/snapshot closure: snapshot format v3, the DDL custom-type pipeline, and the runtime/shared-contract genericization wave are now validated together through focused regressions, touched builds, and the canonical root build.
- Shared runtime contract: `applications-backend`, `applications-frontend`, and `apps-template-mui` now expose generic `section`, `sections`, and `activeSectionId` aliases alongside the legacy catalog fields; frontend/runtime helpers must continue resolving backend `catalogId` payloads from `sectionId ?? catalogId` until the legacy naming can be retired safely.
- Validation closure: the focused runtime regressions, touched package builds, touched-file lint cleanup, and the repository-standard root `pnpm build` are green on the finalized Phase 3.3-3.5 patch set.
- QA closure follow-up: runtime inline cell PATCH in `applications-backend` now shares the same explicit `editContent` guard as the other parent-row edit mutations, the focused route suite is green again (`52/52`), and the canonical task ledger now reflects the already verified Phase 3.3-3.5 closure state.
- Design-time gating: component toggles for arbitrary custom types must stay gated until `MetahubObjectsService`, `MetahubAttributesService`, `MetahubLayoutsService`, and the related publication/runtime seams are genericized or adapter-backed.
- Policy reuse: Catalogs v2 must reuse the existing platform system-attribute governance/seed helpers instead of introducing a second `_upl_*` policy interpretation.
- Strict parity seam: this closure wave is now implemented and validated. Legacy catalog controllers accept catalog-compatible custom kinds for catalog management flows, the generic entity copy route supports catalog-style copy options, script attachments resolve catalog-compatible custom rows behind the legacy `catalog` attachment kind, and `EntityInstanceList` now switches into catalog semantics for those compatible kinds instead of growing a second detail-authoring stack.
- Global presets: reusable cross-metahub entity presets now extend the existing template registry/versioning seam in `metahubs` through `definition_type='entity_type_preset'`, and the `Entities` create dialog consumes active preset manifests from that same templates API.
- Browser proof closure: Phase 2.9 is now closed on the shipped entity-type authoring surface through focused Playwright flow + visual coverage, backend-confirmed persistence, EN/RU parity checks, and a stable dialog baseline that captures the preset selector after blur rather than active focus state.
- UI closure detail: `EntitiesWorkspace` list view now renders the primary `Name` column explicitly via `row.name || row.kindKey`, preventing newly created custom entity types from appearing missing in list mode.
- Phase 3.6/3.7 closure update: the `EntitiesWorkspace` builder source now renders the structured create/edit controls again (guided tabs, publish flag, dependency-aware component toggles), uses real checkbox controls instead of aliased MUI switches, and both focused browser flows are green again on the repaired surface.
- Phase 3.8/4 closure update: legacy snapshot imports stay valid when v3-only entity metadata sections are absent, legacy catalog-wrapper system-attribute reads stay aligned with the object-scoped adapters, EN/RU architecture + custom-entity docs are published, and the canonical root `pnpm build` is green.

## Immediate Next Steps

- Wait for QA mode or the next user-directed wave; this residual implementation pass is complete.
- Preserve the edit-only automation authoring contract on generic custom entities when future dialog or entity-type builder work touches `EntityInstanceList`.
- Preserve the create-path lifecycle boundary so future generic entity refactors do not bypass `EntityMutationService` again.

## Constraints to Preserve

1. Full refactor is permitted internally, but legacy Catalogs/Sets/Enumerations must remain user-visible until entity-based replacements pass acceptance.
2. `_mhb_objects.kind` accepts both built-in and custom kind values.
3. Snapshot format version bumps from 2 to 3 with backward compatibility for v2 imports.
4. All existing E2E tests must remain green at every phase boundary — EN/RU pixel-perfect parity is required for Catalogs v2.
5. ECAE implementation (Actions + Events) and the form-driven Zerocode MVP are part of current scope, not deferred.
6. `Entities` must appear below `Common`, and `Catalogs v2` must be published through the new dynamic menu mechanism, not hardcoded.
7. Future-ready: ComponentManifest JSON remains the stable contract for advanced Zerocode tooling and AOT compilation.
8. Arbitrary custom-type components stay gated until the corresponding design-time service and runtime path are proven generic or adapter-backed.
9. Catalogs v2 parity must reuse the existing platform system-attribute governance helpers, preserve applications-frontend page-surface behavior, and prove legacy/new mutual visibility rather than relying on indirect implementation evidence alone.

## References

- [entity-component-architecture-plan-2026-04-08.md](plan/entity-component-architecture-plan-2026-04-08.md)
- [creative-entity-component-architecture.md](creative/creative-entity-component-architecture.md)
- [tasks.md](tasks.md)
- [progress.md](progress.md)
- [systemPatterns.md](systemPatterns.md)
- [techContext.md](techContext.md)
