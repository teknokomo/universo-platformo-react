import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'

const mockLayoutListContent = vi.fn()

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

import '../../../../i18n'
import CommonPage from '../GeneralPage'

const i18n = getI18nInstance()

describe('CommonPage', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        await i18n.changeLanguage('ru')
    })

    it('renders the Common shell with registered metahubs translations and reuses LayoutListContent without nesting a standalone layouts page shell', () => {
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
    })
})
