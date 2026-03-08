import { describe, expect, it } from 'vitest'
import { getCustomizedDataGridRowClassName } from '../CustomizedDataGrid'

describe('getCustomizedDataGridRowClassName', () => {
    it('keeps pending create rows visually normal until feedback is revealed', () => {
        expect(getCustomizedDataGridRowClassName({ id: 'row-1', __pending: true, __pendingAction: 'create' }, 0)).toBe('even')
        expect(
            getCustomizedDataGridRowClassName(
                { id: 'row-1', __pending: true, __pendingAction: 'create', __pendingFeedbackVisible: true },
                1
            )
        ).toBe('odd pending-create')
    })

    it('preserves delete fade classes for optimistic delete rows', () => {
        expect(getCustomizedDataGridRowClassName({ id: 'row-2', __pending: true, __pendingAction: 'delete' }, 0)).toBe(
            'even pending-delete'
        )
    })
})