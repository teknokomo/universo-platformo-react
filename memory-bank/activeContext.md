# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: QA Remediation Closure For Self-Hosted Parity Lint Debt — COMPLETE — 2026-04-04

- Goal achieved: the final reproducible QA residue on the active self-hosted parity branch is closed without widening feature scope or altering validated runtime behavior.
- Validation closure: fresh package-level lint reruns were used as the source of truth instead of the earlier QA snapshot; the remaining blockers proved to be formatter drift across touched files plus one real ESLint defect in `ElementList.tsx`.
- Code closure: the touched `@universo/utils`, `@universo/template-mui`, `@universo/metahubs-frontend`, `@universo/metahubs-backend`, and `@universo/apps-template-mui` files were normalized to the current Prettier contract, and the duplicate `EnumerationValueOption` type import in `metahubs-frontend` was removed to clear the final `no-redeclare` error.
- Final validation: focused lint now reports `0 errors` for all five touched packages, and the canonical root `pnpm build` finished green with `28/28` successful tasks.

### Immediate Next Steps

- No active remediation work remains from this closure pass.
- If another QA pass is requested, start from package-level lint as the live source of truth because this session proved the remaining debt had shifted from the earlier QA snapshot to current formatter drift plus one local ESLint collision.

## Current Focus: Post-Import Self-Hosted Schema-Diff / Runtime-Inheritance Regression Wave — COMPLETE — 2026-04-04

- Goal achieved: the browser-verified self-hosted regression wave is now closed end-to-end without widening scope beyond the confirmed connector diffing, runtime inheritance, UI polish, and fixture-fidelity defects.
- Import/publication closure: `metahubsController.importFromSnapshot` now creates the initial imported publication baseline from the restored live branch snapshot, so executable schema identity stays stable after restore-time ID remapping and layout-only publications no longer appear as destructive full-table recreations.
- Runtime-config closure: the shared catalog runtime contract now preserves sparse authored config, adds explicit `useLayoutOverrides` semantics, and applies layout-like catalog overrides only when the override seam is actually enabled instead of defaulting every omitted field into a local override.
- UI/runtime closure: the layout-details back button is gone, the create/edit/copy surface labels were clarified in EN/RU, published runtime header spacing was tightened, and toolbar controls now align visually with the primary Create action.
- Fixture/export closure: the self-hosted contract now canonicalizes localized Main codenames and section naming, `@universo/utils` browser export parity was restored for `sanitizeCatalogRuntimeViewConfig`, the real Playwright generator reran and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, the targeted browser import flow passed on the regenerated fixture, and both `pnpm run build:e2e` and the canonical root `pnpm build` finished green (`28/28`).

### Immediate Next Steps
# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Self-Hosted Fixture And Header Geometry Revalidation — COMPLETE — 2026-04-04

- Goal achieved: the clean-state regression wave reported after a full rebuild and empty-database import was closed at the real source seams rather than patched only in artifacts or page-local CSS.
- Fixture closure: the canonical self-hosted fixture contract now exports the expected `Enumerations` / `Перечисления` and `Sets` / `Наборы` labels through the real generator path, and the committed `tools/fixtures/metahubs-self-hosted-app-snapshot.json` was regenerated from that source of truth.
- Shared UI closure: `ViewHeader` no longer applies the desktop negative gutter offsets that pushed the title and controls outside the standard content edge after the back button was removed.
- Runtime control closure: the published runtime Create action now shares the same 40px height contract as the search and card/list toggle controls instead of rendering as a smaller button next to shared toolbar controls.
- Regression-net closure: the affected Playwright flows now assert title/control edge alignment and control-height parity instead of proving only visibility and behavior.
- Validation closure: the focused shared header test passed, the real self-hosted generator reran, the browser import flow passed, the layout-details and runtime geometry flows passed, and the canonical root `pnpm build` finished green.

### Immediate Next Steps

- No active work remains from this regression wave.
- If another QA pass is requested, start from the regenerated self-hosted fixture contract, `ViewHeader`, and the geometry assertions in the affected Playwright flows.

## Current Focus: QA Remediation Closure For Self-Hosted Parity Lint Debt — COMPLETE — 2026-04-04

- Goal achieved: the final reproducible QA residue on top of the self-hosted parity wave was closed without widening scope beyond touched files.
- Validation-first closure: fresh package-level lint reruns were used as the source of truth instead of the earlier QA snapshot.
- Code closure: the touched `@universo/utils`, `@universo/template-mui`, `@universo/metahubs-frontend`, `@universo/metahubs-backend`, and `@universo/apps-template-mui` files were normalized to the current formatter contract.
- Final defect closure: the duplicate `EnumerationValueOption` import in `ElementList.tsx` was removed, clearing the last live `no-redeclare` failure.
- Final validation: focused lint reported `0 errors` for all five touched packages and the canonical root `pnpm build` finished green with `28/28` successful tasks.

### Immediate Next Steps

- No active lint-remediation work remains.
- If QA reopens this seam, start from current package lint instead of historical QA output.

## Current Focus: Self-Hosted Post-Import Runtime And Fixture Stabilization — COMPLETE — 2026-04-04

