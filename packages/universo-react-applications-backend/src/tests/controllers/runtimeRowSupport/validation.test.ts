import {
    applyRuntimeDateOffsetDerivations,
    validateRuntimeDateOrderRules,
    validateRuntimeRequiredWhenRules,
    validateRuntimeAccessLinkTarget
} from '../../../controllers/runtimeRowSupport/validation'
import type { RuntimeObjectCollectionAttr } from '../../../services/runtimeRowSupport/contracts'
import { createMockDbExecutor } from '../../utils/dbMocks'

const codename = (text: string) => ({ _primary: 'en', locales: { en: { content: text } } })

const attr = (columnName: string, dataType: string, label: string): RuntimeObjectCollectionAttr => ({
    id: `attr-${columnName}`,
    codename: codename(label),
    column_name: columnName,
    data_type: dataType,
    is_required: false
})

const attrs = [
    attr('start_date', 'DATE', 'StartDate'),
    attr('end_date', 'DATE', 'EndDate'),
    attr('due_date', 'DATE', 'DueDate'),
    attr('offset_days', 'NUMBER', 'OffsetDays'),
    attr('has_end', 'BOOLEAN', 'HasEnd'),
    attr('clear_flag', 'BOOLEAN', 'ClearFlag')
]

const accessLinkAttrs: RuntimeObjectCollectionAttr[] = [
    {
        id: 'target-type',
        codename: codename('TargetType'),
        column_name: 'target_type',
        data_type: 'STRING',
        is_required: true
    },
    {
        id: 'target-id',
        codename: codename('TargetId'),
        column_name: 'target_id',
        data_type: 'REF',
        target_object_id: '019f2000-0000-7000-8000-000000000201',
        target_object_kind: 'object',
        is_required: false
    },
    {
        id: 'content-target',
        codename: codename('ContentNodeIdRef'),
        column_name: 'content_node_id_ref',
        data_type: 'REF',
        target_object_id: '019f2000-0000-7000-8000-000000000202',
        target_object_kind: 'object',
        is_required: false
    }
]

describe('validateRuntimeAccessLinkTarget', () => {
    const workspaceId = '019f2000-0000-7000-8000-000000000301'
    const userId = '019f2000-0000-7000-8000-000000000302'
    const contentId = '019f2000-0000-7000-8000-000000000303'
    const quizId = '019f2000-0000-7000-8000-000000000304'
    const permissions = {
        manageMembers: false,
        manageApplication: true,
        createContent: true,
        editContent: true,
        deleteContent: true,
        readReports: true
    }

    const createValidator = (targetRows: Array<{ id: string }> = [{ id: contentId }]) => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('FROM runtime_schema._app_objects') && params?.[0] === 'LearningResources') {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000202',
                        codename: 'LearningResources',
                        table_name: 'learning_resources',
                        config: {}
                    }
                ]
            }
            if (sql.includes('FROM runtime_schema._app_objects') && params?.[0] === 'Quizzes') {
                return [{ id: '019f2000-0000-7000-8000-000000000201', codename: 'Quizzes', table_name: 'quizzes', config: {} }]
            }
            if (sql.includes('FROM runtime_schema._app_components')) return []
            if (sql.includes('FROM runtime_schema."learning_resources"') || sql.includes('FROM runtime_schema."quizzes"')) {
                return targetRows
            }
            return []
        })

        return executor
    }

    const validate = (row: Record<string, unknown>, targetRows?: Array<{ id: string }>) =>
        validateRuntimeAccessLinkTarget({
            manager: createValidator(targetRows),
            schemaIdent: 'runtime_schema',
            currentWorkspaceId: workspaceId,
            currentUserId: userId,
            permissions,
            objectCodename: 'AccessLinks',
            attrs: accessLinkAttrs,
            row
        })

    it('accepts a content target only when the linked LearningResources row exists in the active scope', async () => {
        await expect(validate({ target_type: 'content', content_node_id_ref: contentId })).resolves.toBeNull()
        await expect(validate({ target_type: 'content', content_node_id_ref: contentId }, [])).resolves.toBe('Invalid access-link target')
    })

    it('accepts a quiz target through its typed Quizzes reference', async () => {
        await expect(validate({ target_type: 'quiz', target_id: quizId }, [{ id: quizId }])).resolves.toBeNull()
    })

    it('locks an active target row when validation runs inside a write transaction', async () => {
        const manager = createValidator([{ id: quizId }])
        await expect(
            validateRuntimeAccessLinkTarget({
                manager,
                schemaIdent: 'runtime_schema',
                currentWorkspaceId: workspaceId,
                currentUserId: userId,
                permissions,
                objectCodename: 'AccessLinks',
                attrs: accessLinkAttrs,
                row: { target_type: 'quiz', target_id: quizId },
                lockTarget: true
            })
        ).resolves.toBeNull()

        const targetQuery = manager.query.mock.calls.find(([sql]) => String(sql).includes('FROM runtime_schema."quizzes"'))
        expect(targetQuery?.[0]).toContain('FOR SHARE')
    })

    it.each([
        ['unknown type', { target_type: 'external', content_node_id_ref: contentId }],
        ['missing target', { target_type: 'content' }],
        ['conflicting targets', { target_type: 'content', content_node_id_ref: contentId, target_id: quizId }],
        ['invalid reference', { target_type: 'content', content_node_id_ref: 'not-a-uuid' }]
    ])('rejects an %s before a public link can be persisted', async (_label, row) => {
        await expect(validate(row)).resolves.toBe('Invalid access-link target')
    })
})

