import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EntityScriptsTab } from '../EntityScriptsTab'

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
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
                aria-label='Script source code'
                data-testid='script-source-editor'
                value={String(props.value ?? '')}
                onChange={(event) => props.onChange?.(event.target.value)}
            />
        )
    }
}))

vi.mock('../../api/scriptsApi', () => ({
    scriptsApi: {
        list: mocks.list,
        create: mocks.create,
        update: mocks.update,
        remove: mocks.remove
    }
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
    }) as DOMRect

const createScriptRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'script-1',
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
    attachedToKind: 'catalog',
    attachedToId: 'catalog-1',
    moduleRole: 'module',
    sourceKind: 'embedded',
    sdkApiVersion: '1.0.0',
    sourceCode: 'export default class ExampleScript extends ExtensionScript {}',
    manifest: {
        className: 'ExampleScript',
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

describe('EntityScriptsTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(createVisibleDomRect)
        mocks.list.mockResolvedValue([])
        mocks.create.mockResolvedValue(createScriptRecord())
        mocks.update.mockResolvedValue(createScriptRecord())
        mocks.remove.mockResolvedValue(undefined)
        mocks.lastCodeMirrorProps = null
        mocks.resizeWidth = 640
        mocks.resizeCallback = null
        mocks.resizeTarget = null
    })

    it('blocks script authoring until a non-metahub entity has been saved', () => {
        renderTab(<EntityScriptsTab metahubId='metahub-1' attachedToKind='catalog' attachedToId={null} t={translate} />)

        expect(screen.getByText('Save this entity first, then scripts can be attached from this tab.')).toBeInTheDocument()
        expect(mocks.list).not.toHaveBeenCalled()
    })

    it('shows validation feedback before creating an incomplete script draft', async () => {
        const user = userEvent.setup()

        renderTab(<EntityScriptsTab metahubId='metahub-1' attachedToKind='catalog' attachedToId='catalog-1' t={translate} />)

        await waitFor(() => expect(mocks.list).toHaveBeenCalledWith('metahub-1', { attachedToKind: 'catalog', attachedToId: 'catalog-1' }))
        await user.click(screen.getByRole('button', { name: 'Create script' }))

        expect(screen.getByText('Codename, name, and source code are required')).toBeInTheDocument()
        expect(mocks.create).not.toHaveBeenCalled()
    })

    it('swaps to the widget template and submits a create payload for new widget scripts', async () => {
        const user = userEvent.setup()

        renderTab(<EntityScriptsTab metahubId='metahub-1' attachedToKind='catalog' attachedToId='catalog-1' t={translate} />)

        await waitFor(() => expect(mocks.list).toHaveBeenCalled())
        await waitFor(() => expect(screen.queryByText('Loading attached scripts...')).not.toBeInTheDocument())
    await user.click(screen.getAllByRole('combobox')[0])
        await user.click(screen.getByRole('option', { name: 'Widget' }))

        await waitFor(() => {
            expect(String((screen.getByTestId('script-source-editor') as HTMLTextAreaElement).value)).toContain('SpaceQuizWidget')
        })

        expect(screen.getByText('Authoring guidance')).toBeInTheDocument()
        expect(screen.getByText(/Effective capabilities for this role:/)).toHaveTextContent(
            'Read metadata, Call server methods from client code'
        )

        await user.type(screen.getByLabelText('Name'), 'Runtime quiz widget')
        await user.type(screen.getByLabelText('Codename'), 'runtime-quiz-widget')
        await user.click(screen.getByRole('button', { name: 'Create script' }))

        await waitFor(() => {
            expect(mocks.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    attachedToKind: 'catalog',
                    attachedToId: 'catalog-1',
                    moduleRole: 'widget',
                    capabilities: expect.arrayContaining(['metadata.read', 'rpc.client']),
                    codename: 'runtime-quiz-widget',
                    name: 'Runtime quiz widget'
                })
            )
        })
    })

    it('submits update payloads for existing attached scripts', async () => {
        const user = userEvent.setup()
        const existing = createScriptRecord()
        const updated = createScriptRecord({
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

        renderTab(<EntityScriptsTab metahubId='metahub-1' attachedToKind='catalog' attachedToId='catalog-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.clear(screen.getByLabelText('Name'))
        await user.type(screen.getByLabelText('Name'), 'Updated quiz widget')
        await user.click(screen.getByRole('button', { name: 'Save script' }))

        await waitFor(() => {
            expect(mocks.update).toHaveBeenCalledWith(
                'metahub-1',
                'script-1',
                expect.objectContaining({
                    codename: 'quiz-widget',
                    name: 'Updated quiz widget',
                    attachedToKind: 'catalog',
                    attachedToId: 'catalog-1',
                    moduleRole: 'module'
                })
            )
        })
    })

    it('submits delete requests for existing scripts and refetches the list', async () => {
        const user = userEvent.setup()

        mocks.list.mockResolvedValueOnce([createScriptRecord()]).mockResolvedValueOnce([])

        renderTab(<EntityScriptsTab metahubId='metahub-1' attachedToKind='catalog' attachedToId='catalog-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.click(screen.getByRole('button', { name: 'Delete' }))

        await waitFor(() => {
            expect(mocks.remove).toHaveBeenCalledWith('metahub-1', 'script-1')
        })
        await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
    })

    it('switches to a compact layout based on the actual container width', async () => {
        mocks.list.mockResolvedValue([createScriptRecord()])

        renderTab(<EntityScriptsTab metahubId='metahub-1' attachedToKind='catalog' attachedToId='catalog-1' t={translate} />)

        await waitFor(() => expect(screen.getByTestId('entity-scripts-layout')).toHaveAttribute('data-layout-mode', 'compact'))
        await waitFor(() => expect(screen.getByText('Selected: Quiz widget')).toBeInTheDocument())
        expect(screen.getByTestId('entity-scripts-list-toggle')).toBeInTheDocument()
        expect(screen.getByTestId('entity-scripts-editor-shell')).toBeInTheDocument()
    })

    it('returns to split layout when the dialog becomes wide enough', async () => {
        mocks.list.mockResolvedValue([createScriptRecord()])

        renderTab(<EntityScriptsTab metahubId='metahub-1' attachedToKind='catalog' attachedToId='catalog-1' t={translate} />)

        await waitFor(() => expect(screen.getByTestId('entity-scripts-layout')).toHaveAttribute('data-layout-mode', 'compact'))

        triggerResize(1040)

        await waitFor(() => expect(screen.getByTestId('entity-scripts-layout')).toHaveAttribute('data-layout-mode', 'split'))
        expect(screen.queryByTestId('entity-scripts-list-toggle')).not.toBeInTheDocument()
    })
})
