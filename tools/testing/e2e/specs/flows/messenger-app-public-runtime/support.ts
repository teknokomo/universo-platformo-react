import path from 'node:path'
import type { Page, Request, Response } from '@playwright/test'
import { qSchemaTable } from '@universo-react/database'
import { isUuidV7 } from '@universo-react/utils'
import { publicMessengerApplicationRuntimeSchema } from '@universo-react/types'
import { expect } from '../../../fixtures/test'
import { createLoggedInApiContext, sendWithCsrf } from '../../../support/backend/api-session.mjs'
import { withE2eDatabaseClient } from '../../../support/backend/e2eDatabase.mjs'
import { readPageResponseSnapshot } from '../../../support/browser/network'
import {
    assertRuntimeMutationActionsUnavailable,
    expectNoClippedTextContent,
    expectNoTechnicalLeakage
} from '../../../support/browser/runtimeUx'
import { repoRoot } from '../../../support/env/load-e2e-env.mjs'
import { toolbarSelectors } from '../../../support/selectors/contracts'

export const canonicalFixturePath = path.resolve(repoRoot, 'tools/fixtures/metahubs-messenger-app-snapshot.json')

export type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
export type PublicMessengerRuntimeResponse = ReturnType<typeof publicMessengerApplicationRuntimeSchema.parse>
export type PublicDetailsTablePlacement = Extract<
    PublicMessengerRuntimeResponse['messengerApp']['placements'][number],
    { widgetKey: 'detailsTable' }
>
export type MessengerBotBinding = {
    id: string
    platform: 'telegram' | 'max'
    botUsername: string
    status: string
    shortId: string
    version: number
}

export const sameOriginApiResponseMatcher = (page: Page, method: string, pathname: string) => {
    const currentOrigin = new URL(page.url()).origin
    const expectedOrigin =
        currentOrigin !== 'null' ? currentOrigin : process.env.E2E_BASE_URL ? new URL(process.env.E2E_BASE_URL).origin : null
    return (response: Response): boolean => {
        if (!expectedOrigin) return false
        let request: Request | null = response.request()
        while (request) {
            try {
                const requestUrl = new URL(request.url())
                if (request.method() === method && requestUrl.origin === expectedOrigin && requestUrl.pathname === pathname) return true
            } catch {
                // Ignore malformed redirect-chain entries and continue to the initiating request.
            }
            request = request.redirectedFrom()
        }
        return false
    }
}

type CapturedBrowserJson = { requestId: string; method: string; requestPathname: string; status: number; payload: unknown }
type ExpectedBrowserJsonCapture = { id: string; method: string; pathname: string; requestIds: string[] }
type CapturedXhrRequest = { method: string; origin: string; pathname: string; requestId?: string }
type MessengerCaptureXhr = XMLHttpRequest & { __messengerE2eRequest?: CapturedXhrRequest }
type ResponseCaptureWindow = Window & {
    __messengerE2eJsonResponses?: CapturedBrowserJson[]
    __messengerE2eCaptureInstalled?: boolean
    __messengerE2eExpectedResponses?: ExpectedBrowserJsonCapture[]
    __messengerE2eRequestSequence?: number
}

const RESPONSE_CAPTURE_ID_HEADER = 'x-universo-e2e-capture-id'
const responseCapturePages = new WeakSet<Page>()
const activeResponseCaptureKeys = new WeakMap<Page, Set<string>>()
let responseCaptureTargetSequence = 0

const responseCaptureId = (response: Response): string | undefined => {
    let request: Request | null = response.request()
    while (request) {
        const requestId = request.headers()[RESPONSE_CAPTURE_ID_HEADER]
        if (requestId) return requestId
        request = request.redirectedFrom()
    }
    return undefined
}

