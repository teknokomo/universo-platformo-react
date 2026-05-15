import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import type { MouseEvent } from 'react'
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
}

/**
 * Shared row-actions dropdown menu (Edit / Delete).
 *
 * Extracts the duplicated `<Menu>` JSX from both `DashboardApp`
 * and `ApplicationRuntime`.
 */
export function RowActionsMenu({ state, labels, permissions }: RowActionsMenuProps) {
    const canEdit = permissions?.canEdit === true
    const canCopy = permissions?.canCopy === true
    const canDelete = permissions?.canDelete === true
    const selectedRow = state.menuRowId ? state.rows.find((row) => row.id === state.menuRowId) ?? null : null
    const recordBehavior = state.appData?.objectCollection.recordBehavior
    const canShowRecordCommands = Boolean(state.handleRecordCommand && isRuntimeRecordBehaviorCommandable(recordBehavior) && selectedRow)
    const isRecordCommandPending = Boolean(state.isRecordCommandPending)

    if (!canEdit && !canCopy && !canDelete && !canShowRecordCommands) {
        return null
    }

    const canPost = canRunRuntimeRecordCommand({ behavior: recordBehavior, row: selectedRow, command: 'post', canEdit })
    const canUnpost = canRunRuntimeRecordCommand({ behavior: recordBehavior, row: selectedRow, command: 'unpost', canEdit })
    const canVoid = canRunRuntimeRecordCommand({ behavior: recordBehavior, row: selectedRow, command: 'void', canEdit })
    const hasCrudActions = canEdit || canCopy || canDelete
    const hasRecordActions = canShowRecordCommands && (canPost || canUnpost || canVoid)
    const runRecordCommand = (event: MouseEvent<HTMLElement>, command: 'post' | 'unpost' | 'void') => {
        event.preventDefault()
        event.stopPropagation()

        const rowId = state.menuRowId
        state.handleCloseMenu()

        if (!rowId || !state.handleRecordCommand) return
        void state.handleRecordCommand(rowId, command)
    }

    return (
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
            {hasRecordActions && hasCrudActions ? <Divider /> : null}
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
    )
}
