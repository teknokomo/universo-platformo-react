import { getObjectSystemComponentSeedRecords } from '@universo/utils/database'
import { ensureObjectSystemComponentsSeed } from '../../domains/templates/services/systemComponentSeed'

const createSeedQueryBuilder = (
    existingRows: Array<{ id: string; system_key: string }> = [],
    policyRows: Array<{ key: string; value?: Record<string, unknown> | null }> = []
) => {
    const selectComponents = jest.fn(async () => existingRows)
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

        const where = jest.fn((criteria: { id?: string }) => (criteria.id ? { update } : { select: selectComponents }))
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
        mocks: { selectComponents, selectPolicy, update, insert, raw }
    }
}

describe('ensureObjectSystemComponentsSeed', () => {
    it('inserts the canonical shared system rows for a new object', async () => {
        const { qb, mocks } = createSeedQueryBuilder()

        const result = await ensureObjectSystemComponentsSeed(qb as never, 'mhb_test', 'object-1', 'user-1')

        expect(result).toEqual({ inserted: getObjectSystemComponentSeedRecords().length, updated: 0 })
        expect(mocks.insert).toHaveBeenCalledTimes(getObjectSystemComponentSeedRecords().length)
        expect(mocks.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                object_id: 'object-1',
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

        await ensureObjectSystemComponentsSeed(qb as never, 'mhb_test', 'object-1', 'user-1', {
            policy: {
                allowConfiguration: true,
                forceCreate: true,
                ignoreMetahubSettings: false
            }
        })

        expect(mocks.update).toHaveBeenCalled()
        expect(mocks.raw).toHaveBeenCalledWith('COALESCE(is_system_enabled, ?)', [true])
        expect(mocks.insert).toHaveBeenCalledTimes(getObjectSystemComponentSeedRecords().length - 1)
    })

    it('skips platform rows when policy does not force-create them and no explicit state exists', async () => {
        const { qb, mocks } = createSeedQueryBuilder()

        await ensureObjectSystemComponentsSeed(qb as never, 'mhb_test', 'object-1', 'user-1', {
            policy: {
                allowConfiguration: false,
                forceCreate: false,
                ignoreMetahubSettings: false
            }
        })

        const expectedAppRows = getObjectSystemComponentSeedRecords().filter((seed) => seed.key.startsWith('app.')).length

        expect(mocks.insert).toHaveBeenCalledTimes(expectedAppRows)
        expect(
            mocks.insert.mock.calls.some((call) => typeof call[0]?.system_key === 'string' && String(call[0].system_key).startsWith('upl.'))
        ).toBe(false)
    })
})
