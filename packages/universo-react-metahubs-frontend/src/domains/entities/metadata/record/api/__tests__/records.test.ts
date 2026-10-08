import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../../../../shared'
import type { RecordItem } from '../../../../../types'
import { listRecordsDirect } from '../records'

vi.mock('../../../../../shared', () => ({
    apiClient: {
        get: vi.fn()
    }
}))

describe('listRecordsDirect', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('forwards exact component/value filters to the direct records endpoint', async () => {
        vi.mocked(apiClient.get).mockResolvedValueOnce({
            data: {
                items: [{ id: 'record-1', data: { SemanticKey: 'welcome' } } as RecordItem],
                pagination: { total: 1, limit: 2, offset: 0 }
            }
        })

        await expect(
            listRecordsDirect('metahub-1', 'object-1', {
                limit: 2,
                offset: 0,
                exactComponentCodename: 'SemanticKey',
                exactValue: 'welcome',
                sortBy: 'updated',
                sortOrder: 'desc'
            })
        ).resolves.toMatchObject({ items: [{ id: 'record-1' }], pagination: { total: 1 } })

        expect(apiClient.get).toHaveBeenCalledWith('/metahub/metahub-1/entities/object/instance/object-1/records', {
            params: {
                limit: 2,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                exactComponentCodename: 'SemanticKey',
                exactValue: 'welcome'
            }
        })
    })
})
