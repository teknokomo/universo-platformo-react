jest.mock('@universo-react/database', () => ({
    __esModule: true,
    getKnex: jest.fn(() => ({})),
    qSchemaTable: jest.requireActual('@universo-react/database').qSchemaTable
}))

import type { Knex } from 'knex'
import type { EntityDefinition } from '@universo-react/schema-ddl'
import { seedPredefinedElements, syncEnumerationValues } from '../../routes/applicationSyncRoutes'

describe('application sync predefined seeding', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('rejects duplicate predefined ids before any runtime row write', async () => {
        const merge = jest.fn().mockResolvedValue(undefined)
        const onConflict = jest.fn().mockReturnValue({ merge })
        const insert = jest.fn().mockReturnValue({ onConflict })
        const table = jest.fn().mockReturnValue({ insert })
        const withSchema = jest.fn().mockReturnValue({ table })

        const trx = {
            withSchema
        } as unknown as Knex.Transaction

        const entities = [
            {
                id: '019ccefc-2f7b-7b36-82f4-85cdb1312268',
                kind: 'object',
                codename: 'products',
                fields: []
            }
        ] as unknown as EntityDefinition[]

        const snapshot = {
            elements: {
                '019ccefc-2f7b-7b36-82f4-85cdb1312268': [
                    { id: '019ccefc-2f7b-7b39-82f4-85cdb131226b', data: {} },
                    { id: '019ccefc-2f7b-7b39-82f4-85cdb131226b', data: {} }
                ]
            }
        }

        await expect(
            seedPredefinedElements('app_019ccefc2f7b7b3682f485cdb1312268', snapshot as never, entities, 'user-1', trx)
        ).rejects.toThrow('Duplicate predefined element id must be rejected before writing')

        expect(withSchema).not.toHaveBeenCalled()
        expect(table).not.toHaveBeenCalled()
        expect(insert).not.toHaveBeenCalled()
        expect(onConflict).not.toHaveBeenCalled()
        expect(merge).not.toHaveBeenCalled()
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
            optionValues: {
                'enum-status': [
                    {
                        id: '019ccefc-2f7b-7b3a-82f4-85cdb131226c',
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
                        id: '019ccefc-2f7b-7b3b-82f4-85cdb131226d',
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

    it('rejects non-UUID-v7 enumeration ids before writing runtime values', async () => {
        const trx = {
            withSchema: jest.fn()
        } as unknown as Knex.Transaction

        await expect(
            syncEnumerationValues(
                'app_test_schema',
                {
                    entities: {
                        'enum-status': { id: 'enum-status', kind: 'enumeration' }
                    },
                    optionValues: {
                        'enum-status': [{ id: 'value-v4', codename: 'Draft' }]
                    }
                } as never,
                'user-1',
                trx
            )
        ).rejects.toThrow('Snapshot enumeration value id must be a UUID v7')
    })

    it('rejects non-UUID-v7 predefined element ids before writing runtime rows', async () => {
        const trx = {
            withSchema: jest.fn()
        } as unknown as Knex.Transaction
        const entity = {
            id: '019ccefc-2f7b-7b36-82f4-85cdb1312268',
            kind: 'object',
            codename: 'products',
            fields: []
        } as unknown as EntityDefinition

        await expect(
            seedPredefinedElements(
                'app_019ccefc2f7b7b3682f485cdb1312268',
                {
                    elements: {
                        [entity.id]: [{ id: 'element-v4', data: {} }]
                    }
                } as never,
                [entity],
                'user-1',
                trx
            )
        ).rejects.toThrow('Snapshot predefined element id must be a UUID v7')
    })
})
