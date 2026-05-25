import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ApplicationLayoutSyncPolicy } from '@universo/types'

const mocks = vi.hoisted(() => ({
    useApplicationDetails: vi.fn(),
    useConnectorDetails: vi.fn(),
    mutateAsync: vi.fn(),
    navigate: vi.fn()
}))

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()
    return {
        ...actual,
        useTranslation: () => ({
            t: (_key: string, fallback?: string) => fallback ?? _key,
            i18n: { language: 'en' }
        })
    }
})

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mocks.navigate
    }
})

vi.mock('@universo/template-mui', () => ({
    ViewHeaderMUI: ({ title, description }: { title: string; description?: string }) => (
        <div>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
        </div>
    ),
    EmptyListState: ({ title }: { title: string }) => <div>{title}</div>,
    APIEmptySVG: 'api-empty'
}))

vi.mock('../../api/useApplicationDetails', () => ({
    useApplicationDetails: mocks.useApplicationDetails
}))

vi.mock('../../hooks/useConnectorPublications', () => ({
    useConnectorDetails: mocks.useConnectorDetails
}))

vi.mock('../../hooks/mutations', () => ({
    useSyncConnector: () => ({
        mutateAsync: mocks.mutateAsync,
        isPending: false
    })
}))

vi.mock('../../components', () => ({
    ConnectorDiffDialog: ({
        open,
        onClose,
        onSync
    }: {
        open: boolean
        onClose: () => void
        onSync: (confirmDestructive: boolean, layoutResolutionPolicy?: ApplicationLayoutSyncPolicy) => Promise<void>
    }) =>
        open ? (
            <div data-testid='connector-diff-dialog'>
                <button type='button' onClick={() => void onSync(false).catch(() => undefined)}>
                    Apply Safe Changes Only
                </button>
                <button type='button' onClick={() => void onSync(true).catch(() => undefined)}>
                    Apply Including Destructive
                </button>
                <button type='button' onClick={onClose}>
                    Close
                </button>
            </div>
        ) : null
}))

import ConnectorBoard from '../ConnectorBoard'

const renderPage = () =>
    render(
        <MemoryRouter
            initialEntries={['/a/app-1/admin/connector/connector-1']}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
            <Routes>
                <Route path='/a/:applicationId/admin/connector/:connectorId' element={<ConnectorBoard />} />
            </Routes>
        </MemoryRouter>
    )

describe('ConnectorBoard', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mocks.useApplicationDetails.mockReturnValue({
            data: {
                id: 'app-1',
                schemaName: 'app_019cdd54a4e17122878322c174ef217f',
                schemaStatus: 'outdated',
                schemaSyncedAt: null,
                schemaError: null,
                updatedAt: '2026-03-12T10:00:00.000Z'
            },
            isLoading: false
        })

        mocks.useConnectorDetails.mockReturnValue({
            data: {
                connector: {
                    id: 'connector-1',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Connector One' } }
                    },
                    description: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Connector description' } }
                    },
                    createdAt: '2026-03-10T08:00:00.000Z',
                    updatedAt: '2026-03-11T09:00:00.000Z'
                },
                publication: {
                    id: 'publication-1',
                    metahub: {
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Metahub Alpha' } }
                        }
                    }
                }
            },
            isLoading: false,
            error: null,
            isError: false
        })
    })

    it('opens the diff dialog and forwards destructive sync confirmation to the mutation', async () => {
        mocks.mutateAsync.mockResolvedValue(undefined)

        const user = userEvent.setup()
        renderPage()

        await user.click(screen.getByRole('button', { name: 'Sync Schema' }))

        expect(screen.getByTestId('connector-diff-dialog')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Apply Including Destructive' }))

        await waitFor(() => {
            expect(mocks.mutateAsync).toHaveBeenCalledWith({
                applicationId: 'app-1',
                confirmDestructive: true,
                layoutResolutionPolicy: undefined
            })
        })

        await waitFor(() => {
            expect(screen.queryByTestId('connector-diff-dialog')).not.toBeInTheDocument()
        })
    })

    it('keeps the diff dialog open when sync fails and logs the failure', async () => {
        const error = new Error('sync exploded')
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.mutateAsync.mockRejectedValue(error)

        const user = userEvent.setup()
        renderPage()

        await user.click(screen.getByRole('button', { name: 'Sync Schema' }))
        await user.click(screen.getByRole('button', { name: 'Apply Safe Changes Only' }))

        await waitFor(() => {
            expect(mocks.mutateAsync).toHaveBeenCalledWith({
                applicationId: 'app-1',
                confirmDestructive: false,
                layoutResolutionPolicy: undefined
            })
        })

        expect(screen.getByTestId('connector-diff-dialog')).toBeInTheDocument()
        expect(consoleErrorSpy).toHaveBeenCalledWith('[ConnectorBoard] Sync failed:', error)

        consoleErrorSpy.mockRestore()
    })
})
