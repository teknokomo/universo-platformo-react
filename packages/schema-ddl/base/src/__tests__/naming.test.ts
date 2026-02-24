import {
    generateSchemaName,
    generateTableName,
    generateColumnName,
    isValidSchemaName,
    buildFkConstraintName,
    generateTabularTableName
} from '../naming'

describe('DDL Naming Utilities', () => {
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

    describe('generateTableName', () => {
        const testEntityId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
        const expectedCleanId = 'a1b2c3d4e5f67890abcdef1234567890'

        it('should generate table name with cat_ prefix for catalog entities', () => {
            const result = generateTableName(testEntityId, 'catalog')
            expect(result).toBe(`cat_${expectedCleanId}`)
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

    describe('isValidSchemaName', () => {
        it('should return true for valid schema name', () => {
            expect(isValidSchemaName('app_a1b2c3d4e5f67890abcdef1234567890')).toBe(true)
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

        it('should return false for schema name without app_ prefix', () => {
            expect(isValidSchemaName('schema_a1b2c3d4')).toBe(false)
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

    describe('generateTabularTableName', () => {
        it('should generate tabular table name with _tp_ infix using first 12 chars of UUID', () => {
            const result = generateTabularTableName('cat_abc123', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
            expect(result).toBe('cat_abc123_tp_a1b2c3d4e5f6')
        })

        it('should strip hyphens from attribute ID', () => {
            const result = generateTabularTableName('hub_parent', '12345678-1234-1234-1234-123456789abc')
            expect(result).not.toContain('-')
            expect(result).toBe('hub_parent_tp_123456781234')
        })

        it('should handle already clean attribute ID', () => {
            const result = generateTabularTableName('doc_parent', 'abcdef1234567890abcdef1234567890')
            expect(result).toBe('doc_parent_tp_abcdef123456')
        })

        it('should preserve the parent table name exactly', () => {
            const parentTableName = 'cat_a1b2c3d4e5f67890abcdef1234567890'
            const result = generateTabularTableName(parentTableName, 'ff000000-0000-0000-0000-000000000001')
            expect(result.startsWith(parentTableName + '_tp_')).toBe(true)
        })

        it('should not exceed PostgreSQL 63-char NAMEDATALEN limit', () => {
            // Worst case: cat_ + 32 hex = 36 chars parent + _tp_ + 12 hex = 52 chars total
            const longParent = 'cat_a1b2c3d4e5f67890abcdef12345678'
            const result = generateTabularTableName(longParent, 'ff000000-0000-0000-0000-000000000001')
            expect(result.length).toBeLessThanOrEqual(63)
        })
    })
})