describe('validateRuntimeRequiredWhenRules', () => {
    const validate = (config: Record<string, unknown> | null | undefined, row: Record<string, unknown>) =>
        validateRuntimeRequiredWhenRules({ config, attrs, row })
    const rule = { field: 'EndDate', when: { field: 'HasEnd', equals: true } }
    const config = { runtimeValidations: { requiredWhen: [rule] } }
    const message = 'Required field missing: EndDate is required when HasEnd matches'

    it('returns null without rules and supports the legacy runtimeValidation root', () => {
        expect(validate(undefined, {})).toBeNull()
        expect(validate({ runtimeValidations: { requiredWhen: [] } }, {})).toBeNull()
        expect(validate({ runtimeValidation: config.runtimeValidations }, { has_end: true, end_date: '' })).toBe(message)
    })

    it('passes on a present target and skips the rule when the condition does not match', () => {
        expect(validate(config, { has_end: true, end_date: '2026-05-01' })).toBeNull()
        expect(validate(config, { has_end: false })).toBeNull()
    })

    it('rejects whitespace-only and null targets when the condition matches', () => {
        expect(validate(config, { has_end: true, end_date: '   ' })).toBe(message)
        expect(validate(config, { has_end: true, end_date: null })).toBe(message)
    })

    it('uses the custom message when one is configured', () => {
        const customRule = { ...rule, message: 'End date is mandatory' }
        expect(validate({ runtimeValidations: { requiredWhen: [customRule] } }, { has_end: true })).toBe('End date is mandatory')
    })

    it('treats an operator-less condition as a presence check where false still counts as present', () => {
        const presence = { runtimeValidations: { requiredWhen: [{ field: 'EndDate', when: { field: 'HasEnd' } }] } }
        expect(validate(presence, { has_end: null })).toBeNull()
        expect(validate(presence, { has_end: false, end_date: null })).toBe(message)
    })

    it('supports notEquals and in operators', () => {
        const operators = {
            runtimeValidations: {
                requiredWhen: [
                    { field: 'EndDate', when: { field: 'HasEnd', notEquals: false } },
                    { field: 'OffsetDays', when: { field: 'HasEnd', in: ['true'] } }
                ]
            }
        }
        expect(validate(operators, { has_end: true, end_date: '2026-01-01', offset_days: 3 })).toBeNull()
        expect(validate(operators, { has_end: true, end_date: '2026-01-01' })).toBe(
            'Required field missing: OffsetDays is required when HasEnd matches'
        )
    })

    it('fails closed when the target or condition field is missing from attrs', () => {
        const missingTarget = { runtimeValidations: { requiredWhen: [{ field: 'MissingField', when: { field: 'HasEnd' } }] } }
        const missingCondition = { runtimeValidations: { requiredWhen: [{ field: 'EndDate', when: { field: 'MissingField' } }] } }
        expect(validate(missingTarget, {})).toBe('Runtime required validation references missing field: MissingField')
        expect(validate(missingCondition, {})).toBe('Runtime required validation references missing field: MissingField')
    })
})

describe('validateRuntimeDateOrderRules', () => {
    const validate = (rule: Record<string, unknown> | null, row: Record<string, unknown>) =>
        validateRuntimeDateOrderRules({
            config: rule ? { runtimeValidations: { dateOrder: [rule] } } : undefined,
            attrs,
            row
        })
    const orderRule = { startField: 'StartDate', endField: 'EndDate' }

    it('returns null without rules and skips rows with an empty end date', () => {
        expect(validate(null, {})).toBeNull()
        expect(validate(orderRule, { start_date: '2026-01-01', end_date: null })).toBeNull()
    })

    it('requires the start date once the end date is set', () => {
        expect(validate(orderRule, { end_date: '2026-01-01' })).toBe('Invalid date order: EndDate requires StartDate')
    })

    it('allows equal dates by default and rejects them when allowEqual is false', () => {
        const row = { start_date: '2026-01-01', end_date: '2026-01-01' }
        expect(validate(orderRule, row)).toBeNull()
        expect(validate({ ...orderRule, allowEqual: false }, row)).toBe('Invalid date order: EndDate must be after StartDate')
    })

    it('rejects an end date before the start date and honors custom messages', () => {
        expect(validate(orderRule, { start_date: '2026-02-01', end_date: '2026-01-31' })).toBe(
            'Invalid date order: EndDate must be on or after StartDate'
        )
        expect(validate({ ...orderRule, message: 'Dates out of order' }, { start_date: '2026-02-01', end_date: '2026-01-01' })).toBe(
            'Dates out of order'
        )
    })

    it('rejects values that are not valid calendar dates', () => {
        expect(validate(orderRule, { start_date: '2026-02-30', end_date: '2026-03-01' })).toBe(
            'Invalid date order: StartDate and EndDate must contain valid dates'
        )
    })

    it('fails closed on missing and non-DATE fields', () => {
        expect(validate({ startField: 'MissingField', endField: 'EndDate' }, { end_date: '2026-01-01' })).toBe(
            'Runtime date validation references missing field: MissingField'
        )
        expect(validate({ startField: 'HasEnd', endField: 'EndDate' }, { has_end: true, end_date: '2026-01-01' })).toBe(
            'Runtime date validation fields must be DATE fields: HasEnd, EndDate'
        )
    })
})

