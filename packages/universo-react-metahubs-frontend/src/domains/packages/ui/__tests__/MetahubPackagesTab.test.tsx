import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInstance as getI18nInstance } from '@universo-react/i18n/instance'
import type { MetahubPackageCatalogItem } from '@universo-react/types'
import { createLocalizedContent } from '@universo-react/utils'
import '../../../../i18n'
import { packagesApi } from '../../api'
import { MetahubPackagesTab } from '../MetahubPackagesTab'

const mockUseMetahubDetails = vi.fn()
const mockEnqueueSnackbar = vi.fn()

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar })
}))

vi.mock('react-redux', () => ({
    useSelector: (selector: (state: { customization: { isDarkMode: boolean } }) => unknown) =>
        selector({ customization: { isDarkMode: false } })
}))

vi.mock('../../api', () => ({
    packagesApi: {
        listCatalog: vi.fn(),
        attach: vi.fn(),
        changeVersion: vi.fn(),
        detach: vi.fn()
    }
}))

vi.mock('../../../metahubs/hooks', () => ({
    useMetahubDetails: (...args: unknown[]) => mockUseMetahubDetails(...args)
}))

const i18n = getI18nInstance()

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const catalogItem = (overrides: Partial<MetahubPackageCatalogItem> = {}): MetahubPackageCatalogItem => ({
    id: overrides.id ?? '@universo-react/playcanvas-engine:0.1.0',
    packageName: overrides.packageName ?? '@universo-react/playcanvas-engine',
    version: overrides.version ?? '0.1.0',
    displayName: overrides.displayName ?? createLocalizedContent('ru', 'PlayCanvas Engine'),
    description: overrides.description ?? createLocalizedContent('ru', 'Пакет рабочей области для PlayCanvas Engine.'),
    source: overrides.source ?? {
        kind: 'workspace',
        packageName: '@universo-react/playcanvas-engine',
        importName: '@universo-react/playcanvas-engine',
        upstreamPackageName: 'playcanvas',
        upstreamVersion: '2.18.1',
        runtimeTargets: ['client']
    },
    isActive: overrides.isActive ?? true,
    attached: overrides.attached ?? false,
    attachmentId: overrides.attachmentId ?? null,
    attachedPackageId: overrides.attachedPackageId ?? null,
    attachedVersion: overrides.attachedVersion ?? null
})

const renderTab = () =>
    render(
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={createQueryClient()}>
                <MetahubPackagesTab metahubId='metahub-1' />
            </QueryClientProvider>
        </I18nextProvider>
    )

describe('MetahubPackagesTab', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        await i18n.changeLanguage('ru')
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: true } },
            isLoading: false
        })
        vi.mocked(packagesApi.attach).mockResolvedValue({} as never)
        vi.mocked(packagesApi.changeVersion).mockResolvedValue({} as never)
        vi.mocked(packagesApi.detach).mockResolvedValue(undefined)
    })

    it('renders registry packages without raw ids and connects a selected package', async () => {
        const user = userEvent.setup()
        vi.mocked(packagesApi.listCatalog).mockResolvedValue([catalogItem()])

        renderTab()

        expect(await screen.findByText('PlayCanvas Engine')).toBeInTheDocument()
        expect(screen.getByRole('table', { name: 'Пакеты' })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: '#' })).toBeInTheDocument()
        expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument()
        expect(document.querySelector('.FlowListTable-compact')).not.toBeInTheDocument()
        expect(screen.queryByText('@universo-react/playcanvas-engine')).not.toBeInTheDocument()
        expect(screen.queryByText('playcanvas')).not.toBeInTheDocument()
        expect(screen.getByText('Закреплённая upstream-версия')).toBeInTheDocument()
        expect(screen.getByText('Клиент')).toBeInTheDocument()
        expect(screen.getByText('Доступен')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Подключить PlayCanvas Engine' }))
        expect(await screen.findByRole('dialog', { name: 'Подключить пакет' })).toBeInTheDocument()
        expect(screen.queryByTestId('dialog-resize-handle')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Подключить пакет' }))

        await waitFor(() => {
            expect(packagesApi.attach).toHaveBeenCalledWith('metahub-1', {
                packageName: '@universo-react/playcanvas-engine',
                version: '0.1.0'
            })
        })
    })

    it('disconnects an attached package by attachment id without showing the id', async () => {
        const user = userEvent.setup()
        vi.mocked(packagesApi.listCatalog).mockResolvedValue([
            catalogItem({
                attached: true,
                attachmentId: '018f0000-0000-7000-8000-000000000001',
                attachedVersion: '0.1.0'
            })
        ])

        renderTab()

        expect(await screen.findByText('Подключён')).toBeInTheDocument()
        expect(screen.queryByText('018f0000-0000-7000-8000-000000000001')).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Отключить PlayCanvas Engine' }))
        expect(await screen.findByRole('dialog', { name: 'Отключить пакет' })).toBeInTheDocument()
        expect(screen.queryByTestId('dialog-resize-handle')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Отключить пакет' }))

        await waitFor(() => {
            expect(packagesApi.detach).toHaveBeenCalledWith('metahub-1', '018f0000-0000-7000-8000-000000000001')
        })
    })

    it('renders read-only actions when the user cannot manage the metahub', async () => {
        vi.mocked(packagesApi.listCatalog).mockResolvedValue([catalogItem()])
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: false } },
            isLoading: false
        })

        renderTab()

        expect(await screen.findByText('Вы можете просматривать подключённые пакеты, но не можете изменять их.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Подключить PlayCanvas Engine' })).toBeDisabled()
    })

    it('confirms version changes when multiple registry versions exist', async () => {
        const user = userEvent.setup()
        vi.mocked(packagesApi.listCatalog).mockResolvedValue([
            catalogItem({
                id: '@universo-react/playcanvas-engine:0.1.0',
                version: '0.1.0',
                attached: true,
                attachmentId: 'attach-1',
                attachedVersion: '0.1.0'
            }),
            catalogItem({
                id: '@universo-react/playcanvas-engine:0.2.0',
                version: '0.2.0'
            })
        ])

        renderTab()

        const versionSelect = await screen.findByText('0.1.0')
        await user.click(versionSelect)
        await user.click(screen.getByRole('option', { name: '0.2.0' }))

        expect(await screen.findByRole('dialog', { name: 'Изменить версию пакета' })).toBeInTheDocument()
        expect(screen.queryByTestId('dialog-resize-handle')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Изменить версию' }))

        await waitFor(() => {
            expect(packagesApi.changeVersion).toHaveBeenCalledWith('metahub-1', 'attach-1', { version: '0.2.0' })
        })
    })

    it('shows localized package mutation fallback errors', async () => {
        const user = userEvent.setup()
        vi.mocked(packagesApi.listCatalog).mockResolvedValue([catalogItem()])
        vi.mocked(packagesApi.attach).mockRejectedValue(new Error('Package from metahub snapshot is not registered'))

        renderTab()

        await user.click(await screen.findByRole('button', { name: 'Подключить PlayCanvas Engine' }))
        await user.click(screen.getByRole('button', { name: 'Подключить пакет' }))

        await waitFor(() => {
            expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
                'Не удалось выполнить операцию с пакетом. Обновите страницу и попробуйте ещё раз.',
                { variant: 'error' }
            )
        })
    })
})
