import { AttributeDataType } from '@universo/types'
import { SchemaGenerator } from '../SchemaGenerator'
import { generateSchemaName, generateTableName, generateColumnName } from '../naming'

// Create mock Knex instance
const mockTableBuilder = {
    uuid: jest.fn().mockReturnThis(),
    primary: jest.fn().mockReturnThis(),
    defaultTo: jest.fn().mockReturnThis(),
    timestamp: jest.fn().mockReturnThis(),
    notNullable: jest.fn().mockReturnThis(),
    nullable: jest.fn().mockReturnThis(),
    specificType: jest.fn().mockReturnThis(),
}

const mockSchemaBuilder = {
    withSchema: jest.fn().mockReturnThis(),
    createTable: jest.fn((tableName: string, callback: (table: typeof mockTableBuilder) => void) => {
        callback(mockTableBuilder)
        return Promise.resolve()
    }),
    hasTable: jest.fn().mockResolvedValue(false),
    dropTableIfExists: jest.fn().mockResolvedValue(undefined),
}

const mockKnex = jest.fn(() => ({
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
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
            it('should map STRING to TEXT', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.STRING)).toBe('TEXT')
            })

            it('should map NUMBER to NUMERIC', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.NUMBER)).toBe('NUMERIC')
            })

            it('should map BOOLEAN to BOOLEAN', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.BOOLEAN)).toBe('BOOLEAN')
            })

            it('should map DATE to DATE', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.DATE)).toBe('DATE')
            })

            it('should map DATETIME to TIMESTAMPTZ', () => {
                expect(SchemaGenerator.mapDataType(AttributeDataType.DATETIME)).toBe('TIMESTAMPTZ')
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

            expect(mockKnex.raw).toHaveBeenCalledWith(
                'CREATE SCHEMA IF NOT EXISTS ??',
                ['app_abc123def456']
            )
        })

        it('should throw error for invalid schema name', async () => {
            await expect(generator.createSchema('invalid-schema-name')).rejects.toThrow(
                'Invalid schema name format: invalid-schema-name'
            )
        })

        it('should throw error for schema name without app_ prefix', async () => {
            await expect(generator.createSchema('schema_abc123')).rejects.toThrow(
                'Invalid schema name format'
            )
        })
    })

    describe('dropSchema', () => {
        it('should drop schema with valid name', async () => {
            await generator.dropSchema('app_abc123def456')

            expect(mockKnex.raw).toHaveBeenCalledWith(
                'DROP SCHEMA IF EXISTS ?? CASCADE',
                ['app_abc123def456']
            )
        })

        it('should throw error for invalid schema name', async () => {
            await expect(generator.dropSchema('invalid')).rejects.toThrow(
                'Invalid schema name format'
            )
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
                        isRequired: true,
                    },
                ],
            },
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
    })
})
