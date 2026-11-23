import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '../../fixtures/test'
import {
    addApplicationMember,
    createAdminUser,
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    disposeApiContext,
    getApplication,
    getAssignableRoles,
    syncApplicationSchema
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { withE2eDatabaseClient } from '../../support/backend/e2eDatabase.mjs'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { switchRuntimeLocale } from '../../support/browser/preferences'
import {
    expectNoPageHorizontalOverflow,
    expectNoVerticalPageOverflow,
    expectRuntimeUxViewportMatrix
} from '../../support/browser/runtimeUx'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication
} from '../../support/backend/run-manifest.mjs'
import { importMmoommAppSnapshotThroughUi } from '../../support/mmoommAppSnapshotImport'
import {
    CHUNK_MASS_MAX_KG,
    CHUNK_MASS_MIN_KG,
    CHUNK_VISUAL_LIFETIME_MS,
    MAX_CARGO_MASS_KG,
    MINING_COOLDOWN_MS,
    MINING_RADIUS_METERS,
    MINING_STATE_POLL_MS,
    STARTING_BALANCE,
    STARTING_ORE_KG
} from '../../support/mmoommAppGeneratorData'
import { MMOOMM_MOVE_TO_TARGET_BUTTON_NAME } from '../../support/mmoommRuntimeProof.navigation'
import { MMOOMM_RUNTIME_EXPECT_TIMEOUT, openMmoommSpaceSection } from '../../support/mmoommRuntimeProof'
import {
    assertEconomyDbState,
    closeEconomyDialog,
    createEconomyIdempotencyKey,
    expectEconomyArrivalViaApi,
    expectEconomyPanelVisible,
    fetchEconomySummaryViaApi,
    resolveApplicationSchemaName,
    tradeViaApi,
    tradeViaUi,
    type EconomyDatabaseClient
} from '../../support/mmoommEconomyProof'
import {
    assertMiningDbState,
    collectMiningScreenshots,
    expectMiningBeltVisible,
    expectMiningCapacityHint,
    expectMiningCargoHud,
    expectMiningError,
    expectMiningTargetOutOfRange,
    fetchMiningStateViaApi,
    fireViaApi,
    fireViaUi,
    flyMiningShipToPoint,
    MINING_OUT_OF_RANGE_DISTANCE_METERS,
    readMiningCargoHud,
    readMiningDbState,
    readMiningTargetOracles,
    selectAsteroidViaClick,
    waitUntilMiningShipNear,
    type MiningDatabaseClient,
    type MiningFirePayload,
    type MiningStatePayload
} from '../../support/mmoommMiningProof'

type LoggedInApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const APP_RUNTIME_TIMEOUT = 180_000

// Fixture economy constants (tools/testing/e2e/support/mmoommAppGeneratorData.ts):
// ore sells at 10 CR/kg, fuel buys at 5 CR/L with an authored 0.8 kg per liter mass.
const FUEL_MASS_PER_LITER = 0.8

// Fixture belt geometry (seedAsteroidRowsThroughApi): five asteroids
// AST-01..05 with fixed positions/scales/stocks. The ship spawns at
// (18, 3, -9); the station with its guard zone sits at (72, 0, -48). The belt
// lives 450-465 m from the station — five times the previous 88-93 m, beyond
// the 80 m mining radius, so firing always requires a real flight — and
// 385-398 m from the spawn, clear of the spawn→station corridor the
// occupiedSpheres colliders guard (UX round 2026-11-23).
const BELT_FIXTURE = {
    'AST-01': { position: { x: -249, y: 7, z: 274 }, scale: 7, totalQuantityKg: 120 },
    'AST-02': { position: { x: -229, y: 2, z: 290 }, scale: 9, totalQuantityKg: 160 },
    'AST-03': { position: { x: -243, y: 10, z: 288 }, scale: 6, totalQuantityKg: 90 },
    'AST-04': { position: { x: -215, y: 1, z: 298 }, scale: 10, totalQuantityKg: 200 },
    'AST-05': { position: { x: -235, y: 11, z: 298 }, scale: 8, totalQuantityKg: 140 }
} as const

// Fire vantage point south of the belt: inside the mining range of every rock
// (27-46 m), outside every collision sphere, and reachable by a single
// move_to_point flight from both the spawn and the station.
const BELT_VICINITY_POINT = { x: -230, y: 3, z: 255 } as const
const BELT_CODES = Object.keys(BELT_FIXTURE)

/** Viewport whose captures are committed into docs/.gitbook assets (M2). */
const MINING_DOCS_VIEWPORT_NAME = 'desktop-1920'
// Phase E matrix: the standard 1920x1080 desktop plus the two responsive risk
// viewports from the plan's UI Contract (1280x800 laptop, 390x844 mobile).
const MINING_SCREENSHOT_VIEWPORTS = [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'laptop-1280', width: 1280, height: 800 },
    { name: 'mobile-390', width: 390, height: 844 }
]

type BrowserRegressionIssue = {
    source: 'console' | 'pageerror' | 'requestfailed'
    text: string
}

const isIgnoredBrowserRegressionIssue = (issue: BrowserRegressionIssue) =>
    issue.source === 'requestfailed' && issue.text.includes('net::ERR_ABORTED')
// The negative matrix intentionally drives fire attempts into 409/422
// rejections (cooldown, out-of-range, depleted, capacity, invalid payload) —
// Chromium logs every non-2xx fetch as a console error. The rejections
// themselves are asserted explicitly through fireViaUi/fireViaApi
// expectedStatus, so the generic resource-load noise is not a regression.
const isExpectedRejectionNoise = (issue: BrowserRegressionIssue) =>
    issue.source === 'console' && issue.text.includes('Failed to load resource: the server responded with a status of 409 (Conflict)')

const watchBrowserRegressionIssues = (page: Page) => {
    const issues: BrowserRegressionIssue[] = []
    page.on('console', (message) => {
        if (message.type() === 'error') {
            const issue = { source: 'console' as const, text: message.text() }
            if (!isExpectedRejectionNoise(issue)) {
                issues.push(issue)
            }
        }
    })
    page.on('pageerror', (error) => {
        issues.push({ source: 'pageerror', text: error.message })
    })
    page.on('requestfailed', (request) => {
        const issue = { source: 'requestfailed' as const, text: request.failure()?.errorText ?? 'Request failed' }
        if (!isIgnoredBrowserRegressionIssue(issue)) {
            issues.push(issue)
        }
    })
    return issues
}

