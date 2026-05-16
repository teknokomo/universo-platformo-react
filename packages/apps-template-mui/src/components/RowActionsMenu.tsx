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
import { useState, type MouseEvent } from 'react'
import { evaluateWorkflowActionAvailability, readLocalizedTextValue, type WorkflowAction } from '@universo/types'
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
}

type PendingWorkflowConfirmation = {
    rowId: string
    action: WorkflowAction
    title: string
    message: string
    confirmLabel: string
}

const readLocalizedWorkflowText = (value: unknown): string | undefined => readLocalizedTextValue(value)

type RuntimeColumn = NonNullable<CrudDashboardState['appData']>['columns'][number]

const resolveWorkflowStatusColumnName = (action: WorkflowAction, columns: RuntimeColumn[]): string => {
    if (action.statusColumnName) return action.statusColumnName
    if (!action.statusFieldCodename) return '_app_record_state'

    const target = action.statusFieldCodename.trim()
    const column = columns.find((candidate) => candidate.codename === target || candidate.field === target)
    return column?.field ?? target
}

const readWorkflowStatusValue = (row: Record<string, unknown> | null, action: WorkflowAction, columns: RuntimeColumn[]): string => {
    const statusColumnName = resolveWorkflowStatusColumnName(action, columns)
    const value = row?.[statusColumnName]
    return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const hasRuntimeRowVersion = (row: Record<string, unknown> | null): boolean => {
    const rawValue = row?._upl_version
    const value =
        typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' && rawValue.trim().length > 0 ? Number(rawValue) : Number.NaN
    return Number.isInteger(value) && value > 0
}

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
export function RowActionsMenu({ state, labels, permissions }: RowActionsMenuProps) {
    const [pendingWorkflowConfirmation, setPendingWorkflowConfirmation] = useState<PendingWorkflowConfirmation | null>(null)
    const canEdit = permissions?.canEdit === true
    const canCopy = permissions?.canCopy === true
    const canDelete = permissions?.canDelete === true
    const selectedRow = state.menuRowId ? state.rows.find((row) => row.id === state.menuRowId) ?? null : null
    const recordBehavior = state.appData?.objectCollection.recordBehavior
    const canShowRecordCommands = Boolean(state.handleRecordCommand && isRuntimeRecordBehaviorCommandable(recordBehavior) && selectedRow)
    const isRecordCommandPending = Boolean(state.isRecordCommandPending)
    const canShowWorkflowActions = Boolean(state.handleWorkflowAction && selectedRow)
    const workflowCapabilities = state.appData?.workflowCapabilities
    const workflowActions = canShowWorkflowActions
        ? (state.appData?.objectCollection.workflowActions ?? []).filter((action) =>
              isWorkflowActionVisible(selectedRow, action, state.appData?.columns ?? [], workflowCapabilities)
          )
        : []
    const isWorkflowActionPending = Boolean(state.isWorkflowActionPending)

    if (!canEdit && !canCopy && !canDelete && !canShowRecordCommands && workflowActions.length === 0) {
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

        const rowId = state.menuRowId
        state.handleCloseMenu()

        if (!rowId || !state.handleRecordCommand) return
        void state.handleRecordCommand(rowId, command)
    }
    const runWorkflowAction = (event: MouseEvent<HTMLElement>, action: WorkflowAction) => {
        event.preventDefault()
        event.stopPropagation()

        const rowId = state.menuRowId
        if (!rowId || !state.handleWorkflowAction) {
            state.handleCloseMenu()
            return
        }

        const confirmation = action.confirmation
        if (confirmation?.required) {
            const title = readLocalizedWorkflowText(confirmation.title) ?? readLocalizedWorkflowText(action.title) ?? action.codename
            const message =
                readLocalizedWorkflowText(confirmation.message) ??
                readLocalizedWorkflowText(confirmation.title) ??
                readLocalizedWorkflowText(action.title) ??
                action.codename
            const confirmLabel =
                readLocalizedWorkflowText(confirmation.confirmLabel) ??
                labels.confirmText ??
                readLocalizedWorkflowText(action.title) ??
                action.codename
            setPendingWorkflowConfirmation({ rowId, action, title, message, confirmLabel })
            state.handleCloseMenu()
            return
        }

        state.handleCloseMenu()
        void state.handleWorkflowAction(rowId, action.codename)
    }

    return (
        <>
            <Menu
                open={Boolean(state.menuAnchorEl)}
                anchorEl={state.menuAnchorEl}
                onClose={state.handleCloseMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
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
                        {readLocalizedWorkflowText(action.title) ?? action.codename}
                    </MenuItem>
                ))}
                {(hasRecordActions || hasWorkflowActions) && hasCrudActions ? <Divider /> : null}
                {canEdit ? (
                    <MenuItem
                        onClick={() => {
                            if (state.menuRowId) state.handleOpenEdit(state.menuRowId)
                            state.handleCloseMenu()
                        }}
                    >
                        <EditIcon fontSize='small' sx={{ mr: 1 }} />
                        {labels.editText}
                    </MenuItem>
                ) : null}
                {canCopy ? (
                    <MenuItem
                        onClick={() => {
                            if (state.menuRowId) state.handleOpenCopy(state.menuRowId)
                            state.handleCloseMenu()
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
                            if (state.menuRowId) state.handleOpenDelete(state.menuRowId)
                            state.handleCloseMenu()
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
                            if (!pending || !state.handleWorkflowAction) return
                            setPendingWorkflowConfirmation(null)
                            void state.handleWorkflowAction(pending.rowId, pending.action.codename)
                        }}
                    >
                        {pendingWorkflowConfirmation?.confirmLabel ?? labels.confirmText ?? 'Confirm'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
