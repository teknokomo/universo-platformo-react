import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolvePublicMessengerAttribution } from '../api'

const shortId = 'a'.repeat(22)
const fetchMock = vi.fn()

const jsonResponse = (body: unknown, ok = true) => ({
    ok,
    json: vi.fn().mockResolvedValue(body)
})

describe('resolvePublicMessengerAttribution', () => {
    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('uses the same-origin public resolver without credentials and returns only its platform', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ platform: 'telegram' }))

        await expect(resolvePublicMessengerAttribution('public-alias', shortId)).resolves.toBe('telegram')

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/v1/public/applications/public-alias/attribution/' + shortId,
            expect.objectContaining({ method: 'GET', credentials: 'omit', cache: 'no-store' })
        )
        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { Accept: 'application/json' } })
    })

    it('skips malformed ids and treats an unresolved binding as no attribution', async () => {
        await expect(resolvePublicMessengerAttribution('public-alias', 'bad-id')).resolves.toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()

        fetchMock.mockResolvedValue(jsonResponse({ platform: null }))
        await expect(resolvePublicMessengerAttribution('public-alias', shortId)).resolves.toBeNull()
    })

    it('rejects response fields beyond the neutral platform contract', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ platform: 'max', userId: 'private-id' }))

        await expect(resolvePublicMessengerAttribution('public-alias', shortId)).rejects.toThrow(
            'Public Messenger attribution response validation failed'
        )
    })
})
