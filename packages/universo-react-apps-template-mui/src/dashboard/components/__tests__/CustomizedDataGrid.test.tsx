import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCustomizedDataGridRowClassName, default as CustomizedDataGrid } from '../CustomizedDataGrid'

const gridApi = vi.hoisted(() => {
    const resetRowHeights = vi.fn()
    return { apiRef: { current: { resetRowHeights } }, resetRowHeights }
})

vi.mock('@mui/x-data-grid', async () => {
    const actual = await vi.importActual<typeof import('@mui/x-data-grid')>('@mui/x-data-grid')
    return {
        ...actual,
        useGridApiRef: () => gridApi.apiRef,
        DataGrid: (props: { getRowHeight?: () => number | 'auto'; density?: string; apiRef?: unknown; sx?: unknown }) => {
            rowHeightCallbacks.push(props.getRowHeight)
            dataGridSxValues.push(props.sx)
            return (
                <div
                    data-testid='mock-customized-data-grid'
                    data-row-height={String(props.getRowHeight?.())}
                    data-density={props.density ?? ''}
                />
            )
        }
    }
})

const rowHeightCallbacks: Array<(() => number | 'auto') | undefined> = []
const dataGridSxValues: unknown[] = []
const pendingAnimationFrames = new Map<number, FrameRequestCallback>()
let nextAnimationFrameId = 0

class MockResizeObserver {
    static instances: MockResizeObserver[] = []

    observedTarget: Element | null = null

    constructor(private readonly callback: ResizeObserverCallback) {
        MockResizeObserver.instances.push(this)
    }

    observe(target: Element) {
        this.observedTarget = target
    }

    disconnect() {
        this.observedTarget = null
    }

    trigger(width: number) {
        if (!this.observedTarget) throw new Error('ResizeObserver has no observed target')

        this.callback(
            [{ target: this.observedTarget, contentRect: { width } as DOMRectReadOnly } as ResizeObserverEntry],
            this as unknown as ResizeObserver
        )
    }
}

beforeEach(() => {
    rowHeightCallbacks.length = 0
    dataGridSxValues.length = 0
    MockResizeObserver.instances = []
    pendingAnimationFrames.clear()
    nextAnimationFrameId = 0
    gridApi.resetRowHeights.mockClear()
})

afterEach(() => {
    vi.unstubAllGlobals()
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

    it('fills the grid root only when requested', () => {
        render(
            <CustomizedDataGrid
                rows={[{ id: 'row-1', description: 'A short description' }]}
                columns={[{ field: 'description', headerName: 'Description' }]}
                fillHeight
            />
        )

        expect(dataGridSxValues.at(-1)).toEqual(expect.objectContaining({ height: '100%', minHeight: 0 }))
    })
})

describe('CustomizedDataGrid row-height behavior', () => {
    it('keeps its dynamic row-height callback stable across data rerenders', () => {
        const { rerender } = render(
            <CustomizedDataGrid
                rows={[{ id: 'row-1', description: 'A long multiline description' }]}
                columns={[{ field: 'description', headerName: 'Description' }]}
            />
        )
        const initialGetRowHeight = rowHeightCallbacks.at(-1)

        rerender(
            <CustomizedDataGrid
                rows={[{ id: 'row-2', description: 'Another multiline description' }]}
                columns={[{ field: 'description', headerName: 'Description' }]}
            />
        )

        expect(rowHeightCallbacks.at(-1)).toBe(initialGetRowHeight)
    })

    it('resets dynamic row measurements when the grid container width changes', () => {
        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            const frameId = ++nextAnimationFrameId
            pendingAnimationFrames.set(frameId, callback)
            return frameId
        })
        vi.stubGlobal('cancelAnimationFrame', (frameId: number) => {
            pendingAnimationFrames.delete(frameId)
        })

        render(
            <CustomizedDataGrid
                rows={[{ id: 'row-1', description: 'A long multiline description' }]}
                columns={[{ field: 'description', headerName: 'Description' }]}
            />
        )

        const observer = MockResizeObserver.instances[0]
        expect(observer?.observedTarget).toBe(screen.getByTestId('mock-customized-data-grid').parentElement)

        act(() => {
            observer?.trigger(390)
            observer?.trigger(768)
            observer?.trigger(700)
        })
        expect(pendingAnimationFrames.size).toBe(1)
        expect(gridApi.resetRowHeights).not.toHaveBeenCalled()

        const pendingFrame = Array.from(pendingAnimationFrames.values()).at(-1)
        act(() => pendingFrame?.(0))
        expect(gridApi.resetRowHeights).toHaveBeenCalledTimes(1)

        act(() => observer?.trigger(700))
        expect(gridApi.resetRowHeights).toHaveBeenCalledTimes(1)
    })

    it('does not observe widths when a fixed row height is configured', () => {
        vi.stubGlobal('ResizeObserver', MockResizeObserver)

        render(
            <CustomizedDataGrid
                rows={[{ id: 'row-1', description: 'A long multiline description' }]}
                columns={[{ field: 'description', headerName: 'Description' }]}
                rowHeight={64}
            />
        )

        expect(MockResizeObserver.instances).toHaveLength(0)
        expect(gridApi.resetRowHeights).not.toHaveBeenCalled()
    })
})
