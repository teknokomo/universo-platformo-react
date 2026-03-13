import { AttributeDataType } from '@universo/types'
import { SchemaGenerator } from '../SchemaGenerator'
import { generateSchemaName, generateTableName, generateColumnName } from '../naming'

// Create mock Knex instance
const mockTableBuilder = {
    string: jest.fn().mockReturnThis(),
    jsonb: jest.fn().mockReturnThis(),
    boolean: jest.fn().mockReturnThis(),
    integer: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    uuid: jest.fn().mockReturnThis(),
    primary: jest.fn().mockReturnThis(),
    defaultTo: jest.fn().mockReturnThis(),
    timestamp: jest.fn().mockReturnThis(),
    notNullable: jest.fn().mockReturnThis(),
    nullable: jest.fn().mockReturnThis(),
    specificType: jest.fn().mockReturnThis(),
    unique: jest.fn().mockReturnThis(),
    index: jest.fn().mockReturnThis(),
    foreign: jest.fn().mockReturnThis(),
    references: jest.fn().mockReturnThis(),
    inTable: jest.fn().mockReturnThis(),
    onDelete: jest.fn().mockReturnThis()
}

const mockSchemaBuilder = {
    withSchema: jest.fn().mockReturnThis(),
    createTable: jest.fn((tableName: string, callback: (table: typeof mockTableBuilder) => void) => {
        callback(mockTableBuilder)
        return Promise.resolve()
    }),
    hasTable: jest.fn().mockResolvedValue(false),
    dropTableIfExists: jest.fn().mockResolvedValue(undefined)
}

const mockKnex = jest.fn(() => ({
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null)
})) as unknown as jest.Mock & {
    raw: jest.Mock
    schema: typeof mockSchemaBuilder
    transaction: jest.Mock
    fn: { now: jest.Mock }
}

mockKnex.raw = jest.fn().mockResolvedValue(undefined)
mockKnex.schema = mockSchemaBuilder
mockKnex.fn = { now: jest.fn().mockReturnValue('NOW()') }
mockKnex.transaction = jest.fn(async (callback: (trx: typeof mockKnex) => Promise<void>) => {
    await callback(mockKnex)
})