const installBrowserJsonResponseCapture = async (page: Page, initialTarget: ExpectedBrowserJsonCapture): Promise<void> => {
    if (responseCapturePages.has(page)) return

    const installResponseCapture = (initialTarget: ExpectedBrowserJsonCapture) => {
        const captureWindow = window as ResponseCaptureWindow
        const targetStorageKey = '__messengerE2eExpectedResponses'
        captureWindow.__messengerE2eJsonResponses = []
        try {
            const storedTarget = window.sessionStorage.getItem(targetStorageKey)
            const parsedTargets: unknown = storedTarget === null ? [initialTarget] : JSON.parse(storedTarget)
            captureWindow.__messengerE2eExpectedResponses = Array.isArray(parsedTargets)
                ? (parsedTargets as ExpectedBrowserJsonCapture[])
                : []
            if (storedTarget === null) window.sessionStorage.setItem(targetStorageKey, JSON.stringify([initialTarget]))
        } catch {
            captureWindow.__messengerE2eExpectedResponses = [initialTarget]
        }
        if (captureWindow.__messengerE2eCaptureInstalled) return
        captureWindow.__messengerE2eCaptureInstalled = true

        const persistExpectedTargets = () => {
            try {
                window.sessionStorage.setItem(targetStorageKey, JSON.stringify(captureWindow.__messengerE2eExpectedResponses ?? []))
            } catch {
                // The current document keeps its in-memory capture targets when session storage is unavailable.
            }
        }

        const matchesExpectedRequest = (requestMethod: string, requestUrl: URL): boolean => {
            return (
                requestUrl.origin === window.location.origin &&
                (captureWindow.__messengerE2eExpectedResponses ?? []).some(
                    (expected) => requestMethod === expected.method && requestUrl.pathname === expected.pathname
                )
            )
        }

        const recordExpectedRequest = (requestMethod: string, requestUrl: URL, requestId: string): void => {
            const targets = captureWindow.__messengerE2eExpectedResponses ?? []
            let changed = false
            captureWindow.__messengerE2eExpectedResponses = targets.map((target) => {
                if (
                    requestMethod !== target.method ||
                    requestUrl.origin !== window.location.origin ||
                    requestUrl.pathname !== target.pathname
                ) {
                    return target
                }
                changed = true
                return { ...target, requestIds: [...target.requestIds, requestId] }
            })
            if (changed) persistExpectedTargets()
        }

        const nextRequestId = (): string => {
            const sequenceStorageKey = '__messengerE2eRequestSequence'
            let currentSequence = captureWindow.__messengerE2eRequestSequence ?? 0
            try {
                const storedSequence = Number(window.sessionStorage.getItem(sequenceStorageKey) ?? '0')
                if (Number.isSafeInteger(storedSequence)) currentSequence = Math.max(currentSequence, storedSequence)
            } catch {
                // The in-memory sequence remains unique for the current document when session storage is unavailable.
            }
            captureWindow.__messengerE2eRequestSequence = currentSequence + 1
            try {
                window.sessionStorage.setItem(sequenceStorageKey, String(captureWindow.__messengerE2eRequestSequence))
            } catch {
                // The request can still be correlated within the current document without session storage.
            }
            return `messenger-e2e-${captureWindow.__messengerE2eRequestSequence}`
        }

        const recordJsonResponse = (
            requestId: string,
            requestMethod: string,
            requestUrl: URL,
            responseUrl: URL,
            status: number,
            payload: unknown
        ) => {
            if (!matchesExpectedRequest(requestMethod, requestUrl) || responseUrl.origin !== window.location.origin) return
            captureWindow.__messengerE2eJsonResponses?.push({
                requestId,
                method: requestMethod,
                requestPathname: requestUrl.pathname,
                status,
                payload
            })
        }

        const originalFetch = window.fetch.bind(window)
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const requestUrl = new URL(input instanceof Request ? input.url : String(input), window.location.href)
            const requestMethod = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
            if (!matchesExpectedRequest(requestMethod, requestUrl)) return originalFetch(input, init)

            const requestId = nextRequestId()
            recordExpectedRequest(requestMethod, requestUrl, requestId)
            const headers = new Headers(input instanceof Request ? input.headers : undefined)
            if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value))
            headers.set('x-universo-e2e-capture-id', requestId)
            const response = await originalFetch(input, { ...init, headers })
            if (response.headers.get('content-type')?.toLowerCase().includes('json')) {
                try {
                    const payload: unknown = await response.clone().json()
                    const responseUrl = new URL(response.url || requestUrl.href, window.location.href)
                    recordJsonResponse(requestId, requestMethod, requestUrl, responseUrl, response.status, payload)
                } catch {
                    // A non-JSON error response must not interfere with the application fetch.
                }
            }
            return response
        }

        const originalXhrOpen = XMLHttpRequest.prototype.open
        XMLHttpRequest.prototype.open = function (...args: Parameters<XMLHttpRequest['open']>) {
            const requestUrl = new URL(String(args[1]), window.location.href)
            ;(this as MessengerCaptureXhr).__messengerE2eRequest = {
                method: String(args[0]).toUpperCase(),
                origin: requestUrl.origin,
                pathname: requestUrl.pathname
            }
            return originalXhrOpen.apply(this, args)
        }

        const originalXhrSend = XMLHttpRequest.prototype.send
        XMLHttpRequest.prototype.send = function (...args: Parameters<XMLHttpRequest['send']>) {
            const xhr = this as MessengerCaptureXhr
            const request = xhr.__messengerE2eRequest
            if (request && matchesExpectedRequest(request.method, new URL(`${request.origin}${request.pathname}`))) {
                const requestId = nextRequestId()
                request.requestId = requestId
                recordExpectedRequest(request.method, new URL(`${request.origin}${request.pathname}`), requestId)
                xhr.setRequestHeader('x-universo-e2e-capture-id', requestId)
            }
            xhr.addEventListener(
                'loadend',
                () => {
                    const completedRequest = xhr.__messengerE2eRequest
                    if (!completedRequest?.requestId) return
                    if (!xhr.getResponseHeader('content-type')?.toLowerCase().includes('json')) return

                    try {
                        const responseUrl = new URL(
                            xhr.responseURL || `${completedRequest.origin}${completedRequest.pathname}`,
                            window.location.href
                        )
                        const payload: unknown = xhr.responseType === 'json' ? xhr.response : JSON.parse(xhr.responseText)
                        recordJsonResponse(
                            completedRequest.requestId,
                            completedRequest.method,
                            new URL(`${completedRequest.origin}${completedRequest.pathname}`),
                            responseUrl,
                            xhr.status,
                            payload
                        )
                    } catch {
                        // A non-JSON or unavailable XHR response must not interfere with the application request.
                    }
                },
                { once: true }
            )
            return originalXhrSend.apply(this, args)
        }
    }
    await page.addInitScript(installResponseCapture, initialTarget)
    await page.evaluate(installResponseCapture, initialTarget).catch(() => undefined)
    responseCapturePages.add(page)
}