- Goal achieved: the browser-verified self-hosted regressions found after import, publication, and linked-application verification were closed end-to-end.
- Publication-baseline closure: `importFromSnapshot` now serializes the initial imported publication from the restored live branch snapshot, preventing restore-time ID remapping from surfacing later as destructive application diffs.
- Runtime-config closure: catalog runtime config now keeps layout inheritance sparse by default and applies layout-like overrides only when `useLayoutOverrides` is explicitly enabled.
- UI closure: layout-details lost the obsolete back button, create/edit/copy labels were clarified in EN/RU, and runtime header spacing was normalized.
- Export-parity closure: browser-safe `@universo/utils` exports were brought back into parity so `sanitizeCatalogRuntimeViewConfig` and related helpers resolve consistently in downstream browser bundles.

### Immediate Next Steps

- No active stabilization work remains.
- If another regression appears here, start from imported-publication baseline identity and sparse runtime-config inheritance.

## Current Focus: Self-Hosted Codename, Section, And Publication Surface Closure — COMPLETE — 2026-04-04

- Goal achieved: the follow-up clean-import defects around codename drift, repeated sections, publication settings hydration, and duplicated menu-widget state were closed.
- Codename closure: imported metahub codenames are now derived from the localized metahub name with deterministic collision suffixes only when a real conflict exists.
- Template-seed closure: default `Main` entities now derive their primary codename from the localized entity name instead of preserving legacy `MainHub` / `MainCatalog` / `MainSet` / `MainEnumeration` keys.
- Fixture-contract closure: the deprecated standalone `Enumeration Values` section is rejected by the self-hosted contract, and the committed fixture keeps exactly one canonical left menu widget.
- Publication-surface closure: publication breadcrumb cache and detail cache are separated, publication settings hydrate correctly, and application settings no longer show the redundant subtitle.

### Immediate Next Steps

- No active work remains on this seam.
- If another QA pass targets import fidelity, start from the self-hosted fixture import flow and publication inner-route surfaces.

## Current Focus: Self-Hosted Fixture Consumer Compatibility Closure — COMPLETE — 2026-04-04

- Goal achieved: the final downstream blocker after fixture regeneration was closed, so import -> connector -> schema sync now works on the canonical self-hosted snapshot.
- Runtime-sync closure: `applications-backend` now preserves imported enumeration-value codenames as canonical VLC payloads during runtime seeding instead of collapsing them to plain text.
- Proof closure: focused `applicationSyncSeeding` coverage now locks this enum-codename contract before browser flows run.
- Validation closure: the direct runtime reproduction returned `200` with `schemaStatus: synced`, the connector Playwright flow passed, the paired browser import flow still passed, and the canonical root build remained green.

### Immediate Next Steps

- No active consumer-compatibility work remains.
- If this seam regresses, start from `applications-backend` runtime seeding and the connector-driven first schema creation flow.

## Current Focus: Final Self-Hosted Parity Completion Pass — COMPLETE — 2026-04-04

- Goal achieved: the last QA-confirmed branch-health issues that remained after the parity wave were closed without reopening product scope.
- Runtime honesty closure: persisted row reordering now fails closed on partial or filtered datasets and explains why the reorder surface is unavailable.
- Routing closure: hidden create actions can no longer be reactivated through direct page-surface navigation.
- Export closure: the metahub frontend now exposes the supported backend export route as a real per-metahub action.
- Stability closure: touched frontend tests and lint were repaired, and the canonical root build stayed green.

### Immediate Next Steps

- No active parity-completion work remains.
- If another QA pass is requested, start from reorder gating, page-surface routing, and export affordance visibility.

## Recent Background: Snapshot And Self-Hosted Foundation — COMPLETE — 2026-04-03 to 2026-04-04

- The snapshot import/export foundation, self-hosted parity wave, self-hosted generator rename, route proofs, and related docs are already complete and should be treated as the stable baseline for new work.
- The active canonical artifact is `tools/fixtures/metahubs-self-hosted-app-snapshot.json`; legacy `self-model` naming is historical context only.
- The active implementation plan is `memory-bank/plan/metahub-self-hosted-app-parity-plan-2026-04-04.md`.
- Durable implementation detail for these completed waves lives in `progress.md`, not here.

## Operational Constraints

- Use `pnpm build` as the canonical root validation path.
- Preserve Turbo `envMode: "strict"`.
- Helper changes should fail closed when persisted state is missing.

## Session Hygiene

- Keep this file current-focus only.
- Keep durable completion detail in [progress.md](progress.md).
- Keep checklist state in [tasks.md](tasks.md).

## References

- [tasks.md](tasks.md)
- [progress.md](progress.md)
- [techContext.md](techContext.md)
- [systemPatterns.md](systemPatterns.md)
- Import generates new UUIDs with old→new ID remapping for cross-references
- `createPoolSnapshotRestoreService(schemaName)` wrapper added to `ddl/index.ts`
- Import dialog validates file size (50MB limit) and `.json` extension client-side before upload

## Operational Constraints

- Use `pnpm build` as the canonical root validation path.
- Preserve Turbo `envMode: "strict"`.
- Helper changes should fail closed when persisted state is missing.

## Session Hygiene

- Keep this file current-focus only.
- Keep durable completion detail in [progress.md](progress.md).
- Keep checklist state in [tasks.md](tasks.md).

## References

- [tasks.md](tasks.md)
- [progress.md](progress.md)
- [techContext.md](techContext.md)
- [systemPatterns.md](systemPatterns.md)
