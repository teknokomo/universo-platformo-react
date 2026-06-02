import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
                readOnly={props.editable === false}
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
                    storageMode: 'inline',
                    sourcePath: null,
                    capabilities: expect.arrayContaining(['metadata.read', 'rpc.client']),
                    codename: 'runtime-quiz-widget',
                    name: 'Runtime quiz widget'
                })
            )
        })
    })

    it('submits the initial source when creating a new file-backed module from the editor', async () => {
        const user = userEvent.setup()

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(mocks.list).toHaveBeenCalled())
        await user.click(screen.getAllByRole('combobox')[2])
        await user.click(screen.getByRole('option', { name: 'File-backed' }))
        expect(screen.getByText(/This source will be written/)).toBeInTheDocument()
        expect(mocks.lastCodeMirrorProps?.editable).toBe(true)
        fireEvent.change(screen.getByTestId('module-source-editor'), {
            target: { value: 'export default class RuntimeQuizWidget {}' }
        })
        await user.type(screen.getByLabelText('Name'), 'Runtime quiz widget')
        await user.type(screen.getByLabelText('Codename'), 'runtime-quiz-widget')
        await user.clear(screen.getByLabelText('Source path'))
        await user.type(screen.getByLabelText('Source path'), 'modules/attached/object/runtime-quiz-widget.ts')
        await user.click(screen.getByRole('button', { name: 'Create module' }))

        await waitFor(() => {
            expect(mocks.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    codename: 'runtime-quiz-widget',
                    name: 'Runtime quiz widget',
                    storageMode: 'file',
                    sourcePath: 'modules/attached/object/runtime-quiz-widget.ts',
                    sourceCode: 'export default class RuntimeQuizWidget {}'
                })
            )
        })
    })

    it('omits source code when creating a file-backed module from an existing external file', async () => {
        const user = userEvent.setup()

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(mocks.list).toHaveBeenCalled())
        await user.click(screen.getAllByRole('combobox')[2])
        await user.click(screen.getByRole('option', { name: 'File-backed' }))
        await user.click(screen.getByLabelText('Create or update the source file from the editor'))
        await user.type(screen.getByLabelText('Name'), 'Existing quiz widget')
        await user.type(screen.getByLabelText('Codename'), 'existing-quiz-widget')
        await user.clear(screen.getByLabelText('Source path'))
        await user.type(screen.getByLabelText('Source path'), 'modules/attached/object/existing-quiz-widget.ts')
        await user.click(screen.getByRole('button', { name: 'Create module' }))

        await waitFor(() => {
            expect(mocks.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    codename: 'existing-quiz-widget',
                    name: 'Existing quiz widget',
                    storageMode: 'file',
                    sourcePath: 'modules/attached/object/existing-quiz-widget.ts'
                })
            )
            expect(mocks.create.mock.calls.at(-1)?.[1]).not.toHaveProperty('sourceCode')
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
                    moduleRole: 'module',
                    storageMode: 'inline',
                    sourcePath: null
                })
            )
            expect(mocks.update.mock.calls.at(-1)?.[2]).toEqual(expect.objectContaining({ expectedVersion: 1 }))
        })
    })

    it('submits source code when converting an existing inline module to file-backed storage', async () => {
        const user = userEvent.setup()
        const existing = createModuleRecord({
            storageMode: 'inline',
            sourcePath: null,
            sourceStorage: {
                mode: 'inline',
                path: null,
                checksum: null,
                status: 'inline'
            }
        })

        mocks.list.mockResolvedValue([existing])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.click(screen.getAllByRole('combobox')[2])
        await user.click(screen.getByRole('option', { name: 'File-backed' }))
        await user.type(screen.getByLabelText('Source path'), 'modules/attached/object/quiz-widget.ts')
        await user.click(screen.getByRole('button', { name: 'Save module' }))

        await waitFor(() => {
            expect(mocks.update).toHaveBeenCalledWith(
                'metahub-1',
                'module-1',
                expect.objectContaining({
                    storageMode: 'file',
                    sourcePath: 'modules/attached/object/quiz-widget.ts',
                    sourceCode: expect.stringContaining('ExtensionModule'),
                    expectedVersion: 1
                })
            )
        })
    })

    it('submits hydrated source code when converting an existing file-backed module to inline storage', async () => {
        const user = userEvent.setup()
        const hydratedSource = 'export default class HydratedFileModule extends ExtensionModule {}'
        mocks.list.mockResolvedValue([
            createModuleRecord({
                storageMode: 'file',
                sourcePath: 'modules/attached/object/quiz-widget.ts',
                sourceCode: hydratedSource,
                sourceStorage: {
                    mode: 'file',
                    path: 'modules/attached/object/quiz-widget.ts',
                    checksum: 'source-checksum',
                    status: 'ready'
                }
            })
        ])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.click(screen.getAllByRole('combobox')[2])
        await user.click(screen.getByRole('option', { name: 'Inline' }))
        await user.click(screen.getByRole('button', { name: 'Save module' }))

        await waitFor(() => {
            expect(mocks.update).toHaveBeenCalledWith(
                'metahub-1',
                'module-1',
                expect.objectContaining({
                    storageMode: 'inline',
                    sourcePath: null,
                    sourceCode: hydratedSource,
                    expectedVersion: 1,
                    expectedSourceChecksum: 'source-checksum'
                })
            )
        })
    })

    it('initializes file-backed modules and submits the relative source path', async () => {
        const user = userEvent.setup()

        mocks.list.mockResolvedValue([
            createModuleRecord({
                storageMode: 'file',
                sourcePath: 'modules/attached/object/quiz-widget.ts',
                sourceChecksum: 'source-checksum',
                sourceStatus: 'ready',
                sourceLastReadAt: '2026-06-01T10:00:00.000Z',
                sourceLastCompileAt: '2026-06-01T10:01:00.000Z',
                sourceLastCompileStatus: 'success',
                sourceStorage: {
                    mode: 'file',
                    path: 'modules/attached/object/quiz-widget.ts',
                    checksum: null,
                    status: 'ready',
                    lastReadAt: '2026-06-01T10:00:00.000Z',
                    lastCompileAt: '2026-06-01T10:01:00.000Z',
                    lastCompileStatus: 'success'
                }
            })
        ])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Source path')).toHaveValue('modules/attached/object/quiz-widget.ts'))
        expect(screen.getByDisplayValue('file')).toBeInTheDocument()
        expect(screen.getByText(/File-backed source is shown as a live preview/)).toBeInTheDocument()
        expect(screen.getByTestId('entity-module-source-metadata')).toHaveTextContent('Source status: Ready')
        expect(screen.getByTestId('entity-module-source-metadata')).toHaveTextContent('Source checksum: source-check...')
        expect(screen.getByTestId('entity-module-source-metadata')).toHaveTextContent('Last compile: Compiled')
        expect(screen.getByTestId('module-source-editor')).toHaveAttribute('readonly')
        expect(mocks.lastCodeMirrorProps?.editable).toBe(false)

        await user.clear(screen.getByLabelText('Source path'))
        await user.type(screen.getByLabelText('Source path'), 'modules/attached/object/quiz-widget-v2.ts')
        await user.click(screen.getByRole('button', { name: 'Save module' }))

        await waitFor(() => {
            expect(mocks.update).toHaveBeenCalledWith(
                'metahub-1',
                'module-1',
                expect.objectContaining({
                    storageMode: 'file',
                    sourcePath: 'modules/attached/object/quiz-widget-v2.ts',
                    expectedVersion: 1,
                    expectedSourceChecksum: 'source-checksum'
                })
            )
            expect(mocks.update.mock.calls.at(-1)?.[2]).not.toHaveProperty('sourceCode')
        })
    })

    it('refreshes file-backed module guards before saving metadata so external edits can be recompiled safely', async () => {
        const user = userEvent.setup()
        const staleModule = createModuleRecord({
            storageMode: 'file',
            sourcePath: 'modules/attached/object/quiz-widget.ts',
            sourceChecksum: 'old-source-checksum',
            sourceStorage: {
                mode: 'file',
                path: 'modules/attached/object/quiz-widget.ts',
                checksum: 'old-source-checksum',
                status: 'ready'
            }
        })
        const refreshedModule = createModuleRecord({
            storageMode: 'file',
            sourcePath: 'modules/attached/object/quiz-widget.ts',
            sourceChecksum: 'new-source-checksum',
            sourceStorage: {
                mode: 'file',
                path: 'modules/attached/object/quiz-widget.ts',
                checksum: 'new-source-checksum',
                status: 'modified'
            }
        })

        mocks.list.mockResolvedValueOnce([staleModule]).mockResolvedValueOnce([refreshedModule])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.click(screen.getByRole('button', { name: 'Save module' }))

        await waitFor(() => {
            expect(mocks.update).toHaveBeenCalledWith(
                'metahub-1',
                'module-1',
                expect.objectContaining({
                    expectedVersion: 1,
                    expectedSourceChecksum: 'new-source-checksum'
                })
            )
        })
    })

    it('shows the absolute source file path for existing file-backed modules', async () => {
        mocks.list.mockResolvedValue([
            createModuleRecord({
                storageMode: 'file',
                sourcePath: 'modules/attached/object/quiz-widget.ts',
                sourceChecksum: 'source-checksum',
                sourceStatus: 'ready',
                sourceStorage: {
                    mode: 'file',
                    path: 'modules/attached/object/quiz-widget.ts',
                    absolutePath: '/repo/storage/metahubs/metahub-1/branches/main/modules/attached/object/quiz-widget.ts',
                    checksum: 'source-checksum',
                    status: 'ready'
                }
            })
        ])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await expect(screen.findByText(/Source file:/)).resolves.toBeVisible()
        expect(screen.getByText(/\/repo\/storage\/metahubs\/metahub-1/)).toBeInTheDocument()
    })

    it('blocks stale file-backed saves when the preflight module version changed', async () => {
        const user = userEvent.setup()
        const staleModule = createModuleRecord({
            version: 1,
            storageMode: 'file',
            sourcePath: 'modules/attached/object/quiz-widget.ts',
            sourceChecksum: 'old-source-checksum',
            sourceStorage: {
                mode: 'file',
                path: 'modules/attached/object/quiz-widget.ts',
                checksum: 'old-source-checksum',
                status: 'ready'
            }
        })
        const concurrentlySavedModule = createModuleRecord({
            version: 2,
            storageMode: 'file',
            sourcePath: 'modules/attached/object/quiz-widget.ts',
            sourceChecksum: 'new-source-checksum',
            sourceStorage: {
                mode: 'file',
                path: 'modules/attached/object/quiz-widget.ts',
                checksum: 'new-source-checksum',
                status: 'modified'
            }
        })

        mocks.list.mockResolvedValueOnce([staleModule]).mockResolvedValueOnce([concurrentlySavedModule])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.click(screen.getByRole('button', { name: 'Save module' }))

        await expect(screen.findByText('This module was changed by another user. Reload the module before saving.')).resolves.toBeVisible()
        expect(mocks.update).not.toHaveBeenCalled()
    })

    it('sends the current file checksum when converting inline source to a file-backed overwrite', async () => {
        const user = userEvent.setup()
        mocks.list.mockResolvedValue([
            createModuleRecord({
                storageMode: 'inline',
                sourceStorage: {
                    mode: 'inline',
                    path: null,
                    checksum: 'current-source-checksum',
                    status: 'inline'
                }
            })
        ])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.click(screen.getAllByRole('combobox')[2])
        await user.click(screen.getByRole('option', { name: 'File-backed' }))
        await user.clear(screen.getByLabelText('Source path'))
        await user.type(screen.getByLabelText('Source path'), 'modules/attached/object/quiz-widget.ts')
        await user.click(screen.getByRole('button', { name: 'Save module' }))

        await waitFor(() => {
            expect(mocks.update).toHaveBeenCalledWith(
                'metahub-1',
                'module-1',
                expect.objectContaining({
                    expectedVersion: 1,
                    expectedSourceChecksum: 'current-source-checksum'
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

        mocks.list
            .mockResolvedValueOnce([
                createModuleRecord({
                    storageMode: 'file',
                    sourceChecksum: 'source-checksum',
                    sourceStorage: {
                        mode: 'file',
                        path: 'modules/attached/object/quiz-widget.ts',
                        checksum: null,
                        status: 'ready'
                    }
                })
            ])
            .mockResolvedValueOnce([])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.click(screen.getByRole('button', { name: 'Delete' }))
        expect(screen.getByRole('dialog', { name: 'Delete module?' })).toBeInTheDocument()
        expect(mocks.remove).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: 'Delete module' }))

        await waitFor(() => {
            expect(mocks.remove).toHaveBeenCalledWith('metahub-1', 'module-1', 1, 'source-checksum')
        })
        await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
    })

    it('cancels module deletion without calling the API', async () => {
        const user = userEvent.setup()

        mocks.list.mockResolvedValue([createModuleRecord()])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='object' attachedToId='object-1' t={translate} />)

        await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Quiz widget'))
        await user.click(screen.getByRole('button', { name: 'Delete' }))
        expect(screen.getByRole('dialog', { name: 'Delete module?' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Cancel' }))

        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete module?' })).not.toBeInTheDocument())
        expect(mocks.remove).not.toHaveBeenCalled()
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
        await user.click(screen.getByRole('button', { name: 'Delete module' }))

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
                    "import { SharedLibraryModule } from '@universo-react/extension-sdk'\n\nexport default class ExampleSharedLibrary extends SharedLibraryModule {}"
            })
        ])

        renderTab(<EntityModulesTab metahubId='metahub-1' attachedToKind='general' attachedToId={null} t={translate} />)

        await waitFor(() => expect(mocks.list).toHaveBeenCalledWith('metahub-1', { attachedToKind: 'general', attachedToId: null }))
        expect(screen.getByDisplayValue('library')).toBeDisabled()
        expect(screen.getByText(/Start typing SharedLibraryModule or @shared\/example-helpers/)).toBeInTheDocument()
    })
})
