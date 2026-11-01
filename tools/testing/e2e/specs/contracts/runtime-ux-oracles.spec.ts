import type { Route } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { captureBrowserJsonResponse } from '../flows/messenger-app-public-runtime/support'
import {
    assertRuntimeMutationActionsUnavailable,
    expectNoClippedTextContent,
    expectLocalizedValidation,
    expectNoDataGridTechnicalLeakage,
    expectNoTechnicalLeakage,
    expectSemanticFieldControls
} from '../../support/browser/runtimeUx'
import { waitForSettledMutationResponse } from '../../support/browser/network'

const RESPONSE_CAPTURE_ID_HEADER = 'x-universo-e2e-capture-id'

test('runtime UX oracles inspect visible control values and compact structured cells', async ({ page }) => {
    const exposedId = '0190a9b5-3cde-7abc-8def-0123456789a2'
    const exposedRuntimeHandle = `rh1.${'A'.repeat(32)}`
    await page.setContent(`
      <main>
        <section data-testid="visible-id-surface">
          <label for="record-ref">Record</label>
          <input id="record-ref" value="${exposedId}" />
        </section>
        <section data-testid="hidden-id-surface" hidden>
          <input value="${exposedId}" />
        </section>
        <section data-testid="accessible-name-surface">
          <button aria-label="Open record ${exposedId}">Open record</button>
        </section>
        <section data-testid="runtime-handle-surface">${exposedRuntimeHandle}</section>
        <section data-testid="image-alt-surface">
          <img alt="Preview of record ${exposedId}" src="/preview.png" />
        </section>
        <section data-testid="title-surface">
          <button title="Open record ${exposedId}">Open record</button>
        </section>
        <section data-testid="structured-grid">
          <div class="MuiDataGrid-root">
            <div class="MuiDataGrid-virtualScroller">
              <div role="row"><div role="gridcell">{"src":"/internal/assets/hero.png","alt":"raw media payload"}</div></div>
            </div>
          </div>
        </section>
        <section data-testid="localized-validation-surface">
          <p class="MuiFormHelperText-root Mui-error">This field is required.</p>
        </section>
        <section data-testid="unknown-english-russian-validation">
          <p role="alert">Title already exists.</p>
        </section>
        <section data-testid="valid-russian-validation">
          <p role="alert">Заполните обязательное поле.</p>
        </section>
        <section data-testid="russian-english-validation">
          <p role="alert">Заполните обязательное поле.</p>
        </section>
        <section data-testid="valid-english-validation">
          <p role="alert">Please complete this field.</p>
        </section>
        <section data-testid="localized-description-controls">
          <label>English Description<textarea></textarea></label>
          <label>Russian Description<input /></label>
        </section>
      </main>
    `)

    await expect(
        expectNoTechnicalLeakage(page.getByTestId('visible-id-surface'), {
            label: 'Visible record reference field',
            checkUuidSubstrings: true
        })
    ).rejects.toThrow('visible raw UUID value')

    await expect(
        expectNoTechnicalLeakage(page.getByTestId('runtime-handle-surface'), {
            label: 'Visible opaque runtime record handle',
            checkOpaqueRuntimeHandles: true
        })
    ).rejects.toThrow('visible opaque runtime record handle')

    await expect(
        expectNoTechnicalLeakage(page.getByTestId('image-alt-surface'), {
            label: 'Visible image alternative text',
            checkUuidSubstrings: true
        })
    ).rejects.toThrow('visible raw UUID value')

    await expect(
        expectNoTechnicalLeakage(page.getByTestId('title-surface'), {
            label: 'Visible control tooltip',
            checkUuidSubstrings: true
        })
    ).rejects.toThrow('visible raw UUID value')

    await expectNoTechnicalLeakage(page.getByTestId('hidden-id-surface'), {
        label: 'Hidden record reference field',
        checkUuidSubstrings: true
    })

    await expect(
        expectNoTechnicalLeakage(page.getByTestId('accessible-name-surface'), {
            label: 'Visible accessible name',
            checkUuidSubstrings: true
        })
    ).rejects.toThrow('visible raw UUID value')

    await expect(
        expectNoDataGridTechnicalLeakage(page.getByTestId('structured-grid'), {
            label: 'Compact structured action cell',
            requireVisibleGrid: false
        })
    ).rejects.toThrow('visible raw JSON/object text')

    await expect(
        expectLocalizedValidation(page.getByTestId('localized-validation-surface'), 'ru', { label: 'Russian required-field fallback' })
    ).rejects.toThrow('must not expose internal validation text for ru')
    await expect(
        expectLocalizedValidation(page.getByTestId('unknown-english-russian-validation'), 'ru', {
            label: 'Unknown English error in Russian locale'
        })
    ).rejects.toThrow('must not expose internal validation text for ru')
    await expect(
        expectLocalizedValidation(page.getByTestId('valid-russian-validation'), 'ru', { label: 'Russian validation' })
    ).resolves.toBeUndefined()
    await expect(
        expectLocalizedValidation(page.getByTestId('russian-english-validation'), 'en', {
            label: 'Russian error in English locale'
        })
    ).rejects.toThrow('must not expose internal validation text for en')
    await expect(
        expectLocalizedValidation(page.getByTestId('valid-english-validation'), 'en', { label: 'English validation' })
    ).resolves.toBeUndefined()

    await expect(
        expectSemanticFieldControls(page.getByTestId('localized-description-controls'), { longTextLabels: ['Description'] })
    ).rejects.toThrow('control #2 must be multiline')
})

