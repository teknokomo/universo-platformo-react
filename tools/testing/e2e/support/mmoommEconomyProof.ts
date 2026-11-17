import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'
import { generateUuidV7 } from '@universo-react/utils'
import { fetchCsrfToken, requestApi } from './backend/api-session.mjs'
import {
    MMOOMM_ECONOMY_INVENTORY_LEDGER_CODENAME,
    MMOOMM_ECONOMY_OPERATION_CODENAME,
    MMOOMM_ECONOMY_STATION_CODENAME,
    MMOOMM_ECONOMY_WALLET_CODENAME,
    MMOOMM_ECONOMY_WALLET_LEDGER_CODENAME
} from './mmoommAppFixtureContract.shared'

/** Minimal body-readable response: satisfied by both `fetch` and Playwright responses. */
type BodyReadable = { text: () => Promise<string> }

/**
 * MMOOMM economy proof helpers (plan Phase G2/G3).
 *
 * Every assertion is driven through the published runtime economy surface —
 * the economy dialog testids in the browser (opened from the flight canvas
 * toolbar) and the `/api/v1/applications/:id/runtime/economy/*` REST routes —
 * plus direct SQL reads against the application schema for the ledger/store of
 * record.
 * The helpers never write through SQL: the DB layer is read-only here.
 */

export type EconomyTradeKind = 'sell' | 'buy'

/** Structural shape of `createLoggedInApiContext()` from `api-session.mjs`. */
export type EconomyApiSession = {
    baseURL: string
    cookies: Map<string, string>
}

/** Structural shape of a `pg` client as handed over by `withE2eDatabaseClient`. */
export type EconomyDatabaseClient = {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>
}

/** Mirrors `EconomySummary` from `@universo-react/types` (zod `economySummarySchema`). */
export type EconomySummaryPayload = {
    wallet: { currency: string; balance: number }
    cargo: Array<{ nomenclatureCode: string; nomenclatureName: string; quantity: number; unit: string; massKg: number }>
    capacity: { usedKg: number; maxKg: number }
    market: Array<{ nomenclatureCode: string; nomenclatureName: string; side: EconomyTradeKind; price: number; unit: string }>
    operations: Array<{ id: string; type: string; quantity: number; total: number; occurredAt: string }>
    atStation: boolean
    stationName: string | null
}

export type EconomyApiResult = { status: number; payload: Record<string, unknown> | null }
export type EconomySummaryApiResult = { status: number; payload: EconomySummaryPayload | null }

/** Timeout for one panel load: aligned with `MMOOMM_RUNTIME_EXPECT_TIMEOUT`. */
export const MMOOMM_ECONOMY_PANEL_TIMEOUT = 60_000

const ACTIVE_ROW_CONDITION = '_upl_deleted = false AND _app_deleted = false'
const SAFE_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/i

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const readJsonBody = async (response: BodyReadable): Promise<Record<string, unknown> | null> => {
    const text = await response.text()
    if (!text) return null
    try {
        const parsed = JSON.parse(text)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { raw: parsed }
    } catch {
        return { raw: text }
    }
}

/**
 * The panel formats money through `Intl.NumberFormat` (EN groups with commas,
 * RU groups with spaces/nbsp and may use a decimal comma). Parse it back to a
 * number without assuming the locale: `1,050 CR` → 1050, `1 050 CR` → 1050,
 * `6,6` → 6.6.
 */
export const parseLocalizedAmount = (raw: string): number => {
    const cleaned = raw.replace(/[\s\u00a0\u202f\u2009]/g, '').replace(/[^\d.,-]/g, '')
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    let normalized = cleaned
    if (lastComma !== -1 && lastDot !== -1) {
        const decimalSeparator = lastComma > lastDot ? ',' : '.'
        const groupSeparator = decimalSeparator === ',' ? '.' : ','
        normalized = cleaned.split(groupSeparator).join('')
        normalized = decimalSeparator === ',' ? normalized.replace(/,/g, '.') : normalized
    } else if (lastComma !== -1) {
        normalized = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(',', '.') : cleaned.split(',').join('')
    } else if (lastDot !== -1) {
        normalized = /\.\d{1,2}$/.test(cleaned) ? cleaned : cleaned.split('.').join('')
    }
    const value = Number.parseFloat(normalized)
    if (!Number.isFinite(value)) {
        throw new Error(`E2E could not parse the economy amount from "${raw}" (normalized "${normalized}")`)
    }
    return value
}

