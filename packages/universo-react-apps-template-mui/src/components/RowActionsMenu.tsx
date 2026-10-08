import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import { useState, type MouseEvent, type ReactNode } from 'react'
import {
    evaluateWorkflowActionAvailability,
    readLocalizedTextValue,
    type ObjectRecordBehavior,
    type WorkflowAction
} from '@universo-react/types'
import type { CrudDashboardState } from '../hooks/useCrudDashboard'
import { RuntimeRecordStateChip, canRunRuntimeRecordCommand, isRuntimeRecordBehaviorCommandable } from './RuntimeRecordState'

export interface RowActionsMenuProps {
    /** State object returned by `useCrudDashboard()`. */
    state: CrudDashboardState
    /** i18n-resolved labels. */
    labels: RowActionsMenuLabels
    /** Permission flags from the runtime API. Missing flags disable row mutations. */
    permissions?: {
        canEdit?: boolean
        canCopy?: boolean
        canDelete?: boolean
    }
    /** Optional feature-specific actions rendered before the standard CRUD actions. */
    customActions?: ReactNode
    /** Optional binding-aware row context supplied by the Dashboard host. */
    runtimeContext?: ExternalRowActionsContext
}

export interface RowActionsMenuLabels {
    editText: string
    copyText: string
    deleteText: string
    postText?: string
    unpostText?: string
    voidText?: string
    stateDraftText?: string
    statePostedText?: string
    stateVoidedText?: string
    stateUnknownText?: string
    cancelText?: string
    confirmText?: string
    workflowActionText?: string
    workflowConfirmationTitleText?: string
    workflowConfirmationMessageText?: string
    loadingText?: string
    unavailableText?: string
}

type PendingWorkflowConfirmation = {
    rowId: string
    action: WorkflowAction
    title: string
    message: string
    confirmLabel: string
    run: (rowId: string, actionCodename: string) => Promise<void> | void
}

const readLocalizedWorkflowText = (value: unknown): string | undefined => readLocalizedTextValue(value)

type RuntimeColumn = NonNullable<CrudDashboardState['appData']>['columns'][number]

type ExternalRowActionsContext = {
    menuAnchorEl: HTMLElement | null
    menuRowId: string | null
    row: Record<string, unknown> | null
    columns: RuntimeColumn[]
    recordBehavior?: ObjectRecordBehavior
    workflowActions: WorkflowAction[]
    workflowCapabilities?: Record<string, boolean>
    permissions: { canEdit: boolean; canCopy: boolean; canDelete: boolean }
    isLoading: boolean
    hasError: boolean
    isRecordCommandPending?: boolean
    isWorkflowActionPending?: boolean
    onCloseMenu: () => void
    onRowTargetAction?: (rowId: string, action: 'edit' | 'copy' | 'delete', expectedVersion: number | null) => void
    onRecordCommand?: (rowId: string, command: 'post' | 'unpost' | 'void') => Promise<void> | void
    onWorkflowAction?: (rowId: string, actionCodename: string) => Promise<void> | void
}

const resolveWorkflowStatusColumnName = (action: WorkflowAction, columns: RuntimeColumn[]): string => {
    if (action.statusColumnName) return action.statusColumnName
    if (!action.statusFieldCodename) return '_app_record_state'

    const target = action.statusFieldCodename.trim()
    const column = columns.find((candidate) => candidate.codename === target || candidate.field === target)
    return column?.field ?? target
}

const readRefOptionStatusCodename = (value: unknown, column: RuntimeColumn | undefined): string | null => {
    if (!column || column.dataType !== 'REF') return null

    const refId =
        typeof value === 'string'
            ? value.trim()
            : value && typeof value === 'object' && typeof (value as Record<string, unknown>).id === 'string'
            ? String((value as Record<string, unknown>).id).trim()
            : ''
    const inlineCodename =
        value && typeof value === 'object' && typeof (value as Record<string, unknown>).codename === 'string'
            ? String((value as Record<string, unknown>).codename).trim()
            : ''
    if (inlineCodename) return inlineCodename
    if (!refId) return null

    const options = [...(column.refOptions ?? []), ...(column.enumOptions ?? [])]
    const match = options.find((option) => option.id === refId)
    return typeof match?.codename === 'string' && match.codename.trim().length > 0 ? match.codename.trim() : null
}