test('browser JSON capture correlates the exact response body across parallel same-route requests', async ({ page }) => {
    await page.goto('/')
    const fetchPath = '/api/v1/e2e/messenger-response-correlation'
    const fetchRequestIds: string[] = []
    let fetchRequestsWithoutCaptureId = 0
    await page.route(
        (url) => new URL(url).pathname === fetchPath,
        async (route) => {
            const requestId = route.request().headers()[RESPONSE_CAPTURE_ID_HEADER]
            if (!requestId) {
                fetchRequestsWithoutCaptureId += 1
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requestId: null }) })
                return
            }
            fetchRequestIds.push(requestId)
            const responseSequence = fetchRequestIds.length
            if (responseSequence === 1) await new Promise((resolve) => setTimeout(resolve, 100))
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ requestId, responseSequence })
            })
        }
    )

    let triggeredFetchRequestIds: string[] = []
    const fetchCapture = await captureBrowserJsonResponse<{ requestId: string; responseSequence: number }>(
        page,
        'GET',
        fetchPath,
        async () => {
            triggeredFetchRequestIds = await page.evaluate(async (pathname) => {
                const bodies = await Promise.all(
                    [0, 1].map(async () => {
                        const response = await fetch(pathname)
                        return (await response.json()) as { requestId: string }
                    })
                )
                return bodies.map(({ requestId }) => requestId)
            }, fetchPath)
        }
    )
    const fetchResponseRequestId = fetchCapture.response.request().headers()[RESPONSE_CAPTURE_ID_HEADER]
    expect(fetchCapture.response.status()).toBe(200)
    expect(fetchRequestIds).toHaveLength(2)
    expect(new Set(fetchRequestIds).size).toBe(2)
    expect(triggeredFetchRequestIds).toEqual(expect.arrayContaining(fetchRequestIds))
    expect(fetchCapture.payload.requestId).toBe(fetchResponseRequestId)

    await page.reload()
    const uncapturedFetchResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === fetchPath)
    await page.evaluate(async (pathname) => {
        const response = await fetch(pathname)
        await response.json()
    }, fetchPath)
    const uncapturedFetchResponse = await uncapturedFetchResponsePromise
    expect(fetchRequestsWithoutCaptureId).toBe(1)
    expect(uncapturedFetchResponse.request().headers()[RESPONSE_CAPTURE_ID_HEADER]).toBeUndefined()
    expect(
        await page.evaluate(() => ({
            capturedCount: (window as Window & { __messengerE2eJsonResponses?: unknown[] }).__messengerE2eJsonResponses?.length ?? 0,
            expectedTargets: (window as Window & { __messengerE2eExpectedResponses?: unknown[] }).__messengerE2eExpectedResponses ?? [],
            storedTargets: window.sessionStorage.getItem('__messengerE2eExpectedResponses')
        }))
    ).toEqual({ capturedCount: 0, expectedTargets: [], storedTargets: '[]' })

    const redirectPath = '/api/v1/e2e/messenger-response-redirect'
    const redirectedPath = '/api/v1/auth/auth-config'
    await page.route(
        (url) => new URL(url).pathname === redirectPath,
        async (route) => {
            await route.fulfill({ status: 302, headers: { location: redirectedPath } })
        }
    )
    const redirectedCapture = await captureBrowserJsonResponse<Record<string, unknown>>(page, 'GET', redirectPath, async () => {
        return page.evaluate(async (pathname) => {
            const response = await fetch(pathname)
            return response.json()
        }, redirectPath)
    })
    let redirectedRequest = redirectedCapture.response.request()
    let redirectedResponseRequestId = redirectedRequest.headers()[RESPONSE_CAPTURE_ID_HEADER]
    while (!redirectedResponseRequestId && redirectedRequest.redirectedFrom()) {
        redirectedRequest = redirectedRequest.redirectedFrom()!
        redirectedResponseRequestId = redirectedRequest.headers()[RESPONSE_CAPTURE_ID_HEADER]
    }
    expect(redirectedCapture.response.status()).toBe(200)
    expect(redirectedCapture.response.url()).toContain(redirectedPath)
    expect(redirectedCapture.payload).toEqual(await redirectedCapture.response.json())
    expect(redirectedResponseRequestId).toBeTruthy()

    const xhrPath = '/api/v1/e2e/messenger-xhr-response-correlation'
    const xhrRequestIds: string[] = []
    await page.route(
        (url) => new URL(url).pathname === xhrPath,
        async (route) => {
            const requestId = route.request().headers()[RESPONSE_CAPTURE_ID_HEADER]
            expect(requestId, 'The Axios/XHR-style request must carry its unique browser capture ID').toBeTruthy()
            if (!requestId) throw new Error('The browser XHR did not carry its capture ID')
            xhrRequestIds.push(requestId)
            const responseSequence = xhrRequestIds.length
            if (responseSequence === 1) await new Promise((resolve) => setTimeout(resolve, 100))
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requestId, responseSequence }) })
        }
    )
    let triggeredXhrRequestIds: string[] = []
    const xhrCapture = await captureBrowserJsonResponse<{ requestId: string; responseSequence: number }>(page, 'GET', xhrPath, async () => {
        triggeredXhrRequestIds = await page.evaluate(
            (pathname) =>
                Promise.all(
                    [0, 1].map(
                        () =>
                            new Promise<{ requestId: string }>((resolve, reject) => {
                                const request = new XMLHttpRequest()
                                request.open('GET', pathname)
                                request.responseType = 'json'
                                request.addEventListener('load', () => resolve(request.response as { requestId: string }))
                                request.addEventListener('error', () => reject(new Error('The XHR capture contract request failed')))
                                request.send()
                            })
                    )
                ).then((bodies) => bodies.map(({ requestId }) => requestId)),
            xhrPath
        )
    })
    expect(xhrCapture.response.status()).toBe(200)
    expect(xhrCapture.payload.requestId).toBe(xhrCapture.response.request().headers()[RESPONSE_CAPTURE_ID_HEADER])
    expect(xhrRequestIds).toHaveLength(2)
    expect(new Set(xhrRequestIds).size).toBe(2)
    expect(triggeredXhrRequestIds).toEqual(expect.arrayContaining(xhrRequestIds))

    const xhrRedirectPath = '/api/v1/e2e/messenger-xhr-response-redirect'
    const xhrRedirectedPath = '/api/v1/auth/auth-config'
    await page.route(
        (url) => new URL(url).pathname === xhrRedirectPath,
        async (route) => {
            await route.fulfill({ status: 302, headers: { location: xhrRedirectedPath } })
        }
    )
    const xhrRedirectCapture = await captureBrowserJsonResponse<Record<string, unknown>>(page, 'GET', xhrRedirectPath, async () => {
        return page.evaluate(
            (pathname) =>
                new Promise<unknown>((resolve, reject) => {
                    const request = new XMLHttpRequest()
                    request.open('GET', pathname)
                    request.responseType = 'json'
                    request.addEventListener('load', () => resolve(request.response))
                    request.addEventListener('error', () => reject(new Error('The redirected XHR contract request failed')))
                    request.send()
                }),
            xhrRedirectPath
        )
    })
    expect(xhrRedirectCapture.response.status()).toBe(200)
    expect(xhrRedirectCapture.response.url()).toContain(xhrRedirectedPath)
    expect(xhrRedirectCapture.payload).toEqual(await xhrRedirectCapture.response.json())
    expect(xhrRedirectCapture.response.request().headers()[RESPONSE_CAPTURE_ID_HEADER]).toBeTruthy()

    const nestedNavigationPath = '/e2e/messenger-nested-response-capture'
    const nestedInnerPath = '/api/v1/e2e/messenger-nested-inner-response'
    const nestedOuterPath = '/api/v1/e2e/messenger-nested-outer-response'
    await page.route(
        (url) => new URL(url).pathname === nestedNavigationPath,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: `<!doctype html><html><body><script>void fetch(${JSON.stringify(
                    nestedInnerPath
                )}).then((response) => response.json())</script></body></html>`
            })
        }
    )
    const fulfillNestedJson = async (route: Route, source: 'inner' | 'outer') => {
        const requestId = route.request().headers()[RESPONSE_CAPTURE_ID_HEADER] ?? null
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ source, requestId })
        })
    }
    await page.route(
        (url) => new URL(url).pathname === nestedInnerPath,
        (route) => fulfillNestedJson(route, 'inner')
    )
    await page.route(
        (url) => new URL(url).pathname === nestedOuterPath,
        (route) => fulfillNestedJson(route, 'outer')
    )

    let nestedInnerRequestId: string | undefined
    const nestedOuterCapture = await captureBrowserJsonResponse<{ source: string; requestId: string }>(
        page,
        'GET',
        nestedOuterPath,
        async () => {
            const nestedInnerCapture = await captureBrowserJsonResponse<{ source: string; requestId: string }>(
                page,
                'GET',
                nestedInnerPath,
                () => page.goto(nestedNavigationPath)
            )
            expect(nestedInnerCapture.payload.source).toBe('inner')
            nestedInnerRequestId = nestedInnerCapture.payload.requestId
            expect(nestedInnerCapture.payload.requestId).toBe(nestedInnerCapture.response.request().headers()[RESPONSE_CAPTURE_ID_HEADER])
            await page.evaluate(async (pathname) => {
                const response = await fetch(pathname)
                await response.json()
            }, nestedOuterPath)
        }
    )
    expect(nestedOuterCapture.payload.source).toBe('outer')
    expect(nestedOuterCapture.payload.requestId).toBe(nestedOuterCapture.response.request().headers()[RESPONSE_CAPTURE_ID_HEADER])
    expect(nestedOuterCapture.payload.requestId).not.toBe(nestedInnerRequestId)
    expect(
        await page.evaluate(() => ({
            activeTargets:
                (window as Window & { __messengerE2eExpectedResponses?: unknown[] }).__messengerE2eExpectedResponses?.length ?? 0,
            capturedResponses: (window as Window & { __messengerE2eJsonResponses?: unknown[] }).__messengerE2eJsonResponses?.length ?? 0,
            storedTargets: window.sessionStorage.getItem('__messengerE2eExpectedResponses')
        }))
    ).toEqual({ activeTargets: 0, capturedResponses: 0, storedTargets: '[]' })
})

