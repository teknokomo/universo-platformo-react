# MMOOMM Asteroid Mining MVP — IMPLEMENT (2026-11-18)

> Implement QA-refined plan v2 at `memory-bank/plan/mmoomm-asteroid-mining-plan-2026-11-18.md` (research: `memory-bank/research/mmoomm-asteroid-mining-research-2026-11-17.md`, Reviewed). Fresh-database contract: no legacy code/backfill in touched paths; no schema/template version bumps; no new SQL tables. Pre-existing dirty paths (AGENTS.md, CLAUDE.md, READMEs, package.json version bump, memory-bank/progress.md) are preserved untouched. Previous phase record (Theme Presets IMPLEMENT 2026-11-03) is closed in git history and `progress.md`.

## Current Execution Plan

### Phase A — Shared types

-   [x] A1 `packages/universo-react-types/src/common/economyRuntime.ts`: `'mine'` kind, `MINING_*` codes + status map, strict `economyMineRequestSchema`/`economyMineResponseSchema`/`economyMiningStateSchema` (+asteroid/chunk entries, `chunkVisualLifetimeMs`).
-   [x] A2 Vitest: strict-rejection (FR-030), kind enum, map completeness. — 40 files / 356 tests green.

### Phase B — Applications backend

-   [x] B0 Mechanical extraction: idempotency block (`runtimeEconomyService.ts:119-260`) → `services/runtimeEconomyIdempotency.ts` (no behavior change; service re-exports keep controller/test imports stable).
-   [x] B1 `services/miningChunks.ts` pure math (TZ §9.3: skew, 0.1 rounding, scale-down clamp, last-chunk=remainder, capacity-before-operation, all-zero hole + sub-0.1 remainder guard).
-   [x] B2 `services/runtimeEconomySupport.ts`: `MINING_CONSTANTS_SET_CODE`, `resolveMiningConstants`/`resolveMiningConfig` (incl. `depletedValueId` fail-closed REF resolve, asteroid loader FOR UPDATE deterministic, `assertMiningCooldown`, `roundToTenth`, `asteroidEffectiveRadius`, `logEconomyEvent` moved here), `MINING_*` status rows + `ECONOMY_IDEMPOTENCY_KEY_INVALID` drift fix.
-   [x] B3 `services/runtimeEconomyService.ts`: `getMiningState`, `executeMiningFire` (TZ §9.1 chain, §9.2 radius formula, §9.4 tx, 0.1 rounding, counters), `OperationKind` stamps on trade/grant rows (TZ §10.3). Build green.
-   [x] B4 `controllers/runtimeEconomyController.ts`: `getMiningState`, `fireMining` (400/422 split, safeParse, guard-checked permission, normalized forbidden keys).
-   [x] B5 `routes/applicationsRoutes.ts`: `GET mining/state` (readLimiter) + `POST mining/fire` (writeLimiter).
-   [x] B6 Jest unit suites — miningChunks 7/7 + economy/mining service matrix 39/39 + full suite 228/2425 green. Posting-module Mine branch verified via contract (D4 serverBundle assertions) + real dispatch in E2E (unit harness spies the module boundary); noted in Notes.
-   [x] B7 PG integration — mining describe added inside `src/tests/persistence/runtimeEconomy.integration.test.ts` (8 tests: belt snapshot/rounding, happy path with InventoryLedger-only facts + remainder decrement, sequential + concurrent fires, two-user isolation, rejection matrix, sell-after-mine, committed cooldown + race; asteroid DDL + MiningConstants rows + OperationKind/AsteroidCode columns in the harness DDL). Skip-path green without DATABASE_TEST_URL; runner already lists the file.

### Phase C — Runtime template