describe('SchemaGenerator', () => {
    let generator: SchemaGenerator

    beforeEach(() => {
        jest.clearAllMocks()
        // Pass mock Knex directly to constructor (Dependency Injection)
        generator = new SchemaGenerator(mockKnex as unknown as import('knex').Knex)
    })

    describe('static methods', () => {
        describe('generateSchemaName', () => {
            it('should generate schema name with app_ prefix', () => {
                const result = generateSchemaName('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
                expect(result).toBe('app_a1b2c3d4e5f67890abcdef1234567890')
            })
        })

        describe('generateTableName', () => {
            it('should generate table name with correct prefix for catalog', () => {
                const result = generateTableName('e1-0000-0000-0000-000000000001', 'catalog')
                expect(result).toMatch(/^cat_/)
            })

            it('should generate table name with correct prefix for hub', () => {
                const result = generateTableName('e1-0000-0000-0000-000000000001', 'hub')
                expect(result).toMatch(/^hub_/)
            })

            it('should generate table name with correct prefix for document', () => {
                const result = generateTableName('e1-0000-0000-0000-000000000001', 'document')
                expect(result).toMatch(/^doc_/)
            })
        })

        describe('generateColumnName', () => {
            it('should generate column name with attr_ prefix', () => {
                const result = generateColumnName('f1-0000-0000-0000-000000000001')
                expect(result).toMatch(/^attr_/)
            })
        })

        describe('mapDataType', () => {
            it('should map STRING to TEXT by default', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.STRING)).toBe('TEXT')
            })

            it('should map STRING to VARCHAR(n) when maxLength is specified', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.STRING, { maxLength: 255 })).toBe('VARCHAR(255)')
            })

            it('should map NUMBER to NUMERIC(10,0) by default', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.NUMBER)).toBe('NUMERIC(10,0)')
            })

            it('should map NUMBER with custom precision and scale', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.NUMBER, { precision: 15, scale: 4 })).toBe('NUMERIC(15,4)')
            })

            it('should map BOOLEAN to BOOLEAN', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.BOOLEAN)).toBe('BOOLEAN')
            })

            it('should map DATE to TIMESTAMPTZ by default (datetime composition)', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.DATE)).toBe('TIMESTAMPTZ')
            })

            it('should map DATE to DATE when dateComposition is date', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.DATE, { dateComposition: 'date' })).toBe('DATE')
            })

            it('should map DATE to TIME when dateComposition is time', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.DATE, { dateComposition: 'time' })).toBe('TIME')
            })

            it('should map DATE to TIMESTAMPTZ when dateComposition is datetime', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.DATE, { dateComposition: 'datetime' })).toBe('TIMESTAMPTZ')
            })

            it('should map REF to UUID', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.REF)).toBe('UUID')
            })

            it('should map JSON to JSONB', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.JSON)).toBe('JSONB')
            })

            it('should default unknown types to TEXT', () => {
                expect(SchemaGenerator.mapDataType('unknown' as AttributeDataType)).toBe('TEXT')
            })
        })
    })

    describe('createSchema', () => {
        it('should create schema with valid name', async () => {
            await generator.createSchema('app_abc123def456')

            expect(mockKnex.raw).toHaveBeenCalledWith('CREATE SCHEMA IF NOT EXISTS ??', ['app_abc123def456'])
        })

        it('should create fixed system schemas through the same validation boundary', async () => {
            await generator.createSchema('metahubs')

            expect(mockKnex.raw).toHaveBeenCalledWith('CREATE SCHEMA IF NOT EXISTS ??', ['metahubs'])
        })

        it('should create managed custom schemas through the same validation boundary', async () => {
            await generator.createSchema('custom_runtime')

            expect(mockKnex.raw).toHaveBeenCalledWith('CREATE SCHEMA IF NOT EXISTS ??', ['custom_runtime'])
        })

        it('should throw error for invalid schema name', async () => {
            await expect(generator.createSchema('invalid-schema-name')).rejects.toThrow('Invalid schema name format: invalid-schema-name')
        })

        it('should reject reserved synthetic platform scope keys', async () => {
            await expect(generator.createSchema('cross_schema')).rejects.toThrow('Invalid schema name format')
        })
    })

    describe('dropSchema', () => {
        it('should drop schema with valid name', async () => {
            await generator.dropSchema('app_abc123def456')

            expect(mockKnex.raw).toHaveBeenCalledWith('DROP SCHEMA IF EXISTS ?? CASCADE', ['app_abc123def456'])
        })

        it('should drop fixed system schemas through the same validation boundary', async () => {
            await generator.dropSchema('profiles')

            expect(mockKnex.raw).toHaveBeenCalledWith('DROP SCHEMA IF EXISTS ?? CASCADE', ['profiles'])
        })

        it('should throw error for invalid schema name', async () => {
            await expect(generator.dropSchema('invalid-name')).rejects.toThrow('Invalid schema name format')
        })
    })

    describe('generateFullSchema', () => {
        const testEntities = [
            {
                id: 'entity-1111-2222-3333-444455556666',
                codename: 'products',
                kind: 'catalog' as const,
                fields: [
                    {
                        id: 'field-1111-2222-3333-444455556666',
                        codename: 'name',
                        dataType: AttributeDataType.STRING,
                        isRequired: true
                    }
                ]
            }
        ]

        it('should use transaction for atomic operations', async () => {
            await generator.generateFullSchema('app_test123', testEntities)

            expect(mockKnex.transaction).toHaveBeenCalled()
        })

        it('should return error result on failure', async () => {
            mockKnex.transaction.mockRejectedValueOnce(new Error('DB connection failed'))

            const result = await generator.generateFullSchema('app_test123', testEntities)

            expect(result.success).toBe(false)
            expect(result.errors.length).toBeGreaterThan(0)
            expect(result.errors[0]).toContain('DB connection failed')
        })

        it('should include schema name in result', async () => {
            const result = await generator.generateFullSchema('app_test123', testEntities)

            expect(result.schemaName).toBe('app_test123')
        })

        it('should create business tables using explicit physical table names when provided', async () => {
            await generator.generateFullSchema('profiles', [
                {
                    id: 'profile-1111-2222-3333-444455556666',
                    codename: 'profiles',
                    kind: 'catalog',
                    physicalTableName: 'cat_profiles',
                    presentation: {
                        name: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: {
                                    content: 'Profiles',
                                    version: 1,
                                    isActive: true,
                                    createdAt: '1970-01-01T00:00:00.000Z',
                                    updatedAt: '1970-01-01T00:00:00.000Z'
                                }
                            }
                        }
                    },
                    fields: []
                }
            ])

            expect(mockSchemaBuilder.createTable).toHaveBeenCalledWith('cat_profiles', expect.any(Function))
        })

        it('should create business columns using explicit physical column names when provided', async () => {
            await generator.generateFullSchema('profiles', [
                {
                    id: 'profile-1111-2222-3333-444455556666',
                    codename: 'profiles',
                    kind: 'catalog',
                    physicalTableName: 'cat_profiles',
                    presentation: {
                        name: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: {
                                    content: 'Profiles',
                                    version: 1,
                                    isActive: true,
                                    createdAt: '1970-01-01T00:00:00.000Z',
                                    updatedAt: '1970-01-01T00:00:00.000Z'
                                }
                            }
                        }
                    },
                    fields: [
                        {
                            id: 'nickname-field-1111-2222-333344445555',
                            codename: 'nickname',
                            physicalColumnName: 'nickname',
                            dataType: AttributeDataType.STRING,
                            isRequired: true
                        }
                    ]
                }
            ])

            expect(mockTableBuilder.specificType).toHaveBeenCalledWith('nickname', 'TEXT')
        })
    })

    describe('addForeignKey', () => {
        it('skips physical FK for REF fields targeting set constants', async () => {
            const field = {
                id: 'field-ref-set-0000-0000-0000-000000000001',
                codename: 'version',
                dataType: AttributeDataType.REF,
                isRequired: false,
                targetEntityId: 'set-0000-0000-0000-000000000001',
                targetEntityKind: 'set'
            }
            const entity = {
                id: 'catalog-0000-0000-0000-000000000001',
                codename: 'orders',
                kind: 'catalog' as const,
                fields: [field]
            }

            await generator.addForeignKey('app_test123', entity, field, [entity])

            expect(mockKnex.raw).not.toHaveBeenCalled()
        })
    })

    describe('syncSystemMetadata', () => {
        const createTableMock = (tableName: string, operations: string[]) => {
            const table = {
                whereNotIn: jest.fn(() => {
                    operations.push(`${tableName}.whereNotIn`)
                    return table
                }),
                del: jest.fn(async () => {
                    operations.push(`${tableName}.del`)
                }),
                insert: jest.fn(() => {
                    operations.push(`${tableName}.insert`)
                    return table
                }),
                onConflict: jest.fn(() => table),
                merge: jest.fn(async () => {
                    operations.push(`${tableName}.merge`)
                })
            }

            return table
        }

        it('deletes missing metadata before upsert when removeMissing=true', async () => {
            const operations: string[] = []
            const objectsTable = createTableMock('_app_objects', operations)
            const attributesTable = createTableMock('_app_attributes', operations)

            const localKnex = {
                fn: { now: jest.fn(() => 'NOW()') },
                withSchema: jest.fn((_schemaName: string) => ({
                    table: jest.fn((tableName: string) => {
                        if (tableName === '_app_objects') return objectsTable
                        if (tableName === '_app_attributes') return attributesTable
                        throw new Error(`Unexpected table: ${tableName}`)
                    })
                }))
            } as unknown as import('knex').Knex

            const localGenerator = new SchemaGenerator(localKnex)
            jest.spyOn(localGenerator, 'ensureSystemTables').mockResolvedValue()
            const emptyVlc = {
                _schema: '1',
                _primary: 'en',
                locales: {}
            } as unknown as import('@universo/types').VersionedLocalizedContent<string>

            await localGenerator.syncSystemMetadata(
                'app_test123',
                [
                    {
                        id: 'entity-1',
                        kind: 'catalog',
                        codename: 'products',
                        presentation: { name: emptyVlc },
                        fields: [
                            {
                                id: 'field-1',
                                codename: 'name',
                                dataType: AttributeDataType.STRING,
                                isRequired: false,
                                presentation: { name: emptyVlc }
                            }
                        ]
                    } as unknown as import('../types').EntityDefinition
                ],
                {
                    removeMissing: true
                }
            )

            expect(operations.indexOf('_app_objects.del')).toBeGreaterThanOrEqual(0)
            expect(operations.indexOf('_app_objects.insert')).toBeGreaterThanOrEqual(0)
            expect(operations.indexOf('_app_objects.del')).toBeLessThan(operations.indexOf('_app_objects.insert'))
            expect(operations.indexOf('_app_attributes.del')).toBeGreaterThanOrEqual(0)
            expect(operations.indexOf('_app_attributes.insert')).toBeGreaterThanOrEqual(0)
            expect(operations.indexOf('_app_attributes.del')).toBeLessThan(operations.indexOf('_app_attributes.insert'))
        })

        it('stores generated table_name for hub metadata rows', async () => {
            const operations: string[] = []
            const objectsTable = createTableMock('_app_objects', operations)
            const attributesTable = createTableMock('_app_attributes', operations)

            const localKnex = {
                fn: { now: jest.fn(() => 'NOW()') },
                withSchema: jest.fn((_schemaName: string) => ({
                    table: jest.fn((tableName: string) => {
                        if (tableName === '_app_objects') return objectsTable
                        if (tableName === '_app_attributes') return attributesTable
                        throw new Error(`Unexpected table: ${tableName}`)
                    })
                }))
            } as unknown as import('knex').Knex

            const localGenerator = new SchemaGenerator(localKnex)
            jest.spyOn(localGenerator, 'ensureSystemTables').mockResolvedValue()
            const emptyVlc = {
                _schema: '1',
                _primary: 'en',
                locales: {}
            } as unknown as import('@universo/types').VersionedLocalizedContent<string>

            await localGenerator.syncSystemMetadata(
                'app_test123',
                [
                    {
                        id: 'hub-1',
                        kind: 'hub',
                        codename: 'main_hub',
                        presentation: { name: emptyVlc },
                        fields: []
                    } as unknown as import('../types').EntityDefinition
                ],
                { removeMissing: false }
            )

            expect(objectsTable.insert).toHaveBeenCalledTimes(1)
            const insertedRows = objectsTable.insert.mock.calls[0]?.[0] as Array<Record<string, unknown>>
            expect(Array.isArray(insertedRows)).toBe(true)
            expect(insertedRows).toHaveLength(1)
            expect(insertedRows[0]?.kind).toBe('hub')
            expect(insertedRows[0]?.table_name).toBe(generateTableName('hub-1', 'hub'))
        })

        it('passes capability gates to ensureSystemTables during metadata sync', async () => {
            const objectsTable = createTableMock('_app_objects', [])
            const attributesTable = createTableMock('_app_attributes', [])

            const localKnex = {
                fn: { now: jest.fn(() => 'NOW()') },
                withSchema: jest.fn((_schemaName: string) => ({
                    table: jest.fn((tableName: string) => {
                        if (tableName === '_app_objects') return objectsTable
                        if (tableName === '_app_attributes') return attributesTable
                        throw new Error(`Unexpected table: ${tableName}`)
                    })
                }))
            } as unknown as import('knex').Knex

            const localGenerator = new SchemaGenerator(localKnex)
            const ensureSystemTablesSpy = jest.spyOn(localGenerator, 'ensureSystemTables').mockResolvedValue()

            await localGenerator.syncSystemMetadata('profiles', [], {
                systemTableCapabilities: {
                    includeAttributes: true,
                    includeValues: false,
                    includeLayouts: false,
                    includeWidgets: false
                }
            })

            expect(ensureSystemTablesSpy).toHaveBeenCalledWith('profiles', undefined, {
                includeAttributes: true,
                includeValues: false,
                includeLayouts: false,
                includeWidgets: false
            })
        })

        it('stores explicit physical column names in _app_attributes metadata', async () => {
            const objectsTable = createTableMock('_app_objects', [])
            const attributesTable = createTableMock('_app_attributes', [])

            const localKnex = {
                fn: { now: jest.fn(() => 'NOW()') },
                withSchema: jest.fn((_schemaName: string) => ({
                    table: jest.fn((tableName: string) => {
                        if (tableName === '_app_objects') return objectsTable
                        if (tableName === '_app_attributes') return attributesTable
                        throw new Error(`Unexpected table: ${tableName}`)
                    })
                }))
            } as unknown as import('knex').Knex

            const localGenerator = new SchemaGenerator(localKnex)
            jest.spyOn(localGenerator, 'ensureSystemTables').mockResolvedValue()
            const emptyVlc = {
                _schema: '1',
                _primary: 'en',
                locales: {}
            } as unknown as import('@universo/types').VersionedLocalizedContent<string>

            await localGenerator.syncSystemMetadata('profiles', [
                {
                    id: 'profile-object-1',
                    kind: 'catalog',
                    codename: 'profiles',
                    physicalTableName: 'cat_profiles',
                    presentation: { name: emptyVlc },
                    fields: [
                        {
                            id: 'field-nickname-1',
                            codename: 'nickname',
                            physicalColumnName: 'nickname',
                            dataType: AttributeDataType.STRING,
                            isRequired: true,
                            presentation: { name: emptyVlc }
                        }
                    ]
                } as unknown as import('../types').EntityDefinition
            ])

            const insertedRows = attributesTable.insert.mock.calls[0]?.[0] as Array<Record<string, unknown>>
            expect(insertedRows[0]?.column_name).toBe('nickname')
        })
    })

    describe('ensureSystemTables', () => {
        it('supports capability-based optional system table creation while keeping core tables', async () => {
            await generator.ensureSystemTables('metahubs', undefined, {
                includeLayouts: false,
                includeWidgets: false,
                includeValues: false
            })

            const createdTables = mockSchemaBuilder.createTable.mock.calls.map((call) => call[0])
            expect(createdTables).toEqual(expect.arrayContaining(['_app_objects', '_app_attributes', '_app_migrations', '_app_settings']))
            expect(createdTables).not.toContain('_app_layouts')
            expect(createdTables).not.toContain('_app_widgets')
            expect(createdTables).not.toContain('_app_values')
        })

        it('rejects invalid capability combinations where widgets are enabled without layouts', async () => {
            await expect(
                generator.ensureSystemTables('metahubs', undefined, {
                    includeLayouts: false,
                    includeWidgets: true
                })
            ).rejects.toThrow('System table capabilities cannot enable _app_widgets without _app_layouts')
        })
    })

    describe('generateFullSchema', () => {
        it('runs afterMigrationRecorded inside the same transaction after migration history is persisted', async () => {
            jest.spyOn(generator, 'createSchema').mockResolvedValue()
            jest.spyOn(generator, 'ensureSystemTables').mockResolvedValue()
            jest.spyOn(generator, 'syncSystemMetadata').mockResolvedValue()

            const recordMigration = jest.fn().mockResolvedValue('migration-id')
            const afterMigrationRecorded = jest.fn().mockResolvedValue(undefined)

            const result = await generator.generateFullSchema('app_test123', [], {
                recordMigration: true,
                migrationManager: {
                    recordMigration
                } as unknown as import('../MigrationManager').MigrationManager,
                afterMigrationRecorded
            })

            expect(result.success).toBe(true)
            expect(recordMigration).toHaveBeenCalledTimes(1)
            expect(afterMigrationRecorded).toHaveBeenCalledWith(
                expect.objectContaining({
                    trx: mockKnex,
                    schemaName: 'app_test123',
                    snapshotBefore: null,
                    migrationName: expect.stringMatching(/^\d{8}_\d{6}_initial_schema$/),
                    migrationId: 'migration-id',
                    snapshotAfter: expect.objectContaining({
                        version: expect.any(Number),
                        entities: {}
                    }),
                    diff: expect.objectContaining({
                        summary: 'Initial schema creation with 0 table(s)'
                    })
                })
            )
            expect(recordMigration.mock.invocationCallOrder[0]).toBeLessThan(afterMigrationRecorded.mock.invocationCallOrder[0])
        })
    })
})
