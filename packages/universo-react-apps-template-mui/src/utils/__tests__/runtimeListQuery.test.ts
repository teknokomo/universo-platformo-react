import { describe, expect, it, vi } from 'vitest'
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

    it('converts valid Date instances to ISO timestamps and drops invalid Date values', () => {
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
        ).toEqual([validDate.toISOString(), '2026-02-31T08:30'])
    })

    it('serializes date-only columns as calendar dates and datetime filter wall times as UTC instants', () => {
        const date = new Date('2026-10-14T00:00:00.000Z')
        const datetime = new Date('2026-10-14T08:30')

        expect(
            mapGridFilterModel(
                {
                    items: [
                        { field: 'SubmittedOn', operator: 'is', value: date },
                        { field: 'SubmittedAt', operator: 'is', value: datetime },
                        { field: 'SubmittedOn', operator: 'is', value: '2026-10-14' }
                    ]
                },
                new Map([
                    ['SubmittedOn', 'date'],
                    ['SubmittedAt', 'datetime']
                ])
            )
        ).toEqual([
            { field: 'SubmittedOn', operator: 'equals', value: '2026-10-14' },
            { field: 'SubmittedAt', operator: 'equals', value: '2026-10-14T08:30:00.000Z' },
            { field: 'SubmittedOn', operator: 'equals', value: '2026-10-14' }
        ])
    })

    it('preserves the selected MUI calendar day west of UTC', () => {
        vi.stubEnv('TZ', 'America/Los_Angeles')
        try {
            const muiDateInput = new Date('2026-10-14')
            expect(
                mapGridFilterModel(
                    { items: [{ field: 'SubmittedOn', operator: 'is', value: muiDateInput }] },
                    new Map([['SubmittedOn', 'date']])
                )
            ).toEqual([{ field: 'SubmittedOn', operator: 'equals', value: '2026-10-14' }])
        } finally {
            vi.unstubAllEnvs()
        }
    })

    it('interprets report datetime-local filters in UTC to match displayed timestamps', () => {
        vi.stubEnv('TZ', 'Europe/Moscow')
        const localDateTime = '2026-10-14T05:30'
        const dateCompositions = new Map([
            ['SubmittedAt', 'datetime' as const],
            ['SubmittedOn', 'date' as const]
        ])
        try {
            const muiDateTimeInput = new Date(localDateTime)
            expect(
                mapGridFilterModel(
                    {
                        items: [
                            { field: 'SubmittedAt', operator: 'is', value: muiDateTimeInput },
                            { field: 'SubmittedAt', operator: 'is', value: '2026-02-31T08:30' },
                            { field: 'SubmittedOn', operator: 'is', value: '2026-10-14T08:30' }
                        ]
                    },
                    dateCompositions
                )
            ).toEqual([{ field: 'SubmittedAt', operator: 'equals', value: '2026-10-14T05:30:00.000Z' }])
        } finally {
            vi.unstubAllEnvs()
        }
    })

    it('does not emit the unsupported MUI date-time negation operator', () => {
        expect(mapGridFilterModel({ items: [{ field: 'SubmittedAt', operator: 'not', value: '2026-10-14T08:30' }] })).toEqual([])
    })
})
