import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
    buildDynamicFields,
    getRecordLabel,
    hasUnsupportedRequiredRecordComponents,
    resolveRequiredLocaleValidationError
} from '../marketingWidgetBindingDialogModel'
import type { Component } from '../../../../types'
import type { DynamicFieldConfig } from '@universo-react/template-mui/components/dialogs'

const mocks = vi.hoisted(() => ({
    getLayoutZoneWidgetBindings: vi.fn(),
    listWidgetBindingSources: vi.fn(),
    listWidgetBindingRecords: vi.fn(),
    provisionWidgetBindingSource: vi.fn(),
    replaceLayoutZoneWidgetBindings: vi.fn(),
    listComponents: vi.fn(),
    useEntityInstancesQuery: vi.fn(),
    language: 'en',
    onClose: vi.fn(),
    onSelection: vi.fn(),
    confirm: vi.fn()
}))

vi.mock('../../api', () => ({
    getLayoutZoneWidgetBindings: mocks.getLayoutZoneWidgetBindings,
    listWidgetBindingSources: mocks.listWidgetBindingSources,
    listWidgetBindingRecords: mocks.listWidgetBindingRecords,
    provisionWidgetBindingSource: mocks.provisionWidgetBindingSource,
    replaceLayoutZoneWidgetBindings: mocks.replaceLayoutZoneWidgetBindings
}))

vi.mock('../../../entities/hooks', () => ({ useEntityInstancesQuery: mocks.useEntityInstancesQuery }))
vi.mock('../../../entities/metadata/component/api', () => ({ listComponents: mocks.listComponents }))
vi.mock('../../../entities/metadata/record/api', () => ({
    createRecord: vi.fn(),
    copyRecord: vi.fn(),
    updateRecord: vi.fn()
}))
vi.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({
        t: (key: string, options?: { defaultValue?: string }) =>
            ({
                'layouts.widgetBindings.createRecordTitle':
                    mocks.language === 'ru' ? 'Создать запись содержимого' : 'Create content record',
                'layouts.widgetBindings.editRecordTitle':
                    mocks.language === 'ru' ? 'Редактировать запись содержимого' : 'Edit content record',
                'layouts.marketing.actionAuthoring.actionKind': mocks.language === 'ru' ? 'Тип действия' : 'Action type',
                'layouts.marketing.actionAuthoring.actionKinds.anchor': mocks.language === 'ru' ? 'Раздел страницы' : 'Page section',
                'layouts.marketing.actionAuthoring.actionAnchor': mocks.language === 'ru' ? 'Раздел страницы' : 'Page section',
                'layouts.marketing.actionAuthoring.addAction': mocks.language === 'ru' ? 'Добавить действие ссылки' : 'Add link action',
                'layouts.widgetBindings.items.label': 'Content collection',
                'layouts.widgetBindings.section.label': 'Section content'
            }[key] ??
            options?.defaultValue ??
            key)
    })
}))
vi.mock('@universo-react/template-mui', () => ({
    useDebouncedSearch: ({ onSearchChange }: { onSearchChange: (value: string) => void }) => ({ setSearchValue: onSearchChange }),
    useConfirm: () => ({ confirm: mocks.confirm })
}))
vi.mock('@universo-react/template-mui/components/dialogs', () => ({
    DynamicEntityFormDialog: ({
        open,
        title,
        fields,
        initialData,
        renderField
    }: {
        open: boolean
        title: string
        fields: Array<{ id: string; label: string; type: string; validationRules?: { format?: string } }>
        initialData?: Record<string, unknown>
        renderField?: (params: {
            field: { id: string; label: string; type: string; validationRules?: { format?: string } }
            value: unknown
            onChange: (value: unknown) => void
            disabled: boolean
            error: string | null
            helperText?: string
            locale: string
        }) => ReactNode
    }) =>
        open ? (
            <div role='dialog' aria-label={title}>
                {fields.map((field) => (
                    <div key={field.id}>
                        {renderField?.({
                            field,
                            value:
                                initialData?.[field.id] ??
                                (field.id === 'PrimaryAction' ? { kind: 'anchor', href: '#pricing' } : undefined),
                            onChange: vi.fn(),
                            disabled: false,
                            error: null,
                            locale: mocks.language
                        }) ?? <textarea aria-label={field.label} />}
                    </div>
                ))}
            </div>
        ) : null,
    StandardDialog: ({ open, title, actions, children }: { open: boolean; title: string; actions: ReactNode; children: ReactNode }) =>
        open ? (
            <div role='dialog' aria-label={title}>
                {children}
                <div>{actions}</div>
            </div>
        ) : null
}))
vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

