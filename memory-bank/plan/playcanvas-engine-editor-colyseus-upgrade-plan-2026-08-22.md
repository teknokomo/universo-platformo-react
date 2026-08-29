# Plan: PlayCanvas Engine, Editor, and Colyseus Stable Upgrade Gate

> Created: 2026-08-22 · Revised: 2026-08-22 after QA round (v2)
> Status: Proposed (awaiting user approval)
> Source brief: manager-only PlayCanvas Engine, Editor, and Colyseus upgrade brief.
> Required research: `memory-bank/research/playcanvas-engine-editor-colyseus-stable-upgrade-research-2026-08-21.md` (treated as planning context)

## QA Round Record (2026-08-22)

Three independent read-only audits verified this plan before approval; all findings are incorporated below.

1. **Coverage audit** (plan vs brief vs research vs input TZ): all 15 brief goals, research findings #1–#21, 8 conflicts, and 11 open questions are covered or consciously simplified per the user mandate (no legacy preservation). All Non-Goals respected. Gaps found and fixed: missing **OpenAPI/rest-docs regeneration** step; localized **WebGL2-unavailable state** needs implementation (it does not exist today), not just testing; dependency-audit step; vendor isolation-checker scheduling; security-invariant regression list for Phase 2.
2. **Patterns/reuse audit** (plan vs actual codebase conventions): corrections applied — reuse existing MUI primitives instead of inventing components; i18n keys live in package-local locale files (`apps-template-mui …/i18n/locales/{en,ru}/apps.json` namespace `apps` → section `playcanvasCanvas`; metahubs-frontend `metahubs.json` → `packages.editorHost.*`; `universo-react-i18n` holds no playcanvas keys today); unavailable states extend the existing `compatibilitySurfaceDescriptorSchema` + MUI `Alert` pattern (precedents `PlayCanvasEditorHostPage.tsx:694-721, 912`); screenshots follow the GitBook convention `docs/{en,ru}/.gitbook/assets/<feature>/` + provenance manifest under `tools/docs/` + drift gate; budget/chunk tooling is greenfield (no existing scripts — stated honestly); UUID util is `generateUuidV7()` from `@universo-react-utils`; two-widget coexistence is feasible (`MainGrid.tsx:1019-1038` has no dedupe).
3. **Security/correctness review** (decisions D2–D10 against real code): no FAIL/blockers. Five concerns fixed in wording: awaited `onDrop` must preserve `reserveClientShipForReconnect` body and avoid phantom reconnect seats (core awaits `onDrop` itself and re-invokes `onLeave` after rejection via `#_onAfterLeave`; exactly-once relies on `removeClientShip` idempotency); artifact-token renewal must build on the existing iframe-side `refreshFullBootAccessToken()` flow (`artifact.mjs:3010-3048`, `universoBridge.tokenRefreshUrl`) with a server-side grace window as primary resilience — `history.replaceState` throws `SecurityError` under opaque origin and is only valid because the token path is always cross-origin with `allow-same-origin` (invariant + guard test required); migration backup reframed as derived-view snapshot via `loadEditorRealtimeDocument`/`persistEditorRealtimeDocument`, platform-schema table, Tier 2 executor; converter whitelist extended (`$length`, `$title`, `$editorType`, `$mergeMethod` consumed by vendored editor already at v2.24.2); fixture regeneration must happen AFTER the editor seed-row vendor marker changes (ordering fix).

Web re-check 2026-08-22: `@colyseus/core 0.17.50` published 2026-08-10 (quarantine satisfied well before Phase 2 start); engine `v2.21.4` still latest stable.

## Overview

Upgrade three independently owned dependency lines as one compatibility gate before further feature work: the runtime PlayCanvas Engine wrapper (`playcanvas 2.18.1 → 2.21.4`), the vendored open-source Editor frontend (`v2.24.2 → v2.30.4`, embedded engine `2.19.5 → 2.21.3`) together with Universo's compatible backend contract, and the Colyseus protocol matrix (`core 0.17.43 → 0.17.50`, `sdk 0.17.42 → 0.17.43`, `schema 4.0.25 → 4.0.31`, `ws-transport 0.17.13` unchanged). The gate includes lazy-loading the runtime widget, migrating Universo's editor config to the upstream-required versioned schema catalog, closing the artifact-token lifetime gap, and proving every change with real browser/WebGL/WebSocket evidence plus a full Jest/Vitest/Playwright system.

**User-mandated simplifications vs the brief** (recorded 2026-08-22):

- No legacy code preservation: the E2E/test database is deleted and recreated; new metahubs/applications are created fresh. Old-snapshot restore compatibility is explicitly NOT a goal.
- Metahub schema/template versions are NOT bumped.
- Significant refactoring of any existing package is allowed.
- Therefore research findings #18/#20 simplify from "freeze legacy checksum + forward migration" to "update seeds in place + regenerate fixtures through the product flow".

