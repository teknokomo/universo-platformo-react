import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EntityModulesTab } from '../EntityModulesTab'

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    useMetahubDetails: vi.fn(),
    lastCodeMirrorProps: null as Record<string, unknown> | null,
    resizeWidth: 640,
    resizeCallback: null as ResizeObserverCallback | null,
    resizeTarget: null as Element | null
}))

class ResizeObserverMock {
    callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        mocks.resizeCallback = callback
    }

    observe(target: Element) {
        mocks.resizeTarget = target
        this.callback(
            [
                {
                    target,
                    contentRect: {
                        width: mocks.resizeWidth,
                        height: 0,
                        x: 0,
                        y: 0,
                        top: 0,
                        right: mocks.resizeWidth,
                        bottom: 0,
                        left: 0,
                        toJSON: () => ({})
                    } as DOMRectReadOnly
                } as ResizeObserverEntry
            ],
            this as unknown as ResizeObserver
        )
    }

    disconnect() {
        return undefined
    }

    unobserve() {
        return undefined
    }
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

type CodeMirrorMockProps = Record<string, unknown> & {
    value?: unknown
    onChange?: (value: string) => void
}

vi.mock('@uiw/react-codemirror', () => ({
    default: (props: CodeMirrorMockProps) => {
        mocks.lastCodeMirrorProps = props

        return (
            <textarea
                aria-label='Module source code'
                data-testid='module-source-editor'
                value={String(props.value ?? '')}
                onChange={(event) => props.onChange?.(event.target.value)}
            />
        )
    }
}))

vi.mock('../../api/modulesApi', () => ({
    modulesApi: {
        list: mocks.list,
        create: mocks.create,
        update: mocks.update,
        remove: mocks.remove
    }
}))

vi.mock('../../../metahubs/hooks', () => ({
    useMetahubDetails: (...args: unknown[]) => mocks.useMetahubDetails(...args)
}))

const translate = (key: string, fallback?: string) => fallback ?? key

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            },
            mutations: {
                retry: false
            }
        }
    })

const createVisibleDomRect = (): DOMRect =>
    ({
        x: 0,
        y: 0,
        width: 160,
        height: 40,
        top: 0,
        right: 160,
        bottom: 40,
        left: 0,
        toJSON: () => ({})
    } as DOMRect)

const createModuleRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'module-1',
    version: 1,
    codename: {
        _schema: 'v1',
        _primary: 'en',
        locales: {
            en: { content: 'quiz-widget' }
        }
    },
    presentation: {
        name: {
            _schema: 'v1',
            _primary: 'en',
            locales: {
                en: { content: 'Quiz widget' }
            }
        },
        description: {
            _schema: 'v1',
            _primary: 'en',
            locales: {
                en: { content: 'Widget description' }
            }
        }
    },
    attachedToKind: 'object',
    attachedToId: 'object-1',
    moduleRole: 'module',
    sourceKind: 'embedded',
    sdkApiVersion: '1.0.0',
    sourceCode: 'export default class ExampleModule extends ExtensionModule {}',
    manifest: {
        className: 'ExampleModule',
        sdkApiVersion: '1.0.0',
        moduleRole: 'module',
        sourceKind: 'embedded',
        capabilities: ['records.read', 'metadata.read'],
        methods: []
    },
    serverBundle: 'server bundle',
    clientBundle: 'client bundle',
    checksum: 'checksum-1',
    isActive: true,
    ...overrides
})