const captureBrowserJsonResponseForTarget = async <T>(
    page: Page,
    method: string,
    pathname: string,
    target: ExpectedBrowserJsonCapture,
    matcher: (response: Response) => boolean,
    trigger: () => Promise<unknown>
): Promise<{ response: Response; payload: T }> => {
    await installBrowserJsonResponseCapture(page, target)

    let response: Response | null = null
    let requestId: string | undefined
    let captured: CapturedBrowserJson | null = null
    try {
        const targetPersisted = await page.evaluate((expectedTarget) => {
            const captureWindow = window as ResponseCaptureWindow
            const targetStorageKey = '__messengerE2eExpectedResponses'
            const currentTargets = captureWindow.__messengerE2eExpectedResponses ?? []
            const nextTargets = [
                ...currentTargets.filter(({ id }) => id !== expectedTarget.id),
                { ...expectedTarget, requestIds: [...expectedTarget.requestIds] }
            ]
            captureWindow.__messengerE2eExpectedResponses = nextTargets
            try {
                window.sessionStorage.setItem(targetStorageKey, JSON.stringify(nextTargets))
                return true
            } catch {
                return false
            }
        }, target)
        if (!targetPersisted) {
            throw new Error(`Browser response capture requires sessionStorage to preserve ${method} ${pathname} across navigation`)
        }
        const [browserResponse] = await Promise.all([
            page.waitForResponse((candidate) => {
                if (candidate.status() >= 300 && candidate.status() < 400) return false
                return matcher(candidate) && Boolean(responseCaptureId(candidate))
            }),
            trigger()
        ])
        response = browserResponse
        requestId = responseCaptureId(response)
        expect(requestId, `The browser request for ${method} ${pathname} must receive a unique test correlation ID`).toBeTruthy()
        if (!requestId) throw new Error(`The browser request for ${method} ${pathname} has no test correlation ID`)

        await page.waitForFunction(
            ({ expectedRequestId, expectedMethod, expectedPath, expectedStatus }) =>
                ((window as ResponseCaptureWindow).__messengerE2eJsonResponses ?? []).some(
                    ({ requestId: capturedRequestId, method: capturedMethod, requestPathname, status }) =>
                        capturedRequestId === expectedRequestId &&
                        capturedMethod === expectedMethod &&
                        requestPathname === expectedPath &&
                        status === expectedStatus
                ),
            {
                expectedRequestId: requestId,
                expectedMethod: method.toUpperCase(),
                expectedPath: pathname,
                expectedStatus: response.status()
            },
            { timeout: 15_000 }
        )
        captured = await page.evaluate(
            ({ expectedRequestId, expectedMethod, expectedPath, expectedStatus }) =>
                ((window as ResponseCaptureWindow).__messengerE2eJsonResponses ?? []).findLast(
                    ({ requestId: capturedRequestId, method: capturedMethod, requestPathname, status }) =>
                        capturedRequestId === expectedRequestId &&
                        capturedMethod === expectedMethod &&
                        requestPathname === expectedPath &&
                        status === expectedStatus
                ) ?? null,
            {
                expectedRequestId: requestId,
                expectedMethod: method.toUpperCase(),
                expectedPath: pathname,
                expectedStatus: response.status()
            }
        )
    } finally {
        await page
            .evaluate(
                ({ targetId, capturedRequestId }) => {
                    const captureWindow = window as ResponseCaptureWindow
                    const expectedTarget = (captureWindow.__messengerE2eExpectedResponses ?? []).find(({ id }) => id === targetId)
                    const requestIds = new Set([...(expectedTarget?.requestIds ?? []), ...(capturedRequestId ? [capturedRequestId] : [])])
                    const nextTargets = (captureWindow.__messengerE2eExpectedResponses ?? []).filter(({ id }) => id !== targetId)
                    captureWindow.__messengerE2eExpectedResponses = nextTargets
                    captureWindow.__messengerE2eJsonResponses = (captureWindow.__messengerE2eJsonResponses ?? []).filter(
                        ({ requestId: candidateRequestId }) => !requestIds.has(candidateRequestId)
                    )
                    try {
                        window.sessionStorage.setItem('__messengerE2eExpectedResponses', JSON.stringify(nextTargets))
                    } catch {
                        // The in-memory target is cleared even when session storage is unavailable.
                    }
                },
                { targetId: target.id, capturedRequestId: requestId }
            )
            .catch(() => undefined)
    }
    if (!response) throw new Error(`No browser response was captured for ${method} ${pathname}`)
    expect(captured, `The browser fetch body for ${pathname} must be captured`).not.toBeNull()
    return { response, payload: captured?.payload as T }
}