## Target Matrix (re-frozen 2026-08-22)

| Surface | Current | Target | Eligibility note |
| --- | --- | --- | --- |
| Runtime Engine (`pnpm-workspace.yaml` catalog) | `playcanvas 2.18.1` | `2.21.4` (published 2026-08-13) | Existing `minimumReleaseAgeExclude: playcanvas` exception stays; re-verify integrity/installability before install |
| Vendored Editor tag | `v2.24.2` (commit `00360100…`) | `v2.30.4` + peeled SHA recorded at import | Same-day-tag risk accepted with hardened non-skipping provenance gates (Decision D2) |
| Editor embedded Engine | `playcanvas 2.19.5` | `2.21.3` (per tagged manifest) | Never deduplicated against runtime Engine |
| Colyseus core | `0.17.43` | `0.17.50` (published 2026-08-10) | Optional peer becomes `zod ^4.1.12`; metadata-only conflict (see D7) |
| Colyseus sdk | `0.17.42` | `0.17.43` | Peers core `0.17.x` |
| Colyseus schema | `4.0.25` | `4.0.31` | Quarantine until **2026-08-25 04:10 UTC**; Phase 2 must not start earlier unless a newer schema supersedes it |
| Colyseus ws-transport | `0.17.13` | `0.17.13` (unchanged) | Already current |
| Node gates | root `>=22.6.0`, CI `22.22.0` | unchanged | Editor build keeps its stricter package-level `>=22.22.0` gate |

## Key Decisions

