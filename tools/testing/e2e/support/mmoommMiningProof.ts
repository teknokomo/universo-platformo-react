import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'
import type { EconomyMiningState } from '@universo-react/types'
import { requestApi } from './backend/api-session.mjs'
import {
    MMOOMM_ECONOMY_INVENTORY_LEDGER_CODENAME,
    MMOOMM_ECONOMY_OPERATION_CODENAME,
    MMOOMM_MINING_ASTEROID_CODENAME,
    readCodenameText
} from './mmoommAppFixtureContract.shared'
import {
    assertPngHasVisibleContent,
    MMOOMM_ECONOMY_PANEL_TIMEOUT,
    parseLocalizedAmount,
    postWithCsrf,
    readJsonBody,
    type EconomyApiSession,
    type EconomyDatabaseClient
} from './mmoommEconomyProof'
import { MMOOMM_ROTATE_LEFT_BUTTON_NAME, MMOOMM_ROTATE_RIGHT_BUTTON_NAME } from './mmoommRuntimeProof.navigation'

/**
 * MMOOMM mining proof helpers (mining plan Phase E, TZ DOC-2026-006).
 *
 * Every assertion is driven through the published runtime mining surface —
 * the belt canvas oracles (`canvas.dataset.mining*`), the mining HUD testids,
 * the flight canvas toolbar fire button and the
 * `/api/v1/applications/:id/runtime/economy/mining/*` REST routes — plus
 * direct SQL reads against the application schema for the store of record
 * (Mine Operation rows, InventoryLedger facts, asteroid remainders).
 * The helpers never write through SQL: the DB layer is read-only here.
 */

export type MiningApiSession = EconomyApiSession
export type MiningDatabaseClient = EconomyDatabaseClient

/** Timeout for one belt/HUD load: aligned with `MMOOMM_RUNTIME_EXPECT_TIMEOUT`. */
export const MMOOMM_MINING_EXPECT_TIMEOUT = MMOOMM_ECONOMY_PANEL_TIMEOUT

export type MiningStatePayload = EconomyMiningState

export type MiningFireResult = { status: number; payload: Record<string, unknown> | null }
export type MiningStateResult = { status: number; payload: MiningStatePayload | null }

export type MiningFirePayload = {
    operationId?: unknown
    asteroid?: { code?: unknown; remainingQuantityKg?: unknown; status?: unknown }
    chunks?: Array<{ id?: unknown; massKg?: unknown; scale?: unknown }>
    cargo?: { usedKg?: unknown; capacityKg?: unknown }
    wallet?: { balance?: unknown; currency?: unknown }
}

const MINING_FIRE_PATH_PATTERN = /\/runtime\/economy\/mining\/fire(?:\?|$)/
const MINING_STATE_PATH_PATTERN = /\/runtime\/economy\/mining\/state(?:\?|$)/

/**
 * Belt asteroid codes authored by the fixture (TZ §7.7) — five rows, remainders
 * 120/160/90/200/140 kg. Only the ORDER is asserted here; stocks come from the
 * belt state API payload, never from this module.
 */
export const MMOOMM_MINING_BELT_SIZE = 5

/** The fire target is safely out of mining range above this distance (radius 80 m + max asteroid effective radius 5 m, TZ §9.2). */
export const MINING_OUT_OF_RANGE_DISTANCE_METERS = 90

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------
// Canvas belt oracles (mining TZ §11: canvas.dataset mining* attributes)
// ---------------------------------------------------------------------------

type MiningControlCanvas = HTMLCanvasElement & {
    __playcanvasPickAsteroid?: (clientX: number, clientY: number) => { code: string; point: unknown } | null
    __playcanvasMoveToTarget?: (target: { x: number; y: number; z: number } | null, objectId?: string) => void
}

const getMiningCanvas = (page: Page) => page.getByTestId('playcanvas-canvas')

const readMiningCanvasDataset = async (page: Page): Promise<Record<string, string>> =>
    page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="playcanvas-canvas"]') as HTMLCanvasElement | null
        return canvas ? { ...canvas.dataset } : {}
    })

/**
 * Belt snapshot rendered on the canvas: the mining layer publishes
 * `data-mining-asteroid-count` once the belt state poll delivered asteroids.
 */
export const expectMiningBeltVisible = async (
    page: Page,
    label = 'MMOOMM mining belt',
    expectedAsteroidCount = MMOOMM_MINING_BELT_SIZE
): Promise<void> => {
    const canvas = getMiningCanvas(page)
    await expect(canvas, `${label} realtime canvas must render`).toBeVisible({ timeout: MMOOMM_MINING_EXPECT_TIMEOUT })
    await expect(canvas, `${label} must render the fixture belt (${expectedAsteroidCount} asteroids)`).toHaveAttribute(
        'data-mining-asteroid-count',
        String(expectedAsteroidCount),
        { timeout: MMOOMM_MINING_EXPECT_TIMEOUT }
    )
    await expectMiningHud(page, label)
}

