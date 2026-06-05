# PlayCanvas Editor Frontend Package Rename Implementation Tasks

> Date: 2026-06-05
> Source plan: `memory-bank/plan/playcanvas-editor-frontend-package-rename-plan-2026-06-05.md`

## Scope

Rename the PlayCanvas Editor artifact workspace to the frontend package boundary `packages/universo-react-playcanvas-editor-frontend` / `@universo-react/playcanvas-editor-frontend`. Keep the user-facing package slug and routes as `playcanvas-editor`.

## Checklist

-   [x] Inventory active old package references and classify slug-only references before editing.
-   [x] Rename the workspace folder and package manifest to the frontend package name.
-   [x] Update workspace, CI, lint, Vitest, and guardrail tooling to the new package name and path.
-   [x] Update shared constants, package registry seeds/defaults, validation, and artifact path references while keeping the metahub slug stable.
-   [x] Update affected tests and fixtures so package metadata uses the new name and slug/route expectations remain stable.
-   [x] Update package READMEs, GitBook docs, and current Memory Bank state references.
-   [x] Regenerate PNPM lockfile metadata and run focused formatting/checks/tests.
-   [x] Run final stale-reference scans, update progress, and document any verification constraints.

# PlayCanvas Editor Runtime Host, Bridge, and Storage Adapter Implementation Tasks

> Date: 2026-06-04
> Source plan: `memory-bank/plan/playcanvas-editor-runtime-host-bridge-storage-adapter-plan-2026-06-04.md`
> Source brief: private Manager brief

## QA Round 4 Corrective Closure Checklist

-   [x] Keep recoverable PlayCanvas Editor save conflicts out of the global bridge error state.
-   [x] Require session/nonce on iframe-to-host PlayCanvas Editor bridge messages and validate them before backend calls.
-   [x] Return typed `csrfRequired` bridge errors from the frontend bridge client and cover the backend CSRF contract with a route-specific regression.
-   [x] Strengthen artifact keyboard handling and E2E selectors/evidence for real visible editor changes, conflict, and localized host states.
-   [x] Run focused tests, lints/builds, Prettier, browser checks where practical, and update progress notes.

## QA Round 5 Final Acceptance Closure Checklist

-   [x] Fix bridge replay persistence so non-UUID authenticated user ids cannot break replay-guarded commands.
-   [x] Make bridge/artifact HMAC secrets fail closed in production while preserving explicit dev/test fallback.
-   [x] Scope `scene.save` to the selected/default scene unless an explicit scene-create capability is added.
-   [x] Reduce production bridge credential exposure and document the `allow-same-origin` sandbox threat model.
-   [x] Replace Playwright save/reopen evidence that depends on debug payload staging with visible Editor user actions and localized assertions.
-   [x] Run focused backend/types/editor/frontend/E2E checks, Prettier, diff checks, autoreview, and update Memory Bank closeout notes.

## QA Round 3 Corrective Closure Checklist

-   [x] Invalidate PlayCanvas project and package host TanStack Query caches after successful bridge scene saves.
-   [x] Narrow bridge error response typing so save conflict handling is type-safe under strict TypeScript.
-   [x] Align PlayCanvas Editor host CSP origin resolution with the documented trusted proxy header flag.
-   [x] Strengthen Playwright evidence names and assertions for save/reopen, permission-blocked, artifact-unavailable, and dirty-dialog states.
-   [x] Add PlayCanvas Editor troubleshooting docs without exposing secrets.
-   [x] Run focused tests/builds/Prettier/diff checks and close with independent verification.

## Scope

Implement the first Universo-backed PlayCanvas Editor authoring slice: real hosted artifact mode, typed bridge contracts, manager-only bridge command API, scene save/load through metahub PlayCanvas project storage, minimal JSON asset metadata, frontend host integration, docs, tests, and browser evidence. Keep S3/provider administration, PlayCanvas Cloud parity, broad binary assets, Colyseus authoring, AI/MCP automation, and implicit runtime publication out of this slice.

## Checklist

-   [x] Shared contracts: extend package artifact/host descriptors and add strict PlayCanvas Editor bridge schemas/types with UUID v7 and bounded payload validation.
-   [x] Editor artifact: add `universo-hosted` real mode, manifest/readiness checks, bootstrap/bridge runtime, package isolation, and smoke/browser tests.
-   [x] Backend host: extend authoring host descriptor, artifact headers/CSP/referrer controls, package seed data, and fail-closed readiness states.
-   [x] Backend bridge: add authenticated manager-only bridge command route with explicit CSRF, HMAC session payload, replay/idempotency store, strict parsing, safe errors, rate limits, and OpenAPI docs.
-   [x] Backend storage adapter: implement selected/default project load, scene list/read/save, minimal JSON asset metadata, ordered metadata/file/checksum writes, rollback/conflict mapping, and focused regressions.
-   [x] Frontend host: add bridge API/client, iframe message hook, TanStack Query integration, localized safe UI states, dirty/conflict dialogs using existing primitives, and anti-leakage tests.
-   [x] E2E/browser evidence: run local minimal Supabase Playwright flow for real artifact, handshake, save/reopen, conflict, permission blocked, responsive no-overflow, negative bridge messages, and referrer/header leakage.
-   [x] Docs and closeout: update package READMEs, GitBook docs, progress/current context, run focused tests/builds/Prettier/lints/OpenAPI checks/autoreview, and stop local E2E services.

