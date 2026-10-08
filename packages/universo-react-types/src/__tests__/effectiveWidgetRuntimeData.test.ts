import { describe, expect, it } from 'vitest'

import { effectiveWidgetRuntimeDataSchema } from '../common/effectiveWidgetRuntimeData'

const completeReorderTable = {
    kind: 'table',
    sourceEntityCodename: 'DashboardRows',
    columns: [{ key: 'title', label: 'Title' }],
    rows: [
        {
            key: 'course-intro',
            mutationTarget: {
                recordHandle: 'rh1.test-dashboard-row-handle',
                entityCodename: 'DashboardRows',
                version: 4
            },
            cells: [{ key: 'title', value: 'Introduction' }]
        }
    ],
    pagination: { total: 1, limit: 20, offset: 0, complete: true }
}

describe('effective widget runtime table mutation projection', () => {
    it('accepts a complete semantic reorder target without placing identity in cell content', () => {
        const parsed = effectiveWidgetRuntimeDataSchema.safeParse({ status: 'ready', data: completeReorderTable })

        expect(parsed.success).toBe(true)
        if (!parsed.success || parsed.data.status !== 'ready' || parsed.data.data.kind !== 'table') return
        expect(parsed.data.data.rows[0]?.mutationTarget).toEqual(completeReorderTable.rows[0]?.mutationTarget)
        expect(parsed.data.data.rows[0]?.cells).toEqual([{ key: 'title', value: 'Introduction' }])
    })

    it.each([
        {
            name: 'rejects a physical UUID instead of an opaque record handle',
            payload: {
                ...completeReorderTable,
                rows: [
                    {
                        ...completeReorderTable.rows[0],
                        mutationTarget: {
                            ...completeReorderTable.rows[0].mutationTarget,
                            recordHandle: '0190a9b5-3cde-7abc-8def-0123456789b2'
                        }
                    }
                ]
            }
        },
        {
            name: 'rejects incomplete record sets that carry row targets',
            payload: { ...completeReorderTable, pagination: { total: 2, limit: 1, offset: 0 } }
        },
        {
            name: 'rejects a complete set with no semantic source',
            payload: { ...completeReorderTable, sourceEntityCodename: undefined }
        },
        {
            name: 'rejects complete metadata without a mutation target for every row',
            payload: {
                ...completeReorderTable,
                rows: [{ key: 'course-intro', cells: [{ key: 'title', value: 'Introduction' }] }]
            }
        }
    ])('$name', ({ payload }) => {
        expect(effectiveWidgetRuntimeDataSchema.safeParse({ status: 'ready', data: payload }).success).toBe(false)
    })
})
