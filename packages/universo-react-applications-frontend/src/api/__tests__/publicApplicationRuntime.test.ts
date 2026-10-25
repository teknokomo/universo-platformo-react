import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES, PUBLIC_APPLICATION_RUNTIME_ERROR_CODE } from '@universo-react/types'
import {
    buildCanonicalApplicationRuntimePath,
    getPublicApplicationRuntime,
    isPublicApplicationUnavailableError,
    PublicApplicationRuntimeError
} from '../publicApplicationRuntime'
import { publicApplicationRuntimeQueryKeys } from '../publicApplicationRuntimeQueryKeys'

describe('public application runtime transport', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it('accepts the strict public Dashboard union and rejects persistence fields on placements', async () => {
        const payload = {
            route: {
                matchedBy: 'alias',
                matchedAlias: 'network',
                routingMode: 'direct',
                primaryAlias: 'network',
                canonicalAlias: null
            },
            templateKey: 'dashboard',
            dashboard: {
                locale: 'en',
                workspaceAvailability: 'available',
                placements: [
                    {
                        instanceKey: 'public-network',
                        widgetKey: 'interpretationNetworkWorkspace',
                        zone: 'center',
                        sortOrder: 0,
                        parentInstanceKey: null,
                        slotKey: null,
                        config: {},
                        runtimeData: { status: 'deferred' }
                    }
                ]
            }
        }
        const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify(payload)))
        vi.stubGlobal('fetch', fetcher)
        await expect(getPublicApplicationRuntime('network', 'en')).resolves.toEqual(payload)
        Object.assign(payload.dashboard.placements[0], { id: 'physical-widget-id' })
        await expect(getPublicApplicationRuntime('network', 'en')).rejects.toMatchObject({
            status: 502,
            code: 'PUBLIC_APPLICATION_RUNTIME_RESPONSE_INVALID'
        })
    })

    it('uses the anonymous public endpoint without ambient credentials or cache authority', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ code: PUBLIC_APPLICATION_RUNTIME_ERROR_CODE }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            })
        )
        vi.stubGlobal('fetch', fetchMock)

        await expect(getPublicApplicationRuntime('north-route', 'ru')).rejects.toMatchObject({
            status: 404,
            code: PUBLIC_APPLICATION_RUNTIME_ERROR_CODE
        })
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/public/applications/north-route/runtime?locale=ru', {
            method: 'GET',
            credentials: 'omit',
            cache: 'no-store',
            headers: { Accept: 'application/vnd.universo.public-runtime-probe+json' },
            signal: expect.any(AbortSignal)
        })
    })

    it('bounds the anonymous bootstrap request and returns a retryable timeout error', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn(
            (_input: RequestInfo | URL, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
                })
        )
        vi.stubGlobal('fetch', fetchMock)

        const request = getPublicApplicationRuntime('north-route', 'en')
        const timeoutAssertion = expect(request).rejects.toMatchObject({ status: 408, code: 'PUBLIC_APPLICATION_RUNTIME_TIMEOUT' })
        await vi.advanceTimersByTimeAsync(15_000)

        await timeoutAssertion
        expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    })

    it('bounds both declared and streamed anonymous response bodies', async () => {
        const cancelDeclaredBody = vi.fn()
        const declaredBody = new ReadableStream<Uint8Array>({ cancel: cancelDeclaredBody })
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(declaredBody, {
                    headers: { 'Content-Length': String(MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES + 1) }
                })
            )
            .mockResolvedValueOnce(
                new Response(
                    new ReadableStream<Uint8Array>({
                        start(controller) {
                            controller.enqueue(new Uint8Array(MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES + 1))
                            controller.close()
                        }
                    })
                )
            )
        vi.stubGlobal('fetch', fetchMock)

        await expect(getPublicApplicationRuntime('north-route', 'en')).rejects.toMatchObject({
            status: 502,
            code: 'PUBLIC_APPLICATION_RUNTIME_RESPONSE_TOO_LARGE'
        })
        expect(cancelDeclaredBody).toHaveBeenCalledTimes(1)
        await expect(getPublicApplicationRuntime('north-route', 'en')).rejects.toMatchObject({
            status: 502,
            code: 'PUBLIC_APPLICATION_RUNTIME_RESPONSE_TOO_LARGE'
        })
    })

    it('applies the anonymous bootstrap timeout while reading a stalled response body', async () => {
        vi.useFakeTimers()
        let streamController: ReadableStreamDefaultController<Uint8Array> | undefined
        const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
            const body = new ReadableStream<Uint8Array>({
                start(controller) {
                    streamController = controller
                }
            })
            init?.signal?.addEventListener(
                'abort',
                () => streamController?.error(init.signal?.reason ?? new DOMException('Aborted', 'AbortError')),
                { once: true }
            )
            return Promise.resolve(new Response(body))
        })
        vi.stubGlobal('fetch', fetchMock)

        const request = getPublicApplicationRuntime('north-route', 'en')
        const timeoutAssertion = expect(request).rejects.toMatchObject({ status: 408, code: 'PUBLIC_APPLICATION_RUNTIME_TIMEOUT' })
        await vi.advanceTimersByTimeAsync(15_000)

        await timeoutAssertion
        expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    })

    it('sends a scoped target through the anonymous endpoint without forwarding workspace selectors', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
        vi.stubGlobal('fetch', fetchMock)
        const entityTypeId = '0190a9b5-3cde-7abc-8def-0123456789ac'

        await expect(getPublicApplicationRuntime('north-route', 'en', { targetKind: 'object', entityTypeId })).rejects.toMatchObject({
            status: 404,
            code: PUBLIC_APPLICATION_RUNTIME_ERROR_CODE
        })

        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            `/api/v1/public/applications/north-route/runtime?locale=en&targetKind=object&entityTypeId=${entityTypeId}`
        )
        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit', cache: 'no-store' })
    })

    it('maps the UI probe no-content response to the same unavailable contract', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

        await expect(getPublicApplicationRuntime('private-app', 'en')).rejects.toMatchObject({
            status: 404,
            code: PUBLIC_APPLICATION_RUNTIME_ERROR_CODE
        })
    })

    it('normalizes unavailable 404 responses without treating other failures as resource absence', () => {
        expect(isPublicApplicationUnavailableError(new PublicApplicationRuntimeError(404, PUBLIC_APPLICATION_RUNTIME_ERROR_CODE))).toBe(
            true
        )
        expect(isPublicApplicationUnavailableError(new PublicApplicationRuntimeError(404, null))).toBe(true)
        expect(isPublicApplicationUnavailableError(new PublicApplicationRuntimeError(403, PUBLIC_APPLICATION_RUNTIME_ERROR_CODE))).toBe(
            false
        )
        expect(isPublicApplicationUnavailableError(new PublicApplicationRuntimeError(404, 'OTHER_ERROR'))).toBe(false)
    })

    it('rejects malformed successful payloads instead of trusting the public response shape', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ route: {}, templateKey: 'marketing-page', marketingPage: {} }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        )

        await expect(getPublicApplicationRuntime('north-route', 'en')).rejects.toMatchObject({
            status: 502,
            code: 'PUBLIC_APPLICATION_RUNTIME_RESPONSE_INVALID'
        })
    })

    it('builds only same-origin canonical paths and preserves the runtime tail and query', () => {
        expect(
            buildCanonicalApplicationRuntimePath({
                applicationRef: 'secondary',
                canonicalAlias: 'primary',
                remainingPath: '/admin/section/',
                search: '?locale=ru&source=secondary'
            })
        ).toBe('/a/primary/admin/section?locale=ru&source=secondary')
        expect(
            buildCanonicalApplicationRuntimePath({
                applicationRef: 'primary',
                canonicalAlias: 'primary',
                remainingPath: 'admin',
                search: '?locale=ru'
            })
        ).toBeNull()
        expect(
            buildCanonicalApplicationRuntimePath({
                applicationRef: 'technical-id',
                canonicalAlias: null,
                remainingPath: null,
                search: null
            })
        ).toBeNull()
    })

    it('preserves the visitor anchor alongside the path and query on the canonical alias redirect', () => {
        expect(
            buildCanonicalApplicationRuntimePath({
                applicationRef: 'secondary',
                canonicalAlias: 'primary',
                remainingPath: '',
                search: '',
                hash: '#pricing'
            })
        ).toBe('/a/primary#pricing')
        expect(
            buildCanonicalApplicationRuntimePath({
                applicationRef: 'secondary',
                canonicalAlias: 'primary',
                remainingPath: '/admin/section/',
                search: '?locale=ru',
                hash: '#pricing'
            })
        ).toBe('/a/primary/admin/section?locale=ru#pricing')
    })

    it('normalizes a hash without its marker and ignores empty hash fragments', () => {
        expect(
            buildCanonicalApplicationRuntimePath({
                applicationRef: 'secondary',
                canonicalAlias: 'primary',
                hash: 'pricing'
            })
        ).toBe('/a/primary#pricing')
        expect(
            buildCanonicalApplicationRuntimePath({
                applicationRef: 'secondary',
                canonicalAlias: 'primary',
                search: '?locale=en',
                hash: ''
            })
        ).toBe('/a/primary?locale=en')
        expect(
            buildCanonicalApplicationRuntimePath({
                applicationRef: 'secondary',
                canonicalAlias: 'primary',
                hash: '#'
            })
        ).toBe('/a/primary')
    })

    it('keeps anonymous runtime cache keys separate from authenticated application queries', () => {
        expect(publicApplicationRuntimeQueryKeys.runtime(' North-Route ', 'RU_ru')).toEqual([
            'public-application-runtime',
            'north-route',
            'ru',
            { targetKind: null, entityTypeId: null, entityTypeCodename: null }
        ])
        expect(
            publicApplicationRuntimeQueryKeys.runtime('north-route', 'en', {
                targetKind: 'page',
                entityTypeId: ' 0190A9B5-3CDE-7ABC-8DEF-0123456789AC '
            })
        ).not.toEqual(publicApplicationRuntimeQueryKeys.runtime('north-route', 'en'))
    })
})
