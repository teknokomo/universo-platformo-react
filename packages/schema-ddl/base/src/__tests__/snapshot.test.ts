import { buildSchemaSnapshot, CURRENT_SCHEMA_SNAPSHOT_VERSION } from '../snapshot'
import type { EntityDefinition } from '../types'

describe('DDL Snapshot Utilities', () => {
    describe('CURRENT_SCHEMA_SNAPSHOT_VERSION', () => {
        it('should be defined and be a number', () => {
            expect(typeof CURRENT_SCHEMA_SNAPSHOT_VERSION).toBe('number')
            expect(CURRENT_SCHEMA_SNAPSHOT_VERSION).toBeGreaterThan(0)
        })
    })

    describe('buildSchemaSnapshot', () => {
        const createTestEntity = (overrides: Partial<EntityDefinition> = {}): EntityDefinition => ({
            id: 'entity-1111-2222-3333-444455556666',
            codename: 'test_entity',
            kind: 'catalog',
            fields: [],
            ...overrides
        })

        it('should create snapshot with correct version', () => {
            const snapshot = buildSchemaSnapshot([])
            expect(snapshot.version).toBe(CURRENT_SCHEMA_SNAPSHOT_VERSION)
        })

        it('should include generatedAt timestamp', () => {
            const before = new Date().toISOString()
            const snapshot = buildSchemaSnapshot([])
            const after = new Date().toISOString()

            expect(snapshot.generatedAt).toBeDefined()
            expect(snapshot.generatedAt >= before).toBe(true)
            expect(snapshot.generatedAt <= after).toBe(true)
        })

        it('should set hasSystemTables to true', () => {
            const snapshot = buildSchemaSnapshot([])
            expect(snapshot.hasSystemTables).toBe(true)
        })

        it('should return empty entities for empty input', () => {
            const snapshot = buildSchemaSnapshot([])
            expect(snapshot.entities).toEqual({})
        })

        it('should map entity correctly', () => {
            const entity = createTestEntity({
                id: 'e1-0000-0000-0000-000000000001',
                codename: 'my_catalog',
                kind: 'catalog'
            })

            const snapshot = buildSchemaSnapshot([entity])

            expect(snapshot.entities['e1-0000-0000-0000-000000000001']).toBeDefined()
            const snapshotEntity = snapshot.entities['e1-0000-0000-0000-000000000001']
            expect(snapshotEntity.codename).toBe('my_catalog')
            expect(snapshotEntity.kind).toBe('catalog')
            // Table name is 'cat_' + ID with hyphens removed
            expect(snapshotEntity.tableName).toBe('cat_e1000000000000000000000001')
        })

        it('should generate correct table names for different entity kinds', () => {
            const entities: EntityDefinition[] = [
                createTestEntity({ id: 'cat-0000-0000-0000-000000000001', kind: 'catalog' }),
                createTestEntity({ id: 'hub-0000-0000-0000-000000000002', kind: 'hub' }),
                createTestEntity({ id: 'doc-0000-0000-0000-000000000003', kind: 'document' })
            ]

            const snapshot = buildSchemaSnapshot(entities)

            expect(snapshot.entities['cat-0000-0000-0000-000000000001'].tableName).toMatch(/^cat_/)
            expect(snapshot.entities['hub-0000-0000-0000-000000000002'].tableName).toMatch(/^hub_/)
            expect(snapshot.entities['doc-0000-0000-0000-000000000003'].tableName).toMatch(/^doc_/)
        })

        it('should map fields correctly', () => {
            const entity = createTestEntity({
                fields: [
                    {
                        id: 'field-1111-2222-3333-444455556666',
                        codename: 'title',
                        dataType: 'text',
                        isRequired: true
                    },
                    {
                        id: 'field-2222-3333-4444-555566667777',
                        codename: 'count',
                        dataType: 'integer',
                        isRequired: false
                    }
                ]
            })

            const snapshot = buildSchemaSnapshot([entity])
            const fields = snapshot.entities[entity.id].fields

            expect(Object.keys(fields)).toHaveLength(2)

            const titleField = fields['field-1111-2222-3333-444455556666']
            expect(titleField.codename).toBe('title')
            expect(titleField.dataType).toBe('text')
            expect(titleField.isRequired).toBe(true)
            // Column name is 'attr_' + ID with hyphens removed
            expect(titleField.columnName).toBe('attr_field111122223333444455556666')

            const countField = fields['field-2222-3333-4444-555566667777']
            expect(countField.codename).toBe('count')
            expect(countField.dataType).toBe('integer')
            expect(countField.isRequired).toBe(false)
        })

        it('should handle field with targetEntityId (foreign key)', () => {
            const entity = createTestEntity({
                fields: [
                    {
                        id: 'fk-field-1111-2222-333344445555',
                        codename: 'parent_ref',
                        dataType: 'reference',
                        targetEntityId: 'target-entity-1111-222233334444'
                    }
                ]
            })

            const snapshot = buildSchemaSnapshot([entity])
            const fkField = snapshot.entities[entity.id].fields['fk-field-1111-2222-333344445555']

            expect(fkField.targetEntityId).toBe('target-entity-1111-222233334444')
        })

        it('should set targetEntityId to null when not provided', () => {
            const entity = createTestEntity({
                fields: [
                    {
                        id: 'regular-field-1111-22223333444455',
                        codename: 'description',
                        dataType: 'text'
                    }
                ]
            })

            const snapshot = buildSchemaSnapshot([entity])
            const field = snapshot.entities[entity.id].fields['regular-field-1111-22223333444455']

            expect(field.targetEntityId).toBeNull()
        })

        it('should handle multiple entities with multiple fields', () => {
            const entities: EntityDefinition[] = [
                createTestEntity({
                    id: 'entity-a-0000-0000-000000000001',
                    codename: 'entity_a',
                    kind: 'catalog',
                    fields: [
                        { id: 'field-a1', codename: 'a1', dataType: 'text' },
                        { id: 'field-a2', codename: 'a2', dataType: 'integer' }
                    ]
                }),
                createTestEntity({
                    id: 'entity-b-0000-0000-000000000002',
                    codename: 'entity_b',
                    kind: 'hub',
                    fields: [{ id: 'field-b1', codename: 'b1', dataType: 'boolean' }]
                })
            ]

            const snapshot = buildSchemaSnapshot(entities)

            expect(Object.keys(snapshot.entities)).toHaveLength(2)
            expect(Object.keys(snapshot.entities['entity-a-0000-0000-000000000001'].fields)).toHaveLength(2)
            expect(Object.keys(snapshot.entities['entity-b-0000-0000-000000000002'].fields)).toHaveLength(1)
        })

        describe('TABLE attribute (childFields)', () => {
            it('should store TABLE field with tabular table name in columnName', () => {
                const entity = createTestEntity({
                    id: 'entity-t-0000-0000-000000000001',
                    codename: 'orders',
                    kind: 'catalog',
                    fields: [
                        {
                            id: 'table-attr-1111-2222-333344445555',
                            codename: 'order_items',
                            dataType: 'TABLE',
                            isRequired: false
                        }
                    ]
                })

                const snapshot = buildSchemaSnapshot([entity])
                const field = snapshot.entities['entity-t-0000-0000-000000000001'].fields['table-attr-1111-2222-333344445555']

                expect(field).toBeDefined()
                expect(field.dataType).toBe('TABLE')
                // columnName for TABLE is the child table name: tbl_{cleanAttrId}
                expect(field.columnName).toContain('tbl_')
                expect(field.columnName).toBe('tbl_tableattr11112222333344445555')
            })

            it('should nest child fields inside TABLE field as childFields', () => {
                const entity = createTestEntity({
                    id: 'entity-t-0000-0000-000000000001',
                    codename: 'orders',
                    kind: 'catalog',
                    fields: [
                        {
                            id: 'table-attr-1111-2222-333344445555',
                            codename: 'order_items',
                            dataType: 'TABLE',
                            isRequired: false
                        },
                        {
                            id: 'child-field-aaaa-bbbb-ccccddddeeee',
                            codename: 'quantity',
                            dataType: 'integer',
                            isRequired: true,
                            parentAttributeId: 'table-attr-1111-2222-333344445555'
                        },
                        {
                            id: 'child-field-ffff-0000-111122223333',
                            codename: 'price',
                            dataType: 'decimal',
                            isRequired: false,
                            parentAttributeId: 'table-attr-1111-2222-333344445555'
                        }
                    ]
                })

                const snapshot = buildSchemaSnapshot([entity])
                const tableField = snapshot.entities['entity-t-0000-0000-000000000001'].fields['table-attr-1111-2222-333344445555']

                expect(tableField.childFields).toBeDefined()
                expect(Object.keys(tableField.childFields!)).toHaveLength(2)

                const qtyChild = tableField.childFields!['child-field-aaaa-bbbb-ccccddddeeee']
                expect(qtyChild.codename).toBe('quantity')
                expect(qtyChild.dataType).toBe('integer')
                expect(qtyChild.isRequired).toBe(true)
                expect(qtyChild.columnName).toBe('attr_childfieldaaaabbbbccccddddeeee')

                const priceChild = tableField.childFields!['child-field-ffff-0000-111122223333']
                expect(priceChild.codename).toBe('price')
                expect(priceChild.dataType).toBe('decimal')
                expect(priceChild.isRequired).toBe(false)
            })

            it('should not include child fields at top level of entity fields', () => {
                const entity = createTestEntity({
                    id: 'entity-t-0000-0000-000000000001',
                    codename: 'orders',
                    kind: 'catalog',
                    fields: [
                        {
                            id: 'table-attr-1111-2222-333344445555',
                            codename: 'order_items',
                            dataType: 'TABLE',
                            isRequired: false
                        },
                        {
                            id: 'child-field-aaaa-bbbb-ccccddddeeee',
                            codename: 'quantity',
                            dataType: 'integer',
                            isRequired: true,
                            parentAttributeId: 'table-attr-1111-2222-333344445555'
                        }
                    ]
                })

                const snapshot = buildSchemaSnapshot([entity])
                const entityFields = snapshot.entities['entity-t-0000-0000-000000000001'].fields

                // Only TABLE field at top level, child is nested
                expect(Object.keys(entityFields)).toHaveLength(1)
                expect(entityFields['child-field-aaaa-bbbb-ccccddddeeee']).toBeUndefined()
                expect(entityFields['table-attr-1111-2222-333344445555'].childFields).toBeDefined()
            })

            it('should omit childFields when TABLE attribute has no children', () => {
                const entity = createTestEntity({
                    id: 'entity-t-0000-0000-000000000001',
                    codename: 'orders',
                    kind: 'catalog',
                    fields: [
                        {
                            id: 'table-attr-1111-2222-333344445555',
                            codename: 'order_items',
                            dataType: 'TABLE',
                            isRequired: false
                        }
                    ]
                })

                const snapshot = buildSchemaSnapshot([entity])
                const tableField = snapshot.entities['entity-t-0000-0000-000000000001'].fields['table-attr-1111-2222-333344445555']

                // childFields should be omitted (not set to empty object)
                expect(tableField.childFields).toBeUndefined()
            })
        })
    })
})
