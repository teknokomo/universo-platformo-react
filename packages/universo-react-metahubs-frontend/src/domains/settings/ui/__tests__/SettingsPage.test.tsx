import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import SettingsPage from '../SettingsPage'

const updateMutateAsync = vi.fn()
const resetMutateAsync = vi.fn()
const layoutsApiMocks = vi.hoisted(() => ({
    listLayouts: vi.fn(),
    listLayoutZoneWidgets: vi.fn(),
    updateLayoutZoneWidgetConfig: vi.fn()
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: { language: 'en' },
        t: (key: string, options?: string | { defaultValue?: string }, params?: Record<string, unknown>) => {
            const mapped: Record<string, string> = {
                'settings.title': 'Settings',
                'settings.search': 'Search settings...',
                'settings.tabs.general': 'General',
                'settings.tabs.common': 'Common',
                'settings.tabs.page': 'Pages',
                'settings.tabs.catalog': 'Catalogs',
                'settings.tabs.document': 'Documents',
                'settings.tabs.information-register': 'Information Registers',
                'settings.tabs.layouts': 'Layouts and widgets',
                'settings.matrix.modes.hierarchicalCells': 'Hierarchical cells',
                'settings.matrix.views.horizontalRows': 'Horizontal rows',
                'settings.layoutWidgets.interpretationNetworkSummary': 'Matrix mode: {{matrixMode}}. Default view: {{defaultView}}.',
                'settings.layoutWidgets.layoutLabel': 'Layout: {{layout}}',
                'settings.layoutWidgets.editSettings': 'Edit settings',
                'settings.layoutWidgets.openEditor': 'Open in layout',
                'layouts.widgets.interpretationNetworkWorkspace': 'Interpretation network workspace',
                'layouts.interpretationNetworkEditor.title': 'Interpretation network workspace',
                'layouts.interpretationNetworkEditor.displayTitle': 'Matrix views',
                'layouts.interpretationNetworkEditor.resizablePanes': 'Allow users to resize workspace panes',
                'common:save': 'Save',
                'common:cancel': 'Cancel',
                'settings.keys.general.language': 'Language',
                'settings.keys.general.language.description': 'Default language',
                'settings.keys.entity.page.allowCopy': 'Allow Copy',
                'settings.keys.entity.page.allowCopy.description': 'Allow copying pages within this metahub',
                'settings.keys.entity.page.allowDelete': 'Allow Delete',
                'settings.keys.entity.page.allowDelete.description': 'Allow deleting pages from this metahub',
                'settings.keys.entity.catalog.allowedComponentTypes': 'Allowed Requisite Types',
                'settings.keys.entity.catalog.allowedComponentTypes.description':
                    'Which data types can be used when creating requisites in catalogs',
                'settings.keys.entity.document.allowedComponentTypes': 'Allowed Requisite Types',
                'settings.keys.entity.document.allowedComponentTypes.description':
                    'Which data types can be used when creating requisites in documents',
                'settings.keys.entity.information-register.allowedComponentTypes': 'Allowed Register Field Types',
                'settings.keys.entity.information-register.allowedComponentTypes.description':
                    'Which data types can be used when creating information register fields',
                'settings.languages.system': 'System'
            }

            const template = mapped[key] ?? (typeof options === 'string' ? options : options?.defaultValue) ?? key
            const interpolationParams = {
                ...(typeof options === 'object' ? options : {}),
                ...(params ?? {})
            }
            return Object.entries(interpolationParams).reduce((message, [paramKey, value]) => {
                if (paramKey === 'defaultValue') return message
                return message.replace(`{{${paramKey}}}`, String(value))
            }, template)
        }
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}))

vi.mock('@universo-react/template-mui', () => ({
    APIEmptySVG: 'empty',
    EmptyListState: ({ title }: { title?: string }) => <div>{title}</div>,
    EntityFormDialog: ({
        open,
        title,
        extraFields,
        onSave,
        onClose,
        saveButtonText,
        cancelButtonText
    }: {
        open: boolean
        title: string
        extraFields: () => ReactNode
        onSave: () => void
        onClose: () => void
        saveButtonText: string
        cancelButtonText: string
    }) =>
        open ? (
            <div role='dialog' aria-label={title}>
                {extraFields()}
                <button type='button' onClick={onClose}>
                    {cancelButtonText}
                </button>
                <button type='button' onClick={onSave}>
                    {saveButtonText}
                </button>
            </div>
        ) : null,
    TemplateMainCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    ViewHeaderMUI: ({ title }: { title: string }) => <h1>{title}</h1>,
    useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
    useDebouncedSearch: ({ onSearchChange }: { onSearchChange: (value: string) => void }) => ({
        handleSearchChange: (value: string) => onSearchChange(value)
    })
}))