const readWorkflowStatusValue = (row: Record<string, unknown> | null, action: WorkflowAction, columns: RuntimeColumn[]): string => {
    const statusColumnName = resolveWorkflowStatusColumnName(action, columns)
    const statusColumn = columns.find((column) => column.field === statusColumnName)
    const value = row?.[statusColumnName]
    const refCodename = readRefOptionStatusCodename(value, statusColumn)
    const statusValue = refCodename ?? (typeof value === 'string' ? value.trim() : '')
    return statusValue.toLowerCase()
}

const readRuntimeRowVersion = (row: Record<string, unknown> | null): number | null => {
    const rawValue = row?._upl_version
    const value =
        typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' && rawValue.trim().length > 0 ? Number(rawValue) : Number.NaN
    return Number.isSafeInteger(value) && value > 0 ? value : null
}

const hasRuntimeRowVersion = (row: Record<string, unknown> | null): boolean => readRuntimeRowVersion(row) !== null

const isWorkflowActionVisible = (
    row: Record<string, unknown> | null,
    action: WorkflowAction,
    columns: RuntimeColumn[],
    capabilities: Record<string, boolean> | undefined
): boolean => {
    if (!row || !hasRuntimeRowVersion(row)) return false
    const statusValue = readWorkflowStatusValue(row, action, columns)
    if (!statusValue) return false
    return evaluateWorkflowActionAvailability({
        action,
        currentStatus: statusValue,
        capabilities
    }).available
}

/**
 * Shared row-actions dropdown menu (Edit / Delete).
 *
 * Extracts the duplicated `<Menu>` JSX from both `DashboardApp`
 * and `ApplicationRuntime`.
 */
