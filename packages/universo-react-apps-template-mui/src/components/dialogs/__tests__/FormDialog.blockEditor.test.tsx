import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultDashboardLayoutConfig, type PageBlockContent } from '@universo-react/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@universo-react/i18n'
import { FormDialog, type FieldConfig } from '../FormDialog'
import '../../../i18n'

const editorMocks = vi.hoisted(() => ({
    capturedAllowedBlockTypes: undefined as readonly string[] | undefined,
    capturedMaxBlocks: undefined as number | null | undefined,
    capturedValue: undefined as PageBlockContent | undefined
}))

vi.mock('@universo-react/block-editor', () => ({
    EditorJsBlockEditor: ({
        value,
        allowedBlockTypes,
        maxBlocks,
        onChange,
        onValidationError
    }: {
        value: PageBlockContent
        allowedBlockTypes?: readonly string[]
        maxBlocks?: number | null
        onChange: (nextValue: PageBlockContent) => void
        onValidationError?: (message: string | null) => void
    }) => {
        editorMocks.capturedAllowedBlockTypes = allowedBlockTypes
        editorMocks.capturedMaxBlocks = maxBlocks
        editorMocks.capturedValue = value

        return (
            <button
                data-testid='editorjs-block-editor'
                type='button'
                onClick={() => {
                    onValidationError?.(null)
                    onChange({
                        format: 'editorjs',
                        version: '1',
                        data: {
                            blocks: [
                                {
                                    id: 'intro',
                                    type: 'paragraph',
                                    data: {
                                        text: 'Runtime lesson content'
                                    }
                                }
                            ]
                        }
                    })
                }}
            >
                block editor
            </button>
        )
    }
}))