test('browser JSON capture rejects overlapping owners for the same route', async ({ page }) => {
    await page.goto('/')
    const pathname = '/api/v1/e2e/messenger-response-capture-lock'
    await page.route(
        (url) => new URL(url).pathname === pathname,
        async (route) => {
            const requestId = route.request().headers()[RESPONSE_CAPTURE_ID_HEADER]
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requestId }) })
        }
    )

    let releaseTrigger!: () => void
    const triggerGate = new Promise<void>((resolve) => {
        releaseTrigger = resolve
    })
    let signalTriggerStarted!: () => void
    const triggerStarted = new Promise<void>((resolve) => {
        signalTriggerStarted = resolve
    })
    const firstCapturePromise = captureBrowserJsonResponse<{ requestId: string }>(page, 'GET', pathname, async () => {
        signalTriggerStarted()
        await triggerGate
        await page.evaluate(async (path) => {
            const response = await fetch(path)
            await response.json()
        }, pathname)
    })
    await triggerStarted

    let duplicateTriggerRan = false
    try {
        await expect(
            captureBrowserJsonResponse<{ requestId: string }>(page, 'GET', pathname, async () => {
                duplicateTriggerRan = true
                await page.evaluate(async (path) => {
                    const response = await fetch(path)
                    await response.json()
                }, pathname)
            })
        ).rejects.toThrow('already active on this page')
        expect(duplicateTriggerRan).toBe(false)
    } finally {
        releaseTrigger()
    }
    const firstCapture = await firstCapturePromise
    expect(firstCapture.response.status()).toBe(200)
    expect(firstCapture.payload.requestId).toBe(firstCapture.response.request().headers()[RESPONSE_CAPTURE_ID_HEADER])
})

