import {
    buildRuntimeRecordRuleLockKey,
    evaluateRuntimeRecordRules,
    RUNTIME_RECORD_RULE_CODES,
    type RuntimeRecordRuleAttr
} from '../../services/runtimeRecordRules'
import { createMockDbExecutor } from '../utils/dbMocks'

const stringAttr = (overrides: Partial<RuntimeRecordRuleAttr> = {}): RuntimeRecordRuleAttr => ({
    codename: { _primary: 'sectionKey' },
    column_name: 'section_key',
    data_type: 'STRING',
    validation_rules: {},
    ...overrides
})

const baseParams = (query: jest.Mock, attrs: RuntimeRecordRuleAttr[], row: Record<string, unknown>) => ({
    manager: { query } as never,
    dataTableIdent: '"app_1"."records"',
    activeCondition: '_upl_deleted = false AND _app_deleted = false',
    attrs,
    row,
    lockKey: 'runtime-record-rules:"app_1"."records"'
})

describe('buildRuntimeRecordRuleLockKey', () => {
    it('produces one canonical key for quoted, bare and qualified identifier forms', () => {
        expect(buildRuntimeRecordRuleLockKey('"app_1"', 'records')).toBe(buildRuntimeRecordRuleLockKey('app_1', 'records'))
        expect(buildRuntimeRecordRuleLockKey('app_1', '"app_1"."records"')).toBe(buildRuntimeRecordRuleLockKey('"app_1"', 'records'))
        expect(buildRuntimeRecordRuleLockKey('app_1', 'records')).toBe('runtime-record-rules:app_1.records')
    })
})

describe('evaluateRuntimeRecordRules', () => {
    it('skips the database probe entirely when no root string rule uses pattern or unique', async () => {
        const { txExecutor } = createMockDbExecutor()

        const violation = await evaluateRuntimeRecordRules({
            ...baseParams(txExecutor.query, [stringAttr(), stringAttr({ validation_rules: { minLength: 3 } })], {
                section_key: 'programs'
            })
        })

        expect(violation).toBeNull()
        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('rejects a value that does not match the component pattern', async () => {
        const { txExecutor } = createMockDbExecutor()

        const violation = await evaluateRuntimeRecordRules({
            ...baseParams(txExecutor.query, [stringAttr({ validation_rules: { pattern: '^[a-z0-9-]+$' } })], {
                section_key: 'Invalid Key!'
            })
        })

        expect(violation).toMatchObject({
            statusCode: 400,
            code: RUNTIME_RECORD_RULE_CODES.patternMismatch,
            field: 'sectionKey'
        })
        // Pattern checks are read-free: they must not take the table lock.
        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('fails closed on a duplicate unique key and excludes the row being updated', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (String(sql).includes('pg_advisory_xact_lock')) return []
            if (String(sql).includes('SELECT id FROM')) return [{ id: 'row-1' }]
            return []
        })

        const violation = await evaluateRuntimeRecordRules({
            ...baseParams(txExecutor.query, [stringAttr({ validation_rules: { unique: true } })], { section_key: 'programs' }),
            excludeRowId: 'row-self'
        })

        expect(violation).toMatchObject({
            statusCode: 409,
            code: RUNTIME_RECORD_RULE_CODES.keyDuplicate,
            field: 'sectionKey'
        })

        const probe = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('SELECT id FROM'))
        expect(probe).toBeDefined()
        expect(String(probe?.[0])).toContain('"app_1"."records"')
        expect(String(probe?.[0])).toContain('"section_key"')
        expect(probe?.[1]).toEqual(['programs', 'row-self'])
    })

    it('accepts a unique key that is free on the runtime table', async () => {
        const { txExecutor } = createMockDbExecutor()

        const violation = await evaluateRuntimeRecordRules({
            ...baseParams(txExecutor.query, [stringAttr({ validation_rules: { unique: true } })], { section_key: 'programs' })
        })

        expect(violation).toBeNull()
        const probe = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('SELECT id FROM'))
        expect(probe?.[1]).toEqual(['programs', null])
    })

    it('skips empty values, non-string values and localizable text payloads', async () => {
        const { txExecutor } = createMockDbExecutor()

        const violation = await evaluateRuntimeRecordRules({
            ...baseParams(txExecutor.query, [stringAttr({ validation_rules: { unique: true, pattern: '^[a-z]+$' } })], {
                section_key: { locales: { en: { content: 'Programs' } } }
            })
        })

        expect(violation).toBeNull()
        // No write value, no lock and no probe: localized payloads are skipped.
        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('skips patterns with nested quantifiers instead of risking catastrophic backtracking', async () => {
        const { txExecutor } = createMockDbExecutor()

        const violation = await evaluateRuntimeRecordRules({
            ...baseParams(txExecutor.query, [stringAttr({ validation_rules: { pattern: '^(a+)+$' } })], {
                section_key: 'a'.repeat(64) + 'b'
            })
        })

        expect(violation).toBeNull()
        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('does not re-apply patterns for the closed hexColor formatter', async () => {
        const { txExecutor } = createMockDbExecutor()

        const violation = await evaluateRuntimeRecordRules({
            ...baseParams(txExecutor.query, [stringAttr({ validation_rules: { format: 'hexColor', pattern: '^#[0-9a-f]{6}$' } })], {
                section_key: 'NotAColour'
            })
        })

        expect(violation).toBeNull()
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SELECT id FROM'))).toBe(false)
    })

    it('skips unreasonably long patterns and values instead of risking regex backtracking', async () => {
        const { txExecutor } = createMockDbExecutor()

        const longPatternViolation = await evaluateRuntimeRecordRules({
            ...baseParams(txExecutor.query, [stringAttr({ validation_rules: { pattern: 'a'.repeat(600) } })], { section_key: 'x' })
        })
        expect(longPatternViolation).toBeNull()

        const longValueViolation = await evaluateRuntimeRecordRules({
            ...baseParams(txExecutor.query, [stringAttr({ validation_rules: { pattern: '^x$' } })], {
                section_key: 'y'.repeat(5000)
            })
        })
        expect(longValueViolation).toBeNull()
    })

    it('ignores an unparsable pattern instead of failing the write', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (String(sql).includes('SELECT id FROM')) return []
            return []
        })

        const violation = await evaluateRuntimeRecordRules({
            ...baseParams(txExecutor.query, [stringAttr({ validation_rules: { pattern: '(' } })], { section_key: 'anything' })
        })

        expect(violation).toBeNull()
    })
})
