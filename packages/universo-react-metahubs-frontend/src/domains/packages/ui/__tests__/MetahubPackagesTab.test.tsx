import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInstance as getI18nInstance } from '@universo-react/i18n/instance'
import type { MetahubPackageAttachment, MetahubPackageCatalogItem, PackageAttachmentConfig } from '@universo-react/types'
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
        listAttached: vi.fn(),
        attach: vi.fn(),
        changeVersion: vi.fn(),
        updateConfig: vi.fn(),
        getAuthoringHost: vi.fn(),
        detach: vi.fn()
    }
}))

vi.mock('../../../metahubs/hooks', () => ({
    useMetahubDetails: (...args: unknown[]) => mockUseMetahubDetails(...args)
}))

const i18n = getI18nInstance()
const editorPackageName = `@universo-react/${'playcanvas-editor'}`

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
    authoringSurface: overrides.authoringSurface ?? {
        schemaVersion: '1',
        kind: 'none',
        supportedDisplayModes: [],
        defaultConfig: {
            schemaVersion: '1',
            kind: 'none'
        }
    },
    isActive: overrides.isActive ?? true,
    attached: overrides.attached ?? false,
    attachmentId: overrides.attachmentId ?? null,
    attachedPackageId: overrides.attachedPackageId ?? null,
    attachedVersion: overrides.attachedVersion ?? null
})

const playCanvasEditorCatalogItem = (overrides: Partial<MetahubPackageCatalogItem> = {}): MetahubPackageCatalogItem =>
    catalogItem({
        id: overrides.id ?? `${editorPackageName}:0.1.0`,
        packageName: overrides.packageName ?? editorPackageName,
        version: overrides.version ?? '0.1.0',
        displayName: overrides.displayName ?? createLocalizedContent('ru', 'PlayCanvas Editor'),
        description: overrides.description ?? createLocalizedContent('ru', 'Редактор PlayCanvas для метахаба.'),
        source: overrides.source ?? {
            kind: 'workspace',
            packageName: editorPackageName,
            importName: editorPackageName,
            upstreamPackageName: 'playcanvas-editor',
            upstreamVersion: '2026.05.30',
            runtimeTargets: []
        },
        authoringSurface: overrides.authoringSurface ?? {
            schemaVersion: '1',
            kind: 'playcanvasEditor',
            packageSlug: 'playcanvas-editor',
            supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl'],
            defaultConfig: {
                schemaVersion: '1',
                kind: 'display',
                display: {
                    mode: 'embeddedIframe',
                    developmentUrl: null,
                    showArtifactOnlyNotice: true
                }
            },
            artifact: {
                packageName: editorPackageName,
                manifestFileName: 'universo-artifact-manifest.json',
                outputRoot: 'dist/editor',
                smokeMode: 'artifact-only'
            }
        },
        attached: overrides.attached ?? true,
        attachmentId: overrides.attachmentId ?? 'attach-playcanvas-editor',
        attachedPackageId: overrides.attachedPackageId ?? 'pkg-playcanvas-editor',
        attachedVersion: overrides.attachedVersion ?? '0.1.0'
    })

const playCanvasEditorAttachment = (config: PackageAttachmentConfig): MetahubPackageAttachment => {
    const item = playCanvasEditorCatalogItem()
    return {
        id: 'attach-playcanvas-editor',
        metahubId: 'metahub-1',
        packageId: 'pkg-playcanvas-editor',
        packageName: item.packageName,
        version: item.version,
        displayName: item.displayName,
        description: item.description,
        source: item.source,
        authoringSurface: item.authoringSurface,
        config,
        attachedAt: '2026-06-01T00:00:00.000Z',
        isActive: true
    }
}