vi.mock('../SettingControl', () => ({
    default: ({ value }: { value: unknown }) => <span>{String(value)}</span>
}))

vi.mock('../CodenameStylePreview', () => ({
    default: () => null
}))

vi.mock('../../../layouts/ui/WidgetScopeVisibilityPanel', () => ({
    default: ({ widgetId }: { widgetId: string }) => <div data-testid='scope-visibility-panel'>{widgetId}</div>
}))

vi.mock('../../../layouts/api', () => ({
    listLayouts: layoutsApiMocks.listLayouts,
    listLayoutZoneWidgets: layoutsApiMocks.listLayoutZoneWidgets,
    updateLayoutZoneWidgetConfig: layoutsApiMocks.updateLayoutZoneWidgetConfig
}))

vi.mock('../../hooks/useSettings', () => ({
    useSettings: () => ({
        data: {
            registry: [
                {
                    key: 'general.language',
                    tab: 'general',
                    valueType: 'select',
                    defaultValue: 'system',
                    options: ['system', 'en', 'ru'],
                    sortOrder: 1
                },
                {
                    key: 'entity.page.allowCopy',
                    tab: 'page',
                    valueType: 'boolean',
                    defaultValue: true,
                    sortOrder: 1
                },
                {
                    key: 'entity.page.allowDelete',
                    tab: 'page',
                    valueType: 'boolean',
                    defaultValue: true,
                    sortOrder: 2
                },
                {
                    key: 'entity.catalog.allowedComponentTypes',
                    tab: 'catalog',
                    valueType: 'multi-select',
                    defaultValue: ['STRING', 'REF'],
                    sortOrder: 1
                },
                {
                    key: 'entity.document.allowedComponentTypes',
                    tab: 'document',
                    valueType: 'multi-select',
                    defaultValue: ['STRING', 'REF'],
                    sortOrder: 1
                },
                {
                    key: 'entity.information-register.allowedComponentTypes',
                    tab: 'information-register',
                    valueType: 'multi-select',
                    defaultValue: ['STRING', 'NUMBER'],
                    sortOrder: 1
                }
            ],
            settings: [
                { key: 'general.language', value: { _value: 'system' }, id: null, version: 0, updatedAt: null, isDefault: true },
                { key: 'entity.page.allowCopy', value: { _value: true }, id: null, version: 0, updatedAt: null, isDefault: true },
                { key: 'entity.page.allowDelete', value: { _value: true }, id: null, version: 0, updatedAt: null, isDefault: true },
                {
                    key: 'entity.catalog.allowedComponentTypes',
                    value: { _value: ['STRING', 'REF'] },
                    id: null,
                    version: 0,
                    updatedAt: null,
                    isDefault: true
                },
                {
                    key: 'entity.document.allowedComponentTypes',
                    value: { _value: ['STRING', 'REF'] },
                    id: null,
                    version: 0,
                    updatedAt: null,
                    isDefault: true
                },
                {
                    key: 'entity.information-register.allowedComponentTypes',
                    value: { _value: ['STRING', 'NUMBER'] },
                    id: null,
                    version: 0,
                    updatedAt: null,
                    isDefault: true
                }
            ],
            meta: {
                tabOrder: ['general', 'page', 'catalog', 'document', 'information-register']
            }
        },
        isLoading: false,
        isError: false
    }),
    useUpdateSettings: () => ({ mutateAsync: updateMutateAsync }),
    useResetSetting: () => ({ mutateAsync: resetMutateAsync })
}))