/**
 * UUID v7 for the standardized `Idempotency-Key` header, produced by the same
 * shared generator the client widget uses (`@universo-react/utils`) — the
 * backend validates the v7 version nibble, so a v4 `crypto.randomUUID` would
 * be rejected.
 */
export const createEconomyIdempotencyKey = generateUuidV7

// ---------------------------------------------------------------------------
// Browser (economy dialog) assertions
// ---------------------------------------------------------------------------

/**
 * Opens the economy dialog from the flight canvas toolbar (QA 2026-11-16 UX
 * redesign: the economy UI lives in a canonical strict-modal dialog opened
 * from the canvas toolbar, not a permanently mounted zone widget). Idempotent —
 * an already-open dialog is left untouched.
 */
export const openEconomyDialog = async (page: Page, label = 'MMOOMM economy panel'): Promise<void> => {
    // Key on the dialog surface (not the content testid): while the dialog is
    // open and still loading, no `economy-panel` exists yet and a second helper
    // call must not click the opener behind the modal backdrop.
    if (await page.getByRole('dialog').isVisible()) return
    const opener = page.getByTestId('economy-open-button')
    await expect(opener, `${label} toolbar opener must render`).toBeVisible({ timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT })
    await opener.click()
    await expect(page.getByTestId('economy-panel'), `${label} dialog must open`).toBeVisible({ timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT })
}

/** Closes the economy dialog through its visible Close action when it is open. */
export const closeEconomyDialog = async (page: Page, label = 'MMOOMM economy panel'): Promise<void> => {
    if (
        !(await page
            .getByTestId('economy-dialog-close')
            .isVisible()
            .catch(() => false))
    )
        return
    await page.getByTestId('economy-dialog-close').click()
    await expect(page.getByTestId('economy-panel'), `${label} dialog must close`).toBeHidden({ timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT })
}

export const expectEconomyPanelVisible = async (page: Page, label = 'MMOOMM economy panel'): Promise<void> => {
    await openEconomyDialog(page, label)
    await expect(page.getByTestId('economy-panel'), `${label} must render`).toBeVisible({ timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT })
    // The balance is only rendered once the summary query resolved — the panel
    // error state renders `economy-error` instead of `economy-balance`.
    await expect(page.getByTestId('economy-balance'), `${label} wallet balance must render`).toBeVisible({
        timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT
    })
    await expect(page.getByTestId('economy-cargo-list'), `${label} cargo list must render`).toBeVisible({
        timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT
    })
    await expect(page.getByTestId('economy-capacity-bar'), `${label} capacity bar must render`).toBeVisible({
        timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT
    })
    await expect(page.getByTestId('economy-market-list'), `${label} market list must render`).toBeVisible({
        timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT
    })
}

export const readEconomyBalance = async (page: Page, label = 'MMOOMM economy panel'): Promise<number> => {
    await openEconomyDialog(page, label)
    const balance = page.getByTestId('economy-balance')
    await expect(balance, `${label} wallet balance must render`).toBeVisible({ timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT })
    return parseLocalizedAmount((await balance.innerText()).trim())
}

export type EconomySummaryExpectation = {
    balance: number
    oreKg?: number
    fuelL?: number
}

/**
 * Locale-tolerant UI assertions over the panel testids. Exact numeric truth is
 * covered by the API summary + database helpers; this proves the rendered
 * widget shows the granted/traded state (the G2 UI-text requirement).
 */
export const expectEconomySummary = async (
    page: Page,
    expected: EconomySummaryExpectation,
    label = 'MMOOMM economy panel'
): Promise<void> => {
    await expectEconomyPanelVisible(page, label)
    // Poll instead of a single read: the panel refreshes the summary through
    // TanStack invalidation right after a trade, so the rendered value can lag.
    await expect
        .poll(() => readEconomyBalance(page, label), {
            timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT,
            message: `${label} rendered wallet balance`
        })
        .toBeCloseTo(expected.balance, 6)
    if (expected.oreKg !== undefined) {
        await expect(page.getByTestId('economy-cargo-list'), `${label} cargo must render the ore quantity ${expected.oreKg}`).toContainText(
            new RegExp(`\\b${expected.oreKg}\\b`)
        )
    }
    if (expected.fuelL !== undefined) {
        await expect(
            page.getByTestId('economy-cargo-list'),
            `${label} cargo must render the fuel quantity ${expected.fuelL}`
        ).toContainText(new RegExp(`\\b${expected.fuelL}\\b`))
    }
}

