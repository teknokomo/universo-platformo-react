import { getCatalogSystemFieldDefinitionSeedRecords } from '@universo/utils/database'
import { ensureCatalogSystemFieldDefinitionsSeed } from '../../domains/templates/services/systemFieldDefinitionSeed'

const createSeedQueryBuilder = (
    existingRows: Array<{ id: string; system_key: string }> = [],
    policyRows: Array<{ key: string; value?: Record<string, unknown> | null }> = []
) => {
    const selectAttributes = jest.fn(async () => existingRows)
    const selectPolicy = jest.fn(async () => policyRows)
    const update = jest.fn(async () => 1)
    const insert = jest.fn(async () => 1)
    const buildAdminChain = () => {
        const adminChain = {
            where: jest.fn(() => adminChain),
            whereIn: jest.fn(() => adminChain),
            whereRaw: jest.fn(() => adminChain),
            select: selectPolicy
        }

        return adminChain
    }
    const from = jest.fn((tableName?: string) => {
        if (tableName === 'cfg_settings') {
            return buildAdminChain()
        }

        const where = jest.fn((criteria: { id?: string }) => (criteria.id ? { update } : { select: selectAttributes }))
        return { where }
    })
    const into = jest.fn(() => ({ insert }))
    const raw = jest.fn((sql: string, params: unknown[]) => ({ sql, params }))
    const withSchema = jest.fn(() => ({ from, into }))

    return {
        qb: {
            withSchema,
            raw
        },
        mocks: { selectAttributes, selectPolicy, update, insert, raw }
    }
}

describe('ensureCatalogSystemFieldDefinitionsSeed', () => {
    it('inserts the canonical shared system rows for a new catalog', async () => {
        const { qb, mocks } = createSeedQueryBuilder()

        const result = await ensureCatalogSystemFieldDefinitionsSeed(qb as never, 'mhb_test', 'catalog-1', 'user-1')

        expect(result).toEqual({ inserted: getCatalogSystemFieldDefinitionSeedRecords().length, updated: 0 })
        expect(mocks.insert).toHaveBeenCalledTimes(getCatalogSystemFieldDefinitionSeedRecords().length)
        expect(mocks.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                object_id: 'catalog-1',
                codename: expect.objectContaining({
                    _primary: 'en',
                    _schema: '1',
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: '_app_published' })
                    })
                }),
                is_system: true,
                is_system_managed: true,
                is_system_enabled: true
            })
        )
    })

    it('repairs existing rows without force-reenabling disabled system fields', async () => {
        const { qb, mocks } = createSeedQueryBuilder([{ id: 'seed-1', system_key: 'app.deleted' }])

        await ensureCatalogSystemFieldDefinitionsSeed(qb as never, 'mhb_test', 'catalog-1', 'user-1', {
            policy: {
                allowConfiguration: true,
                forceCreate: true,
                ignoreMetahubSettings: false
            }
        })

        expect(mocks.update).toHaveBeenCalled()
        expect(mocks.raw).toHaveBeenCalledWith('COALESCE(is_system_enabled, ?)', [true])
        expect(mocks.insert).toHaveBeenCalledTimes(getCatalogSystemFieldDefinitionSeedRecords().length - 1)
    })

    it('skips platform rows when policy does not force-create them and no explicit state exists', async () => {
        const { qb, mocks } = createSeedQueryBuilder()

        await ensureCatalogSystemFieldDefinitionsSeed(qb as never, 'mhb_test', 'catalog-1', 'user-1', {
            policy: {
                allowConfiguration: false,
                forceCreate: false,
                ignoreMetahubSettings: false
            }
        })

        const expectedAppRows = getCatalogSystemFieldDefinitionSeedRecords().filter((seed) => seed.key.startsWith('app.')).length

        expect(mocks.insert).toHaveBeenCalledTimes(expectedAppRows)
        expect(
            mocks.insert.mock.calls.some((call) => typeof call[0]?.system_key === 'string' && String(call[0].system_key).startsWith('upl.'))
        ).toBe(false)
    })
})
