import { describe, expect, it } from 'vitest'
import { mapGridFilterModel } from '../runtimeListQuery'

describe('mapGridFilterModel date-time operators', () => {
    it.each([
        ['after', 'greaterThan'],
        ['onOrAfter', 'greaterThanOrEqual'],
        ['before', 'lessThan'],
        ['onOrBefore', 'lessThanOrEqual'],
        ['is', 'equals'],
        ['isEmpty', 'isEmpty'],
        ['isNotEmpty', 'isNotEmpty']
    ] as const)('maps MUI date operator %s to the runtime filter contract', (operator, expected) => {
        expect(
            mapGridFilterModel({
                items: [{ field: 'SubmittedAt', operator, value: operator.endsWith('Empty') ? undefined : '2026-10-14T08:30' }]
            })
        ).toEqual([
            {
                field: 'SubmittedAt',
                operator: expected,
                ...(operator.endsWith('Empty') ? {} : { value: '2026-10-14T08:30' })
            }
        ])
    })

    it('does not emit the unsupported MUI date-time negation operator', () => {
        expect(mapGridFilterModel({ items: [{ field: 'SubmittedAt', operator: 'not', value: '2026-10-14T08:30' }] })).toEqual([])
    })
})
