import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { SHARED_OBJECT_KINDS } from '@universo/types'

const mockLayoutListContent = vi.fn()
const mockFieldDefinitionListContent = vi.fn()
const mockFixedValueListContent = vi.fn()
const mockSelectableOptionListContent = vi.fn()
const mockEntityScriptsTab = vi.fn()
const mockUseSharedContainerIds = vi.fn()
const mockUseAllEntityTypesQuery = vi.fn()

vi.mock('@universo/template-mui', () => ({
    TemplateMainCard: ({ children }: { children: ReactNode }) => <div data-testid='shared-resources-main-card'>{children}</div>,
    PAGE_CONTENT_GUTTER_MX: 0,
    PAGE_TAB_BAR_SX: {},
    ViewHeaderMUI: ({ title }: { title?: string }) => <h1>{title}</h1>,
    createMemberActions: () => [],
    createEntityActions: () => []
}))

vi.mock('../../../../layouts/ui/LayoutList', () => ({
    LayoutListContent: (props: Record<string, unknown>) => {
        mockLayoutListContent(props)
        return <div data-testid='shared-resources-layouts-content'>layouts-content</div>
    },
    default: () => <div data-testid='standalone-layout-list'>standalone-layout-list</div>
}))

vi.mock('../../../metadata/fieldDefinition/ui/FieldDefinitionList', () => ({
    FieldDefinitionListContent: (props: Record<string, unknown>) => {
        mockFieldDefinitionListContent(props)
        return <div data-testid='shared-resources-field-definitions-content'>field-definitions-content</div>
    }
}))

vi.mock('../../../metadata/fixedValue/ui/FixedValueList', () => ({
    FixedValueListContent: (props: Record<string, unknown>) => {
        mockFixedValueListContent(props)
        return <div data-testid='shared-resources-fixed-values-content'>fixed-values-content</div>
    }
}))

vi.mock('../../../metadata/optionValue/ui/SelectableOptionList', () => ({
    SelectableOptionListContent: (props: Record<string, unknown>) => {
        mockSelectableOptionListContent(props)
        return <div data-testid='shared-resources-option-values-content'>option-values-content</div>
    }
}))

vi.mock('../../../../scripts/ui/EntityScriptsTab', () => ({
    EntityScriptsTab: (props: Record<string, unknown>) => {
        mockEntityScriptsTab(props)
        return <div data-testid='shared-resources-scripts-content'>scripts-content</div>
    }
}))

vi.mock('../../../../shared/hooks/useSharedContainerIds', () => ({
    useSharedContainerIds: (metahubId: string | undefined) => mockUseSharedContainerIds(metahubId)
}))

vi.mock('../../../hooks/queries', () => ({
    useAllEntityTypesQuery: (metahubId: string | undefined) => mockUseAllEntityTypesQuery(metahubId)
}))

import '../../../../../i18n'
import SharedResourcesPage from '../SharedResourcesPage'

const i18n = getI18nInstance()

const STANDARD_ENTITY_TYPES = {
    items: [
        { kindKey: 'hub', components: { dataSchema: false, fixedValues: false, optionValues: false } },
        { kindKey: 'catalog', components: { dataSchema: { enabled: true }, fixedValues: false, optionValues: false } },
        { kindKey: 'set', components: { dataSchema: { enabled: true }, fixedValues: { enabled: true }, optionValues: false } },
        { kindKey: 'enumeration', components: { dataSchema: false, fixedValues: false, optionValues: { enabled: true } } }
    ],
    pagination: { limit: 100, offset: 0, count: 4, total: 4, hasMore: false }
}