test('browser JSON capture cleans its payload when the trigger fails after the response', async ({ page }) => {
    await page.goto('/')
    const pathname = '/api/v1/e2e/messenger-response-trigger-failure'
    await page.route(
        (url) => new URL(url).pathname === pathname,
        async (route) => {
            const requestId = route.request().headers()[RESPONSE_CAPTURE_ID_HEADER]
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requestId }) })
        }
    )

    await expect(
        captureBrowserJsonResponse(page, 'GET', pathname, async () => {
            await page.evaluate(async (path) => {
                const response = await fetch(path)
                await response.json()
            }, pathname)
            await page.waitForTimeout(100)
            throw new Error('The trigger failed after receiving its JSON response')
        })
    ).rejects.toThrow('The trigger failed after receiving its JSON response')
    expect(
        await page.evaluate(() => ({
            activeTargets:
                (window as Window & { __messengerE2eExpectedResponses?: unknown[] }).__messengerE2eExpectedResponses?.length ?? 0,
            capturedResponses: (window as Window & { __messengerE2eJsonResponses?: unknown[] }).__messengerE2eJsonResponses?.length ?? 0,
            storedTargets: window.sessionStorage.getItem('__messengerE2eExpectedResponses')
        }))
    ).toEqual({ activeTargets: 0, capturedResponses: 0, storedTargets: '[]' })
})

