import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
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
import { expectNoVerticalPageOverflow, expectRuntimeUxViewportMatrix } from '../../support/browser/runtimeUx'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication
} from '../../support/backend/run-manifest.mjs'
import { importMmoommAppSnapshotThroughUi } from '../../support/mmoommAppSnapshotImport'
import {
    FUEL_PRICE_PER_LITER,
    MAX_CARGO_MASS_KG,
    ORE_PRICE_PER_KG,
    STARTING_BALANCE,
    STARTING_ORE_KG
} from '../../support/mmoommAppGeneratorData'
import { MMOOMM_MOVE_TO_TARGET_BUTTON_NAME } from '../../support/mmoommRuntimeProof.navigation'
import { MMOOMM_RUNTIME_EXPECT_TIMEOUT, openMmoommSpaceSection } from '../../support/mmoommRuntimeProof'
import {
    appendLedgerFactViaApi,
    assertEconomyDbState,
    closeEconomyDialog,
    collectEconomyScreenshots,
    createEconomyIdempotencyKey,
    expectEconomyArrivalViaApi,
    expectEconomyError,
    expectEconomyPanelVisible,
    expectEconomySummary,
    expectEconomyTradeButtonsDisabled,
    fetchEconomySummaryViaApi,
    listRuntimeLedgersViaApi,
    openEconomyDialog,
    readEconomyDbState,
    resolveApplicationSchemaName,
    setStationMarketEnabledViaDb,
    tradeViaApi,
    tradeViaUi,
    tradeViaUiKeyboard,
    type EconomyDatabaseClient,
    type EconomyTradeKind
} from '../../support/mmoommEconomyProof'

type LoggedInApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const APP_RUNTIME_TIMEOUT = 180_000

// Fixture economy constants (tools/testing/e2e/support/mmoommAppGeneratorData.ts):
// StarterGrant 1000 CR + 10 kg ORE, ore sells at 10 CR/kg, fuel buys at 5 CR/L.
const SELL_QUANTITY = 5
const BUY_QUANTITY = 2
/** Viewport whose captures are committed into docs/.gitbook assets (M2). */
const ECONOMY_DOCS_VIEWPORT_NAME = 'desktop-1920'
const IDEMPOTENT_SELL_QUANTITY = 1
// Nomenclature/FUEL MassPerUnit authored by the generator (0.8 kg per liter).
const FUEL_MASS_PER_LITER = 0.8
const BALANCE_AFTER_UI_TRADES = STARTING_BALANCE + SELL_QUANTITY * ORE_PRICE_PER_KG - BUY_QUANTITY * FUEL_PRICE_PER_LITER
const BALANCE_AFTER_ALL_TRADES = BALANCE_AFTER_UI_TRADES + IDEMPOTENT_SELL_QUANTITY * ORE_PRICE_PER_KG
const ORE_AFTER_ALL_TRADES = STARTING_ORE_KG - SELL_QUANTITY - IDEMPOTENT_SELL_QUANTITY
const FUEL_AFTER_ALL_TRADES = BUY_QUANTITY

// G3 matrix: the standard 1920x1080 desktop plus the two responsive risk
// viewports from the plan's UI Contract (1280x800 laptop, 390x844 mobile).
const ECONOMY_SCREENSHOT_VIEWPORTS = [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'laptop-1280', width: 1280, height: 800 },
    { name: 'mobile-390', width: 390, height: 844 }
]

const resolveGlobalRoleIds = (roles: Array<{ id?: string; codename?: string }>, roleCodenames: string[]) => {
    const roleMap = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    const roleIds = roleCodenames.map((codename) => roleMap.get(codename.toLowerCase())).filter(Boolean)
    if (roleIds.length !== roleCodenames.length) {
        const missing = roleCodenames.filter((codename) => !roleMap.has(codename.toLowerCase()))
        throw new Error(`Assignable global role(s) not found: ${missing.join(', ')}`)
    }
    return roleIds
}

