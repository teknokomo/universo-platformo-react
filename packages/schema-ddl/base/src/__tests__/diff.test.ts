import { calculateSchemaDiff, ChangeType } from '../diff'
import type { EntityDefinition, SchemaSnapshot } from '../types'

describe('DDL Diff Utilities', () => {
    describe('calculateSchemaDiff', () => {
        const createTestEntity = (overrides: Partial<EntityDefinition> = {}): EntityDefinition => ({
            id: 'entity-1111-2222-3333-444455556666',
            codename: 'test_entity',
            kind: 'catalog',
            fields: [],
            ...overrides
        })

        const createTestSnapshot = (entities: Partial<Record<string, SchemaSnapshot['entities'][string]>> = {}): SchemaSnapshot => ({
            applicationId: 'app-1111-2222-3333-444455556666',
            schemaName: 'app_test',
            snapshotVersion: 1,
            createdAt: new Date().toISOString(),
            entities: {
                'entity-1111-2222-3333-444455556666': {
                    codename: 'test_entity',
                    kind: 'catalog',
                    tableName: 'cat_entity1111222233334444',
                    fields: {}
                },
                ...entities
            }
        })

        describe('when oldSnapshot is null (initial deployment)', () => {
            it('should return all entities as ADD_TABLE changes', () => {
                const entities: EntityDefinition[] = [
                    createTestEntity({ id: 'e1-0000-0000-0000-000000000001', codename: 'entity_a', kind: 'catalog' }),
                    createTestEntity({ id: 'e2-0000-0000-0000-000000000002', codename: 'entity_b', kind: 'hub' })
                ]

                const diff = calculateSchemaDiff(null, entities)

                expect(diff.hasChanges).toBe(true)
                expect(diff.additive).toHaveLength(2)
                expect(diff.destructive).toHaveLength(0)
                expect(diff.additive[0].type).toBe(ChangeType.ADD_TABLE)
                expect(diff.additive[1].type).toBe(ChangeType.ADD_TABLE)
            })

            it('should return no changes for empty entities array', () => {
                const diff = calculateSchemaDiff(null, [])

                expect(diff.hasChanges).toBe(false)
                expect(diff.additive).toHaveLength(0)
                expect(diff.destructive).toHaveLength(0)
                expect(diff.summary).toBe('0 new table(s)')
            })
        })

        describe('when comparing with existing snapshot', () => {
            it('should ignore enumeration entities for physical DDL diff', () => {
                const snapshot = createTestSnapshot({
                    'enum-entity-1111-2222-333344445555': {
                        codename: 'order_status',
                        kind: 'enumeration',
                        tableName: 'enum_entity11112222333344445555',
                        fields: {}
                    }
                })
                const entities: EntityDefinition[] = [createTestEntity()]

                const diff = calculateSchemaDiff(snapshot, entities)

                expect(diff.hasChanges).toBe(false)
                expect(diff.additive).toHaveLength(0)
                expect(diff.destructive).toHaveLength(0)
            })

            it('should detect new tables', () => {
                const snapshot = createTestSnapshot()
                const entities: EntityDefinition[] = [
                    createTestEntity(), // existing
                    createTestEntity({
                        id: 'new-entity-1111-2222-333344445555',
                        codename: 'new_entity',
                        kind: 'hub'
                    })
                ]

                const diff = calculateSchemaDiff(snapshot, entities)

                expect(diff.hasChanges).toBe(true)
                expect(diff.additive).toHaveLength(1)
                expect(diff.additive[0].type).toBe(ChangeType.ADD_TABLE)
                expect(diff.additive[0].entityCodename).toBe('new_entity')
                expect(diff.additive[0].isDestructive).toBe(false)
            })

            it('should detect dropped tables (destructive)', () => {
                const snapshot = createTestSnapshot({
                    'entity-to-delete-2222-333344445555': {
                        codename: 'old_entity',
                        kind: 'document',
                        tableName: 'doc_entitytodelete2222333344445555',
                        fields: {}
                    }
                })
                const entities: EntityDefinition[] = [createTestEntity()] // only existing, missing old_entity

                const diff = calculateSchemaDiff(snapshot, entities)

                expect(diff.hasChanges).toBe(true)
                expect(diff.destructive).toHaveLength(1)
                expect(diff.destructive[0].type).toBe(ChangeType.DROP_TABLE)
                expect(diff.destructive[0].entityCodename).toBe('old_entity')
                expect(diff.destructive[0].isDestructive).toBe(true)
            })

            it('should detect new columns', () => {
                const snapshot = createTestSnapshot()
                const entities: EntityDefinition[] = [
                    createTestEntity({
                        fields: [
                            {
                                id: 'field-1111-2222-3333-444455556666',
                                codename: 'new_field',
                                dataType: 'text'
                            }
                        ]
                    })
                ]

                const diff = calculateSchemaDiff(snapshot, entities)

                expect(diff.hasChanges).toBe(true)
                expect(diff.additive).toHaveLength(1)
                expect(diff.additive[0].type).toBe(ChangeType.ADD_COLUMN)
                expect(diff.additive[0].fieldCodename).toBe('new_field')
            })

            it('should detect dropped columns (destructive)', () => {
                const snapshotWithField = createTestSnapshot()
                snapshotWithField.entities['entity-1111-2222-3333-444455556666'].fields = {
                    'field-to-delete-1111-222233334444': {
                        codename: 'old_field',
                        columnName: 'attr_fieldtodelete1111222233334444',
                        dataType: 'text'
                    }
                }

                const entities: EntityDefinition[] = [createTestEntity({ fields: [] })] // field removed

                const diff = calculateSchemaDiff(snapshotWithField, entities)

                expect(diff.hasChanges).toBe(true)
                expect(diff.destructive).toHaveLength(1)
                expect(diff.destructive[0].type).toBe(ChangeType.DROP_COLUMN)
                expect(diff.destructive[0].fieldCodename).toBe('old_field')
                expect(diff.destructive[0].isDestructive).toBe(true)
            })

            it('should handle entity kind change (destructive drop + additive create)', () => {
                const snapshot = createTestSnapshot()
                const entities: EntityDefinition[] = [
                    createTestEntity({ kind: 'hub' }) // changed from 'catalog' to 'hub'
                ]

                const diff = calculateSchemaDiff(snapshot, entities)

                expect(diff.hasChanges).toBe(true)
                // Kind change results in drop + create
                expect(diff.destructive.some((c) => c.type === ChangeType.DROP_TABLE)).toBe(true)
                expect(diff.additive.some((c) => c.type === ChangeType.ADD_TABLE)).toBe(true)
            })

            it('should detect no changes when entities are identical', () => {
                const snapshot = createTestSnapshot()
                const entities: EntityDefinition[] = [createTestEntity()]

                const diff = calculateSchemaDiff(snapshot, entities)

                expect(diff.hasChanges).toBe(false)
                expect(diff.additive).toHaveLength(0)
                expect(diff.destructive).toHaveLength(0)
            })
        })

        describe('summary generation', () => {
            it('should generate summary for additive changes only', () => {
                const entities: EntityDefinition[] = [createTestEntity()]
                const diff = calculateSchemaDiff(null, entities)

                expect(diff.summary).toContain('1 new table')
            })

            it('should generate summary for mixed changes', () => {
                const snapshot = createTestSnapshot({
                    'entity-to-delete-2222-333344445555': {
                        codename: 'old_entity',
                        kind: 'document',
                        tableName: 'doc_entitytodelete',
                        fields: {}
                    }
                })
                const entities: EntityDefinition[] = [
                    createTestEntity(),
                    createTestEntity({
                        id: 'new-entity-1111-2222-333344445555',
                        codename: 'new_entity'
                    })
                ]

                const diff = calculateSchemaDiff(snapshot, entities)

                expect(diff.summary).toContain('additive')
                expect(diff.summary).toContain('DESTRUCTIVE')
            })
        })
    })

    describe('ChangeType enum', () => {
        it('should have all expected change types', () => {
            expect(ChangeType.ADD_TABLE).toBe('ADD_TABLE')
            expect(ChangeType.DROP_TABLE).toBe('DROP_TABLE')
            expect(ChangeType.ADD_COLUMN).toBe('ADD_COLUMN')
            expect(ChangeType.DROP_COLUMN).toBe('DROP_COLUMN')
            expect(ChangeType.ALTER_COLUMN).toBe('ALTER_COLUMN')
            expect(ChangeType.ADD_FK).toBe('ADD_FK')
            expect(ChangeType.DROP_FK).toBe('DROP_FK')
        })

        it('should have tabular change types', () => {
            expect(ChangeType.ADD_TABULAR_TABLE).toBe('ADD_TABULAR_TABLE')
            expect(ChangeType.DROP_TABULAR_TABLE).toBe('DROP_TABULAR_TABLE')
            expect(ChangeType.ADD_TABULAR_COLUMN).toBe('ADD_TABULAR_COLUMN')
            expect(ChangeType.DROP_TABULAR_COLUMN).toBe('DROP_TABULAR_COLUMN')
            expect(ChangeType.ALTER_TABULAR_COLUMN).toBe('ALTER_TABULAR_COLUMN')
        })
    })

    describe('tabular (TABLE attribute) diff', () => {
        const createTestEntity = (overrides: Partial<EntityDefinition> = {}): EntityDefinition => ({
            id: 'entity-1111-2222-3333-444455556666',
            codename: 'test_entity',
            kind: 'catalog',
            fields: [],
            ...overrides
        })

        const createTestSnapshot = (entities: Partial<Record<string, SchemaSnapshot['entities'][string]>> = {}): SchemaSnapshot => ({
            applicationId: 'app-1111-2222-3333-444455556666',
            schemaName: 'app_test',
            snapshotVersion: 1,
            createdAt: new Date().toISOString(),
            entities: {
                'entity-1111-2222-3333-444455556666': {
                    codename: 'test_entity',
                    kind: 'catalog',
                    tableName: 'cat_entity11112222333344445555',
                    fields: {}
                },
                ...entities
            }
        })

        it('should detect new TABLE attribute as ADD_TABULAR_TABLE', () => {
            const snapshot = createTestSnapshot()
            const entities: EntityDefinition[] = [
                createTestEntity({
                    fields: [
                        {
                            id: 'table-attr-1111-2222-333344445555',
                            codename: 'order_items',
                            dataType: 'TABLE',
                            isRequired: false
                        }
                    ]
                })
            ]

            const diff = calculateSchemaDiff(snapshot, entities)

            expect(diff.hasChanges).toBe(true)
            expect(diff.additive).toHaveLength(1)
            expect(diff.additive[0].type).toBe(ChangeType.ADD_TABULAR_TABLE)
            expect(diff.additive[0].fieldCodename).toBe('order_items')
            expect(diff.additive[0].isDestructive).toBe(false)
        })

        it('should detect removed TABLE attribute as DROP_TABULAR_TABLE', () => {
            const snapshot = createTestSnapshot()
            snapshot.entities['entity-1111-2222-3333-444455556666'].fields = {
                'table-attr-1111-2222-333344445555': {
                    codename: 'order_items',
                    columnName: 'cat_entity11112222333344445555_tp_tableattr1111222233334444555',
                    dataType: 'TABLE',
                    isRequired: false,
                    childFields: {}
                }
            }

            const entities: EntityDefinition[] = [createTestEntity({ fields: [] })]

            const diff = calculateSchemaDiff(snapshot, entities)

            expect(diff.hasChanges).toBe(true)
            expect(diff.destructive).toHaveLength(1)
            expect(diff.destructive[0].type).toBe(ChangeType.DROP_TABULAR_TABLE)
            expect(diff.destructive[0].fieldCodename).toBe('order_items')
            expect(diff.destructive[0].isDestructive).toBe(true)
        })

        it('should detect new child column as ADD_TABULAR_COLUMN', () => {
            const snapshot = createTestSnapshot()
            snapshot.entities['entity-1111-2222-3333-444455556666'].fields = {
                'table-attr-1111-2222-333344445555': {
                    codename: 'order_items',
                    columnName: 'cat_entity11112222333344445555_tp_tableattr1111',
                    dataType: 'TABLE',
                    isRequired: false,
                    childFields: {}
                }
            }

            const entities: EntityDefinition[] = [
                createTestEntity({
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
            ]

            const diff = calculateSchemaDiff(snapshot, entities)

            expect(diff.hasChanges).toBe(true)
            expect(diff.additive).toHaveLength(1)
            expect(diff.additive[0].type).toBe(ChangeType.ADD_TABULAR_COLUMN)
            expect(diff.additive[0].fieldCodename).toBe('quantity')
            expect(diff.additive[0].isDestructive).toBe(false)
        })

        it('should detect removed child column as DROP_TABULAR_COLUMN', () => {
            const snapshot = createTestSnapshot()
            snapshot.entities['entity-1111-2222-3333-444455556666'].fields = {
                'table-attr-1111-2222-333344445555': {
                    codename: 'order_items',
                    columnName: 'cat_entity11112222333344445555_tp_tableattr1111',
                    dataType: 'TABLE',
                    isRequired: false,
                    childFields: {
                        'child-field-aaaa-bbbb-ccccddddeeee': {
                            codename: 'quantity',
                            columnName: 'attr_childfieldaaaabbbbccccddddeeee',
                            dataType: 'integer',
                            isRequired: true
                        }
                    }
                }
            }

            const entities: EntityDefinition[] = [
                createTestEntity({
                    fields: [
                        {
                            id: 'table-attr-1111-2222-333344445555',
                            codename: 'order_items',
                            dataType: 'TABLE',
                            isRequired: false
                        }
                        // child field removed — no child field with parentAttributeId
                    ]
                })
            ]

            const diff = calculateSchemaDiff(snapshot, entities)

            expect(diff.hasChanges).toBe(true)
            expect(diff.destructive).toHaveLength(1)
            expect(diff.destructive[0].type).toBe(ChangeType.DROP_TABULAR_COLUMN)
            expect(diff.destructive[0].fieldCodename).toBe('quantity')
            expect(diff.destructive[0].isDestructive).toBe(true)
        })

        it('should detect no changes when TABLE attribute and children are identical', () => {
            const snapshot = createTestSnapshot()
            snapshot.entities['entity-1111-2222-3333-444455556666'].fields = {
                'table-attr-1111-2222-333344445555': {
                    codename: 'order_items',
                    columnName: 'cat_entity11112222333344445555_tp_tableattr1111',
                    dataType: 'TABLE',
                    isRequired: false,
                    childFields: {
                        'child-field-aaaa-bbbb-ccccddddeeee': {
                            codename: 'quantity',
                            columnName: 'attr_childfieldaaaabbbbccccddddeeee',
                            dataType: 'integer',
                            isRequired: true
                        }
                    }
                }
            }

            const entities: EntityDefinition[] = [
                createTestEntity({
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
            ]

            const diff = calculateSchemaDiff(snapshot, entities)

            expect(diff.hasChanges).toBe(false)
            expect(diff.additive).toHaveLength(0)
            expect(diff.destructive).toHaveLength(0)
        })

        it('should detect ALTER_TABULAR_COLUMN when child field data type changes', () => {
            const snapshot = createTestSnapshot({
                'entity-1111-2222-3333-444455556666': {
                    codename: 'test_entity',
                    kind: 'catalog',
                    tableName: 'cat_entity11112222333344445555',
                    fields: {
                        'table-attr-1111-2222-333344445555': {
                            codename: 'order_items',
                            columnName: 'cat_entity11112222333344445555_tp_tableattr111122223333',
                            dataType: 'TABLE',
                            isRequired: false,
                            targetEntityId: null,
                            targetEntityKind: null,
                            childFields: {
                                'child-field-aaaa-bbbb-ccccddddeeee': {
                                    codename: 'quantity',
                                    columnName: 'attr_childfieldaaaabbbbccccddddeeee',
                                    dataType: 'integer',
                                    isRequired: true,
                                    targetEntityId: null,
                                    targetEntityKind: null
                                }
                            }
                        }
                    }
                }
            })

            const entities: EntityDefinition[] = [
                createTestEntity({
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
                            dataType: 'decimal',
                            isRequired: true,
                            parentAttributeId: 'table-attr-1111-2222-333344445555'
                        }
                    ]
                })
            ]

            const diff = calculateSchemaDiff(snapshot, entities)

            expect(diff.hasChanges).toBe(true)
            const alterOp = diff.destructive.find((op) => op.type === 'ALTER_TABULAR_COLUMN')
            expect(alterOp).toBeDefined()
            expect(alterOp?.oldValue).toBe('integer')
            expect(alterOp?.newValue).toBe('decimal')
        })

        it('should add ADD_FK when child REF field is added to existing TABLE attribute', () => {
            const snapshot = createTestSnapshot({
                'entity-1111-2222-3333-444455556666': {
                    codename: 'test_entity',
                    kind: 'catalog',
                    tableName: 'cat_entity11112222333344445555',
                    fields: {
                        'table-attr-1111-2222-333344445555': {
                            codename: 'order_items',
                            columnName: 'cat_entity11112222333344445555_tp_tableattr111122223333',
                            dataType: 'TABLE',
                            isRequired: false,
                            targetEntityId: null,
                            targetEntityKind: null,
                            childFields: {}
                        }
                    }
                }
            })

            const entities: EntityDefinition[] = [
                createTestEntity({
                    fields: [
                        {
                            id: 'table-attr-1111-2222-333344445555',
                            codename: 'order_items',
                            dataType: 'TABLE',
                            isRequired: false
                        },
                        {
                            id: 'child-ref-aaaa-bbbb-ccccddddeeee',
                            codename: 'product_ref',
                            dataType: 'REF',
                            isRequired: false,
                            parentAttributeId: 'table-attr-1111-2222-333344445555',
                            targetEntityId: 'entity-9999-8888-7777-666655554444',
                            targetEntityKind: 'catalog'
                        }
                    ]
                }),
                createTestEntity({
                    id: 'entity-9999-8888-7777-666655554444',
                    codename: 'product'
                })
            ]

            const diff = calculateSchemaDiff(snapshot, entities)

            expect(diff.hasChanges).toBe(true)
            const addFkOp = diff.additive.find((op) => op.type === ChangeType.ADD_FK)
            expect(addFkOp).toBeDefined()
            expect(addFkOp?.fieldCodename).toBe('product_ref')
        })

        it('should add DROP_FK when child REF field is removed from TABLE attribute', () => {
            const snapshot = createTestSnapshot({
                'entity-1111-2222-3333-444455556666': {
                    codename: 'test_entity',
                    kind: 'catalog',
                    tableName: 'cat_entity11112222333344445555',
                    fields: {
                        'table-attr-1111-2222-333344445555': {
                            codename: 'order_items',
                            columnName: 'cat_entity11112222333344445555_tp_tableattr111122223333',
                            dataType: 'TABLE',
                            isRequired: false,
                            targetEntityId: null,
                            targetEntityKind: null,
                            childFields: {
                                'child-ref-aaaa-bbbb-ccccddddeeee': {
                                    codename: 'product_ref',
                                    columnName: 'attr_childrefaaaabbbbccccddddeeee',
                                    dataType: 'REF',
                                    isRequired: false,
                                    targetEntityId: 'entity-9999-8888-7777-666655554444',
                                    targetEntityKind: 'catalog'
                                }
                            }
                        }
                    }
                },
                'entity-9999-8888-7777-666655554444': {
                    codename: 'product',
                    kind: 'catalog',
                    tableName: 'cat_entity99998888777766665555',
                    fields: {}
                }
            })

            const entities: EntityDefinition[] = [
                createTestEntity({
                    fields: [
                        {
                            id: 'table-attr-1111-2222-333344445555',
                            codename: 'order_items',
                            dataType: 'TABLE',
                            isRequired: false
                        }
                    ]
                }),
                createTestEntity({
                    id: 'entity-9999-8888-7777-666655554444',
                    codename: 'product'
                })
            ]

            const diff = calculateSchemaDiff(snapshot, entities)

            expect(diff.hasChanges).toBe(true)
            const dropFkOp = diff.destructive.find((op) => op.type === ChangeType.DROP_FK)
            expect(dropFkOp).toBeDefined()
            expect(dropFkOp?.fieldCodename).toBe('product_ref')
        })
    })
})