export const captureBrowserJsonResponse = async <T>(
    page: Page,
    method: string,
    pathname: string,
    trigger: () => Promise<unknown>
): Promise<{ response: Response; payload: T }> => {
    const normalizedMethod = method.toUpperCase()
    const captureKey = `${normalizedMethod} ${pathname}`
    const activeKeys = activeResponseCaptureKeys.get(page) ?? new Set<string>()
    if (activeKeys.has(captureKey)) {
        throw new Error(`A JSON response capture for ${captureKey} is already active on this page; run same-route captures sequentially`)
    }
    activeKeys.add(captureKey)
    activeResponseCaptureKeys.set(page, activeKeys)

    const target: ExpectedBrowserJsonCapture = {
        id: `messenger-e2e-capture-${++responseCaptureTargetSequence}`,
        method: normalizedMethod,
        pathname,
        requestIds: []
    }
    try {
        return await captureBrowserJsonResponseForTarget<T>(
            page,
            normalizedMethod,
            pathname,
            target,
            sameOriginApiResponseMatcher(page, normalizedMethod, pathname),
            trigger
        )
    } finally {
        activeKeys.delete(captureKey)
        if (activeKeys.size === 0) activeResponseCaptureKeys.delete(page)
    }
}

const PRIVATE_PUBLIC_RUNTIME_FIELD_NAMES = new Set([
    'user',
    'userid',
    'useremail',
    'member',
    'memberid',
    'memberemail',
    'owner',
    'ownerid',
    'owneremail',
    'actor',
    'actorid',
    'actoremail',
    'email',
    'createdby',
    'createdbyuserid',
    'updatedby',
    'updatedbyuserid',
    'admin',
    'isadmin',
    'canedit',
    'canmanage',
    'permissions'
])

