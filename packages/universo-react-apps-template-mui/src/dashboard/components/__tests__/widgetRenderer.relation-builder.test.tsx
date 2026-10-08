import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../components/runtime-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../components/runtime-ui')>()
    const { MockFlowListTable } = await import('./widgetRenderer.test-mocks')
    return { ...actual, FlowListTable: MockFlowListTable }
})

vi.mock('../../../components/resource-preview', async () => {
    const { MockResourcePreview } = await import('./widgetRenderer.test-mocks')
    return { ResourcePreview: MockResourcePreview }
})

import { placement, renderRuntimeWidget, resetRuntimeLanguage } from './widgetRenderer.test-support'
import i18n from '@universo-react/i18n'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'

describe('Dashboard runtime widget ownership renderers', () => {
    afterEach(resetRuntimeLanguage)

    it('allows a content-only member to create a related record and explains a denied create action', async () => {
        const user = userEvent.setup()
        const parentRecordHandle = 'rh1.test-0190a9b53cde7abc8def0123456789b1'
        const onOpenCreateTarget = vi.fn()
        const widget = placement(
            'relationBuilder',
            {
                status: 'ready',
                data: {
                    kind: 'relation',
                    parents: [
                        {
                            key: 'course-one',
                            label: 'Course One',
                            target: { entityCodename: 'Courses', recordHandle: parentRecordHandle }
                        }
                    ],
                    panels: [
                        {
                            slotKey: 'panel:lessons',
                            title: 'Lessons',
                            targetEntityCodename: 'CourseItems',
                            parentFieldCodename: 'CourseId',
                            rows: []
                        }
                    ]
                }
            },
            {
                panels: [
                    {
                        slotKey: 'panel:lessons',
                        title: { en: 'Lessons', ru: 'Уроки' },
                        parentFieldCodename: 'CourseId',
                        displayFields: []
                    }
                ]
            }
        )
        const details = {
            runtimeAccessMode: 'member' as const,
            permissions: { createContent: true },
            onOpenCreateTarget
        }
        const { rerender } = renderRuntimeWidget(widget, details)

        expect(screen.getByText('Course One')).toBeInTheDocument()
        const createButton = screen.getByRole('button', { name: 'Create' })
        expect(createButton).toBeEnabled()
        expect(screen.queryByText('You do not have permission to create content.')).not.toBeInTheDocument()
        await user.click(createButton)
        expect(onOpenCreateTarget).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                objectCollectionCodename: 'CourseItems',
                createDefaults: [{ fieldCodename: 'CourseId', contextPath: 'relation.parentRecordId' }],
                createDefaultContext: { relation: { parentRecordId: parentRecordHandle } },
                relationScope: { fieldCodename: 'CourseId', parentRecordId: parentRecordHandle }
            })
        )

        rerender(
            <DashboardDetailsProvider value={{ ...details, permissions: { createContent: false } }}>
                {renderWidget(widget)}
            </DashboardDetailsProvider>
        )
        const deniedCreateButton = screen.getByRole('button', { name: 'Create' })
        expect(deniedCreateButton).toBeDisabled()
        expect(screen.getByText('You do not have permission to create content.')).toHaveAttribute('role', 'status')
        expect(onOpenCreateTarget).toHaveBeenCalledTimes(1)
    })

    it('renders relation panels through shared list primitives with parent-scoped create and row actions', async () => {
        const user = userEvent.setup()
        const parentRecordId = 'rh1.test-0190a9b53cde7abc8def0123456789b1'
        const childRecordId = 'rh1.test-0190a9b53cde7abc8def0123456789b2'
        const secondChildRecordId = 'rh1.test-0190a9b53cde7abc8def0123456789b3'
        const onOpenCreateTarget = vi.fn()
        const onOpenRowTarget = vi.fn()
        const onReorderRelationRows = vi.fn().mockResolvedValue(undefined)
        const { rerender } = renderRuntimeWidget(
            placement(
                'relationBuilder',
                {
                    status: 'ready',
                    data: {
                        kind: 'relation',
                        parents: [
                            {
                                key: 'row-1',
                                label: 'Course One',
                                target: { entityCodename: 'Courses', recordHandle: parentRecordId }
                            }
                        ],
                        panels: [
                            {
                                slotKey: 'panel:items',
                                title: 'Lessons',
                                targetEntityCodename: 'CourseItems',
                                parentFieldCodename: 'CourseId',
                                displayColumns: [{ key: 'display1', label: 'Category' }],
                                rows: [
                                    {
                                        key: 'row-1',
                                        parentKey: 'row-1',
                                        label: 'Lesson One',
                                        cells: [{ key: 'display1', value: 'Core' }],
                                        target: { entityCodename: 'CourseItems', recordHandle: childRecordId, version: 4 }
                                    },
                                    {
                                        key: 'row-2',
                                        parentKey: 'row-1',
                                        label: 'Lesson Two',
                                        cells: [{ key: 'display1', value: 'Advanced' }],
                                        target: { entityCodename: 'CourseItems', recordHandle: secondChildRecordId, version: 9 }
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    enableRowReordering: true,
                    panels: [
                        {
                            slotKey: 'panel:items',
                            title: { en: 'Lessons', ru: 'Уроки' },
                            parentFieldCodename: 'CourseId',
                            displayFields: [{ fieldCodename: 'Category', valueType: 'string', localized: true, required: false }],
                            createDefaults: [{ fieldCodename: 'CourseId', value: 'attacker-value' }],
                            createWizard: {
                                steps: [
                                    {
                                        id: 'lesson-content',
                                        label: { en: 'Lesson content', ru: 'Содержание урока' },
                                        fieldCodenames: ['Title', 'Body']
                                    }
                                ]
                            },
                            rowCountWarning: {
                                threshold: 2,
                                message: { en: 'This parent has many lessons.', ru: 'У этого родителя много уроков.' }
                            }
                        }
                    ]
                }
            ),
            {
                runtimeAccessMode: 'member',
                permissions: { createContent: true, editContent: true, deleteContent: true },
                onOpenCreateTarget,
                onOpenRowTarget,
                relationRowReorder: { onReorder: onReorderRelationRows }
            }
        )
        expect(screen.getByTestId('runtime-relation-builder')).toBeInTheDocument()
        expect(screen.getByText('Course One')).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'Category' })).toBeInTheDocument()
        expect(screen.getByText('Lesson One')).toBeInTheDocument()
        expect(screen.getByText('Core')).toBeInTheDocument()
        expect(screen.getByText('Advanced')).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('This parent has many lessons.')
        expect(document.body).not.toHaveTextContent(parentRecordId)
        expect(document.body).not.toHaveTextContent(childRecordId)
        await user.click(screen.getByRole('button', { name: 'Create' }))
        expect(onOpenCreateTarget).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                objectCollectionCodename: 'CourseItems',
                createDefaults: [{ fieldCodename: 'CourseId', contextPath: 'relation.parentRecordId' }],
                createDefaultContext: { relation: { parentRecordId } },
                createWizard: {
                    steps: [
                        {
                            id: 'lesson-content',
                            label: { en: 'Lesson content', ru: 'Содержание урока' },
                            fieldCodenames: ['Title', 'Body']
                        }
                    ]
                },
                relationScope: { fieldCodename: 'CourseId', parentRecordId }
            })
        )
        await user.click(screen.getByRole('button', { name: 'Actions for Lesson One' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit' }))
        const relationScope = { fieldCodename: 'CourseId', parentRecordId }
        expect(onOpenRowTarget).toHaveBeenNthCalledWith(
            1,
            { rowId: childRecordId, objectCollectionCodename: 'CourseItems', relationScope },
            'edit'
        )
        await user.click(screen.getByRole('button', { name: 'Actions for Lesson One' }))
        await user.click(screen.getByRole('menuitem', { name: 'Copy' }))
        expect(onOpenRowTarget).toHaveBeenNthCalledWith(
            2,
            { rowId: childRecordId, objectCollectionCodename: 'CourseItems', relationScope },
            'copy'
        )
        await user.click(screen.getByRole('button', { name: 'Move second row up' }))
        expect(onReorderRelationRows).toHaveBeenCalledExactlyOnceWith({
            objectCollectionCodename: 'CourseItems',
            parentFieldCodename: 'CourseId',
            parentRecordId,
            orderedRowIds: [secondChildRecordId, childRecordId],
            expectedVersionsByRowId: { [childRecordId]: 4, [secondChildRecordId]: 9 }
        })
        expect(document.body).not.toHaveTextContent(parentRecordId)
        expect(document.body).not.toHaveTextContent(childRecordId)

        rerender(
            <DashboardDetailsProvider value={{ title: 'Runtime', locale: 'en' }}>
                {renderWidget(
                    placement('resourcePreview', {
                        status: 'ready',
                        data: {
                            kind: 'resource',
                            title: 'Reference',
                            source: { type: 'url', url: 'https://example.com', launchMode: 'inline' }
                        }
                    })
                )}
            </DashboardDetailsProvider>
        )
        expect(screen.getByTestId('resource-preview')).toHaveAttribute('data-source', 'https://example.com')
    })

    it('forwards a relation row action with its target entity and parent scope to the host menu', async () => {
        const user = userEvent.setup()
        const parentRecordId = 'rh1.test-0190a9b53cde7abc8def0123456789c1'
        const childRecordId = 'rh1.test-0190a9b53cde7abc8def0123456789c2'
        const onOpenRowMenu = vi.fn()
        renderRuntimeWidget(
            placement(
                'relationBuilder',
                {
                    status: 'ready',
                    data: {
                        kind: 'relation',
                        parents: [
                            { key: 'parent', label: 'Course One', target: { entityCodename: 'Courses', recordHandle: parentRecordId } }
                        ],
                        panels: [
                            {
                                slotKey: 'panel:lessons',
                                title: 'Lessons',
                                targetEntityCodename: 'CourseItems',
                                parentFieldCodename: 'CourseId',
                                displayColumns: [],
                                rows: [
                                    {
                                        key: 'lesson',
                                        parentKey: 'parent',
                                        label: 'Lesson One',
                                        cells: [],
                                        target: { entityCodename: 'CourseItems', recordHandle: childRecordId, version: 4 }
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    panels: [
                        {
                            slotKey: 'panel:lessons',
                            title: { en: 'Lessons', ru: 'Уроки' },
                            parentFieldCodename: 'CourseId',
                            displayFields: []
                        }
                    ]
                }
            ),
            {
                runtimeAccessMode: 'member',
                permissions: { createContent: true, editContent: true, deleteContent: true },
                onOpenRowTarget: vi.fn(),
                onOpenRowMenu
            }
        )

        await user.click(screen.getByRole('button', { name: 'Actions for Lesson One' }))

        expect(onOpenRowMenu).toHaveBeenCalledWith(expect.anything(), childRecordId, {
            entityCodename: 'CourseItems',
            recordHandle: childRecordId,
            relationScope: { fieldCodename: 'CourseId', parentRecordId }
        })
        expect(document.body).not.toHaveTextContent(parentRecordId)
        expect(document.body).not.toHaveTextContent(childRecordId)
    })

    it('passes the selected parent scope when deleting a relation row', async () => {
        const user = userEvent.setup()
        const firstParentRecordId = 'rh1.test-0190a9b53cde7abc8def0123456789c1'
        const selectedParentRecordId = 'rh1.test-0190a9b53cde7abc8def0123456789c2'
        const firstChildRecordId = 'rh1.test-0190a9b53cde7abc8def0123456789c3'
        const selectedChildRecordId = 'rh1.test-0190a9b53cde7abc8def0123456789c4'
        const onOpenRowTarget = vi.fn()
        renderRuntimeWidget(
            placement(
                'relationBuilder',
                {
                    status: 'ready',
                    data: {
                        kind: 'relation',
                        parents: [
                            {
                                key: 'course-one',
                                label: 'Course One',
                                target: { entityCodename: 'Courses', recordHandle: firstParentRecordId }
                            },
                            {
                                key: 'course-two',
                                label: 'Course Two',
                                target: { entityCodename: 'Courses', recordHandle: selectedParentRecordId }
                            }
                        ],
                        panels: [
                            {
                                slotKey: 'panel:items',
                                title: 'Lessons',
                                targetEntityCodename: 'CourseItems',
                                parentFieldCodename: 'CourseId',
                                rows: [
                                    {
                                        key: 'lesson-one',
                                        parentKey: 'course-one',
                                        label: 'Lesson One',
                                        target: { entityCodename: 'CourseItems', recordHandle: firstChildRecordId }
                                    },
                                    {
                                        key: 'lesson-two',
                                        parentKey: 'course-two',
                                        label: 'Lesson Two',
                                        target: { entityCodename: 'CourseItems', recordHandle: selectedChildRecordId }
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    panels: [
                        {
                            slotKey: 'panel:items',
                            title: { en: 'Lessons', ru: 'Уроки' },
                            parentFieldCodename: 'CourseId',
                            displayFields: []
                        }
                    ]
                }
            ),
            {
                runtimeAccessMode: 'member',
                permissions: { deleteContent: true },
                onOpenRowTarget
            }
        )

        await user.click(screen.getByRole('tab', { name: 'Course Two' }))
        expect(screen.queryByText('Lesson One')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Actions for Lesson Two' }))
        await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

        expect(onOpenRowTarget).toHaveBeenCalledExactlyOnceWith(
            {
                rowId: selectedChildRecordId,
                objectCollectionCodename: 'CourseItems',
                relationScope: { fieldCodename: 'CourseId', parentRecordId: selectedParentRecordId }
            },
            'delete'
        )
    })

    it('keeps public relation panels read-only when mutation permissions are present in the host context', () => {
        const parentRecordId = 'rh1.test-0190a9b53cde7abc8def0123456789d1'
        const onOpenCreateTarget = vi.fn()
        const onOpenRowTarget = vi.fn()
        const onReorderRelationRows = vi.fn()

        renderRuntimeWidget(
            placement(
                'relationBuilder',
                {
                    status: 'ready',
                    data: {
                        kind: 'relation',
                        parents: [
                            {
                                key: 'course-one',
                                label: 'Course One',
                                target: { entityCodename: 'Courses', recordHandle: parentRecordId }
                            }
                        ],
                        panels: [
                            {
                                slotKey: 'panel:items',
                                title: 'Lessons',
                                targetEntityCodename: 'CourseItems',
                                parentFieldCodename: 'CourseId',
                                rows: [
                                    {
                                        key: 'lesson-one',
                                        parentKey: 'course-one',
                                        label: 'Lesson One',
                                        target: {
                                            entityCodename: 'CourseItems',
                                            recordHandle: 'rh1.test-0190a9b53cde7abc8def0123456789d2',
                                            version: 1
                                        }
                                    },
                                    {
                                        key: 'lesson-two',
                                        parentKey: 'course-one',
                                        label: 'Lesson Two',
                                        target: {
                                            entityCodename: 'CourseItems',
                                            recordHandle: 'rh1.test-0190a9b53cde7abc8def0123456789d3',
                                            version: 2
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    enableRowReordering: true,
                    panels: [
                        {
                            slotKey: 'panel:items',
                            title: { en: 'Lessons', ru: 'Уроки' },
                            parentFieldCodename: 'CourseId',
                            displayFields: [],
                            enableRowReordering: true
                        }
                    ]
                }
            ),
            {
                runtimeAccessMode: 'public',
                permissions: { createContent: true, editContent: true, deleteContent: true },
                onOpenCreateTarget,
                onOpenRowTarget,
                relationRowReorder: { onReorder: onReorderRelationRows }
            }
        )

        expect(screen.getByTestId('relation-table')).toHaveAttribute('data-sortable', 'false')
        const createButton = screen.getByRole('button', { name: 'Create' })
        expect(createButton).toBeDisabled()
        expect(screen.getByText('Content creation is available to application members.')).toHaveAttribute('role', 'status')
        expect(screen.queryByRole('button', { name: 'Actions for Lesson One' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Move second row up' })).not.toBeInTheDocument()
        expect(onOpenCreateTarget).not.toHaveBeenCalled()
        expect(onOpenRowTarget).not.toHaveBeenCalled()
        expect(onReorderRelationRows).not.toHaveBeenCalled()
    })

    it('shows the configured localized message when a relationBuilder has no parent rows', async () => {
        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        renderRuntimeWidget(
            placement(
                'relationBuilder',
                {
                    status: 'ready',
                    data: {
                        kind: 'relation',
                        parents: [],
                        panels: []
                    }
                },
                {
                    emptyParentMessage: { en: 'Choose a course first.', ru: 'Сначала выберите курс.' },
                    panels: [{ slotKey: 'panel:items', title: { en: 'Lessons', ru: 'Уроки' }, parentFieldCodename: 'CourseId' }]
                }
            ),
            { locale: 'ru' }
        )

        expect(screen.getByRole('status')).toHaveTextContent('Сначала выберите курс.')
    })
})