export const expectEconomyTradeButtonsDisabled = async (page: Page, options: { disabled: boolean; label?: string }): Promise<void> => {
    const label = options.label ?? 'MMOOMM economy panel'
    await openEconomyDialog(page, label)
    for (const kind of ['sell', 'buy'] as const) {
        const button = page.getByTestId(`economy-${kind}-button`)
        await expect(button, `${label} ${kind} trade button must render`).toBeVisible({ timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT })
        if (options.disabled) {
            await expect(button, `${label} ${kind} trade button must be disabled while out of station`).toBeDisabled()
        } else {
            await expect(button, `${label} ${kind} trade button must be enabled while docked at the station`).toBeEnabled()
        }
    }
}

export const expectEconomyError = async (page: Page, messageSubstring?: string, label = 'MMOOMM economy panel'): Promise<void> => {
    await openEconomyDialog(page, label)
    const error = page.getByTestId('economy-error')
    await expect(error, `${label} must render the localized economy error`).toBeVisible({ timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT })
    if (messageSubstring) {
        await expect(error, `${label} economy error message`).toContainText(messageSubstring, { ignoreCase: true })
    }
}

/**
 * Drives one trade through the widget (quantity input + trade button) and
 * returns the raw REST outcome. The panel generates a fresh UUID v7
 * `Idempotency-Key` per logical click (plan D10), so no key is forced here.
 * Pass `expectedStatus` to drive a rejection through the UI — the localized
 * error must then surface in `economy-error`.
 */
export const tradeViaUi = async (
    page: Page,
    kind: EconomyTradeKind,
    quantity: number,
    options: { label?: string; expectedStatus?: number } = {}
): Promise<EconomyApiResult> => {
    const label = options.label ?? 'MMOOMM economy panel'
    const expectedStatus = options.expectedStatus ?? 200
    await openEconomyDialog(page, label)
    const quantityInput = page.getByTestId(`economy-${kind}-quantity`)
    await expect(quantityInput, `${label} ${kind} quantity input must render`).toBeVisible({ timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT })
    // `fill` auto-waits for the input to become enabled — it stays disabled
    // until the summary reports `atStation: true`.
    await quantityInput.fill(String(quantity))
    const tradeButton = page.getByTestId(`economy-${kind}-button`)
    await expect(tradeButton, `${label} ${kind} trade button must be enabled for the trade`).toBeEnabled()

    const [response] = await Promise.all([
        page.waitForResponse(
            (res) => res.request().method() === 'POST' && new RegExp(`/runtime/economy/${kind}(?:\\?|$)`).test(res.url()),
            { timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT }
        ),
        tradeButton.click()
    ])
    const payload = await readJsonBody(response)
    expect(response.status(), `${label} ${kind} trade must respond with HTTP ${expectedStatus}`).toBe(expectedStatus)
    if (expectedStatus === 200) {
        await expect(page.getByTestId('economy-error'), `${label} must not render an error after a successful ${kind}`).toHaveCount(0)
    } else {
        await expectEconomyError(page, undefined, label)
    }
    return { status: response.status(), payload }
}

// ---------------------------------------------------------------------------
// REST (runtime economy + runtime ledgers) helpers
// ---------------------------------------------------------------------------

const postWithCsrf = async (
    api: EconomyApiSession,
    url: string,
    body: unknown,
    extraHeaders: Record<string, string> = {}
): Promise<BodyReadable> => {
    const csrfToken = await fetchCsrfToken(api)
    return requestApi(api, url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
            ...extraHeaders
        },
        body: JSON.stringify(body)
    })
}

/**
 * Keyboard-path trade (QA M8 oracle): types the quantity with real key events
 * and activates the trade button with `Enter` on the focused control — the
 * interactive surface must be fully operable without mouse clicks.
 */
