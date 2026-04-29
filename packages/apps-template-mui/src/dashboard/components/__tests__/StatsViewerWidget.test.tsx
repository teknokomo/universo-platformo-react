import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import StatsViewerWidget from '../StatsViewerWidget'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'

const mocks = vi.hoisted(() => ({
    executeClientScriptMethod: vi.fn()
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
            if (typeof fallbackOrOptions === 'string') {
                return fallbackOrOptions
            }

            return _key
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
                <StatsViewerWidget config={{ attachedToKind: 'catalog', scriptCodename: 'lms-stats-viewer' }} />
            </DashboardDetailsProvider>
        </QueryClientProvider>
    )
}

describe('StatsViewerWidget', () => {
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
                                    codename: 'lms-stats-viewer',
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
                        text: async () => 'module.exports = class StatsViewerRuntime {}'
                    } as Response
                }

                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

        mocks.executeClientScriptMethod.mockResolvedValue({
            title: 'Learning stats',
            description: 'Weekly progress',
            categories: ['Week 1', 'Week 2'],
            series: [{ label: 'Completed', values: [3, 5] }]
        })
    })

    it('renders an info state when runtime context is missing', () => {
        renderWidget(undefined)

        expect(screen.getByText('Stats viewer widget is available only inside the application runtime surface.')).toBeInTheDocument()
    })

    it('renders the stats model returned by the runtime widget script', async () => {
        renderWidget({
            applicationId: 'app-1',
            linkedCollectionId: 'catalog-1',
            apiBaseUrl: '/api/v1'
        })

        expect(await screen.findByText('Learning stats')).toBeInTheDocument()
        expect(screen.getByText('Weekly progress')).toBeInTheDocument()
        expect(mocks.executeClientScriptMethod).toHaveBeenCalledWith(
            expect.objectContaining({
                methodName: 'mount',
                args: ['en']
            })
        )
    })
})
