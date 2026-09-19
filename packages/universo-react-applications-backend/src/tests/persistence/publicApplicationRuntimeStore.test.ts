import { createMockDbExecutor } from '../utils/dbMocks'
import { loadAllowlistedPublishedMarketingRows } from '../../persistence/publicApplicationRuntimeStore'

describe('publicApplicationRuntimeStore', () => {
    it('reads only published allowlisted columns without SELECT *', async () => {
        const { executor } = createMockDbExecutor()
        const objectId = '019ccefc-2f7b-7b36-82f4-85cdb1312275'
        const rowId = '019ccefc-2f7b-7b36-82f4-85cdb1312276'
        const physicalBrandName = 'cmp_019ccefc2f7b7b3682f485cdb1312277'
        executor.query
            .mockResolvedValueOnce([{ id: objectId, codename: 'MarketingPageSiteSettings', tableName: 'marketing_site_settings' }])
            .mockResolvedValueOnce([{ objectId, codename: 'BrandName', columnName: physicalBrandName }])
            .mockResolvedValueOnce([{ tableName: 'marketing_site_settings' }])
            .mockResolvedValueOnce([{ id: rowId, codename: 'site-settings', [physicalBrandName]: { en: 'Public brand' } }])

        const rows = await loadAllowlistedPublishedMarketingRows(executor, {
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            workspaceId: null
        })

        expect(rows.get('MarketingPageSiteSettings')).toEqual([{ id: rowId, BrandName: { en: 'Public brand' } }])
        expect(String(executor.query.mock.calls[3][0])).not.toContain('SELECT *')
        expect(String(executor.query.mock.calls[3][0])).toContain('_app_published = true')
        expect(String(executor.query.mock.calls[3][0])).toContain('workspace_id')
        // The limit is fetched as limit+1 so an over-limit published object
        // fails closed instead of silently truncating public content.
        expect(executor.query.mock.calls[3][1]).toEqual([1001])
    })
})