export const tradeViaUiKeyboard = async (
    page: Page,
    kind: EconomyTradeKind,
    quantity: number,
    options: { label?: string; expectedStatus?: number } = {}
): Promise<EconomyApiResult> => {
    const label = options.label ?? 'MMOOMM economy panel'
    await openEconomyDialog(page, label)
    const quantityInput = page.getByTestId(`economy-${kind}-quantity`)
    await expect(quantityInput, `${label} ${kind} quantity input must render`).toBeVisible({ timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT })
    await quantityInput.click()
    // The journey pre-fills quantities in the docked-at-spawn branch — reset the
    // field first so the keyboard typing below starts from an empty value.
    await quantityInput.fill('')
    await quantityInput.pressSequentially(String(quantity))
    await expect(quantityInput, `${label} keyboard typing must fill the ${kind} quantity`).toHaveValue(String(quantity))
    const tradeButton = page.getByTestId(`economy-${kind}-button`)
    await expect(tradeButton, `${label} ${kind} trade button must be enabled for the keyboard trade`).toBeEnabled()
    const expectedStatus = options.expectedStatus ?? 200
    const [response] = await Promise.all([
        page.waitForResponse(
            (res) => res.request().method() === 'POST' && new RegExp(`/runtime/economy/${kind}(?:\\?|$)`).test(res.url()),
            { timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT }
        ),
        tradeButton.press('Enter')
    ])
    expect(response.status(), `${label} keyboard ${kind} trade must respond with HTTP ${expectedStatus}`).toBe(expectedStatus)
    if (expectedStatus === 200) {
        await expect(page.getByTestId('economy-error'), `${label} must not render an error after a keyboard ${kind}`).toHaveCount(0)
    } else {
        await expectEconomyError(page, undefined, label)
    }
    return { status: response.status(), payload: await readJsonBody(response) }
}

/** POST /:applicationId/runtime/economy/sell|buy — returns status + parsed JSON body. */
export const tradeViaApi = async (
    api: EconomyApiSession,
    applicationId: string,
    kind: EconomyTradeKind,
    body: Record<string, unknown>,
    idempotencyKey?: string
): Promise<EconomyApiResult> => {
    const response = await postWithCsrf(api, `/api/v1/applications/${applicationId}/runtime/economy/${kind}`, body, {
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    })
    return { status: response.status, payload: await readJsonBody(response) }
}

/** GET /:applicationId/runtime/economy/summary — side-effecting (D11 bootstrap) but replay-safe. */
export const fetchEconomySummaryViaApi = async (api: EconomyApiSession, applicationId: string): Promise<EconomySummaryApiResult> => {
    const response = await requestApi(api, `/api/v1/applications/${applicationId}/runtime/economy/summary`, { method: 'GET' })
    return { status: response.status, payload: (await readJsonBody(response)) as EconomySummaryPayload | null }
}

/** GET /:applicationId/runtime/ledgers — ledger registry for the registrar-only negative check. */
export const listRuntimeLedgersViaApi = async (
    api: EconomyApiSession,
    applicationId: string
): Promise<EconomyApiResult & { ledgers: Array<Record<string, unknown>> }> => {
    const response = await requestApi(api, `/api/v1/applications/${applicationId}/runtime/ledgers`, { method: 'GET' })
    const payload = await readJsonBody(response)
    const ledgers = Array.isArray(payload?.ledgers) ? (payload.ledgers as Array<Record<string, unknown>>) : []
    return { status: response.status, payload, ledgers }
}

/** POST /:applicationId/runtime/ledgers/:ledgerId/facts — manual append (registrar ledgers must 403). */
export const appendLedgerFactViaApi = async (
    api: EconomyApiSession,
    applicationId: string,
    ledgerId: string,
    factData: Record<string, unknown>
): Promise<EconomyApiResult> => {
    const response = await postWithCsrf(api, `/api/v1/applications/${applicationId}/runtime/ledgers/${ledgerId}/facts`, {
        facts: [{ data: factData }]
    })
    return { status: response.status, payload: await readJsonBody(response) }
}

// ---------------------------------------------------------------------------
// Flight / proximity
// ---------------------------------------------------------------------------

export type EconomyArrivalOptions = {
    timeoutMs?: number
    intervalMs?: number
    label?: string
}

/**
 * Polls the summary until the flight room reports the ship inside the station
 * market radius (`atStation: true`). The authoritative position is the room
 * state (plan D2) — the browser only issues the `move_to_object` intent.
 */
export const expectEconomyArrivalViaApi = async (
    api: EconomyApiSession,
    applicationId: string,
    options: EconomyArrivalOptions = {}
): Promise<EconomySummaryPayload> => {
    const label = options.label ?? 'MMOOMM economy flight arrival'
    const timeoutMs = options.timeoutMs ?? 240_000
    const intervalMs = options.intervalMs ?? 2_000
    const startedAt = Date.now()
    let lastPayload: EconomySummaryPayload | null = null
    while (Date.now() - startedAt < timeoutMs) {
        const summary = await fetchEconomySummaryViaApi(api, applicationId)
        if (summary.status === 200 && summary.payload?.atStation === true) {
            return summary.payload
        }
        lastPayload = summary.payload
        await delay(intervalMs)
    }
    throw new Error(
        `${label}: the ship did not reach the station market radius within ${timeoutMs}ms (last atStation=${String(
            lastPayload?.atStation
        )})`
    )
}

