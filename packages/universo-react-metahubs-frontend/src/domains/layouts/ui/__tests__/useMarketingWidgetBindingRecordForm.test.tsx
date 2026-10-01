import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DynamicFieldConfig } from '@universo-react/template-mui/components/dialogs'
import type { WidgetBindingSlotDefinition } from '@universo-react/types'
import * as recordsApi from '../../../entities/metadata/record/api'
import { metahubsQueryKeys } from '../../../shared'
import type { Component, RecordItem } from '../../../../types'
import type { DraftBinding } from '../marketingWidgetBindingDialogModel'
import { findRecordBySemanticKey } from '../marketingWidgetBindingRecordLookup'
import { useMarketingWidgetBindingRecordForm } from '../useMarketingWidgetBindingRecordForm'

vi.mock('../../../entities/metadata/record/api', () => ({
    listRecords: vi.fn(),
    createRecord: vi.fn(),
    updateRecord: vi.fn()
}))

type HookParams = Parameters<typeof useMarketingWidgetBindingRecordForm>[0]

const activeDraft: DraftBinding = {
    sourceKey: 'HeroSource',
    sourceName: 'Hero content',
    selectorKind: 'semantic-key',
    semanticKey: 'hero-home'
}

const activeSlot = {
    key: 'content',
    requirements: {
        components: [{ componentCodename: 'HeroKey', field: 'HeroKey', semanticKey: true }]
    }
} as WidgetBindingSlotDefinition

const recordFields = [
    {
        id: 'Title',
        label: 'Title',
        type: 'STRING',
        required: true,
        validationRules: { localized: true, requiredLocales: ['en'] }
    }
] as DynamicFieldConfig[]

const translate: HookParams['t'] = (key, options) => {
    if (key === 'layouts.widgetBindings.locales.en') return 'English'
    if (key === 'layouts.widgetBindings.missingLocale') {
        return `Add ${options?.field} in ${options?.locale} before saving.`
    }
    if (key === 'layouts.widgetBindings.recordSaveError') return 'The content record could not be saved.'
    if (key === 'layouts.widgetBindings.recordLoadError') return 'The selected content record could not be loaded.'
    return options?.defaultValue ?? key
}

const createParams = (overrides: Partial<HookParams> = {}): HookParams => ({
    metahubId: 'metahub-1',
    layoutId: 'layout-1',
    widgetKey: 'marketing.hero',
    locale: 'en',
    variant: 'variant-a',
    canManageLayouts: true,
    canEditContent: true,
    canCreateRecord: true,
    activeSlot,
    activeDraft,
    sourceEntity: { id: 'object-1' },
    treeEntityId: 'tree-1',
    semanticKeyRequirement: { componentCodename: 'HeroKey' },
    recordComponents: [] as Component[],
    recordFields,
    updateDraft: vi.fn(),
    t: translate,
    ...overrides
})

const renderRecordForm = (params: HookParams = createParams()) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    const hook = renderHook(() => useMarketingWidgetBindingRecordForm(params), { wrapper })
    return { ...hook, invalidateQueries, params }
}

const apiResponse = (record: RecordItem) => ({ data: record } as Awaited<ReturnType<typeof recordsApi.createRecord>>)