const collectPrivatePublicRuntimeFieldPaths = (value: unknown, path = 'response'): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) => collectPrivatePublicRuntimeFieldPaths(item, `${path}[${index}]`))
    }
    if (typeof value !== 'object' || value === null) return []

    return Object.entries(value).flatMap(([key, item]) => {
        const normalizedKey = key.replace(/[-_]/gu, '').toLowerCase()
        const currentPath = `${path}.${key}`
        return [
            ...(PRIVATE_PUBLIC_RUNTIME_FIELD_NAMES.has(normalizedKey) ? [currentPath] : []),
            ...collectPrivatePublicRuntimeFieldPaths(item, currentPath)
        ]
    })
}

export const assertNoPublicUserIdentityLeak = (value: unknown, userIds: string[], userEmails: string[], label: string): void => {
    const serialized = JSON.stringify(value)
    expect(serialized, `${label} must not contain a user email`).not.toMatch(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u)
    expect(serialized, `${label} must not contain a UUID or other runtime identity`).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu
    )
    for (const userId of userIds) {
        expect(serialized, `${label} must not expose test user ${userId}`).not.toContain(userId)
    }
    for (const userEmail of userEmails) {
        expect(serialized, `${label} must not expose ${userEmail}`).not.toContain(userEmail)
    }
    expect(collectPrivatePublicRuntimeFieldPaths(value), `${label} must not expose identity or admin-only fields`).toEqual([])
}

export const assertNoAdministrativeRuntimeControls = async (page: Page, label: string): Promise<void> => {
    const adminOnlyActionNames = await page
        .getByRole('button')
        .evaluateAll((buttons) =>
            buttons
                .map((button) => button.getAttribute('aria-label') ?? (button as HTMLButtonElement).innerText.trim())
                .filter((name) => /^(?:manage members|settings|участники|настройки)$/iu.test(name))
        )
    expect(adminOnlyActionNames, `${label} must not expose application administration actions`).toEqual([])

    await expect(page.locator('[data-testid^="grid-row-actions-trigger-"]'), `${label} must not expose row mutation menus`).toHaveCount(0)

    const administrationLinks = await page
        .getByRole('link')
        .evaluateAll((links) =>
            links
                .map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? '')
                .filter((href) => /\/(?:admin|metahub)(?:\/|$)/iu.test(href))
        )
    expect(administrationLinks, `${label} must not expose administration routes`).toEqual([])
}

export const assertPublicRuntimeSurfaceIsReadOnly = async (
    page: Page,
    userIds: string[],
    userEmails: string[],
    label: string
): Promise<void> => {
    const main = page.getByRole('main')
    await expectNoTechnicalLeakage(main, { label, checkUuidSubstrings: true, checkOpaqueRuntimeHandles: true })
    await expectNoClippedTextContent(main, { label })
    await assertRuntimeMutationActionsUnavailable(page, label)
    assertNoPublicUserIdentityLeak(await page.locator('body').innerText(), userIds, userEmails, `${label} visible surface`)
    await assertNoAdministrativeRuntimeControls(page, label)
}