/** The mining HUD (cargo + target info) mounted over the flight canvas (TZ §11.4). */
export const expectMiningHud = async (page: Page, label = 'MMOOMM mining HUD'): Promise<void> => {
    await expect(page.getByTestId('mining-hud'), `${label} must render`).toBeVisible({ timeout: MMOOMM_MINING_EXPECT_TIMEOUT })
    await expect(page.getByTestId('mining-cargo-value'), `${label} cargo value must render`).toBeVisible({
        timeout: MMOOMM_MINING_EXPECT_TIMEOUT
    })
}

/**
 * Parses the HUD cargo line `Cargo: {used} / {max} kg` (RU: `Груз: … кг`) —
 * locale-tolerant through `parseLocalizedAmount`.
 */
export const readMiningCargoHud = async (page: Page, label = 'MMOOMM mining HUD'): Promise<{ usedKg: number; capacityKg: number }> => {
    const cargoValue = page.getByTestId('mining-cargo-value')
    await expect(cargoValue, `${label} cargo value must render`).toBeVisible({ timeout: MMOOMM_MINING_EXPECT_TIMEOUT })
    const text = (await cargoValue.innerText()).trim()
    const match = text.match(/([\d.,\s\u00a0\u202f]+)\s*\/\s*([\d.,\s\u00a0\u202f]+)/)
    if (!match) {
        throw new Error(`E2E could not parse the mining HUD cargo line from "${text}"`)
    }
    return {
        usedKg: parseLocalizedAmount(match[1].trim()),
        capacityKg: parseLocalizedAmount(match[2].trim())
    }
}

export const expectMiningCargoHud = async (
    page: Page,
    expected: { usedKg: number; capacityKg?: number },
    label = 'MMOOMM mining HUD'
): Promise<void> => {
    await expect
        .poll(() => readMiningCargoHud(page, label), {
            timeout: MMOOMM_MINING_EXPECT_TIMEOUT,
            message: `${label} rendered cargo value`
        })
        .toMatchObject({
            usedKg: expect.closeTo(expected.usedKg, 1),
            ...(expected.capacityKg !== undefined ? { capacityKg: expect.closeTo(expected.capacityKg, 1) } : {})
        })
}

/**
 * Sweeps the canvas with the runtime's own asteroid raycast
 * (`__playcanvasPickAsteroid`) and returns the screen centroid of the requested
 * asteroid. This is the deterministic first-target oracle: the
 * `miningTargetScreenX/Y` datasets only exist AFTER a target is selected, so
 * they cannot bootstrap the first click.
 */
const findAsteroidScreenPoint = async (page: Page, code: string): Promise<{ x: number; y: number } | null> =>
    page.evaluate((asteroidCode) => {
        const canvas = document.querySelector('[data-testid="playcanvas-canvas"]') as MiningControlCanvas | null
        if (!canvas || typeof canvas.__playcanvasPickAsteroid !== 'function') return null
        const rect = canvas.getBoundingClientRect()
        if (rect.width <= 8 || rect.height <= 8) return null
        const hits: Array<{ x: number; y: number }> = []
        const step = 14
        for (let y = rect.top + step / 2; y < rect.bottom - step / 2; y += step) {
            for (let x = rect.left + step / 2; x < rect.right - step / 2; x += step) {
                const hit = canvas.__playcanvasPickAsteroid?.(x, y)
                if (hit && hit.code === asteroidCode) {
                    hits.push({ x, y })
                }
            }
        }
        if (hits.length === 0) return null
        const centroid = hits.reduce((acc, point) => ({ x: acc.x + point.x / hits.length, y: acc.y + point.y / hits.length }), {
            x: 0,
            y: 0
        })
        return { x: centroid.x, y: centroid.y }
    }, code)

/**
 * Asteroid spheres can partially occlude each other from the current camera,
 * so the centroid of the visible-pixel sweep can land on the occluder. Returns
 * the per-pixel hit candidates (deduplicated, sorted by distance to the
 * centroid) so the selector can click them one by one until the runtime target
 * actually becomes the expected code.
 */
