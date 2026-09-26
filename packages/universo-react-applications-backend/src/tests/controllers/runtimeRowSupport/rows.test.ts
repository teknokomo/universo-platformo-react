import { PUBLIC_MARKETING_ROW_LIMIT } from '../../../persistence/publicApplicationRuntimeStore'
import { assertMarketingRuntimeRowCap, copyRuntimeConfiguredRelations } from '../../../controllers/runtimeRowSupport/rows'

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

describe('copyRuntimeConfiguredRelations Entity policy', () => {
    it('rejects a denied related Object before inserting any copied relation rows', async () => {
        const manager = {
            query: jest.fn().mockResolvedValue([
                {
                    id: 'related-object',
                    kind: 'object',
                    codename: 'OwnedItems',
                    table_name: 'owned_items',
                    config: {
                        recordPolicy: {
                            version: 1,
                            denyDeleteWhenBound: false,
                            immutableSemanticKeyWhenBound: false,
                            runtimeMutation: 'deny'
                        }
                    }
                }
            ])
        }

        await expect(
            copyRuntimeConfiguredRelations({
                manager: manager as never,
                schemaIdent: '"runtime_schema"',
                currentWorkspaceId: null,
                workspacesEnabled: false,
                userId: 'user-1',
                sourceParentId: 'source-id',
                copiedParentId: 'copy-id',
                relations: [
                    {
                        objectCodename: 'OwnedItems',
                        parentFieldCodename: 'Owner',
                        orderFieldCodename: null,
                        refRemaps: []
                    }
                ]
            })
        ).rejects.toMatchObject({ statusCode: 403, code: 'RUNTIME_ENTITY_MUTATION_DENIED' })

        expect(manager.query).toHaveBeenCalledTimes(1)
        expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })
})