// ---------------------------------------------------------------------------
// Database (read-only SQL against the application schema)
// ---------------------------------------------------------------------------

const assertSafeIdentifier = (value: unknown, label: string): string => {
    if (typeof value !== 'string' || !SAFE_IDENTIFIER_PATTERN.test(value)) {
        throw new Error(`E2E could not safely resolve the ${label} database identifier`)
    }
    return value
}

const quoteDatabaseIdentifier = (value: unknown, label: string): string => `"${assertSafeIdentifier(value, label)}"`

/** The fixture stores localized codenames; tolerate both plain text and the localized envelope. */
const readCodenameText = (value: unknown): string => {
    if (typeof value === 'string') return value.trim()
    if (!value || typeof value !== 'object') return ''
    const localized = value as { _primary?: string; locales?: Record<string, { content?: string }> }
    const locales = localized.locales ?? {}
    const primary = localized._primary ? locales[localized._primary]?.content : undefined
    if (typeof primary === 'string' && primary.trim().length > 0) return primary.trim()
    for (const entry of Object.values(locales)) {
        if (typeof entry?.content === 'string' && entry.content.trim().length > 0) return entry.content.trim()
    }
    return ''
}

/** Resolves the application schema name from the platform applications schema. */
export const resolveApplicationSchemaName = async (dbClient: EconomyDatabaseClient, applicationId: string): Promise<string> => {
    const result = await dbClient.query(
        `SELECT schema_name AS "schemaName"
         FROM applications.obj_applications
         WHERE id = $1 AND ${ACTIVE_ROW_CONDITION}`,
        [applicationId]
    )
    const schemaName = (result.rows[0] as { schemaName?: unknown } | undefined)?.schemaName
    return assertSafeIdentifier(schemaName, 'application schema')
}

export type EconomyDbStateSnapshot = {
    walletRows: number
    operations: number
    walletFacts: number
    inventoryFacts: number
    walletFactAmountSum: number
    inventoryQuantityByCode: Record<string, number>
}

export type EconomyDbStateExpectation = {
    walletRows?: number
    operations?: number
    walletFacts?: number
    inventoryFacts?: number
    walletFactAmountSum?: number
    inventoryQuantityByCode?: Record<string, number>
}

export type EconomyDbStateOptions = {
    schemaName: string
    /** Scopes every count/sum to one user (wallet `_upl_created_by`, facts' WalletKey/OwnerKey dimension). */
    userId?: string
    label?: string
}

type EconomyObjectRef = { id: string; tableSql: string }

/**
 * Reads the economy store of record through `_app_objects`/`_app_components`
 * metadata (ledger tables are `obj_<entityId>` — never hardcode table names)
 * and returns per-user counts/sums. Parameterized SQL only; identifiers are
 * quoted after strict validation.
 */