const resolveGlobalRoleIds = (roles: Array<{ id?: string; codename?: string }>, roleCodenames: string[]) => {
    const roleMap = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    const roleIds = roleCodenames.map((codename) => roleMap.get(codename.toLowerCase())).filter(Boolean)
    if (roleIds.length !== roleCodenames.length) {
        const missing = roleCodenames.filter((codename) => !roleMap.has(codename.toLowerCase()))
        throw new Error(`Assignable global role(s) not found: ${missing.join(', ')}`)
    }
    return roleIds
}

const readFirePayload = (payload: Record<string, unknown> | null): MiningFirePayload => (payload ?? {}) as MiningFirePayload

const readTradeBalance = (payload: Record<string, unknown> | null): number => Number((payload ?? {}).walletBalance)

/** Validates the TZ §8.2 chunk envelope (1..3 chunks, mass bounds, visual scale cap) and sums the masses.
 * `enforceMin = false` relaxes the per-chunk minimum for depletion-grind shots whose remainder
 * is scaled down proportionally (TZ §9.3) — positivity is still enforced. */
const readChunkShot = (
    fire: MiningFirePayload,
    { enforceMin = true }: { enforceMin?: boolean } = {}
): { totalKg: number; masses: number[] } => {
    const chunks = Array.isArray(fire.chunks) ? fire.chunks : []
    expect(chunks.length, 'mining fire must return 1..3 chunks').toBeGreaterThanOrEqual(1)
    expect(chunks.length, 'mining fire must return 1..3 chunks').toBeLessThanOrEqual(3)
    const masses = chunks.map((chunk) => {
        const massKg = Number(chunk.massKg)
        // TZ §9.3: full-mass draws respect the configured minimum; when the
        // remainder is scaled down proportionally, chunks may drop below the
        // minimum and the FINAL chunk equals the remainder.
        if (enforceMin) {
            expect(massKg, 'chunk mass must respect the configured minimum').toBeGreaterThanOrEqual(CHUNK_MASS_MIN_KG)
        }
        expect(massKg, 'chunk mass must respect the configured maximum').toBeLessThanOrEqual(CHUNK_MASS_MAX_KG)
        expect(massKg, 'chunk mass must be positive').toBeGreaterThan(0)
        const scale = Number(chunk.scale)
        expect(scale, 'chunk visual scale must be positive').toBeGreaterThan(0)
        expect(scale, 'chunk visual scale is capped away from the full asteroid size').toBeLessThanOrEqual(0.9)
        return Math.round(massKg * 10) / 10
    })
    return { totalKg: Math.round(masses.reduce((sum, mass) => sum + mass, 0) * 10) / 10, masses }
}

const readBeltAsteroid = (payload: MiningStatePayload | null, code: string) => {
    const asteroid = payload?.asteroids.find((entry) => entry.code === code)
    expect(asteroid, `belt state must contain asteroid ${code}`).toBeDefined()
    return asteroid as NonNullable<typeof asteroid>
}