const renderTab = (ui: ReactNode) => {
    const queryClient = createQueryClient()

    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const triggerResize = (width: number) => {
    mocks.resizeWidth = width

    if (!mocks.resizeCallback || !mocks.resizeTarget) return

    act(() => {
        mocks.resizeCallback?.(
            [
                {
                    target: mocks.resizeTarget as Element,
                    contentRect: {
                        width,
                        height: 0,
                        x: 0,
                        y: 0,
                        top: 0,
                        right: width,
                        bottom: 0,
                        left: 0,
                        toJSON: () => ({})
                    } as DOMRectReadOnly
                } as ResizeObserverEntry
            ],
            {} as ResizeObserver
        )
    })
}

describe('EntityModulesTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(createVisibleDomRect)
        mocks.useMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: true } },
            isLoading: false
        })
        mocks.list.mockResolvedValue([])
        mocks.create.mockResolvedValue(createModuleRecord())
        mocks.update.mockResolvedValue(createModuleRecord())
        mocks.remove.mockResolvedValue(undefined)
        mocks.lastCodeMirrorProps = null
        mocks.resizeWidth = 640
        mocks.resizeCallback = null
        mocks.resizeTarget = null
    })

    it('blocks module authoring until a non-metahub entity has been saved', () => {
        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId={null} t={translate} />)

        expect(screen.getByText('Save this entity first, then modules can be attached from this tab.')).toBeInTheDocument()
        expect(mocks.list).not.toHaveBeenCalled()
    })

    it('shows validation feedback before creating an incomplete module draft', async () => {
        const user = userEvent.setup()

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(mocks.list).toHaveBeenCalledWith('metahub-1', { attachedToKind: 'object', attachedToId: 'object-1' }))
        await user.click(screen.getByRole('button', { name: 'Create module' }))

        expect(screen.getByText('Codename, name, and source code are required')).toBeInTheDocument()
        expect(mocks.create).not.toHaveBeenCalled()
    })

    it('hides modules authoring when the user lacks manage permission for the metahub', () => {
        mocks.useMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: false } },
            isLoading: false
        })

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='general' attachedToId={null} t={translate} />)

        expect(screen.getByText('You do not have permission to manage modules for this metahub.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Create module' })).not.toBeInTheDocument()
        expect(mocks.list).not.toHaveBeenCalled()
    })

    it('swaps to the widget template and submits a create payload for new widget modules', async () => {
        const user = userEvent.setup()

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(mocks.list).toHaveBeenCalled())
        await waitFor(() => expect(screen.queryByText('Loading attached modules...')).not.toBeInTheDocument())
        await user.click(screen.getAllByRole('combobox')[0])
        await user.click(screen.getByRole('option', { name: 'Widget' }))

        await waitFor(() => {
            expect(String((screen.getByTestId('module-source-editor') as HTMLTextAreaElement).value)).toContain('SpaceQuizWidget')
        })

        expect(screen.getByText('Authoring guidance')).toBeInTheDocument()
        expect(screen.getByText(/Effective capabilities for this role:/)).toHaveTextContent(
            'Read metadata, Call server methods from client code'
        )

        await user.type(screen.getByLabelText('Name'), 'Runtime quiz widget')
        await user.type(screen.getByLabelText('Codename'), 'runtime-quiz-widget')
        await user.click(screen.getByRole('button', { name: 'Create module' }))

        await waitFor(() => {
            expect(mocks.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    attachedToKind: 'object',
                    attachedToId: 'object-1',
                    moduleRole: 'widget',
                    capabilities: expect.arrayContaining(['metadata.read', 'rpc.client']),
                    codename: 'runtime-quiz-widget',
                    name: 'Runtime quiz widget'
                })
            )
        })
    })

    it('submits update payloads for existing attached modules', async () => {
        const user = userEvent.setup()
        const existing = createModuleRecord()
        const updated = createModuleRecord({
            presentation: {
                ...existing.presentation,
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Updated quiz widget' }
                    }
                }
            }
        })

        mocks.list.mockResolvedValue([existing])
        mocks.update.mockResolvedValue(updated)

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.clear(screen.getByLabelText('Name'))
        await user.type(screen.getByLabelText('Name'), 'Updated quiz widget')
        await user.click(screen.getByRole('button', { name: 'Save module' }))

        await waitFor(() => {
            expect(mocks.update).toHaveBeenCalledWith(
                'metahub-1',
                'module-1',
                expect.objectContaining({
                    codename: 'quiz-widget',
                    name: 'Updated quiz widget',
                    attachedToKind: 'object',
                    attachedToId: 'object-1',
                    moduleRole: 'module'
                })
            )
        })
    })

    it('renders posting and ledger capability labels through the shared i18n map', async () => {
        mocks.list.mockResolvedValue([
            createModuleRecord({
                manifest: {
                    className: 'PostingModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: ['posting', 'ledger.read', 'ledger.write'],
                    methods: []
                }
            })
        ])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByText('Run posting handlers')).toBeInTheDocument())
        expect(screen.getByText('Read ledgers')).toBeInTheDocument()
        expect(screen.getByText('Write ledgers')).toBeInTheDocument()
        expect(screen.queryByText('posting')).not.toBeInTheDocument()
        expect(screen.queryByText('ledger.read')).not.toBeInTheDocument()
        expect(screen.queryByText('ledger.write')).not.toBeInTheDocument()
    })

    it('submits delete requests for existing modules and refetches the list', async () => {
        const user = userEvent.setup()

        mocks.list.mockResolvedValueOnce([createModuleRecord()]).mockResolvedValueOnce([])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.click(screen.getByRole('button', { name: 'Delete' }))

        await waitFor(() => {
            expect(mocks.remove).toHaveBeenCalledWith('metahub-1', 'module-1')
        })
        await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
    })

    it('maps backend delete conflict details to a localized module message', async () => {
        const user = userEvent.setup()

        mocks.list.mockResolvedValue([createModuleRecord()])
        mocks.remove.mockRejectedValue({
            isAxiosError: true,
            message: 'Request failed with status code 409',
            response: {
                data: {
                    message: 'Shared library is still imported by other modules'
                }
            }
        })

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.click(screen.getByRole('button', { name: 'Delete' }))

        await waitFor(() => expect(screen.getByText('This shared library is used by other modules.')).toBeInTheDocument())
    })

    it('switches to a compact layout based on the actual container width', async () => {
        mocks.list.mockResolvedValue([createModuleRecord()])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByTestId('entity-modules-layout')).toHaveAttribute('data-layout-mode', 'compact'))
        await waitFor(() => expect(screen.getByText('Selected: Quiz widget')).toBeInTheDocument())
        expect(screen.getByTestId('entity-modules-list-toggle')).toBeInTheDocument()
        expect(screen.getByTestId('entity-modules-editor-shell')).toBeInTheDocument()
    })

    it('returns to split layout when the dialog becomes wide enough', async () => {
        mocks.list.mockResolvedValue([createModuleRecord()])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByTestId('entity-modules-layout')).toHaveAttribute('data-layout-mode', 'compact'))

        triggerResize(1040)

        await waitFor(() => expect(screen.getByTestId('entity-modules-layout')).toHaveAttribute('data-layout-mode', 'split'))
        expect(screen.queryByTestId('entity-modules-list-toggle')).not.toBeInTheDocument()
    })

    it('locks the Common modules tab to the library role and loads shared libraries through the general attachment context', async () => {
        mocks.list.mockResolvedValue([
            createModuleRecord({
                attachedToKind: 'general',
                attachedToId: null,
                moduleRole: 'library',
                manifest: {
                    className: 'ExampleSharedLibrary',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'library',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: []
                },
                sourceCode:
                    "import { SharedLibraryModule } from '@universo/extension-sdk'\n\nexport default class ExampleSharedLibrary extends SharedLibraryModule {}"
            })
        ])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='general' attachedToId={null} t={translate} />)

        await waitFor(() => expect(mocks.list).toHaveBeenCalledWith('metahub-1', { attachedToKind: 'general', attachedToId: null }))
        expect(screen.getByDisplayValue('library')).toBeDisabled()
        expect(screen.getByText(/Start typing SharedLibraryModule or @shared\/example-helpers/)).toBeInTheDocument()
    })
})
