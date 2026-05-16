import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RowActionsMenu } from '../RowActionsMenu'
import type { CrudDashboardState } from '../../hooks/useCrudDashboard'

vi.mock('@mui/material/Menu', () => ({
    default: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? <div role='menu'>{children}</div> : null)
}))

const recordBehavior = {
    mode: 'transactional' as const,
    numbering: { enabled: true, scope: 'workspace' as const, periodicity: 'none' as const, minLength: 6 },
    effectiveDate: { enabled: true, defaultToNow: true },
    lifecycle: { enabled: true, states: [] },
    posting: { mode: 'manual' as const, targetLedgers: [] },
    immutability: 'posted' as const
}

const createState = (overrides: Partial<CrudDashboardState> = {}): CrudDashboardState =>
    ({
        appData: {
            objectCollection: {
                id: 'object-1',
                codename: 'documents',
                tableName: 'documents',
                name: 'Documents',
                recordBehavior
            },
            columns: [],
            rows: [{ id: 'row-1', _app_record_state: 'draft' }],
            pagination: { total: 1, limit: 20, offset: 0 },
            layoutConfig: {},
            zoneWidgets: { left: [], right: [], center: [] },
            menus: [],
            activeMenuId: null
        },
        rows: [{ id: 'row-1', _app_record_state: 'draft' }],
        menuAnchorEl: document.body,
        menuRowId: 'row-1',
        handleCloseMenu: vi.fn(),
        handleRecordCommand: vi.fn().mockResolvedValue(undefined),
        ...overrides
    } as unknown as CrudDashboardState)

const labels = {
    editText: 'Edit',
    copyText: 'Copy',
    deleteText: 'Delete',
    postText: 'Post',
    unpostText: 'Unpost',
    voidText: 'Void',
    stateDraftText: 'Draft',
    statePostedText: 'Posted',
    stateVoidedText: 'Voided',
    stateUnknownText: 'State'
}

