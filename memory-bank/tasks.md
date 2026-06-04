# PlayCanvas Project Storage Model QA Closure Tasks

> Date: 2026-06-03
> Source plan: `memory-bank/plan/playcanvas-project-storage-model-for-metahubs-plan-2026-06-03.md`
> Brief: `.manager/specs/platformo/playcanvas-project-storage-model-for-metahubs-spec-2026-06-03.md`

## Scope

Close the QA blockers found after the first implementation pass. This work completes the approved storage-model plan without adding the PlayCanvas Editor bridge, S3 provider administration, Colyseus authoring, AI/MCP authoring, or a custom scene-editing UI.

## Checklist

-   [x] Backend contracts: replace weak snapshot `unknown[]` sections with typed Zod schemas and add bounded strict base64/MIME/checksum validation.
-   [x] Backend schema/store: add virtual path collision guard and first-class scene, asset, script, binding, generated-artifact store methods.
-   [x] Backend API: expose the planned project/scene/asset/script/generated-artifact routes with permission, rate-limit, no-store/cache, optimistic, and fail-closed behavior.
-   [x] Snapshot lifecycle: remap PlayCanvas ids on restore/copy, validate checksums, preserve file rollback, and generate complete runtime manifests with scene bindings and artifact URLs.
-   [x] Application sync: ensure PlayCanvas manifest-only changes are detected and reported as updates.
-   [x] Frontend UX: remove the required user-facing Codename workflow, add localized project create validation/errors, and keep shared MUI dialog/list primitives.
-   [x] E2E: add Playwright evidence for create/delete dialogs, keyboard paths, invalid validation, responsive screenshots, and no raw IDs/JSON/paths.
-   [x] Tests/docs: extend focused Jest/Vitest coverage, update OpenAPI/GitBook docs where contracts changed, run Prettier/lints/builds, and finish with autoreview.

## Follow-up QA Closure Checklist

-   [x] Preserve legacy snapshot bundle hash compatibility when PlayCanvas runtime manifests are absent.
-   [x] Include PlayCanvas script binding values and target entity ids in publication hash normalization.
-   [x] Detect PlayCanvas file checksum drift during snapshot export instead of silently accepting changed files.
-   [x] Add optimistic current-file checksum guards for PlayCanvas file writes.
-   [x] Make PlayCanvas project delete clear package default pointers before irreversible file cleanup.
-   [x] Close the metahub copy lifecycle gap for copied PlayCanvas ids and references.
-   [x] Add focused regression tests and rerun backend/frontend/types/utils/schema checks plus autoreview.

## QA Implementation Closure Checklist

-   [x] Treat missing PlayCanvas storage tables as an empty snapshot during metahub copy/export.
-   [x] Validate package `defaultProjectId` against the metahub default branch, not the user's active branch.
-   [x] Reject restored local PlayCanvas file refs that lack bundled snapshot content.
-   [x] Stabilize application backend build or document remaining unrelated blockers with focused PlayCanvas proof.
-   [x] Run focused tests, builds, static checks, Prettier, and autoreview.

## Final QA Findings Closure Checklist

-   [x] Count scene payload, script parse, and generated artifact statuses in PlayCanvas project health and publishability.
-   [x] Prevent free project-level file writes from creating orphan PlayCanvas files outside scene/asset/artifact metadata.
-   [x] Make runtime PlayCanvas manifests fail closed when local file references are not ready instead of publishing live authoring paths as implicitly valid resources.
-   [x] Add focused regression tests for health aggregation, orphan-file guards, and runtime manifest gating.
-   [x] Protect PlayCanvas authoring file/snapshot read endpoints with `manageMetahub` and add a controller permission regression.
-   [x] Extend browser/API evidence for snapshot export/import, metahub copy, and package detach/reattach persistence.
-   [x] Run focused backend/frontend/application tests, DB-access/i18n/diff checks, and document any E2E constraints.

## QA Round 2 Closure Checklist