export const readEconomyDbState = async (
    dbClient: EconomyDatabaseClient,
    options: EconomyDbStateOptions
): Promise<EconomyDbStateSnapshot> => {
    const { schemaName, userId } = options
    const schemaSql = quoteDatabaseIdentifier(schemaName, 'application schema')

    const objectsResult = await dbClient.query(
        `SELECT id, table_name AS "tableName", codename
         FROM ${schemaSql}."_app_objects"
         WHERE ${ACTIVE_ROW_CONDITION}`,
        []
    )
    const objectByCodename = (codename: string, label: string): EconomyObjectRef => {
        const object = objectsResult.rows
            .map((row) => row as { id: unknown; tableName: unknown; codename: unknown })
            .find((row) => readCodenameText(row.codename) === codename)
        if (!object) {
            throw new Error(`E2E could not resolve the ${label} ("${codename}") object in schema ${schemaName}`)
        }
        return { id: String(object.id), tableSql: quoteDatabaseIdentifier(object.tableName, `${label} table`) }
    }

    const walletObject = objectByCodename(MMOOMM_ECONOMY_WALLET_CODENAME, 'Wallet entity')
    const operationObject = objectByCodename(MMOOMM_ECONOMY_OPERATION_CODENAME, 'Operation entity')
    const walletLedgerObject = objectByCodename(MMOOMM_ECONOMY_WALLET_LEDGER_CODENAME, 'WalletLedger register')
    const inventoryLedgerObject = objectByCodename(MMOOMM_ECONOMY_INVENTORY_LEDGER_CODENAME, 'InventoryLedger register')

    const columnsByObject = async (object: EconomyObjectRef, label: string): Promise<Map<string, string>> => {
        const result = await dbClient.query(
            `SELECT codename, column_name AS "columnName"
             FROM ${schemaSql}."_app_components"
             WHERE object_id = $1 AND parent_component_id IS NULL AND ${ACTIVE_ROW_CONDITION}`,
            [object.id]
        )
        const columns = new Map<string, string>()
        for (const row of result.rows as Array<{ codename: unknown; columnName: unknown }>) {
            const codenameText = readCodenameText(row.codename)
            if (codenameText.length > 0 && typeof row.columnName === 'string' && SAFE_IDENTIFIER_PATTERN.test(row.columnName)) {
                columns.set(codenameText, row.columnName)
            }
        }
        if (columns.size === 0) {
            throw new Error(`E2E could not resolve any columns for the ${label} in schema ${schemaName}`)
        }
        return columns
    }

    const requireColumn = (columns: Map<string, string>, codename: string, label: string): string =>
        quoteDatabaseIdentifier(
            columns.get(codename) ??
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

    // Wallet rows: ownership follows the runtime record creator (plan D6).
    const walletParams: unknown[] = []
    const walletOwnerClause = ownerClause('_upl_created_by', walletParams)
    const walletRowsResult = await dbClient.query(
        `SELECT COUNT(*)::int AS count
         FROM ${schemaSql}.${walletObject.tableSql}
         WHERE ${ACTIVE_ROW_CONDITION}${walletOwnerClause}`,
        walletParams
    )

    // Posted Operations only: the trade flow posts immediately, drafts never persist.
    const operationParams: unknown[] = []
    const operationOwnerClause = ownerClause('_upl_created_by', operationParams)
    const operationsResult = await dbClient.query(
        `SELECT COUNT(*)::int AS count
         FROM ${schemaSql}.${operationObject.tableSql}
         WHERE ${ACTIVE_ROW_CONDITION} AND _app_record_state = 'posted'${operationOwnerClause}`,
        operationParams
    )

    const walletLedgerColumns = await columnsByObject(walletLedgerObject, 'WalletLedger register')
    const walletKeyColumnSql = requireColumn(walletLedgerColumns, 'WalletKey', 'WalletLedger register')
    const amountColumnSql = requireColumn(walletLedgerColumns, 'Amount', 'WalletLedger register')
    const walletFactParams: unknown[] = []
    const walletFactOwnerClause = ownerClause(walletKeyColumnSql, walletFactParams)
    const walletFactsResult = await dbClient.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(${amountColumnSql}::float8), 0) AS total
         FROM ${schemaSql}.${walletLedgerObject.tableSql}
         WHERE ${ACTIVE_ROW_CONDITION}${walletFactOwnerClause}`,
        walletFactParams
    )

    const inventoryLedgerColumns = await columnsByObject(inventoryLedgerObject, 'InventoryLedger register')
    const inventoryOwnerColumnSql = requireColumn(inventoryLedgerColumns, 'OwnerKey', 'InventoryLedger register')
    const nomenclatureCodeColumnSql = requireColumn(inventoryLedgerColumns, 'NomenclatureCode', 'InventoryLedger register')
    const quantityColumnSql = requireColumn(inventoryLedgerColumns, 'Quantity', 'InventoryLedger register')
    const inventoryFactParams: unknown[] = []
    const inventoryFactOwnerClause = ownerClause(inventoryOwnerColumnSql, inventoryFactParams)
    const inventoryFactsResult = await dbClient.query(
        `SELECT COUNT(*)::int AS count
         FROM ${schemaSql}.${inventoryLedgerObject.tableSql}
         WHERE ${ACTIVE_ROW_CONDITION}${inventoryFactOwnerClause}`,
        inventoryFactParams
    )
    const inventoryQuantityResult = await dbClient.query(
        `SELECT ${nomenclatureCodeColumnSql}::text AS code, COALESCE(SUM(${quantityColumnSql}::float8), 0) AS quantity
         FROM ${schemaSql}.${inventoryLedgerObject.tableSql}
         WHERE ${ACTIVE_ROW_CONDITION}${inventoryFactOwnerClause}
         GROUP BY 1`,
        inventoryFactParams
    )

    const inventoryQuantityByCode: Record<string, number> = {}
    for (const row of inventoryQuantityResult.rows as Array<{ code: unknown; quantity: unknown }>) {
        if (typeof row.code === 'string' && row.code.length > 0) {
            inventoryQuantityByCode[row.code] = Number(row.quantity)
        }
    }

    const readCount = (row: unknown): number => Number((row as { count?: unknown } | undefined)?.count ?? 0)
    return {
        walletRows: readCount(walletRowsResult.rows[0]),
        operations: readCount(operationsResult.rows[0]),
        walletFacts: readCount(walletFactsResult.rows[0]),
        inventoryFacts: readCount(inventoryFactsResult.rows[0]),
        walletFactAmountSum: Number((walletFactsResult.rows[0] as { total?: unknown } | undefined)?.total ?? 0),
        inventoryQuantityByCode
    }
}

/** `readEconomyDbState` + expectation assertions (counts exact, sums close to 1e-6). */
export const assertEconomyDbState = async (
    dbClient: EconomyDatabaseClient,
    options: EconomyDbStateOptions & { expected: EconomyDbStateExpectation }
): Promise<EconomyDbStateSnapshot> => {
    const label = options.label ?? 'MMOOMM economy database state'
    const snapshot = await readEconomyDbState(dbClient, options)
    const { expected } = options
    if (expected.walletRows !== undefined) {
        expect(snapshot.walletRows, `${label} wallet rows`).toBe(expected.walletRows)
    }
    if (expected.operations !== undefined) {
        expect(snapshot.operations, `${label} posted Operation rows`).toBe(expected.operations)
    }
    if (expected.walletFacts !== undefined) {
        expect(snapshot.walletFacts, `${label} WalletLedger facts`).toBe(expected.walletFacts)
    }
    if (expected.inventoryFacts !== undefined) {
        expect(snapshot.inventoryFacts, `${label} InventoryLedger facts`).toBe(expected.inventoryFacts)
    }
    if (expected.walletFactAmountSum !== undefined) {
        expect(snapshot.walletFactAmountSum, `${label} WalletLedger amount sum`).toBeCloseTo(expected.walletFactAmountSum, 6)
    }
    for (const [code, quantity] of Object.entries(expected.inventoryQuantityByCode ?? {})) {
        expect(snapshot.inventoryQuantityByCode[code], `${label} InventoryLedger quantity for "${code}"`).toBeCloseTo(quantity, 6)
    }
    return snapshot
}

// ---------------------------------------------------------------------------
// Screenshots (G3 artifacts)
// ---------------------------------------------------------------------------

export type EconomyScreenshotOptions = {
    viewportName: string
    locale: string
    label?: string
}

/**
 * FlightStation market toggle driven through the DB of record (metadata-resolved table, fail-closed). */
export const setStationMarketEnabledViaDb = async (
    dbClient: EconomyDatabaseClient,
    schemaName: string,
    enabled: boolean
): Promise<void> => {
    const schemaSql = quoteDatabaseIdentifier(schemaName, 'application schema')
    const objectsResult = await dbClient.query(
        `SELECT id, table_name AS "tableName", codename
         FROM ${schemaSql}."_app_objects"
         WHERE ${ACTIVE_ROW_CONDITION}`,
        []
    )
    const station = objectsResult.rows
        .map((row) => row as { id: unknown; tableName: unknown; codename: unknown })
        .find((row) => readCodenameText(row.codename) === MMOOMM_ECONOMY_STATION_CODENAME)
    if (!station) {
        throw new Error(`E2E could not resolve the FlightStation object in schema ${schemaName}`)
    }
    const tableSql = quoteDatabaseIdentifier(station.tableName, 'FlightStation table')
    // Component columns are physical `cmp_<fieldId>` columns — resolve the
    // MarketEnabled column through _app_components exactly like the backend
    // service does (findRuntimeAttrByFieldKey over component metadata).
    const columnsResult = await dbClient.query(
        `SELECT codename, column_name AS "columnName"
         FROM ${schemaSql}."_app_components"
         WHERE object_id = $1 AND parent_component_id IS NULL AND ${ACTIVE_ROW_CONDITION}`,
        [station.id]
    )
    const marketColumn = (columnsResult.rows as Array<{ codename: unknown; columnName: unknown }>).find(
        (row) => readCodenameText(row.codename) === 'MarketEnabled'
    )
    if (!marketColumn || typeof marketColumn.columnName !== 'string' || !SAFE_IDENTIFIER_PATTERN.test(marketColumn.columnName)) {
        throw new Error(`E2E could not resolve the MarketEnabled column of FlightStation in schema ${schemaName}`)
    }
    const marketColumnSql = quoteDatabaseIdentifier(marketColumn.columnName, 'MarketEnabled column')
    const updated = await dbClient.query(
        `UPDATE ${schemaSql}.${tableSql} SET ${marketColumnSql} = $1 WHERE ${ACTIVE_ROW_CONDITION} RETURNING id`,
        [enabled]
    )
    if ((updated.rowCount ?? 0) < 1) {
        throw new Error(`E2E failed to set MarketEnabled=${enabled}: no active FlightStation rows were updated`)
    }
}

/**
 * Auto-verifies a captured PNG is a real, non-blank image (QA M8): the IHDR
 * header must parse and the inflated pixel data must carry visual variety — a
 * blank/solid screenshot compresses to near-uniform bytes. Pure Node, no
 * image-library dependency.
 */
export const assertPngHasVisibleContent = (path: string, options: { minDistinctBytes?: number } = {}): void => {
    const buffer = readFileSync(path)
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) {
        throw new Error(`${path} is not a PNG file`)
    }
    // First chunk layout: length (4B) at offset 8, type 'IHDR' at 12, then the
    // IHDR payload with width (4B BE) at 16 and height at 20.
    if (buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') {
        throw new Error(`${path} has no IHDR header`)
    }
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)
    if (width < 1 || height < 1) {
        throw new Error(`${path} has invalid dimensions ${width}x${height}`)
    }

    const idatChunks: Buffer[] = []
    let offset = 8
    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset)
        const type = buffer.toString('ascii', offset + 4, offset + 8)
        if (type === 'IDAT') idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length))
        offset += 12 + length
        if (type === 'IEND') break
    }
    if (idatChunks.length === 0) {
        throw new Error(`${path} carries no IDAT pixel data`)
    }
    const raw = inflateSync(Buffer.concat(idatChunks))
    const distinct = new Set(raw.subarray(0, Math.min(raw.length, 262_144))).size
    // The dialog capture is content-rich; the full flight-page capture is
    // dominated by the near-uniform canvas gradient (few byte values even when
    // healthy), so it gets a lower floor. A genuinely broken capture sits at 2-4.
    const minDistinctBytes = options.minDistinctBytes ?? 32
    if (distinct < minDistinctBytes) {
        throw new Error(`${path} looks blank (only ${distinct} distinct pixel byte values)`)
    }
}

export const collectEconomyScreenshots = async (
    page: Page,
    testInfo: TestInfo,
    options: EconomyScreenshotOptions
): Promise<{ panelPath: string; pagePath: string }> => {
    const label = options.label ?? 'MMOOMM economy panel'
    // The economy UI lives in a canonical strict-modal dialog opened from the
    // canvas toolbar (QA 2026-11-16 UX redesign) — reachable at every viewport,
    // so the old mobile context-panel drawer dance is retired. A single
    // instance exists, so the locator needs no visible filter.
    await openEconomyDialog(page, label)
    const panel = page.getByTestId('economy-panel')
    await expect(panel, `${label} must be visible before screenshots`).toBeVisible({ timeout: MMOOMM_ECONOMY_PANEL_TIMEOUT })
    // Capture the whole dialog (title bar + standard insets + Close action), not
    // just the inner content stack — the docs asset must show the canonical
    // dialog chrome the user actually sees.
    const dialog = page.getByRole('dialog')

    const suffix = `${options.viewportName}-${options.locale}`
    const panelPath = testInfo.outputPath(`mmoomm-economy-panel-${suffix}.png`)
    await dialog.screenshot({ path: panelPath })
    // QA M8: captured evidence is auto-verified to be real, non-blank content.
    assertPngHasVisibleContent(panelPath)
    await testInfo.attach(`mmoomm-economy-panel-${suffix}`, { path: panelPath, contentType: 'image/png' })

    // Close the dialog so the full-page screenshot and the overflow check
    // observe the runtime page itself, not the open overlay.
    await closeEconomyDialog(page, label)

    const pagePath = testInfo.outputPath(`mmoomm-economy-page-${suffix}.png`)
    await page.screenshot({ path: pagePath, fullPage: true })
    assertPngHasVisibleContent(pagePath, { minDistinctBytes: 8 })
    await testInfo.attach(`mmoomm-economy-page-${suffix}`, { path: pagePath, contentType: 'image/png' })

    return { panelPath, pagePath }
}
