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

const readCodenameText = (value: unknown): string => {
    if (!value || typeof value !== 'object') {
        return ''
    }

    const raw = value as {
        _primary?: unknown
        locales?: Record<string, { content?: unknown }>
    }
    const primaryLocale = typeof raw._primary === 'string' ? raw._primary : 'en'
    const primaryContent = raw.locales?.[primaryLocale]?.content
    if (typeof primaryContent === 'string') {
        return primaryContent
    }

    const firstContent = Object.values(raw.locales ?? {}).find((entry) => typeof entry?.content === 'string')?.content
    return typeof firstContent === 'string' ? firstContent : ''
}

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
        const codenameConfig = resolveTemplateSeedCodenameConfig(basicTemplate.seed.settings)
        const localizedCodename = buildTemplateSeedEntityCodenameValue(
            'MainHub',
            {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: {
                        content: 'Main',
                        version: 1,
                        isActive: true,
                        createdAt: '1970-01-01T00:00:00.000Z',
                        updatedAt: '1970-01-01T00:00:00.000Z'
                    },
                    ru: {
                        content: 'Основной',
                        version: 1,
                        isActive: true,
                        createdAt: '1970-01-01T00:00:00.000Z',
                        updatedAt: '1970-01-01T00:00:00.000Z'
                    }
                }
            },
            codenameConfig
        )

        expect(localizedCodename?.locales?.en?.content).toBe('Main')
        expect(localizedCodename?.locales?.ru?.content).toBe('Основной')
    })

    it('remaps seeded hub references after all entities are inserted', async () => {
        const objectRows = new Map<string, { id: string; kind: string; codename: unknown; config: Record<string, unknown> }>()
        let nextId = 1

        const createObjectQuery = () => {
            const conditions: Array<Record<string, unknown>> = []
            let codenameFilter: string | null = null

            return {
                where(whereInput: Record<string, unknown>) {
                    conditions.push(whereInput)
                    return this
                },
                whereRaw(_sql: string, params: unknown[]) {
                    codenameFilter = typeof params[0] === 'string' ? params[0] : null
                    return this
                },
                async first() {
                    const idFilter = conditions.find((entry) => typeof entry.id === 'string')?.id as string | undefined
                    if (idFilter) {
                        return objectRows.get(idFilter)
                    }

                    const kindFilter = conditions.find((entry) => typeof entry.kind === 'string')?.kind as string | undefined
                    if (!kindFilter || !codenameFilter) {
                        return undefined
                    }

                    return Array.from(objectRows.values()).find(
                        (row) => row.kind === kindFilter && readCodenameText(row.codename) === codenameFilter
                    )
                },
                async update(patch: Record<string, unknown>) {
                    const idFilter = conditions.find((entry) => typeof entry.id === 'string')?.id as string | undefined
                    if (!idFilter) {
                        return 0
                    }

                    const row = objectRows.get(idFilter)
                    if (!row) {
                        return 0
                    }

                    objectRows.set(idFilter, {
                        ...row,
                        config: (patch.config as Record<string, unknown>) ?? row.config
                    })

                    return 1
                }
            }
        }

        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn((tableName: string) => {
                    if (tableName === '_mhb_objects') {
                        return createObjectQuery()
                    }

                    throw new Error(`Unexpected table read: ${tableName}`)
                }),
                into: jest.fn((tableName: string) => {
                    if (tableName !== '_mhb_objects') {
                        throw new Error(`Unexpected table insert: ${tableName}`)
                    }

                    return {
                        insert: (payload: Record<string, unknown>) => ({
                            returning: async () => {
                                const id = `generated-id-${nextId++}`
                                objectRows.set(id, {
                                    id,
                                    kind: payload.kind as string,
                                    codename: payload.codename,
                                    config: (payload.config as Record<string, unknown>) ?? {}
                                })
                                return [{ id }]
                            }
                        })
                    }
                })
            }))
        }

        const executor = new TemplateSeedExecutor({} as never, 'mhb_tx_scope')
        const entityIdMap = await (executor as any).createEntities(
            trx,
            [
                {
                    codename: 'MainHub',
                    kind: 'hub',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main' } } }
                },
                {
                    codename: 'MainSet',
                    kind: 'set',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main Set' } } },
                    hubs: ['MainHub']
                }
            ],
            {
                style: 'pascal-case',
                alphabet: 'en-ru',
                localizedEnabled: true
            }
        )

        expect(entityIdMap.get('hub:MainHub')).toBe('generated-id-1')
        expect(entityIdMap.get('set:MainSet')).toBe('generated-id-2')
        expect(objectRows.get('generated-id-2')?.config).toEqual({
            sortOrder: 1,
            hubs: ['generated-id-1']
        })
    })
})