-   [x] C1 `src/api/api.ts`: `fetchMiningState`, `postMiningFire`.
-   [x] C2 `src/dashboard/components/useMiningState.ts` hook (statePollMs interval, gating, applyFireResult).
-   [x] C3 `playcanvasCanvasWidgetRuntime.ts`: asteroid entity layer (effective scale §9.2), `__playcanvasPickAsteroid`, laser/chunks effects, dataset oracles, teardown both paths.
-   [x] C4 `PlayCanvasCanvasWidget.tsx`: Fire button + F, click branch (threshold >5), HUD + ≥90 % warning, toasts, Depleted dimming, prefers-reduced-motion.
-   [x] C5 i18n `apps.json` en/ru (`playcanvasCanvas.mining.*`, `runtime.economyErrors.MINING_*`) + EconomyDialog prefix gate.
-   [x] C6 Vitest: mining wiring suite added to PlayCanvasCanvasWidget.test.tsx — 10 new tests (fire gating, pointer sequence vs flight intents, 5 px threshold, fire POST + belt patch, FR-032/FR-034, localized MINING_OUT_OF_RANGE, capacity → Sell-ore action opens economy dialog, cargo HUD + ≥90 % warning, teardown contract, Mine-label regression). 58/58 green in-file; real-i18next harness upgrade documented in-file.

### Phase D — Product-file generator + contracts

-   [x] D1 `mmoommAppGeneratorData.ts`: mining codenames/constants + posting-module Mine branch (never-null StationCode).
-   [x] D2 `metahub-authoring.ts`: asteroid enum/constants/object helpers + serverOwned + seed rows (TZ §7.7 geometry).
-   [x] D3 `generate-mmoomm-app-export.ts`: mining block after economy block.
-   [x] D4 Contract extensions (`mmoommAppFixtureContract.shared.ts`, `mmoommAppContentContract.ts`).
-   [x] D5 Fixture regenerated ×5 (final fixture: 5 asteroid rows AST-01..05, AsteroidStatus enum, MiningConstants 9 values incl. fractional 0.8/3.2/1.6 via API path with scale 3, OperationKind/AsteroidCode components server-owned). Contract PASS on final fixture. Drift PASS in gate round 2 (rerun in pending gate round 3).

### Phase E — E2E journey + visual proof

-   [x] E1 `support/mmoommMiningProof.ts` oracles (dataset-based belt oracles, sweep targeting via `__playcanvasPickAsteroid`, fire UI/API, cmp_-resolved DB state, screenshots) + minimal economy-proof diff (exported postWithCsrf/readJsonBody).
-   [x] E2 `specs/flows/snapshot-import-mmoomm-app-mining.spec.ts` — title carries "imported MMOOMM app snapshot" (gate grep verified via `playwright test --list`); full TZ §14.3 matrix incl. 6-shot series, adaptive geometry/full-cargo legs, EN/RU viewport + docs-asset matrix, manual-acceptance JSON.
-   [x] E3 Root scripts `docs:mmoomm-mining:screenshots:local-supabase`.
-   [x] E4 Visual review of captured PNGs (belt EN: 5 distinct asteroids + station + ship + Fire button; fire EN: glow shell + Laser-is-recharging toast; depleted EN + RU hud: localized labels; no page-level overflow; E4 PASS).

### Phase F — Docs (GitBook) + READMEs

-   [x] F1 `docs/en|ru/guides/mmoomm-mining.md` (economy-guide skeleton) + economy-guide cross-links (EN/RU).
-   [x] F2 `docs/en|ru/SUMMARY.md` +1 line each.
-   [x] F3 READMEs: backend EN (+Mining Runtime) + RU drift fix (Economy Runtime added + Mining); apps-template-mui EN/RU (+Mining canvas controls); root EN/RU implementation-status line.

### Phase G — Full verification

-   [x] G1 types 356/356 + utils 460/460 green.
-   [x] G2 `pnpm --filter @universo-react/applications-backend test` && `pnpm run test:applications-integration:local-supabase`
-   [x] G3 `pnpm --filter @universo-react/apps-template-mui test`
-   [x] G4 fixture contract PASS + drift PASS on the final fixture.
-   [x] G5 `pnpm run test:e2e:mmoomm-app-gate:local-supabase` + `docs:mmoomm-mining:screenshots:local-supabase` + `docs:gitbook-screenshot-assets:check`
-   [x] G6 `pnpm build` + lint/prettier on touched packages + Thermos self-review + §14.6 checklist.

## Owner bug-fix round (2026-11-22, full rebuild + app created from the fixture)

Four UX issues reported by the owner after creating a real app from the fixture:

