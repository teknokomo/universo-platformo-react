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
        const inputValue = operator.endsWith('Empty') ? undefined : new Date('2026-10-14T08:30:00.000Z')
        expect(
            mapGridFilterModel({
                items: [{ field: 'SubmittedAt', operator, value: inputValue }]
            })
        ).toEqual([
            {
                field: 'SubmittedAt',
                operator: expected,
                ...(inputValue === undefined ? {} : { value: inputValue.toISOString() })
            }
        ])
    })

    it('preserves date-shaped strings used by text and reference columns', () => {
        const values = ['2026-10-14', '2026-10-14T08:30', '2026-10-14T08:30:45.12+03:00']
        expect(
            mapGridFilterModel({
                items: values.map((value) => ({ field: 'SubmittedAt', operator: 'is', value }))
            }).map(({ value }) => value)
        ).toEqual(values)
    })

    it('converts valid Date instances to ISO timestamps and leaves string and invalid Date values unchanged', () => {
        const validDate = new Date('2026-10-14T08:30:00.000Z')
        const invalidDate = new Date(Number.NaN)
        expect(
            mapGridFilterModel({
                items: [
                    { field: 'SubmittedAt', operator: 'is', value: validDate },
                    { field: 'SubmittedAt', operator: 'is', value: '2026-02-31T08:30' },
                    { field: 'SubmittedAt', operator: 'is', value: invalidDate }
                ]
            }).map(({ value }) => value)
        ).toEqual([validDate.toISOString(), '2026-02-31T08:30', invalidDate])
    })

    it('does not emit the unsupported MUI date-time negation operator', () => {
        expect(mapGridFilterModel({ items: [{ field: 'SubmittedAt', operator: 'not', value: '2026-10-14T08:30' }] })).toEqual([])
    })
})
