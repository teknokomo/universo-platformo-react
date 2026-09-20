import { PUBLIC_MARKETING_ROW_LIMIT } from '../../../persistence/publicApplicationRuntimeStore'
import { assertMarketingRuntimeRowCap } from '../../../controllers/runtimeRowSupport/rows'

const createManager = (count: string | number) => ({
    query: jest.fn(async () => [{ count: String(count) }])
})

describe('assertMarketingRuntimeRowCap', () => {
    it('skips non-marketing objects without querying', async () => {
        const manager = createManager(0)

        await assertMarketingRuntimeRowCap({
            manager: manager as never,
            schemaIdent: '"app_test"',
            tableName: 'orders',
            runtimeRowCondition: 'TRUE',
            objectCodename: 'Orders'
        })

        expect(manager.query).not.toHaveBeenCalled()
    })

    it('allows a marketing object below the public runtime row limit', async () => {
        const manager = createManager(PUBLIC_MARKETING_ROW_LIMIT - 1)

        await expect(
            assertMarketingRuntimeRowCap({
                manager: manager as never,
                schemaIdent: '"app_test"',
                tableName: 'marketing_faq',
                runtimeRowCondition: '_upl_deleted = false',
                objectCodename: 'MarketingPageFaq'
            })
        ).resolves.toBeUndefined()
        expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('COUNT(*)'), [])
    })

    it('fails closed with a stable code when the limit is reached', async () => {
        const manager = createManager(PUBLIC_MARKETING_ROW_LIMIT)

        await expect(
            assertMarketingRuntimeRowCap({
                manager: manager as never,
                schemaIdent: '"app_test"',
                tableName: 'marketing_faq',
                runtimeRowCondition: '_upl_deleted = false',
                objectCodename: 'MarketingPageFaq'
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            body: expect.objectContaining({ code: 'MARKETING_ROW_LIMIT_REACHED' })
        })
    })
})