test('browser JSON capture fails closed when sessionStorage is unavailable', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
        Object.defineProperty(window, 'sessionStorage', {
            configurable: true,
            get() {
                throw new DOMException('Storage is unavailable', 'SecurityError')
            }
        })
    })
    let triggerExecuted = false

    await expect(
        captureBrowserJsonResponse(page, 'GET', '/api/v1/e2e/messenger-response-no-storage', async () => {
            triggerExecuted = true
        })
    ).rejects.toThrow('requires sessionStorage to preserve GET /api/v1/e2e/messenger-response-no-storage across navigation')
    expect(triggerExecuted).toBe(false)
    expect(
        await page.evaluate(() => (window as Window & { __messengerE2eExpectedResponses?: unknown[] }).__messengerE2eExpectedResponses)
    ).toEqual([])
})

test('runtime UX clipping oracle catches text hidden by an overflow container', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await page.setContent(`
      <main>
        <section data-testid="intentionally-clamped-preview">
          <p data-runtime-text-preview="true" style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden">
            A compact card preview may intentionally show only a few lines while the full description remains multiline in its detail view.
          </p>
        </section>
        <div style="width: 96px; overflow-x: hidden">
          <span style="display: inline-block; width: 300px; white-space: nowrap">Long runtime content that must remain readable</span>
        </div>
        <div style="height: 12px; overflow-y: hidden">
          <div style="position: relative; top: 24px">Runtime text clipped vertically</div>
        </div>
      </main>
    `)

    await expectNoClippedTextContent(page.getByTestId('intentionally-clamped-preview'), {
        label: 'Intentional multiline card preview'
    })
    await page.setContent(`
      <main>
        <p style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden">
          An unmarked line-clamped field is not an approved preview and must remain visible in full.
        </p>
      </main>
    `)
    await expect(expectNoClippedTextContent(page.getByRole('main'), { label: 'Unmarked line-clamped field' })).rejects.toThrow(
        'must keep user-facing text inside its visible bounds'
    )

    await page.setContent(`
      <main>
        <div style="width: 96px; overflow-x: hidden">
          <span style="display: inline-block; width: 300px; white-space: nowrap">Long runtime content that must remain readable</span>
        </div>
      </main>
    `)
    await expect(expectNoClippedTextContent(page.getByRole('main'), { label: 'Horizontally clipped runtime fixture' })).rejects.toThrow(
        'must keep user-facing text inside its visible bounds'
    )
    await page.setContent(`
      <main>
        <div style="height: 12px; overflow-y: hidden">
          <div style="position: relative; top: 24px">Runtime text clipped vertically</div>
        </div>
      </main>
    `)
    await expect(expectNoClippedTextContent(page.getByRole('main'), { label: 'Vertically clipped runtime fixture' })).rejects.toThrow(
        'must keep user-facing text inside its visible bounds'
    )
})