export function RowActionsMenu({ state, labels, permissions, customActions, runtimeContext }: RowActionsMenuProps) {
    const [pendingWorkflowConfirmation, setPendingWorkflowConfirmation] = useState<PendingWorkflowConfirmation | null>(null)
    const canEdit = runtimeContext ? runtimeContext.permissions.canEdit : permissions?.canEdit === true
    const canCopy = runtimeContext ? runtimeContext.permissions.canCopy : permissions?.canCopy === true
    const canDelete = runtimeContext ? runtimeContext.permissions.canDelete : permissions?.canDelete === true
    const menuAnchorEl = runtimeContext ? runtimeContext.menuAnchorEl : state.menuAnchorEl
    const menuRowId = runtimeContext ? runtimeContext.menuRowId : state.menuRowId
    const selectedRow = runtimeContext
        ? runtimeContext.row
        : state.menuRowId
        ? state.rows.find((row) => row.id === state.menuRowId) ?? null
        : null
    const columns = runtimeContext ? runtimeContext.columns : state.appData?.columns ?? []
    const recordBehavior = runtimeContext ? runtimeContext.recordBehavior : state.appData?.objectCollection.recordBehavior
    const workflowActionsSource = runtimeContext ? runtimeContext.workflowActions : state.appData?.objectCollection.workflowActions ?? []
    const recordCommandHandler = runtimeContext ? runtimeContext.onRecordCommand : state.handleRecordCommand
    const workflowActionHandler = runtimeContext ? runtimeContext.onWorkflowAction : state.handleWorkflowAction
    const closeMenu = runtimeContext ? runtimeContext.onCloseMenu : state.handleCloseMenu
    const canShowRecordCommands = Boolean(recordCommandHandler && isRuntimeRecordBehaviorCommandable(recordBehavior) && selectedRow)
    const isRecordCommandPending = runtimeContext ? Boolean(runtimeContext.isRecordCommandPending) : Boolean(state.isRecordCommandPending)
    const canShowWorkflowActions = Boolean(workflowActionHandler && selectedRow)
    const workflowCapabilities = runtimeContext ? runtimeContext.workflowCapabilities : state.appData?.workflowCapabilities
    const workflowActions = canShowWorkflowActions
        ? workflowActionsSource.filter((action) => isWorkflowActionVisible(selectedRow, action, columns, workflowCapabilities))
        : []
    const isWorkflowActionPending = runtimeContext
        ? Boolean(runtimeContext.isWorkflowActionPending)
        : Boolean(state.isWorkflowActionPending)

    if (
        !canEdit &&
        !canCopy &&
        !canDelete &&
        !canShowRecordCommands &&
        workflowActions.length === 0 &&
        !customActions &&
        !runtimeContext?.isLoading &&
        !runtimeContext?.hasError
    ) {
        return null
    }

    const canPost = canRunRuntimeRecordCommand({ behavior: recordBehavior, row: selectedRow, command: 'post', canEdit })
    const canUnpost = canRunRuntimeRecordCommand({ behavior: recordBehavior, row: selectedRow, command: 'unpost', canEdit })
    const canVoid = canRunRuntimeRecordCommand({ behavior: recordBehavior, row: selectedRow, command: 'void', canEdit })
    const hasCrudActions = canEdit || canCopy || canDelete
    const hasRecordActions = canShowRecordCommands && (canPost || canUnpost || canVoid)
    const hasWorkflowActions = workflowActions.length > 0
    const runRecordCommand = (event: MouseEvent<HTMLElement>, command: 'post' | 'unpost' | 'void') => {
        event.preventDefault()
        event.stopPropagation()

        const rowId = menuRowId
        closeMenu()

        if (!rowId || !recordCommandHandler) return
        void recordCommandHandler(rowId, command)
    }
    const runWorkflowAction = (event: MouseEvent<HTMLElement>, action: WorkflowAction) => {
        event.preventDefault()
        event.stopPropagation()

        const rowId = menuRowId
        if (!rowId || !workflowActionHandler) {
            closeMenu()
            return
        }

        const confirmation = action.confirmation
        if (confirmation?.required) {
            const actionLabel = readLocalizedWorkflowText(action.title) ?? labels.workflowActionText ?? 'Run action'
            const title =
                readLocalizedWorkflowText(confirmation.title) ??
                labels.workflowConfirmationTitleText ??
                labels.confirmText ??
                'Confirm action'
            const message =
                readLocalizedWorkflowText(confirmation.message) ??
                readLocalizedWorkflowText(confirmation.title) ??
                labels.workflowConfirmationMessageText ??
                actionLabel
            const confirmLabel = readLocalizedWorkflowText(confirmation.confirmLabel) ?? labels.confirmText ?? actionLabel
            setPendingWorkflowConfirmation({ rowId, action, title, message, confirmLabel, run: workflowActionHandler })
            closeMenu()
            return
        }

        closeMenu()
        void workflowActionHandler(rowId, action.codename)
    }
    const runRowTargetAction = (action: 'edit' | 'copy' | 'delete') => {
        const rowId = menuRowId
        closeMenu()
        if (!rowId) return
        if (runtimeContext) {
            runtimeContext.onRowTargetAction?.(rowId, action, readRuntimeRowVersion(selectedRow))
            return
        }
        if (action === 'edit') state.handleOpenEdit(rowId)
        else if (action === 'copy') state.handleOpenCopy(rowId)
        else state.handleOpenDelete(rowId)
    }

    return (
        <>
            <Menu
                open={Boolean(menuAnchorEl?.isConnected)}
                anchorEl={menuAnchorEl?.isConnected ? menuAnchorEl : null}
                onClose={closeMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {runtimeContext?.isLoading ? <MenuItem disabled>{labels.loadingText ?? 'Loading actions…'}</MenuItem> : null}
                {runtimeContext?.hasError ? (
                    <MenuItem disabled>{labels.unavailableText ?? 'Actions are unavailable for this record.'}</MenuItem>
                ) : null}
                {canShowRecordCommands ? (
                    <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                        <RuntimeRecordStateChip
                            row={selectedRow}
                            labels={{
                                draft: labels.stateDraftText ?? 'Draft',
                                posted: labels.statePostedText ?? 'Posted',
                                voided: labels.stateVoidedText ?? 'Voided',
                                unknown: labels.stateUnknownText ?? 'State'
                            }}
                        />
                    </Box>
                ) : null}
                {canPost ? (
                    <MenuItem
                        data-testid='runtime-record-command-post'
                        disabled={isRecordCommandPending}
                        onClick={(event) => {
                            runRecordCommand(event, 'post')
                        }}
                    >
                        <CheckCircleOutlineRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {labels.postText ?? 'Post'}
                    </MenuItem>
                ) : null}
                {canUnpost ? (
                    <MenuItem
                        data-testid='runtime-record-command-unpost'
                        disabled={isRecordCommandPending}
                        onClick={(event) => {
                            runRecordCommand(event, 'unpost')
                        }}
                    >
                        <UndoRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {labels.unpostText ?? 'Unpost'}
                    </MenuItem>
                ) : null}
                {canVoid ? (
                    <MenuItem
                        data-testid='runtime-record-command-void'
                        disabled={isRecordCommandPending}
                        onClick={(event) => {
                            runRecordCommand(event, 'void')
                        }}
                        sx={{ color: 'error.main' }}
                    >
                        <BlockRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {labels.voidText ?? 'Void'}
                    </MenuItem>
                ) : null}
                {workflowActions.map((action) => (
                    <MenuItem
                        key={action.codename}
                        data-testid={`runtime-workflow-action-${action.codename}`}
                        disabled={isWorkflowActionPending}
                        onClick={(event) => {
                            runWorkflowAction(event, action)
                        }}
                    >
                        <CheckCircleOutlineRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {readLocalizedWorkflowText(action.title) ?? labels.workflowActionText ?? 'Run action'}
                    </MenuItem>
                ))}
                {(hasRecordActions || hasWorkflowActions) && hasCrudActions ? <Divider /> : null}
                {customActions}
                {customActions && hasCrudActions ? <Divider /> : null}
                {canEdit ? (
                    <MenuItem
                        onClick={() => {
                            runRowTargetAction('edit')
                        }}
                    >
                        <EditIcon fontSize='small' sx={{ mr: 1 }} />
                        {labels.editText}
                    </MenuItem>
                ) : null}
                {canCopy ? (
                    <MenuItem
                        onClick={() => {
                            runRowTargetAction('copy')
                        }}
                    >
                        <ContentCopyRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {labels.copyText}
                    </MenuItem>
                ) : null}
                {canDelete && (canEdit || canCopy) ? <Divider /> : null}
                {canDelete ? (
                    <MenuItem
                        onClick={() => {
                            runRowTargetAction('delete')
                        }}
                        sx={{ color: 'error.main' }}
                    >
                        <DeleteIcon fontSize='small' sx={{ mr: 1 }} />
                        {labels.deleteText}
                    </MenuItem>
                ) : null}
            </Menu>
            <Dialog
                open={Boolean(pendingWorkflowConfirmation)}
                onClose={() => setPendingWorkflowConfirmation(null)}
                aria-labelledby='runtime-workflow-confirmation-title'
                aria-describedby='runtime-workflow-confirmation-message'
            >
                <DialogTitle id='runtime-workflow-confirmation-title'>{pendingWorkflowConfirmation?.title}</DialogTitle>
                <DialogContent>
                    <DialogContentText id='runtime-workflow-confirmation-message'>{pendingWorkflowConfirmation?.message}</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPendingWorkflowConfirmation(null)}>{labels.cancelText ?? 'Cancel'}</Button>
                    <Button
                        variant='contained'
                        onClick={() => {
                            const pending = pendingWorkflowConfirmation
                            if (!pending) return
                            setPendingWorkflowConfirmation(null)
                            void pending.run(pending.rowId, pending.action.codename)
                        }}
                    >
                        {pendingWorkflowConfirmation?.confirmLabel ?? labels.confirmText ?? 'Confirm'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