describe('SharedResourcesPage', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        mockUseSharedContainerIds.mockReturnValue({
            data: {
                [SHARED_OBJECT_KINDS.SHARED_CATALOG_POOL]: 'shared-catalog-pool-1',
                [SHARED_OBJECT_KINDS.SHARED_SET_POOL]: 'shared-set-pool-1',
                [SHARED_OBJECT_KINDS.SHARED_ENUM_POOL]: 'shared-enum-pool-1'
            },
            isLoading: false,
            error: null
        })
        mockUseAllEntityTypesQuery.mockReturnValue({
            data: STANDARD_ENTITY_TYPES,
            isLoading: false,
            error: null
        })
        await i18n.changeLanguage('ru')
    })

    it('renders the shared resources shell with all embedded tabs and switches between shared content surfaces', async () => {
        const user = userEvent.setup()

        render(
            <I18nextProvider i18n={i18n}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/resources']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/resources' element={<SharedResourcesPage />} />
                    </Routes>
                </MemoryRouter>
            </I18nextProvider>
        )

        expect(screen.getByTestId('shared-resources-main-card')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Ресурсы' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Макеты' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tab', { name: 'Атрибуты' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Константы' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Значения' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Скрипты' })).toBeInTheDocument()
        expect(screen.getByTestId('metahub-shared-resources-content')).toBeInTheDocument()
        expect(screen.getByTestId('shared-resources-layouts-content')).toBeInTheDocument()
        expect(screen.queryByTestId('standalone-layout-list')).not.toBeInTheDocument()

        expect(mockLayoutListContent).toHaveBeenCalledTimes(1)
        expect(mockLayoutListContent).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                detailBasePath: '/metahub/metahub-1/resources/layouts',
                title: null,
                embedded: true,
                compactHeader: false,
                renderPageShell: false
            })
        )

        expect(mockUseSharedContainerIds).toHaveBeenCalledWith('metahub-1')
        expect(mockUseAllEntityTypesQuery).toHaveBeenCalledWith('metahub-1')

        await user.click(screen.getByRole('tab', { name: 'Атрибуты' }))

        expect(screen.getByTestId('shared-resources-field-definitions-content')).toBeInTheDocument()
        expect(mockFieldDefinitionListContent).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                linkedCollectionId: 'shared-catalog-pool-1',
                sharedEntityMode: true,
                title: null,
                renderPageShell: false,
                showCatalogTabs: false,
                showSettingsTab: false,
                allowSystemTab: false
            })
        )

        await user.click(screen.getByRole('tab', { name: 'Константы' }))

        expect(screen.getByTestId('shared-resources-fixed-values-content')).toBeInTheDocument()
        expect(mockFixedValueListContent).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                valueGroupId: 'shared-set-pool-1',
                sharedEntityMode: true,
                title: null,
                renderPageShell: false,
                showSettingsTab: false
            })
        )

        await user.click(screen.getByRole('tab', { name: 'Значения' }))

        expect(screen.getByTestId('shared-resources-option-values-content')).toBeInTheDocument()
        expect(mockSelectableOptionListContent).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                optionListId: 'shared-enum-pool-1',
                sharedEntityMode: true,
                title: null,
                renderPageShell: false,
                showSettingsTab: false
            })
        )

        await user.click(screen.getByRole('tab', { name: 'Скрипты' }))

        expect(screen.getByRole('tab', { name: 'Скрипты' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByTestId('shared-resources-scripts-content')).toBeInTheDocument()
        expect(screen.queryByTestId('shared-resources-layouts-content')).not.toBeInTheDocument()
        expect(mockEntityScriptsTab).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                attachedToKind: 'general',
                attachedToId: null,
                t: expect.any(Function)
            })
        )
    })

    it('hides shared tabs when no entity types have the corresponding component enabled', async () => {
        mockUseAllEntityTypesQuery.mockReturnValue({
            data: {
                items: [{ kindKey: 'hub', components: { dataSchema: false, fixedValues: false, optionValues: false } }],
                pagination: { limit: 100, offset: 0, count: 1, total: 1, hasMore: false }
            },
            isLoading: false,
            error: null
        })

        render(
            <I18nextProvider i18n={i18n}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/resources']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/resources' element={<SharedResourcesPage />} />
                    </Routes>
                </MemoryRouter>
            </I18nextProvider>
        )

        expect(screen.getByRole('tab', { name: 'Макеты' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Скрипты' })).toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Атрибуты' })).not.toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Константы' })).not.toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Значения' })).not.toBeInTheDocument()
    })

    it('resolves shared tab labels by capability even when entity types use custom resource-surface keys', async () => {
        mockUseAllEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        kindKey: 'custom-knowledge',
                        components: { dataSchema: { enabled: true }, fixedValues: false, optionValues: false },
                        ui: {
                            resourceSurfaces: [
                                {
                                    key: 'attributes',
                                    capability: 'dataSchema',
                                    routeSegment: 'attributes',
                                    fallbackTitle: 'Свойства'
                                }
                            ]
                        }
                    }
                ],
                pagination: { limit: 100, offset: 0, count: 1, total: 1, hasMore: false }
            },
            isLoading: false,
            error: null
        })

        render(
            <I18nextProvider i18n={i18n}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/resources']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/resources' element={<SharedResourcesPage />} />
                    </Routes>
                </MemoryRouter>
            </I18nextProvider>
        )

        expect(screen.getByRole('tab', { name: 'Свойства' })).toBeInTheDocument()
    })

    it('falls back to the canonical shared label when compatible entity types disagree on the title', async () => {
        mockUseAllEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        kindKey: 'custom-alpha',
                        components: { dataSchema: { enabled: true }, fixedValues: false, optionValues: false },
                        ui: {
                            resourceSurfaces: [
                                {
                                    key: 'alpha-attributes',
                                    capability: 'dataSchema',
                                    routeSegment: 'alpha-attributes',
                                    fallbackTitle: 'Свойства'
                                }
                            ]
                        }
                    },
                    {
                        kindKey: 'custom-beta',
                        components: { dataSchema: { enabled: true }, fixedValues: false, optionValues: false },
                        ui: {
                            resourceSurfaces: [
                                {
                                    key: 'beta-attributes',
                                    capability: 'dataSchema',
                                    routeSegment: 'beta-attributes',
                                    fallbackTitle: 'Поля'
                                }
                            ]
                        }
                    }
                ],
                pagination: { limit: 1000, offset: 0, count: 2, total: 2, hasMore: false }
            },
            isLoading: false,
            error: null
        })

        render(
            <I18nextProvider i18n={i18n}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/resources']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/resources' element={<SharedResourcesPage />} />
                    </Routes>
                </MemoryRouter>
            </I18nextProvider>
        )

        expect(screen.getByRole('tab', { name: 'Атрибуты' })).toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Свойства' })).not.toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Поля' })).not.toBeInTheDocument()
    })
})
