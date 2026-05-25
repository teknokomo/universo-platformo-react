import { qSchema, qTable, qSchemaTable, qColumn } from '../identifiers'

// Common SQL injection payloads for security regression testing
const SQL_INJECTION_PAYLOADS = [
    "'; DROP TABLE users; --",
    '" OR 1=1 --',
    '"admin"; SELECT * FROM auth.users; --',
    'table; DELETE FROM pg_catalog.pg_tables; --',
    "' UNION SELECT password FROM auth.users--",
    "Robert'); DROP TABLE students;--",
    '1; EXEC xp_cmdshell("cmd.exe")',
    "test' AND '1'='1",
    '" OR ""="',
    "'; TRUNCATE auth.users; --"
]

describe('qSchema', () => {
    it('accepts fixed schema names', () => {
        expect(qSchema('admin')).toBe('"admin"')
        expect(qSchema('metahubs')).toBe('"metahubs"')
        expect(qSchema('applications')).toBe('"applications"')
        expect(qSchema('public')).toBe('"public"')
    })

    it('accepts managed dynamic schema names', () => {
        expect(qSchema('app_aabbccdd11223344556677889900aabb')).toBe('"app_aabbccdd11223344556677889900aabb"')
        expect(qSchema('mhb_aabbccdd11223344556677889900aabb_b1')).toBe('"mhb_aabbccdd11223344556677889900aabb_b1"')
    })

    it('rejects SQL injection payloads', () => {
        expect(() => qSchema("'; DROP TABLE users; --")).toThrow('Invalid schema name')
        expect(() => qSchema('" OR 1=1 --')).toThrow('Invalid schema name')
        expect(() => qSchema('admin"; SELECT * FROM auth.users; --')).toThrow('Invalid schema name')
    })

    it('rejects empty string', () => {
        expect(() => qSchema('')).toThrow()
    })
})

describe('qTable', () => {
    it('quotes canonical table names', () => {
        expect(qTable('_mhb_objects')).toBe('"_mhb_objects"')
        expect(qTable('metahubs')).toBe('"metahubs"')
    })

    it('rejects injection payloads', () => {
        expect(() => qTable("'; DROP TABLE--")).toThrow('Invalid SQL identifier')
        expect(() => qTable('table name')).toThrow('Invalid SQL identifier')
    })
})

describe('qSchemaTable', () => {
    it('returns correct quoted form', () => {
        expect(qSchemaTable('metahubs', 'metahubs_branches')).toBe('"metahubs"."metahubs_branches"')
        expect(qSchemaTable('admin', 'settings')).toBe('"admin"."settings"')
    })

    it('validates both schema and table', () => {
        expect(() => qSchemaTable('bad schema', 'table')).toThrow()
        expect(() => qSchemaTable('admin', 'bad table')).toThrow()
    })
})

describe('qColumn', () => {
    it('validates and quotes column names', () => {
        expect(qColumn('_upl_deleted')).toBe('"_upl_deleted"')
        expect(qColumn('id')).toBe('"id"')
    })

    it('rejects injection payloads', () => {
        expect(() => qColumn('" OR 1=1 --')).toThrow('Invalid SQL identifier')
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 7.3 — Security regression tests for SQL injection prevention
// ═══════════════════════════════════════════════════════════════════════════════

describe('SQL injection regression — all identifier helpers', () => {
    it.each(SQL_INJECTION_PAYLOADS)('qSchema rejects payload: %s', (payload) => {
        expect(() => qSchema(payload)).toThrow()
    })

    it.each(SQL_INJECTION_PAYLOADS)('qTable rejects payload: %s', (payload) => {
        expect(() => qTable(payload)).toThrow()
    })

    it.each(SQL_INJECTION_PAYLOADS)('qColumn rejects payload: %s', (payload) => {
        expect(() => qColumn(payload)).toThrow()
    })

    it.each(SQL_INJECTION_PAYLOADS)('qSchemaTable rejects payload in schema: %s', (payload) => {
        expect(() => qSchemaTable(payload, '_mhb_objects')).toThrow()
    })

    it.each(SQL_INJECTION_PAYLOADS)('qSchemaTable rejects payload in table: %s', (payload) => {
        expect(() => qSchemaTable('metahubs', payload)).toThrow()
    })

    it('all helpers reject empty string', () => {
        expect(() => qSchema('')).toThrow()
        expect(() => qTable('')).toThrow()
        expect(() => qColumn('')).toThrow()
        expect(() => qSchemaTable('', '')).toThrow()
    })

    it('all helpers reject whitespace-only strings', () => {
        expect(() => qSchema(' ')).toThrow()
        expect(() => qTable(' ')).toThrow()
        expect(() => qColumn(' ')).toThrow()
    })

    it('all helpers reject uppercase identifiers (canonical form is lowercase)', () => {
        expect(() => qTable('MyTable')).toThrow()
        expect(() => qColumn('MyColumn')).toThrow()
    })

    it('all helpers reject identifiers with special characters', () => {
        expect(() => qTable('table-name')).toThrow()
        expect(() => qColumn('col.name')).toThrow()
        expect(() => qTable('table name')).toThrow()
    })
})