describe('RowActionsMenu record commands', () => {
    it('shows post and void for draft transactional records', async () => {
        const handleRecordCommand = vi.fn().mockResolvedValue(undefined)
        const handleCloseMenu = vi.fn()
        const state = createState({ handleRecordCommand, handleCloseMenu })

        render(<RowActionsMenu state={state} labels={labels} permissions={{ canEdit: true, canCopy: true, canDelete: true }} />)

        expect(screen.getByText('Draft')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /^post$/i })).toBeEnabled()
        expect(screen.queryByRole('menuitem', { name: /^unpost$/i })).not.toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /^void$/i })).toBeEnabled()

        await userEvent.click(screen.getByRole('menuitem', { name: /^post$/i }))

        expect(handleRecordCommand).toHaveBeenCalledWith('row-1', 'post')
        expect(handleCloseMenu).toHaveBeenCalledTimes(1)
    })

    it('shows unpost and void for posted records', () => {
        const state = createState({
            rows: [{ id: 'row-1', _app_record_state: 'posted' }],
            appData: {
                ...createState().appData!,
                rows: [{ id: 'row-1', _app_record_state: 'posted' }]
            }
        })

        render(<RowActionsMenu state={state} labels={labels} permissions={{ canEdit: true, canCopy: true, canDelete: true }} />)

        expect(screen.getByText('Posted')).toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: /^post$/i })).not.toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /^unpost$/i })).toBeEnabled()
        expect(screen.getByRole('menuitem', { name: /^void$/i })).toBeEnabled()
    })

    it('shows metadata workflow actions from exact capabilities without broad edit permission', async () => {
        const handleWorkflowAction = vi.fn().mockResolvedValue(undefined)
        const handleCloseMenu = vi.fn()
        const appData = createState().appData!
        const row = { id: 'row-1', status: 'submitted', _upl_version: 2 }
        const state = createState({
            rows: [row],
            appData: {
                ...appData,
                columns: [
                    {
                        id: 'status-column',
                        codename: 'SubmissionStatus',
                        field: 'status',
                        dataType: 'STRING',
                        headerName: 'Status'
                    }
                ],
                rows: [row],
                workflowCapabilities: {
                    'assignment.review': true
                },
                objectCollection: {
                    ...appData.objectCollection,
                    workflowActions: [
                        {
                            codename: 'AcceptSubmission',
                            title: 'Accept submission',
                            from: ['submitted'],
                            to: 'accepted',
                            statusFieldCodename: 'SubmissionStatus',
                            requiredCapabilities: ['assignment.review']
                        }
                    ]
                }
            },
            handleWorkflowAction,
            handleCloseMenu
        })

        render(<RowActionsMenu state={state} labels={labels} permissions={{ canEdit: false, canCopy: false, canDelete: false }} />)

        await userEvent.click(screen.getByRole('menuitem', { name: /^accept submission$/i }))

        expect(handleWorkflowAction).toHaveBeenCalledWith('row-1', 'AcceptSubmission')
        expect(handleCloseMenu).toHaveBeenCalledTimes(1)
    })

    it('uses a MUI confirmation dialog for metadata workflow confirmations', async () => {
        const handleWorkflowAction = vi.fn().mockResolvedValue(undefined)
        const handleCloseMenu = vi.fn()
        const appData = createState().appData!
        const row = { id: 'row-1', status: 'submitted', _upl_version: 2 }
        const state = createState({
            rows: [row],
            appData: {
                ...appData,
                columns: [
                    {
                        id: 'status-column',
                        codename: 'SubmissionStatus',
                        field: 'status',
                        dataType: 'STRING',
                        headerName: 'Status'
                    }
                ],
                rows: [row],
                workflowCapabilities: {
                    'assignment.review': true
                },
                objectCollection: {
                    ...appData.objectCollection,
                    workflowActions: [
                        {
                            codename: 'AcceptSubmission',
                            title: 'Accept submission',
                            from: ['submitted'],
                            to: 'accepted',
                            statusFieldCodename: 'SubmissionStatus',
                            requiredCapabilities: ['assignment.review'],
                            confirmation: {
                                required: true,
                                title: 'Confirm review',
                                message: 'Accept this submission?',
                                confirmLabel: 'Accept now'
                            }
                        }
                    ]
                }
            },
            handleWorkflowAction,
            handleCloseMenu
        })

        render(
            <RowActionsMenu
                state={state}
                labels={{ ...labels, cancelText: 'Cancel', confirmText: 'Confirm' }}
                permissions={{ canEdit: false, canCopy: false, canDelete: false }}
            />
        )

        await userEvent.click(screen.getByRole('menuitem', { name: /^accept submission$/i }))

        expect(handleWorkflowAction).not.toHaveBeenCalled()
        expect(handleCloseMenu).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('dialog', { name: 'Confirm review' })).toBeInTheDocument()
        expect(screen.getByText('Accept this submission?')).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Accept now' }))

        expect(handleWorkflowAction).toHaveBeenCalledWith('row-1', 'AcceptSubmission')
    })

    it('hides metadata workflow actions without a current row version', () => {
        const appData = createState().appData!
        const row = { id: 'row-1', Status: 'submitted' }
        const state = createState({
            rows: [row],
            appData: {
                ...appData,
                rows: [row],
                workflowCapabilities: {
                    'assignment.review': true
                },
                objectCollection: {
                    ...appData.objectCollection,
                    workflowActions: [
                        {
                            codename: 'AcceptSubmission',
                            title: 'Accept submission',
                            from: ['submitted'],
                            to: 'accepted',
                            statusColumnName: 'Status',
                            requiredCapabilities: ['assignment.review']
                        }
                    ]
                }
            },
            handleWorkflowAction: vi.fn().mockResolvedValue(undefined)
        })

        render(<RowActionsMenu state={state} labels={labels} permissions={{ canEdit: true, canCopy: true, canDelete: true }} />)

        expect(screen.queryByRole('menuitem', { name: /^accept submission$/i })).not.toBeInTheDocument()
    })

    it('hides metadata workflow actions without the required runtime capability', () => {
        const appData = createState().appData!
        const row = { id: 'row-1', Status: 'submitted', _upl_version: 2 }
        const state = createState({
            rows: [row],
            appData: {
                ...appData,
                rows: [row],
                workflowCapabilities: {
                    'assignment.review': false
                },
                objectCollection: {
                    ...appData.objectCollection,
                    workflowActions: [
                        {
                            codename: 'AcceptSubmission',
                            title: 'Accept submission',
                            from: ['submitted'],
                            to: 'accepted',
                            statusColumnName: 'Status',
                            requiredCapabilities: ['assignment.review']
                        }
                    ]
                }
            },
            handleWorkflowAction: vi.fn().mockResolvedValue(undefined)
        })

        render(<RowActionsMenu state={state} labels={labels} permissions={{ canEdit: true, canCopy: true, canDelete: true }} />)

        expect(screen.queryByRole('menuitem', { name: /^accept submission$/i })).not.toBeInTheDocument()
    })

    it('does not show record commands when editing is denied', () => {
        render(<RowActionsMenu state={createState()} labels={labels} permissions={{ canEdit: false, canCopy: true, canDelete: true }} />)

        expect(screen.queryByRole('menuitem', { name: /^post$/i })).not.toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /^copy$/i })).toBeInTheDocument()
    })
})
