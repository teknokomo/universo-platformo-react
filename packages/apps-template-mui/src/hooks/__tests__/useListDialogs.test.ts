import { renderHook, act } from '@testing-library/react'
import { useListDialogs } from '../useListDialogs'

interface TestEntity {
    id: string
    name: string
}

describe('useListDialogs', () => {
    it('initialises with all dialogs closed', () => {
        const { result } = renderHook(() => useListDialogs<TestEntity>())

        expect(result.current.dialogs.create.open).toBe(false)
        expect(result.current.dialogs.edit.open).toBe(false)
        expect(result.current.dialogs.edit.item).toBeNull()
        expect(result.current.dialogs.copy.open).toBe(false)
        expect(result.current.dialogs.copy.item).toBeNull()
        expect(result.current.dialogs.delete.open).toBe(false)
        expect(result.current.dialogs.delete.item).toBeNull()
        expect(result.current.dialogs.conflict.open).toBe(false)
    })

    it('openCreate opens the create dialog', () => {
        const { result } = renderHook(() => useListDialogs<TestEntity>())

        act(() => result.current.openCreate())

        expect(result.current.dialogs.create.open).toBe(true)
    })

    it('openEdit opens the edit dialog with item', () => {
        const { result } = renderHook(() => useListDialogs<TestEntity>())
        const item: TestEntity = { id: '1', name: 'Test' }

        act(() => result.current.openEdit(item))

        expect(result.current.dialogs.edit.open).toBe(true)
        expect(result.current.dialogs.edit.item).toEqual(item)
    })

    it('openCopy opens the copy dialog with item', () => {
        const { result } = renderHook(() => useListDialogs<TestEntity>())
        const item: TestEntity = { id: '2', name: 'Copy me' }

        act(() => result.current.openCopy(item))

        expect(result.current.dialogs.copy.open).toBe(true)
        expect(result.current.dialogs.copy.item).toEqual(item)
    })

    it('openDelete opens the delete dialog with item', () => {
        const { result } = renderHook(() => useListDialogs<TestEntity>())
        const item: TestEntity = { id: '3', name: 'Delete me' }

        act(() => result.current.openDelete(item))

        expect(result.current.dialogs.delete.open).toBe(true)
        expect(result.current.dialogs.delete.item).toEqual(item)
    })

    it('openConflict opens the conflict dialog with data', () => {
        const { result } = renderHook(() => useListDialogs<TestEntity>())
        const data = { conflictingId: '99' }

        act(() => result.current.openConflict(data))

        expect(result.current.dialogs.conflict.open).toBe(true)
        expect(result.current.dialogs.conflict.data).toEqual(data)
    })

    it('close resets a specific dialog', () => {
        const { result } = renderHook(() => useListDialogs<TestEntity>())
        const item: TestEntity = { id: '1', name: 'Test' }

        act(() => result.current.openEdit(item))
        expect(result.current.dialogs.edit.open).toBe(true)

        act(() => result.current.close('edit'))
        expect(result.current.dialogs.edit.open).toBe(false)
        expect(result.current.dialogs.edit.item).toBeNull()
    })

    it('closing one dialog does not affect others', () => {
        const { result } = renderHook(() => useListDialogs<TestEntity>())
        const item: TestEntity = { id: '1', name: 'Test' }

        act(() => {
            result.current.openCreate()
            result.current.openEdit(item)
        })

        expect(result.current.dialogs.create.open).toBe(true)
        expect(result.current.dialogs.edit.open).toBe(true)

        act(() => result.current.close('create'))

        expect(result.current.dialogs.create.open).toBe(false)
        expect(result.current.dialogs.edit.open).toBe(true)
        expect(result.current.dialogs.edit.item).toEqual(item)
    })

    it('returns stable callback references across renders', () => {
        const { result, rerender } = renderHook(() => useListDialogs<TestEntity>())

        const firstOpenCreate = result.current.openCreate
        const firstClose = result.current.close

        rerender()

        expect(result.current.openCreate).toBe(firstOpenCreate)
        expect(result.current.close).toBe(firstClose)
    })
})
