import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const flowListTableTestMode = vi.hoisted(() => ({ renderActual: false }))

vi.mock('../CustomizedDataGrid', async () => {
    const { MockCustomizedDataGrid } = await import('./widgetRenderer.test-mocks')
    return { default: MockCustomizedDataGrid }
})

vi.mock('../../../components/runtime-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../components/runtime-ui')>()
    const React = await import('react')
    const { MockFlowListTable } = await import('./widgetRenderer.test-mocks')
    const FlowListTableTestAdapter = (props: Parameters<typeof MockFlowListTable>[0]) =>
        flowListTableTestMode.renderActual
            ? React.createElement(actual.FlowListTable, props as never)
            : React.createElement(MockFlowListTable, props)
    return { ...actual, FlowListTable: FlowListTableTestAdapter }
})

import {
    placement,
    renderRuntimeWidget,
    resetRuntimeLanguage,
    createTarget,
    createPermissions,
    createTargetWidget
} from './widgetRenderer.test-support'
import i18n from '@universo-react/i18n'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'

describe('Dashboard runtime widget ownership renderers', () => {
    afterEach(async () => {
        flowListTableTestMode.renderActual = false
        await resetRuntimeLanguage()
    })

    it('renders typed table rows in the existing CustomizedDataGrid contract', () => {
        renderRuntimeWidget(
            placement('detailsTable', {
                status: 'ready',
                data: {
                    kind: 'table',
                    columns: [
                        { key: 'name', label: 'Name' },
                        { key: 'status', label: 'Status' }
                    ],
                    rows: [
                        {
                            key: 'course-1',
                            cells: [
                                { key: 'name', value: 'Algebra' },
                                { key: 'status', value: 'Published' }
                            ]
                        }
                    ]
                }
            })
        )
        expect(screen.getByTestId('runtime-table')).toHaveAttribute('data-columns', 'name,status')
        expect(screen.getByText('Algebra')).toBeInTheDocument()
        expect(screen.getByText('Published')).toBeInTheDocument()
    })

    it.each(['table', 'card'] as const)(
        'does not expose serialized resource content or internal identifiers in the normal %s view',
        async (defaultViewMode) => {
            const user = userEvent.setup()
            const rawMediaValue = JSON.stringify({
                type: 'image',
                storageKey: 'private/course-cover.png',
                mimeType: 'image/png'
            })
            const rawBlockContent = JSON.stringify({
                blocks: [{ type: 'paragraph', data: { text: 'Private lesson instructions' } }]
            })
            const rawObjectFallback = '[object Object]'
            const internalRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073990'
            const internalUserId = 'usr_internal_48392'
            const unsafeValues = [
                {
                    key: 'cover',
                    label: 'Cover resource binding',
                    title: rawMediaValue,
                    displayName: 'Course cover',
                    value: rawMediaValue
                },
                {
                    key: 'body',
                    label: 'Block document payload',
                    title: 'Lesson instructions',
                    displayName: 'Lesson instructions',
                    value: rawBlockContent
                },
                {
                    key: 'metadata',
                    label: 'Structured resource metadata',
                    title: 'Resource metadata',
                    displayName: 'Resource metadata',
                    value: rawObjectFallback
                },
                {
                    key: 'projectId',
                    label: 'Project internal identifier',
                    title: 'Project overview',
                    displayName: 'Project overview',
                    value: internalRecordId
                },
                {
                    key: 'ownerId',
                    label: 'Owner internal identifier',
                    title: 'Owner record',
                    displayName: 'Owner record',
                    value: internalUserId
                }
            ] as const
            const detailKeys = ['cover', 'body', 'metadata', 'projectId', 'ownerId'] as const

            renderRuntimeWidget(
                placement(
                    'detailsTable',
                    {
                        status: 'ready',
                        data: {
                            kind: 'table',
                            columns: [
                                { key: 'title', label: 'Title' },
                                { key: 'name', label: 'Name' },
                                { key: 'cover', label: 'Cover resource binding' },
                                { key: 'body', label: 'Block document payload' },
                                { key: 'metadata', label: 'Structured resource metadata' },
                                { key: 'projectId', label: 'Project internal identifier' },
                                { key: 'ownerId', label: 'Owner internal identifier' }
                            ],
                            rows: unsafeValues.map(({ key, title, displayName, value }, index) => ({
                                key: `unsafe-value-${index + 1}`,
                                actionTarget: {
                                    entityCodename: 'Courses',
                                    recordHandle: `rh1.test-019f20000000700080000000000000${String(index + 11)}`
                                },
                                cells: [
                                    { key: 'title', value: title },
                                    { key: 'name', value: displayName },
                                    ...detailKeys.map((detailKey) => ({
                                        key: detailKey,
                                        value: detailKey === key ? value : ''
                                    }))
                                ]
                            }))
                        }
                    },
                    { showSearch: true, showViewToggle: false, defaultViewMode }
                ),
                {
                    runtimeAccessMode: 'member',
                    permissions: { ...createPermissions, editContent: true },
                    onOpenRowTarget: vi.fn()
                }
            )

            for (const { displayName } of unsafeValues) {
                expect(screen.getByRole('button', { name: `Actions for ${displayName}` })).toBeInTheDocument()
            }
            const visibleText = document.body.textContent ?? ''
            expect.soft(visibleText).not.toContain(rawMediaValue)
            expect.soft(visibleText).not.toContain(rawBlockContent)
            expect.soft(visibleText).not.toContain(rawObjectFallback)
            expect.soft(visibleText).not.toContain(internalRecordId)
            expect.soft(visibleText).not.toContain(internalUserId)

            if (defaultViewMode === 'table') {
                expect(screen.getByTestId('runtime-table')).toHaveAttribute('data-columns', 'title,name,__runtimeActions')
            } else {
                expect.soft(visibleText).not.toContain('Cover resource binding')
                expect.soft(visibleText).not.toContain('Block document payload')
                expect.soft(visibleText).not.toContain('Structured resource metadata')
                expect.soft(visibleText).not.toContain('Project internal identifier')
                expect.soft(visibleText).not.toContain('Owner internal identifier')
            }

            await user.type(screen.getByPlaceholderText('Search records'), 'private/course-cover.png')
            expect(screen.getByRole('status')).toHaveTextContent('No matching content was found.')
            for (const { displayName } of unsafeValues) {
                expect(screen.queryByRole('button', { name: `Actions for ${displayName}` })).not.toBeInTheDocument()
            }
        }
    )

    it('uses safe semantic names and visible columns for sortable row controls', () => {
        flowListTableTestMode.renderActual = true
        const rawTitle = JSON.stringify({ type: 'document', storageKey: 'private/course-cover.png' })
        const rawMediaValue = JSON.stringify({ type: 'image', storageKey: 'private/course-cover.png', mimeType: 'image/png' })
        const internalRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073990'
        const rowOneId = 'rh1.test-019f2000000070008000000000000021'
        const rowTwoId = 'rh1.test-019f2000000070008000000000000022'

        renderRuntimeWidget(
            placement(
                'detailsTable',
                {
                    status: 'ready',
                    data: {
                        kind: 'table',
                        sourceEntityCodename: 'Courses',
                        pagination: { total: 2, limit: 2, offset: 0, complete: true },
                        columns: [
                            { key: 'title', label: 'Title' },
                            { key: 'name', label: 'Name' },
                            { key: 'media', label: 'Media content' },
                            { key: 'projectId', label: 'Project internal identifier' }
                        ],
                        rows: [
                            {
                                key: 'course-one',
                                mutationTarget: { entityCodename: 'Courses', recordHandle: rowOneId, version: 2 },
                                cells: [
                                    { key: 'title', value: rawTitle },
                                    { key: 'name', value: 'Course cover' },
                                    { key: 'media', value: rawMediaValue },
                                    { key: 'projectId', value: internalRecordId }
                                ]
                            },
                            {
                                key: 'course-two',
                                mutationTarget: { entityCodename: 'Courses', recordHandle: rowTwoId, version: 3 },
                                cells: [
                                    { key: 'title', value: 'Geometry' },
                                    { key: 'name', value: 'Geometry' },
                                    { key: 'media', value: rawMediaValue },
                                    { key: 'projectId', value: internalRecordId }
                                ]
                            }
                        ]
                    }
                },
                { enableRowReordering: true, showSearch: false }
            ),
            {
                runtimeAccessMode: 'member',
                permissions: { ...createPermissions, editContent: true },
                rowReorder: { onReorder: vi.fn().mockResolvedValue(undefined), isPending: false }
            }
        )

        expect(screen.getByRole('table', { name: 'Records' })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'Title' })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
        expect(screen.queryByRole('columnheader', { name: 'Media content' })).not.toBeInTheDocument()
        expect(screen.queryByRole('columnheader', { name: 'Project internal identifier' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Move Course cover up' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Move Geometry down' })).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(rawTitle)
        expect(document.body).not.toHaveTextContent(rawMediaValue)
        expect(document.body).not.toHaveTextContent(internalRecordId)
        expect(document.body).not.toHaveTextContent(rowOneId)
        expect(document.body).not.toHaveTextContent(rowTwoId)
    })

    it('never uses a technical-label cell as the card, action, or reorder display name', async () => {
        flowListTableTestMode.renderActual = true
        const user = userEvent.setup()
        const internalUserId = 'usr_internal_48392'
        const firstRowHandle = 'rh1.test-019f2000000070008000000000000031'
        const secondRowHandle = 'rh1.test-019f2000000070008000000000000032'
        const onReorder = vi.fn().mockResolvedValue(undefined)

        renderRuntimeWidget(
            placement(
                'detailsTable',
                {
                    status: 'ready',
                    data: {
                        kind: 'table',
                        sourceEntityCodename: 'Courses',
                        pagination: { total: 2, limit: 2, offset: 0, complete: true },
                        columns: [
                            { key: 'title', label: 'Owner ID' },
                            { key: 'summary', label: 'Summary' }
                        ],
                        rows: [
                            {
                                key: 'course-one',
                                actionTarget: { entityCodename: 'Courses', recordHandle: firstRowHandle },
                                mutationTarget: { entityCodename: 'Courses', recordHandle: firstRowHandle, version: 2 },
                                cells: [
                                    { key: 'title', value: internalUserId },
                                    { key: 'summary', value: 'Human-readable first course' }
                                ]
                            },
                            {
                                key: 'course-two',
                                actionTarget: { entityCodename: 'Courses', recordHandle: secondRowHandle },
                                mutationTarget: { entityCodename: 'Courses', recordHandle: secondRowHandle, version: 3 },
                                cells: [
                                    { key: 'title', value: internalUserId },
                                    { key: 'summary', value: 'Human-readable second course' }
                                ]
                            }
                        ]
                    }
                },
                { enableRowReordering: true, showSearch: false, showViewToggle: true, defaultViewMode: 'table' }
            ),
            {
                runtimeAccessMode: 'member',
                permissions: { ...createPermissions, editContent: true },
                onOpenRowTarget: vi.fn(),
                rowReorder: { onReorder, isPending: false }
            }
        )

        expect(screen.queryByRole('columnheader', { name: 'Owner ID' })).not.toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'Summary' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Move Human-readable first course down' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Actions for Human-readable first course' })).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(internalUserId)

        await user.click(screen.getByRole('button', { name: 'Card View' }))
        expect(screen.getByText('Human-readable first course')).toBeVisible()
        expect(screen.getByRole('button', { name: 'Actions for Human-readable first course' })).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(internalUserId)
    })

    it('renders learner Enrollment rows as a read-only searchable table', async () => {
        const user = userEvent.setup()
        renderRuntimeWidget(
            placement(
                'detailsTable',
                {
                    status: 'ready',
                    data: {
                        kind: 'table',
                        columns: [{ key: 'title', label: 'Learning item' }],
                        rows: [
                            {
                                key: 'enrollment-one',
                                actionTarget: {
                                    entityCodename: 'Courses',
                                    recordHandle: 'rh1.test-019f2000000070008000000000000011'
                                },
                                cells: [{ key: 'title', value: 'Algebra course' }]
                            }
                        ]
                    }
                },
                { variant: 'learner-enrollments' }
            ),
            {
                runtimeAccessMode: 'member',
                permissions: { ...createPermissions, editContent: true, deleteContent: true },
                onOpenRowTarget: vi.fn()
            }
        )

        const search = screen.getByPlaceholderText('Search records')
        expect(search).toBeInTheDocument()
        expect(screen.getByText('Algebra course')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Card View' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument()
        expect(document.body).not.toHaveTextContent('rh1.test-019f2000000070008000000000000011')

        await user.type(search, 'missing')
        expect(screen.queryByText('Algebra course')).not.toBeInTheDocument()
    })

    it('routes authorized Entity table row actions through the host in table and card views', async () => {
        const user = userEvent.setup()
        const recordHandle = 'rh1.test-019f2000000070008000000000000011'
        expect(recordHandle).toMatch(/^rh1\./u)
        expect(recordHandle).not.toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/iu)
        const onOpenRowTarget = vi.fn()
        renderRuntimeWidget(
            placement(
                'detailsTable',
                {
                    status: 'ready',
                    data: {
                        kind: 'table',
                        columns: [{ key: 'title', label: 'Title' }],
                        rows: [
                            {
                                key: 'course-one',
                                actionTarget: { entityCodename: 'Courses', recordHandle },
                                cells: [{ key: 'title', value: 'Algebra' }]
                            }
                        ]
                    }
                },
                { showSearch: false, showViewToggle: true }
            ),
            {
                runtimeAccessMode: 'member',
                permissions: { ...createPermissions, editContent: true, deleteContent: true },
                onOpenRowTarget
            }
        )

        expect(screen.getByTestId(`grid-row-actions-trigger-${recordHandle}`)).toHaveAccessibleName('Actions for Algebra')
        await user.click(screen.getByRole('button', { name: 'Actions for Algebra' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit' }))
        expect(onOpenRowTarget).toHaveBeenNthCalledWith(1, { rowId: recordHandle, objectCollectionCodename: 'Courses' }, 'edit')

        await user.click(screen.getByRole('button', { name: 'Actions for Algebra' }))
        await user.click(screen.getByRole('menuitem', { name: 'Copy' }))
        await user.click(screen.getByRole('button', { name: 'Actions for Algebra' }))
        await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
        expect(onOpenRowTarget).toHaveBeenNthCalledWith(2, { rowId: recordHandle, objectCollectionCodename: 'Courses' }, 'copy')
        expect(onOpenRowTarget).toHaveBeenNthCalledWith(3, { rowId: recordHandle, objectCollectionCodename: 'Courses' }, 'delete')
        expect(document.body).not.toHaveTextContent(recordHandle)

        await user.click(screen.getByRole('button', { name: 'Card View' }))
        await user.click(screen.getByRole('button', { name: 'Actions for Algebra' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit' }))
        expect(onOpenRowTarget).toHaveBeenCalledTimes(4)
    })

    it('uses a case-insensitive semantic title cell for the row action accessible name', async () => {
        const user = userEvent.setup()
        const recordHandle = 'rh1.test-019f2000000070008000000000000013'
        renderRuntimeWidget(
            placement('detailsTable', {
                status: 'ready',
                data: {
                    kind: 'table',
                    columns: [
                        { key: 'FolderId', label: 'Knowledge Folder' },
                        { key: 'Title', label: 'Title' }
                    ],
                    rows: [
                        {
                            key: 'article-one',
                            actionTarget: { entityCodename: 'KnowledgeArticles', recordHandle },
                            cells: [
                                { key: 'FolderId', value: 'Getting started articles' },
                                { key: 'Title', value: 'Published app article' }
                            ]
                        }
                    ]
                }
            }),
            {
                runtimeAccessMode: 'member',
                permissions: { ...createPermissions, editContent: true },
                onOpenRowTarget: vi.fn()
            }
        )

        await user.click(screen.getByRole('button', { name: 'Actions for Published app article' }))
        expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
        expect(screen.queryByRole('button', { name: 'Actions for Getting started articles' })).not.toBeInTheDocument()
    })

    it('forwards entity row identity to the Dashboard host action menu without rendering the UUID', async () => {
        const user = userEvent.setup()
        const recordHandle = 'rh1.test-019f2000000070008000000000000019'
        const onOpenRowMenu = vi.fn()
        renderRuntimeWidget(
            placement('detailsTable', {
                status: 'ready',
                data: {
                    kind: 'table',
                    columns: [{ key: 'title', label: 'Title' }],
                    rows: [
                        {
                            key: 'course-one',
                            actionTarget: { entityCodename: 'Courses', recordHandle },
                            cells: [{ key: 'title', value: 'Algebra' }]
                        }
                    ]
                }
            }),
            {
                runtimeAccessMode: 'member',
                permissions: { ...createPermissions, editContent: true },
                onOpenRowTarget: vi.fn(),
                onOpenRowMenu
            }
        )

        await user.click(screen.getByRole('button', { name: 'Actions for Algebra' }))

        expect(onOpenRowMenu).toHaveBeenCalledWith(expect.anything(), recordHandle, { entityCodename: 'Courses', recordHandle })
        expect(document.body).not.toHaveTextContent(recordHandle)
    })

    it('reorders a complete, authorized Entity table with UUIDv7 targets kept out of user-visible cells', async () => {
        const user = userEvent.setup()
        const onReorder = vi.fn().mockResolvedValue(undefined)
        const rowOneId = 'rh1.test-019f2000000070008000000000000011'
        const rowTwoId = 'rh1.test-019f2000000070008000000000000012'
        renderRuntimeWidget(
            placement(
                'detailsTable',
                {
                    status: 'ready',
                    data: {
                        kind: 'table',
                        sourceEntityCodename: 'Courses',
                        pagination: { total: 2, limit: 2, offset: 0, complete: true },
                        columns: [
                            { key: 'title', label: 'Title' },
                            { key: 'status', label: 'Status' }
                        ],
                        rows: [
                            {
                                key: 'course-one',
                                mutationTarget: { entityCodename: 'Courses', recordHandle: rowOneId, version: 3 },
                                cells: [
                                    { key: 'title', value: 'Algebra' },
                                    { key: 'status', value: 'Published' }
                                ]
                            },
                            {
                                key: 'course-two',
                                mutationTarget: { entityCodename: 'Courses', recordHandle: rowTwoId, version: 5 },
                                cells: [
                                    { key: 'title', value: 'Geometry' },
                                    { key: 'status', value: 'Draft' }
                                ]
                            }
                        ]
                    }
                },
                { enableRowReordering: true, showSearch: true }
            ),
            {
                runtimeAccessMode: 'member',
                permissions: { ...createPermissions, editContent: true },
                rowReorder: { onReorder, isPending: false }
            }
        )

        expect(screen.getByTestId('relation-table')).toHaveAttribute('data-sortable', 'true')
        expect(screen.getByText('Algebra')).toBeInTheDocument()
        expect(screen.queryByText(rowOneId)).not.toBeInTheDocument()
        const search = screen.getByRole('textbox', { name: 'Search records' })
        await user.type(search, 'Geometry')
        expect(screen.getByTestId('runtime-table')).toHaveAttribute('data-rows', '1')
        expect(screen.getByText('Geometry')).toBeInTheDocument()
        expect(screen.queryByText('Algebra')).not.toBeInTheDocument()
        expect(screen.queryByTestId('relation-table')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Move .* (up|down)/u })).not.toBeInTheDocument()
        await user.clear(search)
        expect(screen.getByTestId('relation-table')).toHaveAttribute('data-sortable', 'true')
        await user.click(screen.getByRole('button', { name: 'Move second row up' }))

        expect(onReorder).toHaveBeenCalledExactlyOnceWith({
            objectCollectionCodename: 'Courses',
            orderedRowIds: [rowTwoId, rowOneId],
            expectedVersionsByRowId: { [rowOneId]: 3, [rowTwoId]: 5 }
        })
    })

    it('supports localized search and the registered table/card view toggle', async () => {
        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        const widget = placement(
            'detailsTable',
            {
                status: 'ready',
                data: {
                    kind: 'table',
                    columns: [
                        { key: 'title', label: 'Название' },
                        { key: 'status', label: 'Статус' }
                    ],
                    rows: [
                        {
                            key: 'algebra',
                            cells: [
                                { key: 'title', value: 'Алгебра' },
                                { key: 'status', value: 'Опубликовано' }
                            ]
                        },
                        {
                            key: 'geometry',
                            cells: [
                                { key: 'title', value: 'Геометрия' },
                                { key: 'status', value: 'Черновик' }
                            ]
                        }
                    ]
                }
            },
            { showSearch: true, showViewToggle: true, defaultViewMode: 'table' }
        )
        renderRuntimeWidget(widget, { locale: 'ru' })

        expect(screen.getByRole('heading', { name: 'Записи' })).toBeInTheDocument()
        const search = screen.getByRole('textbox', { name: 'Поиск записей' })
        expect(screen.getByTestId('runtime-table')).toHaveAttribute('data-rows', '2')
        fireEvent.change(search, { target: { value: 'Алгебра' } })
        expect(screen.getByTestId('runtime-table')).toHaveAttribute('data-rows', '1')
        expect(screen.queryByText('Геометрия')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Карточками' }))
        expect(screen.queryByTestId('runtime-table')).not.toBeInTheDocument()
        expect(screen.getByText('Алгебра')).toBeInTheDocument()
        expect(screen.getByText('Статус: Опубликовано')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Табличный вид' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Табличный вид' }))
        expect(screen.getByTestId('runtime-table')).toHaveAttribute('data-rows', '1')
        await act(async () => {
            await i18n.changeLanguage('en')
        })
    })

    it('localizes typed boolean values in table, search, and card views', async () => {
        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        renderRuntimeWidget(
            placement(
                'detailsTable',
                {
                    status: 'ready',
                    data: {
                        kind: 'table',
                        columns: [
                            { key: 'title', label: 'Название', valueType: 'string' },
                            { key: 'visible', label: 'Видимость', valueType: 'boolean' }
                        ],
                        rows: [
                            {
                                key: 'algebra',
                                cells: [
                                    { key: 'title', value: 'Алгебра' },
                                    { key: 'visible', value: 'true' }
                                ]
                            }
                        ]
                    }
                },
                { showSearch: true, showViewToggle: true }
            ),
            { locale: 'ru' }
        )

        expect(screen.getByText('Да')).toBeInTheDocument()
        expect(screen.queryByText('true')).not.toBeInTheDocument()
        const search = screen.getByRole('textbox', { name: 'Поиск записей' })
        fireEvent.change(search, { target: { value: 'да' } })
        expect(screen.getByTestId('runtime-table')).toHaveAttribute('data-rows', '1')
        fireEvent.click(screen.getByRole('button', { name: 'Карточками' }))
        expect(screen.getByText('Видимость: Да')).toBeInTheDocument()
    })

    it('opens an available semantic section target with an enabled resource policy', async () => {
        const user = userEvent.setup()
        const onOpenCreateTarget = vi.fn()
        const { objectCollectionCodename: _objectCollectionCodename, ...presentation } = createTarget
        const target = {
            ...presentation,
            sectionCodename: 'Lessons',
            createDefaults: [{ fieldCodename: 'Resource', resourceSourceType: 'video' as const }]
        }
        renderRuntimeWidget(createTargetWidget(target), {
            permissions: createPermissions,
            sections: [{ id: 'host-section', codename: 'Lessons' }],
            resourceSourceTypes: [{ resourceType: 'video', enabled: true, deferred: false }],
            onOpenCreateTarget
        })
        await user.click(screen.getByRole('button', { name: 'Create' }))
        await user.click(screen.getByRole('menuitem', { name: 'Course' }))
        expect(onOpenCreateTarget).toHaveBeenCalledExactlyOnceWith(target)
    })

    it('shows actual Russian target labels and metadata/resource disabled reasons', async () => {
        const user = userEvent.setup()
        const onOpenCreateTarget = vi.fn()
        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        const widget = createTargetWidget()
        widget.config = {
            showSearch: false,
            createTargets: [
                { ...createTarget, disabled: true, disabledReason: { en: 'Creation is paused', ru: 'Создание приостановлено' } },
                {
                    ...createTarget,
                    id: 'create-video',
                    label: { en: 'Video lesson', ru: 'Видеоурок' },
                    createDefaults: [{ fieldCodename: 'Resource', resourceSourceType: 'video' }]
                }
            ]
        }
        renderRuntimeWidget(widget, {
            locale: 'ru',
            permissions: createPermissions,
            objectCollections: [{ id: 'host-source', codename: 'Courses' }],
            resourceSourceTypes: [{ resourceType: 'video', enabled: true, deferred: true }],
            onOpenCreateTarget
        })
        await user.click(screen.getByRole('button', { name: 'Создать' }))
        const paused = screen.getByRole('menuitem', { name: 'Курс Создание приостановлено' })
        const deferred = screen.getByRole('menuitem', { name: 'Видеоурок Видео запланирован для следующего этапа.' })
        expect(paused).toHaveAttribute('aria-disabled', 'true')
        expect(deferred).toHaveAttribute('aria-disabled', 'true')
        fireEvent.click(paused)
        fireEvent.click(deferred)
        expect(onOpenCreateTarget).not.toHaveBeenCalled()
    })

    it('rechecks host creation permission when an open menu becomes read-only', async () => {
        const user = userEvent.setup()
        const onOpenCreateTarget = vi.fn()
        const details = {
            title: 'Runtime',
            permissions: createPermissions,
            objectCollections: [{ id: 'host-source', codename: 'Courses' }],
            onOpenCreateTarget
        }
        const widget = createTargetWidget()
        const { rerender } = renderRuntimeWidget(widget, details)
        await user.click(screen.getByRole('button', { name: 'Create' }))
        const item = screen.getByRole('menuitem', { name: 'Course' })
        rerender(
            <DashboardDetailsProvider value={{ ...details, permissions: { ...createPermissions, createContent: false } }}>
                {renderWidget(widget)}
            </DashboardDetailsProvider>
        )
        fireEvent.click(item)
        expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
        expect(onOpenCreateTarget).not.toHaveBeenCalled()
    })

    it('rejects physical create target locators instead of exposing a creation menu', () => {
        const onOpenCreateTarget = vi.fn()
        renderRuntimeWidget(createTargetWidget({ ...createTarget, objectCollectionId: 'physical-id' } as typeof createTarget), {
            permissions: createPermissions,
            objectCollections: [{ id: 'host-source', codename: 'Courses' }],
            onOpenCreateTarget
        })
        expect(screen.getByRole('status')).toHaveTextContent('This widget is configured incorrectly.')
        expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
        expect(onOpenCreateTarget).not.toHaveBeenCalled()
    })

    it('provides dashboard table labels from the shared EN/RU resources', async () => {
        await act(async () => {
            await i18n.changeLanguage('en')
        })
        expect(i18n.t('dashboard.widgets.records', { ns: 'common' })).toBe('Records')
        expect(i18n.t('dashboard.widgets.searchRecords', { ns: 'common' })).toBe('Search records')

        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        expect(i18n.t('dashboard.widgets.records', { ns: 'common' })).toBe('Записи')
        expect(i18n.t('dashboard.widgets.searchRecords', { ns: 'common' })).toBe('Поиск записей')
        expect(i18n.t('dashboard.widgets.tableView', { ns: 'common' })).toBe('Табличный вид')
    })

    it.each([
        { access: 'public' as const, permissions: { ...createPermissions, editContent: true } },
        { access: 'member' as const, permissions: { ...createPermissions, createContent: false } }
    ])('hides Entity table row actions without an authorized member permission', ({ access, permissions }) => {
        renderRuntimeWidget(
            placement('detailsTable', {
                status: 'ready',
                data: {
                    kind: 'table',
                    columns: [{ key: 'title', label: 'Title' }],
                    rows: [
                        {
                            key: 'course-one',
                            actionTarget: {
                                entityCodename: 'Courses',
                                recordHandle: 'rh1.test-019f2000000070008000000000000011'
                            },
                            cells: [{ key: 'title', value: 'Algebra' }]
                        }
                    ]
                }
            }),
            { runtimeAccessMode: access, permissions, onOpenRowTarget: vi.fn() }
        )

        expect(screen.queryByRole('button', { name: 'Actions for Algebra' })).not.toBeInTheDocument()
    })

    it.each(['public', 'read-only', 'incomplete-source'] as const)(
        'keeps the existing read-only table renderer for %s reorder requests',
        (restriction) => {
            const data = {
                kind: 'table' as const,
                sourceEntityCodename: 'Courses',
                ...(restriction === 'incomplete-source'
                    ? { pagination: { total: 20, limit: 2, offset: 0 } }
                    : { pagination: { total: 2, limit: 2, offset: 0, complete: true as const } }),
                columns: [{ key: 'title', label: 'Title' }],
                rows: [
                    {
                        key: 'course-one',
                        ...(restriction === 'incomplete-source'
                            ? {}
                            : {
                                  mutationTarget: {
                                      entityCodename: 'Courses',
                                      recordHandle: 'rh1.test-019f2000000070008000000000000011',
                                      version: 3
                                  }
                              }),
                        cells: [{ key: 'title', value: 'Algebra' }]
                    },
                    {
                        key: 'course-two',
                        ...(restriction === 'incomplete-source'
                            ? {}
                            : {
                                  mutationTarget: {
                                      entityCodename: 'Courses',
                                      recordHandle: 'rh1.test-019f2000000070008000000000000012',
                                      version: 5
                                  }
                              }),
                        cells: [{ key: 'title', value: 'Geometry' }]
                    }
                ]
            }
            const onReorder = vi.fn()
            renderRuntimeWidget(placement('detailsTable', { status: 'ready', data }, { enableRowReordering: true }), {
                runtimeAccessMode: restriction === 'public' ? 'public' : 'member',
                permissions: restriction === 'read-only' ? createPermissions : { ...createPermissions, editContent: true },
                rowReorder: { onReorder, isPending: false }
            })

            expect(screen.getByTestId('runtime-table')).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Move second row up' })).not.toBeInTheDocument()
            expect(onReorder).not.toHaveBeenCalled()
        }
    )

    it.each([
        ['en', 'table'],
        ['en', 'card'],
        ['ru', 'table'],
        ['ru', 'card']
    ] as const)('keeps %s search and %s view controls usable after a no-result query', async (locale, defaultViewMode) => {
        const user = userEvent.setup()
        await act(async () => {
            await i18n.changeLanguage(locale)
        })
        renderRuntimeWidget(
            placement(
                'detailsTable',
                {
                    status: 'ready',
                    data: {
                        kind: 'table',
                        columns: [{ key: 'name', label: 'Name' }],
                        rows: [
                            { key: 'algebra', cells: [{ key: 'name', value: 'Algebra' }] },
                            { key: 'geometry', cells: [{ key: 'name', value: 'Geometry' }] }
                        ]
                    }
                },
                { showSearch: true, showViewToggle: true, defaultViewMode }
            ),
            { locale }
        )

        const heading = locale === 'ru' ? 'Записи' : 'Records'
        const searchLabel = locale === 'ru' ? 'Поиск записей' : 'Search records'
        const cardLabel = locale === 'ru' ? 'Карточками' : 'Card View'
        const tableLabel = locale === 'ru' ? 'Табличный вид' : 'Table view'
        const search = screen.getByRole('textbox', { name: searchLabel })
        expect(screen.getByText('Algebra')).toBeInTheDocument()
        expect(screen.getByText('Geometry')).toBeInTheDocument()

        await user.type(search, 'No matches')

        expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: searchLabel })).toBe(search)
        expect(search).toHaveValue('No matches')
        expect(screen.getByRole('button', { name: cardLabel })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: tableLabel })).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent(
            locale === 'ru' ? 'Подходящее содержимое не найдено.' : 'No matching content was found.'
        )
        expect(screen.queryByText('Algebra')).not.toBeInTheDocument()
        expect(screen.queryByText('Geometry')).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: defaultViewMode === 'table' ? cardLabel : tableLabel }))
        await user.clear(screen.getByRole('textbox', { name: searchLabel }))

        expect(search).toHaveValue('')
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        expect(screen.getByText('Algebra')).toBeInTheDocument()
        expect(screen.getByText('Geometry')).toBeInTheDocument()
        if (defaultViewMode === 'card') {
            expect(screen.getByTestId('runtime-table')).toHaveAttribute('data-rows', '2')
        } else {
            expect(screen.queryByTestId('runtime-table')).not.toBeInTheDocument()
        }
    })

    it.each(['table', 'card'] as const)('keeps the header and controls for a genuinely empty %s view', (defaultViewMode) => {
        renderRuntimeWidget(
            placement(
                'detailsTable',
                { status: 'ready', data: { kind: 'table', columns: [{ key: 'name', label: 'Name' }], rows: [] } },
                { showSearch: true, showViewToggle: true, defaultViewMode }
            )
        )

        expect(screen.getByRole('heading', { name: 'Records' })).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Search records' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Card View' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Table view' })).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('No matching content was found.')
        expect(screen.queryByTestId('runtime-table')).not.toBeInTheDocument()
    })

    it.each(['en', 'ru'] as const)('opens a semantic create target from an empty table using real %s menu labels', async (locale) => {
        const user = userEvent.setup()
        const onOpenCreateTarget = vi.fn()
        await act(async () => {
            await i18n.changeLanguage(locale)
        })
        renderRuntimeWidget(createTargetWidget(), {
            locale,
            runtimeAccessMode: 'member',
            permissions: createPermissions,
            objectCollections: [{ id: 'host-source', codename: 'Courses' }],
            onOpenCreateTarget
        })

        expect(screen.getByRole('heading', { name: locale === 'ru' ? 'Записи' : 'Records' })).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent(
            locale === 'ru' ? 'Подходящее содержимое не найдено.' : 'No matching content was found.'
        )
        await user.click(screen.getByRole('button', { name: locale === 'ru' ? 'Создать' : 'Create' }))
        expect(screen.getByRole('menu', { name: locale === 'ru' ? 'Создать контент' : 'Create content' })).toBeInTheDocument()
        await user.click(screen.getByRole('menuitem', { name: locale === 'ru' ? 'Курс' : 'Course' }))

        expect(onOpenCreateTarget).toHaveBeenCalledExactlyOnceWith(createTarget)
        expect(onOpenCreateTarget.mock.calls[0][0]).not.toHaveProperty('objectCollectionId')
        expect(onOpenCreateTarget.mock.calls[0][0]).not.toHaveProperty('sectionId')
    })

    it('allows a content-only member to create without application-management permissions', async () => {
        const user = userEvent.setup()
        const onOpenCreateTarget = vi.fn()
        renderRuntimeWidget(createTargetWidget(), {
            runtimeAccessMode: 'member',
            permissions: { createContent: true },
            objectCollections: [{ id: 'host-source', codename: 'Courses' }],
            onOpenCreateTarget
        })

        const createButton = screen.getByRole('button', { name: 'Create' })
        expect(createButton).toBeEnabled()
        expect(screen.queryByText('You do not have permission to create content.')).not.toBeInTheDocument()
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()

        await user.click(createButton)
        expect(screen.getByRole('menu', { name: 'Create content' })).toBeInTheDocument()
        await user.click(screen.getByRole('menuitem', { name: 'Course' }))
        expect(onOpenCreateTarget).toHaveBeenCalledExactlyOnceWith(createTarget)
    })

    it('shows the Russian create permission reason before any interaction', async () => {
        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        const onOpenCreateTarget = vi.fn()
        renderRuntimeWidget(createTargetWidget(), {
            locale: 'ru',
            runtimeAccessMode: 'member',
            permissions: { createContent: false },
            objectCollections: [{ id: 'host-source', codename: 'Courses' }],
            onOpenCreateTarget
        })

        expect(screen.getByRole('button', { name: 'Создать' })).toBeDisabled()
        expect(screen.getByText('У вас нет разрешения на создание содержимого.')).toHaveAttribute('role', 'status')
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        expect(onOpenCreateTarget).not.toHaveBeenCalled()
    })

    it.each(['public', 'read-only', 'missing-permissions', 'no-handler'] as const)(
        'explains why creation is unavailable in a %s host context',
        async (context) => {
            const onOpenCreateTarget = vi.fn()
            const expectedReason = {
                public: 'Content creation is available to application members.',
                'read-only': 'You do not have permission to create content.',
                'missing-permissions': 'You do not have permission to create content.',
                'no-handler': 'This application does not provide a content creation workflow.'
            }[context]
            renderRuntimeWidget(createTargetWidget(), {
                runtimeAccessMode: context === 'public' ? 'public' : 'member',
                permissions:
                    context === 'missing-permissions' ? undefined : { ...createPermissions, createContent: context !== 'read-only' },
                objectCollections: [{ id: 'host-source', codename: 'Courses' }],
                onOpenCreateTarget: context === 'no-handler' ? undefined : onOpenCreateTarget
            })

            const createButton = screen.getByRole('button', { name: 'Create' })
            expect(createButton).toBeDisabled()
            expect(screen.getByText(expectedReason)).toHaveAttribute('role', 'status')
            expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
            expect(onOpenCreateTarget).not.toHaveBeenCalled()
        }
    )

    it.each(['metadata', 'unavailable', 'create-hidden', 'resource-disabled', 'resource-deferred', 'resource-missing'] as const)(
        'blocks a %s create target and preserves its applicable disabled reason',
        async (restriction) => {
            const user = userEvent.setup()
            const onOpenCreateTarget = vi.fn()
            const target = {
                ...createTarget,
                ...(restriction === 'metadata'
                    ? { disabled: true, disabledReason: { en: 'Creation is paused', ru: 'Создание приостановлено' } }
                    : {}),
                ...(restriction.startsWith('resource-')
                    ? { createDefaults: [{ fieldCodename: 'Resource', resourceSourceType: 'video' as const }] }
                    : {})
            }
            const sources = [
                { id: 'host-source', codename: 'Courses', runtimeConfig: { showCreateButton: restriction !== 'create-hidden' } }
            ]
            renderRuntimeWidget(createTargetWidget(target), {
                permissions: createPermissions,
                objectCollections: restriction === 'unavailable' ? [] : sources,
                resourceSourceTypes:
                    restriction === 'resource-missing'
                        ? []
                        : [
                              {
                                  resourceType: 'video',
                                  enabled: restriction !== 'resource-disabled',
                                  deferred: restriction === 'resource-deferred'
                              }
                          ],
                onOpenCreateTarget
            })

            await user.click(screen.getByRole('button', { name: 'Create' }))
            const item = screen.getByRole('menuitem', { name: /^Course/ })
            expect(item).toHaveAttribute('aria-disabled', 'true')
            if (restriction === 'metadata') expect(item).toHaveTextContent('Creation is paused')
            if (restriction === 'unavailable') expect(item).toHaveTextContent('This content source is no longer available.')
            if (restriction === 'resource-disabled' || restriction === 'resource-missing') {
                expect(item).toHaveTextContent('Video is disabled in application settings.')
            }
            if (restriction === 'resource-deferred') expect(item).toHaveTextContent('Video is planned for a later phase.')
            if (restriction === 'create-hidden') {
                expect(item).toHaveTextContent('Creation is disabled for this content type in application settings.')
            }
            fireEvent.click(item)
            expect(onOpenCreateTarget).not.toHaveBeenCalled()
        }
    )

    it.each(['empty', 'loading', 'permission-denied'] as const)('does not create from a non-ready %s widget', (status) => {
        const onOpenCreateTarget = vi.fn()
        const widget = createTargetWidget()
        widget.runtimeData = { status }
        renderRuntimeWidget(widget, {
            permissions: createPermissions,
            objectCollections: [{ id: 'host-source', codename: 'Courses' }],
            onOpenCreateTarget
        })
        expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
        expect(onOpenCreateTarget).not.toHaveBeenCalled()
    })
})
