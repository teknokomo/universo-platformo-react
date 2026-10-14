import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../apiClient', () => ({ default: { get: mocks.get } }))

import {
    buildPublicGuestAccessUrl,
    buildGlobalShortLinkUrl,
    GlobalShortLinkUnavailableError,
    listGlobalShortLinkQuizAccessOptions,
    listGlobalShortLinkResourceOptions,
    resolvePublicGlobalShortLink
} from '../globalShortLinksApi'

const APPLICATION_ID = '0190a9b5-3cde-7abc-8def-0123456789ac'

describe('global short-link API', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    it('loads localized quiz link choices through the authorized selector contract', async () => {
        mocks.get.mockResolvedValue({
            data: {
                items: [
                    {
                        id: '0190a9b5-3cde-7abc-8def-0123456789ad',
                        slug: 'grade-5',
                        label: '5 класс — Интеллектуальный марафон',
                        workspaceId: null,
                        workspaceLabel: null
                    }
                ]
            }
        })

        await expect(listGlobalShortLinkQuizAccessOptions({ applicationId: APPLICATION_ID, locale: 'ru' })).resolves.toEqual([
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789ad',
                slug: 'grade-5',
                label: '5 класс — Интеллектуальный марафон',
                workspaceId: null,
                workspaceLabel: null
            }
        ])
        expect(mocks.get).toHaveBeenCalledWith(`/global-short-links/applications/${APPLICATION_ID}/quiz-access-options`, {
            params: { locale: 'ru' }
        })
    })

    it('loads only validated localized page and object target choices', async () => {
        mocks.get.mockResolvedValue({
            data: { items: [{ targetKind: 'page', entityTypeCodename: 'home', label: 'Главная страница' }] }
        })

        await expect(listGlobalShortLinkResourceOptions({ applicationId: APPLICATION_ID, locale: 'ru' })).resolves.toEqual([
            { targetKind: 'page', entityTypeCodename: 'home', label: 'Главная страница' }
        ])
        expect(mocks.get).toHaveBeenCalledWith(`/global-short-links/applications/${APPLICATION_ID}/application-resource-options`, {
            params: { locale: 'ru' }
        })
    })

    it('resolves a public target without ambient cookies or HTTP cache', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    target: {
                        kind: 'lms-access-link',
                        applicationId: APPLICATION_ID,
                        accessLinkId: '0190a9b5-3cde-7abc-8def-0123456789ad',
                        accessLinkSlug: 'grade-5',
                        workspaceId: null
                    }
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            )
        )
        vi.stubGlobal('fetch', fetchMock)

        await expect(resolvePublicGlobalShortLink('marathon-5')).resolves.toEqual({
            kind: 'lms-access-link',
            applicationId: APPLICATION_ID,
            accessLinkId: '0190a9b5-3cde-7abc-8def-0123456789ad',
            accessLinkSlug: 'grade-5',
            workspaceId: null
        })
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/public/l/marathon-5', {
            method: 'GET',
            credentials: 'omit',
            cache: 'no-store',
            headers: { Accept: 'application/json' }
        })
    })

    it('rejects malformed targets and unavailable slugs with a non-enumerating error', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ target: { kind: 'redirect', url: 'https://evil.test' } }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        )
        await expect(resolvePublicGlobalShortLink('unknown')).rejects.toMatchObject({ status: 502 })

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
        await expect(resolvePublicGlobalShortLink('unknown')).rejects.toBeInstanceOf(GlobalShortLinkUnavailableError)
    })

    it('encodes only a same-origin short-link path', () => {
        expect(buildGlobalShortLinkUrl('marathon-5', 'https://universo.pro')).toBe('https://universo.pro/l/marathon-5')
        expect(buildGlobalShortLinkUrl('a b', 'https://universo.pro')).toBe('https://universo.pro/l/a%20b')
    })

    it('builds a full same-origin guest URL from the application and access-link slug', () => {
        expect(buildPublicGuestAccessUrl(APPLICATION_ID, 'lyceum-marathon-grade-5', 'https://universo.pro')).toBe(
            `https://universo.pro/public/a/${APPLICATION_ID}/links/lyceum-marathon-grade-5`
        )
        expect(buildPublicGuestAccessUrl(APPLICATION_ID, 'grade 5', 'https://universo.pro')).toBe(
            `https://universo.pro/public/a/${APPLICATION_ID}/links/grade%205`
        )
    })
})