const findAsteroidScreenCandidates = async (page: Page, code: string): Promise<Array<{ x: number; y: number }>> => {
    const centroid = await findAsteroidScreenPoint(page, code)
    if (!centroid) return []
    return page.evaluate(
        ({ asteroidCode, center }) => {
            const canvas = document.querySelector('[data-testid="playcanvas-canvas"]') as MiningControlCanvas | null
            if (!canvas || typeof canvas.__playcanvasPickAsteroid !== 'function') return []
            const rect = canvas.getBoundingClientRect()
            if (rect.width <= 8 || rect.height <= 8) return []
            const hits: Array<{ x: number; y: number }> = []
            const step = 14
            for (let y = rect.top + step / 2; y < rect.bottom - step / 2; y += step) {
                for (let x = rect.left + step / 2; x < rect.right - step / 2; x += step) {
                    const hit = canvas.__playcanvasPickAsteroid?.(x, y)
                    if (hit && hit.code === asteroidCode) {
                        hits.push({ x, y })
                    }
                }
            }
            return hits.sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y)).slice(0, 6)
        },
        { asteroidCode: code, center: centroid }
    )
}

/**
 * Selects the fire target by clicking the canvas where the runtime's own ray
 * sees the asteroid (TZ §11.2: the click selects the target and must NOT emit
 * `move_to_object`). Falls back to orbit-camera rotation buttons when the
 * asteroid is outside the current view.
 */
export const selectAsteroidViaClick = async (page: Page, code: string, label = 'MMOOMM mining target'): Promise<void> => {
    const canvas = getMiningCanvas(page)
    const canvasWidget = page.getByTestId('playcanvas-canvas-widget')
    const rotateButtons = [
        canvasWidget.getByRole('button', { name: MMOOMM_ROTATE_LEFT_BUTTON_NAME }),
        canvasWidget.getByRole('button', { name: MMOOMM_ROTATE_RIGHT_BUTTON_NAME })
    ]
    const maxAttempts = 16
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const candidates = await findAsteroidScreenCandidates(page, code)
        let targeted = false
        for (const point of candidates) {
            await page.mouse.click(point.x, point.y)
            try {
                await expect(canvas, `${label} ${code} must become the fire target`).toHaveAttribute('data-mining-target-code', code, {
                    timeout: 3_000
                })
                targeted = true
                break
            } catch {
                // The click may have landed on a partially occluding neighbour —
                // retry with the next candidate pixel.
            }
        }
        if (targeted) {
            // The frame loop publishes the projected screen coords + live range
            // only while a target is selected — both must appear for later legs.
            await expect(canvas, `${label} ${code} projected screen coords must render`).toHaveAttribute(
                'data-mining-target-screen-x',
                /-?[\d.]+/,
                { timeout: MMOOMM_MINING_EXPECT_TIMEOUT }
            )
            await expect(canvas, `${label} ${code} live distance must render`).toHaveAttribute(
                'data-mining-target-distance-meters',
                /[\d.]+/,
                { timeout: MMOOMM_MINING_EXPECT_TIMEOUT }
            )
            return
        }
        // Asteroid not under the current camera view: orbit a quarter-turn and
        // sweep again. The sweep re-runs from scratch every attempt.
        const rotateButton = rotateButtons[attempt % rotateButtons.length]
        await expect(rotateButton, `${label} camera rotate button must render for the sweep fallback`).toBeVisible({
            timeout: MMOOMM_MINING_EXPECT_TIMEOUT
        })
        await rotateButton.click()
        await delay(400)
    }
    throw new Error(`${label}: asteroid ${code} was not found on the canvas after ${maxAttempts} sweep/rotate attempts`)
}