- **D1 — Version freeze:** adopt the matrix above; final integrity/publication-time/installability re-freeze happens in Phase 0.
- **D2 — Editor soak:** proceed with `v2.30.4` despite the recent release: atomic hash-pinned vendor import + inventory-based drift gate + instant rollback.
- **D3 — Schema catalog ownership:** Universo owns the canonical `{version: 1, documents, assetData}` catalog, authored for explicitly supported surfaces only, verified against tagged upstream `schema.ts` semantics using ported fixtures/tests. No claim of "complete upstream production catalog conversion".
- **D4 — Page capability matrix:** Main Editor shell = **supported**. Blank/CMS picker = **deferred** (sessions always project-pinned). Code Editor = **intentionally disabled**: hide entry points, typed localized unavailable state (ShareDB `documents` gate not implemented). Launch = **deferred/hidden**. Font import = **hidden/fail closed**. MCP = **out entirely**, no CSP widening. VCS/build/publish remain cloud-only unavailable stubs. Implementation reuses the existing `compatibilitySurfaceDescriptorSchema` extension point and the MUI `Alert` + `packages.editorHost.*` i18n pattern — no new component family.
- **D5 — Registry identity:** keep workspace wrapper versions at `0.1.0`; update `source.upstreamVersion` + descriptions in `seed-packages.json` rows IN PLACE (fresh-DB policy); update the `PackageSeeder.test.ts` checksum guard accordingly; regenerate both MMOOMM fixtures through the documented Playwright product flow AFTER the editor vendor marker row changes. Module runtime resolution stays name-only because helper ABI (`SUPPORTED_RUNTIME_PACKAGE_EXPORTS`) is unchanged.
- **D6 — Artifact token lifetime:** build on the EXISTING sliding-refresh mechanism (`refreshFullBootAccessToken()` inside the artifact bootstrap, resolving `universoBridge.tokenRefreshUrl`) rather than inventing a parallel one. Extend it so a bridge-refresh also mints a new session-bound ARTIFACT token and renews `window.config.url.frontend` (workers/wasm/code-editor resolve from that captured base, independent of document base URL). Server-side grace window accepting the previous artifact token while its bridge session is alive is the PRIMARY resilience layer for in-flight loads. Invariant: the tokenized artifact path is always served cross-origin with `sandbox` including `allow-same-origin` (`packagesController.ts:238-249` returns no artifact URL for same-origin deployments) — add a guard test asserting this invariant. `history.replaceState` is an optional defensive enhancement only where valid (opaque origins throw `SecurityError`); never the sole mechanism.
- **D7 — Zod:** keep the repository override `zod@3.25.76`. Evidence: lockfile contains only zod 3.25.76; core/sdk builds contain zero zod imports; the single usage is a lazy `await import("zod")` in `@colyseus/better-call`'s OpenAPI generator, which local code never invokes. Automated guard `tools/check-zod-resolution.mjs` asserts zod@4 absence from the lockfile AND override immutability, wired into CI like `check-catalog-versions`.
- **D8 — LocalPresence (upstream #942):** pass an explicit `new LocalPresence()` into `new Server({...})` (removes dependence on env-sensitive defaults: `Env.getDefaultPresence` auto-switches to RedisPresence when `COLYSEUS_CLOUD` is set) plus a prod-config guard asserting `COLYSEUS_CLOUD` is unset; document the unreachability proof (LocalPresence is a pure in-process EventEmitter — no network surface; user-derived data reaches driver listings, not presence channels) in the ledger doc with negative tests.
- **D9 — Reconnection lifecycle:** replace the fire-and-forget block ONLY; preserve the whole `reserveClientShipForReconnect` body (duplicate-drop guard + multi-session logic). Call `allowReconnection` only when the client still resolves to a live ship/runtime (prevents phantom reserved seats blocking room disposal after access revocation). Exactly-once cleanup is guaranteed by `removeClientShip` idempotency (delete-before-check): core awaits `onDrop` internally and re-invokes `onLeave` after reservation rejection via `#_onAfterLeave` — both paths converge on the same idempotent removal. Anti-phantom-seat assertions added to the integration suite.
- **D10 — Canvas identity & input ownership:** assign each application canvas a stable unique `id` and scope keyboard input to the canvas rather than `window` (new engine keys its application registry by `canvas.id`). Enforce with a two-widget mount/unmount test (coexistence is feasible — layout grid imposes no dedupe).

## Affected Areas

- `pnpm-workspace.yaml`, lockfile, `packages/universo-react-playcanvas-engine/**`.
- `packages/universo-react-apps-template-mui`: `dashboard/components/PlayCanvasCanvasWidget.tsx`, `widgetRenderer.tsx`, `visualLinkupLabRuntime.ts`, `dashboard/runtime/browserModuleRuntime.ts`, `src/i18n/locales/{en,ru}/apps.json` (namespace `apps`, section `playcanvasCanvas`).
- `packages/universo-react-applications-backend/src/realtime/**` (+ Jest suites), `packages/universo-react-colyseus-server/**`, `packages/universo-react-colyseus-client/**`.
- `packages/universo-react-playcanvas-editor-frontend/**` (vendor tree, `src/index.ts`, artifact lib/scripts/tests), `tools/check-playcanvas-editor-{metadata,vendor-drift,isolation}.mjs`, `tools/playcanvas-editor-previous-version.txt`.
- `packages/universo-react-playcanvas-editor-backend/src/{config,routes,realtime}/**`.
- `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts` (+ bridge constants).
- `packages/universo-react-metahubs-backend`: `domains/packages/data/seed-packages.json`, `services/PackageSeeder.ts` tests, `domains/playcanvas-projects/**` (incl. `minimumTag` literal in `PlayCanvasProjectsService.ts`), `controllers/packagesController.ts` (token logic).
- `packages/universo-react-metahubs-frontend`: `src/i18n/locales/{en,ru}/metahubs.json` (`packages.editorHost.*`), host page unavailable-state rendering.
- `packages/universo-react-rest-docs/**`: generator `scripts/generate-openapi-source.js` (`minimumTag` enum currently pins `['v2.24.2']` at ~line 1571), regenerated `src/openapi/index.yml`.
- `packages/universo-react-modules-engine/src/compiler.ts` (no ABI change; tests updated), fixture contracts `tools/testing/e2e/support/mmoomm{Flight,App}FixtureContract.ts`, fixtures `tools/fixtures/metahubs-mmoomm-*.json` (regenerated via product flow).
- `tools/testing/e2e/support/mmoommRuntimeProof.ts`, MMOOMM flow specs, editor artifact specs; new `tools/check-zod-resolution.mjs`; new screenshot provenance/drift tooling under `tools/docs/` following the Interpretation Network pattern.
- Docs: `docs/en/platform/**`, `docs/ru/platform/**`, package READMEs (EN/RU), Skills `.agents/skills/playcanvas-*` and `colyseus-authoritative-multiplayer` version guards.

## UI Contract (Runtime UX Quality Gate)

- Browser support scope is **Chromium-only** (matches current E2E reality); cross-browser claims are NOT introduced by this work.
- All new/changed user-facing states are EN/RU localized in the package-local locale files named above; no raw i18n keys, `[object Object]`, raw UUIDs/JSON/protocol payloads on normal surfaces.
- Unsupported capabilities (Code Editor, Launch, fonts, MCP, publish/VCS) render typed localized unavailable states built from the existing surface-descriptor contract + MUI `Alert` — never silent loss, raw 404s, blank shells, or console protocol errors.
- WebGL2-unavailable devices get a NEW localized terminal state inside widget bounds (implemented this gate, then tested); lazy chunk shows a loading state composed of existing primitives (`Skeleton variant='rectangular'` precedent `RuntimeTabularPartView.tsx:170`, or `CircularProgress`) — no blank box.
- No page-level horizontal overflow at `1920×1080`, `768×1024`, `390×844`; every UI change gets real Chromium screenshots (EN/RU) human-reviewed against this contract.

## Plan Steps

### Phase 0 — Preconditions and re-freeze (half day)

- [ ] **P0.1** Verify OntoIndex freshness at implementation start; record indexed HEAD; enumerate dirty files.
- [ ] **P0.2** Re-freeze all target versions: npm integrity hashes, publication timestamps, tarball inspection of `@colyseus/core 0.17.50` (optional-peer declaration; confirm zero zod imports in shipped builds), Editor `v2.30.4` tag object + peeled commit SHA. Fail-closed abort if anything moved. Define the **dependency-audit procedure** used after every reinstall (P1.1/P2.1): review lockfile diff for newly introduced direct/transitive packages against supply-chain policy (`minimumReleaseAge`, `blockExoticSubdeps`, `trustPolicy`).
- [ ] **P0.3** Capture baselines: main frontend chunk size (gzip/brotli), startup-to-ready timing of the flight-runtime flow, current `mmoomm-app-gate:local-supabase` result, current editor artifact boot screenshots.
- [ ] **P0.4** Create branch `feature/playcanvas-engine-editor-colyseus-upgrade`.

### Phase 1 — Runtime Engine `2.18.1 → 2.21.4` (2–3 days)

- [ ] **P1.1** Bump catalog `playcanvas: 2.18.1 → 2.21.4`; reinstall; run the dependency audit; fix compile fallout. Keep the WebGL2-only contract; no WebGPU/XR/GSplat adoption.
- [ ] **P1.2** Write the tagged-delta ledger `docs/en/platform/playcanvas-engine-ledger-2-18-1-to-2-21-4.md` (+ RU mirror; consciously establishes a versioned-ledger doc pattern): every breaking item from releases `v2.19.0/v2.20.0/v2.21.0/v2.21.4` mapped to affected local symbol/path, verdict `affected | N/A`, required-test reference, plus the D8 presence outcome from Phase 2. Verified N/A examples: MeshInstance pass flags (wrapper constructs `new pc.MeshInstance(mesh, material)` only, `runtime.ts:114`), audio fallback (unused), GSplat casing (unused).
- [ ] **P1.3** Canvas identity + input ownership (D10):

```ts
// packages/universo-react-playcanvas-engine/src/runtime.ts
export interface CreateBasicApplicationOptions {
    canvas: HTMLCanvasElement;
    /** Stable unique id; becomes the canvas element id used by the engine app registry. */
    applicationId?: string;
    /** When false (default) keyboard events attach to the canvas, not window. */
    windowKeyboard?: boolean;
}

export function createBasicApplication(
    options: CreateBasicApplicationOptions,
): { app: pc.Application; destroy: () => void } {
    const { canvas, applicationId, windowKeyboard = false } = options;
    if (applicationId) canvas.id = applicationId;
    const keyboardTarget = windowKeyboard ? window : canvas;
    const app = new pc.Application(canvas, {
        mouse: new pc.Mouse(canvas),
        touch: new pc.TouchDevice(canvas),
        keyboard: new pc.Keyboard(keyboardTarget),
    });
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    return {
        app,
        destroy: () => {
            app.destroy();
            if (applicationId) delete canvas.id;
        },
    };
}
```

Update both call sites (`PlayCanvasCanvasWidget.tsx:1074`, `visualLinkupLabRuntime.ts:100`) to pass `applicationId` derived from widget id and use the returned `destroy()`.
- [ ] **P1.4** Lazy-load the widget boundary using existing conventions:

```tsx
// packages/universo-react-apps-template-mui/src/dashboard/components/widgetRenderer.tsx
const PlayCanvasCanvasWidget = React.lazy(() =>
    import('./PlayCanvasCanvasWidget').then((m) => ({ default: m.default })),
);
// case 'playcanvasCanvas': <Suspense fallback={<Box aria-busy='true'><Skeleton variant='rectangular' …/></Box>}>
```

Fallback uses existing MUI primitives (`Skeleton` precedent `RuntimeTabularPartView.tsx:170` / `CircularProgress`) with a localized accessible label — no invented component. Prove: a dashboard WITHOUT a `playcanvasCanvas` widget issues no network request for the engine chunk; one WITH it loads lazily behind the skeleton.
- [ ] **P1.5** IMPLEMENT the localized WebGL2-unavailable terminal state (today absent from the codebase): detection at graphics-device init failure plus `webglcontextlost` handling; terminal localized message rendered strictly inside widget bounds; EN/RU keys in apps-template-mui `apps.json` under `playcanvasCanvas.*`.
- [ ] **P1.6** Tests: wrapper Vitest (geometry/material/AABB semantics unchanged + canvas-id assignment + keyboard-target selection); widget Vitest mocks updated + double-mount/unmount leak test (WebGL context count spy); NEW two-widget Playwright scenario; `mmoommRuntimeProof.ts` additions — network-absence assertion, resize→aspect→pick, focus exit, `webglcontextlost` → localized terminal state, viewport matrix, painted-pixel/containment/no-overflow checks. Chunk-budget reporting is GREENFIELD: add a small script capturing chunk sizes into the proof artifacts and assert the recorded baseline budget (created here; none exists today).
- [ ] **P1.7** Update wrapper README EN/RU, `playcanvas-engine-runtime` Skill version references.

### Phase 2 — Colyseus coherent set (start NOT earlier than 2026-08-25 04:10 UTC) (2–3 days)

- [ ] **P2.1** Bump catalog: `@colyseus/core 0.17.50`, `sdk 0.17.43`, `schema 4.0.31`, transport unchanged; regenerate lockfile; dependency audit; add `tools/check-zod-resolution.mjs` (asserts zod@4 absent + override immutable) wired into `.github/workflows/main.yml` beside the catalog-version check.
- [ ] **P2.2** Real-library integration harness (new Jest suite, no Room mocks) booting the actual room via `new Server({ transport: new WebSocketTransport({ server }) })` on an ephemeral port with TWO real SDK clients. Scenarios: (1) join → terminate socket → reconnect within window → same sessionId/ship, zero premature `onLeave`; (2) continued remote patches visible to observer during partner reconnect + RBAC revalidated on `onReconnect`; (3) window expiry → exactly ONE `onLeave`, ship removed once, CCU never negative, **no phantom reserved seat remains** (room disposes); (4) consented leave → exactly one `onLeave`, no duplicate ship. Plus SECURITY-INVARIANT regressions so the D9 refactor cannot silently break them: signed auth/nonce/scope rejection, origin-filtered upgrades, WS payload/rate limits, fixed-tick cadence, observer read-only enforcement, revocation close code 4423.
- [ ] **P2.3** Apply D9 exactly:

```ts
// applicationsRealtimeRuntime.ts — INSIDE reserveClientShipForReconnect (1417–1437):
// keep the duplicate-drop guard (1420–1422) and multi-session logic (1423–1432) untouched;
// replace ONLY the fire-and-forget tail. Reserve nothing when the ship no longer resolves,
// otherwise a rejected seat would block #_disposeIfEmpty for 30 s after access revocation.
if (!this.resolveShipRuntime(client)) {
    this.removeClientShip(client, { force: true });
    return;
}
try {
    await this.allowReconnection(client, RECONNECT_WINDOW_SECONDS);
    // onReconnect restores the session; nothing to do here.
} catch {
    // Window expired or reservation rejected. Core also re-invokes onLeave after
    // rejection (#_onAfterLeave); removeClientShip is idempotent (delete-before-check),
    // so both paths converge on exactly-once cleanup.
    this.removeClientShip(client, { force: true });
}
```

Add the idempotency comment at `removeClientShip` (:1579) documenting the delete-before-check invariant.
- [ ] **P2.4** D8 disposition: pass explicit `new LocalPresence()` in `attachApplicationsRealtimeRuntime` Server options; prod-config guard asserts `COLYSEUS_CLOUD` unset (env-sensitive auto-switch in `Env.getDefaultPresence`); negative tests (no presence topics derived from user data); record outcome in the ledger doc.
- [ ] **P2.5** Update mocked Jest suites where lifecycle semantics changed; keep ALL existing E2E reconnect proofs green (`expectMmoommSecondClientAndReconnect`, flight offline/reconnect block); add RBAC-recheck-after-reconnect and zero-premature-`onLeave` assertions using exposed status attributes (`data-realtime-status`, `data-reconnect-restored`).
- [ ] **P2.6** Wrapper README/Skill updates; record Zod decision (D7) in platform docs.

### Phase 3 — Registry metadata alignment for Engine/Colyseus rows (half day, depends on Phases 1–2)

- [ ] **P3.1** Update `seed-packages.json` rows IN PLACE (D5) for playcanvas-engine (`upstreamVersion '2.18.1' → '2.21.4'` + EN/RU descriptions), colyseus-client (`0.17.42 → 0.17.43`), colyseus-server (`0.17.43 → 0.17.50`). The EDITOR row is deliberately untouched until P4.4 (its vendor marker must change in the same commit as the vendor import, otherwise fixtures would embed a stale marker).
- [ ] **P3.2** Update `PackageSeeder.test.ts` legacy-checksum guard expectations; verify clean apply on a FRESH database (minimal Supabase reset path).
- [ ] **P3.3** Direct store tests for snapshot restore negatives: value-level tamper of any `source` field (e.g., `upstreamVersion`) on a package WITH a non-empty source descriptor fails closed via jsonb semantic equality (`packagesStore.selectActivePackageBySnapshotItem`); unknown wrapper version fails closed. Note the bypass case: items WITHOUT `source` skip descriptor matching by design — cover that branch explicitly.

### Phase 4 — Vendor Editor `v2.30.4` import (2 days)

- [ ] **P4.1** Import atomic snapshot: annotated tag object SHA + peeled commit + tree hash into `vendor/UPSTREAM.md`; refresh renamed manifest `vendor/package.playcanvas-editor.json` (version `2.30.4`, engine `2.21.3`, node `>=22.22.0`); preserve the commit-pinned `ot-text` git dependency (never adopt upstream floating pin); LICENSE/NOTICE copyright checks.
- [ ] **P4.2** Generate committed `vendor/upstream-inventory.json` (path → sha256 over `git archive v2.30.4` minus omit lists).
- [ ] **P4.3** Harden the drift checker (replaces sibling-checkout approach; fixes CI-noop/symlink/CRLF weaknesses): verify vendored tree byte-hashes against the committed inventory; identical omit lists shared by generation and verification; ANY drift exits non-zero; a loud `PC_EDITOR_DRIFT_SKIP=1` escape hatch marks output "unverified" and is FORBIDDEN in CI.
- [ ] **P4.4** Single-commit constants sync: `src/index.ts` (`PLAYCANVAS_EDITOR_UPSTREAM_TAG='v2.30.4'`, commit, node requirement), `scripts/lib/playcanvas-editor-artifact.mjs`, `tests/artifact.test.mjs` pins, sentinel `tools/playcanvas-editor-previous-version.txt → 2.24.2`, AND the editor seed-row vendor marker in `seed-packages.json` (currently `'2026-06-05-vendor'`). Metadata guard passes with zero stale literals outside vendor/history.
- [ ] **P4.5** Build artifact (`universo-full-upstream-ui`): compile/boot fallout fixes; embedded engine stays `2.21.3` (`js/playcanvas-engine.js` stub contract untouched); smoke script extended to require `js/code-editor.js`; browser smoke across desktop/tablet/mobile; RUN `tools/check-playcanvas-editor-isolation.mjs` (scheduled gate, previously unscheduled).
- [ ] **P4.6** Automatic-migration safety gate (finding #12), reframed to the real persistence model: documents persisted by the compatible realtime layer are DERIVED VIEWS over domain stores surfaced through `loadEditorRealtimeDocument`/`persistEditorRealtimeDocument`. Before accepting post-open authoring saves, snapshot those derived documents `{collection, documentId, data, version}` for the opened project into a PLATFORM-SCHEMA table `(metahub_id, project_id, backup_id uuid v7 via generateUuidV7(), collection, document_id, data jsonb, version, created_at)` using the same Tier 2 trusted executor (`getTrustedDbExecutor`) already guarding this attach point with `ensureMetahubAccess`. Failure-injection test proves restore returns prior documents; second-open proves idempotence; persistence ordering model documented (backup BEFORE first post-open write; upstream migrations remain upstream-owned).
- [ ] **P4.7** Post-import keyword-vocabulary scan (CI-gated): scan `vendor/**/src` for consumed `$[a-zA-Z]+` schema keywords and diff against the P5.1 converter whitelist; fail closed on unknown additions. Known vocabulary at v2.24.2: `$default $type $of $editorType $title $enum $mergeMethod $length $scope`.

### Phase 5 — Compatibility migration: schema catalog, config shapes, capability gates (3–4 days)

- [ ] **P5.1** Author the Universo-owned versioned catalog builder (D3), replacing `buildDefaultEditorSchema()`:

```ts
// packages/universo-react-playcanvas-editor-backend/src/config/schemaCatalog.ts (greenfield)
export interface EditorSchemaCatalog { version: 1; documents: JsonSchemaDocumentMap; assetData: JsonSchemaAssetMap }

// Recursive legacy conversion with an explicit whitelist (fail closed on anything else):
//   $type→type, $default→default, $enum→enum, $of→items|additionalProperties,
//   $length→minItems|maxItems (vec semantics), $title→title,
//   $editorType→x-editor-type, $mergeMethod→x-merge-method, $scope→x-scope, x-open-map preserved.
export function convertLegacyNodeToSchema(node: LegacySchemaNode): JsonSchemaObject { … }
export function buildEditorSchemaCatalog(): EditorSchemaCatalog { … }
```

The emitted catalog ships as a GENERATED JSON ARTIFACT consumed by BOTH the backend and the frontend artifact lib (the lib executes inside the static vendor bundle and cannot import workspace packages at runtime; its inline legacy copy already diverged from the backend copy — the parity test exists precisely because of that history). Port relevant tagged-upstream fixture assertions for actually-used `documents.*`/`assetData.*` paths; inspector/default/merge semantics spot-checked via running-editor screenshots.
- [ ] **P5.2** Update shared contract `playcanvasEditorCompatibility.ts`: `fullBootConfig.schema` becomes the versioned-catalog Zod schema; `minimumTag` literal → `'v2.30.4'`; `engineVersions.force/current = '2.21.3'` in `createPlayCanvasEditorFullBootConfig` (`config/index.ts:272-275`); update the artifact fallback to consume the generated catalog JSON.
- [ ] **P5.3** Per-page config contract: typed `window.config` variants (editor-main supported; blank/code-editor/launch as explicit `unavailable` descriptor variants); tighten Zod on owned surfaces; host page + bootstrap assert variant match and fail closed with a localized error state.
- [ ] **P5.4** Capability enforcement (D4) WITHOUT new components: extend the existing `compatibilitySurfaceDescriptorSchema` structure (codeEditor/launch/fonts entries alongside `documents.codeEditorSourcefiles`); render via the established MUI `Alert` + `packages.editorHost.*` i18n keys pattern (precedents: `mobileUnsupported`, `saveUnavailable`, `defaultProjectUnavailable` in `PlayCanvasEditorHostPage.tsx:694-721, 912`); hide/disable Code Editor and Launch actions in the shell patch layer; fonts hidden/fail-closed; MCP untouched, no CSP widening; compatibility matrix doc `docs/{en,ru}/platform/playcanvas-editor-compatibility-v2-30-4.md`.
- [ ] **P5.5** Artifact-token renewal per D6: extend the existing refresh flow (`refreshFullBootAccessToken()`, `tokenRefreshUrl`) so bridge refresh ALSO mints the new sliding session-bound artifact token and renews `window.config.url.frontend`; implement the server-side grace window accepting the previous token while its bridge session lives; add the invariant guard test (token path ⇒ cross-origin deployment with `allow-same-origin`); negative tests: expired token 404, foreign-origin blocked, replayed-old-token rejected after renewal, late-load interaction opens editor → waits past old TTL → triggers lazy chunk/workers → succeeds.
- [ ] **P5.6** Update the ~13 `createPlayCanvasEditorFullBootConfig` backend test sites, artifact-lib string-contract tests (~150 bootstrap assertions), host-page tests, the `minimumTag` literal + test sites in metahubs-backend `PlayCanvasProjectsService.ts`, and add the ShareDB `documents` denial test (collection allowlist stays `scenes|assets|settings|user_data`; Code Editor requests receive the typed unavailable behavior).
- [ ] **P5.7** Numeric-ID collision hardening: persisted `(project_id, numeric_id)` uniqueness index + insert-retry-on-conflict in the ID derivation helper; direct store test simulating a collision.
- [ ] **P5.8** OpenAPI/rest-docs regeneration: bump `minimumTag` enum `['v2.24.2'] → ['v2.30.4']` in `rest-docs/scripts/generate-openapi-source.js`; `pnpm --filter @universo-react/rest-docs generate:openapi`; redocly validate; confirm the schema-catalog config shape flows into generated contracts (precedent: editor upgrade 2026-06-15 phases 3.5–3.6).
- [ ] **P5.9** Regenerate BOTH MMOOMM snapshots strictly through the documented Playwright generator flows (safe now: the editor seed-row marker changed in P4.4): `metahubs-mmoomm-flight-app-snapshot.json`, `metahubs-mmoomm-app-snapshot.json`; strengthen fixture-contract assertions to pin `upstreamPackageName`, `upstreamVersion`, module `packageImports[].version` (all unchecked today).
- [ ] **P5.10** End-to-end proof: fresh DB → import regenerated snapshots → publish → runtime executes modules (`data-runtime-module-executed=true`) with name-only resolution; negative: tampered-snapshot import fails closed end-to-end.

### Phase 6 — Deep test system completion + visual evidence (2 days)

- [ ] **P6.1** Consolidate the coverage map (Jest: applications-backend realtime + metahubs-backend stores/controllers/editor-backend; Vitest: wrappers, types contracts, apps-template widget/runtime, editor artifact lib, modules-engine compiler; Playwright: all flows below); fill gaps flagged by `gn_test_gap`.
- [ ] **P6.2** Full Playwright matrix on minimal local Supabase (`pnpm supabase:e2e:start:minimal`; runner owns port `3100`; never `pnpm dev`): mmoomm-app-gate (generator → drift → import → runtime), flight runtime flow, editor authoring create-edit-save-reload/reopen, artifact boot ×3 viewports, two-widget scenario, reconnect suite, late-asset-token scenario.
- [ ] **P6.3** Screenshot evidence per the established GitBook convention (Interpretation Network pattern): assets to `docs/en/.gitbook/assets/<feature>/` and `docs/ru/.gitbook/assets/<feature>/` (EN pages reference EN screenshots, RU pages reference RU screenshots); provenance manifest `tools/docs/<feature>-screenshot-provenance.json` (sha256 per asset); drift gate analogous to `tools/docs/check-interpretation-network-screenshot-drift.mjs`; link validator `check-gitbook-screenshot-assets.mjs`; HUMAN review recorded against the UI Contract checklist.
- [ ] **P6.4** Performance/budget report (greenfield script from P1.6): engine chunk size before/after, dashboard-without-widget network proof, startup-to-ready delta; thresholds codified in the flow spec.

### Phase 7 — Documentation (1 day)

- [ ] **P7.1** GitBook updates (EN/RU mirrors): `platform/playcanvas-editor.md` (v2.30.4 architecture, capability matrix, security model), the new engine upgrade ledger page (P1.2), `platform/metahubs/packages.md` (registry identity policy: wrapper version ≠ upstream version; fresh-DB policy), multiplayer/MMOOMM pages (Colyseus set, reconnection contract, presence decision), testing pages (new suites + how to run).
- [ ] **P7.2** Package READMEs (EN/RU where present): playcanvas-engine, colyseus-server/client, playcanvas-editor-frontend/-backend, metahubs-backend packages domain, apps-template-mui widget section.
- [ ] **P7.3** Skills version-guard sync: `playcanvas-engine-runtime`, `playcanvas-editor-authoring`, `playcanvas-editor-settings`, `colyseus-authoritative-multiplayer` (versions + API notes only; dated research artifacts are NOT rewritten).
- [ ] **P7.4** Root README command references for new scripts (zod-resolution guard, chunk-budget report).

### Phase 8 — Final verification & closeout (1 day)

- [ ] **P8.1** Formatting + focused lint per touched package; focused builds; full root rebuild.
- [ ] **P8.2** OntoIndex `gn_verify_diff` with expected-file allowlist; resolve unexpected symbol warnings; HIGH/CRITICAL impact items resolved or explicitly waived with rationale.
- [ ] **P8.3** Thermos/autoreview closeout: CRITICAL blockers fixed; HIGH fixed or waived with user approval.
- [ ] **P8.4** Update `memory-bank/tasks.md` (new section), `progress.md` evidence, `activeContext.md` follow-ups; record final D1–D10 outcomes.

## Potential Challenges & Mitigations

| Challenge | Mitigation |
| --- | --- |
| Upstream moves targets between now and IMPLEMENT | Phase 0 re-freeze is authoritative; matrix here is candidates only |
| `v2.30.4` same-day-tag regressions | Atomic vendor import + inventory drift gate + instant rollback; browser smoke mandatory |
| Tagged schema-catalog semantics differ subtly from naive `$*` conversion | Whitelist derived from ACTUAL vendor vocabulary + post-import scan (P4.7); ported upstream fixtures; inspector screenshot spot-checks; fail-closed unknowns |
| Phantom reconnect seats after access revocation block room disposal | Ship-resolution precondition before `allowReconnection` (P2.3) + anti-phantom-seat integration assertions (P2.2 scenario 3) |
| Double `onLeave` paths (local catch + core `#_onAfterLeave`) | Documented `removeClientShip` idempotency invariant + dedicated comment + exactly-once assertions |
| Lazy boundary changes chunk graph unexpectedly | Budget assertions + network-absence proof in CI flow; manual screenshot review |
| Token renewal vs cached lazy chunks/workers | Grace-window-first design + `config.url.frontend` renewal covering worker/wasm bases; late-load test covers the exact failure mode |
| Opaque-origin `replaceState` SecurityError | Invariant guard test (token path ⇒ cross-origin + allow-same-origin); replaceState never the sole mechanism |
| Real-server integration flakiness | Ephemeral ports, deterministic clocks where possible, strict retry-free asserts, `runInBand` |
| Stale fixtures after vendor-marker change | Ordering enforced: fixture regeneration (P5.9) strictly follows P4.4 |
| Seed edit invalidates checksum guard test | Guard updated intentionally (fresh-DB policy); negative test proves fresh apply works |

## Dependencies

- Phase 2 blocked until **2026-08-25 04:10 UTC** (Schema release-age eligibility; core 0.17.50 already eligible since 2026-08-17).
- Phase 3 covers Engine/Colyseus seed rows only; the editor seed row changes in P4.4; fixture regeneration is P5.9 (strictly after P4.4).
- P5.2 (types contract) must be rebuilt before dependent backend/frontend builds (workspace rebuild order).
- Phase 6 depends on all functional phases; Phase 8 last.

## Design Notes

No separate CREATIVE phase is required: UI deltas are localized states/loading skeletons/unavailable alerts composed from existing `apps-template-mui` patterns. Architecture changes stay within the enumerated boundaries; the two-level type system, entity presets, and metahub templates stay untouched (explicitly no schema/template version bumps).
