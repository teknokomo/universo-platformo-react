import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicInterpretationNetworkReadResponse } from '@universo-react/types'
import { PublicNetworkReadError, readPublicInterpretationNetwork } from '../publicInterpretationNetworkApi'
import { readAllPublicPages } from '../publicInterpretationNetworkReaderData'

vi.mock('../publicInterpretationNetworkApi', () => ({
    PublicNetworkReadError: class PublicNetworkReadError extends Error {},
    readPublicInterpretationNetwork: vi.fn()
}))

type StructureResponse = Extract<PublicInterpretationNetworkReadResponse, { view: 'structures' }>

const readPage = vi.mocked(readPublicInterpretationNetwork)
const input = {
    applicationRef: 'public-network',
    locale: 'en',
    instanceKey: 'network-main',
    view: 'structures' as const
}

function structuresPage(offset: number, hasMore: boolean, handle: string, limit = 1): StructureResponse {
    return {
        view: 'structures',
        locale: 'en',
        page: { offset, limit, hasMore },
        items: [{ handle, name: `Structure ${offset}`, description: null }]
    }
}

describe('readAllPublicPages', () => {
    beforeEach(() => {
        readPage.mockReset()
    })

    it('collects every page and advances with the server-reported limit', async () => {
        readPage
            .mockResolvedValueOnce(structuresPage(0, true, 'pn1.structure_first', 2))
            .mockResolvedValueOnce(structuresPage(2, false, 'pn1.structure_second', 2))

        const result = await readAllPublicPages(input, new AbortController().signal)

        expect(result.items.map((item) => item.handle)).toEqual(['pn1.structure_first', 'pn1.structure_second'])
        expect(readPage.mock.calls.map(([request]) => request.offset)).toEqual([0, 2])
        expect(result.page.hasMore).toBe(false)
    })

    it('fails closed when the response does not advance the requested offset', async () => {
        readPage
            .mockResolvedValueOnce(structuresPage(0, true, 'pn1.structure_first'))
            .mockResolvedValueOnce(structuresPage(0, true, 'pn1.structure_repeated'))

        await expect(readAllPublicPages(input, new AbortController().signal)).rejects.toBeInstanceOf(PublicNetworkReadError)
        expect(readPage).toHaveBeenCalledTimes(2)
    })

    it('rejects a next offset beyond the public response boundary', async () => {
        readPage.mockResolvedValueOnce(structuresPage(0, true, 'pn1.structure_first', 10_001))

        await expect(readAllPublicPages(input, new AbortController().signal)).rejects.toBeInstanceOf(PublicNetworkReadError)
        expect(readPage).toHaveBeenCalledTimes(1)
    })
})