const renderPage = (initialEntry = '/metahub/metahub-1/settings') => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route path='/metahub/:metahubId/settings' element={<SettingsPage />} />
                    <Route path='/metahub/:metahubId/resources/layouts/:layoutId' element={<div>Layout detail route</div>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('SettingsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        layoutsApiMocks.listLayouts.mockResolvedValue({
            items: [],
            pagination: { total: 0, limit: 100, offset: 0, count: 0, hasMore: false }
        })
        layoutsApiMocks.listLayoutZoneWidgets.mockResolvedValue([])
        layoutsApiMocks.updateLayoutZoneWidgetConfig.mockResolvedValue({ data: { item: {} } })
    })

    it('renders Page settings from the registry without leaking tab or setting keys', async () => {
        const user = userEvent.setup()

        renderPage()

        expect(screen.getByRole('tab', { name: 'Pages' })).toBeInTheDocument()
        expect(screen.queryByText('settings.tabs.page')).not.toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: 'Pages' }))

        expect(screen.getByText('Allow Copy')).toBeInTheDocument()
        expect(screen.getByText('Allow deleting pages from this metahub')).toBeInTheDocument()
        expect(screen.queryByText('settings.keys.entity.page.allowCopy')).not.toBeInTheDocument()
        expect(screen.queryByText('settings.keys.entity.page.allowDelete')).not.toBeInTheDocument()
    })

    it('renders 1C-compatible settings with user-facing requisite terminology', async () => {
        const user = userEvent.setup()

        renderPage()

        await user.click(screen.getByRole('tab', { name: 'Catalogs' }))
        expect(screen.getByText('Allowed Requisite Types')).toBeInTheDocument()
        expect(screen.getByText('Which data types can be used when creating requisites in catalogs')).toBeInTheDocument()
        expect(screen.queryByText('entity.catalog.allowedComponentTypes')).not.toBeInTheDocument()
        expect(screen.queryByText('Allowed Component Types')).not.toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: 'Documents' }))
        expect(screen.getByText('Which data types can be used when creating requisites in documents')).toBeInTheDocument()
        expect(screen.queryByText('entity.document.allowedComponentTypes')).not.toBeInTheDocument()
        expect(screen.queryByText('Allowed Component Types')).not.toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: 'Information Registers' }))
        expect(screen.getByText('Allowed Register Field Types')).toBeInTheDocument()
        expect(screen.getByText('Which data types can be used when creating information register fields')).toBeInTheDocument()
        expect(screen.queryByText('entity.information-register.allowedComponentTypes')).not.toBeInTheDocument()
    })

    it('aggregates layout widget settings without leaking raw JSON', async () => {
        const user = userEvent.setup()
        layoutsApiMocks.listLayouts.mockResolvedValue({
            items: [
                {
                    id: 'layout-1',
                    templateKey: 'dashboard',
                    name: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: {
                                content: 'Main layout',
                                version: 1,
                                isActive: true,
                                createdAt: '2026-07-17T00:00:00.000Z',
                                updatedAt: '2026-07-17T00:00:00.000Z'
                            }
                        }
                    },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0,
                    createdAt: '2026-07-17T00:00:00.000Z',
                    updatedAt: '2026-07-17T00:00:00.000Z',
                    version: 1
                }
            ],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
        layoutsApiMocks.listLayoutZoneWidgets.mockResolvedValue([
            {
                id: 'widget-1',
                layoutId: 'layout-1',
                zone: 'center',
                widgetKey: 'interpretationNetworkWorkspace',
                sortOrder: 0,
                config: {
                    matrixMode: 'hierarchicalCells',
                    defaultMatrixView: 'horizontalRows',
                    splitPane: { enabled: false }
                },
                isActive: true
            }
        ])

        renderPage()

        await user.click(screen.getByRole('tab', { name: 'Layouts and widgets' }))

        expect(await screen.findByText('Interpretation network workspace')).toBeInTheDocument()
        expect(screen.getByText('Layout: Main layout')).toBeInTheDocument()
        expect(screen.getByText('Matrix mode: Hierarchical cells. Default view: Horizontal rows.')).toBeInTheDocument()
        expect(screen.queryByText(/\{/)).not.toBeInTheDocument()
        expect(screen.queryByText('settings.layoutWidgets.interpretationNetworkSummary')).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Edit settings' }))
        expect(screen.getByRole('dialog', { name: 'Interpretation network workspace' })).toBeInTheDocument()
        expect(screen.getByText('Matrix views')).toBeInTheDocument()
        expect(screen.queryByDisplayValue(/\{/)).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(layoutsApiMocks.updateLayoutZoneWidgetConfig).toHaveBeenCalledWith(
                'metahub-1',
                'layout-1',
                'widget-1',
                expect.objectContaining({
                    matrixMode: 'hierarchicalCells',
                    defaultMatrixView: 'horizontalRows'
                })
            )
        })

        await user.click(screen.getByRole('button', { name: 'Open in layout' }))
        await waitFor(() => {
            expect(screen.getByText('Layout detail route')).toBeInTheDocument()
        })
    })
})