describe('useMarketingWidgetBindingRecordForm', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('resolves the exact semantic record with one bounded component-value query', async () => {
        vi.mocked(recordsApi.listRecords).mockResolvedValueOnce({
            items: [{ id: 'record-target', data: { HeroKey: 'hero-home' } } as RecordItem],
            pagination: { total: 1, hasMore: false }
        } as Awaited<ReturnType<typeof recordsApi.listRecords>>)

        await expect(findRecordBySemanticKey('metahub-1', 'tree-1', 'object-1', 'HeroKey', 'hero-home')).resolves.toMatchObject({
            id: 'record-target'
        })
        expect(recordsApi.listRecords).toHaveBeenCalledTimes(1)
        expect(recordsApi.listRecords).toHaveBeenCalledWith('metahub-1', 'tree-1', 'object-1', {
            limit: 2,
            offset: 0,
            exactComponentCodename: 'HeroKey',
            exactValue: 'hero-home',
            sortBy: 'updated',
            sortOrder: 'desc'
        })
    })

    it('fails when an exact semantic record is missing or duplicated', async () => {
        vi.mocked(recordsApi.listRecords).mockResolvedValueOnce({
            items: [],
            pagination: { total: 0, hasMore: false }
        } as Awaited<ReturnType<typeof recordsApi.listRecords>>)

        await expect(findRecordBySemanticKey('metahub-1', 'tree-1', 'object-1', 'HeroKey', 'hero-home')).rejects.toThrow(
            'MARKETING_WIDGET_SEMANTIC_RECORD_NOT_FOUND'
        )
        expect(recordsApi.listRecords).toHaveBeenCalledTimes(1)

        vi.mocked(recordsApi.listRecords).mockResolvedValueOnce({
            items: [
                { id: 'record-one', data: { HeroKey: 'hero-home' } } as RecordItem,
                { id: 'record-two', data: { HeroKey: 'hero-home' } } as RecordItem
            ],
            pagination: { total: 2, hasMore: false }
        } as Awaited<ReturnType<typeof recordsApi.listRecords>>)
        await expect(findRecordBySemanticKey('metahub-1', 'tree-1', 'object-1', 'HeroKey', 'hero-home')).rejects.toThrow(
            'MARKETING_WIDGET_SEMANTIC_RECORD_NOT_UNIQUE'
        )
    })

    it('creates the selected record and invalidates record, binding-record, and source queries', async () => {
        const recordData = { HeroKey: 'hero-home', Title: 'Home headline' }
        const params = createParams()
        const { result, invalidateQueries } = renderRecordForm(params)
        vi.mocked(recordsApi.createRecord).mockResolvedValue(apiResponse({ id: 'record-1', data: recordData } as unknown as RecordItem))

        act(() => result.current.actions.openCreateRecord())
        await act(async () => result.current.actions.saveRecordForm(recordData))

        expect(recordsApi.createRecord).toHaveBeenCalledWith('metahub-1', 'tree-1', 'object-1', { data: recordData })
        expect(params.updateDraft).toHaveBeenCalledWith('content', {
            ...activeDraft,
            semanticKey: 'hero-home',
            selectionLabel: 'Untitled content record'
        })
        expect(result.current.state.recordFormMode).toBeNull()

        const invalidatedKeys = invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey)
        expect(invalidatedKeys).toContainEqual(metahubsQueryKeys.records('metahub-1', 'tree-1', 'object-1'))
        expect(invalidatedKeys).toContainEqual([
            ...metahubsQueryKeys.layoutZoneWidgets('metahub-1', 'layout-1'),
            'widgetBindingRecords',
            'marketing.hero',
            'content',
            'HeroSource',
            'variant-a'
        ])
        expect(invalidatedKeys).toContainEqual([
            ...metahubsQueryKeys.layoutZoneWidgets('metahub-1', 'layout-1'),
            'widgetBindingSources',
            'marketing.hero',
            'content'
        ])
    })

    it('initializes required boolean fields as explicit false when creating a content record', () => {
        const params = createParams({
            recordFields: [
                ...recordFields,
                { id: 'Decorative', label: 'Decorative image', type: 'BOOLEAN', required: true } as DynamicFieldConfig
            ]
        })
        const { result } = renderRecordForm(params)

        act(() => result.current.actions.openCreateRecord())

        expect(result.current.state.recordFormInitialData).toEqual({ Decorative: false })
    })

    it('does not open or submit inline creation when required fields have no safe editor', async () => {
        const { result } = renderRecordForm(createParams({ canCreateRecord: false }))

        act(() => result.current.actions.openCreateRecord())
        await act(async () => result.current.actions.saveRecordForm({ HeroKey: 'hero-home' }))

        expect(result.current.state.recordFormMode).toBeNull()
        expect(recordsApi.createRecord).not.toHaveBeenCalled()
    })

    it('keeps required-locale validation localized and attached to its field', async () => {
        const { result } = renderRecordForm()
        vi.mocked(recordsApi.createRecord).mockRejectedValue({
            response: { data: { code: 'VALIDATION_ERROR', fields: ['Title.en.required'] } }
        })

        act(() => result.current.actions.openCreateRecord())
        await act(async () => result.current.actions.saveRecordForm({ HeroKey: 'hero-home' }))

        expect(result.current.state.recordFieldError).toEqual({
            fieldId: 'Title',
            locale: 'en',
            message: 'Add Title in English before saving.'
        })
        expect(result.current.state.recordFormError).toBeNull()
        expect(result.current.state.recordFormMode).toBe('create')
    })

    it('maps conditional localized validation errors using the submitted controlling value', async () => {
        const conditionalFields = [
            ...recordFields,
            {
                id: 'AltText',
                label: 'Alternative text',
                type: 'STRING',
                required: false,
                validationRules: {
                    localized: true,
                    requiredLocales: ['en', 'ru'],
                    requiredWhen: { field: 'Decorative', equals: false }
                }
            }
        ] as DynamicFieldConfig[]
        const { result } = renderRecordForm(createParams({ recordFields: conditionalFields }))
        vi.mocked(recordsApi.createRecord).mockRejectedValue({
            response: { data: { code: 'VALIDATION_ERROR', fields: ['AltText.required'] } }
        })

        act(() => result.current.actions.openCreateRecord())
        await act(async () => result.current.actions.saveRecordForm({ HeroKey: 'hero-home', Decorative: false, AltText: null }))

        expect(result.current.state.recordFieldError).toEqual({
            fieldId: 'AltText',
            locale: 'en',
            message: 'Add Alternative text in English before saving.'
        })
        expect(result.current.state.recordFormError).toBeNull()
    })

    it('loads the edit target and maps a version conflict to the localized save error', async () => {
        const editedRecord = { id: 'record-7', version: 8, data: { HeroKey: 'hero-home', Title: 'Existing' } } as unknown as RecordItem
        const params = createParams({ locale: 'ru' })
        const { result } = renderRecordForm(params)
        vi.mocked(recordsApi.listRecords).mockResolvedValue({
            items: [editedRecord],
            pagination: { hasMore: false }
        } as Awaited<ReturnType<typeof recordsApi.listRecords>>)
        vi.mocked(recordsApi.updateRecord).mockRejectedValue({
            response: { status: 409, data: { code: 'RECORD_VERSION_CONFLICT' } }
        })

        await act(async () => result.current.actions.openEditRecord())
        expect(result.current.state.recordFormMode).toBe('edit')
        expect(result.current.state.recordFormInitialData).toEqual(editedRecord.data)

        await act(async () => result.current.actions.saveRecordForm({ HeroKey: 'hero-home', Title: 'Changed' }))

        expect(recordsApi.updateRecord).toHaveBeenCalledWith('metahub-1', 'tree-1', 'object-1', 'record-7', {
            data: { HeroKey: 'hero-home', Title: 'Changed' },
            expectedVersion: 8
        })
        expect(result.current.state.recordFormError).toBe('The content record could not be saved.')
        expect(result.current.state.recordFieldError).toBeNull()
        expect(result.current.state.recordFormMode).toBe('edit')
    })

    it('keeps a failed edit-record lookup recoverable through a retry', async () => {
        const editedRecord = { id: 'record-10', data: { HeroKey: 'hero-home', Title: 'Existing' } } as unknown as RecordItem
        const { result } = renderRecordForm()
        vi.mocked(recordsApi.listRecords)
            .mockRejectedValueOnce(new Error('temporary lookup failure'))
            .mockResolvedValueOnce({
                items: [editedRecord],
                pagination: { hasMore: false }
            } as Awaited<ReturnType<typeof recordsApi.listRecords>>)

        await act(async () => result.current.actions.openEditRecord())
        expect(result.current.state.recordFormMode).toBeNull()
        expect(result.current.state.recordFormError).toBe('The selected content record could not be loaded.')

        await act(async () => result.current.actions.openEditRecord())

        expect(recordsApi.listRecords).toHaveBeenCalledTimes(2)
        expect(result.current.state.recordFormMode).toBe('edit')
        expect(result.current.state.recordFormInitialData).toEqual(editedRecord.data)
        expect(result.current.state.recordFormError).toBeNull()
    })

    it('allows content record updates to editContent users without layout-management permission', async () => {
        const editedRecord = { id: 'record-9', version: 3, data: { HeroKey: 'hero-home', Title: 'Existing' } } as unknown as RecordItem
        const params = createParams({ canManageLayouts: false, canEditContent: true })
        const { result } = renderRecordForm(params)
        vi.mocked(recordsApi.listRecords).mockResolvedValue({
            items: [editedRecord],
            pagination: { hasMore: false }
        } as Awaited<ReturnType<typeof recordsApi.listRecords>>)
        vi.mocked(recordsApi.updateRecord).mockResolvedValue(
            apiResponse({ id: 'record-9', version: 4, data: { HeroKey: 'hero-home', Title: 'Updated' } } as unknown as RecordItem)
        )

        await act(async () => result.current.actions.openEditRecord())
        expect(result.current.state.recordFormMode).toBe('edit')
        await act(async () => result.current.actions.saveRecordForm({ HeroKey: 'hero-home', Title: 'Updated' }))

        expect(recordsApi.updateRecord).toHaveBeenCalledWith('metahub-1', 'tree-1', 'object-1', 'record-9', {
            data: { HeroKey: 'hero-home', Title: 'Updated' },
            expectedVersion: 3
        })
        expect(result.current.state.recordFormMode).toBeNull()
    })

    it('blocks record creation and updates when editContent permission is absent', async () => {
        const params = createParams({ canManageLayouts: true, canEditContent: false })
        const { result } = renderRecordForm(params)

        act(() => result.current.actions.openCreateRecord())
        await act(async () => result.current.actions.openEditRecord())
        await act(async () => result.current.actions.saveRecordForm({ HeroKey: 'hero-home', Title: 'Changed' }))

        expect(result.current.state.recordFormMode).toBeNull()
        expect(recordsApi.listRecords).not.toHaveBeenCalled()
        expect(recordsApi.createRecord).not.toHaveBeenCalled()
        expect(recordsApi.updateRecord).not.toHaveBeenCalled()
    })

    it('prevents closing while a save is pending and closes after the save completes', async () => {
        const { result } = renderRecordForm()
        let resolveCreate!: (value: Awaited<ReturnType<typeof recordsApi.createRecord>>) => void
        vi.mocked(recordsApi.createRecord).mockReturnValue(
            new Promise((resolve) => {
                resolveCreate = resolve
            })
        )

        act(() => result.current.actions.openCreateRecord())
        let savePromise!: Promise<void>
        act(() => {
            savePromise = result.current.actions.saveRecordForm({ HeroKey: 'hero-home' })
        })
        expect(result.current.state.isRecordSaving).toBe(true)

        act(() => result.current.actions.closeRecordForm())
        expect(result.current.state.recordFormMode).toBe('create')

        resolveCreate(apiResponse({ id: 'record-1', data: { HeroKey: 'hero-home' } } as unknown as RecordItem))
        await act(async () => savePromise)
        expect(result.current.state.recordFormMode).toBeNull()
        expect(result.current.state.isRecordSaving).toBe(false)
    })
})
