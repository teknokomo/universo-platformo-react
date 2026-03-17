import { getCatalogSystemAttributeSeedRecords } from '@universo/utils/database'
import { ensureCatalogSystemAttributesSeed } from '../../domains/templates/services/systemAttributeSeed'

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

describe('ensureCatalogSystemAttributesSeed', () => {
    it('inserts the canonical shared system rows for a new catalog', async () => {
        const { qb, mocks } = createSeedQueryBuilder()

        const result = await ensureCatalogSystemAttributesSeed(qb as never, 'mhb_test', 'catalog-1', 'user-1')

        expect(result).toEqual({ inserted: getCatalogSystemAttributeSeedRecords().length, updated: 0 })
        expect(mocks.insert).toHaveBeenCalledTimes(getCatalogSystemAttributeSeedRecords().length)
        expect(mocks.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                object_id: 'catalog-1',
                codename: '_app_published',
                is_system: true,
                is_system_managed: true,
                is_system_enabled: true
            })
        )
    })

    it('repairs existing rows without force-reenabling disabled system fields', async () => {
        const { qb, mocks } = createSeedQueryBuilder([{ id: 'seed-1', system_key: 'app.deleted' }])

        await ensureCatalogSystemAttributesSeed(qb as never, 'mhb_test', 'catalog-1', 'user-1', {
            policy: {
                allowConfiguration: true,
                forceCreate: true,
                ignoreMetahubSettings: false
            }
        })

        expect(mocks.update).toHaveBeenCalled()
        expect(mocks.raw).toHaveBeenCalledWith('COALESCE(is_system_enabled, ?)', [true])
        expect(mocks.insert).toHaveBeenCalledTimes(getCatalogSystemAttributeSeedRecords().length - 1)
    })

    it('skips platform rows when policy does not force-create them and no explicit state exists', async () => {
        const { qb, mocks } = createSeedQueryBuilder()

        await ensureCatalogSystemAttributesSeed(qb as never, 'mhb_test', 'catalog-1', 'user-1', {
            policy: {
                allowConfiguration: false,
                forceCreate: false,
                ignoreMetahubSettings: false
            }
        })

        const expectedAppRows = getCatalogSystemAttributeSeedRecords().filter((seed) => seed.key.startsWith('app.')).length

        expect(mocks.insert).toHaveBeenCalledTimes(expectedAppRows)
        expect(
            mocks.insert.mock.calls.some((call) => typeof call[0]?.system_key === 'string' && String(call[0].system_key).startsWith('upl.'))
        ).toBe(false)
    })
})