/** Reads the live belt target oracles published on the canvas dataset. */
export const readMiningTargetOracles = async (
    page: Page
): Promise<{ targetCode: string | null; distanceMeters: number | null; screenX: number | null; screenY: number | null }> => {
    const dataset = await readMiningCanvasDataset(page)
    const toNumber = (value: string | undefined): number | null => {
        if (value === undefined) return null
        const parsed = Number.parseFloat(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    return {
        targetCode: dataset.miningTargetCode ?? null,
        distanceMeters: toNumber(dataset.miningTargetDistanceMeters),
        screenX: toNumber(dataset.miningTargetScreenX),
        screenY: toNumber(dataset.miningTargetScreenY)
    }
}

/**
 * Waits until the targeted asteroid is beyond the mining radius per the canvas
 * range oracle (TZ §9.2 — the server re-checks with the authoritative room
 * position, and the ship keeps flying away, so the local margin is safe).
 */
export const expectMiningTargetOutOfRange = async (
    page: Page,
    label = 'MMOOMM mining range',
    thresholdMeters = MINING_OUT_OF_RANGE_DISTANCE_METERS
): Promise<number> => {
    let lastDistance: number | null = null
    await expect
        .poll(
            async () => {
                const oracles = await readMiningTargetOracles(page)
                lastDistance = oracles.distanceMeters
                return lastDistance !== null && lastDistance > thresholdMeters
            },
            {
                timeout: 120_000,
                message: `${label} ship must fly beyond ${thresholdMeters} m from the target (last ${lastDistance} m)`
            }
        )
        .toBe(true)
    return lastDistance as number
}

/**
 * Waits until the flight room reports the ship inside `maxMeters` of `point`.
 * Reads the live authoritative position from the flight-control dataset
 * markers (`shipX/Y/Z`) — a fly intent alone proves acceptance, not arrival
 * (UX round 2026-11-23: fires issued mid-flight 409 with MINING_OUT_OF_RANGE
 * instead of the expected code).
 */
export const waitUntilMiningShipNear = async (
    page: Page,
    point: { x: number; y: number; z: number },
    label = 'MMOOMM mining ship arrival',
    maxMeters = 15
): Promise<void> => {
    await expect
        .poll(
            async () => {
                const ship = await page.evaluate(() => {
                    const canvas = document.querySelector('[data-testid="playcanvas-canvas"]') as HTMLCanvasElement | null
                    const read = (key: string): number => Number(canvas?.dataset[key as 'shipX'])
                    const values = [read('shipX'), read('shipY'), read('shipZ')]
                    return values.every((value) => Number.isFinite(value)) ? values : null
                })
                if (!ship) return Number.POSITIVE_INFINITY
                return Math.hypot(ship[0] - point.x, ship[1] - point.y, ship[2] - point.z)
            },
            { timeout: 180_000, intervalMs: 500 }
        )
        .toBeLessThan(maxMeters)
}

/**
 * Issues a server-authoritative `move_to_point` intent through the canvas host
 * bridge (the same path a double-click on empty space uses) and proves the
 * intent was accepted via the `data-last-intent-kind` oracle.
 */
export const flyMiningShipToPoint = async (
    page: Page,
    target: { x: number; y: number; z: number },
    label = 'MMOOMM mining flight'
): Promise<void> => {
    await page.evaluate((point) => {
        const canvas = document.querySelector('[data-testid="playcanvas-canvas"]') as MiningControlCanvas | null
        canvas?.__playcanvasMoveToTarget?.({ x: point.x, y: point.y, z: point.z })
    }, target)
    const canvas = getMiningCanvas(page)
    await expect(canvas, `${label} move_to_point intent must be accepted`).toHaveAttribute('data-last-intent-kind', 'move_to_point', {
        timeout: 15_000
    })
    await expect(canvas, `${label} intent target X must be published`).toHaveAttribute('data-last-intent-target-x', /-?[\d.]+/, {
        timeout: 15_000
    })
}

// ---------------------------------------------------------------------------
// Mining fire / belt REST helpers
// ---------------------------------------------------------------------------

/**
 * Fires through the widget (toolbar fire button) and returns the raw REST
 * outcome. Pass `expectedStatus` to drive a rejection through the UI — the
 * localized error must then surface in `mining-error`.
 */
export const fireViaUi = async (page: Page, options: { label?: string; expectedStatus?: number } = {}): Promise<MiningFireResult> => {
    const label = options.label ?? 'MMOOMM mining fire'
    const expectedStatus = options.expectedStatus ?? 200
    const fireButton = page.getByTestId('mining-fire-button')
    await expect(fireButton, `${label} toolbar button must render`).toBeVisible({ timeout: MMOOMM_MINING_EXPECT_TIMEOUT })
    await expect(fireButton, `${label} toolbar button must be enabled with a target`).toBeEnabled({
        timeout: MMOOMM_MINING_EXPECT_TIMEOUT
    })
    const [response] = await Promise.all([
        page.waitForResponse((res) => res.request().method() === 'POST' && MINING_FIRE_PATH_PATTERN.test(res.url()), {
            timeout: MMOOMM_MINING_EXPECT_TIMEOUT
        }),
        fireButton.click()
    ])
    const payload = await readJsonBody(response)
    expect(response.status(), `${label} must respond with HTTP ${expectedStatus}: ${JSON.stringify(payload)}`).toBe(expectedStatus)
    if (expectedStatus === 200) {
        await expect(page.getByTestId('mining-error'), `${label} must not render an error after a successful fire`).toHaveCount(0)
    } else {
        await expectMiningError(page, undefined, label)
    }
    return { status: response.status(), payload }
}

/** POST /:applicationId/runtime/economy/mining/fire — `{ asteroidCode }` body ONLY (TZ §8.2). */
export const fireViaApi = async (
    api: MiningApiSession,
    applicationId: string,
    body: Record<string, unknown>,
    idempotencyKey?: string
): Promise<MiningFireResult> => {
    const response = await postWithCsrf(api, `/api/v1/applications/${applicationId}/runtime/economy/mining/fire`, body, {
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    })
    return { status: response.status, payload: await readJsonBody(response) }
}

/** GET /:applicationId/runtime/economy/mining/state — belt snapshot + constants (TZ §8.1). */
export const fetchMiningStateViaApi = async (api: MiningApiSession, applicationId: string): Promise<MiningStateResult> => {
    const response = await requestApi(api, `/api/v1/applications/${applicationId}/runtime/economy/mining/state`, { method: 'GET' })
    const payload = (await readJsonBody(response)) as MiningStatePayload | null
    return { status: response.status, payload }
}

/** Waits for the next periodic belt poll so the canvas reflects the shared belt state. */
export const waitForBeltPoll = async (page: Page, applicationId: string, label = 'MMOOMM mining belt'): Promise<void> => {
    await page.waitForResponse(
        (res) => res.request().method() === 'GET' && MINING_STATE_PATH_PATTERN.test(res.url()) && res.url().includes(applicationId),
        { timeout: 30_000 }
    )
    await expectMiningBeltVisible(page, label)
}

// ---------------------------------------------------------------------------
// Localized mining errors (mining-error Alert)
// ---------------------------------------------------------------------------

export const expectMiningError = async (page: Page, messageSubstring?: string, label = 'MMOOMM mining error'): Promise<void> => {
    const error = page.getByTestId('mining-error')
    await expect(error, `${label} must render the localized mining error`).toBeVisible({ timeout: MMOOMM_MINING_EXPECT_TIMEOUT })
    if (messageSubstring) {
        await expect(error, `${label} mining error message`).toContainText(messageSubstring, { ignoreCase: true })
    }
}

/** The capacity rejection renders the "Sell ore" hint action inside the error alert (TZ §11.4). */
export const expectMiningCapacityHint = async (page: Page, label = 'MMOOMM mining capacity hint'): Promise<void> => {
    const hintButton = page.getByTestId('mining-error').getByRole('button', { name: /^(Sell ore|Продать руду)$/i })
    await expect(hintButton, `${label} must offer the Sell ore shortcut`).toBeVisible({ timeout: MMOOMM_MINING_EXPECT_TIMEOUT })
}

// ---------------------------------------------------------------------------
// Database (read-only SQL against the application schema)
// ---------------------------------------------------------------------------

export type MiningDbStateSnapshot = {
    /** Posted Operation rows stamped `OperationKind = 'Mine'`. */
    mineOperations: number
    /** Sum of the server-stamped Quantity (= chunk sums) over the Mine rows. */
    mineQuantitySum: number
    /** Mine quantity per server-stamped AsteroidCode. */
    mineQuantityByAsteroid: Record<string, number>
    inventoryFacts: number
    inventoryQuantityByCode: Record<string, number>
    /** `obj_asteroid` remaining quantity per Code (raw store of record). */
    asteroidRemainingByCode: Record<string, number>
    /** `obj_asteroid` status LABEL per Code — resolved through `_app_values`, never hardcoded. */
    asteroidStatusByCode: Record<string, string>
}

export type MiningDbStateExpectation = Partial<{
    mineOperations: number
    mineQuantitySum: number
    mineQuantityByAsteroid: Record<string, number>
    inventoryFacts: number
    inventoryQuantityByCode: Record<string, number>
    asteroidRemainingByCode: Record<string, number>
    asteroidStatusByCode: Record<string, string>
}>

export type MiningDbStateOptions = {
    schemaName: string
    /** Scopes operation/fact counts to one user (`_upl_created_by` / OwnerKey dimension). */
    userId?: string
    label?: string
}

const ACTIVE_ROW_CONDITION = '_upl_deleted = false AND _app_deleted = false'
const SAFE_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/i

const assertSafeIdentifier = (value: unknown, label: string): string => {
    if (typeof value !== 'string' || !SAFE_IDENTIFIER_PATTERN.test(value)) {
        throw new Error(`E2E could not safely resolve the ${label} database identifier`)
    }
    return value
}

const quoteDatabaseIdentifier = (value: unknown, label: string): string => `"${assertSafeIdentifier(value, label)}"`

type MiningObjectRef = { id: string; tableSql: string }

/**
 * Reads the mining store of record through `_app_objects`/`_app_components`
 * metadata (mirrors `readEconomyDbState`): Operation rows stamped
 * `OperationKind = 'Mine'`, InventoryLedger facts and the asteroid
 * remainders. Asteroid status is mapped to its LABEL through `_app_values`
 * (the column stores the enumeration value id, exactly like the backend
 * service resolves it). Parameterized SQL only; identifiers are quoted after
 * strict validation.
 */
export const readMiningDbState = async (dbClient: MiningDatabaseClient, options: MiningDbStateOptions): Promise<MiningDbStateSnapshot> => {
    const { schemaName, userId } = options
    const schemaSql = quoteDatabaseIdentifier(schemaName, 'application schema')

    const objectsResult = await dbClient.query(
        `SELECT id, table_name AS "tableName", codename
         FROM ${schemaSql}."_app_objects"
         WHERE ${ACTIVE_ROW_CONDITION}`,
        []
    )
    const objectByCodename = (codename: string, label: string): MiningObjectRef => {
        const object = objectsResult.rows
            .map((row) => row as { id: unknown; tableName: unknown; codename: unknown })
            .find((row) => readCodenameText(row.codename) === codename)
        if (!object) {
            throw new Error(`E2E could not resolve the ${label} ("${codename}") object in schema ${schemaName}`)
        }
        return { id: String(object.id), tableSql: quoteDatabaseIdentifier(object.tableName, `${label} table`) }
    }

    const operationObject = objectByCodename(MMOOMM_ECONOMY_OPERATION_CODENAME, 'Operation entity')
    const inventoryLedgerObject = objectByCodename(MMOOMM_ECONOMY_INVENTORY_LEDGER_CODENAME, 'InventoryLedger register')
    const asteroidObject = objectByCodename(MMOOMM_MINING_ASTEROID_CODENAME, 'Asteroid entity')

    const columnsByObject = async (
        object: MiningObjectRef,
        label: string
    ): Promise<Map<string, { columnName: string; targetObjectId: string | null }>> => {
        const result = await dbClient.query(
            `SELECT codename, column_name AS "columnName", target_object_id AS "targetObjectId"
             FROM ${schemaSql}."_app_components"
             WHERE object_id = $1 AND parent_component_id IS NULL AND ${ACTIVE_ROW_CONDITION}`,
            [object.id]
        )
        const columns = new Map<string, { columnName: string; targetObjectId: string | null }>()
        for (const row of result.rows as Array<{ codename: unknown; columnName: unknown; targetObjectId: unknown }>) {
            const codenameText = readCodenameText(row.codename)
            if (codenameText.length > 0 && typeof row.columnName === 'string' && SAFE_IDENTIFIER_PATTERN.test(row.columnName)) {
                columns.set(codenameText, {
                    columnName: row.columnName,
                    targetObjectId: typeof row.targetObjectId === 'string' ? row.targetObjectId : null
                })
            }
        }
        if (columns.size === 0) {
            throw new Error(`E2E could not resolve any columns for the ${label} in schema ${schemaName}`)
        }
        return columns
    }

    const requireColumn = (
        columns: Map<string, { columnName: string; targetObjectId: string | null }>,
        codename: string,
        label: string
    ): string =>
        quoteDatabaseIdentifier(
            columns.get(codename)?.columnName ??
                (() => {
                    throw new Error(`E2E could not resolve the ${label} "${codename}" column`)
                })(),
            `${label} ${codename} column`
        )

    const ownerClause = (ownerColumnSql: string, params: unknown[]): string => {
        if (!userId) return ''
        params.push(userId)
        return ` AND ${ownerColumnSql}::text = $${params.length}::text`
    }

    // Mine Operations only: the mining flow posts immediately like trades, and
    // the OperationKind STRING component is stamped server-side ('Mine').
    const operationColumns = await columnsByObject(operationObject, 'Operation entity')
    const operationKindColumnSql = requireColumn(operationColumns, 'OperationKind', 'Operation entity')
    const operationQuantityColumnSql = requireColumn(operationColumns, 'Quantity', 'Operation entity')
    const asteroidCodeColumnSql = requireColumn(operationColumns, 'AsteroidCode', 'Operation entity')
    const mineParams: unknown[] = []
    const mineOwnerClause = ownerClause('_upl_created_by', mineParams)
    const mineSummaryResult = await dbClient.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(${operationQuantityColumnSql}::float8), 0) AS total
         FROM ${schemaSql}.${operationObject.tableSql}
         WHERE ${ACTIVE_ROW_CONDITION} AND _app_record_state = 'posted'
           AND ${operationKindColumnSql}::text = 'Mine'${mineOwnerClause}`,
        mineParams
    )
    const mineByAsteroidResult = await dbClient.query(
        `SELECT ${asteroidCodeColumnSql}::text AS code, COALESCE(SUM(${operationQuantityColumnSql}::float8), 0) AS quantity
         FROM ${schemaSql}.${operationObject.tableSql}
         WHERE ${ACTIVE_ROW_CONDITION} AND _app_record_state = 'posted'
           AND ${operationKindColumnSql}::text = 'Mine'${mineOwnerClause}
         GROUP BY 1`,
        mineParams
    )

    // InventoryLedger facts (the Mine movement group is inventory-ONLY — the
    // wallet has no Mine movement, TZ FR-012; wallet coverage stays in
    // readEconomyDbState/assertEconomyDbState).
    const inventoryColumns = await columnsByObject(inventoryLedgerObject, 'InventoryLedger register')
    const inventoryOwnerColumnSql = requireColumn(inventoryColumns, 'OwnerKey', 'InventoryLedger register')
    const nomenclatureCodeColumnSql = requireColumn(inventoryColumns, 'NomenclatureCode', 'InventoryLedger register')
    const inventoryQuantityColumnSql = requireColumn(inventoryColumns, 'Quantity', 'InventoryLedger register')
    const inventoryParams: unknown[] = []
    const inventoryOwnerClause = ownerClause(inventoryOwnerColumnSql, inventoryParams)
    const inventoryFactsResult = await dbClient.query(
        `SELECT COUNT(*)::int AS count
         FROM ${schemaSql}.${inventoryLedgerObject.tableSql}
         WHERE ${ACTIVE_ROW_CONDITION}${inventoryOwnerClause}`,
        inventoryParams
    )
    const inventoryQuantityResult = await dbClient.query(
        `SELECT ${nomenclatureCodeColumnSql}::text AS code, COALESCE(SUM(${inventoryQuantityColumnSql}::float8), 0) AS quantity
         FROM ${schemaSql}.${inventoryLedgerObject.tableSql}
         WHERE ${ACTIVE_ROW_CONDITION}${inventoryOwnerClause}
         GROUP BY 1`,
        inventoryParams
    )

    // Asteroid remainders (store of record for the shared belt). The Status
    // column stores an AsteroidStatus enumeration value id — resolve the id →
    // codename label mapping through _app_values exactly like
    // `resolveEnumValueLabels` in the backend service.
    const asteroidColumns = await columnsByObject(asteroidObject, 'Asteroid entity')
    const asteroidCodeSql = requireColumn(asteroidColumns, 'Code', 'Asteroid entity')
    const asteroidRemainingSql = requireColumn(asteroidColumns, 'RemainingQuantityKg', 'Asteroid entity')
    const asteroidStatusSql = requireColumn(asteroidColumns, 'Status', 'Asteroid entity')
    const asteroidRowsResult = await dbClient.query(
        `SELECT ${asteroidCodeSql}::text AS code,
                COALESCE(${asteroidRemainingSql}::float8, 0) AS remaining,
                ${asteroidStatusSql}::text AS status
         FROM ${schemaSql}.${asteroidObject.tableSql}
         WHERE ${ACTIVE_ROW_CONDITION}`,
        []
    )
    const statusValueIds = (asteroidRowsResult.rows as Array<{ status?: unknown }>)
        .map((row) => row.status)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    const statusLabels = new Map<string, string>()
    if (statusValueIds.length > 0) {
        const valuesResult = await dbClient.query(
            `SELECT id, codename
             FROM ${schemaSql}."_app_values"
             WHERE id = ANY($1::uuid[]) AND ${ACTIVE_ROW_CONDITION}`,
            [statusValueIds]
        )
        for (const row of valuesResult.rows as Array<{ id: unknown; codename: unknown }>) {
            if (typeof row.id === 'string') {
                const label = readCodenameText(row.codename)
                if (label) statusLabels.set(row.id, label)
            }
        }
    }

    const asteroidRemainingByCode: Record<string, number> = {}
    const asteroidStatusByCode: Record<string, string> = {}
    for (const row of asteroidRowsResult.rows as Array<{ code: unknown; remaining: unknown; status: unknown }>) {
        if (typeof row.code === 'string' && row.code.length > 0) {
            asteroidRemainingByCode[row.code] = Number(row.remaining)
            asteroidStatusByCode[row.code] = (typeof row.status === 'string' && statusLabels.get(row.status)) || ''
        }
    }

    const mineQuantityByAsteroid: Record<string, number> = {}
    for (const row of mineByAsteroidResult.rows as Array<{ code: unknown; quantity: unknown }>) {
        if (typeof row.code === 'string' && row.code.length > 0) {
            mineQuantityByAsteroid[row.code] = Number(row.quantity)
        }
    }
    const inventoryQuantityByCode: Record<string, number> = {}
    for (const row of inventoryQuantityResult.rows as Array<{ code: unknown; quantity: unknown }>) {
        if (typeof row.code === 'string' && row.code.length > 0) {
            inventoryQuantityByCode[row.code] = Number(row.quantity)
        }
    }

    const readCount = (row: unknown): number => Number((row as { count?: unknown } | undefined)?.count ?? 0)
    return {
        mineOperations: readCount(mineSummaryResult.rows[0]),
        mineQuantitySum: Number((mineSummaryResult.rows[0] as { total?: unknown } | undefined)?.total ?? 0),
        mineQuantityByAsteroid,
        inventoryFacts: readCount(inventoryFactsResult.rows[0]),
        inventoryQuantityByCode,
        asteroidRemainingByCode,
        asteroidStatusByCode
    }
}

/** `readMiningDbState` + expectation assertions (counts exact, sums close to 1e-6). */
export const assertMiningDbState = async (
    dbClient: MiningDatabaseClient,
    options: MiningDbStateOptions & { expected: MiningDbStateExpectation }
): Promise<MiningDbStateSnapshot> => {
    const label = options.label ?? 'MMOOMM mining database state'
    const snapshot = await readMiningDbState(dbClient, options)
    const { expected } = options
    if (expected.mineOperations !== undefined) {
        expect(snapshot.mineOperations, `${label} posted Mine Operation rows`).toBe(expected.mineOperations)
    }
    if (expected.mineQuantitySum !== undefined) {
        expect(snapshot.mineQuantitySum, `${label} Mine quantity sum`).toBeCloseTo(expected.mineQuantitySum, 6)
    }
    for (const [code, quantity] of Object.entries(expected.mineQuantityByAsteroid ?? {})) {
        expect(snapshot.mineQuantityByAsteroid[code], `${label} Mine quantity for "${code}"`).toBeCloseTo(quantity, 6)
    }
    if (expected.inventoryFacts !== undefined) {
        expect(snapshot.inventoryFacts, `${label} InventoryLedger facts`).toBe(expected.inventoryFacts)
    }
    for (const [code, quantity] of Object.entries(expected.inventoryQuantityByCode ?? {})) {
        expect(snapshot.inventoryQuantityByCode[code], `${label} InventoryLedger quantity for "${code}"`).toBeCloseTo(quantity, 6)
    }
    for (const [code, remaining] of Object.entries(expected.asteroidRemainingByCode ?? {})) {
        expect(snapshot.asteroidRemainingByCode[code], `${label} asteroid "${code}" remaining kg`).toBeCloseTo(remaining, 6)
    }
    for (const [code, status] of Object.entries(expected.asteroidStatusByCode ?? {})) {
        expect(snapshot.asteroidStatusByCode[code], `${label} asteroid "${code}" status label`).toBe(status)
    }
    return snapshot
}

// Re-exported for spec convenience: the mining journey asserts the untouched
// wallet through the same economy store-of-record helpers.
export { assertEconomyDbState, readEconomyDbState } from './mmoommEconomyProof'

// ---------------------------------------------------------------------------
// Screenshots (Phase E docs artifacts)
// ---------------------------------------------------------------------------

export type MiningScreenshotStage = 'belt' | 'fire' | 'hud' | 'depleted'

export type MiningScreenshotOptions = {
    stage: MiningScreenshotStage
    viewportName: string
    locale: string
}

/**
 * Captures the flight page (canvas + mining HUD + toolbar) and, when mounted,
 * the mining HUD element for one named stage. PNG content is auto-verified to
 * be real, non-blank output (QA M8 oracle, shared with the economy proof).
 */
export const collectMiningScreenshots = async (
    page: Page,
    testInfo: TestInfo,
    options: MiningScreenshotOptions
): Promise<{ pagePath: string; hudPath: string | null }> => {
    const suffix = `${options.viewportName}-${options.locale}`

    const pagePath = testInfo.outputPath(`mmoomm-mining-${options.stage}-${suffix}.png`)
    await page.screenshot({ path: pagePath, fullPage: true })
    // The flight page is dominated by the near-uniform canvas gradient, so it
    // uses the same lowered floor as the economy full-page capture.
    assertPngHasVisibleContent(pagePath, { minDistinctBytes: 8 })
    await testInfo.attach(`mmoomm-mining-${options.stage}-${suffix}`, { path: pagePath, contentType: 'image/png' })

    const hud = page.getByTestId('mining-hud')
    let hudPath: string | null = null
    if (await hud.isVisible().catch(() => false)) {
        hudPath = testInfo.outputPath(`mmoomm-mining-${options.stage}-hud-${suffix}.png`)
        await hud.screenshot({ path: hudPath })
        // The mining HUD is a small dark panel (rgba(2,6,17,0.72)) with light
        // text — its byte diversity is naturally low, so it shares the lowered
        // floor with the flight-page captures (blank HUDs sit at 2–4).
        assertPngHasVisibleContent(hudPath, { minDistinctBytes: 8 })
        await testInfo.attach(`mmoomm-mining-${options.stage}-hud-${suffix}`, { path: hudPath, contentType: 'image/png' })
    }

    return { pagePath, hudPath }
}