import MarketingWidgetBindingDialog from '../MarketingWidgetBindingDialog'
describe('marketing widget record fields', () => {
    it('applies required locales only to localized record components', () => {
        const components = [
            {
                id: 'title-component',
                objectCollectionId: 'hero-object',
                codename: 'Title',
                dataType: 'STRING',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Title', isActive: true } } },
                validationRules: { localized: true },
                uiConfig: {},
                isRequired: true,
                sortOrder: 0,
                createdAt: '',
                updatedAt: ''
            },
            {
                id: 'slug-component',
                objectCollectionId: 'hero-object',
                codename: 'HeroKey',
                dataType: 'STRING',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Key', isActive: true } } },
                validationRules: { unique: true },
                uiConfig: {},
                isRequired: true,
                sortOrder: 1,
                createdAt: '',
                updatedAt: ''
            }
        ] as Component[]

        const fields = buildDynamicFields(components, 'en', (key) => key, new Set(['HeroKey']), ['en', 'ru'])

        expect(fields).toHaveLength(1)
        expect(fields[0]).toMatchObject({
            id: 'Title',
            required: true,
            validationRules: { localized: true, requiredLocales: ['en', 'ru'] }
        })
    })

    it('maps conditional record policy requirements to editable field rules', () => {
        const components = [
            {
                id: 'decorative-component',
                objectCollectionId: 'image-object',
                codename: 'Decorative',
                dataType: 'BOOLEAN',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Decorative', isActive: true } } },
                validationRules: {},
                uiConfig: {},
                isRequired: true,
                sortOrder: 0,
                createdAt: '',
                updatedAt: ''
            },
            {
                id: 'alt-text-component',
                objectCollectionId: 'image-object',
                codename: 'AltText',
                dataType: 'STRING',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Alternative text', isActive: true } } },
                validationRules: { localized: true },
                uiConfig: {},
                isRequired: false,
                sortOrder: 1,
                createdAt: '',
                updatedAt: ''
            }
        ] as Component[]

        const fields = buildDynamicFields(
            components,
            'en',
            (key) => key,
            new Set(),
            ['en', 'ru'],
            [{ componentCodename: 'AltText', when: { componentCodename: 'Decorative', equals: false } }]
        )

        expect(fields.find(({ id }) => id === 'AltText')).toMatchObject({
            required: false,
            validationRules: {
                localized: true,
                requiredLocales: ['en', 'ru'],
                requiredWhen: { field: 'Decorative', equals: false }
            }
        })
    })

    it('excludes uneditable JSON and REF values and never uses them as record labels', () => {
        const makeComponent = (codename: string, dataType: string, options: Record<string, unknown> = {}): Component =>
            ({
                id: `${codename}-component`,
                objectCollectionId: 'content-object',
                codename,
                dataType,
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: codename } } },
                validationRules: {},
                uiConfig: {},
                isRequired: true,
                isActive: true,
                sortOrder: 0,
                createdAt: '',
                updatedAt: '',
                ...options
            } as Component)
        const components = [
            makeComponent('Title', 'STRING'),
            makeComponent('PrimaryAction', 'JSON', { validationRules: { format: 'marketingAction' } }),
            makeComponent('Resource', 'JSON', { validationRules: { format: 'marketingMediaReference' } }),
            makeComponent('PublishedAt', 'DATE', {
                system: { isSystem: true, systemKey: null, isManaged: true, isEnabled: true }
            }),
            makeComponent('ArchivedBy', 'STRING', {
                isDisplayComponent: true,
                system: { isSystem: true, systemKey: null, isManaged: true, isEnabled: true }
            }),
            makeComponent('DeletedBy', 'STRING', {
                system: { isSystem: true, systemKey: null, isManaged: true, isEnabled: true }
            }),
            makeComponent('OpaquePayload', 'JSON'),
            makeComponent('RelatedRecord', 'REF'),
            makeComponent('Rows', 'TABLE'),
            makeComponent('Uuid', 'STRING', { isDisplayComponent: true })
        ]

        const fields = buildDynamicFields(components, 'en', (key) => key, new Set())

        expect(fields.map(({ id }) => id)).toEqual(['Title', 'PrimaryAction', 'Resource'])
        expect(hasUnsupportedRequiredRecordComponents(components, new Set())).toBe(true)
        expect(
            getRecordLabel(
                {
                    Title: 'Product tour',
                    OpaquePayload: { secret: true },
                    RelatedRecord: '0f8fad5b-d9cb-469f-a165-70867728950e',
                    Uuid: '0f8fad5b-d9cb-469f-a165-70867728950e'
                },
                components,
                'en',
                'Untitled'
            )
        ).toBe('Product tour')
    })

    it('maps only known required-locale record errors to localized field validation', () => {
        const fields: DynamicFieldConfig[] = [
            {
                id: 'Title',
                label: 'Title',
                type: 'STRING',
                required: true,
                validationRules: { localized: true, requiredLocales: ['en', 'ru'] }
            }
        ]
        const translate = (key: string, options?: { defaultValue?: string; field?: string; locale?: string }) => {
            if (key === 'layouts.widgetBindings.locales.en') return 'English'
            if (key === 'layouts.widgetBindings.locales.ru') return 'Russian'
            return (options?.defaultValue ?? key).replace('{{field}}', options?.field ?? '').replace('{{locale}}', options?.locale ?? '')
        }

        expect(resolveRequiredLocaleValidationError(['Title.en.required'], fields, translate)).toEqual({
            fieldId: 'Title',
            locale: 'en',
            message: 'Add Title in English before saving.'
        })
        expect(resolveRequiredLocaleValidationError(['Title.required'], fields, translate)).toEqual({
            fieldId: 'Title',
            locale: 'en',
            message: 'Add Title in English before saving.'
        })
        expect(resolveRequiredLocaleValidationError(['Other.en.required'], fields, translate)).toBeNull()
        expect(resolveRequiredLocaleValidationError(['Title.en.invalid'], fields, translate)).toBeNull()
    })

    it('maps conditional localized errors only when the submitted condition requires the field', () => {
        const translate = (key: string, options?: { defaultValue?: string; field?: string; locale?: string }) => {
            if (key === 'layouts.widgetBindings.locales.en') return 'English'
            if (key === 'layouts.widgetBindings.locales.ru') return 'Russian'
            return (options?.defaultValue ?? key).replace('{{field}}', options?.field ?? '').replace('{{locale}}', options?.locale ?? '')
        }
        const fields: DynamicFieldConfig[] = [
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
        ]

        expect(resolveRequiredLocaleValidationError(['AltText.required'], fields, translate, { Decorative: false })).toEqual({
            fieldId: 'AltText',
            locale: 'en',
            message: 'Add Alternative text in English before saving.'
        })
        expect(resolveRequiredLocaleValidationError(['AltText.required'], fields, translate, { Decorative: true })).toBeNull()
        expect(resolveRequiredLocaleValidationError(['AltText.ru.required'], fields, translate, { Decorative: true })).toEqual({
            fieldId: 'AltText',
            locale: 'ru',
            message: 'Add Alternative text in Russian before saving.'
        })
    })
})