export const makeAliasToken = (runId: string, retry: number): string => {
    const token = `${runId}-retry-${retry}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '')
        .slice(-44)
    return token || 'playwright'
}

export const resolveFixturePath = async (): Promise<string> => {
    if (process.env.MESSENGER_APP_FIXTURE_PATH) return path.resolve(repoRoot, process.env.MESSENGER_APP_FIXTURE_PATH)
    return canonicalFixturePath
}

export const inspectPublicRuntimeMaterialization = async (applicationId: string, alias: string) =>
    withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `
            SELECT
                schema_name,
                schema_status::text AS schema_status,
                is_public,
                workspaces_enabled,
                _app_published,
                _app_archived,
                _app_deleted,
                _upl_archived,
                _upl_deleted,
                installed_release_metadata,
                last_synced_publication_version_id
            FROM applications.obj_applications
            WHERE id = $1
            `,
            [applicationId]
        )
        const application = applicationResult.rows[0] as
            | {
                  schema_name: string | null
                  schema_status: string | null
                  is_public: boolean
                  workspaces_enabled: boolean
                  _app_published: boolean
                  _app_archived: boolean
                  _app_deleted: boolean
                  _upl_archived: boolean
                  _upl_deleted: boolean
                  installed_release_metadata: Record<string, unknown> | null
                  last_synced_publication_version_id: string | null
              }
            | undefined
        if (!application?.schema_name) return { application, materialization: null, aliases: [], layouts: [], widgets: [] }

        const metadata = application.installed_release_metadata
        const metadataRecord = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : null
        const nullableUuidState = (value: unknown): { valid: boolean; value: string | null } => {
            if (value === null || value === undefined) return { valid: true, value: null }
            if (typeof value !== 'string' || !isUuidV7(value)) return { valid: false, value: null }
            return { valid: true, value }
        }
        const publicationId = nullableUuidState(metadataRecord?.publicationId)
        const publicationVersionId = nullableUuidState(metadataRecord?.publicationVersionId)
        const lastSyncedPublicationVersionId = nullableUuidState(application.last_synced_publication_version_id)
        const materialization = {
            metadataRecordValid: metadataRecord !== null,
            kindValid: metadataRecord?.kind === 'application_release_installation',
            bundleVersionValid: metadataRecord?.bundleVersion === 1,
            sourceKindValid: metadataRecord?.sourceKind === 'publication',
            snapshotHashValid: typeof metadataRecord?.snapshotHash === 'string' && /^[0-9a-f]{64}$/iu.test(metadataRecord.snapshotHash),
            publicationIdValid: publicationId.valid,
            publicationVersionIdValid: publicationVersionId.valid,
            lastSyncedPublicationVersionIdValid: lastSyncedPublicationVersionId.valid,
            publicationIdPairValid: Boolean(publicationId.value) === Boolean(publicationVersionId.value),
            publicationLineagePresent: Boolean(publicationId.value && publicationVersionId.value),
            publicationVersionMatches:
                publicationVersionId.value !== null && publicationVersionId.value === lastSyncedPublicationVersionId.value
        }

        const [aliasResult, layoutResult, widgetResult] = await Promise.all([
            client.query(
                `
                SELECT alias, is_primary
                FROM applications.obj_application_aliases
                WHERE application_id = $1
                  AND alias = $2
                  AND released_at IS NULL
                  AND _upl_deleted = false
                  AND _app_deleted = false
                  AND _upl_archived = false
                  AND _app_archived = false
                ORDER BY is_primary DESC, alias ASC
                `,
                [applicationId, alias]
            ),
            client.query(
                `
                SELECT template_key, is_active, is_default, _app_published
                FROM ${qSchemaTable(application.schema_name, '_app_layouts')}
                ORDER BY template_key ASC, is_default DESC, id ASC
                `
            ),
            client.query(
                `
                SELECT w.widget_key, w.is_active, w._app_published
                FROM ${qSchemaTable(application.schema_name, '_app_widgets')} w
                INNER JOIN ${qSchemaTable(application.schema_name, '_app_layouts')} l ON l.id = w.layout_id
                WHERE l.template_key = 'messenger-app'
                ORDER BY w.widget_key ASC, w.id ASC
                `
            )
        ])

        return {
            application,
            materialization,
            aliases: aliasResult.rows.map(({ alias, is_primary }) => ({ alias, is_primary })),
            layouts: layoutResult.rows.map(({ template_key, is_active, is_default, _app_published }) => ({
                template_key,
                is_active,
                is_default,
                _app_published
            })),
            widgets: widgetResult.rows.map(({ widget_key, is_active, _app_published }) => ({ widget_key, is_active, _app_published }))
        }
    })

export const listMessengerBotBindings = async (api: ApiContext, applicationId: string): Promise<MessengerBotBinding[]> => {
    const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')
    const response = await fetch(new URL(`/api/v1/applications/${applicationId}/bot-bindings`, api.baseURL as string), {
        headers: cookieHeader ? { Cookie: cookieHeader } : {}
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { items?: MessengerBotBinding[] }
    return body.items ?? []
}

export const importFixtureThroughUi = async (page: Page, fixturePath: string): Promise<{ metahubId: string; publicationId: string }> => {
    await page.goto('/metahubs')
    const language = await page.evaluate(() => window.localStorage.getItem('i18nextLng')?.toLowerCase() ?? 'en')
    const importLabel = language.startsWith('ru') ? 'Импорт конфигурации' : 'Import Configuration'
    const primaryAction = page.getByTestId(toolbarSelectors.primaryAction)
    await expect(primaryAction).toBeVisible({ timeout: 30_000 })
    await page.getByTestId(`${toolbarSelectors.primaryAction}-menu-trigger`).click()

    const importOption = page.getByRole('menuitem', { name: importLabel, exact: true })
    await expect(importOption).toHaveCount(1)
    await expect(importOption).toBeVisible()
    await importOption.click()

    const dialog = page.getByRole('dialog', { name: importLabel, exact: true })
    await expect(dialog).toBeVisible()
    await dialog.locator('input[type="file"]').setInputFiles(fixturePath)
    await expect(dialog.getByText(path.basename(fixturePath), { exact: true })).toBeVisible()

    const responsePromise = page
        .waitForResponse(sameOriginApiResponseMatcher(page, 'POST', '/api/v1/metahubs/import'), { timeout: 420_000 })
        .then(readPageResponseSnapshot)
    const confirmImport = dialog.getByRole('button', { name: importLabel, exact: true })
    await expect(confirmImport).toHaveCount(1)
    await confirmImport.click()
    const response = await responsePromise
    expect(response.status).toBe(201)

    const body = JSON.parse(response.body) as { metahub?: { id?: unknown }; publication?: { id?: unknown } }
    const metahubId = body.metahub?.id
    const publicationId = body.publication?.id
    expect(typeof metahubId).toBe('string')
    expect(typeof publicationId).toBe('string')
    await expect(dialog).toHaveCount(0)
    return { metahubId: metahubId as string, publicationId: publicationId as string }
}

export const readAnonymousRuntime = async (page: Page, url: string): Promise<PublicMessengerRuntimeResponse> => {
    const targetUrl = new URL(url, page.url())
    const applicationRef = targetUrl.pathname.match(/^\/a\/([^/]+)$/u)?.[1]
    if (!applicationRef) throw new Error(`Expected a Messenger application route, received ${targetUrl.pathname}`)
    const runtimePath = `/api/v1/public/applications/${applicationRef}/runtime`
    const { response, payload: rawPayload } = await captureBrowserJsonResponse<unknown>(page, 'GET', runtimePath, () =>
        page.goto(url, { timeout: 60_000 })
    )
    expect(response.status(), `Public Messenger runtime probe failed for ${url}`).toBe(200)
    const payload = publicMessengerApplicationRuntimeSchema.parse(rawPayload)
    expect(payload.templateKey).toBe('messenger-app')
    expect(JSON.stringify(payload)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu)
    return payload
}

export const createActiveMessengerBinding = async (
    api: ApiContext,
    applicationId: string,
    platform: MessengerBotBinding['platform'],
    botUsername: string
): Promise<MessengerBotBinding> => {
    const createResponse = await sendWithCsrf(api, 'POST', `/api/v1/applications/${applicationId}/bot-bindings`, {
        platform,
        botUsername
    })
    expect(createResponse.status).toBe(201)
    const created = (await createResponse.json()) as MessengerBotBinding
    expect(created.id).toEqual(expect.any(String))
    expect(created.shortId).toMatch(/^[A-Za-z0-9_-]{22}$/u)

    const activateResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}/bot-bindings/${created.id}`, {
        status: 'active',
        expectedVersion: created.version
    })
    expect(activateResponse.status).toBe(200)
    const active = (await activateResponse.json()) as MessengerBotBinding
    expect(active.status).toBe('active')
    return active
}
