import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ data: null as Record<string, unknown> | null, updateRecord: vi.fn() }))

vi.mock('../../../entities/metadata/record/api', () => ({ updateRecord: mocks.updateRecord }))

vi.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key })
}))

vi.mock('../useMarketingHeroBindingData', () => ({
    useMarketingHeroBindingData: () => mocks.data
}))

import { useMarketingHeroBindingDialog } from '../useMarketingHeroBindingDialog'

const readyRecordData = () => ({
    bindingWidgetVersion: 4,
    currentBindingId: 'hero-record-1',
    bindingRecordId: 'hero-record-1',
    selectedRecord: { id: 'hero-record-1', version: 3, data: { Title: { en: 'Launch', ru: 'Запуск' } } },
    selectedRecordVersion: 3,
    selectedOption: { id: 'hero-record-1', label: 'Launch' },
    isSelectedRecordFetching: false,
    treeEntityId: 'tree-1',
    components: [],
    formFields: [],
    actionSectionTargets: [],
    actionSectionTargetsState: 'ready' as const,
    recordPage: 0,
    recordPageCount: 1,
    recordOptions: [],
    hasNoRecords: false,
    hasSelectedRecord: true,
    isRecordsFetching: false,
    isLoading: false,
    queryError: null,
    treeEntityMissing: false,
    heroEntityMissing: false,
    selectedRecordError: null,
    setRecordPage: vi.fn(),
    setBindingCache: vi.fn(),
    refreshBindingState: vi.fn(),
    retry: vi.fn(),
    invalidateHeroRecords: vi.fn(),
    defaultCreateData: {}
})

const options = {
    open: true,
    metahubId: 'metahub-1',
    layoutId: 'layout-1',
    widgetId: 'widget-1',
    widgetVersion: 4,
    heroObjectId: 'hero-object-1',
    locale: 'en',
    canManageLayouts: true,
    canEditContent: true,
    onClose: vi.fn(),
    onBindingSaved: vi.fn().mockResolvedValue(undefined)
}

describe('useMarketingHeroBindingDialog', () => {
    beforeEach(() => {
        mocks.updateRecord.mockReset()
        mocks.data = {
            ...readyRecordData(),
            selectedRecord: null,
            isSelectedRecordFetching: true
        }
        options.onClose.mockClear()
    })

    it('opens the currently bound Entity record directly after its details finish loading', async () => {
        const { result, rerender } = renderHook(() => useMarketingHeroBindingDialog(options))

        expect(result.current.recordFormMode).toBeNull()

        act(() => {
            mocks.data = readyRecordData()
            rerender()
        })

        await waitFor(() => expect(result.current.recordFormMode).toBe('edit'))
        expect(result.current.isDirectBoundEdit).toBe(true)
        expect(result.current.recordFormInitialData).toEqual({ Title: { en: 'Launch', ru: 'Запуск' } })
    })

    it('returns from direct edit to selection without closing the layout editor', async () => {
        mocks.data = readyRecordData()
        const { result } = renderHook(() => useMarketingHeroBindingDialog(options))
        await waitFor(() => expect(result.current.recordFormMode).toBe('edit'))

        act(() => result.current.chooseAnotherRecord())

        expect(result.current.recordFormMode).toBeNull()
        expect(result.current.isDirectBoundEdit).toBe(false)
        expect(options.onClose).not.toHaveBeenCalled()
    })

    it('does not offer record selection when content editors cannot manage layouts', async () => {
        mocks.data = readyRecordData()
        const { result } = renderHook(() => useMarketingHeroBindingDialog({ ...options, canManageLayouts: false, canEditContent: true }))
        await waitFor(() => expect(result.current.recordFormMode).toBe('edit'))

        act(() => result.current.chooseAnotherRecord())

        expect(result.current.recordFormMode).toBe('edit')
        expect(result.current.isDirectBoundEdit).toBe(true)
        expect(options.onClose).not.toHaveBeenCalled()
    })

    it('keeps the direct editor stable if record selection is requested while saving', async () => {
        mocks.data = readyRecordData()
        let resolveUpdate: ((result: { data: { id: string; version: number; data: Record<string, unknown> } }) => void) | undefined
        mocks.updateRecord.mockReturnValue(
            new Promise((resolve) => {
                resolveUpdate = resolve
            })
        )
        const { result } = renderHook(() => useMarketingHeroBindingDialog(options))
        await waitFor(() => expect(result.current.recordFormMode).toBe('edit'))

        let savePromise: Promise<void> | undefined
        act(() => {
            savePromise = result.current.handleRecordSubmit({ Title: { en: 'Updated', ru: 'Обновлено' } })
        })
        await waitFor(() => expect(result.current.isSavingRecord).toBe(true))

        act(() => result.current.chooseAnotherRecord())

        expect(result.current.recordFormMode).toBe('edit')
        expect(result.current.isDirectBoundEdit).toBe(true)
        expect(options.onClose).not.toHaveBeenCalled()

        await act(async () => {
            resolveUpdate?.({ id: 'hero-record-1', version: 4, data: { Title: { en: 'Updated', ru: 'Обновлено' } } })
            await savePromise
        })
        expect(result.current.recordFormMode).toBeNull()
        expect(options.onClose).not.toHaveBeenCalled()
    })

    it('closes the content-only direct editor after a successful save', async () => {
        mocks.data = readyRecordData()
        mocks.updateRecord.mockResolvedValue({
            data: { id: 'hero-record-1', version: 4, data: { Title: { en: 'Updated', ru: 'Обновлено' } } }
        })
        const { result } = renderHook(() => useMarketingHeroBindingDialog({ ...options, canManageLayouts: false, canEditContent: true }))
        await waitFor(() => expect(result.current.recordFormMode).toBe('edit'))

        await act(async () => {
            await result.current.handleRecordSubmit({ Title: { en: 'Updated', ru: 'Обновлено' } })
        })

        expect(options.onClose).toHaveBeenCalledTimes(1)
    })

    it('closes the layout editor when direct record editing is canceled', async () => {
        mocks.data = readyRecordData()
        const { result } = renderHook(() => useMarketingHeroBindingDialog(options))
        await waitFor(() => expect(result.current.recordFormMode).toBe('edit'))

        act(() => result.current.closeRecordForm())

        expect(result.current.recordFormMode).toBeNull()
        expect(result.current.isDirectBoundEdit).toBe(false)
        expect(options.onClose).toHaveBeenCalledTimes(1)
    })

    it('does not bypass the record selector for users without content edit permission', async () => {
        mocks.data = readyRecordData()
        const { result } = renderHook(() => useMarketingHeroBindingDialog({ ...options, canEditContent: false }))

        await waitFor(() => expect(result.current.selectedRecordId).toBe('hero-record-1'))
        expect(result.current.recordFormMode).toBeNull()
        expect(result.current.isDirectBoundEdit).toBe(false)
    })
})
