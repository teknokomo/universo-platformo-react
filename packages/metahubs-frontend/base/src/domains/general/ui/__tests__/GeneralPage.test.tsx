import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { SHARED_OBJECT_KINDS } from '@universo/types'

const mockLayoutListContent = vi.fn()
const mockAttributeListContent = vi.fn()
const mockConstantListContent = vi.fn()
const mockEnumerationValueListContent = vi.fn()
const mockEntityScriptsTab = vi.fn()
const mockUseSharedContainerIds = vi.fn()

vi.mock('@universo/template-mui', () => ({
    TemplateMainCard: ({ children }: { children: ReactNode }) => <div data-testid='common-main-card'>{children}</div>,
    PAGE_CONTENT_GUTTER_MX: 0,
    PAGE_TAB_BAR_SX: {},
    ViewHeaderMUI: ({ title }: { title?: string }) => <h1>{title}</h1>
}))

vi.mock('../../../layouts/ui/LayoutList', () => ({
    LayoutListContent: (props: Record<string, unknown>) => {
        mockLayoutListContent(props)
        return <div data-testid='common-layouts-content'>layouts-content</div>
    },
    default: () => <div data-testid='standalone-layout-list'>standalone-layout-list</div>
}))

vi.mock('../../../attributes/ui/AttributeList', () => ({
    AttributeListContent: (props: Record<string, unknown>) => {
        mockAttributeListContent(props)
        return <div data-testid='common-attributes-content'>attributes-content</div>
    }
}))

vi.mock('../../../constants/ui/ConstantList', () => ({
    ConstantListContent: (props: Record<string, unknown>) => {
        mockConstantListContent(props)
        return <div data-testid='common-constants-content'>constants-content</div>
    }
}))

vi.mock('../../../enumerations/ui/EnumerationValueList', () => ({
    EnumerationValueListContent: (props: Record<string, unknown>) => {
        mockEnumerationValueListContent(props)
        return <div data-testid='common-values-content'>values-content</div>
    }
}))

vi.mock('../../../scripts/ui/EntityScriptsTab', () => ({
    EntityScriptsTab: (props: Record<string, unknown>) => {
        mockEntityScriptsTab(props)
        return <div data-testid='common-scripts-content'>scripts-content</div>
    }
}))

vi.mock('../../../shared/hooks/useSharedContainerIds', () => ({
    useSharedContainerIds: (metahubId: string | undefined) => mockUseSharedContainerIds(metahubId)
}))

import '../../../../i18n'
import CommonPage from '../GeneralPage'

const i18n = getI18nInstance()

describe('CommonPage', () => {
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
        await i18n.changeLanguage('ru')
    })

    it('renders the Common shell with all embedded tabs and switches between shared content surfaces', async () => {
        const user = userEvent.setup()

        render(
            <I18nextProvider i18n={i18n}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/common']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/common' element={<CommonPage />} />
                    </Routes>
                </MemoryRouter>
            </I18nextProvider>
        )

        expect(screen.getByTestId('common-main-card')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Общие' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Макеты' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tab', { name: 'Атрибуты' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Константы' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Значения' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Скрипты' })).toBeInTheDocument()
        expect(screen.getByTestId('metahub-common-content')).toBeInTheDocument()
        expect(screen.getByTestId('common-layouts-content')).toBeInTheDocument()
        expect(screen.queryByTestId('standalone-layout-list')).not.toBeInTheDocument()

        expect(mockLayoutListContent).toHaveBeenCalledTimes(1)
        expect(mockLayoutListContent).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                detailBasePath: '/metahub/metahub-1/common/layouts',
                title: null,
                embedded: true,
                compactHeader: false,
                renderPageShell: false
            })
        )

        expect(mockUseSharedContainerIds).toHaveBeenCalledWith('metahub-1')

        await user.click(screen.getByRole('tab', { name: 'Атрибуты' }))

        expect(screen.getByTestId('common-attributes-content')).toBeInTheDocument()
        expect(mockAttributeListContent).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                catalogId: 'shared-catalog-pool-1',
                sharedEntityMode: true,
                title: null,
                renderPageShell: false,
                showCatalogTabs: false,
                showSettingsTab: false,
                allowSystemTab: false
            })
        )

        await user.click(screen.getByRole('tab', { name: 'Константы' }))

        expect(screen.getByTestId('common-constants-content')).toBeInTheDocument()
        expect(mockConstantListContent).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                setId: 'shared-set-pool-1',
                sharedEntityMode: true,
                title: null,
                renderPageShell: false,
                showSettingsTab: false
            })
        )

        await user.click(screen.getByRole('tab', { name: 'Значения' }))

        expect(screen.getByTestId('common-values-content')).toBeInTheDocument()
        expect(mockEnumerationValueListContent).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                enumerationId: 'shared-enum-pool-1',
                sharedEntityMode: true,
                title: null,
                renderPageShell: false,
                showSettingsTab: false
            })
        )

        await user.click(screen.getByRole('tab', { name: 'Скрипты' }))

        expect(screen.getByRole('tab', { name: 'Скрипты' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByTestId('common-scripts-content')).toBeInTheDocument()
        expect(screen.queryByTestId('common-layouts-content')).not.toBeInTheDocument()
        expect(mockEntityScriptsTab).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                attachedToKind: 'general',
                attachedToId: null,
                t: expect.any(Function)
            })
        )
    })
})
