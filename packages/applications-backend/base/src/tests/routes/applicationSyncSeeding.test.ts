jest.mock('@universo/database', () => ({
    __esModule: true,
    getKnex: jest.fn(() => ({}))
}))

import type { Knex } from 'knex'
import type { EntityDefinition } from '@universo/schema-ddl'
import { seedPredefinedElements, syncEnumerationValues } from '../../routes/applicationSyncRoutes'

describe('application sync predefined seeding', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('deduplicates rows by id before ON CONFLICT upsert and emits warning', async () => {
        const merge = jest.fn().mockResolvedValue(undefined)
        const onConflict = jest.fn().mockReturnValue({ merge })
        const insert = jest.fn().mockReturnValue({ onConflict })
        const table = jest.fn().mockReturnValue({ insert })
        const withSchema = jest.fn().mockReturnValue({ table })

        const trx = {
            withSchema
        } as unknown as Knex.Transaction

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

        const entities = [
            {
                id: '019ccefc-2f7b-7b36-82f4-85cdb1312268',
                kind: 'catalog',
                codename: 'products',
                fields: []
            }
        ] as unknown as EntityDefinition[]

        const snapshot = {
            elements: {
                '019ccefc-2f7b-7b36-82f4-85cdb1312268': [
                    { id: 'elem-1', data: {} },
                    { id: 'elem-1', data: {} }
                ]
            }
        }

        const warnings = await seedPredefinedElements('app_019ccefc2f7b7b3682f485cdb1312268', snapshot as never, entities, 'user-1', trx)

        expect(withSchema).toHaveBeenCalled()
        expect(table).toHaveBeenCalled()
        expect(insert).toHaveBeenCalledTimes(1)

        const insertedRows = insert.mock.calls[0]?.[0] as Array<Record<string, unknown>>
        expect(insertedRows).toHaveLength(1)
        expect(insertedRows[0]?.id).toBe('elem-1')

        expect(onConflict).toHaveBeenCalledWith('id')
        expect(merge).toHaveBeenCalled()
        expect(warnings.some((warning) => warning.includes('Duplicate predefined element id "elem-1"'))).toBe(true)
        expect(warnSpy).toHaveBeenCalled()
    })

    it('preserves VLC enum codenames during runtime sync seeding', async () => {
        const existingSelectBuilder = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockResolvedValue([])
        }
        const softDeleteForeignObjectsBuilder = {
            whereNotIn: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            update: jest.fn().mockResolvedValue(0)
        }
        const softDeleteMissingValuesBuilder = {
            whereIn: jest.fn().mockReturnThis(),
            whereNotIn: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            update: jest.fn().mockResolvedValue(0)
        }
        const merge = jest.fn().mockResolvedValue(undefined)
        const onConflict = jest.fn().mockReturnValue({ merge })
        const insert = jest.fn().mockReturnValue({ onConflict })
        const insertBuilder = { insert }
        const table = jest
            .fn()
            .mockReturnValueOnce(existingSelectBuilder)
            .mockReturnValueOnce(softDeleteForeignObjectsBuilder)
            .mockReturnValueOnce(softDeleteMissingValuesBuilder)
            .mockReturnValueOnce(insertBuilder)
        const withSchema = jest.fn().mockReturnValue({ table })

        const trx = {
            withSchema
        } as unknown as Knex.Transaction

        const snapshot = {
            entities: {
                'enum-status': {
                    id: 'enum-status',
                    kind: 'enumeration'
                }
            },
            enumerationValues: {
                'enum-status': [
                    {
                        id: 'value-draft',
                        codename: {
                            _schema: 'vlc:1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'draft' },
                                ru: { content: 'черновик' }
                            }
                        },
                        presentation: {
                            name: { en: 'Draft' }
                        },
                        sortOrder: 1,
                        isDefault: true
                    },
                    {
                        id: 'value-published',
                        codename: {
                            _schema: 'vlc:1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'published' },
                                ru: { content: 'опубликовано' }
                            }
                        },
                        presentation: {
                            name: { en: 'Published' }
                        },
                        sortOrder: 2,
                        isDefault: false
                    }
                ]
            }
        }

        await syncEnumerationValues('app_test_schema', snapshot as never, 'user-1', trx)

        expect(withSchema).toHaveBeenCalledWith('app_test_schema')
        expect(insert).toHaveBeenCalledTimes(1)
        expect(onConflict).toHaveBeenCalledWith('id')
        expect(merge).toHaveBeenCalled()

        const insertedRows = insert.mock.calls[0]?.[0] as Array<Record<string, unknown>>
        expect(insertedRows).toHaveLength(2)
        expect(insertedRows[0]?.codename).toEqual({
            _schema: 'vlc:1',
            _primary: 'en',
            locales: {
                en: { content: 'draft' },
                ru: { content: 'черновик' }
            }
        })
        expect(insertedRows[1]?.codename).toEqual({
            _schema: 'vlc:1',
            _primary: 'en',
            locales: {
                en: { content: 'published' },
                ru: { content: 'опубликовано' }
            }
        })
    })
})