describe('applyRuntimeDateOffsetDerivations', () => {
    const derive = (rule: Record<string, unknown> | null, row: Record<string, unknown>) =>
        applyRuntimeDateOffsetDerivations({
            config: rule ? { runtimeDerivations: { dateOffset: [rule] } } : undefined,
            attrs,
            row
        })
    const baseRule = { targetField: 'DueDate', startField: 'StartDate', offsetDaysField: 'OffsetDays' }
    const offsetError = (offsetDays: unknown) => derive(baseRule, { start_date: '2026-01-01', offset_days: offsetDays }).error

    it('returns the original row untouched when no rules are configured', () => {
        const row = { start_date: '2026-01-01', offset_days: 1 }
        const result = derive(null, row)
        expect(result.error).toBeNull()
        expect(result.row).toBe(row)
    })

    it('derives the target date without mutating the source row', () => {
        const row = { start_date: '2026-01-30', offset_days: 3 }
        const result = derive(baseRule, row)
        expect(result.row).toEqual({ start_date: '2026-01-30', offset_days: 3, due_date: '2026-02-02' })
        expect(row).toEqual({ start_date: '2026-01-30', offset_days: 3 })
    })

    it('accepts zero and numeric-string offsets and reads codename keys as fallback', () => {
        expect(derive(baseRule, { start_date: '2026-03-31', offset_days: '0' }).row.due_date).toBe('2026-03-31')
        expect(derive(baseRule, { StartDate: '2026-01-01', OffsetDays: '7' }).row.due_date).toBe('2026-01-08')
    })

    it('applies when and clearWhen conditions', () => {
        const conditional = { ...baseRule, when: { field: 'ClearFlag', equals: false } }
        expect(derive(conditional, { start_date: '2026-01-01', offset_days: 1, clear_flag: true }).row.due_date).toBeUndefined()
        expect(derive(conditional, { start_date: '2026-01-01', offset_days: 1, clear_flag: false }).row.due_date).toBe('2026-01-02')

        const clearing = { ...baseRule, clearWhen: { field: 'ClearFlag', equals: true }, when: { field: 'ClearFlag', equals: false } }
        const cleared = derive(clearing, { start_date: '2026-01-01', offset_days: 1, clear_flag: true, due_date: '2026-01-02' })
        expect(cleared.error).toBeNull()
        expect(cleared.row.due_date).toBeNull()
    })

    it('rejects invalid dates and invalid offsets', () => {
        const dateError = (startDate: unknown) => derive(baseRule, { start_date: startDate, offset_days: 1 }).error
        expect(dateError('not-a-date')).toBe('Runtime date derivation requires valid date: StartDate')
        expect(dateError(null)).toBe('Runtime date derivation requires valid date: StartDate')
        expect(offsetError(-1)).toBe('Runtime date derivation requires valid day offset: OffsetDays')
        expect(offsetError(3651)).toBe('Runtime date derivation requires valid day offset: OffsetDays')
        expect(offsetError(1.5)).toBe('Runtime date derivation requires valid day offset: OffsetDays')
        expect(offsetError('abc')).toBe('Runtime date derivation requires valid day offset: OffsetDays')
    })

    it('fails closed on missing fields, wrong data types and broken conditions', () => {
        expect(derive({ ...baseRule, targetField: 'MissingField' }, { start_date: '2026-01-01', offset_days: 1 }).error).toBe(
            'Runtime date derivation references missing field: MissingField'
        )
        expect(derive({ targetField: 'DueDate', startField: 'StartDate', offsetDaysField: 'ClearFlag' }, {}).error).toBe(
            'Runtime date derivation fields must be DATE, DATE, NUMBER: DueDate, StartDate, ClearFlag'
        )
        expect(derive({ ...baseRule, when: { field: 'MissingField' } }, { start_date: '2026-01-01', offset_days: 1 }).error).toBe(
            'Runtime required validation references missing field: MissingField'
        )
    })
})
