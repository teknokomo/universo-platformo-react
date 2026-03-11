import { AttributeDataType } from '@universo/types'
import { SchemaMigrator } from '../SchemaMigrator'
import { ChangeType } from '../diff'
import type { SchemaChange } from '../diff'
import type { EntityDefinition, FieldDefinition } from '../types'

const mockAcquireAdvisoryLock = jest.fn().mockResolvedValue(true)
const mockReleaseAdvisoryLock = jest.fn().mockResolvedValue(undefined)

jest.mock('../locking', () => ({
    uuidToLockKey: jest.fn(() => 123),
    acquireAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releaseAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args)
}))

describe('SchemaMigrator', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockAcquireAdvisoryLock.mockResolvedValue(true)
        mockReleaseAdvisoryLock.mockResolvedValue(undefined)
    })

    it('routes REF->enumeration foreign keys to _app_values', async () => {
        const trx = {
            raw: jest.fn().mockResolvedValue(undefined)
        } as unknown as import('knex').Knex.Transaction

        const generator = {
            ensureSystemTables: jest.fn().mockResolvedValue(undefined)
        } as unknown as import('../SchemaGenerator').SchemaGenerator

        const migrator = new SchemaMigrator({} as import('knex').Knex, generator, {} as import('../MigrationManager').MigrationManager)

        const field: FieldDefinition = {
            id: 'field-ref-0000-0000-0000-000000000001',
            codename: 'status',
            dataType: AttributeDataType.REF,
            isRequired: false,
            targetEntityId: 'enum-0000-0000-0000-000000000001',
            targetEntityKind: 'enumeration'
        }
        const entities: EntityDefinition[] = [
            {
                id: 'catalog-0000-0000-0000-000000000001',
                codename: 'orders',
                kind: 'catalog',
                fields: [field]
            }
        ]

        const change: SchemaChange = {
            type: ChangeType.ADD_FK,
            entityId: entities[0].id,
            fieldId: field.id,
            tableName: 'cat_orders',
            columnName: 'attr_status',
            newValue: field.targetEntityId,
            isDestructive: false,
            description: 'Add FK on "status"'
        }

        const applyChange = Reflect.get(migrator as object, 'applyChange') as (
            schemaName: string,
            change: SchemaChange,
            entities: EntityDefinition[],
            trx: import('knex').Knex.Transaction
        ) => Promise<void>

        await applyChange.call(migrator, 'app_test_schema', change, entities, trx)

        expect(generator.ensureSystemTables).toHaveBeenCalledWith('app_test_schema', trx)
        expect(trx.raw).toHaveBeenCalledWith(
            'ALTER TABLE ??.?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ??.??(id) ON DELETE SET NULL',
            ['app_test_schema', 'cat_orders', 'fk_cat_orders_attr_status', 'attr_status', 'app_test_schema', '_app_values']
        )
    })

    it('skips physical FK creation for REF->set fields', async () => {
        const trx = {
            raw: jest.fn().mockResolvedValue(undefined)
        } as unknown as import('knex').Knex.Transaction

        const generator = {
            ensureSystemTables: jest.fn().mockResolvedValue(undefined)
        } as unknown as import('../SchemaGenerator').SchemaGenerator

        const migrator = new SchemaMigrator({} as import('knex').Knex, generator, {} as import('../MigrationManager').MigrationManager)

        const field: FieldDefinition = {
            id: 'field-ref-0000-0000-0000-000000000002',
            codename: 'version',
            dataType: AttributeDataType.REF,
            isRequired: false,
            targetEntityId: 'set-0000-0000-0000-000000000001',
            targetEntityKind: 'set'
        }
        const entities: EntityDefinition[] = [
            {
                id: 'catalog-0000-0000-0000-000000000001',
                codename: 'orders',
                kind: 'catalog',
                fields: [field]
            }
        ]

        const change: SchemaChange = {
            type: ChangeType.ADD_FK,
            entityId: entities[0].id,
            fieldId: field.id,
            tableName: 'cat_orders',
            columnName: 'attr_version',
            newValue: field.targetEntityId,
            isDestructive: false,
            description: 'Add FK on "version"'
        }

        const applyChange = Reflect.get(migrator as object, 'applyChange') as (
            schemaName: string,
            change: SchemaChange,
            entities: EntityDefinition[],
            trx: import('knex').Knex.Transaction
        ) => Promise<void>

        await applyChange.call(migrator, 'app_test_schema', change, entities, trx)

        expect(generator.ensureSystemTables).not.toHaveBeenCalled()
        expect(trx.raw).not.toHaveBeenCalled()
    })

    it('runs afterMigrationRecorded inside the same transaction after migration history is persisted', async () => {
        const trx = {
            raw: jest.fn().mockResolvedValue(undefined)
        } as unknown as import('knex').Knex.Transaction

        const localKnex = {
            transaction: jest.fn(async (callback: (innerTrx: import('knex').Knex.Transaction) => Promise<void>) => {
                await callback(trx)
            })
        } as unknown as import('knex').Knex

        const generator = {
            syncSystemMetadata: jest.fn().mockResolvedValue(undefined),
            generateSnapshot: jest.fn().mockReturnValue({
                version: 3,
                generatedAt: '2026-03-09T00:00:00.000Z',
                hasSystemTables: true,
                entities: {}
            })
        } as unknown as import('../SchemaGenerator').SchemaGenerator

        const recordMigration = jest.fn().mockResolvedValue('migration-id')
        const migrationManager = {
            getLatestMigration: jest.fn().mockResolvedValue(null),
            recordMigration
        } as unknown as import('../MigrationManager').MigrationManager

        const migrator = new SchemaMigrator(localKnex, generator, migrationManager)
        const applyChangeMock = jest.fn().mockResolvedValue(undefined)
        Reflect.set(migrator as object, 'applyChange', applyChangeMock)

        const afterMigrationRecorded = jest.fn().mockResolvedValue(undefined)
        const result = await migrator.applyAllChanges(
            'app_test_schema',
            {
                hasChanges: true,
                additive: [
                    {
                        type: ChangeType.ADD_TABLE,
                        entityCodename: 'products',
                        tableName: 'cat_products',
                        isDestructive: false,
                        description: 'Create table "products"'
                    }
                ],
                destructive: [],
                summary: '1 additive change'
            },
            [],
            true,
            {
                recordMigration: true,
                afterMigrationRecorded
            }
        )

        expect(result.success).toBe(true)
        expect(recordMigration).toHaveBeenCalledTimes(1)
        expect(afterMigrationRecorded).toHaveBeenCalledWith(
            expect.objectContaining({
                trx,
                schemaName: 'app_test_schema',
                snapshotBefore: null,
                migrationName: expect.stringMatching(/^\d{8}_\d{6}_schema_sync$/),
                migrationId: 'migration-id',
                snapshotAfter: expect.objectContaining({
                    version: 3,
                    entities: {}
                }),
                diff: expect.objectContaining({
                    summary: '1 additive change'
                })
            })
        )
        expect(recordMigration.mock.invocationCallOrder[0]).toBeLessThan(afterMigrationRecorded.mock.invocationCallOrder[0])
        expect(applyChangeMock).toHaveBeenCalledTimes(1)
    })
})