const renderTab = () =>
    render(
        <I18nextProvider i18n={i18n}>
            <MemoryRouter>
                <QueryClientProvider client={createQueryClient()}>
                    <MetahubPackagesTab metahubId='metahub-1' />
                </QueryClientProvider>
            </MemoryRouter>
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
        vi.mocked(packagesApi.listAttached).mockResolvedValue([])
        vi.mocked(packagesApi.changeVersion).mockResolvedValue({} as never)
        vi.mocked(packagesApi.updateConfig).mockResolvedValue({} as never)
        vi.mocked(packagesApi.getAuthoringHost).mockImplementation(async (_metahubId, _packageSlug) => {
            const item = playCanvasEditorAttachment(playCanvasEditorCatalogItem().authoringSurface.defaultConfig)
            return {
                packageSlug: 'playcanvas-editor',
                packageName: item.packageName,
                version: item.version,
                displayName: item.displayName,
                description: item.description,
                attachmentConfig: item.config,
                authoringSurface: item.authoringSurface,
                allowedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl'],
                artifactStatus: 'available',
                artifactUrl: '/api/v1/metahub/metahub-1/packages/playcanvas-editor/editor-artifact-token/test-token/index.html'
            }
        })
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
        expect(screen.getByText('Закреплённая версия исходной зависимости')).toBeInTheDocument()
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
        vi.mocked(packagesApi.listCatalog).mockResolvedValue([catalogItem(), playCanvasEditorCatalogItem()])
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: false } },
            isLoading: false
        })

        renderTab()

        expect(await screen.findByText('Вы можете просматривать подключённые пакеты, но не можете изменять их.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Подключить PlayCanvas Engine' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Действия для PlayCanvas Editor' })).toBeDisabled()
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

    it('sends explicit reset intent for package version changes when requested', async () => {
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
        await user.click(screen.getByRole('checkbox', { name: /Сбросить настройки отображения пакета/i }))
        await user.click(screen.getByRole('button', { name: 'Изменить версию' }))

        await waitFor(() => {
            expect(packagesApi.changeVersion).toHaveBeenCalledWith('metahub-1', 'attach-1', {
                version: '0.2.0',
                resetConfig: true
            })
        })
    })

    it('resets the draft version when the change dialog is dismissed', async () => {
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
        await user.keyboard('{Escape}')

        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: 'Изменить версию пакета' })).not.toBeInTheDocument()
        })
        expect(screen.getByText('0.1.0')).toBeInTheDocument()
        expect(packagesApi.changeVersion).not.toHaveBeenCalled()
    })

    it('shows detach mutation errors inside the confirmation dialog', async () => {
        const user = userEvent.setup()
        vi.mocked(packagesApi.listCatalog).mockResolvedValue([
            catalogItem({
                attached: true,
                attachmentId: '018f0000-0000-7000-8000-000000000001',
                attachedVersion: '0.1.0'
            })
        ])
        vi.mocked(packagesApi.detach).mockRejectedValue(new Error('Detach failed'))

        renderTab()

        await user.click(await screen.findByRole('button', { name: 'Отключить PlayCanvas Engine' }))
        await user.click(screen.getByRole('button', { name: 'Отключить пакет' }))

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Не удалось выполнить операцию с пакетом. Обновите страницу и попробуйте ещё раз.'
        )
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

    it('saves PlayCanvas Editor development URL settings with a typed config payload', async () => {
        const user = userEvent.setup()
        vi.mocked(packagesApi.listCatalog).mockResolvedValue([playCanvasEditorCatalogItem()])

        renderTab()

        await user.click(await screen.findByRole('button', { name: 'Действия для PlayCanvas Editor' }))
        await user.click(screen.getByRole('menuitem', { name: 'Настройки' }))
        expect(await screen.findByRole('dialog', { name: 'Настройки отображения пакета' })).toBeInTheDocument()

        await user.click(screen.getByLabelText('Режим отображения'))
        await user.click(screen.getByRole('option', { name: 'Адрес разработки' }))
        await user.type(screen.getByLabelText('Адрес разработки'), 'http://localhost:5100/editor')
        await user.click(screen.getByRole('switch', { name: 'Показывать статус артефакта' }))
        await user.click(screen.getByRole('button', { name: 'Сохранить настройки' }))

        await waitFor(() => {
            expect(packagesApi.updateConfig).toHaveBeenCalledWith('metahub-1', 'attach-playcanvas-editor', {
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'developmentUrl',
                        developmentUrl: 'http://localhost:5100/editor',
                        showArtifactOnlyNotice: false
                    }
                }
            })
        })
    })

    it('hides PlayCanvas Editor development URL mode when the server policy disables it', async () => {
        const user = userEvent.setup()
        vi.mocked(packagesApi.listCatalog).mockResolvedValue([playCanvasEditorCatalogItem()])
        vi.mocked(packagesApi.getAuthoringHost).mockImplementation(async (_metahubId, _packageSlug) => {
            const item = playCanvasEditorAttachment(playCanvasEditorCatalogItem().authoringSurface.defaultConfig)
            return {
                packageSlug: 'playcanvas-editor',
                packageName: item.packageName,
                version: item.version,
                displayName: item.displayName,
                description: item.description,
                attachmentConfig: item.config,
                authoringSurface: item.authoringSurface,
                allowedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately'],
                artifactStatus: 'available',
                artifactUrl: '/api/v1/metahub/metahub-1/packages/playcanvas-editor/editor-artifact-token/test-token/index.html'
            }
        })

        renderTab()

        await user.click(await screen.findByRole('button', { name: 'Действия для PlayCanvas Editor' }))
        await user.click(screen.getByRole('menuitem', { name: 'Настройки' }))
        expect(await screen.findByRole('dialog', { name: 'Настройки отображения пакета' })).toBeInTheDocument()
        expect(screen.getByText('Режим адреса разработки отключён на этом сервере.')).toBeInTheDocument()

        await user.click(screen.getByLabelText('Режим отображения'))
        expect(screen.queryByRole('option', { name: 'Адрес разработки' })).not.toBeInTheDocument()
        expect(packagesApi.updateConfig).not.toHaveBeenCalled()
    })

    it('resets PlayCanvas Editor settings draft to descriptor defaults', async () => {
        const user = userEvent.setup()
        const developmentConfig: PackageAttachmentConfig = {
            schemaVersion: '1',
            kind: 'display',
            display: {
                mode: 'developmentUrl',
                developmentUrl: 'http://localhost:5100/editor',
                showArtifactOnlyNotice: false
            }
        }
        vi.mocked(packagesApi.listCatalog).mockResolvedValue([playCanvasEditorCatalogItem()])
        vi.mocked(packagesApi.listAttached).mockResolvedValue([playCanvasEditorAttachment(developmentConfig)])
        vi.mocked(packagesApi.getAuthoringHost).mockImplementation(async (_metahubId, _packageSlug) => {
            const item = playCanvasEditorAttachment(developmentConfig)
            return {
                packageSlug: 'playcanvas-editor',
                packageName: item.packageName,
                version: item.version,
                displayName: item.displayName,
                description: item.description,
                attachmentConfig: item.config,
                authoringSurface: item.authoringSurface,
                allowedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl'],
                artifactStatus: 'available',
                artifactUrl: '/api/v1/metahub/metahub-1/packages/playcanvas-editor/editor-artifact-token/test-token/index.html'
            }
        })

        renderTab()

        await user.click(await screen.findByRole('button', { name: 'Действия для PlayCanvas Editor' }))
        await user.click(screen.getByRole('menuitem', { name: 'Настройки' }))
        expect(await screen.findByRole('dialog', { name: 'Настройки отображения пакета' })).toBeInTheDocument()
        expect(screen.getByLabelText('Режим отображения')).toHaveTextContent('Адрес разработки')
        expect(screen.getByLabelText('Адрес разработки')).toHaveValue('http://localhost:5100/editor')

        await user.click(screen.getByRole('button', { name: 'Сбросить по умолчанию' }))
        expect(screen.getByLabelText('Режим отображения')).toHaveTextContent('Встроенный')
        expect(screen.queryByLabelText('Адрес разработки')).not.toBeInTheDocument()
        expect(screen.getByRole('switch', { name: 'Показывать статус артефакта' })).toBeChecked()

        await user.click(screen.getByRole('button', { name: 'Сохранить настройки' }))

        await waitFor(() => {
            expect(packagesApi.updateConfig).toHaveBeenCalledWith('metahub-1', 'attach-playcanvas-editor', {
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'embeddedIframe',
                        developmentUrl: null,
                        showArtifactOnlyNotice: true
                    }
                }
            })
        })
    })

    it('blocks invalid PlayCanvas Editor development URLs before saving settings', async () => {
        const user = userEvent.setup()
        vi.mocked(packagesApi.listCatalog).mockResolvedValue([playCanvasEditorCatalogItem()])

        renderTab()

        await user.click(await screen.findByRole('button', { name: 'Действия для PlayCanvas Editor' }))
        await user.click(screen.getByRole('menuitem', { name: 'Настройки' }))
        await user.click(await screen.findByLabelText('Режим отображения'))
        await user.click(screen.getByRole('option', { name: 'Адрес разработки' }))
        await user.type(screen.getByLabelText('Адрес разработки'), 'notaurl')

        expect(screen.getByText('Введите корректный адрес с http или https.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Сохранить настройки' })).toBeDisabled()
        expect(packagesApi.updateConfig).not.toHaveBeenCalled()
    })
})