test.describe('MMOOMM PlayCanvas Editor snapshot import economy', () => {
    let api: LoggedInApiContext | null = null

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
            api = null
        }
    })

    test('@flow @slow imported MMOOMM app snapshot economy journey grants, trades and isolates wallets', async ({
        browser,
        page,
        runManifest
    }, testInfo) => {
        // Broad product proof on the canonical fixture: snapshot import,
        // publication/schema sync, first-entry StarterGrant, out-of-station
        // gating, the flight-to-station loop, UI trades, idempotency, the
        // negative matrix, per-user isolation and the G3 screenshot matrix.
        test.setTimeout(900_000)
        const label = 'MMOOMM app economy'

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

        const applicationName = `MMOOMM App Economy ${runManifest.runId}`
        const linked = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })
        const applicationId = linked?.application?.id ?? linked?.id
        if (typeof applicationId !== 'string') {
            throw new Error('MMOOMM economy linked application did not return an application id')
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

        // ── b. Open the published application as member user A and open the economy dialog ──
        await page.goto(`/a/${applicationId}`)
        await openMmoommSpaceSection(page)
        const canvas = page.getByTestId('playcanvas-canvas')
        await expect(canvas, `${label} realtime canvas must connect`).toHaveAttribute('data-realtime-status', /^(connected|restored)$/, {
            timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
        })
        // QA 2026-11-17: the flight runtime is a fixed-viewport page — the
        // measured canvas must fill it exactly (no junk document scrollbar).
        await expectNoVerticalPageOverflow(page, `${label} fixed-viewport runtime`)
        await expectEconomyPanelVisible(page, label)
        // The dashboard-level "Create" host action has no meaning in this
        // product: the scoped layout behavior disables it (interpretation
        // network precedent).
        await expect(
            page.getByTestId('application-runtime-create-row'),
            `${label} runtime must not render the junk Create button`
        ).toHaveCount(0)

        // ── c. First-entry grant (D11): 1000 CR / 10 kg ORE on UI and in the app schema ──
        const summaryA = await fetchEconomySummaryViaApi(api, applicationId)
        expect(summaryA.status, `${label} summary must load for user A`).toBe(200)
        expect(summaryA.payload, `${label} summary payload must parse`).not.toBeNull()
        // Spawn geometry is fixture-defined: the canonical MMOOMM scene spawns the
        // ship docked at the station, so atStation may legitimately be true at first
        // entry. Record it and adapt the negative coverage — the guaranteed
        // out-of-station case is a member with NO flight session (user B's
        // pre-canvas trade below exercises the FR-019 409 path).
        const atStationAtSpawn = summaryA.payload?.atStation === true
        await testInfo.attach('mmoomm-economy-spawn-geometry', {
            body: JSON.stringify({ atStationAtSpawn }),
            contentType: 'application/json'
        })
        const marketEntries = summaryA.payload?.market ?? []
        const sellCode = marketEntries.find((entry) => entry.side === 'sell')?.nomenclatureCode
        const buyCode = marketEntries.find((entry) => entry.side === 'buy')?.nomenclatureCode
        expect(sellCode, `${label} fixture must expose a sell-side nomenclature (ORE)`).toEqual(expect.any(String))
        expect(buyCode, `${label} fixture must expose a buy-side nomenclature (FUEL)`).toEqual(expect.any(String))

        await expectEconomySummary(page, { balance: STARTING_BALANCE, oreKg: STARTING_ORE_KG }, label)
        await expect(page.getByTestId('economy-operations-list'), `${label} operations feed must render`).toBeVisible()

        const schemaName = await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) =>
            resolveApplicationSchemaName(dbClient, applicationId)
        )
        await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) =>
            assertEconomyDbState(dbClient, {
                schemaName,
                userId: runManifest.testUser.userId,
                expected: {
                    walletRows: 1,
                    operations: 1,
                    walletFacts: 1,
                    inventoryFacts: 1,
                    walletFactAmountSum: STARTING_BALANCE,
                    inventoryQuantityByCode: { [sellCode]: STARTING_ORE_KG }
                },
                label: `${label} first-entry grant (user A)`
            })
        )

        // ── d/e. Out-of-station negative (when the spawn is outside the radius) and
        // flight to the station (when it is not) — both depend on fixture geometry. ──
        if (!atStationAtSpawn) {
            // Out of station the quantity inputs are disabled too — the disabled
            // buttons plus the API-reported atStation=false prove the FR-019 gate.
            await expectEconomyTradeButtonsDisabled(page, { disabled: true, label })
            const blockedSell = await tradeViaApi(api, applicationId, 'sell', { nomenclatureCode: sellCode, quantity: 1 })
            expect(blockedSell.status, `${label} out-of-station sell must be rejected with 409`).toBe(409)
            expect(blockedSell.payload?.code, `${label} out-of-station sell error code`).toBe('ECONOMY_NOT_AT_STATION')
            // The canvas is behind the strict-modal dialog — close it so the
            // flight control buttons are clickable again.
            await closeEconomyDialog(page, label)
            const canvasWidget = page.getByTestId('playcanvas-canvas-widget')
            await canvasWidget.getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME }).click()
            await expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_object', { timeout: 15_000 })
            await expectEconomyArrivalViaApi(api, applicationId, { label: `${label} flight to station` })
        } else {
            // Docked at spawn: fill the quantities first — the widget also gates the
            // trade buttons on `quantity > 0`, so the enabled assertion is meaningful
            // only with a non-empty quantity.
            await openEconomyDialog(page, label)
            await page.getByTestId('economy-sell-quantity').fill(String(SELL_QUANTITY))
            await page.getByTestId('economy-buy-quantity').fill(String(BUY_QUANTITY))
            await expectEconomyTradeButtonsDisabled(page, { disabled: false, label })
        }

        // ── f. Sell 5 ORE and buy 2 FUEL through the UI, then reload ──
        const sellResult = await tradeViaUi(page, 'sell', SELL_QUANTITY, { label })
        const sellPayload = sellResult.payload as { walletBalance?: unknown; operationId?: unknown } | null
        expect(Number(sellPayload?.walletBalance), `${label} sell response wallet balance`).toBeCloseTo(
            STARTING_BALANCE + SELL_QUANTITY * ORE_PRICE_PER_KG,
            6
        )
        expect(sellPayload?.operationId, `${label} sell response operation id`).toEqual(expect.any(String))
        await expectEconomySummary(
            page,
            { balance: STARTING_BALANCE + SELL_QUANTITY * ORE_PRICE_PER_KG, oreKg: STARTING_ORE_KG - SELL_QUANTITY },
            label
        )

        // The buy leg runs through the KEYBOARD path (QA M8 oracle): typed
        // quantity + Enter on the focused control — no mouse click coordinates.
        const buyResult = await tradeViaUiKeyboard(page, 'buy', BUY_QUANTITY, { label })
        const buyPayload = buyResult.payload as { walletBalance?: unknown } | null
        expect(Number(buyPayload?.walletBalance), `${label} buy response wallet balance`).toBeCloseTo(BALANCE_AFTER_UI_TRADES, 6)
        await expectEconomySummary(
            page,
            { balance: BALANCE_AFTER_UI_TRADES, oreKg: STARTING_ORE_KG - SELL_QUANTITY, fuelL: BUY_QUANTITY },
            label
        )

        const afterTrades = await fetchEconomySummaryViaApi(api, applicationId)
        expect(afterTrades.status, `${label} summary after trades must load`).toBe(200)
        expect(Number(afterTrades.payload?.capacity.usedKg), `${label} capacity used after trades`).toBeCloseTo(
            STARTING_ORE_KG - SELL_QUANTITY + BUY_QUANTITY * FUEL_MASS_PER_LITER,
            6
        )
        expect(Number(afterTrades.payload?.capacity.maxKg), `${label} max cargo mass constant`).toBeCloseTo(MAX_CARGO_MASS_KG, 6)

        await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) =>
            assertEconomyDbState(dbClient, {
                schemaName,
                userId: runManifest.testUser.userId,
                expected: {
                    walletRows: 1,
                    operations: 3,
                    walletFacts: 3,
                    inventoryFacts: 3,
                    walletFactAmountSum: BALANCE_AFTER_UI_TRADES,
                    inventoryQuantityByCode: { [sellCode]: STARTING_ORE_KG - SELL_QUANTITY, [buyCode]: BUY_QUANTITY }
                },
                label: `${label} after UI trades (user A)`
            })
        )

        await page.reload({ waitUntil: 'domcontentloaded' })
        await openMmoommSpaceSection(page)
        await expectEconomyPanelVisible(page, label)
        await expectEconomySummary(
            page,
            { balance: BALANCE_AFTER_UI_TRADES, oreKg: STARTING_ORE_KG - SELL_QUANTITY, fuelL: BUY_QUANTITY },
            label
        )

        // The page reload can replace the flight room; re-dock before the
        // station-gated API scenarios so they reach their intended error codes.
        const precheckAfterReload = await fetchEconomySummaryViaApi(api, applicationId)
        if (precheckAfterReload.payload?.atStation !== true) {
            const reloadedCanvas = page.getByTestId('playcanvas-canvas')
            await page.getByTestId('playcanvas-canvas-widget').getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME }).click()
            await expect(reloadedCanvas).toHaveAttribute('data-last-intent-kind', 'move_to_object', { timeout: 15_000 })
            await expectEconomyArrivalViaApi(api, applicationId, { label: `${label} re-dock after reload` })
        }

        // ── g. Idempotency: same key replays, same key + different body conflicts ──
        const stateBeforeIdempotency = await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) =>
            readEconomyDbState(dbClient, {
                schemaName,
                userId: runManifest.testUser.userId,
                label: `${label} before idempotency probe (user A)`
            })
        )
        const idempotencyKey = createEconomyIdempotencyKey()
        const idempotentBody = { nomenclatureCode: sellCode, quantity: IDEMPOTENT_SELL_QUANTITY }
        const firstIdempotentSell = await tradeViaApi(api, applicationId, 'sell', idempotentBody, idempotencyKey)
        expect(firstIdempotentSell.status, `${label} idempotent sell must execute`).toBe(200)
        const replayedSell = await tradeViaApi(api, applicationId, 'sell', idempotentBody, idempotencyKey)
        expect(replayedSell.status, `${label} idempotent replay must return the stored status`).toBe(firstIdempotentSell.status)
        expect(replayedSell.payload, `${label} idempotent replay must return the stored response body`).toEqual(firstIdempotentSell.payload)
        const conflictingSell = await tradeViaApi(api, applicationId, 'sell', { nomenclatureCode: sellCode, quantity: 2 }, idempotencyKey)
        expect(conflictingSell.status, `${label} same key with a different body must conflict`).toBe(409)
        expect(conflictingSell.payload?.code, `${label} idempotency conflict error code`).toBe('ECONOMY_IDEMPOTENCY_CONFLICT')

        await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) =>
            assertEconomyDbState(dbClient, {
                schemaName,
                userId: runManifest.testUser.userId,
                expected: {
                    walletRows: 1,
                    operations: stateBeforeIdempotency.operations + 1,
                    walletFacts: stateBeforeIdempotency.walletFacts + 1,
                    inventoryFacts: stateBeforeIdempotency.inventoryFacts + 1,
                    walletFactAmountSum: stateBeforeIdempotency.walletFactAmountSum + IDEMPOTENT_SELL_QUANTITY * ORE_PRICE_PER_KG,
                    inventoryQuantityByCode: { [sellCode]: ORE_AFTER_ALL_TRADES, [buyCode]: FUEL_AFTER_ALL_TRADES }
                },
                label: `${label} idempotency replay posted exactly one Operation (user A)`
            })
        )

        // ── h. Negative matrix via direct API (TZ FR-029 + §8.4) ──
        const negativeCases: Array<{
            name: string
            kind: EconomyTradeKind
            body: Record<string, unknown>
            status: number
            code: string
        }> = [
            {
                name: 'zero quantity',
                kind: 'sell',
                body: { nomenclatureCode: sellCode, quantity: 0 },
                status: 422,
                code: 'ECONOMY_INVALID_QUANTITY'
            },
            {
                name: 'unknown nomenclature',
                kind: 'sell',
                body: { nomenclatureCode: 'E2E-UNKNOWN-NOMENCLATURE', quantity: 1 },
                status: 404,
                code: 'ECONOMY_UNKNOWN_NOMENCLATURE'
            },
            {
                name: 'sell beyond owned cargo',
                kind: 'sell',
                body: { nomenclatureCode: sellCode, quantity: 999 },
                status: 409,
                code: 'ECONOMY_INSUFFICIENT_CARGO'
            },
            {
                name: 'buy beyond balance',
                kind: 'buy',
                body: { nomenclatureCode: buyCode, quantity: 1000 },
                status: 409,
                code: 'ECONOMY_INSUFFICIENT_FUNDS'
            },
            {
                name: 'buy beyond max cargo mass',
                kind: 'buy',
                body: { nomenclatureCode: buyCode, quantity: 120 },
                status: 409,
                code: 'ECONOMY_CAPACITY_EXCEEDED'
            },
            {
                name: 'server-owned ownerKey field',
                kind: 'sell',
                body: { nomenclatureCode: sellCode, quantity: 1, ownerKey: 'e2e-forbidden-owner' },
                status: 422,
                code: 'ECONOMY_INVALID_QUANTITY'
            },
            {
                name: 'nomenclature without the requested market side',
                kind: 'sell',
                body: { nomenclatureCode: buyCode, quantity: 1 },
                status: 409,
                code: 'ECONOMY_MARKET_DISABLED'
            }
        ]
        for (const negativeCase of negativeCases) {
            const outcome = await tradeViaApi(api, applicationId, negativeCase.kind, negativeCase.body)
            expect(outcome.status, `${label} ${negativeCase.name} must fail with HTTP ${negativeCase.status}`).toBe(negativeCase.status)
            expect(outcome.payload?.code, `${label} ${negativeCase.name} error code`).toBe(negativeCase.code)
        }

        const ledgersResult = await listRuntimeLedgersViaApi(api, applicationId)
        expect(ledgersResult.status, `${label} runtime ledgers must list`).toBe(200)
        const walletLedgerId = ledgersResult.ledgers.find(
            (ledger) =>
                String(ledger.codename ?? '')
                    .trim()
                    .toLowerCase() === 'walletledger'
        )?.id
        expect(walletLedgerId, `${label} fixture must expose the WalletLedger runtime ledger`).toEqual(expect.any(String))
        const registrarOnly = await appendLedgerFactViaApi(api, applicationId, String(walletLedgerId), { Amount: 999_999 })
        expect(registrarOnly.status, `${label} manual append into a registrar ledger must be forbidden`).toBe(403)
        expect(registrarOnly.payload?.code, `${label} registrar-only error code`).toBe('LEDGER_REGISTRAR_ONLY')

        await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) =>
            assertEconomyDbState(dbClient, {
                schemaName,
                userId: runManifest.testUser.userId,
                expected: {
                    walletRows: 1,
                    operations: stateBeforeIdempotency.operations + 1,
                    walletFacts: stateBeforeIdempotency.walletFacts + 1,
                    inventoryFacts: stateBeforeIdempotency.inventoryFacts + 1,
                    walletFactAmountSum: BALANCE_AFTER_ALL_TRADES,
                    inventoryQuantityByCode: { [sellCode]: ORE_AFTER_ALL_TRADES, [buyCode]: FUEL_AFTER_ALL_TRADES }
                },
                label: `${label} negative matrix must not change the store (user A)`
            })
        )

        // The same rejection through the widget: the localized error surfaces in
        // `economy-error` while the store stays untouched.
        await tradeViaUi(page, 'sell', 999, { expectedStatus: 409, label })
        await expectEconomyError(page, undefined, label)

        // ── h2. Disabled station market: trades are rejected 409 server-side ──
        await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) => {
            await setStationMarketEnabledViaDb(dbClient, schemaName, false)
        })
        try {
            const disabledSell = await tradeViaApi(api, applicationId, 'sell', { nomenclatureCode: sellCode, quantity: 1 })
            expect(disabledSell.status, `${label} sell with a disabled station market must be rejected with 409`).toBe(409)
            expect(disabledSell.payload?.code, `${label} disabled-market error code`).toBe('ECONOMY_MARKET_DISABLED')
        } finally {
            // Restore the market so later legs (user B, screenshots) observe the
            // fully configured economy.
            await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) => {
                await setStationMarketEnabledViaDb(dbClient, schemaName, true)
            })
        }

        // ── i. User B: own grant, no user A rows anywhere in B's payloads ──
        const bootstrapApi = await createBootstrapApiContext()
        let userBCredentials: { email: string; password: string } | null = null
        let userBId: string | null = null
        try {
            const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
            const memberEmail = `e2e+${runManifest.runId}.mmoomm-economy-user-b@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
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
                comment: `Created for MMOOMM economy user B coverage ${runManifest.runId}`
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
            throw new Error('MMOOMM economy user B credentials were not created')
        }

        const userBLabel = `${label} user B`
        const sessionB = await createLoggedInBrowserContext(browser, userBCredentials)
        const apiB = await createLoggedInApiContext(userBCredentials)
        try {
            // B has not opened the app yet: no flight session exists for B, so the
            // FR-019 server-side proximity gate must reject the trade outright.
            const preCanvasSell = await tradeViaApi(apiB, applicationId, 'sell', { nomenclatureCode: sellCode, quantity: 1 })
            expect(preCanvasSell.status, `${userBLabel} pre-canvas sell must be rejected with 409`).toBe(409)
            expect(preCanvasSell.payload?.code, `${userBLabel} pre-canvas sell error code`).toBe('ECONOMY_NOT_AT_STATION')

            await sessionB.page.goto(`/a/${applicationId}`)
            await openMmoommSpaceSection(sessionB.page)
            await expectEconomyPanelVisible(sessionB.page, userBLabel)
            await expectEconomySummary(sessionB.page, { balance: STARTING_BALANCE, oreKg: STARTING_ORE_KG }, userBLabel)

            const summaryB = await fetchEconomySummaryViaApi(apiB, applicationId)
            expect(summaryB.status, `${userBLabel} summary must load`).toBe(200)
            expect(Number(summaryB.payload?.wallet.balance), `${userBLabel} balance must be the own granted one`).toBeCloseTo(
                STARTING_BALANCE,
                6
            )
            const summaryAFresh = await fetchEconomySummaryViaApi(api, applicationId)
            const operationIdsA = (summaryAFresh.payload?.operations ?? []).map((operation) => operation.id)
            const operationIdsB = (summaryB.payload?.operations ?? []).map((operation) => operation.id)
            expect(
                operationIdsB.filter((operationId) => operationIdsA.includes(operationId)),
                `${userBLabel} summary must not contain any user A operation rows`
            ).toEqual([])
            expect(operationIdsB.length, `${userBLabel} must see only the own StarterGrant operation`).toBe(1)

            await withE2eDatabaseClient(async (dbClient: EconomyDatabaseClient) =>
                assertEconomyDbState(dbClient, {
                    schemaName,
                    userId: userBId,
                    expected: {
                        walletRows: 1,
                        operations: 1,
                        walletFacts: 1,
                        inventoryFacts: 1,
                        walletFactAmountSum: STARTING_BALANCE,
                        inventoryQuantityByCode: { [sellCode]: STARTING_ORE_KG }
                    },
                    label: `${userBLabel} isolated first-entry grant`
                })
            )
        } finally {
            await disposeApiContext(apiB)
            await sessionB.context.close()
        }

        // ── j. G3 screenshots: viewport matrix x EN/RU (no committed baselines here) ──
        // expectRuntimeUxViewportMatrix asserts expectNoPageHorizontalOverflow at
        // every viewport, including the 1280x800 and 390x844 UI-Contract gates.
        for (const locale of ['en', 'ru'] as const) {
            await switchRuntimeLocale(page, locale)
            // The locale switch is a full page navigation — the runtime lands on the
            // default Welcome section; re-open Space so the scoped panel remounts.
            await openMmoommSpaceSection(page)
            await expectEconomyPanelVisible(page, `${label} ${locale}`)
            await expectEconomySummary(page, { balance: BALANCE_AFTER_ALL_TRADES }, `${label} ${locale}`)
            await expectRuntimeUxViewportMatrix(page, `${label} ${locale} economy panel`, {
                viewports: ECONOMY_SCREENSHOT_VIEWPORTS,
                beforeEachViewport: async (viewport) => {
                    const { panelPath, pagePath } = await collectEconomyScreenshots(page, testInfo, {
                        viewportName: viewport.name,
                        locale,
                        label: `${label} ${locale}`
                    })
                    // M2: with MMOOMM_ECONOMY_DOCS_SCREENSHOTS=1 the desktop
                    // captures are copied into the GitBook assets so the guides
                    // embed committed screenshots instead of relying on the
                    // screenshotExemptPages escape hatch.
                    if (viewport.name === ECONOMY_DOCS_VIEWPORT_NAME && process.env.MMOOMM_ECONOMY_DOCS_SCREENSHOTS === '1') {
                        const docsAssetsDir = path.resolve('docs', locale, '.gitbook', 'assets', 'mmoomm-economy')
                        await mkdir(docsAssetsDir, { recursive: true })
                        await copyFile(panelPath, path.join(docsAssetsDir, `mmoomm-economy-panel-${locale}.png`))
                        await copyFile(pagePath, path.join(docsAssetsDir, `mmoomm-economy-page-${locale}.png`))
                    }
                }
            })
        }

        // ── k. G5 manual-acceptance evidence ──
        const manualAcceptance = {
            flightRegression:
                'Covered by the existing snapshot-import-mmoomm-app-runtime.spec.ts flight/multi-ship matrix — intentionally not duplicated here.',
            economyPanelPlacement: ECONOMY_SCREENSHOT_VIEWPORTS.map(
                (viewport) =>
                    `${viewport.width}x${viewport.height}: economy dialog (opened from the flight canvas toolbar) + page screenshots attached (EN and RU), no page-level horizontal overflow`
            ),
            localesSpotCheck: ['en', 'ru'],
            exercisedErrorCodes: [
                'ECONOMY_NOT_AT_STATION',
                'ECONOMY_UNKNOWN_NOMENCLATURE',
                'ECONOMY_INVALID_QUANTITY',
                'ECONOMY_INSUFFICIENT_CARGO',
                'ECONOMY_INSUFFICIENT_FUNDS',
                'ECONOMY_CAPACITY_EXCEEDED',
                'ECONOMY_MARKET_DISABLED',
                'ECONOMY_IDEMPOTENCY_CONFLICT',
                'LEDGER_REGISTRAR_ONLY'
            ],
            remainingCoverage: {
                ECONOMY_POSTING_FAILED:
                    'Backend Jest suites (runtimeEconomyService) cover the 500 mapping — not forceable from a healthy E2E fixture.',
                ECONOMY_MARKET_DISABLED_stationVariant:
                    'Exercised through the wrong-market-side sell; the disabled-station fixture variant stays a backend/generator concern.'
            }
        }
        testInfo.annotations.push({
            type: 'manual-acceptance',
            description: 'MMOOMM economy G5 checklist attached as mmoomm-economy-manual-acceptance.json'
        })
        await testInfo.attach('mmoomm-economy-manual-acceptance.json', {
            body: Buffer.from(JSON.stringify(manualAcceptance, null, 2)),
            contentType: 'application/json'
        })
    })
})