const readCargoOreKg = (payload: Awaited<ReturnType<typeof fetchEconomySummaryViaApi>>['payload'], oreCode: string): number => {
    const entry = (payload?.cargo ?? []).find((item) => item.nomenclatureCode === oreCode)
    expect(entry, `economy summary cargo must contain the ore nomenclature ${oreCode}`).toBeDefined()
    return Number(entry?.quantity)
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

test.describe('MMOOMM PlayCanvas Editor snapshot import mining', () => {
    let api: LoggedInApiContext | null = null

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
            api = null
        }
    })

    test('@flow @slow imported MMOOMM app snapshot mining journey fires, depletes and shares the belt', async ({
        browser,
        page,
        runManifest
    }, testInfo) => {
        // Broad product proof on the canonical fixture: snapshot import,
        // publication/schema sync, the five-asteroid belt, click targeting,
        // UI/API fires with server-authoritative chunks, cooldown, out-of-range
        // flight, capacity gating with the sell resume loop, a depletion grind,
        // two-user belt sharing/isolation, the negative matrix, the EN/RU
        // screenshot matrix and console hygiene. The belt sits 450+ m from the
        // station and the spawn (UX round 2026-11-23) — the mining legs carry
        // several real flights, so the budget is generous.
        test.setTimeout(1_800_000)
        const label = 'MMOOMM app mining'

        const issues = watchBrowserRegressionIssues(page)

        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        // ── a. Import fixture → create publication/application → sync schema ──
        const imported = await importMmoommAppSnapshotThroughUi(page)
        await recordCreatedMetahub({
            id: imported.metahubId,
            name: imported.metahubName,
            codename: 'UniversoMmoomm'
        })
        await recordCreatedPublication({
            id: imported.publicationId,
            metahubId: imported.metahubId,
            schemaName: null
        })

        const applicationName = `MMOOMM App Mining ${runManifest.runId}`
        const linked = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })
        const applicationId = linked?.application?.id ?? linked?.id
        if (typeof applicationId !== 'string') {
            throw new Error('MMOOMM mining linked application did not return an application id')
        }
        await recordCreatedApplication({ id: applicationId })

        await syncApplicationSchema(api, applicationId)
        await expect
            .poll(
                async () => {
                    const persisted = await getApplication(api as LoggedInApiContext, applicationId)
                    return persisted?.schemaStatus ?? null
                },
                { timeout: APP_RUNTIME_TIMEOUT }
            )
            .toBe('synced')

        // ── b. Open the published application: realtime canvas, mining HUD, belt of 5 ──
        await page.goto(`/a/${applicationId}`)
        await openMmoommSpaceSection(page)
        const canvas = page.getByTestId('playcanvas-canvas')
        await expect(canvas, `${label} realtime canvas must connect`).toHaveAttribute('data-realtime-status', /^(connected|restored)$/, {
            timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
        })
        // QA 2026-11-17: the flight runtime is a fixed-viewport page — the
        // measured canvas must fill it exactly (no junk document scrollbar).
        await expectNoVerticalPageOverflow(page, `${label} fixed-viewport runtime`)
        await expectMiningBeltVisible(page, `${label} belt`)
        await expectNoPageHorizontalOverflow(page, `${label} runtime with the mining HUD`)

        const beltState = await fetchMiningStateViaApi(api, applicationId)
        expect(beltState.status, `${label} belt state must load for user A`).toBe(200)
        expect(
            beltState.payload?.asteroids.map((asteroid) => asteroid.code),
            `${label} belt must expose AST-01..05 in order`
        ).toEqual(BELT_CODES)
        for (const code of BELT_CODES) {
            const asteroid = readBeltAsteroid(beltState.payload, code)
            const fixture = BELT_FIXTURE[code as keyof typeof BELT_FIXTURE]
            expect(asteroid.name, `${label} ${code} localized name must render`).toBeTruthy()
            expect(asteroid.resourceCode, `${label} ${code} resource nomenclature`).toBe('ORE')
            expect(asteroid.position.x, `${label} ${code} fixture position x`).toBeCloseTo(fixture.position.x, 6)
            expect(asteroid.position.y, `${label} ${code} fixture position y`).toBeCloseTo(fixture.position.y, 6)
            expect(asteroid.position.z, `${label} ${code} fixture position z`).toBeCloseTo(fixture.position.z, 6)
            expect(asteroid.scale, `${label} ${code} fixture scale`).toBeCloseTo(fixture.scale, 6)
            expect(asteroid.totalQuantityKg, `${label} ${code} fixture stock`).toBeCloseTo(fixture.totalQuantityKg, 6)
            expect(asteroid.remainingQuantityKg, `${label} ${code} fresh belt remainder`).toBeCloseTo(fixture.totalQuantityKg, 6)
            expect(asteroid.status, `${label} ${code} fresh belt status`).toBe('Active')
            expect(Number.isInteger(asteroid.visualVariant), `${label} ${code} visual variant must be an integer`).toBe(true)
        }
        expect(beltState.payload?.constants.miningRadiusMeters, `${label} mining radius constant`).toBe(MINING_RADIUS_METERS)
        expect(beltState.payload?.constants.miningCooldownMs, `${label} cooldown constant`).toBe(MINING_COOLDOWN_MS)
        expect(beltState.payload?.constants.chunkMassMinKg, `${label} chunk mass floor constant`).toBe(CHUNK_MASS_MIN_KG)
        expect(beltState.payload?.constants.chunkMassMaxKg, `${label} chunk mass ceiling constant`).toBe(CHUNK_MASS_MAX_KG)
        expect(beltState.payload?.constants.chunkVisualLifetimeMs, `${label} chunk visual lifetime constant`).toBe(CHUNK_VISUAL_LIFETIME_MS)
        expect(beltState.payload?.constants.statePollMs, `${label} belt poll constant`).toBe(MINING_STATE_POLL_MS)

        // Sell/buy nomenclature codes for the station legs (market sides are
        // fixture-defined: ORE sells, FUEL buys).
        const economyBefore = await fetchEconomySummaryViaApi(api, applicationId)
        expect(economyBefore.status, `${label} economy summary must load`).toBe(200)
        const sellCode = (economyBefore.payload?.market ?? []).find((entry) => entry.side === 'sell')?.nomenclatureCode
        const buyCode = (economyBefore.payload?.market ?? []).find((entry) => entry.side === 'buy')?.nomenclatureCode
        expect(sellCode, `${label} fixture must expose a sell-side nomenclature (ORE)`).toEqual(expect.any(String))
        expect(buyCode, `${label} fixture must expose a buy-side nomenclature (FUEL)`).toEqual(expect.any(String))
        const oreCode = String(sellCode)

        const schemaName = await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) =>
            resolveApplicationSchemaName(dbClient, applicationId)
        )

        // Frees ore capacity through the public sell trade (docked at the
        // station). The E2E DB layer stays read-only — the full-cargo leg and
        // every adaptive capacity retry restore headroom through this flow.
        // A zero-ore hold already has ~15 kg of headroom, so the sell is skipped.
        let expectedWalletBalance = STARTING_BALANCE
        const sellAllOreViaApi = async (legLabel: string): Promise<void> => {
            const summary = await fetchEconomySummaryViaApi(api as LoggedInApiContext, applicationId)
            const oreKg = Math.round(readCargoOreKg(summary.payload, oreCode) * 10) / 10
            if (!(oreKg > 0)) return
            const sell = await tradeViaApi(api as LoggedInApiContext, applicationId, 'sell', {
                nomenclatureCode: oreCode,
                quantity: oreKg
            })
            expect(sell.status, `${legLabel} capacity sell must execute`).toBe(200)
            expectedWalletBalance = readTradeBalance(sell.payload)
        }

        // ── c. Fly to the belt vicinity, click-target AST-01 and fire through the UI ──
        // The belt lives beyond the mining radius from both the spawn and the
        // station (UX round 2026-11-23 — asteroids require a real flight), so
        // the ship flies FIRST: at 390 m the rocks are far too small for the
        // click-targeting sweep, and every fire leg below happens from the
        // belt vicinity point.
        const dockAtStation = async (legLabel: string): Promise<void> => {
            // Clear the intent oracle first: 'move_to_object' persists from the
            // previous dock, so a swallowed click would pass the assertion and
            // then hang the 240 s arrival poll (PR #934 feedback round).
            await canvas.evaluate((element) => {
                delete (element as HTMLCanvasElement).dataset.lastIntentKind
            })
            const processedSeqBefore = Number((await canvas.getAttribute('data-last-processed-input-seq')) ?? 0)
            await page.getByTestId('playcanvas-canvas-widget').getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME }).click()
            await expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_object', { timeout: 15_000 })
            // The room must consume the intent: a stationary processed sequence
            // means the fixed-tick intake dropped it (canControl gate, access
            // validator or the seq window) and the ship will never move.
            await expect
                .poll(async () => Number((await canvas.getAttribute('data-last-processed-input-seq')) ?? 0), {
                    timeout: 20_000,
                    message: `${legLabel} room must process the dock intent`
                })
                .toBeGreaterThan(processedSeqBefore)
            await expectEconomyArrivalViaApi(api, applicationId, { label: `${legLabel} arrival at the station` })
        }
        const flyToBeltVicinity = async (legLabel: string): Promise<void> => {
            await flyMiningShipToPoint(page, BELT_VICINITY_POINT, `${legLabel} fly to the belt vicinity`)
            await waitUntilMiningShipNear(page, BELT_VICINITY_POINT, `${legLabel} belt vicinity arrival`)
        }
        await flyToBeltVicinity(`${label} first approach`)

        await selectAsteroidViaClick(page, 'AST-01', `${label} targeting`)
        const beltTargetOracles = await readMiningTargetOracles(page)
        expect(beltTargetOracles.targetCode, `${label} canvas target oracle`).toBe('AST-01')
        expect(beltTargetOracles.distanceMeters, `${label} belt distance oracle must be live`).not.toBeNull()
        await testInfo.attach('mmoomm-mining-belt-arrival-geometry', {
            body: JSON.stringify({
                beltArrivalTargetDistanceMeters: beltTargetOracles.distanceMeters,
                cargoUsedKgAtArrival: (await readMiningCargoHud(page, `${label} HUD`)).usedKg
            }),
            contentType: 'application/json'
        })

        const hudBeforeFire = await readMiningCargoHud(page, `${label} HUD`)
        expect(hudBeforeFire.usedKg, `${label} HUD cargo before the first fire`).toBeCloseTo(STARTING_ORE_KG, 1)
        expect(hudBeforeFire.capacityKg, `${label} HUD capacity matches the fixture maximum`).toBeCloseTo(MAX_CARGO_MASS_KG, 1)

        const firstFire = await fireViaUi(page, { label })
        expect(firstFire.status, `${label} UI fire must execute`).toBe(200)
        const firstShot = readFirePayload(firstFire.payload)
        const first = readChunkShot(firstShot)
        expect(firstShot.asteroid?.code, `${label} fire response asteroid`).toBe('AST-01')
        const firstRemainder = Number(firstShot.asteroid?.remainingQuantityKg)
        expect(firstRemainder, `${label} fire response remainder is the server-rounded stock delta`).toBeCloseTo(
            BELT_FIXTURE['AST-01'].totalQuantityKg - first.totalKg,
            1
        )
        expect(String(firstShot.asteroid?.status), `${label} AST-01 stays active after the first fire`).toBe('Active')
        expect(Number(firstShot.cargo?.usedKg), `${label} fire response cargo gains the chunk sum`).toBeCloseTo(
            STARTING_ORE_KG + first.totalKg,
            1
        )
        expect(Number(firstShot.wallet?.balance), `${label} Mine must not touch the wallet (TZ FR-012)`).toBeCloseTo(STARTING_BALANCE, 6)
        await expectMiningCargoHud(page, { usedKg: Number(firstShot.cargo?.usedKg) }, `${label} HUD after the first fire`)

        let minedAst01Kg = first.totalKg
        let ast01Remaining = firstRemainder
        let totalMinedKg = first.totalKg

        await withE2eDatabaseClient(async (dbClient: MiningDatabaseClient) =>
            assertMiningDbState(dbClient, {
                schemaName,
                userId: runManifest.testUser.userId,
                expected: {
                    mineOperations: 1,
                    mineQuantitySum: first.totalKg,
                    mineQuantityByAsteroid: { 'AST-01': first.totalKg },
                    inventoryFacts: 2,
                    inventoryQuantityByCode: { [oreCode]: STARTING_ORE_KG + first.totalKg },
                    asteroidRemainingByCode: { 'AST-01': firstRemainder },
                    asteroidStatusByCode: { 'AST-01': 'Active' }
                },
                label: `${label} first UI fire (user A)`
            })
        )
        await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) =>
            assertEconomyDbState(dbClient, {
                schemaName,
                userId: runManifest.testUser.userId,
                expected: {
                    walletRows: 1,
                    // StarterGrant + the Mine row — both post immediately.
                    operations: 2,
                    walletFacts: 1,
                    inventoryFacts: 2,
                    walletFactAmountSum: STARTING_BALANCE,
                    inventoryQuantityByCode: { [oreCode]: STARTING_ORE_KG + first.totalKg }
                },
                label: `${label} wallet untouched by the Mine movement (user A)`
            })
        )

        // ── d. Per-user cooldown: a rapid second shot is rejected, a shot after
        // the cooldown window lands and decrements the remainder ──
        const cooldownProbe = await fireViaApi(api, applicationId, { asteroidCode: 'AST-01' })
        expect([200, 409], `${label} rapid second fire must cool down or land after the window`).toContain(cooldownProbe.status)
        if (cooldownProbe.status === 409) {
            expect(cooldownProbe.payload?.code, `${label} rapid fire error code`).toBe('MINING_COOLDOWN')
        } else {
            const probeShot = readChunkShot(readFirePayload(cooldownProbe.payload))
            minedAst01Kg += probeShot.totalKg
            totalMinedKg += probeShot.totalKg
            ast01Remaining = Number(readFirePayload(cooldownProbe.payload).asteroid?.remainingQuantityKg)
        }
        await testInfo.attach('mmoomm-mining-cooldown-probe', {
            body: JSON.stringify({ status: cooldownProbe.status, code: cooldownProbe.payload?.code ?? null }),
            contentType: 'application/json'
        })

        await delay(MINING_COOLDOWN_MS + 100)
        const spacedFire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-01' })
        expect(spacedFire.status, `${label} fire after the cooldown window must execute`).toBe(200)
        const spacedShot = readFirePayload(spacedFire.payload)
        const spaced = readChunkShot(spacedShot)
        const spacedRemainder = Number(spacedShot.asteroid?.remainingQuantityKg)
        expect(spacedRemainder, `${label} remainder must decrease by the new chunk sum`).toBeCloseTo(ast01Remaining - spaced.totalKg, 1)
        expect(Number(spacedShot.wallet?.balance), `${label} spaced fire wallet echo stays untouched`).toBeCloseTo(expectedWalletBalance, 6)
        minedAst01Kg += spaced.totalKg
        totalMinedKg += spaced.totalKg
        ast01Remaining = spacedRemainder

        // ── j. Negative matrix via direct API (TZ §8.2) + idempotency ──
        // Runs while the ship is parked at the belt right after the first-fire
        // series: the hold still holds the starter stock plus a few chunks, so
        // the keyed success fire can never hit the capacity gate. (A later
        // position raced the fuel fill's residual headroom — CI, PR #934.)
        const mineOperationsBeforeMatrix = await withE2eDatabaseClient(
            async (dbClient: MiningDatabaseClient) =>
                (
                    await readMiningDbState(dbClient, { schemaName, userId: runManifest.testUser.userId })
                ).mineOperations
        )

        const emptyBodyFire = await fireViaApi(api, applicationId, {})
        expect(emptyBodyFire.status, `${label} missing body must fail with 400`).toBe(400)
        expect(emptyBodyFire.payload?.code, `${label} missing body error code`).toBe('MINING_INVALID_TARGET')

        // An OVERLONG target code is an invalid target (TZ §8.2 row 1), not a
        // payload-shape error — it must map to 400, not 422 (CodeRabbit, PR #934).
        const overlongTargetFire = await fireViaApi(api, applicationId, { asteroidCode: 'X'.repeat(65) })
        expect(overlongTargetFire.status, `${label} overlong target code must fail with 400`).toBe(400)
        expect(overlongTargetFire.payload?.code, `${label} overlong target error code`).toBe('MINING_INVALID_TARGET')

        const unknownFieldFire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-01', target: 'e2e-unknown-key' })
        expect(unknownFieldFire.status, `${label} unknown body field must fail with 422`).toBe(422)
        expect(unknownFieldFire.payload?.code, `${label} unknown body field error code`).toBe('MINING_INVALID_PAYLOAD')

        const serverOwnedFire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-01', quantity: 5 })
        expect(serverOwnedFire.status, `${label} server-owned field must fail with 422`).toBe(422)
        expect(serverOwnedFire.payload?.code, `${label} server-owned field error code`).toBe('MINING_INVALID_PAYLOAD')

        const malformedKeyFire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-01' }, 'not-a-uuid-v7')
        expect(malformedKeyFire.status, `${label} malformed Idempotency-Key must fail with 400`).toBe(400)
        expect(malformedKeyFire.payload?.code, `${label} malformed key error code`).toBe('ECONOMY_IDEMPOTENCY_KEY_INVALID')

        const unknownAsteroidFire = await fireViaApi(api, applicationId, { asteroidCode: 'E2E-UNKNOWN-AST' })
        expect(unknownAsteroidFire.status, `${label} unknown asteroid must fail with 404`).toBe(404)
        expect(unknownAsteroidFire.payload?.code, `${label} unknown asteroid error code`).toBe('MINING_TARGET_NOT_FOUND')

        // Idempotency: same key replays the stored response, same key with a
        // different asteroid conflicts. The block sits right after the spaced
        // series (PR #934 relocation), so wait out the shot cooldown first.
        await delay(MINING_COOLDOWN_MS + 100)
        const miningIdempotencyKey = createEconomyIdempotencyKey()
        const firstKeyedFire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-05' }, miningIdempotencyKey)
        expect(firstKeyedFire.status, `${label} keyed fire must execute`).toBe(200)
        const keyedShot = readChunkShot(readFirePayload(firstKeyedFire.payload))
        // The relocated block runs before the cargo accounting legs — the keyed
        // chunks must join the mined total (PR #934).
        totalMinedKg += keyedShot.totalKg
        expect(readFirePayload(firstKeyedFire.payload).asteroid?.code, `${label} keyed fire asteroid`).toBe('AST-05')
        const replayedFire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-05' }, miningIdempotencyKey)
        expect(replayedFire.status, `${label} idempotent replay must return the stored status`).toBe(firstKeyedFire.status)
        expect(replayedFire.payload, `${label} idempotent replay must return the stored response body`).toEqual(firstKeyedFire.payload)
        const conflictingFire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-04' }, miningIdempotencyKey)
        expect(conflictingFire.status, `${label} same key with a different asteroid must conflict`).toBe(409)
        expect(conflictingFire.payload?.code, `${label} idempotency conflict error code`).toBe('ECONOMY_IDEMPOTENCY_CONFLICT')

        await withE2eDatabaseClient(async (dbClient: MiningDatabaseClient) =>
            assertMiningDbState(dbClient, {
                schemaName,
                userId: runManifest.testUser.userId,
                expected: {
                    // Exactly one new Mine row: the keyed fire. Replays, conflicts
                    // and the negative matrix must not touch the store.
                    mineOperations: mineOperationsBeforeMatrix + 1,
                    mineQuantityByAsteroid: { 'AST-05': keyedShot.totalKg }
                },
                label: `${label} negative matrix must not change the store (user A)`
            })
        )

        // ── e. Out of range: fly far from the belt through a move_to_point
        // intent, then fire ── the ship is parked at the belt vicinity (inside
        // the mining range by construction), so the guaranteed out-of-range
        // coverage always flies it ~200 m back toward the station (still clear
        // of every rock).
        await flyMiningShipToPoint(page, { x: -100, y: 3, z: 100 }, `${label} fly away from the belt`)
        await expectMiningTargetOutOfRange(page, `${label} range oracle`, MINING_OUT_OF_RANGE_DISTANCE_METERS + 5)
        const outOfRangeFire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-01' })
        expect(outOfRangeFire.status, `${label} out-of-range fire must be rejected with 409`).toBe(409)
        expect(outOfRangeFire.payload?.code, `${label} out-of-range error code`).toBe('MINING_OUT_OF_RANGE')

        // Return to the station for the station-gated legs (fill/sell trades).
        await page.getByTestId('playcanvas-canvas-widget').getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME }).click()
        await expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_object', { timeout: 15_000 })
        await expectEconomyArrivalViaApi(api, applicationId, { label: `${label} return flight to the station` })

        // ── f. Full cargo: exact capacity fill through the FUEL buy trade →
        // mining rejected with the capacity hint → sell via the economy dialog
        // → mining resumes ──
        const summaryBeforeFill = await fetchEconomySummaryViaApi(api, applicationId)
        const usedBeforeFill = Number(summaryBeforeFill.payload?.capacity.usedKg)
        const fillQuantity = (MAX_CARGO_MASS_KG - usedBeforeFill) / FUEL_MASS_PER_LITER
        expect(fillQuantity, `${label} capacity headroom before the fill`).toBeGreaterThan(0)
        const fillTrade = await tradeViaApi(api, applicationId, 'buy', { nomenclatureCode: buyCode, quantity: fillQuantity })
        expect(fillTrade.status, `${label} exact capacity fill must execute`).toBe(200)
        expectedWalletBalance = readTradeBalance(fillTrade.payload)
        const filledSummary = await fetchEconomySummaryViaApi(api, applicationId)
        expect(Number(filledSummary.payload?.capacity.usedKg), `${label} hold filled to capacity`).toBeCloseTo(MAX_CARGO_MASS_KG, 1)

        // Fly from the station back to the belt vicinity: the belt sits beyond
        // the mining radius from the station (UX round 2026-11-23 — firing now
        // requires a real flight), so the full-hold fire and the resumed series
        // below all happen from this point.
        await flyToBeltVicinity(`${label} return to the belt`)

        await fireViaUi(page, { expectedStatus: 409, label: `${label} fire with a full hold` })
        await expectMiningCapacityHint(page, `${label} capacity hint`)
        // The sell trade is station-gated (market radius): dock first, then the
        // hint action opens the canonical economy dialog for the sell loop.
        await dockAtStation(`${label} dock for the capacity sell`)
        await page
            .getByTestId('mining-error')
            .getByRole('button', { name: /^(Sell ore|Продать руду)$/i })
            .click()
        await expectEconomyPanelVisible(page, `${label} economy dialog from the capacity hint`)
        const oreBeforeSell = readCargoOreKg(filledSummary.payload, oreCode)
        expect(oreBeforeSell, `${label} ore in the hold before the sell`).toBeCloseTo(STARTING_ORE_KG + totalMinedKg, 1)
        const sellAll = await tradeViaUi(page, 'sell', Math.round(oreBeforeSell * 10) / 10, { label })
        expect(sellAll.status, `${label} sell-all-ore must execute`).toBe(200)
        expectedWalletBalance = readTradeBalance(sellAll.payload)
        await closeEconomyDialog(page, `${label} economy dialog after the sell`)

        await flyToBeltVicinity(`${label} return for the resumed mining`)
        await delay(MINING_COOLDOWN_MS + 100)
        const resumeFire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-01' })
        expect(resumeFire.status, `${label} mining must resume after freeing the hold`).toBe(200)
        const resumeShot = readFirePayload(resumeFire.payload)
        const resume = readChunkShot(resumeShot)
        minedAst01Kg += resume.totalKg
        totalMinedKg += resume.totalKg
        ast01Remaining = Number(resumeShot.asteroid?.remainingQuantityKg)
        expect(Number(resumeShot.wallet?.balance), `${label} resumed fire wallet echo`).toBeCloseTo(expectedWalletBalance, 6)

        // ── g. Shot series on AST-02: monotonic remainder, uneven chunk masses,
        // adaptive capacity sells keep the series going ──
        await selectAsteroidViaClick(page, 'AST-02', `${label} targeting AST-02`)
        const ast02Stock = BELT_FIXTURE['AST-02'].totalQuantityKg
        const ast02ShotMasses: number[] = []
        let ast02MinedKg = 0
        let ast02Remaining = ast02Stock
        let cooldownRetries = 0
        const AST02_TARGET_SHOTS = 6
        for (let landed = 0; landed < AST02_TARGET_SHOTS; ) {
            const fire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-02' })
            if (fire.status === 409 && fire.payload?.code === 'MINING_COOLDOWN') {
                // The resume fire set the per-user cooldown moments ago: wait
                // out the window and retry the same shot (bounded — a hot
                // cooldown loop means a product defect, not test flake).
                cooldownRetries += 1
                if (cooldownRetries > 3) {
                    expect(fire.status, `${label} AST-02 cooldown must clear after retries`).toBe(200)
                }
                await delay(MINING_COOLDOWN_MS + 100)
                continue
            }
            if (fire.status === 409 && fire.payload?.code === 'ECONOMY_CAPACITY_EXCEEDED') {
                // The hold filled up mid-series: the sell trade is station-gated
                // — dock, sell the freshly mined ore, and fly back to the belt.
                await dockAtStation(`${label} AST-02 series capacity dock`)
                await sellAllOreViaApi(`${label} AST-02 series capacity sell`)
                await flyToBeltVicinity(`${label} AST-02 series return`)
                continue
            }
            expect(fire.status, `${label} AST-02 fire #${landed + 1} must execute: ${JSON.stringify(fire.payload)}`).toBe(200)
            const shot = readFirePayload(fire.payload)
            const chunkShot = readChunkShot(shot)
            const shotRemainder = Number(shot.asteroid?.remainingQuantityKg)
            expect(shotRemainder, `${label} AST-02 remainder must decrease monotonically`).toBeCloseTo(
                ast02Remaining - chunkShot.totalKg,
                1
            )
            expect(chunkShot.totalKg, `${label} AST-02 series must never exceed the stock`).toBeLessThanOrEqual(ast02Remaining)
            expect(Number(shot.wallet?.balance), `${label} AST-02 fire wallet echo stays untouched`).toBeCloseTo(expectedWalletBalance, 6)
            ast02ShotMasses.push(...chunkShot.masses)
            ast02MinedKg += chunkShot.totalKg
            totalMinedKg += chunkShot.totalKg
            ast02Remaining = shotRemainder
            landed += 1
            await delay(MINING_COOLDOWN_MS + 100)
        }
        expect(
            new Set(ast02ShotMasses).size,
            `${label} AST-02 series must observe at least 2 distinct chunk masses`
        ).toBeGreaterThanOrEqual(2)
        expect(ast02MinedKg, `${label} AST-02 mined sum must not exceed the stock`).toBeLessThanOrEqual(ast02Stock)

        await withE2eDatabaseClient(async (dbClient: MiningDatabaseClient) =>
            assertMiningDbState(dbClient, {
                schemaName,
                userId: runManifest.testUser.userId,
                expected: {
                    mineQuantityByAsteroid: { 'AST-01': minedAst01Kg, 'AST-02': ast02MinedKg },
                    asteroidRemainingByCode: {
                        'AST-01': BELT_FIXTURE['AST-01'].totalQuantityKg - minedAst01Kg,
                        'AST-02': ast02Stock - ast02MinedKg
                    },
                    asteroidStatusByCode: { 'AST-01': 'Active', 'AST-02': 'Active' }
                },
                label: `${label} after the AST-02 series (user A)`
            })
        )

        // ── h. Depletion: fire AST-03 until MINING_DEPLETED, the status flips
        // and persists; capacity sells keep the grind going ──
        await selectAsteroidViaClick(page, 'AST-03', `${label} targeting AST-03`)
        const ast03Stock = BELT_FIXTURE['AST-03'].totalQuantityKg
        let ast03MinedKg = 0
        let ast03Remaining = ast03Stock
        let depleted = false
        for (let guard = 0; guard < 160 && !depleted; guard += 1) {
            const fire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-03' })
            if (fire.status === 409 && fire.payload?.code === 'MINING_DEPLETED') {
                depleted = true
                break
            }
            if (fire.status === 409 && fire.payload?.code === 'ECONOMY_CAPACITY_EXCEEDED') {
                await dockAtStation(`${label} depletion capacity dock`)
                await sellAllOreViaApi(`${label} depletion capacity sell`)
                await flyToBeltVicinity(`${label} depletion return`)
                continue
            }
            expect(fire.status, `${label} AST-03 depletion fire must execute`).toBe(200)
            const shot = readFirePayload(fire.payload)
            // Depletion-grind shots scale down to the tiny remainder — skip the
            // min-mass bound (positivity still enforced).
            const chunkShot = readChunkShot(shot, { enforceMin: false })
            const shotRemainder = Number(shot.asteroid?.remainingQuantityKg)
            expect(shotRemainder, `${label} AST-03 remainder must decrease monotonically`).toBeCloseTo(
                ast03Remaining - chunkShot.totalKg,
                1
            )
            ast03MinedKg += chunkShot.totalKg
            totalMinedKg += chunkShot.totalKg
            ast03Remaining = shotRemainder
            await delay(MINING_COOLDOWN_MS + 100)
        }
        expect(depleted, `${label} AST-03 must deplete within the guard budget`).toBe(true)
        expect(Math.round(ast03Remaining * 10) / 10, `${label} depleted asteroid remainder must reach zero`).toBe(0)
        // TZ §9.3 invariant: the clamped chunk sums equal the stock exactly.
        expect(Math.round(ast03MinedKg * 10) / 10, `${label} AST-03 mined sum equals the stock`).toBeCloseTo(ast03Stock, 1)

        const depletedState = await fetchMiningStateViaApi(api, applicationId)
        const depletedAsteroid = readBeltAsteroid(depletedState.payload, 'AST-03')
        expect(depletedAsteroid.status, `${label} belt state must flip AST-03 to Depleted`).toBe('Depleted')
        expect(depletedAsteroid.remainingQuantityKg, `${label} belt state remainder must be zero`).toBe(0)

        await withE2eDatabaseClient(async (dbClient: MiningDatabaseClient) =>
            assertMiningDbState(dbClient, {
                schemaName,
                userId: runManifest.testUser.userId,
                expected: {
                    mineQuantityByAsteroid: { 'AST-01': minedAst01Kg, 'AST-02': ast02MinedKg, 'AST-03': ast03Stock },
                    asteroidRemainingByCode: {
                        'AST-01': BELT_FIXTURE['AST-01'].totalQuantityKg - minedAst01Kg,
                        'AST-02': ast02Stock - ast02MinedKg,
                        'AST-03': 0
                    },
                    asteroidStatusByCode: { 'AST-03': 'Depleted' }
                },
                label: `${label} after depletion (user A)`
            })
        )

        // A rejected fire on the depleted target must not resurrect the belt.
        const depletedFire = await fireViaApi(api, applicationId, { asteroidCode: 'AST-03' })
        expect(depletedFire.status, `${label} fire on a depleted asteroid must be rejected with 409`).toBe(409)
        expect(depletedFire.payload?.code, `${label} depleted error code`).toBe('MINING_DEPLETED')

        // ── i. User B: shared belt remainder, independent cargo/wallet ──
        const bootstrapApi = await createBootstrapApiContext()
        let userBCredentials: { email: string; password: string } | null = null
        let userBId: string | null = null
        try {
            const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
            // The attempt suffix keeps retries collision-proof: a Playwright retry
            // reuses the runId and would otherwise hit "already registered"
            // (CI, PR #934).
            const memberEmail = `e2e+${runManifest.runId}.${Date.now()}.mmoomm-mining-user-b@${
                process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'
            }`
            const defaultRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
            const assignableRoles = await getAssignableRoles(bootstrapApi)
            const roleIds = resolveGlobalRoleIds(assignableRoles, defaultRoleCodenames)
            const createdUser = await createAdminUser(bootstrapApi, {
                email: memberEmail,
                password: memberPassword,
                roleIds,
                comment: `Created for MMOOMM mining user B coverage ${runManifest.runId}`
            })
            await recordCreatedGlobalUser({ userId: createdUser.userId, email: createdUser.email ?? memberEmail })
            userBCredentials = { email: createdUser.email ?? memberEmail, password: memberPassword }
            userBId = String(createdUser.userId)
            await addApplicationMember(api, applicationId, {
                email: userBCredentials.email,
                role: 'admin'
            })
        } finally {
            await disposeBootstrapApiContext(bootstrapApi)
        }
        if (!userBCredentials || !userBId) {
            throw new Error('MMOOMM mining user B credentials were not created')
        }

        const userBLabel = `${label} user B`
        const apiB = await createLoggedInApiContext(userBCredentials)
        try {
            // B has not opened the app yet: no flight session exists for B, so
            // the mining gate must reject the fire outright (TZ §9.1 ③).
            const preCanvasFire = await fireViaApi(apiB, applicationId, { asteroidCode: 'AST-01' })
            expect(preCanvasFire.status, `${userBLabel} pre-canvas fire must be rejected with 409`).toBe(409)
            expect(preCanvasFire.payload?.code, `${userBLabel} pre-canvas fire error code`).toBe('MINING_NO_FLIGHT_SESSION')

            const sessionB = await createLoggedInBrowserContext(browser, userBCredentials)
            try {
                await sessionB.page.goto(`/a/${applicationId}`)
                await openMmoommSpaceSection(sessionB.page)
                await expectMiningBeltVisible(sessionB.page, `${userBLabel} belt`)

                // B observes the SAME belt store of record: A's depletion and
                // series shots are visible in B's snapshot.
                const beltStateB = await fetchMiningStateViaApi(apiB, applicationId)
                expect(beltStateB.status, `${userBLabel} belt state must load`).toBe(200)
                expect(readBeltAsteroid(beltStateB.payload, 'AST-03').status, `${userBLabel} sees the depleted AST-03`).toBe('Depleted')
                expect(
                    readBeltAsteroid(beltStateB.payload, 'AST-02').remainingQuantityKg,
                    `${userBLabel} sees the shared AST-02 remainder`
                ).toBeCloseTo(ast02Remaining, 1)

                // B's ship spawns on the ring around the fixture spawn point —
                // 385-398 m from the belt (UX round 2026-11-23), so B flies to
                // the belt vicinity before firing against the shared store.
                await flyMiningShipToPoint(sessionB.page, BELT_VICINITY_POINT, `${userBLabel} fly to the belt vicinity`)
                await waitUntilMiningShipNear(sessionB.page, BELT_VICINITY_POINT, `${userBLabel} belt vicinity arrival`)
                const fireB = await fireViaApi(apiB, applicationId, { asteroidCode: 'AST-01' })
                expect(fireB.status, `${userBLabel} fire must execute against the shared belt`).toBe(200)
                const shotB = readFirePayload(fireB.payload)
                const chunkShotB = readChunkShot(shotB)
                expect(Number(shotB.wallet?.balance), `${userBLabel} wallet must stay the own granted one`).toBeCloseTo(STARTING_BALANCE, 6)
                expect(Number(shotB.cargo?.usedKg), `${userBLabel} cargo must only carry the own grant + own chunks`).toBeCloseTo(
                    STARTING_ORE_KG + chunkShotB.totalKg,
                    1
                )
                const remainderB = Number(shotB.asteroid?.remainingQuantityKg)

                // Shared belt: user A's snapshot shows B's decrement.
                const beltStateAFresh = await fetchMiningStateViaApi(api, applicationId)
                expect(
                    readBeltAsteroid(beltStateAFresh.payload, 'AST-01').remainingQuantityKg,
                    `${label} user A's belt must reflect user B's fire`
                ).toBeCloseTo(remainderB, 1)

                await withE2eDatabaseClient(async (dbClient: MiningDatabaseClient) =>
                    assertMiningDbState(dbClient, {
                        schemaName,
                        userId: userBId,
                        expected: {
                            mineOperations: 1,
                            mineQuantitySum: chunkShotB.totalKg,
                            mineQuantityByAsteroid: { 'AST-01': chunkShotB.totalKg },
                            inventoryFacts: 2,
                            inventoryQuantityByCode: { [oreCode]: STARTING_ORE_KG + chunkShotB.totalKg },
                            asteroidRemainingByCode: { 'AST-01': remainderB }
                        },
                        label: `${userBLabel} own Mine rows only`
                    })
                )
                await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) =>
                    assertEconomyDbState(dbClient, {
                        schemaName,
                        userId: userBId,
                        expected: {
                            walletRows: 1,
                            operations: 2,
                            walletFacts: 1,
                            inventoryFacts: 2,
                            walletFactAmountSum: STARTING_BALANCE,
                            inventoryQuantityByCode: { [oreCode]: STARTING_ORE_KG + chunkShotB.totalKg }
                        },
                        label: `${userBLabel} isolated wallet/cargo store`
                    })
                )
            } finally {
                await sessionB.context.close()
            }
        } finally {
            await disposeApiContext(apiB)
        }

        // ── k. G3 screenshots: viewport matrix x EN/RU behind MMOOMM_MINING_DOCS_SCREENSHOTS ──
        const captureMiningDocsStage = async (stage: 'belt' | 'fire' | 'hud' | 'depleted', locale: 'en' | 'ru') => {
            const { pagePath } = await collectMiningScreenshots(page, testInfo, {
                stage,
                viewportName: MINING_DOCS_VIEWPORT_NAME,
                locale
            })
            return { stage, pagePath }
        }

        for (const locale of ['en', 'ru'] as const) {
            await switchRuntimeLocale(page, locale)
            // The locale switch is a full page navigation — the runtime lands on
            // the default Welcome section; re-open Space so the canvas remounts
            // with a clean target/error state.
            await openMmoommSpaceSection(page)
            await expectMiningBeltVisible(page, `${label} ${locale} belt`)

            const docsShots: Array<{ stage: string; pagePath: string }> = []
            await expectRuntimeUxViewportMatrix(page, `${label} ${locale} mining runtime`, {
                viewports: MINING_SCREENSHOT_VIEWPORTS,
                beforeEachViewport: async (viewport) => {
                    if (viewport.name !== MINING_DOCS_VIEWPORT_NAME) return
                    // The fresh reload respawns the ship at the spawn, 390 m
                    // from the belt (UX round 2026-11-23): dock at the station
                    // for the station-gated capacity sell, then fly to the belt
                    // vicinity for the targeting and fire captures.
                    await dockAtStation(`${label} ${locale} docs capacity dock`)
                    await sellAllOreViaApi(`${label} ${locale} docs capacity sell`)
                    await flyToBeltVicinity(`${label} ${locale} docs approach`)
                    // belt: clean runtime, no target selected (fresh reload).
                    docsShots.push(await captureMiningDocsStage('belt', locale))
                    // fire: capture within the chunk visual lifetime.
                    await selectAsteroidViaClick(page, 'AST-04', `${label} ${locale} docs targeting`)
                    const docsFire = await fireViaUi(page, { label: `${label} ${locale} docs fire` })
                    expect(docsFire.status, `${label} ${locale} docs fire must execute`).toBe(200)
                    docsShots.push(await captureMiningDocsStage('fire', locale))
                    // hud: the HUD carries the live target info at this point.
                    docsShots.push(await captureMiningDocsStage('hud', locale))
                    // depleted: the belt still renders the exhausted asteroid.
                    await selectAsteroidViaClick(page, 'AST-03', `${label} ${locale} depleted targeting`)
                    docsShots.push(await captureMiningDocsStage('depleted', locale))
                    // The localized rejection surfaces through the widget for
                    // every docs locale (EN: "depleted", RU: "выработан").
                    await fireViaUi(page, { expectedStatus: 409, label: `${label} ${locale} depleted fire` })
                    await expectMiningError(page, locale === 'ru' ? 'выработан' : 'depleted', `${label} ${locale} depleted error`)
                }
            })

            if (process.env.MMOOMM_MINING_DOCS_SCREENSHOTS === '1') {
                for (const shot of docsShots) {
                    const docsAssetsDir = path.resolve('docs', locale, '.gitbook', 'assets', 'mmoomm-mining')
                    await mkdir(docsAssetsDir, { recursive: true })
                    await copyFile(shot.pagePath, path.join(docsAssetsDir, `mmoomm-mining-${shot.stage}-${locale}.png`))
                }
            }
        }

        // ── l. G5 manual-acceptance evidence ──
        const manualAcceptance = {
            flightRegression:
                'Covered by the existing snapshot-import-mmoomm-app-runtime.spec.ts flight/multi-ship matrix — intentionally not duplicated here.',
            miningBeltPlacement: MINING_SCREENSHOT_VIEWPORTS.map(
                (viewport) =>
                    `${viewport.width}x${viewport.height}: belt canvas + mining HUD + fire toolbar screenshots attached (EN and RU), no page-level horizontal overflow`
            ),
            localesSpotCheck: ['en', 'ru'],
            exercisedErrorCodes: [
                'MINING_INVALID_TARGET',
                'MINING_INVALID_PAYLOAD',
                'MINING_TARGET_NOT_FOUND',
                'MINING_NO_FLIGHT_SESSION',
                'MINING_OUT_OF_RANGE',
                'MINING_DEPLETED',
                'MINING_COOLDOWN',
                'ECONOMY_CAPACITY_EXCEEDED',
                'ECONOMY_IDEMPOTENCY_KEY_INVALID',
                'ECONOMY_IDEMPOTENCY_CONFLICT'
            ],
            remainingCoverage: {
                MINING_POSTING_FAILED:
                    'Backend Jest suites (runtimeEconomyService/miningChunks) cover the 500 mapping — not forceable from a healthy E2E fixture.'
            },
            capacitySeedAdaptation:
                'The full-cargo leg fills the hold through the public FUEL buy trade (exact capacity fill) instead of SQL writes — the E2E DB layer stays read-only like the economy proof; the sell-resume loop then restores capacity through the economy dialog.'
        }
        testInfo.annotations.push({
            type: 'manual-acceptance',
            description: 'MMOOMM mining Phase E checklist attached as mmoomm-mining-manual-acceptance.json'
        })
        await testInfo.attach('mmoomm-mining-manual-acceptance.json', {
            body: Buffer.from(JSON.stringify(manualAcceptance, null, 2)),
            contentType: 'application/json'
        })

        // Console hygiene across the whole journey (runtime-spec ignore list).
        expect(issues, `${label} browser regression issues: ${JSON.stringify(issues.slice(0, 8))}`).toEqual([])
    })
})