-   [x] Require `manageMetahub` for PlayCanvas authoring metadata read endpoints and extend permission regressions.
-   [x] Produce resolved runtime PlayCanvas file URLs without leaking authoring storage paths, with fail-closed manifest validation.
-   [x] Add restore preflight validation for duplicate snapshot ids and broken references before destructive cleanup or file writes.
-   [x] Reject symlinked PlayCanvas files in normal read/write/delete flows, not only tree copy.
-   [x] Make project/metahub file deletion lifecycle fail safer and avoid restoring DB metadata to partially deleted files.
-   [x] Extend Playwright evidence for confirmed delete, manual default selection/reset, and RU labels.
-   [x] Run focused tests, build/static checks, Prettier where needed, and final autoreview.

## QA Round 3 Closure Checklist

-   [x] Scope PlayCanvas project publish/export before runtime manifest generation so unrelated broken projects cannot block a healthy project.
-   [x] Correct PlayCanvas optimistic-lock diagnostics to use a PlayCanvas-specific entity type.
-   [x] Add focused regressions for project-scoped publish/export isolation.
-   [x] Run focused backend tests, build/static checks, Prettier where needed, and autoreview.

## QA Round 4 Closure Checklist

-   [x] Make configured default PlayCanvas projects fail closed when no publishable scene can produce a runtime manifest.
-   [x] Persist normal runtime publication manifests into `_mhb_playcanvas_publication_manifests` and clear stale rows when the latest publication has no manifests.
-   [x] Add backend regressions for default-project publish blocking and branch-scoped publication manifest persistence.
-   [x] Extend Playwright evidence for populated PlayCanvas projects panel at mobile/tablet widths and read-only member behavior.
-   [x] Run focused backend/frontend/application tests, builds/static checks, local minimal Supabase Playwright, and autoreview.

## QA Round 5 Closure Checklist

-   [x] Move PlayCanvas publication manifest persistence out of snapshot serialization side effects and into publication transactions.
-   [x] Make project delete rollback fail closed when physical cleanup may be partial.
-   [x] Include asset file references in project-level PlayCanvas file ownership checks.
-   [x] Preserve PlayCanvas restore file rollback during metahub copy failures.
-   [x] Normalize application runtime manifest diff fields so persisted manifests do not create false-positive sync changes.
-   [x] Fix frontend accessibility lint and backend unused warnings.
-   [x] Add focused regressions for the fixed lifecycle/diff/accessibility paths.
-   [x] Run focused tests, lints, DB access check, Prettier where needed, and final autoreview.

## QA Round 6 Closure Checklist

-   [x] Split project-level PlayCanvas file ownership from asset file ownership.
-   [x] Make PlayCanvas file metadata marker updates fail closed on zero-row results.
-   [x] Allow first-time PlayCanvas metadata upserts without meaningless `expectedVersion`.
-   [x] Add focused regressions for asset-owned project endpoint rejection, zero-row marker rollback, and optional `expectedVersion` creates.
-   [x] Run focused tests, lints/static checks, Prettier, and autoreview.

## QA Round 7 Closure Checklist

-   [x] Enforce role-specific PlayCanvas file reference extensions and MIME classes before metadata is persisted.
-   [x] Add focused regressions for invalid scene payload, generated artifact, and script asset file refs.
-   [x] Fix PlayCanvas-only application sync messages so manifest-only updates are not reported as already up to date.
-   [x] Run focused backend/application tests, lint/build/static checks, local minimal Supabase Playwright, and autoreview.

## QA Round 8 UI Closure Checklist

-   [x] Fix PlayCanvas projects empty state image and accessible alt text.
-   [x] Align PlayCanvas Editor open action with new-tab icon semantics.
-   [x] Normalize PlayCanvas project create/delete dialog action labels and form spacing.
-   [x] Strengthen component and Playwright UX assertions for empty images, dialog clipping, standard labels, and popup behavior.
-   [x] Run focused tests, Prettier, and targeted checks for the changed frontend/E2E slice.