## PlayCanvas Editor Host Bridge E2E Closure

-   [x] Fix the real host/artifact bootstrap handshake so iframe initialization is request-bound and race-resistant.
-   [x] Add platform E2E evidence for iframe save through the bridge, backend storage persistence, and reload/reopen scene restore.
-   [x] Strengthen iframe-visible leakage and user-level keyboard assertions for the editor host flow.
-   [x] Run focused editor/frontend/E2E checks, keep local E2E Supabase stopped, and update Memory Bank closeout notes.

## PlayCanvas Editor Bridge QA Repair Checklist

-   [x] Restore metadata-first editor scene save ordering and add crash-window/retry regressions.
-   [x] Make successful bridge save replay idempotent by returning the stored response instead of rejecting duplicate retries.
-   [x] Add dirty navigation protection, localized conflict UX, and stronger user-facing save evidence.
-   [x] Stabilize PlayCanvas Editor browser smoke screenshot evidence across desktop/tablet/mobile.
-   [x] Replace generic OpenAPI bridge endpoint docs and resolve PlayCanvas docs drift.
-   [x] Run focused backend/types/editor/frontend/E2E checks, Prettier, diff checks, and update Memory Bank closeout notes.

## PlayCanvas Editor Bridge QA Round 2 Closure Checklist

-   [x] Make host bridge request ids fail closed instead of repairing invalid iframe messages.
-   [x] Harden authoring host parent origin resolution and document the same-origin sandbox decision.
-   [x] Close OpenAPI schema drift for PlayCanvas package display and authoring host descriptors.
-   [x] Add negative token tampering evidence and avoid overclaiming anonymous token isolation.
-   [x] Verify checksum-guarded rollback delete and scene-owned payload file validation with regressions.
-   [x] Run focused backend/frontend/types/editor/rest-docs checks, Prettier, diff checks, and autoreview.

# PlayCanvas Project Storage Model QA Closure Tasks

> Date: 2026-06-03
> Source plan: `memory-bank/plan/playcanvas-project-storage-model-for-metahubs-plan-2026-06-03.md`

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

## PlayCanvas Editor Bridge Security Hardening Checklist

-   [x] Add iframe-side origin/source validation for PlayCanvas Editor bootstrap and bridge responses.
-   [x] Add browser smoke assertions for rejected spoofed bootstrap and bridge response messages.
-   [x] Run focused PlayCanvas Editor artifact tests and static checks.
-   [x] Update Memory Bank progress after verification.

## PlayCanvas Editor Runtime Host QA Closure Checklist

> Date: 2026-06-04
> Source brief: private Manager brief

-   [x] Make bridge replay completion fail closed after successful mutations instead of releasing completed-but-unrecorded requests.
-   [x] Add expected checksum guards to PlayCanvas project and asset file delete APIs.
-   [x] Strengthen Playwright evidence for user-facing Editor scene mutation and approved dialog primitives.
-   [x] Add RU browser assertions for Editor host dirty/save/conflict/error lifecycle states.
-   [x] Run focused backend/frontend/editor tests, Playwright smoke/E2E where practical, lint, Prettier, and diff checks.

## PlayCanvas Editor Runtime Host QA Round 2 Closure Checklist

> Date: 2026-06-04
> Scope: fix implemented host/settings/storage/test defects while deferring full upstream PlayCanvas Editor UI hosting to a separate research/brief.

-   [x] Align PlayCanvas project creation and package settings dialogs with the shared MUI UX contract.
-   [x] Add default PlayCanvas project selection to package settings and keep project list management as a separate surface.
-   [x] Add visible host save action and robust host-to-iframe shortcut handling without browser Save Page leakage.
-   [x] Remove the open-separately interstitial and make the package action open the final editor host directly.
-   [x] Make hosted readiness fail closed for artifact-only/placeholder manifests when the package expects `universo-hosted`.
-   [x] Lock bridge scene saves to scene-owned payload paths so one scene cannot overwrite another scene's file.
-   [x] Strengthen unit, artifact, and Playwright tests so fallback `Add entity` is not accepted as real Editor UI proof.
-   [x] Run focused backend/frontend/editor tests, lint, Prettier, Playwright evidence where practical, and autoreview.