-   [x] B1 Extra top paddings (left sidebar gap + content dead band): PR #931 made `showAppNavbarOnDesktop = showAppNavbar` unconditional while `AppNavbar` is `display: none` on desktop in docked-wide mode — a dead 64px band above the title. Restored visibility-gated offset (`showAppNavbar && (overlay || rightWidgets)`) in Dashboard.tsx; SideMenu's static `mt: 10` became a `topOffset` prop driven by the same condition (0 when the navbar is hidden).
-   [x] B2 Ship flies through asteroids: movement engine ALREADY supported `occupiedEntities` spheres — never fed. Server: `FixedTickSceneRoomOptions.occupiedSpheres` (+ parse/cap 64, HMAC-signed automatically), room tick passes `occupiedEntities` + `bodyRadius` (blocked handling native), `applyIntent` resolves targets outside spheres; authored module reads `ctx.records.list('Asteroid')` (capability `records.read` added) and emits spheres with the effective-scale radius formula. Client: `flightControl.setAsteroidObstacles` (AABB cube proxy) merged into resolveTarget/prediction/reconciliation clamps; widget runtime feeds belt geometry per poll (solo prediction stops like the server; client radius ≤ server radius at all times so reconciliation never sticks). **Corridor adjustment**: the TZ §7.7 AST-01 spot (36, 2, -26) sat 3.2 m off the direct spawn→station line, so collisions permanently blocked the authored app's move-to-station route (the runtime journey's zero-movement trace proved it — ship frozen exactly at the bodyRadius+radius contact distance); AST-01 moved to (30, 2, -34) — 13.2 m corridor approach, all five rocks now clear the route, no rock-rock visual overlaps; pinned positions updated in the integration/unit stubs and the mining spec's BELT_FIXTURE; docs screenshots regenerated for the new belt layout.
-   [x] B3 Unclear shooting target: hover vs selected shared ONE glow — hover now only faintly lights (opacity 0.1 vs selected 0.22, depleted never hover-lights); the Fire control is a labeled button showing the target code (`Fire: AST-04` / disabled `Fire` with the "click an asteroid" tooltip); HUD cargo/target text switched from theme colors to fixed light-on-dark (`#e2e8f0`/`#cbd5f5`) — in light theme `text.primary` was near-black on the dark HUD backdrop (nearly invisible).
-   [x] B4 Stale EconomyDialog numbers after mining: mining fire onSuccess invalidates the `economy-summary` query family (same as trades do) — the dialog opens fresh instead of a pre-fire cached snapshot + 15s poll delay.
-   [x] Tests: realtime parse/feeding tests (+2, 51/51), widget suite 58/58 (material mock gained the real `update()` API — the runtime's glow-opacity mutation crashed plain-object mocks and wedged act()), backend build, mui build, metahubs build, lint 0 errors, prettier; guides EN/RU document collisions + armed Fire button; fixture regenerated twice (module serverBundle + corridor position) with contract/drift PASS on both; final runtime leg 4 passed (9.9m); backend unit 228 suites / 2429 tests + integration 14 suites / 84 tests GREEN; metahubs 147/1711; docs screenshots regenerated (belt layout) + gitbook asset check PASS.

## Owner UX round 2 (2026-11-23, four corrections on the previous fixes)

-   [x] U1 Top padding overshoot: the visibility-gated fix removed the offset entirely (the header actions row sat flush at the viewport top). The content Stack now carries `pt: { xs: 2, sm: 3 }` — the top padding mirrors the horizontal one (standard, symmetric), the 64px dead band stays gone.
-   [x] U2 Fire button style: the labeled `Button` was off-style (no outline, gray content). Reverted to an icon-only `IconButton` in the shared toolbar style; the selected-target name lives only in the top-left HUD. Removed the unused `fireAt`/`fireShort` locale keys; the widget test asserts the icon-only shape (no text content, accessible name = guidance).
-   [x] U3 Selection toggle: clicking the already-selected asteroid now CLEARS the fire target (`setMiningTargetCode → null`); new widget test proves the second click disarms the control and the target event carries a null code.
-   [x] U4 Belt distance: the belt sat 21-45 m from the station — mineable while docked and visually hugging it. New layout (AST-01 (−4,2,4), AST-02 (16,−3,20), AST-03 (2,5,18), AST-04 (30,−4,28), AST-05 (10,6,28)): 87-99 m from the station (beyond the 80 m mining radius + rock radius — firing always requires a short flight), 25-39 m from the spawn (fires still work there), clear of the spawn→station corridor, no rock-rock overlaps. Synced positions across BELT_FIXTURE, the integration seeds and the unit stub.
-   [x] E2E adjustments for the moved belt: the out-of-range fly-away point moved to (18, 3, −110) (south, away from the belt), and the full-hold/resume/series legs fly to the belt vicinity (14, 3, 2) first — with a live-distance poll (`data-mining-target-distance-meters` < 80) because the fly intent assertion does not wait for the flight (the missing wait raced the docs run: the fire 409ed MINING_OUT_OF_RANGE instead of the capacity code). Verification: widget 59/59 (+toggle test), backend unit 228/2429 + integration 14/84, fixture regenerated + drift/contract PASS, runtime leg 4 passed (9.8m), docs screenshots regenerated + gitbook PASS.

## PR #934 review round (2026-11-23, bots + CI)

-   [x] **Fixed (8)**: (1) Greptile P1 room split — the volatile `occupiedSpheres` no longer feeds `roomConfigHash`/`scopeId` (players stay in one room after mining); (2) Greptile P1 capacity overfill — free space floors to the tenth (`Math.floor`); (3) Greptile P2 stale HUD cargo — the HUD summary query joined the `economy-summary` family and the own-fire override clears on fresher summary data; (4) Greptile P2 detached target-state listener — effect deps `[ready, sceneReady]`; (5) CodeRabbit major — `workspaceId` on mining state/fire, economy summary and trade fetches + query keys (matches the joined room); (6) CodeRabbit major docs i18n — six MMOOMM images referenced in the guides, EN/RU line counts aligned (167/167); (7) chunks bound — sanity cap `ChunksPerHitMax <= 3` matching the response schema; (8) overlong asteroid code → 400 `MINING_INVALID_TARGET` (TZ §8.2). Plus CodeRabbit 689: the flight context reads AFTER the asteroid row lock (fresh range check).
-   [x] **Skipped with justification (8)**: module catch silent (isolate console is a stub; fail-open colliders is deliberate), starter-grant ordering (the grant can never overshoot capacity; reordering adds a wallet lock pre-capacity), `NOW()` vs `clock_timestamp()` (immaterial), idempotency purge lock order (the purge already runs outside the gate tx), asteroid one-target-per-code (generator dedupe already enforces it), `firesDeclined` counting earlier guards (informational), openapi 201/422 (auto-generated boilerplate across all POST routes).
-   [x] **CI build job root causes fixed**: (a) the post-reconnect movement leg is deterministic (retreat-to-known-point then trace the move-to-target; the previous stop-park raced slow CI runners); (b) retry-proof admin e-mails (per-attempt suffix — Playwright retry #1 reused the runId and hit "already registered"); (c) **ghost-ship collision bug** — a ship reserved for reconnect (`onDrop`) kept acting as a physical obstacle and pinned every other ship until the window expired; reserved ships are now excluded from the ship↔ship collision pass, intent target resolution and spawn scans; (d) intentional-offline console noise: the mining-state poll's `ERR_INTERNET_DISCONNECTED` failures are ignored by the runtime spec watcher; (e) `waitUntilMiningShipNear` reads the new AUTHORITATIVE ship-position datasets (the rendered ship is a solo prediction and outran the server — fires validate server-side); (f) intent oracles clear before dispatch so stale `data-last-intent-kind` values cannot pass a swallowed click; (g) the negative-matrix block moved next to the first series (ample hold headroom) with a cooldown wait and keyed chunks counted in `totalMinedKg`; (h) the depletion unit test determinized (remainder below the min chunk).
-   [x] Verification: backend unit 228 suites / 2429 tests, integration 14 / 84, widget 59/59, docs i18n 119 pairs PASS, eslint 0 errors both packages, mining journey solo GREEN (5.6m), runtime journey solo GREEN (8.8m).

## Owner UX round 3 (2026-11-23, two corrections + one product bug found)

-   [x] R3-1 "Create" junk button on the Welcome section: the host dashboard renders the generic `Create` row action (`DashboardApplicationRuntime` — `showCreateButton` from the layout behavior config); the generator only disabled it on the two scoped Space/Visual-Lab layouts, so the default (Welcome) layout kept the template default `true`. Extracted `applyLayoutBehaviorConfig` and applied the canonical `objectBehavior.showCreateButton = false` to the default layout too — the published MMOOMM app creates rows via gameplay services, never the user. Fixture snapshot verified: all three layouts carry the flag.
-   [x] R3-2 Belt x5 distance: AST-01 (-249, 7, 274), AST-02 (-229, 2, 290), AST-03 (-243, 10, 288), AST-04 (-215, 1, 298), AST-05 (-235, 11, 298) — 450-465 m from the station (five times the previous 88-93 m), 385-398 m from the spawn, belt shape preserved, corridor clear. The mining journey restructured for the long flights: fly to the belt FIRST (the targeting sweep cannot find rocks at 390 m), a `waitUntilMiningShipNear` ship-position poll (fly intents prove acceptance only), station-gated sells via an explicit dock-sell-fly-back cycle in the full-hold/resume/series/depletion/pre-matrix/docs legs, user B flies to the belt before firing, journey timeout 30 min.
-   [x] R3-BUG (found by the restructure, real product defect): a ship docked at the station could never leave. The room pushed guarded intent targets only the default 0.02 m clear of the guard box; the client's `resolveTarget` obstacle clamp orients the ship along the departure direction, and the parked body's tail swings back into the guard box -> the clamp returns the current position -> every departure intent becomes a no-op (masked in earlier runs by short hops + loose 80 m polls). Fixed at the room's `applyIntent`: the guard clearance now equals the ship body radius (`resolveBodyRadius`) — the ship parks ~28 m from the station center with its docking approach, and the departure flies with zero blocked ticks (probe-verified against the real engine).
-   [x] Verification: backend unit 228 suites / 2429 tests, integration 14 / 84, mining journey solo GREEN (6.4 m), runtime leg 4 passed (14.7 m), fixture regenerated + drift/contract PASS, docs screenshots regenerated (belt at x5, station tiny in the distance) + gitbook PASS.
## Notes & Discoveries

### QA IMPLEMENT closeout (2026-11-19)

**Backlog closure round (owner IMPLEMENT command after QA PASS)** — all MEDIUM debt closed:
-   [x] M1 Operation-immutability defense-in-depth: contract asserts `recordBehavior.mode === 'transactional'` + `immutability === 'posted'`; authoring poll asserts immutability persisted; guides (EN/RU) note the requirement. Verified `immutability: 'posted'` really is in the fixture snapshot, so the new contract assert passes as-is.
-   [x] M2 Asteroid.Code unique validation: generator dedupe guard in `seedAsteroidRowsThroughApi` + belt-code uniqueness in `assertMiningDomainModel`.
-   [x] M3 MiningConstants sanity checks: `assertMiningConstantsSane` in `resolveMiningConstants` (radius>0, cooldown>=0, chunks 1..max, max>=min, skew>0, lifetimes>0) fail-closed MINING_POSTING_FAILED + 9-case table-driven unit tests via the new `constantsRows` stub override.
-   [x] M4 cross-user cooldown unit test: `miningCooldownRows` accepts a param-aware function; USER_B ctx; user A 409 inside the window while user B executes; advisory-lock keys `mining:<app>:<userId>` asserted for both.

**Integration-suite defects found and fixed during backlog closure (pre-existing in the working tree, never caught because the last full integration verification predated the final edits to this file):**
1. `cleanupCommittedFixture` used PG-positional `$1/$2` bindings inside `knex.raw` — knex's array-binding mode only substitutes `?`, so every committed-fire cleanup threw "Expected 2 bindings, saw 0" and cascaded belt-state pollution into the next tests. Switched to `?` style (consistent with all 18 other knex.raw calls).
2. The full-cargo pre-fill INSERT omitted `_upl_created_by` — the InventoryLedger read scope is ownerOnly on that column, so the seeded 1000 kg fact was invisible to the cargo projection and the fire wrongly succeeded. INSERT now carries `_upl_created_by = $1`.
3. The sell test expected `[-chunkSum, STARTING_ORE_KG, chunkSum]` from a `ORDER BY quantity ASC` read — unsortable for chunkSum < 10 (always); corrected to `[-chunkSum, chunkSum, STARTING_ORE_KG]`.

QA IMPLEMENT gate complete: **PASS after fixes**. Two independent audit agents — (A) Thermos-style code audit: 0 CRITICAL, 0 HIGH, 3 MEDIUM backlog; (B) TZ/plan coverage audit: PASS-WITH-FIXES, both HIGH defects fixed in-session:
1. GitBook asset-name drift — guides embed `mmoomm-mining-<stage>-<locale>.png` while the copy step wrote unlocalized names; fixed the spec copy step to localized names + renamed the 8 existing assets; `docs:gitbook-screenshot-assets:check` PASS.
2. FR-018 client dimming was missing — `buildMiningLayer` now renders Depleted asteroids with dark non-emissive translucent materials, and the widget drops the target after a Depleted fire response. Visually confirmed in the regenerated `mmoomm-mining-depleted-*.png`.

**Debugging conclusions (belt-0 + fire-409, all fixed and fixture-rebuilt):**
1. Root cause 1 — fractional fixed values: the fixed-value dialog defaults NUMBER scale to 0, silently nulling 0.8/3.2/1.6 (`ChunkMassMinKg/ChunkMassMaxKg/ChunkMassSkew` were null in the fixture → `resolveMiningConstants` → 409 ECONOMY_MARKET_DISABLED on `mining/state`). Fix: `createMiningEnumerationAndConstantsThroughBrowser` creates the three fractional constants via API POST with `validationRules: { scale: 3 }` (poll asserts 9 non-null values in the MiningConstants set). Browser-scale filling proved flaky (hidden Type Settings input) and was reverted.
2. Root cause 2 — OperationKind component missing: `createEconomyObjectsThroughBrowser` did not author `OperationKind`/`AsteroidCode` STRING components (only the module source referenced them) → `assertMiningCooldown`'s `requireAttr(operation, 'OperationKind')` → 409 "Economy entity is missing the OperationKind field". Fix: components added + serverOwned flags extended to `['Quantity','UnitPrice','TotalPrice','OperationKind','AsteroidCode']`. Verified in fixture: OperationKind component codename present.
3. `apiSend` returns a native fetch Response (`.ok` property, not `.ok()`); it does NOT throw on 4xx — always check `response.ok` and surface the body.
4. All temporary diagnostics (`[mining-debug]` console.info in spec/widget/runtime, early state-dump block) removed and verified absent before final QA.
5. fireViaUi assertion surfaces the response payload in the message (useful; keep).

**Backlog (MEDIUM, tracked, not blocking):** document the Operation-immutability requirement behind Mine posting (`RECORD_IMMUTABLE` is the only guard — defense-in-depth config recommended); add Asteroid.Code unique validation in the app generator; MiningConstants sanity checks (max >= min, skew > 0); unit tests for cross-user cooldown isolation.

### General discoveries

-   **Module-source backtick trap**: comments inside `economyPostingModuleSource` (a template literal) must never contain backticks — `` `OperationKind` `` in a comment closes the literal and esbuild's compile step fails at generator runtime with `Missing semicolon` (two occurrences fixed: the Mine-branch intro and the legacy-heuristic comment). Validation harness for module sources: `esbuild.transform(source, { loader: 'js' })` — the `node --check` TS parse does NOT validate the embedded string.
-   **Pre-existing frontend failures**: `Dashboard.test.tsx` (2 style assertions) fails identically on a clean checkout (verified via `git stash push` of the touched packages → same 2 failed | 21 passed) — unrelated to mining; heavy-suite flakiness documented in project memory. Widget/EconomyDialog suites pass in isolation (48/48).
-   **Market side narrowing**: widening `economyTradeKindSchema` with `'mine'` leaked `'mine'` into the summary `market[].side`; fixed with a separate `economyMarketSideSchema = z.enum(['sell','buy'])` for market rows (backend `MARKET_SIDE_CONFIGS` retyped to `EconomyMarketSide`).
-   **Gate grep mechanics**: `--grep "imported MMOOMM app snapshot"` is a regex substring match against test TITLES — the mining spec title carries the phrase verbatim.
-   **pc.Entity API**: no `setEnabled` method — use the `enabled` property; PlayCanvas entities have no DOM attributes, so belt E2E oracles are `canvas.dataset.*` projections, not `data-asteroid-*` attributes.
-   **cross-env on Linux**: plain shell env vars suffice for local runs (`UPDATE_MMOOMM_APP_FIXTURE=1 pnpm run …`); the `cross-env` binary is only resolvable inside `pnpm run` script contexts.
-   B6 posting-module branch tests live at two levels: unit spy asserts the movement-group shape the module returns (service-level) and the real compiled module runs only in E2E (the modules engine compiles at generator runtime); the compiled `serverBundle` shape is contract-asserted.
