# Plan: MMOOMM Asteroid Mining MVP (Mine Posting, Belt State, Targeting UI)

> Created: 2026-11-18
> Status: Draft v2 (QA PLAN applied 2026-11-18 — tech/security audit + coverage audit PASS-WITH-FIXES; both edit lists merged)
> Research: `memory-bank/research/mmoomm-asteroid-mining-research-2026-11-17.md` (Reviewed, QA'd) — **required input**
> Brief: QA-refined Manager brief "MMOOMM Asteroid Mining MVP" (2026-11-17, cross-project); source TZ DOC-2026-006
> Baseline: 0.90.0-alpha implemented economy (PR #932); Complexity: Level 4 (cross-package: types + applications-backend + apps-template-mui + generator/E2E + docs)

## Overview

Add the mining vertical slice to the canonical MMOOMM app on top of the implemented economy: five `Asteroid` object-records (`AST-01`…`AST-05`) in a shared belt, an `AsteroidStatus` enumeration, a `MiningConstants` set, additive server-owned `OperationKind`/`AsteroidCode` string fields on `Operation`, and a `Mine` operation kind that posts **only** into `InventoryLedger`. Two member-only runtime routes — `GET …/runtime/economy/mining/state` (belt snapshot + constants) and `POST …/runtime/economy/mining/fire` (accepts only `asteroidCode`) — run server-authoritatively: flight session via the read-only room bridge, distance ≤ `MiningRadiusMeters` against the asteroid's effective radius (TZ §9.2 formula, no line-of-sight in MVP), per-user cooldown (advisory lock + latest-Mine query), capacity/depleted checks, then ONE transaction: asteroid `SELECT … FOR UPDATE` + re-check → Operation row (server-stamped `OperationKind`/`AsteroidCode`) → posting (`beforePost` module returns an InventoryLedger-only movement group; wallet untouched) → `RemainingQuantityKg`/`Status`/`LastMinedAt` update with `RETURNING` fail-closed. The posting module branches on `OperationKind`, which the server stamps on **every** new operation (`StarterGrant`/`Sell`/`Buy`/`Mine` — TZ §10.3); the legacy heuristic remains for rows without the field. Client: asteroid meshes render from `mining/state` into a parallel entity list (never `sceneObjects`), sphere-pick + click branch to target selection (glow-shell highlight, hover distance/availability), Fire toolbar button + `F`, laser beam + 1–3 drifting chunks (visual only), cargo `used/max` HUD with a ≥90 % warning, 2 s TanStack polling driven by `statePollMs` (default background pause). All texts i18n'd EN/RU on day one; all identities UUID v7; fixture regenerated, never hand-edited.

**Owner-confirmed contract for this implementation (fresh-database, no-legacy):**

-   The test database will be deleted and recreated; new metahubs/applications are created fresh. No backfill, no compatibility code in touched paths.
-   **No platform schema version bump and no metahub-template version bump.** No new SQL tables at all (the mining slice reuses the implemented economy infrastructure); entity changes are authoring data + additive schema sync via the publication diff.
-   Serious refactoring of existing packages is allowed where it removes duplication (mining colocates in the economy service factory; the idempotency block is mechanically extracted into its own module).
-   Stack rules: centralized versions via `pnpm-workspace.yaml` catalogs; TanStack Query for all new frontend fetching; shared UI primitives in `packages/universo-react-template-mui`, published-app runtime UI isolated in `packages/universo-react-apps-template-mui` (no dependency on `universo-react-metahubs-*`/`universo-react-applications-*`); shared types in `packages/universo-react-types`; shared helpers in `packages/universo-react-utils`; app-owned widget strings in `packages/universo-react-apps-template-mui/src/i18n/locales/{en,ru}/apps.json` (the `apps` namespace is registered into the shared `@universo-react-i18n` singleton via `registerNamespace` — cross-app authoring labels live in the i18n package, but mining adds no new widget kind so no `common.json` label is needed); everything i18n'd immediately (EN + full RU parity); UUID v7 identity.

## Affected Areas

| Area | Files / packages |
| --- | --- |
| Shared types | `packages/universo-react-types/src/common/economyRuntime.ts` (+`'mine'` kind, `MINING_*` codes + status map, strict `economyMineRequestSchema`, `economyMineResponseSchema`, `economyMiningStateSchema` incl. `chunkVisualLifetimeMs` + asteroid/chunk entries) |
| Applications backend | `services/miningChunks.ts` (new, pure), `services/runtimeEconomyIdempotency.ts` (mechanical extraction of the idempotency block, `runtimeEconomyService.ts:119-260`), `services/runtimeEconomyService.ts` (mining flows colocated in `createRuntimeEconomyService` + `OperationKind` stamps on trade/grant rows), `services/runtimeEconomySupport.ts` (+`MINING_CONSTANTS_SET_CODE`, mining config resolver incl. `depletedValueId`, asteroid loader, cooldown check, `MINING_*` status map + `ECONOMY_IDEMPOTENCY_KEY_INVALID` drift fix), `controllers/runtimeEconomyController.ts` (+2 handlers, 400/422 split), `routes/applicationsRoutes.ts` (+2 routes with limiters), `src/tests/**` (jest unit + PG integration) |
| Runtime template | `packages/universo-react-apps-template-mui/src/api/api.ts` (+`fetchMiningState`, `postMiningFire`), `src/dashboard/components/useMiningState.ts` (new hook), `src/dashboard/components/PlayCanvasCanvasWidget.tsx` (Fire button, HUD + ≥90 % warning, click branch, toasts), `src/dashboard/components/playcanvasCanvasWidgetRuntime.ts` (asteroid entities, sphere pick, laser/chunks, dataset oracles), `src/i18n/locales/{en,ru}/apps.json` (+`playcanvasCanvas.mining.*`, `runtime.economyErrors.MINING_*`), `EconomyDialog.tsx` (prefix gate) |
| Generator / E2E | `tools/testing/e2e/support/mmoommAppGeneratorData.ts` (+mining codenames/constants, posting-module `Mine` branch), `support/mmoomm-app-export/metahub-authoring.ts` (+asteroid/enum/constants authoring helpers, serverOwned flags), `generate-mmoomm-app-export.ts` (+mining block), `mmoommAppContentContract.ts`/`.shared.ts` (additive assertions), `specs/flows/snapshot-import-mmoomm-app-mining.spec.ts` (new; test title MUST contain "imported MMOOMM app snapshot"), `support/mmoommMiningProof.ts` (new), root `package.json` (+`docs:mmoomm-mining:screenshots:local-supabase`) |
| Fixtures | `tools/fixtures/metahubs-mmoomm-app-snapshot.json` — regenerated only (`UPDATE_MMOOMM_APP_FIXTURE=1`); `snapshotHash` recomputed by the export pipeline |
| Docs | `docs/en|ru/guides/mmoomm-mining.md` (new, GitBook), `docs/en|ru/SUMMARY.md` (+1 line each), `docs/en|ru/guides/mmoomm-economy.md` (+mining cross-link), screenshot assets `docs/{en,ru}/.gitbook/assets/mmoomm-mining/` via the gated capture flow |
| READMEs | `packages/universo-react-applications-backend/README.md` (+Mining under "Economy Runtime") **and README-RU.md (fixes the existing EN/RU drift by adding the missing Economy Runtime + Mining sections)**, `packages/universo-react-apps-template-mui/README.md` + RU twin (+mining canvas controls), root `README.md`/`README-RU.md` (MMOOMM functionality list) |
| Tests | Jest (applications-backend unit w/ dbMocks + PG integration), Vitest (types, apps-template-mui incl. NEW pointer-sequence tests), Playwright (mining journey + docs screenshots), contract/drift node checks |

## Pinned Decisions (research-grounded; deviations flagged for owner confirmation)

1.  **D1 — Mining service colocated in the economy service factory.** `postOperationRow` is a closure over `economy.operation` (`runtimeEconomyService.ts:388-411`); `getMiningState`/`executeMiningFire` are added to the same returned service object so they reuse `resolveEconomyConfig`, `createEconomyRow`, the idempotency gate, ledger ids and `postOperationRow` with zero refactor (QA-confirmed: a sibling service would duplicate ~7 closure internals — more invention, higher blast radius). Pure chunk math is extracted to `services/miningChunks.ts`; the idempotency block (`:119-260`, no closure deps) is mechanically extracted to `services/runtimeEconomyIdempotency.ts` so the service stays ≈800 lines (Thermos "not monolithic"). Routes/handlers join the existing `runtimeEconomyController.ts` (mining is an economy capability, same `/runtime/economy` prefix).
2.  **D2 — `StationCode` via the trade fallback, never null.** Fire resolves the first active `FlightStation` row with `loadFirstStationRow` (bare `WHERE active LIMIT 1`, `runtimeEconomySupport.ts:414-453`) and stamps `Code ?? stationRowId`; **if no active station row resolves, the fire fails closed (rollback)** — TZ §10.2 forbids null (`required: true` fact validation, `runtimeLedgersService.ts:984-990`). No `FlightStation.Code` authoring in MVP; the stamped station is not surfaced in the mining UI (internal ledger dimension, TZ §7.6 "for compatibility").
3.  **D3 — `OperationKind`/`AsteroidCode` are server-owned STRING components, stamped on ALL new operations.** Additive authoring + schema sync via the publication diff (no migration, no `CURRENT_SCHEMA_SNAPSHOT_VERSION` bump). The fire flow stamps `OperationKind: 'Mine'` + `AsteroidCode`; per TZ §10.3 the **trade/grant flows also stamp `OperationKind`** (`'StarterGrant'`/`'Sell'`/`'Buy'` — one-line additive stamps in the existing `createEconomyRow` call sites; no trade logic/price/grant change), so new rows are kind-driven and the module's legacy heuristic (`mmoommAppGeneratorData.ts:227`) survives only for rows predating the field. The module reads fields by codename via `ctx.records.get` (never `payload.previousRow` — raw `cmp_*`) and branches `kind === 'Mine'` → Mine rules; `targetLedgers` stays `[WalletLedger, InventoryLedger]` (per-record config on the shared Operation entity; the both-registers contract assertion at `mmoommAppContentContract.ts:408-414` keeps passing); the Mine branch returns only the InventoryLedger movement group (legal per `assertDeclaredLedgers`, verified).
4.  **D4 — Cooldown: per-user advisory lock + latest-Mine query.** `acquireAdvisoryXactLock(tx, 'mining:<appId>:<userId>')` (helper `locks.ts:20-22`, never inline SQL) serializes the user's own fires; then one parameterized query for the user's latest `Mine` operation (owner clause `_upl_created_by = $n` + the STRING `OperationKind` column = `'Mine'` — a string literal, unlike the StarterGrant template's resolved `_app_values` UUID at `runtimeEconomyService.ts:470-479`) compared against `MiningCooldownMs` (350). The query deliberately omits the active-row condition: soft-deleted Mine rows still count (fail-closed — deleting rows cannot bypass cooldown, mirroring the StarterGrant rationale at `:463-466`). `LastMinedAt` (authored `DATE`, optional — no DATETIME component type exists; DATE+`dateComposition:'datetime'` → physical TIMESTAMPTZ) is per-asteroid state written in the fire tx, not the cooldown source (TZ §9.5 makes cooldown per-user). No new table, no index DDL (seq scan acceptable at MVP scale — flagged).
5.  **D5 — Idempotency + request validation with a 400/422 split.** `'mine'` into `economyTradeKindSchema` (`economyRuntime.ts:42`); strict `economyMineRequestSchema` (`{ asteroidCode }`). Route-level validation order (TZ §8.2 exact): (1) missing/empty/invalid-type `asteroidCode` → **400 `MINING_INVALID_TARGET`**; (2) forbidden/server-owned client fields (normalized `trim().toLowerCase()` matching, reusing the trade helper pattern at `runtimeEconomyController.ts:23-28`) and unknown extra keys → **422 `MINING_INVALID_PAYLOAD`**; (3) state conflicts → 409; (4) posting failure → 500. `economyMineRequestSchema.safeParse` with an **explicit `res.status(422)` mapping** — a raw `.parse` would escape as a `ZodError` (the trade controller's codeless 400 at `:88-91` is a deliberate deviation, documented). Fingerprint `{ kind: 'mine', body: { asteroidCode } }` (kind already bound, `:161-172`); replay/conflict semantics equal to trade; **no migration** (no `kind` column; store persists arbitrary JSON). Key optional (UUID v7 via `generateUuidV7`, `utils/src/uuid/index.ts:13`); no-key fire is allowed and protected by cooldown + asteroid lock (TZ §8.3).
6.  **D6 — Error codes: TZ §8.2 verbatim, all reachable.** `MINING_INVALID_TARGET` (400 — missing/invalid `asteroidCode`), `MINING_TARGET_NOT_FOUND` (404 — unknown code), `MINING_NO_FLIGHT_SESSION` (409), `MINING_OUT_OF_RANGE` (409), `MINING_DEPLETED` (409), `MINING_COOLDOWN` (409), `MINING_INVALID_PAYLOAD` (422 — forbidden/unknown fields), `MINING_POSTING_FAILED` (500) added to the types whitelist + status map (`economyRuntime.ts:15-40`) AND the backend map `ECONOMY_ERROR_STATUS_BY_CODE` (`runtimeEconomySupport.ts:107-117`; also fix its pre-existing `ECONOMY_IDEMPOTENCY_KEY_INVALID` drift); `ECONOMY_CAPACITY_EXCEEDED`/`ECONOMY_IDEMPOTENCY_CONFLICT` are reused as-is (409). Client: extend `localizeEconomyError`'s prefix gate to `ECONOMY_`/`MINING_` (`EconomyDialog.tsx:97-103`) and add `runtime.economyErrors.MINING_*` keys (one namespace, minimal diff). **Deviation (owner-confirm): TZ §8.2's `MINING_AUTH_REQUIRED`/`MINING_PERMISSION_DENIED` are NOT emitted in MVP** — 401/403 stay on the shared runtime guard path exactly like sell/buy (`ensureRuntimePermission` returns a boolean and sends 403 itself, `runtimeHelpers.ts:1085-1096`); the guide documents them as reserved codes; the client renders the generic message for guard-level failures.
7.  **D7 — No line-of-sight in MVP** (TZ §9.2/§16-Q5 delegation): server validates target + distance only; the camera is a free orbit (no heading coupling) and all asteroids sit in open space. A future LOS check would be a separate `MiningConstants` parameter that must not block asteroids outside guard zones.
8.  **D8 — Client targeting: parallel asteroid entity list.** Asteroids render from the `mining/state` payload (never `sceneObjects` — avoids the unconditional `move_to_object` conversion at `PlayCanvasCanvasWidget.tsx:554-563`, the `targetObjectId` hijack at `:296-299`, the strict published-scene schema at `playcanvasProjects.ts:483-496`, the exact-equality entity tests, and the `sceneObjects` dep-array teardown coupling at `playcanvasCanvasWidgetRuntime.ts:1004-1034`). Sphere-pick branch as a separate `__playcanvasPickAsteroid` canvas method (keeps `__playcanvasPickAt` semantics untouched — extending it would make asteroid clicks emit move intents); `handleCanvasClick` branches asteroid hits to target selection (React state + Visual-Lab glow-shell `enabled` toggle, `visualLinkupLabRuntime.ts:171-201,284-292`); hover shows distance/availability (FR-031, with the FR-032 no-target hint emitted locally without a server request); drag threshold raised `>2` → `>5` px manhattan (TZ §11.2 "~6px"; test-safe — zero pointer-sequence tests today); Fire button mirrors the MyLocation Tooltip→span→IconButton with `F` in `handleCanvasKeyDown` (MyLocation↔Enter pairing precedent, `:747-758`+`:577-579`), visible focus ring, disabled when no target/cooldown/in-flight; client-side cooldown timer after each own fire (FR-034 — no shot queue); `Depleted` asteroids dim/hide (FR-018) and are dropped as targets; asteroid shape/color deterministic from `code`/`visualVariant` (FR-003); the "Sell ore" capacity suggestion opens the existing economy dialog (never auto-sells). E2E targeting oracles are **`canvas.dataset.*` projections** written in `app.on('update')` (runtime `:533-561` precedent — PlayCanvas entities have no DOM representation): `canvas.dataset.miningAsteroidCount`, `canvas.dataset.miningTargetCode`, per-asteroid screen coords.
9.  **D9 — Visuals and lifecycle.** Laser = thin elongated box primitive with additive translucent material oriented nose→asteroid, 80–150 ms lifetime (nose-offset precedent `playcanvasCanvasWidgetRuntime.ts:549-553`; no laser helper exists); chunks = 1–3 `createLowPolySphereEntity` meshes (engine `:137-156`) with mass-proportional scale (`min(0.9, 0.35 + 0.18*massKg)`, TZ §11.3), random offset/spin, `chunkVisualLifetimeMs` lifetime **delivered in the state payload** (client never hardcodes it), shrink/fade at end-of-life then `entity.destroy()` mid-session (official engine API, web-verified) + whole-app teardown safety; materials tracked in an `ownedMaterials`-style array (lab precedent `:101,378-389`); per-frame updates in the existing `app.on('update')` handler (`:527-563`); `prefers-reduced-motion` disables shake/flash extras (TZ §13 — net-new, minimal).
10. **D10 — Polling & caching.** `useMiningState` hook in the widget: `useQuery({ enabled: ready && (realtimeStatus==='connected'||'restored') && runtimeAccessMode==='member', refetchInterval: data?.constants.statePollMs ?? 2000 })` — interval driven by the server payload (TZ §11.5), TanStack default `refetchIntervalInBackground: false` pauses in hidden tabs (primary-source verified for the pinned `^5.62.13`), satisfying FR-024 with no manual `visibilitychange` code. Server state GET is uncached for MVP (five rows; TZ §9.6 cache optional).
11. **D11 — Generator authoring order** (extends the economy block of `generateMmoommAppExport` after the existing economy steps at `:156-163`): `AsteroidStatus` enumeration → `MiningConstants` set with fixed values (TZ §7.4, all 9) → `Asteroid` object + components (STRING `Code`/`Name`/`ResourceCode`; NUMBER `PositionX/Y/Z`, `Scale`, `TotalQuantityKg`, server-owned `RemainingQuantityKg`, `ChunkMinKg`, `ChunkMaxKg`, `VisualVariant`; REF → `AsteroidStatus` for `Status`; DATE optional `LastMinedAt` — per-asteroid chunk bounds are TZ §7.2 fields, seeded with the §7.7 values and used by the server with the constants as fallback) → serverOwned flags via `updateComponent` (`RemainingQuantityKg`/`Status`/`LastMinedAt`) → posting-module source edit → five seed rows via `createRecord` (TZ §7.7 geometry verbatim; global, non-ownerOnly, not primary-nav; positions clear the station guard zone and ship spawn).
12. **D12 — Contracts additive.** `mmoommAppFixtureContract.shared.ts` gains mining codename constants; `assertDomainModel`/`assertEconomyDomainModel` gain Asteroid/AsteroidStatus/MiningConstants assertions + serverOwned assertions; the "exactly two primary-nav objects" check keeps excluding Asteroid (`~:218-243`); `MMOOMM_ECONOMY_OPERATION_TYPE_VALUES` already contains `'Mine'` (no enum change, no renumbering — the guide documents `Mine` as reserved).
13. **D13 — Docs screenshots via a gated mining flow.** Mirror the economy precedent (`snapshot-import-mmoomm-app-economy.spec.ts:545-571` writes `docs/{en,ru}/.gitbook/assets/mmoomm-economy/*.png` behind `MMOOMM_ECONOMY_DOCS_SCREENSHOTS=1`): a `MMOOMM_MINING_DOCS_SCREENSHOTS=1` gate + root script `docs:mmoomm-mining:screenshots:local-supabase`. Capture at 1920×1080 EN/RU pairs with a provenance manifest (sibling release-audit conventions) so the frames double as the future release-cover candidates. The guide is registered in `docs/{en,ru}/SUMMARY.md` (`:135` — the only mandatory registry; `guides/README.md` is stale and optional).

## UI Contract — mining canvas controls & HUD (mui-runtime-ux skill)

-   **Role/semantics**: member-only targeting/fire surface inside the existing PlayCanvas canvas widget — no new screens, no new widget kinds. Displayed: belt (5 asteroids, deterministic low-poly shapes/colors), target highlight + hover info (localized asteroid **Name** — never raw UUIDs; `AST-xx` codes appear only as stable keys, not as primary text), cargo `used/max kg` HUD (economy capacity semantics/wording) with a warning state at ≥90 % capacity, localized error toasts, `Mine` entries in the existing operations list (pre-wired label "Mining"/"Добыча", `EconomyDialog.tsx:31-37`).
-   **Controls**: Fire = `Tooltip > span > IconButton` (`data-testid='mining-fire-button'`, `aria-label`, visible focus ring, disabled when `!movementControlsEnabled || !miningTarget || cooldownActive || fireMutation.isPending` with localized Tooltip); keyboard `F` (canvas focus required, `preventDefault`, same handler as the button); click/tap on asteroid = target selection (drag stays camera rotation; threshold ~6px); no dialogs on this surface.
-   **Status/empty/error rendering**: errors as localized toasts/Alert (`MINING_*` → `runtime.economyErrors.<code>` with server-message fallback); cooldown shown via button disabled state + tooltip; no-target F-press shows the localized hint locally without a server request (FR-032); no bespoke MUI primitives beyond the HUD overlay div (absolute, `pointerEvents: 'none'`, inside the canvas container Box after adding `position: 'relative'` — the only layout change, no page-level overflow).
-   **Hidden/system-owned fields**: `RemainingQuantityKg`/`Status`/`LastMinedAt` are server-owned (generic rows API rejects client writes); `operationId` and internal UUIDs never render; client never computes masses/prices/remainders — everything comes from the server payload.
-   **Validation/localization**: every new string has EN + RU entries in `apps.json` (app-owned `apps` namespace merged via `registerNamespace`); `MINING_*` codes localized via the extended prefix gate; belt state renders from the zod-validated `economyMiningStateSchema` payload.
-   **Responsive/browser proof**: no page-level horizontal overflow at 1920×1080 / 1280×800 / 390×844; HUD overlay collapses gracefully on narrow viewports; screenshots captured in E2E for EN/RU (Phase E) — visual claims asserted from screenshots, never assumed.
-   **Testids & oracles** (`data-testid`): `mining-fire-button`, `mining-hud`, `mining-cargo-value`, `mining-target-info`, `mining-error`; belt oracles are **`canvas.dataset.*` projections** (`miningAsteroidCount`, `miningTargetCode`, per-asteroid screen coords) — PlayCanvas entities have no DOM attributes.

## Plan Steps

### Phase A — Shared types (`packages/universo-react-types`)

-   [ ] A1. `src/common/economyRuntime.ts` — extend the existing whitelist/map and add mining schemas (zod-only, types-local `economyUuidV7Schema` reused — no utils import, circular-dep rule):
    ```ts
    export const economyErrorCodeSchema = z.enum([
        /* existing ECONOMY_* codes unchanged */
        'MINING_INVALID_TARGET', 'MINING_TARGET_NOT_FOUND', 'MINING_NO_FLIGHT_SESSION',
        'MINING_OUT_OF_RANGE', 'MINING_DEPLETED', 'MINING_COOLDOWN',
        'MINING_INVALID_PAYLOAD', 'MINING_POSTING_FAILED'
    ] as const)
    // TZ §8.2 statuses; 401/403 stay on the shared runtime guard (D6 deviation)
    export const economyErrorStatusByCode: Record<EconomyErrorCode, 400 | 404 | 409 | 422 | 500> = {
        /* …existing…, */
        MINING_INVALID_TARGET: 400, MINING_TARGET_NOT_FOUND: 404, MINING_NO_FLIGHT_SESSION: 409,
        MINING_OUT_OF_RANGE: 409, MINING_DEPLETED: 409, MINING_COOLDOWN: 409,
        MINING_INVALID_PAYLOAD: 422, MINING_POSTING_FAILED: 500
    }
    export const economyTradeKindSchema = z.enum(['sell', 'buy', 'mine']) // fingerprint binds kind — no migration
    export const economyMineRequestSchema = z
        .object({ asteroidCode: z.string().min(1).max(64) })
        .strict() // FR-030: forbidden/server-owned or unknown client fields fail here → 422 MINING_INVALID_PAYLOAD
    export const economyMiningChunkSchema = z.object({
        id: z.string().min(1),
        massKg: z.number().positive(),
        scale: z.number().positive() // visual coefficient, not an economic value
    }).strict()
    export const economyMineResponseSchema = z.object({
        operationId: economyUuidV7Schema,
        asteroid: z.object({
            code: z.string().min(1), remainingQuantityKg: z.number().nonnegative(), status: z.enum(['Active', 'Depleted'])
        }).strict(), // remainingQuantityKg rounded to 0.1 kg (TZ §8.1)
        chunks: z.array(economyMiningChunkSchema).min(1).max(3),
        cargo: z.object({ usedKg: z.number().nonnegative(), capacityKg: z.number().positive() }).strict(),
        wallet: z.object({ balance: z.number(), currency: z.string().min(1) }).strict() // echo: proves Mine did not touch it
    }).strict()
    export const economyAsteroidStateSchema = z.object({
        code: z.string().min(1), name: z.string().min(1), resourceCode: z.string().min(1),
        position: z.object({ x: z.number(), y: z.number(), z: z.number() }).strict(),
        scale: z.number().positive(), totalQuantityKg: z.number().positive(),
        remainingQuantityKg: z.number().nonnegative(), status: z.enum(['Active', 'Depleted']),
        visualVariant: z.number().int()
    }).strict()
    export const economyMiningStateSchema = z.object({
        asteroids: z.array(economyAsteroidStateSchema),
        constants: z.object({
            miningRadiusMeters: z.number().positive(), miningCooldownMs: z.number().positive(),
            chunkMassMinKg: z.number().positive(), chunkMassMaxKg: z.number().positive(),
            chunkVisualLifetimeMs: z.number().positive(), // client chunk lifetime comes from the payload (TZ §11.3)
            statePollMs: z.number().positive()
        }).strict()
    }).strict() // remainder values rounded to 0.1 kg server-side before parse (TZ §8.1)
    ```
-   [ ] A2. Vitest: extend the economyRuntime schema tests — strict rejection of unknown keys (FR-030 contract), `'mine'` kind accepted, chunk/response/state shapes (incl. `chunkVisualLifetimeMs`), error-status map completeness (every code has exactly one status).

### Phase B — Applications backend (`packages/universo-react-applications-backend`)

-   [ ] B1. `src/services/miningChunks.ts` (new, pure — TZ §9.3 verbatim; no DB imports):
    ```ts
    export interface MiningChunk { id: string; massKg: number; scale: number }
    export type MiningChunkFailure = 'depleted' | 'capacity'
    export function computeMiningChunks(
        random: () => number,                       // injectable RNG — tests assert ranges/sums, not masses
        bounds: { chunksPerHitMin: number; chunksPerHitMax: number; chunkMassMinKg: number; chunkMassMaxKg: number; chunkMassSkew: number },
        remainingKg: number,
        capacityLeftKg: number
    ): { ok: true; chunks: MiningChunk[]; totalKg: number } | { ok: false; reason: MiningChunkFailure } {
        if (remainingKg <= 0) return { ok: false, reason: 'depleted' }
        if (capacityLeftKg <= 0) return { ok: false, reason: 'capacity' }
        const count = bounds.chunksPerHitMin + Math.floor(random() * (bounds.chunksPerHitMax - bounds.chunksPerHitMin + 1))
        const round = (v: number) => Math.round(v * 10) / 10                       // 0.1 kg precision (TZ §9.3)
        const masses = Array.from({ length: count }, () =>
            round(Math.pow(bounds.chunkMassMinKg + random() * (bounds.chunkMassMaxKg - bounds.chunkMassMinKg), 1 / bounds.chunkMassSkew)))
        const kept = masses.filter((m) => m > 0)
        if (kept.length === 0) return { ok: false, reason: 'depleted' }            // all-zero rounding hole — never return zero chunks
        const rawTotal = round(kept.reduce((s, m) => s + m, 0))
        let total = Math.min(rawTotal, remainingKg, capacityLeftKg)
        if (total < kept[kept.length - 1].massKg) {                                 // proportional scale-down + deterministic clamp
            let acc = 0
            for (let i = 0; i < kept.length; i += 1) {
                const cap = Math.max(0, round(Math.min(kept[i].massKg, total - acc)))
                kept[i] = { ...kept[i], massKg: cap }; acc = round(acc + cap)
            }
            kept[kept.length - 1].massKg = round(total - (acc - kept[kept.length - 1].massKg)) // last chunk = remainder (TZ §9.3)
        }
        if (total < 0.1) return { ok: false, reason: 'depleted' }
        const chunks = kept.map((massKg, i) => ({ id: `chunk-${i + 1}`, massKg, scale: Math.min(0.9, 0.35 + 0.18 * massKg) })) // TZ §11.3
        return { ok: true, chunks, totalKg: total }                                 // totalKg = sum of kept chunks == Operation.Quantity
    }
    ```
-   [ ] B2. `src/services/runtimeEconomySupport.ts` — `MINING_CONSTANTS_SET_CODE = 'MiningConstants'` + `resolveMiningConstants` (mirror `resolveEconomyConstants:267-290`; required codes `MiningRadiusMeters/MiningCooldownMs/ChunksPerHitMin/ChunksPerHitMax/ChunkMassMinKg/ChunkMassMaxKg/ChunkMassSkew/ChunkVisualLifetimeMs/MiningStatePollMs` read via `readNumberConstant` fail-closed), `resolveMiningConfig` (asteroid collection via `resolveEconomyObjectCollection(...,'Asteroid')` + `requireAttr` per field incl. `VisualVariant`/`ChunkMinKg`/`ChunkMaxKg` + `loadFirstStationRow` + **`depletedValueId` resolved via the Status REF target (`statusAttr.target_object_id` → `'Depleted'` value id) with fail-closed throw when absent — REF columns store `_app_values` UUIDs**), `loadAsteroidByCodeForUpdate` (parameterized `SELECT … FOR UPDATE` on `obj_<asteroidId>` with `buildEconomyActiveCondition`; deterministic single-row pick `ORDER BY id LIMIT 1`, fail closed if duplicate `Code` rows exist), `assertMiningCooldown` (per-user lock + latest-Mine query), `roundToTenth` (TZ §8.1 remainder rounding), and the `MINING_*` rows in `ECONOMY_ERROR_STATUS_BY_CODE` (+ the `ECONOMY_IDEMPOTENCY_KEY_INVALID` drift fix).
-   [ ] B3. `src/services/runtimeEconomyService.ts` — inside `createRuntimeEconomyService` add:
    -   `getMiningState(ctx, applicationId)`: `resolveEconomyConfig` → `resolveMiningConfig` → parallel reads (asteroid rows via one parameterized SELECT; constants) → round remainders to 0.1 → `economyMiningStateSchema.parse` — no cache (D10). Empty asteroid list → 200 with `asteroids: []` (TZ §8.1).
    -   `executeMiningFire(ctx, applicationId, body, idempotencyKey | null)`: clones the `executeTrade` skeleton — savepoint → optional idempotency gate (`runIdempotencyGateInTx` with the `mine` kind fingerprint) → `describeFlightContext` (null ⇒ `MINING_NO_FLIGHT_SESSION` 409) → `loadAsteroidByCodeForUpdate` + **re-check status/remainder under the lock** (TZ §9.4 step 2 — TOCTOU guard; unknown code ⇒ `MINING_TARGET_NOT_FOUND` 404) → distance check against the TZ §9.2 shape: `distance ≤ miningRadiusMeters + radius` where `radius = scale * effectiveScale * 0.5`, `effectiveScale = 0.55 + 0.45 * (remaining/total)` — **the same formula the client renders** (`MINING_OUT_OF_RANGE` 409; no LOS per D7) → `assertMiningCooldown` (`MINING_COOLDOWN` 409) → cargo read (`computeCargo` projection path, `runtimeEconomySupport.ts:492-527`) → `computeMiningChunks` with per-asteroid chunk bounds (`ChunkMinKg`/`ChunkMaxKg`, constants fallback) (`depleted`⇒409 / `capacity`⇒`ECONOMY_CAPACITY_EXCEEDED` 409 — **before any Operation**) → wallet ensure (reuse the trade helper under its own lock — `Operation.Wallet` is required even though the wallet gets no movement) → `createEconomyRow(tx, …, economy.operation, { OperationType: mineValueId, Wallet, Station: firstStationRowId, Nomenclature: oreValueId, Quantity: totalKg, UnitPrice: 0, TotalPrice: 0, OccurredAt, OperationKind: 'Mine', AsteroidCode })` → `postOperationRow(tx, …)` → `updateAsteroidAfterFire` (conditional `UPDATE … WHERE id = $1 AND remaining >= $total RETURNING id` setting remainder, `Status` REF → `depletedValueId` at zero, `LastMinedAt = NOW()`; zero rows ⇒ throw `MINING_POSTING_FAILED`, fail-closed) → fresh cargo/wallet reads, remainder rounded → `economyMineResponseSchema.parse` → idempotent response save (200 only, when a key was supplied). Post-commit lifecycle hooks: none beyond the existing `afterCreateLifecycleRequest` pattern (polling-only MVP — TZ §9.1 step 14 explicitly satisfied by absence). Structured logs + success/declined counters: `operationId/asteroidCode/applicationId/userId`, no secrets.
    -   TZ §10.3 stamps: `OperationKind: 'StarterGrant' | 'Sell' | 'Buy'` added to the three existing `createEconomyRow` call sites (one-line additive stamps; no trade logic change — see D3).
-   [ ] B4. `src/controllers/runtimeEconomyController.ts` — `getMiningState` (auth-only, payload scoped to the member; no `editContent`) and `fireMining`:
    ```ts
    export async function fireMining(deps, query, req, res) {                        // resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        const ctx = await resolveRuntimeSchema(deps.getDbExecutor, query, req, res, req.params.applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return               // returns boolean + sends 403 itself (runtimeHelpers:1085-1096)
        const rawCode = typeof req.body?.asteroidCode === 'string' ? req.body.asteroidCode.trim() : '' // TZ §8.2 row 1: missing/invalid code
        if (!rawCode) return res.status(400).json({ error: 'Choose an asteroid', code: 'MINING_INVALID_TARGET' })
        if (hasForbiddenMiningBodyKey(req.body))                                     // normalized trim().toLowerCase() — trade helper pattern :23-28
            return res.status(422).json({ error: 'Invalid mining payload', code: 'MINING_INVALID_PAYLOAD' })
        const parsed = economyMineRequestSchema.safeParse(req.body ?? {})            // strict: unknown keys rejected here
        if (!parsed.success)                                                         // deliberate deviation from trade's codeless 400 (:88-91)
            return res.status(422).json({ error: 'Invalid mining payload', code: 'MINING_INVALID_PAYLOAD' })
        // Idempotency-Key parse/validate mirrors :95-114 (malformed → 400), then the service call in try/catch → UpdateFailure mapping
    }
    ```
-   [ ] B5. `src/routes/applicationsRoutes.ts` — `GET /:applicationId/runtime/economy/mining/state` (`readLimiter`) + `POST /:applicationId/runtime/economy/mining/fire` (`writeLimiter`) next to the economy routes at `:247-249` (auto-documented; no rest-docs `routeSources` change needed).
-   [ ] B6. Jest unit tests (`src/tests/services/`, dbMocks pattern of `runtimeEconomyService.test.ts`): `miningChunks` property tests (count range, mass range, sum of kept chunks = `totalKg` = Operation.Quantity, skew distribution sanity, scale-down + last-chunk-equals-remainder clamp, all-zero-rounding hole, capacity-before-operation, `total < 0.1`, exact-capacity boundary, rounding to 0.1); mining service validation matrix (no session / unknown asteroid 404 / out-of-range boundary ±ε with the §9.2 radius formula / depleted / cooldown first-and-repeat incl. different users / full cargo / strict-body + forbidden-field 422 / missing-code 400 / malformed Idempotency-Key 400); posting-module branch tests against `dispatchRuntimeLifecycle` payloads (Mine → single InventoryLedger group with `Cost = 0`; legacy rows without `OperationKind` unchanged; stamped `Sell`/`Buy`/`StarterGrant` rows classify by kind; malformed Mine throws and rolls back); server-owned rejection (generic rows API rejects client writes to `RemainingQuantityKg`/`Status`/`LastMinedAt`); error payloads carry no internal details (no SQL/UUIDs/schema ids); FR-006 flight-keys regression mini-test (Enter/Escape/arrows unchanged with `F` added).
-   [ ] B7. PG integration test (`src/tests/persistence/runtimeMining.integration.test.ts`, `describeIntegration`/`withRollback` pattern; append to `tools/testing/backend/run-applications-integration-local-supabase.mjs:29-46` file list): real-DB atomicity (operation + fact + remainder commit together; posting failure rolls back all three), two parallel fires on one asteroid serialized by the row lock (sum ≤ stock, never negative), two users (shared remainder, separate cargo/wallet), idempotency replay/conflict on real rows, reload persistence; `GET mining/state` cases (5 asteroids / empty list / `Depleted`); fire rejection matrix at integration level (out-of-range / cooldown / full cargo / depleted → no Operation, remainder unchanged); sell-after-mine leg (trade consumes mined cargo end-to-end).

### Phase C — Runtime template (`packages/universo-react-apps-template-mui`)

-   [ ] C1. `src/api/api.ts` — `fetchMiningState` (mirror `fetchRuntimeEconomySummary:843-855`: `credentials: 'include'`, `signal`, zod `economyMiningStateSchema`) and `postMiningFire` (mirror `postEconomyTrade:863-891`: `fetchWithCsrf`, optional `Idempotency-Key` from `generateUuidV7()`, `economyMineResponseSchema` parse).
-   [ ] C2. `src/dashboard/components/useMiningState.ts` (new hook) — TanStack `useQuery` with `enabled` gating on `ready && (realtimeStatus === 'connected' || 'restored') && runtimeAccessMode === 'member'`, `refetchInterval: data?.constants.statePollMs ?? 2000` (TZ §11.5; default background pause), returns `{ asteroids, constants, error }`; exposes an `applyFireResult` helper that patches the asteroid list from a fire response (own-shot local update, TZ §11.5).
-   [ ] C3. `src/dashboard/components/playcanvasCanvasWidgetRuntime.ts` — asteroid entity layer: create one low-poly sphere entity (+ glow-shell sibling) per asteroid from the payload (positions/scale from records, deterministic color/shape from `code`/`visualVariant`, **effective scale per the TZ §9.2 formula `0.55 + 0.45 * remaining/total` — identical to the server's distance check**); a `pickAsteroidAt(clientX, clientY)` sphere-ray branch beside `intersectAabb` (sphere radius = TZ §9.2 `scale * effectiveScale * 0.5`); expose it as a canvas `__playcanvasPickAsteroid` method (type in `PlayCanvasControlCanvas` `:87-90`, registration `:652-660`, cleanup `:984-985`); laser/chunk effect helpers (laser lifetime 80–150 ms; chunk lifetime from `constants.chunkVisualLifetimeMs`; shrink/fade at end-of-life; `entity.destroy()` mid-session; materials registered for `destroy()`); per-frame transform updates in `app.on('update')` **including `canvas.dataset` oracles** (`miningAsteroidCount`, `miningTargetCode`, targeted-asteroid screen coords — `:533-561` precedent); teardown additions in BOTH the unmount cleanup and the `webglcontextlost` path.
-   [ ] C4. `src/dashboard/components/PlayCanvasCanvasWidget.tsx` — wire `useMiningState` + mining target React state: `handleCanvasClick` branches (`__playcanvasPickAsteroid` hit → `setMiningTarget`, glow-shell on, else existing `move_to_object`); drag threshold `> 2` → `> 5`; Fire button (Tooltip→span→IconButton, `data-testid='mining-fire-button'`, visible focus ring, disabled per D8) + `F` branch in `handleCanvasKeyDown` (no target → localized hint, **no request** — FR-032); client-side cooldown timer after each own fire (FR-034 — no shot queue); `fireMining` mutation (`useMutation`, localized `onError` toast/Alert with `mining-error` testid); HUD overlay (`mining-hud` with `mining-cargo-value` used/max + `mining-target-info` name/distance/availability + **≥90 % capacity warning**); hover updates target info; `Depleted` dimming + target drop; `prefers-reduced-motion` gate for shake/flash extras; capacity-error suggestion button opens the existing economy dialog (never auto-sells).
-   [ ] C5. `src/i18n/locales/{en,ru}/apps.json` — `playcanvasCanvas.mining.*` (fire tooltip, HUD labels incl. near-full warning, hover text, target-hint/out-of-range hints, cooldown tooltip, "sell ore" suggestion) + `runtime.economyErrors.MINING_*` (8 keys, both locales); `EconomyDialog.tsx:97-103` prefix gate extended to `ECONOMY_`/`MINING_`.
-   [ ] C6. Vitest — NEW pointer-sequence tests (drag < threshold + click on asteroid → target set, no `move_to_object` intent; drag > threshold → no fire); Fire button states (disabled without target / during cooldown timer / during pending; visible focus); FR-032 no-target F-press → hint without request; HUD renders cargo from payload + ≥90 % warning; `useMiningState` gating + `statePollMs`-driven interval + background pause; error mapping (`MINING_OUT_OF_RANGE` → localized text, `ECONOMY_` codes still work); dialog `Mine` label unchanged (regression guard). Follow the `EconomyDialog.test.tsx` provider stack (QueryClientProvider + I18nextProvider with real apps.json resources).

### Phase D — Product-file generator (`tools/testing/e2e`)

-   [ ] D1. `support/mmoommAppGeneratorData.ts` — mining codename constants (shared with contracts); posting-module source edit: read `OperationKind` by codename, branch `Mine` → validate (`Quantity > 0`, `UnitPrice === 0`, `TotalPrice === 0`, `AsteroidCode` set, nomenclature ORE) → return the single InventoryLedger movement group (`StationCode: stationCode ?? stationRowId` — **never null**; throw when the station row does not resolve, per TZ §10.2); absent kind → legacy heuristic untouched.
-   [ ] D2. `support/mmoomm-app-export/metahub-authoring.ts` — new helpers mirroring the economy block: `createAsteroidStatusEnumerationThroughBrowser` (enum `Active`/`Depleted`), `createMiningConstantsThroughBrowser` (Set + 9 fixed values, TZ §7.4), `createAsteroidObjectThroughBrowser` (object + components: STRING `Code`/`Name`/`ResourceCode`; NUMBER `PositionX/Y/Z`/`Scale`/`TotalQuantityKg`/server-owned `RemainingQuantityKg`/`ChunkMinKg`/`ChunkMaxKg`/`VisualVariant`; REF → `AsteroidStatus` for `Status`; DATE optional `LastMinedAt`; then serverOwned via `updateComponent` for `RemainingQuantityKg`/`Status`/`LastMinedAt`), `seedAsteroidRowsThroughApi` (five `createRecord` rows, TZ §7.7 geometry incl. `ChunkMinKg/ChunkMaxKg = 0.8/3.2`, `VisualVariant` 1…5).
-   [ ] D3. `generate-mmoomm-app-export.ts` — insert the mining block after the economy block (`:156-163` order: enum → constants → object+components → serverOwned → seed rows), keeping the publish/runtime-verify/export sequence intact.
-   [ ] D4. `mmoommAppFixtureContract.shared.ts` + `mmoommAppContentContract.ts` — additive assertions (codenames, Asteroid/enum/constants presence, serverOwned flags, belt geometry sanity); primary-nav check untouched (Asteroid is not primary).
-   [ ] D5. Regenerate the fixture: `pnpm run test:e2e:mmoomm-app-fixture-generator:local-supabase` with `UPDATE_MMOOMM_APP_FIXTURE=1` (never hand-edit), then `pnpm run check:mmoomm-app-fixture-contract` + `pnpm run check:mmoomm-app-fixture-drift` green.

### Phase E — Runtime journey E2E + visual proof (`tools/testing/e2e`, local Supabase)

-   [ ] E1. `support/mmoommMiningProof.ts` (new oracles, mirroring `mmoommEconomyProof.ts`): `expectBeltVisible` (5 asteroids via `canvas.dataset.miningAsteroidCount`, ≥3 distinct shapes/colors via screenshots), `targetAsteroidViaClick`, `fireViaUi`/`fireViaApi` (CSRF + optional `Idempotency-Key`), `expectMiningHud`, `readMiningDbState`/`assertMiningDbState` (remainder/status/Operation/facts — read-only SQL), `collectMiningScreenshots` (`assertPngHasVisibleContent`).
-   [ ] E2. `specs/flows/snapshot-import-mmoomm-app-mining.spec.ts` (new `@flow @slow`, single-test structure like the economy spec; **the test title MUST contain the phrase "imported MMOOMM app snapshot"** — the gate's leg-3 `--grep` is a regex substring match against test titles, e.g. `@flow @slow imported MMOOMM app snapshot mining journey fires, depletes and shares the belt`): import + runtime open; belt visible (FR-001/002/003); first fire (click → beam → chunks → cargo increments = chunk sum → HUD → `Mine` in operations list → wallet unchanged); cooldown 409 on rapid second fire; out-of-range 409 (fly away); full-cargo 409 → sell at station → mining resumes (TZ §6.2); **5–8 shot series asserting ≥2 distinct chunk masses and uneven cargo growth (TZ §14.3)**; depletion → last chunk → `Depleted` persisted after reload (TZ §6.3); two users — shared remainder, separate cargo/wallet (TZ §6.4); error matrix incl. missing-code 400 + strict-body 422 (server-owned fields rejected) and localized messages, no console errors, no drones/chunks disappear; docs-screenshot matrix EN/RU (1920×1080 pairs + provenance manifest) behind `MMOOMM_MINING_DOCS_SCREENSHOTS=1` (belt, firing shot, chunks, HUD, depleted asteroid); manual-acceptance JSON attach (TZ §14.4).
-   [ ] E3. Root `package.json` — `docs:mmoomm-mining:screenshots:local-supabase` script (mirror the economy one at `:86`; same `--grep "imported MMOOMM app snapshot"` title match with `MMOOMM_MINING_DOCS_SCREENSHOTS=1`).
-   [ ] E4. **Visual review (mandatory)**: open the captured PNGs and verify the belt actually renders (asteroids visible, distinct shapes), the beam/chunks appear, the HUD overlays without page-level overflow, depleted asteroids are dimmed — claims come from the screenshots, never assumptions; EN/RU parity checked visually.

### Phase F — Docs (GitBook) + READMEs

-   [ ] F1. `docs/en/guides/mmoomm-mining.md` + `docs/ru/guides/mmoomm-mining.md` (mirroring `mmoomm-economy.md`'s 206-line skeleton): `description:` front-matter; intro + hero image; `## Mining Loop`; `## Entity Model` (Asteroid/AsteroidStatus/MiningConstants tables); `## Mining API` (`state`/`fire` + request/response examples) with `### Idempotency-Key`; `## Targeting & Controls` (click/F/fire button, drag threshold); `## Error Codes` (TZ §8.2 table — all 12 rows, with the reserved 401/403 codes note); `## Mining HUD`; `## Configuration Constants` (TZ §7.4 values); `## Related Documentation` (+ economy cross-link both ways).
-   [ ] F2. `docs/en/SUMMARY.md` + `docs/ru/SUMMARY.md` — +1 line each under "Guides" (`:135` area).
-   [ ] F3. READMEs: `packages/universo-react-applications-backend/README.md` — `### Mining Runtime` under "## Economy Runtime" (routes, cooldown, single-ledger posting); **README-RU.md — add the missing `## Economy Runtime` section (fixing the existing EN/RU drift) + Mining**; `packages/universo-react-apps-template-mui/README.md` + RU twin — `### Mining canvas controls` sibling of "Economy dialog"; root `README.md`/`README-RU.md` — MMOOMM functionality list gains the mining loop line; run `pnpm run docs:gitbook-screenshot-assets:check` so every referenced GitBook image resolves.

### Phase G — Full verification (TZ §14.5 + §14.6)

-   [ ] G1. `pnpm --filter @universo-react/types test` && `pnpm --filter @universo-react/utils test`
-   [ ] G2. `pnpm --filter @universo-react/applications-backend test` (jest unit) && `pnpm run test:applications-integration:local-supabase` (incl. the new mining integration file)
-   [ ] G3. `pnpm --filter @universo-react/apps-template-mui test` (vitest incl. the new pointer/HUD suites)
-   [ ] G4. `pnpm run check:mmoomm-app-fixture-contract` && `pnpm run check:mmoomm-app-fixture-drift`
-   [ ] G5. `pnpm run test:e2e:mmoomm-app-gate:local-supabase` (generator → contract/drift → runtime flows incl. mining) + `pnpm run docs:mmoomm-mining:screenshots:local-supabase` + `pnpm run docs:gitbook-screenshot-assets:check`
-   [ ] G6. `pnpm build` (full workspace) + Thermos-rubric self-review; screenshots reviewed visually (E4); TZ §14.6 readiness checklist ticked with evidence links.

## Code Examples (quality / performance / safety patterns to follow)

**Strict request validation with the TZ §8.2 400/422 split (route-level, before the service):**

```ts
const MINING_FORBIDDEN_BODY_KEYS = ['quantity', 'mass', 'massKg', 'yield', 'price', 'unitPrice', 'totalPrice',
    'remaining', 'remainingQuantityKg', 'cargo', 'walletId', 'balance', 'status'] as const
// matching normalized like the trade helper (runtimeEconomyController.ts:23-28): key.trim().toLowerCase()
export async function fireMining(deps, query, req, res) {
    const ctx = await resolveRuntimeSchema(deps.getDbExecutor, query, req, res, req.params.applicationId)
    if (!ctx) return                                                  // resolveRuntimeSchema sends 401 itself (member-only)
    if (!ensureRuntimePermission(res, ctx, 'editContent')) return     // sends 403 itself; returns boolean (runtimeHelpers:1085-1096)
    const rawCode = typeof req.body?.asteroidCode === 'string' ? req.body.asteroidCode.trim() : ''
    if (!rawCode) return res.status(400).json({ error: 'Choose an asteroid', code: 'MINING_INVALID_TARGET' })       // TZ §8.2 row 1
    if (hasForbiddenMiningBodyKey(req.body))                            // casing-robust, trade-helper pattern
        return res.status(422).json({ error: 'Invalid mining payload', code: 'MINING_INVALID_PAYLOAD' })            // TZ §8.2 row 11
    const parsed = economyMineRequestSchema.safeParse(req.body ?? {})   // safeParse — .parse would escape as ZodError → 500
    if (!parsed.success) return res.status(422).json({ error: 'Invalid mining payload', code: 'MINING_INVALID_PAYLOAD' })
    // Idempotency-Key parse mirrors :95-114 (malformed → 400), then the service call in try/catch → UpdateFailure mapping
}
```

**Cooldown under the per-user lock (TOCTOU-safe by serialization; `'Mine'` is a STRING-column literal — unlike the StarterGrant template's resolved `_app_values` UUID):**

```ts
export async function assertMiningCooldown(tx: DbExecutor, ctx: RuntimeContext, economy: EconomyResolvedConfig, mining: MiningResolvedConfig) {
    await acquireAdvisoryXactLock(tx, `mining:${ctx.applicationId}:${ctx.userId}`)   // serializes this user's own fires
    const kindAttr = requireAttr(economy.operation.attrs, 'OperationKind')           // STRING component → physical TEXT column
    const occurredAttr = requireAttr(economy.operation.attrs, 'OccurredAt')          // DATE+'datetime' → physical TIMESTAMPTZ
    const { rows } = await tx.query(                                                 // active-row condition deliberately omitted:
        `SELECT 1 FROM ${qSchemaTable(ctx.schemaIdent, economy.operation.tableName)} // soft-deleted Mine rows still count —
          WHERE _upl_created_by = $1 AND ${quoteIdentifier(kindAttr.column_name)} = $2  // deleting rows cannot bypass cooldown
            AND ${quoteIdentifier(occurredAttr.column_name)} > $3 LIMIT 1`,
        [ctx.userId, 'Mine', new Date(Date.now() - mining.constants.miningCooldownMs)])
    if (rows.length > 0) throw new UpdateFailure(409, { error: 'Laser is recharging', code: 'MINING_COOLDOWN' })
}
```

**Fail-closed remainder update (same transaction as the posting; `depletedValueId` is the resolved `_app_values` UUID of the Status REF):**

```ts
const { rows } = await tx.query(
    `UPDATE ${qSchemaTable(ctx.schemaIdent, asteroid.tableName)}
        SET ${quoteIdentifier(remainingAttr.column_name)} = ${quoteIdentifier(remainingAttr.column_name)} - $1,
            ${quoteIdentifier(statusAttr.column_name)}  = CASE WHEN ${quoteIdentifier(remainingAttr.column_name)} - $1 <= 0 THEN $2 ELSE ${quoteIdentifier(statusAttr.column_name)} END,
            ${quoteIdentifier(lastMinedAttr.column_name)} = NOW()
      WHERE id = $3 AND ${quoteIdentifier(remainingAttr.column_name)} >= $1
      RETURNING id`, [totalKg, mining.depletedValueId, asteroid.rowId])
if (rows.length === 0) throw new UpdateFailure(500, { error: 'Mining failed', code: 'MINING_POSTING_FAILED' }) // AGENTS.md Mutation Rule
```

**TZ §9.2 effective radius — one shared formula, server and client:**

```ts
export function asteroidEffectiveRadius(scale: number, remainingKg: number, totalKg: number): number {
    const effectiveScale = 0.55 + 0.45 * (remainingKg / totalKg)   // TZ §9.2: same formula on both sides
    return scale * effectiveScale * 0.5
}
// server: distance(ship.position, asteroid.position) <= miningRadiusMeters + asteroidEffectiveRadius(...)
// client: sphere-pick + rendered entity scale use the same expression
```

**Client click branch (target vs fly):**

```ts
const handleCanvasClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (draggedRef.current) return                                   // threshold now > 5 px manhattan (TZ §11.2 ~6px)
    const canvas = canvasRef.current as PlayCanvasControlCanvas | null
    const asteroidHit = canvas?.__playcanvasPickAsteroid?.(event.clientX, event.clientY)   // sphere-pick branch
    if (asteroidHit) { setMiningTarget(asteroidHit); return }        // target selection — NO move_to_object intent
    const picked = canvas?.__playcanvasPickAt?.(event.clientX, event.clientY, false)
    if (picked?.objectId) canvas?.__playcanvasMoveToTarget?.(picked.point, picked.objectId)  // existing behavior
}
```

**Polling hook (interval from the payload; TanStack default pauses in hidden tabs — FR-024 for free):**

```ts
export function useMiningState(apiBaseUrl: string, applicationId: string, opts: { enabled: boolean }) {
    const query = useQuery({
        queryKey: ['mining-state', apiBaseUrl, applicationId],
        queryFn: ({ signal }) => fetchMiningState(apiBaseUrl, applicationId, signal),
        enabled: opts.enabled,                 // ready && realtime connected/restored && member mode
        refetchInterval: query.data?.constants.statePollMs ?? 2000   // TZ §11.5: poll every MiningStatePollMs
    })
    return query   // refetchIntervalInBackground defaults to false → hidden-tab pause (TanStack v5, pinned ^5.62.13)
}
```

## Potential Challenges & Mitigations

1.  **Posting-module branch regression** — the module source is baked generator data; the `Mine` branch must not disturb `StarterGrant`/`Sell`/`Buy`. Mitigation: branch keyed on the server-stamped `OperationKind`; legacy path untouched; jest module-branch tests (B6) + the both-registers contract assertion (D4) + E2E trade legs still green in the gate.
2.  **Fixture churn** — mining entities change the canonical snapshot broadly; drift normalization already covers uuid/hash/timestamp tokens. Mitigation: regenerate deliberately with `UPDATE_MMOOMM_APP_FIXTURE=1` (D5) and review the fixture diff in the PR.
3.  **E2E geometry adaptivity** — spawn position may already be inside/outside mining radius; mirror the economy spec's fixture-geometry-branching pattern (its docked/not-docked branches) instead of assuming positions.
4.  **Canvas teardown coupling** — asteroid entities/effects must be cleaned in BOTH the unmount path and `webglcontextlost`; keep asteroid definitions outside the `sceneObjects` dep array to avoid full-canvas rebuilds on poll updates (memoize the layer on asteroid state identity).
5.  **Cooldown seq scan** — `_upl_created_by` has no index; per-app Operation tables are small at MVP scale; flagged for later profiling (no index DDL — TZ forbids platform schema changes).
6.  **Performance NFR (TZ §13)**: fire p95 ≤ 400 ms — one transaction, ≤ 8 statements + an in-process room round-trip (sub-ms); state ≤ 200 ms — one SELECT of five rows + constants map; ≥ 50 FPS desktop / ≥ 30 FPS mobile — ≤ 5 asteroid entities + ≤ 24 short-lived chunk meshes, all destroyed mid-session; `prefers-reduced-motion` trims effects. Observability: structured logs + success/declined counters with `operationId/asteroidCode/applicationId/userId`, no secrets.
7.  **MUI v9 policy** — secondary text via `sx={{ color: 'text.secondary' }}`, never the `color` prop (economy-dialog fix precedent `67796852b`).
8.  **Trade touch scope** — the only trade-adjacent change is the one-line `OperationKind` stamp on the three existing `createEconomyRow` call sites (TZ §10.3); no trade logic/prices/grant behavior changes. Everything else untouched: flight scripts (`flight-control`, `follow-camera`, `remote-ships`), camera behavior, PlayCanvas Editor/Engine versions/scene/runtime manifest, `EconomyDialog` structure (additive only), other fixtures, `CURRENT_SCHEMA_SNAPSHOT_VERSION`, template manifests.

## Rollback (TZ §7.8)

-   Revert the PR; the fixture is NOT hand-restored — re-generate from the previous commit (`UPDATE_MMOOMM_APP_FIXTURE=1` via the generator gate). No migrations exist to roll back (no new tables; entity changes are authoring data consumed by the fresh-database contract).

## Dependencies

-   Phases ordered: A → B (backend) and C (client) parallelizable after A → D (generator, after B's module-branch design settles) → E (after B+C+D) → F/G (last).
-   Local Supabase (docker) required for D5/E/G; Playwright CLI runs standalone (`run-playwright-suite.mjs` spawns servers; `supabase:e2e:start:minimal` for the minimal stack).
-   Cross-package lockstep: types schemas + apps-template-mui client + i18n keys land together (vitest parity/strictness tests enforce it).

## Out of Scope (unchanged from TZ §15)

Drones/respawn/multiple ore types/laser upgrades/sound, ship damage/collisions, player market/contracts/taxes/dynamic prices/multi-currency, new kind-types/tables/ledger entities, direct ledger writes, public/anonymous mining, flight/camera/server-tick changes, Editor/Engine/scene/manifest changes, binary assets/LFS, hand-edited fixtures, `package.json` release-meta fix (separate defect).

## Decision Points for Owner Review

1.  **D6 deviation** — `MINING_AUTH_REQUIRED`/`MINING_PERMISSION_DENIED` are reserved-but-not-emitted (shared runtime guard handles 401/403 like sell/buy; no middleware fork for codes the UI renders generically). All other TZ §8.2 codes are emitted with the exact TZ statuses (incl. 400 `MINING_INVALID_TARGET`).
2.  **D3/§10.3 stamp scope** — new `StarterGrant`/`Sell`/`Buy` rows also receive `OperationKind` (one-line stamps in the existing call sites; TZ-required; no behavior change), so the module heuristic survives only for pre-field rows.
3.  **D2** — `StationCode` = row-UUID fallback (trade-consistent, never null); `FlightStation.Code` component deferred as optional.
4.  **D1** — mining flows colocated in the economy service factory (closure reuse; QA-confirmed minimal-invention choice) + the idempotency block mechanically extracted to `runtimeEconomyIdempotency.ts` to keep the service ≈800 lines.
5.  **Error i18n namespace** — `runtime.economyErrors.MINING_*` under the extended prefix gate (recommended) vs a separate `runtime.miningErrors.*` block + parallel localizer.

## Links

-   Research artifact (required input): `memory-bank/research/mmoomm-asteroid-mining-research-2026-11-17.md` (Reviewed, QA'd — 41/41 citations verified)
-   QA-refined Manager brief: local hand-off spec "MMOOMM Asteroid Mining MVP" (TZ DOC-2026-006; stored outside the repository in the local manager workspace)
-   Prior implemented slice: `memory-bank/plan/mmoomm-metahub-economy-plan-2026-11-12.md` + `memory-bank/research/mmoomm-metahub-economy-research-2026-11-12.md` (RES-2026-014)
-   Sibling conventions: `memory-bank/research/2026-11-17-release-screenshot-audit.md` (docs-asset generation precedent; 1920×1080 EN/RU pairs + provenance manifest)
-   Plan-mode/QA skills applied: `mui-runtime-ux-patterns` (UI Contract), `research-before-plan`, `playwright-best-practices` (E2E gates/commands), `thermos` (rubric framing for Phase G)
