import { describe, expect, it, vi } from 'vitest'

import { metahubsQueryKeys } from '../../../shared'
import { invalidatePublicationSettingsQueries } from '../publicationSettingsQueries'

describe('invalidatePublicationSettingsQueries', () => {
    it('invalidates publication detail, publications list, and breadcrumb queries together', async () => {
        const invalidateQueries = vi.fn().mockResolvedValue(undefined)

        await invalidatePublicationSettingsQueries({ invalidateQueries }, 'metahub-1', 'publication-1')

        expect(invalidateQueries).toHaveBeenCalledTimes(3)
        expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
            queryKey: metahubsQueryKeys.publicationDetail('metahub-1', 'publication-1')
        })
        expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
            queryKey: metahubsQueryKeys.publications('metahub-1')
        })
        expect(invalidateQueries).toHaveBeenNthCalledWith(3, {
            queryKey: ['breadcrumb', 'metahub-publication', 'metahub-1', 'publication-1']
        })
    })
})