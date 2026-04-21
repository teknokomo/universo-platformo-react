import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ModuleViewerWidget from '../ModuleViewerWidget'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'

const mocks = vi.hoisted(() => ({
    executeClientScriptMethod: vi.fn()
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: string | Record<string, unknown>) => {
            if (typeof options === 'string') {
                return options
            }

            if (options && typeof options === 'object' && 'defaultValue' in options) {
                return String(options.defaultValue)
                    .replace('{{current}}', String(options.current ?? ''))
                    .replace('{{total}}', String(options.total ?? ''))
            }

            return key
        },
        i18n: {
            language: 'en'
        }
    })
}))

vi.mock('../../runtime/browserScriptRuntime', () => ({
    executeClientScriptMethod: mocks.executeClientScriptMethod
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    })

const renderWidget = (details?: Record<string, unknown>) => {
    const queryClient = createQueryClient()

    return render(
        <QueryClientProvider client={queryClient}>
            <DashboardDetailsProvider value={details as never}>
                <ModuleViewerWidget config={{ attachedToKind: 'catalog', scriptCodename: 'lms-module-viewer' }} />
            </DashboardDetailsProvider>
        </QueryClientProvider>
    )
}

describe('ModuleViewerWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)

                if (url.includes('/runtime/scripts?attachedToKind=catalog&attachedToId=catalog-1')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                {
                                    id: 'script-1',
                                    codename: 'lms-module-viewer',
                                    attachedToKind: 'catalog',
                                    attachedToId: 'catalog-1',
                                    moduleRole: 'widget',
                                    sourceKind: 'embedded',
                                    sdkApiVersion: '1.0.0',
                                    isActive: true,
                                    checksum: 'checksum-1',
                                    manifest: {
                                        moduleRole: 'widget',
                                        capabilities: ['rpc.client'],
                                        methods: [{ name: 'mount', target: 'client' }]
                                    }
                                }
                            ]
                        })
                    } as Response
                }

                if (url.endsWith('/runtime/scripts/script-1/client')) {
                    return {
                        ok: true,
                        text: async () => 'module.exports = class ModuleViewerRuntime {}'
                    } as Response
                }

                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

        mocks.executeClientScriptMethod.mockResolvedValue({
            title: 'LMS Demo Module',
            description: 'Three content items',
            progressPercent: 33,
            items: [
                {
                    id: 'item-1',
                    itemType: 'text',
                    itemTitle: 'Welcome',
                    itemContent: 'Hello class',
                    sortOrder: 1
                },
                {
                    id: 'item-2',
                    itemType: 'image',
                    itemTitle: 'Space map',
                    itemContent: 'https://example.com/map.png',
                    sortOrder: 2
                }
            ]
        })
    })

    it('renders an info state when runtime context is missing', () => {
        renderWidget(undefined)

        expect(screen.getByText('Module viewer widget is available only inside the application runtime surface.')).toBeInTheDocument()
    })

    it('renders content items and allows forward/backward navigation', async () => {
        renderWidget({
            applicationId: 'app-1',
            linkedCollectionId: 'catalog-1',
            apiBaseUrl: '/api/v1'
        })

        expect(await screen.findByText('LMS Demo Module')).toBeInTheDocument()
        expect(screen.getByText('Hello class')).toBeInTheDocument()
        expect(screen.getByText('Item 1 of 2')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => {
            expect(screen.getByText('Space map')).toBeInTheDocument()
            expect(screen.getByRole('img', { name: 'Space map' })).toHaveAttribute('src', 'https://example.com/map.png')
            expect(screen.getByText('Item 2 of 2')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Previous' }))

        await waitFor(() => {
            expect(screen.getByText('Welcome')).toBeInTheDocument()
            expect(screen.getByText('Hello class')).toBeInTheDocument()
        })
    })
})
