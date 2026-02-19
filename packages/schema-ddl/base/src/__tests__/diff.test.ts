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
    })
})
