import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getCustomizedDataGridRowClassName, default as CustomizedDataGrid } from '../CustomizedDataGrid'

vi.mock('@mui/x-data-grid', async () => {
    const actual = await vi.importActual<typeof import('@mui/x-data-grid')>('@mui/x-data-grid')
    return {
        ...actual,
        DataGrid: (props: { getRowHeight?: () => number | 'auto'; density?: string }) => (
            <div
                data-testid='mock-customized-data-grid'
                data-row-height={String(props.getRowHeight?.())}
                data-density={props.density ?? ''}
            />
        )
    }
})

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

    it('uses auto row height by default so multiline runtime cells are not clipped', () => {
        render(
            <CustomizedDataGrid
                rows={[{ id: 'row-1', description: 'A long multiline description' }]}
                columns={[{ field: 'description', headerName: 'Description' }]}
            />
        )

        expect(screen.getByTestId('mock-customized-data-grid')).toHaveAttribute('data-row-height', 'auto')
    })

    it('keeps explicit fixed row-height overrides intact', () => {
        render(
            <CustomizedDataGrid
                rows={[{ id: 'row-1', description: 'A short description' }]}
                columns={[{ field: 'description', headerName: 'Description' }]}
                rowHeight={64}
            />
        )

        expect(screen.getByTestId('mock-customized-data-grid')).toHaveAttribute('data-row-height', '64')
    })
})
