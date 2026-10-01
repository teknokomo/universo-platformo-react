import { afterEach, describe, expect, it, vi } from 'vitest'
import { PUBLIC_APPLICATION_RUNTIME_ERROR_CODE } from '@universo-react/types'
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
            headers: { Accept: 'application/vnd.universo.public-runtime-probe+json' }
        })
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