const renderDialog = (options?: {
    canManageLayouts?: boolean
    canEditContent?: boolean
    widgetKey?: 'marketing.image' | 'marketing.hero' | 'marketing.collection'
    widgetId?: string | null
    widgetVersion?: number | null
    rendererConfigPending?: boolean
    variant?: string
    locale?: 'en' | 'ru'
    sectionTargets?: Array<{ href: string; labelKey: string; defaultLabel: string; instanceNumber: number; sectionId: string }>
}) => {
    const widgetKey = options?.widgetKey ?? 'marketing.image'
    const locale = options?.locale ?? 'en'
    mocks.language = locale
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MarketingWidgetBindingDialog
                open
                metahubId='metahub-1'
                layoutId='layout-1'
                widgetKey={widgetKey}
                zone='marketing-main'
                widgetId={options?.widgetId ?? null}
                widgetVersion={options?.widgetVersion}
                rendererConfig={{
                    instanceKey: widgetKey === 'marketing.hero' ? 'test-hero' : 'test-image',
                    ...(widgetKey === 'marketing.collection' ? { variant: options?.variant ?? 'logos' } : {})
                }}
                rendererConfigPending={options?.rendererConfigPending}
                sectionTargets={options?.sectionTargets}
                locale={locale}
                canManageLayouts={options?.canManageLayouts ?? true}
                canEditContent={options?.canEditContent ?? true}
                onClose={mocks.onClose}
                onSelection={mocks.onSelection}
            />
        </QueryClientProvider>
    )
}

