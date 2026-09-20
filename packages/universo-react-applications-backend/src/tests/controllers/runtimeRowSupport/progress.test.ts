import {
    readRuntimeProgressAggregateParents,
    readRuntimeProgressNumber,
    readRuntimeProgressPrerequisiteIds,
    readRuntimeProgressSequencePolicy,
    readRuntimeProgressStatus,
    readRuntimeProgressString,
    statusFromAggregatedProgress,
    toPositiveRuntimeWeight,
    toRuntimeBoolean
} from '../../../controllers/runtimeRowSupport/progress'

describe('readRuntimeProgressSequencePolicy', () => {
    it('returns null when runtimeProgress or the sequencePolicy key is absent', () => {
        expect(readRuntimeProgressSequencePolicy(null)).toBeNull()
        expect(readRuntimeProgressSequencePolicy({})).toBeNull()
        expect(readRuntimeProgressSequencePolicy({ runtimeProgress: 'invalid' })).toBeNull()
        expect(readRuntimeProgressSequencePolicy({ runtimeProgress: ['invalid'] })).toBeNull()
        expect(readRuntimeProgressSequencePolicy({ runtimeProgress: { aggregateParents: [] } })).toBeNull()
    })

    it('treats an explicit free policy as no sequence policy', () => {
        expect(readRuntimeProgressSequencePolicy({ runtimeProgress: { sequencePolicy: { mode: 'free' } } })).toBeNull()
    })

    it('returns the parsed policy for a configured mode', () => {
        expect(
            readRuntimeProgressSequencePolicy({
                runtimeProgress: { sequencePolicy: { mode: 'sequential', orderFieldCodename: 'order' } }
            })
        ).toEqual({
            invalid: false,
            sequencePolicy: {
                mode: 'sequential',
                orderFieldCodename: 'order',
                completion: []
            }
        })
    })

    it('fails closed on an invalid policy payload', () => {
        expect(readRuntimeProgressSequencePolicy({ runtimeProgress: { sequencePolicy: { mode: 'bogus' } } })).toEqual({ invalid: true })
        expect(readRuntimeProgressSequencePolicy({ runtimeProgress: { sequencePolicy: { mode: 'sequential', bogus: true } } })).toEqual({
            invalid: true
        })
    })
})

describe('readRuntimeProgressAggregateParents', () => {
    it('returns null when the key is absent or the array is empty', () => {
        expect(readRuntimeProgressAggregateParents(undefined)).toBeNull()
        expect(readRuntimeProgressAggregateParents({ runtimeProgress: {} })).toBeNull()
        expect(readRuntimeProgressAggregateParents({ runtimeProgress: { aggregateParents: [] } })).toBeNull()
    })

    it('parses aggregate parents with the requiredOnly default', () => {
        expect(
            readRuntimeProgressAggregateParents({
                runtimeProgress: { aggregateParents: [{ parentObjectCodename: 'courses', parentIdFieldCodename: 'courseId' }] }
            })
        ).toEqual({
            invalid: false,
            aggregateParents: [{ parentObjectCodename: 'courses', parentIdFieldCodename: 'courseId', requiredOnly: false }]
        })

        expect(
            readRuntimeProgressAggregateParents({
                runtimeProgress: {
                    aggregateParents: [
                        {
                            parentObjectCodename: 'courses',
                            parentIdFieldCodename: 'courseId',
                            itemWeightFieldCodename: 'weight',
                            itemRequiredFieldCodename: 'required',
                            requiredOnly: true
                        }
                    ]
                }
            })
        ).toMatchObject({
            invalid: false,
            aggregateParents: [{ requiredOnly: true, itemWeightFieldCodename: 'weight', itemRequiredFieldCodename: 'required' }]
        })
    })

    it('fails closed for malformed items and more than eight parents', () => {
        expect(
            readRuntimeProgressAggregateParents({ runtimeProgress: { aggregateParents: [{ parentObjectCodename: 'courses' }] } })
        ).toEqual({
            invalid: true
        })
        const nineParents = Array.from({ length: 9 }, (_, index) => ({
            parentObjectCodename: `parent_${index}`,
            parentIdFieldCodename: 'parentId'
        }))
        expect(readRuntimeProgressAggregateParents({ runtimeProgress: { aggregateParents: nineParents } })).toEqual({ invalid: true })
    })
})

describe('readRuntimeProgressString', () => {
    it('trims strings and rejects empty or non-string values', () => {
        expect(readRuntimeProgressString('  value  ')).toBe('value')
        expect(readRuntimeProgressString('   ')).toBeUndefined()
        expect(readRuntimeProgressString(42)).toBeUndefined()
        expect(readRuntimeProgressString(null)).toBeUndefined()
    })
})

describe('readRuntimeProgressNumber', () => {
    it('accepts finite numbers and numeric strings only', () => {
        expect(readRuntimeProgressNumber(42)).toBe(42)
        expect(readRuntimeProgressNumber(' 3.5 ')).toBe(3.5)
        expect(readRuntimeProgressNumber('abc')).toBeUndefined()
        expect(readRuntimeProgressNumber('')).toBeUndefined()
        expect(readRuntimeProgressNumber(Number.NaN)).toBeUndefined()
    })
})

describe('readRuntimeProgressStatus', () => {
    it('keeps known completion statuses and defaults everything else to notStarted', () => {
        expect(readRuntimeProgressStatus('completed')).toBe('completed')
        expect(readRuntimeProgressStatus('passed')).toBe('passed')
        expect(readRuntimeProgressStatus('bogus')).toBe('notStarted')
        expect(readRuntimeProgressStatus(null)).toBe('notStarted')
    })
})

describe('readRuntimeProgressPrerequisiteIds', () => {
    it('normalizes arrays and comma-separated strings', () => {
        expect(readRuntimeProgressPrerequisiteIds(['a', ' b ', '', 7])).toEqual(['a', ' b '])
        expect(readRuntimeProgressPrerequisiteIds('a, b ,, c')).toEqual(['a', 'b', 'c'])
        expect(readRuntimeProgressPrerequisiteIds(null)).toEqual([])
    })
})

describe('runtime progress scalar helpers', () => {
    it('converts boolean-like values', () => {
        expect(toRuntimeBoolean(true)).toBe(true)
        expect(toRuntimeBoolean(0)).toBe(false)
        expect(toRuntimeBoolean(2)).toBe(true)
        expect(toRuntimeBoolean(' YES ')).toBe(true)
        expect(toRuntimeBoolean('no')).toBe(false)
        expect(toRuntimeBoolean(null)).toBe(false)
    })

    it('maps aggregated percentages to statuses', () => {
        expect(statusFromAggregatedProgress(0)).toBe('notStarted')
        expect(statusFromAggregatedProgress(30)).toBe('inProgress')
        expect(statusFromAggregatedProgress(100)).toBe('completed')
    })

    it('accepts only positive weights', () => {
        expect(toPositiveRuntimeWeight('2.5')).toBe(2.5)
        expect(toPositiveRuntimeWeight(0)).toBeUndefined()
        expect(toPositiveRuntimeWeight(-3)).toBeUndefined()
        expect(toPositiveRuntimeWeight('abc')).toBeUndefined()
    })
})
