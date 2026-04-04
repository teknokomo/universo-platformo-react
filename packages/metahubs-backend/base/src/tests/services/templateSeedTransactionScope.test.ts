jest.mock('../../domains/templates/services/widgetTableResolver', () => ({
    __esModule: true,
    resolveWidgetTableName: jest.fn(async () => '_mhb_widgets')
}))

import {
    TemplateSeedExecutor,
    buildTemplateSeedEntityCodenameValue,
    resolveTemplateSeedCodenameConfig
} from '../../domains/templates/services/TemplateSeedExecutor'
import { TemplateSeedMigrator } from '../../domains/templates/services/TemplateSeedMigrator'
import { resolveWidgetTableName } from '../../domains/templates/services/widgetTableResolver'
import { basicTemplate } from '../../domains/templates/data/basic.template'

describe('Template seed services transaction scope', () => {
    const mockedResolveWidgetTableName = resolveWidgetTableName as jest.MockedFunction<typeof resolveWidgetTableName>

    beforeEach(() => {
        mockedResolveWidgetTableName.mockClear()
    })

    it('uses active transaction when resolving widget table in TemplateSeedExecutor', async () => {
        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn(),
                into: jest.fn()
            }))
        }

        const knex = {
            transaction: jest.fn(async (callback: (tx: typeof trx) => Promise<void>) => callback(trx))
        }

        const executor = new TemplateSeedExecutor(knex as never, 'mhb_tx_scope')
        await executor.apply({
            layouts: [],
            layoutZoneWidgets: {}
        })

        expect(mockedResolveWidgetTableName).toHaveBeenCalledWith(trx, 'mhb_tx_scope')
    })

    it('uses active transaction when resolving widget table in TemplateSeedMigrator', async () => {
        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn(() => ({
                    where: jest.fn(() => ({
                        first: jest.fn(async () => ({ id: 'layout-existing-id' }))
                    })),
                    select: jest.fn(async () => []),
                    update: jest.fn(async () => 0)
                })),
                into: jest.fn(() => ({
                    insert: jest.fn(async () => [{ id: 'layout-inserted-id' }])
                }))
            }))
        }

        const knex = {
            transaction: jest.fn(async (callback: (tx: typeof trx) => Promise<void>) => callback(trx))
        }

        const migrator = new TemplateSeedMigrator(knex as never, 'mhb_tx_scope')
        await migrator.migrateSeed({
            layouts: [
                {
                    codename: 'dashboard',
                    templateKey: 'dashboard.default',
                    name: {} as never,
                    isActive: true,
                    isDefault: false,
                    sortOrder: 10
                }
            ],
            layoutZoneWidgets: {
                dashboard: []
            }
        })

        expect(mockedResolveWidgetTableName).toHaveBeenCalledWith(trx, 'mhb_tx_scope')
    })

    it('builds localized codename locales for seeded default entities when localized names exist', () => {
        const entity = basicTemplate.seed.entities?.find((item) => item.codename === 'MainHub')
        expect(entity).toBeTruthy()

        const codenameConfig = resolveTemplateSeedCodenameConfig(basicTemplate.seed.settings)
        const localizedCodename = buildTemplateSeedEntityCodenameValue(entity!.codename, entity!.name, codenameConfig)

        expect(localizedCodename?.locales?.en?.content).toBe('Main')
        expect(localizedCodename?.locales?.ru?.content).toBe('Основной')
    })
})