describe('FormDialog block editor fields', () => {
    beforeEach(() => {
        editorMocks.capturedAllowedBlockTypes = undefined
        editorMocks.capturedMaxBlocks = undefined
        editorMocks.capturedValue = undefined
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        void i18n.changeLanguage('en')
    })

    it('renders metadata-driven Editor.js JSON fields and submits normalized block content', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'content',
                label: 'Content',
                type: 'JSON',
                required: true,
                uiConfig: {
                    widget: 'editorjsBlockContent',
                    blockEditor: {
                        allowedBlockTypes: ['paragraph', 'header'],
                        maxBlocks: 3
                    }
                }
            }
        ]

        render(<FormDialog open title='Create content' fields={fields} locale='en' onClose={vi.fn()} onSubmit={onSubmit} />)

        const user = userEvent.setup()
        await user.click(screen.getByTestId('editorjs-block-editor'))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(editorMocks.capturedAllowedBlockTypes).toEqual(['paragraph', 'header'])
        expect(editorMocks.capturedMaxBlocks).toBe(3)
        expect(onSubmit).toHaveBeenCalledWith({
            content: expect.objectContaining({
                format: 'editorjs',
                data: expect.objectContaining({
                    blocks: [expect.objectContaining({ id: 'intro', type: 'paragraph' })]
                })
            })
        })
    })

    it('renders metadata-driven runtime record pickers for polymorphic content links', async () => {
        const fetchMock = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        objectCollection: { id: 'pages-object', codename: 'Pages', tableName: null, name: 'Pages' },
                        sections: [],
                        objectCollections: [],
                        columns: [],
                        rows: [{ id: 'page-1', Title: 'Intro page' }],
                        pagination: { total: 1, limit: 100, offset: 0 },
                        permissions: {},
                        layoutConfig: defaultDashboardLayoutConfig
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
        )
        vi.stubGlobal('fetch', fetchMock)

        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'TargetObjectCodename',
                label: 'Target Object',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'select',
                    stringOptions: [{ value: 'Pages', label: 'Pages' }]
                }
            },
            {
                id: 'TargetRecordId',
                label: 'Target Record',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'runtimeRecordPicker',
                    runtimeRecordPicker: {
                        targetObjectCodenameField: 'TargetObjectCodename',
                        allowedObjectCodenames: ['Pages'],
                        labelFields: ['Title'],
                        limit: 100
                    }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Create course item'
                fields={fields}
                locale='en'
                initialData={{ TargetObjectCodename: 'Pages' }}
                onClose={vi.fn()}
                onSubmit={onSubmit}
                apiBaseUrl='/api/v1'
                applicationId='app-1'
                objectCollections={[{ id: 'pages-object', codename: 'Pages', name: 'Pages' }]}
                currentWorkspaceId='workspace-1'
            />
        )

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
        expect(requestedUrl.searchParams.get('objectCollectionId')).toBe('pages-object')
        expect(requestedUrl.searchParams.get('workspaceId')).toBe('workspace-1')

        const user = userEvent.setup()
        await user.click(screen.getByRole('combobox', { name: 'Target Record' }))
        await user.click(await screen.findByRole('option', { name: 'Intro page' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSubmit).toHaveBeenCalledWith({
            TargetObjectCodename: 'Pages',
            TargetRecordId: 'page-1'
        })
    })

    it('does not expose raw unavailable runtime record picker IDs', async () => {
        const rawRecordId = '019e44fc-a16a-760c-8190-280c4d9dc720'
        const fetchMock = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        objectCollection: { id: 'pages-object', codename: 'Pages', tableName: null, name: 'Pages' },
                        sections: [],
                        objectCollections: [],
                        columns: [],
                        rows: [],
                        pagination: { total: 0, limit: 100, offset: 0 },
                        permissions: {},
                        layoutConfig: defaultDashboardLayoutConfig
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
        )
        vi.stubGlobal('fetch', fetchMock)

        const fields: FieldConfig[] = [
            {
                id: 'TargetObjectCodename',
                label: 'Target Object',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'select',
                    stringOptions: [{ value: 'Pages', label: 'Pages' }]
                }
            },
            {
                id: 'TargetRecordId',
                label: 'Target Record',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'runtimeRecordPicker',
                    runtimeRecordPicker: {
                        targetObjectCodenameField: 'TargetObjectCodename',
                        allowedObjectCodenames: ['Pages'],
                        labelFields: ['Title'],
                        limit: 100
                    }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Edit course item'
                fields={fields}
                locale='en'
                initialData={{ TargetObjectCodename: 'Pages', TargetRecordId: rawRecordId }}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
                apiBaseUrl='/api/v1'
                applicationId='app-1'
                objectCollections={[{ id: 'pages-object', codename: 'Pages', name: 'Pages' }]}
                currentWorkspaceId='workspace-1'
            />
        )

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

        const user = userEvent.setup()
        await user.click(screen.getByRole('combobox', { name: 'Target Record' }))

        expect(screen.getByRole('option', { name: 'Selected record is unavailable.' })).toBeInTheDocument()
        expect(screen.queryByText(rawRecordId)).not.toBeInTheDocument()
    })

    it('does not expose raw runtime record picker option IDs when labels are missing', async () => {
        const rawRecordId = '019e44fc-a16a-760c-8190-280c4d9dc722'
        const fetchMock = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        objectCollection: { id: 'pages-object', codename: 'Pages', tableName: null, name: 'Pages' },
                        sections: [],
                        objectCollections: [],
                        columns: [],
                        rows: [{ id: rawRecordId }],
                        pagination: { total: 1, limit: 100, offset: 0 },
                        permissions: {},
                        layoutConfig: defaultDashboardLayoutConfig
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
        )
        vi.stubGlobal('fetch', fetchMock)

        const fields: FieldConfig[] = [
            {
                id: 'TargetObjectCodename',
                label: 'Target Object',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'select',
                    stringOptions: [{ value: 'Pages', label: 'Pages' }]
                }
            },
            {
                id: 'TargetRecordId',
                label: 'Target Record',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'runtimeRecordPicker',
                    runtimeRecordPicker: {
                        targetObjectCodenameField: 'TargetObjectCodename',
                        allowedObjectCodenames: ['Pages'],
                        labelFields: ['Title', 'Name'],
                        limit: 100
                    }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Create course item'
                fields={fields}
                locale='en'
                initialData={{ TargetObjectCodename: 'Pages' }}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
                apiBaseUrl='/api/v1'
                applicationId='app-1'
                objectCollections={[{ id: 'pages-object', codename: 'Pages', name: 'Pages' }]}
                currentWorkspaceId='workspace-1'
            />
        )

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

        const user = userEvent.setup()
        await user.click(screen.getByRole('combobox', { name: 'Target Record' }))

        expect(screen.getByRole('option', { name: 'Untitled record' })).toBeInTheDocument()
        expect(screen.queryByText(rawRecordId)).not.toBeInTheDocument()
    })

    it('does not render unconfigured generic reference fields as editable raw ID inputs', () => {
        const rawProjectId = '019e44fc-a16a-760c-8190-280c4d9dc720'
        const fields: FieldConfig[] = [
            {
                id: 'ProjectId',
                label: 'Project',
                type: 'REF'
            }
        ]

        render(
            <FormDialog
                open
                title='Edit item'
                fields={fields}
                locale='en'
                initialData={{ ProjectId: rawProjectId }}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />
        )

        const projectField = screen.getByRole('textbox', { name: 'Project' })

        expect(projectField).toBeDisabled()
        expect(projectField).toHaveValue('Selected reference is unavailable.')
        expect(screen.queryByText(rawProjectId)).not.toBeInTheDocument()
    })

    it('sanitizes runtime record picker load failures before rendering helper text', async () => {
        const rawRecordId = '019e44fc-a16a-760c-8190-280c4d9dc721'
        const fetchMock = vi.fn(async () => {
            return new Response(JSON.stringify({ error: `SQL relation app_runtime.pages does not exist for ${rawRecordId}` }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        const fields: FieldConfig[] = [
            {
                id: 'TargetObjectCodename',
                label: 'Target Object',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'select',
                    stringOptions: [{ value: 'Pages', label: 'Pages' }]
                }
            },
            {
                id: 'TargetRecordId',
                label: 'Target Record',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'runtimeRecordPicker',
                    runtimeRecordPicker: {
                        targetObjectCodenameField: 'TargetObjectCodename',
                        allowedObjectCodenames: ['Pages'],
                        labelFields: ['Title'],
                        limit: 100
                    }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Edit item'
                fields={fields}
                locale='en'
                initialData={{ TargetObjectCodename: 'Pages' }}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
                apiBaseUrl='/api/v1'
                applicationId='app-1'
                objectCollections={[{ id: 'pages-object', codename: 'Pages', name: 'Pages' }]}
                currentWorkspaceId='workspace-1'
            />
        )

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

        expect(screen.getByText('Unable to load records.')).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent('SQL relation')
        expect(document.body).not.toHaveTextContent('app_runtime.pages')
        expect(document.body).not.toHaveTextContent(rawRecordId)
    })

    it('uses the localized runtime record picker load fallback for unsafe Russian errors', async () => {
        await i18n.changeLanguage('ru')
        const rawRecordId = '019e44fc-a16a-760c-8190-280c4d9dc722'
        const fetchMock = vi.fn(async () => {
            return new Response(JSON.stringify({ error: `SQL relation app_runtime.pages does not exist for ${rawRecordId}` }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        const fields: FieldConfig[] = [
            {
                id: 'TargetObjectCodename',
                label: 'Целевой объект',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'select',
                    stringOptions: [{ value: 'Pages', label: 'Страницы' }]
                }
            },
            {
                id: 'TargetRecordId',
                label: 'Целевая запись',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'runtimeRecordPicker',
                    runtimeRecordPicker: {
                        targetObjectCodenameField: 'TargetObjectCodename',
                        allowedObjectCodenames: ['Pages'],
                        labelFields: ['Title'],
                        limit: 100
                    }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Редактировать элемент'
                fields={fields}
                locale='ru'
                initialData={{ TargetObjectCodename: 'Pages' }}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
                apiBaseUrl='/api/v1'
                applicationId='app-1'
                objectCollections={[{ id: 'pages-object', codename: 'Pages', name: 'Страницы' }]}
                currentWorkspaceId='workspace-1'
            />
        )

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

        expect(screen.getByText('Не удалось загрузить записи.')).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent('SQL relation')
        expect(document.body).not.toHaveTextContent('app_runtime.pages')
        expect(document.body).not.toHaveTextContent(rawRecordId)
    })

    it('clears runtime record picker values when the target object changes', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            const objectCollectionId = url.searchParams.get('objectCollectionId')
            return new Response(
                JSON.stringify({
                    objectCollection: { id: objectCollectionId, codename: objectCollectionId === 'quiz-object' ? 'Quizzes' : 'Pages' },
                    sections: [],
                    objectCollections: [],
                    columns: [],
                    rows:
                        objectCollectionId === 'quiz-object'
                            ? [{ id: 'quiz-1', Title: 'Intro quiz' }]
                            : [{ id: 'page-1', Title: 'Intro page' }],
                    pagination: { total: 1, limit: 100, offset: 0 },
                    permissions: {},
                    layoutConfig: defaultDashboardLayoutConfig
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'TargetObjectCodename',
                label: 'Target Object',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'select',
                    stringOptions: [
                        { value: 'Pages', label: 'Pages' },
                        { value: 'Quizzes', label: 'Quizzes' }
                    ]
                }
            },
            {
                id: 'TargetRecordId',
                label: 'Target Record',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'runtimeRecordPicker',
                    runtimeRecordPicker: {
                        targetObjectCodenameField: 'TargetObjectCodename',
                        allowedObjectCodenames: ['Pages', 'Quizzes'],
                        labelFields: ['Title'],
                        limit: 100
                    }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Edit course item'
                fields={fields}
                locale='en'
                initialData={{ TargetObjectCodename: 'Pages', TargetRecordId: 'page-1' }}
                onClose={vi.fn()}
                onSubmit={onSubmit}
                apiBaseUrl='/api/v1'
                applicationId='app-1'
                objectCollections={[
                    { id: 'pages-object', codename: 'Pages', name: 'Pages' },
                    { id: 'quiz-object', codename: 'Quizzes', name: 'Quizzes' }
                ]}
                currentWorkspaceId='workspace-1'
            />
        )

        await waitFor(() =>
            expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('objectCollectionId=pages-object'))).toBe(true)
        )

        const user = userEvent.setup()
        await user.click(screen.getByRole('combobox', { name: 'Target Object' }))
        await user.click(await screen.findByRole('option', { name: 'Quizzes' }))
        await waitFor(() =>
            expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('objectCollectionId=quiz-object'))).toBe(true)
        )

        expect(screen.getByTestId('entity-form-submit')).toBeDisabled()
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('parses persisted JSON strings before opening Editor.js edit fields', () => {
        const fields: FieldConfig[] = [
            {
                id: 'content',
                label: 'Content',
                type: 'JSON',
                uiConfig: {
                    widget: 'editorjsBlockContent',
                    blockEditor: {
                        allowedBlockTypes: ['paragraph']
                    }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Edit content'
                fields={fields}
                initialData={{
                    content: JSON.stringify({
                        format: 'editorjs',
                        data: {
                            blocks: [
                                {
                                    id: 'stored',
                                    type: 'paragraph',
                                    data: {
                                        text: 'Persisted lesson content'
                                    }
                                }
                            ]
                        }
                    })
                }}
                locale='en'
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />
        )

        expect(editorMocks.capturedValue).toEqual(
            expect.objectContaining({
                format: 'editorjs',
                data: expect.objectContaining({
                    blocks: [expect.objectContaining({ id: 'stored', type: 'paragraph' })]
                })
            })
        )
    })

    it('renders a visual resource source editor and submits a normalized safe URL', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'source',
                label: 'Source',
                type: 'JSON',
                required: true,
                uiConfig: {
                    widget: 'resourceSource'
                }
            }
        ]

        render(<FormDialog open title='Create resource' fields={fields} locale='en' onClose={vi.fn()} onSubmit={onSubmit} />)

        const user = userEvent.setup()
        const submit = screen.getByTestId('entity-form-submit')
        const urlField = screen.getByPlaceholderText('https://')

        expect(submit).toBeDisabled()
        fireEvent.change(urlField, { target: { value: 'javascript:alert(1)' } })
        expect(submit).toBeDisabled()
        expect(screen.getByText('Enter an absolute http or https URL.')).toBeVisible()
        expect(screen.queryByTestId('source-resource-source-domain-preview')).not.toBeInTheDocument()
        expect(screen.queryByTestId('resource-preview')).not.toBeInTheDocument()

        fireEvent.change(urlField, { target: { value: 'https://example.com/lesson' } })
        expect(screen.getByTestId('source-resource-source-domain-preview')).toHaveTextContent('Domain: example.com')
        expect(screen.getByTestId('resource-preview')).toBeInTheDocument()
        expect(submit).toBeEnabled()

        await user.click(submit)

        expect(onSubmit).toHaveBeenCalledWith({
            source: {
                type: 'url',
                url: 'https://example.com/lesson',
                launchMode: 'inline'
            }
        })
    })

    it('keeps optional resource source fields quiet until a source is entered', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'cover',
                label: 'Cover',
                type: 'JSON',
                uiConfig: {
                    widget: 'resourceSource'
                }
            },
            {
                id: 'title',
                label: 'Title',
                type: 'STRING',
                required: true
            }
        ]

        render(<FormDialog open title='Create project' fields={fields} locale='en' onClose={vi.fn()} onSubmit={onSubmit} />)

        const user = userEvent.setup()
        expect(screen.queryByTestId('resource-preview')).not.toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()

        await user.type(screen.getByRole('textbox', { name: /Title/i }), 'Project')
        await user.click(screen.getByTestId('entity-form-submit'))

        expect(onSubmit).toHaveBeenCalledWith({
            title: 'Project'
        })
    })

    it('applies resource-source type policy from runtime settings', async () => {
        const fields: FieldConfig[] = [
            {
                id: 'source',
                label: 'Source',
                type: 'JSON',
                required: true,
                uiConfig: {
                    widget: 'resourceSource'
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Create resource'
                fields={fields}
                locale='en'
                onClose={vi.fn()}
                onSubmit={vi.fn()}
                resourceSourceTypes={[
                    { resourceType: 'page', enabled: true, label: 'Page' },
                    { resourceType: 'url', enabled: true, label: 'Link' },
                    { resourceType: 'embed', enabled: true },
                    { resourceType: 'scorm', enabled: true, deferred: true, label: 'SCORM package' },
                    { resourceType: 'file', enabled: false, label: 'File upload' }
                ]}
            />
        )

        fireEvent.mouseDown(screen.getByRole('combobox', { name: /Resource type/i }))

        expect(screen.getByRole('option', { name: /^Page$/i })).toBeEnabled()
        expect(screen.getByRole('option', { name: /^Link$/i })).toBeEnabled()
        expect(screen.queryByRole('option', { name: /^url$/i })).not.toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Embed' })).toBeEnabled()
        expect(screen.queryByRole('option', { name: 'embed' })).not.toBeInTheDocument()
        expect(screen.getByRole('option', { name: /SCORM package.*not available yet/i })).toHaveAttribute('aria-disabled', 'true')
        expect(screen.queryByRole('option', { name: /File upload/i })).not.toBeInTheDocument()
    })

    it('keeps the selected embed resource type readable when metadata does not provide a label', async () => {
        const fields: FieldConfig[] = [
            {
                id: 'source',
                label: 'Source',
                type: 'JSON',
                required: true,
                uiConfig: {
                    widget: 'resourceSource'
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Create embed resource'
                fields={fields}
                locale='en'
                onClose={vi.fn()}
                onSubmit={vi.fn()}
                resourceSourceTypes={[{ resourceType: 'embed', enabled: true }]}
            />
        )

        const user = userEvent.setup()
        const typeSelect = screen.getByRole('combobox', { name: /Resource type/i })
        fireEvent.mouseDown(typeSelect)
        await user.click(screen.getByRole('option', { name: 'Embed' }))

        expect(typeSelect).toHaveTextContent('Embed')
        expect(typeSelect).not.toHaveTextContent(/^embed$/)
    })

    it('applies textarea metadata to localized string fields', async () => {
        const fields: FieldConfig[] = [
            {
                id: 'description',
                label: 'Description',
                type: 'STRING',
                validationRules: { localized: true, versioned: true },
                uiConfig: {
                    widget: 'textarea',
                    rows: 2
                }
            }
        ]

        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        render(
            <QueryClientProvider client={queryClient}>
                <FormDialog open title='Edit project' fields={fields} locale='en' onClose={vi.fn()} onSubmit={vi.fn()} />
            </QueryClientProvider>
        )

        await waitFor(() => {
            const textarea = screen.getAllByRole('textbox').find((element) => element.tagName.toLowerCase() === 'textarea')
            expect(textarea).toHaveAttribute('rows', '2')
        })
    })

    it('disables submit when a localized string value exceeds max length', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'title',
                label: 'Title',
                type: 'STRING',
                validationRules: { localized: true, versioned: true, maxLength: '5' as unknown as number }
            }
        ]

        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        render(
            <QueryClientProvider client={queryClient}>
                <FormDialog open title='Create material' fields={fields} locale='en' onClose={vi.fn()} onSubmit={onSubmit} />
            </QueryClientProvider>
        )

        fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Too long' } })

        expect(await screen.findByText('Language "EN": maximum length 5')).toBeVisible()
        expect(screen.getByTestId('entity-form-submit')).toBeDisabled()
    })

    it('renders semantic long-text string fields as multiline controls by default', async () => {
        const fields: FieldConfig[] = [
            {
                id: 'AssignmentInstructions',
                label: 'Instructions',
                type: 'STRING'
            },
            {
                id: 'Title',
                label: 'Title',
                type: 'STRING'
            }
        ]

        render(<FormDialog open title='Edit assignment' fields={fields} locale='en' onClose={vi.fn()} onSubmit={vi.fn()} />)

        const instructionsField = screen.getByRole('textbox', { name: /Instructions/i })
        const titleField = screen.getByRole('textbox', { name: /Title/i })

        expect(instructionsField.tagName.toLowerCase()).toBe('textarea')
        expect(instructionsField).toHaveAttribute('rows', '4')
        expect(titleField.tagName.toLowerCase()).toBe('input')
    })

    it('keeps normal JSON fields readable without leaking raw payloads', async () => {
        const rawRecordId = '018f52d6-9b71-7d58-8f2d-889ac8263a6d'
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'sourceJson',
                label: 'Source data',
                type: 'JSON',
                required: true
            }
        ]
        const initialData = {
            sourceJson: {
                storageKey: 'uploads/course-intro.pdf',
                recordId: rawRecordId,
                mimeType: 'application/pdf'
            }
        }

        render(
            <FormDialog
                open
                title='Edit source'
                fields={fields}
                initialData={initialData}
                locale='en'
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />
        )

        const displayField = screen.getByRole('textbox', { name: /Source data/i })
        expect(displayField).toHaveValue('Structured data is managed by the application.')
        expect(displayField).toHaveAttribute('readonly')
        expect(screen.getByText('This field is not edited as raw JSON.')).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(rawRecordId)
        expect(document.body).not.toHaveTextContent('storageKey')
        expect(document.body).not.toHaveTextContent('uploads/course-intro.pdf')
        expect(document.body).not.toHaveTextContent('[object Object]')

        await userEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSubmit).toHaveBeenCalledWith(initialData)
    })

    it('supports page resources without raw JSON editing', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'source',
                label: 'Source',
                type: 'JSON',
                required: true,
                uiConfig: {
                    widget: 'resourceSource'
                }
            }
        ]

        render(<FormDialog open title='Create page resource' fields={fields} locale='en' onClose={vi.fn()} onSubmit={onSubmit} />)

        const user = userEvent.setup()
        fireEvent.mouseDown(screen.getByRole('combobox', { name: /Resource type/i }))
        expect(screen.queryByRole('option', { name: 'page' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('option', { name: 'Page' }))
        await user.type(screen.getByRole('textbox', { name: /Page codename/i }), 'lesson-page')
        await user.click(screen.getByTestId('entity-form-submit'))

        expect(onSubmit).toHaveBeenCalledWith({
            source: {
                type: 'page',
                pageCodename: 'lesson-page',
                launchMode: 'inline'
            }
        })
    })

    it('auto-resolves page resource codenames from metadata source fields', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'Title',
                label: 'Title',
                type: 'STRING',
                required: true
            },
            {
                id: 'source',
                label: 'Source',
                type: 'JSON',
                required: true,
                uiConfig: {
                    widget: 'resourceSource',
                    autoPageCodename: {
                        sourceFields: ['Title']
                    }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Create page resource'
                fields={fields}
                initialData={{ source: { type: 'page', pageCodename: '' } }}
                locale='en'
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />
        )

        const user = userEvent.setup()
        const submit = screen.getByTestId('entity-form-submit')

        expect(screen.queryByRole('textbox', { name: /Page codename/i })).not.toBeInTheDocument()
        expect(submit).toBeDisabled()

        await user.type(screen.getByRole('textbox', { name: /Title/i }), 'Lunar Orbit Basics')

        expect(screen.getByTestId('resource-preview')).toBeInTheDocument()
        expect(submit).toBeEnabled()

        await user.click(submit)

        expect(onSubmit).toHaveBeenCalledWith({
            Title: 'Lunar Orbit Basics',
            source: {
                type: 'page',
                pageCodename: 'lunar-orbit-basics',
                launchMode: 'inline'
            }
        })
    })

    it('hides metadata-conditional fields and skips stale hidden values on submit', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'DueDateMode',
                label: 'Due Date Mode',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'select',
                    stringOptions: [
                        { value: 'ByDate', label: 'Due by date' },
                        { value: 'ForPeriod', label: 'Due for period' },
                        { value: 'NoDueDate', label: 'No due date' }
                    ]
                }
            },
            {
                id: 'DueDate',
                label: 'Due Date',
                type: 'DATE',
                uiConfig: {
                    visibleWhen: { field: 'DueDateMode', equals: 'ByDate' }
                }
            },
            {
                id: 'DuePeriodDays',
                label: 'Due Period, Days',
                type: 'NUMBER',
                uiConfig: {
                    visibleWhen: { field: 'DueDateMode', equals: 'ForPeriod' }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Create enrollment'
                fields={fields}
                locale='en'
                initialData={{ DueDateMode: 'ByDate', DueDate: '2026-06-01', DuePeriodDays: 30 }}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />
        )

        expect(screen.getByLabelText('Due Date')).toBeInTheDocument()
        expect(screen.queryByLabelText('Due Period, Days')).not.toBeInTheDocument()

        const user = userEvent.setup()
        await user.click(screen.getByRole('combobox', { name: 'Due Date Mode' }))
        await user.click(screen.getByRole('option', { name: 'No due date' }))

        expect(screen.queryByLabelText('Due Date')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Due Period, Days')).not.toBeInTheDocument()

        await user.click(screen.getByTestId('entity-form-submit'))

        expect(onSubmit).toHaveBeenCalledWith({
            DueDateMode: 'NoDueDate'
        })
    })

    it('enforces metadata-conditional required fields on the active form state', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'DueDateMode',
                label: 'Due Date Mode',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'select',
                    stringOptions: [
                        { value: 'ByDate', label: 'Due by date' },
                        { value: 'ForPeriod', label: 'Due for period' },
                        { value: 'NoDueDate', label: 'No due date' }
                    ]
                }
            },
            {
                id: 'DueDate',
                label: 'Due Date',
                type: 'DATE',
                uiConfig: {
                    visibleWhen: { field: 'DueDateMode', equals: 'ByDate' },
                    requiredWhen: { field: 'DueDateMode', equals: 'ByDate' }
                }
            },
            {
                id: 'DuePeriodDays',
                label: 'Due Period, Days',
                type: 'NUMBER',
                uiConfig: {
                    visibleWhen: { field: 'DueDateMode', equals: 'ForPeriod' },
                    requiredWhen: { field: 'DueDateMode', equals: 'ForPeriod' }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Create enrollment'
                fields={fields}
                locale='en'
                initialData={{ DueDateMode: 'ByDate' }}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />
        )

        const user = userEvent.setup()
        expect(screen.getByTestId('entity-form-submit')).toBeDisabled()

        await user.click(screen.getByRole('combobox', { name: 'Due Date Mode' }))
        await user.click(screen.getByRole('option', { name: 'No due date' }))
        expect(screen.getByTestId('entity-form-submit')).toBeEnabled()

        await user.click(screen.getByTestId('entity-form-submit'))

        expect(onSubmit).toHaveBeenCalledWith({
            DueDateMode: 'NoDueDate'
        })
    })

    it('derives hidden due dates from metadata-defined period parameters', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'EnrolledAt',
                label: 'Enrolled At',
                type: 'DATE',
                required: true,
                validationRules: { dateComposition: 'date' }
            },
            {
                id: 'DueDateMode',
                label: 'Due Date Mode',
                type: 'STRING',
                required: true,
                uiConfig: {
                    widget: 'select',
                    stringOptions: [
                        { value: 'ByDate', label: 'Due by date' },
                        { value: 'ForPeriod', label: 'Due for period' },
                        { value: 'NoDueDate', label: 'No due date' }
                    ]
                }
            },
            {
                id: 'DueDate',
                label: 'Due Date',
                type: 'DATE',
                uiConfig: {
                    visibleWhen: { field: 'DueDateMode', equals: 'ByDate' },
                    requiredWhen: { field: 'DueDateMode', equals: 'ByDate' },
                    derivedDateOffset: {
                        startField: 'EnrolledAt',
                        offsetDaysField: 'DuePeriodDays',
                        when: { field: 'DueDateMode', equals: 'ForPeriod' },
                        clearWhen: { field: 'DueDateMode', equals: 'NoDueDate' }
                    }
                }
            },
            {
                id: 'DuePeriodDays',
                label: 'Due Period, Days',
                type: 'NUMBER',
                uiConfig: {
                    visibleWhen: { field: 'DueDateMode', equals: 'ForPeriod' },
                    requiredWhen: { field: 'DueDateMode', equals: 'ForPeriod' }
                }
            }
        ]

        render(
            <FormDialog
                open
                title='Create enrollment'
                fields={fields}
                locale='en'
                initialData={{ EnrolledAt: '2026-06-01', DueDateMode: 'ForPeriod', DuePeriodDays: 14 }}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />
        )

        expect(screen.queryByLabelText('Due Date')).not.toBeInTheDocument()

        const user = userEvent.setup()
        await user.click(screen.getByTestId('entity-form-submit'))

        expect(onSubmit).toHaveBeenCalledWith({
            EnrolledAt: '2026-06-01',
            DueDateMode: 'ForPeriod',
            DueDate: '2026-06-15',
            DuePeriodDays: 14
        })
    })

    it('derives date offsets from UTC date-only values without daylight-saving arithmetic', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'StartDate',
                label: 'Start Date',
                type: 'DATE',
                required: true,
                validationRules: { dateComposition: 'date' }
            },
            {
                id: 'DueDate',
                label: 'Due Date',
                type: 'DATE',
                validationRules: { dateComposition: 'date' },
                uiConfig: {
                    hidden: true,
                    derivedDateOffset: {
                        startField: 'StartDate',
                        offsetDaysField: 'OffsetDays'
                    }
                }
            },
            {
                id: 'OffsetDays',
                label: 'Offset Days',
                type: 'NUMBER',
                required: true
            }
        ]

        render(
            <FormDialog
                open
                title='Create enrollment'
                fields={fields}
                locale='en'
                initialData={{ StartDate: '2026-03-28', OffsetDays: 2 }}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />
        )

        const user = userEvent.setup()
        await user.click(screen.getByTestId('entity-form-submit'))

        expect(onSubmit).toHaveBeenCalledWith({
            StartDate: '2026-03-28',
            DueDate: '2026-03-30',
            OffsetDays: 2
        })
    })

    it('syncs metadata-declared title fields into name fields until the name is manually edited', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const fields: FieldConfig[] = [
            {
                id: 'Title',
                label: 'Title',
                type: 'STRING',
                required: true,
                uiConfig: {
                    syncTargets: [{ fieldId: 'Name', manualFlagFieldId: 'NameManuallyEdited' }]
                }
            },
            {
                id: 'Name',
                label: 'Name',
                type: 'STRING'
            },
            {
                id: 'NameManuallyEdited',
                label: 'Name manually edited',
                type: 'BOOLEAN',
                uiConfig: {
                    hidden: true
                }
            }
        ]

        render(<FormDialog open title='Create page' fields={fields} locale='en' onClose={vi.fn()} onSubmit={onSubmit} />)

        const user = userEvent.setup()
        await user.type(screen.getByRole('textbox', { name: /Title/i }), 'Intro')
        expect(screen.getByRole('textbox', { name: /Name/i })).toHaveValue('Intro')
        expect(screen.queryByLabelText(/Name manually edited/i)).not.toBeInTheDocument()

        await user.clear(screen.getByRole('textbox', { name: /Name/i }))
        await user.type(screen.getByRole('textbox', { name: /Name/i }), 'Custom page name')
        await user.clear(screen.getByRole('textbox', { name: /Title/i }))
        await user.type(screen.getByRole('textbox', { name: /Title/i }), 'Advanced intro')
        await user.click(screen.getByTestId('entity-form-submit'))

        expect(onSubmit).toHaveBeenCalledWith({
            Title: 'Advanced intro',
            Name: 'Custom page name',
            NameManuallyEdited: true
        })
    })

    it('keeps TABLE fields immutable in copy mode so child rows are not silently dropped', () => {
        const fields: FieldConfig[] = [
            {
                id: 'Items',
                label: 'Items',
                type: 'TABLE',
                childFields: [{ id: 'Title', label: 'Title', type: 'STRING' }]
            }
        ]

        render(
            <FormDialog
                open
                copyMode
                title='Copy record'
                fields={fields}
                locale='en'
                initialData={{ Items: [{ Title: 'Existing row' }] }}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />
        )

        expect(screen.getByText('Table rows are copied unchanged from the source record.')).toBeInTheDocument()
        expect(screen.queryByText('Add Row')).not.toBeInTheDocument()
    })
})