test('runtime UX mutation oracle detects destructive links', async ({ page }) => {
    await page.setContent('<main><a href="/records/one/delete">Delete record</a></main>')

    await expect(assertRuntimeMutationActionsUnavailable(page, 'Read-only runtime fixture')).rejects.toThrow(
        'must not expose mutation controls'
    )
})

test('settled mutation response listener catches an immediate retry after HTTP 419', async ({ page }) => {
    await page.goto('/')
    const mutationPath = '/api/v1/__e2e__/settled-mutation'
    const routeMatcher = (url: URL) => url.pathname === mutationPath
    let requestCount = 0

    await page.route(routeMatcher, async (route) => {
        if (route.request().method() !== 'POST') {
            await route.continue()
            return
        }
        requestCount += 1
        await route.fulfill({
            status: requestCount === 1 ? 419 : 201,
            contentType: 'application/json',
            body: JSON.stringify({ attempt: requestCount })
        })
    })

    try {
        const settledResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === mutationPath,
            { label: 'Transient CSRF retry', timeout: 5_000 }
        )
        const browserStatusPromise = page.evaluate(async (path) => {
            const firstResponse = await fetch(path, { method: 'POST' })
            if (firstResponse.status !== 419) return firstResponse.status
            const retryResponse = await fetch(path, { method: 'POST' })
            return retryResponse.status
        }, mutationPath)
        const [settledResponse, browserStatus] = await Promise.all([settledResponsePromise, browserStatusPromise])

        expect(requestCount).toBe(2)
        expect(browserStatus).toBe(201)
        expect(settledResponse.status()).toBe(201)
    } finally {
        await page.unroute(routeMatcher)
    }
})
