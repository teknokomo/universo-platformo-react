import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES } from '@universo-react/types'
import {
    publicNetworkReadQueryKey,
    readPublicInterpretationNetwork,
    type PublicDashboardTarget,
    type PublicNetworkReadInput
} from '../publicInterpretationNetworkApi'
import { handles, responses, scope } from './fixtures'

const input: PublicNetworkReadInput = { ...scope, view: 'structures', offset: 0 }
afterEach(() => vi.unstubAllGlobals())

describe('public network read boundary', () => {
    it('uses only the anonymous GET transport without credentials or browser cache', async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(responses.interpretations)))
        vi.stubGlobal('fetch', fetcher)
        await readPublicInterpretationNetwork({
            ...input,
            view: 'interpretations',
            parentHandle: handles.structure,
            target: { targetKind: 'page', entityTypeCodename: 'Overview' }
        })
        const [url, options] = fetcher.mock.calls[0]
        expect(url).toBe(
            '/api/v1/public/applications/public-network/runtime/widgets/network-main/interpretation-network?locale=en&view=interpretations&offset=0&targetKind=page&entityTypeCodename=Overview&parentHandle=pn1.public_structure_handle_example'
        )
        expect(options).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } })
        expect(options).not.toHaveProperty('body')
        expect(options.headers).not.toHaveProperty('Authorization')
    })

    it('preserves a normalized public entity ID selector in the bounded read request', async () => {
        const entityTypeId = '0190A9B5-3CDE-7ABC-8DEF-0123456789AC'
        const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(responses.structures)))
        vi.stubGlobal('fetch', fetcher)
        await readPublicInterpretationNetwork({
            ...input,
            target: { targetKind: 'PAGE', entityTypeId } as unknown as PublicDashboardTarget
        })
        const [url, options] = fetcher.mock.calls[0]
        const parsedUrl = new URL(String(url), 'https://public.test')
        expect(parsedUrl.searchParams.get('targetKind')).toBe('page')
        expect(parsedUrl.searchParams.get('entityTypeId')).toBe(entityTypeId.toLowerCase())
        expect(parsedUrl.searchParams.has('entityTypeCodename')).toBe(false)
        expect(options).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store' })
    })

    it('rejects oversized declared and streamed public page responses', async () => {
        const oversizedLength = String(MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES + 1)
        const cancelDeclaredBody = vi.fn()
        const declaredBody = new ReadableStream<Uint8Array>({ cancel: cancelDeclaredBody })
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce(new Response(declaredBody, { headers: { 'content-length': oversizedLength } }))
        )
        await expect(readPublicInterpretationNetwork(input)).rejects.toThrow('Public content is unavailable')
        expect(cancelDeclaredBody).toHaveBeenCalledTimes(1)

        const oversizedStream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array(MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES + 1))
                controller.close()
            }
        })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(oversizedStream)))
        await expect(readPublicInterpretationNetwork(input)).rejects.toThrow('Public content is unavailable')
    })

    it('accepts a valid page response at the shared byte limit', async () => {
        const body = JSON.stringify(responses.structures).padEnd(MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES, ' ')
        expect(new TextEncoder().encode(body)).toHaveLength(MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES)
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce(
                    new Response(body, { headers: { 'content-length': String(MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES) } })
                )
        )

        await expect(readPublicInterpretationNetwork(input)).resolves.toMatchObject({ view: 'structures', page: { hasMore: false } })
    })

    it.each([
        { applicationRef: '../authenticated' },
        { instanceKey: '018f8a78-7b8f-7c1d-a111-222233334444' },
        { view: 'delete' },
        { offset: -1 },
        { offset: 10_001 },
        { offset: 0.5 },
        { locale: 'fr' },
        { view: 'matrix', parentHandle: 'physical-cell-id' },
        { parentHandle: handles.cell },
        { target: { targetKind: 'page', entityTypeCodename: '../unsafe' } },
        { target: { targetKind: 'page', entityTypeId: 'not-a-uuid' } },
        { target: { targetKind: 'page', entityTypeId: '0190a9b5-3cde-7abc-8def-0123456789ac', entityTypeCodename: 'Overview' } },
        { target: { entityTypeId: '0190a9b5-3cde-7abc-8def-0123456789ac' } }
    ])('rejects invalid endpoint selectors before fetching: %j', async (change) => {
        const fetcher = vi.fn()
        vi.stubGlobal('fetch', fetcher)
        await expect(readPublicInterpretationNetwork({ ...input, ...change } as PublicNetworkReadInput)).rejects.toThrow()
        expect(fetcher).not.toHaveBeenCalled()
    })

    it.each([
        { ...responses.structures, physicalId: 'forbidden' },
        { ...responses.structures, locale: 'ru' },
        responses.interpretations,
        { ...responses.structures, page: { offset: 25, limit: 25, hasMore: false } },
        { ...responses.structures, items: [{ handle: handles.structure, name: 'Cities', description: null, id: 'forbidden' }] }
    ])('rejects incompatible or cross-scope response DTOs', async (body) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))))
        await expect(readPublicInterpretationNetwork(input)).rejects.toThrow('Public content is unavailable')
    })

    it('rejects a response for another opaque parent and duplicate primary materials', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...responses.materials, cellHandle: handles.row }))))
        const request = { ...input, view: 'materials' as const, parentHandle: handles.cell }
        await expect(readPublicInterpretationNetwork(request)).rejects.toThrow()
        const materials = responses.materials as Extract<typeof responses.materials, { view: 'materials' }>
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    new Response(JSON.stringify({ ...materials, items: materials.items.map((item) => ({ ...item, isPrimary: true })) }))
                )
        )
        await expect(readPublicInterpretationNetwork(request)).rejects.toThrow()
    })

    it('isolates every application, locale, target, placement, view, parent and offset in TanStack cache', () => {
        const queryClient = new QueryClient()
        const base = { ...input, view: 'matrix' as const, parentHandle: handles.interpretation }
        const key = publicNetworkReadQueryKey(base)
        queryClient.setQueryData(key, 'only this page')
        const variants: Partial<PublicNetworkReadInput>[] = [
            { applicationRef: 'other-network' },
            { locale: 'ru' },
            { target: { targetKind: 'page', entityTypeCodename: 'Overview' } },
            { target: { targetKind: 'page', entityTypeId: '0190a9b5-3cde-7abc-8def-0123456789ac' } },
            { instanceKey: 'network-secondary' },
            { view: 'materials' },
            { parentHandle: handles.cell },
            { offset: 25 }
        ]
        for (const variant of variants) expect(queryClient.getQueryData(publicNetworkReadQueryKey({ ...base, ...variant }))).toBeUndefined()
        expect(publicNetworkReadQueryKey({ ...base, applicationRef: ' PUBLIC-NETWORK ', locale: 'EN_us' })).toEqual(key)
        queryClient.clear()
    })
})
