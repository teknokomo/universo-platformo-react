import { AttributeDataType } from '@universo/types'
import { SchemaMigrator } from '../SchemaMigrator'
import { ChangeType } from '../diff'
import type { SchemaChange } from '../diff'
import type { EntityDefinition, FieldDefinition } from '../types'

describe('SchemaMigrator', () => {
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
})