describe('MarketingWidgetBindingDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.confirm.mockReset().mockResolvedValue(false)
        mocks.language = 'en'
        mocks.getLayoutZoneWidgetBindings.mockResolvedValue({ data: { widgetKey: 'marketing.image', version: 1, bindings: [] } })
        mocks.listWidgetBindingSources.mockResolvedValue({
            data: {
                widgetKey: 'marketing.image',
                slot: 'content',
                selectorKinds: ['semantic-key'],
                sources: [{ sourceKey: 'MarketingPageImage', label: 'Image content', recordsCount: 1, selectorKinds: ['semantic-key'] }],
                nextOffset: null,
                truncated: false
            }
        })
        mocks.listWidgetBindingRecords.mockResolvedValue({
            data: {
                widgetKey: 'marketing.image',
                slot: 'content',
                sourceKey: 'MarketingPageImage',
                records: [],
                nextOffset: null,
                truncated: false
            }
        })
        mocks.provisionWidgetBindingSource.mockResolvedValue({
            data: {
                widgetKey: 'marketing.image',
                slot: 'content',
                source: {
                    sourceKey: 'MarketingWidgetSourceNew',
                    label: 'Alternative image source',
                    recordsCount: 0,
                    selectorKinds: ['semantic-key']
                }
            }
        })
        mocks.listComponents.mockResolvedValue({ items: [] })
        mocks.useEntityInstancesQuery.mockImplementation((_metahubId: string, params?: { kind?: string }) => {
            if (params?.kind === 'hub') {
                return { data: { items: [{ id: 'hub-1', codename: 'MarketingPage' }] }, isLoading: false, isError: false }
            }
            if (params?.kind === 'object') {
                return {
                    data: {
                        items: [
                            { id: 'image-object', codename: 'MarketingPageImage' },
                            { id: 'hero-object', codename: 'MarketingPageHero' }
                        ]
                    },
                    isLoading: false,
                    isError: false
                }
            }
            return { data: { items: [] }, isLoading: false, isError: false }
        })
    })

    it('opens the registry-declared initial source slot when adding a collection widget', async () => {
        renderDialog({ widgetKey: 'marketing.collection', rendererConfigPending: true, variant: 'logos' })

        const collectionSlot = await screen.findByRole('button', { name: /Content collection/u })
        const sectionSlot = screen.getByRole('button', { name: /Section content/u })
        await waitFor(() => expect(collectionSlot).toHaveAttribute('aria-expanded', 'true'))
        expect(sectionSlot).toHaveAttribute('aria-expanded', 'false')
    })

    it('focuses the first missing required source and exposes a localized inline error on Add', async () => {
        const user = userEvent.setup()
        renderDialog()

        const addButton = await screen.findByRole('button', { name: 'Add' })
        await waitFor(() => expect(addButton).toBeEnabled())
        await user.click(addButton)

        const sourceInput = screen.getByRole('combobox', { name: 'Content source' })
        expect(await screen.findByText('Choose a content source to continue.')).toBeVisible()
        await waitFor(() => expect(document.activeElement).toBe(sourceInput))
        expect(mocks.onSelection).not.toHaveBeenCalled()
    })

    it('focuses the required semantic record after a compatible source is selected', async () => {
        const user = userEvent.setup()
        renderDialog()

        const sourceInput = await screen.findByRole('combobox', { name: 'Content source' })
        await user.click(sourceInput)
        await user.click(await screen.findByRole('option', { name: 'Image content' }))

        const addButton = screen.getByRole('button', { name: 'Add' })
        await waitFor(() => expect(addButton).toBeEnabled())
        await user.click(addButton)

        const recordInput = screen.getByRole('combobox', { name: 'Content record' })
        expect(await screen.findByText('Choose a content record to continue.')).toBeVisible()
        await waitFor(() => expect(document.activeElement).toBe(recordInput))
        expect(mocks.onSelection).not.toHaveBeenCalled()
    })

    it('does not expose source selection or Add without layout and content permission', async () => {
        renderDialog({ canManageLayouts: false })

        const sourceInput = await screen.findByRole('combobox', { name: 'Content source' })
        expect(sourceInput).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
        expect(mocks.listWidgetBindingSources).not.toHaveBeenCalled()
        expect(mocks.onSelection).not.toHaveBeenCalled()
    })

    it('creates a separate empty Entity source from the selected compatible source', async () => {
        const user = userEvent.setup()
        renderDialog()

        const sourceInput = await screen.findByRole('combobox', { name: 'Content source' })
        await user.click(sourceInput)
        await user.click(await screen.findByRole('option', { name: 'Image content' }))
        await user.click(screen.getByRole('button', { name: 'Create a separate content source' }))

        const nameInput = await screen.findByRole('textbox', { name: 'Content source name' })
        await user.type(nameInput, 'Campaign image')
        expect(screen.getByText(/Existing records will not be copied/u)).toBeVisible()
        await user.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() =>
            expect(mocks.provisionWidgetBindingSource).toHaveBeenCalledWith('metahub-1', 'layout-1', 'marketing.image', 'content', {
                locale: 'en',
                templateSourceKey: 'MarketingPageImage',
                name: 'Campaign image'
            })
        )
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create a separate content source' })).not.toBeInTheDocument())
    })

    it('saves an edited binding with the server binding version and canonical selector payload', async () => {
        const user = userEvent.setup()
        mocks.getLayoutZoneWidgetBindings.mockResolvedValue({ data: { widgetKey: 'marketing.image', version: 7, bindings: [] } })
        mocks.listWidgetBindingRecords.mockResolvedValue({
            data: {
                widgetKey: 'marketing.image',
                slot: 'content',
                sourceKey: 'MarketingPageImage',
                records: [{ semanticKey: 'main-image', label: 'Main campaign image' }],
                nextOffset: null,
                truncated: false
            }
        })
        mocks.replaceLayoutZoneWidgetBindings.mockResolvedValue({ data: { widgetKey: 'marketing.image', version: 8, bindings: [] } })
        renderDialog({ widgetId: 'image-placement-1', widgetVersion: 6 })

        const sourceInput = await screen.findByRole('combobox', { name: 'Content source' })
        await user.click(sourceInput)
        await user.click(await screen.findByRole('option', { name: 'Image content' }))
        const recordInput = await screen.findByRole('combobox', { name: 'Content record' })
        await user.click(recordInput)
        await user.click(await screen.findByRole('option', { name: 'Main campaign image' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() =>
            expect(mocks.replaceLayoutZoneWidgetBindings).toHaveBeenCalledWith('metahub-1', 'layout-1', 'image-placement-1', {
                expectedVersion: 7,
                bindings: [
                    {
                        slot: 'content',
                        sourceKey: 'MarketingPageImage',
                        selector: { kind: 'semantic-key', value: 'main-image' }
                    }
                ],
                locale: 'en'
            })
        )
    })

    it('keeps the binding editor open and shows a localized error when an edit conflicts', async () => {
        const user = userEvent.setup()
        mocks.getLayoutZoneWidgetBindings.mockResolvedValue({ data: { widgetKey: 'marketing.image', version: 7, bindings: [] } })
        mocks.listWidgetBindingRecords.mockResolvedValue({
            data: {
                widgetKey: 'marketing.image',
                slot: 'content',
                sourceKey: 'MarketingPageImage',
                records: [{ semanticKey: 'main-image', label: 'Main campaign image' }],
                nextOffset: null,
                truncated: false
            }
        })
        mocks.replaceLayoutZoneWidgetBindings.mockRejectedValue(new Error('STALE_VERSION'))
        renderDialog({ widgetId: 'image-placement-1' })

        const sourceInput = await screen.findByRole('combobox', { name: 'Content source' })
        await user.click(sourceInput)
        await user.click(await screen.findByRole('option', { name: 'Image content' }))
        const recordInput = await screen.findByRole('combobox', { name: 'Content record' })
        await user.click(recordInput)
        await user.click(await screen.findByRole('option', { name: 'Main campaign image' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(await screen.findByText('Content bindings could not be saved. Try again.')).toBeVisible()
        expect(screen.getByRole('dialog')).toBeVisible()
    })

    it('renders Hero actions as localized typed controls and offers active section targets', async () => {
        const user = userEvent.setup()
        mocks.getLayoutZoneWidgetBindings.mockResolvedValue({ data: { widgetKey: 'marketing.hero', version: 1, bindings: [] } })
        mocks.listWidgetBindingSources.mockResolvedValue({
            data: {
                widgetKey: 'marketing.hero',
                slot: 'content',
                selectorKinds: ['semantic-key'],
                sources: [{ sourceKey: 'MarketingPageHero', label: 'Hero content', recordsCount: 1, selectorKinds: ['semantic-key'] }],
                nextOffset: null,
                truncated: false
            }
        })
        mocks.listWidgetBindingRecords.mockResolvedValue({
            data: {
                widgetKey: 'marketing.hero',
                slot: 'content',
                sourceKey: 'MarketingPageHero',
                records: [],
                nextOffset: null,
                truncated: false
            }
        })
        mocks.listComponents.mockResolvedValue({
            items: [
                {
                    codename: 'HeroKey',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Hero key' }, ru: { content: 'Ключ' } } },
                    dataType: 'STRING',
                    isRequired: true,
                    isActive: true,
                    uiConfig: { hidden: true }
                },
                {
                    codename: 'PrimaryAction',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Primary action' }, ru: { content: 'Основное действие' } }
                    },
                    dataType: 'JSON',
                    isRequired: true,
                    isActive: true,
                    validationRules: { format: 'marketingAction' },
                    uiConfig: { gridHidden: true }
                },
                {
                    codename: 'TermsAction',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Terms action' }, ru: { content: 'Действие условий' } }
                    },
                    dataType: 'JSON',
                    isRequired: false,
                    isActive: true,
                    validationRules: { format: 'marketingAction' },
                    uiConfig: { gridHidden: true }
                }
            ]
        })

        renderDialog({
            widgetKey: 'marketing.hero',
            locale: 'ru',
            sectionTargets: [{ href: '#pricing', sectionId: 'pricing', labelKey: 'pricing', defaultLabel: 'Стоимость', instanceNumber: 1 }]
        })

        const sourceInput = await screen.findByRole('combobox', { name: 'Content source' })
        await user.click(sourceInput)
        await user.click(await screen.findByRole('option', { name: 'Hero content' }))
        const createRecordButton = await screen.findByRole('button', { name: 'Create content record' })
        await waitFor(() => expect(createRecordButton).toBeEnabled())
        await user.click(createRecordButton)

        const recordDialog = await screen.findByRole('dialog', { name: 'Создать запись содержимого' })
        expect(recordDialog).toBeVisible()
        const primaryAction = within(recordDialog).getByRole('group', { name: 'Основное действие' })
        const termsAction = within(recordDialog).getByRole('group', { name: 'Действие условий' })
        expect(primaryAction).toBeVisible()
        expect(termsAction).toBeVisible()
        expect(within(primaryAction).getByRole('combobox', { name: 'Тип действия' })).toBeVisible()
        const addTermsAction = within(termsAction).getByRole('button', { name: 'Добавить действие ссылки' })
        expect(addTermsAction).toBeVisible()
        const sectionTarget = within(primaryAction).getByRole('combobox', { name: 'Раздел страницы' })
        await user.click(sectionTarget)
        await expect(screen.findByRole('option', { name: 'Стоимость', exact: true })).resolves.toBeVisible()
        expect(screen.queryByRole('textbox', { name: 'Основное действие' })).not.toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: 'Действие условий' })).not.toBeInTheDocument()
    })
})
