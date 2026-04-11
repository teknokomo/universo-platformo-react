import {
    generateSchemaName,
    generateMetahubSchemaName,
    generateTableName,
    generateColumnName,
    resolveFieldColumnName,
    resolveEntityTableName,
    isValidSchemaName,
    buildFkConstraintName,
    generateChildTableName,
    qualifySchemaObjectName,
    qualifyTableName
} from '../naming'

describe('DDL Naming Utilities', () => {
    const testEntityId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const expectedCleanId = 'a1b2c3d4e5f67890abcdef1234567890'

    describe('generateSchemaName', () => {
        it('should generate schema name with app_ prefix', () => {
            const applicationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            const result = generateSchemaName(applicationId)
            expect(result).toBe('app_a1b2c3d4e5f67890abcdef1234567890')
        })

        it('should strip all hyphens from UUID', () => {
            const applicationId = '12345678-1234-1234-1234-123456789abc'
            const result = generateSchemaName(applicationId)
            expect(result).not.toContain('-')
            expect(result).toBe('app_12345678123412341234123456789abc')
        })

        it('should handle already clean ID (no hyphens)', () => {
            const applicationId = 'abcdef1234567890abcdef1234567890'
            const result = generateSchemaName(applicationId)
            expect(result).toBe('app_abcdef1234567890abcdef1234567890')
        })
    })

    describe('generateMetahubSchemaName', () => {
        it('should generate schema name with mhb_ prefix', () => {
            const metahubId = '018f8a78-7b8f-7c1d-a111-222233334444'
            const result = generateMetahubSchemaName(metahubId)
            expect(result).toBe('mhb_018f8a787b8f7c1da111222233334444')
        })

        it('should strip hyphens from metahub UUIDs', () => {
            const metahubId = '12345678-1234-1234-1234-123456789abc'
            const result = generateMetahubSchemaName(metahubId)
            expect(result).toBe('mhb_12345678123412341234123456789abc')
        })
    })

    describe('generateTableName', () => {
        it('should generate table name with cat_ prefix for catalog entities', () => {
            const result = generateTableName(testEntityId, 'catalog')
            expect(result).toBe(`cat_${expectedCleanId}`)
        })

        it('should prefer an explicit custom prefix when provided', () => {
            const result = generateTableName(testEntityId, 'customer_registry', 'cust')
            expect(result).toBe(`cust_${expectedCleanId}`)
        })

        it('should generate table name with hub_ prefix for hub entities', () => {
            const result = generateTableName(testEntityId, 'hub')
            expect(result).toBe(`hub_${expectedCleanId}`)
        })

        it('should generate table name with doc_ prefix for document entities', () => {
            const result = generateTableName(testEntityId, 'document')
            expect(result).toBe(`doc_${expectedCleanId}`)
        })

        it('should strip all hyphens from entity ID', () => {
            const result = generateTableName(testEntityId, 'catalog')
            expect(result).not.toContain('-')
        })

        it('should generate table name with rel_ prefix for relation entities', () => {
            const result = generateTableName(testEntityId, 'relation')
            expect(result).toBe(`rel_${expectedCleanId}`)
        })

        it('should generate table name with cfg_ prefix for settings entities', () => {
            const result = generateTableName(testEntityId, 'settings')
            expect(result).toBe(`cfg_${expectedCleanId}`)
        })
    })

    describe('resolveEntityTableName', () => {
        it('should prefer explicit physical table name when provided', () => {
            expect(
                resolveEntityTableName({
                    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    kind: 'catalog',
                    physicalTableName: 'cat_profiles'
                })
            ).toBe('cat_profiles')
        })

        it('should fallback to generated table name when physical override is absent', () => {
            expect(
                resolveEntityTableName({
                    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    kind: 'catalog'
                })
            ).toBe(`cat_${expectedCleanId}`)
        })

        it('should fallback to physical table prefix when explicit table name is absent', () => {
            expect(
                resolveEntityTableName({
                    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    kind: 'customer_registry',
                    physicalTablePrefix: 'cust'
                })
            ).toBe(`cust_${expectedCleanId}`)
        })
    })

    describe('generateColumnName', () => {
        it('should generate column name with attr_ prefix', () => {
            const fieldId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            const result = generateColumnName(fieldId)
            expect(result).toBe('attr_a1b2c3d4e5f67890abcdef1234567890')
        })

        it('should strip all hyphens from field ID', () => {
            const fieldId = '12345678-1234-1234-1234-123456789abc'
            const result = generateColumnName(fieldId)
            expect(result).not.toContain('-')
            expect(result).toBe('attr_12345678123412341234123456789abc')
        })
    })

    describe('resolveFieldColumnName', () => {
        it('should prefer explicit physical column names when provided', () => {
            expect(
                resolveFieldColumnName({
                    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    physicalColumnName: 'nickname'
                })
            ).toBe('nickname')
        })

        it('should fallback to generated attr_* names when override is absent', () => {
            expect(
                resolveFieldColumnName({
                    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
                })
            ).toBe('attr_a1b2c3d4e5f67890abcdef1234567890')
        })
    })

    describe('isValidSchemaName', () => {
        it('should return true for valid schema name', () => {
            expect(isValidSchemaName('app_a1b2c3d4e5f67890abcdef1234567890')).toBe(true)
        })

        it('should return true for fixed system schema names', () => {
            expect(isValidSchemaName('metahubs')).toBe(true)
            expect(isValidSchemaName('applications')).toBe(true)
            expect(isValidSchemaName('profiles')).toBe(true)
        })

        it('should return true for managed custom schema names', () => {
            expect(isValidSchemaName('custom_runtime')).toBe(true)
            expect(isValidSchemaName('tenant_reports')).toBe(true)
        })

        it('should return true for short valid schema name', () => {
            expect(isValidSchemaName('app_abc123')).toBe(true)
        })

        it('should return true for valid metahub schema name', () => {
            expect(isValidSchemaName('mhb_a1b2c3d4e5f67890abcdef1234567890')).toBe(true)
        })

        it('should return true for metahub branch schema name', () => {
            expect(isValidSchemaName('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')).toBe(true)
        })

        it('should return true for simple custom schema names outside reserved managed prefixes', () => {
            expect(isValidSchemaName('schema_a1b2c3d4')).toBe(true)
        })

        it('should return false for reserved synthetic platform scope keys', () => {
            expect(isValidSchemaName('cross_schema')).toBe(false)
        })

        it('should return false for schema name with uppercase letters', () => {
            expect(isValidSchemaName('app_A1B2C3D4')).toBe(false)
        })

        it('should return false for schema name with hyphens', () => {
            expect(isValidSchemaName('app_a1b2-c3d4')).toBe(false)
        })

        it('should return false for schema name with special characters', () => {
            expect(isValidSchemaName('app_a1b2c3d4!')).toBe(false)
        })

        it('should return false for app schema name with branch suffix', () => {
            expect(isValidSchemaName('app_a1b2c3d4_b1')).toBe(false)
        })

        it('should return false for empty string', () => {
            expect(isValidSchemaName('')).toBe(false)
        })

        it('should return false for just prefix', () => {
            expect(isValidSchemaName('app_')).toBe(false)
        })

        it('should return false for invalid managed metahub-style prefixes', () => {
            expect(isValidSchemaName('mhb_invalid')).toBe(false)
        })
    })

    describe('buildFkConstraintName', () => {
        it('should build FK constraint name with fk_ prefix', () => {
            const result = buildFkConstraintName('cat_abc123', 'attr_def456')
            expect(result).toBe('fk_cat_abc123_attr_def456')
        })

        it('should truncate constraint name to 63 characters max', () => {
            const longTableName = 'cat_' + 'a'.repeat(40)
            const longColumnName = 'attr_' + 'b'.repeat(40)
            const result = buildFkConstraintName(longTableName, longColumnName)
            expect(result.length).toBeLessThanOrEqual(63)
            expect(result.startsWith('fk_')).toBe(true)
        })

        it('should not truncate short constraint names', () => {
            const result = buildFkConstraintName('cat_short', 'attr_col')
            expect(result).toBe('fk_cat_short_attr_col')
            expect(result.length).toBeLessThan(63)
        })
    })

    describe('schema qualification helpers', () => {
        it('should qualify schema object names safely', () => {
            expect(qualifySchemaObjectName('metahubs', 'publications')).toBe('"metahubs"."publications"')
            expect(qualifyTableName('applications', 'connectors')).toBe('"applications"."connectors"')
        })
    })

    describe('generateChildTableName', () => {
        it('should generate child table name with tbl_ prefix using full UUID hex', () => {
            const result = generateChildTableName('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
            expect(result).toBe('tbl_a1b2c3d4e5f67890abcdef1234567890')
        })

        it('should strip hyphens from attribute ID', () => {
            const result = generateChildTableName('12345678-1234-1234-1234-123456789abc')
            expect(result).not.toContain('-')
            expect(result).toBe('tbl_12345678123412341234123456789abc')
        })

        it('should handle already clean attribute ID', () => {
            const result = generateChildTableName('abcdef1234567890abcdef1234567890')
            expect(result).toBe('tbl_abcdef1234567890abcdef1234567890')
        })

        it('should always produce 36-char name for standard UUIDs', () => {
            // tbl_ (4) + 32 hex = 36 chars
            const result = generateChildTableName('ff000000-0000-0000-0000-000000000001')
            expect(result.length).toBe(36)
        })

        it('should be well within PostgreSQL 63-char NAMEDATALEN limit', () => {
            const result = generateChildTableName('ff112233-4455-6677-8899-aabbccddeeff')
            expect(result.length).toBeLessThanOrEqual(63)
            expect(result).toBe('tbl_ff112233445566778899aabbccddeeff')
        })

        it('should not depend on parent table name', () => {
            // Same attribute ID should produce same table name regardless of parent
            const attrId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            const result = generateChildTableName(attrId)
            expect(result).toBe('tbl_a1b2c3d4e5f67890abcdef1234567890')
        })
    })
})
